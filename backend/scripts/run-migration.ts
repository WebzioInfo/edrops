import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('No DATABASE_URL');
  
  let cleanUrl = connectionString;
  try {
    const parsed = new URL(connectionString);
    parsed.searchParams.delete('sslmode');
    cleanUrl = parsed.toString();
  } catch {}

  const client = new Client({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'v3_indexes_migration.sql'), 'utf-8');
    await client.query(sql);
    console.log('Migration executed successfully via pg Client');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await client.end();
  }
}

main();
