import { AsyncLocalStorage } from 'node:async_hooks';

// Holds the "current school" for the lifetime of a request or a script run.
// This is what lets Model.find()/create()/etc calls inside controllers stay
// untouched while still being scoped to a tenant under the hood.
const als = new AsyncLocalStorage();

export const tenantContext = {
  /**
   * Run `fn` with `school` (an ObjectId or string) bound as the active tenant.
   * Any mongoose query/save made synchronously or asynchronously inside `fn`
   * will pick this up via the tenantScope plugin.
   *
   * `fn` is always invoked through an `async () => await fn()` wrapper, not
   * called directly. This matters: AsyncLocalStorage's context only reliably
   * survives into a later continuation when something actually starts
   * executing (a real await, or a called async function) while the store is
   * active. A bare Mongoose query (Model.find()/findOne()/etc) is a *lazy*
   * builder — calling it just constructs an object, it doesn't touch the
   * database or run any hooks until something awaits it — so a caller like
   * `runAsSystem(() => Driver.findOne({ phone }))` returns that inert query
   * object having done nothing yet, `als.run()` has already unwound by the
   * time the caller's own `await` finally triggers `.exec()`, and the
   * tenantScope pre-hook fires with no store active at all. Explicitly
   * awaiting `fn()` here forces that `.exec()` to happen synchronously within
   * this wrapper's own execution, which *is* tracked correctly.
   */
  run(school, fn) {
    if (!school) throw new Error('[tenant] tenantContext.run() called without a school id');
    return als.run({ school: String(school) }, async () => await fn());
  },

  /**
   * Escape hatch for operations that must legitimately cross tenants:
   * platform-level superadmin screens, cron jobs that sweep all schools,
   * seed/migration scripts, etc. Use sparingly and explicitly. See the
   * comment on `run()` above for why `fn` is awaited inside the wrapper.
   */
  runAsSystem(fn) {
    return als.run({ system: true }, async () => await fn());
  },

  getSchool() {
    return als.getStore()?.school || null;
  },

  isSystem() {
    return als.getStore()?.system === true;
  },
};

export default tenantContext;