/**
 * Domain buckets for gap/education questions. Each domain = one accordion section on the Gap Plan page.
 * Admin picks a domain (dropdown) and types a category name (e.g. "Coordination") per question.
 */
export const EDUCATION_BUCKETS = [
  'Guidelines for Administration and Coordination of the ED for the Care of Children',
  'Physician, Nurses, and Other Health Care Providers Who Staff the ED',
  'Guidelines QI/PI in the ED',
  'Guidelines for Improving Pediatric Patient Safety in the ED',
  'Guidelines for Policies, Procedures, and Protocols for the ED',
  'Guidelines for Equipment, Supplies, and Medications for the Care of Pediatric Patients in the ED'
] as const;

export type EducationBucket = typeof EDUCATION_BUCKETS[number];
