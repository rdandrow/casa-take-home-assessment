import { expect, Page, test } from '@playwright/test';
import { VaultSummaryPage } from '../pages/vault-summary.page';

// Lightweight fixture helper for parser-focused tests.
// Renders only the minimum DOM required by VaultSummaryPage: a vault-summary card
// containing a total-balance value element.
const renderBalanceFixture = async (page: Page, value: string): Promise<void> => {
  await page.setContent(`
    <div data-testid="vault-summary-card">
      <span data-testid="total-balance">${value}</span>
    </div>
  `);
};

// Unit-like parser coverage for getTotalBalanceBtc().
// These tests avoid external network/state by using a minimal in-memory DOM fixture,
// ensuring deterministic behavior for numeric parsing and unit handling.
test.describe('VaultSummaryPage.getTotalBalanceBtc parser', () => {
  // Verifies comma-separated numeric formatting does not truncate values at the first comma.
  // Expected parse: "1,234.56000000 BTC" -> 1234.56 BTC.
  test('parses comma-formatted BTC values', async ({ page }) => {
    await renderBalanceFixture(page, '1,234.56000000 BTC');

    const vaultSummaryPage = new VaultSummaryPage(page);
    await expect(vaultSummaryPage.getTotalBalanceBtc()).resolves.toBe(1234.56);
  });

  // Verifies satoshi-denominated balances are converted to BTC using
  // 1 BTC = 100,000,000 sats.
  test('converts sats to BTC', async ({ page }) => {
    await renderBalanceFixture(page, '123,456 sats');

    const vaultSummaryPage = new VaultSummaryPage(page);
    await expect(vaultSummaryPage.getTotalBalanceBtc()).resolves.toBeCloseTo(0.00123456, 10);
  });

  // Verifies fail-loud behavior for unsupported units.
  // Parser must reject non-BTC/sat units so downstream math cannot proceed with invalid input.
  test('throws on unsupported units', async ({ page }) => {
    await renderBalanceFixture(page, '1,234.56 USD');

    const vaultSummaryPage = new VaultSummaryPage(page);
    await expect(vaultSummaryPage.getTotalBalanceBtc()).rejects.toThrow(
      /Could not parse total balance with unit/,
    );
  });

  // Verifies fail-loud behavior when unit suffix is omitted.
  // Numeric values without explicit unit are ambiguous and must not be auto-interpreted.
  test('throws when unit is missing', async ({ page }) => {
    await renderBalanceFixture(page, '1,234.56');

    const vaultSummaryPage = new VaultSummaryPage(page);
    await expect(vaultSummaryPage.getTotalBalanceBtc()).rejects.toThrow(
      /Could not parse total balance with unit/,
    );
  });
});
