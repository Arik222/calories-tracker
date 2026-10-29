const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync('index.html', 'utf8');
function extract(name) {
  const start = source.indexOf('  async function ' + name + '(');
  const end = source.indexOf('\n  }', start) + 4;
  return source.slice(start, end);
}
(async () => {
  const button = { disabled: false, textContent: '' };
  let errors = 0, saved = 0;
  const context = vm.createContext({
    document: { getElementById: () => button },
    saveAllRows: async () => { throw Error('database unavailable'); },
    reportSaveError: () => errors++, setTimeout: () => {},
    hasUnsavedChanges: () => true, showUnsavedModal: async () => 'save',
    showFinalizeModal: async () => 'save',
    db: { from: () => { saved++; throw Error('unexpected database access'); } },
    updateActiveDateDisplay: () => {},
  });
  vm.runInContext(['saveProgress', 'requestDateSwitch', 'signOut', 'finalizeDay', 'settleSaveOperations'].map(extract).join('\n'), context);
  await context.saveProgress();
  assert.equal(button.textContent, 'שמור');
  assert.equal(button.disabled, false);
  await context.requestDateSwitch('2026-10-30');
  await context.signOut();
  await context.finalizeDay();
  assert.equal(saved, 0, 'Failed saving must stop navigation, sign-out and finalization');
  assert.equal(errors, 4);
  let settled = false;
  await assert.rejects(context.settleSaveOperations([
    Promise.reject(Error('write failed')),
    new Promise(resolve => setTimeout(() => { settled = true; resolve(); }, 10)),
  ]));
  assert.equal(settled, true, 'All writes settle before retry is allowed');
  context.saveAllRows = async () => {};
  await context.saveProgress();
  assert.equal(button.textContent, 'נשמר ✓');
  assert.equal(button.disabled, false);
  assert.equal(readFileSync('www/index.html', 'utf8'), source);
  console.log('Save error regression checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
