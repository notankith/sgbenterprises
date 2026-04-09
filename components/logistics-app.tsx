"use client";

import { ChangeEvent, Fragment, useEffect, useMemo, useState } from 'react';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Truck,
  UploadCloud,
  UserCircle,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type TabKey = 'dashboard' | 'invoices' | 'import' | 'trips' | 'approvals' | 'expenses' | 'backup';
type TripsSubTab = 'new' | 'past';
type InvoiceFilterKey = 'invoiceNumber' | 'date' | 'shopName' | 'amount' | 'deliveryStatus' | 'paymentStatus';

type InvoiceFilters = {
  invoiceNumber: string;
  shopName: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  deliveryStatus: string;
  paymentStatus: string;
};

type InvoiceRow = {
  _id: string;
  invoiceNumber: string;
  date: string;
  shopName: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  deliveryStatus: 'delivered' | 'pending';
  deliveryPerson?: string | null;
  assignedTripId?: string;
  notes?: { text: string; timestamp: string }[];
  paymentHistory?: { date: string; amount: number; mode: string; collectedBy: string }[];
  deliveredAt?: string;
  deliveredDate?: string;
};

type Summary = {
  totalInvoices: number;
  paid: number;
  partial: number;
  unpaid: number;
  revenue: number;
  expenses: number;
  net: number;
  pendingCollections: number;
  delivered: number;
  pendingDelivery: number;
  driverPerformance: { name: string; assigned: number; delivered: number; efficiency: number }[];
  problemZone: {
    highPendingInvoices: boolean;
    lowPerformingDrivers: { name: string; assigned: number; delivered: number; efficiency: number }[];
    highExpenses: boolean;
  };
};

type ApprovalRow = {
  _id: string;
  type: 'payment' | 'expense';
  status: 'pending' | 'approved';
  payload: Record<string, any>;
};

type Agent = { _id: string; name: string; username?: string };

type TripInvoice = {
  invoiceNumber: string;
  shopName: string;
  totalAmount: number;
  deliveryStatus: string;
};

type TripSheet = {
  _id: string;
  agentId?: string;
  agentName: string;
  invoiceNumbers: string[];
  invoiceIds?: string[];
  createdAt: string;
  invoiceCount: number;
  totalAmount: number;
  status: string;
  invoices: TripInvoice[];
};

type ImportStats = {
  inserted: number;
  duplicates: number;
  errors: number;
};

type Tab = { key: TabKey; label: string; icon: typeof LayoutDashboard };

const tabs: Tab[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'import', label: 'Import', icon: UploadCloud },
  { key: 'trips', label: 'Trip Sheets', icon: Truck },
  { key: 'approvals', label: 'Approvals', icon: ShieldCheck },
  { key: 'expenses', label: 'Expenses', icon: Wallet },
  { key: 'backup', label: 'Backup', icon: Database },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function statusBadgeClass(status: string) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'partial') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'unpaid') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'delivered') return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof LayoutDashboard; tone: string }) {
  return (
    <div className={`card p-5 transition hover:-translate-y-0.5 ${tone}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function LogisticsApp() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [apiError, setApiError] = useState('');
  const [pageLoading, setPageLoading] = useState(true);

  const [summary, setSummary] = useState<Summary | null>(null);

  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoicePage, setInvoicePage] = useState(1);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [activeInvoiceFilter, setActiveInvoiceFilter] = useState<InvoiceFilterKey | null>(null);
  const [invoiceFilters, setInvoiceFilters] = useState<InvoiceFilters>({
    invoiceNumber: '',
    shopName: '',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    deliveryStatus: '',
    paymentStatus: '',
  });

  const [importMessage, setImportMessage] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importStats, setImportStats] = useState<ImportStats>({ inserted: 0, duplicates: 0, errors: 0 });

  const [tripsSubTab, setTripsSubTab] = useState<TripsSubTab>('new');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [agentForm, setAgentForm] = useState({ name: '', username: '', password: '' });
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [tripSheets, setTripSheets] = useState<TripSheet[]>([]);
  const [pendingPool, setPendingPool] = useState<InvoiceRow[]>([]);
  const [tripSelected, setTripSelected] = useState<string[]>([]);
  const [tripSearch, setTripSearch] = useState('');
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);

  const debouncedInvoiceNumber = useDebouncedValue(invoiceFilters.invoiceNumber);
  const debouncedShopName = useDebouncedValue(invoiceFilters.shopName);
  const debouncedAmountMin = useDebouncedValue(invoiceFilters.amountMin);
  const debouncedAmountMax = useDebouncedValue(invoiceFilters.amountMax);
  const debouncedTripSearch = useDebouncedValue(tripSearch, 300);

  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const pageSize = 20;
  const invoicePages = useMemo(() => Math.max(1, Math.ceil(invoiceTotal / pageSize)), [invoiceTotal]);
  const pageTitle = tabs.find((t) => t.key === activeTab)?.label || 'Dashboard';
  const filteredPendingPool = useMemo(() => {
    const q = debouncedTripSearch.trim().toLowerCase();
    if (!q) return pendingPool;
    return pendingPool.filter((row) => row.invoiceNumber.toLowerCase().includes(q) || row.shopName.toLowerCase().includes(q));
  }, [pendingPool, debouncedTripSearch]);

  async function fetchJson(url: string, options?: RequestInit) {
    const res = await fetch(url, options);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed: ${res.status}`);
    return json;
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  }

  async function loadSummary() {
    const data = await fetchJson('/api/dashboard/summary');
    setSummary(data);
  }

  async function loadInvoices(page = invoicePage) {
    setInvoiceLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        invoiceNumber: debouncedInvoiceNumber,
        shopName: debouncedShopName,
        dateFrom: invoiceFilters.dateFrom,
        dateTo: invoiceFilters.dateTo,
        amountMin: debouncedAmountMin,
        amountMax: debouncedAmountMax,
        deliveryStatus: invoiceFilters.deliveryStatus,
        paymentStatus: invoiceFilters.paymentStatus,
      });
      const data = await fetchJson(`/api/invoices?${params.toString()}`);
      setInvoiceRows(data.rows || []);
      setInvoiceTotal(data.total || 0);
      setInvoicePage(data.page || 1);
    } finally {
      setInvoiceLoading(false);
    }
  }

  async function loadApprovals() {
    const data = await fetchJson('/api/approvals');
    setApprovals(data);
  }

  async function loadExpenses() {
    const data = await fetchJson('/api/expenses');
    setExpenses(data);
  }

  async function loadTripSheets() {
    const data = await fetchJson('/api/trips');
    setTripSheets(data);
  }

  async function loadAgents() {
    const data = await fetchJson('/api/trips/agents');
    setAgents(data);
    if (!selectedAgentId && data.length) setSelectedAgentId(data[0]._id);
  }

  async function loadPendingPool() {
    const params = new URLSearchParams({ page: '1', pageSize: '5000', deliveryStatus: 'pending' });
    const data = await fetchJson(`/api/invoices?${params.toString()}`);
    setPendingPool(
      (data.rows || []).filter(
        (r: InvoiceRow) => !r.assignedTripId && (r.paymentStatus === 'unpaid' || r.paymentStatus === 'partial'),
      ),
    );
  }

  async function refreshAll() {
    setApiError('');
    setPageLoading(true);
    try {
      await Promise.all([loadSummary(), loadInvoices(1), loadApprovals(), loadExpenses(), loadTripSheets(), loadAgents()]);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (!pageLoading) {
      loadInvoices(1).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to load invoices'));
    }
  }, [
    debouncedInvoiceNumber,
    debouncedShopName,
    debouncedAmountMin,
    debouncedAmountMax,
    invoiceFilters.dateFrom,
    invoiceFilters.dateTo,
    invoiceFilters.deliveryStatus,
    invoiceFilters.paymentStatus,
  ]);

  useEffect(() => {
    if (activeTab === 'trips') {
      loadPendingPool().catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to load pending invoices'));
    }
  }, [activeTab]);

  async function addDeliveryAgent() {
    const name = agentForm.name.trim();
    const username = agentForm.username.trim();
    const password = agentForm.password.trim();
    if (!name || !username || !password) return;

    const data = await fetchJson('/api/trips/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password }),
    });

    setAgentForm({ name: '', username: '', password: '' });
    setShowAgentModal(false);
    await loadAgents();
    if (data?.agent?._id) setSelectedAgentId(data.agent._id);
  }

  async function submitPaymentApproval(invoice: InvoiceRow) {
    const amountStr = prompt('Enter payment amount');
    if (!amountStr) return;
    const mode = prompt('Payment mode (cash, upi, bank, etc.)') || 'cash';
    const collectedBy = prompt('Collected by') || 'staff';
    const amount = Number(amountStr);
    if (!amount || amount <= 0) return;

    await fetchJson('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment',
        payload: {
          invoiceNumber: invoice.invoiceNumber,
          invoiceId: invoice._id,
          amount,
          mode,
          collectedBy,
          date: new Date().toISOString().slice(0, 10),
        },
      }),
    });
    await loadApprovals();
  }

  async function addNote(invoice: InvoiceRow) {
    const text = prompt('Add note');
    if (!text) return;
    await fetchJson(`/api/invoices/${encodeURIComponent(invoice.invoiceNumber)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteText: text, invoiceId: invoice._id }),
    });
    await loadInvoices();
  }

  async function archiveInvoice(invoice: InvoiceRow) {
    await fetchJson('/api/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceNumber: invoice.invoiceNumber, archive: true }),
    });
    await Promise.all([loadInvoices(), loadSummary()]);
  }

  async function onImportFile(file: File) {
    setImportLoading(true);
    setImportMessage('Reading and importing Excel file...');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/import/preview', { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportMessage(json.error || 'Import failed');
        return;
      }

      const data = await fetchJson('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: json.preview || [], ignoredTotalRows: Number(json.summary?.ignoredTotalRows || 0) }),
      });

      setImportStats({
        inserted: Number(data.inserted || 0),
        duplicates: Number(data.duplicatesFound || 0),
        errors: Number(data.missingFound || 0),
      });

      setImportMessage('Import completed successfully.');
      await Promise.all([loadInvoices(1), loadSummary()]);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  }

  async function addToSelectedAgent() {
    if (!selectedAgentId || tripSelected.length === 0) return;
    const selectedInvoices = pendingPool.filter((p) => tripSelected.includes(p._id));
    await fetchJson('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: selectedAgentId,
        invoiceIds: tripSelected,
        invoiceNumbers: selectedInvoices.map((x) => x.invoiceNumber),
      }),
    });
    setTripSelected([]);
    await Promise.all([loadTripSheets(), loadPendingPool(), loadInvoices(), loadSummary()]);
  }

  function addPendingInvoicesForSelectedShops() {
    const selectedInvoices = pendingPool.filter((p) => tripSelected.includes(p._id));
    const shops = new Set(selectedInvoices.map((x) => x.shopName));
    if (!shops.size) return;
    const fromSameShops = pendingPool.filter((x) => shops.has(x.shopName));
    const merged = Array.from(new Set([...tripSelected, ...fromSameShops.map((x) => x._id)]));
    setTripSelected(merged);
  }

  function selectVisibleTrips(checked: boolean) {
    if (!checked) {
      const visible = new Set(filteredPendingPool.map((x) => x._id));
      setTripSelected((prev) => prev.filter((x) => !visible.has(x)));
      return;
    }
    const merged = Array.from(new Set([...tripSelected, ...filteredPendingPool.map((x) => x._id)]));
    setTripSelected(merged);
  }

  async function approveItem(id: string) {
    await fetchJson(`/api/approvals/${id}/approve`, { method: 'POST' });
    await Promise.all([loadApprovals(), loadInvoices(), loadSummary(), loadExpenses()]);
  }

  async function downloadBackup() {
    const res = await fetch('/api/backup');
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || 'Backup failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logistics-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const expenseApprovals = approvals.filter((a) => a.type === 'expense');
  const paymentApprovals = approvals.filter((a) => a.type === 'payment');
  const selectedAgent = agents.find((a) => a._id === selectedAgentId);
  const selectedAgentTrips = selectedAgent
    ? tripSheets.filter((t) => (t.agentId ? t.agentId === selectedAgentId : t.agentName === selectedAgent.name))
    : [];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-6 py-6">
        <aside className="sticky top-6 hidden h-fit w-60 shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Logistics</p>
              <p className="text-xs text-slate-500">Internal Console</p>
            </div>
          </div>

          <nav className="mt-6 space-y-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                    activeTab === t.key
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 space-y-2">
            <button
              onClick={refreshAll}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              Refresh Data
            </button>
            <button
              onClick={logout}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{pageTitle}</p>
              <h1 className="text-2xl font-semibold text-slate-900">{pageTitle}</h1>
            </div>
              <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                <UserCircle className="h-4 w-4" />
                Admin
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>

          {apiError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {apiError}
            </div>
          ) : null}

          {!pageLoading && activeTab === 'dashboard' && summary ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard label="Total Invoices" value={String(summary.totalInvoices)} icon={FileText} tone="" />
                <StatCard label="Paid" value={String(summary.paid)} icon={CheckCircle2} tone="" />
                <StatCard label="Revenue" value={formatMoney(summary.revenue)} icon={Wallet} tone="" />
                <StatCard label="Expenses" value={formatMoney(summary.expenses)} icon={AlertTriangle} tone="" />
                <StatCard label="Net" value={formatMoney(summary.net)} icon={LayoutDashboard} tone="" />
                <StatCard label="Pending" value={formatMoney(summary.pendingCollections)} icon={XCircle} tone="" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-900">Driver Performance</h3>
                  <div className="mt-3 space-y-2">
                    {summary.driverPerformance.slice(0, 10).map((d) => (
                      <div key={d.name} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <span>{d.name}</span>
                        <span className="text-slate-500">
                          {d.delivered}/{d.assigned} ({d.efficiency}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-900">Problem Zone</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li className="rounded-lg border border-slate-200 px-3 py-2">
                      High pending invoices: {summary.problemZone.highPendingInvoices ? 'Yes' : 'No'}
                    </li>
                    <li className="rounded-lg border border-slate-200 px-3 py-2">
                      Low-performing drivers: {summary.problemZone.lowPerformingDrivers.length}
                    </li>
                    <li className="rounded-lg border border-slate-200 px-3 py-2">
                      High expenses: {summary.problemZone.highExpenses ? 'Yes' : 'No'}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          {!pageLoading && activeTab === 'invoices' ? (
            <InvoiceTable
              rows={invoiceRows}
              loading={invoiceLoading}
              filters={invoiceFilters}
              setFilters={setInvoiceFilters}
              activeFilter={activeInvoiceFilter}
              setActiveFilter={setActiveInvoiceFilter}
              expandedInvoice={expandedInvoice}
              setExpandedInvoice={setExpandedInvoice}
              page={invoicePage}
              pages={invoicePages}
              total={invoiceTotal}
              onPrev={() => loadInvoices(invoicePage - 1)}
              onNext={() => loadInvoices(invoicePage + 1)}
              onAddPayment={submitPaymentApproval}
              onAddNote={addNote}
              onArchive={archiveInvoice}
            />
          ) : null}

          {!pageLoading && activeTab === 'import' ? (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Import invoices</h3>
                    <p className="mt-1 text-xs text-slate-500">Upload an Excel file to import invoice records.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                    <UploadCloud className="h-4 w-4" />
                    {importLoading ? 'Importing...' : 'Upload file'}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files?.[0] && onImportFile(e.target.files[0])}
                    />
                  </label>
                </div>
                {importMessage ? <p className="mt-2 text-xs text-slate-500">{importMessage}</p> : null}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="card p-5 transition hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Inserted</p>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{importStats.inserted}</p>
                </div>
                <div className="card p-5 transition hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Duplicates</p>
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{importStats.duplicates}</p>
                </div>
                <div className="card p-5 transition hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-rose-600">Errors / Missing</p>
                    <XCircle className="h-5 w-5 text-rose-500" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{importStats.errors}</p>
                </div>
              </div>
            </div>
          ) : null}

          {!pageLoading && activeTab === 'trips' ? (
            <div className="space-y-4">
                <div className="card p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Delivery agents</h3>
                      <p className="mt-1 text-xs text-slate-500">Create and assign agents using unique accounts.</p>
                    </div>
                    <button
                      onClick={() => setShowAgentModal(true)}
                      className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                    >
                      Create Agent
                    </button>
                  </div>
                </div>

              {showAgentModal ? (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4">
                  <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Create Agent</h3>
                      <button onClick={() => setShowAgentModal(false)} className="text-xs text-slate-500">Close</button>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Agent Name</label>
                        <input
                          value={agentForm.name}
                          onChange={(e) => setAgentForm((p) => ({ ...p, name: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Username</label>
                        <input
                          value={agentForm.username}
                          onChange={(e) => setAgentForm((p) => ({ ...p, username: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Password</label>
                        <input
                          type="password"
                          value={agentForm.password}
                          onChange={(e) => setAgentForm((p) => ({ ...p, password: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setShowAgentModal(false)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => addDeliveryAgent().catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to add agent'))}
                          className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white"
                        >
                          Create
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                <div className="card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery agents</p>
                  <div className="mt-3 space-y-1">
                      {agents.map((a) => (
                      <button
                        key={a._id}
                          onClick={() => setSelectedAgentId(a._id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                          selectedAgentId === a._id
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-slate-900">{a.name}</p>
                          <p className="text-xs text-slate-500">{a.username}</p>
                        </div>
                        {selectedAgentId === a._id ? <ChevronDown className="h-4 w-4" /> : null}
                      </button>
                    ))}
                    {!agents.length ? <p className="text-sm text-slate-500">No agents created.</p> : null}
                  </div>
                </div>

                <div className="card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {selectedAgent ? `${selectedAgent.name} · Trip sheets` : 'Select a delivery agent'}
                      </h3>
                      <p className="text-xs text-slate-500">Manage new and past assignments.</p>
                    </div>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs">
                      <button
                        onClick={() => setTripsSubTab('new')}
                        className={`rounded-md px-3 py-1 ${tripsSubTab === 'new' ? 'bg-brand-50 text-brand-700' : ''}`}
                      >
                        New
                      </button>
                      <button
                        onClick={() => setTripsSubTab('past')}
                        className={`rounded-md px-3 py-1 ${tripsSubTab === 'past' ? 'bg-brand-50 text-brand-700' : ''}`}
                      >
                        Past
                      </button>
                    </div>
                  </div>

                  {tripsSubTab === 'new' ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                        <input
                          value={tripSearch}
                          onChange={(e) => setTripSearch(e.target.value)}
                          placeholder="Search by invoice number or shop name"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        />
                        <button
                          onClick={() => selectVisibleTrips(true)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
                        >
                          Select visible
                        </button>
                        <button
                          onClick={() => selectVisibleTrips(false)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
                        >
                          Clear visible
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={addPendingInvoicesForSelectedShops}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
                        >
                          Add Credit Note
                        </button>
                        <button
                          onClick={() => addToSelectedAgent().catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to assign invoices'))}
                          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                        >
                          Assign to agent
                        </button>
                        <span className="text-xs text-slate-500">
                          Showing {filteredPendingPool.length} of {pendingPool.length} · Selected {tripSelected.length}
                        </span>
                      </div>

                      <div className="max-h-[480px] overflow-auto rounded-lg border border-slate-200">
                        {filteredPendingPool.map((r) => (
                          <label key={r._id} className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 text-sm hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={tripSelected.includes(r._id)}
                              onChange={(e) =>
                                setTripSelected((prev) =>
                                  e.target.checked ? [...prev, r._id] : prev.filter((x) => x !== r._id),
                                )
                              }
                            />
                            <div>
                              <p className="font-medium text-slate-900">{r.invoiceNumber}</p>
                              <p className="text-xs text-slate-500">{r.shopName}</p>
                            </div>
                            <span className="ml-auto text-sm text-slate-600">{formatMoney(r.totalAmount)}</span>
                          </label>
                        ))}
                        {!filteredPendingPool.length ? <p className="p-4 text-sm text-slate-500">No matching pending invoices.</p> : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {selectedAgentTrips.map((t) => (
                        <div key={t._id} className="rounded-lg border border-slate-200 bg-white">
                          <button
                            onClick={() => setExpandedTrip(expandedTrip === t._id ? null : t._id)}
                            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-slate-50"
                          >
                            <div>
                              <p className="font-medium text-slate-900">{t.agentName}</p>
                              <p className="text-xs text-slate-500">
                                {t.invoiceCount} invoices · {formatMoney(t.totalAmount)} · {new Date(t.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <Badge className={t.status === 'Complete' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                              {t.status}
                            </Badge>
                          </button>
                          <AnimatePresence initial={false}>
                            {expandedTrip === t._id ? (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="overflow-hidden"
                              >
                                <div className="border-t border-slate-200 px-4 py-3">
                                  <div className="grid gap-2">
                                    {t.invoices.map((inv) => (
                                      <div key={inv.invoiceNumber} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                        <div>
                                          <p className="font-medium text-slate-900">{inv.invoiceNumber}</p>
                                          <p className="text-xs text-slate-500">{inv.shopName}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <Badge className={statusBadgeClass(inv.deliveryStatus)}>{inv.deliveryStatus}</Badge>
                                          <span className="text-slate-600">{formatMoney(inv.totalAmount)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </div>
                      ))}
                      {!selectedAgentTrips.length ? <p className="text-sm text-slate-500">No past trip sheets for this agent.</p> : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {!pageLoading && activeTab === 'approvals' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-900">Pending payment approvals</h3>
                <div className="mt-3 space-y-2">
                  {paymentApprovals.map((a) => (
                    <div key={a._id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-slate-900">{a.payload.invoiceNumber}</p>
                      <p className="text-slate-500">Amount: {a.payload.amount} · Mode: {a.payload.mode} · By: {a.payload.collectedBy}</p>
                      <button
                        onClick={() => approveItem(a._id).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to approve'))}
                        className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
                      >
                        Approve
                      </button>
                    </div>
                  ))}
                  {!paymentApprovals.length ? <p className="text-sm text-slate-500">No pending payments.</p> : null}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-900">Pending expense approvals</h3>
                <div className="mt-3 space-y-2">
                  {expenseApprovals.map((a) => (
                    <div key={a._id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-slate-900">{a.payload.category}</p>
                      <p className="text-slate-500">Amount: {a.payload.amount} · Date: {a.payload.date} · By: {a.payload.addedBy}</p>
                      <button
                        onClick={() => approveItem(a._id).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to approve'))}
                        className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
                      >
                        Approve
                      </button>
                    </div>
                  ))}
                  {!expenseApprovals.length ? <p className="text-sm text-slate-500">No pending expenses.</p> : null}
                </div>
              </div>
            </div>
          ) : null}

          {!pageLoading && activeTab === 'expenses' ? (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">Expenses</h3>
                <p className="mt-1 text-xs text-slate-500">Review expense records managed via approvals.</p>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium">Added By</th>
                      <th className="px-4 py-3 text-left text-xs font-medium">Notes</th>
                      <th className="px-4 py-3 text-left text-xs font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e._id} className="border-t border-slate-200">
                        <td className="px-4 py-4">{e.date}</td>
                        <td className="px-4 py-4">{formatMoney(e.amount)}</td>
                        <td className="px-4 py-4">{e.category}</td>
                        <td className="px-4 py-4">{e.addedBy}</td>
                        <td className="px-4 py-4">{e.notes || '-'}</td>
                        <td className="px-4 py-4">{e.approvedAt ? 'Approved' : 'Pending'}</td>
                      </tr>
                    ))}
                    {!expenses.length ? (
                      <tr className="border-t border-slate-200">
                        <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                          No expenses found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {!pageLoading && activeTab === 'backup' ? (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900">Manual backup</h3>
              <p className="mt-1 text-sm text-slate-500">Download invoices, payments, and expenses as a single Excel file.</p>
              <button
                onClick={() => downloadBackup().catch((e) => setApiError(e instanceof Error ? e.message : 'Backup failed'))}
                className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                Download backup
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function InvoiceTable({
  rows,
  loading,
  filters,
  setFilters,
  activeFilter,
  setActiveFilter,
  expandedInvoice,
  setExpandedInvoice,
  page,
  pages,
  total,
  onPrev,
  onNext,
  onAddPayment,
  onAddNote,
  onArchive,
}: {
  rows: InvoiceRow[];
  loading: boolean;
  filters: InvoiceFilters;
  setFilters: React.Dispatch<React.SetStateAction<InvoiceFilters>>;
  activeFilter: InvoiceFilterKey | null;
  setActiveFilter: React.Dispatch<React.SetStateAction<InvoiceFilterKey | null>>;
  expandedInvoice: string | null;
  setExpandedInvoice: React.Dispatch<React.SetStateAction<string | null>>;
  page: number;
  pages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onAddPayment: (invoice: InvoiceRow) => void;
  onAddNote: (invoice: InvoiceRow) => void;
  onArchive: (invoice: InvoiceRow) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<InvoiceRow>[]>(
    () => [
      {
        accessorKey: 'invoiceNumber',
        header: 'Invoice Number',
        meta: { filter: 'invoiceNumber' },
      },
      {
        accessorKey: 'date',
        header: 'Date',
        meta: { filter: 'date' },
      },
      {
        accessorKey: 'shopName',
        header: 'Shop Name',
        meta: { filter: 'shopName' },
      },
      {
        accessorKey: 'totalAmount',
        header: 'Amount',
        meta: { filter: 'amount' },
        cell: (info) => formatMoney(Number(info.getValue() || 0)),
      },
      {
        accessorKey: 'deliveryStatus',
        header: 'Delivery Status',
        meta: { filter: 'deliveryStatus' },
        cell: (info) => <Badge className={statusBadgeClass(String(info.getValue()))}>{String(info.getValue())}</Badge>,
      },
      {
        accessorKey: 'paymentStatus',
        header: 'Payment Status',
        meta: { filter: 'paymentStatus' },
        cell: (info) => <Badge className={statusBadgeClass(String(info.getValue()))}>{String(info.getValue())}</Badge>,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white text-slate-600">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 text-left text-xs font-medium">
                      {header.isPlaceholder ? null : (
                        <InvoiceHeader
                          columnId={String(header.column.id)}
                          label={String(header.column.columnDef.header)}
                          filterKey={(header.column.columnDef.meta as { filter: InvoiceFilterKey } | undefined)?.filter}
                          activeFilter={activeFilter}
                          setActiveFilter={setActiveFilter}
                          filters={filters}
                          setFilters={setFilters}
                          sortState={header.column.getIsSorted()}
                          onSort={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-200">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="skeleton h-6 w-full" />
                      </td>
                    </tr>
                  ))
                : table.getRowModel().rows.length === 0
                  ? (
                    <tr className="border-b border-slate-200">
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                        No invoices found.
                      </td>
                    </tr>
                  )
                  : table.getRowModel().rows.map((row) => (
                      <Fragment key={row.id}>
                        <tr
                          className="border-b border-slate-200 hover:bg-slate-50"
                          onClick={() => setExpandedInvoice(expandedInvoice === row.original._id ? null : row.original._id)}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-4 py-4 text-sm text-slate-700">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                        <AnimatePresence initial={false}>
                          {expandedInvoice === row.original._id ? (
                            <motion.tr
                              key={`${row.id}-expanded`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <td colSpan={6} className="bg-slate-50 px-4 py-4">
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: 'auto' }}
                                  exit={{ height: 0 }}
                                  transition={{ duration: 0.2, ease: 'easeOut' }}
                                  className="overflow-hidden"
                                >
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                                      {row.original.deliveryStatus === 'delivered' ? (
                                        <div className="space-y-2 text-sm">
                                          <div className="flex items-center justify-between">
                                            <span className="text-slate-500">Delivery agent</span>
                                            <span className="font-medium text-slate-900">{row.original.deliveryPerson || 'Unassigned'}</span>
                                          </div>
                                          {row.original.deliveredAt || row.original.deliveredDate ? (
                                            <div className="flex items-center justify-between">
                                              <span className="text-slate-500">Delivered date</span>
                                              <span className="font-medium text-slate-900">{row.original.deliveredAt || row.original.deliveredDate}</span>
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <Badge className={statusBadgeClass('pending')}>Not Delivered</Badge>
                                      )}
                                    </div>

                                    {(row.original.paymentHistory || []).length ? (
                                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                                        <div className="space-y-2 text-sm">
                                          {row.original.paymentHistory!
                                            .slice()
                                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                            .map((p, i) => (
                                              <div key={i} className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="font-medium text-slate-900">{formatMoney(p.amount)}</span>
                                                <span className="text-xs text-slate-500">{p.date}</span>
                                                <span className="text-xs text-slate-500">Collected by: {p.collectedBy}</span>
                                                {p.mode ? <span className="text-xs text-slate-500">{p.mode}</span> : null}
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
                                    <div>Total Amount: <span className="font-medium text-slate-900">{formatMoney(row.original.totalAmount)}</span></div>
                                    <div>Total Paid: <span className="font-medium text-slate-900">{formatMoney((row.original.paymentHistory || []).reduce((sum, p) => sum + Number(p.amount || 0), 0) || row.original.paidAmount || 0)}</span></div>
                                    <div>Remaining: <span className="font-medium text-slate-900">{formatMoney(row.original.totalAmount - ((row.original.paymentHistory || []).reduce((sum, p) => sum + Number(p.amount || 0), 0) || row.original.paidAmount || 0))}</span></div>
                                  </div>

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAddPayment(row.original);
                                      }}
                                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 transition hover:bg-slate-100"
                                    >
                                      Add payment
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAddNote(row.original);
                                      }}
                                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 transition hover:bg-slate-100"
                                    >
                                      Add note
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onArchive(row.original);
                                      }}
                                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 transition hover:bg-slate-100"
                                    >
                                      Archive invoice
                                    </button>
                                  </div>
                                </motion.div>
                              </td>
                            </motion.tr>
                          ) : null}
                        </AnimatePresence>
                      </Fragment>
                    ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          disabled={page <= 1 || loading}
          onClick={onPrev}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-slate-500">
          Page {page}/{pages} · Total {total}
        </span>
        <button
          disabled={page >= pages || loading}
          onClick={onNext}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function InvoiceHeader({
  columnId,
  label,
  filterKey,
  activeFilter,
  setActiveFilter,
  filters,
  setFilters,
  sortState,
  onSort,
}: {
  columnId: string;
  label: string;
  filterKey?: InvoiceFilterKey;
  activeFilter: InvoiceFilterKey | null;
  setActiveFilter: React.Dispatch<React.SetStateAction<InvoiceFilterKey | null>>;
  filters: InvoiceFilters;
  setFilters: React.Dispatch<React.SetStateAction<InvoiceFilters>>;
  sortState: false | 'asc' | 'desc';
  onSort?: (event: unknown) => void;
}) {
  const isActive = filterKey && activeFilter === filterKey;

  const sortIcon = sortState === 'asc' ? <ChevronUp className="h-3 w-3" /> : sortState === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ArrowDownUp className="h-3 w-3" />;

  const close = () => setActiveFilter(null);

  const setFilterValue = (next: Partial<InvoiceFilters>) => setFilters((prev) => ({ ...prev, ...next }));

  return (
    <div className="flex items-center justify-between gap-2">
      {isActive ? (
        <div className="flex w-full items-center gap-2">
          {filterKey === 'invoiceNumber' ? (
            <input
              value={filters.invoiceNumber}
              onChange={(e) => setFilterValue({ invoiceNumber: e.target.value })}
              placeholder="Invoice"
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              autoFocus
            />
          ) : null}
          {filterKey === 'shopName' ? (
            <input
              value={filters.shopName}
              onChange={(e) => setFilterValue({ shopName: e.target.value })}
              placeholder="Shop"
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              autoFocus
            />
          ) : null}
          {filterKey === 'date' ? (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilterValue({ dateFrom: e.target.value })}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilterValue({ dateTo: e.target.value })}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          ) : null}
          {filterKey === 'amount' ? (
            <div className="flex items-center gap-1">
              <input
                value={filters.amountMin}
                onChange={(e) => setFilterValue({ amountMin: e.target.value })}
                placeholder="Min"
                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <input
                value={filters.amountMax}
                onChange={(e) => setFilterValue({ amountMax: e.target.value })}
                placeholder="Max"
                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          ) : null}
          {filterKey === 'deliveryStatus' ? (
            <select
              value={filters.deliveryStatus}
              onChange={(e) => setFilterValue({ deliveryStatus: e.target.value })}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="">All</option>
              <option value="delivered">Delivered</option>
              <option value="pending">Pending</option>
            </select>
          ) : null}
          {filterKey === 'paymentStatus' ? (
            <select
              value={filters.paymentStatus}
              onChange={(e) => setFilterValue({ paymentStatus: e.target.value })}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
          ) : null}
          <button onClick={close} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-500">
            Done
          </button>
        </div>
      ) : (
        <div className="flex w-full items-center justify-between gap-2">
          <button
            onClick={() => filterKey && setActiveFilter(filterKey)}
            className="flex items-center gap-2 text-left text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            {label}
          </button>
          {onSort ? (
            <button onClick={onSort} className="rounded-md border border-slate-200 p-1 text-slate-400 hover:text-slate-700">
              {sortIcon}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
