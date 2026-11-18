"use client";

import { ChangeEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  FilterX,
  HelpCircle,
  Info,
  Key,
  Landmark,
  Layers,
  LayoutDashboard,
  ListFilter,
  Loader2,
  Lock,
  LogOut,
  Menu,
  MoreVertical,
  Palette,
  Plus,
  Receipt,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
  Upload,
  UploadCloud,
  User,
  UserCheck,
  UserCircle,
  UserPlus,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ThemeSettingsPopover } from '@/components/theme-provider';

type TabKey = 'dashboard' | 'invoices' | 'importExport' | 'trips' | 'approvals' | 'cheques' | 'expenses';
type TripsSubTab = 'new' | 'past';
type InvoiceFilterKey = 'invoiceNumber' | 'date' | 'shopName' | 'route' | 'amount' | 'deliveryStatus' | 'paymentStatus';

type FilterType = 'text' | 'enum' | 'date' | 'amount';

type ActiveFilterChipItem = {
  id: string;
  label: string;
  onRemove: () => void;
};

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
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return 'border-emerald-400/25 bg-emerald-400/12 text-emerald-300';
  if (s === 'partial') return 'border-amber-400/25 bg-amber-400/12 text-amber-300';
  if (s === 'unpaid') return 'border-rose-400/25 bg-rose-400/12 text-rose-300';
  if (s === 'payable') return 'border-orange-400/25 bg-orange-400/12 text-orange-300';
  if (s === 'delivered') return 'border-sky-400/25 bg-sky-400/12 text-sky-300';
  if (s === 'complete') return 'border-emerald-400/25 bg-emerald-400/12 text-emerald-300';
  return 'border-white/[0.08] bg-white/[0.04] text-white/70';
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
    ? 'border-sky-400/25 bg-sky-400/12 text-sky-300'
    : 'border-white/[0.08] bg-white/[0.04] text-white/70';
}

function tripPaymentBadgeClass(status: unknown) {
  const normalized = normalizeTripPaymentStatus(status);
  if (normalized === 'paid') return 'border-emerald-400/25 bg-emerald-400/12 text-emerald-300';
  if (normalized === 'partial') return 'border-amber-400/25 bg-amber-400/12 text-amber-300';
  return 'border-rose-400/25 bg-rose-400/12 text-rose-300';
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

function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  variant = 'default',
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: typeof LayoutDashboard;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const variantStyles = {
    default: {
      bg: 'bg-white/[0.045]',
      border: 'border-white/[0.08]',
      iconBox: 'bg-white/[0.05] text-white/70 border border-white/[0.08] backdrop-blur-md',
      text: 'text-white/95',
    },
    success: {
      bg: 'bg-white/[0.045]',
      border: 'border-emerald-400/25',
      iconBox: 'bg-emerald-400/12 text-emerald-300 border border-emerald-400/25 backdrop-blur-md',
      text: 'text-white/95',
    },
    warning: {
      bg: 'bg-white/[0.045]',
      border: 'border-amber-400/25',
      iconBox: 'bg-amber-400/12 text-amber-300 border border-amber-400/25 backdrop-blur-md',
      text: 'text-white/95',
    },
    danger: {
      bg: 'bg-white/[0.045]',
      border: 'border-rose-400/25',
      iconBox: 'bg-rose-400/12 text-rose-300 border border-rose-400/25 backdrop-blur-md',
      text: 'text-white/95',
    },
    info: {
      bg: 'bg-white/[0.045]',
      border: 'border-sky-400/25',
      iconBox: 'bg-sky-400/12 text-sky-300 border border-sky-400/25 backdrop-blur-md',
      text: 'text-white/95',
    },
  }[variant];

  return (
    <div className={`card relative overflow-hidden rounded-[20px] p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 ${variantStyles.border} ${variantStyles.bg}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/50">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${variantStyles.iconBox}`}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </div>
      </div>
      <p className={`mt-2 text-2xl font-medium tracking-tight num-tabular ${variantStyles.text}`}>
        {value}
      </p>
      {subtext && (
        <p className="mt-1 text-[11px] font-normal text-white/50">
          {subtext}
        </p>
      )}
    </div>
  );
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card rounded-[20px] p-5">
      <div className="skeleton h-4 w-40" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="skeleton h-12 w-full" />
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
        className="glass-input flex w-full items-center justify-between px-3 py-2 text-left text-xs font-normal text-white/85 shadow-sm"
      >
        <span className="truncate">{summaryLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.5} />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-1.5 w-64 glass-popover p-2.5 shadow-panel text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between border-b border-white/[0.06] pb-1.5 px-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/45">Select Options</p>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] font-normal text-indigo-400 hover:text-indigo-300"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-52 space-y-0.5 overflow-y-auto pr-1">
            {options.length ? (
              options.map((option) => {
                const key = option.toLowerCase();
                const checked = selectedSet.has(key);
                return (
                  <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/[0.08] transition">
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
                      className="rounded border-white/20 bg-white/10 text-indigo-500 focus:ring-indigo-400"
                    />
                    <span className="truncate">{option}</span>
                  </label>
                );
              })
            ) : (
              <p className="px-2 py-3 text-center text-xs text-white/40">No options available.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SidebarNav({
  activeTab,
  setActiveTab,
  onCloseMobile,
  pendingApprovalsCount,
  pendingChequesCount,
  invoicesCount,
  tripsCount,
  refreshAll,
  pageLoading,
  logout,
  onOpenTheme,
}: {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  onCloseMobile?: () => void;
  pendingApprovalsCount: number;
  pendingChequesCount: number;
  invoicesCount: number;
  tripsCount: number;
  refreshAll: () => Promise<void>;
  pageLoading: boolean;
  logout: () => Promise<void>;
  onOpenTheme?: (el: HTMLElement) => void;
}) {
  const sections = [
    {
      title: 'OVERVIEW',
      items: [
        { key: 'dashboard' as TabKey, label: 'Dashboard', icon: BarChart3 },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        { key: 'invoices' as TabKey, label: 'Invoices', icon: Receipt, badge: invoicesCount > 0 ? invoicesCount : undefined, badgeColor: 'slate' },
        { key: 'trips' as TabKey, label: 'Trip Sheets', icon: Route, badge: tripsCount > 0 ? tripsCount : undefined, badgeColor: 'slate' },
        { key: 'importExport' as TabKey, label: 'Import / Export', icon: ArrowDownUp },
      ],
    },
    {
      title: 'FINANCE & AUDIT',
      items: [
        {
          key: 'approvals' as TabKey,
          label: 'Approvals',
          icon: ShieldCheck,
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
          badgeColor: 'amber',
        },
        {
          key: 'cheques' as TabKey,
          label: 'Cheques',
          icon: Landmark,
          badge: pendingChequesCount > 0 ? pendingChequesCount : undefined,
          badgeColor: 'blue',
        },
        { key: 'expenses' as TabKey, label: 'Expenses', icon: Wallet },
      ],
    },
  ];

  return (
    <div className="flex h-full flex-col justify-between overflow-y-auto p-4 text-white/80">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4 pt-1">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] p-1.5 shadow-inner backdrop-blur-md">
            <Image
              src="/sgb.png"
              alt="SGB Logo"
              width={36}
              height={36}
              className="object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-medium tracking-wider text-white/95 uppercase">
                SGB Enterprises
              </span>
            </div>
            <p className="truncate text-[10px] font-normal text-white/50">Logistics & Fleet Console</p>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="rounded-lg p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white lg:hidden"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Live Status Pill */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[10px] backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-medium tracking-wide">ONLINE SYSTEM</span>
          </div>
          <span className="num-tabular font-normal text-white/45">v2.4 Prod</span>
        </div>

        {/* Navigation Groups */}
        <nav className="mt-5 space-y-4">
          {sections.map((sec) => (
            <div key={sec.title}>
              <p className="px-2 pb-1 text-[11px] font-medium tracking-[0.08em] text-white/45 uppercase">
                {sec.title}
              </p>
              <div className="space-y-1">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setActiveTab(item.key);
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={`group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-normal transition ${
                        isActive
                          ? 'border border-indigo-400/35 bg-indigo-500/18 text-white/95 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                          : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition ${
                            isActive ? 'text-indigo-300' : 'text-white/50 group-hover:text-white/80'
                          }`}
                          strokeWidth={1.5}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {typeof item.badge === 'number' && item.badge > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium num-tabular ${
                            item.badgeColor === 'amber'
                              ? 'border border-amber-400/25 bg-amber-400/12 text-amber-300 animate-pulse'
                              : item.badgeColor === 'blue'
                              ? 'border border-sky-400/25 bg-sky-400/12 text-sky-300'
                              : 'border border-white/[0.08] bg-white/[0.08] text-white/80'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="mt-6 border-t border-white/[0.06] pt-4 space-y-3">
        {/* Quick Sync & Theme Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            disabled={pageLoading}
            className="glass-btn flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pageLoading ? 'animate-spin text-indigo-400' : 'text-white/50'}`} strokeWidth={1.5} />
            <span>{pageLoading ? 'Synchronizing...' : 'Sync Console'}</span>
          </button>
          {onOpenTheme && (
            <button
              onClick={(e) => onOpenTheme(e.currentTarget)}
              title="Theme Settings"
              aria-label="Theme Settings"
              className="glass-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/70 hover:text-white shadow-sm"
            >
              <Palette className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* User Card & Logout */}
        <div className="glass-row flex items-center justify-between p-2.5 rounded-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-400/30 bg-indigo-500/25 text-xs font-medium text-white shadow-sm">
              AD
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white/92">Administrator</p>
              <p className="truncate text-[10px] font-normal text-white/50">Operations Root</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Log out of console"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/45 transition hover:bg-rose-500/15 hover:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

type ColumnFilterHeaderProps = {
  columnId?: string;
  label: string;
  filterType?: FilterType;
  filterValue?: any;
  enumOptions?: string[];
  isFiltered?: boolean;
  onApplyFilter?: (value: any) => void;
  onClearFilter?: () => void;
  sortState?: false | 'asc' | 'desc';
  onSort?: (event: unknown) => void;
};

function ColumnFilterHeader({
  columnId,
  label,
  filterType,
  filterValue,
  enumOptions,
  isFiltered = false,
  onApplyFilter,
  onClearFilter,
  sortState,
  onSort,
}: ColumnFilterHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [draftText, setDraftText] = useState('');
  const [draftEnums, setDraftEnums] = useState<string[]>([]);
  const [enumSearch, setEnumSearch] = useState('');
  const [draftDate, setDraftDate] = useState({ from: '', to: '' });
  const [draftAmount, setDraftAmount] = useState({ min: '', max: '' });

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setEnumSearch('');

    if (filterType === 'text') {
      setDraftText(typeof filterValue === 'string' ? filterValue : '');
    } else if (filterType === 'enum') {
      if (Array.isArray(filterValue)) {
        setDraftEnums(filterValue.map((s: string) => String(s).toLowerCase()));
      } else if (typeof filterValue === 'string' && filterValue) {
        setDraftEnums([filterValue.toLowerCase()]);
      } else {
        setDraftEnums([]);
      }
    } else if (filterType === 'date') {
      setDraftDate({
        from: filterValue?.from || '',
        to: filterValue?.to || '',
      });
    } else if (filterType === 'amount') {
      setDraftAmount({
        min: filterValue?.min || '',
        max: filterValue?.max || '',
      });
    }

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 260;
      const popoverEstimatedHeight = filterType === 'enum' ? 320 : 220;
      let left = rect.left;
      let top = rect.bottom + 8;

      if (typeof window !== 'undefined') {
        if (left + popoverWidth > window.innerWidth - 16) {
          left = Math.max(16, window.innerWidth - popoverWidth - 16);
        }
        if (top + popoverEstimatedHeight > window.innerHeight - 16 && rect.top > popoverEstimatedHeight) {
          top = Math.max(16, rect.top - popoverEstimatedHeight - 8);
        }
      }

      setPopoverPos({ top, left });
    }
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleApply = () => {
    if (filterType === 'text') {
      onApplyFilter?.(draftText);
    } else if (filterType === 'enum') {
      onApplyFilter?.(draftEnums);
    } else if (filterType === 'date') {
      onApplyFilter?.(draftDate);
    } else if (filterType === 'amount') {
      onApplyFilter?.(draftAmount);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    onClearFilter?.();
    setDraftText('');
    setDraftEnums([]);
    setEnumSearch('');
    setDraftDate({ from: '', to: '' });
    setDraftAmount({ min: '', max: '' });
    setIsOpen(false);
  };

  const filteredEnumOptions = useMemo(() => {
    if (!enumOptions) return [];
    if (!enumSearch.trim()) return enumOptions;
    const q = enumSearch.toLowerCase().trim();
    return enumOptions.filter((opt) => opt.toLowerCase().includes(q));
  }, [enumOptions, enumSearch]);

  const sortIcon =
    sortState === 'asc' ? (
      <ChevronUp className="h-3 w-3 text-[var(--accent-solid)]" strokeWidth={1.5} />
    ) : sortState === 'desc' ? (
      <ChevronDown className="h-3 w-3 text-[var(--accent-solid)]" strokeWidth={1.5} />
    ) : (
      <ArrowDownUp className="h-3 w-3 text-[var(--text-3)] group-hover:text-[var(--text-1)]" strokeWidth={1.5} />
    );

  return (
    <div className="inline-flex items-center gap-1.5 font-medium text-[11px] uppercase tracking-[0.08em] select-none">
      <span className={isFiltered ? 'text-[var(--accent-solid)] font-semibold' : 'text-[var(--text-2)]'}>
        {label}
      </span>

      {filterType && (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          title={`Filter ${label}`}
          className={`relative inline-flex items-center justify-center p-1 rounded-lg transition-colors duration-150 ${
            isFiltered ? 'text-[var(--accent-solid)] bg-[var(--accent-soft)]' : 'text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-white/[0.06]'
          }`}
        >
          <ListFilter className="h-3.5 w-3.5" strokeWidth={1.5} />
          {isFiltered && (
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--accent-solid)] shadow-[0_0_6px_var(--accent-solid)]" />
          )}
        </button>
      )}

      {onSort && (
        <button
          type="button"
          onClick={onSort}
          title="Toggle sort direction"
          className="group rounded-lg p-1 hover:bg-white/[0.06] transition text-[var(--text-3)] hover:text-[var(--text-1)]"
        >
          {sortIcon}
        </button>
      )}

      {isOpen && popoverPos && typeof document !== 'undefined' &&
        createPortal(
          <>
            {/* Full-screen invisible backdrop layer for click-to-close & slight table dimming */}
            <div
              className="fixed inset-0 z-[9998] bg-black/15 transition-opacity"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <div
              ref={popoverRef}
              style={{
                position: 'fixed',
                top: `${popoverPos.top}px`,
                left: `${popoverPos.left}px`,
                width: '260px',
                zIndex: 9999,
              }}
              className="glass-popover p-3.5 text-xs text-[var(--text-1)] shadow-2xl animate-in fade-in zoom-in-95 duration-150 select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)] mb-2.5">
                FILTER {label.toUpperCase()}
              </div>

              {filterType === 'text' && (
                <input
                  type="text"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="Contains..."
                  className="glass-input w-full px-2.5 py-1.5 h-8 text-xs text-[var(--text-1)] placeholder-[var(--text-3)] font-normal"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApply();
                    }
                  }}
                />
              )}

              {filterType === 'enum' && (
                <div className="space-y-2">
                  {enumOptions && enumOptions.length > 5 && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-3)] pointer-events-none" strokeWidth={1.5} />
                      <input
                        type="text"
                        value={enumSearch}
                        onChange={(e) => setEnumSearch(e.target.value)}
                        placeholder="Search..."
                        className="glass-input w-full pl-8 pr-2.5 h-8 text-xs text-[var(--text-1)] placeholder-[var(--text-3)] font-normal"
                      />
                    </div>
                  )}
                  <div
                    className="max-h-[240px] overflow-y-auto space-y-1 pr-1 custom-scrollbar"
                    style={{
                      maskImage: filteredEnumOptions.length > 6
                        ? 'linear-gradient(to bottom, black calc(100% - 20px), transparent 100%)'
                        : undefined,
                      WebkitMaskImage: filteredEnumOptions.length > 6
                        ? 'linear-gradient(to bottom, black calc(100% - 20px), transparent 100%)'
                        : undefined,
                    }}
                  >
                    {filteredEnumOptions && filteredEnumOptions.length > 0 ? (
                      filteredEnumOptions.map((opt) => {
                        const checked = draftEnums.includes(opt.toLowerCase());
                        return (
                          <label
                            key={opt}
                            className="flex items-center gap-2.5 px-2 h-9 rounded-lg text-[13px] text-[var(--text-1)] cursor-pointer hover:bg-[var(--glass-row-hover)] transition-colors select-none"
                          >
                            <span
                              className={`relative inline-flex items-center justify-center w-4 h-4 rounded-[4px] border transition-colors flex-shrink-0 ${
                                checked
                                  ? 'bg-[var(--accent-solid)] border-[var(--accent-solid)] text-white shadow-sm'
                                  : 'border-white/30 dark:border-white/30 light:border-black/25 bg-white/5'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                            </span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const lower = opt.toLowerCase();
                                if (e.target.checked) {
                                  setDraftEnums((prev) => [...prev, lower]);
                                } else {
                                  setDraftEnums((prev) => prev.filter((x) => x !== lower));
                                }
                              }}
                              className="sr-only"
                            />
                            <span className="capitalize truncate flex-1">{opt}</span>
                          </label>
                        );
                      })
                    ) : (
                      <div className="py-4 text-center text-xs text-[var(--text-3)] italic">
                        No options found
                      </div>
                    )}
                  </div>
                </div>
              )}

              {filterType === 'date' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--text-3)] block mb-1">From</label>
                    <input
                      type="date"
                      value={draftDate.from}
                      onChange={(e) => setDraftDate((prev) => ({ ...prev, from: e.target.value }))}
                      className="glass-input w-full px-2 py-1 h-8 text-xs text-[var(--text-1)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--text-3)] block mb-1">To</label>
                    <input
                      type="date"
                      value={draftDate.to}
                      onChange={(e) => setDraftDate((prev) => ({ ...prev, to: e.target.value }))}
                      className="glass-input w-full px-2 py-1 h-8 text-xs text-[var(--text-1)]"
                    />
                  </div>
                </div>
              )}

              {filterType === 'amount' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--text-3)] block mb-1">Min</label>
                    <input
                      type="number"
                      placeholder="Min"
                      value={draftAmount.min}
                      onChange={(e) => setDraftAmount((prev) => ({ ...prev, min: e.target.value }))}
                      className="glass-input w-full px-2.5 py-1.5 h-8 text-xs text-[var(--text-1)] placeholder-[var(--text-3)] font-normal"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApply();
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--text-3)] block mb-1">Max</label>
                    <input
                      type="number"
                      placeholder="Max"
                      value={draftAmount.max}
                      onChange={(e) => setDraftAmount((prev) => ({ ...prev, max: e.target.value }))}
                      className="glass-input w-full px-2.5 py-1.5 h-8 text-xs text-[var(--text-1)] placeholder-[var(--text-3)] font-normal"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApply();
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[var(--border-subtle)] mt-3">
                <button
                  type="button"
                  onClick={handleClear}
                  className="h-[30px] px-2.5 text-xs text-[var(--text-2)] hover:text-[var(--text-1)] rounded-lg hover:bg-white/[0.06] font-medium transition"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="h-[30px] px-3.5 text-xs font-medium rounded-lg text-white bg-[var(--accent-solid)] hover:brightness-110 shadow-[0_2px_10px_var(--accent-soft)] transition active:scale-[0.98]"
                >
                  Apply
                </button>
              </div>
            </div>
          </>,
          document.body
        )
      }
    </div>
  );
}

function ActiveFilterChips({
  chips,
  onClearAll,
}: {
  chips: ActiveFilterChipItem[];
  onClearAll: () => void;
}) {
  if (!chips || chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1 px-1">
      <span className="text-[11px] text-white/45 font-medium uppercase tracking-[0.06em]">Active filters:</span>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-normal bg-indigo-500/15 border border-indigo-400/30 text-indigo-200"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="text-indigo-300 hover:text-white p-0.5 transition"
            title="Remove filter"
          >
            <X className="h-3 w-3" strokeWidth={1.5} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs text-white/50 hover:text-white/90 px-2 py-0.5 transition underline-offset-2 hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

export default function LogisticsApp() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [apiError, setApiError] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeAnchorEl, setThemeAnchorEl] = useState<HTMLElement | null>(null);

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
  const pageTitle = {
    dashboard: 'Operations Dashboard',
    invoices: 'Invoice Records & Clearance',
    trips: 'Trip Sheets & Dispatch',
    importExport: 'Data Management & Excel',
    approvals: 'Payment & Expense Approvals',
    cheques: 'Cheque Clearance & Audit',
    expenses: 'Operational Expense Tracking',
  }[activeTab];

  const [tripColumnFilters, setTripColumnFilters] = useState<{
    invoiceNumber: string;
    shopName: string;
    route: string[];
    amountMin: string;
    amountMax: string;
    deliveryStatus: string[];
    paymentStatus: string[];
  }>({
    invoiceNumber: '',
    shopName: '',
    route: [],
    amountMin: '',
    amountMax: '',
    deliveryStatus: [],
    paymentStatus: [],
  });
  const [tripSort, setTripSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  function toggleTripSort(col: string) {
    setTripSort((prev) => {
      if (prev?.column === col) {
        if (prev.direction === 'asc') return { column: col, direction: 'desc' };
        return null;
      }
      return { column: col, direction: 'asc' };
    });
  }

  function clearAllTripColumnFilters() {
    setTripColumnFilters({
      invoiceNumber: '',
      shopName: '',
      route: [],
      amountMin: '',
      amountMax: '',
      deliveryStatus: [],
      paymentStatus: [],
    });
  }

  const activeTripChips = useMemo<ActiveFilterChipItem[]>(() => {
    const chips: ActiveFilterChipItem[] = [];
    if (tripColumnFilters.invoiceNumber) {
      chips.push({
        id: 'tripInvoice',
        label: `Invoice #: ${tripColumnFilters.invoiceNumber}`,
        onRemove: () => setTripColumnFilters((p) => ({ ...p, invoiceNumber: '' })),
      });
    }
    if (tripColumnFilters.shopName) {
      chips.push({
        id: 'tripShop',
        label: `Shop: ${tripColumnFilters.shopName}`,
        onRemove: () => setTripColumnFilters((p) => ({ ...p, shopName: '' })),
      });
    }
    if (tripColumnFilters.route.length > 0) {
      chips.push({
        id: 'tripRoute',
        label: `Route: ${tripColumnFilters.route.join(', ')}`,
        onRemove: () => setTripColumnFilters((p) => ({ ...p, route: [] })),
      });
    }
    if (tripColumnFilters.amountMin || tripColumnFilters.amountMax) {
      chips.push({
        id: 'tripAmount',
        label: `Amount: ₹${tripColumnFilters.amountMin || '0'} - ₹${tripColumnFilters.amountMax || '...'}`,
        onRemove: () => setTripColumnFilters((p) => ({ ...p, amountMin: '', amountMax: '' })),
      });
    }
    if (tripColumnFilters.deliveryStatus.length > 0) {
      chips.push({
        id: 'tripDelivery',
        label: `Delivery: ${tripColumnFilters.deliveryStatus.join(', ')}`,
        onRemove: () => setTripColumnFilters((p) => ({ ...p, deliveryStatus: [] })),
      });
    }
    if (tripColumnFilters.paymentStatus.length > 0) {
      chips.push({
        id: 'tripPayment',
        label: `Payment: ${tripColumnFilters.paymentStatus.join(', ')}`,
        onRemove: () => setTripColumnFilters((p) => ({ ...p, paymentStatus: [] })),
      });
    }
    return chips;
  }, [tripColumnFilters]);

  const filteredPendingPool = useMemo(() => {
    const q = debouncedTripSearch.trim().toLowerCase();
    const selectedRoutes = new Set([
      ...tripRouteFilters.map((x) => x.toLowerCase()),
      ...tripColumnFilters.route.map((x) => x.toLowerCase()),
    ]);
    const selectedDeliveryStatuses = new Set([
      ...tripDeliveryFilters.map((x) => x.toLowerCase()),
      ...tripColumnFilters.deliveryStatus.map((x) => x.toLowerCase()),
    ]);
    const selectedPaymentStatuses = new Set([
      ...tripPaymentFilters.map((x) => x.toLowerCase()),
      ...tripColumnFilters.paymentStatus.map((x) => x.toLowerCase()),
    ]);

    let rows = pendingPool.filter((row) => {
      const bySearch = !q || row.invoiceNumber.toLowerCase().includes(q) || row.shopName.toLowerCase().includes(q);
      const byColInv = !tripColumnFilters.invoiceNumber || row.invoiceNumber.toLowerCase().includes(tripColumnFilters.invoiceNumber.toLowerCase());
      const byColShop = !tripColumnFilters.shopName || row.shopName.toLowerCase().includes(tripColumnFilters.shopName.toLowerCase());

      const routeValue = String(row.route || '').trim().toLowerCase();
      const deliveryStatusValue = normalizeTripDeliveryStatus(row.deliveryStatus);
      const paymentStatusValue = normalizeTripPaymentStatus(row.paymentStatus);
      const byRoute = selectedRoutes.size === 0 || selectedRoutes.has(routeValue);
      const byDelivery = selectedDeliveryStatuses.size === 0 || selectedDeliveryStatuses.has(deliveryStatusValue);
      const byPayment = selectedPaymentStatuses.size === 0 || selectedPaymentStatuses.has(paymentStatusValue);

      const byAmountMin = !tripColumnFilters.amountMin || Number(row.totalAmount || 0) >= Number(tripColumnFilters.amountMin);
      const byAmountMax = !tripColumnFilters.amountMax || Number(row.totalAmount || 0) <= Number(tripColumnFilters.amountMax);

      return bySearch && byColInv && byColShop && byRoute && byDelivery && byPayment && byAmountMin && byAmountMax;
    });

    if (tripSort) {
      rows = [...rows].sort((a, b) => {
        let vA = (a as any)[tripSort.column] ?? '';
        let vB = (b as any)[tripSort.column] ?? '';
        if (typeof vA === 'string') vA = vA.toLowerCase();
        if (typeof vB === 'string') vB = vB.toLowerCase();
        if (vA < vB) return tripSort.direction === 'asc' ? -1 : 1;
        if (vA > vB) return tripSort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }, [pendingPool, debouncedTripSearch, tripRouteFilters, tripDeliveryFilters, tripPaymentFilters, tripColumnFilters, tripSort]);

  const [chequeColumnFilters, setChequeColumnFilters] = useState<{
    chequeNumber: string;
    invoiceNumber: string;
    bankName: string;
    dateFrom: string;
    dateTo: string;
    amountMin: string;
    amountMax: string;
    status: string[];
  }>({
    chequeNumber: '',
    invoiceNumber: '',
    bankName: '',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    status: [],
  });
  const [chequeSort, setChequeSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  function toggleChequeSort(col: string) {
    setChequeSort((prev) => {
      if (prev?.column === col) {
        if (prev.direction === 'asc') return { column: col, direction: 'desc' };
        return null;
      }
      return { column: col, direction: 'asc' };
    });
  }

  function clearAllChequeColumnFilters() {
    setChequeColumnFilters({
      chequeNumber: '',
      invoiceNumber: '',
      bankName: '',
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      status: [],
    });
    setChequeFilters((p) => ({ ...p, status: '' }));
  }

  const activeChequeChips = useMemo<ActiveFilterChipItem[]>(() => {
    const chips: ActiveFilterChipItem[] = [];
    if (chequeColumnFilters.chequeNumber) {
      chips.push({
        id: 'chequeNum',
        label: `Cheque #: ${chequeColumnFilters.chequeNumber}`,
        onRemove: () => setChequeColumnFilters((p) => ({ ...p, chequeNumber: '' })),
      });
    }
    if (chequeColumnFilters.invoiceNumber) {
      chips.push({
        id: 'invoiceNum',
        label: `Invoice #: ${chequeColumnFilters.invoiceNumber}`,
        onRemove: () => setChequeColumnFilters((p) => ({ ...p, invoiceNumber: '' })),
      });
    }
    if (chequeColumnFilters.bankName) {
      chips.push({
        id: 'bankName',
        label: `Bank: ${chequeColumnFilters.bankName}`,
        onRemove: () => setChequeColumnFilters((p) => ({ ...p, bankName: '' })),
      });
    }
    if (chequeColumnFilters.dateFrom || chequeColumnFilters.dateTo) {
      chips.push({
        id: 'chequeDate',
        label: `Date: ${chequeColumnFilters.dateFrom || '...'} to ${chequeColumnFilters.dateTo || '...'}`,
        onRemove: () => setChequeColumnFilters((p) => ({ ...p, dateFrom: '', dateTo: '' })),
      });
    }
    if (chequeColumnFilters.amountMin || chequeColumnFilters.amountMax) {
      chips.push({
        id: 'chequeAmount',
        label: `Amount: ₹${chequeColumnFilters.amountMin || '0'} - ₹${chequeColumnFilters.amountMax || '...'}`,
        onRemove: () => setChequeColumnFilters((p) => ({ ...p, amountMin: '', amountMax: '' })),
      });
    }
    if (chequeColumnFilters.status.length > 0) {
      chips.push({
        id: 'chequeStatus',
        label: `Lifecycle: ${chequeColumnFilters.status.join(', ')}`,
        onRemove: () => setChequeColumnFilters((p) => ({ ...p, status: [] })),
      });
    }
    return chips;
  }, [chequeColumnFilters]);

  const filteredCheques = useMemo(() => {
    let list = cheques.filter((c) => {
      if (chequeColumnFilters.chequeNumber && !c.chequeNumber.toLowerCase().includes(chequeColumnFilters.chequeNumber.toLowerCase())) {
        return false;
      }
      if (chequeColumnFilters.invoiceNumber && !c.invoiceNumber.toLowerCase().includes(chequeColumnFilters.invoiceNumber.toLowerCase())) {
        return false;
      }
      if (chequeColumnFilters.bankName && !c.bankName.toLowerCase().includes(chequeColumnFilters.bankName.toLowerCase())) {
        return false;
      }
      if (chequeColumnFilters.dateFrom && new Date(c.date) < new Date(chequeColumnFilters.dateFrom)) {
        return false;
      }
      if (chequeColumnFilters.dateTo && new Date(c.date) > new Date(chequeColumnFilters.dateTo + 'T23:59:59')) {
        return false;
      }
      if (chequeColumnFilters.amountMin && Number(c.amount) < Number(chequeColumnFilters.amountMin)) {
        return false;
      }
      if (chequeColumnFilters.amountMax && Number(c.amount) > Number(chequeColumnFilters.amountMax)) {
        return false;
      }
      if (chequeColumnFilters.status.length && !chequeColumnFilters.status.map((s) => s.toLowerCase()).includes(c.status.toLowerCase())) {
        return false;
      }
      return true;
    });

    if (chequeSort) {
      list = [...list].sort((a, b) => {
        let vA = (a as any)[chequeSort.column] ?? '';
        let vB = (b as any)[chequeSort.column] ?? '';
        if (typeof vA === 'string') vA = vA.toLowerCase();
        if (typeof vB === 'string') vB = vB.toLowerCase();
        if (vA < vB) return chequeSort.direction === 'asc' ? -1 : 1;
        if (vA > vB) return chequeSort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [cheques, chequeColumnFilters, chequeSort]);

  const [expenseColumnFilters, setExpenseColumnFilters] = useState<{
    dateFrom: string;
    dateTo: string;
    amountMin: string;
    amountMax: string;
    category: string[];
    addedBy: string;
    notes: string;
    status: string[];
  }>({
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    category: [],
    addedBy: '',
    notes: '',
    status: [],
  });
  const [expenseSort, setExpenseSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  function toggleExpenseSort(col: string) {
    setExpenseSort((prev) => {
      if (prev?.column === col) {
        if (prev.direction === 'asc') return { column: col, direction: 'desc' };
        return null;
      }
      return { column: col, direction: 'asc' };
    });
  }

  function clearAllExpenseColumnFilters() {
    setExpenseColumnFilters({
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      category: [],
      addedBy: '',
      notes: '',
      status: [],
    });
  }

  const availableExpenseCategories = useMemo(() => {
    const set = new Set(expenses.map((e) => e.category).filter(Boolean));
    if (!set.size) return ['Fuel', 'Maintenance', 'Food', 'Toll', 'Driver Allowance', 'Other'];
    return Array.from(set);
  }, [expenses]);

  const activeExpenseChips = useMemo<ActiveFilterChipItem[]>(() => {
    const chips: ActiveFilterChipItem[] = [];
    if (expenseColumnFilters.dateFrom || expenseColumnFilters.dateTo) {
      chips.push({
        id: 'expenseDate',
        label: `Date: ${expenseColumnFilters.dateFrom || '...'} to ${expenseColumnFilters.dateTo || '...'}`,
        onRemove: () => setExpenseColumnFilters((p) => ({ ...p, dateFrom: '', dateTo: '' })),
      });
    }
    if (expenseColumnFilters.amountMin || expenseColumnFilters.amountMax) {
      chips.push({
        id: 'expenseAmount',
        label: `Amount: ₹${expenseColumnFilters.amountMin || '0'} - ₹${expenseColumnFilters.amountMax || '...'}`,
        onRemove: () => setExpenseColumnFilters((p) => ({ ...p, amountMin: '', amountMax: '' })),
      });
    }
    if (expenseColumnFilters.category.length > 0) {
      chips.push({
        id: 'expenseCategory',
        label: `Category: ${expenseColumnFilters.category.join(', ')}`,
        onRemove: () => setExpenseColumnFilters((p) => ({ ...p, category: [] })),
      });
    }
    if (expenseColumnFilters.addedBy) {
      chips.push({
        id: 'expenseAddedBy',
        label: `Logged By: ${expenseColumnFilters.addedBy}`,
        onRemove: () => setExpenseColumnFilters((p) => ({ ...p, addedBy: '' })),
      });
    }
    if (expenseColumnFilters.notes) {
      chips.push({
        id: 'expenseNotes',
        label: `Notes: ${expenseColumnFilters.notes}`,
        onRemove: () => setExpenseColumnFilters((p) => ({ ...p, notes: '' })),
      });
    }
    if (expenseColumnFilters.status.length > 0) {
      chips.push({
        id: 'expenseStatus',
        label: `Status: ${expenseColumnFilters.status.join(', ')}`,
        onRemove: () => setExpenseColumnFilters((p) => ({ ...p, status: [] })),
      });
    }
    return chips;
  }, [expenseColumnFilters]);

  const filteredExpenses = useMemo(() => {
    let list = expenses.filter((e) => {
      if (expenseColumnFilters.dateFrom && new Date(e.date) < new Date(expenseColumnFilters.dateFrom)) {
        return false;
      }
      if (expenseColumnFilters.dateTo && new Date(e.date) > new Date(expenseColumnFilters.dateTo + 'T23:59:59')) {
        return false;
      }
      if (expenseColumnFilters.amountMin && Number(e.amount) < Number(expenseColumnFilters.amountMin)) {
        return false;
      }
      if (expenseColumnFilters.amountMax && Number(e.amount) > Number(expenseColumnFilters.amountMax)) {
        return false;
      }
      if (expenseColumnFilters.category.length && !expenseColumnFilters.category.map((c) => c.toLowerCase()).includes(e.category.toLowerCase())) {
        return false;
      }
      if (expenseColumnFilters.addedBy && !e.addedBy.toLowerCase().includes(expenseColumnFilters.addedBy.toLowerCase())) {
        return false;
      }
      if (expenseColumnFilters.notes && !String(e.notes || '').toLowerCase().includes(expenseColumnFilters.notes.toLowerCase())) {
        return false;
      }
      return true;
    });

    if (expenseSort) {
      list = [...list].sort((a, b) => {
        let vA = (a as any)[expenseSort.column] ?? '';
        let vB = (b as any)[expenseSort.column] ?? '';
        if (typeof vA === 'string') vA = vA.toLowerCase();
        if (typeof vB === 'string') vB = vB.toLowerCase();
        if (vA < vB) return expenseSort.direction === 'asc' ? -1 : 1;
        if (vA > vB) return expenseSort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [expenses, expenseColumnFilters, expenseSort]);

  const [approvalColumnFilters, setApprovalColumnFilters] = useState<{
    shopName: string;
    invoiceNumber: string;
    actualMin: string;
    actualMax: string;
    receivedMin: string;
    receivedMax: string;
    mode: string[];
    deductionsMin: string;
    deductionsMax: string;
  }>({
    shopName: '',
    invoiceNumber: '',
    actualMin: '',
    actualMax: '',
    receivedMin: '',
    receivedMax: '',
    mode: [],
    deductionsMin: '',
    deductionsMax: '',
  });
  const [approvalSort, setApprovalSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  function toggleApprovalSort(col: string) {
    setApprovalSort((prev) => {
      if (prev?.column === col) {
        if (prev.direction === 'asc') return { column: col, direction: 'desc' };
        return null;
      }
      return { column: col, direction: 'asc' };
    });
  }

  function clearAllApprovalColumnFilters() {
    setApprovalColumnFilters({
      shopName: '',
      invoiceNumber: '',
      actualMin: '',
      actualMax: '',
      receivedMin: '',
      receivedMax: '',
      mode: [],
      deductionsMin: '',
      deductionsMax: '',
    });
  }

  const activeApprovalChips = useMemo<ActiveFilterChipItem[]>(() => {
    const chips: ActiveFilterChipItem[] = [];
    if (approvalColumnFilters.shopName) {
      chips.push({
        id: 'approvalShop',
        label: `Shop: ${approvalColumnFilters.shopName}`,
        onRemove: () => setApprovalColumnFilters((p) => ({ ...p, shopName: '' })),
      });
    }
    if (approvalColumnFilters.invoiceNumber) {
      chips.push({
        id: 'approvalInvoice',
        label: `Invoice #: ${approvalColumnFilters.invoiceNumber}`,
        onRemove: () => setApprovalColumnFilters((p) => ({ ...p, invoiceNumber: '' })),
      });
    }
    if (approvalColumnFilters.actualMin || approvalColumnFilters.actualMax) {
      chips.push({
        id: 'approvalActual',
        label: `Actual: ₹${approvalColumnFilters.actualMin || '0'} - ₹${approvalColumnFilters.actualMax || '...'}`,
        onRemove: () => setApprovalColumnFilters((p) => ({ ...p, actualMin: '', actualMax: '' })),
      });
    }
    if (approvalColumnFilters.receivedMin || approvalColumnFilters.receivedMax) {
      chips.push({
        id: 'approvalReceived',
        label: `Received: ₹${approvalColumnFilters.receivedMin || '0'} - ₹${approvalColumnFilters.receivedMax || '...'}`,
        onRemove: () => setApprovalColumnFilters((p) => ({ ...p, receivedMin: '', receivedMax: '' })),
      });
    }
    if (approvalColumnFilters.mode.length > 0) {
      chips.push({
        id: 'approvalMode',
        label: `Mode: ${approvalColumnFilters.mode.join(', ')}`,
        onRemove: () => setApprovalColumnFilters((p) => ({ ...p, mode: [] })),
      });
    }
    if (approvalColumnFilters.deductionsMin || approvalColumnFilters.deductionsMax) {
      chips.push({
        id: 'approvalDeductions',
        label: `Deductions: ₹${approvalColumnFilters.deductionsMin || '0'} - ₹${approvalColumnFilters.deductionsMax || '...'}`,
        onRemove: () => setApprovalColumnFilters((p) => ({ ...p, deductionsMin: '', deductionsMax: '' })),
      });
    }
    return chips;
  }, [approvalColumnFilters]);

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

  const filteredGroupedPaymentApprovals = useMemo(() => {
    return groupedPaymentApprovals
      .map((group) => {
        let filteredRows = group.rows.filter((row) => {
          const payload = row.payload || {};
          if (approvalColumnFilters.shopName && !String(payload.shopName || '').toLowerCase().includes(approvalColumnFilters.shopName.toLowerCase())) {
            return false;
          }
          if (approvalColumnFilters.invoiceNumber && !String(payload.invoiceNumber || '').toLowerCase().includes(approvalColumnFilters.invoiceNumber.toLowerCase())) {
            return false;
          }
          if (approvalColumnFilters.actualMin && Number(payload.totalAmount || 0) < Number(approvalColumnFilters.actualMin)) {
            return false;
          }
          if (approvalColumnFilters.actualMax && Number(payload.totalAmount || 0) > Number(approvalColumnFilters.actualMax)) {
            return false;
          }
          if (approvalColumnFilters.receivedMin && Number(payload.amount || 0) < Number(approvalColumnFilters.receivedMin)) {
            return false;
          }
          if (approvalColumnFilters.receivedMax && Number(payload.amount || 0) > Number(approvalColumnFilters.receivedMax)) {
            return false;
          }
          if (approvalColumnFilters.mode.length > 0 && !approvalColumnFilters.mode.map((m) => m.toLowerCase()).includes(String(payload.mode || '').toLowerCase())) {
            return false;
          }
          if (approvalColumnFilters.deductionsMin && Number(payload.deductedAmount || 0) < Number(approvalColumnFilters.deductionsMin)) {
            return false;
          }
          if (approvalColumnFilters.deductionsMax && Number(payload.deductedAmount || 0) > Number(approvalColumnFilters.deductionsMax)) {
            return false;
          }
          return true;
        });

        if (approvalSort) {
          filteredRows = [...filteredRows].sort((a, b) => {
            let vA = (a.payload as any)?.[approvalSort.column] ?? '';
            let vB = (b.payload as any)?.[approvalSort.column] ?? '';
            if (typeof vA === 'string') vA = vA.toLowerCase();
            if (typeof vB === 'string') vB = vB.toLowerCase();
            if (vA < vB) return approvalSort.direction === 'asc' ? -1 : 1;
            if (vA > vB) return approvalSort.direction === 'asc' ? 1 : -1;
            return 0;
          });
        }

        return {
          ...group,
          rows: filteredRows,
        };
      })
      .filter((group) => group.rows.length > 0);
  }, [groupedPaymentApprovals, approvalColumnFilters, approvalSort]);

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
      setApiError(e instanceof Error ? e.message : 'Failed to synchronize console data');
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
    setImportMessage('Reading and validating Excel data...');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/import/preview', { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportMessage(json.error || 'Import validation failed');
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

      setImportMessage('Data import committed successfully.');
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

  const pendingApprovalsCount = paymentApprovals.length + expenseApprovals.length;
  const pendingChequesCount = cheques.filter((c) => c.status === 'pending').length;
  const tripsCount = tripSheets.length;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-transparent font-sans text-slate-100">
      {/* Desktop Fixed Professional Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-white/[0.06] bg-white/[0.03] text-white/80 z-30 select-none backdrop-blur-[24px] shadow-panel">
        <SidebarNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingApprovalsCount={pendingApprovalsCount}
          pendingChequesCount={pendingChequesCount}
          invoicesCount={invoiceTotal}
          tripsCount={tripsCount}
          refreshAll={refreshAll}
          pageLoading={pageLoading}
          logout={logout}
          onOpenTheme={(el) => {
            setThemeAnchorEl(el);
            setThemeOpen((prev) => !prev);
          }}
        />
      </aside>

      {/* Mobile Sidebar Overlay & Drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-[#0b1020]/95 border-r border-white/[0.06] shadow-2xl backdrop-blur-2xl lg:hidden"
            >
              <SidebarNav
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onCloseMobile={() => setMobileNavOpen(false)}
                pendingApprovalsCount={pendingApprovalsCount}
                pendingChequesCount={pendingChequesCount}
                invoicesCount={invoiceTotal}
                tripsCount={tripsCount}
                refreshAll={refreshAll}
                pageLoading={pageLoading}
                logout={logout}
                onOpenTheme={(el) => {
                  setThemeAnchorEl(el);
                  setThemeOpen((prev) => !prev);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Modern Top Header Bar */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] bg-white/[0.03] px-4 sm:px-6 lg:px-8 backdrop-blur-[24px] shadow-panel">
          {/* Left: Mobile Toggle + Breadcrumb + Firm Selector */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="glass-btn flex h-9 w-9 items-center justify-center rounded-xl text-white/80 transition hover:text-white lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] font-medium tracking-[0.08em] text-white/40 sm:inline uppercase">
                CONSOLE
              </span>
              <span className="hidden text-white/30 sm:inline">/</span>
              <h1 className="text-sm sm:text-base font-medium tracking-tight text-white/92 truncate">
                {pageTitle}
              </h1>
            </div>

            {/* Global Firm / CmpCode Selector Pill */}
            {availableCmpCodes.length > 0 && (
              <div className="hidden items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs backdrop-blur-md md:flex">
                <span className="text-[10px] font-medium tracking-[0.08em] text-white/40 uppercase">FIRM:</span>
                <select
                  value={selectedCmpCode}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSelectedCmpCode(next);
                    loadSummary(next).catch((err) => setApiError(err instanceof Error ? err.message : 'Failed to load dashboard'));
                  }}
                  className="border-none bg-transparent p-0 text-xs font-medium text-white/90 focus:ring-0 focus:outline-none cursor-pointer"
                >
                  <option value="" className="bg-[#0f172a] text-white">All CmpCodes</option>
                  {availableCmpCodes.map((code) => (
                    <option key={code} value={code} className="bg-[#0f172a] text-white">{code}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right: Quick actions, Live Sync, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {activeTab === 'invoices' && (
              <button
                onClick={resetInvoiceFilters}
                disabled={!hasInvoiceFilters}
                className="glass-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-normal text-white/80 disabled:opacity-40"
              >
                <FilterX className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span className="hidden sm:inline">Reset Filters</span>
              </button>
            )}

            <button
              onClick={refreshAll}
              disabled={pageLoading}
              title="Synchronize all console datasets"
              className="glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/85 shadow-sm active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${pageLoading ? 'animate-spin text-indigo-400' : 'text-white/50'}`} strokeWidth={1.5} />
              <span className="hidden sm:inline">{pageLoading ? 'Syncing...' : 'Sync Console'}</span>
            </button>

            <button
              onClick={(e) => {
                setThemeAnchorEl(e.currentTarget);
                setThemeOpen((prev) => !prev);
              }}
              title="Theme Settings"
              aria-label="Theme Settings"
              className="glass-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white/85 hover:text-white shadow-sm active:scale-[0.98]"
            >
              <Palette className="h-4 w-4" strokeWidth={1.5} />
              <span className="hidden xl:inline">Theme</span>
            </button>

            <div className="hidden h-5 w-[1px] bg-white/[0.08] sm:block" />

            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-white/80 backdrop-blur-md">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-indigo-400/30 bg-indigo-500/25 text-[10px] font-medium text-white shadow-sm">
                AD
              </div>
              <span className="hidden font-medium text-white/92 sm:inline">Admin</span>
              <span className="hidden text-[10px] font-normal text-white/40 md:inline">(Ops Root)</span>
            </div>
          </div>
        </header>

        {/* Scrollable Content Workspace */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6 max-w-[1680px] w-full mx-auto">
          {/* Global Alert Notification */}
          {apiError ? (
            <div className="flex items-center justify-between rounded-xl border border-rose-400/25 bg-rose-500/12 px-4 py-3 text-xs sm:text-sm text-rose-300 shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" strokeWidth={1.5} />
                <span>{apiError}</span>
              </div>
              <button
                onClick={() => setApiError('')}
                className="rounded-lg p-1 text-rose-400 hover:bg-rose-500/20 hover:text-rose-200"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ) : null}

          {/* TAB 1: DASHBOARD */}
          {(pageLoading || summaryLoading) && activeTab === 'dashboard' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="card h-28 animate-pulse bg-white/[0.04]" />
              ))}
            </div>
          ) : null}

          {!pageLoading && !summaryLoading && activeTab === 'dashboard' && summary ? (
            <div className="space-y-6">
              {/* Primary Financial & Operational Metrics */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard
                  label="Total Invoices"
                  value={String(summary.totalInvoices)}
                  icon={Receipt}
                  variant="default"
                  subtext="Registered invoice count"
                />
                <StatCard
                  label="Fully Paid"
                  value={String(summary.paid)}
                  icon={CheckCircle2}
                  variant="success"
                  subtext="Cleared invoices"
                />
                <StatCard
                  label="Gross Revenue"
                  value={formatMoney(summary.revenue)}
                  icon={TrendingUp}
                  variant="info"
                  subtext="Total collected funds"
                />
                <StatCard
                  label="Operational Expenses"
                  value={formatMoney(summary.expenses)}
                  icon={TrendingDown}
                  variant="danger"
                  subtext="Logged fleet costs"
                />
                <StatCard
                  label="Net Balance"
                  value={formatMoney(summary.net)}
                  icon={BarChart3}
                  variant="success"
                  subtext="Net operational cash"
                />
                <StatCard
                  label="Pending Clearance"
                  value={formatMoney(summary.pendingCollections)}
                  icon={AlertTriangle}
                  variant="warning"
                  subtext="Uncollected balance"
                />
              </div>

              {/* Driver Performance & Problem Zone Diagnostic Panels */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Driver Performance Ranking */}
                <div className="card rounded-[20px] p-5">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div>
                      <h3 className="text-[15px] font-medium text-white/92">Delivery Fleet Performance</h3>
                      <p className="text-xs font-normal text-white/55">Dispatch fulfillment rates across active drivers</p>
                    </div>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-white/70">
                      Top {summary.driverPerformance.slice(0, 8).length} Drivers
                    </span>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {summary.driverPerformance.slice(0, 8).map((d) => (
                      <div
                        key={d.name}
                        className="glass-row flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 text-xs transition hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.06] text-[11px] font-medium text-white/90">
                            {d.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-white/90 truncate">{d.name}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="hidden sm:block w-28 bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                d.efficiency >= 80 ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]' : d.efficiency >= 50 ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]' : 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.4)]'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, d.efficiency))}%` }}
                            />
                          </div>
                          <span className="num-tabular font-normal text-white/60">
                            {d.delivered} / {d.assigned}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium num-tabular ${
                              d.efficiency >= 80
                                ? 'border border-emerald-400/25 bg-emerald-400/12 text-emerald-300'
                                : d.efficiency >= 50
                                ? 'border border-amber-400/25 bg-amber-400/12 text-amber-300'
                                : 'border border-rose-400/25 bg-rose-400/12 text-rose-300'
                            }`}
                          >
                            {d.efficiency}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {!summary.driverPerformance.length && (
                      <p className="py-4 text-center text-xs text-white/40">No driver activity logged yet.</p>
                    )}
                  </div>
                </div>

                {/* Operational Diagnostics & Health Zone */}
                <div className="card rounded-[20px] p-5">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div>
                      <h3 className="text-[15px] font-medium text-white/92">Operational Health Diagnostics</h3>
                      <p className="text-xs font-normal text-white/55">Automated system checks on pending invoices and costs</p>
                    </div>
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/12 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                      System Healthy
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="glass-row flex items-center justify-between p-3.5 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${summary.problemZone.highPendingInvoices ? 'border border-rose-400/25 bg-rose-400/12 text-rose-300' : 'border border-emerald-400/25 bg-emerald-400/12 text-emerald-300'}`}>
                          {summary.problemZone.highPendingInvoices ? <AlertTriangle className="h-4 w-4" strokeWidth={1.5} /> : <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />}
                        </div>
                        <div>
                          <p className="font-medium text-white/90">Pending Invoice Ratio</p>
                          <p className="text-[11px] font-normal text-white/50">Clearance status across open invoices</p>
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${summary.problemZone.highPendingInvoices ? 'border-rose-400/25 bg-rose-400/12 text-rose-300' : 'border-emerald-400/25 bg-emerald-400/12 text-emerald-300'}`}>
                        {summary.problemZone.highPendingInvoices ? 'High Backlog' : 'Nominal'}
                      </span>
                    </div>

                    <div className="glass-row flex items-center justify-between p-3.5 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${summary.problemZone.lowPerformingDrivers.length > 0 ? 'border border-amber-400/25 bg-amber-400/12 text-amber-300' : 'border border-emerald-400/25 bg-emerald-400/12 text-emerald-300'}`}>
                          {summary.problemZone.lowPerformingDrivers.length > 0 ? <AlertCircle className="h-4 w-4" strokeWidth={1.5} /> : <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />}
                        </div>
                        <div>
                          <p className="font-medium text-white/90">Driver Efficiency Thresholds</p>
                          <p className="text-[11px] font-normal text-white/50">Drivers below 50% fulfillment</p>
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${summary.problemZone.lowPerformingDrivers.length > 0 ? 'border-amber-400/25 bg-amber-400/12 text-amber-300' : 'border-emerald-400/25 bg-emerald-400/12 text-emerald-300'}`}>
                        {summary.problemZone.lowPerformingDrivers.length > 0 ? `${summary.problemZone.lowPerformingDrivers.length} Flagged` : 'All Optimal'}
                      </span>
                    </div>

                    <div className="glass-row flex items-center justify-between p-3.5 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${summary.problemZone.highExpenses ? 'border border-rose-400/25 bg-rose-400/12 text-rose-300' : 'border border-emerald-400/25 bg-emerald-400/12 text-emerald-300'}`}>
                          {summary.problemZone.highExpenses ? <TrendingDown className="h-4 w-4" strokeWidth={1.5} /> : <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />}
                        </div>
                        <div>
                          <p className="font-medium text-white/90">Fleet Expense Tolerance</p>
                          <p className="text-[11px] font-normal text-white/50">Expenditure ratio relative to collections</p>
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${summary.problemZone.highExpenses ? 'border-rose-400/25 bg-rose-400/12 text-rose-300' : 'border-emerald-400/25 bg-emerald-400/12 text-emerald-300'}`}>
                        {summary.problemZone.highExpenses ? 'Elevated Costs' : 'Within Budget'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* TAB 2: INVOICES */}
          {pageLoading && activeTab === 'invoices' ? (
            <div className="space-y-4">
              <CardSkeleton rows={5} />
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

          {/* TAB 3: IMPORT / EXPORT */}
          {pageLoading && activeTab === 'importExport' ? (
            <div className="space-y-4">
              <CardSkeleton rows={4} />
            </div>
          ) : null}

          {!pageLoading && activeTab === 'importExport' ? (
            <div className="space-y-6">
              {/* Import Excel Panel */}
              <div className="card rounded-[20px] p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
                  <div>
                    <h3 className="text-base font-medium text-white/92">Import Invoices from Excel</h3>
                    <p className="mt-1 text-xs font-normal text-white/55">
                      Upload `.xlsx` or `.xls` spreadsheet files to batch create or update invoice records with automatic schema validation.
                    </p>
                  </div>
                  <label className="glass-btn-primary inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-white shadow-sm">
                    <UploadCloud className="h-4 w-4" strokeWidth={1.5} />
                    <span>{importLoading ? 'Validating File...' : 'Choose Spreadsheet'}</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files?.[0] && onImportFile(e.target.files[0])}
                    />
                  </label>
                </div>

                {importMessage && (
                  <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-xs text-white/80 flex items-center gap-2">
                    <Info className="h-4 w-4 text-indigo-400 shrink-0" strokeWidth={1.5} />
                    <span>{importMessage}</span>
                  </div>
                )}

                {/* Import Statistics Result Cards */}
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="glass-row border border-emerald-400/25 p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-emerald-300">New Invoices</p>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
                    </div>
                    <p className="mt-2 text-2xl font-medium num-tabular text-emerald-200">{importStats.inserted}</p>
                    <p className="text-[11px] font-normal text-emerald-400/80 mt-1">Successfully inserted</p>
                  </div>
                  <div className="glass-row border border-amber-400/25 p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-amber-300">Duplicates Reconciled</p>
                      <AlertTriangle className="h-4 w-4 text-amber-400" strokeWidth={1.5} />
                    </div>
                    <p className="mt-2 text-2xl font-medium num-tabular text-amber-200">{importStats.duplicates}</p>
                    <p className="text-[11px] font-normal text-amber-400/80 mt-1">Matched existing records</p>
                  </div>
                  <div className="glass-row border border-rose-400/25 p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-rose-300">Format Errors</p>
                      <XCircle className="h-4 w-4 text-rose-400" strokeWidth={1.5} />
                    </div>
                    <p className="mt-2 text-2xl font-medium num-tabular text-rose-200">{importStats.errors}</p>
                    <p className="text-[11px] font-normal text-rose-400/80 mt-1">Rows with invalid data</p>
                  </div>
                </div>

                {/* Collapsible Error Logs Table */}
                {importErrors.length > 0 && (
                  <div className="mt-5 rounded-[16px] border border-amber-400/25 bg-amber-400/10 p-4 backdrop-blur-md">
                    <button
                      onClick={() => setShowImportErrors((prev) => !prev)}
                      className="flex w-full items-center justify-between text-left text-xs font-medium text-amber-300"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400" strokeWidth={1.5} />
                        <span>Validation Warnings ({importErrors.length} errors found)</span>
                      </div>
                      {showImportErrors ? <ChevronUp className="h-4 w-4" strokeWidth={1.5} /> : <ChevronDown className="h-4 w-4" strokeWidth={1.5} />}
                    </button>
                    {showImportErrors && (
                      <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-amber-400/20 bg-[#0d1326]/90 backdrop-blur-md">
                        <table className="min-w-full text-xs">
                          <thead className="border-b border-amber-400/20 text-amber-200 sticky top-0 bg-[#0d1326]/90">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Row</th>
                              <th className="px-3 py-2 text-left font-medium">Field</th>
                              <th className="px-3 py-2 text-left font-medium">Problem Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importErrors.map((err, index) => (
                              <tr key={`${err.rowNumber}-${err.field}-${index}`} className="border-t border-amber-400/10">
                                <td className="px-3 py-2 num-tabular font-medium text-white/80">{err.rowNumber}</td>
                                <td className="px-3 py-2 font-medium text-white/90">{err.field}</td>
                                <td className="px-3 py-2 text-rose-300">{err.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Export Data Console Panel */}
              <div className="card rounded-[20px] p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
                  <div>
                    <h3 className="text-base font-medium text-white/92">Export Ledger Datasets (.xlsx)</h3>
                    <p className="mt-1 text-xs font-normal text-white/55">
                      Generate filtered multi-tab Excel reports for invoices, payments, tripsheets, cheques, and expenses.
                    </p>
                  </div>
                  <button
                    onClick={() => exportData().catch((e) => setApiError(e instanceof Error ? e.message : 'Export failed'))}
                    disabled={exportLoading}
                    className="glass-btn inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-white/90 shadow-sm disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" strokeWidth={1.5} />
                    <span>{exportLoading ? 'Generating XLSX...' : 'Export Spreadsheet'}</span>
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={exportFilters.dateFrom}
                      onChange={(e) => setExportFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                      className="glass-input w-full px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={exportFilters.dateTo}
                      onChange={(e) => setExportFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                      className="glass-input w-full px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">
                      Filter by Driver
                    </label>
                    <input
                      value={exportFilters.driver}
                      onChange={(e) => setExportFilters((prev) => ({ ...prev, driver: e.target.value }))}
                      placeholder="e.g. Ramesh"
                      className="glass-input w-full px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">
                      Delivery Status
                    </label>
                    <input
                      value={exportFilters.status}
                      onChange={(e) => setExportFilters((prev) => ({ ...prev, status: e.target.value }))}
                      placeholder="e.g. delivered"
                      className="glass-input w-full px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div className="mt-5 border-t border-white/[0.06] pt-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-2">
                    Included Datasets in Export:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(exportTypes).map((key) => {
                      const isSelected = Boolean(exportTypes[key]);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setExportTypes((prev) => ({
                              ...prev,
                              [key]: !prev[key],
                            }))
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-normal capitalize transition ${
                            isSelected ? 'glass-pill-active' : 'glass-pill'
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${isSelected ? 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-white/30'}`} />
                          {key}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* TAB 4: TRIP SHEETS */}
          {pageLoading && activeTab === 'trips' ? (
            <div className="space-y-4">
              <CardSkeleton rows={4} />
              <CardSkeleton rows={5} />
            </div>
          ) : null}

          {!pageLoading && activeTab === 'trips' ? (
            <div className="space-y-6">
              {/* Delivery Agent Management Header */}
              <div className="card rounded-[20px] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-white/92">Delivery Fleet & Agents</h3>
                    <p className="text-xs font-normal text-white/55">Configure driver accounts and allocate dispatch itineraries</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openAgentCredentialsModal}
                      disabled={!selectedAgentId}
                      className="glass-btn inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white/80 shadow-sm disabled:opacity-40"
                    >
                      <Key className="h-3.5 w-3.5 text-white/50" strokeWidth={1.5} />
                      <span>Update Password</span>
                    </button>
                    <button
                      onClick={() => setShowAgentModal(true)}
                      className="glass-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white shadow-sm"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                      <span>Create Agent</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Trip Sheets Operations Layout */}
              <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                {/* Agent Selector Column */}
                <div className="card rounded-[20px] p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">Select Driver</p>
                    <span className="text-[10px] text-white/50 num-tabular font-normal">{agents.length} active</span>
                  </div>

                  <div className="space-y-1 max-h-[600px] overflow-y-auto">
                    {agents.map((a) => {
                      const isSelected = selectedAgentId === a._id;
                      return (
                        <button
                          key={a._id}
                          onClick={() => setSelectedAgentId(a._id)}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition ${
                            isSelected
                              ? 'border border-indigo-400/35 bg-indigo-500/18 text-white/95 font-medium shadow-sm'
                              : 'text-white/70 hover:bg-white/[0.04] hover:text-white border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-medium ${
                              isSelected ? 'bg-indigo-500/30 border border-indigo-400/40 text-white' : 'border border-white/[0.08] bg-white/[0.06] text-white/80'
                            }`}>
                              {a.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-white/95">{a.name}</p>
                              <p className="truncate text-[10px] text-white/40">@{a.username || 'driver'}</p>
                            </div>
                          </div>
                          {isSelected && <ChevronRight className="h-4 w-4 text-indigo-400" strokeWidth={1.5} />}
                        </button>
                      );
                    })}
                    {!agents.length && <p className="py-4 text-center text-xs text-white/40">No agents registered.</p>}
                  </div>
                </div>

                {/* Right Column: New Dispatch vs Past Trips */}
                <div className="card rounded-[20px] min-w-0 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-medium text-white/92">
                        {selectedAgent ? `${selectedAgent.name} • Trip Management` : 'Select a driver on the left'}
                      </h3>
                      <p className="text-xs font-normal text-white/55">Assign pending invoices or review historical delivery performance</p>
                    </div>
                    <div className="inline-flex rounded-xl border border-white/[0.06] bg-white/[0.025] p-1 text-xs font-normal backdrop-blur-md">
                      <button
                        onClick={() => setTripsSubTab('new')}
                        className={`rounded-lg px-3.5 py-1.5 transition ${
                          tripsSubTab === 'new' ? 'glass-pill-active' : 'text-white/50 hover:text-white'
                        }`}
                      >
                        New Dispatch Itinerary
                      </button>
                      <button
                        onClick={() => setTripsSubTab('past')}
                        className={`rounded-lg px-3.5 py-1.5 transition ${
                          tripsSubTab === 'past' ? 'glass-pill-active' : 'text-white/50 hover:text-white'
                        }`}
                      >
                        Past Dispatches History
                      </button>
                    </div>
                  </div>

                  {tripsSubTab === 'new' ? (
                    <div className="space-y-4">
                      {/* Filter Controls Bar */}
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_auto]">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-white/40" strokeWidth={1.5} />
                          <input
                            value={tripSearch}
                            onChange={(e) => setTripSearch(e.target.value)}
                            placeholder="Filter by invoice # or shop name..."
                            className="glass-input w-full py-2 pr-3 pl-9 text-xs"
                          />
                        </div>
                        <MultiSelectDropdown
                          options={['Delivered', 'Undelivered']}
                          selected={tripDeliveryFilters}
                          onChange={setTripDeliveryFilters}
                          placeholder="All Deliveries"
                        />
                        <MultiSelectDropdown
                          options={availableRoutes}
                          selected={tripRouteFilters}
                          onChange={setTripRouteFilters}
                          placeholder="All Routes"
                        />
                        {hasTripSelectionFilters && (
                          <button
                            onClick={clearTripSelectionFilters}
                            className="glass-btn px-3 py-2 text-xs font-normal text-white/70"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      {/* Quick Bulk Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-white/[0.06] py-2.5 text-xs text-white/60">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => selectVisibleTrips(true)}
                            className="glass-btn px-2.5 py-1 text-xs font-normal text-white/80"
                          >
                            Select All Visible ({filteredPendingPool.length})
                          </button>
                          <button
                            onClick={() => selectVisibleTrips(false)}
                            className="glass-btn px-2.5 py-1 text-xs font-normal text-white/80"
                          >
                            Deselect All
                          </button>
                          <button
                            onClick={addPendingInvoicesForSelectedShops}
                            className="glass-btn px-2.5 py-1 text-xs font-normal text-white/80"
                          >
                            Include Same Shops
                          </button>
                        </div>
                        <span className="font-medium text-indigo-300 num-tabular">
                          {tripSelected.length} invoices selected
                        </span>
                      </div>

                      {/* Active Filter Chips */}
                      <ActiveFilterChips chips={activeTripChips} onClearAll={clearAllTripColumnFilters} />

                      {/* Pending Pool Table */}
                      <div className="table-wrapper max-h-96 rounded-xl border border-white/[0.06]">
                        <table className="min-w-full text-xs">
                          <thead className="bg-white/[0.06] backdrop-blur-md sticky top-0 text-white/50 font-medium border-b border-white/[0.06] z-10">
                            <tr>
                              <th className="px-3 py-2.5 text-left w-10">
                                <input
                                  type="checkbox"
                                  checked={filteredPendingPool.length > 0 && tripSelected.length >= filteredPendingPool.length}
                                  onChange={(e) => selectVisibleTrips(e.target.checked)}
                                  className="rounded border-white/20 bg-white/10 text-indigo-500"
                                />
                              </th>
                              <th className="px-3 py-2.5 text-left">
                                <ColumnFilterHeader
                                  label="Invoice #"
                                  filterType="text"
                                  filterValue={tripColumnFilters.invoiceNumber}
                                  isFiltered={Boolean(tripColumnFilters.invoiceNumber)}
                                  onApplyFilter={(v) => setTripColumnFilters((p) => ({ ...p, invoiceNumber: String(v || '') }))}
                                  onClearFilter={() => setTripColumnFilters((p) => ({ ...p, invoiceNumber: '' }))}
                                  sortState={tripSort?.column === 'invoiceNumber' ? tripSort.direction : false}
                                  onSort={() => toggleTripSort('invoiceNumber')}
                                />
                              </th>
                              <th className="px-3 py-2.5 text-left">
                                <ColumnFilterHeader
                                  label="Shop Name"
                                  filterType="text"
                                  filterValue={tripColumnFilters.shopName}
                                  isFiltered={Boolean(tripColumnFilters.shopName)}
                                  onApplyFilter={(v) => setTripColumnFilters((p) => ({ ...p, shopName: String(v || '') }))}
                                  onClearFilter={() => setTripColumnFilters((p) => ({ ...p, shopName: '' }))}
                                  sortState={tripSort?.column === 'shopName' ? tripSort.direction : false}
                                  onSort={() => toggleTripSort('shopName')}
                                />
                              </th>
                              <th className="px-3 py-2.5 text-left">
                                <ColumnFilterHeader
                                  label="Route"
                                  filterType="enum"
                                  enumOptions={availableRoutes}
                                  filterValue={tripColumnFilters.route}
                                  isFiltered={tripColumnFilters.route.length > 0}
                                  onApplyFilter={(v) => setTripColumnFilters((p) => ({ ...p, route: Array.isArray(v) ? v : [] }))}
                                  onClearFilter={() => setTripColumnFilters((p) => ({ ...p, route: [] }))}
                                  sortState={tripSort?.column === 'route' ? tripSort.direction : false}
                                  onSort={() => toggleTripSort('route')}
                                />
                              </th>
                              <th className="px-3 py-2.5 text-left">
                                <ColumnFilterHeader
                                  label="Amount"
                                  filterType="amount"
                                  filterValue={{ min: tripColumnFilters.amountMin, max: tripColumnFilters.amountMax }}
                                  isFiltered={Boolean(tripColumnFilters.amountMin || tripColumnFilters.amountMax)}
                                  onApplyFilter={(v) => setTripColumnFilters((p) => ({ ...p, amountMin: v?.min || '', amountMax: v?.max || '' }))}
                                  onClearFilter={() => setTripColumnFilters((p) => ({ ...p, amountMin: '', amountMax: '' }))}
                                  sortState={tripSort?.column === 'totalAmount' ? tripSort.direction : false}
                                  onSort={() => toggleTripSort('totalAmount')}
                                />
                              </th>
                              <th className="px-3 py-2.5 text-left">
                                <ColumnFilterHeader
                                  label="Delivery"
                                  filterType="enum"
                                  enumOptions={['Delivered', 'Pending']}
                                  filterValue={tripColumnFilters.deliveryStatus}
                                  isFiltered={tripColumnFilters.deliveryStatus.length > 0}
                                  onApplyFilter={(v) => setTripColumnFilters((p) => ({ ...p, deliveryStatus: Array.isArray(v) ? v : [] }))}
                                  onClearFilter={() => setTripColumnFilters((p) => ({ ...p, deliveryStatus: [] }))}
                                  sortState={tripSort?.column === 'deliveryStatus' ? tripSort.direction : false}
                                  onSort={() => toggleTripSort('deliveryStatus')}
                                />
                              </th>
                              <th className="px-3 py-2.5 text-left">
                                <ColumnFilterHeader
                                  label="Payment"
                                  filterType="enum"
                                  enumOptions={['Paid', 'Partial', 'Unpaid', 'Payable']}
                                  filterValue={tripColumnFilters.paymentStatus}
                                  isFiltered={tripColumnFilters.paymentStatus.length > 0}
                                  onApplyFilter={(v) => setTripColumnFilters((p) => ({ ...p, paymentStatus: Array.isArray(v) ? v : [] }))}
                                  onClearFilter={() => setTripColumnFilters((p) => ({ ...p, paymentStatus: [] }))}
                                  sortState={tripSort?.column === 'paymentStatus' ? tripSort.direction : false}
                                  onSort={() => toggleTripSort('paymentStatus')}
                                />
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {filteredPendingPool.map((row) => {
                              const isChecked = tripSelected.includes(row._id);
                              return (
                                <tr
                                  key={row._id}
                                  onClick={() =>
                                    setTripSelected((prev) =>
                                      isChecked ? prev.filter((id) => id !== row._id) : [...prev, row._id],
                                    )
                                  }
                                  className={`cursor-pointer transition ${isChecked ? 'bg-indigo-500/12' : 'hover:bg-white/[0.04]'}`}
                                >
                                  <td className="px-3 py-2">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                      className="rounded border-white/20 bg-white/10 text-indigo-500"
                                    />
                                  </td>
                                  <td className="px-3 py-2 num-tabular font-medium text-white/92">{row.invoiceNumber}</td>
                                  <td className="px-3 py-2 font-normal text-white/85">{row.shopName}</td>
                                  <td className="px-3 py-2 text-white/50">{row.route || '-'}</td>
                                  <td className="px-3 py-2 font-medium num-tabular text-white/95">{formatMoney(row.totalAmount)}</td>
                                  <td className="px-3 py-2">
                                    <Badge className={tripDeliveryBadgeClass(row.deliveryStatus)}>
                                      {tripDeliveryCode(row.deliveryStatus)}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge className={tripPaymentBadgeClass(row.paymentStatus)}>
                                      {tripPaymentLabel(row.paymentStatus)}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                            {!filteredPendingPool.length && (
                              <tr>
                                <td colSpan={7} className="py-8 text-center text-white/40">
                                  No assignable invoices found matching current filters.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Sticky Dispatch Summary Footer */}
                      {tripSelected.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-indigo-400/25 bg-indigo-500/12 p-4 shadow-sm backdrop-blur-md">
                          <div>
                            <p className="text-xs font-medium text-white/95">
                              Ready to Dispatch: {tripSelected.length} Invoices to {selectedAgent ? selectedAgent.name : 'Selected Driver'}
                            </p>
                            <p className="text-xs text-indigo-200 num-tabular mt-0.5 font-normal">
                              Cumulative Itinerary Amount: {formatMoney(
                                pendingPool
                                  .filter((p) => tripSelected.includes(p._id))
                                  .reduce((sum, p) => sum + Number(p.totalAmount || 0), 0),
                              )}
                            </p>
                          </div>
                          <button
                            onClick={addToSelectedAgent}
                            disabled={!selectedAgentId}
                            className="glass-btn-primary rounded-xl px-5 py-2.5 text-xs font-medium text-white shadow-sm active:scale-[0.99] disabled:opacity-50"
                          >
                            Create Trip Sheet
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Past Trip Sheets */
                    <div className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <input
                          type="date"
                          value={tripFilters.dateFrom}
                          onChange={(e) => setTripFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                          className="glass-input px-3 py-1.5 text-xs"
                        />
                        <input
                          type="date"
                          value={tripFilters.dateTo}
                          onChange={(e) => setTripFilters((p) => ({ ...p, dateTo: e.target.value }))}
                          className="glass-input px-3 py-1.5 text-xs"
                        />
                        <input
                          value={tripFilters.driver}
                          onChange={(e) => setTripFilters((p) => ({ ...p, driver: e.target.value }))}
                          placeholder="Filter driver name"
                          className="glass-input px-3 py-1.5 text-xs"
                        />
                      </div>

                      <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                        {filteredTripHistory.map((t) => (
                          <div key={t._id} className="glass-row p-4 rounded-xl">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.06] text-white/80">
                                  <Truck className="h-4 w-4" strokeWidth={1.5} />
                                </div>
                                <div>
                                  <p className="font-medium text-white/92 text-xs sm:text-sm">{t.agentName}</p>
                                  <p className="text-[11px] text-white/50 num-tabular font-normal">
                                    {t.invoiceCount} orders · {formatMoney(t.totalAmount)} · {formatDateTime(t.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={t.status === 'Complete' ? 'border-emerald-400/25 bg-emerald-400/12 text-emerald-300' : 'border-amber-400/25 bg-amber-400/12 text-amber-300'}>
                                  {t.status}
                                </Badge>
                                <button
                                  onClick={() => runAction(`complete-trip-${t._id}`, async () => completeTripSheet(t._id))}
                                  disabled={t.status === 'Complete' || isActionLoading(`complete-trip-${t._id}`)}
                                  className="glass-btn px-2.5 py-1 text-xs font-normal text-white/80 disabled:opacity-40"
                                >
                                  {t.status === 'Complete' ? 'Completed' : 'Mark Complete'}
                                </button>
                                <button
                                  onClick={() => setExpandedTrip(expandedTrip === t._id ? null : t._id)}
                                  className="glass-btn p-1 text-white/50"
                                >
                                  {expandedTrip === t._id ? <ChevronUp className="h-4 w-4" strokeWidth={1.5} /> : <ChevronDown className="h-4 w-4" strokeWidth={1.5} />}
                                </button>
                              </div>
                            </div>

                            {expandedTrip === t._id && (
                              <div className="mt-3 table-wrapper">
                                <table className="min-w-full text-xs">
                                  <thead className="bg-transparent text-white/50 font-medium border-b border-white/[0.06]">
                                    <tr>
                                      <th className="px-3 py-2 text-left">Invoice #</th>
                                      <th className="px-3 py-2 text-left">Shop Name</th>
                                      <th className="px-3 py-2 text-left">Route</th>
                                      <th className="px-3 py-2 text-left">Amount</th>
                                      <th className="px-3 py-2 text-left">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/[0.06]">
                                    {t.invoices.map((inv) => (
                                      <tr key={inv.invoiceNumber} className="hover:bg-white/[0.04]">
                                        <td className="px-3 py-1.5 num-tabular font-medium text-white/92">{inv.invoiceNumber}</td>
                                        <td className="px-3 py-1.5 text-white/85">{inv.shopName}</td>
                                        <td className="px-3 py-1.5 text-white/50">{inv.route || '-'}</td>
                                        <td className="px-3 py-1.5 font-medium num-tabular text-white/95">{formatMoney(inv.totalAmount)}</td>
                                        <td className="px-3 py-1.5">
                                          <Badge className={statusBadgeClass(inv.deliveryStatus)}>
                                            {inv.deliveryStatus}
                                          </Badge>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ))}
                        {!filteredTripHistory.length && (
                          <p className="py-8 text-center text-xs text-white/40">No past trip sheets match current filters.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* TAB 5: APPROVALS */}
          {pageLoading && activeTab === 'approvals' ? (
            <div className="space-y-4">
              <CardSkeleton rows={5} />
            </div>
          ) : null}

          {!pageLoading && activeTab === 'approvals' ? (
            <div className="space-y-6">
              <div className="card rounded-[20px] p-5">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div>
                    <h3 className="text-base font-medium text-white/92">Pending Financial Approvals</h3>
                    <p className="text-xs font-normal text-white/55">Audit driver payment collections, cheques, and expense claims</p>
                  </div>
                  <span className="rounded-full border border-amber-400/25 bg-amber-400/12 px-3 py-1 text-xs font-medium text-amber-300">
                    {paymentApprovals.length} Payment Claims Pending
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  {/* Active Filter Chips */}
                  <ActiveFilterChips chips={activeApprovalChips} onClearAll={clearAllApprovalColumnFilters} />

                  {filteredGroupedPaymentApprovals.map((group) => (
                    <div key={group.key} className="rounded-[16px] border border-white/[0.08] bg-white/[0.03] overflow-hidden shadow-sm backdrop-blur-md">
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.03] px-4 py-3 text-xs sm:text-sm border-b border-white/[0.06]">
                        <div>
                          <p className="font-medium text-white/95">
                            {group.driverName} · {group.date ? formatDateTime(group.date) : 'Today'}
                          </p>
                          <p className="text-xs text-white/50 num-tabular font-normal">
                            Tripsheet ID: {group.tripsheetId} · Delivered: {group.deliveredCount}/{group.rows.length} Shops
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => runAction(`approve-group-${group.key}`, async () => approveGroup(group.rows.map((row) => row._id)))}
                            disabled={isActionLoading(`approve-group-${group.key}`)}
                            className="glass-btn-primary rounded-xl px-3 py-1.5 text-xs font-medium text-white shadow-sm disabled:opacity-50"
                          >
                            {isActionLoading(`approve-group-${group.key}`) ? 'Approving...' : 'Approve All Claims'}
                          </button>
                          <button
                            onClick={() =>
                              setExpandedApprovalGroups((prev) =>
                                prev.includes(group.key) ? prev.filter((k) => k !== group.key) : [...prev, group.key],
                              )
                            }
                            className="glass-btn rounded-xl px-3 py-1.5 text-xs font-medium text-white/80"
                          >
                            {expandedApprovalGroups.includes(group.key) ? 'Collapse' : 'Inspect Breakdown'}
                          </button>
                        </div>
                      </div>

                      {/* Financial Mode Totals Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/[0.015] px-4 py-3 text-xs border-b border-white/[0.06]">
                        <div>
                          <span className="text-[10px] uppercase tracking-[0.08em] text-white/40 block font-medium">Cash Collected</span>
                          <span className="font-medium text-white/95 num-tabular">{formatMoney(group.totals.cash)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-[0.08em] text-white/40 block font-medium">UPI Digital</span>
                          <span className="font-medium text-white/95 num-tabular">{formatMoney(group.totals.upi)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-[0.08em] text-white/40 block font-medium">Cheques Logged</span>
                          <span className="font-medium text-white/95 num-tabular">{formatMoney(group.totals.cheque)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-[0.08em] text-white/40 block font-medium">Actual Total</span>
                          <span className="font-medium text-indigo-300 num-tabular">{formatMoney(group.totals.actual)}</span>
                        </div>
                      </div>

                      {expandedApprovalGroups.includes(group.key) && (
                        <div className="table-wrapper">
                          <table className="min-w-full text-xs">
                            <thead className="bg-white/[0.06] backdrop-blur-md sticky top-0 text-white/50 font-medium border-b border-white/[0.06] z-10">
                              <tr>
                                <th className="px-3 py-2 text-left">
                                  <ColumnFilterHeader
                                    label="Shop Name"
                                    filterType="text"
                                    filterValue={approvalColumnFilters.shopName}
                                    isFiltered={Boolean(approvalColumnFilters.shopName)}
                                    onApplyFilter={(v) => setApprovalColumnFilters((p) => ({ ...p, shopName: String(v || '') }))}
                                    onClearFilter={() => setApprovalColumnFilters((p) => ({ ...p, shopName: '' }))}
                                    sortState={approvalSort?.column === 'shopName' ? approvalSort.direction : false}
                                    onSort={() => toggleApprovalSort('shopName')}
                                  />
                                </th>
                                <th className="px-3 py-2 text-left">
                                  <ColumnFilterHeader
                                    label="Invoice #"
                                    filterType="text"
                                    filterValue={approvalColumnFilters.invoiceNumber}
                                    isFiltered={Boolean(approvalColumnFilters.invoiceNumber)}
                                    onApplyFilter={(v) => setApprovalColumnFilters((p) => ({ ...p, invoiceNumber: String(v || '') }))}
                                    onClearFilter={() => setApprovalColumnFilters((p) => ({ ...p, invoiceNumber: '' }))}
                                    sortState={approvalSort?.column === 'invoiceNumber' ? approvalSort.direction : false}
                                    onSort={() => toggleApprovalSort('invoiceNumber')}
                                  />
                                </th>
                                <th className="px-3 py-2 text-left">
                                  <ColumnFilterHeader
                                    label="Actual"
                                    filterType="amount"
                                    filterValue={{ min: approvalColumnFilters.actualMin, max: approvalColumnFilters.actualMax }}
                                    isFiltered={Boolean(approvalColumnFilters.actualMin || approvalColumnFilters.actualMax)}
                                    onApplyFilter={(v) => setApprovalColumnFilters((p) => ({ ...p, actualMin: v?.min || '', actualMax: v?.max || '' }))}
                                    onClearFilter={() => setApprovalColumnFilters((p) => ({ ...p, actualMin: '', actualMax: '' }))}
                                    sortState={approvalSort?.column === 'totalAmount' ? approvalSort.direction : false}
                                    onSort={() => toggleApprovalSort('totalAmount')}
                                  />
                                </th>
                                <th className="px-3 py-2 text-left">
                                  <ColumnFilterHeader
                                    label="Received"
                                    filterType="amount"
                                    filterValue={{ min: approvalColumnFilters.receivedMin, max: approvalColumnFilters.receivedMax }}
                                    isFiltered={Boolean(approvalColumnFilters.receivedMin || approvalColumnFilters.receivedMax)}
                                    onApplyFilter={(v) => setApprovalColumnFilters((p) => ({ ...p, receivedMin: v?.min || '', receivedMax: v?.max || '' }))}
                                    onClearFilter={() => setApprovalColumnFilters((p) => ({ ...p, receivedMin: '', receivedMax: '' }))}
                                    sortState={approvalSort?.column === 'amount' ? approvalSort.direction : false}
                                    onSort={() => toggleApprovalSort('amount')}
                                  />
                                </th>
                                <th className="px-3 py-2 text-left">
                                  <ColumnFilterHeader
                                    label="Mode"
                                    filterType="enum"
                                    enumOptions={['cash', 'upi', 'cheque', 'credit_note']}
                                    filterValue={approvalColumnFilters.mode}
                                    isFiltered={approvalColumnFilters.mode.length > 0}
                                    onApplyFilter={(v) => setApprovalColumnFilters((p) => ({ ...p, mode: Array.isArray(v) ? v : [] }))}
                                    onClearFilter={() => setApprovalColumnFilters((p) => ({ ...p, mode: [] }))}
                                    sortState={approvalSort?.column === 'mode' ? approvalSort.direction : false}
                                    onSort={() => toggleApprovalSort('mode')}
                                  />
                                </th>
                                <th className="px-3 py-2 text-left">
                                  <ColumnFilterHeader
                                    label="Deductions"
                                    filterType="amount"
                                    filterValue={{ min: approvalColumnFilters.deductionsMin, max: approvalColumnFilters.deductionsMax }}
                                    isFiltered={Boolean(approvalColumnFilters.deductionsMin || approvalColumnFilters.deductionsMax)}
                                    onApplyFilter={(v) => setApprovalColumnFilters((p) => ({ ...p, deductionsMin: v?.min || '', deductionsMax: v?.max || '' }))}
                                    onClearFilter={() => setApprovalColumnFilters((p) => ({ ...p, deductionsMin: '', deductionsMax: '' }))}
                                    sortState={approvalSort?.column === 'deductedAmount' ? approvalSort.direction : false}
                                    onSort={() => toggleApprovalSort('deductedAmount')}
                                  />
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                              {group.rows.map((approval) => (
                                <tr key={approval._id} className="hover:bg-white/[0.04]">
                                  <td className="px-3 py-2 font-normal text-white/90">{approval.payload.shopName || '-'}</td>
                                  <td className="px-3 py-2 num-tabular text-white/70">{approval.payload.invoiceNumber || '-'}</td>
                                  <td className="px-3 py-2 num-tabular text-white/80">{formatMoney(Number(approval.payload?.totalAmount || 0))}</td>
                                  <td className="px-3 py-2 font-medium num-tabular text-emerald-400">{formatMoney(Number(approval.payload?.amount || 0))}</td>
                                  <td className="px-3 py-2 uppercase font-medium text-white/70">{approval.payload.mode || '-'}</td>
                                  <td className="px-3 py-2 text-white/50 num-tabular">
                                    {formatMoney(Number(approval.payload?.deductedAmount || 0))}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => runAction(`approve-${approval._id}`, async () => approveItem(approval._id))}
                                        disabled={isActionLoading(`approve-${approval._id}`)}
                                        className="rounded-lg border border-emerald-400/25 bg-emerald-400/12 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-400/25 disabled:opacity-50"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => runAction(`reject-${approval._id}`, async () => rejectItem(approval._id))}
                                        disabled={isActionLoading(`reject-${approval._id}`)}
                                        className="rounded-lg bg-rose-500/12 border border-rose-400/25 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
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
                      )}
                    </div>
                  ))}
                  {!groupedPaymentApprovals.length && (
                    <p className="py-8 text-center text-xs text-white/40">All driver payments reconciled. Zero pending claims.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* TAB 6: CHEQUES */}
          {pageLoading && activeTab === 'cheques' ? (
            <div className="space-y-4">
              <CardSkeleton rows={5} />
            </div>
          ) : null}

          {!pageLoading && activeTab === 'cheques' ? (
            <div className="card rounded-[20px] overflow-hidden">
              <div className="border-b border-white/[0.06] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-medium text-white/92">Cheque Clearance & Reconciliations</h3>
                  <p className="text-xs font-normal text-white/55">Track deposited cheques, mark clearances, and bounce adjustments</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {(['', 'pending', 'deposited', 'cleared', 'bounced'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setChequeFilters((p) => ({ ...p, status: st }))}
                      className={`px-3 py-1.5 text-xs font-normal capitalize transition ${
                        chequeFilters.status === st ? 'glass-pill-active' : 'glass-pill'
                      }`}
                    >
                      {st || 'All Cheques'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Cheque Entry Bar */}
              <div className="grid gap-2 border-b border-white/[0.06] bg-white/[0.025] p-4 md:grid-cols-6 text-xs">
                <input
                  value={manualChequeForm.invoiceNumber}
                  onChange={(e) => setManualChequeForm((p) => ({ ...p, invoiceNumber: e.target.value }))}
                  placeholder="Invoice #"
                  className="glass-input px-3 py-2 text-xs"
                />
                <input
                  value={manualChequeForm.chequeNumber}
                  onChange={(e) => setManualChequeForm((p) => ({ ...p, chequeNumber: e.target.value }))}
                  placeholder="Cheque #"
                  className="glass-input px-3 py-2 text-xs"
                />
                <input
                  type="date"
                  value={manualChequeForm.date}
                  onChange={(e) => setManualChequeForm((p) => ({ ...p, date: e.target.value }))}
                  className="glass-input px-3 py-2 text-xs"
                />
                <input
                  value={manualChequeForm.bankName}
                  onChange={(e) => setManualChequeForm((p) => ({ ...p, bankName: e.target.value }))}
                  placeholder="Bank Name"
                  className="glass-input px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  value={manualChequeForm.amount}
                  onChange={(e) => setManualChequeForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="Amount"
                  className="glass-input px-3 py-2 text-xs"
                />
                <button
                  onClick={() => runAction('create-cheque', async () => createManualCheque())}
                  disabled={isActionLoading('create-cheque')}
                  className="glass-btn-primary px-4 py-2 text-xs font-medium text-white shadow-sm disabled:opacity-50"
                >
                  {isActionLoading('create-cheque') ? 'Logging...' : 'Log Cheque'}
                </button>
              </div>

              {/* Active Filter Chips */}
              <ActiveFilterChips chips={activeChequeChips} onClearAll={clearAllChequeColumnFilters} />

              {/* Cheques Ledger Table */}
              <div className="table-wrapper">
                <table className="min-w-full text-xs">
                  <thead className="bg-white/[0.06] backdrop-blur-md sticky top-0 text-white/50 font-medium border-b border-white/[0.06] z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">
                        <ColumnFilterHeader
                          label="Cheque #"
                          filterType="text"
                          filterValue={chequeColumnFilters.chequeNumber}
                          isFiltered={Boolean(chequeColumnFilters.chequeNumber)}
                          onApplyFilter={(v) => setChequeColumnFilters((p) => ({ ...p, chequeNumber: String(v || '') }))}
                          onClearFilter={() => setChequeColumnFilters((p) => ({ ...p, chequeNumber: '' }))}
                          sortState={chequeSort?.column === 'chequeNumber' ? chequeSort.direction : false}
                          onSort={() => toggleChequeSort('chequeNumber')}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">
                        <ColumnFilterHeader
                          label="Invoice #"
                          filterType="text"
                          filterValue={chequeColumnFilters.invoiceNumber}
                          isFiltered={Boolean(chequeColumnFilters.invoiceNumber)}
                          onApplyFilter={(v) => setChequeColumnFilters((p) => ({ ...p, invoiceNumber: String(v || '') }))}
                          onClearFilter={() => setChequeColumnFilters((p) => ({ ...p, invoiceNumber: '' }))}
                          sortState={chequeSort?.column === 'invoiceNumber' ? chequeSort.direction : false}
                          onSort={() => toggleChequeSort('invoiceNumber')}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">
                        <ColumnFilterHeader
                          label="Bank"
                          filterType="text"
                          filterValue={chequeColumnFilters.bankName}
                          isFiltered={Boolean(chequeColumnFilters.bankName)}
                          onApplyFilter={(v) => setChequeColumnFilters((p) => ({ ...p, bankName: String(v || '') }))}
                          onClearFilter={() => setChequeColumnFilters((p) => ({ ...p, bankName: '' }))}
                          sortState={chequeSort?.column === 'bankName' ? chequeSort.direction : false}
                          onSort={() => toggleChequeSort('bankName')}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">
                        <ColumnFilterHeader
                          label="Date"
                          filterType="date"
                          filterValue={{ from: chequeColumnFilters.dateFrom, to: chequeColumnFilters.dateTo }}
                          isFiltered={Boolean(chequeColumnFilters.dateFrom || chequeColumnFilters.dateTo)}
                          onApplyFilter={(v) => setChequeColumnFilters((p) => ({ ...p, dateFrom: v?.from || '', dateTo: v?.to || '' }))}
                          onClearFilter={() => setChequeColumnFilters((p) => ({ ...p, dateFrom: '', dateTo: '' }))}
                          sortState={chequeSort?.column === 'date' ? chequeSort.direction : false}
                          onSort={() => toggleChequeSort('date')}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">
                        <ColumnFilterHeader
                          label="Amount"
                          filterType="amount"
                          filterValue={{ min: chequeColumnFilters.amountMin, max: chequeColumnFilters.amountMax }}
                          isFiltered={Boolean(chequeColumnFilters.amountMin || chequeColumnFilters.amountMax)}
                          onApplyFilter={(v) => setChequeColumnFilters((p) => ({ ...p, amountMin: v?.min || '', amountMax: v?.max || '' }))}
                          onClearFilter={() => setChequeColumnFilters((p) => ({ ...p, amountMin: '', amountMax: '' }))}
                          sortState={chequeSort?.column === 'amount' ? chequeSort.direction : false}
                          onSort={() => toggleChequeSort('amount')}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">
                        <ColumnFilterHeader
                          label="Lifecycle"
                          filterType="enum"
                          enumOptions={['pending', 'deposited', 'cleared', 'bounced']}
                          filterValue={chequeColumnFilters.status}
                          isFiltered={chequeColumnFilters.status.length > 0}
                          onApplyFilter={(v) => {
                            const statuses = Array.isArray(v) ? v : [];
                            setChequeColumnFilters((p) => ({ ...p, status: statuses }));
                            if (statuses.length === 1) {
                              setChequeFilters((p) => ({ ...p, status: statuses[0] }));
                            }
                          }}
                          onClearFilter={() => {
                            setChequeColumnFilters((p) => ({ ...p, status: [] }));
                            setChequeFilters((p) => ({ ...p, status: '' }));
                          }}
                          sortState={chequeSort?.column === 'status' ? chequeSort.direction : false}
                          onSort={() => toggleChequeSort('status')}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">Update Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredCheques.map((c) => (
                      <tr key={c._id} className="hover:bg-white/[0.04]">
                        <td className="px-4 py-3 num-tabular font-medium text-white/92">{c.chequeNumber}</td>
                        <td className="px-4 py-3 num-tabular text-white/80">{c.invoiceNumber}</td>
                        <td className="px-4 py-3 font-normal text-white/85">{c.bankName}</td>
                        <td className="px-4 py-3 text-white/50 num-tabular">{formatDateTime(c.date)}</td>
                        <td className="px-4 py-3 font-medium num-tabular text-white/95">{formatMoney(c.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                            c.status === 'cleared'
                              ? 'border-emerald-400/25 bg-emerald-400/12 text-emerald-300'
                              : c.status === 'deposited'
                              ? 'border-sky-400/25 bg-sky-400/12 text-sky-300'
                              : c.status === 'bounced'
                              ? 'border-rose-400/25 bg-rose-400/12 text-rose-300'
                              : 'border-amber-400/25 bg-amber-400/12 text-amber-300'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {c.status === 'pending' && (
                              <button
                                onClick={() => updateChequeStatus(c._id, 'deposited')}
                                className="rounded-lg border border-sky-400/25 bg-sky-400/12 px-2 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-400/20"
                              >
                                Deposit
                              </button>
                            )}
                            {c.status !== 'cleared' && (
                              <button
                                onClick={() => updateChequeStatus(c._id, 'cleared')}
                                className="rounded-lg border border-emerald-400/25 bg-emerald-400/12 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-400/20"
                              >
                                Clear
                              </button>
                            )}
                            {c.status !== 'bounced' && (
                              <button
                                onClick={() => updateChequeStatus(c._id, 'bounced')}
                                className="rounded-lg border border-rose-400/25 bg-rose-400/12 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-400/20"
                              >
                                Bounce
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredCheques.length && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-white/40">
                          No cheque records registered for this query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* TAB 7: EXPENSES */}
          {pageLoading && activeTab === 'expenses' ? (
            <div className="space-y-4">
              <CardSkeleton rows={4} />
            </div>
          ) : null}

          {!pageLoading && activeTab === 'expenses' ? (
            <div className="card overflow-hidden">
              <div className="border-b border-white/[0.06] px-6 py-4">
                <h3 className="text-base font-medium text-white/92">Fleet Operations & Field Expenses</h3>
                <p className="text-xs font-normal text-white/55">Record overhead, fuel, transit costs, and administrative disbursements</p>
              </div>

              {/* Pending Driver Expenses */}
              {expenseApprovals.length > 0 && (
                <div className="border-b border-white/[0.06] bg-amber-400/[0.05] p-5 backdrop-blur-md">
                  <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" strokeWidth={1.5} />
                    <span>Driver Field Expense Claims ({expenseApprovals.length})</span>
                  </h4>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {expenseApprovals.map((approval) => (
                      <div key={approval._id} className="glass-row border border-amber-400/25 p-3.5 shadow-sm text-xs rounded-xl">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-white/95">
                            {approval.payload?.type || approval.payload?.category || 'Expense'}
                          </span>
                          <span className="font-medium text-rose-400 num-tabular">
                            {formatMoney(Number(approval.payload?.amount || 0))}
                          </span>
                        </div>
                        <p className="text-white/50 text-[11px] mt-1 num-tabular font-normal">
                          {approval.payload?.date} · By {approval.payload?.addedBy || 'Driver'}
                        </p>
                        <p className="text-white/70 mt-1 italic font-normal">{approval.payload?.notes || '-'}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() => runAction(`approve-${approval._id}`, async () => approveItem(approval._id))}
                            className="flex-1 rounded-lg border border-emerald-400/25 bg-emerald-400/12 py-1.5 text-center font-medium text-emerald-300 hover:bg-emerald-400/20"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => runAction(`reject-${approval._id}`, async () => rejectItem(approval._id))}
                            className="flex-1 rounded-lg border border-rose-400/25 bg-rose-500/12 py-1.5 text-center font-medium text-rose-300 hover:bg-rose-500/20"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Expense Form Grid */}
              <div className="grid gap-2.5 border-b border-white/[0.06] bg-white/[0.025] p-4 sm:grid-cols-2 lg:grid-cols-5 text-xs">
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
                  className="glass-input px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  placeholder="Amount (INR)"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                  className="glass-input px-3 py-2 num-tabular text-xs"
                />
                <input
                  placeholder="Category (e.g. Fuel, Toll, Meal)"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))}
                  className="glass-input px-3 py-2 text-xs"
                />
                <input
                  placeholder="Added By"
                  value={expenseForm.addedBy}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, addedBy: e.target.value }))}
                  className="glass-input px-3 py-2 text-xs"
                />
                <button
                  onClick={() => runAction('add-expense', async () => createExpense())}
                  disabled={isActionLoading('add-expense')}
                  className="glass-btn-primary px-4 py-2 font-medium text-white shadow-sm disabled:opacity-50"
                >
                  {isActionLoading('add-expense') ? 'Adding...' : 'Post Expense'}
                </button>
                <input
                  placeholder="Expense memo or narrative (optional)"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))}
                  className="glass-input sm:col-span-2 lg:col-span-5 px-3 py-2 text-xs"
                />
              </div>

              {/* Active Filter Chips */}
              <ActiveFilterChips chips={activeExpenseChips} onClearAll={clearAllExpenseColumnFilters} />

              {/* Expense Records Table */}
              <div className="table-wrapper">
                <table className="min-w-full text-xs">
                  <thead className="bg-white/[0.06] backdrop-blur-md sticky top-0 text-white/50 font-medium border-b border-white/[0.06] z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">
                        <ColumnFilterHeader
                          label="Date"
                          filterType="date"
                          filterValue={{ from: expenseColumnFilters.dateFrom, to: expenseColumnFilters.dateTo }}
                          isFiltered={Boolean(expenseColumnFilters.dateFrom || expenseColumnFilters.dateTo)}
                          onApplyFilter={(v) => setExpenseColumnFilters((p) => ({ ...p, dateFrom: v?.from || '', dateTo: v?.to || '' }))}
                          onClearFilter={() => setExpenseColumnFilters((p) => ({ ...p, dateFrom: '', dateTo: '' }))}
                          sortState={expenseSort?.column === 'date' ? expenseSort.direction : false}
                          onSort={() => toggleExpenseSort('date')}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">
                        <ColumnFilterHeader
                          label="Amount"
                          filterType="amount"
                          filterValue={{ min: expenseColumnFilters.amountMin, max: expenseColumnFilters.amountMax }}
                          isFiltered={Boolean(expenseColumnFilters.amountMin || expenseColumnFilters.amountMax)}
                          onApplyFilter={(v) => setExpenseColumnFilters((p) => ({ ...p, amountMin: v?.min || '', amountMax: v?.max || '' }))}
                          onClearFilter={() => setExpenseColumnFilters((p) => ({ ...p, amountMin: '', amountMax: '' }))}
                          sortState={expenseSort?.column === 'amount' ? expenseSort.direction : false}
                          onSort={() => toggleExpenseSort('amount')}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">
                        <ColumnFilterHeader
                          label="Category"
                          filterType="enum"
                          enumOptions={availableExpenseCategories}
                          filterValue={expenseColumnFilters.category}
                          isFiltered={expenseColumnFilters.category.length > 0}
                          onApplyFilter={(v) => setExpenseColumnFilters((p) => ({ ...p, category: Array.isArray(v) ? v : [] }))}
                          onClearFilter={() => setExpenseColumnFilters((p) => ({ ...p, category: [] }))}
                          sortState={expenseSort?.column === 'category' ? expenseSort.direction : false}
                          onSort={() => toggleExpenseSort('category')}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">
                        <ColumnFilterHeader
                          label="Logged By"
                          filterType="text"
                          filterValue={expenseColumnFilters.addedBy}
                          isFiltered={Boolean(expenseColumnFilters.addedBy)}
                          onApplyFilter={(v) => setExpenseColumnFilters((p) => ({ ...p, addedBy: String(v || '') }))}
                          onClearFilter={() => setExpenseColumnFilters((p) => ({ ...p, addedBy: '' }))}
                          sortState={expenseSort?.column === 'addedBy' ? expenseSort.direction : false}
                          onSort={() => toggleExpenseSort('addedBy')}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">
                        <ColumnFilterHeader
                          label="Notes"
                          filterType="text"
                          filterValue={expenseColumnFilters.notes}
                          isFiltered={Boolean(expenseColumnFilters.notes)}
                          onApplyFilter={(v) => setExpenseColumnFilters((p) => ({ ...p, notes: String(v || '') }))}
                          onClearFilter={() => setExpenseColumnFilters((p) => ({ ...p, notes: '' }))}
                          sortState={expenseSort?.column === 'notes' ? expenseSort.direction : false}
                          onSort={() => toggleExpenseSort('notes')}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">
                        <ColumnFilterHeader
                          label="Status"
                          filterType="enum"
                          enumOptions={['Approved']}
                          filterValue={expenseColumnFilters.status}
                          isFiltered={expenseColumnFilters.status.length > 0}
                          onApplyFilter={(v) => setExpenseColumnFilters((p) => ({ ...p, status: Array.isArray(v) ? v : [] }))}
                          onClearFilter={() => setExpenseColumnFilters((p) => ({ ...p, status: [] }))}
                          sortState={expenseSort?.column === 'status' ? expenseSort.direction : false}
                          onSort={() => toggleExpenseSort('status')}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredExpenses.map((e) => (
                      <tr key={e._id} className="hover:bg-white/[0.04]">
                        <td className="px-4 py-3 num-tabular text-white/50 font-normal">{e.date}</td>
                        <td className="px-4 py-3 font-medium num-tabular text-white/95">{formatMoney(e.amount)}</td>
                        <td className="px-4 py-3 font-normal text-white/90">{e.category}</td>
                        <td className="px-4 py-3 text-white/70 font-normal">{e.addedBy}</td>
                        <td className="px-4 py-3 text-white/50 font-normal">{e.notes || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/12 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                            Approved
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!filteredExpenses.length && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-white/40">
                          No operating expenses logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* MODALS */}

          {/* Delivery Status Modal */}
          {showDeliveryModal && deliveryModalInvoice ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
              <div className="w-full max-w-md card rounded-[20px] p-6 shadow-panel backdrop-blur-2xl text-white">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-400/25 bg-sky-400/12 text-sky-300">
                      <Truck className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white/92">Mark as Delivered</h3>
                      <p className="text-[11px] text-white/50 num-tabular font-normal">Invoice #{deliveryModalInvoice.invoiceNumber}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowDeliveryModal(false);
                      setDeliveryModalInvoice(null);
                    }}
                    className="rounded-lg p-1 text-white/40 hover:bg-white/[0.06] hover:text-white"
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">
                      Delivery Person / Driver Name
                    </label>
                    <input
                      value={deliveryForm.deliveryPerson}
                      onChange={(e) => {
                        setDeliveryForm((p) => ({ ...p, deliveryPerson: e.target.value }));
                        if (deliveryFormError) setDeliveryFormError('');
                      }}
                      placeholder="e.g. Ramesh"
                      className="glass-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                  {deliveryFormError && (
                    <p className="text-xs text-rose-400 font-normal">{deliveryFormError}</p>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowDeliveryModal(false);
                      setDeliveryModalInvoice(null);
                    }}
                    className="glass-btn px-4 py-2 text-xs font-normal text-white/70 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => runAction('save-delivery-status', async () => submitDeliveredStatusUpdate())}
                    disabled={isActionLoading('save-delivery-status')}
                    className="glass-btn-primary px-4 py-2 text-xs font-medium text-white shadow-sm disabled:opacity-50"
                  >
                    {isActionLoading('save-delivery-status') ? 'Saving...' : 'Confirm Delivered'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Payment Modal */}
          {showPaymentModal && paymentModalInvoice ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
              <div className="w-full max-w-lg card rounded-[20px] p-6 shadow-panel backdrop-blur-2xl text-white">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/12 text-emerald-300">
                      <CreditCard className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white/92">Add Payment Receipt</h3>
                      <p className="text-[11px] text-white/50 num-tabular font-normal">Invoice #{paymentModalInvoice.invoiceNumber} · {paymentModalInvoice.shopName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="rounded-lg p-1 text-white/40 hover:bg-white/[0.06] hover:text-white"
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">Payment Mode</label>
                    <select
                      value={paymentForm.mode}
                      onChange={(e) => setPaymentForm((p) => ({ ...p, mode: e.target.value }))}
                      className="glass-input w-full px-3 py-2 text-white"
                    >
                      <option value="cash" className="bg-[#0f172a] text-white">Cash</option>
                      <option value="upi" className="bg-[#0f172a] text-white">UPI Digital</option>
                      <option value="cheque" className="bg-[#0f172a] text-white">Bank Cheque</option>
                      <option value="credit_note" className="bg-[#0f172a] text-white">Credit Note</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">Received Amount (INR)</label>
                    <input
                      type="number"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
                      className="glass-input w-full px-3 py-2 num-tabular font-medium text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">Collected By</label>
                    <input
                      value={paymentForm.receivedBy}
                      onChange={(e) => setPaymentForm((p) => ({ ...p, receivedBy: e.target.value }))}
                      placeholder="e.g. Ramesh"
                      className="glass-input w-full px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">Receipt Date</label>
                    <input
                      type="date"
                      value={paymentForm.date}
                      onChange={(e) => setPaymentForm((p) => ({ ...p, date: e.target.value }))}
                      className="glass-input w-full px-3 py-2 text-white"
                    />
                  </div>

                  {(paymentForm.mode === 'upi' || paymentForm.mode === 'credit_note') && (
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">
                        {paymentForm.mode === 'upi' ? 'UPI Reference / Transaction ID' : 'Credit Note Reference'}
                      </label>
                      <input
                        value={paymentForm.reference}
                        onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))}
                        className="glass-input w-full px-3 py-2 num-tabular text-white"
                      />
                    </div>
                  )}

                  {paymentForm.mode === 'cheque' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">Cheque Number</label>
                        <input
                          value={paymentForm.chequeNumber}
                          onChange={(e) => setPaymentForm((p) => ({ ...p, chequeNumber: e.target.value }))}
                          className="glass-input w-full px-3 py-2 num-tabular text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">Bank Name</label>
                        <input
                          value={paymentForm.bankName}
                          onChange={(e) => setPaymentForm((p) => ({ ...p, bankName: e.target.value }))}
                          placeholder="e.g. HDFC"
                          className="glass-input w-full px-3 py-2 text-white"
                        />
                      </div>
                    </>
                  )}
                </div>

                {paymentFormError && (
                  <p className="mt-3 text-xs text-rose-400 font-normal">{paymentFormError}</p>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="glass-btn px-4 py-2 text-xs font-normal text-white/70 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => runAction('submit-payment', async () => submitPaymentApproval())}
                    disabled={isActionLoading('submit-payment')}
                    className="glass-btn-primary px-4 py-2 text-xs font-medium text-white shadow-sm disabled:opacity-50"
                  >
                    {isActionLoading('submit-payment') ? 'Submitting...' : 'Record Payment'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Note Modal */}
          {showNoteModal && noteModalInvoice ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
              <div className="w-full max-w-md card rounded-[20px] p-6 shadow-panel backdrop-blur-2xl text-white">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/15 text-indigo-300">
                      <FileText className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white/92">Add Invoice Note</h3>
                      <p className="text-[11px] text-white/50 num-tabular font-normal">Invoice #{noteModalInvoice.invoiceNumber}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowNoteModal(false)}
                    className="rounded-lg p-1 text-white/40 hover:bg-white/[0.06] hover:text-white"
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">Author</label>
                    <input
                      value={noteForm.addedBy}
                      onChange={(e) => setNoteForm((p) => ({ ...p, addedBy: e.target.value }))}
                      className="glass-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">Note Content</label>
                    <textarea
                      rows={4}
                      value={noteForm.content}
                      onChange={(e) => setNoteForm((p) => ({ ...p, content: e.target.value }))}
                      placeholder="Add settlement details, shop manager remarks, or transit notes..."
                      className="glass-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setShowNoteModal(false)}
                    className="glass-btn px-4 py-2 text-xs font-normal text-white/70 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => runAction('save-note', async () => submitNote())}
                    disabled={isActionLoading('save-note')}
                    className="glass-btn-primary px-4 py-2 text-xs font-medium text-white shadow-sm disabled:opacity-50"
                  >
                    {isActionLoading('save-note') ? 'Saving...' : 'Save Note'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Agent Modal */}
          {showAgentModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
              <div className="w-full max-w-md card rounded-[20px] p-6 shadow-panel backdrop-blur-2xl text-white">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/15 text-indigo-300">
                      <UserPlus className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-sm font-medium text-white/92">Create Driver Account</h3>
                  </div>
                  <button
                    onClick={() => setShowAgentModal(false)}
                    className="rounded-lg p-1 text-white/40 hover:bg-white/[0.06] hover:text-white"
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">Driver Full Name</label>
                    <input
                      value={agentForm.name}
                      onChange={(e) => setAgentForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Ramesh Kumar"
                      className="glass-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">Username</label>
                    <input
                      value={agentForm.username}
                      onChange={(e) => setAgentForm((p) => ({ ...p, username: e.target.value }))}
                      placeholder="e.g. ramesh"
                      className="glass-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">Password</label>
                    <input
                      type="password"
                      value={agentForm.password}
                      onChange={(e) => setAgentForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Account password"
                      className="glass-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setShowAgentModal(false)}
                    className="glass-btn px-4 py-2 text-xs font-normal text-white/70 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => runAction('create-agent', async () => addDeliveryAgent())}
                    disabled={isActionLoading('create-agent')}
                    className="glass-btn-primary px-4 py-2 text-xs font-medium text-white shadow-sm disabled:opacity-50"
                  >
                    {isActionLoading('create-agent') ? 'Creating...' : 'Create Driver'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Agent Credentials Modal */}
          {showAgentCredentialsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
              <div className="w-full max-w-md card rounded-[20px] p-6 shadow-panel backdrop-blur-2xl text-white">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/12 text-amber-300">
                      <Key className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-sm font-medium text-white/92">Update Driver Password</h3>
                  </div>
                  <button
                    onClick={() => setShowAgentCredentialsModal(false)}
                    className="rounded-lg p-1 text-white/40 hover:bg-white/[0.06] hover:text-white"
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">Driver</label>
                    <input
                      value={agentCredentialsForm.name}
                      disabled
                      className="glass-input w-full px-3 py-2 text-sm text-white/50 font-normal"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">Username</label>
                    <input
                      value={agentCredentialsForm.username}
                      disabled
                      className="glass-input w-full px-3 py-2 text-sm text-white/50 num-tabular font-normal"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/50 mb-1">New Password</label>
                    <input
                      type="password"
                      value={agentCredentialsForm.password}
                      onChange={(e) => setAgentCredentialsForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Enter minimum 4 characters"
                      className="glass-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setShowAgentCredentialsModal(false)}
                    className="glass-btn px-4 py-2 text-xs font-normal text-white/70 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => runAction('update-agent-password', async () => updateSelectedAgentPassword())}
                    disabled={isActionLoading('update-agent-password') || !agentCredentialsForm.password.trim()}
                    className="glass-btn-primary px-4 py-2 text-xs font-medium text-white shadow-sm disabled:opacity-50"
                  >
                    {isActionLoading('update-agent-password') ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <ThemeSettingsPopover
        isOpen={themeOpen}
        onClose={() => setThemeOpen(false)}
        anchorEl={themeAnchorEl}
      />
    </div>
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
        header: 'Invoice #',
        meta: { filter: 'invoiceNumber' },
        cell: (info) => <span className="num-tabular font-medium text-white/95">{String(info.getValue())}</span>,
      },
      {
        accessorKey: 'cmpCode',
        header: 'CmpCode',
        cell: (info) => (
          <span className="num-tabular text-xs font-normal text-white/80">
            {String(info.row.original.cmpCode || info.row.original.firm || '-')}
          </span>
        ),
      },
      {
        accessorKey: 'route',
        header: 'Route',
        meta: { filter: 'route' },
        enableSorting: false,
        cell: (info) => <span className="text-white/60 font-normal">{String(info.row.original.route || '-')}</span>,
      },
      {
        accessorKey: 'date',
        header: 'Date',
        meta: { filter: 'date' },
        cell: (info) => <span className="num-tabular text-white/60 font-normal">{String(info.getValue())}</span>,
      },
      {
        accessorKey: 'shopName',
        header: 'Shop Name',
        meta: { filter: 'shopName' },
        cell: (info) => <span className="font-normal text-white/90">{String(info.getValue())}</span>,
      },
      {
        accessorKey: 'totalAmount',
        header: 'Total Amount',
        meta: { filter: 'amount' },
        cell: (info) => <span className="font-medium num-tabular text-white/95">{formatMoney(Number(info.getValue() || 0))}</span>,
      },
      {
        accessorKey: 'deliveryStatus',
        header: 'Delivery',
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

  const activeInvoiceChips = useMemo<ActiveFilterChipItem[]>(() => {
    const chips: ActiveFilterChipItem[] = [];
    if (filters.invoiceNumber) {
      chips.push({
        id: 'invoiceNumber',
        label: `Invoice #: ${filters.invoiceNumber}`,
        onRemove: () => setFilters((p) => ({ ...p, invoiceNumber: '' })),
      });
    }
    if (filters.shopName) {
      chips.push({
        id: 'shopName',
        label: `Shop: ${filters.shopName}`,
        onRemove: () => setFilters((p) => ({ ...p, shopName: '' })),
      });
    }
    if (filters.route && filters.route.length > 0) {
      chips.push({
        id: 'route',
        label: `Route: ${filters.route.join(', ')}`,
        onRemove: () => setFilters((p) => ({ ...p, route: [] })),
      });
    }
    if (filters.dateFrom || filters.dateTo) {
      chips.push({
        id: 'date',
        label: `Date: ${filters.dateFrom || '...'} to ${filters.dateTo || '...'}`,
        onRemove: () => setFilters((p) => ({ ...p, dateFrom: '', dateTo: '' })),
      });
    }
    if (filters.amountMin || filters.amountMax) {
      chips.push({
        id: 'amount',
        label: `Amount: ₹${filters.amountMin || '0'} - ₹${filters.amountMax || '...'}`,
        onRemove: () => setFilters((p) => ({ ...p, amountMin: '', amountMax: '' })),
      });
    }
    if (filters.deliveryStatus) {
      chips.push({
        id: 'deliveryStatus',
        label: `Delivery: ${filters.deliveryStatus}`,
        onRemove: () => setFilters((p) => ({ ...p, deliveryStatus: '' })),
      });
    }
    if (filters.paymentStatus) {
      chips.push({
        id: 'paymentStatus',
        label: `Payment: ${filters.paymentStatus}`,
        onRemove: () => setFilters((p) => ({ ...p, paymentStatus: '' })),
      });
    }
    return chips;
  }, [filters, setFilters]);

  const handleClearAllInvoiceFilters = () => {
    setFilters({
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
  };

  return (
    <div className="space-y-4">
      {/* Table Information Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-white/50">
        <span className="font-normal text-white/80 num-tabular">
          Showing {rows.length} records · Page {page} of {pages} ({total} total invoices)
        </span>
        <span className="text-[11px] italic text-white/40 font-normal">
          Click any invoice row to inspect delivery, notes & transaction ledger
        </span>
      </div>

      {/* Active Filter Chips */}
      <ActiveFilterChips chips={activeInvoiceChips} onClearAll={handleClearAllInvoiceFilters} />

      <div className="card rounded-[20px] overflow-hidden">
        <table className="min-w-full text-xs">
          <thead className="bg-white/[0.06] backdrop-blur-md text-white/50 sticky top-0 z-10 border-b border-white/[0.06]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const filterKey = (header.column.columnDef.meta as { filter?: InvoiceFilterKey } | undefined)?.filter;
                  return (
                    <th key={header.id} className="px-4 py-3 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">
                      {header.isPlaceholder ? null : (
                        <ColumnFilterHeader
                          columnId={String(header.column.id)}
                          label={String(header.column.columnDef.header)}
                          filterType={
                            filterKey === 'invoiceNumber' || filterKey === 'shopName'
                              ? 'text'
                              : filterKey === 'route' || filterKey === 'deliveryStatus' || filterKey === 'paymentStatus'
                              ? 'enum'
                              : filterKey === 'date'
                              ? 'date'
                              : filterKey === 'amount'
                              ? 'amount'
                              : undefined
                          }
                          enumOptions={
                            filterKey === 'route'
                              ? routeOptions
                              : filterKey === 'deliveryStatus'
                              ? ['delivered', 'pending']
                              : filterKey === 'paymentStatus'
                              ? ['paid', 'partial', 'unpaid', 'payable']
                              : undefined
                          }
                          filterValue={
                            filterKey === 'invoiceNumber'
                              ? filters.invoiceNumber
                              : filterKey === 'shopName'
                              ? filters.shopName
                              : filterKey === 'route'
                              ? filters.route
                              : filterKey === 'date'
                              ? { from: filters.dateFrom, to: filters.dateTo }
                              : filterKey === 'amount'
                              ? { min: filters.amountMin, max: filters.amountMax }
                              : filterKey === 'deliveryStatus'
                              ? (filters.deliveryStatus ? [filters.deliveryStatus] : [])
                              : filterKey === 'paymentStatus'
                              ? (filters.paymentStatus ? [filters.paymentStatus] : [])
                              : undefined
                          }
                          isFiltered={(() => {
                            if (!filterKey) return false;
                            if (filterKey === 'invoiceNumber') return Boolean(filters.invoiceNumber);
                            if (filterKey === 'shopName') return Boolean(filters.shopName);
                            if (filterKey === 'route') return filters.route.length > 0;
                            if (filterKey === 'date') return Boolean(filters.dateFrom || filters.dateTo);
                            if (filterKey === 'amount') return Boolean(filters.amountMin || filters.amountMax);
                            if (filterKey === 'deliveryStatus') return Boolean(filters.deliveryStatus);
                            if (filterKey === 'paymentStatus') return Boolean(filters.paymentStatus);
                            return false;
                          })()}
                          onApplyFilter={(val) => {
                            if (filterKey === 'invoiceNumber') setFilters((p) => ({ ...p, invoiceNumber: String(val || '') }));
                            else if (filterKey === 'shopName') setFilters((p) => ({ ...p, shopName: String(val || '') }));
                            else if (filterKey === 'route') setFilters((p) => ({ ...p, route: Array.isArray(val) ? val : [] }));
                            else if (filterKey === 'date') setFilters((p) => ({ ...p, dateFrom: val?.from || '', dateTo: val?.to || '' }));
                            else if (filterKey === 'amount') setFilters((p) => ({ ...p, amountMin: val?.min || '', amountMax: val?.max || '' }));
                            else if (filterKey === 'deliveryStatus') setFilters((p) => ({ ...p, deliveryStatus: Array.isArray(val) && val[0] ? val[0] : '' }));
                            else if (filterKey === 'paymentStatus') setFilters((p) => ({ ...p, paymentStatus: Array.isArray(val) && val[0] ? val[0] : '' }));
                          }}
                          onClearFilter={() => {
                            if (filterKey === 'invoiceNumber') setFilters((p) => ({ ...p, invoiceNumber: '' }));
                            else if (filterKey === 'shopName') setFilters((p) => ({ ...p, shopName: '' }));
                            else if (filterKey === 'route') setFilters((p) => ({ ...p, route: [] }));
                            else if (filterKey === 'date') setFilters((p) => ({ ...p, dateFrom: '', dateTo: '' }));
                            else if (filterKey === 'amount') setFilters((p) => ({ ...p, amountMin: '', amountMax: '' }));
                            else if (filterKey === 'deliveryStatus') setFilters((p) => ({ ...p, deliveryStatus: '' }));
                            else if (filterKey === 'paymentStatus') setFilters((p) => ({ ...p, paymentStatus: '' }));
                          }}
                          sortState={header.column.getIsSorted()}
                          onSort={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.06]">
                  <td colSpan={8} className="px-4 py-3.5">
                    <div className="skeleton h-5 w-full bg-white/[0.04]" />
                  </td>
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-white/40" colSpan={8}>
                  No invoices found matching current filter parameters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    className={`cursor-pointer transition ${
                      expandedInvoice === row.original._id ? 'bg-indigo-500/12' : 'hover:bg-white/[0.04]'
                    }`}
                    onClick={() => setExpandedInvoice(expandedInvoice === row.original._id ? null : row.original._id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-white/80">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  <AnimatePresence initial={false}>
                    {expandedInvoice === row.original._id && (
                      <motion.tr
                        key={`${row.id}-expanded`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <td colSpan={8} className="bg-white/[0.03] p-4 border-b border-white/[0.06] backdrop-blur-md">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden space-y-4"
                          >
                            {/* 4 Diagnostic Inspection Cards */}
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              {/* 1. Delivery Info Card */}
                              <div className="glass-row p-3.5 shadow-sm rounded-xl">
                                <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2 text-white/95 font-medium">
                                  <Truck className="h-3.5 w-3.5 text-sky-400" strokeWidth={1.5} />
                                  <span>Delivery Details</span>
                                </div>
                                <div className="mt-2.5 space-y-1.5 text-[11px]">
                                  <div className="flex justify-between">
                                    <span className="text-white/50">Status</span>
                                    <Badge className={statusBadgeClass(row.original.deliveryStatus)}>
                                      {row.original.deliveryStatus}
                                    </Badge>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-white/50">Driver</span>
                                    <span className="font-normal text-white/95">{row.original.deliveryPerson || 'Unassigned'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-white/50">Delivered At</span>
                                    <span className="num-tabular font-normal text-white/70">{formatDateTime(row.original.deliveredAt || row.original.deliveredDate)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* 2. Financial Balance Summary Card */}
                              <div className="glass-row p-3.5 shadow-sm rounded-xl">
                                {(() => {
                                  const metrics = getInvoicePaymentMetrics(row.original);
                                  return (
                                    <>
                                      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2 text-white/95 font-medium">
                                        <Wallet className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
                                        <span>Invoice Balances</span>
                                      </div>
                                      <div className="mt-2.5 space-y-1.5 text-[11px]">
                                        <div className="flex justify-between">
                                          <span className="text-white/50">Total Billed</span>
                                          <span className="font-medium text-white/95 num-tabular">{formatMoney(metrics.total)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-white/50">Settled (Paid)</span>
                                          <span className="font-medium text-emerald-400 num-tabular">{formatMoney(metrics.paid)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-white/50">Deductions</span>
                                          <span className="font-medium text-amber-400 num-tabular">{formatMoney(metrics.deducted)}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-white/[0.06] pt-1 font-medium">
                                          <span className="text-white/80">Remaining</span>
                                          <span className={`num-tabular ${metrics.remaining > 0.01 ? 'text-rose-400' : 'text-white/95'}`}>
                                            {formatMoney(metrics.remaining)}
                                          </span>
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>

                              {/* 3. Deductions Breakdown Card */}
                              <div className="glass-row p-3.5 shadow-sm rounded-xl">
                                <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2 text-white/95 font-medium">
                                  <Coins className="h-3.5 w-3.5 text-amber-400" strokeWidth={1.5} />
                                  <span>Deductions Log</span>
                                </div>
                                <div className="mt-2.5 max-h-24 overflow-y-auto space-y-1 text-[11px]">
                                  {(row.original.deductions || []).map((ded, idx) => (
                                    <div key={idx} className="flex justify-between items-center rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-white/80">
                                      <span>{ded.typeLabel || ded.type}</span>
                                      <span className="font-medium num-tabular text-white">{formatMoney(Number(ded.amount || 0))}</span>
                                    </div>
                                  ))}
                                  {!(row.original.deductions || []).length && (
                                    <p className="text-white/40 py-2">No adjustments or deductions applied.</p>
                                  )}
                                </div>
                              </div>

                              {/* 4. Notes & Remarks Card */}
                              <div className="glass-row p-3.5 shadow-sm rounded-xl">
                                <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2 text-white/95 font-medium">
                                  <FileText className="h-3.5 w-3.5 text-indigo-400" strokeWidth={1.5} />
                                  <span>Admin Notes</span>
                                </div>
                                <div className="mt-2.5 max-h-24 overflow-y-auto space-y-1.5 text-[11px]">
                                  {(row.original.notes || []).map((note, idx) => (
                                    <div key={idx} className="rounded-lg bg-white/[0.03] p-1.5 border border-white/[0.06]">
                                      <p className="text-white/90 font-normal">{note.text}</p>
                                      <p className="text-[10px] text-white/40 num-tabular mt-0.5">{note.addedBy || 'Admin'} · {formatDateTime(note.timestamp || note.createdAt)}</p>
                                    </div>
                                  ))}
                                  {!(row.original.notes || []).length && (
                                    <p className="text-white/40 py-2">No notes recorded for this invoice.</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Payment History Ledger Table inside expander */}
                            {(row.original.paymentHistory || []).length > 0 && (
                              <div className="glass-row p-3.5 shadow-sm rounded-xl">
                                <p className="text-xs font-medium text-white/95 mb-2">Recorded Payment Receipts</p>
                                <div className="table-wrapper">
                                  <table className="min-w-full text-xs">
                                    <thead className="bg-transparent text-white/50 font-medium border-b border-white/[0.06]">
                                      <tr>
                                        <th className="px-3 py-1.5 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">Mode</th>
                                        <th className="px-3 py-1.5 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">Amount</th>
                                        <th className="px-3 py-1.5 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">Date</th>
                                        <th className="px-3 py-1.5 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">Collector</th>
                                        <th className="px-3 py-1.5 text-left font-medium text-[11px] uppercase tracking-[0.08em] text-white/45">Reference / Cheque</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.06]">
                                      {row.original.paymentHistory!.map((p, i) => (
                                        <tr key={i} className="hover:bg-white/[0.04]">
                                          <td className="px-3 py-1.5 uppercase font-medium text-white/80">{p.mode}</td>
                                          <td className="px-3 py-1.5 font-medium num-tabular text-emerald-400">{formatMoney(Number(p.amount || 0))}</td>
                                          <td className="px-3 py-1.5 num-tabular text-white/50">{formatDateTime(p.date)}</td>
                                          <td className="px-3 py-1.5 text-white/70 font-normal">{p.collectedBy || '-'}</td>
                                          <td className="px-3 py-1.5">
                                            {p.proofImageUrl ? (
                                              <a
                                                href={p.proofImageUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 rounded-full bg-sky-400/12 border border-sky-400/25 px-2 py-0.5 text-[10px] font-medium text-sky-300 hover:bg-sky-400/20"
                                              >
                                                <span>Proof Image</span>
                                                <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                                              </a>
                                            ) : (
                                              <span className="text-white/60 num-tabular">{p.reference || p.chequeNumber || '-'}</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Action Bar */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeliveryStatusAction(row.original);
                                }}
                                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                                  row.original.deliveryStatus === 'delivered'
                                    ? 'glass-btn text-white/80'
                                    : 'glass-btn-primary'
                                }`}
                              >
                                {row.original.deliveryStatus === 'delivered' ? 'Mark Undelivered' : 'Mark Delivered'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddPayment(row.original);
                                }}
                                className="glass-btn-primary rounded-xl px-3 py-1.5 text-xs font-medium text-white shadow-sm"
                              >
                                Add Payment
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddNote(row.original);
                                }}
                                className="glass-btn rounded-xl px-3 py-1.5 text-xs font-medium text-white/80"
                              >
                                Add Note
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onArchive(row.original);
                                }}
                                className="glass-btn rounded-xl px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-rose-500/15 hover:text-rose-300"
                              >
                                Archive Invoice
                              </button>
                            </div>
                          </motion.div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-2">
        <span className="text-xs text-white/50 num-tabular">
          Page <strong className="font-medium text-white/90">{page}</strong> of <strong className="font-medium text-white/90">{pages}</strong>
        </span>

        <div className="flex items-center gap-1.5">
          <button
            aria-label="Previous page"
            disabled={page <= 1 || loading}
            onClick={onPrev}
            className="glass-btn flex h-8 w-8 items-center justify-center rounded-xl text-white/70 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>

          {paginationItems.map((item, idx) => {
            if (item === 'ellipsis-left' || item === 'ellipsis-right') {
              return (
                <span key={`${item}-${idx}`} className="px-1 text-white/30 num-tabular">
                  ...
                </span>
              );
            }

            return (
              <button
                key={item}
                disabled={loading}
                onClick={() => onPageJump(item)}
                className={`flex h-8 min-w-[32px] items-center justify-center rounded-xl px-2 text-xs font-medium num-tabular transition disabled:opacity-30 ${
                  item === page
                    ? 'glass-pill-active'
                    : 'glass-btn text-white/70'
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
            className="glass-btn flex h-8 w-8 items-center justify-center rounded-xl text-white/70 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
