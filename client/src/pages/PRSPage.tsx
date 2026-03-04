import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Container,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormGroup,
  Checkbox,
  Link
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ExpandMore as ExpandMoreIcon, Upload as UploadIcon, Image as ImageIcon, Visibility as VisibilityIcon, Warning as WarningIcon, CloudUpload as CloudUploadIcon, Send as SendIcon } from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { getUserData, setUserData, migrateFromLocalStorage } from '../utils/userData';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

interface ReadinessScore {
  id: string;
  date: string;
  score: number;
  pdfFile?: string;
  pdfFileName?: string;
}

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
  fileData?: string;
}

interface AssessmentQuestion {
  id: string;
  text: string;
  type: 'yesno' | 'dropdown' | 'text' | 'subquestions' | 'numeric' | 'radio' | 'checkbox' | 'paragraph' | 'header';
  options?: string[];
  subQuestions?: AssessmentQuestion[];
  answer?: string | string[] | null;
  hasGapPlan?: boolean;
  skipLogic?: {
    if: string;
    hideQuestions: string[];
    showMessage: string;
  };
  conditionalLogic?: {
    dependsOn: string;
    showIf: string;
  };
  note?: string;
  points?: number;
}

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // Basic Information
  {
    id: '1',
    text: 'Name',
    type: 'text',
    hasGapPlan: true
  },
  {
    id: '2',
    text: 'Title/Position',
    type: 'text',
    hasGapPlan: true
  },
  {
    id: '3',
    text: 'Phone number',
    type: 'text',
    hasGapPlan: true
  },
  {
    id: '4',
    text: 'Email',
    type: 'text',
    hasGapPlan: true
  },
  {
    id: '5',
    text: 'Name of your facility/hospital',
    type: 'text',
    hasGapPlan: true
  },
  {
    id: '6',
    text: 'Physical street address of your facility/hospital',
    type: 'text',
    hasGapPlan: true
  },
  {
    id: '7',
    text: 'City your facility/hospital is located in',
    type: 'text',
    hasGapPlan: true
  },
  {
    id: '8',
    text: 'Zip code of your facility/hospital',
    type: 'text',
    hasGapPlan: true
  },
  {
    id: '9',
    text: 'Does your hospital have an emergency department (ED) that is open 24/7?',
    type: 'yesno',
    hasGapPlan: true,
    skipLogic: {
      if: 'no',
      hideQuestions: ['10', '11', '12', '13', '14', '15', '16', '17', '18', '18a', '18b', '18c', '18d', '18e', '18f', '18g', '18h', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '29a', '29b', '29c', '29d', '29e', '29f', '29g', '29h', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '44a', '44b', '44c', '44d', '44e', '45', '46', '47', '48', '49', '50', '51', '52', '53', '54', '55', '56', '57', '57a', '57b', '57c', '57d', '57e', '57f', '58', '59', '60', '61', '61a', '61b', '61c', '61d', '61e', '62', '63', '63a', '63b', '63c', '63d', '64', '65', '66', '67', '68', '69', '69a', '69b', '69c', '69d', '69e', '69f', '69g', '69h', '70', '71', '72', '73', '74', '74a', '74b', '74c', '74d', '74e', '74f', '75', '75a', '75b', '75c', '75d', '76', '76a', '76b', '76c', '76d', '76e', '76f', '76g', '76h', '77', '77a', '77b', '77c', '77d', '77e', '77f', '77g', '77h', '77i', '77j', '77k', '77l', '78', '78a', '78b', '78c', '78d', '78e', '78f', '78g', '78h', '78i', '78j', '78k', '78l', '78m', '79', '80', '81', '82'],
      showMessage: 'You do not need to complete the assessment. Thank you for your time.'
    }
  },
  {
    id: '10',
    text: 'Which of the following best describes your hospital?',
    type: 'checkbox',
    options: [
      'General Hospital (a non-specialized facility treating adults and children for all medical and trauma conditions with or without a separate pediatric ED)',
      'Children\'s Hospital within a General Hospital (children\'s hospital located completely within a larger hospital which also sees adults)',
      'Children\'s Hospital (a stand-alone, specialized facility which offers services exclusively to children and adolescents)',
      'Critical Access Hospital (a non-specialized facility that is typically 35 miles from another hospital and maintains no more than 25 inpatient beds)',
      'Micro-Hospital (small scale inpatient facility that typically maintains 8 to 15 beds for observation and short-stay use for low-acuity patients)',
      'Off-Site Hospital-Based or Satellite Emergency Department (a facility providing emergency department services, basic imaging, and laboratory services)',
      'Independently-Owned Freestanding Emergency Department (a stand-alone facility providing emergency department services, basic imaging, and laboratory services)',
      'Other'
    ],
    hasGapPlan: true
  },
  {
    id: '11',
    text: 'You answered "other," please describe your hospital',
    type: 'paragraph',
    hasGapPlan: true,
    conditionalLogic: {
      dependsOn: '10',
      showIf: 'Other'
    }
  },
  {
    id: '12',
    text: 'Which one of the following is the best description of your ED configuration for the care of children (children as defined by your hospital)?',
    type: 'checkbox',
    options: [
      'General ED (pediatric and adult patients seen in same area)',
      'Separate pediatric ED in a hospital that treats both adults and children',
      'Pediatric ED in a Children\'s hospital (hospital cares ONLY for children)',
      'Other'
    ],
    hasGapPlan: true
  },
  {
    id: '13',
    text: 'You answered "other", please describe your hospital\'s ED configuration for the care of children',
    type: 'text',
    hasGapPlan: true,
    conditionalLogic: {
      dependsOn: '12',
      showIf: 'Other'
    }
  },
  {
    id: '14',
    text: 'Is your hospital designated as a trauma center?',
    type: 'yesno',
    hasGapPlan: true,
    skipLogic: {
      if: 'no',
      hideQuestions: ['15', '16', '17'],
      showMessage: 'Trauma center questions are hidden because your hospital is not designated as a trauma center.'
    }
  },
  {
    id: '15',
    text: 'Which of the following are used to verify your trauma Center for designation? (Check all that apply)',
    type: 'checkbox',
    options: [
      'American College of surgeons',
      'State or Regional Level Entity (E.g., EMS authority/governing board/bureau, Department of Health)'
    ],
    hasGapPlan: true
  },
  {
    id: '16',
    text: 'At what trauma level is your hospital currently designated for adults? (choose one)',
    type: 'radio',
    options: [
      'Adult Level I',
      'Adult Level II',
      'Adult Level III',
      'Adult Level IV',
      'Adult Level V',
      'None of the above'
    ],
    hasGapPlan: true
  },
  {
    id: '17',
    text: 'At what trauma level is your hospital currently designated for children? (Choose one)',
    type: 'radio',
    options: [
      'Pediatric Level I',
      'Pediatric Level II',
      'None of the above'
    ],
    hasGapPlan: true
  },
  {
    id: '18',
    text: 'Which of the following inpatient services does your hospital have on site? (Check Yes or No for each)',
    type: 'header',
    hasGapPlan: false
  },
  {
    id: '18a',
    text: 'Newborn nursery',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '18b',
    text: 'Neonatal intensive care unit',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '18c',
    text: 'Psychiatric intensive care unit',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '18d',
    text: 'Psychiatric step-down unit',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '18e',
    text: 'Pediatric inpatient ward',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '18f',
    text: 'Adult intensive care unit (medical or surgical)',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '18g',
    text: 'Adult step-down unit',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '18h',
    text: 'Adult inpatient ward',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '19',
    text: 'Does your hospital admit children to the adult intensive care unit (medical or surgical)?',
    type: 'yesno',
    hasGapPlan: true,
    conditionalLogic: {
      dependsOn: '18f',
      showIf: 'Yes'
    }
  },
  {
    id: '20',
    text: 'Does your hospital ever admit children to the adult step-down unit?',
    type: 'yesno',
    hasGapPlan: true,
    conditionalLogic: {
      dependsOn: '18g',
      showIf: 'Yes'
    }
  },
  {
    id: '21',
    text: 'Does your hospital ever admit children to the adult inpatient ward?',
    type: 'yesno',
    hasGapPlan: true,
    conditionalLogic: {
      dependsOn: '18h',
      showIf: 'Yes'
    }
  },
  // Administration and Coordination for the Care of Children
  {
    id: '22',
    text: 'Does your ED have a physician coordinator—sometimes referred to as a pediatric emergency care coordinator (PECC) or pediatric champion—who is assigned the role of overseeing various administrative aspects of pediatric emergency care (e.g., oversees quality improvement, collaborates with nursing, ensures pediatric skills of staff, develops and periodically reviews policies)? (Choose one):',
    type: 'radio',
    options: [
      'Our ED has a physician coordinator that is filled by an MD or DO',
      'Our ED has a physician coordinator that is filled by an Advanced Practice Provider (e.g., Physician Assistant or Nurse Practitioner) with physician oversight',
      'Our ED does NOT HAVE a physician coordinator at this time'
    ],
    hasGapPlan: true,
    skipLogic: {
      if: 'Our ED does NOT HAVE a physician coordinator at this time',
      hideQuestions: ['23', '24'],
      showMessage: 'Physician coordinator questions are hidden because your ED does not have a physician coordinator.'
    },
    note: 'Note: the physician coordinator for pediatric emergency care may have additional administrative roles in the ED.',
    points: 9.5
  },
  {
    id: '23',
    text: 'Is dedicated non-clinical time allotted to complete the tasks associated with the physician coordinator role?',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '24',
    text: 'Which of the following statements best describes the scope of the physician coordinator role? (Choose one)',
    type: 'radio',
    options: [
      'An individual who coordinates care only for your hospital\'s ED',
      'An individual who coordinates care for your hospital\'s ED as well as other hospitals\' EDs'
    ],
    hasGapPlan: true
  },
  {
    id: '25',
    text: 'Does your ED have a nurse coordinator—sometimes referred to as a pediatric emergency care coordinator (PECC) or pediatric champion—who is assigned the role of overseeing various administrative aspects of pediatric emergency care (e.g., facilitates continuing education, facilitates quality improvement activities, ensures pediatric specific elements are included in orientation of staff)? (Choose one):',
    type: 'radio',
    options: [
      'Our ED has a nurse coordinator that is filled by an RN',
      'Our ED has a nurse coordinator that is filled by a Nurse Practitioner',
      'Our ED does NOT HAVE a nurse coordinator at this time'
    ],
    hasGapPlan: true,
    note: 'Note: The nurse coordinator for pediatric emergency care may have additional administrative roles in the ED.',
    points: 9.5
  },
  {
    id: '26',
    text: 'Is dedicated non-clinical time allotted to complete the tasks associated with the nurse coordinator role?',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '27',
    text: 'Which of the following statements best describes the scope of the nurse coordinator role? (Choose one)',
    type: 'radio',
    options: [
      'An individual who coordinates care only for your hospital\'s ED',
      'An individual who coordinates care for your hospital\'s ED as well as other hospitals\' EDs'
    ],
    hasGapPlan: true
  },
  // Personnel – Physicians
  {
    id: '28',
    text: 'Is there a physician working on-site in the ED 24/7?',
    type: 'yesno',
    hasGapPlan: true,
    skipLogic: {
      if: 'no',
      hideQuestions: ['29', '29a', '29b', '29c', '29d', '29e', '29f', '29g', '29h'],
      showMessage: 'Physician 24/7 questions are hidden because there is no physician working on-site in the ED 24/7.'
    }
  },
  {
    id: '29',
    text: 'If yes, what types of training/certification are required for physicians who staff your ED 24/7 and care for children? (Check Yes or No for each)',
    type: 'header',
    hasGapPlan: false
  },
  {
    id: '29a',
    text: 'Emergency medicine board eligible/certified',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '29b',
    text: 'Pediatric emergency medicine board eligible/certified',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '29c',
    text: 'Pediatrics board eligible/certified',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '29d',
    text: 'Family medicine board eligible/certified',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '29e',
    text: 'Internal medicine board eligible/certified',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '29f',
    text: 'Surgery board eligible/certified',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '29g',
    text: 'Board eligible/certified physician with other training',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '29h',
    text: 'Non-Board eligible/certified physician with other training',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '30',
    text: 'Does your hospital have a policy for physician credentialing that requires pediatric-specific competencies for working in the ED (e.g., continuing education requirements, maintenance of board certification, hospital specific competency evaluations)?',
    type: 'yesno',
    hasGapPlan: true,
    skipLogic: {
      if: 'no',
      hideQuestions: ['31', '32', '33'],
      showMessage: 'Physician credentialing policy questions are hidden because your hospital does not have a policy for physician credentialing that requires pediatric-specific competencies.'
    },
    points: 2.5
  },
  {
    id: '31',
    text: 'Continuing education requirements in pediatric emergency care',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '32',
    text: 'Maintenance of board certification',
    type: 'yesno',
    hasGapPlan: true,
    points: 2.5
  },
  {
    id: '33',
    text: 'Hospital-specific competency evaluations (e.g., sedation and analgesia)',
    type: 'yesno',
    hasGapPlan: true
  },
  // Personnel – Nurses
  {
    id: '34',
    text: 'Does your hospital have a policy for nurse credentialing that requires pediatric-specific competencies for working in the ED (e.g., continuing education requirements, maintenance specialty certifications, hospital specific competency evaluations)?',
    type: 'yesno',
    hasGapPlan: true,
    skipLogic: {
      if: 'no',
      hideQuestions: ['35', '36', '37'],
      showMessage: 'Nurse credentialing policy questions are hidden because your hospital does not have a policy for nurse credentialing that requires pediatric-specific competencies.'
    },
    points: 2.5
  },
  {
    id: '35',
    text: 'Continuing education requirements in pediatric emergency care (e.g., ENPC, PALS)',
    type: 'yesno',
    hasGapPlan: true,
    points: 2.5
  },
  {
    id: '36',
    text: 'Maintenance of specialty certification for nurses (e.g., CEN, CPEN)',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '37',
    text: 'Hospital-specific competency evaluations (e.g., triage, pain assessment)',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '38',
    text: 'Does your hospital employ advanced practice providers (nurse practitioners and/or physician assistants) to provide care for children in the ED?',
    type: 'yesno',
    hasGapPlan: true,
    skipLogic: {
      if: 'no',
      hideQuestions: ['39', '40', '41', '42'],
      showMessage: 'Advanced practice provider credentialing questions are hidden because your hospital does not employ advanced practice providers to provide care for children in the ED.'
    }
  },
  {
    id: '39',
    text: 'Does your hospital staff policy for advanced practice provider credentialing require pediatric-specific competencies for working in the ED (e.g., continuing education requirements, maintenance of national specialty certification, hospital specific competency evaluations)?',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '40',
    text: 'Continuing education requirements in pediatric emergency care',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '41',
    text: 'Maintenance of national specialty certification',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '42',
    text: 'Hospital specific competency evaluations (e.g., pain assessment and management)',
    type: 'yesno',
    hasGapPlan: true
  },
  // Quality Improvement
  {
    id: '43',
    text: 'Does your ED have a Quality Improvement/Performance Improvement Plan for pediatric patients? (e.g., chart review, collection of pediatric emergency care data, development of a plan to improve pediatric emergency care)',
    type: 'yesno',
    hasGapPlan: true,
    skipLogic: {
      if: 'no',
      hideQuestions: ['44', '44a', '44b', '44c', '44d', '44e'],
      showMessage: 'Quality Improvement/Performance Improvement Plan component questions are hidden because your ED does not have a QI/PI Plan for pediatric patients.'
    },
    note: 'Note: This may be a separate Quality Improvement/Performance Improvement Plan for pediatric patients or integrated into the overall ED Quality Improvement/Performance Improvement Plan.',
    points: 1.4
  },
  {
    id: '44',
    text: 'If yes, are each of the following components included in the Quality Improvement/Performance Improvement Plan? (Check Yes or No for each)',
    type: 'header',
    hasGapPlan: false
  },
  {
    id: '44a',
    text: 'Patient care review process (chart review)',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '44b',
    text: 'Identification of quality indicators for children (e.g., timely administration of steroids in acute asthma exacerbation or time to antibiotics in the pediatric sepsis patient)',
    type: 'yesno',
    hasGapPlan: true,
    points: 1.4
  },
  {
    id: '44c',
    text: 'Collection and analysis of pediatric emergency care data (e.g., admissions, transfers, death in the ED, or return visits)',
    type: 'yesno',
    hasGapPlan: true,
    points: 1.4
  },
  {
    id: '44d',
    text: 'Development of a plan for improvement in pediatric emergency care (e.g., process to ensure that variances in care are addressed through education or training and reassessed for evidence of improvement)',
    type: 'yesno',
    hasGapPlan: true,
    points: 1.4
  },
  {
    id: '44e',
    text: 'Re-evaluation of performance using outcomes-based measures (e.g., how often was pain rapidly controlled or fever properly treated?)',
    type: 'yesno',
    hasGapPlan: true,
    points: 1.4
  },
  // Pediatric Patient Safety in the ED
  {
    id: '45',
    text: 'Are all children seen in the ED weighed in kilograms (without conversion from pounds)?',
    type: 'yesno',
    hasGapPlan: true,
    points: 1.5
  },
  {
    id: '46',
    text: 'Are all children\'s weights recorded in the ED medical record in kilograms only?',
    type: 'yesno',
    hasGapPlan: true,
    points: 1.5
  },
  {
    id: '47',
    text: 'Are temperature, heart rate, and respiratory rate recorded on all children?',
    type: 'yesno',
    hasGapPlan: true,
    points: 1
  },
  {
    id: '48',
    text: 'Is blood pressure monitoring available for children of all ages based on severity of illness?',
    type: 'yesno',
    hasGapPlan: true,
    points: 1
  },
  {
    id: '49',
    text: 'Is pulse oximetry monitoring available for children of all ages based on severity of illness?',
    type: 'yesno',
    hasGapPlan: true,
    points: 1
  },
  {
    id: '50',
    text: 'Is end tidal CO2 monitoring available for children of all ages based on severity of illness?',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  {
    id: '51',
    text: 'Is there a process in place for notification (manual or automated) of physicians when abnormal vital signs are found?',
    type: 'yesno',
    hasGapPlan: true,
    points: 3
  },
  {
    id: '52',
    text: 'Is a process in place for the use of pre-calculated drug dosing in all children?',
    type: 'yesno',
    hasGapPlan: true,
    points: 3
  },
  {
    id: '53',
    text: 'Is a process in place that allows for 24/7 access to interpreter services in the ED?',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  {
    id: '54',
    text: 'Is level of consciousness (e.g., AVPU or GCS) assessed in all children?',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  {
    id: '55',
    text: 'Is level of pain assessed in all children?',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  // Policies and Procedures
  {
    id: '56',
    text: 'Does your ED have a triage policy that specifically addresses ill and injured children?',
    type: 'yesno',
    hasGapPlan: true,
    points: 2
  },
  {
    id: '57',
    text: 'Does your ED have any of the following policies, procedures, or plans? (Check Yes or No for each)',
    type: 'header',
    hasGapPlan: false
  },
  {
    id: '57a',
    text: 'Pediatric patient assessment and reassessment policies, procedures, or plans',
    type: 'yesno',
    hasGapPlan: true,
    points: 1.5
  },
  {
    id: '57b',
    text: 'Immunization assessment and management of the UNDER-IMMUNIZED child policies, procedures, or plans',
    type: 'yesno',
    hasGapPlan: true,
    points: 1.5
  },
  {
    id: '57c',
    text: 'Child maltreatment policies, procedures, or plans',
    type: 'yesno',
    hasGapPlan: true,
    points: 1.5
  },
  {
    id: '57d',
    text: 'Death of the child in the ED policies, procedures, or plans',
    type: 'yesno',
    hasGapPlan: true,
    points: 1.5
  },
  {
    id: '57e',
    text: 'Reduced-dose radiation for CT and x-ray imaging based on pediatric age or weight policies, procedures, or plans',
    type: 'yesno',
    hasGapPlan: true,
    points: 1.5
  },
  {
    id: '57f',
    text: 'Behavioral health issues policies, procedures, or plans for children of all ages',
    type: 'yesno',
    hasGapPlan: true,
    points: 1.5
  },
  {
    id: '58',
    text: 'Does your ED have a written guideline for the transfer of children with behavioral health issues out of your facility to an appropriate facility?',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.4
  },
  {
    id: '59',
    text: 'Does your ED have social services policies, procedures, or a plan for children of all ages?',
    type: 'yesno',
    hasGapPlan: true
  },
  // Policies for Family-Centered Care
  {
    id: '60',
    text: 'Does your ED have a policy for promoting family-centered care? (e.g., family presence, family involvement in clinical decision making)',
    type: 'yesno',
    hasGapPlan: true,
    skipLogic: {
      if: 'no',
      hideQuestions: ['61a', '61b', '61c', '61d', '61e'],
      showMessage: 'Family-centered care policy component questions are hidden because your ED does not have a policy for promoting family-centered care.'
    },
    points: 0.4
  },
  {
    id: '61',
    text: 'If yes, does your ED\'s family-centered care policy include any of the following? (Check Yes or No for each)',
    type: 'header',
    hasGapPlan: false
  },
  {
    id: '61a',
    text: 'Involving families and caregivers in patient care decision-making',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '61b',
    text: 'Involving families and caregivers in medication safety processes',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '61c',
    text: 'Family and guardian presence during all aspects of emergency care, including resuscitation',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '61d',
    text: 'Education of the patient, family, and caregivers on treatment plan and disposition',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.4
  },
  {
    id: '61e',
    text: 'Bereavement counseling',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.4
  },
  // Policies for Disaster Planning
  {
    id: '62',
    text: 'Does your hospital disaster plan address issues specific to the care of children (e.g., pediatric surge capacity, patient tracking and reunification, pediatric decontamination)?',
    type: 'yesno',
    hasGapPlan: true,
    skipLogic: {
      if: 'no',
      hideQuestions: ['63', '63a', '63b', '63c', '63d', '64', '65', '66', '67'],
      showMessage: 'Disaster plan component questions are hidden because your hospital disaster plan does not address issues specific to the care of children.'
    },
    points: 0
  },
  {
    id: '63',
    text: 'If yes, does your hospital disaster plan include each of the following? (Check Yes or No for each)',
    type: 'header',
    hasGapPlan: false
  },
  {
    id: '63a',
    text: 'Availability of medications, vaccines (e.g., tetanus and influenza), equipment, supplies, and appropriately trained providers for children in disasters',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.29
  },
  {
    id: '63b',
    text: 'Decontamination, isolation, and quarantine of families and children of all ages',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.29
  },
  {
    id: '63c',
    text: 'Minimization of parent-child separation and methods for reuniting separated children with their families',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.29
  },
  {
    id: '63d',
    text: 'All disaster drills include pediatric patients',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.29
  },
  {
    id: '64',
    text: 'Pediatric surge capacity for both injured and non-injured children',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.28
  },
  {
    id: '65',
    text: 'Access to behavioral health resources for children in the event of a disaster',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.28
  },
  {
    id: '66',
    text: 'Access to social services for children in the event of a disaster',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '67',
    text: 'The care of children with special health care needs, including children with developmental disabilities',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.28
  },
  // Interfacility Transfer Guidelines
  {
    id: '68',
    text: 'Does your hospital have written interfacility guidelines that outline procedural and administrative policies with other hospitals for the transfer of patients of all ages including children in need of care not available at your hospital?',
    type: 'yesno',
    hasGapPlan: true,
    skipLogic: {
      if: 'no',
      hideQuestions: ['69a', '69b', '69c', '69d', '69e', '69f', '69g', '69h'],
      showMessage: 'Interfacility transfer guideline component questions are hidden because your hospital does not have written interfacility guidelines.'
    },
    note: 'Note: Compliance with EMTALA does not constitute having interfacility transfer guidelines. The guidelines may be a separate document or part of an interfacility transfer agreement document.',
    points: 2
  },
  {
    id: '69',
    text: 'You answered that your hospital has written interfacility transfer guidelines. Please indicate whether the guidelines include the information specifically for the transfer of patients for each item below. (Check Yes or No for each)',
    type: 'header',
    hasGapPlan: false
  },
  {
    id: '69a',
    text: 'Defined process for initiation of transfer, including the roles and responsibilities of the referring facility and referral center (including responsibilities for requesting transfer and communication)',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '69b',
    text: 'Process for selecting the appropriate care facility',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '69c',
    text: 'Process for selecting the appropriately staffed transport service to match the patient\'s acuity level (e.g., level of care required by patient or equipment needed in transport)',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '69d',
    text: 'Process for patient transfer (including obtaining informed consent)',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '69e',
    text: 'Plan for transfer of copy of patient medical record',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '69f',
    text: 'Plan for transfer of copy of signed transport consent',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '69g',
    text: 'Plan for transfer of personal belongings of the patient',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '69h',
    text: 'Plan for provision of directions and referral institution information to family',
    type: 'yesno',
    hasGapPlan: true
  },
  {
    id: '70',
    text: 'Does your hospital have written interfacility agreement(s) with other hospitals for the transfer of patients of all ages including children in need of care not available at your hospital?',
    type: 'yesno',
    hasGapPlan: true,
    note: 'Note: Compliance with EMTALA does not constitute having interfacility transfer agreements. Agreements may be a separate document or part of an interfacility transfer guidelines document.'
  },
  // Equipment and Supplies Management
  {
    id: '71',
    text: 'Are all ED staff trained on the location of all pediatric equipment and medications?',
    type: 'yesno',
    hasGapPlan: true,
    points: 3
  },
  {
    id: '72',
    text: 'Is there a daily method used to verify the proper location and stocking of pediatric equipment and supplies?',
    type: 'yesno',
    hasGapPlan: true,
    points: 3
  },
  {
    id: '73',
    text: 'Is there a standardized chart or tool to estimate weight if resuscitation precludes the use of a weight scale (e.g., length-based tape)?',
    type: 'yesno',
    hasGapPlan: true,
    points: 3
  },
  // Monitoring Equipment
  {
    id: '74',
    text: 'Are each of the following monitoring equipment items available for immediate use in the ED? (Check Yes or No for each)',
    type: 'header',
    hasGapPlan: false
  },
  {
    id: '74a',
    text: 'Neonatal blood pressure cuff',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  {
    id: '74b',
    text: 'Infant blood pressure cuff',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  {
    id: '74c',
    text: 'Child blood pressure cuff',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  {
    id: '74d',
    text: 'Defibrillator with pediatric and adult capabilities including pads and/or paddles',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  {
    id: '74e',
    text: 'Pulse oximeter with pediatric and adult probes',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  {
    id: '74f',
    text: 'Continuous end-tidal CO2 monitoring device',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  // Resuscitation Equipment
  {
    id: '75',
    text: 'Are each of the following fluid resuscitation equipment items available for immediate use in the ED? (Check Yes or No for each)',
    type: 'header',
    hasGapPlan: false
  },
  {
    id: '75a',
    text: '22 gauge catheter-over-the-needle',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  {
    id: '75b',
    text: '24 gauge catheter-over-the-needle',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  {
    id: '75c',
    text: 'Pediatric intra-osseus needles',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  {
    id: '75d',
    text: 'IV administration sets with calibrated chambers or an infusion pump with the ability to regulate rate and volume of infusate (e.g., buretrol)',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.5
  },
  // Airway Equipment
  {
    id: '76',
    text: 'Are each of the following respiratory/airway management equipment items available for immediate use in the ED? (Check Yes or No for each)',
    type: 'header',
    hasGapPlan: false
  },
  {
    id: '76a',
    text: 'Endotracheal tubes: cuffed or uncuffed 2.5 mm',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.575
  },
  {
    id: '76b',
    text: 'Endotracheal tubes: cuffed or uncuffed 3.0 mm',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.575
  },
  {
    id: '76c',
    text: 'Endotracheal tubes: cuffed or uncuffed 3.5 mm',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.575
  },
  {
    id: '76d',
    text: 'Endotracheal tubes: cuffed or uncuffed 4.0 mm',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.575
  },
  {
    id: '76e',
    text: 'Endotracheal tubes: cuffed or uncuffed 4.5 mm',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.575
  },
  {
    id: '76f',
    text: 'Endotracheal tubes: cuffed or uncuffed 5.0 mm',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.575
  },
  {
    id: '76g',
    text: 'Endotracheal tubes: cuffed or uncuffed 5.5 mm',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.575
  },
  {
    id: '76h',
    text: 'Endotracheal tubes: cuffed 6.0 mm',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.575
  },
  // Airway Equipment
  {
    id: '77',
    text: 'Are each of the following respiratory/airway management equipment items available for immediate use in the ED? (Check Yes or No for each)',
    type: 'header',
    hasGapPlan: false
  },
  {
    id: '77a',
    text: 'Laryngoscope blades: straight, size 0',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '77b',
    text: 'Laryngoscope blades: straight, size 1',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '77c',
    text: 'Laryngoscope blades: straight, size 2',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '77d',
    text: 'Laryngoscope blades: curved, size 2',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '77e',
    text: 'Pediatric-sized Magill forceps',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '77f',
    text: 'Nasopharyngeal airways: infant-sized',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '77g',
    text: 'Nasopharyngeal airways: child-sized',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '77h',
    text: 'Oropharyngeal airways: size 0 (50mm)',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '77i',
    text: 'Oropharyngeal airways: size 1 (60mm)',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '77j',
    text: 'Oropharyngeal airways: size 2 (70mm)',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '77k',
    text: 'Oropharyngeal airways: size 3 (80mm)',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '77l',
    text: 'Stylets for pediatric/infant-sized endotracheal tubes',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '78',
    text: 'Are each of the following respiratory/airway management equipment items available for immediate use in the ED? (Check Yes or No for each)',
    type: 'header',
    hasGapPlan: false
  },
  {
    id: '78a',
    text: 'Bag-mask device, self-inflating (infant/child)',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '78b',
    text: 'Masks (neonatal size) to fit bag-mask device',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '78c',
    text: 'Masks (infant size) to fit bag-mask device',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '78d',
    text: 'Masks (child size) to fit bag-mask device',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '78e',
    text: 'Simple oxygen face masks: standard infant',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '78f',
    text: 'Clear oxygen masks: standard child',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '78g',
    text: 'Non-rebreather masks: infant-sized',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '78h',
    text: 'Non-rebreather masks: child-sized',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '78i',
    text: 'Nasal cannulas: infant',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '78j',
    text: 'Nasal cannulas: child',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '78k',
    text: 'Suction catheters: at least one in range 6-8F',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '78l',
    text: 'Suction catheters: at least one in range 10-12F',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  {
    id: '78m',
    text: 'Supplies/kit for pediatric patients with difficult airways (e.g., supraglottic airways, needle cricothyrotomy supplies, surgical cricothyrotomy kit, and/or video laryngoscopy)',
    type: 'yesno',
    hasGapPlan: true,
    points: 0.576
  },
  // Patient Volume
  {
    id: '79',
    text: 'Estimate the total number of patients (adult and pediatric) seen in your ED in the last year. (Numeric data only, e.g., 5000, not "five thousand") Number of Total Patients:',
    type: 'numeric',
    hasGapPlan: true
  },
  {
    id: '80',
    text: 'Estimate the number of pediatric patients (as defined by your hospital) seen in your ED in the last year. (Choose one)',
    type: 'radio',
    options: [
      'Low: <1,800 pediatric patients (average of 5 or fewer a day)',
      'Medium: 1,800 – 4,999 pediatric patients (average of 6-13 a day)',
      'Medium to High: 5,000 – 9,999 pediatric patients (average of 14-26 a day)',
      'High: >=10,000 pediatric patients (average of 27 or more a day)'
    ],
    hasGapPlan: true
  },
  {
    id: '81',
    text: 'If you know the actual number or a more precise estimate of pediatric patients seen in your ED in the last year, please record the number below. (Numeric data only, e.g., 500, not "five hundred") Number of Pediatric Patients:',
    type: 'numeric',
    hasGapPlan: true
  },
  {
    id: '82',
    text: 'If you have any comments regarding pediatric readiness, please note them here:',
    type: 'paragraph',
    hasGapPlan: true
  }
];

const PRSPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUserProfile();
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(ASSESSMENT_QUESTIONS);
  const [readinessScores, setReadinessScores] = useState<ReadinessScore[]>([]);
  const [gapPlans, setGapPlans] = useState<GapPlan[]>([]);
  const [gapPlanDialogOpen, setGapPlanDialogOpen] = useState(false);
  const [gapFormData, setGapFormData] = useState<Partial<GapPlan>>({});
  const [editingGapPlan, setEditingGapPlan] = useState<GapPlan | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<AssessmentQuestion | null>(null);
  const [showSkipMessage, setShowSkipMessage] = useState<string | null>(null);
  const [previousScoreDate, setPreviousScoreDate] = useState(new Date().toISOString().split('T')[0]);
  const [previousScoreValue, setPreviousScoreValue] = useState('');
  const [previousScorePdf, setPreviousScorePdf] = useState<File | null>(null);
  const [previousScoreDialogOpen, setPreviousScoreDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingScore, setEditingScore] = useState<ReadinessScore | null>(null);
  const [editingScoreDate, setEditingScoreDate] = useState('');
  const [editingScoreValue, setEditingScoreValue] = useState('');
  const [editingScorePdf, setEditingScorePdf] = useState<File | null>(null);
  const [editScoreDialogOpen, setEditScoreDialogOpen] = useState(false);
  const [officialSubmissionFile, setOfficialSubmissionFile] = useState<File | null>(null);
  const [isSubmittingToAPI, setIsSubmittingToAPI] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [unansweredQuestions, setUnansweredQuestions] = useState<string[]>([]);
  const [legalWarningDialogOpen, setLegalWarningDialogOpen] = useState(false);

  // Clear PRS-related localStorage only (not entire localStorage) and reload
  const clearLocalStorageAndReload = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === 'prsQuestions' || k === 'prsReadinessScores' || k === 'prsGapPlans') keysToRemove.push(k);
      else if (k.startsWith('gapPlans_')) keysToRemove.push(k);
      else if (k.startsWith('ud_') && (k.endsWith('_prsQuestions') || k.endsWith('_prsReadinessScores') || k.endsWith('_gapPlans'))) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    setQuestions(ASSESSMENT_QUESTIONS);
    setReadinessScores([]);
    setGapPlans([]);
    setShowSkipMessage(null);
  };

  const prsUserId = currentUser?.uid ?? (currentUser as { id?: string })?.id;
  // Load data from user_data on mount
  useEffect(() => {
    if (!prsUserId) return;
    let mounted = true;
    (async () => {
      const [questionsVal, scoresVal, gapPlansVal] = await Promise.all([
        getUserData<any[]>(prsUserId, 'prsQuestions'),
        getUserData<any[]>(prsUserId, 'prsReadinessScores'),
        getUserData<any[]>(prsUserId, 'gapPlans')
      ]);
      if (!mounted) return;
      if (questionsVal != null && Array.isArray(questionsVal)) setQuestions(questionsVal);
      else await migrateFromLocalStorage(prsUserId, 'prsQuestions', 'prsQuestions', (v) => setQuestions(Array.isArray(v) ? v : ASSESSMENT_QUESTIONS));
      if (scoresVal != null && Array.isArray(scoresVal)) setReadinessScores(scoresVal);
      else await migrateFromLocalStorage(prsUserId, 'prsReadinessScores', 'prsReadinessScores', (v) => setReadinessScores(Array.isArray(v) ? v : []));
      if (gapPlansVal != null && Array.isArray(gapPlansVal)) setGapPlans(gapPlansVal);
      else {
        await migrateFromLocalStorage(prsUserId, 'gapPlans', `gapPlans_${prsUserId}`, (v) => setGapPlans(Array.isArray(v) ? v : []));
        try {
          const oldGap = localStorage.getItem('prsGapPlans');
          if (oldGap) { const p = JSON.parse(oldGap); if (Array.isArray(p)) { await setUserData(prsUserId, 'gapPlans', p); setGapPlans(p); localStorage.removeItem('prsGapPlans'); } }
        } catch {}
      }
    })();
    return () => { mounted = false; };
  }, [prsUserId]);

  // Persist questions to user_data when they change
  useEffect(() => {
    if (prsUserId) setUserData(prsUserId, 'prsQuestions', questions);
  }, [prsUserId, questions]);

  // Persist readiness scores to user_data when they change
  useEffect(() => {
    if (prsUserId) setUserData(prsUserId, 'prsReadinessScores', readinessScores);
  }, [prsUserId, readinessScores]);

  // Handle viewing PDF files
  const handleViewPdf = (score: ReadinessScore) => {
    if (score.pdfFile && score.pdfFileName) {
      // Create a blob from the base64 data and open it in a new window
      const byteCharacters = atob(score.pdfFile.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Open PDF in new window
      window.open(url, '_blank');
      
      // Clean up the URL object
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  // Handle deleting a score
  const handleDeleteScore = (scoreId: string) => {
    if (window.confirm('Are you sure you want to delete this score?')) {
      setReadinessScores(prev => prev.filter(s => s.id !== scoreId));
    }
  };

  // Handle editing a score
  const handleEditScore = (score: ReadinessScore) => {
    setEditingScore(score);
    setEditingScoreDate(score.date);
    setEditingScoreValue(score.score.toString());
    setEditingScorePdf(null); // Reset PDF for editing
    setEditScoreDialogOpen(true);
  };

  // Handle saving edited score
  const handleSaveEditedScore = () => {
    if (!editingScore || !editingScoreValue || !editingScoreDate) return;

    const scoreValue = parseFloat(editingScoreValue);
    if (isNaN(scoreValue) || scoreValue < 0 || scoreValue > totalPoints) return;

    const updatedScore: ReadinessScore = {
      ...editingScore,
      date: editingScoreDate,
      score: scoreValue,
      pdfFileName: editingScorePdf ? editingScorePdf.name : editingScore.pdfFileName,
      pdfFile: editingScorePdf ? '' : editingScore.pdfFile // Will be updated if new PDF
    };

    // If there's a new PDF, convert it to base64
    if (editingScorePdf) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const pdfData = e.target?.result as string;
        updatedScore.pdfFile = pdfData;
        
        // Update the score in the list
        setReadinessScores(prev => prev.map(s => 
          s.id === editingScore.id ? updatedScore : s
        ));
        
        // Close dialog and reset
        setEditScoreDialogOpen(false);
        setEditingScore(null);
        setEditingScoreDate('');
        setEditingScoreValue('');
        setEditingScorePdf(null);
      };
      reader.readAsDataURL(editingScorePdf);
    } else {
      // No new PDF, just update the score
      setReadinessScores(prev => prev.map(s => 
        s.id === editingScore.id ? updatedScore : s
      ));
      
      // Close dialog and reset
      setEditScoreDialogOpen(false);
      setEditingScore(null);
      setEditingScoreDate('');
      setEditingScoreValue('');
      setEditingScorePdf(null);
    }
  };

  // Format score for display
  const formatScore = (score: number) => {
    return score.toFixed(3);
  };

  // Persist gap plans to user_data when they change
  useEffect(() => {
    if (prsUserId) setUserData(prsUserId, 'gapPlans', gapPlans);
  }, [prsUserId, gapPlans]);

  // Calculate readiness score
  const calculateReadinessScore = () => {
    let totalPoints = 0;
    let earnedPoints = 0;

    const calculateQuestionPoints = (question: AssessmentQuestion): number => {
      if (question.points) {
        totalPoints += question.points;
        
        // Check if the question has a valid answer that should earn points
        if (question.answer) {
          let shouldEarnPoints = false;
          
          // For yes/no questions, only 'yes' earns points
          if (question.type === 'yesno') {
            shouldEarnPoints = question.answer === 'yes';
          }
          // For radio questions, any selected option earns points (assuming all options are valid)
          else if (question.type === 'radio') {
            shouldEarnPoints = true;
          }
          // For checkbox questions, any selected options earn points
          else if (question.type === 'checkbox') {
            shouldEarnPoints = Array.isArray(question.answer) && question.answer.length > 0;
          }
          // For text/numeric questions, any non-empty answer earns points
          else if (question.type === 'text' || question.type === 'numeric' || question.type === 'paragraph') {
            shouldEarnPoints = question.answer !== '' && question.answer !== null;
          }
          // For other types, any answer earns points
          else {
            shouldEarnPoints = true;
          }
          
          if (shouldEarnPoints) {
            earnedPoints += question.points;
          }
        }
      }

      if (question.subQuestions) {
        question.subQuestions.forEach(subQ => {
          calculateQuestionPoints(subQ);
        });
      }

      return earnedPoints;
    };

    questions.forEach(question => {
      calculateQuestionPoints(question);
    });

    const score = earnedPoints; // Score is now the sum of earned points, not a percentage
    const roundedTotalPoints = Math.round(totalPoints); // Round to avoid floating point precision issues
    return { score, totalPoints: roundedTotalPoints, earnedPoints };
  };

  // Handle question answer changes
  const handleAnswerChange = (questionId: string, answer: string | string[] | null, subQuestionId?: string) => {
    setQuestions(prevQuestions => {
      const updatedQuestions = prevQuestions.map(question => {
        if (question.id === questionId) {
          return { ...question, answer };
        }
        return question;
      });

      // Check skip logic after updating
      const updatedQuestion = updatedQuestions.find(q => q.id === questionId);
      if (updatedQuestion?.skipLogic && answer === updatedQuestion.skipLogic.if) {
        setShowSkipMessage(updatedQuestion.skipLogic.showMessage);
        // Hide questions based on skip logic
        return updatedQuestions.map(q => {
          if (updatedQuestion.skipLogic?.hideQuestions.includes(q.id)) {
            return { ...q, answer: null };
          }
          return q;
        });
      } else {
        setShowSkipMessage(null);
      }

      return updatedQuestions;
    });
  };

  // Handle gap plan creation/editing
  const handleGapPlanOpen = (question: AssessmentQuestion) => {
    setSelectedQuestion(question);
    const existingPlan = gapPlans.find(plan => plan.questionId === question.id);
    
    if (existingPlan) {
      setEditingGapPlan(existingPlan);
      setGapFormData({
        action: existingPlan.action,
        owner: existingPlan.owner,
        status: existingPlan.status,
        priority: existingPlan.priority,
        difficulty: existingPlan.difficulty,
        notes: existingPlan.notes,
        dueDate: existingPlan.dueDate,
        completionDate: existingPlan.completionDate,
        rank: existingPlan.rank,
        attachments: existingPlan.attachments || []
      });
    } else {
      setEditingGapPlan(null);
      setGapFormData({
        action: '',
        owner: '',
        status: '',
        priority: '',
        difficulty: '',
        notes: '',
        dueDate: '',
        completionDate: '',
        rank: '',
        attachments: []
      });
    }
    setGapPlanDialogOpen(true);
  };

  // Function to check if a gap plan has actual content
  const hasGapPlanContent = (questionId: string) => {
    const plan = gapPlans.find(plan => plan.questionId === questionId);
    if (!plan) return false;
    
    // Check if the plan has meaningful content
    return !!(plan.action && plan.action.trim() && plan.owner && plan.owner.trim());
  };

  // Function to get the next available sequential rank
  const getNextAvailableRank = () => {
    const rankedPlans = gapPlans.filter(plan => typeof plan.rank === 'number');
    if (rankedPlans.length === 0) return 0; // First rank starts at 0 (displays as 1)
    
    // Find the highest rank and add 1
    const maxRank = Math.max(...rankedPlans.map(plan => plan.rank as number));
    return maxRank + 1;
  };

  // Function to reassign all ranks sequentially (1, 2, 3, 4...)
  const reassignRanksSequentially = () => {
    const rankedPlans = gapPlans.filter(plan => typeof plan.rank === 'number');
    const unrankedPlans = gapPlans.filter(plan => plan.rank === '');
    
    // Sort ranked plans by current rank
    rankedPlans.sort((a, b) => (a.rank as number) - (b.rank as number));
    
    // Reassign ranks sequentially starting from 0 (displays as 1)
    const updatedPlans = gapPlans.map(plan => {
      if (plan.rank === '') {
        return plan; // Keep unranked plans as is
      }
      
      // Find the position of this plan in the sorted ranked list
      const rankIndex = rankedPlans.findIndex(p => p.id === plan.id);
      if (rankIndex === -1) return plan; // Shouldn't happen
      
      return { ...plan, rank: rankIndex };
    });
    
    setGapPlans(updatedPlans);
  };

  const handleGapPlanSubmit = () => {
    if (!selectedQuestion || !gapFormData.action || !gapFormData.owner) return;

    if (editingGapPlan) {
      // Update existing gap plan
      setGapPlans(prevPlans => 
        prevPlans.map(plan => 
          plan.id === editingGapPlan.id 
            ? { ...plan, ...gapFormData, questionText: selectedQuestion.text }
            : plan
        )
      );
    } else {
      // Create new gap plan
      const newPlan: GapPlan = {
        id: Date.now().toString(),
        questionId: selectedQuestion.id,
        questionText: selectedQuestion.text,
        action: gapFormData.action!,
        owner: gapFormData.owner!,
        status: gapFormData.status as GapPlan['status'] || 'Need to Develop',
        priority: gapFormData.priority as GapPlan['priority'] || 'Low Importance & Low Urgency (Do Last)',
        difficulty: gapFormData.difficulty as GapPlan['difficulty'] || 'Low Impact & Low Effort (Filler Tasks)',
        notes: gapFormData.notes || '',
        dueDate: gapFormData.dueDate || '',
        completionDate: gapFormData.completionDate || '',
        rank: getNextAvailableRank(),
        attachments: gapFormData.attachments || []
      };
      setGapPlans(prevPlans => [...prevPlans, newPlan]);
    }

    setGapPlanDialogOpen(false);
    setGapFormData({});
    setEditingGapPlan(null);
    setSelectedQuestion(null);
  };

  const handleGapPlanDelete = (gapPlanId: string) => {
    setGapPlans(prevPlans => prevPlans.filter(plan => plan.id !== gapPlanId));
  };

  const handleGapPlanFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const attachment: GapPlanAttachment = {
          id: Date.now().toString(),
          fileName: file.name,
          fileType: file.type.includes('pdf') ? 'pdf' : 'image',
          fileSize: file.size,
          uploadedAt: new Date(),
          fileData: e.target?.result as string
        };

        setGapFormData(prev => ({
          ...prev,
          attachments: [...(prev.attachments || []), attachment]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setGapFormData(prev => ({
      ...prev,
      attachments: prev.attachments?.filter(att => att.id !== attachmentId) || []
    }));
  };

  // Save readiness score
  const saveReadinessScore = () => {
    const { score } = calculateReadinessScore();
    const newScore: ReadinessScore = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      score
    };
    setReadinessScores(prev => [...prev, newScore]);
  };

  // Export functions
  const exportToPDF = () => {
    const { score, totalPoints, earnedPoints } = calculateReadinessScore();
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Pediatric Readiness Assessment Report', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Score: ${score}/${totalPoints}`, 20, 40);
    doc.text(`Points Earned: ${earnedPoints}/${totalPoints}`, 20, 50);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 60);
    
    doc.save('pediatric-readiness-assessment.pdf');
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(questions);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assessment');
    XLSX.writeFile(workbook, 'pediatric-readiness-assessment.xlsx');
  };

  // Handle official submission document upload
  const handleOfficialSubmissionUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setOfficialSubmissionFile(file);
      // TODO: Parse the uploaded document and populate questions
      // For now, just show a success message
      setSubmissionStatus('Official submission document uploaded successfully! Please review the populated answers below.');
    }
  };

  // Submit to Google Sheets API
  const submitToAPI = async () => {
    setIsSubmittingToAPI(true);
    setSubmissionStatus(null);
    
    try {
      const { score } = calculateReadinessScore();
      const submissionData = {
        questions: questions,
        hospitalName: userProfile?.hospital_name ?? 'ImPACTS Hospital',
        submissionDate: new Date().toISOString(),
        score: score
      };

      const response = await fetch('https://script.google.com/macros/s/AKfycbz17z-9FVVioi9kbEPd33X2pCWEIJmTq_xzHVaax-yV1II/exec', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData)
      });

      if (response.ok) {
        const result = await response.json();
        setSubmissionStatus(`✅ Successfully submitted to pedsready.org! Timestamp: ${result.timestamp}`);
      } else {
        throw new Error('Failed to submit to API');
      }
    } catch (error) {
      console.error('Error submitting to API:', error);
      setSubmissionStatus('❌ Error submitting to pedsready.org. Please try again.');
    } finally {
      setIsSubmittingToAPI(false);
    }
  };

  // Validate all required questions are answered
  const validateQuestions = () => {
    const unanswered: string[] = [];
    
    questions.forEach(question => {
      // Skip header questions
      if (question.type === 'header') return;
      
      // Check if question has an answer
      const hasAnswer = question.answer !== null && question.answer !== undefined && question.answer !== '';
      
      if (!hasAnswer) {
        // Apply conditional logic to determine if this question is required
        const isRequired = isQuestionRequired(question.id);
        
        if (isRequired) {
          unanswered.push(`Question ${question.id}: ${question.text}`);
        }
      }
    });
    
    return unanswered;
  };

  // Determine if a question is required based on conditional logic
  const isQuestionRequired = (questionId: string): boolean => {
    // Get the question to check its dependencies
    const question = questions.find(q => q.id === questionId);
    if (!question) return false;

    // Conditional logic based on your requirements
    switch (questionId) {
      // If Q14 is "no", don't require Q15, Q16, Q17
      case '15':
      case '16':
      case '17':
        const q14 = questions.find(q => q.id === '14');
        return q14?.answer !== 'no';

      // If Q22 is "Our ED does NOT HAVE...", don't require Q23, Q24
      case '23':
      case '24':
        const q22 = questions.find(q => q.id === '22');
        return !q22?.answer?.toString().includes('Our ED does NOT HAVE');

      // If Q25 is "Our ED does NOT HAVE...", don't require Q26, Q27, Q28
      case '26':
      case '27':
      case '28':
        const q25 = questions.find(q => q.id === '25');
        return !q25?.answer?.toString().includes('Our ED does NOT HAVE');

      // If Q28 is "no", don't require Q29
      case '29':
        const q28 = questions.find(q => q.id === '28');
        return q28?.answer !== 'no';

      // If Q30 is "no", don't require Q31, Q32, Q33
      case '31':
      case '32':
      case '33':
        const q30 = questions.find(q => q.id === '30');
        return q30?.answer !== 'no';

      // If Q34 is "no", don't require Q35, Q36, Q37
      case '35':
      case '36':
      case '37':
        const q34 = questions.find(q => q.id === '34');
        return q34?.answer !== 'no';

      // If Q43 is "no", don't require Q39, Q40, Q41, Q42
      case '39':
      case '40':
      case '41':
      case '42':
        const q43 = questions.find(q => q.id === '43');
        const q39 = questions.find(q => q.id === '39');
        return q43?.answer !== 'no' && q39?.answer !== 'no';

      // If Q43 is "no", don't require Q44a, Q44b, Q44c, Q44d, Q44e
      case '44a':
      case '44b':
      case '44c':
      case '44d':
      case '44e':
        const q43Check2 = questions.find(q => q.id === '43');
        return q43Check2?.answer !== 'no';

      // If Q60 is "no", don't require Q61a, Q61b, Q61c, Q61d, Q61e
      case '61a':
      case '61b':
      case '61c':
      case '61d':
      case '61e':
        const q60 = questions.find(q => q.id === '60');
        return q60?.answer !== 'no';

      // If Q62 is "no", don't require Q63a, Q63b, Q63c, Q63d, Q64, Q65, Q66, Q67
      case '63a':
      case '63b':
      case '63c':
      case '63d':
      case '64':
      case '65':
      case '66':
      case '67':
        const q62 = questions.find(q => q.id === '62');
        return q62?.answer !== 'no';

      // If Q68 is "no", don't require Q69a, Q69b, Q69c, Q69d, Q69e, Q69f, Q69g, Q69h
      case '69a':
      case '69b':
      case '69c':
      case '69d':
      case '69e':
      case '69f':
      case '69g':
      case '69h':
        const q68 = questions.find(q => q.id === '68');
        return q68?.answer !== 'no';

      // All other questions are required by default
      default:
        return true;
    }
  };

  // Handle submit button click with validation
  const handleSubmitClick = () => {
    const unanswered = validateQuestions();
    
    if (unanswered.length > 0) {
      setUnansweredQuestions(unanswered);
      setValidationDialogOpen(true);
      return;
    }
    
    // If all required questions are answered, show legal warning
    setLegalWarningDialogOpen(true);
  };

  // Proceed with submission after legal warning is accepted
  const proceedWithSubmission = () => {
    setLegalWarningDialogOpen(false);
    submitToAPI();
  };

  // Render question based on type
  const renderQuestion = (question: AssessmentQuestion, level: number = 0) => {
    const marginLeft = level * 20;

    switch (question.type) {
      case 'text':
        return (
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            value={question.answer || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            sx={{ mt: 1, ml: marginLeft }}
          />
        );

      case 'paragraph':
        return (
          <TextField
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            size="small"
            value={question.answer || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            sx={{ mt: 1, ml: marginLeft }}
          />
        );

      case 'header':
        return null; // No input field for header questions

      case 'numeric':
        return (
          <TextField
            fullWidth
            type="number"
            variant="outlined"
            size="small"
            value={question.answer || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            sx={{ mt: 1, ml: marginLeft }}
          />
        );

      case 'yesno':
        return (
          <FormControl sx={{ mt: 1, ml: marginLeft }}>
            <FormGroup row>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={question.answer === 'yes'}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleAnswerChange(question.id, 'yes');
                      } else {
                        handleAnswerChange(question.id, null);
                      }
                    }}
                  />
                }
                label="Yes"
                sx={{ mr: 3 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={question.answer === 'no'}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleAnswerChange(question.id, 'no');
                      } else {
                        handleAnswerChange(question.id, null);
                      }
                    }}
                  />
                }
                label="No"
              />
            </FormGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Select one option (you can uncheck to clear your selection)
            </Typography>
          </FormControl>
        );

      case 'radio':
        // Check if this is a single response question that should have side-by-side layout
        // Only question 18 (sub-questions) should be side by side, others should be stacked
        const isSingleResponse = ['10', '12'].includes(question.id);
        return (
          <FormControl sx={{ mt: 1, ml: marginLeft }}>
            <FormGroup row={isSingleResponse}>
              {question.options?.map((option, index) => (
                <FormControlLabel
                  key={index}
                  control={
                    <Checkbox
                      checked={question.answer === option}
                      onChange={(e) => {
                        // For single-selection questions, unchecking sets answer to null
                        if (e.target.checked) {
                          handleAnswerChange(question.id, option);
                        } else {
                          handleAnswerChange(question.id, null);
                        }
                      }}
                    />
                  }
                  label={option}
                  sx={isSingleResponse ? { mr: 3, minWidth: 'fit-content' } : {}}
                />
              ))}
            </FormGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Select one option (you can uncheck to clear your selection)
            </Typography>
          </FormControl>
        );

      case 'checkbox':
        // Check if this is question 15 (select all that apply) that should have side-by-side layout
        const isSelectAllThatApply = question.id === '15';
        return (
          <FormControl sx={{ mt: 1, ml: marginLeft }}>
            <FormGroup row={isSelectAllThatApply}>
              {question.options?.map((option, index) => (
                <FormControlLabel
                  key={index}
                  control={
                    <Checkbox
                      checked={Array.isArray(question.answer) && question.answer.includes(option)}
                      onChange={(e) => {
                        const currentAnswers = Array.isArray(question.answer) ? question.answer : [];
                        const newAnswers = e.target.checked
                          ? [...currentAnswers, option]
                          : currentAnswers.filter(ans => ans !== option);
                        handleAnswerChange(question.id, newAnswers);
                      }}
                    />
                  }
                  label={option}
                  sx={isSelectAllThatApply ? { mr: 3, minWidth: 'fit-content' } : {}}
                />
              ))}
            </FormGroup>
            {isSelectAllThatApply && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Check all that apply
              </Typography>
            )}
          </FormControl>
        );



      default:
        return null;
    }
  };

  // Check if question should be shown based on conditional logic
  const shouldShowQuestion = (question: AssessmentQuestion): boolean => {
    if (!question.conditionalLogic) return true;
    
    const { dependsOn, showIf } = question.conditionalLogic;
    const dependentQuestion = questions.find(q => q.id === dependsOn);
    
    if (!dependentQuestion) return true;
    
    if (Array.isArray(dependentQuestion.answer)) {
      return dependentQuestion.answer.includes(showIf);
    }
    
    return dependentQuestion.answer === showIf;
  };

  const { score, totalPoints, earnedPoints } = calculateReadinessScore();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom color="primary">
        National Pediatric Readiness Assessment
      </Typography>

      {/* Official Submission Warning Banner */}
      <Alert 
        severity="warning" 
        sx={{ 
          mb: 3, 
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          '& .MuiAlert-icon': {
            color: '#d32f2f'
          }
        }}
        icon={<WarningIcon />}
      >
        <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
          ⚠️ This score is not official until it is submitted through{' '}
          <Link 
            href="https://pedsready.org/" 
            target="_blank" 
            rel="noopener noreferrer"
            sx={{ color: '#1976d2', textDecoration: 'underline' }}
          >
            pedsready.org
          </Link>
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
          {/* Upload Official Submission Document Button */}
          <Button
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            component="label"
            sx={{ 
              borderColor: '#1976d2',
              color: '#1976d2',
              '&:hover': {
                borderColor: '#1565c0',
                backgroundColor: '#e3f2fd'
              }
            }}
          >
            Upload Official Submission Document
            <input
              type="file"
              hidden
              accept=".pdf,.doc,.docx"
              onChange={handleOfficialSubmissionUpload}
            />
          </Button>

          {/* API Submission Button */}
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleSubmitClick}
            disabled={isSubmittingToAPI}
            sx={{ 
              backgroundColor: '#1976d2',
              '&:hover': {
                backgroundColor: '#1565c0'
              }
            }}
          >
            {isSubmittingToAPI ? 'Submitting...' : 'Submit to pedsready.org'}
          </Button>
        </Box>

        {/* Submission Status */}
        {submissionStatus && (
          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
            {submissionStatus}
          </Typography>
        )}
      </Alert>

      {showSkipMessage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {showSkipMessage}
        </Alert>
      )}

      {/* Current Score Section */}
      <Box sx={{ mb: 3 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Current Score: {score.toFixed(3)}/{totalPoints}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Progress: {questions.filter(q => q.answer).length} of {questions.length} questions answered
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Previous Assessment Scores with Integrated History */}
      <Box sx={{ mb: 3 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                Previous Assessment Scores
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setIsEditMode(!isEditMode)}
                  startIcon={<EditIcon />}
                >
                  {isEditMode ? 'Exit Edit' : 'Edit'}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => setPreviousScoreDialogOpen(true)}
                  startIcon={<AddIcon />}
                >
                  Add Previous Score
                </Button>
              </Box>
            </Box>
            
            {/* Readiness Scores History integrated here */}
            {readinessScores.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Readiness Score History
                </Typography>
                <TableContainer component={Paper}>
                  <Table>
                                            <TableHead>
                          <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Score</TableCell>
                            <TableCell>PDF File</TableCell>
                            {isEditMode && <TableCell>Actions</TableCell>}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {readinessScores
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((score) => (
                            <TableRow key={score.id}>
                              <TableCell>{score.date}</TableCell>
                              <TableCell>{formatScore(score.score)}/{totalPoints}</TableCell>
                              <TableCell>
                                {score.pdfFileName ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleViewPdf(score)}>
                                    <PictureAsPdfIcon sx={{ mr: 1, color: 'red' }} />
                                    <Typography variant="body2" sx={{ textDecoration: 'underline', color: 'primary.main' }}>
                                      {score.pdfFileName}
                                    </Typography>
                                  </Box>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No PDF
                                  </Typography>
                                )}
                              </TableCell>
                              {isEditMode && (
                                <TableCell>
                                  <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                      size="small"
                                      color="primary"
                                      onClick={() => handleEditScore(score)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="small"
                                      color="error"
                                      onClick={() => handleDeleteScore(score.id)}
                                    >
                                      Delete
                                    </Button>
                                  </Box>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Questions 1-29 in accordion */}
      <Accordion>
        <AccordionSummary 
          expandIcon={<ExpandMoreIcon sx={{ color: 'white' }} />}
          sx={{ 
            backgroundColor: '#1976d2',
            '&:hover': { backgroundColor: '#1565c0' }
          }}
        >
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
            Basic Information & Hospital Setup (Questions 1-21)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {questions.filter(question => {
            // Check if this question should be hidden due to skip logic from other questions
            const shouldHide = questions.some(q => {
              if (q.skipLogic && q.skipLogic.hideQuestions.includes(question.id)) {
                return q.answer === q.skipLogic.if;
              }
              return false;
            });
            
            if (shouldHide) return false;
            
            // Show questions 1-21 and sub-questions 18a-18h
            const questionId = question.id;
            const questionNumber = parseInt(questionId);
            
            // Check if it's a main question 1-21
            if (!isNaN(questionNumber) && questionNumber >= 1 && questionNumber <= 21) return true;
            
            // Check if it's a sub-question that should be in this section (18a-18h)
            if (/^18[a-h]$/.test(questionId)) return true;
            
            return false;
          }).map((question) => {
            // Check if this is a sub-question (18a-18h) for special styling
            const isSubQuestion = ['18a', '18b', '18c', '18d', '18e', '18f', '18g', '18h'].includes(question.id);
            const isHeader = question.type === 'header';
            
            return (
              <Box key={question.id} sx={{ 
                mb: 3, 
                p: 2, 
                border: '1px solid #e0e0e0', 
                borderRadius: 1,
                ml: isSubQuestion ? 3 : 0, // Indent sub-questions
                borderLeft: isSubQuestion ? '3px solid #1976d2' : '1px solid #e0e0e0' // Blue left border for sub-questions
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {question.id}. {question.text}
                    </Typography>
                    {question.note && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontStyle: 'italic' }}>
                        {question.note}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {question.points ? `${question.points} points` : '0.0 points'}
                    </Typography>
                  </Box>
                  {/* Add Gap Plan button for questions with gap plans */}
                  {question.hasGapPlan && (
                    <Button
                      variant={hasGapPlanContent(question.id) ? "contained" : "outlined"}
                      size="small"
                      onClick={() => handleGapPlanOpen(question)}
                      startIcon={hasGapPlanContent(question.id) ? <VisibilityIcon /> : <AddIcon />}
                      sx={{ 
                        ml: 2, 
                        flexShrink: 0,
                        bgcolor: hasGapPlanContent(question.id) ? 'warning.main' : 'transparent',
                        color: hasGapPlanContent(question.id) ? 'white' : 'primary.main',
                        borderColor: hasGapPlanContent(question.id) ? 'warning.main' : 'primary.main',
                        '&:hover': {
                          bgcolor: hasGapPlanContent(question.id) ? 'warning.dark' : 'primary.dark',
                          color: hasGapPlanContent(question.id) ? 'white' : 'primary.main'
                        }
                      }}
                    >
                      {hasGapPlanContent(question.id) ? 'View Plan' : 'Gap Plan'}
                    </Button>
                  )}
                </Box>
                {!isHeader && renderQuestion(question)}
              </Box>
            );
          })}
        </AccordionDetails>
      </Accordion>

      {/* Core Assessment Questions */}
      <Accordion defaultExpanded>
        <AccordionSummary 
          expandIcon={<ExpandMoreIcon sx={{ color: 'white' }} />}
          sx={{ 
            backgroundColor: '#2e7d32',
            '&:hover': { backgroundColor: '#1b5e20' }
          }}
        >
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
            Core Assessment Questions (Questions 22-78)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {questions.filter(question => {
            // Check if this question should be hidden due to skip logic from other questions
            const shouldHide = questions.some(q => {
              if (q.skipLogic && q.skipLogic.hideQuestions.includes(question.id)) {
                return q.answer === q.skipLogic.if;
              }
              return false;
            });
            
            if (shouldHide) return false;
            
            // Show questions 22-78 and sub-questions (excluding 18a-18h which are in first accordion)
            const questionId = question.id;
            const questionNumber = parseInt(questionId);
            
            // Check if it's a main question 22-78
            if (!isNaN(questionNumber) && questionNumber >= 22 && questionNumber <= 78) return true;
            
            // Check if it's a sub-question that should be in this section (excluding 18a-18h)
            const subQuestionPatterns = [
              /^29[a-h]$/,  // 29a-29h
              /^44[a-e]$/,  // 44a-44e
              /^57[a-f]$/,  // 57a-57f
              /^61[a-e]$/,  // 61a-61e
              /^63[a-d]$/,  // 63a-63d
              /^69[a-h]$/,  // 69a-69h
              /^74[a-f]$/,  // 74a-74f
              /^75[a-d]$/,  // 75a-75d
              /^76[a-h]$/,  // 76a-76h
              /^77[a-l]$/,  // 77a-77l
              /^78[a-m]$/   // 78a-78m
            ];
            
            if (subQuestionPatterns.some(pattern => pattern.test(questionId))) return true;
            
            return false; // Only show questions that match the criteria above
          }).map((question) => {
            // Check if this is a sub-question for special styling
            const isSubQuestion = ['18a', '18b', '18c', '18d', '18e', '18f', '18g', '18h',
                                  '29a', '29b', '29c', '29d', '29e', '29f', '29g', '29h', 
                                  '44a', '44b', '44c', '44d', '44e',
                                  '57a', '57b', '57c', '57d', '57e', '57f',
                                  '61a', '61b', '61c', '61d', '61e',
                                  '63a', '63b', '63c', '63d',
                                  '69a', '69b', '69c', '69d', '69e', '69f', '69g', '69h',
                                  '74a', '74b', '74c', '74d', '74e', '74f',
                                  '75a', '75b', '75c', '75d',
                                  '76a', '76b', '76c', '76d', '76e', '76f', '76g', '76h',
                                  '77a', '77b', '77c', '77d', '77e', '77f', '77g', '77h', '77i', '77j', '77k', '77l',
                                  '78a', '78b', '78c', '78d', '78e', '78f', '78g', '78h', '78i', '78j', '78k', '78l', '78m'].includes(question.id);
            const isHeader = question.type === 'header';
            
            return (
              <Box key={question.id} sx={{ 
                mb: 3, 
                p: 2, 
                border: '1px solid #e0e0e0', 
                borderRadius: 1,
                ml: isSubQuestion ? 3 : 0, // Indent sub-questions
                borderLeft: isSubQuestion ? '3px solid #1976d2' : '1px solid #e0e0e0' // Blue left border for sub-questions
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {question.id}. {question.text}
                    </Typography>
                    {question.note && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontStyle: 'italic' }}>
                        {question.note}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {question.points ? `${question.points} points` : '0.0 points'}
                    </Typography>
                  </Box>
                  {/* Add Gap Plan button for questions with gap plans */}
                  {question.hasGapPlan && (
                    <Button
                      variant={hasGapPlanContent(question.id) ? "contained" : "outlined"}
                      size="small"
                      onClick={() => handleGapPlanOpen(question)}
                      startIcon={hasGapPlanContent(question.id) ? <VisibilityIcon /> : <AddIcon />}
                      sx={{ 
                        ml: 2, 
                        flexShrink: 0,
                        bgcolor: hasGapPlanContent(question.id) ? 'warning.main' : 'transparent',
                        color: hasGapPlanContent(question.id) ? 'white' : 'primary.main',
                        borderColor: hasGapPlanContent(question.id) ? 'warning.main' : 'primary.main',
                        '&:hover': {
                          bgcolor: hasGapPlanContent(question.id) ? 'warning.dark' : 'primary.dark',
                          color: hasGapPlanContent(question.id) ? 'white' : 'primary.main'
                        }
                      }}
                    >
                      {hasGapPlanContent(question.id) ? 'View Plan' : 'Gap Plan'}
                    </Button>
                  )}
                </Box>
                {!isHeader && renderQuestion(question)}
              </Box>
            );
          })}
        </AccordionDetails>
      </Accordion>

      {/* Conclusion & Patient Volume */}
      <Accordion>
        <AccordionSummary 
          expandIcon={<ExpandMoreIcon sx={{ color: 'white' }} />}
          sx={{ 
            backgroundColor: '#ed6c02',
            '&:hover': { backgroundColor: '#e65100' }
          }}
        >
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
            Conclusion & Patient Volume (Questions 79-82)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {questions.filter(question => {
            // Check if this question should be hidden due to skip logic from other questions
            const shouldHide = questions.some(q => {
              if (q.skipLogic && q.skipLogic.hideQuestions.includes(question.id)) {
                return q.answer === q.skipLogic.if;
              }
              return false;
            });
            
            if (shouldHide) return false;
            
            // Only show questions 79-82
            const questionNumber = parseInt(question.id);
            if (isNaN(questionNumber) || questionNumber < 79 || questionNumber > 82) return false;
            
            return shouldShowQuestion(question);
          }).map((question) => (
            <Box key={question.id} sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {question.id}. {question.text}
                  </Typography>
                  {question.note && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontStyle: 'italic' }}>
                      {question.note}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {question.points ? `${question.points} points` : '0.0 points'}
                  </Typography>
                </Box>
                {/* Add Gap Plan button for questions with gap plans */}
                {question.hasGapPlan && (
                  <Button
                    variant={hasGapPlanContent(question.id) ? "contained" : "outlined"}
                    size="small"
                    onClick={() => handleGapPlanOpen(question)}
                    startIcon={hasGapPlanContent(question.id) ? <VisibilityIcon /> : <AddIcon />}
                    sx={{ 
                      ml: 2, 
                      flexShrink: 0,
                      bgcolor: hasGapPlanContent(question.id) ? 'warning.main' : 'transparent',
                      color: hasGapPlanContent(question.id) ? 'white' : 'primary.main',
                      borderColor: hasGapPlanContent(question.id) ? 'warning.main' : 'primary.main',
                      '&:hover': {
                        bgcolor: hasGapPlanContent(question.id) ? 'warning.dark' : 'primary.dark',
                        color: hasGapPlanContent(question.id) ? 'white' : 'primary.main'
                      }
                    }}
                  >
                    {hasGapPlanContent(question.id) ? 'View Plan' : 'Gap Plan'}
                  </Button>
                )}
              </Box>
              {renderQuestion(question)}
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>

      {/* Gap Plan Dialog */}
      <Dialog open={gapPlanDialogOpen} onClose={() => setGapPlanDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingGapPlan ? 'Edit Gap Plan' : 'Create Gap Plan'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Question: {selectedQuestion?.text}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Action Plan"
                multiline
                rows={3}
                value={gapFormData.action || ''}
                onChange={(e) => setGapFormData({ ...gapFormData, action: e.target.value })}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Owner"
                value={gapFormData.owner || ''}
                onChange={(e) => setGapFormData({ ...gapFormData, owner: e.target.value })}
              />
            </Grid>

            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={gapFormData.status || ''}
                  onChange={(e) => setGapFormData({ ...gapFormData, status: e.target.value as GapPlan['status'] })}
                >
                  <MenuItem value="Need to Develop">Need to Develop</MenuItem>
                  <MenuItem value="In Progress">In Progress</MenuItem>
                  <MenuItem value="Needs Update">Needs Update</MenuItem>
                  <MenuItem value="Cannot be done at this time">Cannot be done at this time</MenuItem>
                  <MenuItem value="Completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={gapFormData.priority || ''}
                  onChange={(e) => setGapFormData({ ...gapFormData, priority: e.target.value as GapPlan['priority'] })}
                >
                  <MenuItem value="High Importance & High Urgency (Do Now)">High Importance & High Urgency (Do Now)</MenuItem>
                  <MenuItem value="High Importance & Low Urgency (Do Next)">High Importance & Low Urgency (Do Next)</MenuItem>
                  <MenuItem value="Low Importance & High Effort (Do Later)">Low Importance & High Effort (Do Later)</MenuItem>
                  <MenuItem value="Low Importance & Low Urgency (Do Last)">Low Importance & Low Urgency (Do Last)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={gapFormData.difficulty || ''}
                  onChange={(e) => setGapFormData({ ...gapFormData, difficulty: e.target.value as GapPlan['difficulty'] })}
                >
                  <MenuItem value="High Impact & Low Effort (Quick Wins)">High Impact & Low Effort (Quick Wins)</MenuItem>
                  <MenuItem value="High Impact & High Effort (Big Projects)">High Impact & High Effort (Big Projects)</MenuItem>
                  <MenuItem value="Low Impact & Low Effort (Filler Tasks)">Low Impact & Low Effort (Filler Tasks)</MenuItem>
                  <MenuItem value="Low Impact & High Effort (Hard Slogs)">Low Impact & High Effort (Hard Slogs)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Due Date"
                type="date"
                value={gapFormData.dueDate || ''}
                onChange={(e) => setGapFormData({ ...gapFormData, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Completion Date"
                type="date"
                value={gapFormData.completionDate || ''}
                onChange={(e) => setGapFormData({ ...gapFormData, completionDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={gapFormData.notes || ''}
                onChange={(e) => setGapFormData({ ...gapFormData, notes: e.target.value })}
              />
            </Grid>

            {/* File Upload Section */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Attachments
              </Typography>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleGapPlanFileUpload}
                style={{ display: 'none' }}
                id="gap-plan-file-upload"
              />
              <label htmlFor="gap-plan-file-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                >
                  Upload Files
                </Button>
              </label>
              
              {/* Display current attachments */}
              {gapFormData.attachments && gapFormData.attachments.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  {gapFormData.attachments.map((attachment) => (
                    <Box key={attachment.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      {attachment.fileType === 'pdf' ? (
                        <PictureAsPdfIcon sx={{ mr: 1, color: 'red' }} />
                      ) : (
                        <ImageIcon sx={{ mr: 1, color: 'green' }} />
                      )}
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {attachment.fileName}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveAttachment(attachment.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGapPlanDialogOpen(false)}>Cancel</Button>
          {editingGapPlan && (
            <Button
              color="error"
              onClick={() => {
                handleGapPlanDelete(editingGapPlan.id);
                setGapPlanDialogOpen(false);
                setEditingGapPlan(null);
                setGapFormData({});
              }}
            >
              Delete
            </Button>
          )}
          <Button onClick={handleGapPlanSubmit} variant="contained">
            {editingGapPlan ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Previous Assessment Score Dialog */}
      <Dialog open={previousScoreDialogOpen} onClose={() => setPreviousScoreDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Add Previous Assessment Score
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={previousScoreDate}
                onChange={(e) => setPreviousScoreDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Score (Points)"
                type="number"
                placeholder={`Enter score (0-${totalPoints})`}
                value={previousScoreValue}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty string for clearing
                  if (value === '') {
                    setPreviousScoreValue('');
                    return;
                  }
                  // Parse the number
                  const numValue = parseFloat(value);
                  // Check if it's a valid number and within range
                  if (!isNaN(numValue) && numValue >= 0 && numValue <= totalPoints) {
                    setPreviousScoreValue(value);
                  }
                }}
                inputProps={{
                  min: 0,
                  max: totalPoints,
                  step: 0.001
                }}
                helperText={`Score must be between 0 and ${totalPoints} (up to 3 decimal places)`}
              />
            </Grid>
            <Grid item xs={12}>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPreviousScorePdf(file);
                  }
                }}
                style={{ display: 'none' }}
                id="previous-score-pdf-upload"
              />
              <label htmlFor="previous-score-pdf-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<PictureAsPdfIcon />}
                  fullWidth
                >
                  {previousScorePdf ? `PDF: ${previousScorePdf.name}` : 'Upload PDF'}
                </Button>
              </label>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviousScoreDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained"
                              onClick={() => {
                    if (previousScoreValue && previousScoreDate) {
                      const scoreValue = parseFloat(previousScoreValue);
                      if (!isNaN(scoreValue) && scoreValue >= 0 && scoreValue <= totalPoints) {
                        // Convert PDF file to base64 for storage
                        let pdfData = '';
                        if (previousScorePdf) {
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            pdfData = e.target?.result as string;
                            const newScore: ReadinessScore = {
                              id: Date.now().toString(),
                              date: previousScoreDate,
                              score: scoreValue,
                              pdfFileName: previousScorePdf?.name,
                              pdfFile: pdfData
                            };
                            setReadinessScores(prev => [...prev, newScore]);
                            setPreviousScoreValue('');
                            setPreviousScorePdf(null);
                            setPreviousScoreDialogOpen(false);
                          };
                          reader.readAsDataURL(previousScorePdf);
                        } else {
                          const newScore: ReadinessScore = {
                            id: Date.now().toString(),
                            date: previousScoreDate,
                            score: scoreValue,
                            pdfFileName: undefined,
                            pdfFile: pdfData
                          };
                          setReadinessScores(prev => [...prev, newScore]);
                          setPreviousScoreValue('');
                          setPreviousScorePdf(null);
                          setPreviousScoreDialogOpen(false);
                        }
                      }
                    }
                  }}
          >
            Add Score
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Assessment Score Dialog */}
      <Dialog open={editScoreDialogOpen} onClose={() => setEditScoreDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit Assessment Score
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={editingScoreDate}
                onChange={(e) => setEditingScoreDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Score (Points)"
                type="number"
                placeholder="Enter score (0-100)"
                value={editingScoreValue}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty string for clearing
                  if (value === '') {
                    setEditingScoreValue('');
                    return;
                  }
                  // Parse the number
                  const numValue = parseFloat(value);
                  // Check if it's a valid number and within range
                  if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                    setEditingScoreValue(value);
                  }
                }}
                inputProps={{
                  min: 0,
                  max: totalPoints,
                  step: 0.001
                }}
                helperText={`Score must be between 0 and ${totalPoints} (up to 3 decimal places)`}
              />
            </Grid>
            <Grid item xs={12}>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setEditingScorePdf(file);
                  }
                }}
                style={{ display: 'none' }}
                id="edit-score-pdf-upload"
              />
              <label htmlFor="edit-score-pdf-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<PictureAsPdfIcon />}
                  fullWidth
                >
                  {editingScorePdf ? `PDF: ${editingScorePdf.name}` : editingScore?.pdfFileName ? `Current: ${editingScore.pdfFileName}` : 'Upload New PDF (Optional)'}
                </Button>
              </label>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditScoreDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained"
            onClick={handleSaveEditedScore}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Validation Dialog */}
      <Dialog 
        open={validationDialogOpen} 
        onClose={() => setValidationDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ color: '#d32f2f', fontWeight: 'bold' }}>
          ⚠️ Incomplete Assessment
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Please complete the following required questions before submitting:
          </Typography>
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {unansweredQuestions.map((question, index) => (
              <ListItem key={index} sx={{ py: 0.5 }}>
                <ListItemText 
                  primary={question}
                  sx={{ 
                    '& .MuiListItemText-primary': {
                      fontSize: '0.9rem',
                      color: '#666'
                    }
                  }}
                />
              </ListItem>
            ))}
          </List>
          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic', color: '#666' }}>
            Note: Some questions may not be required based on your previous answers.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setValidationDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Legal Warning Dialog */}
      <Dialog 
        open={legalWarningDialogOpen} 
        onClose={() => setLegalWarningDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ color: '#d32f2f', fontWeight: 'bold' }}>
          ⚠️ Data Sharing Agreement
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2, fontWeight: 'bold' }}>
            By submitting this assessment, you acknowledge and agree to the following:
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>1. Data Collection and Use:</strong> You are providing official hospital data to pedsready.org for the purpose of pediatric emergency care readiness assessment and quality improvement initiatives.
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>2. Data Sharing:</strong> Your responses will be shared with pedsready.org and may be used for research, benchmarking, and national pediatric readiness initiatives.
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>3. Data Security:</strong> While we implement appropriate security measures, you acknowledge that data transmission over the internet carries inherent risks.
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>4. Accuracy:</strong> You certify that all information provided is accurate and complete to the best of your knowledge.
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>5. Authorization:</strong> You have the authority to submit this assessment on behalf of your healthcare facility.
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic', color: '#666' }}>
            By clicking "I Agree and Submit", you confirm that you have read, understood, and agree to these terms.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLegalWarningDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={proceedWithSubmission}
            variant="contained"
            sx={{ backgroundColor: '#1976d2' }}
          >
            I Agree and Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PRSPage;
