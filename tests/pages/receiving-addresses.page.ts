import { expect, Locator, Page } from '@playwright/test';

// Typed return shape for getAddresses() — represents a single receiving address entry.
type ReceivingAddress = {
  address: string;
  raw: string;
};

/**
 * Page object for the Receiving Addresses section of the Vault Health Dashboard.
 *
 * Covers:
 *  - Address rows and address text values
 *  - Copy and Receive action buttons per address
 *
 * All locators are scoped to `receiving-addresses-card` to prevent cross-section matches.
 * Individual `*ByIndex` helpers accept both numeric and string index values.
 */
export class ReceivingAddressesPage {
  readonly page: Page;

  // The outer Receiving Addresses section card — used as locator scope anchor.
  readonly card: Locator;

  // Semantic section heading — confirms the section is rendered and visible.
  readonly sectionLabel: Locator;

  // Dynamic collections scoped to the card — all matched by data-testid prefix.
  readonly addressRows: Locator;
  readonly addressTexts: Locator;
  readonly copyAddressButtons: Locator;
  readonly receiveAddressButtons: Locator;

  // Sanity-level regex to validate rendered address strings match Bitcoin address formats.
  // Covers mainnet (bc1/1/3) and testnet (tb1) address patterns.
  private static readonly bitcoinAddressRegex = /^(bc1|tb1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/;

  constructor(page: Page) {
    this.page = page;

    // Card anchor — all scoped locators below reference this element as their root.
    this.card = page.getByTestId('receiving-addresses-card');

    // Role-based heading locator — resilient to DOM structure changes around the element.
    this.sectionLabel = page.getByRole('heading', { name: 'Receiving Addresses' });

    // Prefix-based dynamic collections scoped to the card for isolation.
    this.addressRows = this.card.locator('[data-testid^="address-row-"]');
    this.addressTexts = this.card.locator('[data-testid^="address-text-"]');
    this.copyAddressButtons = this.card.locator('[data-testid^="copy-address-btn-"]');
    this.receiveAddressButtons = this.card.locator('[data-testid^="receive-address-btn-"]');
  }

  // Validates that the index is a non-negative integer string before constructing a test ID.
  // Throws immediately on invalid input so test failures surface at the call site.
  private normalizeIndex(index: number | string): string {
    const normalized = String(index).trim();

    if (!/^\d+$/.test(normalized)) {
      throw new Error(`Invalid receiving address index: ${index}`);
    }

    return normalized;
  }

  // Returns the full address row locator for the given index. Scoped to card.
  addressRowByIndex(index: number | string): Locator {
    return this.card.getByTestId(`address-row-${this.normalizeIndex(index)}`);
  }

  // Returns the address text locator for the given index. Scoped to card.
  addressTextByIndex(index: number | string): Locator {
    return this.card.getByTestId(`address-text-${this.normalizeIndex(index)}`);
  }

  // Returns the Copy button locator for the given index. Scoped to card.
  copyAddressButtonByIndex(index: number | string): Locator {
    return this.card.getByTestId(`copy-address-btn-${this.normalizeIndex(index)}`);
  }

  // Returns the Receive button locator for the given index. Scoped to card.
  receiveAddressButtonByIndex(index: number | string): Locator {
    return this.card.getByTestId(`receive-address-btn-${this.normalizeIndex(index)}`);
  }

  // Asserts the section card and heading are visible — used as a pre-condition
  // before running deeper coverage checks.
  async expectVisible(): Promise<void> {
    await expect(this.card).toBeVisible();
    await expect(this.sectionLabel).toBeVisible();
  }

  // Deep coverage assertion over all address rows. Validates that:
  //  - At least one row is rendered
  //  - Text, copy, and receive locator collections align 1:1 with rows
  //  - Each address text is visible, non-empty, and matches a Bitcoin address format
  //  - Each action button is visible and enabled
  async expectFieldCoverage(): Promise<void> {
    await this.expectVisible();

    const rowCount = await this.addressRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Confirm all sub-field locator collections align 1:1 with address rows.
    await expect(this.addressTexts).toHaveCount(rowCount);
    await expect(this.copyAddressButtons).toHaveCount(rowCount);
    await expect(this.receiveAddressButtons).toHaveCount(rowCount);

    // Fetch all address values once in bulk to avoid repeated per-row DOM reads.
    const addressValues = await this.getAddressTexts();

    for (let index = 0; index < rowCount; index += 1) {
      const row = this.addressRows.nth(index);
      const text = this.addressTexts.nth(index);
      const copyButton = this.copyAddressButtons.nth(index);
      const receiveButton = this.receiveAddressButtons.nth(index);

      await expect(row).toBeVisible();
      await expect(text).toBeVisible();
      // /\S/ confirms the address field has non-whitespace content.
      await expect(text).toContainText(/\S/);

      // Buttons must be both visible and enabled before a user can interact with them.
      await expect(copyButton).toBeVisible();
      await expect(copyButton).toBeEnabled();
      await expect(receiveButton).toBeVisible();
      await expect(receiveButton).toBeEnabled();

      // Sanity-check that the rendered address matches a known Bitcoin address format.
      const address = addressValues[index] ?? '';
      expect(address).toMatch(ReceivingAddressesPage.bitcoinAddressRegex);
    }
  }

  // Returns the trimmed text of every address-text element. Reads all in parallel
  // for efficiency — also used internally by expectFieldCoverage to avoid re-querying.
  async getAddressTexts(): Promise<string[]> {
    const count = await this.addressTexts.count();
    const values = await Promise.all(
      Array.from({ length: count }, (_, index) => this.addressTexts.nth(index).innerText()),
    );

    return values.map((value) => value.trim());
  }

  // Returns a ReceivingAddress object for every address row. Address and raw are
  // identical at this level — raw is preserved for cases where further parsing is needed.
  async getAddresses(): Promise<ReceivingAddress[]> {
    const addressTexts = await this.getAddressTexts();

    return addressTexts.map((address) => ({
      address,
      raw: address,
    }));
  }

  // Asserts the Copy button is visible and enabled, then clicks it.
  // The enabled check guards against accidentally interacting with a disabled/loading state.
  async copyAddressByIndex(index: number | string): Promise<void> {
    const copyButton = this.copyAddressButtonByIndex(index);
    await expect(copyButton).toBeVisible();
    await expect(copyButton).toBeEnabled();
    await copyButton.click();
  }

  // Asserts the Receive button is visible and enabled, then clicks it.
  // The enabled check guards against accidentally interacting with a disabled/loading state.
  async clickReceiveByIndex(index: number | string): Promise<void> {
    const receiveButton = this.receiveAddressButtonByIndex(index);
    await expect(receiveButton).toBeVisible();
    await expect(receiveButton).toBeEnabled();
    await receiveButton.click();
  }
}
