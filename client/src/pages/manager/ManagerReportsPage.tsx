import React from 'react';
import { Navigate } from 'react-router-dom';

/** Legacy URL — Team hub owns reports now. */
const ManagerReportsPage: React.FC = () => <Navigate to="/manager/team?tab=reports" replace />;

export default ManagerReportsPage;
