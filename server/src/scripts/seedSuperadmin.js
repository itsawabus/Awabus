// Creates the platform superadmin (the developers' account).
//
//   MONGO_URI=... SEED_SUPERADMIN_EMAIL=you@example.com SEED_SUPERADMIN_PASSWORD='...' \
//   SEED_SUPERADMIN_NAME='Your Name' SEED_SUPERADMIN_PHONE=0241234567 node src/scripts/seedSuperadmin.js
//
// Everything comes from the environment (or server/.env). There are no
// built-in defaults: no database address, and the account is created WITH a
// password, so nobody can claim it by typing its email on the sign-in page.
import 'dotenv/config';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import { tenantContext } from '../utils/tenantContext.js';
import { checkPasswordStrength } from '../utils/password.js';
import { normalizeGhanaPhone } from '../utils/phone.js';

const need = (key) => {
  const v = (process.env[key] || '').trim();
  if (!v) {
    console.error(`${key} is not set. See the comment at the top of this script.`);
    process.exit(1);
  }
  return v;
};

async function run() {
  const uri = need('MONGO_URI');
  const email = need('SEED_SUPERADMIN_EMAIL').toLowerCase();
  const password = need('SEED_SUPERADMIN_PASSWORD');
  const name = need('SEED_SUPERADMIN_NAME');
  const phone = normalizeGhanaPhone(need('SEED_SUPERADMIN_PHONE'));
  if (!phone) {
    console.error('SEED_SUPERADMIN_PHONE must be a Ghana number, e.g. 0241234567');
    process.exit(1);
  }
  const weak = checkPasswordStrength(password, { email, name });
  if (weak) {
    console.error(`SEED_SUPERADMIN_PASSWORD is too weak: ${weak}`);
    process.exit(1);
  }

  await mongoose.connect(uri);
  const existing = await tenantContext.runAsSystem(() => Admin.findOne({ email }));
  if (existing) {
    console.log(`An account with email "${email}" already exists. Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  const admin = await tenantContext.runAsSystem(() =>
    Admin.create({ school: null, name, email, phone, password, role: 'superadmin' })
  );
  console.log(`Superadmin created: ${admin.email}. Sign in at /sign-in with this email and password.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed to create the superadmin:', err.message);
  process.exit(1);
});
