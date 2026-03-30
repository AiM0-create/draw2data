import { useState } from 'react';

interface LandingPageProps {
  onLogin: (email: string, name: string) => void;
}

export function LandingPage({ onLogin }: LandingPageProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'hero' | 'form'>('hero');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes('@')) {
      onLogin(email, name);
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
            {/* Logo */}
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
            {step === 'hero' ? (
              <button
                onClick={() => setStep('form')}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-white text-gray-900 hover:bg-white/90 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-black/20"
              >
                <svg className="inline w-4 h-4 mr-2 -mt-0.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@gmail.com"
                    className="w-full px-4 py-3 rounded-2xl text-sm bg-white/10 text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-2xl text-sm bg-white/10 text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!email.includes('@')}
                  className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-white text-gray-900 hover:bg-white/90 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-black/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setStep('hero')}
                  className="w-full py-2 text-xs text-white/50 hover:text-white/70 transition-colors"
                >
                  Back
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
