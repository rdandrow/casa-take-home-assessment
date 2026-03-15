import { expect, Locator, Page } from '@playwright/test';
import { normalizePrefixedId } from '../utils/normalize';

// Typed return shape for getTransactions() — represents a single transaction row's fields.
type Transaction = {
  rowText: string;
  status: string;
  confirmations: string;
  fee: string;
};

// Typed return shape for getTransactionDetail() — represents the expanded detail panel.
type TransactionDetail = {
  hash: string;
  address: string;
  timestamp: string;
  block: string;
  fee: string;
  raw: string;
};

// Typed return shape for getTransactionStatusData() — used for confirmation threshold validation.
type TransactionStatusData = {
  txId: string;
  status: string;
  confirmationCount: number;
};

/**
 * Page object for the Transaction History section of the Vault Health Dashboard.
 *
 * Covers:
 *  - Transaction table (sort toggle, per-row fields: status, confirmations, fee, expand icon)
 *  - Expandable transaction detail panels (hash, address, timestamp, block, fee)
 *
 * Collection locators are scoped to `transaction-history-card` to prevent cross-section matches.
 * Individual `*ById` helpers accept either bare IDs ("1") or prefixed IDs ("tx-1").
 */
export class TransactionHistoryPage {
  readonly page: Page;

  // The outer Transaction History section card — used as locator scope anchor.
  readonly card: Locator;

  // The transactions table element — used to assert the data container has rendered.
  readonly table: Locator;

  // Semantic section heading locator.
  readonly sectionLabel: Locator;

  // Semantic sort control label — confirms the sort UI is rendered.
  readonly sortLabel: Locator;

  // Interactive sort toggle — used to assert the control is present and interactable.
  readonly sortToggle: Locator;

  // Dynamic collections scoped to the card — all matched by data-testid prefix.
  readonly transactionRows: Locator;
  readonly transactionStatuses: Locator;
  readonly transactionConfirmations: Locator;
  readonly transactionFees: Locator;
  readonly transactionExpandIcons: Locator;

  constructor(page: Page) {
    this.page = page;

    // Card anchor — all scoped locators below reference this element as their root.
    this.card = page.getByTestId('transaction-history-card');

    // Scoped data-testid locators for stable structural elements.
    this.table = this.card.getByTestId('transaction-table');
    this.sortToggle = this.card.getByTestId('sort-toggle');

    // Role and text-based locators — resilient to DOM structure changes.
    this.sectionLabel = page.getByRole('heading', { name: 'Transaction History' });
    this.sortLabel = this.card.getByText(/SORT BY DATE/i);

    // Prefix-based dynamic collections scoped to the card for isolation from other sections.
    this.transactionRows = this.card.locator('[data-testid^="transaction-row-tx-"]');
    this.transactionStatuses = this.card.locator('[data-testid^="tx-status-tx-"]');
    this.transactionConfirmations = this.card.locator('[data-testid^="tx-confirmations-tx-"]');
    this.transactionFees = this.card.locator('[data-testid^="tx-fee-tx-"]');
    this.transactionExpandIcons = this.card.locator('[data-testid^="tx-expand-icon-tx-"]');
  }

  // Normalizes tx ID input to accept both bare IDs ("1") and prefixed IDs ("tx-1").
  private normalizeTxId(txId: string): string {
    return normalizePrefixedId(txId, 'tx', 'transaction id');
  }

  // Parses the signed BTC amount from a transaction row's raw text.
  // Expects a value like "+0.25000000" (receive) or "-0.12000000" (send).
  // Throws if no signed numeric value is found, surfacing malformed row data early.
  private parseAmount(rowText: string): number {
    const match = rowText.match(/([+-]\d+\.\d+)/);
    if (!match) throw new Error(`Could not parse amount from row text: ${rowText}`);
    return parseFloat(match[1]!);
  }

  // Parses the confirmation count from the raw confirmations text.
  // Strips locale-formatted commas (e.g. "1,024" → 1024) before parsing to an integer.
  // Returns 0 for empty or non-numeric values rather than throwing, since "0" is a valid state.
  private parseConfirmationCount(text: string): number {
    const stripped = text.replace(/,/g, '').trim();
    const parsed = parseInt(stripped, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  // Asserts the section card, heading, table, and sort controls are all visible.
  // Used as a pre-condition before running deeper field-level coverage checks.
  async expectVisible(): Promise<void> {
    await expect(this.card).toBeVisible();
    await expect(this.sectionLabel).toBeVisible();
    await expect(this.table).toBeVisible();
    await expect(this.sortLabel).toBeVisible();
    await expect(this.sortToggle).toBeVisible();
  }

  // Deep coverage assertion over all transaction rows. Validates that:
  //  - At least one row is rendered
  //  - All sub-field collections (status, confirmations, fees, icons) match the row count
  //  - Every field is visible and contains non-whitespace content
  async expectFieldCoverage(): Promise<void> {
    await this.expectVisible();

    const rowCount = await this.transactionRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Confirm all sub-field locator collections align 1:1 with transaction rows.
    await expect(this.transactionStatuses).toHaveCount(rowCount);
    await expect(this.transactionConfirmations).toHaveCount(rowCount);
    await expect(this.transactionFees).toHaveCount(rowCount);
    await expect(this.transactionExpandIcons).toHaveCount(rowCount);

    for (let index = 0; index < rowCount; index += 1) {
      await expect(this.transactionRows.nth(index)).toBeVisible();
      // /\S/ confirms the row has rendered content beyond whitespace.
      await expect(this.transactionRows.nth(index)).toContainText(/\S/);

      await expect(this.transactionStatuses.nth(index)).toBeVisible();
      await expect(this.transactionStatuses.nth(index)).toContainText(/\S/);

      await expect(this.transactionConfirmations.nth(index)).toBeVisible();
      await expect(this.transactionConfirmations.nth(index)).toContainText(/\S/);

      await expect(this.transactionFees.nth(index)).toBeVisible();
      await expect(this.transactionFees.nth(index)).toContainText(/\S/);

      // Expand icon only needs to be visible — its interactability is tested via expand helpers.
      await expect(this.transactionExpandIcons.nth(index)).toBeVisible();
    }
  }

  // Individual locator helpers — all scoped to the card, normalized to accept "1" or "tx-1".

  // Returns the full row locator for the given transaction ID.
  transactionRowById(txId: string): Locator {
    return this.card.getByTestId(`transaction-row-${this.normalizeTxId(txId)}`);
  }

  // Returns the status badge locator for the given transaction ID.
  transactionStatusById(txId: string): Locator {
    return this.card.getByTestId(`tx-status-${this.normalizeTxId(txId)}`);
  }

  // Returns the confirmation count locator for the given transaction ID.
  transactionConfirmationsById(txId: string): Locator {
    return this.card.getByTestId(`tx-confirmations-${this.normalizeTxId(txId)}`);
  }

  // Returns the fee value locator for the given transaction ID.
  transactionFeeById(txId: string): Locator {
    return this.card.getByTestId(`tx-fee-${this.normalizeTxId(txId)}`);
  }

  // Returns the expand/collapse icon locator for the given transaction ID.
  transactionExpandIconById(txId: string): Locator {
    return this.card.getByTestId(`tx-expand-icon-${this.normalizeTxId(txId)}`);
  }

  // Returns the expanded detail panel locator for the given transaction ID.
  transactionDetailById(txId: string): Locator {
    return this.card.getByTestId(`transaction-detail-${this.normalizeTxId(txId)}`);
  }

  // Returns the close button within the expanded detail panel.
  transactionDetailCloseById(txId: string): Locator {
    return this.card.getByTestId(`tx-detail-close-${this.normalizeTxId(txId)}`);
  }

  // Returns the transaction hash field within the expanded detail panel.
  transactionDetailHashById(txId: string): Locator {
    return this.card.getByTestId(`tx-detail-hash-${this.normalizeTxId(txId)}`);
  }

  // Returns the address field within the expanded detail panel.
  transactionDetailAddressById(txId: string): Locator {
    return this.card.getByTestId(`tx-detail-address-${this.normalizeTxId(txId)}`);
  }

  // Returns the timestamp field within the expanded detail panel.
  transactionDetailTimestampById(txId: string): Locator {
    return this.card.getByTestId(`tx-detail-timestamp-${this.normalizeTxId(txId)}`);
  }

  // Returns the block height field within the expanded detail panel.
  transactionDetailBlockById(txId: string): Locator {
    return this.card.getByTestId(`tx-detail-block-${this.normalizeTxId(txId)}`);
  }

  // Returns the fee field within the expanded detail panel.
  transactionDetailFeeById(txId: string): Locator {
    return this.card.getByTestId(`tx-detail-fee-${this.normalizeTxId(txId)}`);
  }

  // Expands the detail panel for the given transaction ID if not already visible.
  // Uses DOM presence check (count > 0) + visibility check to safely determine current state
  // without masking real locator errors via try/catch.
  async expandTransactionById(txId: string): Promise<void> {
    const detail = this.transactionDetailById(txId);
    const hasDetailInDom = (await detail.count()) > 0;
    const isDetailVisible = hasDetailInDom && (await detail.isVisible());

    if (!isDetailVisible) {
      await this.transactionExpandIconById(txId).click();
      await expect(detail).toBeVisible();
    }
  }

  // Collapses the detail panel for the given transaction ID if currently visible.
  // Prefers the explicit close button; falls back to the expand icon toggle if absent.
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

  // Expands the given transaction and asserts that all detail panel fields are visible
  // and non-empty. Also validates that the panel contains recognizable field label text.
  async expectExpandedCoverageById(txId: string): Promise<void> {
    await this.expandTransactionById(txId);

    const detail = this.transactionDetailById(txId);
    const hash = this.transactionDetailHashById(txId);
    const address = this.transactionDetailAddressById(txId);
    const timestamp = this.transactionDetailTimestampById(txId);
    const block = this.transactionDetailBlockById(txId);
    const fee = this.transactionDetailFeeById(txId);

    // Assert all detail panel fields are rendered.
    await expect(detail).toBeVisible();
    await expect(hash).toBeVisible();
    await expect(address).toBeVisible();
    await expect(timestamp).toBeVisible();
    await expect(block).toBeVisible();
    await expect(fee).toBeVisible();

    // /\S/ confirms each field has non-whitespace content (not blank/placeholder).
    await expect(hash).toContainText(/\S/);
    await expect(address).toContainText(/\S/);
    await expect(timestamp).toContainText(/\S/);
    await expect(block).toContainText(/\S/);
    await expect(fee).toContainText(/\S/);

    // Sanity check that the panel contains recognizable field label text.
    await expect(detail).toContainText(/hash|address|timestamp|block|fee/i);
  }

  // Expands the given transaction and returns all detail panel field values as trimmed strings.
  // Reads all fields in parallel for efficiency. Returns typed TransactionDetail.
  async getExpandedTransactionDetailsById(txId: string): Promise<TransactionDetail> {
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

  // Returns the raw trimmed text of every transaction row. Used as a fast row dump
  // or as input to further assertions in tests.
  async getTransactionRowsText(): Promise<string[]> {
    const rowCount = await this.transactionRows.count();
    const rows = await Promise.all(
      Array.from({ length: rowCount }, (_, index) => this.transactionRows.nth(index).innerText()),
    );

    return rows.map((value) => value.trim());
  }

  // Returns a structured Transaction object for every row. For each row, reads
  // row text, status, confirmations, and fee in parallel for efficiency.
  async getTransactions(): Promise<Transaction[]> {
    const rowCount = await this.transactionRows.count();
    const transactions: Transaction[] = [];

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

  // Returns the signed BTC amount for every transaction row, parsed from row text.
  // Positive values are receives; negative values are sends.
  // Returns decimal BTC numbers; callers that need exact arithmetic should convert
  // to satoshis (integer math) before aggregating.
  async getTransactionAmounts(): Promise<number[]> {
    const rowTexts = await this.getTransactionRowsText();
    return rowTexts.map((text) => this.parseAmount(text));
  }

  // Returns status and parsed numeric confirmation count for every transaction row.
  // Used to assert confirmation threshold rules (e.g. minimum 20 confirmations for Confirmed status).
  // txId is derived from the row's data-testid attribute for precise identification in failure messages.
  async getTransactionStatusData(): Promise<TransactionStatusData[]> {
    const rowCount = await this.transactionRows.count();

    return Promise.all(
      Array.from({ length: rowCount }, async (_, index) => {
        const [txId, status, confirmationsText] = await Promise.all([
          this.transactionRows.nth(index).getAttribute('data-testid'),
          this.transactionStatuses.nth(index).innerText(),
          this.transactionConfirmations.nth(index).innerText(),
        ]);

        return {
          txId: txId ?? `row-${index}`,
          status: status.trim(),
          confirmationCount: this.parseConfirmationCount(confirmationsText),
        };
      }),
    );
  }

  // Expands every transaction row in sequence and reads the full address from the detail panel.
  // Returns an array of { txId, address } objects for network-type validation.
  // Uses sequential expansion rather than parallel to avoid overlapping panel animations.
  async getTransactionDetailAddresses(): Promise<Array<{ txId: string; address: string }>> {
    const rowCount = await this.transactionRows.count();
    const results: Array<{ txId: string; address: string }> = [];

    for (let index = 0; index < rowCount; index += 1) {
      const txId = await this.transactionRows.nth(index).getAttribute('data-testid') ?? `row-${index}`;
      const txNum = txId.replace('transaction-row-', '');

      await this.expandTransactionById(txNum);
      const address = (await this.transactionDetailAddressById(txNum).innerText()).trim();
      await this.collapseTransactionById(txNum);

      results.push({ txId, address });
    }

    return results;
  }
}
