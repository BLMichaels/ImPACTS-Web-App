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
}

/**
 * Create an invitation and send email via Supabase Edge Function (Resend).
 * If the Edge Function is not deployed or fails, invitation is still created; emailSent will be false.
 */
export async function createAndSendInvitation(params: CreateInvitationParams): Promise<CreateInvitationResult> {
  const { email, role, invitedBy, hospitalId, mentorId, managerId, managerIdForPECC, cohortIds, programIds, customMessage } = params;
  
  // Generate unique code
  let code: string;
  let attempts = 0;
  do {
    code = generateInvitationCode();
    attempts++;
    if (attempts > 10) {
      throw new Error('Failed to generate unique invitation code');
    }
    // Check if code already exists
    const { data: existing } = await supabase
      .from('invitations')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (!existing) break;
  } while (true);
  
  // Create invitation record
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
  
  // For PECC with direct manager (bypassing mentor), store manager_id
  // For Mentor, store manager_id
  // For PECC with mentor, store mentor_id
  const finalManagerId = role === 'pecc' && managerIdForPECC ? managerIdForPECC : (role === 'mentor' ? managerId : null);
  const finalMentorId = role === 'pecc' && mentorId ? mentorId : null;
  
  const insertPayload: Record<string, unknown> = {
      code,
      email: email.trim().toLowerCase(),
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
  
  if (insertError) {
    throw new Error(`Failed to create invitation: ${insertError.message}`);
  }
  
  const invitationUrl = `${window.location.origin}/invite/${code}`;
  let emailSent = false;

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
    if (!emailError && emailData?.ok !== false) {
      emailSent = true;
    } else {
      console.warn('Invitation email not sent:', emailError?.message ?? emailData?.error ?? 'unknown');
    }
  } catch (err) {
    console.warn('Invitation email error:', err);
  }

  return { code, invitationId: invitation.id, emailSent };
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
  const { error } = await supabase
    .from('invitations')
    .update({
      status: 'accepted' as InvitationStatus,
      accepted_at: new Date().toISOString(),
      accepted_by: userId
    })
    .eq('code', code);
  
  if (error) throw error;
}
