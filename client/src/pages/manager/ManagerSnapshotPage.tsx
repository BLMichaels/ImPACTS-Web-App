import { Navigate } from 'react-router-dom';

/** Legacy route — team snapshot is now on Manager Overview. */
export default function ManagerSnapshotPage() {
  return <Navigate to="/manager/overview" replace />;
}
