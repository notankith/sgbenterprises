import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, scryptSync } from 'node:crypto';
import { getDb } from '@/lib/mongo';
import { isLoggedInRequest } from '@/lib/auth';

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export async function GET(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await getDb();
    const rows = await db
      .collection('delivery_agents')
      .find({ active: { $ne: false } })
      .project({ name: 1, username: 1, active: 1, createdAt: 1 })
      .sort({ name: 1 })
      .toArray();
    return NextResponse.json(rows.map((r) => ({ ...r, _id: r._id.toString() })));
  } catch {
    return NextResponse.json({ error: 'Internal server error while loading agents.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isLoggedInRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const name = String(body.name || '').trim();
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    if (!name || !username || !password) {
      return NextResponse.json({ error: 'Agent name, username, and password are required' }, { status: 400 });
    }

    const db = await getDb();
    const exists = await db.collection('delivery_agents').findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
    if (exists) return NextResponse.json({ error: 'Delivery agent already exists' }, { status: 400 });

    const usernameExists = await db.collection('delivery_agents').findOne({ username: { $regex: `^${username}$`, $options: 'i' } });
    if (usernameExists) return NextResponse.json({ error: 'Username already in use' }, { status: 400 });

    const now = new Date().toISOString();
    const result = await db.collection('delivery_agents').insertOne({
      name,
      username,
      passwordHash: hashPassword(password),
      active: true,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      agent: { _id: result.insertedId.toString(), name, username, active: true, createdAt: now },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error while creating agent.' }, { status: 500 });
  }
}
