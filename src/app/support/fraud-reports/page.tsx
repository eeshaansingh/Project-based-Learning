'use client';

import React, { useState, useEffect } from 'react';
import NavigationShell from '@/components/NavigationShell';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Send, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  Info,
  Building2,
  FileText
} from 'lucide-react';

export default function FraudReportsPage() {
  const [suspectUpiId, setSuspectUpiId] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('MALICIOUS_FRAUD');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    try {
      const res = await fetch('/api/support/fraud-reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (e) {
      console.error('Failed to fetch fraud reports:', e);
    } finally {
      setLoadingReports(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspectUpiId.trim() || !description.trim()) {
      setError('Suspected UPI ID and detailed complaint description are required.');
      return;
    }

    setError(null);
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/support/fraud-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suspectUpiId: suspectUpiId.trim(),
          amount: amount ? Number(amount) : undefined,
          category,
          description: description.trim(),
          evidenceUrl: evidenceUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit fraud report.');
      }

      setResult(data);
      setSuspectUpiId('');
      setAmount('');
      setDescription('');
      setEvidenceUrl('');
      fetchReports();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NavigationShell>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-700">
            <ShieldAlert className="h-4 w-4" />
            Security & Fraud Prevention
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1f1f1f] font-outfit">
            Bank Fraud Reporting & Account Protection
          </h1>
          <p className="mt-1 text-xs text-[#6e6f6a]">
            Report a fraudulent payee or transaction. Submitted reports trigger our bank fraud-response policy evaluation to safeguard users against illicit debit transfers.
          </p>
        </div>

        {/* Prototype Disclaimer Banner */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 flex items-start gap-3 shadow-xs">
          <Info className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Prototype Bank Fraud Response</p>
            <p className="mt-0.5 text-amber-800">
              Account holds shown here are simulated for educational evaluation and do not affect real bank accounts. The maximum simulated temporary debit-hold period is set to <strong>60 DAYS</strong>.
            </p>
          </div>
        </div>

        {/* Form and Submission */}
        <div className="grid gap-6 md:grid-cols-3">
          <form onSubmit={handleSubmit} className="md:col-span-2 rounded-2xl border border-[#e3e4d9] bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#1f1f1f] flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Report Fraudulent Payee / Transaction
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1f1f1f] mb-1">
                  Suspected Recipient UPI ID *
                </label>
                <input
                  type="text"
                  required
                  value={suspectUpiId}
                  onChange={(e) => setSuspectUpiId(e.target.value)}
                  placeholder="e.g. suspect@upi or fakecare@upi"
                  className="w-full rounded-xl border border-[#e3e4d9] bg-[#fdfdfc] px-3.5 py-2.5 text-xs text-[#1f1f1f] focus:border-[#1f1f1f] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1f1f1f] mb-1">
                  Disputed Amount (₹) <span className="text-[#8a8b84] font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 8500"
                  className="w-full rounded-xl border border-[#e3e4d9] bg-[#fdfdfc] px-3.5 py-2.5 text-xs text-[#1f1f1f] focus:border-[#1f1f1f] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1f1f1f] mb-1">
                Fraud Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-[#e3e4d9] bg-[#fdfdfc] px-3.5 py-2.5 text-xs font-semibold text-[#1f1f1f] focus:border-[#1f1f1f] focus:outline-none"
              >
                <option value="MALICIOUS_FRAUD">MALICIOUS_FRAUD (Impersonation / Fake Care Scam)</option>
                <option value="UNAUTHORIZED_TRANSACTION">UNAUTHORIZED_TRANSACTION (Unapproved Payment)</option>
                <option value="SOCIAL_ENGINEERING">SOCIAL_ENGINEERING (Phishing / Tricked)</option>
                <option value="ACCOUNT_TAKEOVER">ACCOUNT_TAKEOVER (Stolen Access / Compromised Session)</option>
                <option value="FAKE_MERCHANT">FAKE_MERCHANT (Fraudulent Storefront)</option>
                <option value="SUSPICIOUS_PAYEE">SUSPICIOUS_PAYEE (Unusual Recipient Activity)</option>
                <option value="OTHER">OTHER (General Security Concern)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1f1f1f] mb-1">
                Detailed Complaint Description *
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the circumstances, interactions, or fake support communications..."
                className="w-full rounded-xl border border-[#e3e4d9] bg-[#fdfdfc] p-3 text-xs text-[#1f1f1f] focus:border-[#1f1f1f] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1f1f1f] mb-1">
                Evidence Link / Attachment <span className="text-[#8a8b84] font-normal">(Optional URL)</span>
              </label>
              <input
                type="text"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-[#e3e4d9] bg-[#fdfdfc] px-3.5 py-2.5 text-xs text-[#1f1f1f] focus:border-[#1f1f1f] focus:outline-none"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-xs font-bold text-white hover:bg-red-800 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting & Evaluating Policy...
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4" />
                  Submit Fraud Report & Evaluate Hold Policy
                </>
              )}
            </button>
          </form>

          {/* Guidelines Sidebar */}
          <div className="rounded-2xl border border-[#e3e4d9] bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6e6f6a]">
              Fraud Policy Sentinel
            </h3>
            <div className="space-y-2 text-xs text-[#6e6f6a]">
              <p>
                When a report is submitted, our backend policy engine automatically evaluates the risk of the reported recipient.
              </p>
              <div className="rounded-xl bg-[#f6f7ed] p-3 border border-[#e3e4d9] text-[11px] font-medium space-y-1">
                <p className="font-bold text-[#1f1f1f]">Automatic Debit Hold Policy:</p>
                <p>High-risk reports trigger an automatic <span className="font-bold font-mono">DEBIT_HOLD_ACTIVE</span> status on the suspect account for up to 60 days.</p>
              </div>
              <p className="text-[10px] text-[#8a8b84]">
                The hold prevents the suspect account from making debit transfers or withdrawals, protecting potential victims during the bank investigation.
              </p>
            </div>
          </div>
        </div>

        {/* Feedback Banner on Submission */}
        {result && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-sm space-y-2 animate-fadeIn">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              Fraud Report Submitted (Report #{result.reportId.substring(0, 8)})
            </div>
            <div className="text-xs text-emerald-900 space-y-1.5">
              <p className="font-semibold">Policy evaluation result: {result.evaluation?.reason}</p>
              
              {result.evaluation?.lienApplied && !result.evaluation?.holdApplied && (
                <div className="rounded-xl bg-amber-100/80 border border-amber-300 p-3 text-amber-900 text-xs font-semibold flex items-center justify-between">
                  <span>⚡ 2026 RBI Automated Lien: Marked ₹{result.evaluation.disputedAmount?.toLocaleString('en-IN')} lock on suspect account ({result.evaluation.suspectUpiId}).</span>
                  <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-amber-200">Quorum: {result.evaluation.quorumCount}/3</span>
                </div>
              )}

              {result.evaluation?.holdApplied && (
                <div className="rounded-xl bg-red-100 border border-red-300 p-3 text-red-900 text-xs font-bold">
                  🚨 AI Quorum & Velocity Threshold Reached ({result.evaluation.quorumCount} Reports in 2h)! Full Temporary Debit Hold applied to suspect account ({result.evaluation.suspectUpiId}).
                </div>
              )}
            </div>
          </div>
        )}

        {/* History of Fraud Reports */}
        <div className="rounded-2xl border border-[#e3e4d9] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#1f1f1f]">Your Reported Fraud Cases</h2>

          {loadingReports ? (
            <div className="flex items-center justify-center py-6 text-xs text-[#6e6f6a]">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading reports...
            </div>
          ) : reports.length === 0 ? (
            <p className="text-xs text-[#8a8b84] italic text-center py-6">
              No fraud reports filed yet.
            </p>
          ) : (
            <div className="divide-y divide-[#e3e4d9]">
              {reports.map((r) => (
                <div key={r.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1f1f1f]">{r.category}</span>
                      <span className="text-[10px] font-mono text-[#8a8b84]">#{r.id.substring(0, 8)}</span>
                      <span className="rounded bg-[#f4f4f4] text-[#1f1f1f] text-[10px] font-mono font-bold px-2 py-0.5 border border-[#e3e4d9]">
                        Target: {r.suspectUpiId}
                      </span>
                    </div>
                    <p className="text-[#6e6f6a] truncate">"{r.description}"</p>
                    <p className="text-[10px] text-[#8a8b84]">
                      Reported on {new Date(r.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block font-extrabold text-[10px] px-2.5 py-1 rounded-full border ${
                      r.status === 'HOLD_ACTIVE' ? 'bg-red-100 text-red-800 border-red-200' :
                      r.status === 'CLEARED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                      'bg-amber-100 text-amber-800 border-amber-200'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </NavigationShell>
  );
}
