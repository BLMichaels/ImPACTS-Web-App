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
  Paper,
  Divider,
  Link
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

/** Update this date when the Terms of Service and User Agreement content is substantively revised. */
const TERMS_LAST_UPDATED = 'February 14, 2026';

interface TermsOfServiceProps {
  open: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
  readOnly?: boolean;
}

const TermsOfService: React.FC<TermsOfServiceProps> = ({
  open,
  onClose,
  onAccept,
  showAcceptButton = false,
  readOnly = false
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
        sx: { maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" component="h2">
            Terms of Service and User Agreement
          </Typography>
          <Button
            onClick={onClose}
            startIcon={<CloseIcon />}
            variant="text"
            size="small"
          >
            Close
          </Button>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        <Paper elevation={1} sx={{ p: 3, mb: 2 }}>
          <Typography variant="h6" gutterBottom color="primary">
            ImPACTS Pediatric Readiness Assessment Tool
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            <strong>Last Updated:</strong> {TERMS_LAST_UPDATED}
          </Typography>
        </Paper>

        <Typography variant="h6" gutterBottom>
          1. Purpose and Scope
        </Typography>
        <Typography variant="body1" paragraph>
          This Terms of Service and User Agreement ("Agreement") is a legally binding contract 
          between you ("User," "you," or "your") and the ImPACTS Collaborative ("ImPACTS," "we," 
          "us," or "our") governing your use of the ImPACTS (Improving Pediatric Acute Care Through 
          Simulation) Pediatric Readiness Assessment Tool ("Tool" or "Service"). This Tool is 
          designed to assist healthcare facilities in assessing and improving their pediatric 
          readiness capabilities through simulation-based evaluation and gap analysis. By accessing, 
          using, or registering for this Tool, you acknowledge that you have read, understood, and 
          agree to be bound by the terms and conditions of this Agreement.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>IMPORTANT:</strong> This Agreement contains important legal provisions, including 
          limitations on our liability, your indemnification obligations, and dispute resolution 
          procedures. Please read this Agreement carefully before using the Tool.
        </Typography>

        <Typography variant="h6" gutterBottom>
          2. Critical Data Usage Restrictions and HIPAA Compliance
        </Typography>
        <Box sx={{ bgcolor: 'error.light', p: 3, borderRadius: 1, mb: 3, border: '2px solid', borderColor: 'error.main' }}>
          <Typography variant="h5" color="error.contrastText" gutterBottom align="center">
            ⚠️ ABSOLUTELY NO REAL PATIENT DATA ALLOWED ⚠️
          </Typography>
          <Typography variant="h6" color="error.contrastText" gutterBottom align="center">
            ZERO TOLERANCE POLICY FOR PATIENT DATA
          </Typography>
          <Typography variant="body1" color="error.contrastText" paragraph>
            <strong>THIS TOOL IS STRICTLY PROHIBITED FROM CONTAINING ANY REAL PATIENT DATA, 
            ESPECIALLY IDENTIFIABLE HUMAN SUBJECT DATA.</strong> This is a fundamental requirement 
            and violation will result in immediate account termination and potential legal action.
          </Typography>
          <Typography variant="body1" color="error.contrastText" paragraph>
            You expressly agree, warrant, and covenant that you will NEVER input, upload, store, 
            transmit, or otherwise introduce any of the following into this Tool:
          </Typography>
          <Typography component="ul" sx={{ pl: 2, mb: 2 }}>
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
          </Typography>
          <Typography variant="body1" color="error.contrastText" paragraph>
            <strong>VIOLATION CONSEQUENCES:</strong> Any violation of this section will result in 
            immediate termination of your account, potential legal action, and reporting to 
            appropriate regulatory authorities. You will be held fully liable for any damages, 
            fines, or penalties resulting from such violations.
          </Typography>
        </Box>

        <Typography variant="h6" gutterBottom>
          3. Data Collection, Research Use, and Intellectual Property
        </Typography>
        <Typography variant="body1" paragraph>
          By using this Tool, you acknowledge, agree, and consent to the following:
        </Typography>
        <Typography component="ul" sx={{ pl: 2, mb: 2 }}>
          <li><strong>Research Participation:</strong> All data entered will be utilized for research purposes by the ImPACTS Collaborative and its affiliated researchers, institutions, and partners</li>
          <li><strong>Data Deidentification:</strong> All data will be deidentified, anonymized, and aggregated before any research analysis, publication, or presentation</li>
          <li><strong>National Contribution:</strong> Your facility's participation contributes to national pediatric readiness improvement efforts and evidence-based healthcare research</li>
          <li><strong>Research Publications:</strong> Aggregated, deidentified data may be used in research publications, presentations, grant applications, and other scholarly activities</li>
          <li><strong>Facility Anonymity:</strong> No individual facility will be identified in research outputs without your explicit written consent</li>
          <li><strong>Data Sharing:</strong> Deidentified data may be shared with other researchers, institutions, or organizations for legitimate research purposes</li>
          <li><strong>Long-term Storage:</strong> Data may be stored indefinitely for research purposes, subject to applicable data retention laws</li>
          <li><strong>Commercial Use:</strong> ImPACTS reserves the right to use aggregated, deidentified data for commercial purposes, including but not limited to product development and consulting services</li>
          <li><strong>Intellectual Property:</strong> All data, insights, and research findings derived from this Tool become the intellectual property of ImPACTS, subject to applicable laws and regulations</li>
        </Typography>

        <Typography variant="h6" gutterBottom>
          4. Opt-Out Rights and Data Withdrawal
        </Typography>
        <Typography variant="body1" paragraph>
          You have the right to opt out of data collection and research use at any time. However, 
          please note the following important limitations and procedures:
        </Typography>
        <Typography component="ul" sx={{ pl: 2, mb: 2 }}>
          <li><strong>Withdrawal Process:</strong> To opt out, you must send a written request to 
            <Link href="mailto:impactscollaborative@gmail.com" target="_blank">
              impactscollaborative@gmail.com
            </Link> with your facility name, contact information, and explicit request for data removal</li>
          <li><strong>Data Removal Timeline:</strong> We will remove your identifiable data within 30 days of receiving your verified request</li>
          <li><strong>Research Data Limitation:</strong> Once data has been included in published research, presentations, or other scholarly works, it cannot be withdrawn from those specific publications</li>
          <li><strong>Aggregated Data:</strong> Deidentified, aggregated data may be retained for ongoing research purposes even after your withdrawal</li>
          <li><strong>Verification Required:</strong> We may require verification of your identity and authorization to make such requests</li>
          <li><strong>Partial Withdrawal:</strong> You may request withdrawal from future data collection while allowing previously collected data to remain in research datasets</li>
        </Typography>

        <Typography variant="h6" gutterBottom>
          5. Indemnification, Liability, and Risk Allocation
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>INDEMNIFICATION OBLIGATION:</strong> You agree to indemnify, defend, and hold 
          harmless ImPACTS, its officers, directors, employees, agents, affiliates, successors, 
          and assigns from and against any and all claims, demands, actions, suits, proceedings, 
          damages, losses, costs, expenses (including reasonable attorneys' fees and court costs), 
          judgments, settlements, and penalties arising out of or relating to:
        </Typography>
        <Typography component="ul" sx={{ pl: 2, mb: 2 }}>
          <li>Your use of the Tool in violation of this Agreement or applicable laws</li>
          <li>Your input of any real patient data, PHI, or PII into the Tool</li>
          <li>Any breach of patient confidentiality, privacy laws, or medical ethics</li>
          <li>Any unauthorized use of the Tool, its data, or its intellectual property</li>
          <li>Any claims by third parties (including patients, regulatory authorities, or other users) related to your use of the Tool</li>
          <li>Any violation of HIPAA, state privacy laws, or other applicable regulations</li>
          <li>Any misuse, misrepresentation, or inappropriate reliance on Tool outputs</li>
          <li>Any data breaches or security incidents caused by your actions or omissions</li>
          <li>Any decisions made based on Tool outputs that result in harm or liability</li>
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>LIMITATION OF LIABILITY:</strong> TO THE MAXIMUM EXTENT PERMITTED BY LAW, 
          IMPACTS' TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING OUT OF OR RELATING TO THIS 
          AGREEMENT OR THE TOOL SHALL NOT EXCEED THE AMOUNT YOU PAID TO USE THE TOOL (IF ANY) 
          IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM. IN NO EVENT SHALL IMPACTS BE LIABLE 
          FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING 
          BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>DISCLAIMER OF WARRANTIES:</strong> THE TOOL IS PROVIDED "AS IS" AND "AS AVAILABLE" 
          WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. 
          IMPACTS DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO WARRANTIES OF 
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY. 
          IMPACTS DOES NOT WARRANT THAT THE TOOL WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
        </Typography>

        <Typography variant="h6" gutterBottom>
          6. Tool Limitations, Disclaimers, and Professional Responsibility
        </Typography>
        <Typography variant="body1" paragraph>
          You acknowledge, understand, and agree that:
        </Typography>
        <Typography component="ul" sx={{ pl: 2, mb: 2 }}>
          <li><strong>Educational Purpose Only:</strong> This Tool is intended for pediatric readiness improvement, educational purposes, and research only. It is NOT a substitute for professional medical judgment, clinical decision-making, or regulatory compliance</li>
          <li><strong>No Government Endorsement:</strong> The Tool is aligned with national pediatric readiness projects but is NOT endorsed by, affiliated with, or approved by any government agency, regulatory body, professional organization, or official entity</li>
          <li><strong>Clinical Decision Limitation:</strong> Results from this Tool should NEVER be used as the sole basis for clinical decisions, patient care protocols, policy changes, or regulatory compliance decisions</li>
          <li><strong>Professional Responsibility:</strong> You are solely responsible for ensuring compliance with all applicable laws, regulations, professional standards, and ethical guidelines in your jurisdiction</li>
          <li><strong>No Liability for Decisions:</strong> ImPACTS is not responsible for any decisions, actions, or consequences resulting from your use of Tool outputs</li>
          <li><strong>Accuracy Disclaimer:</strong> ImPACTS does not guarantee the accuracy, completeness, or reliability of any Tool outputs or recommendations</li>
          <li><strong>Regulatory Compliance:</strong> You must independently verify that your use of this Tool complies with all applicable healthcare regulations, including but not limited to HIPAA, state privacy laws, and professional licensing requirements</li>
          <li><strong>Professional Standards:</strong> You must maintain appropriate professional standards and ethical practices when using this Tool</li>
        </Typography>

        <Typography variant="h6" gutterBottom>
          7. Data Security, Privacy, and Compliance
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Security Measures:</strong> While ImPACTS implements reasonable administrative, 
          technical, and physical security measures to protect data, you acknowledge and agree that:
        </Typography>
        <Typography component="ul" sx={{ pl: 2, mb: 2 }}>
          <li><strong>No Absolute Security:</strong> No system is completely secure from unauthorized access, data breaches, or cyber attacks</li>
          <li><strong>Credential Responsibility:</strong> You are solely responsible for maintaining the security and confidentiality of your login credentials, passwords, and access codes</li>
          <li><strong>Breach Notification:</strong> You will immediately notify ImPACTS of any suspected security breaches, unauthorized access, or data incidents</li>
          <li><strong>Incident Response:</strong> ImPACTS will notify users of any significant security incidents affecting their data within 72 hours of discovery</li>
          <li><strong>Data Encryption:</strong> Data is encrypted in transit and at rest, but you acknowledge that encryption is not foolproof</li>
          <li><strong>Third-Party Services:</strong> ImPACTS may use third-party services for data processing, and you consent to such use</li>
          <li><strong>International Transfers:</strong> Data may be transferred to and processed in countries other than your own</li>
          <li><strong>Regulatory Compliance:</strong> You must ensure your use complies with all applicable data protection laws, including GDPR, CCPA, and state privacy laws</li>
        </Typography>

        <Typography variant="h6" gutterBottom>
          8. Termination and Suspension
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Termination Rights:</strong> ImPACTS reserves the right to terminate or suspend 
          your access to the Tool at any time, with or without notice, for any reason, including 
          but not limited to:
        </Typography>
        <Typography component="ul" sx={{ pl: 2, mb: 2 }}>
          <li>Violation of this Agreement or any applicable laws</li>
          <li>Input of real patient data or PHI into the Tool</li>
          <li>Unauthorized use of the Tool or its data</li>
          <li>Breach of security or confidentiality</li>
          <li>Misrepresentation or fraud</li>
          <li>Any other reason at our sole discretion</li>
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Effect of Termination:</strong> Upon termination, your right to use the Tool 
          ceases immediately. ImPACTS may delete your account and data at any time after 
          termination. Sections 2, 3, 5, 6, and 9-12 of this Agreement shall survive termination.
        </Typography>

        <Typography variant="h6" gutterBottom>
          9. Governing Law, Disputes, and Jurisdiction
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Governing Law:</strong> This Agreement shall be governed by and construed in 
          accordance with the laws of the State of Connecticut, United States, without regard to 
          conflict of law principles.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Dispute Resolution:</strong> Any disputes arising from this Agreement shall be 
          resolved through binding arbitration administered by the American Arbitration Association 
          (AAA) under its Commercial Arbitration Rules. The arbitration shall be conducted in 
          New Haven, Connecticut and shall be confidential. Judgment on the arbitration award may be entered 
          in any court having jurisdiction.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Class Action Waiver:</strong> You agree that any arbitration or legal proceeding 
          shall be limited to the dispute between you and ImPACTS individually. You waive any right 
          to participate in class actions, collective actions, or representative proceedings.
        </Typography>

        <Typography variant="h6" gutterBottom>
          10. Contact Information
        </Typography>
        <Typography variant="body1" paragraph>
          For questions about this Agreement or the Tool, please contact:
        </Typography>
        <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, mb: 3 }}>
          <Typography variant="body1">
            <strong>ImPACTS Collaborative</strong><br />
            Email: <Link href="mailto:impactscollaborative@gmail.com" target="_blank">
              impactscollaborative@gmail.com
            </Link><br />
            Website: <Link href="https://impacts-tracker.web.app" target="_blank">
              https://impacts-tracker.web.app
            </Link>
          </Typography>
        </Box>

        <Typography variant="h6" gutterBottom>
          11. User Account and Access
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Account Creation:</strong> You must provide accurate, complete, and current 
          information when creating your account. You are responsible for maintaining the 
          accuracy of your account information.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Access Control:</strong> You are responsible for all activities that occur 
          under your account. You must immediately notify ImPACTS of any unauthorized use of 
          your account or any other breach of security.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Account Security:</strong> You must use strong passwords and keep your login 
          credentials confidential. ImPACTS is not liable for any loss or damage arising from 
          your failure to protect your account.
        </Typography>

        <Typography variant="h6" gutterBottom>
          12. Prohibited Uses and Activities
        </Typography>
        <Typography variant="body1" paragraph>
          You agree NOT to use the Tool for any of the following prohibited purposes:
        </Typography>
        <Typography component="ul" sx={{ pl: 2, mb: 2 }}>
          <li>Inputting any real patient data, PHI, or PII</li>
          <li>Violating any applicable laws or regulations</li>
          <li>Infringing on intellectual property rights</li>
          <li>Transmitting malicious code or viruses</li>
          <li>Attempting to gain unauthorized access to the Tool</li>
          <li>Interfering with the Tool's operation or security</li>
          <li>Using the Tool for commercial purposes without authorization</li>
          <li>Reverse engineering, decompiling, or disassembling the Tool</li>
          <li>Creating derivative works based on the Tool</li>
          <li>Reselling or redistributing the Tool or its data</li>
        </Typography>

        <Typography variant="h6" gutterBottom>
          13. Modifications and Updates
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Agreement Changes:</strong> ImPACTS reserves the right to modify this Agreement 
          at any time. The "Last Updated" date at the top of this document reflects the date of 
          the most recent substantive revision. We will notify users of material changes via email 
          or through the Tool. Your continued use of the Tool after such modifications constitutes 
          acceptance of the updated Agreement.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Tool Updates:</strong> ImPACTS may update, modify, or discontinue the Tool at 
          any time without notice. We are not obligated to maintain or support any particular 
          version of the Tool.
        </Typography>

        <Typography variant="h6" gutterBottom>
          14. Severability and Entire Agreement
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Severability:</strong> If any provision of this Agreement is found to be 
          unenforceable or invalid, the remaining provisions shall remain in full force and effect.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Entire Agreement:</strong> This Agreement constitutes the entire agreement 
          between you and ImPACTS regarding the Tool and supersedes all prior agreements, 
          understandings, or communications.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Waiver:</strong> No waiver of any provision of this Agreement shall be effective 
          unless in writing and signed by both parties.
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Typography variant="body2" color="text.secondary" align="center">
          By using this Tool, you acknowledge that you have read, understood, and agree to be bound 
          by this Terms of Service and User Agreement.
        </Typography>
      </DialogContent>

      {showAcceptButton && !readOnly && (
        <DialogActions sx={{ p: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                color="primary"
              />
            }
            label="I have read and agree to the Terms of Service and User Agreement"
            sx={{ flexGrow: 1 }}
          />
          <Button
            onClick={handleAccept}
            variant="contained"
            color="primary"
            disabled={!accepted}
            size="large"
          >
            Accept Terms
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default TermsOfService;
