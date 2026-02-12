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

/**
 * Create an invitation and send email
 */
export async function createAndSendInvitation(params: CreateInvitationParams): Promise<{ code: string; invitationId: string }> {
  const { email, role, invitedBy, hospitalId, mentorId, managerId, managerIdForPECC, cohortIds, customMessage } = params;
  
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
  if (customMessage != null && customMessage.trim() !== '') insertPayload.custom_message = customMessage.trim();

  const { data: invitation, error: insertError } = await supabase
    .from('invitations')
    .insert(insertPayload)
    .select('id')
    .single();
  
  if (insertError) {
    throw new Error(`Failed to create invitation: ${insertError.message}`);
  }
  
  // Send invitation email via Supabase Edge Function or email service
  // For now, we'll use Supabase's built-in email (if configured) or a custom function
  try {
    // Get invitation URL
    const invitationUrl = `${window.location.origin}/invite/${code}`;
    
    // Call a Supabase Edge Function to send email (if available)
    // Or use a third-party email service
    // For now, we'll create a function that can be called
    const { error: emailError } = await supabase.functions.invoke('send-invitation-email', {
      body: {
        email: email.trim(),
        code,
        role,
        invitationUrl,
        expiresAt: expiresAt.toISOString()
      }
    });
    
    // If Edge Function doesn't exist, that's okay - we'll handle it manually
    if (emailError && !emailError.message.includes('Function not found')) {
      console.warn('Failed to send invitation email:', emailError);
      // Still return success - invitation was created, email can be sent manually
    }
  } catch (err) {
    console.warn('Email sending not configured:', err);
    // Invitation was created successfully, email can be sent manually
  }
  
  return { code, invitationId: invitation.id };
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
