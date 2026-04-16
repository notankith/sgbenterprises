import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

const headerAliases = {
  invoiceNumber: ['invoice no', 'invoice number', 'invoice', 'invoice #', 'invoice id', 'bill no', 'bill number'],
  shopName: ['party name', 'shop name', 'customer name', 'party', 'shop', 'retailer name', 'retailer'],
  amount: ['net amount', 'total amount', 'invoice amount', 'amount', 'total', 'bill amount', 'gross amount'],
  date: ['date', 'invoice date', 'billing date', 'bill date'],
} as const;

const optionalHeaderAliases = {
  cmpCode: ['cmpcode', 'cmp code', 'company code', 'firm code'],
  firm: ['firm', 'company', 'cmpcode', 'cmp name', 'cmpname'],
  route: ['route', 'beat', 'sales route'],
} as const;

function normalizeHeader(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseExcelDate(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && Number.isInteger(parsed.y) && Number.isInteger(parsed.m) && Number.isInteger(parsed.d)) {
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${mm}-${dd}`;
    }
  }

  const text = String(value || '').trim();
  if (!text) return '';

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return text;
}

function parseAmount(value: unknown) {
  if (typeof value === 'number') return value;
  const text = String(value || '')
    .replace(/,/g, '')
    .replace(/[^0-9.-]/g, '')
    .trim();
  if (!text) return NaN;
  return Number(text);
}

function detectHeaderRow(rows: any[][]) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const headers = rows[i].map(normalizeHeader);
    const hasInvoice = headers.some((h) => (headerAliases.invoiceNumber as readonly string[]).includes(h));
    const hasShop = headers.some((h) => (headerAliases.shopName as readonly string[]).includes(h));
    const hasAmount = headers.some((h) => (headerAliases.amount as readonly string[]).includes(h));
    const hasDate = headers.some((h) => (headerAliases.date as readonly string[]).includes(h));
    if (hasInvoice && hasShop && hasAmount && hasDate) {
      return i;
    }
  }
  return -1;
}

function findColumnIndex(headers: string[], aliases: readonly string[]) {
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => h === alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function isTotalFooterRow(invoiceNumber: string, shopName: string, date: string) {
  const normalizedInvoice = invoiceNumber.toLowerCase().trim();
  const normalizedShop = shopName.toLowerCase().trim();
  const normalizedDate = date.toLowerCase().trim();
  const hasTotalKeyword = /^totals?$/.test(normalizedInvoice) || /^totals?$/.test(normalizedShop);
  return hasTotalKeyword || (!normalizedInvoice && !normalizedDate && /^totals?$/.test(normalizedShop));
}

function isSummaryTotalsRow(row: any[], invoiceNumber: string, shopName: string, date: string) {
  if (isTotalFooterRow(invoiceNumber, shopName, date)) return true;
  const rowHeaders = row.map(normalizeHeader).filter(Boolean);
  if (!rowHeaders.length) return false;
  const containsTotals = rowHeaders.some((h) => h === 'total' || h === 'totals');
  return containsTotals && !invoiceNumber.trim() && !date.trim();
}

export async function POST(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const wb = XLSX.read(bytes, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' }) as any[][];

    const headerRowIndex = detectHeaderRow(matrix);
    if (headerRowIndex === -1) {
      return NextResponse.json(
        { error: 'Could not detect required columns. Need invoice number, shop name, amount, and date columns.' },
        { status: 400 },
      );
    }

    const rawHeaders = matrix[headerRowIndex] || [];
    const headers = rawHeaders.map(normalizeHeader);
    const invoiceIdx = findColumnIndex(headers, headerAliases.invoiceNumber);
    const shopIdx = findColumnIndex(headers, headerAliases.shopName);
    const amountIdx = findColumnIndex(headers, headerAliases.amount);
    const dateIdx = findColumnIndex(headers, headerAliases.date);
    const cmpCodeIdx = findColumnIndex(headers, optionalHeaderAliases.cmpCode);
    const firmIdx = findColumnIndex(headers, optionalHeaderAliases.firm);
    const routeIdx = findColumnIndex(headers, optionalHeaderAliases.route);

    if ([invoiceIdx, shopIdx, amountIdx, dateIdx].some((i) => i === -1)) {
      return NextResponse.json(
        { error: 'Missing required columns: invoiceNumber, shopName, amount, date' },
        { status: 400 },
      );
    }

    const dataRows = matrix.slice(headerRowIndex + 1).filter((r) => r.some((v) => String(v || '').trim() !== ''));

    let ignoredTotalRows = 0;
    const normalized = dataRows
      .map((r, idx) => {
        const invoiceNumber = String(r[invoiceIdx] || '').trim();
        const shopName = String(r[shopIdx] || '').trim();
        const date = parseExcelDate(r[dateIdx]);
        const cmpCode = cmpCodeIdx === -1
          ? (firmIdx === -1 ? '' : String(r[firmIdx] || '').trim())
          : String(r[cmpCodeIdx] || '').trim();
        const firm = firmIdx === -1 ? cmpCode : String(r[firmIdx] || '').trim();
        const route = routeIdx === -1 ? '' : String(r[routeIdx] || '').trim();

        if (isSummaryTotalsRow(r, invoiceNumber, shopName, date)) {
          ignoredTotalRows += 1;
          return null;
        }

        const totalAmount = parseAmount(r[amountIdx]);
        const errors: Array<{ field: string; message: string }> = [];

        if (!invoiceNumber) errors.push({ field: 'invoiceNumber', message: 'Missing invoice number' });
        if (!shopName) errors.push({ field: 'shopName', message: 'Missing shop name' });
        if (!date) errors.push({ field: 'date', message: 'Missing date' });
        if (Number.isNaN(totalAmount) || totalAmount <= 0) {
          errors.push({ field: 'totalAmount', message: 'Invalid amount' });
        }

        return {
          rowNumber: headerRowIndex + idx + 2,
          cmpCode,
          firm,
          invoiceNumber,
          shopName,
          date,
          route,
          totalAmount: Number.isNaN(totalAmount) ? 0 : totalAmount,
          hasError: errors.length > 0,
          errors,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const db = await getDb();
    const existing = await db
      .collection('invoices')
      .find({ invoiceNumber: { $in: normalized.map((x) => x.invoiceNumber).filter(Boolean) } })
      .project({ invoiceNumber: 1 })
      .toArray();
    const existingSet = new Set(existing.map((x) => x.invoiceNumber));

    const preview = normalized.map((x) => ({ ...x, duplicate: existingSet.has(x.invoiceNumber) }));
    const errorLogs = preview.flatMap((row) =>
      (row.errors || []).map((err: { field: string; message: string }) => ({
        rowNumber: row.rowNumber,
        field: err.field,
        message: err.message,
      })),
    );

    return NextResponse.json({
      preview,
      errorLogs,
      summary: {
        totalRows: preview.length,
        duplicates: preview.filter((x) => x.duplicate).length,
        invalidRows: preview.filter((x) => x.hasError).length,
        newRows: preview.filter((x) => !x.duplicate && !x.hasError).length,
        ignoredTotalRows,
      },
      mappedColumns: {
        cmpCode: cmpCodeIdx === -1 ? null : rawHeaders[cmpCodeIdx],
        invoiceNumber: rawHeaders[invoiceIdx],
        shopName: rawHeaders[shopIdx],
        amount: rawHeaders[amountIdx],
        date: rawHeaders[dateIdx],
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error while previewing import file.' }, { status: 500 });
  }
}
