/**
 * Main category buckets for gap/education questions.
 * Used in Admin Settings (Gaps tab) and on the Gap Plan page accordions.
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
