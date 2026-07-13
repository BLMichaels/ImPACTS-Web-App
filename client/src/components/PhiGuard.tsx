import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { logSecurityEvent } from '../utils/securityEvents';
import {
  PhiBlockedError,
  PhiFinding,
  PhiNeedsAcknowledgmentError,
  acknowledgePhiContent,
  enforcePhiScan,
  hashPhiContent,
  phiFindingsToMetadata,
  scanTexts,
  scanUnknownPayload,
  type PhiScanResult,
} from '../utils/phiScanner';

type PhiDialogState =
  | { mode: 'blocked'; findings: PhiFinding[]; surface: string }
  | { mode: 'warn'; findings: PhiFinding[]; surface: string; contentHash: string; resolve: (ok: boolean) => void }
  | null;

interface RunWithPhiGuardArgs {
  texts?: Array<string | null | undefined>;
  payload?: unknown;
  surface: string;
  fieldHint?: string;
  onSave: () => void | Promise<void>;
}

interface PhiGuardContextValue {
  runWithPhiGuard: (args: RunWithPhiGuardArgs) => Promise<boolean>;
  showBlocked: (findings: PhiFinding[], surface: string) => void;
}

const PhiGuardContext = createContext<PhiGuardContextValue | null>(null);

function FindingsList({ findings }: { findings: PhiFinding[] }) {
  return (
    <List dense sx={{ bgcolor: 'action.hover', borderRadius: 1, mb: 1 }}>
      {findings.map((f, i) => (
        <ListItem key={`${f.identifierNumber}-${i}`} alignItems="flex-start">
          <ListItemText
            primary={`#${f.identifierNumber} ${f.category} (${f.severity})`}
            secondary={`${f.message}${f.matchPreview ? ` — ${f.matchPreview}` : ''}`}
          />
        </ListItem>
      ))}
    </List>
  );
}

export const PhiGuardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [dialog, setDialog] = useState<PhiDialogState>(null);
  const [acked, setAcked] = useState(false);

  const showBlocked = useCallback(
    (findings: PhiFinding[], surface: string) => {
      void logSecurityEvent('phi_input_blocked', {
        email: currentUser?.email,
        userId: currentUser?.id,
        metadata: phiFindingsToMetadata(findings, surface),
      });
      setDialog({ mode: 'blocked', findings, surface });
    },
    [currentUser?.email, currentUser?.id]
  );

  const requestAck = useCallback(
    (findings: PhiFinding[], surface: string, contentHash: string) =>
      new Promise<boolean>((resolve) => {
        void logSecurityEvent('phi_input_warned', {
          email: currentUser?.email,
          userId: currentUser?.id,
          metadata: phiFindingsToMetadata(findings, surface),
        });
        setAcked(false);
        setDialog({ mode: 'warn', findings, surface, contentHash, resolve });
      }),
    [currentUser?.email, currentUser?.id]
  );

  const runWithPhiGuard = useCallback(
    async ({ texts, payload, surface, fieldHint, onSave }: RunWithPhiGuardArgs): Promise<boolean> => {
      let result: PhiScanResult =
        texts && texts.length
          ? scanTexts(texts)
          : payload !== undefined
            ? scanUnknownPayload(payload)
            : { findings: [], maxSeverity: 'none' };

      if (texts?.length && payload !== undefined) {
        const a = scanTexts(texts);
        const b = scanUnknownPayload(payload);
        const merged = [...a.findings];
        b.findings.forEach((f) => {
          if (!merged.some((x) => x.identifierNumber === f.identifierNumber && x.matchPreview === f.matchPreview)) {
            merged.push(f);
          }
        });
        result = {
          findings: merged,
          maxSeverity: merged.some((f) => f.severity === 'high')
            ? 'high'
            : merged.length
              ? 'medium'
              : 'none',
        };
      }

      const contentForHash =
        (texts || []).filter(Boolean).join('\n') ||
        (typeof payload === 'string' ? payload : JSON.stringify(payload ?? ''));

      try {
        enforcePhiScan(result, { surface, contentForHash });
      } catch (err) {
        if (err instanceof PhiBlockedError) {
          showBlocked(err.findings, surface);
          return false;
        }
        if (err instanceof PhiNeedsAcknowledgmentError) {
          const ok = await requestAck(err.findings, surface, err.contentHash);
          if (!ok) return false;
          acknowledgePhiContent(err.contentHash);
          void logSecurityEvent('phi_input_acknowledged', {
            email: currentUser?.email,
            userId: currentUser?.id,
            metadata: {
              ...phiFindingsToMetadata(err.findings, surface, fieldHint),
              contentHash: err.contentHash,
            },
          });
        } else {
          throw err;
        }
      }

      await onSave();
      return true;
    },
    [currentUser?.email, currentUser?.id, requestAck, showBlocked]
  );

  const value = useMemo(() => ({ runWithPhiGuard, showBlocked }), [runWithPhiGuard, showBlocked]);

  return (
    <PhiGuardContext.Provider value={value}>
      {children}
      <Dialog
        open={!!dialog}
        onClose={() => {
          if (dialog?.mode === 'warn') dialog.resolve(false);
          setDialog(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        {dialog?.mode === 'blocked' ? (
          <>
            <DialogTitle>Possible PHI detected — save blocked</DialogTitle>
            <DialogContent>
              <Alert severity="error" sx={{ mb: 2 }}>
                This text appears to contain Protected Health Information (HIPAA identifiers). Remove patient
                identifiers before saving. ImPACTS does not allow real patient PHI.
              </Alert>
              <FindingsList findings={dialog.findings} />
              <Typography variant="caption" color="text.secondary">
                Screening is heuristic and may flag false positives. Contact your administrator if you believe this
                is an error.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button
                variant="contained"
                onClick={() => setDialog(null)}
                autoFocus
              >
                OK
              </Button>
            </DialogActions>
          </>
        ) : null}
        {dialog?.mode === 'warn' ? (
          <>
            <DialogTitle>Possible PHI — confirm before saving</DialogTitle>
            <DialogContent>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Automated screening found patterns that might identify a patient. Confirm this does not contain real
                patient PHI before continuing.
              </Alert>
              <FindingsList findings={dialog.findings} />
              <FormControlLabel
                control={<Checkbox checked={acked} onChange={(e) => setAcked(e.target.checked)} />}
                label="I confirm this does not contain real patient Protected Health Information (PHI)."
              />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  dialog.resolve(false);
                  setDialog(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                disabled={!acked}
                onClick={() => {
                  acknowledgePhiContent(dialog.contentHash);
                  dialog.resolve(true);
                  setDialog(null);
                }}
              >
                Save anyway
              </Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>
    </PhiGuardContext.Provider>
  );
};

export function usePhiGuard(): PhiGuardContextValue {
  const ctx = useContext(PhiGuardContext);
  if (!ctx) {
    // Fallback when provider missing: hard-block high only, auto-fail medium
    return {
      showBlocked: () => undefined,
      runWithPhiGuard: async ({ texts, payload, surface, onSave }) => {
        const result = texts?.length ? scanTexts(texts) : scanUnknownPayload(payload);
        const contentForHash = (texts || []).filter(Boolean).join('\n');
        try {
          enforcePhiScan(result, { surface, contentForHash });
          await onSave();
          return true;
        } catch (err) {
          if (err instanceof PhiBlockedError || err instanceof PhiNeedsAcknowledgmentError) {
            console.warn('[PhiGuard]', err.message, err.findings);
            return false;
          }
          throw err;
        }
      },
    };
  }
  return ctx;
}

/** Helper for catch blocks around setUserData / writeContinuityData. */
export function handlePhiPersistenceError(
  err: unknown,
  showBlocked: (findings: PhiFinding[], surface: string) => void
): boolean {
  if (err instanceof PhiBlockedError) {
    showBlocked(err.findings, err.surface);
    return true;
  }
  if (err instanceof PhiNeedsAcknowledgmentError) {
    // Persistence without UI ack — treat as block at this layer
    showBlocked(err.findings, err.surface);
    return true;
  }
  return false;
}

export function previewPhiHash(text: string): string {
  return hashPhiContent(text);
}

/** Simple banner line for pages. */
export const PHI_SCAN_HINT =
  'Free-text is screened for common HIPAA identifiers (SSN, MRN, patient names, etc.). High-risk matches are blocked; uncertain matches require confirmation.';

export default PhiGuardProvider;
