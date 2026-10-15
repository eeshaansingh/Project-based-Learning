'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, User, Mail, Phone, KeyRound, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !mobileNumber || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          mobileNumber,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
      } else {
        router.push('/onboarding');
        router.refresh();
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7ed] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-[#e3e4d9] text-[#1f1f1f] shadow-xs">
            <UserPlus className="h-5 w-5" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-[#1f1f1f] font-outfit">
            Create account
          </h2>
          <p className="mt-1.5 text-xs text-[#6e6f6a] font-medium">
            Step 1 of the prototype onboarding process
          </p>
        </div>

        {/* Card Panel */}
        <div className="glass-panel rounded-2xl p-8 shadow-xs bg-white border border-[#e3e4d9]">
          <form className="space-y-4" onSubmit={handleRegister}>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-scale-up">
                {error}
              </div>
            )}

            {/* Name Field */}
            <div className="space-y-1">
              <label htmlFor="name" className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#9e9f98]">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field w-full pl-10 text-sm"
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-1">
              <label htmlFor="email" className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#9e9f98]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field w-full pl-10 text-sm"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            {/* Mobile Number Field */}
            <div className="space-y-1">
              <label htmlFor="mobile" className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">
                Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#9e9f98]">
                  <Phone className="h-4 w-4" />
                </div>
                <input
                  id="mobile"
                  type="tel"
                  required
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="input-field w-full pl-10 text-sm"
                  placeholder="9876543210"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <label htmlFor="password" className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#9e9f98]">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full pl-10 text-sm"
                  placeholder="•••••••• (min 8 chars)"
                />
              </div>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#9e9f98]">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field w-full pl-10 text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex justify-center items-center gap-2 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  Creating Account...
                </>
              ) : (
                'Sign Up'
              )}
            </button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-[#6e6f6a]">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-[#1f1f1f] underline hover:text-black transition-colors">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
