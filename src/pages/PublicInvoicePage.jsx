import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicInvoice } from '../hooks/useInvoiceData';
import { FileDown, AlertCircle } from 'lucide-react';

function fmt(n, currency = 'USD') {
  return `${currency} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PublicInvoicePage() {
  const { token } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPublicInvoice(token).then(({ data, error: err }) => {
      if (err) setError(err);
      else setInvoice(data);
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          <AlertCircle size={40} className="mx-auto mb-3 text-gray-300" />
          <h1 className="text-lg font-semibold text-gray-800 mb-1">Invoice not found</h1>
          <p className="text-sm text-gray-400">This link may have expired or the invoice is no longer public.</p>
        </div>
      </div>
    );
  }

  const from = invoice.from_details || {};
  const billTo = invoice.bill_to || {};
  const lineItems = invoice.line_items || [];
  const totals = invoice.totals || {};
  const payment = invoice.payment_details || {};
  const currency = invoice.currency || 'USD';

  const subtotal = lineItems.reduce((s, li) => s + (Number(li.qty || 0) * Number(li.price || 0)), 0);
  const additions = totals.additions || [];
  let total = subtotal;
  additions.forEach((a) => {
    const amt = a.isPercent ? (subtotal * Number(a.value || 0)) / 100 : Number(a.value || 0);
    total += a.sign === -1 ? -amt : amt;
  });

  const statusColors = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      {/* Download bar */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">W</span>
          </div>
          <span>Sent via WorkBoard</span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-white rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <FileDown size={14} />
          Download PDF
        </button>
      </div>

      {/* Invoice document */}
      <div id="invoice-document" className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm overflow-hidden print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="px-10 pt-10 pb-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              {from.logo && (
                <img src={from.logo} alt="Logo" className="h-12 mb-3 object-contain" />
              )}
              <h1 className="text-2xl font-bold text-gray-900">INVOICE</h1>
              <p className="text-sm text-gray-400 mt-0.5">#{invoice.invoice_number}</p>
            </div>
            <div className="text-right">
              <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusColors[invoice.status] || statusColors.draft}`}>
                {invoice.status || 'Draft'}
              </span>
              <p className="text-xs text-gray-400 mt-2">Issued: {fmtDate(invoice.issue_date)}</p>
              <p className="text-xs text-gray-500 font-medium">Due: {fmtDate(invoice.due_date)}</p>
            </div>
          </div>

          {/* From / Bill To */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">From</p>
              {from.name && <p className="text-sm font-semibold text-gray-800">{from.name}</p>}
              {from.email && <p className="text-sm text-gray-500">{from.email}</p>}
              {from.phone && <p className="text-sm text-gray-500">{from.phone}</p>}
              {from.address && <p className="text-sm text-gray-500 whitespace-pre-line">{from.address}</p>}
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Bill To</p>
              {billTo.name && <p className="text-sm font-semibold text-gray-800">{billTo.name}</p>}
              {billTo.email && <p className="text-sm text-gray-500">{billTo.email}</p>}
              {billTo.phone && <p className="text-sm text-gray-500">{billTo.phone}</p>}
              {billTo.address && <p className="text-sm text-gray-500 whitespace-pre-line">{billTo.address}</p>}
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="px-10 pb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</th>
                <th className="text-right py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-16">Qty</th>
                <th className="text-right py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">Price</th>
                <th className="text-right py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lineItems.map((li, i) => (
                <tr key={i}>
                  <td className="py-3 text-gray-700">{li.description}</td>
                  <td className="py-3 text-right text-gray-500">{li.qty}</td>
                  <td className="py-3 text-right text-gray-500">{fmt(li.price, currency)}</td>
                  <td className="py-3 text-right font-medium text-gray-800">{fmt(li.qty * li.price, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-6 ml-auto w-64">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Subtotal</span>
              <span>{fmt(subtotal, currency)}</span>
            </div>
            {additions.map((a, i) => {
              const amt = a.isPercent ? (subtotal * Number(a.value || 0)) / 100 : Number(a.value || 0);
              return (
                <div key={i} className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>{a.label}{a.isPercent ? ` (${a.value}%)` : ''}</span>
                  <span>{a.sign === -1 ? '−' : '+'} {fmt(amt, currency)}</span>
                </div>
              );
            })}
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-3 mt-1">
              <span>Total</span>
              <span>{fmt(total, currency)}</span>
            </div>
          </div>
        </div>

        {/* Payment details */}
        {payment.method && invoice.invoice_settings?.show_payment !== false && (
          <div className="px-10 pb-8">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Payment Details</p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
              <p className="font-medium text-gray-800">{payment.method}</p>
              {Object.entries(payment.fields || {}).map(([k, v]) => (
                <p key={k}><span className="text-gray-400">{k}:</span> {v}</p>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="px-10 pb-10">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</p>
            <p className="text-sm text-gray-500 whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-10 py-5 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-300">Created with WorkBoard</p>
          <p className="text-xs text-gray-400 font-medium">{invoice.invoice_number}</p>
        </div>
      </div>
    </div>
  );
}
