export const formatPermissionLabel = (permissionKey: string): string =>
  permissionKey
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

