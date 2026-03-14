import { expect, Locator, Page } from '@playwright/test';

type ReceivingAddress = {
  address: string;
  raw: string;
};

export class ReceivingAddressesPage {
  readonly page: Page;

  readonly card: Locator;
  readonly sectionLabel: Locator;

  readonly addressRows: Locator;
  readonly addressTexts: Locator;
  readonly copyAddressButtons: Locator;
  readonly receiveAddressButtons: Locator;

  private static readonly bitcoinAddressRegex = /^(bc1|tb1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/;

  constructor(page: Page) {
    this.page = page;

    this.card = page.getByTestId('receiving-addresses-card');
    this.sectionLabel = page.getByRole('heading', { name: 'Receiving Addresses' });

    this.addressRows = this.card.locator('[data-testid^="address-row-"]');
    this.addressTexts = this.card.locator('[data-testid^="address-text-"]');
    this.copyAddressButtons = this.card.locator('[data-testid^="copy-address-btn-"]');
    this.receiveAddressButtons = this.card.locator('[data-testid^="receive-address-btn-"]');
  }

  private normalizeIndex(index: number | string): string {
    const normalized = String(index).trim();

    if (!/^\d+$/.test(normalized)) {
      throw new Error(`Invalid receiving address index: ${index}`);
    }

    return normalized;
  }

  addressRowByIndex(index: number | string): Locator {
    return this.card.getByTestId(`address-row-${this.normalizeIndex(index)}`);
  }

  addressTextByIndex(index: number | string): Locator {
    return this.card.getByTestId(`address-text-${this.normalizeIndex(index)}`);
  }

  copyAddressButtonByIndex(index: number | string): Locator {
    return this.card.getByTestId(`copy-address-btn-${this.normalizeIndex(index)}`);
  }

  receiveAddressButtonByIndex(index: number | string): Locator {
    return this.card.getByTestId(`receive-address-btn-${this.normalizeIndex(index)}`);
  }

  async expectVisible(): Promise<void> {
    await expect(this.card).toBeVisible();
    await expect(this.sectionLabel).toBeVisible();
  }

  async expectFieldCoverage(): Promise<void> {
    await this.expectVisible();

    const rowCount = await this.addressRows.count();
    expect(rowCount).toBeGreaterThan(0);

    await expect(this.addressTexts).toHaveCount(rowCount);
    await expect(this.copyAddressButtons).toHaveCount(rowCount);
    await expect(this.receiveAddressButtons).toHaveCount(rowCount);

    const addressValues = await this.getAddressTexts();

    for (let index = 0; index < rowCount; index += 1) {
      const row = this.addressRows.nth(index);
      const text = this.addressTexts.nth(index);
      const copyButton = this.copyAddressButtons.nth(index);
      const receiveButton = this.receiveAddressButtons.nth(index);

      await expect(row).toBeVisible();
      await expect(text).toBeVisible();
      await expect(text).toContainText(/\S/);
      await expect(copyButton).toBeVisible();
      await expect(copyButton).toBeEnabled();
      await expect(receiveButton).toBeVisible();
      await expect(receiveButton).toBeEnabled();

      const address = addressValues[index] ?? '';
      expect(address).toMatch(ReceivingAddressesPage.bitcoinAddressRegex);
    }
  }

  async getAddressTexts(): Promise<string[]> {
    const count = await this.addressTexts.count();
    const values = await Promise.all(
      Array.from({ length: count }, (_, index) => this.addressTexts.nth(index).innerText()),
    );

    return values.map((value) => value.trim());
  }

  async getAddresses(): Promise<ReceivingAddress[]> {
    const addressTexts = await this.getAddressTexts();

    return addressTexts.map((address) => ({
      address,
      raw: address,
    }));
  }

  async copyAddressByIndex(index: number | string): Promise<void> {
    const copyButton = this.copyAddressButtonByIndex(index);
    await expect(copyButton).toBeVisible();
    await expect(copyButton).toBeEnabled();
    await copyButton.click();
  }

  async clickReceiveByIndex(index: number | string): Promise<void> {
    const receiveButton = this.receiveAddressButtonByIndex(index);
    await expect(receiveButton).toBeVisible();
    await expect(receiveButton).toBeEnabled();
    await receiveButton.click();
  }
}
