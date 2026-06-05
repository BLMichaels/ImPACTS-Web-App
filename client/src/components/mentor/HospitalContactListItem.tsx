import React from 'react';
import {
  Avatar,
  Box,
  Chip,
  Divider,
  IconButton,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import type { AssignedHospitalPecc } from '../../utils/mentorHospitalAssignedPeccs';

export interface HospitalContactListItemData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  contactStatus: string;
  roleAtHospital: string;
  isPrimaryContact: boolean;
  isActivelyEngaged: boolean;
  isWorkingWithMentor?: boolean;
  assignedPeccSource?: AssignedHospitalPecc['source'];
}

export function isAutoAssignedHospitalContact(contact: HospitalContactListItemData): boolean {
  return (
    Boolean(contact.assignedPeccSource) ||
    contact.id.startsWith('pecc-') ||
    contact.id.startsWith('hc-') ||
    contact.id.startsWith('crm-')
  );
}

function autoAssignedCopy(contact: HospitalContactListItemData): {
  roleLine: string;
  syncNote: string;
} {
  switch (contact.assignedPeccSource) {
    case 'portal':
      return {
        roleLine:
          contact.isWorkingWithMentor !== false
            ? 'Your assigned PECC · has an ImPACTS login'
            : 'PECC at this site · has an ImPACTS login',
        syncNote: 'Synced automatically — edit in Admin or the PECC account',
      };
    case 'hospital_contact':
      return {
        roleLine: [contact.roleAtHospital || 'PECC', 'on file for this hospital'].filter(Boolean).join(' · '),
        syncNote: 'From hospital contact records',
      };
    case 'crm':
      return {
        roleLine: 'PECC listed in CRM',
        syncNote: contact.contactStatus?.startsWith('CRM')
          ? contact.contactStatus
          : 'Synced from CRM — invite to create a login',
      };
    default:
      return {
        roleLine: contact.roleAtHospital || 'PECC',
        syncNote: 'Synced automatically',
      };
  }
}

function manualContactStatusLine(contact: HospitalContactListItemData): string {
  const parts = [contact.roleAtHospital, contact.contactStatus].map((p) => String(p || '').trim()).filter(Boolean);
  return parts.join(' · ') || 'Contact';
}

interface HospitalContactListItemProps {
  contact: HospitalContactListItemData;
  showDivider?: boolean;
  onEdit?: () => void;
  onToggleWorkingWith?: () => void;
}

export function HospitalContactListItem({
  contact,
  showDivider = false,
  onEdit,
  onToggleWorkingWith,
}: HospitalContactListItemProps) {
  const autoAssigned = isAutoAssignedHospitalContact(contact);
  const fullName = `${contact.firstName} ${contact.lastName}`.trim() || 'Unnamed contact';
  const autoCopy = autoAssigned ? autoAssignedCopy(contact) : null;

  return (
    <>
      <ListItem
        alignItems="flex-start"
        sx={{
          py: 2,
          px: { xs: 0.5, sm: 1 },
          ...(autoAssigned
            ? {
                borderLeft: '3px solid',
                borderColor: 'primary.main',
                pl: 1.5,
                bgcolor: 'action.hover',
                borderRadius: 1,
                mb: 0.5,
              }
            : {}),
        }}
      >
        <ListItemAvatar sx={{ minWidth: 48, mt: 0.25 }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: contact.isPrimaryContact ? 'primary.main' : autoAssigned ? 'primary.light' : 'grey.400',
              color: contact.isPrimaryContact || autoAssigned ? 'primary.contrastText' : 'grey.800',
            }}
          >
            <PersonIcon fontSize="small" />
          </Avatar>
        </ListItemAvatar>

        <Box sx={{ flex: 1, minWidth: 0, pr: 5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
              {fullName}
            </Typography>
            {contact.isPrimaryContact && (
              <Chip label="Primary" size="small" color="primary" variant="outlined" sx={{ height: 22 }} />
            )}
            {!autoAssigned && onToggleWorkingWith && (
              <Chip
                size="small"
                variant={contact.isWorkingWithMentor !== false ? 'filled' : 'outlined'}
                color={contact.isWorkingWithMentor !== false ? 'success' : 'default'}
                label={contact.isWorkingWithMentor !== false ? 'Working with me' : 'Not working with me'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWorkingWith();
                }}
                sx={{ height: 22, cursor: 'pointer' }}
              />
            )}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, lineHeight: 1.45 }}>
            {autoCopy ? autoCopy.roleLine : manualContactStatusLine(contact)}
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: autoAssigned ? 0.75 : 0 }}>
            {contact.email && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                <EmailIcon sx={{ fontSize: 15, color: 'text.secondary', flexShrink: 0 }} />
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                  {contact.email}
                </Typography>
              </Box>
            )}
            {contact.phone && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <PhoneIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                <Typography variant="body2">{contact.phone}</Typography>
              </Box>
            )}
          </Box>

          {autoCopy && (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <SyncIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.disabled">
                {autoCopy.syncNote}
              </Typography>
            </Box>
          )}
        </Box>

        <ListItemSecondaryAction sx={{ top: 16 }}>
          {!autoAssigned && onEdit && (
            <IconButton size="small" onClick={onEdit} aria-label={`Edit ${fullName}`}>
              <EditIcon fontSize="small" />
            </IconButton>
          )}
        </ListItemSecondaryAction>
      </ListItem>
      {showDivider && <Divider component="li" sx={{ ml: 7 }} />}
    </>
  );
}

export default HospitalContactListItem;
