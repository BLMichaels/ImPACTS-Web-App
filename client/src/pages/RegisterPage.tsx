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
  FormGroup,
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
import { hospitalIdOrFacilityOrClause } from '../utils/hospitalId';
import TermsOfService from '../components/TermsOfService';
import { validateNewPassword, PASSWORD_REQUIREMENT_TEXT } from '../utils/passwordPolicy';
import type { RegistrationQuestion, RegistrationQuestionType, RegistrationQuestionDisplayCondition } from '../types/database';

interface HospitalOption {
  id: string;
  name: string;
  state: string;
  city: string;
  county: string;
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

  // Load all hospitals from CRM (state, county, city, name) for dropdown selection
  useEffect(() => {
    let mounted = true;
    setHospitalsLoading(true);
    (async () => {
      try {
        const list: HospitalOption[] = [];
        const chunk = 1000;
        let offset = 0;
        let hasMore = true;
        while (mounted && hasMore) {
          const { data, error: err } = await supabase
            .from('hospitals')
            .select('facility_id, id, name, state, city, county, hospital_system')
            .range(offset, offset + chunk - 1)
            .order('state', { ascending: true })
            .order('county', { ascending: true, nullsFirst: false })
            .order('city', { ascending: true })
            .order('name', { ascending: true });
          if (!mounted) return;
          if (err || !data) {
            setHospitals([]);
            setHospitalsLoading(false);
            return;
          }
          for (const row of data as Record<string, unknown>[]) {
            const id = String(row.facility_id ?? row.id ?? '');
            const name = normalizeHospitalOrOrgName(String(row.name ?? 'Unknown'));
            const state = String(row.state ?? '');
            const city = String(row.city ?? '');
            const county = String(row.county ?? '');
            const hospitalSystem = row.hospital_system != null ? String(row.hospital_system) : undefined;
            list.push({
              id,
              name,
              state,
              city,
              county,
              hospitalSystem,
              label: [state, county, city, name].filter(Boolean).join(' – ') || name
            });
          }
          hasMore = data.length >= chunk;
          offset += chunk;
        }
        if (!mounted) return;
        list.sort((a, b) => {
          const sa = a.state || '', sb = b.state || '';
          if (sa !== sb) return sa.localeCompare(sb);
          const coa = a.county || '', cob = b.county || '';
          if (coa !== cob) return coa.localeCompare(cob);
          const ca = a.city || '', cb = b.city || '';
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
                display_condition: dc && typeof dc === 'object' && dc.question_id ? dc : null,
                linked_crm_field: r.linked_crm_field != null ? String(r.linked_crm_field) : null,
                target_program_ids: r.target_program_ids != null && Array.isArray(r.target_program_ids) ? (r.target_program_ids as unknown[]).map((x) => String(x)) : null,
                target_cohort_ids: r.target_cohort_ids != null && Array.isArray(r.target_cohort_ids) ? (r.target_cohort_ids as unknown[]).map((x) => String(x)) : null
              } as RegistrationQuestion;
            })
            .filter((q) => !q.target_roles?.length || q.target_roles.includes(role))
            .filter((q) => {
              const hasProgramTarget = q.target_program_ids != null && q.target_program_ids.length > 0;
              const hasCohortTarget = q.target_cohort_ids != null && q.target_cohort_ids.length > 0;
              return !hasProgramTarget && !hasCohortTarget;
            });
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

  const hasLinkedField = (field: string) => visibleQuestions.some((q) => q.linked_crm_field === field);
  const getLinkedAnswer = (field: string): string | boolean | string[] | undefined => {
    const q = visibleQuestions.find((q) => q.linked_crm_field === field);
    if (!q) return undefined;
    return dynamicAnswers[q.id];
  };
  const getLinkedHospital = (): { facilityId: string | null; other: string | null } => {
    const q = visibleQuestions.find((q) => q.linked_crm_field === 'hospital');
    if (!q) return { facilityId: null, other: null };
    const id = dynamicAnswers[q.id] as string | undefined;
    const other = (dynamicAnswers[`${q.id}_other`] as string | undefined) ?? '';
    if (!id) return { facilityId: null, other: null };
    if (id === OTHER_HOSPITAL_ID) return { facilityId: null, other: other.trim() || null };
    return { facilityId: id, other: null };
  };

  const linkedHospitalFacilityId = (() => {
    const q = visibleQuestions.find((q) => q.linked_crm_field === 'hospital');
    return q ? (dynamicAnswers[q.id] as string | undefined) : undefined;
  })();
  const linkedHospitalOption = linkedHospitalFacilityId && linkedHospitalFacilityId !== OTHER_HOSPITAL_ID ? hospitals.find((h) => h.id === linkedHospitalFacilityId) ?? null : null;
  const effectiveHospitalSystem = linkedHospitalOption?.hospitalSystem ?? selectedHospitalFromCrm?.hospitalSystem ?? hospitalSystem;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const effectiveFirstName = (hasLinkedField('first_name') ? String(getLinkedAnswer('first_name') ?? '').trim() : firstName.trim()) || '';
    const effectiveLastName = (hasLinkedField('last_name') ? String(getLinkedAnswer('last_name') ?? '').trim() : lastName.trim()) || '';
    const effectiveEmail = (hasLinkedField('email') ? String(getLinkedAnswer('email') ?? '').trim() : email.trim()) || '';
    const effectiveNprqi = hasLinkedField('nprqi_participant') ? getLinkedAnswer('nprqi_participant') : nprqiParticipant;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (password !== confirmPassword) return setError('Passwords do not match');
    const passwordPolicyError = validateNewPassword(password);
    if (passwordPolicyError) return setError(passwordPolicyError);
    if (!termsAccepted) return setError('You must accept the Terms of Service to register.');

    if (!effectiveFirstName) return setError('First name is required.');
    if (!effectiveLastName) return setError('Last name is required.');
    if (!effectiveEmail) return setError('Email is required.');
    if (!emailRegex.test(effectiveEmail)) return setError('Please enter a valid email address.');
    if (effectiveNprqi === '' || effectiveNprqi === undefined) return setError('Please indicate if you are participating in NPRQI.');

    let hospitalFacilityId: string | null;
    let hospitalOther: string | null;
    if (hasLinkedField('hospital')) {
      const linked = getLinkedHospital();
      hospitalFacilityId = linked.facilityId;
      hospitalOther = linked.other;
      if (!hospitalFacilityId && !(hospitalOther && hospitalOther.trim())) return setError('Please select your hospital or choose "Other" and enter it.');
      if (hospitalFacilityId === null && hospitalOther !== null && !hospitalOther.trim()) return setError('Please enter your hospital name when selecting "Other".');
    } else {
      if (!hospitalValue) return setError('Please select your hospital or choose "Other" and enter it.');
      if (hospitalValue.id === OTHER_HOSPITAL_ID && !hospitalOtherText.trim()) return setError('Please enter your hospital name when selecting "Other".');
      hospitalFacilityId = hospitalValue!.id === OTHER_HOSPITAL_ID ? null : hospitalValue!.id;
      hospitalOther = hospitalValue!.id === OTHER_HOSPITAL_ID ? hospitalOtherText.trim() : null;
    }

    const requiredQuestions = registrationQuestions.filter((q) => q.required && satisfiesDisplayCondition(q, dynamicAnswers));
    for (const q of requiredQuestions) {
      if (q.linked_crm_field === 'hospital') {
        const linked = getLinkedHospital();
        if (!linked.facilityId && !(linked.other && linked.other.trim())) return setError(`"${q.label}" is required.`);
        if (!linked.facilityId && linked.other !== null && !linked.other.trim()) return setError(`"${q.label}": please enter your hospital name when selecting "Other".`);
      } else {
        const v = dynamicAnswers[q.id];
        if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
          return setError(`"${q.label}" is required.`);
        }
      }
    }

    try {
      setLoading(true);
      const { data, error: signUpError } = await supabase.auth.signUp({ email: effectiveEmail.trim().toLowerCase(), password });
      if (signUpError) throw signUpError;
      if (!data?.user) throw new Error('Sign up failed.');

      const userId = data.user.id;
      const effectivePhone = hasLinkedField('phone') ? String(getLinkedAnswer('phone') ?? '').trim() : phone.trim();
      const effectiveJobTitle = hasLinkedField('job_title') ? String(getLinkedAnswer('job_title') ?? '').trim() : jobTitle.trim();
      const effectiveDepartment = hasLinkedField('department') ? String(getLinkedAnswer('department') ?? '').trim() : department.trim();
      const effectiveHospitalSystemVal = hasLinkedField('hospital_system') ? String(getLinkedAnswer('hospital_system') ?? '').trim() : effectiveHospitalSystem.trim();
      const effectiveNprqiBool = hasLinkedField('nprqi_participant')
        ? (getLinkedAnswer('nprqi_participant') === true || getLinkedAnswer('nprqi_participant') === 'yes')
        : nprqiParticipant === true;
      const effectiveAdditionalName = hasLinkedField('additional_contact_name') ? String(getLinkedAnswer('additional_contact_name') ?? '').trim() : additionalContactName.trim();
      const effectiveAdditionalEmail = hasLinkedField('additional_contact_email') ? String(getLinkedAnswer('additional_contact_email') ?? '').trim() : additionalContactEmail.trim();
      const effectiveAdditionalJobTitle = hasLinkedField('additional_contact_job_title') ? String(getLinkedAnswer('additional_contact_job_title') ?? '').trim() : additionalContactJobTitle.trim();

      const { error: updateError } = await supabase.from('users').update({
        first_name: effectiveFirstName,
        last_name: effectiveLastName,
        role: 'pecc',
        is_active: true,
        phone: effectivePhone || null,
        hospital_facility_id: hospitalFacilityId,
        hospital_other: hospitalOther,
        job_title: effectiveJobTitle || null,
        department: effectiveDepartment || null,
        nprqi_participant: effectiveNprqiBool,
        additional_contact_name: effectiveAdditionalName || null,
        additional_contact_email: effectiveAdditionalEmail || null,
        additional_contact_job_title: effectiveAdditionalJobTitle || null,
        hospital_system: effectiveHospitalSystemVal || null,
        registration_answers: dynamicAnswers,
        updated_at: new Date().toISOString()
      }).eq('id', userId);

      if (updateError) {
        throw new Error(`Profile setup failed: ${updateError.message}`);
      }

      // Add this person to the CRM as a contact associated with their hospital
      if (hospitalFacilityId) {
        const { data: hosp } = await supabase
          .from('hospitals')
          .select('id')
          .or(hospitalIdOrFacilityOrClause(hospitalFacilityId))
          .limit(1)
          .maybeSingle();
        const hospitalId = hosp && typeof (hosp as { id?: string }).id === 'string' ? (hosp as { id: string }).id : null;
        if (hospitalId) {
          const { error: upsertContactError } = await supabase.from('hospital_contacts').upsert(
            {
              hospital_id: hospitalId,
              user_id: userId,
              first_name: effectiveFirstName,
              last_name: effectiveLastName,
              email: effectiveEmail,
              phone: effectivePhone || null,
              contact_status: 'New PECC',
              role_at_hospital: effectiveJobTitle || null,
              is_primary_contact: false,
              is_actively_engaged: true,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'hospital_id,user_id' }
          );
          if (upsertContactError) {
            throw new Error(`Could not link your account to CRM contacts: ${upsertContactError.message}`);
          }
        }
      }

      const { setUserData } = await import('../utils/userData');
      await setUserData(userId, 'terms_accepted_at', new Date().toISOString());
      navigate('/', { replace: true });
    } catch (err: unknown) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
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
    { id: OTHER_HOSPITAL_ID, name: 'Other', state: '', city: '', county: '', label: 'Other (type below)' }
  ];

  const setDynamicAnswer = (questionId: string, value: string | boolean | string[]) => {
    setDynamicAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const renderQuestion = (q: RegistrationQuestion) => {
    if (q.linked_crm_field === 'hospital') {
      const linkState = (dynamicAnswers[`${q.id}_state`] as string) ?? '';
      const linkCounty = (dynamicAnswers[`${q.id}_county`] as string) ?? '';
      const linkCity = (dynamicAnswers[`${q.id}_city`] as string) ?? '';
      const linkHospitalId = (dynamicAnswers[q.id] as string) ?? '';
      const linkOther = (dynamicAnswers[`${q.id}_other`] as string) ?? '';
      const states = [...new Set(hospitals.map((h) => h.state).filter(Boolean))].sort();
      const counties = linkState ? [...new Set(hospitals.filter((h) => h.state === linkState).map((h) => h.county || ''))].sort((a, b) => (a || '').localeCompare(b || '')) : [];
      const matchCounty = (h: HospitalOption) => linkCounty === '' ? !h.county : h.county === linkCounty;
      const cities = linkState ? [...new Set(hospitals.filter((h) => h.state === linkState && matchCounty(h)).map((h) => h.city).filter(Boolean))].sort() : [];
      const hospitalsInStateCountyCity = linkState && linkCity
        ? hospitals.filter((h) => h.state === linkState && matchCounty(h) && h.city === linkCity)
        : [];
      const hospitalOptionsForLink: HospitalOption[] = [
        ...hospitalsInStateCountyCity,
        { id: OTHER_HOSPITAL_ID, name: 'Other', state: '', city: '', county: '', label: 'Other (type below)' }
      ];
      return (
        <Box key={q.id} sx={{ mt: 2, mb: 2 }}>
          <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>{q.label}{q.required ? ' *' : ''}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Choose from the CRM list: State → County → City → Hospital</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth size="small" required={q.required}>
              <InputLabel>State</InputLabel>
              <Select
                value={linkState}
                label="State"
                onChange={(e) => {
                  const v = e.target.value;
                  setDynamicAnswers((prev) => ({ ...prev, [`${q.id}_state`]: v, [`${q.id}_county`]: '', [`${q.id}_city`]: '', [q.id]: '', [`${q.id}_other`]: '' }));
                }}
              >
                <MenuItem value="">— Select state —</MenuItem>
                {states.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {linkState && (
              <FormControl fullWidth size="small" required={q.required}>
                <InputLabel>County</InputLabel>
                <Select
                  value={linkCounty}
                  label="County"
                  onChange={(e) => {
                    const v = e.target.value;
                    setDynamicAnswers((prev) => ({ ...prev, [`${q.id}_county`]: v, [`${q.id}_city`]: '', [q.id]: '', [`${q.id}_other`]: '' }));
                  }}
                >
                  <MenuItem value="">— Select county —</MenuItem>
                  {counties.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {linkState && linkCounty && (
              <FormControl fullWidth size="small" required={q.required}>
                <InputLabel>City</InputLabel>
                <Select
                  value={linkCity}
                  label="City"
                  onChange={(e) => {
                    const v = e.target.value;
                    setDynamicAnswers((prev) => ({ ...prev, [`${q.id}_city`]: v, [q.id]: '', [`${q.id}_other`]: '' }));
                  }}
                >
                  <MenuItem value="">— Select city —</MenuItem>
                  {cities.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {linkState && linkCounty && linkCity && (
              <>
                <FormControl fullWidth size="small" required={q.required}>
                  <InputLabel>Hospital</InputLabel>
                  <Select
                    value={linkHospitalId}
                    label="Hospital"
                    onChange={(e) => {
                      const v = e.target.value;
                      setDynamicAnswers((prev) => ({
                        ...prev,
                        [q.id]: v,
                        [`${q.id}_other`]: v === OTHER_HOSPITAL_ID ? (prev[`${q.id}_other`] as string) ?? '' : ''
                      }));
                    }}
                  >
                    <MenuItem value="">— Select hospital —</MenuItem>
                    {hospitalOptionsForLink.map((opt) => (
                      <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {linkHospitalId === OTHER_HOSPITAL_ID && (
                  <TextField
                    fullWidth
                    size="small"
                    label="Hospital name (Other)"
                    required={q.required}
                    value={linkOther}
                    onChange={(e) => setDynamicAnswer(`${q.id}_other`, e.target.value)}
                    placeholder="Enter your hospital or facility name"
                  />
                )}
              </>
            )}
          </Box>
        </Box>
      );
    }

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
        if (opts.length > 0) {
          const selected = (Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []) as string[];
          return (
            <FormControl key={q.id} fullWidth margin="normal" required={q.required}>
              <FormLabel>{q.label + (q.required ? ' *' : '')}</FormLabel>
              <FormGroup>
                {opts.map((opt) => (
                  <FormControlLabel
                    key={opt}
                    control={
                      <Checkbox
                        checked={selected.includes(opt)}
                        onChange={(e) => {
                          const next = e.target.checked ? [...selected, opt] : selected.filter((x) => x !== opt);
                          setDynamicAnswer(q.id, next);
                        }}
                      />
                    }
                    label={opt}
                  />
                ))}
              </FormGroup>
            </FormControl>
          );
        }
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
          {!hasLinkedField('hospital') && (
            <>
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
            </>
          )}

          {(!hasLinkedField('first_name') || !hasLinkedField('last_name') || !hasLinkedField('email') || !hasLinkedField('phone') || !hasLinkedField('job_title') || !hasLinkedField('department') || !hasLinkedField('hospital_system') || !hasLinkedField('nprqi_participant') || !hasLinkedField('additional_contact_name') || !hasLinkedField('additional_contact_email') || !hasLinkedField('additional_contact_job_title')) && (
            <>
              <Typography variant="subtitle1" color="primary" sx={{ mb: 1, mt: hasLinkedField('hospital') ? 2 : 0 }}>Contact information</Typography>
              {!hasLinkedField('first_name') && <TextField margin="normal" required fullWidth label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />}
              {!hasLinkedField('last_name') && <TextField margin="normal" required fullWidth label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />}
              {!hasLinkedField('email') && <TextField margin="normal" required fullWidth type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}
              {!hasLinkedField('phone') && <TextField margin="normal" fullWidth label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />}
              {!hasLinkedField('job_title') && <TextField margin="normal" required fullWidth label="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />}
              {!hasLinkedField('department') && <TextField margin="normal" required fullWidth label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} />}
              {!hasLinkedField('hospital_system') && (
                <TextField
                  margin="normal"
                  fullWidth
                  label="Hospital system (if applicable)"
                  value={effectiveHospitalSystem}
                  onChange={(e) => setHospitalSystem(e.target.value)}
                  placeholder={selectedHospitalFromCrm?.hospitalSystem || linkedHospitalOption?.hospitalSystem ? `Pre-filled from CRM: ${selectedHospitalFromCrm?.hospitalSystem || linkedHospitalOption?.hospitalSystem}` : ''}
                  helperText={selectedHospitalFromCrm?.hospitalSystem || linkedHospitalOption?.hospitalSystem ? 'Pre-filled from your selected hospital. You can edit if needed.' : undefined}
                />
              )}
              {!hasLinkedField('nprqi_participant') && (
                <FormControl component="fieldset" required sx={{ mt: 2, display: 'block' }}>
                  <FormLabel component="legend">Are you participating in NPRQI?</FormLabel>
                  <RadioGroup row value={nprqiParticipant === true ? 'yes' : nprqiParticipant === false ? 'no' : ''} onChange={(_, v) => setNprqiParticipant(v === 'yes')}>
                    <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                    <FormControlLabel value="no" control={<Radio />} label="No" />
                  </RadioGroup>
                </FormControl>
              )}
              {(!hasLinkedField('additional_contact_name') || !hasLinkedField('additional_contact_email') || !hasLinkedField('additional_contact_job_title')) && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Additional contact from your department</Typography>
                  {!hasLinkedField('additional_contact_name') && <TextField margin="normal" fullWidth label="Name" value={additionalContactName} onChange={(e) => setAdditionalContactName(e.target.value)} />}
                  {!hasLinkedField('additional_contact_email') && <TextField margin="normal" fullWidth type="email" label="Email" value={additionalContactEmail} onChange={(e) => setAdditionalContactEmail(e.target.value)} />}
                  {!hasLinkedField('additional_contact_job_title') && <TextField margin="normal" fullWidth label="Job title" value={additionalContactJobTitle} onChange={(e) => setAdditionalContactJobTitle(e.target.value)} />}
                </>
              )}
            </>
          )}

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
          <TextField margin="normal" required fullWidth type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" helperText={PASSWORD_REQUIREMENT_TEXT} />
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
