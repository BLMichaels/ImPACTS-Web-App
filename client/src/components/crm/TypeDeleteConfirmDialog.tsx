import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography
} from '@mui/material';

const CONFIRM_WORD = 'DELETE';

export interface TypeDeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Extra body content below the main message */
  children?: React.ReactNode;
  /** Main warning text */
  description?: string;
  /** Controlled typed confirmation (must be exactly DELETE) */
  typedValue: string;
  onTypedChange: (v: string) => void;
  onConfirm: () => void | Promise<void>;
  /** If true, Confirm button stays disabled until typedValue === DELETE */
  requireTypedConfirm?: boolean;
  confirmButtonText?: string;
}

/**
 * Consistent dangerous-action dialog: user must type DELETE (used by Admin CRM and Manager CRM).
 */
export const TypeDeleteConfirmDialog: React.FC<TypeDeleteConfirmDialogProps> = ({
  open,
  onClose,
  title,
  children,
  description = 'This cannot be undone.',
  typedValue,
  onTypedChange,
  onConfirm,
  requireTypedConfirm = true,
  confirmButtonText = 'Delete'
}) => {
  const ok = !requireTypedConfirm || typedValue === CONFIRM_WORD;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="type-delete-confirm-title"
      disableRestoreFocus
    >
      <DialogTitle id="type-delete-confirm-title" sx={{ fontWeight: 700, letterSpacing: -0.01 }}>
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>{description}</Typography>
        {children}
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={typedValue}
          onChange={(e) => onTypedChange(e.target.value)}
          placeholder={CONFIRM_WORD}
          sx={{ mt: 2 }}
          error={typedValue.length > 0 && typedValue !== CONFIRM_WORD}
          helperText={
            typedValue.length > 0 && typedValue !== CONFIRM_WORD
              ? `Must type exactly ${CONFIRM_WORD}`
              : undefined
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="error"
          variant="contained"
          disabled={!ok}
          onClick={() => {
            if (!ok) return;
            void onConfirm();
          }}
        >
          {confirmButtonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
