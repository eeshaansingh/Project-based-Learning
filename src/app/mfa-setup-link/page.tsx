'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ShieldCheck, 
  Copy, 
  Check, 
  Loader2, 
  AlertTriangle, 
  QrCode, 
  Key, 
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

function MfaSetupLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mfaData, setMfaData] = useState<any>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const verificationStarted = React.useRef(false);

  useEffect(() => {
    if (!token) {
      setError('Setup token is missing in the link. Please request a new setup link.');
      setLoading(false);
      return;
    }
    if (verificationStarted.current) return;
    verificationStarted.current = true;

    async function verifyLink() {
      try {
        const res = await fetch('/api/auth/mfa-setup-link/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();
        if (res.ok) {
          setMfaData(data);
        } else {
          setError(data.error || 'Verification failed. This setup link might be invalid or expired.');
        }
      } catch (err) {
        setError('A network error occurred while verifying the setup link.');
      } finally {
        setLoading(false);
      }
    }

    verifyLink();
  }, [token]);

  const copyRecoveryCodes = () => {
    if (mfaData?.recoveryCodes) {
      navigator.clipboard.writeText(mfaData.recoveryCodes.join('\n'));
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        <h3 className="text-md font-bold text-white mt-4 font-outfit">Verifying Enrollment Link</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-xs">Establishing secure session and generating your security credentials...</p>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="max-w-md w-full mx-auto space-y-6 px-4">
        <div className="glass-panel rounded-2xl p-8 text-center bg-[#0a0e1b] border border-red-500/20 shadow-2xl">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 animate-pulse" />
          <h3 className="text-lg font-bold text-white mt-4 font-outfit">Setup Verification Failed</h3>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">{error}</p>
          
          <div className="mt-8 border-t border-card-border pt-6">
            <button
              onClick={() => router.replace('/login')}
              className="btn-primary w-full py-2.5 text-xs flex justify-center items-center gap-1"
            >
              Go to Login Page
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Success Enrollment State
  return (
    <div className="max-w-lg w-full mx-auto space-y-8 px-4 py-12">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-extrabold text-white tracking-tight font-outfit">SecureUPI Onboarding</h1>
        <p className="text-xs text-indigo-400 font-semibold tracking-wider uppercase">Device Enrollment Successful</p>
      </div>

      <div className="glass-panel rounded-2xl p-8 bg-[#0a0e1b] shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />

        <div className="text-center">
          <ShieldCheck className="h-12 w-12 mx-auto text-emerald-400 glow-emerald/10" />
          <h3 className="text-lg font-bold text-white mt-3 font-outfit">MFA Setup Activated</h3>
          <p className="text-xs text-gray-400 mt-1">This device has been authenticated, trusted, and linked to your profile.</p>
        </div>

        {/* Recovery codes display */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block text-center">Your Backup Recovery Codes</span>
          <div className="bg-black/55 p-4 rounded-xl border border-card-border">
            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-center font-semibold text-indigo-300">
              {mfaData?.recoveryCodes?.map((code: string, idx: number) => (
                <div key={idx} className="bg-black/30 border border-white/5 py-1.5 rounded select-all">
                  {code}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={copyRecoveryCodes}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-xs font-semibold py-2.5 text-white border border-card-border cursor-pointer transition-all"
            >
              {copiedCodes ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  Recovery Codes Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-gray-400" />
                  Copy Recovery Codes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Setup Authenticator Info */}
        <div className="flex flex-col sm:flex-row items-center gap-6 justify-center bg-gray-950/40 p-4 rounded-xl border border-card-border text-xs">
          {mfaData?.qrCodeUrl ? (
            <img src={mfaData.qrCodeUrl} alt="MFA QR Code" className="h-28 w-28 rounded bg-white p-1" />
          ) : (
            <div className="h-28 w-28 border border-card-border flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          
          <div className="flex-1 space-y-2">
            <span className="text-[9px] font-bold text-indigo-400 block uppercase tracking-wider">Add to Authenticator (Optional)</span>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Scan this code in Google Authenticator or copy the key below to generate codes on this device:
            </p>
            <code className="text-xs font-semibold text-indigo-200 select-all block bg-black/40 px-2 py-1 rounded font-mono truncate border border-white/5">
              {mfaData?.secret}
            </code>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3 text-xs text-amber-300">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <span className="font-bold uppercase tracking-wider block mb-0.5">Critical Recovery Notice</span>
            Store recovery codes in a safe place. They will not be displayed again.
          </div>
        </div>

        <button
          onClick={() => router.replace('/')}
          className="btn-primary w-full py-3 text-xs font-bold flex justify-center items-center gap-1 shadow-lg shadow-indigo-600/30"
        >
          Go to Dashboard
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function MfaSetupLinkPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070b14] py-12 px-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#070b14] to-[#070b14]">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center text-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          <h3 className="text-md font-bold text-white mt-4 font-outfit">Loading Page...</h3>
        </div>
      }>
        <MfaSetupLinkContent />
      </Suspense>
    </div>
  );
}
