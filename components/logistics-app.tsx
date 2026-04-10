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
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  FilterX,
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

type TabKey = 'dashboard' | 'invoices' | 'importExport' | 'trips' | 'approvals' | 'cheques' | 'expenses';
type TripsSubTab = 'new' | 'past';
type TripInvoiceSort = 'numberAsc' | 'numberDesc';
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
  assignedAgentId?: unknown;
  notes?: { text: string; timestamp?: string; createdAt?: string; addedBy?: string }[];
  paymentHistory?: Array<{
    mode: string;
    amount: number;
    date: string;
    collectedBy: string;
    role?: 'driver' | 'admin';
    reference?: string | null;
    status?: 'pending' | 'approved' | 'rejected';
    chequeNumber?: string | null;
    bankName?: string | null;
    chequeStatus?: 'pending' | 'deposited' | 'cleared' | 'bounced' | null;
  }>;
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
  status: 'pending' | 'approved' | 'rejected';
  payload: Record<string, any>;
  createdAt?: string;
};

type ChequeRow = {
  _id: string;
  chequeNumber: string;
  amount: number;
  date: string;
  invoiceNumber: string;
  bankName: string;
  status: 'pending' | 'deposited' | 'cleared' | 'bounced';
  driverName?: string;
  tripsheetId?: string;
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
  { key: 'importExport', label: 'Import / Export', icon: UploadCloud },
  { key: 'trips', label: 'Trip Sheets', icon: Truck },
  { key: 'approvals', label: 'Approvals', icon: ShieldCheck },
  { key: 'cheques', label: 'Cheques', icon: Database },
  { key: 'expenses', label: 'Expenses', icon: Wallet },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusBadgeClass(status: string) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'partial') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'unpaid') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'delivered') return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function isInvoiceUnassigned(invoice: Pick<InvoiceRow, 'assignedTripId'>) {
  const assigned = String(invoice.assignedTripId || '').trim().toLowerCase();
  return !assigned || assigned === 'null' || assigned === 'undefined';
}

function hasPendingBalance(
  invoice: Pick<InvoiceRow, 'paymentStatus' | 'totalAmount' | 'paidAmount'>,
) {
  const payment = String(invoice.paymentStatus || 'unpaid').toLowerCase();
  const total = Number(invoice.totalAmount || 0);
  const paid = Number(invoice.paidAmount || 0);
  return payment !== 'paid' && paid < total;
}

function isPaymentDueInvoice(
  invoice: Pick<InvoiceRow, 'deliveryStatus' | 'paymentStatus' | 'totalAmount' | 'paidAmount'>,
) {
  const delivery = String(invoice.deliveryStatus || 'pending').toLowerCase();
  return delivery === 'delivered' && hasPendingBalance(invoice);
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
  const [importErrors, setImportErrors] = useState<Array<{ rowNumber: number; field: string; message: string }>>([]);
  const [showImportErrors, setShowImportErrors] = useState(false);

  const [exportLoading, setExportLoading] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    dateFrom: '',
    dateTo: '',
    driver: '',
    status: '',
  });
  const [exportTypes, setExportTypes] = useState<Record<string, boolean>>({
    invoices: true,
    tripsheets: true,
    payments: true,
    cheques: true,
    expenses: true,
  });

  const [tripsSubTab, setTripsSubTab] = useState<TripsSubTab>('new');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [agentForm, setAgentForm] = useState({ name: '', username: '', password: '' });
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [tripSheets, setTripSheets] = useState<TripSheet[]>([]);
  const [pendingPool, setPendingPool] = useState<InvoiceRow[]>([]);
  const [tripSelected, setTripSelected] = useState<string[]>([]);
  const [tripSearch, setTripSearch] = useState('');
  const [tripInvoiceSort, setTripInvoiceSort] = useState<TripInvoiceSort>('numberAsc');
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [tripFilters, setTripFilters] = useState({
    driver: '',
    dateFrom: '',
    dateTo: '',
  });
  const [tripInvoiceDetailOpen, setTripInvoiceDetailOpen] = useState(false);
  const [tripInvoiceDetail, setTripInvoiceDetail] = useState<InvoiceRow | null>(null);
  const [tripInvoiceDetailLoading, setTripInvoiceDetailLoading] = useState(false);
  const [tripInvoiceDetailError, setTripInvoiceDetailError] = useState('');

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<InvoiceRow | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    mode: 'cash',
    amount: '',
    receivedBy: '',
    date: new Date().toISOString().slice(0, 10),
    reference: '',
    chequeNumber: '',
    bankName: '',
  });
  const [paymentFormError, setPaymentFormError] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentRequestId, setPaymentRequestId] = useState('');

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteModalInvoice, setNoteModalInvoice] = useState<InvoiceRow | null>(null);
  const [noteForm, setNoteForm] = useState({ content: '', addedBy: 'Admin' });

  const [cheques, setCheques] = useState<ChequeRow[]>([]);
  const [chequeFilters, setChequeFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    driver: '',
    tripsheet: '',
  });
  const [chequeCreateForm, setChequeCreateForm] = useState({
    chequeNumber: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    invoiceNumber: '',
    bankName: '',
    driverName: '',
    tripsheetId: '',
  });
  const [chequeCreateError, setChequeCreateError] = useState('');
  const [chequeCreateSubmitting, setChequeCreateSubmitting] = useState(false);

  const debouncedInvoiceNumber = useDebouncedValue(invoiceFilters.invoiceNumber);
  const debouncedShopName = useDebouncedValue(invoiceFilters.shopName);
  const debouncedAmountMin = useDebouncedValue(invoiceFilters.amountMin);
  const debouncedAmountMax = useDebouncedValue(invoiceFilters.amountMax);
  const debouncedTripSearch = useDebouncedValue(tripSearch, 300);

  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expandedPaymentGroup, setExpandedPaymentGroup] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    category: '',
    addedBy: 'Admin',
    notes: '',
  });
  const [expenseFormError, setExpenseFormError] = useState('');
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  const pageSize = 20;
  const invoicePages = useMemo(() => Math.max(1, Math.ceil(invoiceTotal / pageSize)), [invoiceTotal]);
  const pageTitle = tabs.find((t) => t.key === activeTab)?.label || 'Dashboard';
  const filteredPendingPool = useMemo(() => {
    const q = debouncedTripSearch.trim().toLowerCase();
    const matched = q
      ? pendingPool.filter((row) => row.invoiceNumber.toLowerCase().includes(q) || row.shopName.toLowerCase().includes(q))
      : pendingPool;

    return matched.slice().sort((a, b) => {
      const left = String(a.invoiceNumber || '');
      const right = String(b.invoiceNumber || '');
      const base = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
      return tripInvoiceSort === 'numberDesc' ? -base : base;
    });
  }, [pendingPool, debouncedTripSearch, tripInvoiceSort]);

  const filteredTripHistory = useMemo(() => {
    const selectedAgent = agents.find((a) => a._id === selectedAgentId);
    const candidateTrips = selectedAgent
      ? tripSheets.filter((t) => (t.agentId ? t.agentId === selectedAgentId : t.agentName === selectedAgent.name))
      : [];

    const from = tripFilters.dateFrom ? new Date(tripFilters.dateFrom).getTime() : null;
    const to = tripFilters.dateTo ? new Date(tripFilters.dateTo).getTime() : null;
    const driverQ = tripFilters.driver.trim().toLowerCase();

    return candidateTrips.filter((trip) => {
      const byDriver = driverQ
        ? String(trip.agentName || '').toLowerCase().includes(driverQ)
        : true;
      const createdAt = new Date(trip.createdAt).getTime();
      const byFrom = from ? createdAt >= from : true;
      const byTo = to ? createdAt <= to + 24 * 60 * 60 * 1000 - 1 : true;
      return byDriver && byFrom && byTo;
    });
  }, [agents, selectedAgentId, tripSheets, tripFilters.dateFrom, tripFilters.dateTo, tripFilters.driver]);

  const expenseApprovals = approvals.filter((a) => a.type === 'expense');
  const paymentApprovals = approvals.filter((a) => a.type === 'payment');
  const tripSheetMetaById = useMemo(() => new Map(tripSheets.map((trip) => [trip._id, trip])), [tripSheets]);

  const groupedPaymentApprovals = useMemo(() => {
    const groups = new Map<string, { key: string; tripsheetId: string; driverName: string; rows: ApprovalRow[] }>();
    paymentApprovals.forEach((approval) => {
      const tripsheetId = String(approval.payload?.tripsheetId || 'Unassigned');
      const driverName = String(approval.payload?.driverName || approval.payload?.collectedBy || 'Unknown');
      const key = `${tripsheetId}::${driverName}`;
      if (!groups.has(key)) {
        groups.set(key, { key, tripsheetId, driverName, rows: [] });
      }
      groups.get(key)!.rows.push(approval);
    });

    return Array.from(groups.values()).map((group) => {
      const totals = group.rows.reduce(
        (acc, row) => {
          const amount = Number(row.payload?.amount || 0);
          const mode = String(row.payload?.mode || '').toLowerCase();
          acc.total += amount;
          if (mode === 'cash') acc.cash += amount;
          if (mode === 'upi') acc.upi += amount;
          if (mode === 'cheque') acc.cheque += amount;
          if (mode === 'credit_note') acc.creditNote += amount;
          return acc;
        },
        { total: 0, cash: 0, upi: 0, cheque: 0, creditNote: 0 },
      );

      const modeCounts = group.rows.reduce(
        (acc, row) => {
          const mode = String(row.payload?.mode || '').toLowerCase();
          if (mode === 'cash') acc.cash += 1;
          if (mode === 'upi') acc.upi += 1;
          if (mode === 'cheque') acc.cheque += 1;
          if (mode === 'credit_note') acc.creditNote += 1;
          return acc;
        },
        { cash: 0, upi: 0, cheque: 0, creditNote: 0 },
      );

      const deliveredCount = group.rows.filter((row) => row.payload?.deliveryStatus === 'delivered').length;
      const tripMeta = tripSheetMetaById.get(group.tripsheetId);

      return {
        ...group,
        totals,
        modeCounts,
        deliveredCount,
        tripsheetDate: tripMeta?.createdAt || null,
      };
    });
  }, [paymentApprovals, tripSheetMetaById]);

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

  async function loadCheques() {
    const params = new URLSearchParams({
      status: chequeFilters.status,
      dateFrom: chequeFilters.dateFrom,
      dateTo: chequeFilters.dateTo,
      driver: chequeFilters.driver,
      tripsheet: chequeFilters.tripsheet,
    });
    const data = await fetchJson(`/api/cheques?${params.toString()}`);
    setCheques(data || []);
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
    const params = new URLSearchParams({ page: '1', pageSize: '200000' });
    const data = await fetchJson(`/api/invoices?${params.toString()}`);
    setPendingPool(
      (data.rows || []).filter((r: InvoiceRow) => {
        const delivery = String(r.deliveryStatus || 'pending').toLowerCase();
        const includeForDelivery = isInvoiceUnassigned(r) && delivery !== 'delivered';
        const includeForPendingCollection = hasPendingBalance(r);
        return includeForDelivery || includeForPendingCollection;
      }),
    );
  }

  async function openTripInvoiceDetails(invoiceNumber: string) {
    const target = String(invoiceNumber || '').trim();
    if (!target) return;

    const local = pendingPool.find((x) => x.invoiceNumber === target) || invoiceRows.find((x) => x.invoiceNumber === target);
    setTripInvoiceDetail(local || null);
    setTripInvoiceDetailOpen(true);
    setTripInvoiceDetailLoading(true);
    setTripInvoiceDetailError('');

    try {
      const detail = await fetchJson(`/api/invoices/${encodeURIComponent(target)}`);
      setTripInvoiceDetail(detail);
    } catch (e) {
      setTripInvoiceDetailError(e instanceof Error ? e.message : 'Failed to load invoice details.');
      if (!local) setTripInvoiceDetail(null);
    } finally {
      setTripInvoiceDetailLoading(false);
    }
  }

  async function refreshAll() {
    setApiError('');
    setPageLoading(true);
    try {
      await Promise.all([
        loadSummary(),
        loadInvoices(1),
        loadApprovals(),
        loadExpenses(),
        loadCheques(),
        loadTripSheets(),
        loadAgents(),
      ]);
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

  useEffect(() => {
    if (activeTab === 'cheques') {
      loadCheques().catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to load cheques'));
    }
  }, [activeTab, chequeFilters.status, chequeFilters.dateFrom, chequeFilters.dateTo, chequeFilters.driver, chequeFilters.tripsheet]);

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

  function openPaymentModal(invoice: InvoiceRow) {
    const remaining = Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0));
    const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${invoice._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPaymentModalInvoice(invoice);
    setPaymentForm({
      mode: 'cash',
      amount: remaining ? String(remaining) : '',
      receivedBy: '',
      date: new Date().toISOString().slice(0, 10),
      reference: '',
      chequeNumber: '',
      bankName: '',
    });
    setPaymentRequestId(requestId);
    setPaymentFormError('');
    setShowPaymentModal(true);
  }

  async function submitPaymentApproval() {
    if (!paymentModalInvoice || paymentSubmitting) return;

    const amount = Number(paymentForm.amount);
    const mode = String(paymentForm.mode || '').toLowerCase();
    const receivedBy = paymentForm.receivedBy.trim();
    const reference = paymentForm.reference.trim();
    const chequeNumber = paymentForm.chequeNumber.trim();
    const bankName = paymentForm.bankName.trim();

    if (!['cash', 'upi', 'cheque', 'credit_note'].includes(mode)) {
      setPaymentFormError('Select a valid payment mode.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentFormError('Enter a valid payment amount.');
      return;
    }
    if (!receivedBy) {
      setPaymentFormError('Received By is required.');
      return;
    }
    if ((mode === 'upi' || mode === 'credit_note') && !reference) {
      setPaymentFormError(mode === 'upi' ? 'UPI reference is required.' : 'Credit note reference is required.');
      return;
    }
    if (mode === 'cheque' && (!chequeNumber || !bankName)) {
      setPaymentFormError('Cheque number and bank name are required for cheque payments.');
      return;
    }

    const requestId = paymentRequestId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${paymentModalInvoice._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    setPaymentSubmitting(true);
    setPaymentFormError('');
    try {
      const result = await fetchJson(`/api/invoices/${encodeURIComponent(paymentModalInvoice.invoiceNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment: {
            requestId,
            invoiceId: paymentModalInvoice._id,
            amount,
            mode,
            date: paymentForm.date,
            collectedBy: receivedBy,
            reference: reference || null,
            chequeNumber: chequeNumber || null,
            bankName: bankName || null,
            tripsheetId: paymentModalInvoice.assignedTripId || null,
            driverName: paymentModalInvoice.deliveryPerson || 'Unknown',
          },
        }),
      });

      setShowPaymentModal(false);
      setPaymentModalInvoice(null);
      setPaymentRequestId('');
      await Promise.all([loadInvoices(), loadSummary(), loadCheques(), loadPendingPool()]);

      if (result?.duplicate) {
        setApiError('Duplicate payment request ignored. Invoice is unchanged by repeat submits.');
      }
    } catch (e) {
      setPaymentFormError(e instanceof Error ? e.message : 'Failed to record payment.');
    } finally {
      setPaymentSubmitting(false);
    }
  }

  function openNoteModal(invoice: InvoiceRow) {
    setNoteModalInvoice(invoice);
    setNoteForm({ content: '', addedBy: 'Admin' });
    setShowNoteModal(true);
  }

  async function submitNote() {
    if (!noteModalInvoice) return;
    const content = noteForm.content.trim();
    if (!content) return;

    await fetchJson(`/api/invoices/${encodeURIComponent(noteModalInvoice.invoiceNumber)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        noteText: content,
        invoiceId: noteModalInvoice._id,
        addedBy: noteForm.addedBy,
      }),
    });

    setShowNoteModal(false);
    setNoteModalInvoice(null);
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
        setImportErrors([]);
        return;
      }

      setImportErrors(Array.isArray(json.errorLogs) ? json.errorLogs : []);

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
    const shops = new Set(selectedInvoices.map((x) => String(x.shopName || '').trim()).filter(Boolean));
    if (!shops.size) {
      setApiError('Select at least one invoice to include its shop in Credit Note selection.');
      return [] as string[];
    }

    const pendingByShops = pendingPool.filter((x) => shops.has(String(x.shopName || '').trim()) && hasPendingBalance(x));
    if (!pendingByShops.length) {
      setApiError('');
      return tripSelected;
    }

    const merged = Array.from(new Set([...tripSelected, ...pendingByShops.map((x) => x._id)]));
    setTripSelected(merged);
    setApiError('');
    return merged;
  }

  function openCreditNoteWorkflow() {
    addPendingInvoicesForSelectedShops();
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
    await Promise.all([loadApprovals(), loadInvoices(), loadSummary(), loadExpenses(), loadCheques()]);
  }

  async function approveGroup(rows: ApprovalRow[]) {
    const ids = rows.map((row) => row._id);
    if (!ids.length) return;
    await Promise.all(ids.map((id) => fetchJson(`/api/approvals/${id}/approve`, { method: 'POST' })));
    await Promise.all([loadApprovals(), loadInvoices(), loadSummary(), loadExpenses(), loadCheques()]);
  }

  async function rejectGroup(rows: ApprovalRow[]) {
    const ids = rows.map((row) => row._id);
    if (!ids.length) return;
    await Promise.all(
      ids.map((id) =>
        fetchJson(`/api/approvals/${id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      ),
    );
    await loadApprovals();
  }

  async function rejectItem(id: string) {
    await fetchJson(`/api/approvals/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    await loadApprovals();
  }

  async function updateChequeStatus(id: string, status: ChequeRow['status']) {
    await fetchJson(`/api/cheques/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await Promise.all([loadCheques(), loadInvoices(), loadSummary()]);
  }

  async function createChequeEntry() {
    if (chequeCreateSubmitting) return;

    const chequeNumber = chequeCreateForm.chequeNumber.trim();
    const amount = Number(chequeCreateForm.amount);
    const date = chequeCreateForm.date.trim();
    const invoiceNumber = chequeCreateForm.invoiceNumber.trim();
    const bankName = chequeCreateForm.bankName.trim();
    const driverName = chequeCreateForm.driverName.trim();
    const tripsheetId = chequeCreateForm.tripsheetId.trim();

    if (!chequeNumber || !date || !invoiceNumber || !bankName || !Number.isFinite(amount) || amount <= 0) {
      setChequeCreateError('Cheque number, amount, date, invoice number, and bank name are required.');
      return;
    }

    setChequeCreateSubmitting(true);
    setChequeCreateError('');
    try {
      await fetchJson('/api/cheques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chequeNumber,
          amount,
          date,
          invoiceNumber,
          bankName,
          driverName: driverName || undefined,
          tripsheetId: tripsheetId || undefined,
        }),
      });

      setChequeCreateForm({
        chequeNumber: '',
        amount: '',
        date: new Date().toISOString().slice(0, 10),
        invoiceNumber: '',
        bankName: '',
        driverName: '',
        tripsheetId: '',
      });
      await Promise.all([loadCheques(), loadInvoices(), loadSummary()]);
    } catch (e) {
      setChequeCreateError(e instanceof Error ? e.message : 'Failed to create cheque.');
    } finally {
      setChequeCreateSubmitting(false);
    }
  }

  async function submitExpense() {
    if (expenseSubmitting) return;
    const amount = Number(expenseForm.amount);
    const date = expenseForm.date.trim();
    const category = expenseForm.category.trim();
    const addedBy = expenseForm.addedBy.trim();
    const notes = expenseForm.notes.trim();

    if (!date || !category || !Number.isFinite(amount) || amount <= 0) {
      setExpenseFormError('Date, category, and valid amount are required.');
      return;
    }

    setExpenseSubmitting(true);
    setExpenseFormError('');
    try {
      await fetchJson('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direct: true,
          date,
          amount,
          category,
          addedBy: addedBy || 'Admin',
          notes,
        }),
      });
      setExpenseForm({
        date: new Date().toISOString().slice(0, 10),
        amount: '',
        category: '',
        addedBy: 'Admin',
        notes: '',
      });
      await Promise.all([loadExpenses(), loadSummary()]);
    } catch (e) {
      setExpenseFormError(e instanceof Error ? e.message : 'Failed to record expense.');
    } finally {
      setExpenseSubmitting(false);
    }
  }

  async function exportData() {
    const selectedTypes = Object.entries(exportTypes)
      .filter(([, value]) => value)
      .map(([key]) => key);

    if (!selectedTypes.length) {
      setApiError('Select at least one dataset for export.');
      return;
    }

    setExportLoading(true);
    const params = new URLSearchParams({
      types: selectedTypes.join(','),
      dateFrom: exportFilters.dateFrom,
      dateTo: exportFilters.dateTo,
      driver: exportFilters.driver,
      status: exportFilters.status,
    });

    const res = await fetch(`/api/export?${params.toString()}`);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setExportLoading(false);
      throw new Error(json.error || 'Export failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logistics-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoading(false);
  }

  const selectedAgent = agents.find((a) => a._id === selectedAgentId);

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
              onAddPayment={openPaymentModal}
              onAddNote={openNoteModal}
              onArchive={archiveInvoice}
              onResetFilters={() =>
                setInvoiceFilters({
                  invoiceNumber: '',
                  shopName: '',
                  dateFrom: '',
                  dateTo: '',
                  amountMin: '',
                  amountMax: '',
                  deliveryStatus: '',
                  paymentStatus: '',
                })
              }
            />
          ) : null}

          {!pageLoading && activeTab === 'importExport' ? (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Import invoices</h3>
                    <p className="mt-1 text-xs text-slate-500">Upload an Excel file to import invoice records with validation logs.</p>
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

                {importErrors.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <button
                      onClick={() => setShowImportErrors((prev) => !prev)}
                      className="flex w-full items-center justify-between text-left text-xs font-semibold text-amber-800"
                    >
                      <span>Import Validation Errors ({importErrors.length})</span>
                      {showImportErrors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {showImportErrors ? (
                      <div className="mt-2 max-h-56 overflow-auto rounded-md border border-amber-200 bg-white">
                        <table className="min-w-full text-xs">
                          <thead className="bg-amber-100 text-amber-900">
                            <tr>
                              <th className="px-3 py-2 text-left">Row</th>
                              <th className="px-3 py-2 text-left">Field</th>
                              <th className="px-3 py-2 text-left">Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importErrors.map((err, index) => (
                              <tr key={`${err.rowNumber}-${err.field}-${index}`} className="border-t border-amber-100">
                                <td className="px-3 py-2">{err.rowNumber}</td>
                                <td className="px-3 py-2">{err.field}</td>
                                <td className="px-3 py-2">{err.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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

              <div className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Export Data (.xlsx)</h3>
                    <p className="mt-1 text-xs text-slate-500">Export invoices, tripsheets, payments, cheques, and expenses with filters.</p>
                  </div>
                  <button
                    onClick={() => exportData().catch((e) => setApiError(e instanceof Error ? e.message : 'Export failed'))}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                  >
                    {exportLoading ? 'Exporting...' : 'Export'}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <input
                    type="date"
                    value={exportFilters.dateFrom}
                    onChange={(e) => setExportFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={exportFilters.dateTo}
                    onChange={(e) => setExportFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    value={exportFilters.driver}
                    onChange={(e) => setExportFilters((prev) => ({ ...prev, driver: e.target.value }))}
                    placeholder="Driver"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    value={exportFilters.status}
                    onChange={(e) => setExportFilters((prev) => ({ ...prev, status: e.target.value }))}
                    placeholder="Status"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {Object.keys(exportTypes).map((key) => (
                    <label key={key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean(exportTypes[key])}
                        onChange={(e) =>
                          setExportTypes((prev) => ({
                            ...prev,
                            [key]: e.target.checked,
                          }))
                        }
                      />
                      {key}
                    </label>
                  ))}
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
                        <select
                          value={tripInvoiceSort}
                          onChange={(e) => setTripInvoiceSort(e.target.value as TripInvoiceSort)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        >
                          <option value="numberAsc">Invoice # 0-9</option>
                          <option value="numberDesc">Invoice # 9-0</option>
                        </select>
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
                          onClick={openCreditNoteWorkflow}
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openTripInvoiceDetails(r.invoiceNumber).catch((err) =>
                                    setApiError(err instanceof Error ? err.message : 'Failed to load invoice details'),
                                  );
                                }}
                                className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
                              >
                                {r.invoiceNumber}
                              </button>
                              <p className="text-xs text-slate-500">{r.shopName}</p>
                              {isPaymentDueInvoice(r) ? (
                                <Badge className="mt-1 border-amber-200 bg-amber-50 text-amber-700">Payment Due</Badge>
                              ) : null}
                            </div>
                            <span className="ml-auto text-sm text-slate-600">{formatMoney(r.totalAmount)}</span>
                          </label>
                        ))}
                        {!filteredPendingPool.length ? <p className="p-4 text-sm text-slate-500">No matching pending invoices.</p> : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-2 md:grid-cols-3">
                        <div className="relative">
                          <CalendarRange className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            value={tripFilters.driver}
                            onChange={(e) => setTripFilters((prev) => ({ ...prev, driver: e.target.value }))}
                            placeholder="Filter by driver"
                            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
                          />
                        </div>
                        <input
                          type="date"
                          value={tripFilters.dateFrom}
                          onChange={(e) => setTripFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <input
                          type="date"
                          value={tripFilters.dateTo}
                          onChange={(e) => setTripFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>

                      {filteredTripHistory.map((t) => (
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
                                    {(t.invoices || []).map((inv) => (
                                      <div key={inv.invoiceNumber} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                        <div>
                                          <button
                                            type="button"
                                            onClick={() => openTripInvoiceDetails(inv.invoiceNumber).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to load invoice details'))}
                                            className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
                                          >
                                            {inv.invoiceNumber}
                                          </button>
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
                      {!filteredTripHistory.length ? <p className="text-sm text-slate-500">No trip sheets match current filters.</p> : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {!pageLoading && activeTab === 'approvals' ? (
            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-900">Pending Payment Approvals</h3>
                <div className="mt-3 space-y-3">
                  {groupedPaymentApprovals.map((group) => (
                    <div key={group.key} className="rounded-lg border border-slate-200">
                      <div className="space-y-3 bg-slate-50 px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">Driver: {group.driverName}</p>
                            <p className="text-xs text-slate-500">Tripsheet Date: {formatDateTime(group.tripsheetDate || undefined)}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => approveGroup(group.rows).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to approve group'))}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700"
                            >
                              Approve Group
                            </button>
                            <button
                              onClick={() => rejectGroup(group.rows).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to reject group'))}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700"
                            >
                              Reject Group
                            </button>
                            <button
                              onClick={() => setExpandedPaymentGroup(expandedPaymentGroup === group.key ? null : group.key)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
                            >
                              {expandedPaymentGroup === group.key ? 'Hide Details' : 'View Details'}
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-5">
                          <div>Deliveries: <span className="font-semibold text-slate-900">{group.deliveredCount}/{group.rows.length}</span></div>
                          <div>Cash: <span className="font-semibold text-slate-900">{group.modeCounts.cash}</span></div>
                          <div>UPI: <span className="font-semibold text-slate-900">{group.modeCounts.upi}</span></div>
                          <div>Cheque: <span className="font-semibold text-slate-900">{group.modeCounts.cheque}</span></div>
                          <div>Total: <span className="font-semibold text-slate-900">{formatMoney(group.totals.total)}</span></div>
                        </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {expandedPaymentGroup === group.key ? (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="overflow-hidden border-t border-slate-200"
                          >
                            <div className="overflow-auto">
                              <table className="min-w-full text-xs">
                                <thead className="bg-white text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left">Shop Name</th>
                                    <th className="px-3 py-2 text-left">Invoice Number</th>
                                    <th className="px-3 py-2 text-left">Amount</th>
                                    <th className="px-3 py-2 text-left">Payment Mode</th>
                                    <th className="px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2 text-left">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.rows.map((approval) => (
                                    <tr key={approval._id} className="border-t border-slate-200">
                                      <td className="px-3 py-2">{approval.payload.shopName || '-'}</td>
                                      <td className="px-3 py-2">{approval.payload.invoiceNumber || '-'}</td>
                                      <td className="px-3 py-2">{formatMoney(Number(approval.payload.amount || 0))}</td>
                                      <td className="px-3 py-2 uppercase">{approval.payload.mode || '-'}</td>
                                      <td className="px-3 py-2">{approval.status}</td>
                                      <td className="px-3 py-2">
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => approveItem(approval._id).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to approve'))}
                                            className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            onClick={() => rejectItem(approval._id).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to reject'))}
                                            className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  ))}

                  {!groupedPaymentApprovals.length ? <p className="text-sm text-slate-500">No pending payment groups.</p> : null}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-900">Pending Expense Approvals</h3>
                <div className="mt-3 space-y-2">
                  {expenseApprovals.map((a) => (
                    <div key={a._id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-slate-900">{a.payload.category || a.payload.type}</p>
                      <p className="text-slate-500">Amount: {formatMoney(Number(a.payload.amount || 0))} · Date: {a.payload.date} · By: {a.payload.addedBy}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => approveItem(a._id).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to approve'))}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectItem(a._id).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to reject'))}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                  {!expenseApprovals.length ? <p className="text-sm text-slate-500">No pending expenses.</p> : null}
                </div>
              </div>
            </div>
          ) : null}

          {!pageLoading && activeTab === 'cheques' ? (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">Cheques</h3>
                <p className="mt-1 text-xs text-slate-500">Track cheque lifecycle and reconcile invoice balances.</p>
              </div>

              <div className="grid gap-2 border-b border-slate-200 px-5 py-3 md:grid-cols-4 lg:grid-cols-8">
                <input
                  value={chequeCreateForm.chequeNumber}
                  onChange={(e) => setChequeCreateForm((prev) => ({ ...prev, chequeNumber: e.target.value }))}
                  placeholder="Cheque Number"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  value={chequeCreateForm.amount}
                  onChange={(e) => setChequeCreateForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Amount"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={chequeCreateForm.date}
                  onChange={(e) => setChequeCreateForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={chequeCreateForm.invoiceNumber}
                  onChange={(e) => setChequeCreateForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                  placeholder="Invoice Number"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={chequeCreateForm.bankName}
                  onChange={(e) => setChequeCreateForm((prev) => ({ ...prev, bankName: e.target.value }))}
                  placeholder="Bank Name"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={chequeCreateForm.driverName}
                  onChange={(e) => setChequeCreateForm((prev) => ({ ...prev, driverName: e.target.value }))}
                  placeholder="Driver Name"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={chequeCreateForm.tripsheetId}
                  onChange={(e) => setChequeCreateForm((prev) => ({ ...prev, tripsheetId: e.target.value }))}
                  placeholder="Tripsheet ID"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => createChequeEntry().catch((e) => setChequeCreateError(e instanceof Error ? e.message : 'Failed to create cheque'))}
                  disabled={chequeCreateSubmitting}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
                >
                  {chequeCreateSubmitting ? 'Saving...' : 'Add Cheque'}
                </button>
              </div>

              {chequeCreateError ? <p className="px-5 py-2 text-xs text-rose-700">{chequeCreateError}</p> : null}

              <div className="grid gap-2 border-b border-slate-200 px-5 py-3 md:grid-cols-5">
                <select
                  value={chequeFilters.status}
                  onChange={(e) => setChequeFilters((prev) => ({ ...prev, status: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="deposited">Deposited</option>
                  <option value="cleared">Cleared</option>
                  <option value="bounced">Bounced</option>
                </select>
                <input
                  type="date"
                  value={chequeFilters.dateFrom}
                  onChange={(e) => setChequeFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={chequeFilters.dateTo}
                  onChange={(e) => setChequeFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={chequeFilters.driver}
                  onChange={(e) => setChequeFilters((prev) => ({ ...prev, driver: e.target.value }))}
                  placeholder="Driver"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={chequeFilters.tripsheet}
                  onChange={(e) => setChequeFilters((prev) => ({ ...prev, tripsheet: e.target.value }))}
                  placeholder="Tripsheet"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium">Cheque Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium">Invoice Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium">Bank</th>
                      <th className="px-4 py-3 text-left text-xs font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cheques.map((cheque) => (
                      <tr key={cheque._id} className="border-t border-slate-200">
                        <td className="px-4 py-3">{cheque.chequeNumber}</td>
                        <td className="px-4 py-3">{formatMoney(cheque.amount)}</td>
                        <td className="px-4 py-3">{formatDateTime(cheque.date)}</td>
                        <td className="px-4 py-3">{cheque.invoiceNumber}</td>
                        <td className="px-4 py-3">{cheque.bankName}</td>
                        <td className="px-4 py-3 uppercase">{cheque.status}</td>
                        <td className="px-4 py-3">
                          <select
                            value={cheque.status}
                            onChange={(e) => updateChequeStatus(cheque._id, e.target.value as ChequeRow['status']).catch((err) => setApiError(err instanceof Error ? err.message : 'Failed to update cheque'))}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                          >
                            <option value="pending">pending</option>
                            <option value="deposited">deposited</option>
                            <option value="cleared">cleared</option>
                            <option value="bounced">bounced</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                    {!cheques.length ? (
                      <tr className="border-t border-slate-200">
                        <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                          No cheques found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {!pageLoading && activeTab === 'expenses' ? (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">Expenses</h3>
                <p className="mt-1 text-xs text-slate-500">Record expenses directly and review expense records.</p>
              </div>

              <div className="grid gap-2 border-b border-slate-200 px-5 py-3 md:grid-cols-5">
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Amount"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Category"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={expenseForm.addedBy}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, addedBy: e.target.value }))}
                  placeholder="Added By"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => submitExpense().catch((e) => setExpenseFormError(e instanceof Error ? e.message : 'Failed to record expense'))}
                  disabled={expenseSubmitting}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
                >
                  {expenseSubmitting ? 'Saving...' : 'Add Expense'}
                </button>
                <textarea
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes"
                  rows={2}
                  className="md:col-span-5 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              {expenseFormError ? <p className="px-5 py-2 text-xs text-rose-700">{expenseFormError}</p> : null}

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

          {showPaymentModal && paymentModalInvoice ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
              <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
                <h3 className="text-sm font-semibold text-slate-900">Add Payment Entry</h3>
                <p className="mt-1 text-xs text-slate-500">Invoice {paymentModalInvoice.invoiceNumber} · {paymentModalInvoice.shopName}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Step 1: Payment Mode</label>
                    <select
                      value={paymentForm.mode}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, mode: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                      <option value="credit_note">Credit Note</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Step 2: Amount</label>
                    <input
                      type="number"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Step 2: Received By</label>
                    <input
                      value={paymentForm.receivedBy}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, receivedBy: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Step 2: Date</label>
                    <input
                      type="date"
                      value={paymentForm.date}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, date: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  {(paymentForm.mode === 'upi' || paymentForm.mode === 'credit_note') ? (
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-slate-600">Step 3: Reference</label>
                      <input
                        value={paymentForm.reference}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                  ) : null}
                  {paymentForm.mode === 'cheque' ? (
                    <>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Step 3: Cheque Number</label>
                        <input
                          value={paymentForm.chequeNumber}
                          onChange={(e) => setPaymentForm((prev) => ({ ...prev, chequeNumber: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Step 3: Bank Name</label>
                        <input
                          value={paymentForm.bankName}
                          onChange={(e) => setPaymentForm((prev) => ({ ...prev, bankName: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </>
                  ) : null}
                </div>

                {paymentFormError ? <p className="mt-3 text-xs text-rose-700">{paymentFormError}</p> : null}

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentSubmitting(false);
                      setPaymentRequestId('');
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => submitPaymentApproval().catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to submit payment'))}
                    disabled={paymentSubmitting}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {paymentSubmitting ? 'Saving...' : 'Save Payment'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {showNoteModal && noteModalInvoice ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
              <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
                <h3 className="text-sm font-semibold text-slate-900">Add Note</h3>
                <p className="mt-1 text-xs text-slate-500">Invoice {noteModalInvoice.invoiceNumber}</p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Added By</label>
                    <input
                      value={noteForm.addedBy}
                      onChange={(e) => setNoteForm((prev) => ({ ...prev, addedBy: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Content</label>
                    <textarea
                      value={noteForm.content}
                      onChange={(e) => setNoteForm((prev) => ({ ...prev, content: e.target.value }))}
                      rows={4}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setShowNoteModal(false)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => submitNote().catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to add note'))}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {tripInvoiceDetailOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
              <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Trip Invoice Details</h3>
                    <p className="mt-1 text-xs text-slate-500">{tripInvoiceDetail?.invoiceNumber || '-'}</p>
                  </div>
                  <button
                    onClick={() => {
                      setTripInvoiceDetailOpen(false);
                      setTripInvoiceDetailError('');
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                  >
                    Close
                  </button>
                </div>

                {tripInvoiceDetailLoading && !tripInvoiceDetail ? (
                  <div className="mt-4 space-y-2">
                    <div className="skeleton h-5 w-1/2" />
                    <div className="skeleton h-5 w-full" />
                    <div className="skeleton h-5 w-full" />
                  </div>
                ) : null}

                {tripInvoiceDetailError ? <p className="mt-4 text-xs text-rose-700">{tripInvoiceDetailError}</p> : null}

                {tripInvoiceDetail ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="h-full rounded-lg border border-slate-200 bg-white p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery Info</h4>
                      <div className="mt-3 grid gap-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Delivery Status</span>
                          <Badge className={statusBadgeClass(tripInvoiceDetail.deliveryStatus)}>{tripInvoiceDetail.deliveryStatus}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Driver</span>
                          <span className="font-medium text-slate-900">{tripInvoiceDetail.deliveryPerson || 'Unassigned'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Delivered At</span>
                          <span className="font-medium text-slate-900">{formatDateTime(tripInvoiceDetail.deliveredAt || tripInvoiceDetail.deliveredDate)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="h-full rounded-lg border border-slate-200 bg-white p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Logs</h4>
                      {(tripInvoiceDetail.paymentHistory || []).length ? (
                        <div className="mt-3 max-h-56 overflow-auto">
                          <table className="min-w-full text-xs">
                            <thead className="text-slate-500">
                              <tr>
                                <th className="px-2 py-1 text-left">Mode</th>
                                <th className="px-2 py-1 text-left">Amount</th>
                                <th className="px-2 py-1 text-left">Date</th>
                                <th className="px-2 py-1 text-left">Collected By</th>
                                <th className="px-2 py-1 text-left">Reference</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tripInvoiceDetail.paymentHistory!
                                .slice()
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map((p, i) => (
                                  <tr key={i} className="border-t border-slate-100">
                                    <td className="px-2 py-1 uppercase">{p.mode}</td>
                                    <td className="px-2 py-1">{formatMoney(Number(p.amount || 0))}</td>
                                    <td className="px-2 py-1">{formatDateTime(p.date)}</td>
                                    <td className="px-2 py-1">{p.collectedBy || '-'}</td>
                                    <td className="px-2 py-1">
                                      {p.reference || p.chequeNumber || '-'}
                                      {p.bankName ? ` (${p.bankName})` : ''}
                                      {p.chequeStatus ? ` • ${p.chequeStatus}` : ''}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">No payment logs available.</p>
                      )}
                    </div>

                    <div className="h-full rounded-lg border border-slate-200 bg-white p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</h4>
                      <div className="mt-3 grid gap-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Invoice Amount</span>
                          <span className="font-medium text-slate-900">{formatMoney(Number(tripInvoiceDetail.totalAmount || 0))}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Paid Amount</span>
                          <span className="font-medium text-slate-900">{formatMoney(Number(tripInvoiceDetail.paidAmount || 0))}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Balance</span>
                          <span className="font-medium text-slate-900">
                            {formatMoney(Math.max(0, Number(tripInvoiceDetail.totalAmount || 0) - Number(tripInvoiceDetail.paidAmount || 0)))}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Payment Status</span>
                          <Badge className={statusBadgeClass(tripInvoiceDetail.paymentStatus)}>{tripInvoiceDetail.paymentStatus}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="h-full rounded-lg border border-slate-200 bg-white p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</h4>
                      {(tripInvoiceDetail.notes || []).length ? (
                        <div className="mt-3 max-h-56 space-y-2 overflow-auto">
                          {(tripInvoiceDetail.notes || []).map((note, idx) => (
                            <div key={idx} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                              <p className="text-xs text-slate-700">{note.text}</p>
                              <p className="mt-1 text-[11px] text-slate-500">{note.addedBy || '-'} · {formatDateTime(note.timestamp || note.createdAt)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">No notes available.</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
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
  onResetFilters,
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
  onResetFilters: () => void;
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

  const hasActiveFilters = Boolean(
    filters.invoiceNumber ||
      filters.shopName ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.amountMin ||
      filters.amountMax ||
      filters.deliveryStatus ||
      filters.paymentStatus,
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={onResetFilters}
          disabled={!hasActiveFilters}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
        >
          <FilterX className="h-3.5 w-3.5" />
          Reset Filters
        </button>
      </div>

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
                          isFiltered={(() => {
                            const key = (header.column.columnDef.meta as { filter: InvoiceFilterKey } | undefined)?.filter;
                            if (!key) return false;
                            if (key === 'invoiceNumber') return Boolean(filters.invoiceNumber);
                            if (key === 'shopName') return Boolean(filters.shopName);
                            if (key === 'date') return Boolean(filters.dateFrom || filters.dateTo);
                            if (key === 'amount') return Boolean(filters.amountMin || filters.amountMax);
                            if (key === 'deliveryStatus') return Boolean(filters.deliveryStatus);
                            if (key === 'paymentStatus') return Boolean(filters.paymentStatus);
                            return false;
                          })()}
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
                                    <div className="h-full rounded-lg border border-slate-200 bg-white p-4">
                                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery Info</h4>
                                      <div className="mt-3 grid gap-2 text-sm">
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-500">Delivery Status</span>
                                          <Badge className={statusBadgeClass(row.original.deliveryStatus)}>{row.original.deliveryStatus}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-500">Driver</span>
                                          <span className="font-medium text-slate-900">{row.original.deliveryPerson || 'Unassigned'}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-500">Delivered At</span>
                                          <span className="font-medium text-slate-900">{formatDateTime(row.original.deliveredAt || row.original.deliveredDate)}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="h-full rounded-lg border border-slate-200 bg-white p-4">
                                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Logs</h4>
                                      {(row.original.paymentHistory || []).length ? (
                                        <div className="mt-3 max-h-56 overflow-auto">
                                          <table className="min-w-full text-xs">
                                            <thead className="text-slate-500">
                                              <tr>
                                                <th className="px-2 py-1 text-left">Mode</th>
                                                <th className="px-2 py-1 text-left">Amount</th>
                                                <th className="px-2 py-1 text-left">Date</th>
                                                <th className="px-2 py-1 text-left">Collected By</th>
                                                <th className="px-2 py-1 text-left">Reference</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {row.original.paymentHistory!
                                                .slice()
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                .map((p, i) => (
                                                  <tr key={i} className="border-t border-slate-100">
                                                    <td className="px-2 py-1 uppercase">{p.mode}</td>
                                                    <td className="px-2 py-1">{formatMoney(Number(p.amount || 0))}</td>
                                                    <td className="px-2 py-1">{formatDateTime(p.date)}</td>
                                                    <td className="px-2 py-1">{p.collectedBy || '-'}</td>
                                                    <td className="px-2 py-1">
                                                      {p.reference || p.chequeNumber || '-'}
                                                      {p.bankName ? ` (${p.bankName})` : ''}
                                                      {p.chequeStatus ? ` • ${p.chequeStatus}` : ''}
                                                    </td>
                                                  </tr>
                                                ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <p className="mt-2 text-xs text-slate-500">No payment logs yet.</p>
                                      )}
                                    </div>

                                    <div className="h-full rounded-lg border border-slate-200 bg-white p-4">
                                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</h4>
                                      <div className="mt-3 grid gap-2 text-sm">
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-500">Total Amount</span>
                                          <span className="font-medium text-slate-900">{formatMoney(Number(row.original.totalAmount || 0))}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-500">Total Paid</span>
                                          <span className="font-medium text-slate-900">{formatMoney(Number(row.original.paidAmount || 0))}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-500">Remaining</span>
                                          <span className="font-medium text-slate-900">{formatMoney(Math.max(0, Number(row.original.totalAmount || 0) - Number(row.original.paidAmount || 0)))}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="h-full rounded-lg border border-slate-200 bg-white p-4">
                                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</h4>
                                      {(row.original.notes || []).length ? (
                                        <div className="mt-2 max-h-48 space-y-2 overflow-auto text-xs">
                                          {(row.original.notes || []).map((note, idx) => (
                                            <div key={idx} className="rounded border border-slate-100 p-2">
                                              <p className="text-slate-700">{note.text}</p>
                                              <p className="mt-1 text-slate-500">{note.addedBy || 'Admin'} · {formatDateTime(note.timestamp || note.createdAt)}</p>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="mt-2 text-xs text-slate-500">No notes available.</p>
                                      )}
                                    </div>
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
  isFiltered,
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
  isFiltered: boolean;
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
            className={`flex items-center gap-2 text-left text-xs font-medium hover:text-slate-900 ${isFiltered ? 'text-rose-600' : 'text-slate-600'}`}
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
