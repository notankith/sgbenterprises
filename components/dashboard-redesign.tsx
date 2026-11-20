"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GlassPopover, GlassDropdown, GlassDatePill, GlassTooltip } from '@/components/glass-popover';
import { StatusChip } from '@/components/status-chip';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  RefreshCw,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Check,
  Search,
  ArrowRight,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  Receipt,
  ShieldCheck,
  Truck,
  Download,
} from 'lucide-react';

export type TabKey =
  | 'dashboard'
  | 'invoices'
  | 'importExport'
  | 'trips'
  | 'approvals'
  | 'cheques'
  | 'expenses';

export type InvoiceRow = {
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

export type ChequeRow = {
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

export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatCompactINR(value: number): string {
  const num = Math.abs(Number(value || 0));
  const sign = value < 0 ? '-' : '';
  if (num >= 10000000) {
    const cr = num / 10000000;
    return `${sign}₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
  }
  if (num >= 100000) {
    const l = num / 100000;
    return `${sign}₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`;
  }
  if (num >= 1000) {
    const k = num / 1000;
    return `${sign}₹${k % 1 === 0 ? k.toFixed(0) : k.toFixed(0)}K`;
  }
  return `${sign}₹${num}`;
}

export type BarSegment = {
  label: string;
  value: number;
  color: string;
};

export function SegmentedBar({
  segments,
  height = 6,
  className = '',
}: {
  segments: BarSegment[];
  height?: number;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-white/[0.08] flex items-center ${className}`}
      style={{ height }}
    >
      {total > 0 ? (
        segments.map((seg, idx) => {
          const pct = (Math.max(0, seg.value) / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={idx}
              title={`${seg.label}: ${seg.value}`}
              className={`h-full ${seg.color} transition-all duration-300 first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${pct}%` }}
            />
          );
        })
      ) : (
        <div className="h-full w-full bg-white/[0.04]" />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// User Menu Popover
// ----------------------------------------------------------------------
export function UserMenuPopover({
  isOpen,
  onClose,
  anchorEl,
  logout,
}: {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  logout: () => Promise<void>;
}) {
  return (
    <GlassPopover
      isOpen={isOpen}
      onClose={onClose}
      anchorEl={anchorEl}
      width={220}
      align="right"
      id="user-menu-popover"
      className="p-3 select-none"
    >
      <div className="flex items-center gap-2.5 px-2 py-1.5 mb-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-solid)]/20 text-[11px] font-semibold text-[var(--accent-solid)]">
          AD
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text-1)] truncate leading-tight">
            Administrator
          </p>
          <p className="text-[11px] text-[var(--text-3)] truncate leading-tight mt-0.5">
            Operations Root
          </p>
        </div>
      </div>
      <div className="h-[1px] bg-white/[0.08] my-1" />
      <button
        onClick={async () => {
          onClose();
          await logout();
        }}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-full text-xs font-medium text-[var(--text-2)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
      >
        <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span>Log out</span>
      </button>
    </GlassPopover>
  );
}

// ----------------------------------------------------------------------
// Floating Top Bar (Replaces Sidebar)
// ----------------------------------------------------------------------
export function FloatingTopBar({
  activeTab,
  onTabSelect,
  pendingApprovalsCount,
  pendingChequesCount,
  pageLoading,
  refreshAll,
  logout,
  userMenuOpen,
  setUserMenuOpen,
  mobileNavOpen,
  setMobileNavOpen,
}: {
  activeTab: TabKey;
  onTabSelect: (tab: TabKey) => void;
  pendingApprovalsCount: number;
  pendingChequesCount: number;
  pageLoading: boolean;
  refreshAll: () => Promise<void>;
  logout: () => Promise<void>;
  userMenuOpen: boolean;
  setUserMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileNavOpen: boolean;
  setMobileNavOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const shouldReduceMotion = useReducedMotion();
  const avatarButtonRef = useRef<HTMLButtonElement>(null);

  const navItems: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'trips', label: 'Trip Sheets' },
    { key: 'importExport', label: 'Import / Export' },
    { key: 'approvals', label: 'Approvals', badge: pendingApprovalsCount },
    { key: 'cheques', label: 'Cheques', badge: pendingChequesCount },
    { key: 'expenses', label: 'Expenses' },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 w-full h-[72px] flex items-center justify-between px-4 sm:px-6 md:px-8 bg-[#060708]/80 backdrop-blur-xl border-b border-white/[0.06] select-none">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <Image
            src="/sgb.png"
            alt="SGB Logo"
            width={32}
            height={32}
            className="h-8 w-8 rounded-[8px] object-contain shrink-0"
            priority
          />
          <span className="text-[14px] font-medium text-[var(--text-1)] tracking-tight">
            SGB Enterprises
          </span>
        </div>

        {/* Center: Desktop Floating Pill Navigation */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex h-[48px] items-center rounded-full p-1 bg-[var(--nav-surface)] border border-white/[0.08] shadow-sm backdrop-blur-md"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onTabSelect(item.key)}
                className="relative flex h-10 items-center justify-center rounded-full px-4 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {isActive && (
                  <motion.div
                    layoutId={shouldReduceMotion ? undefined : 'activeNavPill'}
                    className="absolute inset-0 rounded-full bg-[var(--text-1)] shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span
                  className={`relative z-10 ${
                    isActive
                      ? 'text-[#060708] font-semibold'
                      : 'text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors'
                  }`}
                >
                  {item.label}
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`relative z-10 ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                      isActive
                        ? 'bg-[#060708] text-[var(--text-1)]'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Actions & User Avatar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile Menu Button (<700px) */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex md:hidden h-10 w-10 items-center justify-center rounded-full text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-white/[0.06] transition"
            aria-label="Open mobile navigation"
          >
            <Menu className="h-4 w-4" strokeWidth={1.5} />
          </button>

          {/* Sync Button: 40px circular ghost button */}
          <button
            onClick={refreshAll}
            disabled={pageLoading}
            title="Synchronize console datasets"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-white/[0.06] active:scale-95 transition focus:outline-none"
            aria-label="Sync console"
          >
            <RefreshCw
              className={`h-4 w-4 ${pageLoading ? 'animate-spin' : ''}`}
              strokeWidth={1.5}
            />
          </button>

          {/* Avatar: 36px circular avatar */}
          <div className="relative">
            <button
              ref={avatarButtonRef}
              onClick={() => setUserMenuOpen((prev) => !prev)}
              title="Administrator Profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-[12px] font-medium text-[var(--text-1)] border border-white/[0.08] active:scale-95 transition cursor-pointer focus:outline-none"
            >
              AD
            </button>
            <UserMenuPopover
              isOpen={userMenuOpen}
              onClose={() => setUserMenuOpen(false)}
              anchorEl={avatarButtonRef.current}
              logout={logout}
            />
          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation (<700px) */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed inset-y-0 left-0 z-50 w-[260px] bg-[#060708]/95 border-r border-white/[0.08] p-5 shadow-2xl backdrop-blur-2xl flex flex-col justify-between md:hidden"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2.5">
                    <Image src="/sgb.png" alt="SGB Logo" width={28} height={28} className="h-7 w-7 rounded-[6px]" />
                    <span className="text-[13px] font-medium text-[var(--text-1)]">SGB Enterprises</span>
                  </div>
                  <button
                    onClick={() => setMobileNavOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-3)] hover:text-[var(--text-1)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex flex-col gap-1.5">
                  {navItems.map((item) => {
                    const isActive = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          onTabSelect(item.key);
                          setMobileNavOpen(false);
                        }}
                        className={`flex h-10 items-center justify-between px-3.5 rounded-full text-xs font-medium transition ${
                          isActive
                            ? 'bg-[var(--text-1)] text-[#060708] font-semibold'
                            : 'text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-white/[0.04]'
                        }`}
                      >
                        <span>{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span
                            className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                              isActive
                                ? 'bg-[#060708] text-[var(--text-1)]'
                                : 'bg-rose-500/20 text-rose-400'
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
              <div className="pt-4 border-t border-white/[0.08]">
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-3.5 py-2.5 rounded-full text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ----------------------------------------------------------------------
// Popover Filter Dropdown
// ----------------------------------------------------------------------
export function FilterDropdown({
  triggerLabel,
  options,
  selected,
  onSelect,
}: {
  triggerLabel: string;
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (val: string) => void;
}) {
  return (
    <GlassDropdown
      triggerLabel={triggerLabel}
      options={options}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

// ----------------------------------------------------------------------
// Dashboard Filter Row (Section 4: Height 44px, Radius 999px Glass Pills)
// ----------------------------------------------------------------------
export function DashboardFilterRow({
  selectedCmpCode,
  onSelectCmpCode,
  availableCmpCodes,
  route,
  onSelectRoute,
  availableRoutes,
  dateFrom,
  onSelectDateFrom,
  dateTo,
  onSelectDateTo,
  search,
  onSearchChange,
  onReset,
}: {
  selectedCmpCode: string;
  onSelectCmpCode: (code: string) => void;
  availableCmpCodes: string[];
  route: string;
  onSelectRoute: (r: string) => void;
  availableRoutes: string[];
  dateFrom: string;
  onSelectDateFrom: (d: string) => void;
  dateTo: string;
  onSelectDateTo: (d: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
  onReset: () => void;
}) {
  const activeCount =
    (selectedCmpCode ? 1 : 0) +
    (route ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const firmOptions = [
    { label: 'All companies', value: '' },
    ...availableCmpCodes.map((code) => ({ label: code, value: code })),
  ];

  const routeOptions = [
    { label: 'All routes', value: '' },
    ...availableRoutes.map((r) => ({ label: r, value: r })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2.5 py-1 select-none">
      {/* Active filters count badge: Height 44px, radius 999px */}
      <div
        className={`h-11 px-4 rounded-full inline-flex items-center gap-1.5 text-[13px] transition ${
          activeCount > 0
            ? 'bg-white/10 text-[var(--text-1)] border border-white/20 font-medium'
            : 'text-[var(--text-3)] border border-transparent font-normal'
        }`}
      >
        <span>Active filters ({activeCount})</span>
      </div>

      {/* Firm filter pill */}
      <GlassDropdown
        triggerLabel="Firm: All companies"
        options={firmOptions}
        selected={selectedCmpCode}
        onSelect={onSelectCmpCode}
        id="dashboard-filter-firm"
      />

      {/* Route filter pill */}
      <GlassDropdown
        triggerLabel="Route: All routes"
        options={routeOptions}
        selected={route}
        onSelect={onSelectRoute}
        id="dashboard-filter-route"
      />

      {/* Date From: 44px dark glass pill with plain text date and calendar icon */}
      <GlassDatePill
        value={dateFrom}
        onChange={onSelectDateFrom}
        placeholder="From date"
        partnerDate={dateTo}
        isFromDate={true}
        id="dashboard-filter-date-from"
      />

      {/* Date To: 44px dark glass pill with plain text date and calendar icon */}
      <GlassDatePill
        value={dateTo}
        onChange={onSelectDateTo}
        placeholder="To date"
        partnerDate={dateFrom}
        isFromDate={false}
        id="dashboard-filter-date-to"
      />

      {/* Search Invoice # pill: 44px tall, radius 999px */}
      <div className="relative inline-flex items-center">
        <Search className="absolute left-3.5 h-4 w-4 text-[var(--text-3)] pointer-events-none" />
        <input
          type="text"
          placeholder="Search invoice #"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-11 pl-10 pr-4 rounded-full bg-white/[0.04] border border-white/[0.08] text-[13px] text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:border-white/28 w-48 transition"
        />
      </div>

      {/* Reset button: 44px pill (visible only when active filters > 0) */}
      {activeCount > 0 && (
        <button
          onClick={onReset}
          className="h-11 px-4 rounded-full text-[13px] font-medium text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-white/[0.06] transition"
        >
          Reset
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Hero Stat Cards (Left: Operations overview, Right: Cash flow / Net balance)
// ----------------------------------------------------------------------
export type DashboardStats = {
  billed: number;
  collected: number;
  outstanding: number;
  unpaidCount: number;
  deliveredUnpaid: number;
  pendingDeliveryUnpaid: number;
  aging: { b0_30: number; b31_60: number; b61_90: number; b90_plus: number };
  modes: { modeCash: number; modeUpi: number; modeCheque: number; modeCreditNote: number };
  thisMonthColl: number;
  lastMonthColl: number;
  expTotal: number;
  netBal: number;
  topRoutes: { route: string; outstanding: number; billed: number; collected: number }[];
  topClearance: { name: string; rate: number }[];
  recentMonths: { month: string; billed: number; collected: number }[];
};

export function HeroStatCards({
  stats,
  selectedHeroMetric,
  onSelectHeroMetric,
  onNavigateTab,
}: {
  stats: DashboardStats;
  selectedHeroMetric: 'collected' | 'expenses' | 'outstanding';
  onSelectHeroMetric: (metric: 'collected' | 'expenses' | 'outstanding') => void;
  onNavigateTab: (tab: TabKey) => void;
}) {
  const agingSegments: BarSegment[] = [
    { label: '0-30d', value: stats.aging.b0_30, color: 'bg-emerald-500' },
    { label: '31-60d', value: stats.aging.b31_60, color: 'bg-sky-500' },
    { label: '61-90d', value: stats.aging.b61_90, color: 'bg-amber-500' },
    { label: '90+d', value: stats.aging.b90_plus, color: 'bg-rose-500' },
  ];

  const modeSegments: BarSegment[] = [
    { label: 'Cash', value: stats.modes.modeCash, color: 'bg-emerald-500' },
    { label: 'UPI', value: stats.modes.modeUpi, color: 'bg-indigo-500' },
    { label: 'Cheque', value: stats.modes.modeCheque, color: 'bg-sky-500' },
    { label: 'Credit Note', value: stats.modes.modeCreditNote, color: 'bg-purple-500' },
  ];

  const deliverySegments: BarSegment[] = [
    { label: 'Delivered', value: stats.deliveredUnpaid, color: 'bg-emerald-500' },
    { label: 'Pending Delivery', value: stats.pendingDeliveryUnpaid, color: 'bg-amber-500' },
  ];

  const collectedPctOfBilled =
    stats.billed > 0 ? Math.round((stats.collected / stats.billed) * 100) : 0;
  const expPctOfCollected =
    stats.collected > 0 ? Math.round((stats.expTotal / stats.collected) * 100) : 0;
  const outstandingPctOfBilled =
    stats.billed > 0 ? Math.round((stats.outstanding / stats.billed) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 items-stretch">
      {/* LEFT CARD: Operations overview (Radius 28px, padding 28px) */}
      <div className="rounded-[28px] p-7 glass-panel border border-white/[0.08] shadow-glass flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-1">
            <div>
              <h2 className="text-[15px] font-medium text-[var(--text-1)]">
                Operations overview
              </h2>
              <p className="text-[12px] text-[var(--text-3)] mt-0.5">
                Clearance & receivables
              </p>
            </div>
            <span className="text-[12px] font-medium text-[var(--text-3)] tabular-nums">
              Billed: {formatINR(stats.billed)}
            </span>
          </div>

          {/* Three Primary Metrics in a Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-5 pb-5 border-b border-white/[0.06]">
            {/* Metric 1: Outstanding */}
            <div className="space-y-2.5">
              <p className="text-[12px] text-[var(--text-3)]">Outstanding</p>
              <p className="text-[32px] font-medium leading-none tabular-nums text-[var(--text-1)]">
                {formatINR(stats.outstanding)}
              </p>
              <SegmentedBar segments={agingSegments} height={6} />
            </div>

            {/* Metric 2: Collected */}
            <div className="space-y-2.5">
              <p className="text-[12px] text-[var(--text-3)]">Collected</p>
              <p className="text-[32px] font-medium leading-none tabular-nums text-[var(--text-1)]">
                {formatINR(stats.collected)}
              </p>
              <SegmentedBar segments={modeSegments} height={6} />
            </div>

            {/* Metric 3: Unpaid Invoices (Substituted for avg days per spec) */}
            <div className="space-y-2.5">
              <p className="text-[12px] text-[var(--text-3)]">Unpaid invoices</p>
              <p className="text-[32px] font-medium leading-none tabular-nums text-[var(--text-1)]">
                {stats.unpaidCount}
              </p>
              <SegmentedBar segments={deliverySegments} height={6} />
            </div>
          </div>
        </div>

        {/* Row of 3 sub-metrics below: 3-column CSS grid, equal columns, gap 32px, align-items: start. Below 900px stacks to single column */}
        {(() => {
          const totalAging = Math.max(1, (stats.aging.b0_30 || 0) + (stats.aging.b31_60 || 0) + (stats.aging.b61_90 || 0) + (stats.aging.b90_plus || 0));
          const pct0_30 = Math.round(((stats.aging.b0_30 || 0) / totalAging) * 100);
          const pct31_60 = Math.round(((stats.aging.b31_60 || 0) / totalAging) * 100);
          const pct61_90 = Math.round(((stats.aging.b61_90 || 0) / totalAging) * 100);
          const pct90_plus = Math.round(((stats.aging.b90_plus || 0) / totalAging) * 100);

          return (
            <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-8 items-start pt-6 border-t border-white/[0.06] mt-6">
              {/* Sub-metric 1: Aged Receivables Breakdown (4 equal cells in one row) */}
              <div>
                <p className="text-[13px] text-[var(--text-2)] font-normal leading-tight mb-3">
                  Aged receivables
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {/* 0-30 days */}
                  <div>
                    <span className="text-[12px] text-[var(--text-3)] font-normal block mb-1 truncate">
                      0-30 days
                    </span>
                    <span
                      title={formatINR(stats.aging.b0_30)}
                      className="text-[15px] font-medium text-[var(--text-1)] tabular-nums block truncate"
                    >
                      {formatCompactINR(stats.aging.b0_30)}
                    </span>
                    <div className="h-[3px] w-full rounded-full bg-white/[0.08] mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--text-2)] transition-all duration-300"
                        style={{ width: `${pct0_30}%` }}
                      />
                    </div>
                  </div>

                  {/* 31-60 */}
                  <div>
                    <span className="text-[12px] text-[var(--text-3)] font-normal block mb-1 truncate">
                      31-60
                    </span>
                    <span
                      title={formatINR(stats.aging.b31_60)}
                      className="text-[15px] font-medium text-[var(--text-1)] tabular-nums block truncate"
                    >
                      {formatCompactINR(stats.aging.b31_60)}
                    </span>
                    <div className="h-[3px] w-full rounded-full bg-white/[0.08] mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--text-2)] transition-all duration-300"
                        style={{ width: `${pct31_60}%` }}
                      />
                    </div>
                  </div>

                  {/* 61-90 */}
                  <div>
                    <span className="text-[12px] text-[var(--text-3)] font-normal block mb-1 truncate">
                      61-90
                    </span>
                    <span
                      title={formatINR(stats.aging.b61_90)}
                      className="text-[15px] font-medium text-[var(--text-1)] tabular-nums block truncate"
                    >
                      {formatCompactINR(stats.aging.b61_90)}
                    </span>
                    <div className="h-[3px] w-full rounded-full bg-white/[0.08] mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--text-2)] transition-all duration-300"
                        style={{ width: `${pct61_90}%` }}
                      />
                    </div>
                  </div>

                  {/* 90+ (Red Tint) */}
                  <div>
                    <span className="text-[12px] text-[var(--text-3)] font-normal block mb-1 truncate">
                      90+
                    </span>
                    <span
                      title={formatINR(stats.aging.b90_plus)}
                      className="text-[15px] font-medium text-rose-400 tabular-nums block truncate"
                    >
                      {formatCompactINR(stats.aging.b90_plus)}
                    </span>
                    <div className="h-[3px] w-full rounded-full bg-white/[0.08] mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-500 transition-all duration-300"
                        style={{ width: `${pct90_plus}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-metric 2: Monthly Velocity */}
              <div>
                <p className="text-[13px] text-[var(--text-2)] font-normal leading-tight mb-3">
                  Monthly velocity
                </p>
                <p className="text-[15px] text-[var(--text-1)] font-medium tabular-nums">
                  {formatCompactINR(stats.thisMonthColl || stats.collected)} this month
                </p>
                <p className="text-[12px] text-[var(--text-3)] mt-1.5 tabular-nums">
                  vs {formatCompactINR(stats.lastMonthColl)} prior period
                </p>
              </div>

              {/* Sub-metric 3: Top Clearance Routes */}
              <div>
                <p className="text-[13px] text-[var(--text-2)] font-normal leading-tight mb-3">
                  Top clearance routes
                </p>
                <div className="flex items-center gap-2 h-6">
                  {stats.topClearance.slice(0, 5).map((item, idx) => {
                    const initials = item.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <div
                        key={idx}
                        title={`${item.name} (${item.rate}% clearance)`}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.08] text-[10px] font-medium text-[var(--text-1)] shrink-0"
                      >
                        {initials || `R${idx + 1}`}
                      </div>
                    );
                  })}
                  {stats.topClearance.length === 0 && (
                    <span className="text-[12px] text-[var(--text-3)]">Optimal</span>
                  )}
                </div>
                <p className="text-[12px] text-[var(--text-3)] mt-1.5">
                  Top collection routes
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* RIGHT CARD: Cash flow / Net balance (Radius 28px, padding 28px) */}
      <div className="rounded-[28px] p-7 glass-panel border border-white/[0.08] shadow-glass flex flex-col justify-between bg-white/[0.035]">
        <div>
          {/* Header & circular arrow button */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] text-[var(--text-3)] font-normal">Net balance</p>
              <div className="mt-1 flex items-baseline">
                <span className="text-[32px] opacity-55 font-light text-[var(--text-1)] mr-1">
                  ₹
                </span>
                <span className="text-[40px] font-medium leading-none tabular-nums text-[var(--text-1)]">
                  {new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
                    stats.netBal,
                  )}
                </span>
              </div>
            </div>

            {/* Circular Arrow Button navigating to Expenses tab */}
            <button
              onClick={() => onNavigateTab('expenses')}
              title="Navigate to Expense Tracking"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[var(--text-1)] hover:bg-white/[0.08] active:scale-95 transition focus:outline-none"
            >
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          {/* Three Mini Cards inside (Radius 20px, raised glass surface) */}
          <div className="grid grid-cols-3 gap-3 my-5">
            {/* Mini Card 1: Collected */}
            <button
              onClick={() => onSelectHeroMetric('collected')}
              className={`rounded-[20px] p-3.5 text-left border transition focus:outline-none ${
                selectedHeroMetric === 'collected'
                  ? 'bg-white/[0.08] border-[var(--accent-solid)]/40 shadow-sm'
                  : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.06]'
              }`}
            >
              <p className="text-[11px] text-[var(--text-3)]">Collected</p>
              <p className="text-[14px] font-medium text-[var(--text-1)] tabular-nums mt-1 truncate">
                {formatINR(stats.collected)}
              </p>
              <p className="text-[10px] text-emerald-400 font-medium mt-1">
                {collectedPctOfBilled}% of billed
              </p>
            </button>

            {/* Mini Card 2: Expenses */}
            <button
              onClick={() => onSelectHeroMetric('expenses')}
              className={`rounded-[20px] p-3.5 text-left border transition focus:outline-none ${
                selectedHeroMetric === 'expenses'
                  ? 'bg-white/[0.08] border-[var(--accent-solid)]/40 shadow-sm'
                  : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.06]'
              }`}
            >
              <p className="text-[11px] text-[var(--text-3)]">Expenses</p>
              <p className="text-[14px] font-medium text-[var(--text-1)] tabular-nums mt-1 truncate">
                {formatINR(stats.expTotal)}
              </p>
              <p className="text-[10px] text-rose-400 font-medium mt-1">
                {expPctOfCollected}% of collected
              </p>
            </button>

            {/* Mini Card 3: Outstanding */}
            <button
              onClick={() => onSelectHeroMetric('outstanding')}
              className={`rounded-[20px] p-3.5 text-left border transition focus:outline-none ${
                selectedHeroMetric === 'outstanding'
                  ? 'bg-white/[0.08] border-[var(--accent-solid)]/40 shadow-sm'
                  : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.06]'
              }`}
            >
              <p className="text-[11px] text-[var(--text-3)]">Outstanding</p>
              <p className="text-[14px] font-medium text-[var(--text-1)] tabular-nums mt-1 truncate">
                {formatINR(stats.outstanding)}
              </p>
              <p className="text-[10px] text-amber-400 font-medium mt-1">
                {outstandingPctOfBilled}% of billed
              </p>
            </button>
          </div>

          {/* Selected Metric Caption */}
          <div className="text-[11px] text-[var(--text-3)] mb-4">
            {selectedHeroMetric === 'collected' && (
              <span>₹{new Intl.NumberFormat('en-IN').format(stats.collected)} realized across settlement accounts.</span>
            )}
            {selectedHeroMetric === 'expenses' && (
              <span>Logged fleet overhead totals {formatINR(stats.expTotal)} this billing cycle.</span>
            )}
            {selectedHeroMetric === 'outstanding' && (
              <span>Active uncollected invoices total {stats.unpaidCount} balance items.</span>
            )}
          </div>
        </div>

        {/* Light pill button: View cheques (Section 2: btn-light) */}
        <button
          onClick={() => onNavigateTab('cheques')}
          className="btn-light h-10 px-6 rounded-full active:scale-98 font-medium text-[13px] flex items-center justify-center w-full transition shadow-sm focus:outline-none"
        >
          View cheques
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Workspace: Notched Tabs + List + Detail Split
// ----------------------------------------------------------------------
export function MainWorkspaceSection({
  workspaceTab,
  onWorkspaceTabChange,
  invoices,
  onOpenInvoice,
  onRecordPayment,
}: {
  workspaceTab: 'all' | 'unpaid' | 'partial' | 'paid';
  onWorkspaceTabChange: (tab: 'all' | 'unpaid' | 'partial' | 'paid') => void;
  invoices: InvoiceRow[];
  onOpenInvoice: (invoice: InvoiceRow) => void;
  onRecordPayment: (invoice: InvoiceRow) => void;
}) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [listLimit, setListLimit] = useState(20);

  // Filter invoices by notched workspace tab
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (workspaceTab === 'all') return true;
      if (workspaceTab === 'unpaid') return inv.paymentStatus === 'unpaid';
      if (workspaceTab === 'partial') return inv.paymentStatus === 'partial';
      if (workspaceTab === 'paid') return inv.paymentStatus === 'paid';
      return true;
    });
  }, [invoices, workspaceTab]);

  // Ensure an active invoice is selected
  useEffect(() => {
    if (filteredInvoices.length > 0) {
      const exists = filteredInvoices.some((i) => i._id === selectedInvoiceId);
      if (!exists) {
        setSelectedInvoiceId(filteredInvoices[0]._id);
      }
    } else {
      setSelectedInvoiceId('');
    }
  }, [filteredInvoices, selectedInvoiceId]);

  const activeInvoice = useMemo(() => {
    return filteredInvoices.find((i) => i._id === selectedInvoiceId) || filteredInvoices[0];
  }, [filteredInvoices, selectedInvoiceId]);

  // Keyboard navigation through invoice list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const currIdx = filteredInvoices.findIndex((i) => i._id === activeInvoice?._id);
      if (currIdx < filteredInvoices.length - 1) {
        setSelectedInvoiceId(filteredInvoices[currIdx + 1]._id);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const currIdx = filteredInvoices.findIndex((i) => i._id === activeInvoice?._id);
      if (currIdx > 0) {
        setSelectedInvoiceId(filteredInvoices[currIdx - 1]._id);
      }
    }
  };

  const tabs: { key: 'all' | 'unpaid' | 'partial' | 'paid'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unpaid', label: 'Unpaid' },
    { key: 'partial', label: 'Partial' },
    { key: 'paid', label: 'Paid' },
  ];

  const visibleInvoices = filteredInvoices.slice(0, listLimit);

  // Compute metrics for active invoice
  const tot = activeInvoice ? Number(activeInvoice.totalAmount || 0) : 0;
  const pd = activeInvoice ? Number(activeInvoice.paidAmount || 0) : 0;
  const ded = activeInvoice ? Number(activeInvoice.deductedAmount || 0) : 0;
  const rem = Math.max(0, tot - pd - ded);

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="rounded-[28px] border border-white/[0.08] glass-panel relative mt-8 pt-9 pb-6 px-6 shadow-glass focus:outline-none"
    >
      {/* Notched Tabs Capsule sitting centered on the top edge (Section 1) */}
      <div className="absolute -top-[22px] left-1/2 -translate-x-1/2 z-10 flex h-[44px] items-center rounded-full bg-[#060708] p-1 border border-white/[0.12] shadow-xl gap-1 select-none">
        {tabs.map((tab) => {
          const isActive = workspaceTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                onWorkspaceTabChange(tab.key);
                setListLimit(20);
              }}
              className={`rounded-full px-4 h-9 flex items-center justify-center text-[12px] font-medium transition focus:outline-none ${
                isActive
                  ? 'bg-[var(--text-1)] text-[#060708] font-semibold shadow-sm'
                  : 'text-[var(--text-2)] hover:text-[var(--text-1)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2-Column Split: 45% List, 55% Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-6 items-start mt-2">
        {/* Left Column: Invoice List */}
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {visibleInvoices.map((inv) => {
            const isSelected = inv._id === activeInvoice?._id;
            const shopInitials = (inv.shopName || 'Shop')
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            const isPaid = inv.paymentStatus === 'paid';
            const isPartial = inv.paymentStatus === 'partial';

            return (
              <div
                key={inv._id}
                onClick={() => setSelectedInvoiceId(inv._id)}
                className={`h-16 rounded-[20px] px-3.5 flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                  isSelected
                    ? 'bg-white/[0.08] border border-[var(--accent-solid)]/40 shadow-sm'
                    : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05]'
                }`}
              >
                {/* Initials & Title */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[12px] font-medium text-[var(--text-1)] border border-white/[0.06]">
                    {shopInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-[var(--text-1)] leading-tight">
                      {inv.shopName}
                    </p>
                    <p className="truncate text-[12px] font-mono text-[var(--text-3)] leading-tight mt-0.5">
                      #{inv.invoiceNumber}
                    </p>
                  </div>
                </div>

                {/* Route Tag, Amount & Status */}
                <div className="flex items-center gap-3 shrink-0">
                  {inv.route && (
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[11px] bg-white/[0.04] text-[var(--text-2)] border border-white/[0.06] truncate max-w-[85px]">
                      {inv.route}
                    </span>
                  )}
                  <span className="text-[14px] font-medium text-[var(--text-1)] tabular-nums">
                    {formatINR(inv.totalAmount)}
                  </span>
                  <StatusChip status={inv.paymentStatus || 'unpaid'} type="payment" />
                </div>
              </div>
            );
          })}

          {filteredInvoices.length === 0 && (
            <p className="py-12 text-center text-xs text-[var(--text-3)]">
              No invoices match this clearance status.
            </p>
          )}

          {filteredInvoices.length > visibleInvoices.length && (
            <div className="pt-2 text-center">
              <button
                onClick={() => setListLimit((prev) => prev + 20)}
                className="h-10 px-6 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[var(--text-2)] transition"
              >
                Show more ({filteredInvoices.length - visibleInvoices.length} remaining)
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Invoice Detail Panel (Radius 24px, darker inset) */}
        {activeInvoice ? (
          <div className="rounded-[24px] bg-[#030405]/80 border border-white/[0.06] p-6 shadow-inner flex flex-col justify-between min-h-[440px]">
            <div>
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
                <div>
                  <h3 className="text-[20px] font-mono font-medium text-[var(--text-1)]">
                    #{activeInvoice.invoiceNumber}
                  </h3>
                  <p className="text-[14px] text-[var(--text-2)] mt-0.5">
                    {activeInvoice.shopName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {activeInvoice.route && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] bg-white/[0.06] text-[var(--text-2)] border border-white/[0.08]">
                      Route: {activeInvoice.route}
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-full text-[11px] bg-white/[0.06] text-[var(--text-2)] border border-white/[0.08]">
                    {activeInvoice.date || 'Undated'}
                  </span>
                </div>
              </div>

              {/* 3-Column Metadata Cards (Radius 20px) */}
              <div className="grid grid-cols-3 gap-3 my-5">
                <div className="rounded-[20px] bg-white/[0.04] border border-white/[0.06] p-3 text-center">
                  <p className="text-[11px] text-[var(--text-3)]">Total amount</p>
                  <p className="text-[15px] font-medium text-[var(--text-1)] tabular-nums mt-1">
                    {formatINR(tot)}
                  </p>
                </div>
                <div className="rounded-[20px] bg-white/[0.04] border border-white/[0.06] p-3 text-center">
                  <p className="text-[11px] text-[var(--text-3)]">Paid amount</p>
                  <p className="text-[15px] font-medium text-emerald-400 tabular-nums mt-1">
                    {formatINR(pd)}
                  </p>
                </div>
                <div className="rounded-[20px] bg-white/[0.04] border border-white/[0.06] p-3 text-center">
                  <p className="text-[11px] text-[var(--text-3)]">Remaining</p>
                  <p className="text-[15px] font-medium text-amber-400 tabular-nums mt-1">
                    {formatINR(rem)}
                  </p>
                </div>
              </div>

              {/* Payment History List */}
              <div className="space-y-2 mb-4">
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-3)] font-medium">
                  Payment History
                </p>
                {activeInvoice.paymentHistory && activeInvoice.paymentHistory.length > 0 ? (
                  <div className="divide-y divide-white/[0.06] rounded-[20px] bg-white/[0.02] border border-white/[0.04] p-3">
                    {activeInvoice.paymentHistory.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 text-xs">
                        <span className="text-[var(--text-2)]">
                          {p.date} · <span className="capitalize">{p.mode}</span> by {p.collectedBy}
                        </span>
                        <span className="font-medium text-emerald-400 tabular-nums">
                          {formatINR(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-3)] italic py-2">
                    No payments recorded yet.
                  </p>
                )}
              </div>

              {/* Delivery Info */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs py-2 border-t border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 text-[var(--text-3)]" />
                  <span className="text-[var(--text-2)]">
                    Delivery: <StatusChip status={activeInvoice.deliveryStatus} type="delivery" className="ml-1" />
                    {activeInvoice.deliveryPerson ? ` (${activeInvoice.deliveryPerson})` : ''}
                  </span>
                </div>
                {activeInvoice.assignedTripId && (
                  <span className="text-[var(--text-3)]">
                    Trip #{activeInvoice.assignedTripId.slice(-6)}
                  </span>
                )}
              </div>

              {/* Deductions if any */}
              {ded > 0 && (
                <div className="text-xs text-amber-400 py-1">
                  Deductions applied: {formatINR(ded)}
                </div>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.06]">
              <button
                onClick={() => onOpenInvoice(activeInvoice)}
                className="h-10 px-5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-[var(--text-1)] transition focus:outline-none"
              >
                Open invoice
              </button>
              <button
                onClick={() => onRecordPayment(activeInvoice)}
                className="btn-light h-10 px-5 rounded-full active:scale-98 text-xs font-medium transition focus:outline-none"
              >
                Record payment
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] bg-[#030405]/80 border border-white/[0.06] p-12 text-center text-xs text-[var(--text-3)] flex items-center justify-center min-h-[440px]">
            Select an invoice to preview details
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 6 Chart & Insight Cards
// ----------------------------------------------------------------------

// 1. Chart: Billed vs Collected
export function ChartBilledVsCollected({
  data,
}: {
  data: { month: string; billed: number; collected: number }[];
}) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.billed, d.collected)), 1);
  const totalBilled = data.reduce((s, d) => s + d.billed, 0);
  const totalColl = data.reduce((s, d) => s + d.collected, 0);
  const eff = totalBilled > 0 ? Math.round((totalColl / totalBilled) * 100) : 0;

  return (
    <div className="rounded-[24px] border border-white/[0.08] glass-panel p-6 shadow-glass flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-medium text-[var(--text-1)]">
              Billed vs collected
            </h3>
            <p className="text-[12px] text-[var(--text-3)] mt-0.5">
              Monthly revenue and cleared totals
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[var(--text-3)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-white/30" />
              Billed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Collected
            </span>
          </div>
        </div>

        {/* Visual: Bars */}
        <div className="h-44 flex items-end justify-between gap-3 pt-6 pb-2">
          {data.map((item, idx) => {
            const billedH = Math.min(100, Math.round((item.billed / maxVal) * 100));
            const collH = Math.min(100, Math.round((item.collected / maxVal) * 100));
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <div className="flex items-end gap-1.5 w-full justify-center h-32">
                  <GlassTooltip
                    content={
                      <div className="space-y-0.5">
                        <p className="font-semibold text-[var(--text-1)]">{item.month}</p>
                        <p className="text-[var(--text-2)]">Billed: <span className="font-medium text-[var(--text-1)]">{formatINR(item.billed)}</span></p>
                        <p className="text-[var(--text-2)]">Collected: <span className="font-medium text-emerald-400">{formatINR(item.collected)}</span></p>
                      </div>
                    }
                  >
                    <div className="flex items-end gap-1.5 h-full cursor-pointer">
                      <div
                        style={{ height: `${Math.max(4, billedH)}%` }}
                        className="w-3 rounded-full bg-white/20 hover:bg-white/30 transition-all duration-300"
                      />
                      <div
                        style={{ height: `${Math.max(4, collH)}%` }}
                        className="w-3 rounded-full bg-emerald-500 hover:bg-emerald-400 transition-all duration-300"
                      />
                    </div>
                  </GlassTooltip>
                </div>
                <span className="text-[11px] text-[var(--text-3)] truncate">{item.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[12px] text-[var(--text-2)] pt-3 border-t border-white/[0.06] mt-2">
        Collection efficiency reached {eff}% across recent billing cycles.
      </p>
    </div>
  );
}

// 2. Chart: Payment Status (Donut)
export function ChartPaymentStatus({
  paid,
  partial,
  unpaid,
  total,
}: {
  paid: number;
  partial: number;
  unpaid: number;
  total: number;
}) {
  const sum = total > 0 ? total : Math.max(1, paid + partial + unpaid);
  const paidPct = Math.round((paid / sum) * 100);
  const partialPct = Math.round((partial / sum) * 100);
  const unpaidPct = Math.round((unpaid / sum) * 100);

  // Donut SVG circumference calculation
  const circ = 2 * Math.PI * 40;
  const strokePaid = (paid / sum) * circ;
  const strokePartial = (partial / sum) * circ;
  const strokeUnpaid = (unpaid / sum) * circ;

  return (
    <div className="rounded-[24px] border border-white/[0.08] glass-panel p-6 shadow-glass flex flex-col justify-between">
      <div>
        <h3 className="text-[15px] font-medium text-[var(--text-1)]">
          Payment status
        </h3>
        <p className="text-[12px] text-[var(--text-3)] mt-0.5">
          Distribution across registered invoices
        </p>

        {/* Visual: Donut & Legend */}
        <div className="flex items-center justify-around gap-4 py-4">
          <div className="relative h-28 w-28 shrink-0 flex items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="10"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#10b981"
                strokeWidth="10"
                strokeDasharray={`${strokePaid} ${circ}`}
                strokeDashoffset={0}
                className="transition-all duration-500"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="10"
                strokeDasharray={`${strokePartial} ${circ}`}
                strokeDashoffset={-strokePaid}
                className="transition-all duration-500"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="10"
                strokeDasharray={`${strokeUnpaid} ${circ}`}
                strokeDashoffset={-(strokePaid + strokePartial)}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-[18px] font-medium text-[var(--text-1)] tabular-nums">
                {total}
              </span>
              <span className="block text-[9px] uppercase tracking-wider text-[var(--text-3)]">
                Invoices
              </span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-[var(--text-2)]">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Paid
              </span>
              <span className="font-medium text-[var(--text-1)] tabular-nums">
                {paid} ({paidPct}%)
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-[var(--text-2)]">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Partial
              </span>
              <span className="font-medium text-[var(--text-1)] tabular-nums">
                {partial} ({partialPct}%)
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-[var(--text-2)]">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Unpaid
              </span>
              <span className="font-medium text-[var(--text-1)] tabular-nums">
                {unpaid} ({unpaidPct}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[12px] text-[var(--text-2)] pt-3 border-t border-white/[0.06] mt-2">
        {paidPct}% of active invoices have been completely cleared.
      </p>
    </div>
  );
}

// 3. Chart: Receivables Aging
export function ChartReceivablesAging({
  aging,
}: {
  aging: { b0_30: number; b31_60: number; b61_90: number; b90_plus: number };
}) {
  const total = aging.b0_30 + aging.b31_60 + aging.b61_90 + aging.b90_plus || 1;
  const past60 = aging.b61_90 + aging.b90_plus;

  const buckets = [
    { label: '0-30d', amount: aging.b0_30, color: 'bg-emerald-500' },
    { label: '31-60d', amount: aging.b31_60, color: 'bg-sky-500' },
    { label: '61-90d', amount: aging.b61_90, color: 'bg-amber-500' },
    { label: '90+d', amount: aging.b90_plus, color: 'bg-rose-500' },
  ];

  return (
    <div className="rounded-[24px] border border-white/[0.08] glass-panel p-6 shadow-glass flex flex-col justify-between">
      <div>
        <h3 className="text-[15px] font-medium text-[var(--text-1)]">
          Receivables aging
        </h3>
        <p className="text-[12px] text-[var(--text-3)] mt-0.5">
          Overdue breakdown by maturity
        </p>

        {/* Visual: Aging Bars */}
        <div className="space-y-3 py-4">
          {buckets.map((b) => {
            const pct = Math.round((b.amount / total) * 100);
            return (
              <div key={b.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-2)]">{b.label}</span>
                  <span className="font-medium text-[var(--text-1)] tabular-nums">
                    {formatINR(b.amount)} ({pct}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full rounded-full ${b.color} transition-all duration-300`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[12px] text-[var(--text-2)] pt-3 border-t border-white/[0.06] mt-2">
        {formatINR(past60)} is overdue past 60 days requiring follow-up.
      </p>
    </div>
  );
}

// 4. Chart: Outstanding by Route
export function ChartOutstandingByRoute({
  routes,
}: {
  routes: { route: string; outstanding: number; billed: number }[];
}) {
  const top8 = routes.slice(0, 8);
  const maxOutstanding = Math.max(...top8.map((r) => r.outstanding), 1);
  const totalOutstanding = top8.reduce((s, r) => s + r.outstanding, 0);
  const topRoute = top8[0];
  const topShare =
    topRoute && totalOutstanding > 0
      ? Math.round((topRoute.outstanding / totalOutstanding) * 100)
      : 0;

  return (
    <div className="rounded-[24px] border border-white/[0.08] glass-panel p-6 shadow-glass flex flex-col justify-between">
      <div>
        <h3 className="text-[15px] font-medium text-[var(--text-1)]">
          Outstanding by route
        </h3>
        <p className="text-[12px] text-[var(--text-3)] mt-0.5">
          Top routes by open invoice balance
        </p>

        {/* Horizontal Bars */}
        <div className="space-y-2 py-3 max-h-48 overflow-y-auto pr-1">
          {top8.map((r) => {
            const pct = Math.round((r.outstanding / maxOutstanding) * 100);
            return (
              <GlassTooltip
                key={r.route}
                className="w-full"
                content={
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[var(--text-1)]">{r.route}</p>
                    <p className="text-[var(--text-2)]">Outstanding: <span className="font-medium text-amber-400">{formatINR(r.outstanding)}</span></p>
                    <p className="text-[var(--text-2)]">Total Billed: <span className="font-medium text-[var(--text-1)]">{formatINR(r.billed)}</span></p>
                  </div>
                }
              >
                <div className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                  <span className="w-20 truncate text-[var(--text-2)] shrink-0">{r.route}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full rounded-full bg-[var(--accent-solid)] transition-all duration-300"
                    />
                  </div>
                  <span className="w-16 text-right font-medium text-[var(--text-1)] tabular-nums shrink-0">
                    {formatINR(r.outstanding)}
                  </span>
                </div>
              </GlassTooltip>
            );
          })}
          {top8.length === 0 && (
            <p className="py-6 text-center text-xs text-[var(--text-3)]">No open balances logged.</p>
          )}
        </div>
      </div>

      <p className="text-[12px] text-[var(--text-2)] pt-3 border-t border-white/[0.06] mt-2">
        {topRoute ? `${topRoute.route} represents ${topShare}% of top route balances.` : 'All route accounts nominal.'}
      </p>
    </div>
  );
}

// 5. Chart: Cheque Pipeline
export function ChartChequePipeline({
  cheques,
  onNavigateCheques,
}: {
  cheques: ChequeRow[];
  onNavigateCheques: () => void;
}) {
  const pending = cheques.filter((c) => c.status === 'pending');
  const deposited = cheques.filter((c) => c.status === 'deposited');
  const cleared = cheques.filter((c) => c.status === 'cleared');
  const bounced = cheques.filter((c) => c.status === 'bounced');

  const pendingAmt = pending.reduce((s, c) => s + Number(c.amount || 0), 0);
  const depositedAmt = deposited.reduce((s, c) => s + Number(c.amount || 0), 0);
  const clearedAmt = cleared.reduce((s, c) => s + Number(c.amount || 0), 0);
  const bouncedAmt = bounced.reduce((s, c) => s + Number(c.amount || 0), 0);

  const stages = [
    { label: 'Pending', count: pending.length, amount: pendingAmt, color: 'text-amber-400' },
    { label: 'Deposited', count: deposited.length, amount: depositedAmt, color: 'text-sky-400' },
    { label: 'Cleared', count: cleared.length, amount: clearedAmt, color: 'text-emerald-400' },
    { label: 'Bounced', count: bounced.length, amount: bouncedAmt, color: 'text-rose-400' },
  ];

  return (
    <div className="rounded-[24px] border border-white/[0.08] glass-panel p-6 shadow-glass flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-medium text-[var(--text-1)]">
              Cheque pipeline
            </h3>
            <p className="text-[12px] text-[var(--text-3)] mt-0.5">
              Clearance progression & deposit audit
            </p>
          </div>
          <button
            onClick={onNavigateCheques}
            className="text-xs text-[var(--text-3)] hover:text-[var(--text-1)] transition"
          >
            Audit →
          </button>
        </div>

        {/* 4 Pipeline stages */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-4">
          {stages.map((st) => (
            <div
              key={st.label}
              className="rounded-[20px] bg-white/[0.04] border border-white/[0.06] p-2.5 text-center"
            >
              <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">{st.label}</p>
              <p className={`text-[16px] font-medium tabular-nums mt-1 ${st.color}`}>
                {st.count}
              </p>
              <p className="text-[10px] text-[var(--text-2)] tabular-nums mt-0.5 truncate">
                {formatINR(st.amount)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[12px] text-[var(--text-2)] pt-3 border-t border-white/[0.06] mt-2">
        {pending.length} cheques ({formatINR(pendingAmt)}) awaiting clearance.
      </p>
    </div>
  );
}

// 6. Chart: Needs Attention
export function ChartNeedsAttention({
  overdue60Count,
  pendingChequesCount,
  pendingApprovalsCount,
  undeliveredTripsCount,
  onNavigateTab,
}: {
  overdue60Count: number;
  pendingChequesCount: number;
  pendingApprovalsCount: number;
  undeliveredTripsCount: number;
  onNavigateTab: (tab: TabKey) => void;
}) {
  const items: { label: string; count: number; tab: TabKey; color: string }[] = [];

  if (overdue60Count > 0) {
    items.push({
      label: `${overdue60Count} invoices overdue past 60 days`,
      count: overdue60Count,
      tab: 'invoices',
      color: 'text-rose-400',
    });
  }

  if (pendingChequesCount > 0) {
    items.push({
      label: `${pendingChequesCount} cheques pending deposit`,
      count: pendingChequesCount,
      tab: 'cheques',
      color: 'text-amber-400',
    });
  }

  if (pendingApprovalsCount > 0) {
    items.push({
      label: `${pendingApprovalsCount} payment approvals awaiting review`,
      count: pendingApprovalsCount,
      tab: 'approvals',
      color: 'text-[var(--accent-solid)]',
    });
  }

  if (undeliveredTripsCount > 0) {
    items.push({
      label: `${undeliveredTripsCount} undelivered invoices on active trips`,
      count: undeliveredTripsCount,
      tab: 'trips',
      color: 'text-sky-400',
    });
  }

  const totalActions = items.reduce((s, i) => s + i.count, 0);

  return (
    <div className="rounded-[24px] border border-white/[0.08] glass-panel p-6 shadow-glass flex flex-col justify-between">
      <div>
        <h3 className="text-[15px] font-medium text-[var(--text-1)]">
          Needs attention
        </h3>
        <p className="text-[12px] text-[var(--text-3)] mt-0.5">
          Actionable items & operational alerts
        </p>

        {/* Action list */}
        <div className="space-y-2 py-4">
          {items.map((it, idx) => (
            <button
              key={idx}
              onClick={() => onNavigateTab(it.tab)}
              className="flex w-full items-center justify-between p-2.5 rounded-[20px] bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] text-xs text-left transition"
            >
              <span className={`font-medium ${it.color}`}>{it.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-[var(--text-3)] shrink-0" />
            </button>
          ))}
          {items.length === 0 && (
            <p className="py-6 text-center text-xs text-emerald-400">
              All tasks cleared. No operational issues detected.
            </p>
          )}
        </div>
      </div>

      <p className="text-[12px] text-[var(--text-2)] pt-3 border-t border-white/[0.06] mt-2">
        {totalActions > 0
          ? `${totalActions} items require immediate administrative action.`
          : 'Zero critical bottlenecks across operational channels.'}
      </p>
    </div>
  );
}
