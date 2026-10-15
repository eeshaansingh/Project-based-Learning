'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavigationShell from '@/components/NavigationShell';
import { 
  CreditCard, 
  ArrowUpRight, 
  ArrowRight, 
  Shield, 
  Eye, 
  EyeOff, 
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Plus,
  ShieldAlert
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accountHold, setAccountHold] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [meRes, txRes, holdRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/transactions'),
          fetch('/api/security/account-status'),
        ]);
        
        if (meRes.status === 401) {
          router.replace('/login');
          return;
        }

        const meData = await meRes.json();
        const txData = await txRes.json();
        const holdData = await holdRes.json();
        
        if (meData.user) {
          setData(meData.user);
        }
        if (txData.transactions) {
          setTransactions(txData.transactions.slice(0, 3));
        }
        if (holdData.freeze) {
          setAccountHold(holdData.freeze);
        }
      } catch (err) {
        console.error('Error fetching dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#f6f7ed] text-[#1f1f1f]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1f1f1f]" />
      </div>
    );
  }

  const user = data;
  const bankAccount = user?.bankAccounts?.[0] || null;

  return (
    <NavigationShell>
      <div className="space-y-6">
        
        {/* Account Protection Banner (When Hold Active) */}
        {accountHold && (
          <div className="rounded-2xl border border-red-300 bg-red-50/90 p-5 shadow-xs space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-950 font-extrabold text-sm font-outfit">
                <ShieldAlert className="h-5 w-5 text-red-700" />
                Temporary Debit Hold Active
              </div>
              <span className="rounded-full bg-red-700 text-white text-[10px] font-mono font-extrabold px-3 py-0.5 shadow-xs">
                DEBIT_HOLD_ACTIVE
              </span>
            </div>
            <p className="text-xs text-red-900 font-medium">
              Debit transactions are temporarily unavailable while your bank investigates a security report.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-red-800 pt-1 font-mono">
              <span>Started: {new Date(accountHold.startedAt).toLocaleDateString('en-IN')}</span>
              <span>Expires: {new Date(accountHold.expiresAt).toLocaleDateString('en-IN')}</span>
            </div>
            <p className="text-[10px] text-red-700 italic border-t border-red-200/80 pt-2 mt-2">
              Account holds shown here are simulated and do not affect real bank accounts. Maximum simulated hold period: 60 days.
            </p>
          </div>
        )}

        {/* Welcome Section */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1f1f1f] font-outfit">
              Hello, {user?.name}
            </h1>
            <p className="text-xs text-[#6e6f6a] mt-0.5">Welcome to your SecureUPI bank portal.</p>
          </div>
          
          <div className="mt-3 sm:mt-0 flex gap-2">
            <Link 
              href="/pay" 
              className="flex items-center gap-1.5 rounded-xl bg-[#1f1f1f] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#333333] transition-all cursor-pointer"
            >
              <ArrowUpRight className="h-4 w-4" />
              Send Money
            </Link>
          </div>
        </div>

        {/* Financial Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Card 1: Premium Dark Bank Account Card */}
          {bankAccount ? (
            <div className="rounded-2xl p-6 relative overflow-hidden bg-[#1f1f1f] text-white border border-[#1f1f1f] shadow-sm min-h-[180px] flex flex-col justify-between">
              <div className="flex items-start justify-between relative z-10">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Linked bank account</span>
                  <p className="text-md font-bold text-white font-outfit">{bankAccount.bankName}</p>
                  <p className="text-xs text-gray-400 font-mono">{bankAccount.accountNumberMasked}</p>
                </div>
                <div className="p-2 rounded-xl bg-white/10 text-white">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 relative z-10 space-y-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Available Spending Balance</span>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-white font-mono tracking-tight font-outfit">
                    {showBalance ? `₹${(bankAccount.availableBalance ?? bankAccount.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••'}
                  </p>
                  <button 
                    onClick={() => setShowBalance(!showBalance)}
                    className="p-1 text-gray-400 hover:text-white rounded transition-colors cursor-pointer"
                  >
                    {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {bankAccount.totalLienAmount > 0 && showBalance && (
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-300 font-mono pt-1">
                    <span className="rounded bg-amber-400/20 border border-amber-400/30 px-2 py-0.5">
                      ₹{bankAccount.totalLienAmount.toLocaleString('en-IN')} on Dispute Lien Hold
                    </span>
                    <span className="text-gray-400">(Total: ₹{bankAccount.balance.toLocaleString('en-IN')})</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3.5 text-xs relative z-10">
                <span className="text-gray-400 font-medium">UPI ID</span>
                <code className="text-white font-semibold font-mono bg-white/10 border border-white/10 px-2 py-0.5 rounded-md text-[11px]">{bankAccount.upiId}</code>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center border-dashed border-2 border-[#e3e4d9] bg-white text-center min-h-[180px]">
              <AlertTriangle className="h-7 w-7 text-[#1f1f1f] animate-pulse" />
              <p className="mt-3 text-sm text-[#1f1f1f] font-semibold">No bank account linked</p>
              <p className="text-xs text-[#6e6f6a] max-w-[220px] mt-1">Link your bank account to initiate standard and step-up payments.</p>
              <Link href="/onboarding" className="mt-4 text-xs font-semibold text-[#1f1f1f] hover:underline flex items-center gap-1">
                Link bank account <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}

          {/* Card 2: Active Security Rules Summary */}
          <div className="glass-panel rounded-2xl p-6 bg-white flex flex-col justify-between border border-[#e3e4d9]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#1f1f1f]" />
                <span className="text-sm font-bold text-[#1f1f1f] font-outfit">Active Security Rules</span>
              </div>
              <Link href="/security" className="text-[10px] font-bold text-[#1f1f1f] hover:underline uppercase tracking-wider flex items-center gap-0.5">
                Configure <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-[#f4f4f4] border border-[#e3e4d9] p-3 rounded-xl">
                <span className="text-[9px] font-bold text-[#6e6f6a] uppercase tracking-wider block">Verification Threshold</span>
                <span className="text-sm font-bold text-[#1f1f1f] block mt-1 font-mono">₹{user?.stepUpThreshold?.toLocaleString('en-IN')}</span>
                <span className="text-[9px] text-[#6e6f6a] block mt-0.5">MFA required above this</span>
              </div>
              <div className="bg-[#f4f4f4] border border-[#e3e4d9] p-3 rounded-xl">
                <span className="text-[9px] font-bold text-[#6e6f6a] uppercase tracking-wider block">Daily Transaction Limit</span>
                <span className="text-sm font-bold text-[#1f1f1f] block mt-1 font-mono">₹{user?.dailyLimit?.toLocaleString('en-IN')}</span>
                <span className="text-[9px] text-[#6e6f6a] block mt-0.5">Blocked if exceeded</span>
              </div>
            </div>

            <div className="mt-4 border-t border-[#e3e4d9] pt-3.5 flex justify-between items-center text-xs">
              <span className="text-[#6e6f6a] font-medium">Verify New Payees</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${user?.requireMfaNewPayees ? 'bg-[#1f1f1f] text-white' : 'bg-[#f4f4f4] text-[#6e6f6a] border border-[#e3e4d9]'}`}>
                {user?.requireMfaNewPayees ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Grid Layout (Recent Activity + Quick payees) */}
        <div className="grid gap-6 md:grid-cols-3">
          
          {/* Recent Transactions List */}
          <div className="glass-panel rounded-2xl p-6 md:col-span-2 space-y-4 bg-white border border-[#e3e4d9]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-[#1f1f1f]" />
                <h3 className="text-sm font-bold text-[#1f1f1f] font-outfit">Recent Payments</h3>
              </div>
              <Link href="/activity" className="text-xs font-semibold text-[#1f1f1f] hover:underline transition-colors">
                View all
              </Link>
            </div>

            <div className="space-y-2.5">
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-[#f4f4f4] border border-[#e3e4d9] hover:bg-[#eaeaea] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                        tx.status === 'SUCCESS' 
                          ? 'bg-white border-[#e3e4d9] text-[#1f1f1f]' 
                          : tx.status === 'BLOCKED'
                          ? 'bg-[#1f1f1f] border-[#1f1f1f] text-white'
                          : 'bg-white border-[#e3e4d9] text-[#1f1f1f]'
                      }`}>
                        {tx.status === 'SUCCESS' ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : tx.status === 'BLOCKED' ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1f1f1f]">{tx.payeeName}</p>
                        <p className="text-[10px] text-[#6e6f6a] font-mono mt-0.5">{tx.payeeUpiId}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold text-[#1f1f1f] font-mono">₹{tx.amount.toLocaleString('en-IN')}</p>
                      <span className={`inline-block text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 ${
                        tx.status === 'BLOCKED'
                          ? 'bg-[#1f1f1f] text-white'
                          : tx.riskLevel === 'CRITICAL' || tx.riskLevel === 'HIGH'
                          ? 'bg-[#e3e4d9] text-[#1f1f1f]'
                          : 'bg-white border border-[#e3e4d9] text-[#6e6f6a]'
                      }`}>
                        {tx.status === 'BLOCKED' ? 'Blocked' : `${tx.riskLevel} Risk`}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-[#6e6f6a] border border-dashed border-[#e3e4d9] rounded-xl bg-[#f4f4f4]/40">
                  No transaction history found.
                </div>
              )}
            </div>
          </div>

          {/* Quick Pay Panel */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between bg-white border border-[#e3e4d9]">
            <div>
              <h3 className="text-sm font-bold text-[#1f1f1f] font-outfit">Quick Pay</h3>
              <p className="text-xs text-[#6e6f6a] mt-0.5">Instant transfers to demo payees.</p>
              
              <div className="space-y-2.5 mt-4">
                <Link href="/pay?to=rahul@upi" className="flex items-center justify-between p-2.5 rounded-xl border border-[#e3e4d9] bg-[#f4f4f4] hover:bg-[#e8e9de] transition-all group">
                  <div>
                    <p className="text-xs font-bold text-[#1f1f1f] group-hover:underline">Rahul</p>
                    <p className="text-[9px] text-[#6e6f6a] font-mono mt-0.5">rahul@upi</p>
                  </div>
                  <span className="text-[8px] font-bold text-[#6e6f6a] uppercase tracking-wider bg-white border border-[#e3e4d9] px-2 py-0.5 rounded">LOW RISK</span>
                </Link>
                <Link href="/pay?to=cafe@upi" className="flex items-center justify-between p-2.5 rounded-xl border border-[#e3e4d9] bg-[#f4f4f4] hover:bg-[#e8e9de] transition-all group">
                  <div>
                    <p className="text-xs font-bold text-[#1f1f1f] group-hover:underline">Cafe</p>
                    <p className="text-[9px] text-[#6e6f6a] font-mono mt-0.5">cafe@upi</p>
                  </div>
                  <span className="text-[8px] font-bold text-[#6e6f6a] uppercase tracking-wider bg-white border border-[#e3e4d9] px-2 py-0.5 rounded">LOW RISK</span>
                </Link>
                <Link href="/pay?to=rent@upi" className="flex items-center justify-between p-2.5 rounded-xl border border-[#e3e4d9] bg-[#f4f4f4] hover:bg-[#e8e9de] transition-all group">
                  <div>
                    <p className="text-xs font-bold text-[#1f1f1f] group-hover:underline">Rent</p>
                    <p className="text-[9px] text-[#6e6f6a] font-mono mt-0.5">rent@upi</p>
                  </div>
                  <span className="text-[8px] font-bold text-[#1f1f1f] uppercase tracking-wider bg-white border border-[#e3e4d9] px-2 py-0.5 rounded">TRUSTED</span>
                </Link>
              </div>
            </div>

            <Link href="/pay" className="btn-primary flex items-center justify-center gap-1.5 text-xs py-2.5 mt-4">
              <Plus className="h-4 w-4" />
              Pay New Address
            </Link>
          </div>
        </div>

      </div>
    </NavigationShell>
  );
}

function Loader2({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <span className="h-8 w-8 border-3 border-[#1f1f1f] border-t-transparent rounded-full animate-spin"></span>
    </div>
  );
}
