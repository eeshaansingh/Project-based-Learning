'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building, 
  Key, 
  ShieldAlert, 
  Copy, 
  Check, 
  Loader2, 
  CreditCard,
  QrCode,
  ShieldCheck
} from 'lucide-react';

type Step = 'BANK_LINK' | 'PIN_SETUP' | 'MFA_SETUP' | 'MFA_SUCCESS';

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<Step>('BANK_LINK');
  const [error, setError] = useState('');
  
  // Bank Link State
  const [selectedBank, setSelectedBank] = useState('');
  const [linkedAccount, setLinkedAccount] = useState<any>(null);

  // PIN Setup State
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // MFA Setup State
  const [mfaSecret, setMfaSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [currentTotpToken, setCurrentTotpToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          if (data.user.bankAccounts.length > 0) {
            setLinkedAccount(data.user.bankAccounts[0]);
            if (data.user.mfaEnabled) {
              router.push('/');
            } else {
              setCurrentStep('MFA_SETUP');
              fetchMfaSetup();
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [router]);

  const fetchMfaSetup = async () => {
    try {
      const res = await fetch('/api/onboarding/mfa-setup');
      const data = await res.json();
      if (res.ok) {
        setMfaSecret(data.secret);
        setQrCodeUrl(data.qrCodeUrl);
        setCurrentTotpToken(data.currentTotpToken || '');
      } else {
        setError(data.error || 'Failed to initialize MFA');
      }
    } catch (err) {
      setError('Connection error initializing MFA');
    }
  };

  const handleBankLink = async () => {
    if (!selectedBank) {
      setError('Please select a bank');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/onboarding/bank-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankName: selectedBank }),
      });
      const data = await res.json();
      if (res.ok) {
        setLinkedAccount(data.bankAccount);
        setCurrentStep('PIN_SETUP');
      } else {
        setError(data.error || 'Failed to link account');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSetup = async () => {
    if (!pin || !confirmPin) {
      setError('Please fill in both fields');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be a 4 to 6 digit number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/onboarding/setup-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bankAccountId: linkedAccount.id, 
          pin 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentStep('MFA_SETUP');
        await fetchMfaSetup();
      } else {
        setError(data.error || 'Failed to configure PIN');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/onboarding/mfa-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecoveryCodes(data.recoveryCodes);
        setCurrentStep('MFA_SUCCESS');
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  if (loading && currentStep === 'BANK_LINK') {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#f6f7ed] text-[#1f1f1f]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1f1f1f]" />
        <p className="mt-3 text-xs text-[#6e6f6a] font-medium">Preparing onboarding...</p>
      </div>
    );
  }

  const bankOptions = [
    { name: 'State Bank of India', code: 'SBI' },
    { name: 'HDFC Bank', code: 'HDFC' },
    { name: 'ICICI Bank', code: 'ICICI' },
    { name: 'Axis Bank', code: 'AXIS' },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7ed] px-4 py-12">
      <div className="w-full max-w-lg space-y-8 animate-fade-in">
        
        {/* Onboarding Steps Indicators */}
        <div className="flex justify-between items-center px-4 max-w-sm mx-auto">
          <div className="flex flex-col items-center">
            <div className={`h-8 w-8 flex items-center justify-center rounded-full text-xs font-bold ${
              currentStep === 'BANK_LINK' 
                ? 'bg-[#1f1f1f] text-white shadow-xs' 
                : 'bg-[#f4f4f4] border border-[#e3e4d9] text-[#1f1f1f]'
            }`}>
              1
            </div>
            <span className="text-[10px] mt-1 text-[#6e6f6a] font-bold">Link Bank</span>
          </div>
          <div className="h-px bg-[#e3e4d9] flex-1 mx-2 -mt-4" />
          <div className="flex flex-col items-center">
            <div className={`h-8 w-8 flex items-center justify-center rounded-full text-xs font-bold ${
              currentStep === 'PIN_SETUP' 
                ? 'bg-[#1f1f1f] text-white shadow-xs' 
                : currentStep === 'BANK_LINK' ? 'bg-white border border-[#e3e4d9] text-[#8a8b84]' : 'bg-[#f4f4f4] border border-[#e3e4d9] text-[#1f1f1f]'
            }`}>
              2
            </div>
            <span className="text-[10px] mt-1 text-[#6e6f6a] font-bold">UPI PIN</span>
          </div>
          <div className="h-px bg-[#e3e4d9] flex-1 mx-2 -mt-4" />
          <div className="flex flex-col items-center">
            <div className={`h-8 w-8 flex items-center justify-center rounded-full text-xs font-bold ${
              currentStep === 'MFA_SETUP' || currentStep === 'MFA_SUCCESS'
                ? 'bg-[#1f1f1f] text-white shadow-xs' 
                : 'bg-white border border-[#e3e4d9] text-[#8a8b84]'
            }`}>
              3
            </div>
            <span className="text-[10px] mt-1 text-[#6e6f6a] font-bold">Secure MFA</span>
          </div>
        </div>

        {/* Dynamic Step Panels */}
        <div className="glass-panel rounded-2xl p-8 bg-white border border-[#e3e4d9] shadow-xs relative overflow-hidden">
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-scale-up">
              {error}
            </div>
          )}

          {/* STEP 1: Link Bank Account */}
          {currentStep === 'BANK_LINK' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f4f4] border border-[#e3e4d9] text-[#1f1f1f]">
                  <Building className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-[#1f1f1f] mt-3 font-outfit">Link Bank Account</h3>
                <p className="text-xs text-[#6e6f6a] mt-1">Select your primary bank to generate a simulated UPI ID.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {bankOptions.map((bank) => (
                  <button
                    key={bank.code}
                    onClick={() => { setSelectedBank(bank.name); setError(''); }}
                    className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                      selectedBank === bank.name 
                        ? 'border-[#1f1f1f] bg-[#f4f4f4] ring-1 ring-[#1f1f1f]' 
                        : 'border-[#e3e4d9] bg-white hover:bg-[#f4f4f4]'
                    }`}
                  >
                    <div className="h-8 w-8 rounded-lg bg-[#1f1f1f] flex items-center justify-center text-[10px] font-bold text-white uppercase group-hover:scale-105 transition-transform">
                      {bank.code}
                    </div>
                    <span className="text-xs font-bold text-[#1f1f1f] mt-4">{bank.name}</span>
                    <span className="text-[9px] text-[#6e6f6a] mt-0.5">Simulated Link</span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleBankLink}
                disabled={loading}
                className="btn-primary w-full flex justify-center items-center gap-2 mt-4 text-xs py-2.5"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : null}
                Link Account & Continue
              </button>
            </div>
          )}

          {/* STEP 2: Mock Bank UPI PIN Setup */}
          {currentStep === 'PIN_SETUP' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f4f4] border border-[#e3e4d9] text-[#1f1f1f]">
                  <Key className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-[#1f1f1f] mt-3 font-outfit">Setup UPI PIN</h3>
                <p className="text-xs text-[#6e6f6a] mt-1">Create a secure transaction PIN for your linked bank account.</p>
              </div>

              {/* Warning Banner */}
              <div className="rounded-xl border border-[#e3e4d9] bg-[#f4f4f4] p-4 flex gap-3 text-xs text-[#1f1f1f]">
                <ShieldAlert className="h-5 w-5 shrink-0 text-[#1f1f1f]" />
                <div>
                  <span className="font-bold uppercase tracking-wider block mb-0.5">Secure Bank Environment</span>
                  This interface belongs to the Mock Bank layer. The main payment application cannot access or store this PIN in plaintext.
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">UPI PIN (4-6 Digits)</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    className="input-field w-full text-center tracking-[1em] text-lg font-bold font-mono"
                    placeholder="••••••"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">Confirm UPI PIN</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className="input-field w-full text-center tracking-[1em] text-lg font-bold font-mono"
                    placeholder="••••••"
                  />
                </div>
              </div>

              <button
                onClick={handlePinSetup}
                disabled={loading}
                className="btn-primary w-full flex justify-center items-center gap-2 mt-4 text-xs py-2.5"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : null}
                Configure UPI PIN & Continue
              </button>
            </div>
          )}

          {/* STEP 3: MFA TOTP Setup */}
          {currentStep === 'MFA_SETUP' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f4f4] border border-[#e3e4d9] text-[#1f1f1f]">
                  <QrCode className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-[#1f1f1f] mt-3 font-outfit">Enable Security MFA</h3>
                <p className="text-xs text-[#6e6f6a] mt-1">Configure your Authenticator App to protect high-value payments.</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 justify-center bg-[#f4f4f4] p-4 rounded-xl border border-[#e3e4d9]">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="MFA QR Code" className="h-32 w-32 rounded-lg border border-[#e3e4d9] p-1 bg-white" />
                ) : (
                  <div className="h-32 w-32 rounded-lg border border-[#e3e4d9] flex items-center justify-center bg-white">
                    <Loader2 className="h-5 w-5 animate-spin text-[#1f1f1f]" />
                  </div>
                )}
                
                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-[#1f1f1f] uppercase tracking-wider block">Authenticator Setup</span>
                  <p className="text-xs text-[#6e6f6a] leading-relaxed">
                    Scan this QR code in Google Authenticator, Microsoft Authenticator, or Authy.
                  </p>
                  <div className="mt-2 text-left">
                    <span className="text-[9px] text-[#6e6f6a] uppercase tracking-wider font-bold block">Setup Key (Manual Entry)</span>
                    <code className="text-xs font-semibold text-[#1f1f1f] select-all block bg-white px-2 py-1 rounded mt-0.5 border border-[#e3e4d9] truncate font-mono">
                      {mfaSecret}
                    </code>
                  </div>
                </div>
              </div>

              {/* Prototype Demo Helper */}
              {currentTotpToken && (
                <div className="rounded-xl border border-[#e3e4d9] bg-[#fdfdfc] p-3 text-xs text-[#1f1f1f] flex items-center justify-between">
                  <span className="text-[11px] text-[#6e6f6a]">Prototype Demo Code:</span>
                  <button
                    type="button"
                    onClick={() => setMfaCode(currentTotpToken)}
                    className="font-mono font-extrabold text-xs bg-[#1f1f1f] text-white px-2.5 py-1 rounded-md hover:bg-black transition-all cursor-pointer"
                  >
                    Click to fill: {currentTotpToken}
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block text-center">
                  Enter 6-Digit Authenticator Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="input-field w-full text-center text-lg tracking-[0.5em] font-semibold font-mono"
                  placeholder="000000"
                />
                <p className="text-[10px] text-[#8a8b84] text-center italic">
                  Note: You can use your phone authenticator app, the live code above, or demo code <code className="font-bold text-[#1f1f1f]">123456</code>.
                </p>
              </div>

              <button
                onClick={handleMfaVerify}
                disabled={loading}
                className="btn-primary w-full flex justify-center items-center gap-2 text-xs py-2.5 cursor-pointer"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : null}
                Verify & Activate MFA
              </button>
            </div>
          )}

          {/* STEP 4: Onboarding Recovery Codes Display */}
          {currentStep === 'MFA_SUCCESS' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f1f1f] text-white">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-[#1f1f1f] mt-3 font-outfit">MFA Activated Successfully</h3>
                <p className="text-xs text-[#6e6f6a] mt-1">Please copy your recovery codes. They are required if you lose device access.</p>
              </div>

              {/* Recovery codes container */}
              <div className="bg-[#f4f4f4] p-4 rounded-xl border border-[#e3e4d9] relative group">
                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-center font-bold text-[#1f1f1f]">
                  {recoveryCodes.map((code, idx) => (
                    <div key={idx} className="bg-white border border-[#e3e4d9] py-2 rounded">
                      {code}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white border border-[#e3e4d9] text-xs font-bold py-2.5 text-[#1f1f1f] cursor-pointer hover:bg-[#1f1f1f] hover:text-white transition-all shadow-xs"
                >
                  {copiedCodes ? (
                    <>
                      <Check className="h-4 w-4 text-[#1f1f1f]" />
                      Recovery Codes Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-[#6e6f6a]" />
                      Copy Recovery Codes
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl border border-[#e3e4d9] bg-[#f4f4f4] p-4 flex gap-3 text-xs text-[#1f1f1f]">
                <ShieldAlert className="h-5 w-5 shrink-0 text-[#1f1f1f]" />
                <div>
                  <span className="font-bold uppercase tracking-wider block mb-0.5">Critical Recovery Notice</span>
                  These recovery codes will never be displayed again. Store them in a secure password manager or key vault.
                </div>
              </div>

              <button
                onClick={() => router.push('/')}
                className="btn-primary w-full flex justify-center items-center gap-2 text-xs py-2.5 mt-4 cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
