"use client";

import React from 'react';

export type StatusCategory = 'payment' | 'delivery' | 'cheque' | 'approval' | 'auto';

export interface StatusChipProps {
  status: unknown;
  type?: StatusCategory;
  className?: string;
  rawTooltip?: boolean;
}

export function StatusChip({
  status,
  type = 'auto',
  className = '',
  rawTooltip = true,
}: StatusChipProps) {
  const rawStr = String(status ?? '').trim();
  const lower = rawStr.toLowerCase();

  let label = rawStr;
  let bgClass = 'bg-[var(--neutral-bg)] text-[var(--neutral)]';
  let dotClass = 'bg-[var(--neutral)]';

  // Determine category & display mapping
  const isPayment =
    type === 'payment' ||
    (type === 'auto' && ['paid', 'partial', 'unpaid', 'payable'].includes(lower));

  const isDelivery =
    type === 'delivery' ||
    (type === 'auto' && ['d', 'nd', 'delivered', 'pending', 'undelivered'].includes(lower));

  const isCheque =
    type === 'cheque' ||
    (type === 'auto' && ['deposited', 'cleared', 'bounced'].includes(lower));

  if (isPayment) {
    if (lower === 'paid' || lower === 'complete' || lower === 'optimal') {
      label = 'Paid';
      bgClass = 'bg-[var(--ok-bg)] text-[var(--ok)]';
      dotClass = 'bg-[var(--ok)]';
    } else if (lower === 'partial' || lower === 'payable') {
      label = lower === 'payable' ? 'Payable' : 'Partial';
      bgClass = 'bg-[var(--warn-bg)] text-[var(--warn)]';
      dotClass = 'bg-[var(--warn)]';
    } else {
      label = 'Unpaid';
      bgClass = 'bg-[var(--bad-bg)] text-[var(--bad)]';
      dotClass = 'bg-[var(--bad)]';
    }
  } else if (isDelivery) {
    if (lower === 'd' || lower === 'delivered') {
      label = 'Delivered';
      bgClass = 'bg-[var(--ok-bg)] text-[var(--ok)]';
      dotClass = 'bg-[var(--ok)]';
    } else if (lower === 'nd' || lower === 'pending' || lower === 'undelivered') {
      label = 'Not delivered';
      bgClass = 'bg-[var(--neutral-bg)] text-[var(--neutral)]';
      dotClass = 'bg-[var(--neutral)]';
    } else {
      label = rawStr ? rawStr.charAt(0).toUpperCase() + rawStr.slice(1) : 'Not delivered';
      bgClass = 'bg-[var(--neutral-bg)] text-[var(--neutral)]';
      dotClass = 'bg-[var(--neutral)]';
    }
  } else if (isCheque) {
    if (lower === 'cleared') {
      label = 'Cleared';
      bgClass = 'bg-[var(--ok-bg)] text-[var(--ok)]';
      dotClass = 'bg-[var(--ok)]';
    } else if (lower === 'deposited') {
      label = 'Deposited';
      bgClass = 'bg-[var(--info-bg)] text-[var(--info)]';
      dotClass = 'bg-[var(--info)]';
    } else if (lower === 'bounced') {
      label = 'Bounced';
      bgClass = 'bg-[var(--bad-bg)] text-[var(--bad)]';
      dotClass = 'bg-[var(--bad)]';
    } else {
      label = 'Pending';
      bgClass = 'bg-[var(--neutral-bg)] text-[var(--neutral)]';
      dotClass = 'bg-[var(--neutral)]';
    }
  } else {
    // General approval / status
    if (lower === 'approved' || lower === 'system healthy') {
      label = rawStr.charAt(0).toUpperCase() + rawStr.slice(1);
      bgClass = 'bg-[var(--ok-bg)] text-[var(--ok)]';
      dotClass = 'bg-[var(--ok)]';
    } else if (lower === 'rejected' || lower === 'delayed') {
      label = rawStr.charAt(0).toUpperCase() + rawStr.slice(1);
      bgClass = 'bg-[var(--bad-bg)] text-[var(--bad)]';
      dotClass = 'bg-[var(--bad)]';
    } else if (lower === 'transit' || lower === 'in transit') {
      label = rawStr.charAt(0).toUpperCase() + rawStr.slice(1);
      bgClass = 'bg-[var(--warn-bg)] text-[var(--warn)]';
      dotClass = 'bg-[var(--warn)]';
    } else {
      label = rawStr ? rawStr.charAt(0).toUpperCase() + rawStr.slice(1) : '-';
    }
  }

  return (
    <span
      title={rawTooltip && rawStr !== label ? `Raw: ${rawStr}` : undefined}
      className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium select-none whitespace-nowrap ${bgClass} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full mr-1.5 shrink-0 ${dotClass}`} />
      <span>{label}</span>
    </span>
  );
}

export default StatusChip;
