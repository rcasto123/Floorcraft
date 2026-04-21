import { supabase } from '../supabase'
import { slugFromName } from '../slug'
import type { Team, TeamMember, Invite } from '../../types/team'

export async function createTeam(name: string, createdBy: string): Promise<Team> {
  const slug = slugFromName(name)
  const { data, error } = await supabase
    .from('teams')
    .insert({ name, slug, created_by: createdBy })
    .select('id, slug, name, created_by, created_at')
    .single()
  if (error) throw error
  return data as Team
}

export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, user_id, role, joined_at, profiles!inner(email,name)')
    .eq('team_id', teamId)
  if (error) throw error
  return (data ?? []).map((row: {
    team_id: string
    user_id: string
    role: 'admin' | 'member'
    joined_at: string
    profiles: { email: string; name: string | null }
  }) => ({
    team_id: row.team_id,
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at,
    email: row.profiles.email,
    name: row.profiles.name ?? undefined,
  })) as TeamMember[]
}

export async function listInvites(teamId: string): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('team_id', teamId)
    .is('accepted_at', null)
  if (error) throw error
  return data as Invite[]
}

export async function createInvite(teamId: string, email: string, invitedBy: string): Promise<Invite> {
  const { data, error } = await supabase
    .from('invites')
    .insert({ team_id: teamId, email, invited_by: invitedBy })
    .select('*')
    .single()
  if (error) throw error
  return data as Invite
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function updateMemberRole(
  teamId: string,
  userId: string,
  role: 'admin' | 'member',
): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .update({ role })
    .eq('team_id', teamId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function renameTeam(teamId: string, name: string): Promise<void> {
  const { error } = await supabase.from('teams').update({ name }).eq('id', teamId)
  if (error) throw error
}

export async function deleteTeam(teamId: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) throw error
}
