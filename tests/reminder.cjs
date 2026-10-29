const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('index.html', 'utf8');
const code = source.slice(source.indexOf('  let reminderTimer'), source.indexOf('  // ─── Profile (calorie target)'));
(async () => {
  const elements = { personalReminder: { value: '' }, reminderStatus: {}, reminderRetry: { style: {} } };
  const storage = new Map();
  let fail = false;
  const writes = [];
  const ctx = vm.createContext({
    currentUser: { id: 'user-a', user_metadata: { personal_reminder: 'existing note' } },
    document: { getElementById: id => elements[id], addEventListener() {} },
    window: { addEventListener() {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    setTimeout: () => 1, clearTimeout() {}, console: { error() {} },
    db: { auth: { updateUser: async payload => { writes.push(payload.data.personal_reminder); return { error: fail ? Error('offline') : null }; } } },
  });
  vm.runInContext(code, ctx);
  ctx.loadReminder();
  assert.equal(elements.personalReminder.value, 'existing note');
  elements.personalReminder.value = 'שתי עוגיות ועוד גמבה';
  ctx.scheduleReminderSave();
  assert.equal(storage.get('calories-reminder-draft:user-a'), elements.personalReminder.value);
  await ctx.flushReminder();
  assert.equal(writes.at(-1), elements.personalReminder.value);
  assert.equal(storage.size, 0);
  assert.match(elements.reminderStatus.textContent, /נשמרה/);
  fail = true;
  elements.personalReminder.value = 'offline draft';
  ctx.scheduleReminderSave();
  await ctx.flushReminder();
  assert.equal(storage.get('calories-reminder-draft:user-a'), 'offline draft');
  assert.equal(elements.reminderRetry.style.display, '');
  fail = false;
  await ctx.flushReminder();
  assert.equal(storage.size, 0);
  elements.personalReminder.value = '';
  ctx.scheduleReminderSave();
  await ctx.flushReminder();
  assert.equal(writes.at(-1), '', 'Clearing the note persists');
  ctx.currentUser = { id: 'user-b', user_metadata: {} };
  ctx.loadReminder();
  assert.equal(elements.personalReminder.value, '', 'Users have separate reminders');
  assert.equal(fs.readFileSync('www/index.html', 'utf8'), source);
  console.log('Reminder autosave, failure/retry, clearing and user isolation checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
