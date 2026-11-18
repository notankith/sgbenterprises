import './globals.css';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { ThemeProvider } from '@/components/theme-provider';

const inter = localFont({
  src: [
    { path: './fonts/Inter-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Inter-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/Inter-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['Segoe UI', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'SGB Internal Console',
  description: 'SGB Enterprises internal console & invoice management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('sgb-theme');if(s){var t=JSON.parse(s);var m=t.mode||'dark';var r=m==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m;document.documentElement.setAttribute('data-theme',r);if(t.accent){document.documentElement.style.setProperty('--accent-solid',t.accent);}}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        <ThemeProvider>
          <div className="glass-background-layer" aria-hidden="true" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
