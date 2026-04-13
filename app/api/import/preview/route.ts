import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

const requiredColumnAliases = {
  firm: ['cmpcode', 'cmp code'],
  invoiceNumber: ['bill number'],
  date: ['bill date'],
  route: ['route'],
  shopName: ['retailer name'],
  amount: ['net amount'],
} as const;

function normalizeHeader(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function detectHeaderRow(rows: any[][]) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const headers = rows[i].map(normalizeHeader);
    const hasFirm = headers.some((h) => (requiredColumnAliases.firm as readonly string[]).includes(h));
    const hasInvoice = headers.some((h) => (requiredColumnAliases.invoiceNumber as readonly string[]).includes(h));
    const hasDate = headers.some((h) => (requiredColumnAliases.date as readonly string[]).includes(h));
    const hasRoute = headers.some((h) => (requiredColumnAliases.route as readonly string[]).includes(h));
    const hasShop = headers.some((h) => (requiredColumnAliases.shopName as readonly string[]).includes(h));
    const hasAmount = headers.some((h) => (requiredColumnAliases.amount as readonly string[]).includes(h));
    if (hasFirm && hasInvoice && hasDate && hasRoute && hasShop && hasAmount) {
      return i;
    }
  }
  return -1;
}

function findColumnIndex(headers: string[], aliases: readonly string[]) {
  return headers.findIndex((h) => aliases.includes(h));
}

function isTotalFooterRow(firm: string, invoiceNumber: string, shopName: string, route: string, date: string) {
  const normalizedFirm = firm.toLowerCase().trim();
  const normalizedInvoice = invoiceNumber.toLowerCase().trim();
  const normalizedShop = shopName.toLowerCase().trim();
  const normalizedRoute = route.toLowerCase().trim();
  const normalizedDate = date.toLowerCase().trim();
  const totalTokens = new Set(['total', 'totals']);

  if (totalTokens.has(normalizedFirm) || totalTokens.has(normalizedInvoice) || totalTokens.has(normalizedShop) || totalTokens.has(normalizedRoute)) {
    return true;
  }

  return !normalizedInvoice && !normalizedDate && (
    normalizedFirm.includes('total') ||
    normalizedShop.includes('total') ||
    normalizedRoute.includes('total')
  );
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
        { error: 'Could not detect required columns. Need CmpCode, Bill Number, Bill Date, Route, Retailer Name, and Net Amount.' },
        { status: 400 },
      );
    }

    const rawHeaders = matrix[headerRowIndex] || [];
    const headers = rawHeaders.map(normalizeHeader);
    const firmIdx = findColumnIndex(headers, requiredColumnAliases.firm);
    const invoiceIdx = findColumnIndex(headers, requiredColumnAliases.invoiceNumber);
    const dateIdx = findColumnIndex(headers, requiredColumnAliases.date);
    const routeIdx = findColumnIndex(headers, requiredColumnAliases.route);
    const shopIdx = findColumnIndex(headers, requiredColumnAliases.shopName);
    const amountIdx = findColumnIndex(headers, requiredColumnAliases.amount);

    if ([firmIdx, invoiceIdx, dateIdx, routeIdx, shopIdx, amountIdx].some((i) => i === -1)) {
      return NextResponse.json(
        { error: 'Missing required columns: firm, invoiceNumber, date, route, shopName, amount' },
        { status: 400 },
      );
    }

    const dataRows = matrix.slice(headerRowIndex + 1).filter((r) => r.some((v) => String(v || '').trim() !== ''));

    let ignoredTotalRows = 0;
    const normalized = dataRows
      .map((r, idx) => {
        const firm = String(r[firmIdx] || '').trim().toUpperCase();
        const invoiceNumber = String(r[invoiceIdx] || '').trim();
        const route = String(r[routeIdx] || '').trim();
        const shopName = String(r[shopIdx] || '').trim();
        const date = String(r[dateIdx] || '').trim();

        if (isTotalFooterRow(firm, invoiceNumber, shopName, route, date)) {
          ignoredTotalRows += 1;
          return null;
        }

        const totalAmount = Number(String(r[amountIdx] || '').replace(/,/g, ''));
        const errors: Array<{ field: string; message: string }> = [];

        if (!firm) errors.push({ field: 'firm', message: 'Missing firm (CmpCode)' });
        if (!invoiceNumber) errors.push({ field: 'invoiceNumber', message: 'Missing invoice number' });
        if (!route) errors.push({ field: 'route', message: 'Missing route' });
        if (!shopName) errors.push({ field: 'shopName', message: 'Missing shop name' });
        if (!date) errors.push({ field: 'date', message: 'Missing date' });
        if (Number.isNaN(totalAmount) || totalAmount <= 0) {
          errors.push({ field: 'totalAmount', message: 'Invalid amount' });
        }

        return {
          rowNumber: headerRowIndex + idx + 2,
          firm,
          invoiceNumber,
          route,
          shopName,
          date,
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
        firm: rawHeaders[firmIdx],
        invoiceNumber: rawHeaders[invoiceIdx],
        route: rawHeaders[routeIdx],
        shopName: rawHeaders[shopIdx],
        amount: rawHeaders[amountIdx],
        date: rawHeaders[dateIdx],
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error while previewing import file.' }, { status: 500 });
  }
}
