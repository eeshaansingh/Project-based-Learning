'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, Loader2, KeyRound, Building2, User } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const executeLogin = async (loginEmail: string, loginPass: string) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
      } else {
        // Direct browser navigation to ensure HTTP-only session cookie is attached cleanly
        const targetPath = data.user?.role === 'BANK_OPERATOR' || data.user?.role === 'BANK_ADMIN' 
          ? '/bank-ops' 
          : '/';
        window.location.href = targetPath;
      }
    } catch (err) {
      setError('An error occurred during authentication. Please try again.');
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    executeLogin(email, password);
  };

  const handleDemoUserLogin = () => {
    setEmail('demo@secureupi');
    setPassword('password123');
    executeLogin('demo@secureupi', 'password123');
  };

  const handleOperatorLogin = () => {
    setEmail('operator@secureupi');
    setPassword('password123');
    executeLogin('operator@secureupi', 'password123');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7ed] px-4 py-12 sm:px-6 lg:px-8 font-sans text-[#1f1f1f]">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f1f1f] text-white shadow-xs">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-[#1f1f1f] font-outfit">
            Welcome to SecureUPI
          </h2>
          <p className="mt-1 text-xs text-[#6e6f6a] font-medium">
            Adaptive MFA & 2026 RBI Fraud Prevention Prototype
          </p>
        </div>

        {/* Card Panel */}
        <div className="glass-panel rounded-2xl p-8 shadow-xs bg-white border border-[#e3e4d9]">
          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-semibold animate-scale-up">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#9e9f98]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field w-full pl-10 text-sm"
                  placeholder="demo@secureupi or operator@secureupi"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#9e9f98]">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full pl-10 text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex justify-center items-center gap-2 mt-2 py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  Authenticating Session...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Quick Demo Assist */}
          <div className="mt-6 border-t border-[#e3e4d9] pt-5 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a8b84] block text-center">
              Instant Demo Access
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDemoUserLogin}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#e3e4d9] bg-[#f4f4f4] py-2.5 px-3 text-xs font-bold text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                <User className="h-3.5 w-3.5" />
                Demo User
              </button>
              <button
                type="button"
                onClick={handleOperatorLogin}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#d97706]/30 bg-[#fef3c7] py-2.5 px-3 text-xs font-bold text-[#b45309] hover:bg-[#d97706] hover:text-white transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Building2 className="h-3.5 w-3.5" />
                Bank Ops
              </button>
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-[#6e6f6a]">
          Don't have an account?{' '}
          <Link href="/register" className="font-bold text-[#1f1f1f] underline hover:text-black transition-colors">
            Register new account
          </Link>
        </p>
      </div>
    </div>
  );
}
