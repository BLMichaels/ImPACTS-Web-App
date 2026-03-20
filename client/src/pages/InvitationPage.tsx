import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Container,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  FormGroup,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  Radio
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { getInvitationByCode, acceptInvitation } from '../utils/invitations';
import { UserRole } from '../types/database';
import { normalizeHospitalOrOrgName, getUserDisplayName } from '../utils/displayName';
import type { RegistrationQuestion, RegistrationQuestionDisplayCondition } from '../types/database';

interface InvitationData {
  code: string;
  email: string;
  role: UserRole;
  hospitalName?: string;
  mentorName?: string;
  managerName?: string;
  status: string;
  expiresAt: string;
  customMessage?: string | null;
  cohortIds?: string[];
}

const InvitationPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  });
  const [registrationQuestions, setRegistrationQuestions] = useState<RegistrationQuestion[]>([]);
  const [registrationAnswers, setRegistrationAnswers] = useState<Record<string, string | boolean | string[]>>({});
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [emailConfirmationMessage, setEmailConfirmationMessage] = useState<string>('');

  useEffect(() => {
    validateInvitation();
  }, [code]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'email_confirmation_message').maybeSingle();
      const v = (data as { value?: string } | null)?.value;
      if (typeof v === 'string' && v.trim()) setEmailConfirmationMessage(v.trim());
    })();
  }, []);

  const validateInvitation = async () => {
    if (!code) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    try {
      const invitationData = await getInvitationByCode(code);
      
      if (!invitationData) {
        setError('This invitation link is invalid or has expired.');
        setInvitation(null);
        setLoading(false);
        return;
      }
      
      // Check if invitation has expired
      const expiresAt = new Date(invitationData.expires_at);
      if (expiresAt < new Date()) {
        setError('This invitation has expired. Please contact your administrator for a new invitation.');
        setInvitation(null);
        setLoading(false);
        return;
      }
      
      // Fetch related data if available
      let hospitalName: string | undefined;
      let mentorName: string | undefined;
      let managerName: string | undefined;
      
      if (invitationData.hospital_id) {
        const { data: hospital } = await supabase
          .from('hospitals')
          .select('name')
          .eq('id', invitationData.hospital_id)
          .single();
        if (hospital) hospitalName = normalizeHospitalOrOrgName(hospital.name);
      }
      
      if (invitationData.mentor_id) {
        const { data: mentor } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', invitationData.mentor_id)
          .single();
        if (mentor) {
          mentorName = getUserDisplayName(mentor);
        }
      }
      
      if (invitationData.manager_id) {
        const { data: manager } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', invitationData.manager_id)
          .single();
        if (manager) {
          managerName = getUserDisplayName(manager);
        }
      }
      
      const invitation: InvitationData = {
        code: invitationData.code,
        email: invitationData.email,
        role: invitationData.role as UserRole,
        hospitalName,
        mentorName,
        managerName,
        status: invitationData.status,
        expiresAt: invitationData.expires_at,
        customMessage: (invitationData as { custom_message?: string }).custom_message ?? null,
        cohortIds: Array.isArray((invitationData as { cohort_ids?: string[] }).cohort_ids)
          ? (invitationData as { cohort_ids: string[] }).cohort_ids
          : undefined
      };
      
      setInvitation(invitation);
      setFormData(prev => ({ ...prev, email: invitationData.email }));

      const cohortIds = Array.isArray((invitationData as { cohort_ids?: string[] }).cohort_ids)
        ? (invitationData as { cohort_ids: string[] }).cohort_ids
        : [];
      let programIds: string[] = [];
      if (cohortIds.length > 0) {
        const { data: cohorts } = await supabase.from('cohorts').select('program_id').in('id', cohortIds);
        programIds = [...new Set((cohorts || []).map((c: { program_id: string | null }) => c.program_id).filter(Boolean) as string[])];
      }
      setQuestionsLoading(true);
      try {
        const { data: qData } = await supabase
          .from('registration_questions')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        const role = invitationData.role as string;
        const rows = (qData || []).map((r: Record<string, unknown>) => {
          const dc = r.display_condition as RegistrationQuestionDisplayCondition | null | undefined;
          return {
            id: String(r.id),
            label: String(r.label),
            question_type: (r.question_type as RegistrationQuestion['question_type']) || 'short_answer',
            required: Boolean(r.required),
            options: Array.isArray(r.options) ? (r.options as unknown[]).map((x) => String(x)) : [],
            sort_order: Number(r.sort_order) || 0,
            target_roles: r.target_roles != null && Array.isArray(r.target_roles) ? (r.target_roles as unknown[]).map((x) => String(x)) : null,
            target_program_ids: r.target_program_ids != null && Array.isArray(r.target_program_ids) ? (r.target_program_ids as unknown[]).map((x) => String(x)) : null,
            target_cohort_ids: r.target_cohort_ids != null && Array.isArray(r.target_cohort_ids) ? (r.target_cohort_ids as unknown[]).map((x) => String(x)) : null,
            display_condition: dc && typeof dc === 'object' && dc.question_id ? dc : null
          } as RegistrationQuestion;
        });
        const filtered = rows
          .filter((q) => !q.target_roles?.length || q.target_roles.includes(role))
          .filter((q) => {
            const hasProgram = q.target_program_ids != null && q.target_program_ids.length > 0;
            const hasCohort = q.target_cohort_ids != null && q.target_cohort_ids.length > 0;
            if (!hasProgram && !hasCohort) return true;
            const programMatch = !hasProgram || (programIds.length > 0 && q.target_program_ids!.some((pid) => programIds.includes(pid)));
            const cohortMatch = !hasCohort || (cohortIds.length > 0 && q.target_cohort_ids!.some((cid) => cohortIds.includes(cid)));
            return programMatch && cohortMatch;
          });
        setRegistrationQuestions(filtered);
      } finally {
        setQuestionsLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to validate invitation. Please try again.');
      setInvitation(null);
    } finally {
      setLoading(false);
    }
  };

  const setRegistrationAnswer = (questionId: string, value: string | boolean | string[]) => {
    setRegistrationAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const satisfiesDisplayCondition = (q: RegistrationQuestion, answers: Record<string, string | boolean | string[]>): boolean => {
    const dc = q.display_condition;
    if (!dc || !dc.question_id) return true;
    const val = answers[dc.question_id];
    const str = val === true ? 'true' : val === false ? 'false' : Array.isArray(val) ? val.join(',') : String(val ?? '');
    if (dc.operator === 'not_empty') return str.trim() !== '';
    if (dc.operator === 'equals') return dc.value !== undefined && str.trim() === String(dc.value).trim();
    if (dc.operator === 'in') return Array.isArray(dc.value) && dc.value.some((v) => String(v).trim() === str.trim());
    return true;
  };

  const visibleQuestions = registrationQuestions.filter((q) => satisfiesDisplayCondition(q, registrationAnswers));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    
    // Validate email matches invitation
    if (invitation && invitation.email && formData.email.trim().toLowerCase() !== invitation.email.toLowerCase()) {
      setError('Email does not match the invitation. Please use the email address the invitation was sent to.');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    // Only require answers for required questions that are visible (question logic may hide some)
    const requiredVisible = registrationQuestions.filter((q) => q.required && satisfiesDisplayCondition(q, registrationAnswers));
    for (const q of requiredVisible) {
      const v = registrationAnswers[q.id];
      const empty = v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
      if (empty) {
        setError(`Please answer: ${q.label}`);
        return;
      }
    }

    setSubmitting(true);

    try {
      if (!invitation || !code) {
        throw new Error('Invalid invitation');
      }

      const finishRegistration = async (userId: string) => {
        const dynamicAnswers: Record<string, string | boolean | string[]> = {};
        Object.entries(registrationAnswers).forEach(([k, v]) => {
          if (v !== undefined && v !== null && (typeof v !== 'string' || v.trim() !== '')) {
            dynamicAnswers[k] = v;
          }
        });
        const updatePayload: Record<string, unknown> = {
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          phone: formData.phone.trim() || null,
          role: invitation.role,
          registration_answers: Object.keys(dynamicAnswers).length ? dynamicAnswers : {},
          updated_at: new Date().toISOString()
        };

        const { data: invData } = await supabase
          .from('invitations')
          .select('mentor_id, manager_id, hospital_id, cohort_ids, invited_by')
          .eq('code', code)
          .single();

        if (invitation.role === 'pecc') {
          if (invData?.hospital_id) {
            updatePayload.hospital_facility_id = String(invData.hospital_id);
          }
          if (invData?.mentor_id) {
            updatePayload.mentor_id = invData.mentor_id;
          } else if (invData?.manager_id) {
            updatePayload.manager_id_for_pecc = invData.manager_id;
          }
        } else if (invitation.role === 'mentor' && invData?.manager_id) {
          updatePayload.manager_id = invData.manager_id;
        }

        const { error: updateError } = await supabase.from('users').update(updatePayload).eq('id', userId);

        if (updateError) {
          console.error('Failed to update user profile:', updateError);
        }

        const cohortIds = (invData as { cohort_ids?: string[] } | null)?.cohort_ids;
        const invitedBy = (invData as { invited_by?: string } | null)?.invited_by;
        if (invitation.role === 'pecc' && Array.isArray(cohortIds) && cohortIds.length > 0 && invitedBy) {
          for (const cohortId of cohortIds) {
            await supabase.from('cohort_members').upsert(
              { cohort_id: cohortId, user_id: userId, added_by: invitedBy, status: 'active' },
              { onConflict: 'cohort_id,user_id' }
            );
          }
        }
        if (invitation.role === 'mentor' && Array.isArray(cohortIds) && cohortIds.length > 0 && invitedBy) {
          for (const cohortId of cohortIds) {
            await supabase.from('cohort_invite_mentors').upsert(
              { cohort_id: cohortId, mentor_id: userId, assigned_by: invitedBy },
              { onConflict: 'cohort_id,mentor_id' }
            );
          }
        }

        try {
          await acceptInvitation(code, userId);
        } catch (acceptError) {
          console.error('Failed to mark invitation as accepted:', acceptError);
        }
      };

      // Create account with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone || null,
            role: invitation.role,
            invitation_code: code
          },
          emailRedirectTo: `${window.location.origin}/login?confirmed=true`
        }
      });

      if (signUpError) {
        const msg = signUpError.message?.toLowerCase() ?? '';
        const looksLikeExisting =
          msg.includes('already') ||
          msg.includes('registered') ||
          msg.includes('exists') ||
          msg.includes('user already');

        if (looksLikeExisting) {
          const { data: fnData, error: fnErr } = await supabase.functions.invoke('complete-invitation-registration', {
            body: {
              invitation_code: code,
              email: formData.email.trim().toLowerCase(),
              password: formData.password
            }
          });
          const fnPayload = fnData as { ok?: boolean; error?: string } | null;
          if (fnErr || !fnPayload?.ok) {
            throw new Error(fnPayload?.error || fnErr?.message || 'Could not complete registration for this invitation.');
          }
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: formData.email.trim().toLowerCase(),
            password: formData.password
          });
          if (signInErr || !signInData.user) {
            throw signInErr ?? new Error('Sign-in failed after setting password.');
          }
          await finishRegistration(signInData.user.id);
          await supabase.auth.signOut();
          setError(null);
          navigate('/login?registered=success&message=Account ready. Sign in with your email and password.');
          return;
        }
        throw signUpError;
      }

      if (data.user) {
        await finishRegistration(data.user.id);
        setError(null);
        navigate('/login?registered=success&message=Please check your email to confirm your account');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Validating invitation...</Typography>
        </Box>
      </Container>
    );
  }

  if (!invitation) {
    return (
      <Container maxWidth="sm">
        <Paper sx={{ mt: 8, p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Invalid Invitation
          </Typography>
          <Typography color="textSecondary" sx={{ mb: 3 }}>
            {error || 'This invitation link is invalid or has expired. Contact your administrator for a new invitation link if you believe this is an error.'}
          </Typography>
          <Button variant="contained" onClick={() => navigate('/login')}>
            Go to Login
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Paper sx={{ mt: 4, p: 4 }}>
        <Typography variant="h4" align="center" gutterBottom>
          Welcome to ImPACTS
        </Typography>
        <Typography color="textSecondary" align="center" gutterBottom>
          Complete your registration to get started
        </Typography>

        {/* Invitation Details */}
        <Box sx={{ my: 3, p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            Invitation Details
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip 
              label={`Role: ${invitation.role.toUpperCase()}`} 
              color={
                invitation.role === 'mentor' ? 'warning' : 
                invitation.role === 'manager' ? 'secondary' : 
                'primary'
              }
            />
            {invitation.hospitalName && (
              <Chip label={`Hospital: ${invitation.hospitalName}`} variant="outlined" />
            )}
            {invitation.mentorName && (
              <Chip label={`Mentor: ${invitation.mentorName}`} variant="outlined" />
            )}
            {invitation.managerName && (
              <Chip label={`Manager: ${invitation.managerName}`} variant="outlined" />
            )}
          </Box>
          {invitation.customMessage && (
            <Typography variant="body2" sx={{ mt: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1 }}>
              <strong>Message from your inviter:</strong><br />
              {invitation.customMessage}
            </Typography>
          )}
          <Alert severity="info" sx={{ mt: 2 }}>
            {emailConfirmationMessage || 'After completing registration, you will receive an email to confirm your account. Please check your inbox and click the confirmation link before logging in.'}
          </Alert>
        </Box>

        <Divider sx={{ my: 3 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
              fullWidth
              required
              disabled={submitting}
            />
            <TextField
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
              fullWidth
              required
              disabled={submitting}
            />
          </Box>

          <TextField
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            fullWidth
            required
            disabled={submitting || !!invitation?.email}
            helperText={invitation?.email ? 'This email is pre-filled from your invitation' : undefined}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Phone (optional)"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            fullWidth
            disabled={submitting}
            sx={{ mb: 2 }}
          />

          {questionsLoading ? (
            <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={24} /></Box>
          ) : visibleQuestions.length > 0 ? (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>Additional questions</Typography>
              {visibleQuestions.map((q) => {
                const value = registrationAnswers[q.id];
                const opts = q.options || [];
                if (q.question_type === 'paragraph') {
                  return (
                    <TextField key={q.id} fullWidth multiline rows={3} label={q.label} required={q.required} value={(value as string) ?? ''} onChange={(e) => setRegistrationAnswer(q.id, e.target.value)} margin="normal" />
                  );
                }
                if (q.question_type === 'checkbox') {
                  if (opts.length > 0) {
                    const selected = (Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []) as string[];
                    return (
                      <FormControl key={q.id} fullWidth margin="normal" required={q.required}>
                        <FormLabel>{q.label + (q.required ? ' *' : '')}</FormLabel>
                        <FormGroup>
                          {opts.map((opt) => (
                            <FormControlLabel
                              key={opt}
                              control={<Checkbox checked={selected.includes(opt)} onChange={(e) => { const next = e.target.checked ? [...selected, opt] : selected.filter((x) => x !== opt); setRegistrationAnswer(q.id, next); }} />}
                              label={opt}
                              sx={{ display: 'block', mb: 0.5 }}
                            />
                          ))}
                        </FormGroup>
                      </FormControl>
                    );
                  }
                  return (
                    <FormControlLabel key={q.id} control={<Checkbox checked={value === true} onChange={(e) => setRegistrationAnswer(q.id, e.target.checked)} />} label={q.label + (q.required ? ' *' : '')} sx={{ display: 'block', mb: 1 }} />
                  );
                }
                if (q.question_type === 'radio') {
                  return (
                    <FormControl key={q.id} fullWidth margin="normal" required={q.required}>
                      <FormLabel>{q.label}</FormLabel>
                      <RadioGroup value={typeof value === 'string' ? value : ''} onChange={(_, v) => setRegistrationAnswer(q.id, v)}>
                        {opts.map((opt) => (
                          <FormControlLabel key={opt} value={opt} control={<Radio />} label={opt} />
                        ))}
                      </RadioGroup>
                    </FormControl>
                  );
                }
                if (q.question_type === 'select') {
                  return (
                    <FormControl key={q.id} fullWidth margin="normal" required={q.required}>
                      <InputLabel>{q.label}</InputLabel>
                      <Select value={(value as string) ?? ''} label={q.label} onChange={(e) => setRegistrationAnswer(q.id, e.target.value)}>
                        <MenuItem value="">—</MenuItem>
                        {opts.map((opt) => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  );
                }
                if (q.question_type === 'date') {
                  return (
                    <TextField key={q.id} fullWidth type="date" label={q.label} required={q.required} value={(value as string) ?? ''} onChange={(e) => setRegistrationAnswer(q.id, e.target.value)} margin="normal" InputLabelProps={{ shrink: true }} />
                  );
                }
                return (
                  <TextField key={q.id} fullWidth label={q.label} required={q.required} value={(value as string) ?? ''} onChange={(e) => setRegistrationAnswer(q.id, e.target.value)} margin="normal" type={q.question_type === 'email' ? 'email' : q.question_type === 'number' ? 'number' : 'text'} />
                );
              })}
            </Box>
          ) : null}

          <TextField
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            fullWidth
            required
            disabled={submitting}
            helperText="At least 8 characters"
            sx={{ mb: 2 }}
          />

          <TextField
            label="Confirm Password"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            fullWidth
            required
            disabled={submitting}
            sx={{ mb: 3 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : undefined}
          >
            {submitting ? 'Creating account...' : 'Complete Registration'}
          </Button>
        </form>

        <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 3 }}>
          Already have an account?{' '}
          <Button size="small" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </Typography>
      </Paper>
    </Container>
  );
};

export default InvitationPage;
