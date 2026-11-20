"use client";

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import { Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

const EASE_CURVE = [0.22, 1, 0.36, 1] as const;

export default function LoginForm() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const shouldReduceMotion = useReducedMotion();

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

    if (shouldReduceMotion) {
      window.location.reload();
      return;
    }

    setIsExiting(true);
    if (typeof document !== 'undefined') {
      document.body.classList.add('in-app');
    }
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  const headlineWords = ['Sign', 'in', 'to', 'SGB', 'Enterprises'];

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center bg-transparent px-4 py-12 text-zinc-100 font-sans">
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
        animate={
          isExiting
            ? {
                opacity: 0,
                scale: shouldReduceMotion ? 1 : 1.03,
                filter: shouldReduceMotion ? 'none' : 'blur(6px)',
                transition: { duration: shouldReduceMotion ? 0.15 : 0.4, ease: EASE_CURVE },
              }
            : {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: shouldReduceMotion ? 0.15 : 0.6, delay: shouldReduceMotion ? 0 : 0.2, ease: EASE_CURVE },
              }
        }
        className="glass-card relative w-full max-w-[420px] rounded-[16px] p-8 border border-white/[0.08] shadow-glass"
      >
        {/* Top Branding */}
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : 0.25, ease: EASE_CURVE }}
            className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] p-2.5 shadow-sm"
          >
            <Image
              src="/sgb.png"
              alt="SGB Logo"
              width={44}
              height={44}
              className="object-contain"
              priority
            />
          </motion.div>

          {/* Word-by-word headline reveal */}
          <h1 className="mt-1 flex flex-wrap justify-center gap-x-1.5 text-2xl sm:text-3xl font-serif font-normal tracking-[-0.01em] text-[var(--text-1)]">
            {headlineWords.map((word, i) => (
              <motion.span
                key={i}
                initial={shouldReduceMotion ? false : { opacity: 0, filter: 'blur(8px)', y: 8 }}
                animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0.15 }
                    : { duration: 0.5, delay: 0.42 + i * 0.06, ease: EASE_CURVE }
                }
                className="inline-block"
              >
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: shouldReduceMotion ? 0 : 0.72, ease: EASE_CURVE }}
            className="mt-1.5 text-xs font-normal text-zinc-400"
          >
            Fleet dispatch and invoice clearance
          </motion.p>
        </div>

        {/* Login Form */}
        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: shouldReduceMotion ? 0 : 0.8, ease: EASE_CURVE }}
          >
            <label className="block text-[11px] font-medium uppercase tracking-[0.08em] opacity-50 text-[var(--cream,#f3f6df)]">
              Username
            </label>
            <div className="relative mt-1.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                <User className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full py-2.5 pr-3 pl-10 text-xs rounded-[14px] border border-white/[0.18] bg-white/[0.04] text-[var(--cream,#f3f6df)] placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid,#b7cc8a)]/40 focus:border-[var(--accent-solid,#b7cc8a)]/60 transition"
              />
            </div>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: shouldReduceMotion ? 0 : 0.88, ease: EASE_CURVE }}
          >
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-medium uppercase tracking-[0.08em] opacity-50 text-[var(--cream,#f3f6df)]">
                Password
              </label>
            </div>
            <div className="relative mt-1.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                <Lock className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full py-2.5 pr-3 pl-10 text-xs rounded-[14px] border border-white/[0.18] bg-white/[0.04] text-[var(--cream,#f3f6df)] placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid,#b7cc8a)]/40 focus:border-[var(--accent-solid,#b7cc8a)]/60 transition"
              />
            </div>
          </motion.div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-[14px] border border-rose-500/25 bg-rose-500/12 px-3.5 py-2.5 text-xs text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" strokeWidth={1.5} />
              <span>{error}</span>
            </motion.div>
          )}

          <motion.button
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: shouldReduceMotion ? 0 : 0.96, ease: EASE_CURVE }}
            type="submit"
            disabled={loading}
            className="w-full rounded-[14px] bg-[var(--accent-solid,#9db98a)] hover:brightness-110 text-[#060708] font-medium py-2.5 text-xs transition duration-200 shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </motion.button>
        </form>

        {/* Access Notice */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: shouldReduceMotion ? 0 : 1.04, ease: EASE_CURVE }}
          className="mt-6 border-t border-white/[0.08] pt-3.5 text-center"
        >
          <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 font-normal">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Authorized operations dispatch only</span>
          </div>
        </motion.div>
      </motion.div>
    </main>
  );
}
