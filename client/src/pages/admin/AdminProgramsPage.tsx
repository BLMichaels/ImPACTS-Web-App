import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Autocomplete,
  Chip,
  IconButton
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Search as SearchIcon,
  School as ProgramIcon,
  Add as AddIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { supabase } from '../../supabase';
import { useUserProfile } from '../../context/UserProfileContext';
import { ProgramWithStats, UserRole, Program } from '../../types/database';
import { ProgramCard, ProgramDetail } from '../../components/programs';

const PROGRAM_LOGOS_BUCKET = 'program-logos';

interface ProgramFormData {
  name: string;
  description: string;
  start_date: Date | null;
  end_date: Date | null;
  is_active: boolean;
  manager_ids: string[];
  logo_url: string | null;
  logo_file: File | null;
}

const initialFormData: ProgramFormData = {
  name: '',
  description: '',
  start_date: null,
  end_date: null,
  is_active: true,
  manager_ids: [],
  logo_url: null,
  logo_file: null
};

const AdminProgramsPage: React.FC = () => {
  const { userProfile } = useUserProfile();
  const [programs, setPrograms] = useState<ProgramWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Create/Edit Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState<ProgramFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [managers, setManagers] = useState<Array<{ id: string; first_name: string; last_name: string; email: string; role: UserRole }>>([]);

  const loadPrograms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('programs')
        .select('*')
        .order('name');

      if (!showInactive) {
        query = query.eq('is_active', true);
      }

      const { data: programsData, error: programsError } = await query;

      if (programsError) throw programsError;

      const programIds = programsData?.map(p => p.id) || [];

      if (programIds.length === 0) {
        setPrograms([]);
        setLoading(false);
        return;
      }

      // Get member counts
      const { data: memberCounts } = await supabase
        .from('program_members')
        .select('program_id')
        .in('program_id', programIds)
        .eq('status', 'active');

      // Get announcement counts
      const { data: announcementCounts } = await supabase
        .from('program_announcements')
        .select('program_id')
        .in('program_id', programIds);

      // Get manager status for current user
      const { data: managerStatus } = await supabase
        .from('program_managers')
        .select('program_id')
        .in('program_id', programIds)
        .eq('manager_id', userProfile?.id || '');

      // Combine data
      const programsWithStats: ProgramWithStats[] = (programsData || []).map(program => ({
        ...program,
        member_count: memberCounts?.filter(m => m.program_id === program.id).length || 0,
        announcement_count: announcementCounts?.filter(a => a.program_id === program.id).length || 0,
        is_manager: managerStatus?.some(m => m.program_id === program.id)
      }));

      setPrograms(programsWithStats);
    } catch (err) {
      console.error('Error loading programs:', err);
      setError('Failed to load programs');
    } finally {
      setLoading(false);
    }
  }, [showInactive, userProfile?.id]);

  const loadManagers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role')
        .in('role', ['admin', 'manager'])
        .eq('is_active', true)
        .order('last_name');

      if (error) throw error;
      setManagers(data || []);
    } catch (err) {
      console.error('Error loading managers:', err);
    }
  }, []);

  useEffect(() => {
    loadPrograms();
    loadManagers();
  }, [loadPrograms, loadManagers]);

  const handleOpenCreate = () => {
    setEditingProgram(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = async (program: Program) => {
    setEditingProgram(program);
    
    const { data: programManagers } = await supabase
      .from('program_managers')
      .select('manager_id')
      .eq('program_id', program.id);

    setFormData({
      name: program.name,
      description: program.description || '',
      start_date: program.start_date ? new Date(program.start_date) : null,
      end_date: program.end_date ? new Date(program.end_date) : null,
      is_active: program.is_active,
      manager_ids: programManagers?.map((m: { manager_id: string }) => m.manager_id) || [],
      logo_url: program.logo_url ?? null,
      logo_file: null
    });
    setDialogOpen(true);
  };

  const handleSaveProgram = async () => {
    if (!formData.name.trim()) return;

    try {
      setSaving(true);

      let logoUrl: string | null = !formData.logo_file ? (editingProgram?.logo_url ?? formData.logo_url ?? null) : null;
      let logoUploadFailed = false;

      const programDataBase = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        start_date: formData.start_date?.toISOString().split('T')[0] || null,
        end_date: formData.end_date?.toISOString().split('T')[0] || null,
        is_active: formData.is_active,
        updated_at: new Date().toISOString()
      };

      let programId: string;

      if (editingProgram) {
        programId = editingProgram.id;
        if (formData.logo_file) {
          const ext = formData.logo_file.name.split('.').pop()?.toLowerCase() || 'png';
          const path = `program-${programId}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from(PROGRAM_LOGOS_BUCKET)
            .upload(path, formData.logo_file, { upsert: true, contentType: formData.logo_file.type });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from(PROGRAM_LOGOS_BUCKET).getPublicUrl(path);
            logoUrl = urlData?.publicUrl ?? null;
          } else {
            logoUploadFailed = true;
          }
        }
        const { error } = await supabase
          .from('programs')
          .update({ ...programDataBase, logo_url: logoUrl })
          .eq('id', programId);
        if (error) throw error;

        await supabase
          .from('program_managers')
          .delete()
          .eq('program_id', programId);
      } else {
        const { data, error } = await supabase
          .from('programs')
          .insert({
            ...programDataBase,
            logo_url: null,
            created_by: userProfile?.id
          })
          .select()
          .single();
        if (error) throw error;
        programId = data.id;
        if (formData.logo_file) {
          const ext = formData.logo_file.name.split('.').pop()?.toLowerCase() || 'png';
          const path = `program-${programId}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from(PROGRAM_LOGOS_BUCKET)
            .upload(path, formData.logo_file, { upsert: true, contentType: formData.logo_file.type });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from(PROGRAM_LOGOS_BUCKET).getPublicUrl(path);
            await supabase.from('programs').update({ logo_url: urlData?.publicUrl }).eq('id', programId);
          } else {
            logoUploadFailed = true;
          }
        }
      }

      // Add managers
      if (formData.manager_ids.length > 0) {
        const managerRecords = formData.manager_ids.map(managerId => ({
          program_id: programId,
          manager_id: managerId,
          assigned_by: userProfile?.id
        }));

        const { error: managerError } = await supabase
          .from('program_managers')
          .insert(managerRecords);

        if (managerError) throw managerError;
      }

      setDialogOpen(false);
      loadPrograms();
      if (logoUploadFailed) {
        setError('Program saved. Logo could not be uploaded: the "program-logos" storage bucket may be missing. Run PROGRAM_LOGO_AND_USER_PRIMARY_PROGRAM.sql in Supabase SQL Editor, then edit the program to upload the logo.');
      }
    } catch (err) {
      console.error('Error saving program:', err);
      setError('Failed to save program');
    } finally {
      setSaving(false);
    }
  };

  const filteredPrograms = programs.filter(program =>
    program.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    program.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Program detail view and list view both render; Create/Edit Dialog is always mounted so Edit works from detail
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      {selectedProgramId ? (
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <ProgramDetail
            programId={selectedProgramId}
            onBack={() => setSelectedProgramId(null)}
            onEdit={() => {
              const program = programs.find(p => p.id === selectedProgramId);
              if (program) handleOpenEdit(program);
            }}
          />
        </Container>
      ) : (
        <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box display="flex" alignItems="center" gap={2}>
            <ProgramIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
            <Box>
              <Typography variant="h4" component="h1" fontWeight="bold">
                Manage Programs
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Create and manage programs
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
          >
            Create Program
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Search and Filters */}
        <Box display="flex" gap={2} mb={3} alignItems="center">
          <TextField
            fullWidth
            placeholder="Search programs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
            }
            label="Show inactive"
            sx={{ whiteSpace: 'nowrap' }}
          />
        </Box>

        {/* Loading */}
        {loading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress />
          </Box>
        ) : filteredPrograms.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <ProgramIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {searchTerm ? 'No programs match your search' : 'No programs yet'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
              sx={{ mt: 2 }}
            >
              Create Your First Program
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {filteredPrograms.map((program) => (
              <Grid item xs={12} sm={6} md={4} key={program.id}>
                <ProgramCard
                  program={program}
                  onClick={() => setSelectedProgramId(program.id)}
                  showManagerBadge
                />
              </Grid>
            ))}
          </Grid>
        )}
        </Container>
      )}

      {/* Create/Edit Dialog — always mounted so Edit works from program detail view */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            {editingProgram ? 'Edit Program' : 'Create Program'}
            <IconButton onClick={() => setDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers aria-describedby={undefined}>
          <TextField
            autoFocus
            margin="normal"
            label="Program Name"
            fullWidth
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          />
          <TextField
            margin="normal"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
          <Box display="flex" gap={2} mt={2}>
            <DatePicker
              label="Start Date"
              value={formData.start_date}
              onChange={(date) => setFormData(prev => ({ ...prev, start_date: date }))}
              slotProps={{ textField: { fullWidth: true } }}
            />
            <DatePicker
              label="End Date"
              value={formData.end_date}
              onChange={(date) => setFormData(prev => ({ ...prev, end_date: date }))}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Box>
          <Autocomplete
            multiple
            options={managers}
            getOptionLabel={(option) => `${option.first_name} ${option.last_name}`}
            value={managers.filter(m => formData.manager_ids.includes(m.id))}
            onChange={(_, value) => setFormData(prev => ({ 
              ...prev, 
              manager_ids: value.map(v => v.id) 
            }))}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Program Managers"
                margin="normal"
                placeholder="Select managers..."
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  label={`${option.first_name} ${option.last_name}`}
                  {...getTagProps({ index })}
                  key={option.id}
                />
              ))
            }
            renderOption={(props, option) => (
              <li {...props}>
                <Box>
                  <Typography>{option.first_name} {option.last_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {option.email} • {option.role}
                  </Typography>
                </Box>
              </li>
            )}
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Program logo (shown in navbar for users with this as primary program)</Typography>
            {(formData.logo_url || formData.logo_file) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <img
                  src={formData.logo_file ? URL.createObjectURL(formData.logo_file) : formData.logo_url || ''}
                  alt="Logo preview"
                  style={{ height: 48, width: 'auto', objectFit: 'contain' }}
                />
                <Button
                  size="small"
                  onClick={() => setFormData(prev => ({ ...prev, logo_url: null, logo_file: null }))}
                >
                  Remove logo
                </Button>
              </Box>
            )}
            <Button variant="outlined" component="label" size="small">
              {formData.logo_url || formData.logo_file ? 'Replace logo' : 'Upload logo image'}
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setFormData(prev => ({ ...prev, logo_file: file || null, logo_url: file ? prev.logo_url : null }));
                }}
              />
            </Button>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              />
            }
            label="Active"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveProgram}
            disabled={!formData.name.trim() || saving}
          >
            {saving ? 'Saving...' : (editingProgram ? 'Save Changes' : 'Create Program')}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default AdminProgramsPage;
