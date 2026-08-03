import { Navigate } from 'react-router-dom';

/** Legacy alias — Snapshot lives at `/manager/snapshot` (ManagerOverviewPage). */
export default function ManagerSnapshotPage() {
  return <Navigate to="/manager/snapshot" replace />;
}
