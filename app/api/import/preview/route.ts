import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

const headerAliases = {
  invoiceNumber: ['invoice no', 'invoice number', 'invoice', 'invoice #', 'invoice id'],
  shopName: ['party name', 'shop name', 'customer name', 'party', 'shop'],
  amount: ['total amount', 'amount', 'invoice amount', 'total'],
  date: ['date', 'invoice date', 'billing date'],
} as const;

function normalizeHeader(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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
  return headers.findIndex((h) => aliases.includes(h));
}

function isTotalFooterRow(invoiceNumber: string, shopName: string, date: string) {
  const normalizedInvoice = invoiceNumber.toLowerCase().trim();
  const normalizedShop = shopName.toLowerCase().trim();
  const normalizedDate = date.toLowerCase().trim();
  const hasTotalKeyword = /^total$/.test(normalizedInvoice) || /^total$/.test(normalizedShop);
  return hasTotalKeyword || (!normalizedInvoice && !normalizedDate && /^total$/.test(normalizedShop));
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
        const date = String(r[dateIdx] || '').trim();

        if (isTotalFooterRow(invoiceNumber, shopName, date)) {
          ignoredTotalRows += 1;
          return null;
        }

        const totalAmount = Number(String(r[amountIdx] || '').replace(/,/g, ''));
        const errors: Array<{ field: string; message: string }> = [];

        if (!invoiceNumber) errors.push({ field: 'invoiceNumber', message: 'Missing invoice number' });
        if (!shopName) errors.push({ field: 'shopName', message: 'Missing shop name' });
        if (!date) errors.push({ field: 'date', message: 'Missing date' });
        if (Number.isNaN(totalAmount) || totalAmount <= 0) {
          errors.push({ field: 'totalAmount', message: 'Invalid amount' });
        }

        return {
          rowNumber: headerRowIndex + idx + 2,
          invoiceNumber,
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
