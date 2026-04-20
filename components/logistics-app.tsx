"use client";

import { ChangeEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
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
type InvoiceFilterKey = 'invoiceNumber' | 'date' | 'shopName' | 'route' | 'amount' | 'deliveryStatus' | 'paymentStatus';

type InvoiceFilters = {
  invoiceNumber: string;
  shopName: string;
  route: string[];
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
  paymentStatus: 'paid' | 'partial' | 'unpaid' | 'payable';
  deliveryStatus: 'delivered' | 'pending';
  deliveryPerson?: string | null;
  assignedTripId?: string;
  deductedAmount?: number;
  deductions?: Array<{
    type: string;
    typeLabel?: string;
    customType?: string | null;
    amount: number;
    createdAt?: string;
  }>;
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
    proofImageUrl?: string | null;
    proofImageKey?: string | null;
  }>;
  deliveredAt?: string;
  deliveredDate?: string;
  route?: string;
  cmpCode?: string;
  firm?: string;
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
  availableCmpCodes?: string[];
};

type ApprovalRow = {
  _id: string;
  type: 'payment' | 'expense' | 'deduction';
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
  paidAmount?: number;
  deductedAmount?: number;
  paymentStatus?: string;
  deliveryStatus: string;
  route?: string;
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
  if (status === 'payable') return 'bg-orange-50 text-orange-700 border-orange-200';
  if (status === 'delivered') return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function normalizeTripDeliveryStatus(status: unknown) {
  return String(status || '').trim().toLowerCase() === 'delivered' ? 'delivered' : 'undelivered';
}

function normalizeTripPaymentStatus(status: unknown) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'paid' || normalized === 'payable') return 'paid';
  if (normalized === 'partial') return 'partial';
  return 'unpaid';
}

function tripDeliveryCode(status: unknown) {
  return normalizeTripDeliveryStatus(status) === 'delivered' ? 'D' : 'ND';
}

function tripPaymentLabel(status: unknown) {
  const normalized = normalizeTripPaymentStatus(status);
  if (normalized === 'paid') return 'Paid';
  if (normalized === 'partial') return 'Partial';
  return 'Unpaid';
}

function tripDeliveryBadgeClass(status: unknown) {
  return normalizeTripDeliveryStatus(status) === 'delivered'
    ? 'border-sky-200 bg-sky-50 text-sky-700'
    : 'border-slate-200 bg-slate-100 text-slate-700';
}

function tripPaymentBadgeClass(status: unknown) {
  const normalized = normalizeTripPaymentStatus(status);
  if (normalized === 'paid') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'partial') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

function getTotalDeducted(invoice: Pick<InvoiceRow, 'deductedAmount' | 'deductions'>) {
  if (typeof invoice.deductedAmount === 'number') return Number(invoice.deductedAmount || 0);
  if (Array.isArray(invoice.deductions)) {
    return invoice.deductions.reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  }
  return 0;
}

function getInvoicePaymentMetrics(invoice: Pick<InvoiceRow, 'totalAmount' | 'paidAmount' | 'deductedAmount' | 'deductions'>) {
  const total = Number(invoice.totalAmount || 0);
  const paid = Number(invoice.paidAmount || 0);
  const deducted = getTotalDeducted(invoice);
  const remaining = total - paid - deducted;
  const epsilon = 0.01;

  const settled = Math.abs(remaining) <= epsilon || Math.abs(paid + deducted - total) <= epsilon;
  const status: InvoiceRow['paymentStatus'] = settled
    ? 'paid'
    : remaining < -epsilon
      ? 'payable'
      : remaining > epsilon
        ? paid + deducted > epsilon
          ? 'partial'
          : 'unpaid'
        : 'paid';

  return { total, paid, deducted, remaining, status };
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

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card p-5">
      <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder,
  className = '',
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const selectedSet = new Set(selected.map((x) => x.toLowerCase()));
  const summaryLabel = selected.length === 0
    ? placeholder
    : selected.length <= 2
      ? selected.join(', ')
      : `${selected.length} selected`;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700"
      >
        <span className="truncate">{summaryLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Options</p>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          </div>

          <div className="max-h-48 space-y-1 overflow-auto pr-1">
            {options.length ? (
              options.map((option) => {
                const key = option.toLowerCase();
                const checked = selectedSet.has(key);
                return (
                  <label key={option} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (checked) {
                          onChange(selected.filter((value) => value.toLowerCase() !== key));
                        } else {
                          onChange([...selected, option]);
                        }
                      }}
                    />
                    <span className="truncate">{option}</span>
                  </label>
                );
              })
            ) : (
              <p className="px-2 py-1 text-xs text-slate-500">No routes available.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function LogisticsApp() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [apiError, setApiError] = useState('');
  const [pageLoading, setPageLoading] = useState(true);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedCmpCode, setSelectedCmpCode] = useState('');
  const [availableCmpCodes, setAvailableCmpCodes] = useState<string[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<string[]>([]);

  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceSort, setInvoiceSort] = useState<{ sortBy: string; sortDirection: 'asc' | 'desc' }>({
    sortBy: 'date',
    sortDirection: 'desc',
  });
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [activeInvoiceFilter, setActiveInvoiceFilter] = useState<InvoiceFilterKey | null>(null);
  const [invoiceFilters, setInvoiceFilters] = useState<InvoiceFilters>({
    invoiceNumber: '',
    shopName: '',
    route: [],
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
  const [showAgentCredentialsModal, setShowAgentCredentialsModal] = useState(false);
  const [agentForm, setAgentForm] = useState({ name: '', username: '', password: '' });
  const [agentCredentialsForm, setAgentCredentialsForm] = useState({ name: '', username: '', password: '' });
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [tripSheets, setTripSheets] = useState<TripSheet[]>([]);
  const [pendingPool, setPendingPool] = useState<InvoiceRow[]>([]);
  const [tripSelected, setTripSelected] = useState<string[]>([]);
  const [tripSearch, setTripSearch] = useState('');
  const [tripDeliveryFilters, setTripDeliveryFilters] = useState<string[]>([]);
  const [tripPaymentFilters, setTripPaymentFilters] = useState<string[]>([]);
  const [tripRouteFilters, setTripRouteFilters] = useState<string[]>([]);
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [tripFilters, setTripFilters] = useState({
    driver: '',
    dateFrom: '',
    dateTo: '',
  });

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

  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const actionLockRef = useRef(new Set<string>());

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteModalInvoice, setNoteModalInvoice] = useState<InvoiceRow | null>(null);
  const [noteForm, setNoteForm] = useState({ content: '', addedBy: 'Admin' });
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryModalInvoice, setDeliveryModalInvoice] = useState<InvoiceRow | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    deliveryPerson: '',
  });
  const [deliveryFormError, setDeliveryFormError] = useState('');

  const [cheques, setCheques] = useState<ChequeRow[]>([]);
  const [chequeFilters, setChequeFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    driver: '',
    tripsheet: '',
  });
  const [manualChequeForm, setManualChequeForm] = useState({
    invoiceNumber: '',
    chequeNumber: '',
    date: new Date().toISOString().slice(0, 10),
    bankName: '',
    amount: '',
    action: 'manual_entry',
  });

  const debouncedInvoiceNumber = useDebouncedValue(invoiceFilters.invoiceNumber);
  const debouncedShopName = useDebouncedValue(invoiceFilters.shopName);
  const debouncedAmountMin = useDebouncedValue(invoiceFilters.amountMin);
  const debouncedAmountMax = useDebouncedValue(invoiceFilters.amountMax);
  const debouncedTripSearch = useDebouncedValue(tripSearch, 300);

  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expandedApprovalGroups, setExpandedApprovalGroups] = useState<string[]>([]);
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    category: '',
    addedBy: 'Admin',
    notes: '',
  });

  const pageSize = 20;
  const invoicePages = useMemo(() => Math.max(1, Math.ceil(invoiceTotal / pageSize)), [invoiceTotal]);
  const pageTitle = tabs.find((t) => t.key === activeTab)?.label || 'Dashboard';
  const filteredPendingPool = useMemo(() => {
    const q = debouncedTripSearch.trim().toLowerCase();
    const selectedRoutes = new Set(tripRouteFilters.map((x) => x.toLowerCase()));
    const selectedDeliveryStatuses = new Set(tripDeliveryFilters.map((x) => x.toLowerCase()));
    const selectedPaymentStatuses = new Set(tripPaymentFilters.map((x) => x.toLowerCase()));

    return pendingPool.filter((row) => {
      const bySearch = !q || row.invoiceNumber.toLowerCase().includes(q) || row.shopName.toLowerCase().includes(q);
      const routeValue = String(row.route || '').trim().toLowerCase();
      const deliveryStatusValue = normalizeTripDeliveryStatus(row.deliveryStatus);
      const paymentStatusValue = normalizeTripPaymentStatus(row.paymentStatus);
      const byRoute = selectedRoutes.size === 0 || selectedRoutes.has(routeValue);
      const byDelivery = selectedDeliveryStatuses.size === 0 || selectedDeliveryStatuses.has(deliveryStatusValue);
      const byPayment = selectedPaymentStatuses.size === 0 || selectedPaymentStatuses.has(paymentStatusValue);
      return bySearch && byRoute && byDelivery && byPayment;
    });
  }, [pendingPool, debouncedTripSearch, tripRouteFilters, tripDeliveryFilters, tripPaymentFilters]);

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

  const paymentApprovals = approvals.filter((a) => a.type === 'payment' && a.status === 'pending');
  const expenseApprovals = approvals.filter((a) => a.type === 'expense' && a.status === 'pending');

  const groupedPaymentApprovals = useMemo(() => {
    const groups = new Map<string, { key: string; tripsheetId: string; driverName: string; date: string; rows: ApprovalRow[] }>();
    paymentApprovals.forEach((approval) => {
      const tripsheetId = String(approval.payload?.tripsheetId || 'Unassigned');
      const driverName = String(approval.payload?.driverName || approval.payload?.collectedBy || 'Unknown');
      const key = `${tripsheetId}::${driverName}`;
      const date = String(approval.payload?.date || approval.createdAt || '');
      if (!groups.has(key)) {
        groups.set(key, { key, tripsheetId, driverName, date, rows: [] });
      }
      groups.get(key)!.rows.push(approval);
    });

    return Array.from(groups.values()).map((group) => {
      const totals = group.rows.reduce(
        (acc, row) => {
          const amount = Number(row.payload?.amount || 0);
          const mode = String(row.payload?.mode || '').toLowerCase();
          acc.received += amount;
          acc.actual += Number(row.payload?.totalAmount || 0);
          if (mode === 'cash') acc.cash += amount;
          if (mode === 'upi') acc.upi += amount;
          if (mode === 'cheque') acc.cheque += amount;
          if (mode === 'credit_note') acc.creditNote += amount;
          return acc;
        },
        { received: 0, actual: 0, cash: 0, upi: 0, cheque: 0, creditNote: 0 },
      );

      const deliveredCount = group.rows.filter((row) => row.payload?.deliveryStatus === 'delivered').length;

      return {
        ...group,
        totals,
        deliveredCount,
      };
    });
  }, [paymentApprovals]);

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

  async function loadSummary(cmpCode = selectedCmpCode) {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams();
      if (cmpCode) params.set('cmpCode', cmpCode);
      const data = await fetchJson(`/api/dashboard/summary${params.size ? `?${params.toString()}` : ''}`);
      setSummary(data);
      const options = Array.isArray(data?.availableCmpCodes)
        ? data.availableCmpCodes.map((x: unknown) => String(x || '').trim().toUpperCase()).filter(Boolean)
        : [];
      setAvailableCmpCodes(options);
    } finally {
      setSummaryLoading(false);
    }
  }

  function isActionLoading(key: string) {
    return Boolean(actionLoading[key]);
  }

  async function runAction(key: string, action: () => Promise<void>) {
    if (actionLockRef.current.has(key)) return;
    actionLockRef.current.add(key);
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await action();
    } finally {
      actionLockRef.current.delete(key);
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function loadInvoices(page = invoicePage) {
    setInvoiceLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy: invoiceSort.sortBy,
        sortDirection: invoiceSort.sortDirection,
        invoiceNumber: debouncedInvoiceNumber,
        shopName: debouncedShopName,
        dateFrom: invoiceFilters.dateFrom,
        dateTo: invoiceFilters.dateTo,
        amountMin: debouncedAmountMin,
        amountMax: debouncedAmountMax,
        deliveryStatus: invoiceFilters.deliveryStatus,
        paymentStatus: invoiceFilters.paymentStatus,
      });
      invoiceFilters.route.forEach((route) => {
        params.append('route', route);
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

  async function loadInvoiceFilterMeta() {
    const data = await fetchJson('/api/invoices?meta=filters');
    const routes = Array.isArray(data?.routes)
      ? data.routes.map((x: unknown) => String(x || '').trim()).filter(Boolean)
      : [];
    setAvailableRoutes(routes);
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
    const params = new URLSearchParams({ page: '1', pageSize: '5000' });
    const data = await fetchJson(`/api/invoices?${params.toString()}`);
    setPendingPool(
      (data.rows || []).filter(
        (r: InvoiceRow) => {
          const metrics = getInvoicePaymentMetrics(r);
          const hasPendingBalance = metrics.remaining > 0.01;
          const undelivered = normalizeTripDeliveryStatus(r.deliveryStatus) === 'undelivered';
          const unassigned = !String(r.assignedTripId || '').trim();
          return (undelivered && unassigned) || hasPendingBalance;
        },
      ),
    );
  }

  async function refreshAll() {
    setApiError('');
    setPageLoading(true);
    try {
      await Promise.all([
        loadSummary(),
        loadInvoices(1),
        loadApprovals(),
        loadInvoiceFilterMeta(),
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
    invoiceFilters.route.join('|'),
    invoiceFilters.dateFrom,
    invoiceFilters.dateTo,
    invoiceFilters.deliveryStatus,
    invoiceFilters.paymentStatus,
    invoiceSort.sortBy,
    invoiceSort.sortDirection,
  ]);

  function updateInvoiceSort(sortBy: string, sortDirection: 'asc' | 'desc') {
    setInvoiceSort({ sortBy, sortDirection });
    setInvoicePage(1);
  }

  function resetInvoiceFilters() {
    setInvoiceFilters({
      invoiceNumber: '',
      shopName: '',
      route: [],
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      deliveryStatus: '',
      paymentStatus: '',
    });
    setActiveInvoiceFilter(null);
  }

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

  function openAgentCredentialsModal() {
    const selectedAgent = agents.find((a) => a._id === selectedAgentId);
    if (!selectedAgent) {
      setApiError('Select a driver first.');
      return;
    }

    setAgentCredentialsForm({
      name: selectedAgent.name || '',
      username: selectedAgent.username || '',
      password: '',
    });
    setApiError('');
    setShowAgentCredentialsModal(true);
  }

  async function updateSelectedAgentPassword() {
    if (!selectedAgentId) {
      setApiError('Select a driver first.');
      return;
    }

    const password = agentCredentialsForm.password.trim();
    if (!password) {
      setApiError('Enter a new password.');
      return;
    }
    if (password.length < 4) {
      setApiError('New password must be at least 4 characters.');
      return;
    }

    setApiError('');
    await fetchJson(`/api/trips/agents/${selectedAgentId}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    setAgentCredentialsForm((prev) => ({ ...prev, password: '' }));
    setShowAgentCredentialsModal(false);
    window.alert('Password updated successfully.');
  }

  function openPaymentModal(invoice: InvoiceRow) {
    const { remaining } = getInvoicePaymentMetrics(invoice);
    setPaymentModalInvoice(invoice);
    setPaymentForm({
      mode: 'cash',
      amount: remaining > 0 ? String(remaining) : '',
      receivedBy: '',
      date: new Date().toISOString().slice(0, 10),
      reference: '',
      chequeNumber: '',
      bankName: '',
    });
    setPaymentFormError('');
    setShowPaymentModal(true);
  }

  async function submitPaymentApproval() {
    if (!paymentModalInvoice) return;

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
    if (mode === 'credit_note' && !reference) {
      setPaymentFormError('Credit note reference is required.');
      return;
    }
    if (mode === 'cheque' && (!chequeNumber || !bankName)) {
      setPaymentFormError('Cheque number and bank name are required for cheque payments.');
      return;
    }

    await fetchJson('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: paymentModalInvoice.invoiceNumber,
        invoiceId: paymentModalInvoice._id,
        amount,
        mode,
        date: paymentForm.date,
        collectedBy: receivedBy,
        role: 'admin',
        reference: reference || null,
        chequeNumber: chequeNumber || null,
        bankName: bankName || null,
        tripsheetId: paymentModalInvoice.assignedTripId || null,
        driverName: paymentModalInvoice.deliveryPerson || 'Unknown',
      }),
    });

    setShowPaymentModal(false);
    setPaymentModalInvoice(null);
    await Promise.all([loadInvoices(), loadSummary(), loadCheques(), loadApprovals()]);
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

  function clearTripSelectionFilters() {
    setTripSearch('');
    setTripDeliveryFilters([]);
    setTripPaymentFilters([]);
    setTripRouteFilters([]);
  }

  function applyLocalInvoiceDeliveryUpdate(
    invoiceNumber: string,
    nextDeliveryStatus: InvoiceRow['deliveryStatus'],
    nextDeliveryPerson: string | null,
    deliveredAt?: string,
  ) {
    const nextDeliveredAt = nextDeliveryStatus === 'delivered' ? deliveredAt || new Date().toISOString() : undefined;

    setInvoiceRows((prev) =>
      prev.map((row) =>
        row.invoiceNumber === invoiceNumber
          ? {
              ...row,
              deliveryStatus: nextDeliveryStatus,
              deliveryPerson: nextDeliveryPerson,
              deliveredAt: nextDeliveredAt,
              deliveredDate: nextDeliveredAt,
            }
          : row,
      ),
    );

    setPendingPool((prev) =>
      prev.map((row) =>
        row.invoiceNumber === invoiceNumber
          ? {
              ...row,
              deliveryStatus: nextDeliveryStatus,
              deliveryPerson: nextDeliveryPerson,
              deliveredAt: nextDeliveredAt,
              deliveredDate: nextDeliveredAt,
            }
          : row,
      ),
    );

    setTripSheets((prev) =>
      prev.map((trip) => ({
        ...trip,
        invoices: trip.invoices.map((invoice) =>
          invoice.invoiceNumber === invoiceNumber
            ? {
                ...invoice,
                deliveryStatus: nextDeliveryStatus,
              }
            : invoice,
        ),
      })),
    );
  }

  async function updateInvoiceDeliveryStatus(
    invoice: InvoiceRow,
    nextDeliveryStatus: InvoiceRow['deliveryStatus'],
    deliveryPerson?: string | null,
  ) {
    const normalizedDeliveryPerson = nextDeliveryStatus === 'delivered'
      ? String(deliveryPerson || '').trim()
      : null;

    if (nextDeliveryStatus === 'delivered' && !normalizedDeliveryPerson) {
      setDeliveryFormError('Delivery Person Name is required.');
      return false;
    }

    const deliveredAt = nextDeliveryStatus === 'delivered' ? new Date().toISOString() : undefined;
    applyLocalInvoiceDeliveryUpdate(invoice.invoiceNumber, nextDeliveryStatus, normalizedDeliveryPerson, deliveredAt);

    try {
      await fetchJson(`/api/invoices/${encodeURIComponent(invoice.invoiceNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice._id,
          deliveryStatus: nextDeliveryStatus,
          deliveryPerson: normalizedDeliveryPerson,
        }),
      });
    } catch (error) {
      await Promise.all([loadInvoices(invoicePage), loadTripSheets(), loadPendingPool()]);
      throw error;
    }

    await Promise.all([loadInvoices(invoicePage), loadTripSheets(), loadPendingPool(), loadSummary()]);
    return true;
  }

  function openDeliveryModal(invoice: InvoiceRow) {
    setDeliveryModalInvoice(invoice);
    setDeliveryForm({
      deliveryPerson: String(invoice.deliveryPerson || '').trim(),
    });
    setDeliveryFormError('');
    setShowDeliveryModal(true);
  }

  function requestDeliveryStatusUpdate(invoice: InvoiceRow) {
    if (invoice.deliveryStatus === 'delivered') {
      runAction(`undeliver-${invoice._id}`, async () => {
        await updateInvoiceDeliveryStatus(invoice, 'pending', null);
      }).catch((e) =>
        setApiError(e instanceof Error ? e.message : 'Failed to update delivery status'),
      );
      return;
    }

    openDeliveryModal(invoice);
  }

  async function submitDeliveredStatusUpdate() {
    if (!deliveryModalInvoice) return;
    const updated = await updateInvoiceDeliveryStatus(deliveryModalInvoice, 'delivered', deliveryForm.deliveryPerson);
    if (!updated) return;
    setShowDeliveryModal(false);
    setDeliveryModalInvoice(null);
    setDeliveryForm({ deliveryPerson: '' });
    setDeliveryFormError('');
  }

  async function approveItem(id: string, withRefresh = true) {
    await fetchJson(`/api/approvals/${id}/approve`, { method: 'POST' });
    if (withRefresh) {
      await Promise.all([loadApprovals(), loadInvoices(), loadSummary(), loadExpenses(), loadCheques()]);
    }
  }

  async function approveGroup(ids: string[]) {
    if (!ids.length) return;
    await Promise.all(ids.map((id) => approveItem(id, false)));
    await Promise.all([loadApprovals(), loadInvoices(), loadSummary(), loadExpenses(), loadCheques()]);
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

  async function createExpense() {
    const amount = Number(expenseForm.amount);
    const category = expenseForm.category.trim();
    const addedBy = expenseForm.addedBy.trim() || 'Admin';

    if (!expenseForm.date || !category || !Number.isFinite(amount) || amount <= 0) {
      setApiError('Expense date, category, and valid amount are required.');
      return;
    }

    await fetchJson('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: expenseForm.date,
        amount,
        category,
        addedBy,
        notes: expenseForm.notes.trim(),
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
  }

  async function createManualCheque() {
    const amount = Number(manualChequeForm.amount);
    const invoiceNumber = manualChequeForm.invoiceNumber.trim();
    const chequeNumber = manualChequeForm.chequeNumber.trim();
    const date = manualChequeForm.date;
    const bankName = manualChequeForm.bankName.trim();

    if (!invoiceNumber || !chequeNumber || !date || !bankName || !Number.isFinite(amount) || amount <= 0) {
      setApiError('Invoice number, cheque number, date, bank name, and valid amount are required.');
      return;
    }

    await fetchJson('/api/cheques', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber,
        chequeNumber,
        date,
        bankName,
        amount,
      }),
    });

    setManualChequeForm({
      invoiceNumber: '',
      chequeNumber: '',
      date: new Date().toISOString().slice(0, 10),
      bankName: '',
      amount: '',
      action: 'manual_entry',
    });
    await Promise.all([loadCheques(), loadInvoices(), loadSummary()]);
  }

  async function completeTripSheet(tripId: string) {
    await fetchJson(`/api/trips/${tripId}/complete`, { method: 'POST' });
    await Promise.all([loadTripSheets(), loadInvoices(), loadSummary()]);
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
  const hasInvoiceFilters = Boolean(
    invoiceFilters.invoiceNumber ||
      invoiceFilters.shopName ||
      invoiceFilters.route.length ||
      invoiceFilters.dateFrom ||
      invoiceFilters.dateTo ||
      invoiceFilters.amountMin ||
      invoiceFilters.amountMax ||
      invoiceFilters.deliveryStatus ||
      invoiceFilters.paymentStatus,
  );
  const hasTripSelectionFilters = Boolean(
    tripSearch.trim() ||
      tripRouteFilters.length ||
      tripDeliveryFilters.length ||
      tripPaymentFilters.length,
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-6 py-6">
        <aside className="sticky top-6 hidden h-fit w-60 shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Internal Dashboard</p>
              <p className="text-xs text-slate-500">SGB Enterprises</p>
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
              <h1 className="text-2xl font-semibold text-slate-900">{pageTitle}</h1>
            </div>
              <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                <UserCircle className="h-4 w-4" />
                Admin
              </div>
              {activeTab === 'invoices' ? (
                <button
                  onClick={resetInvoiceFilters}
                  disabled={!hasInvoiceFilters}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  <FilterX className="h-4 w-4" />
                  Reset Filters
                </button>
              ) : null}
            </div>
          </div>

          {apiError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {apiError}
            </div>
          ) : null}

          {(pageLoading || summaryLoading) && activeTab === 'dashboard' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="card h-28 animate-pulse bg-slate-100" />
              ))}
            </div>
          ) : null}

          {!pageLoading && !summaryLoading && activeTab === 'dashboard' && summary ? (
            <div className="space-y-6">
              <div className="card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500">CmpCode Filter</label>
                  <select
                    value={selectedCmpCode}
                    onChange={(e) => {
                      const next = e.target.value;
                      setSelectedCmpCode(next);
                      loadSummary(next).catch((err) => setApiError(err instanceof Error ? err.message : 'Failed to load dashboard'));
                    }}
                    disabled={summaryLoading}
                    className="min-w-52 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All CmpCodes</option>
                    {availableCmpCodes.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </div>
              </div>

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

          {pageLoading && activeTab === 'invoices' ? (
            <div className="space-y-4">
              <CardSkeleton rows={4} />
            </div>
          ) : null}

          {!pageLoading && activeTab === 'invoices' ? (
            <InvoiceTable
              rows={invoiceRows}
              loading={invoiceLoading}
              sortBy={invoiceSort.sortBy}
              sortDirection={invoiceSort.sortDirection}
              onSortChange={updateInvoiceSort}
              filters={invoiceFilters}
              routeOptions={availableRoutes}
              setFilters={setInvoiceFilters}
              activeFilter={activeInvoiceFilter}
              setActiveFilter={setActiveInvoiceFilter}
              expandedInvoice={expandedInvoice}
              setExpandedInvoice={setExpandedInvoice}
              page={invoicePage}
              pages={invoicePages}
              total={invoiceTotal}
              onPageJump={loadInvoices}
              onPrev={() => loadInvoices(invoicePage - 1)}
              onNext={() => loadInvoices(invoicePage + 1)}
              onAddPayment={openPaymentModal}
              onAddNote={openNoteModal}
              onArchive={archiveInvoice}
              onDeliveryStatusAction={requestDeliveryStatusUpdate}
            />
          ) : null}

          {pageLoading && activeTab === 'importExport' ? (
            <div className="space-y-4">
              <CardSkeleton rows={4} />
            </div>
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

          {pageLoading && activeTab === 'trips' ? (
            <div className="space-y-4">
              <CardSkeleton rows={4} />
              <CardSkeleton rows={5} />
            </div>
          ) : null}

          {!pageLoading && activeTab === 'trips' ? (
            <div className="space-y-4">
                <div className="card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Delivery agents</h3>
                      <p className="mt-1 text-xs text-slate-500">Create and assign agents using unique accounts.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={openAgentCredentialsModal}
                        disabled={!selectedAgentId}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Credentials
                      </button>
                      <button
                        onClick={() => setShowAgentModal(true)}
                        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                      >
                        Create Agent
                      </button>
                    </div>
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
                          onClick={() => runAction('create-agent', async () => addDeliveryAgent()).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to add agent'))}
                          disabled={isActionLoading('create-agent')}
                          className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white"
                        >
                          {isActionLoading('create-agent') ? 'Creating...' : 'Create'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {showAgentCredentialsModal ? (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4">
                  <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Agent Credentials</h3>
                      <button onClick={() => setShowAgentCredentialsModal(false)} className="text-xs text-slate-500">Close</button>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Agent Name</label>
                        <input
                          value={agentCredentialsForm.name}
                          disabled
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Username</label>
                        <input
                          value={agentCredentialsForm.username}
                          disabled
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Password</label>
                        <input
                          type="password"
                          value={agentCredentialsForm.password}
                          onChange={(e) => setAgentCredentialsForm((prev) => ({ ...prev, password: e.target.value }))}
                          placeholder="Enter new password"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setShowAgentCredentialsModal(false)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
                        >
                          Cancel
                        </button>
                        {agentCredentialsForm.password.trim() ? (
                          <button
                            onClick={() => runAction('update-agent-password', async () => updateSelectedAgentPassword()).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to update password'))}
                            disabled={isActionLoading('update-agent-password')}
                            className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white"
                          >
                            {isActionLoading('update-agent-password') ? 'Updating...' : 'Update Password'}
                          </button>
                        ) : null}
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

                <div className="card min-w-0 overflow-hidden p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900">
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
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_170px_170px_200px_auto_auto]">
                        <input
                          value={tripSearch}
                          onChange={(e) => setTripSearch(e.target.value)}
                          placeholder="Search by invoice number or shop name"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        />
                        <MultiSelectDropdown
                          options={['Delivered', 'Undelivered']}
                          selected={tripDeliveryFilters}
                          onChange={setTripDeliveryFilters}
                          placeholder="Delivery Status"
                        />
                        <MultiSelectDropdown
                          options={['Paid', 'Partial', 'Unpaid']}
                          selected={tripPaymentFilters}
                          onChange={setTripPaymentFilters}
                          placeholder="Payment Status"
                        />
                        <MultiSelectDropdown
                          options={availableRoutes}
                          selected={tripRouteFilters}
                          onChange={setTripRouteFilters}
                          placeholder="Route"
                        />
                        <button
                          onClick={() => selectVisibleTrips(true)}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 xl:w-auto"
                        >
                          Select Visible
                        </button>
                        <button
                          onClick={clearTripSelectionFilters}
                          disabled={!hasTripSelectionFilters}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 xl:w-auto"
                        >
                          Clear Filters
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
                          onClick={() => runAction('assign-agent', async () => addToSelectedAgent()).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to assign invoices'))}
                          disabled={isActionLoading('assign-agent')}
                          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                        >
                          {isActionLoading('assign-agent') ? 'Assigning...' : 'Assign to agent'}
                        </button>
                        <span className="text-xs text-slate-500">
                          Showing {filteredPendingPool.length} of {pendingPool.length} · Selected {tripSelected.length}
                        </span>
                      </div>

                      <div className="max-h-[480px] overflow-auto rounded-lg border border-slate-200">
                        {filteredPendingPool.map((r) => (
                          <label key={r._id} className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 text-sm hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={tripSelected.includes(r._id)}
                              onChange={(e) =>
                                setTripSelected((prev) =>
                                  e.target.checked ? [...prev, r._id] : prev.filter((x) => x !== r._id),
                                )
                              }
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900">{r.invoiceNumber}</p>
                              <p className="text-xs text-slate-500">{r.shopName}</p>
                              <p className="text-[11px] text-slate-500">Route: {r.route || '-'}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs sm:ml-auto sm:justify-end">
                              <span className={`rounded-md border px-2 py-1 font-medium ${tripDeliveryBadgeClass(r.deliveryStatus)}`}>
                                Delivery: {tripDeliveryCode(r.deliveryStatus)}
                              </span>
                              <span className={`rounded-md border px-2 py-1 font-medium ${tripPaymentBadgeClass(r.paymentStatus)}`}>
                                Payment: {tripPaymentLabel(r.paymentStatus)}
                              </span>
                              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700">
                                {formatMoney(r.totalAmount)}
                              </span>
                            </div>
                          </label>
                        ))}
                        {!filteredPendingPool.length ? <p className="p-4 text-sm text-slate-500">No invoices match current filters.</p> : null}
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
                          <div className="flex items-center gap-2 px-2 py-1">
                            <button
                              onClick={() => setExpandedTrip(expandedTrip === t._id ? null : t._id)}
                              className="flex flex-1 items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
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
                            <button
                              onClick={() => runAction(`complete-trip-${t._id}`, async () => completeTripSheet(t._id)).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to complete trip sheet'))}
                              disabled={t.status === 'Complete' || isActionLoading(`complete-trip-${t._id}`)}
                              title={t.status === 'Complete' ? 'Trip already completed' : 'Mark trip sheet as completed'}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          </div>
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
                                          <p className="text-[11px] text-slate-500">Route: {inv.route || '-'}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 text-[11px] text-slate-600">
                                          <div className="flex flex-wrap items-center justify-end gap-2">
                                            <span className={`rounded-md border px-2 py-1 font-medium ${tripDeliveryBadgeClass(inv.deliveryStatus)}`}>
                                              Delivery: {tripDeliveryCode(inv.deliveryStatus)}
                                            </span>
                                            <span className={`rounded-md border px-2 py-1 font-medium ${tripPaymentBadgeClass(inv.paymentStatus)}`}>
                                              Payment: {tripPaymentLabel(inv.paymentStatus)}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span>Actual: <span className="font-medium text-slate-900">{formatMoney(Number(inv.totalAmount || 0))}</span></span>
                                            <span>Received: <span className="font-medium text-emerald-700">{formatMoney(Number(inv.paidAmount || 0))}</span></span>
                                            <span>Deduction: <span className="font-medium text-amber-700">{formatMoney(Number(inv.deductedAmount || 0))}</span></span>
                                          </div>
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

          {pageLoading && activeTab === 'approvals' ? (
            <div className="space-y-4">
              <CardSkeleton rows={5} />
            </div>
          ) : null}

          {!pageLoading && activeTab === 'approvals' ? (
            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-900">Pending Payment Approvals</h3>
                <div className="mt-3 space-y-3">
                  {groupedPaymentApprovals.map((group) => (
                    <div key={group.key} className="rounded-lg border border-slate-200">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {group.driverName} {group.date ? new Date(group.date).toLocaleDateString() : ''}
                          </p>
                          <p className="text-xs text-slate-500">Tripsheet: {group.tripsheetId}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Delivered Shops ({group.deliveredCount}/{group.rows.length})
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => runAction(`approve-group-${group.key}`, async () => approveGroup(group.rows.map((row) => row._id))).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to approve group'))}
                            disabled={isActionLoading(`approve-group-${group.key}`)}
                            className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                          >
                            {isActionLoading(`approve-group-${group.key}`) ? 'Approving...' : 'Approve All'}
                          </button>
                          <button
                            onClick={() =>
                              setExpandedApprovalGroups((prev) =>
                                prev.includes(group.key)
                                  ? prev.filter((key) => key !== group.key)
                                  : [...prev, group.key],
                              )
                            }
                            className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            {expandedApprovalGroups.includes(group.key) ? 'Collapse' : 'Expand'}
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                        <div>Total Cash Received: <span className="font-semibold text-slate-900">{formatMoney(group.totals.cash)}</span></div>
                        <div>Total UPI Received: <span className="font-semibold text-slate-900">{formatMoney(group.totals.upi)}</span></div>
                        <div>Total Cheque Received: <span className="font-semibold text-slate-900">{formatMoney(group.totals.cheque)}</span></div>
                        <div>Delivered Status: <span className="font-semibold text-slate-900">{group.deliveredCount}/{group.rows.length} Delivered</span></div>
                      </div>

                      {expandedApprovalGroups.includes(group.key) ? (
                        <div className="overflow-auto border-t border-slate-200">
                          <table className="min-w-full text-xs">
                            <thead className="bg-white text-slate-500">
                              <tr>
                                <th className="px-3 py-2 text-left">Shop Name</th>
                                <th className="px-3 py-2 text-left">Invoice Number</th>
                                <th className="px-3 py-2 text-left">Actual</th>
                                <th className="px-3 py-2 text-left">Received</th>
                                <th className="px-3 py-2 text-left">Payment Mode</th>
                                <th className="px-3 py-2 text-left">Deduction Total</th>
                                <th className="px-3 py-2 text-left">Deductions</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-left">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.rows.map((approval) => (
                                <tr key={approval._id} className="border-t border-slate-200">
                                  <td className="px-3 py-2">{approval.payload.shopName || '-'}</td>
                                  <td className="px-3 py-2">{approval.payload.invoiceNumber || '-'}</td>
                                  <td className="px-3 py-2">{formatMoney(Number(approval.payload?.totalAmount || 0))}</td>
                                  <td className="px-3 py-2">{formatMoney(Number(approval.payload?.amount || 0))}</td>
                                  <td className="px-3 py-2 uppercase">{approval.payload.mode || '-'}</td>
                                  <td className="px-3 py-2">{formatMoney(Number(approval.payload?.deductedAmount || 0))}</td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {Array.isArray(approval.payload?.deductions) && approval.payload.deductions.length
                                      ? approval.payload.deductions
                                          .map((ded: any) => `${ded.typeLabel || ded.type || 'deduction'}: ${formatMoney(Number(ded.amount || 0))}`)
                                          .join(', ')
                                      : '-'}
                                  </td>
                                  <td className="px-3 py-2">{approval.status}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => runAction(`approve-${approval._id}`, async () => approveItem(approval._id)).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to approve'))}
                                        disabled={isActionLoading(`approve-${approval._id}`)}
                                        className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700"
                                      >
                                        {isActionLoading(`approve-${approval._id}`) ? 'Approving...' : 'Approve'}
                                      </button>
                                      <button
                                        onClick={() => runAction(`reject-${approval._id}`, async () => rejectItem(approval._id)).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to reject'))}
                                        disabled={isActionLoading(`reject-${approval._id}`)}
                                        className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700"
                                      >
                                        {isActionLoading(`reject-${approval._id}`) ? 'Rejecting...' : 'Reject'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {!groupedPaymentApprovals.length ? <p className="text-sm text-slate-500">No pending payment groups.</p> : null}
                </div>
              </div>
            </div>
          ) : null}

          {pageLoading && activeTab === 'cheques' ? (
            <div className="space-y-4">
              <CardSkeleton rows={5} />
            </div>
          ) : null}

          {!pageLoading && activeTab === 'cheques' ? (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">Cheques</h3>
                <p className="mt-1 text-xs text-slate-500">Track cheque lifecycle and reconcile invoice balances.</p>
              </div>

              <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:grid-cols-6">
                <input
                  value={manualChequeForm.invoiceNumber}
                  onChange={(e) => setManualChequeForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                  placeholder="Invoice Number"
                  list="invoice-number-options"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <datalist id="invoice-number-options">
                  {invoiceRows.map((row) => (
                    <option key={row._id} value={row.invoiceNumber} />
                  ))}
                </datalist>
                <input
                  value={manualChequeForm.chequeNumber}
                  onChange={(e) => setManualChequeForm((prev) => ({ ...prev, chequeNumber: e.target.value }))}
                  placeholder="Cheque Number"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={manualChequeForm.date}
                  onChange={(e) => setManualChequeForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  value={manualChequeForm.bankName}
                  onChange={(e) => setManualChequeForm((prev) => ({ ...prev, bankName: e.target.value }))}
                  placeholder="Bank Name"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  value={manualChequeForm.amount}
                  onChange={(e) => setManualChequeForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Cheque Amount"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  value={manualChequeForm.action}
                  disabled
                  className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
                />
                <button
                  onClick={() => runAction('add-cheque-entry', async () => createManualCheque()).catch((err) => setApiError(err instanceof Error ? err.message : 'Failed to create cheque'))}
                  disabled={isActionLoading('add-cheque-entry')}
                  className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  {isActionLoading('add-cheque-entry') ? 'Adding...' : 'Add Cheque Entry'}
                </button>
              </div>

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

          {pageLoading && activeTab === 'expenses' ? (
            <div className="space-y-4">
              <CardSkeleton rows={4} />
            </div>
          ) : null}

          {!pageLoading && activeTab === 'expenses' ? (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">Expenses</h3>
                <p className="mt-1 text-xs text-slate-500">Add and review expense records.</p>
              </div>

              <div className="border-b border-slate-200 px-5 py-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Driver Expense Approvals</h4>
                <div className="mt-3 space-y-2">
                  {expenseApprovals.map((approval) => (
                    <div key={approval._id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">
                          {approval.payload?.type || approval.payload?.category || 'Expense'}
                        </p>
                        <p className="text-slate-700">{formatMoney(Number(approval.payload?.amount || 0))}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {approval.payload?.date || '-'} · {approval.payload?.addedBy || 'Driver'}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{approval.payload?.note || approval.payload?.notes || '-'}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => runAction(`approve-${approval._id}`, async () => approveItem(approval._id)).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to approve'))}
                          disabled={isActionLoading(`approve-${approval._id}`)}
                          className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                        >
                          {isActionLoading(`approve-${approval._id}`) ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => runAction(`reject-${approval._id}`, async () => rejectItem(approval._id)).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to reject'))}
                          disabled={isActionLoading(`reject-${approval._id}`)}
                          className="rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700"
                        >
                          {isActionLoading(`reject-${approval._id}`) ? 'Rejecting...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {!expenseApprovals.length ? <p className="text-sm text-slate-500">No pending driver expenses.</p> : null}
                </div>
              </div>

              <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:grid-cols-5">
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  placeholder="Category"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  placeholder="Added By"
                  value={expenseForm.addedBy}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, addedBy: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <button
                  onClick={() => runAction('add-expense', async () => createExpense()).catch((err) => setApiError(err instanceof Error ? err.message : 'Failed to create expense'))}
                  disabled={isActionLoading('add-expense')}
                  className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  {isActionLoading('add-expense') ? 'Adding...' : 'Add Expense'}
                </button>
                <input
                  placeholder="Notes (optional)"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="md:col-span-5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
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
                        <td className="px-4 py-4">{e.status || (e.approvedAt ? 'approved' : 'approved')}</td>
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

          {showDeliveryModal && deliveryModalInvoice ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
              <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
                <h3 className="text-sm font-semibold text-slate-900">Mark Invoice as Delivered</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Invoice {deliveryModalInvoice.invoiceNumber} · {deliveryModalInvoice.shopName}
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Delivery Person Name</label>
                    <input
                      value={deliveryForm.deliveryPerson}
                      onChange={(e) => {
                        setDeliveryForm((prev) => ({ ...prev, deliveryPerson: e.target.value }));
                        if (deliveryFormError) setDeliveryFormError('');
                      }}
                      placeholder="Enter delivery person name"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {deliveryFormError ? <p className="mt-3 text-xs text-rose-700">{deliveryFormError}</p> : null}

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowDeliveryModal(false);
                      setDeliveryModalInvoice(null);
                      setDeliveryForm({ deliveryPerson: '' });
                      setDeliveryFormError('');
                    }}
                    disabled={isActionLoading('save-delivery-status')}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => runAction('save-delivery-status', async () => submitDeliveredStatusUpdate()).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to update delivery status'))}
                    disabled={isActionLoading('save-delivery-status')}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white"
                  >
                    {isActionLoading('save-delivery-status') ? 'Saving...' : 'Save Delivery Status'}
                  </button>
                </div>
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
                      <label className="text-xs font-medium text-slate-600">
                        {paymentForm.mode === 'upi' ? 'Step 3: Reference (Optional)' : 'Step 3: Reference'}
                      </label>
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
                    onClick={() => setShowPaymentModal(false)}
                    disabled={isActionLoading('submit-payment')}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => runAction('submit-payment', async () => submitPaymentApproval()).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to submit payment'))}
                    disabled={isActionLoading('submit-payment')}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white"
                  >
                    {isActionLoading('submit-payment') ? 'Confirming...' : 'Confirm'}
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
                    disabled={isActionLoading('save-note')}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => runAction('save-note', async () => submitNote()).catch((e) => setApiError(e instanceof Error ? e.message : 'Failed to add note'))}
                    disabled={isActionLoading('save-note')}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white"
                  >
                    {isActionLoading('save-note') ? 'Saving...' : 'Save Note'}
                  </button>
                </div>
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
  sortBy,
  sortDirection,
  onSortChange,
  filters,
  routeOptions,
  setFilters,
  activeFilter,
  setActiveFilter,
  expandedInvoice,
  setExpandedInvoice,
  page,
  pages,
  total,
  onPageJump,
  onPrev,
  onNext,
  onAddPayment,
  onAddNote,
  onArchive,
  onDeliveryStatusAction,
}: {
  rows: InvoiceRow[];
  loading: boolean;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  onSortChange: (sortBy: string, sortDirection: 'asc' | 'desc') => void;
  filters: InvoiceFilters;
  routeOptions: string[];
  setFilters: React.Dispatch<React.SetStateAction<InvoiceFilters>>;
  activeFilter: InvoiceFilterKey | null;
  setActiveFilter: React.Dispatch<React.SetStateAction<InvoiceFilterKey | null>>;
  expandedInvoice: string | null;
  setExpandedInvoice: React.Dispatch<React.SetStateAction<string | null>>;
  page: number;
  pages: number;
  total: number;
  onPageJump: (page: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onAddPayment: (invoice: InvoiceRow) => void;
  onAddNote: (invoice: InvoiceRow) => void;
  onArchive: (invoice: InvoiceRow) => void;
  onDeliveryStatusAction: (invoice: InvoiceRow) => void;
}) {
  const sorting = useMemo<SortingState>(
    () => [{ id: sortBy, desc: sortDirection === 'desc' }],
    [sortBy, sortDirection],
  );

  const columns = useMemo<ColumnDef<InvoiceRow>[]>(
    () => [
      {
        accessorKey: 'invoiceNumber',
        header: 'Invoice Number',
        meta: { filter: 'invoiceNumber' },
      },
      {
        accessorKey: 'cmpCode',
        header: 'CmpCode',
        cell: (info) => String(info.row.original.cmpCode || info.row.original.firm || '-'),
      },
      {
        accessorKey: 'route',
        header: 'Route',
        meta: { filter: 'route' },
        enableSorting: false,
        cell: (info) => String(info.row.original.route || '-'),
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
        cell: (info) => {
          const metrics = getInvoicePaymentMetrics(info.row.original);
          return <Badge className={statusBadgeClass(metrics.status)}>{metrics.status}</Badge>;
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    manualSorting: true,
    enableSortingRemoval: false,
    onSortingChange: (updater) => {
      const nextSorting = typeof updater === 'function' ? updater(sorting) : updater;
      if (!nextSorting.length) return;
      const next = nextSorting[0];
      const nextSortBy = String(next.id);
      const nextSortDirection = next.desc ? 'desc' : 'asc';
      if (nextSortBy !== sortBy || nextSortDirection !== sortDirection) {
        onSortChange(nextSortBy, nextSortDirection);
      }
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const paginationItems = useMemo<Array<number | 'ellipsis-left' | 'ellipsis-right'>>(() => {
    if (pages <= 8) {
      return Array.from({ length: pages }, (_, i) => i + 1);
    }

    const items: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [];

    if (page <= 4) {
      for (let p = 1; p <= 6; p += 1) {
        items.push(p);
      }
      items.push('ellipsis-right', pages);
      return items;
    }

    if (page >= pages - 3) {
      items.push(1, 'ellipsis-left');
      for (let p = pages - 5; p <= pages; p += 1) {
        items.push(p);
      }
      return items;
    }

    items.push(1, 'ellipsis-left');
    for (let p = page - 2; p <= page + 2; p += 1) {
      items.push(p);
    }
    items.push('ellipsis-right', pages);
    return items;
  }, [page, pages]);

  return (
    <div className="space-y-4">
      <div className="card overflow-visible">
        <div className="overflow-x-auto overflow-y-visible">
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
                          routeOptions={routeOptions}
                          setFilters={setFilters}
                          isFiltered={(() => {
                            const key = (header.column.columnDef.meta as { filter: InvoiceFilterKey } | undefined)?.filter;
                            if (!key) return false;
                            if (key === 'invoiceNumber') return Boolean(filters.invoiceNumber);
                            if (key === 'shopName') return Boolean(filters.shopName);
                            if (key === 'route') return filters.route.length > 0;
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
                      <td colSpan={8} className="px-4 py-4">
                        <div className="skeleton h-6 w-full" />
                      </td>
                    </tr>
                  ))
                : table.getRowModel().rows.length === 0
                  ? (
                    <tr className="border-b border-slate-200">
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
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
                                <td colSpan={8} className="bg-slate-50 px-4 py-4">
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: 'auto' }}
                                  exit={{ height: 0 }}
                                  transition={{ duration: 0.2, ease: 'easeOut' }}
                                  className="overflow-hidden"
                                >
                                  <div className="grid gap-3">
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                                        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Delivery Info</h4>
                                        <div className="mt-2 grid gap-1.5 text-xs">
                                          <div className="flex items-center justify-between">
                                            <span className="text-slate-500">Status</span>
                                            <Badge className={statusBadgeClass(row.original.deliveryStatus)}>{row.original.deliveryStatus}</Badge>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-slate-500">Driver</span>
                                            <span className="font-medium text-slate-900">{row.original.deliveryPerson || 'Unassigned'}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-slate-500">CmpCode</span>
                                            <span className="font-medium text-slate-900">{row.original.cmpCode || row.original.firm || '-'}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-slate-500">Delivered At</span>
                                            <span className="font-medium text-slate-900">{formatDateTime(row.original.deliveredAt || row.original.deliveredDate)}</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                                        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Payment Logs</h4>
                                        {(row.original.paymentHistory || []).length ? (
                                          <div className="mt-2 max-h-44 overflow-auto">
                                            <table className="min-w-full text-[11px]">
                                              <thead className="text-slate-500">
                                                <tr>
                                                  <th className="px-2 py-1 text-left">Mode</th>
                                                  <th className="px-2 py-1 text-left">Amt</th>
                                                  <th className="px-2 py-1 text-left">Date</th>
                                                  <th className="px-2 py-1 text-left">By</th>
                                                  <th className="px-2 py-1 text-left">Ref/Proof</th>
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
                                                        {String(p.mode || '').toLowerCase() === 'upi' ? (
                                                          p.proofImageUrl ? (
                                                            <a
                                                              href={p.proofImageUrl}
                                                              target="_blank"
                                                              rel="noreferrer"
                                                              className="inline-flex rounded border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-700"
                                                            >
                                                              Open Image
                                                            </a>
                                                          ) : (
                                                            '-'
                                                          )
                                                        ) : (
                                                          <>
                                                            {p.reference || p.chequeNumber || '-'}
                                                            {p.bankName ? ` (${p.bankName})` : ''}
                                                            {p.chequeStatus ? ` • ${p.chequeStatus}` : ''}
                                                          </>
                                                        )}
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
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-3">
                                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                                        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</h4>
                                        {(row.original.notes || []).length ? (
                                          <div className="mt-2 max-h-32 space-y-1.5 overflow-auto text-[11px]">
                                            {(row.original.notes || []).map((note, idx) => (
                                              <div key={idx} className="rounded border border-slate-100 p-1.5">
                                                <p className="text-slate-700">{note.text}</p>
                                                <p className="mt-1 text-slate-500">{note.addedBy || 'Admin'} · {formatDateTime(note.timestamp || note.createdAt)}</p>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="mt-2 text-xs text-slate-500">No notes available.</p>
                                        )}
                                      </div>

                                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                                        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Summary</h4>
                                        {(() => {
                                          const metrics = getInvoicePaymentMetrics(row.original)

                                          return (
                                            <div className="mt-2 grid gap-1.5 text-xs">
                                              <div className="flex items-center justify-between">
                                                <span className="text-slate-500">Total Amount</span>
                                                <span className="font-medium text-slate-900">{formatMoney(metrics.total)}</span>
                                              </div>
                                              <div className="flex items-center justify-between">
                                                <span className="text-slate-500">Total Paid</span>
                                                <span className="font-medium text-slate-900">{formatMoney(metrics.paid)}</span>
                                              </div>
                                              <div className="flex items-center justify-between">
                                                <span className="text-slate-500">Total Deducted</span>
                                                <span className="font-medium text-slate-900">{formatMoney(metrics.deducted)}</span>
                                              </div>
                                              <div className="flex items-center justify-between">
                                                <span className="text-slate-500">Remaining</span>
                                                <span className={`font-medium ${metrics.remaining < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                                                  {formatMoney(metrics.remaining)}
                                                </span>
                                              </div>
                                            </div>
                                          )
                                        })()}
                                      </div>

                                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                                        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Deductions</h4>
                                        {(row.original.deductions || []).length ? (
                                          <div className="mt-2 max-h-32 space-y-1.5 overflow-auto text-[11px]">
                                            {(row.original.deductions || []).map((deduction, idx) => (
                                              <div key={`${deduction.type}-${deduction.createdAt || idx}`} className="rounded border border-slate-100 p-1.5">
                                                <div className="flex items-center justify-between gap-2">
                                                  <p className="font-medium text-slate-700">{deduction.typeLabel || deduction.type || 'Deduction'}</p>
                                                  <p className="text-slate-900">{formatMoney(Number(deduction.amount || 0))}</p>
                                                </div>
                                                <p className="mt-1 text-slate-500">{formatDateTime(deduction.createdAt)}</p>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="mt-2 text-xs text-slate-500">No deductions available.</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeliveryStatusAction(row.original);
                                      }}
                                      className={`rounded-lg border px-3 py-2 text-xs transition hover:bg-slate-100 ${
                                        row.original.deliveryStatus === 'delivered'
                                          ? 'border-slate-200 text-slate-600'
                                          : 'border-sky-200 bg-sky-50 text-sky-700'
                                      }`}
                                    >
                                      {row.original.deliveryStatus === 'delivered' ? 'Mark undelivered' : 'Mark delivered'}
                                    </button>
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

      <div className="flex items-center justify-center gap-2 text-sm">
        <button
          aria-label="Previous page"
          disabled={page <= 1 || loading}
          onClick={onPrev}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
        >
          &lt;
        </button>
        {paginationItems.map((item) => {
          if (item === 'ellipsis-left' || item === 'ellipsis-right') {
            return (
              <span key={item} className="px-1 text-slate-400">
                ...
              </span>
            );
          }

          return (
            <button
              key={item}
              disabled={loading}
              onClick={() => onPageJump(item)}
              className={`rounded-lg border px-3 py-2 text-sm transition disabled:opacity-40 ${
                item === page
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item}
            </button>
          );
        })}
        <button
          aria-label="Next page"
          disabled={page >= pages || loading}
          onClick={onNext}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
        >
          &gt;
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
  routeOptions,
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
  routeOptions: string[];
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
          {filterKey === 'route' ? (
            <MultiSelectDropdown
              options={routeOptions}
              selected={filters.route}
              onChange={(next) => setFilterValue({ route: next })}
              placeholder="All Routes"
              className="w-64"
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
              <option value="pending">Undelivered</option>
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
