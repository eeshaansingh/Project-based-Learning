'use client';

import React, { useState, useEffect } from 'react';
import NavigationShell from '@/components/NavigationShell';
import { 
  BrainCircuit, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  Loader2, 
  HelpCircle,
  ArrowRight,
  Info
} from 'lucide-react';

export default function SmartDisputePage() {
  const [description, setDescription] = useState('');
  const [suspectUpiId, setSuspectUpiId] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [disputesHistory, setDisputesHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const samplePrompts = [
    {
      label: 'Network Crash / Timeout',
      text: 'I tried to pay the shopkeeper but the app crashed and my money is gone but he didn\'t get it.',
    },
    {
      label: 'Merchant Non-Receipt',
      text: 'Money was deducted from my account but the merchant says they never received it.',
    },
    {
      label: 'Unauthorized Payment',
      text: 'I don\'t recognize this transaction. I never made this payment.',
    },
    {
      label: 'Duplicate Charge',
      text: 'I was charged twice for the same payment.',
    },
    {
      label: 'Wrong Recipient',
      text: 'I entered the wrong UPI ID and sent the money to someone else.',
    },
    {
      label: 'Fake Support Scam',
      text: 'I was tricked into sending money to a fake customer support person.',
    },
  ];

  useEffect(() => {
    fetchDisputes();
  }, []);

  async function fetchDisputes() {
    try {
      const res = await fetch('/api/support/disputes');
      if (res.ok) {
        const data = await res.json();
        setDisputesHistory(data.disputes || []);
      }
    } catch (e) {
      console.error('Failed to fetch disputes:', e);
    } finally {
      setLoadingHistory(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please enter your complaint text.');
      return;
    }

    setError(null);
    setAnalyzing(true);
    setResult(null);

    try {
      const res = await fetch('/api/support/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawDescription: description,
          suspectUpiId: suspectUpiId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to classify dispute.');
      }

      setResult(data);
      fetchDisputes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <NavigationShell>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6e6f6a]">
            <BrainCircuit className="h-4 w-4 text-[#1f1f1f]" />
            Support & Resolution
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1f1f1f] font-outfit">
            AI/NLP Smart Dispute Categorizer
          </h1>
          <p className="mt-1 text-xs text-[#6e6f6a]">
            Describe what happened in your own words. Our simulated bank NLP routing engine will analyze the complaint, extract key issue patterns, and route it to the correct reconciliation workflow.
          </p>
        </div>

        {/* Prototype Disclaimer Alert */}
        <div className="rounded-xl border border-[#e3e4d9] bg-white p-4 shadow-xs flex items-start gap-3">
          <Info className="h-5 w-5 text-[#1f1f1f] shrink-0 mt-0.5" />
          <div className="text-xs text-[#6e6f6a]">
            <span className="font-bold text-[#1f1f1f]">Simulated Bank Routing Engine:</span> Non-fraud disputes (such as network timeouts or duplicate charges) are routed to payment status reconciliation without freezing recipient accounts. Fraud reports undergo dual-layer risk evaluation before any temporary debit hold is applied.
          </div>
        </div>

        {/* Main Form & Sample Prompts */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Form Area */}
          <div className="md:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="rounded-2xl border border-[#e3e4d9] bg-white p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-[#1f1f1f]">What happened?</h2>

              <div>
                <label className="block text-xs font-semibold text-[#1f1f1f] mb-1.5">
                  Describe your complaint
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened in your own words (e.g. 'I tried to pay the shopkeeper but the app crashed and my money is gone...')"
                  className="w-full rounded-xl border border-[#e3e4d9] bg-[#fdfdfc] p-3 text-xs text-[#1f1f1f] placeholder:text-[#a0a199] focus:border-[#1f1f1f] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1f1f1f] mb-1.5">
                  Suspected Recipient / UPI ID <span className="text-[#8a8b84] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={suspectUpiId}
                  onChange={(e) => setSuspectUpiId(e.target.value)}
                  placeholder="e.g. merchant@upi or rahul@upi"
                  className="w-full rounded-xl border border-[#e3e4d9] bg-[#fdfdfc] px-3.5 py-2.5 text-xs text-[#1f1f1f] placeholder:text-[#a0a199] focus:border-[#1f1f1f] focus:outline-none transition-all"
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
                disabled={analyzing}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1f1f1f] px-4 py-3 text-xs font-bold text-white hover:bg-black transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing Complaint with NLP...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="h-4 w-4" />
                    Analyze Dispute & Route to Bank
                  </>
                )}
              </button>
            </form>

            {/* Analysis Result Display Card */}
            {result && (
              <div className="rounded-2xl border border-[#e3e4d9] bg-white p-6 shadow-sm space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-[#e3e4d9] pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-sm font-bold text-[#1f1f1f]">Classification Result</h3>
                  </div>
                  <span className="rounded-full bg-[#f4f4f4] px-3 py-1 text-[11px] font-mono font-bold text-[#1f1f1f] border border-[#e3e4d9]">
                    Case #{result.disputeId.substring(0, 8)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-[#f6f7ed] p-3 border border-[#e3e4d9]">
                    <p className="text-[10px] font-bold text-[#6e6f6a] uppercase">Detected Issue Category</p>
                    <p className="mt-1 text-xs font-bold text-[#1f1f1f]">{result.category}</p>
                  </div>
                  <div className="rounded-xl bg-[#f6f7ed] p-3 border border-[#e3e4d9]">
                    <p className="text-[10px] font-bold text-[#6e6f6a] uppercase">Confidence Rating</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1 bg-[#e3e4d9] h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#1f1f1f] h-full rounded-full transition-all"
                          style={{ width: `${Math.round(result.confidence * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-[#1f1f1f]">
                        {Math.round(result.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#fdfdfc] p-3.5 border border-[#e3e4d9] text-xs space-y-1.5">
                  <p className="font-bold text-[#1f1f1f]">NLP System Reasoning:</p>
                  <p className="text-[#6e6f6a]">{result.reason}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#6e6f6a]">Recommended Route: </span>
                    <span className="text-xs font-bold text-[#1f1f1f] bg-[#f4f4f4] px-2.5 py-1 rounded-md border border-[#e3e4d9]">
                      {result.recommendedRoute}
                    </span>
                  </div>

                  {result.fraudReportResult && result.fraudReportResult.holdApplied && (
                    <div className="flex items-center gap-1.5 rounded-full bg-red-100 text-red-800 border border-red-200 px-3 py-1 text-[11px] font-bold">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Fraud Hold Activated ({result.fraudReportResult.suspectUpiId})
                    </div>
                  )}

                  {result.requiresHumanReview && (
                    <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 text-[11px] font-bold">
                      Flagged for Human Review
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sample Prompts Sidebar */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#e3e4d9] bg-white p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6e6f6a]">
                Quick Test Prompts
              </h3>
              <p className="text-[11px] text-[#6e6f6a]">
                Click any benchmark scenario below to populate the complaint description:
              </p>
              <div className="space-y-2">
                {samplePrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDescription(prompt.text)}
                    className="w-full text-left rounded-xl border border-[#e3e4d9] bg-[#fdfdfc] p-2.5 text-xs text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white transition-all cursor-pointer group"
                  >
                    <div className="font-bold flex items-center justify-between text-[11px]">
                      <span>{prompt.label}</span>
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                    <p className="text-[10px] text-[#8a8b84] group-hover:text-gray-300 truncate mt-0.5">
                      "{prompt.text}"
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* History of Submitted Disputes */}
        <div className="rounded-2xl border border-[#e3e4d9] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#1f1f1f]">Your Submitted Disputes</h2>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-6 text-xs text-[#6e6f6a]">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading disputes...
            </div>
          ) : disputesHistory.length === 0 ? (
            <p className="text-xs text-[#8a8b84] italic text-center py-6">
              No disputes submitted yet. Use the form above to analyze a complaint.
            </p>
          ) : (
            <div className="divide-y divide-[#e3e4d9]">
              {disputesHistory.map((d) => (
                <div key={d.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1f1f1f]">{d.predictedType}</span>
                      <span className="text-[10px] font-mono text-[#8a8b84]">#{d.id.substring(0, 8)}</span>
                      {d.requiresHumanReview && (
                        <span className="rounded bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5">
                          REVIEW RECOMMENDED
                        </span>
                      )}
                    </div>
                    <p className="text-[#6e6f6a] truncate">"{d.rawDescription}"</p>
                    <p className="text-[10px] text-[#8a8b84]">
                      Route: <span className="font-mono">{d.recommendedRoute}</span> | {new Date(d.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-[#1f1f1f]">
                      {Math.round(d.confidence * 100)}%
                    </span>
                    <p className="text-[10px] font-semibold text-[#6e6f6a]">{d.routingStatus}</p>
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
