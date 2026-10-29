const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('index.html', 'utf8');
const code = source.slice(source.indexOf('  let reminderTimer'), source.indexOf('  // ─── Profile (calorie target)'));
(async () => {
  const elements = { personalReminder: { value: '' }, reminderStatus: {}, reminderRetry: { style: {} } };
  const storage = new Map(), rows = new Map();
  rows.set('user-a:2026-10-29', 'existing note');
  let fail = false, gate = null;
  const ctx = vm.createContext({
    currentUser: { id: 'user-a' }, activeTrackingDate: '2026-10-29', Date,
    document: { getElementById: id => elements[id], addEventListener() {} },
    window: { addEventListener() {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    setTimeout: () => 1, clearTimeout() {}, console: { error() {} },
    db: { from(table) {
      assert.equal(table, 'daily_reminders');
      const filters = {}; let payload, options;
      return {
        select() { return this; }, eq(key, value) { filters[key] = value; return this; }, maybeSingle() { return this; },
        upsert(value, opts) { payload = value; options = opts; return this; },
        async throwOnError() {
          if (fail) throw Error('offline');
          if (payload) {
            if (gate) { const wait = gate; gate = null; await wait; }
            const key = payload.user_id + ':' + payload.tracking_date;
            if (!options.ignoreDuplicates || !rows.has(key)) rows.set(key, payload.reminder_text);
            return { data: null };
          }
          const key = filters.user_id + ':' + filters.tracking_date;
          return { data: rows.has(key) ? { reminder_text: rows.get(key) } : null };
        },
      };
    } },
  });
  vm.runInContext(code, ctx);
  await ctx.loadReminder();
  assert.equal(elements.personalReminder.value, 'existing note');
  elements.personalReminder.value = 'שתי עוגיות ועוד גמבה';
  ctx.scheduleReminderSave();
  assert.equal(storage.get('calories-reminder-draft:user-a:2026-10-29'), elements.personalReminder.value);
  await ctx.flushReminder();
  assert.equal(rows.get('user-a:2026-10-29'), elements.personalReminder.value);
  ctx.activeTrackingDate = '2026-10-30';
  await ctx.loadReminder();
  assert.equal(elements.personalReminder.value, '');
  assert.equal(rows.get('user-a:2026-10-30'), '', 'New days get an empty database row');
  elements.personalReminder.value = 'next-day note'; ctx.scheduleReminderSave();
  let release;
  gate = new Promise(resolve => { release = resolve; });
  const saving = ctx.flushReminder();
  ctx.activeTrackingDate = '2026-10-29'; await ctx.loadReminder();
  release(); await saving;
  assert.equal(rows.get('user-a:2026-10-30'), 'next-day note', 'In-flight writes retain their original date');
  assert.equal(elements.personalReminder.value, 'שתי עוגיות ועוד גמבה');
  fail = true;
  elements.personalReminder.value = 'offline draft'; ctx.scheduleReminderSave(); await ctx.flushReminder();
  assert.equal(storage.get('calories-reminder-draft:user-a:2026-10-29'), 'offline draft');
  assert.equal(elements.reminderRetry.style.display, '');
  fail = false; await ctx.retryReminder(); assert.equal(storage.size, 0);
  elements.personalReminder.value = ''; ctx.scheduleReminderSave(); await ctx.flushReminder();
  assert.equal(rows.get('user-a:2026-10-29'), '', 'Clearing persists only for the selected day');
  assert.equal(rows.get('user-a:2026-10-30'), 'next-day note');
  ctx.currentUser = { id: 'user-b' }; await ctx.loadReminder();
  assert.equal(elements.personalReminder.value, '', 'Users have separate reminders');
  fail = true; ctx.activeTrackingDate = '2026-10-31'; await ctx.loadReminder();
  assert.equal(elements.personalReminder.disabled, true, 'Failed loads cannot overwrite an unseen existing note');
  fail = false; await ctx.retryReminder(); assert.equal(elements.personalReminder.disabled, false);
  assert.equal(fs.readFileSync('www/index.html', 'utf8'), source);
  console.log('Daily reminders: date/user isolation, empty rows, history, in-flight saves, failure/retry and clearing passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
