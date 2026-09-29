import Guardian from '../models/Guardian.js';
import Student from '../models/Student.js';
import { tenantContext } from '../utils/tenantContext.js';

/**
 * Parent records used to be shared by every school. This gives each parent
 * record the school of the students that point at it. A parent whose children
 * are at more than one school is copied once per extra school, and those
 * students are moved to the copy. Parents with no students are left alone:
 * no school can see them.
 *
 * Safe to run on every start: it only touches records that have no school yet.
 */
export async function assignGuardianSchools() {
  return tenantContext.runAsSystem(async () => {
    // { school: null } matches both a missing and an empty school.
    const guardians = await Guardian.collection.find({ school: null }).toArray();
    let assigned = 0;
    let copied = 0;
    let orphans = 0;

    for (const g of guardians) {
      // eslint-disable-next-line no-await-in-loop
      const schools = (await Student.collection.distinct('school', { primaryGuardian: g._id })).filter(Boolean);
      if (!schools.length) {
        orphans += 1;
        continue;
      }
      const [first, ...others] = schools;
      // eslint-disable-next-line no-await-in-loop
      await Guardian.collection.updateOne({ _id: g._id }, { $set: { school: first } });
      assigned += 1;
      for (const school of others) {
        const { _id, ...rest } = g;
        // eslint-disable-next-line no-await-in-loop
        const { insertedId } = await Guardian.collection.insertOne({ ...rest, school, createdAt: g.createdAt, updatedAt: new Date() });
        // eslint-disable-next-line no-await-in-loop
        await Student.collection.updateMany({ primaryGuardian: g._id, school }, { $set: { primaryGuardian: insertedId } });
        copied += 1;
      }
    }

    if (assigned || copied) {
      console.log(`[migrate] parents given a school: ${assigned}, copied for a second school: ${copied}, without students: ${orphans}`);
    }
    return { assigned, copied, orphans };
  });
}

export default assignGuardianSchools;
