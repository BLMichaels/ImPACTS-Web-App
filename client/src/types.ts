// Essential type definitions for the application
export interface User {
  id: string;
  email: string;
  termsAccepted?: boolean;
  termsAcceptedDate?: string;
}
export interface Activity {
  id: string;
  title: string;
  description: string;
  date: string;
  hours: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: string;
}


