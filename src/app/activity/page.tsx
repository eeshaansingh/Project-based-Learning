'use client';

import React, { useEffect, useState } from 'react';
import NavigationShell from '@/components/NavigationShell';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Lock, 
  Calendar, 
  User, 
  Clock, 
  FileText,
  ShieldAlert,
  Loader2,
  Info
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ActivityPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTransactions() {
      try {
        const res = await fetch('/api/transactions');
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        const data = await res.json();
        if (data.transactions) {
          setTransactions(data.transactions);
        }
      } catch (err) {
        console.error('Failed to load transactions:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTransactions();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#f6f7ed] text-[#1f1f1f]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1f1f1f]" />
      </div>
    );
  }

  return (
    <NavigationShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1f1f1f] font-outfit">Payment Activity</h1>
          <p className="text-xs text-[#6e6f6a] mt-0.5">View and audit all transaction history and authorization details.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* List panel (2/3 width) */}
          <div className="md:col-span-2 space-y-3">
            {transactions.length > 0 ? (
              transactions.map((tx) => (
                <button
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                    selectedTx?.id === tx.id 
                      ? 'bg-white border-[#1f1f1f] shadow-sm' 
                      : 'bg-white border-[#e3e4d9] hover:bg-[#f4f4f4]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                      tx.status === 'SUCCESS' 
                        ? 'bg-[#f4f4f4] border-[#e3e4d9] text-[#1f1f1f]' 
                        : tx.status === 'BLOCKED'
                        ? 'bg-[#1f1f1f] border-[#1f1f1f] text-white'
                        : 'bg-[#f4f4f4] border-[#e3e4d9] text-[#1f1f1f]'
                    }`}>
                      {tx.status === 'SUCCESS' ? (
                        <CheckCircle2 className="h-4.5 w-4.5" />
                      ) : tx.status === 'BLOCKED' ? (
                        <Lock className="h-4.5 w-4.5" />
                      ) : (
                        <XCircle className="h-4.5 w-4.5" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1f1f1f]">{tx.payeeName}</p>
                      <span className="text-[10px] text-[#6e6f6a] block mt-0.5 font-mono">{tx.payeeUpiId}</span>
                      <span className="text-[10px] text-[#8a8b84] flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold text-[#1f1f1f] font-mono">₹{tx.amount.toLocaleString('en-IN')}</p>
                    <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1.5 ${
                      tx.status === 'SUCCESS' 
                        ? 'bg-[#f4f4f4] text-[#1f1f1f] border border-[#e3e4d9]' 
                        : tx.status === 'BLOCKED'
                        ? 'bg-[#1f1f1f] text-white'
                        : 'bg-[#e3e4d9] text-[#1f1f1f]'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-[#6e6f6a] border border-dashed border-[#e3e4d9] rounded-2xl bg-white">
                No transactions found. Make a payment to see history here.
              </div>
            )}
          </div>

          {/* Details panel (1/3 width) */}
          <div className="space-y-4">
            {selectedTx ? (
              <div className="glass-panel rounded-2xl p-6 border border-[#e3e4d9] bg-white shadow-xs animate-scale-up sticky top-24">
                <div className="flex items-center justify-between border-b border-[#e3e4d9] pb-3.5">
                  <h3 className="text-sm font-bold text-[#1f1f1f] font-outfit">Receipt Details</h3>
                  <button 
                    onClick={() => setSelectedTx(null)}
                    className="text-xs text-[#6e6f6a] hover:text-[#1f1f1f] font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                </div>

                <div className="space-y-4 py-3 text-xs">
                  <div className="text-center py-2 bg-[#f4f4f4] rounded-xl border border-[#e3e4d9]">
                    <span className="text-[10px] text-[#6e6f6a] font-bold uppercase tracking-wider block">Amount Sent</span>
                    <p className="text-2xl font-bold text-[#1f1f1f] font-mono mt-0.5 font-outfit">₹{selectedTx.amount.toLocaleString('en-IN')}</p>
                  </div>

                  <div className="space-y-2 border-t border-b border-[#e3e4d9] py-3.5">
                    <div className="flex justify-between">
                      <span className="text-[#6e6f6a]">Recipient:</span>
                      <span className="font-semibold text-[#1f1f1f]">{selectedTx.payeeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6e6f6a]">UPI ID:</span>
                      <span className="font-mono text-[#1f1f1f] font-semibold">{selectedTx.payeeUpiId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6e6f6a]">Note:</span>
                      <span className="text-[#1f1f1f] italic">"{selectedTx.note || 'None'}"</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {/* Status */}
                    <div className="flex justify-between items-center">
                      <span className="text-[#6e6f6a]">Status:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedTx.status === 'SUCCESS' ? 'bg-[#f4f4f4] text-[#1f1f1f] border border-[#e3e4d9]' : 'bg-[#1f1f1f] text-white'
                      }`}>
                        {selectedTx.status}
                      </span>
                    </div>

                    {/* Auth Method */}
                    <div className="flex justify-between items-center">
                      <span className="text-[#6e6f6a]">Auth Method:</span>
                      <span className="font-bold text-[#1f1f1f] uppercase bg-[#f4f4f4] border border-[#e3e4d9] px-2 py-0.5 rounded text-[10px]">
                        {selectedTx.authMethod === 'STANDARD' ? 'PIN ONLY' : `${selectedTx.authMethod} + PIN`}
                      </span>
                    </div>

                    {/* Risk Level */}
                    <div className="flex justify-between items-center">
                      <span className="text-[#6e6f6a]">Risk Assessment:</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1f1f1f] text-white">
                        {selectedTx.riskLevel}
                      </span>
                    </div>

                    {/* Timestamp */}
                    <div className="flex justify-between items-center text-[10px] text-[#6e6f6a] pt-1">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Time:</span>
                      <span>{new Date(selectedTx.createdAt).toLocaleTimeString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Block / Step-up reasons display */}
                  {selectedTx.blockReasons && (
                    <div className="mt-4 pt-3.5 border-t border-[#e3e4d9] text-[10px] rounded-xl border border-[#e3e4d9] bg-[#f4f4f4] p-3 text-[#1f1f1f]">
                      <div className="flex items-center gap-1 text-[#1f1f1f] font-bold mb-1 uppercase tracking-wider">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Risk Parameters Triggered
                      </div>
                      <ul className="list-disc pl-3 space-y-1 text-[#6e6f6a]">
                        {selectedTx.blockReasons.map((reason: string, idx: number) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-panel rounded-2xl p-6 border border-dashed border-[#e3e4d9] bg-white text-center py-12 text-xs text-[#6e6f6a] flex flex-col items-center justify-center">
                <Info className="h-6 w-6 text-[#9e9f98] mb-2" />
                Select a transaction receipt to view audit log and risk details.
              </div>
            )}
          </div>
        </div>
      </div>
    </NavigationShell>
  );
}
