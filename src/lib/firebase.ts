// Simple built-in auth — no external service required.
// Admin email is hardcoded. Auth state persists in localStorage.

const ADMIN_EMAIL = 'abhishekrawat426@gmail.com';
const STORAGE_KEY = 'draw2data_auth';

export interface SimpleUser {
  email: string;
  displayName: string;
  photoURL: string | null;
}

export function isAdmin(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL;
}

export function getSavedUser(): SimpleUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SimpleUser) : null;
  } catch {
    return null;
  }
}

export function saveUser(user: SimpleUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(STORAGE_KEY);
}
