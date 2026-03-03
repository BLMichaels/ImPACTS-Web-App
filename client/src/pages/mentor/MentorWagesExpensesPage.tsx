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
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  HelpOutline as HelpIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth, parseISO, getYear, getMonth, isWithinInterval } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { getUserData, setUserData } from '../../utils/userData';

// Constants
const HOURLY_RATE = 30; // $30/hr
const FEDERAL_MILEAGE_RATE = 0.725; // $0.725 per mile for 2026

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

// Interfaces
interface Expense {
  id: string;
  date: string;
  vendor: string;
  description: string;
  category: string;
  receiptFileName: string;
  total: number;
  miles?: number; // Only for Travel Expense
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  managerNotes?: string;
  createdAt: string;
}

interface MonthlyWageData {
  month: number; // 0-11
  monthName: string;
  hoursWorked: number;
  wages: number; // hours × $30
  stipends: number;
  totalPayment: number; // wages + stipends
  monthlyExpenses: number;
  paid?: boolean;
  hoursOnPaymentDate?: number;
  stipendsOnPaymentDate?: number;
  paymentDate?: string;
  hoursAfterPayment?: number; // Hours added after payment
}

interface MentorWagesData {
  receiptsFolderLink?: string;
  monthlyData: MonthlyWageData[];
  expenses: Expense[];
  stipends: Record<string, number>; // month -> stipend amount
}

const MentorWagesExpensesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const currentYear = new Date().getFullYear();
  
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    date: new Date(),
    vendor: '',
    description: '',
    category: '',
    receiptFileName: '',
    total: '',
    miles: ''
  });

  const [wagesData, setWagesData] = useState<MentorWagesData>({ monthlyData: [], expenses: [], stipends: {} });
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    const uid = currentUser?.id;
    if (!uid) return;
    let mounted = true;
    (async () => {
      let wagesVal = await getUserData<MentorWagesData>(uid, 'mentorWages');
      let activitiesVal = await getUserData<any[]>(uid, 'mentorActivities');
      if (wagesVal == null) {
        try {
          const raw = localStorage.getItem(`mentorWages_${uid}`);
          if (raw) {
            wagesVal = JSON.parse(raw) as MentorWagesData;
            await setUserData(uid, 'mentorWages', wagesVal);
            localStorage.removeItem(`mentorWages_${uid}`);
          }
        } catch {}
      }
      if (activitiesVal == null) {
        try {
          const raw = localStorage.getItem(`mentorActivities_${uid}`);
          if (raw) {
            activitiesVal = JSON.parse(raw);
            if (Array.isArray(activitiesVal)) {
              await setUserData(uid, 'mentorActivities', activitiesVal);
              localStorage.removeItem(`mentorActivities_${uid}`);
            }
          }
        } catch {}
      }
      if (!mounted) return;
      if (wagesVal && typeof wagesVal === 'object') setWagesData(wagesVal);
      if (Array.isArray(activitiesVal)) setActivities(activitiesVal);
    })();
    return () => { mounted = false; };
  }, [currentUser?.id]);

  // Calculate monthly hours from activities
  const calculateMonthlyHours = (month: number, year: number): number => {
    const monthStart = startOfMonth(new Date(year, month, 1));
    const monthEnd = endOfMonth(new Date(year, month, 1));
    
    return activities
      .filter(activity => {
        const activityDate = parseISO(activity.date);
        return isWithinInterval(activityDate, { start: monthStart, end: monthEnd });
      })
      .reduce((sum, activity) => sum + (activity.hours || 0), 0);
  };

  // Calculate monthly expenses
  const calculateMonthlyExpenses = (month: number, year: number): number => {
    return wagesData.expenses
      .filter(expense => {
        const expenseDate = parseISO(expense.date);
        return getYear(expenseDate) === year && getMonth(expenseDate) === month;
      })
      .reduce((sum, expense) => sum + expense.total, 0);
  };

  // Generate monthly data for current year
  const monthlyData: MonthlyWageData[] = useMemo(() => {
    const months: MonthlyWageData[] = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    for (let month = 0; month < 12; month++) {
      const hoursWorked = calculateMonthlyHours(month, currentYear);
      const wages = hoursWorked * HOURLY_RATE;
      const stipends = wagesData.stipends[`${currentYear}-${month}`] || 0;
      const totalPayment = wages + stipends;
      const monthlyExpenses = calculateMonthlyExpenses(month, currentYear);
      
      // Get saved payment data
      const savedMonth = wagesData.monthlyData.find(m => m.month === month);
      
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
  }, [activities, wagesData, currentYear]);

  const saveWagesData = async (data: MentorWagesData) => {
    setWagesData(data);
    if (currentUser?.id) await setUserData(currentUser.id, 'mentorWages', data);
  };

  // Expense handlers
  const handleAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      date: new Date(),
      vendor: '',
      description: '',
      category: '',
      receiptFileName: '',
      total: '',
      miles: ''
    });
    setExpenseDialogOpen(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      date: parseISO(expense.date),
      vendor: expense.vendor,
      description: expense.description,
      category: expense.category,
      receiptFileName: expense.receiptFileName,
      total: expense.total.toString(),
      miles: expense.miles?.toString() || ''
    });
    setExpenseDialogOpen(true);
  };

  const handleSaveExpense = () => {
    if (!expenseForm.vendor || !expenseForm.description || !expenseForm.category || !expenseForm.total) {
      return;
    }

    let total = parseFloat(expenseForm.total);
    
    // If Travel Expense, add mileage reimbursement
    if (expenseForm.category === 'Travel Expense' && expenseForm.miles) {
      const miles = parseFloat(expenseForm.miles);
      total += miles * FEDERAL_MILEAGE_RATE;
    }

    const expense: Expense = {
      id: editingExpense?.id || `expense_${Date.now()}`,
      date: format(expenseForm.date, 'yyyy-MM-dd'),
      vendor: expenseForm.vendor,
      description: expenseForm.description,
      category: expenseForm.category,
      receiptFileName: expenseForm.receiptFileName,
      total,
      miles: expenseForm.category === 'Travel Expense' && expenseForm.miles ? parseFloat(expenseForm.miles) : undefined,
      approvalStatus: editingExpense?.approvalStatus || 'pending',
      managerNotes: editingExpense?.managerNotes,
      createdAt: editingExpense?.createdAt || new Date().toISOString()
    };

    const newExpenses = editingExpense
      ? wagesData.expenses.map(e => e.id === expense.id ? expense : e)
      : [...wagesData.expenses, expense];

    saveWagesData({ ...wagesData, expenses: newExpenses });
    setExpenseDialogOpen(false);
  };

  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Delete this expense?')) {
      const newExpenses = wagesData.expenses.filter(e => e.id !== id);
      saveWagesData({ ...wagesData, expenses: newExpenses });
    }
  };

  // Filter expenses by current year
  const currentYearExpenses = useMemo(() => {
    return wagesData.expenses.filter(expense => {
      const expenseDate = parseISO(expense.date);
      return getYear(expenseDate) === currentYear;
    }).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [wagesData.expenses, currentYear]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h4">Wages & Expenses</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddExpense}>
            Add Expense
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Hours are calculated from your logged activities; stipends from Site Milestones stage completions. Log expenses for reimbursement; your manager can approve or reject.
        </Typography>

        {wagesData.receiptsFolderLink && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Receipts Folder:</strong>{' '}
              <Link href={wagesData.receiptsFolderLink} target="_blank" rel="noopener">
                {wagesData.receiptsFolderLink}
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
                </TableRow>
              </TableHead>
              <TableBody>
                {monthlyData.map((month) => (
                  <TableRow key={month.month}>
                    <TableCell>
                      {month.monthName}
                      {month.hoursAfterPayment !== undefined && month.hoursAfterPayment > 0 && (
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
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell><strong>Year Total</strong></TableCell>
                  <TableCell align="right">
                    <strong>{monthlyData.reduce((sum, m) => sum + m.hoursWorked, 0).toFixed(2)}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>${monthlyData.reduce((sum, m) => sum + m.wages, 0).toFixed(2)}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>${monthlyData.reduce((sum, m) => sum + m.stipends, 0).toFixed(2)}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>${monthlyData.reduce((sum, m) => sum + m.totalPayment, 0).toFixed(2)}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>${monthlyData.reduce((sum, m) => sum + m.monthlyExpenses, 0).toFixed(2)}</strong>
                  </TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
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
                      <Typography color="textSecondary" gutterBottom>No expenses recorded yet for {currentYear}</Typography>
                      <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAddExpense}>
                        Add expense
                      </Button>
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
                      <TableCell>
                        {expense.receiptFileName || '—'}
                      </TableCell>
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
                        <IconButton size="small" onClick={() => handleEditExpense(expense)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {expense.approvalStatus === 'pending' && (
                          <IconButton size="small" onClick={() => handleDeleteExpense(expense.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Expense Dialog */}
        <Dialog open={expenseDialogOpen} onClose={() => setExpenseDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <DatePicker
                  label="Date"
                  value={expenseForm.date}
                  onChange={(newValue) => newValue && setExpenseForm(prev => ({ ...prev, date: newValue }))}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Vendor"
                  value={expenseForm.vendor}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, vendor: e.target.value }))}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                  fullWidth
                  required
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value, miles: '' }))}
                    label="Category"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {expenseForm.category === 'Travel Expense' && (
                <Grid item xs={12}>
                  <TextField
                    label="# of Miles *Note: Distance, not time driven"
                    type="number"
                    value={expenseForm.miles}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, miles: e.target.value }))}
                    fullWidth
                    helperText={`Mileage reimbursement: $${FEDERAL_MILEAGE_RATE} per mile`}
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  label="Receipt File Name"
                  value={expenseForm.receiptFileName}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, receiptFileName: e.target.value }))}
                  fullWidth
                  placeholder="e.g., receipt_2026_01_15.pdf"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Total"
                  type="number"
                  value={expenseForm.total}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, total: e.target.value }))}
                  fullWidth
                  required
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                  }}
                  helperText={
                    expenseForm.category === 'Travel Expense' && expenseForm.miles
                      ? `Total: $${parseFloat(expenseForm.total || '0').toFixed(2)} + Mileage: $${(parseFloat(expenseForm.miles || '0') * FEDERAL_MILEAGE_RATE).toFixed(2)} = $${(parseFloat(expenseForm.total || '0') + parseFloat(expenseForm.miles || '0') * FEDERAL_MILEAGE_RATE).toFixed(2)}`
                      : undefined
                  }
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExpenseDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveExpense} 
              variant="contained"
              disabled={!expenseForm.vendor || !expenseForm.description || !expenseForm.category || !expenseForm.total}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default MentorWagesExpensesPage;
