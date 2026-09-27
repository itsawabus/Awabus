import 'dotenv/config';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import { tenantContext } from '../utils/tenantContext.js';

const SUPERADMIN_NAME = process.env.SEED_SUPERADMIN_NAME || 'Dave';
const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL || '@gmail.com';
const SUPERADMIN_PHONE = process.env.SEED_SUPERADMIN_PHONE || '+233557625112';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://itsawabus_db_user:TNLRgCyRjH9MwtWK@cluster0.pozplzv.mongodb.net/?appName=Cluster0';

async function run() {
  if (!MONGO_URI) {
    console.error('MONGO_URI is not set in your environment');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const email = SUPERADMIN_EMAIL.toLowerCase().trim();

  const existing = await tenantContext.runAsSystem(async () => {
    return Admin.findOne({ email });
  });

  if (existing) {
    console.log(`A superadmin with email "${email}" already exists (id: ${existing._id}). Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  const admin = await tenantContext.runAsSystem(async () => {
    return Admin.create({
      school: null,
      name: SUPERADMIN_NAME,
      email,
      phone: SUPERADMIN_PHONE,
      role: 'superadmin',
    });
  });

  console.log('Superadmin created successfully:');
  console.log({ id: admin._id.toString(), name: admin.name, email: admin.email, role: admin.role });
  console.log(`\nSign in at your app's /sign-in page with email "${email}" to set a password.`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed to seed superadmin:', err);
  process.exit(1);
});