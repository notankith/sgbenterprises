"use client";

import dynamic from 'next/dynamic';

const LogisticsApp = dynamic(() => import('@/components/logistics-app'), {
  ssr: false,
  loading: () => (
    <div
      suppressHydrationWarning
      className="flex min-h-screen items-center justify-center bg-transparent"
    >
      <div className="flex flex-col items-center gap-3">
        <span
          suppressHydrationWarning
          className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent shadow-sm"
        />
        <span className="text-xs font-semibold tracking-wider text-white/50 uppercase">
          Initializing SGB Console...
        </span>
      </div>
    </div>
  ),
});

const LoginForm = dynamic(() => import('@/components/login-form'), {
  ssr: false,
  loading: () => (
    <div
      suppressHydrationWarning
      className="flex min-h-screen items-center justify-center bg-transparent text-slate-100"
    >
      <div className="flex flex-col items-center gap-3">
        <span
          suppressHydrationWarning
          className="h-8 w-8 animate-spin rounded-full border-3 border-brand-500 border-t-transparent"
        />
        <span className="text-xs font-semibold tracking-wider text-white/50 uppercase">
          Securing Connection...
        </span>
      </div>
    </div>
  ),
});

export default function ClientHome({ loggedIn }: { loggedIn: boolean }) {
  return loggedIn ? <LogisticsApp /> : <LoginForm />;
}
