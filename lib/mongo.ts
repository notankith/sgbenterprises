import { MongoClient, Db } from 'mongodb';
import dns from 'node:dns';

const dbName = process.env.MONGODB_DB_NAME || 'logistics_dashboard';

let clientPromise: Promise<MongoClient> | null = null;
let dnsConfigured = false;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise() {
  const configureDnsIfNeeded = () => {
    if (dnsConfigured) return;
    const dnsOverride = process.env.MONGODB_DNS_SERVERS;
    if (dnsOverride) {
      const dnsServers = dnsOverride
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (dnsServers.length > 0) {
        try {
          dns.setServers(dnsServers);
        } catch {
          // Ignore invalid DNS server values and use system defaults.
        }
      }
    }
    dnsConfigured = true;
  };

  const connectClient = async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('Missing MONGODB_URI in environment variables');
    }

    configureDnsIfNeeded();

    const client = new MongoClient(uri, {
      family: 4,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    try {
      return await client.connect();
    } catch (error) {
      // Important: clear cached failed promise so subsequent requests can retry.
      if (process.env.NODE_ENV === 'development') {
        global._mongoClientPromise = undefined;
      } else {
        clientPromise = null;
      }
      throw error;
    }
  };

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = connectClient();
    }
    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    clientPromise = connectClient();
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const connected = await getClientPromise();
  return connected.db(dbName);
}
