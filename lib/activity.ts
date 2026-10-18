export const ACTIVITY_ACTIONS = ['Open', 'Login', 'Logout', 'Register', 'Create', 'Update', 'Delete', 'Activate', 'Deactivate', 'Download'] as const;
export type ActivityAction = typeof ACTIVITY_ACTIONS[number];
export const IT_DEPARTMENT_ID = '8113ab6f-d5cc-4c94-bbf6-e08047931fab';

export function sanitizeActivitySearch(value: string): string {
  return value.replace(/[,()%*]/g, '').replace(/[^\p{L}\p{N}\s@._:\-]/gu, '').trim().slice(0, 100);
}

// Defense in depth; callers must never pass passwords, tokens, or form payloads.
export function sanitizeActivityDescription(value: string): string {
  return value
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]')
    .replace(/\b(password|token|access_token|refresh_token|secret|api[_-]?key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)/gi, '$1=[REDACTED]')
    .trim().slice(0, 500);
}
