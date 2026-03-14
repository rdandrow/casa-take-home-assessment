import { expect, Locator, Page } from '@playwright/test';

export class TransactionHistoryPage {
  readonly page: Page;

  readonly card: Locator;
  readonly table: Locator;
  readonly sectionLabel: Locator;
  readonly sortLabel: Locator;
  readonly sortToggle: Locator;

  readonly transactionRows: Locator;
  readonly transactionStatuses: Locator;
  readonly transactionConfirmations: Locator;
  readonly transactionFees: Locator;
  readonly transactionExpandIcons: Locator;

  private normalizeTxId(txId: string): string {
    return txId.startsWith('tx-') ? txId : `tx-${txId}`;
  }

  constructor(page: Page) {
    this.page = page;

    this.card = page.getByTestId('transaction-history-card');
    this.table = page.getByTestId('transaction-table');
    this.sectionLabel = page.getByRole('heading', { name: 'Transaction History' });
    this.sortLabel = page.getByText(/SORT BY DATE/i);
    this.sortToggle = page.getByTestId('sort-toggle');

    this.transactionRows = page.locator('[data-testid^="transaction-row-tx-"]');
    this.transactionStatuses = page.locator('[data-testid^="tx-status-tx-"]');
    this.transactionConfirmations = page.locator('[data-testid^="tx-confirmations-tx-"]');
    this.transactionFees = page.locator('[data-testid^="tx-fee-tx-"]');
    this.transactionExpandIcons = page.locator('[data-testid^="tx-expand-icon-tx-"]');
  }

  async expectVisible(): Promise<void> {
    await expect(this.card).toBeVisible();
    await expect(this.sectionLabel).toBeVisible();
    await expect(this.table).toBeVisible();
    await expect(this.sortLabel).toBeVisible();
    await expect(this.sortToggle).toBeVisible();
  }

  async expectFieldCoverage(): Promise<void> {
    await this.expectVisible();

    const rowCount = await this.transactionRows.count();
    expect(rowCount).toBeGreaterThan(0);

    await expect(this.transactionStatuses).toHaveCount(rowCount);
    await expect(this.transactionConfirmations).toHaveCount(rowCount);
    await expect(this.transactionFees).toHaveCount(rowCount);
    await expect(this.transactionExpandIcons).toHaveCount(rowCount);

    for (let index = 0; index < rowCount; index += 1) {
      await expect(this.transactionRows.nth(index)).toBeVisible();
      await expect(this.transactionRows.nth(index)).toContainText(/\S/);

      await expect(this.transactionStatuses.nth(index)).toBeVisible();
      await expect(this.transactionStatuses.nth(index)).toContainText(/\S/);

      await expect(this.transactionConfirmations.nth(index)).toBeVisible();
      await expect(this.transactionConfirmations.nth(index)).toContainText(/\S/);

      await expect(this.transactionFees.nth(index)).toBeVisible();
      await expect(this.transactionFees.nth(index)).toContainText(/\S/);

      await expect(this.transactionExpandIcons.nth(index)).toBeVisible();
    }
  }

  transactionRowById(txId: string): Locator {
    const normalizedTxId = this.normalizeTxId(txId);
    return this.page.getByTestId(`transaction-row-${normalizedTxId}`);
  }

  transactionStatusById(txId: string): Locator {
    const normalizedTxId = this.normalizeTxId(txId);
    return this.page.getByTestId(`tx-status-${normalizedTxId}`);
  }

  transactionConfirmationsById(txId: string): Locator {
    const normalizedTxId = this.normalizeTxId(txId);
    return this.page.getByTestId(`tx-confirmations-${normalizedTxId}`);
  }

  transactionFeeById(txId: string): Locator {
    const normalizedTxId = this.normalizeTxId(txId);
    return this.page.getByTestId(`tx-fee-${normalizedTxId}`);
  }

  transactionExpandIconById(txId: string): Locator {
    const normalizedTxId = this.normalizeTxId(txId);
    return this.page.getByTestId(`tx-expand-icon-${normalizedTxId}`);
  }

  transactionDetailById(txId: string): Locator {
    const normalizedTxId = this.normalizeTxId(txId);
    return this.page.getByTestId(`transaction-detail-${normalizedTxId}`);
  }

  transactionDetailCloseById(txId: string): Locator {
    const normalizedTxId = this.normalizeTxId(txId);
    return this.page.getByTestId(`tx-detail-close-${normalizedTxId}`);
  }

  transactionDetailHashById(txId: string): Locator {
    const normalizedTxId = this.normalizeTxId(txId);
    return this.page.getByTestId(`tx-detail-hash-${normalizedTxId}`);
  }

  transactionDetailAddressById(txId: string): Locator {
    const normalizedTxId = this.normalizeTxId(txId);
    return this.page.getByTestId(`tx-detail-address-${normalizedTxId}`);
  }

  transactionDetailTimestampById(txId: string): Locator {
    const normalizedTxId = this.normalizeTxId(txId);
    return this.page.getByTestId(`tx-detail-timestamp-${normalizedTxId}`);
  }

  transactionDetailBlockById(txId: string): Locator {
    const normalizedTxId = this.normalizeTxId(txId);
    return this.page.getByTestId(`tx-detail-block-${normalizedTxId}`);
  }

  transactionDetailFeeById(txId: string): Locator {
    const normalizedTxId = this.normalizeTxId(txId);
    return this.page.getByTestId(`tx-detail-fee-${normalizedTxId}`);
  }

  async expandTransactionById(txId: string): Promise<void> {
    const detail = this.transactionDetailById(txId);
    const hasDetailInDom = (await detail.count()) > 0;
    const isDetailVisible = hasDetailInDom && (await detail.isVisible());

    if (!isDetailVisible) {
      await this.transactionExpandIconById(txId).click();
      await expect(detail).toBeVisible();
    }
  }

  async collapseTransactionById(txId: string): Promise<void> {
    const detail = this.transactionDetailById(txId);
    const hasDetailInDom = (await detail.count()) > 0;
    const isDetailVisible = hasDetailInDom && (await detail.isVisible());

    if (isDetailVisible) {
      const closeButton = this.transactionDetailCloseById(txId);
      const canUseCloseButton = (await closeButton.count()) > 0 && (await closeButton.isVisible());

      if (canUseCloseButton) {
        await closeButton.click();
      } else {
        await this.transactionExpandIconById(txId).click();
      }

      await expect(detail).not.toBeVisible();
    }
  }

  async expectExpandedCoverageById(txId: string): Promise<void> {
    await this.expandTransactionById(txId);

    const detail = this.transactionDetailById(txId);
    const hash = this.transactionDetailHashById(txId);
    const address = this.transactionDetailAddressById(txId);
    const timestamp = this.transactionDetailTimestampById(txId);
    const block = this.transactionDetailBlockById(txId);
    const fee = this.transactionDetailFeeById(txId);

    await expect(detail).toBeVisible();
    await expect(hash).toBeVisible();
    await expect(address).toBeVisible();
    await expect(timestamp).toBeVisible();
    await expect(block).toBeVisible();
    await expect(fee).toBeVisible();

    await expect(hash).toContainText(/\S/);
    await expect(address).toContainText(/\S/);
    await expect(timestamp).toContainText(/\S/);
    await expect(block).toContainText(/\S/);
    await expect(fee).toContainText(/\S/);

    await expect(detail).toContainText(/hash|address|timestamp|block|fee/i);
  }

  async getExpandedTransactionDetailsById(txId: string): Promise<{
    hash: string;
    address: string;
    timestamp: string;
    block: string;
    fee: string;
    raw: string;
  }> {
    await this.expandTransactionById(txId);

    const detail = this.transactionDetailById(txId);
    const [hash, address, timestamp, block, fee, raw] = await Promise.all([
      this.transactionDetailHashById(txId).innerText(),
      this.transactionDetailAddressById(txId).innerText(),
      this.transactionDetailTimestampById(txId).innerText(),
      this.transactionDetailBlockById(txId).innerText(),
      this.transactionDetailFeeById(txId).innerText(),
      detail.innerText(),
    ]);

    return {
      hash: hash.trim(),
      address: address.trim(),
      timestamp: timestamp.trim(),
      block: block.trim(),
      fee: fee.trim(),
      raw: raw.trim(),
    };
  }

  async getTransactionRowsText(): Promise<string[]> {
    const rowCount = await this.transactionRows.count();
    const rows = await Promise.all(
      Array.from({ length: rowCount }, (_, index) => this.transactionRows.nth(index).innerText()),
    );

    return rows.map((value) => value.trim());
  }

  async getTransactions(): Promise<
    Array<{
      rowText: string;
      status: string;
      confirmations: string;
      fee: string;
    }>
  > {
    const rowCount = await this.transactionRows.count();
    const transactions: Array<{
      rowText: string;
      status: string;
      confirmations: string;
      fee: string;
    }> = [];

    for (let index = 0; index < rowCount; index += 1) {
      const [rowText, status, confirmations, fee] = await Promise.all([
        this.transactionRows.nth(index).innerText(),
        this.transactionStatuses.nth(index).innerText(),
        this.transactionConfirmations.nth(index).innerText(),
        this.transactionFees.nth(index).innerText(),
      ]);

      transactions.push({
        rowText: rowText.trim(),
        status: status.trim(),
        confirmations: confirmations.trim(),
        fee: fee.trim(),
      });
    }

    return transactions;
  }
}
