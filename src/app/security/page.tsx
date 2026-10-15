'use client';

import React, { useState, useEffect } from 'react';
import NavigationShell from '@/components/NavigationShell';
import { 
  Shield, 
  Key, 
  Users, 
  Smartphone, 
  Activity, 
  Save, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  Check, 
  Copy, 
  Loader2, 
  LogOut,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  RefreshCw,
  QrCode
} from 'lucide-react';
import { useRouter } from 'next/navigation';

type Tab = 'RULES' | 'MFA' | 'PAYEES' | 'SESSIONS' | 'LOGS';

export default function SecurityPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('RULES');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Data States
  const [rules, setRules] = useState<any>({});
  const [payees, setPayees] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  // Add Trusted Payee Form State
  const [payeeName, setPayeeName] = useState('');
  const [payeeUpiId, setPayeeUpiId] = useState('');
  const [payeeLimit, setPayeeLimit] = useState('');
  const [payeeTotpCode, setPayeeTotpCode] = useState('');

  // Re-enroll MFA State
  const [reconfiguringMfa, setReconfiguringMfa] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // One-Time Setup Link State
  const [setupLink, setSetupLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    loadTabContent(activeTab);
  }, [activeTab]);

  const loadTabContent = async (tab: Tab) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      if (tab === 'RULES') {
        const res = await fetch('/api/security/rules');
        const data = await res.json();
        if (res.ok) setRules(data.rules);
      } else if (tab === 'PAYEES') {
        const res = await fetch('/api/security/trusted-payees');
        const data = await res.json();
        if (res.ok) setPayees(data.payees);
      } else if (tab === 'SESSIONS') {
        const res = await fetch('/api/security/sessions');
        const data = await res.json();
        if (res.ok) setSessions(data.sessions);
      } else if (tab === 'LOGS') {
        const res = await fetch('/api/security/logs');
        const data = await res.json();
        if (res.ok) setLogs(data.logs);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/security/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules),
      });
      const data = await res.json();
      if (res.ok) {
        setRules(data.rules);
        setSuccessMsg('Security rules updated successfully!');
      } else {
        setError(data.error || 'Failed to update rules');
      }
    } catch (err) {
      setError('An error occurred saving rules');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTrustedPayee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payeeName || !payeeUpiId || !payeeTotpCode) {
      setError('Please fill in Name, UPI ID, and MFA Verification code');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/security/trusted-payees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payeeName,
          upiId: payeeUpiId,
          limitAmount: payeeLimit ? Number(payeeLimit) : null,
          code: payeeTotpCode
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPayees(prev => [data.payee, ...prev]);
        setSuccessMsg(`Successfully added ${payeeName} as trusted!`);
        setPayeeName('');
        setPayeeUpiId('');
        setPayeeLimit('');
        setPayeeTotpCode('');
      } else {
        setError(data.error || 'Failed to add payee');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTrustedPayee = async (payeeId: string, payeeName: string) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/security/trusted-payees?id=${payeeId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPayees(prev => prev.filter(p => p.id !== payeeId));
        setSuccessMsg(`Removed ${payeeName} from trusted list`);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to remove payee');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/security/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_single', sessionId }),
      });
      if (res.ok) {
        if (isCurrent) {
          router.replace('/login');
        } else {
          setSessions(prev => prev.filter(s => s.id !== sessionId));
          setSuccessMsg('Session terminated successfully');
        }
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to revoke session');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutAllOthers = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/security/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_all_others' }),
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.isCurrent));
        setSuccessMsg('Signed out of all other sessions');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to sign out other sessions');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSessionTrust = async (sessionId: string, currentTrust: boolean) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/security/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_trust', sessionId, isTrusted: !currentTrust }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, isTrusted: data.session.isTrusted } : s));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateReconfigure = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/mfa-setup');
      const data = await res.json();
      if (res.ok) {
        setMfaSecret(data.secret);
        setQrCodeUrl(data.qrCodeUrl);
        setReconfiguringMfa(true);
      } else {
        setError(data.error || 'Failed to configure MFA');
      }
    } catch (err) {
      setError('Connection error configuring MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReconfigure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode) {
      setError('Please enter code');
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
        setSuccessMsg('Authenticator App successfully reconfigured!');
        setMfaCode('');
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleGenerateSetupLink = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/security/mfa-setup-link', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setSetupLink(data.link);
        setSuccessMsg('One-time MFA Setup Link generated successfully!');
      } else {
        setError(data.error || 'Failed to generate setup link');
      }
    } catch (err) {
      setError('Connection error generating setup link');
    } finally {
      setLoading(false);
    }
  };

  const copySetupLink = () => {
    if (setupLink) {
      navigator.clipboard.writeText(setupLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const tabs = [
    { id: 'RULES', name: 'Rules', icon: Shield },
    { id: 'MFA', name: 'MFA Setup', icon: Key },
    { id: 'PAYEES', name: 'Trusted Payees', icon: Users },
    { id: 'SESSIONS', name: 'Sessions', icon: Smartphone },
    { id: 'LOGS', name: 'Security Log', icon: Activity },
  ] as const;

  return (
    <NavigationShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1f1f1f] font-outfit">Security & Verification</h1>
          <p className="text-xs text-[#6e6f6a] mt-0.5">Configure your adaptive MFA thresholds, manage devices, and audit log entries.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#e3e4d9] overflow-x-auto gap-2 py-1 select-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 cursor-pointer transition-all ${
                  isActive 
                    ? 'border-[#1f1f1f] text-[#1f1f1f] font-bold' 
                    : 'border-transparent text-[#8a8b84] hover:text-[#1f1f1f]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* Alerts display */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 animate-scale-up">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="rounded-xl border border-[#e3e4d9] bg-white p-3.5 text-xs text-[#1f1f1f] font-bold shadow-xs animate-scale-up">
            {successMsg}
          </div>
        )}

        {/* TAB 1: Authentication Rules */}
        {activeTab === 'RULES' && (
          <div className="glass-panel rounded-2xl p-6 bg-white border border-[#e3e4d9]">
            <h3 className="text-sm font-bold text-[#1f1f1f] mb-6 font-outfit">Adaptive MFA Risk Parameters</h3>
            <form onSubmit={handleSaveRules} className="space-y-6">
              
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="threshold" className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">Additional Verification Threshold (₹)</label>
                  <input
                    id="threshold"
                    type="number"
                    value={rules.stepUpThreshold || ''}
                    onChange={(e) => setRules({ ...rules, stepUpThreshold: Number(e.target.value) })}
                    className="input-field w-full text-sm font-mono"
                    placeholder="15000"
                  />
                  <span className="text-[9px] text-[#6e6f6a] block">Payments larger than this demand TOTP authenticator verification.</span>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="limit" className="text-[10px] font-bold text-[#6e6f6a] uppercase tracking-wider block">Daily Spending Limit (₹)</label>
                  <input
                    id="limit"
                    type="number"
                    value={rules.dailyLimit || ''}
                    onChange={(e) => setRules({ ...rules, dailyLimit: Number(e.target.value) })}
                    className="input-field w-full text-sm font-mono"
                    placeholder="50000"
                  />
                  <span className="text-[9px] text-[#6e6f6a] block">Absolute limit. Any transactions causing volume to go above this will block.</span>
                </div>
              </div>

              <div className="border-t border-[#e3e4d9] pt-6 space-y-4">
                {/* Toggle 1: New Payees */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-xs font-bold text-[#1f1f1f] block">MFA for new payees</span>
                    <span className="text-[10px] text-[#6e6f6a]">Require TOTP step-up if sending to a recipient for the first time.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRules({ ...rules, requireMfaNewPayees: !rules.requireMfaNewPayees })}
                    className="text-[#1f1f1f] transition-colors cursor-pointer"
                  >
                    {rules.requireMfaNewPayees ? <ToggleRight className="h-8 w-8 text-[#1f1f1f] fill-[#1f1f1f]" /> : <ToggleLeft className="h-8 w-8 text-[#9e9f98]" />}
                  </button>
                </div>

                {/* Toggle 2: New Devices */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-xs font-bold text-[#1f1f1f] block">MFA from untrusted devices</span>
                    <span className="text-[10px] text-[#6e6f6a]">Trigger step-up if session device identifier is untrusted/new.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRules({ ...rules, requireMfaNewDevices: !rules.requireMfaNewDevices })}
                    className="text-[#1f1f1f] transition-colors cursor-pointer"
                  >
                    {rules.requireMfaNewDevices ? <ToggleRight className="h-8 w-8 text-[#1f1f1f] fill-[#1f1f1f]" /> : <ToggleLeft className="h-8 w-8 text-[#9e9f98]" />}
                  </button>
                </div>

                {/* Toggle 3: Trusted Payees */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-xs font-bold text-[#1f1f1f] block">Enable trusted payees bypass</span>
                    <span className="text-[10px] text-[#6e6f6a]">Trusted payees can bypass the new payee rule (high value rules still apply).</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRules({ ...rules, allowTrustedPayees: !rules.allowTrustedPayees })}
                    className="text-[#1f1f1f] transition-colors cursor-pointer"
                  >
                    {rules.allowTrustedPayees ? <ToggleRight className="h-8 w-8 text-[#1f1f1f] fill-[#1f1f1f]" /> : <ToggleLeft className="h-8 w-8 text-[#9e9f98]" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto text-xs py-2.5"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Save className="h-4 w-4" />}
                Save Security Rules
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: Authenticator / Reconfiguration */}
        {activeTab === 'MFA' && (
          <div className="glass-panel rounded-2xl p-6 bg-white border border-[#e3e4d9] space-y-6">
            <h3 className="text-sm font-bold text-[#1f1f1f] mb-2 font-outfit">Authenticator Configuration</h3>
            
            {!reconfiguringMfa ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#f4f4f4] border border-[#e3e4d9] text-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#1f1f1f] text-white">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-bold text-[#1f1f1f] block">MFA Status: ENABLED</span>
                      <span className="text-[#6e6f6a]">Your account is protected by adaptive TOTP codes.</span>
                    </div>
                  </div>
                  <button
                    onClick={handleInitiateReconfigure}
                    className="flex items-center gap-1.5 rounded-xl border border-[#e3e4d9] bg-white px-3 py-1.5 text-xs font-bold text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white transition-all cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reconfigure App
                  </button>
                </div>

                {/* One-Time MFA Setup Link Section */}
                <div className="border-t border-[#e3e4d9] pt-6 space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[#1f1f1f] uppercase tracking-wider">New Device Onboarding Link</h4>
                    <p className="text-[10px] text-[#6e6f6a]">
                      Generate a secure, one-time link to log in and automatically configure/reset your MFA on a new device.
                    </p>
                  </div>
                  
                  {setupLink ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 bg-[#f4f4f4] border border-[#e3e4d9] rounded-xl p-3">
                        <code className="text-xs font-mono text-[#1f1f1f] select-all truncate flex-1 font-semibold">{setupLink}</code>
                        <button
                          type="button"
                          onClick={copySetupLink}
                          className="rounded-lg p-1.5 hover:bg-white text-[#1f1f1f] transition-colors cursor-pointer"
                          title="Copy Link"
                        >
                          {copiedLink ? <Check className="h-4 w-4 text-[#1f1f1f]" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                      <span className="text-[9px] text-[#1f1f1f] font-bold block uppercase tracking-wider">
                        ⚠️ This link is single-use only and expires in 15 minutes.
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGenerateSetupLink}
                      disabled={loading}
                      className="btn-primary flex items-center gap-1.5 text-xs py-2.5"
                    >
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : <Smartphone className="h-3.5 w-3.5" />}
                      Generate Setup Link
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleCompleteReconfigure} className="space-y-6 animate-fade-in border-t border-[#e3e4d9] pt-4">
                {recoveryCodes.length === 0 ? (
                  <>
                    <div className="text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f4f4] border border-[#e3e4d9] text-[#1f1f1f]">
                        <QrCode className="h-5 w-5" />
                      </div>
                      <h4 className="text-sm font-bold text-[#1f1f1f] mt-2">Link Authenticator Key</h4>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center bg-[#f4f4f4] p-4 rounded-xl border border-[#e3e4d9] text-xs">
                      {qrCodeUrl ? (
                        <img src={qrCodeUrl} alt="MFA QR Code" className="h-32 w-32 rounded bg-white p-1 border border-[#e3e4d9]" />
                      ) : (
                        <div className="h-32 w-32 border border-[#e3e4d9] flex items-center justify-center bg-white">
                          <Loader2 className="h-5 w-5 animate-spin text-[#1f1f1f]" />
                        </div>
                      )}
                      
                      <div className="flex-1 space-y-2">
                        <span className="text-[10px] font-bold text-[#1f1f1f] block uppercase">Manual Key Entry</span>
                        <code className="text-xs font-semibold text-[#1f1f1f] select-all block bg-white px-2 py-1 rounded border border-[#e3e4d9] font-mono truncate">
                          {mfaSecret}
                        </code>
                        <p className="text-[#6e6f6a] leading-relaxed text-[11px]">
                          Scan the code or enter the key manually inside Google Authenticator.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[#6e6f6a] uppercase block text-center">Verification Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                        className="input-field w-full text-center tracking-[0.5em] text-lg font-bold font-mono"
                        placeholder="000000"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button type="submit" disabled={loading} className="btn-primary flex-1 flex justify-center items-center gap-2 text-xs py-2.5">
                        {loading && <Loader2 className="h-4 w-4 animate-spin text-white" />}
                        Confirm Configuration
                      </button>
                      <button type="button" onClick={() => setReconfiguringMfa(false)} className="rounded-xl border border-[#e3e4d9] px-4 py-2.5 text-xs font-semibold text-[#1f1f1f] hover:bg-[#f4f4f4] cursor-pointer">
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f1f1f] text-white">
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                      <h4 className="text-sm font-bold text-[#1f1f1f] mt-2 font-outfit">New Recovery Keys Generated</h4>
                      <p className="text-xs text-[#6e6f6a] mt-1">Copy and save these codes immediately.</p>
                    </div>

                    <div className="bg-[#f4f4f4] p-4 rounded-xl border border-[#e3e4d9]">
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono text-center text-[#1f1f1f] font-bold">
                        {recoveryCodes.map((code, idx) => (
                          <div key={idx} className="bg-white border border-[#e3e4d9] py-1.5 rounded">{code}</div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={copyRecoveryCodes}
                        className="mt-4 flex w-full justify-center items-center gap-2 rounded-xl bg-white border border-[#e3e4d9] py-2 text-xs font-bold text-[#1f1f1f] cursor-pointer hover:bg-[#1f1f1f] hover:text-white transition-all shadow-xs"
                      >
                        {copiedCodes ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copiedCodes ? 'Recovery Keys Copied!' : 'Copy Recovery Keys'}
                      </button>
                    </div>

                    <button type="button" onClick={() => { setReconfiguringMfa(false); setRecoveryCodes([]); }} className="btn-primary w-full py-2.5 text-xs">
                      Close Configurator
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        )}

        {/* TAB 3: Trusted Payees */}
        {activeTab === 'PAYEES' && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Payee addition form */}
            <div className="glass-panel rounded-2xl p-6 bg-white border border-[#e3e4d9] h-fit">
              <h3 className="text-sm font-bold text-[#1f1f1f] mb-4 font-outfit">Add Trusted Payee</h3>
              <form onSubmit={handleAddTrustedPayee} className="space-y-4">
                
                <div className="space-y-1">
                  <label htmlFor="pname" className="text-[10px] font-bold text-[#6e6f6a] uppercase block">Recipient Name</label>
                  <input
                    id="pname"
                    type="text"
                    required
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    className="input-field w-full text-xs"
                    placeholder="Rahul"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="pupi" className="text-[10px] font-bold text-[#6e6f6a] uppercase block">UPI ID</label>
                  <input
                    id="pupi"
                    type="text"
                    required
                    value={payeeUpiId}
                    onChange={(e) => setPayeeUpiId(e.target.value)}
                    className="input-field w-full text-xs font-mono"
                    placeholder="rahul@upi"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="plimit" className="text-[10px] font-bold text-[#6e6f6a] uppercase block">Payee Transaction Limit (Optional, ₹)</label>
                  <input
                    id="plimit"
                    type="number"
                    value={payeeLimit}
                    onChange={(e) => setPayeeLimit(e.target.value)}
                    className="input-field w-full text-xs font-mono"
                    placeholder="10000"
                  />
                  <span className="text-[8px] text-[#6e6f6a] block">Overrides threshold. Above this limit requires MFA.</span>
                </div>

                {/* MFA Verification Prompt */}
                <div className="border-t border-[#e3e4d9] pt-4 space-y-2">
                  <div className="rounded-xl border border-[#e3e4d9] bg-[#f4f4f4] p-3 flex gap-2 text-[10px] text-[#1f1f1f]">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-[#1f1f1f]" />
                    <span>Before adding a payee as trusted, require TOTP verification.</span>
                  </div>
                  <label htmlFor="ptotp" className="text-[10px] font-bold text-[#1f1f1f] uppercase block">Authenticator Code</label>
                  <input
                    id="ptotp"
                    type="text"
                    maxLength={6}
                    required
                    value={payeeTotpCode}
                    onChange={(e) => setPayeeTotpCode(e.target.value.replace(/\D/g, ''))}
                    className="input-field w-full text-center text-sm font-semibold tracking-widest font-mono"
                    placeholder="000000"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full flex justify-center items-center gap-2 cursor-pointer mt-2 text-xs py-2.5"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Plus className="h-4 w-4" />}
                  Verify & Add Trusted Payee
                </button>
              </form>
            </div>

            {/* Payee list */}
            <div className="glass-panel rounded-2xl p-6 bg-white border border-[#e3e4d9] space-y-4">
              <h3 className="text-sm font-bold text-[#1f1f1f] font-outfit">Trusted Payees List</h3>
              
              <div className="space-y-2.5 overflow-y-auto max-h-[360px]">
                {payees.filter(p => p.isTrusted).length > 0 ? (
                  payees.filter(p => p.isTrusted).map((payee) => (
                    <div key={payee.id} className="flex items-center justify-between p-3 rounded-xl bg-[#f4f4f4] border border-[#e3e4d9]">
                      <div>
                        <p className="text-xs font-bold text-[#1f1f1f]">{payee.name}</p>
                        <p className="text-[10px] text-[#6e6f6a] font-mono mt-0.5">{payee.upiId}</p>
                        {payee.limitAmount && (
                          <span className="text-[9px] text-[#1f1f1f] font-bold block mt-1 font-mono">
                            Custom limit: ₹{payee.limitAmount.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      
                      <button
                        onClick={() => handleRemoveTrustedPayee(payee.id, payee.name)}
                        className="rounded-lg p-2 text-[#6e6f6a] hover:bg-white hover:text-red-600 cursor-pointer transition-colors"
                        title="Remove Trust"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-[#6e6f6a] border border-dashed border-[#e3e4d9] rounded-xl bg-[#f4f4f4]/40">
                    No trusted payees configured.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Active Sessions / Devices */}
        {activeTab === 'SESSIONS' && (
          <div className="glass-panel rounded-2xl p-6 bg-white border border-[#e3e4d9] space-y-6">
            <div className="flex items-center justify-between border-b border-[#e3e4d9] pb-4">
              <div>
                <h3 className="text-sm font-bold text-[#1f1f1f] font-outfit">Active Devices</h3>
                <p className="text-[11px] text-[#6e6f6a] mt-0.5">Revoke active sessions or toggle device trust to test Rule 6.</p>
              </div>
              <button
                onClick={handleSignOutAllOthers}
                className="flex items-center gap-1.5 rounded-xl border border-[#e3e4d9] bg-white px-3 py-1.5 text-xs font-bold text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white transition-all cursor-pointer shadow-xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out Other Devices
              </button>
            </div>

            <div className="space-y-3">
              {sessions.map((session) => (
                <div 
                  key={session.id} 
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border ${
                    session.isCurrent 
                      ? 'bg-[#f4f4f4] border-[#1f1f1f]' 
                      : 'bg-white border-[#e3e4d9]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#1f1f1f]">{session.deviceOs} • {session.deviceBrowser}</span>
                      {session.isCurrent && (
                        <span className="text-[9px] bg-[#1f1f1f] text-white font-bold px-2 py-0.5 rounded tracking-wider uppercase select-none">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#6e6f6a] font-mono">IP: {session.ipAddress}</p>
                    <p className="text-[9px] text-[#8a8b84]">
                      Last active: {new Date(session.lastActiveAt).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="mt-4 sm:mt-0 flex items-center gap-3 justify-end">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#6e6f6a] font-bold">Device Trust:</span>
                      <button
                        onClick={() => handleToggleSessionTrust(session.id, session.isTrusted)}
                        className={`text-[9px] font-bold border rounded-lg px-2.5 py-1 uppercase transition-all cursor-pointer ${
                          session.isTrusted 
                            ? 'bg-[#1f1f1f] border-[#1f1f1f] text-white' 
                            : 'bg-[#f4f4f4] border-[#e3e4d9] text-[#6e6f6a]'
                        }`}
                        title="Toggle session trust state for testing rule 6"
                      >
                        {session.isTrusted ? 'Trusted' : 'Untrusted'}
                      </button>
                    </div>

                    <button
                      onClick={() => handleRevokeSession(session.id, session.isCurrent)}
                      className="rounded-lg p-2 text-[#6e6f6a] hover:bg-[#f4f4f4] hover:text-[#1f1f1f] cursor-pointer"
                      title={session.isCurrent ? 'Log Out' : 'Revoke Session'}
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: Security Activity Audit Logs */}
        {activeTab === 'LOGS' && (
          <div className="glass-panel rounded-2xl p-6 bg-white border border-[#e3e4d9] space-y-4">
            <h3 className="text-sm font-bold text-[#1f1f1f] font-outfit">Security Activity Ticker</h3>
            
            <div className="space-y-2.5 overflow-y-auto max-h-[420px] pr-2">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-[#f4f4f4] border border-[#e3e4d9] text-xs flex justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-[#1f1f1f] text-white">
                          {log.eventType.replace(/_/g, ' ')}
                        </span>
                        
                        {log.deviceIdentifier && (
                          <span className="text-[10px] text-[#6e6f6a] font-semibold">via {log.deviceIdentifier}</span>
                        )}
                      </div>
                      
                      {log.metadata && (
                        <p className="text-[11px] text-[#1f1f1f] mt-1 leading-relaxed">
                          {log.metadata.message || JSON.stringify(log.metadata)}
                        </p>
                      )}
                    </div>

                    <span className="text-[9px] text-[#8a8b84] whitespace-nowrap self-start mt-0.5 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-[#6e6f6a] border border-dashed border-[#e3e4d9] rounded-xl bg-[#f4f4f4]/40">
                  No security events found.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </NavigationShell>
  );
}
