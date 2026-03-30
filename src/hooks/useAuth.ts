import { useState, useCallback } from 'react';
import { getSavedUser, saveUser, clearUser, isAdmin, type SimpleUser } from '../lib/firebase';

export interface AuthState {
  user: SimpleUser | null;
  isAdmin: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<SimpleUser | null>(() => getSavedUser());

  const login = useCallback((email: string, name: string) => {
    const u: SimpleUser = { email, displayName: name || email.split('@')[0], photoURL: null };
    saveUser(u);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    clearUser();
    setUser(null);
  }, []);

  return {
    user,
    isAdmin: isAdmin(user?.email),
    login,
    logout,
  };
}
