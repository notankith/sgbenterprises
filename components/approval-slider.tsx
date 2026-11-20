"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GlassPopover } from '@/components/glass-popover';
import { ArrowRight, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';

// ----------------------------------------------------------------------
// Slide-To-Confirm Control
// ----------------------------------------------------------------------
export interface SlideToConfirmProps {
  onConfirm: () => Promise<void>;
  onSuccessDone?: () => void;
  label?: string;
  successLabel?: string;
  variant?: 'approve' | 'reject';
  disabled?: boolean;
}

export function SlideToConfirm({
  onConfirm,
  onSuccessDone,
  label = 'Slide to approve',
  successLabel = 'Approved',
  variant = 'approve',
  disabled = false,
}: SlideToConfirmProps) {
  const shouldReduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isReject = variant === 'reject';
  const startPointerX = useRef(0);
  const initialDragX = useRef(0);

  // Compute maximum drag distance: trackWidth - handleSize(44) - padding(8)
  const getMaxDrag = useCallback(() => {
    if (!trackRef.current) return 220;
    return Math.max(80, trackRef.current.clientWidth - 44 - 8);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || isSubmitting || isSuccess) return;
    setIsDragging(true);
    setErrorMessage(null);
    startPointerX.current = e.clientX;
    initialDragX.current = dragX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || isSubmitting || isSuccess) return;
    const maxDrag = getMaxDrag();
    const delta = e.clientX - startPointerX.current;
    const nextX = Math.max(0, Math.min(maxDrag, initialDragX.current + delta));
    setDragX(nextX);
  };

  const executeConfirm = useCallback(async () => {
    const maxDrag = getMaxDrag();
    setDragX(maxDrag);
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onConfirm();
      setIsSuccess(true);
      setTimeout(() => {
        onSuccessDone?.();
      }, 800);
    } catch (err: any) {
      setIsSubmitting(false);
      setDragX(0);
      setErrorMessage(err?.message || 'Action failed. Please try again.');
    }
  }, [getMaxDrag, onConfirm, onSuccessDone]);

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    const maxDrag = getMaxDrag();
    const progress = maxDrag > 0 ? dragX / maxDrag : 0;

    if (progress >= 0.85) {
      executeConfirm();
    } else {
      // Spring back to start
      setDragX(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || isSubmitting || isSuccess) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      executeConfirm();
    }
  };

  const maxDrag = getMaxDrag();
  const progress = maxDrag > 0 ? dragX / maxDrag : 0;

  return (
    <div className="w-full flex flex-col gap-2">
      {/* 52px Tall Pill Track */}
      <div
        ref={trackRef}
        className={`relative h-[52px] w-full rounded-full border overflow-hidden select-none transition-colors duration-300 ${
          isSuccess
            ? isReject
              ? 'bg-rose-500/20 border-rose-500/40'
              : 'bg-[var(--ok-bg)] border-[var(--ok)]/40'
            : 'bg-white/[0.04] border-white/[0.14]'
        }`}
      >
        {/* Fill behind handle */}
        <div
          className={`absolute top-0 bottom-0 left-0 transition-all ${
            isSuccess
              ? isReject
                ? 'bg-rose-500/30'
                : 'bg-[var(--accent-solid)]/30'
              : isDragging
              ? 'duration-0'
              : 'duration-250 ease-out'
          } ${
            isReject ? 'bg-rose-500/30' : 'bg-[var(--accent-solid)]/30'
          }`}
          style={{
            width: isSuccess ? '100%' : `${dragX + 44 + 4}px`,
          }}
        />

        {/* Center Track Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-12">
          {isSuccess ? (
            <span
              className={`text-[14px] font-semibold flex items-center gap-2 ${
                isReject ? 'text-rose-400' : 'text-[var(--ok)]'
              }`}
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
              <span>{successLabel}</span>
            </span>
          ) : isSubmitting ? (
            <span className="text-[13px] text-[var(--text-2)] flex items-center gap-2 font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--text-1)]" />
              <span>Processing...</span>
            </span>
          ) : (
            <span
              className={`text-[13px] font-medium transition-opacity ${
                isDragging && progress > 0.4 ? 'opacity-20' : 'opacity-100'
              } ${shouldReduceMotion ? 'text-[var(--text-3)]' : 'animate-shimmer-text'}`}
            >
              {label}
            </span>
          )}
        </div>

        {/* 44px Circular Handle */}
        {!isSuccess && (
          <div
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
            style={{
              transform: `translateX(${dragX}px)`,
              transition: isDragging ? 'none' : 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            className={`absolute top-1 left-1 h-11 w-11 rounded-full flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 select-none touch-none ${
              isReject
                ? 'bg-rose-500 text-white'
                : 'bg-[var(--accent-solid)] text-[var(--on-accent)]'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isReject ? (
              <X className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            )}
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-rose-400 px-1 mt-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Approval Confirmation Popover (Section 4)
// ----------------------------------------------------------------------
export interface ApprovalItemData {
  _id: string;
  type?: string;
  shopName?: string;
  invoiceNumber?: string;
  amount?: number;
  requester?: string;
  date?: string;
  mode?: string;
  notes?: string;
}

export function ApprovalConfirmPopover({
  isOpen,
  onClose,
  anchorEl,
  approval,
  actionType,
  onExecute,
}: {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  approval: ApprovalItemData | null;
  actionType: 'approve' | 'reject';
  onExecute: () => Promise<void>;
}) {
  if (!isOpen || !approval) return null;

  const isReject = actionType === 'reject';
  const itemName =
    approval.shopName || approval.invoiceNumber || approval.type || 'Request Claim';
  const amountStr =
    typeof approval.amount === 'number'
      ? new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(approval.amount)
      : '';

  return (
    <GlassPopover
      isOpen={isOpen}
      onClose={onClose}
      anchorEl={anchorEl}
      width={330}
      id={`approval-confirm-${approval._id}`}
      className="p-4 flex flex-col gap-3.5 text-xs select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
        <h3 className="text-[14px] font-medium text-[var(--text-1)]">
          {isReject ? 'Reject this request?' : 'Approve this request?'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-white/[0.08] transition"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Item Summary Card */}
      <div className="rounded-[14px] bg-white/[0.035] border border-white/[0.08] p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-medium text-[13px] text-[var(--text-1)] truncate max-w-[200px]">
            {itemName}
          </span>
          {amountStr && (
            <span
              className={`font-semibold num-tabular text-[14px] ${
                isReject ? 'text-rose-400' : 'text-[var(--ok)]'
              }`}
            >
              {amountStr}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[var(--text-3)] pt-1 border-t border-white/[0.05]">
          <span>Requested by:</span>
          <span className="text-[var(--text-2)] font-medium">
            {approval.requester || 'Driver'}
          </span>
        </div>

        {approval.mode && (
          <div className="flex items-center justify-between text-[11px] text-[var(--text-3)]">
            <span>Payment mode:</span>
            <span className="text-[var(--text-2)] uppercase font-medium">
              {approval.mode}
            </span>
          </div>
        )}

        {approval.notes && (
          <div className="text-[11px] text-[var(--text-3)] italic truncate pt-0.5">
            &ldquo;{approval.notes}&rdquo;
          </div>
        )}
      </div>

      {/* Slide to Confirm Control */}
      <div className="pt-1">
        <SlideToConfirm
          variant={actionType}
          label={isReject ? 'Slide to reject' : 'Slide to approve'}
          successLabel={isReject ? 'Rejected' : 'Approved'}
          onConfirm={onExecute}
          onSuccessDone={onClose}
        />
      </div>
    </GlassPopover>
  );
}
