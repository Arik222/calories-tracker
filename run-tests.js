// Headless browser test runner for QUnit tests in tests.html
// Usage: node run-tests.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page    = await browser.newPage();

  page.on('console', msg => console.log('[browser]', msg.text()));
  page.on('pageerror', err => console.error('[page error]', err.message));

  await page.goto('http://localhost:8080/tests.html', { waitUntil: 'networkidle' });

  // Wait up to 30s for QUnit to finish (banner gets qunit-pass or qunit-fail class)
  try {
    await page.waitForFunction(() => {
      const banner = document.getElementById('qunit-banner');
      return banner &&
        (banner.classList.contains('qunit-pass') || banner.classList.contains('qunit-fail'));
    }, { timeout: 30000 });
  } catch {
    console.error('Timed out waiting for QUnit to finish.');
    await browser.close();
    process.exit(1);
  }

  // Collect results
  const { allPassed, summary, failures } = await page.evaluate(() => {
    const banner  = document.getElementById('qunit-banner');
    const result  = document.getElementById('qunit-testresult');
    const allPassed = banner.classList.contains('qunit-pass');

    const failures = [];
    document.querySelectorAll('#qunit-tests > li.fail').forEach(li => {
      const module = li.querySelector('.module-name');
      const test   = li.querySelector('.test-name');
      const msgs   = [...li.querySelectorAll('.qunit-assert-list li.fail .test-message')]
        .map(m => m.textContent.trim());
      failures.push({
        name: [module?.textContent, test?.textContent].filter(Boolean).join(' › '),
        messages: msgs,
      });
    });

    return { allPassed, summary: result?.textContent?.trim() ?? '', failures };
  });

  await browser.close();

  console.log('\n─────────────────────────────────');
  if (failures.length > 0) {
    console.log('FAILING TESTS:\n');
    failures.forEach(f => {
      console.log('  ✗', f.name);
      f.messages.forEach(m => console.log('      →', m));
    });
    console.log('');
  }
  console.log(summary);
  console.log(allPassed ? '\n✓ All tests passed' : '\n✗ Tests failed');
  console.log('─────────────────────────────────\n');

  process.exit(allPassed ? 0 : 1);
})();
