import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

const EXPORT_TYPES = ['invoices', 'tripsheets', 'payments', 'cheques', 'expenses'] as const;

type ExportType = (typeof EXPORT_TYPES)[number];

function parseTypes(value: string | null): ExportType[] {
  if (!value) return [...EXPORT_TYPES];
  const parts = value
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean) as ExportType[];
  const valid = parts.filter((x) => EXPORT_TYPES.includes(x));
  return valid.length ? valid : [...EXPORT_TYPES];
}

function withDateRange(filter: Record<string, any>, field: string, dateFrom: string, dateTo: string) {
  if (!dateFrom && !dateTo) return;
  filter[field] = {};
  if (dateFrom) filter[field].$gte = dateFrom;
  if (dateTo) filter[field].$lte = dateTo;
  if (!Object.keys(filter[field]).length) delete filter[field];
}

function cleanRows(rows: Record<string, any>[]) {
  return rows.map((row) => {
    const next: Record<string, any> = {};
    Object.keys(row).forEach((key) => {
      const value = row[key];
      if (value && typeof value === 'object' && typeof value.toISOString !== 'function') {
        next[key] = JSON.stringify(value);
      } else if (key === '_id' && value && typeof value.toString === 'function') {
        next[key] = value.toString();
      } else {
        next[key] = value;
      }
    });
    return next;
  });
}

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const types = parseTypes(searchParams.get('types'));
    const dateFrom = String(searchParams.get('dateFrom') || '').trim();
    const dateTo = String(searchParams.get('dateTo') || '').trim();
    const driver = String(searchParams.get('driver') || '').trim();
    const status = String(searchParams.get('status') || '').trim();

    const db = await getDb();
    const wb = XLSX.utils.book_new();

    if (types.includes('invoices')) {
      const invoiceFilter: Record<string, any> = { archived: { $ne: true } };
      withDateRange(invoiceFilter, 'date', dateFrom, dateTo);
      if (driver) invoiceFilter.deliveryPerson = { $regex: driver, $options: 'i' };
      if (status) invoiceFilter.paymentStatus = status;

      const rows = await db.collection('invoices').find(invoiceFilter).sort({ date: -1 }).toArray();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cleanRows(rows)), 'Invoices');
    }

    if (types.includes('tripsheets')) {
      const tripFilter: Record<string, any> = {};
      withDateRange(tripFilter, 'createdAt', dateFrom, dateTo);
      if (driver) tripFilter.agentName = { $regex: driver, $options: 'i' };
      if (status) tripFilter.status = status;

      const rows = await db.collection('trip_sheets').find(tripFilter).sort({ createdAt: -1 }).toArray();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cleanRows(rows)), 'Tripsheets');
    }

    if (types.includes('payments')) {
      const paymentFilter: Record<string, any> = {};
      withDateRange(paymentFilter, 'date', dateFrom, dateTo);
      if (driver) paymentFilter.collectedBy = { $regex: driver, $options: 'i' };
      if (status) paymentFilter.status = status;

      const rows = await db.collection('payments').find(paymentFilter).sort({ date: -1 }).toArray();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cleanRows(rows)), 'Payments');
    }

    if (types.includes('cheques')) {
      const chequeFilter: Record<string, any> = {};
      withDateRange(chequeFilter, 'date', dateFrom, dateTo);
      if (driver) chequeFilter.driverName = { $regex: driver, $options: 'i' };
      if (status) chequeFilter.status = status;

      const rows = await db.collection('cheques').find(chequeFilter).sort({ date: -1 }).toArray();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cleanRows(rows)), 'Cheques');
    }

    if (types.includes('expenses')) {
      const expenseFilter: Record<string, any> = {};
      withDateRange(expenseFilter, 'date', dateFrom, dateTo);
      if (driver) expenseFilter.addedBy = { $regex: driver, $options: 'i' };
      if (status) expenseFilter.status = status;

      const rows = await db.collection('expenses').find(expenseFilter).sort({ date: -1 }).toArray();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cleanRows(rows)), 'Expenses');
    }

    const data = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(data as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="logistics-export-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error while exporting data.' }, { status: 500 });
  }
}
