"use client";

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import { Lock, User, ShieldCheck, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginForm() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || 'Invalid credentials. Please try again.');
      return;
    }
    window.location.reload();
  };

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center bg-transparent px-4 py-12 text-slate-100 font-sans">
      <div className="card relative w-full max-w-md rounded-[20px] p-8">
        {/* Top Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] p-2 shadow-inner backdrop-blur-md">
            <Image
              src="/sgb.png"
              alt="SGB Logo"
              width={48}
              height={48}
              className="object-contain"
              priority
            />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/25 bg-indigo-500/12 px-2.5 py-0.5 text-[11px] font-medium tracking-[0.08em] text-indigo-300 uppercase">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" strokeWidth={1.5} />
            Internal Management Console
          </div>
          <h1 className="mt-3 text-xl font-medium tracking-tight text-white/92">SGB Enterprises</h1>
          <p className="mt-1 text-xs font-normal text-white/55">Logistics dispatch, fleet invoicing & clearance terminal</p>
        </div>

        {/* Login Form */}
        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50">
              Username
            </label>
            <div className="relative mt-1.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-white/40">
                <User className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="glass-input w-full py-2.5 pr-3 pl-9 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50">
                Password
              </label>
            </div>
            <div className="relative mt-1.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-white/40">
                <Lock className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="glass-input w-full py-2.5 pr-3 pl-9 text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-500/12 px-3 py-2 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" strokeWidth={1.5} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="glass-btn-primary group relative mt-2 flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign in to Dashboard</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
              </>
            )}
          </button>
        </form>

        {/* Security & Access Notice */}
        <div className="mt-8 border-t border-white/[0.06] pt-4 text-center">
          <p className="text-[11px] font-normal text-white/45">
            Protected internal system. Unauthorized access attempts are monitored and logged.
          </p>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-white/50">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            <span>Operational Server: Online • TLS 1.3 Active</span>
          </div>
        </div>
      </div>
    </main>
  );
}
