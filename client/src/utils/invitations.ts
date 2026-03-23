import { supabase } from '../supabase';
import { UserRole, InvitationStatus } from '../types/database';

export interface CreateInvitationParams {
  email: string;
  role: UserRole;
  invitedBy: string;
  hospitalId?: string | null;
  mentorId?: string | null;
  managerId?: string | null;
  managerIdForPECC?: string | null;  // For direct Manager-PECC assignment
  cohortIds?: string[];   // Pre-designate cohorts for PECC (added on accept)
  programIds?: string[];  // Pre-designate programs for invitee (added on accept)
  customMessage?: string | null;  // Optional message from inviter
}

/**
 * Generate a unique invitation code
 */
function generateInvitationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface CreateInvitationResult {
  code: string;
  invitationId: string;
  /** True if the invitation email was sent successfully; false if not (link must be shared manually). */
  emailSent: boolean;
  /** Optional error detail when email delivery fails. */
  emailError?: string;
}

/**
 * Create an invitation and send email via Supabase Edge Function (Resend).
 * If the Edge Function is not deployed or fails, invitation is still created; emailSent will be false.
 */
export async function createAndSendInvitation(params: CreateInvitationParams): Promise<CreateInvitationResult> {
  const { email, role, invitedBy, hospitalId, mentorId, managerId, managerIdForPECC, cohortIds, programIds, customMessage } = params;
  // Reuse existing pending invitation when possible to avoid duplicates.
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
  
  // For PECC with direct manager (bypassing mentor), store manager_id
  // For Mentor, store manager_id
  // For PECC with mentor, store mentor_id
  const finalManagerId = role === 'pecc' && managerIdForPECC ? managerIdForPECC : (role === 'mentor' ? managerId : null);
  const finalMentorId = role === 'pecc' && mentorId ? mentorId : null;
  
  const emailNorm = email.trim().toLowerCase();
  let invitationId = '';
  let code = '';
  const { data: existingPending } = await supabase
    .from('invitations')
    .select('id, code, cohort_ids, program_ids')
    .eq('email', emailNorm)
    .eq('role', role)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPending?.id && existingPending.code) {
    invitationId = existingPending.id;
    code = existingPending.code;
    const mergedCohorts = [...new Set([...(existingPending.cohort_ids || []), ...(cohortIds || [])])];
    const mergedPrograms = [...new Set([...(existingPending.program_ids || []), ...(programIds || [])])];
    const updatePayload: Record<string, unknown> = {
      hospital_id: hospitalId || null,
      mentor_id: finalMentorId,
      manager_id: finalManagerId,
      invited_by: invitedBy,
      expires_at: expiresAt.toISOString(),
    };
    if (mergedCohorts.length > 0) updatePayload.cohort_ids = mergedCohorts;
    if (mergedPrograms.length > 0) updatePayload.program_ids = mergedPrograms;
    if (customMessage != null && customMessage.trim() !== '') updatePayload.custom_message = customMessage.trim();
    const { error: updateErr } = await supabase
      .from('invitations')
      .update(updatePayload)
      .eq('id', invitationId);
    if (updateErr) {
      throw new Error(`Failed to update existing invitation: ${updateErr.message}`);
    }
  } else {
    let insertAttempts = 0;
    while (!invitationId) {
      code = generateInvitationCode();
      insertAttempts++;
      if (insertAttempts > 10) {
        throw new Error('Failed to create invitation after multiple retries');
      }
      const insertPayload: Record<string, unknown> = {
        code,
        email: emailNorm,
        role,
        status: 'pending' as InvitationStatus,
        hospital_id: hospitalId || null,
        mentor_id: finalMentorId,
        manager_id: finalManagerId,
        invited_by: invitedBy,
        expires_at: expiresAt.toISOString()
      };
      if (cohortIds?.length) insertPayload.cohort_ids = cohortIds;
      if (programIds?.length) insertPayload.program_ids = programIds;
      if (customMessage != null && customMessage.trim() !== '') insertPayload.custom_message = customMessage.trim();

      const { data: invitation, error: insertError } = await supabase
        .from('invitations')
        .insert(insertPayload)
        .select('id')
        .single();
      if (!insertError && invitation?.id) {
        invitationId = invitation.id;
        break;
      }
      const msg = `${insertError?.message ?? ''}`.toLowerCase();
      const maybeDuplicateCode =
        msg.includes('duplicate') || msg.includes('unique') || msg.includes('code');
      if (!maybeDuplicateCode) {
        throw new Error(`Failed to create invitation: ${insertError?.message ?? 'Unknown error'}`);
      }
    }
  }
  
  const invitationUrl = `${window.location.origin}/invite/${code}`;
  let emailSent = false;
  let emailErrorMessage: string | undefined;

  try {
    const { data: emailData, error: emailError } = await supabase.functions.invoke('send-invitation-email', {
      body: {
        email: email.trim(),
        code,
        role,
        invitationUrl,
        expiresAt: expiresAt.toISOString(),
        customMessage: customMessage != null && customMessage.trim() !== '' ? customMessage.trim() : null
      }
    });
    if (!emailError && emailData?.ok === true) {
      emailSent = true;
    } else {
      emailErrorMessage = emailError?.message ?? emailData?.error ?? 'Invitation email function returned an error';
      console.warn('Invitation email not sent:', emailErrorMessage);
    }
  } catch (err) {
    emailErrorMessage = err instanceof Error ? err.message : 'Unknown invitation email error';
    console.warn('Invitation email error:', err);
  }

  return { code, invitationId, emailSent, emailError: emailErrorMessage };
}

/**
 * Get invitation by code
 */
export async function getInvitationByCode(code: string) {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('code', code)
    .eq('status', 'pending')
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Mark invitation as accepted
 */
export async function acceptInvitation(code: string, userId: string) {
  const { data, error } = await supabase
    .from('invitations')
    .update({
      status: 'accepted' as InvitationStatus,
      accepted_at: new Date().toISOString(),
      accepted_by: userId
    })
    .eq('code', code)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  
  if (error) throw error;
  if (!data?.id) throw new Error('Invitation was already used or could not be finalized.');
}
