// Sync status component
import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Typography
} from '@mui/material';
import {
  Sync as SyncIcon,
  CloudOff as CloudOffIcon,
  CloudDone as CloudDoneIcon,
  CloudSync as CloudSyncIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useSync } from '../context/SyncContext';

const SyncStatus: React.FC = () => {
  const {
    isOnline,
    pendingCount,
    syncInProgress,
    lastSyncTime,
    bigQueryEnabled,
    forceSync
  } = useSync();

  const getStatusColor = (): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    if (!isOnline) return 'error';
    if (syncInProgress) return 'info';
    if (pendingCount > 0) return 'warning';
    return 'success';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <CloudOffIcon />;
    if (syncInProgress) return <CloudSyncIcon />;
    if (pendingCount > 0) return <ErrorIcon />;
    return <CloudDoneIcon />;
  };

  const getStatusText = (): string => {
    if (!isOnline) return 'Offline';
    if (syncInProgress) return 'Syncing...';
    if (pendingCount > 0) return `${pendingCount} Pending`;
    return 'Synced';
  };

  const getTooltipText = (): string => {
    if (!bigQueryEnabled) return 'BigQuery is not configured. Data is stored locally only.';
    if (!isOnline) return 'You are offline. Changes will sync when you reconnect.';
    if (syncInProgress) return 'Synchronizing data with BigQuery...';
    if (pendingCount > 0) return `${pendingCount} changes waiting to sync. Click to sync now.`;
    if (lastSyncTime) {
      const lastSync = new Date(lastSyncTime);
      return `Last synced: ${lastSync.toLocaleString()}`;
    }
    return 'All data is synchronized with BigQuery';
  };

  const handleSyncClick = async () => {
    if (isOnline && !syncInProgress && bigQueryEnabled) {
      await forceSync();
    }
  };

  // Don't show sync status if BigQuery is not enabled
  if (!bigQueryEnabled) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="BigQuery is not configured. Data is stored locally only.">
          <Chip
            icon={<CloudOffIcon />}
            label="Local Only"
            color="warning"
            size="small"
          />
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={getTooltipText()}>
        <Chip
          icon={getStatusIcon()}
          label={getStatusText()}
          color={getStatusColor()}
          size="small"
          onClick={isOnline && !syncInProgress ? handleSyncClick : undefined}
          clickable={isOnline && !syncInProgress}
        />
      </Tooltip>
      
      {syncInProgress && (
        <Box sx={{ width: 100 }}>
          <LinearProgress />
        </Box>
      )}
      
      {pendingCount > 0 && isOnline && !syncInProgress && (
        <Tooltip title="Sync now">
          <IconButton size="small" onClick={handleSyncClick}>
            <SyncIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default SyncStatus;
