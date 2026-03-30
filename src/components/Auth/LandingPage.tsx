import { useState, useEffect, useRef } from 'react';

interface LandingPageProps {
  onLogin: (email: string, name: string, photoURL?: string) => void;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

/** Decode a JWT payload (no verification — Google GSI already verified it). */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

export function LandingPage({ onLogin }: LandingPageProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [showFallback, setShowFallback] = useState(!GOOGLE_CLIENT_ID);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Initialize Google Sign-In
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGoogle = () => {
      const g = (window as unknown as { google?: { accounts: { id: {
        initialize: (cfg: unknown) => void;
        renderButton: (el: HTMLElement, cfg: unknown) => void;
      } } } }).google;

      if (!g || !googleBtnRef.current) return;

      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => {
          const payload = decodeJwtPayload(response.credential);
          onLogin(
            payload.email as string,
            payload.name as string,
            (payload.picture as string) || undefined,
          );
        },
      });

      g.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        width: 360,
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
      });
    };

    // GSI script may not be loaded yet
    if ((window as unknown as { google?: unknown }).google) {
      initGoogle();
    } else {
      const timer = setInterval(() => {
        if ((window as unknown as { google?: unknown }).google) {
          clearInterval(timer);
          initGoogle();
        }
      }, 100);
      // Give up after 5s and show fallback
      const timeout = setTimeout(() => { clearInterval(timer); setShowFallback(true); }, 5000);
      return () => { clearInterval(timer); clearTimeout(timeout); };
    }
  }, [onLogin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes('@')) {
      onLogin(email, name || email.split('@')[0]);
    }
  };

  return (
    <div className="h-full w-full relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 animate-gradient" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Floating orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-400/10 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative z-10 h-full flex items-center justify-center p-6">
        <div className="glass-dark rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden">
          {/* Top section */}
          <div className="px-8 pt-10 pb-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm mb-6">
              <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
                <path d="M16 3L28 9V23L16 29L4 23V9L16 3Z" stroke="white" strokeWidth="1.5" fill="none" />
                <circle cx="16" cy="16" r="4" fill="white" opacity="0.8" />
                <path d="M16 3L16 12M16 20L16 29M4 9L12 13M20 19L28 23M28 9L20 13M12 19L4 23" stroke="white" strokeWidth="0.7" opacity="0.3" />
              </svg>
            </div>

            <h1 className="text-3xl font-bold text-white tracking-tight">draw2data</h1>
            <p className="text-white/60 text-sm mt-2 leading-relaxed">
              Extract geospatial data from open datasets.<br />
              Draw, extract, download.
            </p>
          </div>

          {/* Feature pills */}
          <div className="px-8 pb-6 flex flex-wrap justify-center gap-2">
            {['Buildings', 'Roads', 'POIs', 'Land Use', 'Water', 'Addresses'].map((f) => (
              <span key={f} className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/8 text-white/70 border border-white/10">
                {f}
              </span>
            ))}
          </div>

          {/* Login section */}
          <div className="px-8 pb-10">
            {/* Google Sign-In button (real OAuth) */}
            {GOOGLE_CLIENT_ID && (
              <div className="flex justify-center mb-4">
                <div ref={googleBtnRef} />
              </div>
            )}

            {/* Fallback email form or separator */}
            {showFallback && GOOGLE_CLIENT_ID && (
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] text-white/30 uppercase">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            )}

            {(!GOOGLE_CLIENT_ID || showFallback) && (
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@gmail.com"
                  className="w-full px-4 py-3 rounded-2xl text-sm bg-white/10 text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all"
                  autoFocus={!GOOGLE_CLIENT_ID}
                  required
                />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-3 rounded-2xl text-sm bg-white/10 text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all"
                />
                <button
                  type="submit"
                  disabled={!email.includes('@')}
                  className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-white text-gray-900 hover:bg-white/90 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-black/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  Sign In
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-[10px] text-white/30">
              Open source geospatial extraction portal
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
