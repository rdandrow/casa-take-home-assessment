import { expect, Locator, Page } from '@playwright/test';

// Typed return shape for getSummaryValues() — keeps method signatures clean and consistent.
type SummaryValues = {
  vaultName: string;
  vaultType: string;
  totalBalance: string;
  usdEquivalent: string;
};

// Typed return shape for getKeyHealthEntries() — structured parse of each key card row.
type KeyHealthEntry = {
  keyName: string;
  healthStatus: string;
  lastChecked: string;
  raw: string;
};

/**
 * Page object for the Vault Summary and Key Health sections of the Vault Health Dashboard.
 *
 * Covers:
 *  - Vault label/value fields (Vault Name, Vault Type, Total Balance, USD Equivalent)
 *  - Key Health card entries (per-key name, health status, last checked date)
 *
 * Locators are scoped to `vault-summary-card` wherever possible to prevent
 * false matches from other sections on the same page.
 */
export class VaultSummaryPage {
  readonly page: Page;

  // The outer Vault Summary section card — used as locator scope anchor.
  readonly card: Locator;

  // Value locators — scoped to the card to prevent cross-section collisions.
  readonly vaultName: Locator;
  readonly vaultType: Locator;
  readonly totalBalance: Locator;
  readonly usdEquivalent: Locator;

  // Semantic label locators — used to verify that field labels are rendered
  // alongside their values (dual-coverage pattern).
  readonly vaultNameLabel: Locator;
  readonly vaultTypeLabel: Locator;
  readonly totalBalanceLabel: Locator;

  // Section heading for the Key Health subsection.
  readonly keyHealthLabel: Locator;

  // Dynamic collection of all key health item rows (key-key-1, key-key-2, …).
  // Scoped to the card so new sections added to the page won't cause false matches.
  readonly keyHealthItems: Locator;

  constructor(page: Page) {
    this.page = page;

    // Card anchor — all scoped locators below reference this element as their root.
    this.card = page.getByTestId('vault-summary-card');

    // data-testid value locators — stable primary selectors for field value assertions.
    this.vaultName = this.card.getByTestId('vault-name');
    this.vaultType = this.card.getByTestId('vault-type');
    this.totalBalance = this.card.getByTestId('total-balance');
    this.usdEquivalent = this.card.getByTestId('usd-equivalent');

    // Semantic label locators — exact-text matches used for dual label+value coverage.
    this.vaultNameLabel = this.card.getByText('Vault Name', { exact: true });
    this.vaultTypeLabel = this.card.getByText('Vault Type', { exact: true });
    this.totalBalanceLabel = this.card.getByText('Total Balance', { exact: true });

    // Key Health section heading — confirms the subsection is rendered on the page.
    this.keyHealthLabel = this.card.getByText('Key Health', { exact: true });

    // All key health rows matched by prefix — dynamically sized so tests don't
    // break if the number of keys changes in the data.
    this.keyHealthItems = this.card.locator('[data-testid^="key-key-"]');
  }

  // Asserts that the Vault Summary card and all primary value fields are visible.
  async expectVisible(): Promise<void> {
    await expect(this.card).toBeVisible();
    await expect(this.vaultName).toBeVisible();
    await expect(this.vaultType).toBeVisible();
    await expect(this.totalBalance).toBeVisible();
    await expect(this.usdEquivalent).toBeVisible();
  }

  // Asserts that the semantic field labels (not values) are rendered. Use alongside
  // expectVisible() for full dual label+value coverage.
  async expectSummaryLabelsVisible(): Promise<void> {
    await expect(this.vaultNameLabel).toBeVisible();
    await expect(this.vaultTypeLabel).toBeVisible();
    await expect(this.totalBalanceLabel).toBeVisible();
  }

  // Asserts each summary field as a label+value pair and confirms neither is empty.
  // Also verifies the USD equivalent value is present and non-empty.
  async expectSummaryFieldCoverage(): Promise<void> {
    const summaryFields = [
      { label: this.vaultNameLabel, value: this.vaultName },
      { label: this.vaultTypeLabel, value: this.vaultType },
      { label: this.totalBalanceLabel, value: this.totalBalance },
    ];

    for (const field of summaryFields) {
      await expect(field.label).toBeVisible();
      await expect(field.value).toBeVisible();
      // /\S/ ensures the value contains at least one non-whitespace character.
      await expect(field.value).toContainText(/\S/);
    }

    await expect(this.usdEquivalent).toBeVisible();
    await expect(this.usdEquivalent).toContainText(/\S/);
  }

  // Asserts the Key Health section heading is visible and that at least one
  // key health item row is rendered.
  async expectKeyHealthVisible(): Promise<void> {
    await expect(this.keyHealthLabel).toBeVisible();

    const keyHealthCount = await this.keyHealthItems.count();
    expect(keyHealthCount).toBeGreaterThan(0);

    for (let index = 0; index < keyHealthCount; index += 1) {
      await expect(this.keyHealthItems.nth(index)).toBeVisible();
    }
  }

  // Deep coverage assertion for the Key Health section. For each key row, verifies
  // that it is visible, non-empty, shows a valid health status, and shows a last-checked date.
  async expectKeyHealthFieldCoverage(): Promise<void> {
    await expect(this.keyHealthLabel).toBeVisible();

    const keyHealthCount = await this.keyHealthItems.count();
    expect(keyHealthCount).toBeGreaterThan(0);

    for (let index = 0; index < keyHealthCount; index += 1) {
      const keyHealthItem = this.keyHealthItems.nth(index);

      await expect(keyHealthItem).toBeVisible();
      // Confirms the row has rendered content (not blank or whitespace-only).
      await expect(keyHealthItem).toContainText(/\S/);
      // Validates against the two known health status values from the requirements.
      await expect(keyHealthItem).toContainText(/Healthy|Needs Health Check/);
      // Confirms audit date metadata is always present alongside the status.
      await expect(keyHealthItem).toContainText('Last checked');
    }
  }

  // Returns the trimmed text values of all four Vault Summary fields as a plain object.
  // Reads all four values in parallel for efficiency.
  async getSummaryValues(): Promise<SummaryValues> {
    const [vaultName, vaultType, totalBalance, usdEquivalent] = await Promise.all([
      this.vaultName.innerText(),
      this.vaultType.innerText(),
      this.totalBalance.innerText(),
      this.usdEquivalent.innerText(),
    ]);

    return {
      vaultName: vaultName.trim(),
      vaultType: vaultType.trim(),
      totalBalance: totalBalance.trim(),
      usdEquivalent: usdEquivalent.trim(),
    };
  }

  // Returns the total balance as a parsed float in BTC.
  // Supports either BTC (e.g. "1,234.56000000 BTC") or sats (e.g. "123,456 sats")
  // and converts sats → BTC using 1 BTC = 100,000,000 sats.
  // Throws on unknown/malformed formats so reconciliation tests fail loudly rather
  // than silently computing with the wrong unit.
  async getTotalBalanceBtc(): Promise<number> {
    const raw = await this.totalBalance.innerText();
    const normalized = raw.trim().replace(/\s+/g, ' ');
    const match = normalized.match(/^([\d,]+(?:\.\d+)?)\s*(BTC|sats?|satoshis?)$/i);

    if (!match) {
      throw new Error(
        `Could not parse total balance with unit from: ${raw}. Expected formats like "1,234.56000000 BTC" or "123,456 sats".`,
      );
    }

    const numericValue = Number.parseFloat(match[1]!.replace(/,/g, ''));
    if (Number.isNaN(numericValue)) {
      throw new Error(`Could not parse numeric total balance from: ${raw}`);
    }

    const unit = match[2]!.toLowerCase();
    if (unit === 'btc') return numericValue;
    if (unit === 'sat' || unit === 'sats' || unit === 'satoshi' || unit === 'satoshis') {
      return numericValue / 1e8;
    }

    throw new Error(`Unsupported total balance unit in: ${raw}`);
  }

  // Returns the raw trimmed text of every key health row. Used as input to
  // getKeyHealthEntries() or for direct string assertions in tests.
  async getKeyHealthValues(): Promise<string[]> {
    const keyHealthCount = await this.keyHealthItems.count();
    const keyHealthValues = await Promise.all(
      Array.from({ length: keyHealthCount }, (_, index) => this.keyHealthItems.nth(index).innerText()),
    );

    return keyHealthValues.map((value) => value.trim());
  }

  // Parses each key health row into a structured object with keyName, healthStatus,
  // and lastChecked fields. Falls back to empty strings if the row format is unexpected,
  // preserving raw text for debugging.
  async getKeyHealthEntries(): Promise<KeyHealthEntry[]> {
    const keyHealthValues = await this.getKeyHealthValues();

    return keyHealthValues.map((rawValue) => {
      // Normalize whitespace/line-breaks before parsing so layout variations don't break the regex.
      const normalized = rawValue.replace(/\s+/g, ' ').trim();
      const match = normalized.match(/^(.*?)\s*(Healthy|Needs Health Check)\s*·\s*Last checked\s*(.+)$/);

      if (!match) {
        // Return a partial entry with raw text to help diagnose unexpected formats in CI.
        return {
          keyName: normalized,
          healthStatus: '',
          lastChecked: '',
          raw: normalized,
        };
      }

      return {
        keyName: match[1]!.trim(),
        healthStatus: match[2]!.trim(),
        lastChecked: match[3]!.trim(),
        raw: normalized,
      };
    });
  }
}
