import React, { useEffect, useState } from 'react'
import { FiDollarSign, FiArrowDown, FiArrowUp, FiSmartphone, FiDatabase } from 'react-icons/fi'
import { toast } from 'react-hot-toast'

import { API_BASE } from '../config'

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
}

function formatAmount(val) {
  if (val == null) return '—'
  return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function BalanceTab() {
  const [balances, setBalances] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  const fetchData = async () => {
    try {
      const [balRes, txRes] = await Promise.all([
        fetch(`${API_BASE}/bank/balances`, { headers: authHeaders() }),
        fetch(`${API_BASE}/bank/transactions?limit=50`, { headers: authHeaders() })
      ])
      const balData = await balRes.json().catch(() => ({}))
      const txData = await txRes.json().catch(() => ({}))
      if (balData.success) setBalances(balData)
      if (txData.success) setTransactions(txData.transactions || [])
    } catch {
      toast.error('FAILED TO LOAD BALANCE DATA')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) {
    return <div className="py-20 text-center text-emerald-300/60">SCANNING BANK SMS…</div>
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          icon={<FiDollarSign />}
          label="TOTAL BALANCE"
          value={formatAmount(balances?.total_balance)}
          color="emerald"
        />
        <StatCard
          icon={<FiArrowDown />}
          label="TOTAL DEBIT"
          value={formatAmount(balances?.total_debit)}
          sub={`${balances?.device_count || 0} devices`}
          color="red"
        />
        <StatCard
          icon={<FiArrowUp />}
          label="TOTAL CREDIT"
          value={formatAmount(balances?.total_credit)}
          sub={`${balances?.device_count || 0} devices`}
          color="blue"
        />
      </div>

      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <button
          onClick={() => setTab('overview')}
          className={`w-full justify-center rounded-xl border px-4 py-2.5 text-xs font-bold transition md:w-auto md:py-2 ${tab === 'overview' ? 'border-emerald-300/60 bg-emerald-400/25 text-emerald-50' : 'border-emerald-500/30 text-emerald-300/60 hover:bg-emerald-500/10'}`}
        >
          <FiSmartphone className="mr-1 inline" /> DEVICE BALANCES
        </button>
        <button
          onClick={() => setTab('transactions')}
          className={`w-full justify-center rounded-xl border px-4 py-2.5 text-xs font-bold transition md:w-auto md:py-2 ${tab === 'transactions' ? 'border-emerald-300/60 bg-emerald-400/25 text-emerald-50' : 'border-emerald-500/30 text-emerald-300/60 hover:bg-emerald-500/10'}`}
        >
          <FiDatabase className="mr-1 inline" /> TRANSACTIONS
        </button>
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {balances?.devices?.map((d) => (
            <div key={d.device_uid} className="rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiSmartphone className="text-emerald-400" />
                  <span className="font-mono text-sm text-slate-300">{d.device_uid}</span>
                </div>
                {d.bank_name && (
                  <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    {d.bank_name}
                  </span>
                )}
              </div>
              <div className="mb-4">
                <p className="terminal-title">AVAILABLE BALANCE</p>
                <p className="mt-1 font-mono text-3xl font-black text-emerald-300">{formatAmount(d.latest_balance)}</p>
                {d.account_last4 && <p className="mt-1 text-xs text-slate-500">A/c ****{d.account_last4}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                  <p className="text-slate-400">Debit</p>
                  <p className="mt-1 font-bold text-red-300">{formatAmount(d.total_debit)}</p>
                </div>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                  <p className="text-slate-400">Credit</p>
                  <p className="mt-1 font-bold text-blue-300">{formatAmount(d.total_credit)}</p>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-slate-600">{d.transaction_count} transactions · Updated {formatDate(d.last_updated)}</p>
            </div>
          ))}
          {!balances?.devices?.length && (
            <div className="col-span-2 rounded-2xl border border-emerald-400/20 bg-slate-950/70 py-16 text-center">
              <FiDollarSign className="mx-auto mb-3 text-4xl text-emerald-400/30" />
              <p className="text-sm text-slate-500">No bank SMS detected yet</p>
              <p className="mt-1 text-xs text-slate-600">Incoming bank SMS will be auto-parsed for balance info</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-emerald-400/20 bg-slate-950/70 md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-emerald-500/20 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-bold">TIME</th>
                  <th className="px-4 py-3 font-bold">DEVICE</th>
                  <th className="px-4 py-3 font-bold">BANK</th>
                  <th className="px-4 py-3 font-bold">TYPE</th>
                  <th className="px-4 py-3 font-bold">AMOUNT</th>
                  <th className="px-4 py-3 font-bold">BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={tx.id} className={`border-b border-emerald-500/10 ${i % 2 === 0 ? 'bg-black/20' : 'bg-emerald-950/20'}`}>
                    <td className="px-4 py-3 text-slate-400">{formatDate(tx.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{tx.device_uid || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{tx.bank_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        tx.transaction_type === 'debit' ? 'bg-red-400/15 text-red-300' :
                        tx.transaction_type === 'credit' ? 'bg-blue-400/15 text-blue-300' :
                        'bg-emerald-400/15 text-emerald-300'
                      }`}>
                        {tx.transaction_type?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-200">{formatAmount(tx.amount)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-300">{formatAmount(tx.available_balance)}</td>
                  </tr>
                ))}
                {!transactions.length && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No bank transactions parsed yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {transactions.map((tx) => (
              <div key={tx.id} className="rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{formatDate(tx.created_at)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    tx.transaction_type === 'debit' ? 'bg-red-400/15 text-red-300' :
                    tx.transaction_type === 'credit' ? 'bg-blue-400/15 text-blue-300' :
                    'bg-emerald-400/15 text-emerald-300'
                  }`}>
                    {tx.transaction_type?.toUpperCase()}
                  </span>
                </div>
                <div className="mb-2 font-mono text-xs text-slate-300">{tx.device_uid || '—'} · {tx.bank_name || '—'}</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-200">{formatAmount(tx.amount)}</span>
                  <span className="text-sm font-bold text-emerald-300">{formatAmount(tx.available_balance)}</span>
                </div>
              </div>
            ))}
            {!transactions.length && (
              <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/70 py-12 text-center text-sm text-slate-500">No bank transactions parsed yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, sub, color }) {
  const colors = {
    emerald: 'border-emerald-400/20 text-emerald-300',
    red: 'border-red-400/20 text-red-300',
    blue: 'border-blue-400/20 text-blue-300'
  }
  return (
    <div className={`rounded-2xl border bg-slate-950/70 p-5 ${colors[color] || colors.emerald}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="terminal-title">{label}</p>
      </div>
      <p className="mt-2 font-mono text-2xl font-black">{value}</p>
      {sub && <p className="mt-1 text-[10px] text-slate-500">{sub}</p>}
    </div>
  )
}
