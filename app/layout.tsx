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
            __html: `(function(){try{document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.setProperty('--accent-solid','#b9cf9f');localStorage.removeItem('sgb-theme');}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        <ThemeProvider>
          <div className="glass-background-layer" aria-hidden="true">
            <div className="ambient-light-top-left" />
            <div className="ambient-light-bottom-right" />
            <div className="bg-grain-overlay" />
          </div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
