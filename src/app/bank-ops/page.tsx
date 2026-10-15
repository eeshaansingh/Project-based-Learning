'use client';

import React, { useState, useEffect } from 'react';
import NavigationShell from '@/components/NavigationShell';
import { 
  Building2, 
  ShieldAlert, 
  AlertTriangle, 
  BrainCircuit, 
  FileCheck, 
  Activity, 
  Loader2, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  UserCheck, 
  RefreshCw,
  Search,
  Info,
  Scale,
  Zap,
  Users
} from 'lucide-react';

export default function BankOpsDashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'LIENS' | 'HOLDS' | 'FRAUD' | 'DISPUTES' | 'CASES' | 'AUDIT'>('LIENS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab Data States
  const [liens, setLiens] = useState<any[]>([]);
  const [holds, setHolds] = useState<any[]>([]);
  const [fraudReports, setFraudReports] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Release Hold Modal State
  const [selectedHold, setSelectedHold] = useState<any>(null);
  const [selectedLien, setSelectedLien] = useState<any>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
    fetchTabData(activeTab);
  }, [activeTab]);

  async function fetchMetrics() {
    try {
      const res = await fetch('/api/bank-ops/metrics');
      if (res.status === 403) {
        setError('Access denied. You require BANK_OPERATOR or BANK_ADMIN privileges to view this console.');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
      }
    } catch (e) {
      console.error('Metrics fetch error:', e);
    }
  }

  async function fetchTabData(tab: string) {
    setLoading(true);
    setActionSuccessMsg(null);
    try {
      if (tab === 'LIENS') {
        const res = await fetch('/api/bank-ops/liens');
        if (res.ok) setLiens((await res.json()).liens || []);
      } else if (tab === 'HOLDS') {
        const res = await fetch('/api/bank-ops/holds');
        if (res.ok) setHolds((await res.json()).holds || []);
      } else if (tab === 'FRAUD') {
        const res = await fetch('/api/bank-ops/fraud-reports');
        if (res.ok) setFraudReports((await res.json()).reports || []);
      } else if (tab === 'DISPUTES') {
        const res = await fetch('/api/bank-ops/disputes');
        if (res.ok) setDisputes((await res.json()).disputes || []);
      } else if (tab === 'CASES') {
        const res = await fetch('/api/bank-ops/investigations');
        if (res.ok) setCases((await res.json()).cases || []);
      } else if (tab === 'AUDIT') {
        const res = await fetch('/api/security/logs');
        if (res.ok) setAuditLogs((await res.json()).logs || []);
      }
    } catch (e) {
      console.error('Tab data fetch error:', e);
    } finally {
      setLoading(false);
    }
  }

  const handleReleaseHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHold || !releaseReason.trim()) return;

    setReleasing(true);
    try {
      const res = await fetch('/api/bank-ops/holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freezeId: selectedHold.id,
          releaseReason: releaseReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to release debit hold.');

      setActionSuccessMsg(`Successfully released debit hold for account (${selectedHold.account?.upiId}).`);
      setSelectedHold(null);
      setReleaseReason('');
      fetchMetrics();
      fetchTabData('HOLDS');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReleasing(false);
    }
  };

  const handleReleaseLien = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLien || !releaseReason.trim()) return;

    setReleasing(true);
    try {
      const res = await fetch('/api/bank-ops/liens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lienId: selectedLien.id,
          releaseReason: releaseReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to release active lien.');

      setActionSuccessMsg(`Successfully released dispute lien of ₹${selectedLien.amount} for account (${selectedLien.account?.upiId}).`);
      setSelectedLien(null);
      setReleaseReason('');
      fetchMetrics();
      fetchTabData('LIENS');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReleasing(false);
    }
  };

  if (error) {
    return (
      <NavigationShell>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center space-y-4">
          <ShieldAlert className="h-10 w-10 text-red-600 mx-auto" />
          <h2 className="text-lg font-bold text-red-900 font-outfit">Bank Operations Console Restricted</h2>
          <p className="text-xs text-red-700 max-w-md mx-auto">{error}</p>
          <div className="pt-2 text-xs text-[#6e6f6a]">
            Log in with demo bank operator credentials (<code className="font-bold text-[#1f1f1f]">operator@secureupi</code> / <code className="font-bold text-[#1f1f1f]">password123</code>) to access the Bank Operations Dashboard.
          </div>
        </div>
      </NavigationShell>
    );
  }

  return (
    <NavigationShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#d97706]">
              <Building2 className="h-4 w-4" />
              2026 RBI Compliant Bank Operations Console
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1f1f1f] font-outfit">
              Automated Lien Marking & AI Quorum Sentinel
            </h1>
            <p className="text-xs text-[#6e6f6a]">
              Review targeted amount liens, inspect AI Quorum signals and cashflow velocity flags, manage full debit holds, and authorize legal releases.
            </p>
          </div>

          <button
            onClick={() => { fetchMetrics(); fetchTabData(activeTab); }}
            className="flex items-center gap-1.5 rounded-xl border border-[#e3e4d9] bg-white px-3.5 py-2 text-xs font-bold text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white transition-all cursor-pointer shadow-xs self-start"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Console
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-amber-800 flex items-center gap-1">
              <Scale className="h-3 w-3" /> Active Liens
            </span>
            <p className="text-2xl font-extrabold text-amber-900 font-outfit mt-1">{metrics?.activeLiens ?? '...'}</p>
            <span className="text-[9px] text-amber-700 font-mono">₹{metrics?.activeLienTotal?.toLocaleString('en-IN') ?? 0} locked</span>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-red-800 flex items-center gap-1">
              <Lock className="h-3 w-3" /> Full Holds
            </span>
            <p className="text-2xl font-extrabold text-red-900 font-outfit mt-1">{metrics?.activeHolds ?? '...'}</p>
            <span className="text-[9px] text-red-700">Accounts frozen</span>
          </div>

          <div className="rounded-2xl border border-[#e3e4d9] bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#6e6f6a]">Open Fraud Reports</span>
            <p className="text-2xl font-extrabold text-amber-700 font-outfit mt-1">{metrics?.openFraudCases ?? '...'}</p>
            <span className="text-[9px] text-[#8a8b84]">Pending review</span>
          </div>

          <div className="rounded-2xl border border-[#e3e4d9] bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#6e6f6a]">Disputes In Review</span>
            <p className="text-2xl font-extrabold text-[#1f1f1f] font-outfit mt-1">{metrics?.disputesAwaitingReview ?? '...'}</p>
            <span className="text-[9px] text-[#8a8b84]">Human review queue</span>
          </div>

          <div className="rounded-2xl border border-[#e3e4d9] bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#6e6f6a]">Critical Priority</span>
            <p className="text-2xl font-extrabold text-red-900 font-outfit mt-1">{metrics?.highRiskCases ?? '...'}</p>
            <span className="text-[9px] text-[#8a8b84]">Immediate action</span>
          </div>

          <div className="rounded-2xl border border-[#e3e4d9] bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#6e6f6a]">Expired Holds</span>
            <p className="text-2xl font-extrabold text-emerald-700 font-outfit mt-1">{metrics?.expiredHolds ?? '...'}</p>
            <span className="text-[9px] text-[#8a8b84]">Auto-cleared</span>
          </div>
        </div>

        {/* Action Success Alert */}
        {actionSuccessMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            {actionSuccessMsg}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-[#e3e4d9] gap-2 overflow-x-auto select-none">
          {[
            { id: 'LIENS', name: 'Active Liens (RBI 2026)', icon: Scale },
            { id: 'HOLDS', name: 'Full Debit Holds', icon: Lock },
            { id: 'FRAUD', name: 'Fraud Reports', icon: AlertTriangle },
            { id: 'DISPUTES', name: 'Smart Disputes', icon: BrainCircuit },
            { id: 'CASES', name: 'Investigation Cases', icon: FileCheck },
            { id: 'AUDIT', name: 'Audit Events Log', icon: Activity },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 cursor-pointer transition-all ${
                  isActive 
                    ? 'border-[#d97706] text-[#d97706]' 
                    : 'border-transparent text-[#8a8b84] hover:text-[#1f1f1f]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* TAB 0: LIENS MANAGEMENT */}
        {activeTab === 'LIENS' && (
          <div className="rounded-2xl border border-[#e3e4d9] bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#1f1f1f] flex items-center gap-2">
                  <Scale className="h-4 w-4 text-amber-700" />
                  Automated Disputed Amount Liens
                </h2>
                <p className="text-xs text-[#6e6f6a]">
                  Amount-specific targeted locks. Accounts remain active for everyday purchases up to their available balance.
                </p>
              </div>
              <span className="text-xs font-bold text-[#d97706] bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                2026 RBI Framework
              </span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-[#6e6f6a]"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : liens.length === 0 ? (
              <p className="text-xs text-[#8a8b84] italic text-center py-6">No active disputed liens recorded.</p>
            ) : (
              <div className="divide-y divide-[#e3e4d9] overflow-x-auto">
                {liens.map((l) => (
                  <div key={l.id} className="py-4 flex items-start justify-between gap-4 text-xs">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#1f1f1f]">{l.user?.name}</span>
                        <code className="text-[10px] font-mono bg-[#f4f4f4] px-2 py-0.5 rounded border border-[#e3e4d9]">{l.account?.upiId}</code>
                        <span className="font-extrabold font-mono text-amber-900 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded">
                          Lien: ₹{l.amount.toLocaleString('en-IN')}
                        </span>
                        
                        {/* AI Quorum Badge */}
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1 ${
                          l.isQuorumReached ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}>
                          <Users className="h-3 w-3" />
                          Quorum: {l.quorumCount}/3 Reports
                        </span>

                        {/* Cashflow Velocity Badge */}
                        {l.isHighVelocity && (
                          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            High Velocity Drain ({Math.round(l.turnoverRatio * 100)}%)
                          </span>
                        )}
                      </div>

                      <p className="text-[#6e6f6a]">Reason: "{l.reason}"</p>
                      
                      <div className="flex gap-4 text-[10px] font-mono text-[#8a8b84]">
                        <span>Marked on: {new Date(l.createdAt).toLocaleDateString('en-IN')}</span>
                        {l.fraudReport && <span>Report ID: #{l.fraudReport.id.substring(0, 8)}</span>}
                        {l.releasedBy && <span className="text-emerald-700 font-bold">Released by: {l.releasedBy}</span>}
                      </div>
                    </div>

                    {l.status === 'ACTIVE' && (
                      <button
                        onClick={() => setSelectedLien(l)}
                        className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-600 hover:text-white transition-all cursor-pointer shadow-xs shrink-0"
                      >
                        <Unlock className="h-3.5 w-3.5" />
                        Release Lien
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 1: HOLDS MANAGEMENT */}
        {activeTab === 'HOLDS' && (
          <div className="rounded-2xl border border-[#e3e4d9] bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#1f1f1f]">Simulated Account Full Debit Holds</h2>
              <span className="text-xs text-[#8a8b84]">Policy Duration: 60 Days Max</span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-[#6e6f6a]"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : holds.length === 0 ? (
              <p className="text-xs text-[#8a8b84] italic text-center py-6">No full account freezes recorded.</p>
            ) : (
              <div className="divide-y divide-[#e3e4d9] overflow-x-auto">
                {holds.map((h) => (
                  <div key={h.id} className="py-4 flex items-start justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1f1f1f]">{h.user?.name}</span>
                        <code className="text-[10px] font-mono bg-[#f4f4f4] px-2 py-0.5 rounded border border-[#e3e4d9]">{h.account?.upiId}</code>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          h.status === 'DEBIT_HOLD_ACTIVE' ? 'bg-red-100 text-red-800 border border-red-200' :
                          h.status === 'RELEASED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          'bg-[#f4f4f4] text-[#6e6f6a] border border-[#e3e4d9]'
                        }`}>
                          {h.status}
                        </span>
                      </div>
                      <p className="text-[#6e6f6a]">Reason: "{h.reason}"</p>
                      <div className="flex gap-4 text-[10px] font-mono text-[#8a8b84]">
                        <span>Started: {new Date(h.startedAt).toLocaleDateString('en-IN')}</span>
                        <span>Expires: {new Date(h.expiresAt).toLocaleDateString('en-IN')}</span>
                        {h.releasedBy && <span className="text-emerald-700 font-bold">Released by: {h.releasedBy}</span>}
                      </div>
                    </div>

                    {h.status === 'DEBIT_HOLD_ACTIVE' && (
                      <button
                        onClick={() => setSelectedHold(h)}
                        className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer shadow-xs shrink-0"
                      >
                        <Unlock className="h-3.5 w-3.5" />
                        Release Hold
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FRAUD REPORTS */}
        {activeTab === 'FRAUD' && (
          <div className="rounded-2xl border border-[#e3e4d9] bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#1f1f1f]">Submitted Fraud Reports</h2>
            {loading ? (
              <div className="py-8 text-center text-xs text-[#6e6f6a]"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : (
              <div className="divide-y divide-[#e3e4d9]">
                {fraudReports.map((f) => (
                  <div key={f.id} className="py-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1f1f1f]">{f.category}</span>
                        <span className="text-[10px] font-mono text-[#8a8b84]">#{f.id.substring(0, 8)}</span>
                        <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded">
                          Priority: {f.priority}
                        </span>
                      </div>
                      <span className="font-bold text-[#1f1f1f] bg-[#f4f4f4] px-2.5 py-1 rounded border border-[#e3e4d9]">
                        Status: {f.status}
                      </span>
                    </div>
                    <p className="text-[#6e6f6a]">"{f.description}"</p>
                    <p className="text-[10px] font-mono text-[#8a8b84]">
                      Reporter: {f.reporterUser?.name} ({f.reporterUser?.email}) | Suspect UPI: <strong className="text-[#1f1f1f]">{f.suspectUpiId}</strong>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SMART DISPUTES */}
        {activeTab === 'DISPUTES' && (
          <div className="rounded-2xl border border-[#e3e4d9] bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#1f1f1f]">NLP Smart Dispute Classification Queue</h2>
            {loading ? (
              <div className="py-8 text-center text-xs text-[#6e6f6a]"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : (
              <div className="divide-y divide-[#e3e4d9]">
                {disputes.map((d) => (
                  <div key={d.id} className="py-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1f1f1f]">{d.predictedType}</span>
                        <span className="text-[10px] font-mono text-[#8a8b84]">#{d.id.substring(0, 8)}</span>
                        {d.requiresHumanReview && (
                          <span className="rounded bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                            REQUIRES HUMAN REVIEW
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-xs text-[#1f1f1f]">
                        Confidence: {Math.round(d.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-[#6e6f6a]">"{d.rawDescription}"</p>
                    <p className="text-[10px] text-[#8a8b84]">
                      User: {d.user?.name} | Recommended Route: <span className="font-mono text-[#1f1f1f] font-bold">{d.recommendedRoute}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: INVESTIGATION CASES */}
        {activeTab === 'CASES' && (
          <div className="rounded-2xl border border-[#e3e4d9] bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#1f1f1f]">Open Bank Investigation Cases</h2>
            {loading ? (
              <div className="py-8 text-center text-xs text-[#6e6f6a]"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : (
              <div className="divide-y divide-[#e3e4d9]">
                {cases.map((c) => (
                  <div key={c.id} className="py-4 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1f1f1f]">Case ID: {c.id}</span>
                      <span className="rounded bg-[#f4f4f4] px-2.5 py-0.5 text-[10px] font-bold border border-[#e3e4d9]">
                        {c.status}
                      </span>
                    </div>
                    <p className="text-[#6e6f6a]">Notes: {c.notes || 'No notes'}</p>
                    <p className="text-[10px] text-[#8a8b84]">Reviewer: {c.reviewer || 'System Auto'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: AUDIT LOGS */}
        {activeTab === 'AUDIT' && (
          <div className="rounded-2xl border border-[#e3e4d9] bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#1f1f1f]">System Security Audit Log</h2>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {auditLogs.map((l) => (
                <div key={l.id} className="p-3 rounded-xl bg-[#f4f4f4] border border-[#e3e4d9] text-xs flex justify-between gap-4">
                  <div>
                    <span className="font-bold text-[#1f1f1f] block">{l.eventType}</span>
                    <p className="text-[11px] text-[#6e6f6a] mt-0.5">{l.metadata ? JSON.stringify(JSON.parse(l.metadata)) : ''}</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#8a8b84] whitespace-nowrap">
                    {new Date(l.timestamp).toLocaleTimeString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Release Lien Modal */}
        {selectedLien && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <form onSubmit={handleReleaseLien} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4 animate-scale-up">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <Scale className="h-5 w-5 text-amber-700" />
                Release Disputed Amount Lien
              </div>
              <p className="text-xs text-[#6e6f6a]">
                You are authorizing the release of ₹<strong className="text-[#1f1f1f]">{selectedLien.amount?.toLocaleString('en-IN')}</strong> lien on account <strong className="text-[#1f1f1f]">{selectedLien.account?.upiId}</strong> ({selectedLien.user?.name}).
              </p>

              <div>
                <label className="block text-xs font-bold text-[#1f1f1f] mb-1">
                  Reason for Lien Release *
                </label>
                <textarea
                  rows={3}
                  required
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  placeholder="e.g. Dispute resolved. Beneficiary merchant confirmed legitimate order."
                  className="w-full rounded-xl border border-[#e3e4d9] bg-[#fdfdfc] p-3 text-xs text-[#1f1f1f] focus:border-[#1f1f1f] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLien(null)}
                  className="rounded-xl border border-[#e3e4d9] px-4 py-2 text-xs font-semibold text-[#1f1f1f] hover:bg-[#f4f4f4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={releasing}
                  className="rounded-xl bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-50"
                >
                  {releasing ? 'Releasing...' : 'Authorize Lien Release'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Release Hold Modal */}
        {selectedHold && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <form onSubmit={handleReleaseHold} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4 animate-scale-up">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <Unlock className="h-5 w-5 text-emerald-600" />
                Release Temporary Debit Hold
              </div>
              <p className="text-xs text-[#6e6f6a]">
                You are authorizing the removal of debit hold on account <strong className="text-[#1f1f1f]">{selectedHold.account?.upiId}</strong> ({selectedHold.user?.name}).
              </p>

              <div>
                <label className="block text-xs font-bold text-[#1f1f1f] mb-1">
                  Reason for Hold Release *
                </label>
                <textarea
                  rows={3}
                  required
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  placeholder="e.g. Investigation completed. Customer documentation verified."
                  className="w-full rounded-xl border border-[#e3e4d9] bg-[#fdfdfc] p-3 text-xs text-[#1f1f1f] focus:border-[#1f1f1f] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedHold(null)}
                  className="rounded-xl border border-[#e3e4d9] px-4 py-2 text-xs font-semibold text-[#1f1f1f] hover:bg-[#f4f4f4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={releasing}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {releasing ? 'Releasing...' : 'Authorize Release'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </NavigationShell>
  );
}
