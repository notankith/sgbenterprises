import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    const invoices = await db.collection('invoices').find({}).toArray();
    const payments = await db.collection('payments').find({}).toArray();
    const expenses = await db.collection('expenses').find({}).toArray();

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoices.map((x) => ({ ...x, _id: x._id.toString() }))), 'Invoices');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payments.map((x) => ({ ...x, _id: x._id.toString() }))), 'Payments');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenses.map((x) => ({ ...x, _id: x._id.toString() }))), 'Expenses');

    const data = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(data as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="logistics-backup-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error while generating backup.' }, { status: 500 });
  }
}
