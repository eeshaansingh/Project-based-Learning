'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Home, 
  Send, 
  History, 
  ShieldCheck, 
  LogOut, 
  Lock, 
  Loader2, 
  User,
  BrainCircuit,
  AlertTriangle,
  Building2
} from 'lucide-react';

interface NavigationShellProps {
  children: React.ReactNode;
}

export default function NavigationShell({ children }: NavigationShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        
        const data = await res.json();
        if (!data.user) {
          router.replace('/login');
          return;
        }

        setUser(data.user);
        
        const needsOnboarding = data.user.bankAccounts.length === 0;
        
        if (needsOnboarding && !pathname.startsWith('/onboarding')) {
          router.replace('/onboarding');
        } else if (!needsOnboarding && pathname.startsWith('/onboarding')) {
          router.replace('/');
        }
      } catch (err) {
        console.error('Auth verification failed', err);
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router, pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#f6f7ed] text-[#1f1f1f]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1f1f1f]" />
        <p className="mt-3 text-xs text-[#6e6f6a] font-medium tracking-wide">Securing session...</p>
      </div>
    );
  }

  const mainNavItems = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Pay / Send', href: '/pay', icon: Send },
    { name: 'Activity', href: '/activity', icon: History },
    { name: 'Security', href: '/security', icon: ShieldCheck },
  ];

  const supportNavItems = [
    { name: 'Smart Dispute', href: '/support/smart-dispute', icon: BrainCircuit },
    { name: 'Fraud Reports', href: '/support/fraud-reports', icon: AlertTriangle },
  ];

  const isOperator = user?.role === 'BANK_OPERATOR' || user?.role === 'BANK_ADMIN';

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7ed] font-sans md:flex-row text-[#1f1f1f]">
      {/* Sidebar for Desktop */}
      <aside className="hidden w-64 border-r border-[#e3e4d9] bg-white md:flex md:flex-col justify-between overflow-y-auto">
        <div>
          <div className="flex h-16 items-center border-b border-[#e3e4d9] px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1f1f1f] text-white">
                <Lock className="h-4 w-4" />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-[#1f1f1f] font-outfit">
                SecureUPI
              </span>
            </Link>
          </div>

          <div className="px-4 py-4 space-y-6">
            {/* Main Nav */}
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#8a8b84]">Core</p>
              {mainNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-[#1f1f1f] text-white shadow-sm'
                        : 'text-[#6e6f6a] hover:bg-[#f4f4f4] hover:text-[#1f1f1f]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Support Nav */}
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#8a8b84]">Support</p>
              {supportNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-[#1f1f1f] text-white shadow-sm'
                        : 'text-[#6e6f6a] hover:bg-[#f4f4f4] hover:text-[#1f1f1f]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Bank Operations Nav (Visible to Operators) */}
            {isOperator && (
              <div className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#d97706]">Bank Ops</p>
                <Link
                  href="/bank-ops"
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                    pathname.startsWith('/bank-ops')
                      ? 'bg-[#d97706] text-white shadow-sm'
                      : 'text-[#d97706] hover:bg-[#fef3c7] hover:text-[#b45309]'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Bank Operations
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* User Card & Logout inside Sidebar */}
        {user && (
          <div className="border-t border-[#e3e4d9] p-4 bg-[#f4f4f4]/60">
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-[#e3e4d9] text-[#1f1f1f]">
                <User className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold truncate text-[#1f1f1f]">{user.name}</p>
                  {isOperator && (
                    <span className="rounded bg-[#d97706] px-1 py-0.5 text-[9px] font-extrabold text-white">OPS</span>
                  )}
                </div>
                <p className="text-[11px] truncate text-[#6e6f6a]">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#e3e4d9] bg-white px-3 py-2 text-xs font-semibold text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white transition-all cursor-pointer shadow-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col">
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between border-b border-[#e3e4d9] px-6 bg-[#f6f7ed]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Mobile Title */}
            <Link href="/" className="flex items-center gap-2 md:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1f1f1f] text-white">
                <Lock className="h-3.5 w-3.5" />
              </div>
              <span className="text-base font-extrabold text-[#1f1f1f] font-outfit">
                SecureUPI
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {isOperator && (
              <Link
                href="/bank-ops"
                className="hidden sm:flex items-center gap-1.5 rounded-full bg-[#d97706] px-3.5 py-1 text-xs font-bold text-white shadow-xs"
              >
                <Building2 className="h-3 w-3" />
                Bank Ops Console
              </Link>
            )}

            {/* Adaptive MFA indicator badge */}
            <div className="flex items-center gap-1.5 rounded-full border border-[#e3e4d9] bg-[#ffffff] px-3.5 py-1 text-xs font-semibold text-[#1f1f1f] shadow-xs select-none">
              <Lock className="h-3 w-3 text-[#1f1f1f]" />
              <span className="hidden sm:inline">Protected by Adaptive MFA</span>
              <span className="sm:hidden">Adaptive MFA</span>
            </div>

            {/* Logout Shortcut for Mobile */}
            <button
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-[#6e6f6a] hover:bg-[#f4f4f4] hover:text-[#1f1f1f] md:hidden cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8 pb-24 md:pb-8">
          <div className="mx-auto max-w-5xl w-full">
            {children}
          </div>
        </main>

        {/* Bottom Nav for Mobile */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e3e4d9] bg-white/95 backdrop-blur-lg md:hidden safe-bottom">
          <div className="flex h-16 items-center justify-around px-2">
            {[...mainNavItems, ...supportNavItems, ...(isOperator ? [{ name: 'Bank Ops', href: '/bank-ops', icon: Building2 }] : [])].slice(0, 5).map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center justify-center gap-1 w-14 h-full text-[10px] font-semibold transition-all ${
                    isActive ? 'text-[#1f1f1f]' : 'text-[#8a8b84] hover:text-[#1f1f1f]'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
