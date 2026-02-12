import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Container,
  FormControlLabel,
  Checkbox,
  Link,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Divider,
  CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { normalizeHospitalOrOrgName } from '../utils/displayName';
import TermsOfService from '../components/TermsOfService';
import type { RegistrationQuestion, RegistrationQuestionType, RegistrationQuestionDisplayCondition } from '../types/database';

interface HospitalOption {
  id: string;
  name: string;
  state: string;
  city: string;
  hospitalSystem?: string;
  label: string;
}

const OTHER_HOSPITAL_ID = '__OTHER__';

export default function RegisterPage() {
  const navigate = useNavigate();

  // Hospital (CRM list or Other)
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);
  const [hospitalValue, setHospitalValue] = useState<HospitalOption | null>(null);
  const [hospitalOtherText, setHospitalOtherText] = useState('');

  // Contact
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [hospitalSystem, setHospitalSystem] = useState('');
  const [nprqiParticipant, setNprqiParticipant] = useState<boolean | ''>('');
  const [additionalContactName, setAdditionalContactName] = useState('');
  const [additionalContactEmail, setAdditionalContactEmail] = useState('');
  const [additionalContactJobTitle, setAdditionalContactJobTitle] = useState('');

  // Auth & terms
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Dynamic questions
  const [registrationQuestions, setRegistrationQuestions] = useState<RegistrationQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string | boolean | string[]>>({});

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load hospitals from CRM (state, city, name)
  useEffect(() => {
    let mounted = true;
    setHospitalsLoading(true);
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('hospitals')
          .select('facility_id, id, name, state, city, hospital_system')
          .limit(2000);
        if (!mounted) return;
        if (err || !data) {
          setHospitals([]);
          setHospitalsLoading(false);
          return;
        }
        const list: HospitalOption[] = (data as Record<string, unknown>[]).map((row) => {
          const id = String(row.facility_id ?? row.id ?? '');
          const name = normalizeHospitalOrOrgName(String(row.name ?? 'Unknown'));
          const state = String(row.state ?? '');
          const city = String(row.city ?? '');
          const hospitalSystem = row.hospital_system != null ? String(row.hospital_system) : undefined;
          return {
            id,
            name,
            state,
            city,
            hospitalSystem,
            label: [state, city, name].filter(Boolean).join(' – ') || name
          };
        });
        list.sort((a, b) => {
          const sa = a.state || '';
          const sb = b.state || '';
          if (sa !== sb) return sa.localeCompare(sb);
          const ca = a.city || '';
          const cb = b.city || '';
          if (ca !== cb) return ca.localeCompare(cb);
          return (a.name || '').localeCompare(b.name || '');
        });
        setHospitals(list);
      } finally {
        if (mounted) setHospitalsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load registration questions
  useEffect(() => {
    let mounted = true;
    setQuestionsLoading(true);
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('registration_questions')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        if (!mounted) return;
        if (err || !data) {
          setRegistrationQuestions([]);
        } else {
          const role = 'pecc'; // RegisterPage is PECC self-registration
          const rows = (data as Record<string, unknown>[])
            .map((r) => {
              const targetRoles = r.target_roles != null && Array.isArray(r.target_roles) ? (r.target_roles as unknown[]).map((x) => String(x)) : null;
              const dc = r.display_condition as RegistrationQuestionDisplayCondition | null | undefined;
              return {
                id: String(r.id),
                label: String(r.label),
                question_type: (r.question_type as RegistrationQuestionType) || 'short_answer',
                required: Boolean(r.required),
                options: Array.isArray(r.options) ? (r.options as unknown[]).map((x) => String(x)) : [],
                sort_order: Number(r.sort_order) || 0,
                is_active: Boolean(r.is_active),
                created_at: r.created_at as string | undefined,
                updated_at: r.updated_at as string | undefined,
                target_roles: targetRoles,
                display_condition: dc && typeof dc === 'object' && dc.question_id ? dc : null
              } as RegistrationQuestion;
            })
            .filter((q) => !q.target_roles?.length || q.target_roles.includes(role));
          setRegistrationQuestions(rows);
        }
      } finally {
        if (mounted) setQuestionsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const isOtherHospital = hospitalValue?.id === OTHER_HOSPITAL_ID;
  const selectedHospitalFromCrm = hospitalValue && hospitalValue.id !== OTHER_HOSPITAL_ID ? hospitalValue : null;
  const effectiveHospitalSystem = selectedHospitalFromCrm?.hospitalSystem ?? hospitalSystem;

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

  const visibleQuestions = registrationQuestions.filter((q) => satisfiesDisplayCondition(q, dynamicAnswers));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) return setError('Passwords do not match');
    if (!termsAccepted) return setError('You must accept the Terms of Service to register.');
    if (!firstName.trim()) return setError('First name is required.');
    if (!lastName.trim()) return setError('Last name is required.');
    if (!email.trim()) return setError('Email is required.');
    if (nprqiParticipant === '') return setError('Please indicate if you are participating in NPRQI.');

    if (!hospitalValue) return setError('Please select your hospital or choose "Other" and enter it.');
    if (hospitalValue.id === OTHER_HOSPITAL_ID && !hospitalOtherText.trim()) return setError('Please enter your hospital name when selecting "Other".');

    const requiredQuestions = registrationQuestions.filter((q) => q.required && satisfiesDisplayCondition(q, dynamicAnswers));
    for (const q of requiredQuestions) {
      const v = dynamicAnswers[q.id];
      if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
        return setError(`"${q.label}" is required.`);
      }
    }

    try {
      setLoading(true);
      const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (signUpError) throw signUpError;
      if (!data?.user) throw new Error('Sign up failed.');

      const userId = data.user.id;
      const hospitalFacilityId = hospitalValue!.id === OTHER_HOSPITAL_ID ? null : hospitalValue!.id;
      const hospitalOther = hospitalValue!.id === OTHER_HOSPITAL_ID ? hospitalOtherText.trim() : null;

      const { error: updateError } = await supabase.from('users').update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        hospital_facility_id: hospitalFacilityId,
        hospital_other: hospitalOther,
        job_title: jobTitle.trim() || null,
        department: department.trim() || null,
        nprqi_participant: nprqiParticipant === true,
        additional_contact_name: additionalContactName.trim() || null,
        additional_contact_email: additionalContactEmail.trim() || null,
        additional_contact_job_title: additionalContactJobTitle.trim() || null,
        hospital_system: effectiveHospitalSystem.trim() || null,
        registration_answers: dynamicAnswers,
        updated_at: new Date().toISOString()
      }).eq('id', userId);

      if (updateError) {
        console.error('Profile update failed:', updateError);
        // Still allow login; profile can be updated later
      }

      // Add this person to the CRM as a contact associated with their hospital
      if (hospitalFacilityId) {
        const { data: hosp } = await supabase
          .from('hospitals')
          .select('id')
          .or(`id.eq.${hospitalFacilityId},facility_id.eq.${hospitalFacilityId}`)
          .limit(1)
          .maybeSingle();
        const hospitalId = hosp && typeof (hosp as { id?: string }).id === 'string' ? (hosp as { id: string }).id : null;
        if (hospitalId) {
          await supabase.from('hospital_contacts').upsert(
            {
              hospital_id: hospitalId,
              user_id: userId,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.trim(),
              phone: phone.trim() || null,
              contact_status: 'New PECC',
              role_at_hospital: jobTitle.trim() || null,
              is_primary_contact: false,
              is_actively_engaged: true,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'hospital_id,user_id' }
          );
        }
      }

      localStorage.setItem('termsAccepted', 'true');
      localStorage.setItem('termsAcceptedDate', new Date().toISOString());
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed to create an account.');
    } finally {
      setLoading(false);
    }
  };

  const handleTermsAccept = () => {
    setTermsAccepted(true);
    setShowTerms(false);
  };

  const hospitalOptions: HospitalOption[] = [
    ...hospitals,
    { id: OTHER_HOSPITAL_ID, name: 'Other', state: '', city: '', label: 'Other (type below)' }
  ];

  const setDynamicAnswer = (questionId: string, value: string | boolean | string[]) => {
    setDynamicAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const renderQuestion = (q: RegistrationQuestion) => {
    const value = dynamicAnswers[q.id];
    const opts = q.options || [];

    switch (q.question_type) {
      case 'paragraph':
        return (
          <TextField
            key={q.id}
            fullWidth
            multiline
            rows={3}
            label={q.label}
            required={q.required}
            value={(value as string) ?? ''}
            onChange={(e) => setDynamicAnswer(q.id, e.target.value)}
            margin="normal"
          />
        );
      case 'checkbox':
        return (
          <FormControlLabel
            key={q.id}
            control={
              <Checkbox
                checked={value === true}
                onChange={(e) => setDynamicAnswer(q.id, e.target.checked)}
              />
            }
            label={q.label + (q.required ? ' *' : '')}
          />
        );
      case 'radio':
        return (
          <FormControl key={q.id} fullWidth margin="normal" required={q.required}>
            <FormLabel>{q.label}</FormLabel>
            <RadioGroup
              value={typeof value === 'string' ? value : ''}
              onChange={(_, v) => setDynamicAnswer(q.id, v)}
            >
              {opts.map((opt) => (
                <FormControlLabel key={opt} value={opt} control={<Radio />} label={opt} />
              ))}
            </RadioGroup>
          </FormControl>
        );
      case 'select':
        return (
          <FormControl key={q.id} fullWidth margin="normal" required={q.required}>
            <InputLabel>{q.label}</InputLabel>
            <Select
              value={(value as string) ?? ''}
              label={q.label}
              onChange={(e) => setDynamicAnswer(q.id, e.target.value)}
            >
              <MenuItem value="">—</MenuItem>
              {opts.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case 'date':
        return (
          <TextField
            key={q.id}
            fullWidth
            type="date"
            label={q.label}
            required={q.required}
            value={(value as string) ?? ''}
            onChange={(e) => setDynamicAnswer(q.id, e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
        );
      case 'number':
        return (
          <TextField
            key={q.id}
            fullWidth
            type="number"
            label={q.label}
            required={q.required}
            value={(value as string) ?? ''}
            onChange={(e) => setDynamicAnswer(q.id, e.target.value)}
            margin="normal"
          />
        );
      case 'email':
      case 'phone':
        return (
          <TextField
            key={q.id}
            fullWidth
            type={q.question_type}
            label={q.label}
            required={q.required}
            value={(value as string) ?? ''}
            onChange={(e) => setDynamicAnswer(q.id, e.target.value)}
            margin="normal"
          />
        );
      default:
        return (
          <TextField
            key={q.id}
            fullWidth
            label={q.label}
            required={q.required}
            value={(value as string) ?? ''}
            onChange={(e) => setDynamicAnswer(q.id, e.target.value)}
            margin="normal"
          />
        );
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, mb: 6 }}>
        <Typography component="h1" variant="h4" gutterBottom align="center">
          PECC Registration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }} align="center">
          Create an account to access the Pediatric Emergency Care Coordinator tools.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          <Typography variant="subtitle1" color="primary" sx={{ mt: 2, mb: 1 }}>Hospital</Typography>
          {hospitalsLoading ? (
            <Box sx={{ py: 2 }}><CircularProgress size={24} /></Box>
          ) : (
            <>
              <Autocomplete
                options={hospitalOptions}
                getOptionLabel={(opt) => opt.label}
                value={hospitalValue}
                onChange={(_, v) => setHospitalValue(v)}
                renderInput={(params) => (
                  <TextField {...params} label="Hospital (or Other)" required placeholder="Search by state, city, or name" />
                )}
              />
              {isOtherHospital && (
                <TextField
                  fullWidth
                  label="Hospital name (Other)"
                  required
                  value={hospitalOtherText}
                  onChange={(e) => setHospitalOtherText(e.target.value)}
                  margin="normal"
                  placeholder="Enter your hospital or facility name"
                />
              )}
            </>
          )}

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle1" color="primary" sx={{ mb: 1 }}>Contact information</Typography>
          <TextField margin="normal" required fullWidth label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <TextField margin="normal" required fullWidth label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <TextField margin="normal" required fullWidth type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <TextField margin="normal" fullWidth label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <TextField margin="normal" required fullWidth label="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          <TextField margin="normal" required fullWidth label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} />

          <TextField
            margin="normal"
            fullWidth
            label="Hospital system (if applicable)"
            value={effectiveHospitalSystem}
            onChange={(e) => setHospitalSystem(e.target.value)}
            placeholder={selectedHospitalFromCrm?.hospitalSystem ? `Pre-filled from CRM: ${selectedHospitalFromCrm.hospitalSystem}` : ''}
            helperText={selectedHospitalFromCrm?.hospitalSystem ? 'Pre-filled from your selected hospital. You can edit if needed.' : undefined}
          />

          <FormControl component="fieldset" required sx={{ mt: 2, display: 'block' }}>
            <FormLabel component="legend">Are you participating in NPRQI?</FormLabel>
            <RadioGroup row value={nprqiParticipant === true ? 'yes' : nprqiParticipant === false ? 'no' : ''} onChange={(_, v) => setNprqiParticipant(v === 'yes')}>
              <FormControlLabel value="yes" control={<Radio />} label="Yes" />
              <FormControlLabel value="no" control={<Radio />} label="No" />
            </RadioGroup>
          </FormControl>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Additional contact from your department</Typography>
          <TextField margin="normal" fullWidth label="Name" value={additionalContactName} onChange={(e) => setAdditionalContactName(e.target.value)} />
          <TextField margin="normal" fullWidth type="email" label="Email" value={additionalContactEmail} onChange={(e) => setAdditionalContactEmail(e.target.value)} />
          <TextField margin="normal" fullWidth label="Job title" value={additionalContactJobTitle} onChange={(e) => setAdditionalContactJobTitle(e.target.value)} />

          {questionsLoading ? (
            <Box sx={{ py: 2 }}><CircularProgress size={24} /></Box>
          ) : (
            visibleQuestions.length > 0 && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle1" color="primary" sx={{ mb: 1 }}>Additional questions</Typography>
                {visibleQuestions.map(renderQuestion)}
              </>
            )
          )}

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle1" color="primary" sx={{ mb: 1 }}>Account &amp; Terms</Typography>
          <TextField margin="normal" required fullWidth type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <TextField margin="normal" required fullWidth type="password" label="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />

          <Box sx={{ mt: 2, mb: 2 }}>
            <FormControlLabel
              control={<Checkbox checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} color="primary" />}
              label={
                <Typography variant="body2">
                  I agree to the{' '}
                  <Link component="button" type="button" onClick={() => setShowTerms(true)} sx={{ textDecoration: 'underline' }}>
                    Terms of Service and User Agreement
                  </Link>
                </Typography>
              }
            />
          </Box>

          <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading || !termsAccepted}>
            {loading ? 'Creating account…' : 'Register'}
          </Button>
          <Button fullWidth variant="text" onClick={() => navigate('/login')}>
            Already have an account? Login
          </Button>
        </Box>
      </Box>

      <TermsOfService open={showTerms} onClose={() => setShowTerms(false)} onAccept={handleTermsAccept} showAcceptButton />
    </Container>
  );
}
