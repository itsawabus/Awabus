import { tenantContext } from '../utils/tenantContext.js';

const SCOPED_QUERY_OPS = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndRemove',
  'count',
  'countDocuments',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
  'distinct',
];

/**
 * Apply this to any schema that has a `school` field. It makes every
 * find/update/delete/aggregate/save/insertMany automatically scoped to
 * tenantContext.getSchool() — so controllers don't need to pass `school`
 * in every query by hand, and (more importantly) can't accidentally forget to.
 *
 * Escape hatches, both explicit and opt-in:
 *   - Model.find(filter).setOptions({ skipTenantScope: true })
 *   - tenantContext.runAsSystem(() => ...)   // for scripts/cron/superadmin
 *   - passing `school` explicitly in the filter/doc yourself
 */
export function tenantScope(schema) {
  if (!schema.path('school')) return; // not a tenant-scoped model, skip entirely

  const injectFilter = function injectFilter(next) {
  console.log(
    `[TENANT] ${this.model.modelName}.${this.op}`,
    {
      isSystem: tenantContext.isSystem(),
      school: tenantContext.getSchool(),
      filter: this.getFilter(),
    }
  );

  if (tenantContext.isSystem()) return next();
    if (this.getOptions().skipTenantScope) return next();

    const filter = this.getFilter();
    if (filter.school) return next(); // caller already scoped explicitly

    const school = tenantContext.getSchool();
    if (!school) {
      return next(
        new Error(
          `[tenant] Missing tenant context for ${this.model.modelName}.${this.op}(). ` +
            'Wrap this call in tenantContext.run(school, ...) or pass { skipTenantScope: true } deliberately.'
        )
      );
    }
    this.where({ school });
    next();
  };

  SCOPED_QUERY_OPS.forEach((op) => schema.pre(op, injectFilter));

  // Must run on 'validate', not 'save' — mongoose runs schema validation
  // (including the `required: true` check on `school`) before 'save' hooks
  // fire, so setting it in pre('save') is too late.
  schema.pre('validate', function preValidateTenant(next) {
    if (tenantContext.isSystem() || this.school) return next();
    const school = tenantContext.getSchool();
    if (!school) {
      return next(
        new Error(`[tenant] Missing tenant context creating a ${this.constructor.modelName}.`)
      );
    }
    this.school = school;
    next();
  });

  schema.pre('insertMany', function preInsertManyTenant(next, docs) {
    if (tenantContext.isSystem()) return next();
    const school = tenantContext.getSchool();
    for (const doc of docs) {
      if (!doc.school) {
        if (!school) {
          return next(new Error('[tenant] Missing tenant context for insertMany().'));
        }
        doc.school = school;
      }
    }
    next();
  });

  schema.pre('aggregate', function preAggregateTenant(next) {
    if (tenantContext.isSystem() || this.options.skipTenantScope) return next();
    const school = tenantContext.getSchool();
    if (!school) {
      return next(new Error('[tenant] Missing tenant context for aggregate().'));
    }
    this.pipeline().unshift({ $match: { school } });
    next();
  });
}

export default tenantScope;
