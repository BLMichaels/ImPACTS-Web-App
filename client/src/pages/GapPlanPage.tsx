import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Chip,
  SelectChangeEvent,
  Alert,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { Upload as UploadIcon, Image as ImageIcon, Delete as DeleteIcon, ExpandMore as ExpandMoreIcon, School as SchoolIcon, DragIndicator as DragIndicatorIcon } from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useUsageAnalytics } from '../context/UsageAnalyticsContext';
import { supabase } from '../supabase';
import {
  getUserData,
  setUserData,
  migrateFromLocalStorage,
  getHospitalData,
  setHospitalData,
  resolveHospitalUuid,
} from '../utils/userData';
import TableChartIcon from '@mui/icons-material/TableChart';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GapPlanReminderBanner from '../components/GapPlanReminderBanner';
import EducationPage from './EducationPage';
import { GAP_PLANS_UPDATED_EVENT } from './EducationPage';
import { EDUCATION_BUCKETS } from '../constants/educationBuckets';

const DOMAIN_ACCORDION_COLORS = [
  { bg: 'rgba(25, 118, 210, 0.18)', border: '#1976d2' },
  { bg: 'rgba(46, 125, 50, 0.2)', border: '#2e7d32' },
  { bg: 'rgba(123, 31, 162, 0.18)', border: '#7b1fa2' },
  { bg: 'rgba(245, 124, 0, 0.2)', border: '#f57c00' },
  { bg: 'rgba(0, 150, 136, 0.18)', border: '#009688' },
  { bg: 'rgba(233, 30, 99, 0.18)', border: '#e91e63' }
];

interface GapPlan {
  id: string;
  questionId: string;
  questionText: string;
  action: string;
  owner: string;
  status: 'In Progress' | 'Needs Update' | 'Need to Develop' | 'Cannot be done at this time' | 'Completed' | '';
  priority: 'High Importance & High Urgency (Do Now)' | 'High Importance & Low Urgency (Do Next)' | 'Low Importance & High Effort (Do Later)' | 'Low Importance & Low Urgency (Do Last)' | '';
  difficulty: 'Low Impact & Low Effort (Filler Tasks)' | 'Low Impact & High Effort (Hard Slogs)' | 'High Impact & Low Effort (Quick Wins)' | 'High Impact & High Effort (Big Projects)' | '';
  notes: string;
  dueDate: string;
  completionDate: string;
  rank: number | '';
  attachments: GapPlanAttachment[];
}

interface GapPlanAttachment {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'image';
  fileSize: number;
  uploadedAt: Date;
  fileData?: string; // Base64 encoded file data for storage
}

const GapPlanPage: React.FC = () => {
  useAuth();
  const { effectiveUserId, siteId } = useUserProfile();
  const { trackClick } = useUsageAnalytics();
  const [gapPlans, setGapPlans] = useState<GapPlan[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<GapPlan[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterOwner, setFilterOwner] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('questionId');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [educationCategories, setEducationCategories] = useState<Record<string, string>>({});
  const [openGapsAccordions, setOpenGapsAccordions] = useState<Record<number, boolean>>(() => {
    const o: Record<number, boolean> = {};
    EDUCATION_BUCKETS.forEach((_, i) => { o[i] = i === 0; });
    return o;
  });
  const [editingPlan, setEditingPlan] = useState<GapPlan | null>(null);
  const [editFormData, setEditFormData] = useState({
    action: '',
    owner: '',
    status: '' as GapPlan['status'],
    priority: '' as GapPlan['priority'],
    difficulty: '' as GapPlan['difficulty'],
    notes: '',
    dueDate: '',
    completionDate: '',
    attachments: [] as GapPlanAttachment[]
  });
  const [error, setError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState(false);
  const [activitiesForGapPlan, setActivitiesForGapPlan] = useState<any[]>([]);
  const [effectiveHospitalId, setEffectiveHospitalId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!siteId) {
        if (mounted) setEffectiveHospitalId(null);
        return;
      }
      const resolved = await resolveHospitalUuid(siteId);
      if (mounted) setEffectiveHospitalId(resolved);
    })();
    return () => {
      mounted = false;
    };
  }, [siteId]);

  useEffect(() => {
    if (effectiveUserId) {
      loadGapPlans();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadGapPlans defined below; tied to user + hospital context
  }, [effectiveUserId, effectiveHospitalId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'education_questions').maybeSingle();
      if (!mounted) return;
      const parsed = (data as { value?: unknown } | null)?.value;
      if (parsed != null && Array.isArray(parsed)) {
        const map: Record<string, string> = {};
        (parsed as { questionId?: string; category?: string }[]).forEach((q) => {
          if (q.questionId != null) map[String(q.questionId)] = q.category || '';
        });
        setEducationCategories(map);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Reload when gap plans updated (e.g. added from Education) or user returns to this tab
  useEffect(() => {
    const onGapPlansUpdated = () => { if (effectiveUserId) loadGapPlans(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && effectiveUserId) loadGapPlans();
    };
    window.addEventListener(GAP_PLANS_UPDATED_EVENT, onGapPlansUpdated);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener(GAP_PLANS_UPDATED_EVENT, onGapPlansUpdated);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadGapPlans defined below
  }, [effectiveUserId, effectiveHospitalId]);

  useEffect(() => {
    applyFiltersAndSort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyFiltersAndSort defined below
  }, [gapPlans, filterStatus, filterPriority, filterOwner, sortBy, sortOrder]);

  const userId = effectiveUserId;
  const loadGapPlans = async () => {
    if (!userId) return;
    try {
      let plans = effectiveHospitalId
        ? await getHospitalData<GapPlan[]>(effectiveHospitalId, 'gapPlans')
        : await getUserData<GapPlan[]>(userId, 'gapPlans');
      if (effectiveHospitalId && (plans == null || !Array.isArray(plans))) {
        plans = await getUserData<GapPlan[]>(userId, 'gapPlans');
      }
      if (plans == null || !Array.isArray(plans)) {
        if (!effectiveHospitalId) {
          await migrateFromLocalStorage(userId, 'gapPlans', `gapPlans_${userId}`, (raw) => {
            const parsed = Array.isArray(raw) ? raw : [];
            setGapPlans(parsed.map((plan: GapPlan) => ({
              ...plan,
              attachments: (plan.attachments || []).map((att: GapPlanAttachment) => ({
                ...att,
                uploadedAt: att.uploadedAt instanceof Date ? att.uploadedAt : new Date((att as any).uploadedAt)
              }))
            })));
          });
        }
        return;
      }
      const fixedPlans = plans.map((plan: GapPlan) => ({
        ...plan,
        attachments: (plan.attachments || []).map((att: GapPlanAttachment) => ({
          ...att,
          uploadedAt: att.uploadedAt instanceof Date ? att.uploadedAt : new Date((att as any).uploadedAt)
        }))
      }));
      setGapPlans(fixedPlans);
      const acts = await (effectiveHospitalId
        ? getHospitalData<any[]>(effectiveHospitalId, 'activities')
        : getUserData<any[]>(userId, 'activities'));
      if (Array.isArray(acts)) setActivitiesForGapPlan(acts);
      else if (effectiveHospitalId) {
        const fallbackActs = await getUserData<any[]>(userId, 'activities');
        if (Array.isArray(fallbackActs)) setActivitiesForGapPlan(fallbackActs);
      }
    } catch (err) {
      console.error('Error loading gap plans:', err);
      setError('Failed to load gap plans');
    }
  };

  useEffect(() => {
    if (!userId) return;
    if (effectiveHospitalId) {
      getHospitalData<any[]>(effectiveHospitalId, 'activities').then((v) => {
        if (Array.isArray(v)) setActivitiesForGapPlan(v);
        else getUserData<any[]>(userId, 'activities').then((fv) => { if (Array.isArray(fv)) setActivitiesForGapPlan(fv); });
      });
      return;
    }
    getUserData<any[]>(userId, 'activities').then((v) => { if (Array.isArray(v)) setActivitiesForGapPlan(v); });
  }, [userId, effectiveHospitalId]);

  const saveGapPlans = async (plans: GapPlan[]) => {
    if (!userId) return;
    try {
      if (effectiveHospitalId) {
        await Promise.all([
          setHospitalData(effectiveHospitalId, 'gapPlans', plans),
          setUserData(userId, 'gapPlans', plans),
        ]);
      } else {
        await setUserData(userId, 'gapPlans', plans);
      }
    } catch (err) {
      console.error('Error saving gap plans:', err);
      setError('Failed to save gap plans');
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = gapPlans.filter(plan => {
      // Apply user-selected filters
      if (filterStatus === 'active') {
        // Show all statuses except completed
        if (plan.status === 'Completed') return false;
      } else if (filterStatus === 'blank') {
        // Show only plans with no status
        if (plan.status !== '') return false;
      } else if (filterStatus && plan.status !== filterStatus) {
        // Show only specific status
        return false;
      }
      
      if (filterPriority === 'blank') {
        // Show only plans with no priority
        if (plan.priority !== '') return false;
      } else if (filterPriority && plan.priority !== filterPriority) {
        // Show only specific priority
        return false;
      }
      
      if (filterOwner && !plan.owner.toLowerCase().includes(filterOwner.toLowerCase())) return false;
      return true;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'order':
          comparison = gapPlans.findIndex(p => p.id === a.id) - gapPlans.findIndex(p => p.id === b.id);
          break;
        case 'questionId':
          comparison = (parseInt(a.questionId, 10) || 0) - (parseInt(b.questionId, 10) || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'dueDate':
          comparison = new Date(a.dueDate || '9999-12-31').getTime() - new Date(b.dueDate || '9999-12-31').getTime();
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredPlans(filtered);
  };

  const handleEdit = (plan: GapPlan) => {
    try {
      setEditingPlan(plan);
      setEditFormData({
        action: plan.action,
        owner: plan.owner,
        status: plan.status,
        priority: plan.priority,
        difficulty: plan.difficulty,
        notes: plan.notes,
        dueDate: plan.dueDate,
        completionDate: plan.completionDate,
        attachments: plan.attachments || []
      });
      setOpenEditDialog(true);
    } catch (error) {
      console.error('Error opening edit dialog:', error);
      setError('Failed to open edit dialog. Please try again.');
    }
  };

  const handleEditSubmit = () => {
    if (!editFormData.action || !editFormData.owner) {
      setError('Please fill in all required fields');
      return;
    }
    trackClick?.('Gap Plan - Update');

    const updatedPlans = gapPlans.map(plan =>
      plan.id === editingPlan!.id
        ? { ...plan, ...editFormData, rank: plan.rank }
        : plan
    );

    setGapPlans(updatedPlans);
    saveGapPlans(updatedPlans);
    setOpenEditDialog(false);
    setEditingPlan(null);
    setError(null);
  };

  const handleGapPlanEditFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileData = e.target?.result as string;
        const attachment: GapPlanAttachment = {
          id: Date.now().toString() + Math.random(),
          fileName: file.name,
          fileType: file.type.includes('pdf') ? 'pdf' : 'image',
          fileSize: file.size,
          uploadedAt: new Date(),
          fileData: fileData
        };
        
        setEditFormData(prev => ({
          ...prev,
          attachments: [...prev.attachments, attachment]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveEditAttachment = (index: number) => {
    setEditFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleViewAttachment = (attachment: GapPlanAttachment) => {
    if (attachment.fileData) {
      try {
        if (attachment.fileType === 'pdf') {
          // For PDFs, create a blob and open in new tab
          const byteCharacters = atob(attachment.fileData.split(',')[1]);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          // Clean up the URL object after a delay
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
          // For images, create a blob and open in new tab
          const byteCharacters = atob(attachment.fileData.split(',')[1]);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: `image/${attachment.fileType}` });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          // Clean up the URL object after a delay
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } catch (error) {
        console.error('Error viewing attachment:', error);
        alert('Error opening file. Please try again.');
      }
    } else {
      alert('File data not available.');
    }
  };

  const handleViewAttachments = (plan: GapPlan) => {
    // For now, just open the edit dialog to view attachments
    // In the future, this could open a dedicated attachments viewer
    handleEdit(plan);
  };



  const clearFilters = () => {
    setFilterStatus('');
    setFilterPriority('');
    setFilterOwner('');
    setSortBy('questionId');
    setSortOrder('asc');
  };

  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else setSortBy(field);
  };

  const handleDragStart = (e: React.DragEvent, planId: string) => {
    setDraggedPlanId(planId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', planId);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => setDragOverIndex(null);

  const handleDrop = async (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const planId = e.dataTransfer.getData('text/plain');
    if (!planId || !draggedPlanId) return;
    const fromIndex = filteredPlans.findIndex(p => p.id === planId);
    if (fromIndex === -1 || fromIndex === toIndex) return;
    const reordered = [...filteredPlans];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);
    const filteredIds = new Set(reordered.map(p => p.id));
    // Preserve global order: only reorder within the filtered subset's slot positions
    const filteredIndices = gapPlans
      .map((p, i) => (filteredIds.has(p.id) ? i : -1))
      .filter((i) => i >= 0);
    const newGapPlans = [...gapPlans];
    reordered.forEach((plan, j) => {
      if (filteredIndices[j] !== undefined) newGapPlans[filteredIndices[j]] = plan;
    });
    setGapPlans(newGapPlans);
    await saveGapPlans(newGapPlans);
    setDraggedPlanId(null);
  };

  const handleDragEnd = () => {
    setDraggedPlanId(null);
    setDragOverIndex(null);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    let yPos = 20;
    
    doc.setFontSize(18);
    doc.text('Gap Analysis Reduction Plans Report', 20, yPos);
    yPos += 20;
    
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, yPos);
    yPos += 15;
    
    // Table headers
    doc.setFontSize(10);
    doc.text('Question', 20, yPos);
    doc.text('Action', 60, yPos);
    doc.text('Owner', 120, yPos);
    doc.text('Status', 160, yPos);
    doc.text('Priority', 200, yPos);
    doc.text('Difficulty', 250, yPos);
    yPos += 10;
    
    // Table data
    filteredPlans.forEach(plan => {
      if (yPos > 180) {
        doc.addPage('landscape');
        yPos = 20;
      }
      
      doc.text(plan.questionId, 20, yPos);
      doc.text(plan.action.substring(0, 30), 60, yPos);
      doc.text(plan.owner.substring(0, 20), 120, yPos);
      doc.text(plan.status.substring(0, 20), 160, yPos);
      doc.text(plan.priority.substring(0, 25), 200, yPos);
      doc.text(plan.difficulty.substring(0, 25), 250, yPos);
      yPos += 8;
    });
    
    doc.save('gap-plans-report.pdf');
  };

  const exportToExcel = () => {
    const exportData = filteredPlans.map(plan => ({
      'Ques. #': plan.questionId,
      'Category': educationCategories[plan.questionId] || '',
      'Action': plan.action,
      'Owner': plan.owner,
      'Status': plan.status,
      'Priority': plan.priority,
      'Difficulty': plan.difficulty,
      'Notes': plan.notes,
      'Due Date': plan.dueDate,
      'Completion Date': plan.completionDate
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gap Plans');
    
    XLSX.writeFile(wb, 'gap-plans.xlsx');
  };

  const getStatusColor = (status: string) => {
    if (!status) return 'default';
    switch (status) {
      case 'Completed': return 'success';
      case 'In Progress': return 'primary';
      case 'Needs Update': return 'warning';
      case 'Need to Develop': return 'info';
      case 'Cannot be done at this time': return 'error';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    if (!priority) return 'default';
    if (priority.includes('High Importance & High Urgency')) return 'error';
    if (priority.includes('High Importance')) return 'warning';
    if (priority.includes('Low Importance')) return 'info';
    return 'default';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (err) {
      return dateString;
    }
  };

  // Add error boundary to catch rendering errors
  if (renderError) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h4" color="error" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            There was an error rendering the gap plan page. Please try refreshing.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => window.location.reload()}
            sx={{ mr: 2 }}
          >
            Refresh Page
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => setRenderError(false)}
          >
            Try Again
          </Button>
        </Box>
      </Container>
    );
  }

  try {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4, mt: 3 }}>
          <Typography variant="h3" component="h1" gutterBottom color="primary">
            Gap Analysis Reduction Plans
          </Typography>
          <Typography variant="h6" gutterBottom sx={{ mb: 4, color: 'text.secondary' }}>
            View and manage all your gap analysis reduction plans in one place.
          </Typography>

        <Alert severity="info" sx={{ mb: 2 }} icon={false}>
          <strong>No PHI:</strong> Do not include any Protected Health Information (PHI) or real patient data in plans, notes, or attachments.
        </Alert>

        {/* Gap Plan Reminder Banner */}
        <GapPlanReminderBanner />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Filters and Export Section */}
        <Card sx={{ mb: 3, p: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
            💡 All gap plans are visible by default. Use the filters below to narrow down your view.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ mr: 2 }}>Filters & Sorting</Typography>
            
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e: SelectChangeEvent) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="active">All Active (Not Completed)</MenuItem>
                <MenuItem value="blank">No Status</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Needs Update">Needs Update</MenuItem>
                <MenuItem value="Need to Develop">Need to Develop</MenuItem>
                <MenuItem value="Cannot be done at this time">Cannot be done at this time</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={filterPriority}
                label="Priority"
                onChange={(e: SelectChangeEvent) => setFilterPriority(e.target.value)}
              >
                <MenuItem value="">All Priorities</MenuItem>
                <MenuItem value="blank">No Priority</MenuItem>
                <MenuItem value="High Importance & High Urgency (Do Now)">High Importance & High Urgency (Do Now)</MenuItem>
                <MenuItem value="High Importance & Low Urgency (Do Next)">High Importance & Low Urgency (Do Next)</MenuItem>
                <MenuItem value="Low Importance & High Effort (Do Later)">Low Importance & High Effort (Do Later)</MenuItem>
                <MenuItem value="Low Importance & Low Urgency (Do Last)">Low Importance & Low Urgency (Do Last)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Owner"
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              size="small"
              sx={{ minWidth: 150 }}
            />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e: SelectChangeEvent) => setSortBy(e.target.value)}
              >
                <MenuItem value="order">Order (drag to reorder)</MenuItem>
                <MenuItem value="questionId">Question #</MenuItem>
                <MenuItem value="status">Status</MenuItem>
                <MenuItem value="dueDate">Due Date</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Order</InputLabel>
              <Select
                value={sortOrder}
                label="Order"
                onChange={(e: SelectChangeEvent) => setSortOrder(e.target.value as 'asc' | 'desc')}
              >
                <MenuItem value="asc">Asc</MenuItem>
                <MenuItem value="desc">Desc</MenuItem>
              </Select>
            </FormControl>

            <Button variant="outlined" onClick={clearFilters} size="small">
              Clear Filters
            </Button>
          </Box>

          {/* Export Section */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
              Export:
            </Typography>
            <Button
              variant="outlined"
              startIcon={<TableChartIcon />}
              onClick={exportToExcel}
              sx={{ borderColor: 'success.main', color: 'success.main', '&:hover': { borderColor: 'success.dark', bgcolor: 'success.light' } }}
            >
              Export to Excel
            </Button>
            <Button
              variant="contained"
              startIcon={<PictureAsPdfIcon />}
              onClick={exportToPDF}
              sx={{ bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' } }}
            >
              Export to PDF
            </Button>
          </Box>
        </Card>

        {/* Results Count */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {filteredPlans.length} of {gapPlans.length} gap plans
          </Typography>
        </Box>

        {/* Gap Plans Table */}
        {filteredPlans.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {gapPlans.length === 0 ? 'No Gap Plans Yet' : 'No Plans Match Filters'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {gapPlans.length === 0 ? 'Create gap plans from the Assessment page to get started.' : 'Try adjusting your filters.'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <TableContainer component={Paper} sx={{ maxHeight: '70vh', overflow: 'auto' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', width: 40, minWidth: 40, backgroundColor: 'primary.main', color: 'white' }} />
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 100, backgroundColor: 'primary.main', color: 'white', cursor: 'pointer' }} onClick={() => handleSort('questionId')}>Ques. # {sortBy === 'questionId' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 200, backgroundColor: 'primary.main', color: 'white' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 300, backgroundColor: 'primary.main', color: 'white' }}>Action</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 120, backgroundColor: 'primary.main', color: 'white' }}>Owner</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 150, backgroundColor: 'primary.main', color: 'white', cursor: 'pointer' }} onClick={() => handleSort('status')}>Status {sortBy === 'status' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 200, backgroundColor: 'primary.main', color: 'white' }}>Priority</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 200, backgroundColor: 'primary.main', color: 'white' }}>Difficulty</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 120, backgroundColor: 'primary.main', color: 'white', cursor: 'pointer' }} onClick={() => handleSort('dueDate')}>Due Date {sortBy === 'dueDate' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 150, backgroundColor: 'primary.main', color: 'white' }}>Attachments</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPlans.map((plan, index) => (
                  <TableRow
                    key={plan.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, plan.id)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    sx={{
                      opacity: draggedPlanId === plan.id ? 0.5 : 1,
                      bgcolor: dragOverIndex === index ? 'action.hover' : undefined
                    }}
                  >
                    <TableCell sx={{ width: 40, minWidth: 40, cursor: 'grab', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                      <DragIndicatorIcon fontSize="small" color="action" />
                    </TableCell>
                    <TableCell sx={{ minWidth: 100 }}>{plan.questionId}</TableCell>
                    <TableCell
                      sx={{
                        minWidth: 200,
                        maxWidth: 280,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' },
                        whiteSpace: 'normal',
                        wordWrap: 'break-word'
                      }}
                      onClick={() => handleEdit(plan)}
                    >
                      {educationCategories[plan.questionId]?.trim() || '—'}
                    </TableCell>
                    <TableCell sx={{ 
                      minWidth: 300, 
                      maxWidth: 300, 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      whiteSpace: 'normal',
                      wordWrap: 'break-word'
                    }}>
                      {plan.action}
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>{plan.owner}</TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <Chip 
                        label={plan.status || 'No Status'} 
                        color={getStatusColor(plan.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 200 }}>
                      <Chip 
                        label={plan.priority ? plan.priority.split('(')[1]?.replace(')', '') || plan.priority : 'No Priority'} 
                        color={getPriorityColor(plan.priority) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 200 }}>
                      <Chip 
                        label={plan.difficulty ? plan.difficulty.split('(')[1]?.replace(')', '') || plan.difficulty : 'No Difficulty'} 
                        color="default"
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>{formatDate(plan.dueDate)}</TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      {plan.attachments && plan.attachments.length > 0 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Chip 
                            label={`${plan.attachments.length} file${plan.attachments.length > 1 ? 's' : ''}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          <IconButton
                            size="small"
                            onClick={() => handleViewAttachments(plan)}
                            sx={{ ml: 0.5 }}
                          >
                            <ExpandMoreIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No files
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Gap Closure – accordion per domain (each with distinct color) */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" sx={{ mb: 1.5, fontWeight: 600 }}>Gap Closure</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Work through questions by domain. Add notes as you go and create gap plans to track actions.
        </Typography>
        {EDUCATION_BUCKETS.map((bucket, index) => {
          const { bg, border } = DOMAIN_ACCORDION_COLORS[index % DOMAIN_ACCORDION_COLORS.length] ?? DOMAIN_ACCORDION_COLORS[0];
          return (
            <Accordion
              key={bucket}
              expanded={openGapsAccordions[index] ?? index === 0}
              onChange={() => setOpenGapsAccordions((prev) => ({ ...prev, [index]: !(prev[index] ?? index === 0) }))}
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: border,
                borderLeftWidth: 4,
                borderRadius: 1,
                overflow: 'hidden',
                '&:not(:last-child)': { mb: 1.5 },
                '&:before': { display: 'none' }
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  bgcolor: bg,
                  color: 'text.primary',
                  minHeight: 48,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '& .MuiAccordionSummary-expandIconWrapper': { color: 'text.secondary' },
                  '&.Mui-expanded': { minHeight: 48 }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SchoolIcon fontSize="small" sx={{ color: border }} />
                  <Typography variant="subtitle1" fontWeight={500}>{bucket}</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pt: 0, pb: 2, bgcolor: 'rgba(0,0,0,0.02)' }}>
                <EducationPage domainFilter={bucket} onGapPlanSaved={loadGapPlans} />
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>

      {/* Edit Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Edit Gap Plan: {editingPlan ? (educationCategories[editingPlan.questionId]?.trim() || `Question ${editingPlan.questionId}`) : ''}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="What is the action/plan to resolve?"
                multiline
                rows={3}
                value={editFormData.action}
                onChange={(e) => setEditFormData({ ...editFormData, action: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Owner"
                value={editFormData.owner}
                onChange={(e) => setEditFormData({ ...editFormData, owner: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={editFormData.status}
                  label="Status"
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as GapPlan['status'] })}
                >
                  <MenuItem value="">No Status</MenuItem>
                  <MenuItem value="In Progress">In Progress</MenuItem>
                  <MenuItem value="Needs Update">Needs Update</MenuItem>
                  <MenuItem value="Need to Develop">Need to Develop</MenuItem>
                  <MenuItem value="Cannot be done at this time">Cannot be done at this time</MenuItem>
                  <MenuItem value="Completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={editFormData.priority}
                  label="Priority"
                  onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value as GapPlan['priority'] })}
                >
                  <MenuItem value="">No Priority</MenuItem>
                  <MenuItem value="High Importance & High Urgency (Do Now)">High Importance & High Urgency (Do Now)</MenuItem>
                  <MenuItem value="High Importance & Low Urgency (Do Next)">High Importance & Low Urgency (Do Next)</MenuItem>
                  <MenuItem value="Low Importance & High Effort (Do Later)">Low Importance & High Effort (Do Later)</MenuItem>
                  <MenuItem value="Low Importance & Low Urgency (Do Last)">Low Importance & Low Urgency (Do Last)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={editFormData.difficulty}
                  label="Difficulty"
                  onChange={(e) => setEditFormData({ ...editFormData, difficulty: e.target.value as GapPlan['difficulty'] })}
                >
                  <MenuItem value="">No Difficulty</MenuItem>
                  <MenuItem value="Low Impact & Low Effort (Filler Tasks)">Low Impact & Low Effort (Filler Tasks)</MenuItem>
                  <MenuItem value="Low Impact & High Effort (Hard Slogs)">Low Impact & High Effort (Hard Slogs)</MenuItem>
                  <MenuItem value="High Impact & Low Effort (Quick Wins)">High Impact & Low Effort (Quick Wins)</MenuItem>
                  <MenuItem value="High Impact & High Effort (Big Projects)">High Impact & High Effort (Big Projects)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Due Date"
                type="date"
                value={editFormData.dueDate}
                onChange={(e) => setEditFormData({ ...editFormData, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            {editFormData.status === 'Completed' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Completion Date"
                  type="date"
                  value={editFormData.completionDate}
                  onChange={(e) => setEditFormData({ ...editFormData, completionDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes (Progress? Where did you get this information?)"
                multiline
                rows={3}
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
              />
            </Grid>

            {/* Related Activities Section */}
            <Grid item xs={12}>
              <Box sx={{ border: '1px solid #ddd', borderRadius: 1, p: 2, bgcolor: '#fafafa', mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Related Activities
                </Typography>
                {(() => {
                  const relatedActivities = (activitiesForGapPlan || []).filter((activity: any) =>
                    activity.associatedGaps && activity.associatedGaps.includes(editingPlan?.id)
                  );

                  if (relatedActivities.length === 0) {
                    return (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        No activities are currently associated with this gap plan.
                      </Typography>
                    );
                  }
                  return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {relatedActivities.map((activity) => (
                        <Box key={activity.id} sx={{ 
                          p: 1.5, 
                          bgcolor: 'white', 
                          borderRadius: 1, 
                          border: '1px solid #e0e0e0' 
                        }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                            {activity.activity}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(activity.date).toLocaleDateString()} • {activity.category} • {activity.hours} hours
                          </Typography>
                          {activity.notes && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              {activity.notes}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  );
                })()}
              </Box>
            </Grid>
            
            {/* File Attachments Section */}
            <Grid item xs={12}>
              <Box sx={{ border: '1px solid #ddd', borderRadius: 1, p: 2, bgcolor: '#fafafa' }}>
                <Typography variant="h6" gutterBottom>
                  File Attachments
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Upload PDFs or images related to this gap plan (e.g., policies, photos, documents)
                </Typography>
                
                {/* File Upload */}
                <Box sx={{ mb: 2 }}>
                  <input
                    accept=".pdf,.jpg,.jpeg,.png,.gif"
                    style={{ display: 'none' }}
                    id="gap-plan-edit-file-upload"
                    type="file"
                    onChange={handleGapPlanEditFileUpload}
                    multiple
                  />
                  <label htmlFor="gap-plan-edit-file-upload">
                    <Button variant="outlined" component="span" startIcon={<UploadIcon />}>
                      Upload Files
                    </Button>
                  </label>
                </Box>
                
                {/* Display Current Attachments */}
                {editFormData.attachments.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Current Attachments:
                    </Typography>
                    {editFormData.attachments.map((attachment, index) => (
                      <Box key={attachment.id} sx={{ display: 'flex', alignItems: 'center', mb: 1, p: 1, bgcolor: 'white', borderRadius: 1 }}>
                        <Box sx={{ mr: 2 }}>
                          {attachment.fileType === 'pdf' ? <PictureAsPdfIcon color="error" /> : <ImageIcon color="primary" />}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                cursor: 'pointer', 
                                color: 'primary.main',
                                '&:hover': { textDecoration: 'underline' }
                              }}
                              onClick={() => handleViewAttachment(attachment)}
                            >
                              {attachment.fileName}
                            </Typography>
                            <Typography variant="caption" color="primary.main" sx={{ fontSize: '0.7rem' }}>
                              (click to view)
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {(attachment.fileSize / 1024).toFixed(1)} KB • {(() => {
                              try {
                                return attachment.uploadedAt instanceof Date 
                                  ? attachment.uploadedAt.toLocaleDateString()
                                  : new Date(attachment.uploadedAt).toLocaleDateString();
                              } catch (error) {
                                return 'Invalid date';
                              }
                            })()}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveEditAttachment(index)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
          <Button onClick={handleEditSubmit} variant="contained">Update Gap Plan</Button>
        </DialogActions>
      </Dialog>
    </Container>
    );
  } catch (error) {
    console.error('Error rendering GapPlanPage:', error);
    setRenderError(true);
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h4" color="error" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            There was an error rendering the gap plan page. Please try refreshing.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => window.location.reload()}
            sx={{ mr: 2 }}
          >
            Refresh Page
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => setRenderError(false)}
          >
            Try Again
          </Button>
        </Box>
      </Container>
    );
  }
};

export default GapPlanPage;

