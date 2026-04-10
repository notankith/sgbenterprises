import './globals.css';
import type { Metadata } from 'next';
import localFont from 'next/font/local';

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
  title: 'Internal Logistics Dashboard',
  description: 'Internal logistics and finance control panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}
