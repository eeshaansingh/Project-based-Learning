'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import NavigationShell from '@/components/NavigationShell';
import { 
  ArrowLeft, 
  Send, 
  Lock, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Building,
  Key,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

type FlowState = 'INPUT' | 'MFA' | 'PIN' | 'SUCCESS' | 'BLOCKED' | 'FAILED';

export default function PayPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-[#1f1f1f] font-mono text-xs">Loading...</div>}>
      <PayContent />
    </Suspense>
  );
}

function PayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Base Payment Fields
  const [payeeUpiId, setPayeeUpiId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  // Flow State Management
  const [flow, setFlow] = useState<FlowState>('INPUT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Transaction Context
  const [transactionId, setTransactionId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [triggerReasons, setTriggerReasons] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // MFA step state
  const [mfaCode, setMfaCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  
  // PIN step state
  const [pin, setPin] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(5);

  // Pre-fill fields from query params (Dashboard quick pay)
  useEffect(() => {
    const to = searchParams.get('to');
    if (to) {
      setPayeeUpiId(to);
    }

    async function loadProfile() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUserProfile(data.user);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadProfile();
  }, [searchParams]);

  // Phase 1: Initiate Payment & Trigger Risk Engine
  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payeeUpiId || !amount) {
      setError('Please enter Payee UPI ID and Amount');
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive payment amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payeeUpiId, amount: numAmount, note }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Payment initiation failed');
        return;
      }

      setTransactionId(data.transactionId);

      if (data.decision === 'BLOCK_TRANSACTION') {
        setTriggerReasons(data.reasons || []);
        setFlow('BLOCKED');
      } else if (data.decision === 'STEP_UP_REQUIRED') {
        setChallengeId(data.challengeId);
        setTriggerReasons(data.reasons || []);
        setAttemptsLeft(5);
        setFlow('MFA');
      } else {
        setFlow('PIN');
      }
    } catch (err) {
      setError('A connection error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Phase 2: Verify MFA TOTP or Recovery Code
  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode) {
      setError('Please enter code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/payment/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transactionId, 
          challengeId, 
          code: mfaCode 
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAttemptsLeft(prev => Math.max(0, prev - 1));
        setError(data.error || 'Verification failed');
        
        if (data.error?.toLowerCase().includes('lock') || data.error?.toLowerCase().includes('cancel') || attemptsLeft <= 1) {
          setFlow('FAILED');
        }
      } else {
        setError('');
        setMfaCode('');
        setFlow('PIN');
      }
    } catch (err) {
      setError('A connection error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Phase 3: Verify Mock Bank UPI PIN & Complete Payment
  const handleAuthorizePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setError('Please enter your complete UPI PIN');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/payment/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authorization failed');
        setFlow('FAILED');
      } else {
        setFlow('SUCCESS');
      }
    } catch (err) {
      setError('A connection error occurred during authorization.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPayeeUpiId('');
    setAmount('');
    setNote('');
    setTransactionId('');
    setChallengeId('');
    setTriggerReasons([]);
    setMfaCode('');
    setPin('');
    setFlow('INPUT');
    setError('');
  };

  const bankAccount = userProfile?.bankAccounts?.[0] || null;

  return (
    <NavigationShell>
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Header Title */}
        <div className="flex items-center gap-3">
          {flow === 'INPUT' ? (
            <Link href="/" className="p-2 rounded-xl bg-white border border-[#e3e4d9] text-[#1f1f1f] hover:bg-[#f4f4f4] transition-colors shadow-xs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : (
            <button onClick={handleReset} className="p-2 rounded-xl bg-white border border-[#e3e4d9] text-[#1f1f1f] hover:bg-[#f4f4f4] transition-colors cursor-pointer shadow-xs">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h1 className="text-xl font-bold text-[#1f1f1f] font-outfit">Send Money</h1>
        </div>

        {/* Dynamic Payment State Panels */}
        <div className="glass-panel rounded-2xl p-8 bg-white border border-[#e3e4d9] shadow-xs relative">
          
          {error && flow !== 'MFA' && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-scale-up">
              {error}
            </div>
          )}

          {/* STATE 1: Input Fields */}
          {flow === 'INPUT' && (
            <form onSubmit={handleInitiatePayment} className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f4f4] border border-[#e3e4d9] text-[#1f1f1f]">
                  <Send className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-[#1f1f1f] mt-3 font-outfit">New Instant Transfer</h3>
                <p className="text-xs text-[#6e6f6a] mt-1">Initiate safe UPI payment. Rules will evaluate risk.</p>
              </div>

              <div className="space-y-4">
                {/* Recipient UPI ID */}
                <div className="space-y-1.5">
                  <label htmlFor="upiId" className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">Recipient UPI ID</label>
                  <input
                    id="upiId"
                    type="text"
                    required
                    value={payeeUpiId}
                    onChange={(e) => setPayeeUpiId(e.target.value)}
                    className="input-field w-full text-sm font-mono"
                    placeholder="merchant@upi"
                  />
                  <div className="flex gap-2 mt-1">
                    <span className="text-[9px] text-[#6e6f6a] font-medium">Demo payees:</span>
                    <button type="button" onClick={() => setPayeeUpiId('rahul@upi')} className="text-[9px] text-[#1f1f1f] font-bold hover:underline">rahul@upi</button>
                    <button type="button" onClick={() => setPayeeUpiId('cafe@upi')} className="text-[9px] text-[#1f1f1f] font-bold hover:underline">cafe@upi</button>
                    <button type="button" onClick={() => setPayeeUpiId('rent@upi')} className="text-[9px] text-[#1f1f1f] font-bold hover:underline">rent@upi</button>
                    <button type="button" onClick={() => setPayeeUpiId('newpayee@upi')} className="text-[9px] text-[#1f1f1f] font-bold hover:underline">newpayee@upi</button>
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <label htmlFor="amount" className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">Amount (₹)</label>
                  <input
                    id="amount"
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input-field w-full text-lg font-bold font-mono"
                    placeholder="0.00"
                  />
                </div>

                {/* Note */}
                <div className="space-y-1.5">
                  <label htmlFor="note" className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">Note (Optional)</label>
                  <input
                    id="note"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="input-field w-full text-sm"
                    placeholder="Split bill"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex justify-center items-center gap-2 mt-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : null}
                Verify & Continue
              </button>
            </form>
          )}

          {/* STATE 2: MFA Step-up Screen */}
          {flow === 'MFA' && (
            <form onSubmit={handleVerifyMfa} className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f1f1f] text-white">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-[#1f1f1f] mt-3 font-outfit">Additional Verification Required</h3>
                <span className="text-[9px] font-bold text-[#1f1f1f] border border-[#e3e4d9] bg-[#f4f4f4] px-2.5 py-0.5 rounded-md uppercase tracking-wider mt-2 inline-block">
                  High Risk Event
                </span>
              </div>

              {/* Step-up Reasoning Description */}
              <div className="rounded-xl border border-[#e3e4d9] bg-[#f4f4f4] p-4 text-xs leading-relaxed text-[#1f1f1f]">
                <span className="font-bold block mb-1 text-[#1f1f1f]">MFA trigger reasoning:</span>
                <ul className="list-disc pl-4 space-y-1 text-[#6e6f6a]">
                  {triggerReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-scale-up">
                  {error}
                </div>
              )}

              {/* MFA Code Input */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block text-center">
                  {useRecovery ? 'Enter 8-Character Recovery Code' : 'Enter Authenticator 6-Digit Code'}
                </label>
                <input
                  type="text"
                  maxLength={useRecovery ? 9 : 6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.toUpperCase())}
                  className="input-field w-full text-center text-lg tracking-[0.2em] font-bold font-mono"
                  placeholder={useRecovery ? 'XXXX-XXXX' : '000000'}
                />
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#6e6f6a]">Attempts left: <b className="text-[#1f1f1f] font-mono">{attemptsLeft}</b></span>
                  
                  <button 
                    type="button" 
                    onClick={() => { setUseRecovery(!useRecovery); setMfaCode(''); setError(''); }}
                    className="text-[#1f1f1f] font-bold hover:underline cursor-pointer"
                  >
                    {useRecovery ? 'Use Authenticator Code' : 'Use Recovery Code'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex justify-center items-center gap-2 mt-4"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : null}
                Verify & Continue
              </button>
            </form>
          )}

          {/* STATE 3: Mock Bank controlled PIN Screen */}
          {flow === 'PIN' && (
            <form onSubmit={handleAuthorizePayment} className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f4f4] border border-[#e3e4d9] text-[#1f1f1f]">
                  <Building className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-[#1f1f1f] mt-3 font-outfit">Bank Authorization</h3>
                <p className="text-xs text-[#6e6f6a]">Simulated secure bank network page.</p>
              </div>

              {/* Payee Details card */}
              <div className="bg-[#f4f4f4] rounded-xl p-4 border border-[#e3e4d9] space-y-2 text-sm text-center">
                <span className="text-[10px] text-[#6e6f6a] font-bold uppercase tracking-wider block">Paying Amount</span>
                <p className="text-2xl font-bold text-[#1f1f1f] font-mono font-outfit">₹{Number(amount).toLocaleString('en-IN')}</p>
                <div className="text-xs text-[#6e6f6a] border-t border-[#e3e4d9] pt-2 flex justify-between">
                  <span>To: <b className="text-[#1f1f1f]">{payeeUpiId}</b></span>
                  <span>From: <b className="text-[#1f1f1f]">{bankAccount?.bankName || 'HDFC Bank'}</b></span>
                </div>
              </div>

              {/* UPI PIN Input */}
              <div className="space-y-3">
                <label htmlFor="pin" className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block text-center">
                  Enter UPI PIN
                </label>
                <input
                  id="pin"
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="input-field w-full text-center tracking-[1em] text-lg font-bold font-mono"
                  placeholder="••••••"
                />
                
                <span className="text-[9px] text-[#6e6f6a] font-semibold block text-center uppercase tracking-wider">
                  Secure Bank Terminal — Hash PIN checks only.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex justify-center items-center gap-2 mt-4"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : null}
                Authorize Transaction
              </button>
            </form>
          )}

          {/* STATE 4: Success Screen */}
          {flow === 'SUCCESS' && (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1f1f1f] text-white">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[#1f1f1f] font-outfit">Payment Successful</h3>
                <p className="text-xs text-[#6e6f6a]">Your mock bank transaction completed successfully.</p>
              </div>

              <div className="bg-[#f4f4f4] border border-[#e3e4d9] p-4 rounded-xl text-xs space-y-2 max-w-xs mx-auto text-left">
                <div className="flex justify-between">
                  <span className="text-[#6e6f6a]">Recipient:</span>
                  <span className="font-semibold text-[#1f1f1f]">{payeeUpiId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6e6f6a]">Amount Sent:</span>
                  <span className="font-bold text-[#1f1f1f] font-mono">₹{Number(amount).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6e6f6a]">Transaction ID:</span>
                  <span className="font-mono text-[10px] text-[#1f1f1f] truncate max-w-[150px]">{transactionId}</span>
                </div>
              </div>

              <button
                onClick={() => router.push('/')}
                className="btn-primary w-full py-2.5 mt-4"
              >
                Return to Dashboard
              </button>
            </div>
          )}

          {/* STATE 5: Blocked Screen */}
          {flow === 'BLOCKED' && (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1f1f1f] text-white">
                <XCircle className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[#1f1f1f] font-outfit">Transaction Blocked</h3>
                <p className="text-xs text-[#6e6f6a]">The Adaptive Security Engine blocked this payment.</p>
              </div>

              {/* Trigger details */}
              <div className="rounded-xl border border-[#e3e4d9] bg-[#f4f4f4] p-4 text-xs leading-relaxed text-[#1f1f1f] text-left">
                <span className="font-bold block mb-1 text-[#1f1f1f]">Blocked rules triggered:</span>
                <ul className="list-disc pl-4 space-y-1 text-[#6e6f6a]">
                  {triggerReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>

              <button
                onClick={handleReset}
                className="btn-primary w-full py-2.5 mt-4"
              >
                Back to Payment
              </button>
            </div>
          )}

          {/* STATE 6: Failed Screen */}
          {flow === 'FAILED' && (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f4f4f4] border border-[#e3e4d9] text-[#1f1f1f]">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[#1f1f1f] font-outfit">Transaction Failed</h3>
                <p className="text-xs text-[#6e6f6a]">Payment failed or verification attempts were locked out.</p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={handleReset}
                className="btn-primary w-full py-2.5 mt-4"
              >
                Restart Transaction
              </button>
            </div>
          )}

        </div>
      </div>
    </NavigationShell>
  );
}
