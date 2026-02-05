import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Paper,
  Tabs,
  Tab
} from '@mui/material';
import { Search as SearchIcon, School as ProgramIcon } from '@mui/icons-material';
import { supabase } from '../../supabase';
import { useUserProfile } from '../../context/UserProfileContext';
import { ProgramWithStats } from '../../types/database';
import { ProgramCard, ProgramDetail } from '../../components/programs';

const ManagerProgramsPage: React.FC = () => {
  const { userProfile } = useUserProfile();
  const [programs, setPrograms] = useState<ProgramWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0); // 0 = managing, 1 = member of

  const loadPrograms = useCallback(async () => {
    if (!userProfile) return;

    try {
      setLoading(true);
      setError(null);

      // Get programs user manages
      const { data: managingData, error: managingError } = await supabase
        .from('program_managers')
        .select('program_id')
        .eq('manager_id', userProfile.id);

      if (managingError) throw managingError;

      // Get programs user is a member of
      const { data: memberData, error: memberError } = await supabase
        .from('program_members')
        .select('program_id')
        .eq('user_id', userProfile.id)
        .eq('status', 'active');

      if (memberError) throw memberError;

      const managingIds = managingData?.map(m => m.program_id) || [];
      const memberIds = memberData?.map(m => m.program_id) || [];
      const allProgramIds = [...new Set([...managingIds, ...memberIds])];

      if (allProgramIds.length === 0) {
        setPrograms([]);
        setLoading(false);
        return;
      }

      // Load program details
      const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select('*')
        .in('id', allProgramIds)
        .eq('is_active', true)
        .order('name');

      if (programsError) throw programsError;

      // Get member counts
      const { data: memberCounts } = await supabase
        .from('program_members')
        .select('program_id')
        .in('program_id', allProgramIds)
        .eq('status', 'active');

      // Get announcement counts
      const { data: announcementCounts } = await supabase
        .from('program_announcements')
        .select('program_id')
        .in('program_id', allProgramIds);

      // Combine data
      const programsWithStats: ProgramWithStats[] = (programsData || []).map(program => ({
        ...program,
        member_count: memberCounts?.filter(m => m.program_id === program.id).length || 0,
        announcement_count: announcementCounts?.filter(a => a.program_id === program.id).length || 0,
        is_manager: managingIds.includes(program.id)
      }));

      setPrograms(programsWithStats);
    } catch (err) {
      console.error('Error loading programs:', err);
      setError('Failed to load programs');
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  const managingPrograms = programs.filter(p => p.is_manager);
  const memberPrograms = programs.filter(p => !p.is_manager);

  const displayPrograms = tabValue === 0 ? managingPrograms : memberPrograms;
  const filteredPrograms = displayPrograms.filter(program =>
    program.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    program.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show program detail
  if (selectedProgramId) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <ProgramDetail
          programId={selectedProgramId}
          onBack={() => setSelectedProgramId(null)}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={4}>
        <ProgramIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
        <Box>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Programs
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Programs you manage and are enrolled in
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label={`Managing (${managingPrograms.length})`} />
          <Tab label={`Member of (${memberPrograms.length})`} />
        </Tabs>
      </Paper>

      {/* Search */}
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
        sx={{ mb: 3 }}
      />

      {/* Loading */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : filteredPrograms.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <ProgramIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchTerm 
              ? 'No programs match your search' 
              : tabValue === 0
                ? 'No programs to manage'
                : 'Not a member of any programs'
            }
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm
              ? 'Try adjusting your search terms'
              : tabValue === 0
                ? 'Contact an admin to be assigned as a program manager'
                : 'Contact a manager to be added to a program'
            }
          </Typography>
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
  );
};

export default ManagerProgramsPage;
