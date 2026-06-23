import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Checkbox,
  FormControlLabel,
  Divider,
  Link,
  SxProps,
  Theme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  IMPACTS_CONTACT_EMAIL,
  IMPACTS_ORG_URL,
  PECC_TOOL_ACCOUNT_URL,
} from '../config/appUrls';
import { CURRENT_TERMS_VERSION, TERMS_LAST_UPDATED_LABEL } from '../utils/termsOfService';

interface TermsOfServiceProps {
  open: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
  readOnly?: boolean;
}

const TERMS_FONT = '"Times New Roman", Times, serif';

const termsDoc: SxProps<Theme> = {
  fontFamily: TERMS_FONT,
  fontSize: '12pt',
  lineHeight: 1,
  color: '#000000',
  textAlign: 'left',
};

const termsSectionSx: SxProps<Theme> = {
  ...termsDoc,
  fontWeight: 700,
  display: 'block',
  mt: 2,
  mb: 0.75,
};

const termsParagraphSx: SxProps<Theme> = {
  ...termsDoc,
  display: 'block',
  mb: 1,
};

const termsListSx: SxProps<Theme> = {
  ...termsDoc,
  pl: 3,
  mb: 1,
  mt: 0,
  listStyleType: 'disc',
  '& li': {
    fontFamily: TERMS_FONT,
    fontSize: '12pt',
    lineHeight: 1,
    color: '#000000',
    display: 'list-item',
    mb: 0.5,
  },
};

const termsLinkSx: SxProps<Theme> = {
  ...termsDoc,
  color: '#000000',
  textDecoration: 'underline',
  '&:hover': { color: '#000000' },
};

const TermsSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography component="h3" sx={termsSectionSx}>
    {children}
  </Typography>
);

const TermsP: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography component="p" sx={termsParagraphSx}>
    {children}
  </Typography>
);

const TermsList: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box component="ul" sx={termsListSx}>
    {children}
  </Box>
);

const TermsOfService: React.FC<TermsOfServiceProps> = ({
  open,
  onClose,
  onAccept,
  showAcceptButton = false,
  readOnly = false,
}) => {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    if (accepted && onAccept) {
      onAccept();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90vh',
          bgcolor: '#ffffff',
          color: '#000000',
          border: '1px solid #000000',
        },
      }}
    >
      <DialogTitle
        sx={{
          ...termsDoc,
          fontWeight: 700,
          borderBottom: '1px solid #000000',
          py: 1.5,
          px: 3,
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography component="span" sx={{ ...termsDoc, fontWeight: 700 }}>
            Terms of Service and User Agreement
          </Typography>
          <Button
            onClick={onClose}
            startIcon={<CloseIcon />}
            variant="text"
            size="small"
            sx={{
              ...termsDoc,
              minWidth: 'auto',
              textTransform: 'none',
              color: '#000000',
            }}
          >
            Close
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          ...termsDoc,
          px: 3,
          py: 2,
          bgcolor: '#ffffff',
          '& .MuiDivider-root': { borderColor: '#000000' },
        }}
      >
        <Box sx={{ mb: 2, pb: 1, borderBottom: '1px solid #000000' }}>
          <Typography component="p" sx={{ ...termsSectionSx, mt: 0 }}>
            ImPACTS PECC Support Tool
          </Typography>
          <Typography component="p" sx={termsParagraphSx}>
            <strong>Last Updated:</strong> {TERMS_LAST_UPDATED_LABEL}
            <br />
            <strong>Version:</strong> {CURRENT_TERMS_VERSION}
          </Typography>
        </Box>

        <TermsSection>1. Purpose and Scope</TermsSection>
        <TermsP>
          This Terms of Service and User Agreement (&quot;Agreement&quot;) is a legally binding contract
          between you (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) and the ImPACTS Collaborative (&quot;ImPACTS,&quot; &quot;we,&quot;
          &quot;us,&quot; or &quot;our&quot;) governing your use of the ImPACTS (Improving Pediatric Acute Care Through
          Simulation) ImPACTS PECC Support Tool (&quot;Tool&quot; or &quot;Service&quot;). This Tool is
          designed to assist healthcare facilities in assessing and improving their pediatric
          readiness capabilities through simulation-based evaluation and gap analysis. By accessing,
          using, or registering for this Tool, you acknowledge that you have read, understood, and
          agree to be bound by the terms and conditions of this Agreement.
        </TermsP>
        <TermsP>
          <strong>IMPORTANT:</strong> This Agreement contains important legal provisions, including
          limitations on our liability, your indemnification obligations, and dispute resolution
          procedures. Please read this Agreement carefully before using the Tool.
        </TermsP>

        <TermsSection>2. Critical Data Usage Restrictions and HIPAA Compliance</TermsSection>
        <Box
          sx={{
            border: '1px solid #000000',
            p: 2,
            mb: 2,
            bgcolor: '#ffffff',
          }}
        >
          <Typography component="p" sx={{ ...termsSectionSx, mt: 0, textAlign: 'left' }}>
            ABSOLUTELY NO REAL PATIENT DATA ALLOWED
          </Typography>
          <Typography component="p" sx={{ ...termsParagraphSx, fontWeight: 700 }}>
            ZERO TOLERANCE POLICY FOR PATIENT DATA
          </Typography>
          <TermsP>
            <strong>THIS TOOL IS STRICTLY PROHIBITED FROM CONTAINING ANY REAL PATIENT DATA,
            ESPECIALLY IDENTIFIABLE HUMAN SUBJECT DATA.</strong> This is a fundamental requirement
            and violation will result in immediate account termination and potential legal action.
          </TermsP>
          <TermsP>
            You expressly agree, warrant, and covenant that you will NEVER input, upload, store,
            transmit, or otherwise introduce any of the following into this Tool:
          </TermsP>
          <TermsList>
            <li>Patient names, medical record numbers, social security numbers, or any other identifiers</li>
            <li>Protected Health Information (PHI) as defined by the Health Insurance Portability and Accountability Act (HIPAA)</li>
            <li>Personal Identifiable Information (PII) as defined by applicable privacy laws</li>
            <li>Any data that could directly or indirectly identify individual patients</li>
            <li>Real clinical data from actual patient encounters, treatments, or medical records</li>
            <li>Patient demographics, addresses, phone numbers, or contact information</li>
            <li>Medical diagnoses, treatment plans, or clinical notes</li>
            <li>Any information that could be used to re-identify de-identified data</li>
            <li>Images, photographs, or videos of patients</li>
            <li>Any data subject to patient confidentiality or medical privacy laws</li>
          </TermsList>
          <TermsP>
            <strong>VIOLATION CONSEQUENCES:</strong> Any violation of this section will result in
            immediate termination of your account, potential legal action, and reporting to
            appropriate regulatory authorities. You will be held fully liable for any damages,
            fines, or penalties resulting from such violations.
          </TermsP>
        </Box>

        <TermsSection>3. Data Collection, Research Use, and Intellectual Property</TermsSection>
        <TermsP>By using this Tool, you acknowledge, agree, and consent to the following:</TermsP>
        <TermsList>
          <li><strong>Research Participation:</strong> All data entered will be utilized for research purposes by the ImPACTS Collaborative and its affiliated researchers, institutions, and partners</li>
          <li><strong>Data Deidentification:</strong> All data will be deidentified, anonymized, and aggregated before any research analysis, publication, or presentation</li>
          <li><strong>National Contribution:</strong> Your facility&apos;s participation contributes to national pediatric readiness improvement efforts and evidence-based healthcare research</li>
          <li><strong>Research Publications:</strong> Aggregated, deidentified data may be used in research publications, presentations, grant applications, and other scholarly activities</li>
          <li><strong>Facility Anonymity:</strong> No individual facility will be identified in research outputs without your explicit written consent</li>
          <li><strong>Data Sharing:</strong> Deidentified data may be shared with other researchers, institutions, or organizations for legitimate research purposes</li>
          <li><strong>Long-term Storage:</strong> Data may be stored indefinitely for research purposes, subject to applicable data retention laws</li>
          <li><strong>Commercial Use:</strong> ImPACTS reserves the right to use aggregated, deidentified data for commercial purposes, including but not limited to product development and consulting services</li>
          <li><strong>Intellectual Property:</strong> All data, insights, and research findings derived from this Tool become the intellectual property of ImPACTS, subject to applicable laws and regulations</li>
        </TermsList>

        <TermsSection>4. Opt-Out Rights and Data Withdrawal</TermsSection>
        <TermsP>
          You have the right to opt out of data collection and research use at any time. However,
          please note the following important limitations and procedures:
        </TermsP>
        <TermsList>
          <li>
            <strong>Withdrawal Process:</strong> To opt out, you must send a written request to{' '}
            <Link href={`mailto:${IMPACTS_CONTACT_EMAIL}`} sx={termsLinkSx}>
              {IMPACTS_CONTACT_EMAIL}
            </Link>{' '}
            with your facility name, contact information, and explicit request for data removal
          </li>
          <li><strong>Data Removal Timeline:</strong> We will remove your identifiable data within 30 days of receiving your verified request</li>
          <li><strong>Research Data Limitation:</strong> Once data has been included in published research, presentations, or other scholarly works, it cannot be withdrawn from those specific publications</li>
          <li><strong>Aggregated Data:</strong> Deidentified, aggregated data may be retained for ongoing research purposes even after your withdrawal</li>
          <li><strong>Verification Required:</strong> We may require verification of your identity and authorization to make such requests</li>
          <li><strong>Partial Withdrawal:</strong> You may request withdrawal from future data collection while allowing previously collected data to remain in research datasets</li>
        </TermsList>

        <TermsSection>5. Indemnification, Liability, and Risk Allocation</TermsSection>
        <TermsP>
          <strong>INDEMNIFICATION OBLIGATION:</strong> You agree to indemnify, defend, and hold
          harmless ImPACTS, its officers, directors, employees, agents, affiliates, successors,
          and assigns from and against any and all claims, demands, actions, suits, proceedings,
          damages, losses, costs, expenses (including reasonable attorneys&apos; fees and court costs),
          judgments, settlements, and penalties arising out of or relating to:
        </TermsP>
        <TermsList>
          <li>Your use of the Tool in violation of this Agreement or applicable laws</li>
          <li>Your input of any real patient data, PHI, or PII into the Tool</li>
          <li>Any breach of patient confidentiality, privacy laws, or medical ethics</li>
          <li>Any unauthorized use of the Tool, its data, or its intellectual property</li>
          <li>Any claims by third parties (including patients, regulatory authorities, or other users) related to your use of the Tool</li>
          <li>Any violation of HIPAA, state privacy laws, or other applicable regulations</li>
          <li>Any misuse, misrepresentation, or inappropriate reliance on Tool outputs</li>
          <li>Any data breaches or security incidents caused by your actions or omissions</li>
          <li>Any decisions made based on Tool outputs that result in harm or liability</li>
        </TermsList>
        <TermsP>
          <strong>LIMITATION OF LIABILITY:</strong> TO THE MAXIMUM EXTENT PERMITTED BY LAW,
          IMPACTS&apos; TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING OUT OF OR RELATING TO THIS
          AGREEMENT OR THE TOOL SHALL NOT EXCEED THE AMOUNT YOU PAID TO USE THE TOOL (IF ANY)
          IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM. IN NO EVENT SHALL IMPACTS BE LIABLE
          FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING
          BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES.
        </TermsP>
        <TermsP>
          <strong>DISCLAIMER OF WARRANTIES:</strong> THE TOOL IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
          WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE.
          IMPACTS DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY.
          IMPACTS DOES NOT WARRANT THAT THE TOOL WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
        </TermsP>

        <TermsSection>6. Tool Limitations, Disclaimers, and Professional Responsibility</TermsSection>
        <TermsP>You acknowledge, understand, and agree that:</TermsP>
        <TermsList>
          <li><strong>Educational Purpose Only:</strong> This Tool is intended for pediatric readiness improvement, educational purposes, and research only. It is NOT a substitute for professional medical judgment, clinical decision-making, or regulatory compliance</li>
          <li><strong>No Government Endorsement:</strong> The Tool is aligned with national pediatric readiness projects but is NOT endorsed by, affiliated with, or approved by any government agency, regulatory body, professional organization, or official entity</li>
          <li><strong>Clinical Decision Limitation:</strong> Results from this Tool should NEVER be used as the sole basis for clinical decisions, patient care protocols, policy changes, or regulatory compliance decisions</li>
          <li><strong>Professional Responsibility:</strong> You are solely responsible for ensuring compliance with all applicable laws, regulations, professional standards, and ethical guidelines in your jurisdiction</li>
          <li><strong>No Liability for Decisions:</strong> ImPACTS is not responsible for any decisions, actions, or consequences resulting from your use of Tool outputs</li>
          <li><strong>Accuracy Disclaimer:</strong> ImPACTS does not guarantee the accuracy, completeness, or reliability of any Tool outputs or recommendations</li>
          <li><strong>Regulatory Compliance:</strong> You must independently verify that your use of this Tool complies with all applicable healthcare regulations, including but not limited to HIPAA, state privacy laws, and professional licensing requirements</li>
          <li><strong>Professional Standards:</strong> You must maintain appropriate professional standards and ethical practices when using this Tool</li>
        </TermsList>

        <TermsSection>7. Data Security, Privacy, and Compliance</TermsSection>
        <TermsP>
          <strong>Account and CRM Data:</strong> Personal and facility information you provide in
          Account Settings may be stored and synced with the platform&apos;s CRM and registration data
          for administration, cohort management, and program operations. By updating your account
          information, you consent to this use and to your organization&apos;s administrators viewing
          and managing contact details as needed for the service.
        </TermsP>
        <TermsP>
          <strong>Security Measures:</strong> While ImPACTS implements reasonable administrative,
          technical, and physical security measures to protect data, you acknowledge and agree that:
        </TermsP>
        <TermsList>
          <li><strong>No Absolute Security:</strong> No system is completely secure from unauthorized access, data breaches, or cyber attacks</li>
          <li><strong>Credential Responsibility:</strong> You are solely responsible for maintaining the security and confidentiality of your login credentials, passwords, access codes, and authenticator devices used for multi-factor authentication (MFA)</li>
          <li><strong>Breach Notification:</strong> You will immediately notify ImPACTS of any suspected security breaches, unauthorized access, or data incidents</li>
          <li><strong>Incident Response:</strong> ImPACTS will notify users of any significant security incidents affecting their data within 72 hours of discovery</li>
          <li><strong>Data Encryption:</strong> Data is encrypted in transit and at rest, but you acknowledge that encryption is not foolproof</li>
          <li><strong>Third-Party Services:</strong> ImPACTS may use third-party services for data processing, and you consent to such use</li>
          <li><strong>International Transfers:</strong> Data may be transferred to and processed in countries other than your own</li>
          <li><strong>Regulatory Compliance:</strong> You must ensure your use complies with all applicable data protection laws, including GDPR, CCPA, and state privacy laws</li>
        </TermsList>
        <TermsP>
          <strong>Password and Session Security:</strong> To protect accounts and facility data, ImPACTS
          enforces technical access controls that may include:
        </TermsP>
        <TermsList>
          <li><strong>Minimum password length:</strong> Passwords must meet the minimum length and strength requirements displayed in the Tool (currently at least 15 characters). Requirements may be strengthened over time; you may be required to update legacy passwords before continuing to use the Tool.</li>
          <li><strong>Multi-factor authentication (MFA):</strong> All users must enroll MFA using a time-based one-time password (TOTP) authenticator app (for example, Google Authenticator, 1Password, Authy, or Apple Passwords). Enrollment is required before full use of the Tool after sign-in. You may be prompted to verify MFA when signing in, resuming a session, or after inactivity. Password-reset email links do not require MFA during the recovery flow itself; MFA applies again after you complete recovery and sign in normally.</li>
          <li><strong>Password changes:</strong> Changing your password may require your current password or recent re-authentication.</li>
          <li><strong>Idle session timeout:</strong> For shared-workstation safety, inactive sessions may be signed out automatically after a period of inactivity (currently approximately 30 minutes).</li>
        </TermsList>
        <TermsP>
          <strong>Security and Audit Logging:</strong> ImPACTS maintains operational logs to detect abuse,
          support incident response, and meet program security expectations. These may include:
        </TermsP>
        <TermsList>
          <li>Failed sign-in attempts and password-reset requests</li>
          <li>Password update events and mandatory password-upgrade prompts</li>
          <li>MFA enrollment and failed MFA verification attempts</li>
          <li>Idle-timeout sign-outs and related session activity metadata</li>
          <li>Administrative changes to sensitive records (for example, user roles, hospital contacts, and CRM data), where audit logging is enabled</li>
        </TermsList>
        <TermsP>
          Logs may include your account email, user identifier, timestamps, browser or device user-agent
          strings, and limited technical metadata. They are not intended to contain patient data. Logs are
          retained for security and compliance purposes for a reasonable period and are accessible to
          authorized ImPACTS administrators only, subject to applicable law.
        </TermsP>
        <TermsP>
          <strong>Administrative Access Reviews:</strong> Organization administrators and authorized ImPACTS
          staff may view user roles, entitlements, and contact information needed to operate the program.
          Administrators may export user access reports for compliance and entitlement reviews. By using
          the Tool, you acknowledge that your organization&apos;s administrators may manage your access
          accordingly.
        </TermsP>
        <TermsP>
          <strong>Infrastructure Providers (Subprocessors):</strong> ImPACTS uses reputable third-party
          providers to host and operate the Tool, including but not limited to:
        </TermsP>
        <TermsList>
          <li><strong>Supabase</strong> — authentication, database, and serverless functions</li>
          <li><strong>Vercel</strong> — web application hosting and delivery</li>
          <li><strong>Email delivery providers</strong> (for example, Resend) — transactional messages such as invitations and password resets, when configured</li>
        </TermsList>
        <TermsP>
          These providers process account, facility, and operational data only as needed to provide the
          Service. ImPACTS does not authorize subprocessors to use Tool data for their own marketing
          purposes. Hospital or institutional agreements (including Business Associate Agreements, where
          applicable) are handled separately from this user Agreement.
        </TermsP>

        <TermsSection>8. Termination and Suspension</TermsSection>
        <TermsP>
          <strong>Termination Rights:</strong> ImPACTS reserves the right to terminate or suspend
          your access to the Tool at any time, with or without notice, for any reason, including
          but not limited to:
        </TermsP>
        <TermsList>
          <li>Violation of this Agreement or any applicable laws</li>
          <li>Input of real patient data or PHI into the Tool</li>
          <li>Unauthorized use of the Tool or its data</li>
          <li>Breach of security or confidentiality</li>
          <li>Misrepresentation or fraud</li>
          <li>Any other reason at our sole discretion</li>
        </TermsList>
        <TermsP>
          <strong>Effect of Termination:</strong> Upon termination, your right to use the Tool
          ceases immediately. ImPACTS may delete your account and data at any time after
          termination. Sections 2, 3, 5, 6, and 9-12 of this Agreement shall survive termination.
        </TermsP>

        <TermsSection>9. Governing Law, Disputes, and Jurisdiction</TermsSection>
        <TermsP>
          <strong>Governing Law:</strong> This Agreement shall be governed by and construed in
          accordance with the laws of the State of Connecticut, United States, without regard to
          conflict of law principles.
        </TermsP>
        <TermsP>
          <strong>Dispute Resolution:</strong> Any disputes arising from this Agreement shall be
          resolved through binding arbitration administered by the American Arbitration Association
          (AAA) under its Commercial Arbitration Rules. The arbitration shall be conducted in
          New Haven, Connecticut and shall be confidential. Judgment on the arbitration award may be entered
          in any court having jurisdiction.
        </TermsP>
        <TermsP>
          <strong>Class Action Waiver:</strong> You agree that any arbitration or legal proceeding
          shall be limited to the dispute between you and ImPACTS individually. You waive any right
          to participate in class actions, collective actions, or representative proceedings.
        </TermsP>

        <TermsSection>10. Contact Information</TermsSection>
        <TermsP>For questions about this Agreement or the Tool, please contact:</TermsP>
        <Box sx={{ border: '1px solid #000000', p: 2, mb: 2, bgcolor: '#ffffff' }}>
          <TermsP>
            <strong>ImPACTS Collaborative</strong>
            <br />
            Email:{' '}
            <Link href={`mailto:${IMPACTS_CONTACT_EMAIL}`} sx={termsLinkSx}>
              {IMPACTS_CONTACT_EMAIL}
            </Link>
            <br />
            Organization website:{' '}
            <Link href={IMPACTS_ORG_URL} target="_blank" rel="noopener noreferrer" sx={termsLinkSx}>
              {IMPACTS_ORG_URL}
            </Link>
            <br />
            PECC Support Tool:{' '}
            <Link href={PECC_TOOL_ACCOUNT_URL} target="_blank" rel="noopener noreferrer" sx={termsLinkSx}>
              {PECC_TOOL_ACCOUNT_URL}
            </Link>
          </TermsP>
        </Box>

        <TermsSection>11. User Account and Access</TermsSection>
        <TermsP>
          <strong>Account Creation:</strong> You must provide accurate, complete, and current
          information when creating your account. You are responsible for maintaining the
          accuracy of your account information.
        </TermsP>
        <TermsP>
          <strong>Access Control:</strong> You are responsible for all activities that occur
          under your account. You must immediately notify ImPACTS of any unauthorized use of
          your account or any other breach of security.
        </TermsP>
        <TermsP>
          <strong>Account Security:</strong> You must use passwords that meet the Tool&apos;s current
          requirements (including the displayed minimum length), enroll and maintain MFA as required,
          keep credentials and authenticator devices confidential, sign out on shared devices, and not
          share accounts. You are responsible for activity under your account until you report
          unauthorized access. ImPACTS is not liable for loss or damage arising from your failure to
          protect your account, including weak or reused passwords or compromised authenticator access.
        </TermsP>
        <TermsP>
          <strong>Session Use:</strong> You acknowledge that inactive sessions may be terminated
          automatically and that you may be prompted to accept updated terms, enroll or verify MFA,
          or upgrade your password when security requirements change.
        </TermsP>

        <TermsSection>12. Prohibited Uses and Activities</TermsSection>
        <TermsP>You agree NOT to use the Tool for any of the following prohibited purposes:</TermsP>
        <TermsList>
          <li>Inputting any real patient data, PHI, or PII</li>
          <li>Violating any applicable laws or regulations</li>
          <li>Infringing on intellectual property rights</li>
          <li>Transmitting malicious code or viruses</li>
          <li>Attempting to gain unauthorized access to the Tool</li>
          <li>Interfering with the Tool&apos;s operation or security</li>
          <li>Using the Tool for commercial purposes without authorization</li>
          <li>Reverse engineering, decompiling, or disassembling the Tool</li>
          <li>Creating derivative works based on the Tool</li>
          <li>Reselling or redistributing the Tool or its data</li>
        </TermsList>

        <TermsSection>13. Modifications and Updates</TermsSection>
        <TermsP>
          <strong>Agreement Changes:</strong> ImPACTS reserves the right to modify this Agreement
          at any time. The &quot;Last Updated&quot; date and version at the top reflect the most recent
          substantive revision. We will notify users of material changes via email or through the Tool,
          and may require you to review and accept the updated Agreement before continued use. If you do
          not agree to updated terms, you must stop using the Tool and may request account closure.
        </TermsP>
        <TermsP>
          <strong>Tool Updates:</strong> ImPACTS may update, modify, or discontinue the Tool at
          any time without notice. We are not obligated to maintain or support any particular
          version of the Tool.
        </TermsP>

        <TermsSection>14. Severability and Entire Agreement</TermsSection>
        <TermsP>
          <strong>Severability:</strong> If any provision of this Agreement is found to be
          unenforceable or invalid, the remaining provisions shall remain in full force and effect.
        </TermsP>
        <TermsP>
          <strong>Entire Agreement:</strong> This Agreement constitutes the entire agreement
          between you and ImPACTS regarding the Tool and supersedes all prior agreements,
          understandings, or communications.
        </TermsP>
        <TermsP>
          <strong>Waiver:</strong> No waiver of any provision of this Agreement shall be effective
          unless in writing and signed by both parties.
        </TermsP>

        <Divider sx={{ my: 2, borderColor: '#000000' }} />

        <TermsP>
          By using this Tool, you acknowledge that you have read, understood, and agree to be bound
          by this Terms of Service and User Agreement.
        </TermsP>
      </DialogContent>

      {showAcceptButton && !readOnly && (
        <DialogActions
          sx={{
            px: 3,
            py: 1.5,
            borderTop: '1px solid #000000',
            bgcolor: '#ffffff',
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                sx={{ color: '#000000', '&.Mui-checked': { color: '#000000' } }}
              />
            }
            label="I have read and agree to the Terms of Service and User Agreement"
            sx={{
              flexGrow: 1,
              ...termsDoc,
              '& .MuiFormControlLabel-label': { ...termsDoc },
            }}
          />
          <Button
            onClick={handleAccept}
            variant="outlined"
            disabled={!accepted}
            sx={{
              ...termsDoc,
              textTransform: 'none',
              color: '#000000',
              borderColor: '#000000',
              '&:hover': { borderColor: '#000000', bgcolor: '#f5f5f5' },
              '&.Mui-disabled': { color: '#666666', borderColor: '#999999' },
            }}
          >
            Accept Terms
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default TermsOfService;
