"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Search,
  Calendar,
  X,
} from 'lucide-react';

// ----------------------------------------------------------------------
// Global Single-Popover Coordinator (Section 1 & 6: Never two popovers at once)
// ----------------------------------------------------------------------
type PopoverCloseFn = () => void;
const popoverRegistry = new Map<string, PopoverCloseFn>();

export function registerPopover(id: string, closeFn: PopoverCloseFn) {
  popoverRegistry.set(id, closeFn);
  return () => {
    popoverRegistry.delete(id);
  };
}

export function notifyPopoverOpened(currentId: string) {
  popoverRegistry.forEach((closeFn, id) => {
    if (id !== currentId) {
      try {
        closeFn();
      } catch (err) {
        console.error('Error closing popover:', err);
      }
    }
  });
}

export function closeAllPopovers() {
  popoverRegistry.forEach((closeFn) => {
    try {
      closeFn();
    } catch (err) {
      console.error('Error closing popover:', err);
    }
  });
}

// ----------------------------------------------------------------------
// Date Formatting Helpers: "YYYY-MM-DD" <-> "18 Nov 2026"
// ----------------------------------------------------------------------
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_FULL_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 0 && m < 12) {
      return `${d} ${MONTH_NAMES[m]} ${y}`;
    }
  }
  return dateStr;
}

export function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ----------------------------------------------------------------------
// Anchor Position Calculation Hook (Portal on document.body, z-index 1001)
// ----------------------------------------------------------------------
export function useAnchorPosition(
  anchorEl: HTMLElement | null,
  isOpen: boolean,
  estimatedWidth = 296,
  estimatedHeight = 320,
  align: 'left' | 'right' | 'auto' = 'left',
) {
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width?: number;
    transformOrigin: string;
  }>({
    top: 0,
    left: 0,
    transformOrigin: 'top left',
  });

  const updatePos = useCallback(() => {
    if (!anchorEl || typeof window === 'undefined') return;
    const rect = anchorEl.getBoundingClientRect();

    let top = rect.bottom + 8;
    let transformOriginY = 'top';

    // Flip upward if overflowing viewport bottom and room exists above
    if (
      top + estimatedHeight > window.innerHeight - 16 &&
      rect.top > estimatedHeight + 16
    ) {
      top = rect.top - estimatedHeight - 8;
      transformOriginY = 'bottom';
    }

    let left = rect.left;
    let transformOriginX = 'left';

    if (align === 'right') {
      left = rect.right - estimatedWidth;
      transformOriginX = 'right';
    }

    // Clamp horizontally within window viewport bounds
    if (left + estimatedWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - estimatedWidth - 16);
      transformOriginX = 'right';
    }
    if (left < 16) {
      left = 16;
      transformOriginX = 'left';
    }

    setPos({
      top: Math.round(top),
      left: Math.round(left),
      width: Math.round(rect.width),
      transformOrigin: `${transformOriginY} ${transformOriginX}`,
    });
  }, [anchorEl, estimatedWidth, estimatedHeight, align]);

  useEffect(() => {
    if (!isOpen) return;
    updatePos();

    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);

    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [isOpen, updatePos]);

  return pos;
}

// ----------------------------------------------------------------------
// Universal Glass Popover Container (Sections 1, 2, 3, 4, 6, 7)
// ----------------------------------------------------------------------
export function GlassPopover({
  isOpen,
  onClose,
  anchorEl,
  children,
  className = '',
  width,
  minWidth,
  maxWidth = 320,
  maxHeight,
  estimatedHeight = 320,
  align = 'left',
  id,
}: {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  children: ReactNode;
  className?: string;
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  estimatedHeight?: number;
  align?: 'left' | 'right' | 'auto';
  id?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverIdRef = useRef(id || `popover-${Math.random().toString(36).slice(2, 9)}`);

  const estW = typeof width === 'number' ? width : 296;
  const pos = useAnchorPosition(anchorEl, isOpen, estW, estimatedHeight, align);

  // Register in global single-popover manager
  useEffect(() => {
    const popoverId = popoverIdRef.current;
    const unregister = registerPopover(popoverId, onClose);
    return unregister;
  }, [onClose]);

  // When opened, close any other currently open popover
  useEffect(() => {
    if (isOpen) {
      notifyPopoverOpened(popoverIdRef.current);
    }
  }, [isOpen]);

  // Focus trap, Escape key handling, and return focus to trigger on close (Section 7)
  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;

    // Focus first focusable element inside the popover
    const timer = setTimeout(() => {
      if (popoverRef.current) {
        const focusable = popoverRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    }, 25);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && popoverRef.current) {
        const focusable = Array.from(
          popoverRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Section 4: Full-Screen Sibling Backdrop Overlay (blur 6px, bg rgba(0,0,0,0.35), 200ms fade) */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="glass-popover-backdrop"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Section 3 & 7: Popover Surface (scale 0.97 -> 1, 160ms cubic-bezier, exit 120ms) */}
          <motion.div
            key="panel"
            ref={popoverRef}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{
              duration: shouldReduceMotion ? 0.1 : 0.16,
              exit: { duration: 0.12 },
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              position: 'fixed',
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              width: width ?? undefined,
              minWidth: minWidth ?? (pos.width ? Math.max(pos.width, 200) : 200),
              maxWidth: maxWidth ?? 320,
              maxHeight: maxHeight ?? undefined,
              zIndex: 1001,
              transformOrigin: pos.transformOrigin,
            }}
            className={`glass-popover-panel flex flex-col ${className}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ----------------------------------------------------------------------
// Pure Calendar View Component (Section 5: Reusable inline or in popovers)
// ----------------------------------------------------------------------
export interface CalendarViewProps {
  value: string; // "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
  partnerDate?: string;
  isFromDate?: boolean;
  onClear?: () => void;
  onToday?: () => void;
  className?: string;
}

export function CalendarView({
  value,
  onChange,
  partnerDate,
  isFromDate = true,
  onClear,
  onToday,
  className = '',
}: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<'days' | 'month-year'>('days');

  // Parse initial selected date or default to current date
  const parsedDate = useMemo(() => {
    if (!value) return new Date();
    const parts = value.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      return !isNaN(dt.getTime()) ? dt : new Date();
    }
    return new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(parsedDate.getMonth());
  const [focusedDayStr, setFocusedDayStr] = useState<string>(value || toIsoDate(new Date()));

  useEffect(() => {
    setViewYear(parsedDate.getFullYear());
    setViewMonth(parsedDate.getMonth());
    setFocusedDayStr(value || toIsoDate(new Date()));
  }, [parsedDate, value]);

  const todayStr = useMemo(() => toIsoDate(new Date()), []);

  // Compute Days for 7-Column Grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const dayOfWeek = firstDay.getDay(); // 0 = Sunday
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      dateObj: Date;
    }[] = [];

    // Prev month padding days
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(viewYear, viewMonth - 1, dayNum);
      days.push({
        dateStr: toIsoDate(d),
        dayNumber: dayNum,
        isCurrentMonth: false,
        dateObj: d,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const d = new Date(viewYear, viewMonth, i);
      days.push({
        dateStr: toIsoDate(d),
        dayNumber: i,
        isCurrentMonth: true,
        dateObj: d,
      });
    }

    // Next month padding days to complete grid
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      days.push({
        dateStr: toIsoDate(d),
        dayNumber: i,
        isCurrentMonth: false,
        dateObj: d,
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (dateStr: string) => {
    onChange(dateStr);
  };

  const handleClear = () => {
    if (onClear) onClear();
    else onChange('');
  };

  const handleToday = () => {
    if (onToday) onToday();
    else onChange(todayStr);
  };

  // Keyboard navigation: arrows move days, Enter selects
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (viewMode === 'days') {
      const curr = new Date(focusedDayStr);
      let nextDate: Date | null = null;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nextDate = new Date(curr.setDate(curr.getDate() - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextDate = new Date(curr.setDate(curr.getDate() + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nextDate = new Date(curr.setDate(curr.getDate() - 7));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nextDate = new Date(curr.setDate(curr.getDate() + 7));
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        handlePrevMonth();
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        handleNextMonth();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectDay(focusedDayStr);
      }

      if (nextDate) {
        const iso = toIsoDate(nextDate);
        setFocusedDayStr(iso);
        if (nextDate.getMonth() !== viewMonth || nextDate.getFullYear() !== viewYear) {
          setViewMonth(nextDate.getMonth());
          setViewYear(nextDate.getFullYear());
        }
      }
    }
  };

  // Range calculation for From/To partner date
  const rangeStart = isFromDate ? value : partnerDate;
  const rangeEnd = isFromDate ? partnerDate : value;

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`w-full max-w-[296px] select-none focus:outline-none ${className}`}
    >
      {/* Header: Month and Year (15px / 500) + 32px Circular Prev/Next Buttons */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-white/[0.08] active:scale-95 transition"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={() => setViewMode((v) => (v === 'days' ? 'month-year' : 'days'))}
          className="px-2.5 py-1 rounded-full text-[15px] font-medium text-[var(--text-1)] hover:bg-white/[0.08] transition"
        >
          {MONTH_FULL_NAMES[viewMonth]} {viewYear}
        </button>

        <button
          type="button"
          onClick={handleNextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-white/[0.08] active:scale-95 transition"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Month-Year Fast Selection Grid (4x3) */}
      {viewMode === 'month-year' ? (
        <div className="py-2">
          <div className="flex items-center justify-between px-2 mb-3">
            <span className="text-xs text-[var(--text-3)] uppercase tracking-wider font-medium">
              Select Month ({viewYear})
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                className="h-6 px-2 rounded-full text-xs text-[var(--text-2)] hover:bg-white/[0.06]"
              >
                -1y
              </button>
              <button
                type="button"
                onClick={() => setViewYear((y) => y + 1)}
                className="h-6 px-2 rounded-full text-xs text-[var(--text-2)] hover:bg-white/[0.06]"
              >
                +1y
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_NAMES.map((mName, mIdx) => {
              const isSelectedMonth =
                viewMonth === mIdx && viewYear === parsedDate.getFullYear();
              return (
                <button
                  key={mName}
                  type="button"
                  onClick={() => {
                    setViewMonth(mIdx);
                    setViewMode('days');
                  }}
                  className={`h-9 rounded-[12px] text-xs font-medium transition ${
                    isSelectedMonth
                      ? 'bg-[var(--accent-solid)] text-[var(--on-accent)] font-semibold'
                      : 'text-[var(--text-1)] hover:bg-white/[0.08]'
                  }`}
                >
                  {mName}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Days 7-Column Grid */
        <div>
          {/* Weekday Row: 12px text-3 */}
          <div className="grid grid-cols-7 gap-1 text-center text-[12px] text-[var(--text-3)] font-medium mb-1">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* 7-Column Grid of 36px Day Cells, radius 999px */}
          <div className="grid grid-cols-7 gap-y-1">
            {calendarDays.map((cell) => {
              const isSelected = cell.dateStr === value;
              const isToday = cell.dateStr === todayStr;
              const isKeyboardFocused = cell.dateStr === focusedDayStr;

              // Soft white 6% band between From and To
              const inRange =
                rangeStart &&
                rangeEnd &&
                cell.dateStr > rangeStart &&
                cell.dateStr < rangeEnd;

              return (
                <div
                  key={cell.dateStr}
                  className={`relative flex items-center justify-center ${
                    inRange ? 'bg-white/[0.06]' : ''
                  } first:rounded-l-full last:rounded-r-full`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectDay(cell.dateStr)}
                    className={`h-9 w-9 rounded-full flex items-center justify-center text-[14px] tabular-nums transition focus:outline-none ${
                      isSelected
                        ? 'bg-[var(--accent-solid)] text-[var(--on-accent)] font-semibold shadow-sm'
                        : isToday
                        ? 'ring-1 ring-white/40 text-[var(--text-1)] hover:bg-white/[0.08]'
                        : isKeyboardFocused
                        ? 'bg-white/[0.12] text-[var(--text-1)]'
                        : cell.isCurrentMonth
                        ? 'text-[var(--text-1)] hover:bg-white/[0.08]'
                        : 'text-[var(--text-3)] opacity-30 hover:opacity-70 hover:bg-white/[0.08]'
                    }`}
                  >
                    {cell.dayNumber}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer: "Clear" and "Today" Ghost Text Buttons */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/[0.08] text-xs">
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1 rounded-full text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-white/[0.06] transition"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 rounded-full text-[var(--text-1)] hover:bg-white/[0.06] font-medium transition"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Standalone Glass Date Picker Popover (Wraps CalendarView)
// ----------------------------------------------------------------------
export function GlassDatePicker({
  isOpen,
  onClose,
  anchorEl,
  value,
  onChange,
  partnerDate,
  isFromDate = true,
  id,
}: {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  value: string;
  onChange: (val: string) => void;
  partnerDate?: string;
  isFromDate?: boolean;
  id?: string;
}) {
  return (
    <GlassPopover
      isOpen={isOpen}
      onClose={onClose}
      anchorEl={anchorEl}
      width={296}
      estimatedHeight={350}
      id={id || 'standalone-date-picker'}
      className="p-3"
    >
      <CalendarView
        value={value}
        onChange={(val) => {
          onChange(val);
          onClose();
        }}
        partnerDate={partnerDate}
        isFromDate={isFromDate}
        onClear={() => {
          onChange('');
          onClose();
        }}
        onToday={() => {
          onChange(toIsoDate(new Date()));
          onClose();
        }}
      />
    </GlassPopover>
  );
}

// ----------------------------------------------------------------------
// Trigger Pill for From / To Dates (Section 4: Height 44px, Radius 999px)
// ----------------------------------------------------------------------
export function GlassDatePill({
  value,
  onChange,
  placeholder,
  partnerDate,
  isFromDate = true,
  className = '',
  id,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  partnerDate?: string;
  isFromDate?: boolean;
  className?: string;
  id?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement>(null);
  const pillId = useMemo(
    () => id || `date-pill-${isFromDate ? 'from' : 'to'}-${Math.random().toString(36).slice(2, 6)}`,
    [id, isFromDate],
  );

  const displayDate = formatDisplayDate(value);
  const hasValue = Boolean(value);

  const handleToggle = () => {
    if (!isOpen) {
      notifyPopoverOpened(pillId);
    }
    setIsOpen((prev) => !prev);
  };

  // Close when another popover opens
  useEffect(() => {
    const unregister = registerPopover(pillId, () => setIsOpen(false));
    return unregister;
  }, [pillId]);

  return (
    <div className={`relative inline-block ${className}`}>
      {/* 44px pill container with hairline border */}
      <button
        ref={pillRef}
        type="button"
        onClick={handleToggle}
        className={`inline-flex h-11 items-center gap-2.5 px-4 rounded-full text-[13px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]/40 ${
          isOpen || hasValue
            ? 'bg-white/[0.08] border border-white/[0.28] text-[var(--text-1)]'
            : 'bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-[var(--text-2)] hover:text-[var(--text-1)]'
        }`}
      >
        <span className={hasValue ? 'text-[var(--text-1)] font-medium' : 'text-[var(--text-3)]'}>
          {hasValue ? displayDate : placeholder}
        </span>
        <Calendar className="h-4 w-4 text-[var(--text-3)] shrink-0" strokeWidth={1.5} />
      </button>

      {/* Hidden native input kept in DOM for forms/tests compatibility */}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Standalone Glass Date Picker */}
      <GlassDatePicker
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorEl={pillRef.current}
        value={value}
        onChange={onChange}
        partnerDate={partnerDate}
        isFromDate={isFromDate}
        id={pillId}
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// Form Date Input (Replaces native input in forms and modal dialogs)
// ----------------------------------------------------------------------
export function GlassDateInput({
  value,
  onChange,
  placeholder = 'Select date',
  partnerDate,
  isFromDate = true,
  className = '',
  id,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  partnerDate?: string;
  isFromDate?: boolean;
  className?: string;
  id?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputId = useMemo(
    () => id || `date-input-${Math.random().toString(36).slice(2, 8)}`,
    [id],
  );

  const displayDate = formatDisplayDate(value);
  const hasValue = Boolean(value);

  const handleToggle = () => {
    if (!isOpen) {
      notifyPopoverOpened(inputId);
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    const unregister = registerPopover(inputId, () => setIsOpen(false));
    return unregister;
  }, [inputId]);

  return (
    <div className={`relative inline-block w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={`w-full flex items-center justify-between px-3 h-8 rounded-lg text-xs font-normal transition text-left border focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]/40 ${
          isOpen || hasValue
            ? 'bg-white/[0.08] border-white/[0.28] text-[var(--text-1)]'
            : 'bg-white/[0.04] border-white/[0.08] text-[var(--text-3)] hover:border-white/20'
        }`}
      >
        <span className={hasValue ? 'text-[var(--text-1)] font-medium truncate' : 'text-[var(--text-3)]'}>
          {hasValue ? displayDate : placeholder}
        </span>
        <Calendar className="h-3.5 w-3.5 text-[var(--text-3)] shrink-0 ml-1.5" strokeWidth={1.5} />
      </button>

      {/* Hidden native input kept in DOM for forms/tests compatibility */}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      <GlassDatePicker
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorEl={triggerRef.current}
        value={value}
        onChange={onChange}
        partnerDate={partnerDate}
        isFromDate={isFromDate}
        id={inputId}
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// Reusable Glass Dropdown List (Section 3: Firm, Route, and similar)
// ----------------------------------------------------------------------
export function GlassDropdown({
  triggerLabel,
  options,
  selected,
  onSelect,
  placeholder = 'Select option...',
  className = '',
  id,
}: {
  triggerLabel?: string;
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (val: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dropdownId = useMemo(
    () => id || `dropdown-${Math.random().toString(36).slice(2, 8)}`,
    [id],
  );

  const selectedOption = options.find((o) => o.value === selected);
  const isFiltered = Boolean(selected);
  const displayLabel = selectedOption ? selectedOption.label : (triggerLabel || placeholder);

  // Filter options based on search query when options > 8
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, searchQuery]);

  const handleOpen = () => {
    notifyPopoverOpened(dropdownId);
    setSearchQuery('');
    setHighlightedIndex(-1);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelect = (val: string) => {
    onSelect(val);
    handleClose();
  };

  useEffect(() => {
    const unregister = registerPopover(dropdownId, handleClose);
    return unregister;
  }, [dropdownId]);

  // Keyboard navigation: Arrow keys, Enter, Esc, type-ahead
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const char = e.key.toLowerCase();
      const matchIdx = filteredOptions.findIndex((o) =>
        o.label.toLowerCase().startsWith(char),
      );
      if (matchIdx !== -1) {
        setHighlightedIndex(matchIdx);
      }
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightedIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Pill: Height 44px, radius 999px, hairline border */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        onKeyDown={handleKeyDown}
        className={`inline-flex h-11 items-center justify-between gap-2 px-4 rounded-full text-[13px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-solid)]/40 ${
          isOpen || isFiltered
            ? 'bg-white/[0.08] border border-white/[0.28] text-[var(--text-1)]'
            : 'bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-[var(--text-2)] hover:text-[var(--text-1)]'
        }`}
      >
        <span className="truncate max-w-[150px]">{displayLabel}</span>
        <ChevronDown
          className={`h-4 w-4 text-[var(--text-3)] transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[var(--text-1)]' : ''
          }`}
          strokeWidth={1.5}
        />
      </button>

      {/* Popover Portal */}
      <GlassPopover
        isOpen={isOpen}
        onClose={handleClose}
        anchorEl={triggerRef.current}
        maxWidth={320}
        maxHeight={320}
        id={dropdownId}
      >
        <div className="flex flex-col select-none max-h-[304px]">
          {/* Search field if > 8 options */}
          {options.length > 8 && (
            <div className="relative mb-2 px-1">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-3)] pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                className="w-full h-8 pl-8 pr-3 rounded-[10px] bg-white/[0.05] border border-white/[0.08] text-xs text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:border-white/20"
                autoFocus
              />
            </div>
          )}

          {/* Option rows: 36px high, radius 12px, padding 0 12px, text-1 */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto space-y-0.5 pr-0.5 glass-dropdown-scroll max-h-[240px]"
          >
            {filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === selected;
              const isHighlighted = idx === highlightedIndex;
              return (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`h-9 rounded-[12px] px-3 flex items-center justify-between text-[14px] cursor-pointer transition select-none ${
                    isSelected
                      ? 'bg-white/10 text-[var(--text-1)] font-medium'
                      : isHighlighted
                      ? 'bg-white/[0.07] text-[var(--text-1)]'
                      : 'text-[var(--text-1)] hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check
                      className="h-4 w-4 text-[var(--text-1)] shrink-0 ml-2"
                      strokeWidth={2}
                    />
                  )}
                </div>
              );
            })}

            {filteredOptions.length === 0 && (
              <p className="py-4 text-center text-xs text-[var(--text-3)]">
                No matching options
              </p>
            )}
          </div>
        </div>
      </GlassPopover>
    </div>
  );
}

// ----------------------------------------------------------------------
// Glass Checkbox: 16px, radius 5px, 1px border rgba(255,255,255,0.3)
// Checked = --accent-solid fill with --on-accent check
// ----------------------------------------------------------------------
export function GlassCheckbox({
  checked,
  onChange,
  label,
  sublabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  sublabel?: string;
}) {
  return (
    <label className="flex items-center gap-2.5 px-3 h-9 rounded-[12px] text-xs cursor-pointer hover:bg-white/[0.07] transition-colors select-none">
      <span
        className={`relative inline-flex items-center justify-center w-4 h-4 rounded-[5px] border transition-colors flex-shrink-0 ${
          checked
            ? 'bg-[var(--accent-solid)] border-[var(--accent-solid)] text-[var(--on-accent)]'
            : 'border-white/30 bg-white/[0.04]'
        }`}
      >
        {checked && <Check className="w-3 h-3 text-[var(--on-accent)]" strokeWidth={2.5} />}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <div className="min-w-0 flex-1">
        <span className="text-[14px] text-[var(--text-1)] truncate block leading-tight">
          {label}
        </span>
        {sublabel && (
          <span className="text-[11px] text-[var(--text-3)] truncate block leading-tight mt-0.5">
            {sublabel}
          </span>
        )}
      </div>
    </label>
  );
}

// ----------------------------------------------------------------------
// Glass Tooltip Surface: blur 24px, radius 12px, padding 8px 12px, 12px text
// ----------------------------------------------------------------------
export function GlassTooltip({
  content,
  children,
  className = '',
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const showTooltip = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: Math.round(rect.top - 8),
        left: Math.round(rect.left + rect.width / 2),
      });
      setIsVisible(true);
    }
  };

  const hideTooltip = () => {
    setIsVisible(false);
  };

  return (
    <div
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      className={`inline-block ${className}`}
    >
      {children}
      {isVisible &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              transform: 'translate(-50%, -100%)',
              zIndex: 10000,
            }}
            className="glass-tooltip-panel select-none pointer-events-none"
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}
