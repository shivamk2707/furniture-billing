'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)
}

interface DatewiseRow {
  date: string
  count: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  gross: number
}

interface CustomerwiseRow {
  name: string
  count: number
  taxable: number
  tax: number
  gross: number
}

interface Props {
  dateFrom: string
  dateTo: string
  tab: string
  datewiseData: DatewiseRow[]
  customerwiseData: CustomerwiseRow[]
}

function downloadCSV(rows: Record<string, string | number>[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => `"${row[h]}"`).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportsClient({ dateFrom, dateTo, tab, datewiseData, customerwiseData }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [from, setFrom] = useState(dateFrom)
  const [to, setTo] = useState(dateTo)
  const [activeTab, setActiveTab] = useState(tab)

  const applyFilter = () => {
    startTransition(() => {
      router.push(`/reports?from=${from}&to=${to}&tab=${activeTab}`)
    })
  }

  const switchTab = (t: string) => {
    setActiveTab(t)
    startTransition(() => {
      router.push(`/reports?from=${from}&to=${to}&tab=${t}`)
    })
  }

  // Totals for date-wise
  const dwTotals = datewiseData.reduce(
    (acc, r) => ({
      count: acc.count + r.count,
      taxable: acc.taxable + r.taxable,
      cgst: acc.cgst + r.cgst,
      sgst: acc.sgst + r.sgst,
      igst: acc.igst + r.igst,
      gross: acc.gross + r.gross,
    }),
    { count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, gross: 0 }
  )

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <button
          onClick={() => {
            if (activeTab === 'date') {
              downloadCSV(
                datewiseData.map((r) => ({
                  Date: r.date, 'Invoice Count': r.count, 'Taxable Sales': r.taxable,
                  CGST: r.cgst, SGST: r.sgst, IGST: r.igst, 'Gross Sales': r.gross,
                })),
                `date-wise-report-${from}-${to}.csv`
              )
            } else {
              downloadCSV(
                customerwiseData.map((r) => ({
                  Customer: r.name, 'Invoice Count': r.count,
                  'Taxable Sales': r.taxable, 'Total Tax': r.tax, 'Gross Sales': r.gross,
                })),
                `customer-wise-report-${from}-${to}.csv`
              )
            }
          }}
          className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Date filter */}
      <div className="flex gap-3 mb-6 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <button onClick={applyFilter}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors">
          Apply
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-1">
          {[
            { id: 'date', label: 'Date-wise Summary' },
            { id: 'customer', label: 'Customer-wise Summary' },
          ].map((t) => (
            <button key={t.id} onClick={() => switchTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Date-wise table */}
      {activeTab === 'date' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {datewiseData.length === 0 ? (
            <p className="p-8 text-center text-gray-500 text-sm">No issued invoices in this date range.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Count</th>
                  <th className="px-4 py-3 text-right">Taxable Sales</th>
                  <th className="px-4 py-3 text-right">CGST</th>
                  <th className="px-4 py-3 text-right">SGST</th>
                  <th className="px-4 py-3 text-right">IGST</th>
                  <th className="px-4 py-3 text-right">Gross Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {datewiseData.map((row) => (
                  <tr key={row.date} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{row.date}</td>
                    <td className="px-4 py-2 text-right">{row.count}</td>
                    <td className="px-4 py-2 text-right">{formatINR(row.taxable)}</td>
                    <td className="px-4 py-2 text-right">{formatINR(row.cgst)}</td>
                    <td className="px-4 py-2 text-right">{formatINR(row.sgst)}</td>
                    <td className="px-4 py-2 text-right">{formatINR(row.igst)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatINR(row.gross)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold text-sm">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{dwTotals.count}</td>
                  <td className="px-4 py-3 text-right">{formatINR(dwTotals.taxable)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(dwTotals.cgst)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(dwTotals.sgst)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(dwTotals.igst)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(dwTotals.gross)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* Customer-wise table */}
      {activeTab === 'customer' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {customerwiseData.length === 0 ? (
            <p className="p-8 text-center text-gray-500 text-sm">No issued invoices in this date range.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-right">Invoices</th>
                  <th className="px-4 py-3 text-right">Taxable Sales</th>
                  <th className="px-4 py-3 text-right">Total Tax</th>
                  <th className="px-4 py-3 text-right">Gross Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customerwiseData.map((row) => (
                  <tr key={row.name} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{row.name}</td>
                    <td className="px-4 py-2 text-right">{row.count}</td>
                    <td className="px-4 py-2 text-right">{formatINR(row.taxable)}</td>
                    <td className="px-4 py-2 text-right">{formatINR(row.tax)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatINR(row.gross)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  )
}
