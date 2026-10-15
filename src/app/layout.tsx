import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SecureUPI — Adaptive MFA UPI Payment Prototype',
  description: 'An educational prototype demonstrating risk-based adaptive multi-factor authentication (MFA) at the application layer before bank UPI PIN authorization.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} h-full antialiased selection:bg-[#1f1f1f] selection:text-white`}>
      <body className="font-sans min-h-full flex flex-col bg-[#f6f7ed] text-[#1f1f1f] animate-fade-in">
        {children}
      </body>
    </html>
  );
}
