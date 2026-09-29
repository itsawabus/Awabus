import mongoose from 'mongoose';

// Several models (Route.routeId, Bus.plateNumber, Student.studentCode,
// Driver.phone, Admin.phone) started out with a single-field `unique: true`
// before multi-tenancy existed, and were later changed to a compound
// `{ school, field }` unique index instead so the same code/plate/phone can
// exist in two different schools. Mongoose's autoIndex only *adds* indexes
// declared in the current schema — it never drops one that's no longer
// declared — so any database that's been running since before that change
// still has the old global-unique index sitting alongside the new one, and
// the old one silently wins (e.g. two schools can't both have route
// "RT-001", even though the compound index says they can).
// Model.syncIndexes() reconciles the live indexes with the current schema
// on every boot, dropping stale ones — a no-op once the database already
// matches, so it's safe to run unconditionally.
const syncIndexes = async () => {
  for (const [name, Model] of Object.entries(mongoose.models)) {
    try {
      await Model.syncIndexes();
    } catch (err) {
      console.error(`[db] Failed to sync indexes for ${name}: ${err.message}`);
    }
  }
  console.log('[db] Indexes synced');
};

export const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/awabus';
  try {
    await mongoose.connect(uri);
    console.log(`[db] MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    await syncIndexes();
  } catch (err) {
    console.error(`[db] MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

export default connectDB;
