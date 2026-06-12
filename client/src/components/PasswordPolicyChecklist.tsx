import React from 'react';
import { Box, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import {
  getPasswordPolicyChecks,
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
  type PasswordPolicyCheck,
} from '../utils/passwordPolicy';

interface PasswordPolicyChecklistProps {
  password: string;
  /** When true, unmet required rules use error coloring. */
  showValidation?: boolean;
  compact?: boolean;
}

function checkColor(check: PasswordPolicyCheck, showValidation: boolean): string {
  if (check.met) return 'success.main';
  if (!showValidation) return 'text.secondary';
  if (check.required) return 'error.main';
  return 'warning.main';
}

function CheckIcon({ check, showValidation }: { check: PasswordPolicyCheck; showValidation: boolean }) {
  const color = checkColor(check, showValidation);
  if (check.met) {
    return <CheckCircleOutlineIcon sx={{ fontSize: 18, color, mt: '1px' }} aria-hidden />;
  }
  if (showValidation && check.required) {
    return <CancelOutlinedIcon sx={{ fontSize: 18, color, mt: '1px' }} aria-hidden />;
  }
  return <RadioButtonUncheckedIcon sx={{ fontSize: 18, color, mt: '1px' }} aria-hidden />;
}

const PasswordPolicyChecklist: React.FC<PasswordPolicyChecklistProps> = ({
  password,
  showValidation = false,
  compact = false,
}) => {
  const checks = getPasswordPolicyChecks(password);

  return (
    <Box
      component="ul"
      role="list"
      aria-label="Password requirements"
      sx={{
        m: 0,
        mt: compact ? 1 : 1.5,
        p: compact ? 1.25 : 1.5,
        listStyle: 'none',
        borderRadius: 1.5,
        bgcolor: showValidation ? 'action.hover' : 'transparent',
        border: '1px solid',
        borderColor: showValidation ? 'divider' : 'transparent',
      }}
    >
      {checks
        .filter((check) => check.id !== 'not_whitespace' || (showValidation && !check.met))
        .map((check) => (
          <Box
            component="li"
            key={check.id}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              py: 0.35,
            }}
          >
            <CheckIcon check={check} showValidation={showValidation} />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  color: checkColor(check, showValidation),
                  fontWeight: check.required && showValidation && !check.met ? 600 : 400,
                  lineHeight: 1.4,
                }}
              >
                {check.label}
                {check.required ? ' (required)' : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {check.example}
              </Typography>
            </Box>
          </Box>
        ))}
      {!compact && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, pl: 3.25 }}>
          Tip: a long passphrase with mixed character types is easier to remember and harder to guess.
        </Typography>
      )}
    </Box>
  );
};

export function passwordFieldHelperText(password: string, showValidation: boolean): string | undefined {
  if (!showValidation) {
    return `At least ${MIN_PASSWORD_LENGTH} characters with uppercase, lowercase, a number, and a symbol.`;
  }
  const error = password.length > 0 ? validateNewPassword(password) : null;
  return error ?? undefined;
}

export default PasswordPolicyChecklist;
