import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Link,
  Tooltip,
  useMediaQuery,
  useTheme,
  Container,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '../context/UserProfileContext';
import { useAuth } from '../context/AuthContext';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import GapPlanReminderBanner from '../components/GapPlanReminderBanner';
import DashboardResources from '../components/DashboardResources';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface DepartmentContact {
  id: string;
  department: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
}

  const DashboardPage = () => {
    const { userProfile } = useUserProfile();
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    
    // Mobile responsiveness
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    
    
  const [departmentContacts, setDepartmentContacts] = useState<DepartmentContact[]>([
    { id: '1', department: 'Chief Nursing Officer', contactName: '', phone: '', email: '', notes: '' },
    { id: '2', department: 'Chief Medical Officer', contactName: '', phone: '', email: '', notes: '' },
    { id: '3', department: 'Trauma Coordinator', contactName: '', phone: '', email: '', notes: '' },
    { id: '4', department: 'Emergency Nursing Director', contactName: '', phone: '', email: '', notes: '' },
    { id: '5', department: 'Emergency Medical Director', contactName: '', phone: '', email: '', notes: '' },
    { id: '6', department: 'Emergency Manager(s)', contactName: '', phone: '', email: '', notes: '' },
    { id: '7', department: 'Pharmacy Director', contactName: '', phone: '', email: '', notes: '' },
    { id: '8', department: 'Respiratory Therapy Director or Educator', contactName: '', phone: '', email: '', notes: '' },
    { id: '9', department: 'Pediatric Educator', contactName: '', phone: '', email: '', notes: '' },
    { id: '10', department: 'Emergency Dept Educator', contactName: '', phone: '', email: '', notes: '' },
    { id: '11', department: 'Peds Social Worker', contactName: '', phone: '', email: '', notes: '' },
    { id: '12', department: 'PICU Manager', contactName: '', phone: '', email: '', notes: '' },
    { id: '13', department: 'Pediatric Unit Manager', contactName: '', phone: '', email: '', notes: '' },
    { id: '14', department: 'Information Systems Contact', contactName: '', phone: '', email: '', notes: '' },
    { id: '15', department: 'Pediatric Hospitalist (Point Person)', contactName: '', phone: '', email: '', notes: '' },
    { id: '16', department: 'Pediatric Intensivist (Point Person)', contactName: '', phone: '', email: '', notes: '' },
    { id: '17', department: 'Pediatric Readiness Mentor', contactName: '', phone: '', email: '', notes: '' },
    { id: '18', department: 'Pediatric and/or Emergency Clinical Nurse Specialist', contactName: '', phone: '', email: '', notes: '' },
    { id: '19', department: 'OTHER CONTACT 1', contactName: '', phone: '', email: '', notes: '' },
    { id: '20', department: 'OTHER CONTACT 2', contactName: '', phone: '', email: '', notes: '' },
    { id: '21', department: 'OTHER CONTACT 3', contactName: '', phone: '', email: '', notes: '' },
    { id: '22', department: 'OTHER CONTACT 4', contactName: '', phone: '', email: '', notes: '' },
    { id: '23', department: 'OTHER CONTACT 5', contactName: '', phone: '', email: '', notes: '' },
    { id: '24', department: 'OTHER CONTACT 6', contactName: '', phone: '', email: '', notes: '' },
    { id: '25', department: 'OTHER CONTACT 7', contactName: '', phone: '', email: '', notes: '' },
    { id: '26', department: 'OTHER CONTACT 8', contactName: '', phone: '', email: '', notes: '' },
    { id: '27', department: 'OTHER CONTACT 9', contactName: '', phone: '', email: '', notes: '' },
    { id: '28', department: 'OTHER CONTACT 10', contactName: '', phone: '', email: '', notes: '' }
  ]);

  const [sortConfig, setSortConfig] = useState<{
    key: keyof DepartmentContact;
    direction: 'asc' | 'desc';
  } | null>(null);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    contactId: string | null;
    contactName: string;
  }>({
    open: false,
    contactId: null,
    contactName: ''
  });

  const handleContactUpdate = (id: string, field: keyof DepartmentContact, value: string) => {
    setDepartmentContacts(prev => prev.map(contact => 
      contact.id === id ? { ...contact, [field]: value } : contact
    ));
  };

  const handleSort = (key: keyof DepartmentContact) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedContacts = () => {
    if (!sortConfig) return departmentContacts;
    
    return [...departmentContacts].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const addNewContact = () => {
    const newId = (Math.max(...departmentContacts.map(c => parseInt(c.id))) + 1).toString();
    const newContact: DepartmentContact = {
      id: newId,
      department: `NEW CONTACT ${newId}`,
      contactName: '',
      phone: '',
      email: '',
      notes: ''
    };
    setDepartmentContacts([...departmentContacts, newContact]);
  };

  const deleteContact = (id: string) => {
    setDepartmentContacts(prev => prev.filter(contact => contact.id !== id));
  };

  const handleDeleteContact = (contact: DepartmentContact) => {
    setDeleteConfirmDialog({
      open: true,
      contactId: contact.id,
      contactName: contact.department
    });
  };

  const confirmDeleteContact = () => {
    if (deleteConfirmDialog.contactId) {
      deleteContact(deleteConfirmDialog.contactId);
      setDeleteConfirmDialog({
        open: false,
        contactId: null,
        contactName: ''
      });
    }
  };

  const cancelDeleteContact = () => {
    setDeleteConfirmDialog({
      open: false,
      contactId: null,
      contactName: ''
    });
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: isMobile ? 2 : 4 }}>
        <GapPlanReminderBanner />
        
        {/* Welcome Section */}
        <Box sx={{ mb: isMobile ? 3 : 4 }}>
          <Typography variant={isMobile ? "h4" : "h3"} gutterBottom color="primary">
            Welcome back, {(userProfile as any)?.firstName || (userProfile as any)?.first_name || 'PECC'}!
          </Typography>
          <Typography variant={isMobile ? "body1" : "h6"} color="text.secondary" sx={{ mb: 2 }}>
            Your Pediatric Readiness Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track your progress, manage resources, and coordinate with your hospital team to improve pediatric emergency care readiness.
          </Typography>
        </Box>


        {/* How This Dashboard Works Section */}
        <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: isMobile ? 3 : 4 }}>
          <Grid item xs={12}>
          <Card sx={{ p: 2 }}>
            <CardContent>
              <Typography variant="h4" gutterBottom color="primary" sx={{ mb: 2 }}>
                How This Dashboard Works
              </Typography>
              
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.4 }}>
                Welcome to your ImPACTS PECC Tracker! This dashboard is designed to guide you through your Pediatric Emergency Care Coordinator journey. Here's how to get started:
              </Typography>
              
              <Grid container spacing={isMobile ? 1 : 2} sx={{ mt: 2 }}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 1 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      📋 Checklist
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Track your progress through 4 stages: Establish, Implement, Lead, and Sustain. Each stage has specific objectives and tasks to complete.
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 1 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      📊 Assessment
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Complete your facility's Pediatric Readiness Assessment and create gap reduction plans to address identified areas for improvement.
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 1 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      📝 Activities
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Log your PECC activities, simulations, and training sessions. Track your time commitment and document your impact.
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 1 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      📈 Snapshot
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      View analytics, charts, and metrics from your activities, milestones, assessment, and gap plans to track your overall progress.
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 1 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      🎯 Gap Plans
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Manage and track your gap reduction action plans. Prioritize improvements and monitor progress toward pediatric readiness goals.
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2, lineHeight: 1.4 }}>
                <strong>Pro Tip:</strong> Start with the Checklist tab to understand your journey, then use the Assessment tab to identify gaps, and log your activities to track your progress. Your pediatric readiness mentor will guide you through each stage!
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Hospital Department Contacts Section */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" color="primary">
            Hospital Department Contacts
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant={isEditMode ? "contained" : "outlined"}
              startIcon={<EditIcon />}
              onClick={() => setIsEditMode(!isEditMode)}
              sx={{ fontSize: '0.875rem' }}
            >
              {isEditMode ? 'Exit Edit' : 'Edit Mode'}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={addNewContact}
              sx={{ fontSize: '0.875rem' }}
            >
              Add Contact
            </Button>
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Click on column headers to sort departments. Click in any field to edit contact information.
        </Typography>
        <Card>
          <CardContent>
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th 
                      style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 'bold', cursor: 'pointer' }}
                      onClick={() => handleSort('department')}
                    >
                      Department {sortConfig?.key === 'department' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 'bold', cursor: 'pointer' }}
                      onClick={() => handleSort('contactName')}
                    >
                      Contact Name {sortConfig?.key === 'contactName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 'bold', cursor: 'pointer' }}
                      onClick={() => handleSort('phone')}
                    >
                      Phone {sortConfig?.key === 'phone' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 'bold', cursor: 'pointer' }}
                      onClick={() => handleSort('email')}
                    >
                      Email {sortConfig?.key === 'email' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 'bold', cursor: 'pointer' }}
                      onClick={() => handleSort('notes')}
                    >
                      Notes {sortConfig?.key === 'notes' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    {isEditMode && (
                      <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 'bold', width: '80px' }}>
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {getSortedContacts().map((contact) => (
                    <tr
                      key={contact.id}
                      style={{ 
                        borderBottom: '1px solid #ddd',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <td style={{ padding: '12px', border: '1px solid #ddd', fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
                        {isEditMode ? (
                          <TextField
                            fullWidth
                            size="small"
                            placeholder="Enter department name"
                            variant="outlined"
                            value={contact.department}
                            onChange={(e) => handleContactUpdate(contact.id, 'department', e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { border: 'none' } }}
                          />
                        ) : (
                          contact.department
                        )}
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Enter name"
                          variant="outlined"
                          value={contact.contactName}
                          onChange={(e) => handleContactUpdate(contact.id, 'contactName', e.target.value)}
                          sx={{ '& .MuiOutlinedInput-root': { border: 'none' } }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Enter phone"
                          variant="outlined"
                          value={contact.phone}
                          onChange={(e) => handleContactUpdate(contact.id, 'phone', e.target.value)}
                          sx={{ '& .MuiOutlinedInput-root': { border: 'none' } }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Enter email"
                          variant="outlined"
                          value={contact.email}
                          onChange={(e) => handleContactUpdate(contact.id, 'email', e.target.value)}
                          sx={{ '& .MuiOutlinedInput-root': { border: 'none' } }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Add notes"
                          variant="outlined"
                          value={contact.notes}
                          onChange={(e) => handleContactUpdate(contact.id, 'notes', e.target.value)}
                          sx={{ '& .MuiOutlinedInput-root': { border: 'none' } }}
                        />
                      </td>
                      {isEditMode && (
                        <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteContact(contact)}
                            sx={{ p: 0.5 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <DashboardResources userId={currentUser?.uid} isMobile={isMobile} />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.open}
        onClose={cancelDeleteContact}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography id="delete-dialog-description">
            Are you sure you want to delete the contact for {deleteConfirmDialog.contactName}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDeleteContact} color="primary">
            Cancel
          </Button>
          <Button onClick={confirmDeleteContact} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Container>
  );
};

export default DashboardPage;
