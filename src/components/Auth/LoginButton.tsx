import { useState } from 'react';
import type { SimpleUser } from '../../lib/firebase';

interface LoginButtonProps {
  user: SimpleUser | null;
  isAdmin: boolean;
  onLogin: (email: string, name: string) => void;
  onLogout: () => void;
  onAdminClick?: () => void;
}

export function LoginButton({ user, isAdmin, onLogin, onLogout, onAdminClick }: LoginButtonProps) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  if (user) {
    return (
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {user.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-700 truncate">{user.displayName}</p>
          {isAdmin && onAdminClick && (
            <button
              onClick={onAdminClick}
              className="text-[10px] text-blue-600 hover:text-blue-800"
            >
              Admin Dashboard
            </button>
          )}
        </div>
        <button
          onClick={onLogout}
          className="text-xs text-gray-400 hover:text-red-500 flex-shrink-0"
        >
          Logout
        </button>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          autoFocus
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              if (email.includes('@')) {
                onLogin(email, name);
                setShowForm(false);
                setEmail('');
                setName('');
              }
            }}
            disabled={!email.includes('@')}
            className="flex-1 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
          >
            Sign In
          </button>
          <button
            onClick={() => setShowForm(false)}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowForm(true)}
      className="mt-2 pt-2 border-t border-gray-100 w-full flex items-center gap-2 text-xs text-gray-500 hover:text-blue-600 transition-colors"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
      </svg>
      Sign in
    </button>
  );
}
