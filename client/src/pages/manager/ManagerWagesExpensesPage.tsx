import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  Grid,
  Link,
  Tabs,
  Tab,
  Checkbox,
  FormControlLabel,
  Tooltip
} from '@mui/material';
import {
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO, getYear, getMonth } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';

// Constants (same as mentor page)
const HOURLY_RATE = 30;
const FEDERAL_MILEAGE_RATE = 0.725;
const EXPENSE_CATEGORIES = [
  'Travel Expense',
  'Program Supplies & Expenses',
  'Marketing - General',
  'Marketing - Print Media',
  'Marketing - Swag & Promotional',
  'Office Supplies & Expenses',
  'Membership Fees & dues',
  'Postage & Shipping',
  'Printing',
  'Publications & Subscriptions',
  'Meetings & Entertainment',
  'Staff Professional Development'
];

// Interfaces (same as mentor page)
interface Expense {
  id: string;
  date: string;
  vendor: string;
  description: string;
  category: string;
  receiptFileName: string;
  total: number;
  miles?: number;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  managerNotes?: string;
  createdAt: string;
}

interface MonthlyWageData {
  month: number;
  monthName: string;
  hoursWorked: number;
  wages: number;
  stipends: number;
  totalPayment: number;
  monthlyExpenses: number;
  paid?: boolean;
  hoursOnPaymentDate?: number;
  stipendsOnPaymentDate?: number;
  paymentDate?: string;
  hoursAfterPayment?: number;
}

interface MentorWagesData {
  receiptsFolderLink?: string;
  monthlyData: MonthlyWageData[];
  expenses: Expense[];
  stipends: Record<string, number>;
}

interface Mentor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const ManagerWagesExpensesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUserProfile();
  const currentYear = new Date().getFullYear();
  
  const [tabValue, setTabValue] = useState(0); // 0 = list view, 1 = mentor detail
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [mentorWagesData, setMentorWagesData] = useState<MentorWagesData | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [receiptsDialogOpen, setReceiptsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  
  const [paymentForm, setPaymentForm] = useState({
    paid: false,
    hoursOnPaymentDate: '',
    stipendsOnPaymentDate: '',
    paymentDate: new Date()
  });

  const [expenseForm, setExpenseForm] = useState({
    approvalStatus: 'pending' as 'pending' | 'approved' | 'rejected',
    managerNotes: ''
  });

  const [receiptsLink, setReceiptsLink] = useState('');

  // Load mentors (those managed by this manager)
  useEffect(() => {
    const loadMentors = async () => {
      if (!currentUser?.id) return;
      
      try {
        // Load mentors from Supabase where manager_id matches current user
        const { data, error } = await supabase
          .from('users')
          .select('id, first_name, last_name, email')
          .eq('role', 'mentor')
          .eq('manager_id', currentUser.id);
        
        if (error) throw error;
        
        if (data) {
          setMentors(data.map(u => ({
            id: u.id,
            firstName: u.first_name || '',
            lastName: u.last_name || '',
            email: u.email || ''
          })));
        }
      } catch (err) {
        console.error('Error loading mentors:', err);
        // Fallback to empty list
        setMentors([]);
      }
    };
    
    loadMentors();
  }, [currentUser]);

  // Load selected mentor's wages data
  useEffect(() => {
    if (selectedMentor?.id) {
      const saved = localStorage.getItem(`mentorWages_${selectedMentor.id}`);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setMentorWagesData(data);
          setReceiptsLink(data.receiptsFolderLink || '');
        } catch {
          setMentorWagesData({ monthlyData: [], expenses: [], stipends: {} });
        }
      } else {
        setMentorWagesData({ monthlyData: [], expenses: [], stipends: {} });
      }
    }
  }, [selectedMentor]);

  // Load activities for selected mentor to calculate hours
  const [activities, setActivities] = useState<any[]>([]);
  useEffect(() => {
    if (selectedMentor?.id) {
      const saved = localStorage.getItem(`mentorActivities_${selectedMentor.id}`);
      if (saved) {
        setActivities(JSON.parse(saved));
      } else {
        setActivities([]);
      }
    }
  }, [selectedMentor]);

  // Calculate monthly hours
  const calculateMonthlyHours = (month: number, year: number): number => {
    return activities
      .filter(activity => {
        const activityDate = parseISO(activity.date);
        return getYear(activityDate) === year && getMonth(activityDate) === month;
      })
      .reduce((sum, activity) => sum + (activity.hours || 0), 0);
  };

  // Calculate monthly expenses
  const calculateMonthlyExpenses = (month: number, year: number): number => {
    if (!mentorWagesData) return 0;
    return mentorWagesData.expenses
      .filter(expense => {
        const expenseDate = parseISO(expense.date);
        return getYear(expenseDate) === year && getMonth(expenseDate) === month;
      })
      .reduce((sum, expense) => sum + expense.total, 0);
  };

  // Generate monthly data
  const monthlyData: MonthlyWageData[] = useMemo(() => {
    if (!mentorWagesData) return [];
    
    const months: MonthlyWageData[] = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    for (let month = 0; month < 12; month++) {
      const hoursWorked = calculateMonthlyHours(month, currentYear);
      const wages = hoursWorked * HOURLY_RATE;
      const stipends = mentorWagesData.stipends[`${currentYear}-${month}`] || 0;
      const totalPayment = wages + stipends;
      const monthlyExpenses = calculateMonthlyExpenses(month, currentYear);
      
      const savedMonth = mentorWagesData.monthlyData.find(m => m.month === month);
      
      months.push({
        month,
        monthName: monthNames[month],
        hoursWorked,
        wages,
        stipends,
        totalPayment,
        monthlyExpenses,
        paid: savedMonth?.paid || false,
        hoursOnPaymentDate: savedMonth?.hoursOnPaymentDate,
        stipendsOnPaymentDate: savedMonth?.stipendsOnPaymentDate,
        paymentDate: savedMonth?.paymentDate,
        hoursAfterPayment: savedMonth?.paid 
          ? Math.max(0, hoursWorked - (savedMonth.hoursOnPaymentDate || 0))
          : 0
      });
    }
    
    return months;
  }, [activities, mentorWagesData, currentYear]);

  // Save mentor wages data
  const saveMentorWagesData = (data: MentorWagesData) => {
    if (selectedMentor?.id) {
      localStorage.setItem(`mentorWages_${selectedMentor.id}`, JSON.stringify(data));
      setMentorWagesData(data);
    }
  };

  // Handle payment update
  const handleOpenPaymentDialog = (month: number) => {
    const monthData = monthlyData.find(m => m.month === month);
    setEditingMonth(month);
    setPaymentForm({
      paid: monthData?.paid || false,
      hoursOnPaymentDate: monthData?.hoursOnPaymentDate?.toString() || '',
      stipendsOnPaymentDate: monthData?.stipendsOnPaymentDate?.toString() || '',
      paymentDate: monthData?.paymentDate ? parseISO(monthData.paymentDate) : new Date()
    });
    setPaymentDialogOpen(true);
  };

  const handleSavePayment = () => {
    if (!mentorWagesData || editingMonth === null || !selectedMentor) return;

    const updatedMonthlyData = [...(mentorWagesData.monthlyData || [])];
    const existingIndex = updatedMonthlyData.findIndex(m => m.month === editingMonth);
    
    const monthData = monthlyData.find(m => m.month === editingMonth);
    const updatedMonth: MonthlyWageData = {
      ...(monthData || {
        month: editingMonth,
        monthName: '',
        hoursWorked: 0,
        wages: 0,
        stipends: 0,
        totalPayment: 0,
        monthlyExpenses: 0
      }),
      paid: paymentForm.paid,
      hoursOnPaymentDate: paymentForm.hoursOnPaymentDate ? parseFloat(paymentForm.hoursOnPaymentDate) : undefined,
      stipendsOnPaymentDate: paymentForm.stipendsOnPaymentDate ? parseFloat(paymentForm.stipendsOnPaymentDate) : undefined,
      paymentDate: paymentForm.paid ? format(paymentForm.paymentDate, 'yyyy-MM-dd') : undefined
    };

    if (existingIndex >= 0) {
      updatedMonthlyData[existingIndex] = updatedMonth;
    } else {
      updatedMonthlyData.push(updatedMonth);
    }

    saveMentorWagesData({ ...mentorWagesData, monthlyData: updatedMonthlyData });
    setPaymentDialogOpen(false);
  };

  // Handle expense approval
  const handleOpenExpenseDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      approvalStatus: expense.approvalStatus || 'pending',
      managerNotes: expense.managerNotes || ''
    });
    setExpenseDialogOpen(true);
  };

  const handleSaveExpenseApproval = () => {
    if (!mentorWagesData || !editingExpense || !selectedMentor) return;

    const updatedExpenses = mentorWagesData.expenses.map(e =>
      e.id === editingExpense.id
        ? { ...e, approvalStatus: expenseForm.approvalStatus, managerNotes: expenseForm.managerNotes }
        : e
    );

    saveMentorWagesData({ ...mentorWagesData, expenses: updatedExpenses });
    setExpenseDialogOpen(false);
  };

  // Handle receipts folder link
  const handleSaveReceiptsLink = () => {
    if (!mentorWagesData || !selectedMentor) return;
    saveMentorWagesData({ ...mentorWagesData, receiptsFolderLink: receiptsLink });
    setReceiptsDialogOpen(false);
  };

  // Filter expenses by current year
  const currentYearExpenses = useMemo(() => {
    if (!mentorWagesData) return [];
    return mentorWagesData.expenses
      .filter(expense => {
        const expenseDate = parseISO(expense.date);
        return getYear(expenseDate) === currentYear;
      })
      .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [mentorWagesData, currentYear]);

  if (tabValue === 0) {
    // List View
    return (
      <Box sx={{ py: 3 }}>
        <Typography variant="h4" gutterBottom>Mentor Wages & Expenses</Typography>
        <Typography color="textSecondary" gutterBottom sx={{ mb: 3 }}>
          View and manage wages and expenses for your mentors
        </Typography>

        {mentors.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="textSecondary">No mentors assigned to you yet</Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Mentor</strong></TableCell>
                  <TableCell><strong>Email</strong></TableCell>
                  <TableCell align="right"><strong>Total Hours ({currentYear})</strong></TableCell>
                  <TableCell align="right"><strong>Total Wages</strong></TableCell>
                  <TableCell align="right"><strong>Total Expenses</strong></TableCell>
                  <TableCell align="center"><strong>Pending Expenses</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mentors.map(mentor => {
                  // Load each mentor's data for summary
                  const saved = localStorage.getItem(`mentorWages_${mentor.id}`);
                  const mentorData: MentorWagesData = saved ? JSON.parse(saved) : { monthlyData: [], expenses: [], stipends: {} };
                  const mentorActivities = JSON.parse(localStorage.getItem(`mentorActivities_${mentor.id}`) || '[]');
                  
                  const totalHours = mentorActivities.reduce((sum: number, a: any) => {
                    const activityDate = parseISO(a.date);
                    return getYear(activityDate) === currentYear ? sum + (a.hours || 0) : sum;
                  }, 0);
                  
                  const totalWages = totalHours * HOURLY_RATE;
                  const totalExpenses = mentorData.expenses
                    .filter(e => getYear(parseISO(e.date)) === currentYear)
                    .reduce((sum, e) => sum + e.total, 0);
                  const pendingExpenses = mentorData.expenses
                    .filter(e => getYear(parseISO(e.date)) === currentYear && e.approvalStatus === 'pending').length;

                  return (
                    <TableRow key={mentor.id}>
                      <TableCell>
                        {mentor.firstName} {mentor.lastName}
                      </TableCell>
                      <TableCell>{mentor.email}</TableCell>
                      <TableCell align="right">{totalHours.toFixed(2)}</TableCell>
                      <TableCell align="right">${totalWages.toFixed(2)}</TableCell>
                      <TableCell align="right">${totalExpenses.toFixed(2)}</TableCell>
                      <TableCell align="center">
                        {pendingExpenses > 0 ? (
                          <Chip label={pendingExpenses} color="warning" size="small" />
                        ) : (
                          <Chip label="0" size="small" />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setSelectedMentor(mentor);
                            setTabValue(1);
                          }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  }

  // Mentor Detail View
  if (!selectedMentor || !mentorWagesData) {
    return (
      <Box sx={{ py: 3 }}>
        <Button onClick={() => setTabValue(0)} sx={{ mb: 2 }}>← Back to List</Button>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Button onClick={() => setTabValue(0)} sx={{ mb: 1 }}>← Back to List</Button>
            <Typography variant="h4">
              {selectedMentor.firstName} {selectedMentor.lastName} - Wages & Expenses
            </Typography>
            <Typography color="textSecondary">{selectedMentor.email}</Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={() => {
              setReceiptsLink(mentorWagesData.receiptsFolderLink || '');
              setReceiptsDialogOpen(true);
            }}
          >
            Set Receipts Folder
          </Button>
        </Box>

        {mentorWagesData.receiptsFolderLink && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Receipts Folder:</strong>{' '}
              <Link href={mentorWagesData.receiptsFolderLink} target="_blank" rel="noopener">
                {mentorWagesData.receiptsFolderLink}
              </Link>
            </Typography>
          </Alert>
        )}

        {/* Monthly Breakdown Table */}
        <Paper sx={{ mb: 4 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Monthly Breakdown - {currentYear}</Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Month</strong></TableCell>
                  <TableCell align="right"><strong>Hours Worked</strong></TableCell>
                  <TableCell align="right"><strong>Wages</strong></TableCell>
                  <TableCell align="right"><strong>Stipends</strong></TableCell>
                  <TableCell align="right"><strong>Total Payment</strong></TableCell>
                  <TableCell align="right"><strong>Monthly Expenses</strong></TableCell>
                  <TableCell align="center"><strong>Paid?</strong></TableCell>
                  <TableCell align="right"><strong>Hours on Payment Date</strong></TableCell>
                  <TableCell align="right"><strong>Stipends on Payment Date</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthlyData.map((month) => (
                  <TableRow key={month.month}>
                    <TableCell>
                      {month.monthName}
                      {month.hoursAfterPayment && month.hoursAfterPayment > 0 && (
                        <Tooltip title={`${month.hoursAfterPayment.toFixed(2)} hours submitted after payment`}>
                          <Chip 
                            label={`+${month.hoursAfterPayment.toFixed(1)}h`} 
                            size="small" 
                            color="warning" 
                            sx={{ ml: 1 }}
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="right">{month.hoursWorked.toFixed(2)}</TableCell>
                    <TableCell align="right">${month.wages.toFixed(2)}</TableCell>
                    <TableCell align="right">${month.stipends.toFixed(2)}</TableCell>
                    <TableCell align="right"><strong>${month.totalPayment.toFixed(2)}</strong></TableCell>
                    <TableCell align="right">${month.monthlyExpenses.toFixed(2)}</TableCell>
                    <TableCell align="center">
                      {month.paid ? (
                        <Chip label="Yes" color="success" size="small" />
                      ) : (
                        <Chip label="No" size="small" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {month.hoursOnPaymentDate !== undefined ? month.hoursOnPaymentDate.toFixed(2) : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {month.stipendsOnPaymentDate !== undefined ? `$${month.stipendsOnPaymentDate.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleOpenPaymentDialog(month.month)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Expenses Log */}
        <Paper>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Expense Reimbursements</Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell><strong>Vendor</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell><strong>Category</strong></TableCell>
                  <TableCell align="right"><strong>Miles</strong></TableCell>
                  <TableCell><strong>Receipt</strong></TableCell>
                  <TableCell align="right"><strong>Total</strong></TableCell>
                  <TableCell align="center"><strong>Approval</strong></TableCell>
                  <TableCell><strong>Notes</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentYearExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      <Typography color="textSecondary">No expenses recorded</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentYearExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{format(parseISO(expense.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{expense.vendor}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>
                        <Chip label={expense.category} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        {expense.miles ? `${expense.miles} mi` : '—'}
                      </TableCell>
                      <TableCell>{expense.receiptFileName || '—'}</TableCell>
                      <TableCell align="right">${expense.total.toFixed(2)}</TableCell>
                      <TableCell align="center">
                        {expense.approvalStatus === 'approved' && (
                          <Chip icon={<ApprovedIcon />} label="Approved" color="success" size="small" />
                        )}
                        {expense.approvalStatus === 'rejected' && (
                          <Chip icon={<RejectedIcon />} label="Rejected" color="error" size="small" />
                        )}
                        {expense.approvalStatus === 'pending' && (
                          <Chip label="Pending" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        {expense.managerNotes || '—'}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => handleOpenExpenseDialog(expense)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Update Payment Information</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={paymentForm.paid}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, paid: e.target.checked }))}
                    />
                  }
                  label="Paid?"
                />
              </Grid>
              {paymentForm.paid && (
                <>
                  <Grid item xs={12}>
                    <DatePicker
                      label="Payment Date"
                      value={paymentForm.paymentDate}
                      onChange={(newValue) => newValue && setPaymentForm(prev => ({ ...prev, paymentDate: newValue }))}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Hours on Payment Date"
                      type="number"
                      value={paymentForm.hoursOnPaymentDate}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, hoursOnPaymentDate: e.target.value }))}
                      fullWidth
                      helperText="Number of hours worked at the time of payment"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Stipends on Payment Date"
                      type="number"
                      value={paymentForm.stipendsOnPaymentDate}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, stipendsOnPaymentDate: e.target.value }))}
                      fullWidth
                      InputProps={{
                        startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                      }}
                      helperText="Stipend amount paid"
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePayment} variant="contained">Save</Button>
          </DialogActions>
        </Dialog>

        {/* Expense Approval Dialog */}
        <Dialog open={expenseDialogOpen} onClose={() => setExpenseDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Approve/Reject Expense</DialogTitle>
          <DialogContent>
            {editingExpense && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary">
                    <strong>Date:</strong> {format(parseISO(editingExpense.date), 'MMM d, yyyy')}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    <strong>Vendor:</strong> {editingExpense.vendor}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    <strong>Description:</strong> {editingExpense.description}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    <strong>Total:</strong> ${editingExpense.total.toFixed(2)}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Approval Status</InputLabel>
                    <Select
                      value={expenseForm.approvalStatus}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, approvalStatus: e.target.value as any }))}
                      label="Approval Status"
                    >
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="approved">Approved</MenuItem>
                      <MenuItem value="rejected">Rejected</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Notes"
                    value={expenseForm.managerNotes}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, managerNotes: e.target.value }))}
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Add any notes about this expense..."
                  />
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExpenseDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveExpenseApproval} variant="contained">Save</Button>
          </DialogActions>
        </Dialog>

        {/* Receipts Folder Dialog */}
        <Dialog open={receiptsDialogOpen} onClose={() => setReceiptsDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Set Receipts Folder Link</DialogTitle>
          <DialogContent>
            <TextField
              label="Receipts Folder URL"
              value={receiptsLink}
              onChange={(e) => setReceiptsLink(e.target.value)}
              fullWidth
              sx={{ mt: 2 }}
              placeholder="https://drive.google.com/..."
              helperText="Enter the link to the mentor's receipts folder"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReceiptsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveReceiptsLink} variant="contained">Save</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default ManagerWagesExpensesPage;
