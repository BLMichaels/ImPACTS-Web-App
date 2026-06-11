/**
 * When duplicate public.users rows share an email, pick the account that should
 * drive CRM links and supervisor assignments.
 */
export type EmailLinkableUser = {
  id: string;
  email?: string | null;
  last_login?: string | null;
  created_at?: string | null;
  is_active?: boolean | null;
};

export function pickCanonicalUserByEmail<T extends EmailLinkableUser>(users: T[]): T | null {
  if (users.length === 0) return null;
  if (users.length === 1) return users[0];

  const active = users.filter((u) => u.is_active !== false);
  const pool = active.length > 0 ? active : users;

  return [...pool].sort((a, b) => {
    const aLogin = a.last_login ? new Date(a.last_login).getTime() : 0;
    const bLogin = b.last_login ? new Date(b.last_login).getTime() : 0;
    if (aLogin !== bLogin) return bLogin - aLogin;

    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aCreated - bCreated;
  })[0];
}

export function buildCanonicalEmailToUserMap<T extends EmailLinkableUser>(users: T[]): Map<string, T> {
  const grouped = new Map<string, T[]>();
  users.forEach((u) => {
    const key = String(u.email || '').trim().toLowerCase();
    if (!key) return;
    const list = grouped.get(key) ?? [];
    list.push(u);
    grouped.set(key, list);
  });

  const result = new Map<string, T>();
  grouped.forEach((list, key) => {
    const picked = pickCanonicalUserByEmail(list);
    if (picked) result.set(key, picked);
  });
  return result;
}
