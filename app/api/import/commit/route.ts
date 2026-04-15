import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

function toIsoDate(year: number, month: number, day: number) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function normalizeImportDate(value: unknown, importYear: number) {
  if (value == null) return null;
  const text = String(value || '').trim();
  if (!text) return null;

  const dm = text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (dm) {
    // dd/mm format: dm[1]=day, dm[2]=month
    return toIsoDate(importYear, Number(dm[2]), Number(dm[1]));
  }

  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (dmy) {
    const yearRaw = dmy[3];
    const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
    return toIsoDate(year, Number(dmy[2]), Number(dmy[1]));
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return toIsoDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const rows: Array<Record<string, any>> = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return NextResponse.json({ error: 'No rows to import' }, { status: 400 });

    const duplicatesFound = rows.filter((r) => Boolean(r.duplicate)).length;
    const missingFound = rows.filter((r) => Boolean(r.hasError)).length;
    const ignoredTotalRows = Number(body.ignoredTotalRows || 0);

    const db = await getDb();
    const importYear = new Date().getFullYear();
    const clean = rows
      .filter((r) => !r.duplicate && !r.hasError)
      .map((r) => ({
        firm: String(r.firm || '').trim().toUpperCase(),
        invoiceNumber: String(r.invoiceNumber || '').trim(),
        date: normalizeImportDate(r.date, importYear) || '',
        route: String(r.route || '').trim(),
        shopName: String(r.shopName || '').trim(),
        totalAmount: Number(r.totalAmount || 0),
        paidAmount: 0,
        paymentStatus: 'unpaid',
        deliveryStatus: 'pending',
        deliveryPerson: null,
        notes: [],
        archived: false,
        paymentHistory: [],
        deductions: [],
        deductedAmount: 0,
        createdAt: new Date().toISOString(),
      }))
      .filter((r) => r.firm && r.invoiceNumber && r.date && r.route && r.shopName && Number.isFinite(r.totalAmount) && r.totalAmount !== 0);

    if (!clean.length) {
      return NextResponse.json({
        inserted: 0,
        duplicatesFound,
        missingFound,
        ignoredTotalRows,
        skipped: rows.length,
      });
    }

    const existing = await db
      .collection('invoices')
      .find({ invoiceNumber: { $in: clean.map((x) => x.invoiceNumber) } })
      .project({ invoiceNumber: 1 })
      .toArray();
    const existingSet = new Set(existing.map((x) => x.invoiceNumber));

    const toInsert = clean.filter((x) => !existingSet.has(x.invoiceNumber));
    if (toInsert.length) await db.collection('invoices').insertMany(toInsert, { ordered: false });

    return NextResponse.json({
      inserted: toInsert.length,
      duplicatesFound,
      missingFound,
      ignoredTotalRows,
      skipped: rows.length - toInsert.length,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error while importing invoices.' }, { status: 500 });
  }
}
