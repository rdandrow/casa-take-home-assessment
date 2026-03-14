import { expect, Locator, Page } from '@playwright/test';

export class VaultSummaryPage {
  readonly page: Page;

  readonly card: Locator;
  readonly vaultName: Locator;
  readonly vaultType: Locator;
  readonly totalBalance: Locator;
  readonly usdEquivalent: Locator;
  readonly vaultNameLabel: Locator;
  readonly vaultTypeLabel: Locator;
  readonly totalBalanceLabel: Locator;
  readonly keyHealthLabel: Locator;
  readonly keyHealthItems: Locator[];

  constructor(page: Page) {
    this.page = page;
    this.card = page.getByTestId('vault-summary-card');
    this.vaultName = page.getByTestId('vault-name');
    this.vaultType = page.getByTestId('vault-type');
    this.totalBalance = page.getByTestId('total-balance');
    this.usdEquivalent = page.getByTestId('usd-equivalent');
    this.vaultNameLabel = page.getByText('Vault Name', { exact: true });
    this.vaultTypeLabel = page.getByText('Vault Type', { exact: true });
    this.totalBalanceLabel = page.getByText('Total Balance', { exact: true });
    this.keyHealthLabel = page.getByText('Key Health', { exact: true });
    this.keyHealthItems = [1, 2, 3, 4, 5, 6].map((index) => page.getByTestId(`key-key-${index}`));
  }

  async expectVisible(): Promise<void> {
    await expect(this.card).toBeVisible();
    await expect(this.vaultName).toBeVisible();
    await expect(this.vaultType).toBeVisible();
    await expect(this.totalBalance).toBeVisible();
    await expect(this.usdEquivalent).toBeVisible();
  }

  async expectSummaryLabelsVisible(): Promise<void> {
    await expect(this.vaultNameLabel).toBeVisible();
    await expect(this.vaultTypeLabel).toBeVisible();
    await expect(this.totalBalanceLabel).toBeVisible();
  }

  async expectSummaryFieldCoverage(): Promise<void> {
    const summaryFields = [
      { label: this.vaultNameLabel, value: this.vaultName },
      { label: this.vaultTypeLabel, value: this.vaultType },
      { label: this.totalBalanceLabel, value: this.totalBalance },
    ];

    for (const field of summaryFields) {
      await expect(field.label).toBeVisible();
      await expect(field.value).toBeVisible();
      await expect(field.value).not.toHaveText('');
    }

    await expect(this.usdEquivalent).toBeVisible();
    await expect(this.usdEquivalent).not.toHaveText('');
  }

  async expectKeyHealthVisible(): Promise<void> {
    await expect(this.keyHealthLabel).toBeVisible();

    for (const keyHealthItem of this.keyHealthItems) {
      await expect(keyHealthItem).toBeVisible();
    }
  }

  async expectKeyHealthFieldCoverage(): Promise<void> {
    await expect(this.keyHealthLabel).toBeVisible();

    for (const keyHealthItem of this.keyHealthItems) {
      await expect(keyHealthItem).toBeVisible();
      await expect(keyHealthItem).not.toHaveText('');
      await expect(keyHealthItem).toContainText(/Healthy|Needs Health Check/);
      await expect(keyHealthItem).toContainText('Last checked');
    }
  }

  async getSummaryValues(): Promise<{
    vaultName: string;
    vaultType: string;
    totalBalance: string;
    usdEquivalent: string;
  }> {
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

  async getKeyHealthValues(): Promise<string[]> {
    const keyHealthValues = await Promise.all(
      this.keyHealthItems.map((keyHealthItem) => keyHealthItem.innerText()),
    );

    return keyHealthValues.map((value) => value.trim());
  }

  async getKeyHealthEntries(): Promise<
    Array<{
      keyName: string;
      healthStatus: string;
      lastChecked: string;
      raw: string;
    }>
  > {
    const keyHealthValues = await this.getKeyHealthValues();

    return keyHealthValues.map((rawValue) => {
      const normalized = rawValue.replace(/\s+/g, ' ').trim();
      const match = normalized.match(/^(.*?)\s*(Healthy|Needs Health Check)\s*·\s*Last checked\s*(.+)$/);

      if (!match) {
        return {
          keyName: normalized,
          healthStatus: '',
          lastChecked: '',
          raw: normalized,
        };
      }

      return {
        keyName: match[1].trim(),
        healthStatus: match[2].trim(),
        lastChecked: match[3].trim(),
        raw: normalized,
      };
    });
  }
}
