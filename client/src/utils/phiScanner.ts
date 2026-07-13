/**
 * Heuristic scanner for accidental HIPAA Safe Harbor identifiers in free-text.
 * Defense-in-depth only — not a guarantee of zero PHI.
 * @see https://cphs.berkeley.edu/hipaa/hipaa18.html
 */

export type PhiSeverity = 'none' | 'medium' | 'high';

export interface PhiFinding {
  /** Safe Harbor identifier number 1–18 */
  identifierNumber: number;
  category: string;
  severity: 'medium' | 'high';
  /** Redacted preview suitable for UI (never full SSN digits). */
  matchPreview: string;
  message: string;
}

export interface PhiScanResult {
  findings: PhiFinding[];
  maxSeverity: PhiSeverity;
}

export class PhiBlockedError extends Error {
  readonly findings: PhiFinding[];
  readonly surface: string;
  constructor(findings: PhiFinding[], surface = 'unknown') {
    super('Possible PHI detected — save blocked.');
    this.name = 'PhiBlockedError';
    this.findings = findings;
    this.surface = surface;
  }
}

export class PhiNeedsAcknowledgmentError extends Error {
  readonly findings: PhiFinding[];
  readonly surface: string;
  readonly contentHash: string;
  constructor(findings: PhiFinding[], contentHash: string, surface = 'unknown') {
    super('Possible PHI detected — acknowledgment required.');
    this.name = 'PhiNeedsAcknowledgmentError';
    this.findings = findings;
    this.contentHash = contentHash;
    this.surface = surface;
  }
}

export const HIPAA_18_CATEGORIES: Record<number, string> = {
  1: 'Names',
  2: 'Geographic subdivisions smaller than a state',
  3: 'Dates related to an individual (except year)',
  4: 'Telephone numbers',
  5: 'Fax numbers',
  6: 'Email addresses',
  7: 'Social Security numbers',
  8: 'Medical record numbers',
  9: 'Health plan beneficiary numbers',
  10: 'Account numbers',
  11: 'Certificate / license numbers',
  12: 'Vehicle identifiers / license plates',
  13: 'Device identifiers / serial numbers',
  14: 'Web URLs',
  15: 'IP addresses',
  16: 'Biometric identifiers',
  17: 'Full-face photographic images',
  18: 'Other unique identifying codes',
};

/** Continuity / user_data keys that hold free-text narrative (scan these). */
export const PHI_NARRATIVE_DATA_KEYS = new Set([
  'gapPlans',
  'activities',
  'mentorActivities',
  'simulation_sessions',
  'simulation_gaps',
  'gap_closure_question_notes',
  'dashboard_department_contacts',
  'mentorHospitals',
  'mentorContacts',
  'prismActivities',
  'mentorWages',
  'admin_project_pipeline_simbox',
  'admin_project_pipeline_scholarship',
  'admin_project_pipeline_research_dissemination',
  'admin_project_pipeline_abstracts',
  'prsQuestions',
  'dashboard_resources',
]);

/** Keys that autosave frequently — persistence hard-blocks high only; medium is logged. */
export const PHI_AUTOSAVE_DATA_KEYS = new Set([
  'dashboard_department_contacts',
  'simulation_sessions',
  'simulation_gaps',
  'prsQuestions',
]);

/** Object keys that are structured identity / staff fields — do not scan their values. */
const SKIP_FIELD_KEYS = new Set([
  'id',
  'user_id',
  'hospital_id',
  'facility_id',
  'email',
  'phone',
  'fax',
  'first_name',
  'last_name',
  'name',
  'contactName',
  'contact_name',
  'department',
  'owner',
  'assignee',
  'assignedTo',
  'assigned_to',
  'assignedBy',
  'leadSenior',
  'lead_senior',
  'teamMember',
  'team_member',
  'teamMembers',
  'projectLead',
  'projectSponsor',
  'projectAdmin',
  'consulted',
  'informed',
  'reachOutToLeadAuthor',
  'interestedCoAuthors',
  'vendor',
  'participants', // often staff roles/names in sim forms
  'address',
  'city',
  'state',
  'zip',
  'zip_code',
  'county',
  'region',
  'created_at',
  'updated_at',
  'date',
  'activityDate',
  'startDate',
  'endDate',
  'role',
  'status',
  'type',
  'url',
  'fileData',
  'file_data',
  'receiptFileName',
]);

/** Words that look Title-Case but are not person names in PECC/readiness text. */
const NAME_STOPWORDS = new Set([
  'safety',
  'care',
  'education',
  'family',
  'families',
  'experience',
  'outcomes',
  'volume',
  'flow',
  'handbook',
  'advocate',
  'rights',
  'portal',
  'identifier',
  'identifiers',
  'information',
  'privacy',
  'readiness',
  'transport',
  'handoff',
  'life',
  'officer',
  'director',
  'manager',
  'coordinator',
  'educator',
  'nurse',
  'nursing',
  'physician',
  'hospitalist',
  'intensivist',
  'trauma',
  'emergency',
  'pediatric',
  'pediatrics',
  'policy',
  'policies',
  'procedure',
  'procedures',
  'team',
  'staff',
  'mentor',
  'manager',
  'pecc',
]);

/**
 * Staff-collaboration phrasing — person names here are expected (gap owners, colleagues).
 * Do not treat nearby Title-Case names as patient PHI solely because "patient" appears elsewhere.
 */
const STAFF_NAME_CONTEXT_RE =
  /\b(?:talk\s+to|speak\s+(?:to|with)|spoke\s+with|meet\s+with|meeting\s+with|assign(?:ed)?\s+to|follow[\s-]?up\s+with|reach\s+out\s+to|email|call|ask|notify|cc|owner|assignee|contact)\b/i;

const APP_URL_ALLOWLIST = [
  'peccsupporttool.com',
  'impacts-tau.vercel.app',
  'localhost',
  'supabase.co',
];

const acknowledgedHashes = new Set<string>();

export function acknowledgePhiContent(contentHash: string): void {
  if (contentHash) acknowledgedHashes.add(contentHash);
}

export function clearPhiAcknowledgments(): void {
  acknowledgedHashes.clear();
}

export function isPhiAcknowledged(contentHash: string): boolean {
  return acknowledgedHashes.has(contentHash);
}

/** Stable hash for acknowledgment tokens (not cryptographic). */
export function hashPhiContent(text: string): string {
  let h = 2166136261;
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `phi_${(h >>> 0).toString(16)}`;
}

function redactPreview(raw: string, kind: 'ssn' | 'generic' = 'generic'): string {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (kind === 'ssn') {
    const digits = t.replace(/\D/g, '');
    if (digits.length >= 4) return `***-**-${digits.slice(-4)}`;
    return '***-**-****';
  }
  if (t.length <= 8) return `${t.slice(0, 2)}…`;
  return `${t.slice(0, 4)}…${t.slice(-2)}`;
}

function pushFinding(
  out: PhiFinding[],
  seen: Set<string>,
  finding: PhiFinding
): void {
  const key = `${finding.identifierNumber}:${finding.severity}:${finding.matchPreview}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(finding);
}

function maxSeverityOf(findings: PhiFinding[]): PhiSeverity {
  if (findings.some((f) => f.severity === 'high')) return 'high';
  if (findings.some((f) => f.severity === 'medium')) return 'medium';
  return 'none';
}

function isLikelyPersonName(candidate: string): boolean {
  const parts = String(candidate || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every((p) => !NAME_STOPWORDS.has(p.toLowerCase()));
}

/**
 * Scan a single free-text string for likely HIPAA identifiers.
 * Staff names (gap owners, "talk to Jane Doe about policy") are allowed;
 * only patient-context names are flagged.
 */
export function scanTextForPhi(text: string | null | undefined): PhiScanResult {
  const raw = String(text ?? '');
  if (!raw.trim()) return { findings: [], maxSeverity: 'none' };

  const findings: PhiFinding[] = [];
  const seen = new Set<string>();
  const lower = raw.toLowerCase();

  // 7 — SSN (high)
  const ssnRe = /\b(?:ssn|social\s*security(?:\s*number)?)\s*[:#]?\s*(\d{3}[-\s]?\d{2}[-\s]?\d{4})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = ssnRe.exec(raw)) !== null) {
    pushFinding(findings, seen, {
      identifierNumber: 7,
      category: HIPAA_18_CATEGORIES[7],
      severity: 'high',
      matchPreview: redactPreview(m[1], 'ssn'),
      message: 'Social Security number pattern detected.',
    });
  }
  const bareSsn = /\b(\d{3}-\d{2}-\d{4})\b/g;
  while ((m = bareSsn.exec(raw)) !== null) {
    pushFinding(findings, seen, {
      identifierNumber: 7,
      category: HIPAA_18_CATEGORIES[7],
      severity: 'high',
      matchPreview: redactPreview(m[1], 'ssn'),
      message: 'Social Security number pattern detected.',
    });
  }

  // 8 / 18 — MRN / patient ID / chart # (high when labeled)
  const mrnRe =
    /\b(?:mrn|medical\s*record(?:\s*number)?)\s*[:#]?\s*([A-Za-z0-9-]{4,20})\b/gi;
  while ((m = mrnRe.exec(raw)) !== null) {
    pushFinding(findings, seen, {
      identifierNumber: 8,
      category: HIPAA_18_CATEGORIES[8],
      severity: 'high',
      matchPreview: redactPreview(m[1]),
      message: 'Labeled medical record number detected.',
    });
  }
  const patientIdRe =
    /\b(?:patient\s*id|chart\s*(?:#|number)|chart\s*#)\s*[:#]\s*([A-Za-z0-9-]{4,20})\b/gi;
  while ((m = patientIdRe.exec(raw)) !== null) {
    pushFinding(findings, seen, {
      identifierNumber: 18,
      category: HIPAA_18_CATEGORIES[18],
      severity: 'high',
      matchPreview: redactPreview(m[1]),
      message: 'Labeled patient / chart identifier detected.',
    });
  }

  // 9 — health plan beneficiary
  const planRe =
    /\b(?:member\s*id|beneficiary\s*(?:id|number)|health\s*plan\s*(?:id|number)|subscriber\s*id)\s*[:#]?\s*([A-Za-z0-9-]{4,24})\b/gi;
  while ((m = planRe.exec(raw)) !== null) {
    pushFinding(findings, seen, {
      identifierNumber: 9,
      category: HIPAA_18_CATEGORIES[9],
      severity: 'high',
      matchPreview: redactPreview(m[1]),
      message: 'Health plan beneficiary identifier detected.',
    });
  }

  // 10 — account numbers (labeled)
  const acctRe = /\b(?:account\s*(?:number|#|no\.?)|acct\.?\s*#?)\s*[:#]?\s*([A-Za-z0-9-]{5,24})\b/gi;
  while ((m = acctRe.exec(raw)) !== null) {
    pushFinding(findings, seen, {
      identifierNumber: 10,
      category: HIPAA_18_CATEGORIES[10],
      severity: 'high',
      matchPreview: redactPreview(m[1]),
      message: 'Account number pattern detected.',
    });
  }

  // 11 — license / certificate (labeled)
  const licRe =
    /\b(?:driver'?s?\s*license|dl\s*#|license\s*(?:number|#)|certificate\s*(?:number|#))\s*[:#]?\s*([A-Za-z0-9-]{5,20})\b/gi;
  while ((m = licRe.exec(raw)) !== null) {
    pushFinding(findings, seen, {
      identifierNumber: 11,
      category: HIPAA_18_CATEGORIES[11],
      severity: 'high',
      matchPreview: redactPreview(m[1]),
      message: 'Certificate / license number pattern detected.',
    });
  }

  // 3 — DOB / admission / discharge labeled (high)
  const dobRe =
    /\b(?:dob|date\s*of\s*birth|birth\s*date|admission\s*date|discharge\s*date|date\s*of\s*death)\s*[:#]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/gi;
  while ((m = dobRe.exec(raw)) !== null) {
    pushFinding(findings, seen, {
      identifierNumber: 3,
      category: HIPAA_18_CATEGORIES[3],
      severity: 'high',
      matchPreview: redactPreview(m[1]),
      message: 'Date related to an individual (DOB / admission / discharge) detected.',
    });
  }

  // 1 — patient names only (staff names like gap owners / "talk to John Smith" are allowed)
  const patientNamePatterns: RegExp[] = [
    /\b(?:patient|pt\.?)(?:'s)?\s+(?:named\s+|name\s*[:-]\s*)([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,2})\b/g,
    /\b(?:the\s+)?(?:patient|pt\.?)\s+([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,2})\b/g,
    /\b(?:infant|neonate)\s+(?:named\s+)?([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,2})\b/g,
  ];
  for (const re of patientNamePatterns) {
    re.lastIndex = 0;
    while ((m = re.exec(raw)) !== null) {
      const candidate = m[1];
      if (!isLikelyPersonName(candidate)) continue;
      // Ignore when the hit is clearly staff collaboration phrasing in the same clause.
      const windowStart = Math.max(0, m.index - 40);
      const window = raw.slice(windowStart, m.index + m[0].length + 10);
      if (STAFF_NAME_CONTEXT_RE.test(window) && !/\b(?:patient|pt\.?|infant|neonate)\b/i.test(window)) {
        continue;
      }
      pushFinding(findings, seen, {
        identifierNumber: 1,
        category: HIPAA_18_CATEGORIES[1],
        severity: 'high',
        matchPreview: redactPreview(candidate),
        message: 'Possible patient name in clinical context (staff names in assignments are allowed).',
      });
    }
  }

  // 3 medium — full date near patient/age words (not near staff assignment language alone)
  if (/\b(?:patient|pt\.?|years?\s*old|y\/o)\b/i.test(raw) && !STAFF_NAME_CONTEXT_RE.test(raw)) {
    const dateNear = raw.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
    if (dateNear && !findings.some((f) => f.identifierNumber === 3 && f.severity === 'high')) {
      pushFinding(findings, seen, {
        identifierNumber: 3,
        category: HIPAA_18_CATEGORIES[3],
        severity: 'medium',
        matchPreview: redactPreview(dateNear[1]),
        message: 'Date near patient/age context may identify an individual.',
      });
    }
  }

  // 4–5 phone / fax (medium)
  const phoneRe =
    /\b(?:(?:fax|phone|tel|mobile|cell)\s*[:#]?\s*)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/gi;
  while ((m = phoneRe.exec(raw)) !== null) {
    const isFax = /\bfax\b/i.test(m[0]);
    pushFinding(findings, seen, {
      identifierNumber: isFax ? 5 : 4,
      category: HIPAA_18_CATEGORIES[isFax ? 5 : 4],
      severity: 'medium',
      matchPreview: redactPreview(m[1]),
      message: isFax ? 'Fax number pattern in free text.' : 'Phone number pattern in free text.',
    });
  }

  // 6 email (medium)
  const emailRe = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
  while ((m = emailRe.exec(raw)) !== null) {
    pushFinding(findings, seen, {
      identifierNumber: 6,
      category: HIPAA_18_CATEGORIES[6],
      severity: 'medium',
      matchPreview: redactPreview(m[1]),
      message: 'Email address in free text.',
    });
  }

  // 2 — street address (medium)
  const streetRe =
    /\b(\d{1,5}\s+[A-Za-z0-9.'-]{2,30}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Pkwy|Parkway)\.?)\b/gi;
  while ((m = streetRe.exec(raw)) !== null) {
    pushFinding(findings, seen, {
      identifierNumber: 2,
      category: HIPAA_18_CATEGORIES[2],
      severity: 'medium',
      matchPreview: redactPreview(m[1]),
      message: 'Street address pattern in free text.',
    });
  }
  const zipPlus4 = /\b\d{5}-\d{4}\b/;
  if (zipPlus4.test(raw)) {
    pushFinding(findings, seen, {
      identifierNumber: 2,
      category: HIPAA_18_CATEGORIES[2],
      severity: 'medium',
      matchPreview: 'ZIP+4',
      message: 'ZIP+4 code may identify a small geography.',
    });
  }

  // 12–13 vehicle / device (medium when labeled)
  const vehicleRe =
    /\b(?:license\s*plate|plate\s*#|vin)\s*[:#]?\s*([A-Z0-9-]{5,20})\b/gi;
  while ((m = vehicleRe.exec(raw)) !== null) {
    pushFinding(findings, seen, {
      identifierNumber: 12,
      category: HIPAA_18_CATEGORIES[12],
      severity: 'medium',
      matchPreview: redactPreview(m[1]),
      message: 'Vehicle identifier pattern detected.',
    });
  }
  const deviceRe =
    /\b(?:device\s*(?:id|serial)|serial\s*(?:number|#))\s*[:#]?\s*([A-Za-z0-9-]{5,24})\b/gi;
  while ((m = deviceRe.exec(raw)) !== null) {
    pushFinding(findings, seen, {
      identifierNumber: 13,
      category: HIPAA_18_CATEGORIES[13],
      severity: 'medium',
      matchPreview: redactPreview(m[1]),
      message: 'Device identifier / serial pattern detected.',
    });
  }

  // 14 URLs (medium) — exclude app domains
  const urlRe = /\bhttps?:\/\/[^\s<>"']+/gi;
  while ((m = urlRe.exec(raw)) !== null) {
    const url = m[0];
    const allowed = APP_URL_ALLOWLIST.some((d) => url.toLowerCase().includes(d));
    if (!allowed) {
      pushFinding(findings, seen, {
        identifierNumber: 14,
        category: HIPAA_18_CATEGORIES[14],
        severity: 'medium',
        matchPreview: redactPreview(url),
        message: 'External URL in free text.',
      });
    }
  }

  // 15 IP (medium)
  const ipRe = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
  while ((m = ipRe.exec(raw)) !== null) {
    if (m[0].startsWith('127.') || m[0].startsWith('0.')) continue;
    pushFinding(findings, seen, {
      identifierNumber: 15,
      category: HIPAA_18_CATEGORIES[15],
      severity: 'medium',
      matchPreview: redactPreview(m[0]),
      message: 'IP address pattern detected.',
    });
  }

  // 16–17 biometric / photos — keyword only (medium)
  if (/\b(?:fingerprint|voice\s*print|biometric|retina\s*scan)\b/i.test(lower)) {
    pushFinding(findings, seen, {
      identifierNumber: 16,
      category: HIPAA_18_CATEGORIES[16],
      severity: 'medium',
      matchPreview: 'biometric…',
      message: 'Biometric identifier wording detected.',
    });
  }
  if (/\b(?:full[- ]?face|patient\s*photo|facial\s*image)\b/i.test(lower)) {
    pushFinding(findings, seen, {
      identifierNumber: 17,
      category: HIPAA_18_CATEGORIES[17],
      severity: 'medium',
      matchPreview: 'photo…',
      message: 'Full-face / patient photo wording detected.',
    });
  }

  return { findings, maxSeverity: maxSeverityOf(findings) };
}

function shouldSkipFieldKey(key: string): boolean {
  const k = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  if (SKIP_FIELD_KEYS.has(key) || SKIP_FIELD_KEYS.has(k)) return true;
  if (/(^|_)(email|phone|fax|first_name|last_name|zip|city|state|county|address)$/i.test(key)) {
    return true;
  }
  return false;
}

/**
 * Recursively collect string values from a payload, skipping structured identity keys.
 */
export function collectNarrativeStrings(
  value: unknown,
  path: string[] = [],
  out: string[] = []
): string[] {
  if (value == null) return out;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return out;
    // Skip embedded file blobs (base64 / data URLs) — not OCR-scanned
    if (
      trimmed.length > 120 &&
      (trimmed.toLowerCase().startsWith('data:') || /^[A-Za-z0-9+/=]{200,}$/.test(trimmed))
    ) {
      return out;
    }
    out.push(trimmed);
    return out;
  }
  if (typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectNarrativeStrings(item, [...path, String(i)], out));
    return out;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    if (shouldSkipFieldKey(key)) return;
    // Prefer scanning known narrative field names; still scan other strings except skip list
    collectNarrativeStrings(child, [...path, key], out);
  });
  return out;
}

export function scanUnknownPayload(value: unknown): PhiScanResult {
  const strings = collectNarrativeStrings(value);
  const findings: PhiFinding[] = [];
  const seen = new Set<string>();
  strings.forEach((s) => {
    scanTextForPhi(s).findings.forEach((f) => pushFinding(findings, seen, f));
  });
  return { findings, maxSeverity: maxSeverityOf(findings) };
}

export function scanTexts(texts: Array<string | null | undefined>): PhiScanResult {
  const findings: PhiFinding[] = [];
  const seen = new Set<string>();
  texts.forEach((t) => {
    scanTextForPhi(t).findings.forEach((f) => pushFinding(findings, seen, f));
  });
  return { findings, maxSeverity: maxSeverityOf(findings) };
}

/** Metadata-safe summary for security_events (no raw PHI). */
export function phiFindingsToMetadata(findings: PhiFinding[], surface: string, fieldHint?: string) {
  return {
    surface,
    fieldHint: fieldHint || null,
    severity: maxSeverityOf(findings),
    categories: [...new Set(findings.map((f) => f.identifierNumber))],
    categoryLabels: [...new Set(findings.map((f) => f.category))],
    findingCount: findings.length,
  };
}

/**
 * Enforce PHI policy for a scan result.
 * - high → PhiBlockedError
 * - medium without ack → PhiNeedsAcknowledgmentError
 * - medium with ack / none → ok
 */
export function enforcePhiScan(
  result: PhiScanResult,
  options: { surface: string; contentForHash?: string; forceAcknowledged?: boolean } = { surface: 'unknown' }
): void {
  const { findings, maxSeverity } = result;
  if (maxSeverity === 'none' || findings.length === 0) return;

  const high = findings.filter((f) => f.severity === 'high');
  if (high.length > 0) {
    throw new PhiBlockedError(high, options.surface);
  }

  const contentHash = hashPhiContent(options.contentForHash ?? JSON.stringify(findings.map((f) => f.matchPreview)));
  if (options.forceAcknowledged || isPhiAcknowledged(contentHash)) return;

  throw new PhiNeedsAcknowledgmentError(findings, contentHash, options.surface);
}

/** Scan narrative continuity payload for a known data_key. */
export function enforcePhiForDataKey(
  dataKey: string,
  value: unknown,
  options?: { forceAcknowledged?: boolean }
): void {
  if (!PHI_NARRATIVE_DATA_KEYS.has(dataKey)) return;
  const result = scanUnknownPayload(value);
  const joined = collectNarrativeStrings(value).join('\n');
  enforcePhiScan(result, {
    surface: `data_key:${dataKey}`,
    contentForHash: joined,
    forceAcknowledged: options?.forceAcknowledged,
  });
}
