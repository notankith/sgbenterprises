import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

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
    const clean = rows
      .filter((r) => !r.duplicate && !r.hasError)
      .map((r) => ({
        invoiceNumber: String(r.invoiceNumber || '').trim(),
        date: String(r.date || '').trim(),
        shopName: String(r.shopName || '').trim(),
        totalAmount: Number(r.totalAmount || 0),
        paidAmount: 0,
        paymentStatus: 'unpaid',
        deliveryStatus: 'pending',
        deliveryPerson: null,
        notes: [],
        archived: false,
        paymentHistory: [],
        createdAt: new Date().toISOString(),
      }))
      .filter((r) => r.invoiceNumber && r.shopName && r.date && r.totalAmount > 0);

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
