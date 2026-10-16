import 'dotenv/config';
import mongoose from 'mongoose';
import {readFile} from 'node:fs/promises';

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env first.');
const source = JSON.parse(await readFile(new URL('../data/store.json', import.meta.url), 'utf8'));
try {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  for (const [collection, records] of [['products', source.products], ['orders', source.orders]]) {
    if (records.length) {
      // Preserve any records already in MongoDB and keep the local file untouched.
      await db.collection(collection).bulkWrite(records.map(record => ({
        updateOne: {filter: {id: record.id}, update: {$setOnInsert: record}, upsert: true}
      })));
    }
    console.log(`${collection}: ${await db.collection(collection).countDocuments()} records in MongoDB`);
  }
} finally {
  await mongoose.disconnect();
}
