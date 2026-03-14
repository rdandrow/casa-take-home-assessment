import { expect, test } from '@playwright/test';
import { ConnectedDevicesPage } from './../pages/connected-devices.page';
import { ReceivingAddressesPage } from './../pages/receiving-addresses.page';
import { TransactionHistoryPage } from './../pages/transaction-history.page';
import { VaultSummaryPage } from './../pages/vault-summary.page';

const DASHBOARD_URL = 'https://app-stg.keys.casa/qa_hire_q1_2026';

// Known data counts derived from the scraped data-testid ranges on the staging dashboard.
// These reflect the fixed test data present on the staging instance.
const EXPECTED_TRANSACTION_COUNT = 8; // transaction-row-tx-1 through tx-8
const EXPECTED_DEVICE_COUNT = 3;      // device-device-1 through device-3
const EXPECTED_ADDRESS_COUNT = 4;     // address-row-0 through address-row-3
const EXPECTED_KEY_COUNT = 6;         // key-key-1 through key-key-6

test.describe('Vault Health Dashboard - Page Object Coverage', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('page').waitFor({ state: 'visible', timeout: 30000 });
  });

  // Validates Vault Summary field formats and all 6 Key Health entries.
  // Asserts: value format patterns (numeric balance, $ USD), exact key count, parsed entry fields.
  test('covers Vault Summary page object helpers', async ({ page }) => {
    const vaultSummaryPage = new VaultSummaryPage(page);

    await vaultSummaryPage.expectVisible();
    await vaultSummaryPage.expectSummaryLabelsVisible();
    await vaultSummaryPage.expectSummaryFieldCoverage();
    await vaultSummaryPage.expectKeyHealthVisible();
    await vaultSummaryPage.expectKeyHealthFieldCoverage();

    const summaryValues = await vaultSummaryPage.getSummaryValues();
    expect(summaryValues.vaultName).toBeTruthy();
    expect(summaryValues.vaultType).toBeTruthy();
    // Balance should contain a numeric value (e.g. "0.001 BTC" or "100,000 sats").
    expect(summaryValues.totalBalance).toMatch(/[\d,.]+/);
    // USD equivalent should be a dollar-formatted value (e.g. "$1,234.56").
    expect(summaryValues.usdEquivalent).toMatch(/\$[\d,]+/);

    const keyHealthEntries = await vaultSummaryPage.getKeyHealthEntries();
    // Assert the exact count matches the known number of keys on the staging instance.
    expect(keyHealthEntries).toHaveLength(EXPECTED_KEY_COUNT);
    for (const entry of keyHealthEntries) {
      expect(entry.keyName).toBeTruthy();
      expect(entry.healthStatus).toBeTruthy();
      expect(entry.lastChecked).toBeTruthy();
    }
  });

  // Validates Transaction History list fields, sort toggle behavior, and expanded detail formats.
  // Asserts: exact row count, field format patterns (numeric confirmations/fee, hex hash,
  // Bitcoin address), sort order change, and collapse restores hidden state.
  test('covers Transaction History page object helpers', async ({ page }) => {
    const transactionHistoryPage = new TransactionHistoryPage(page);

    await transactionHistoryPage.expectVisible();
    await transactionHistoryPage.expectFieldCoverage();

    const transactions = await transactionHistoryPage.getTransactions();
    // Assert the exact count matches the known number of transactions on the staging instance.
    expect(transactions).toHaveLength(EXPECTED_TRANSACTION_COUNT);
    for (const transaction of transactions) {
      expect(transaction.status).toBeTruthy();
      // Confirmation count should contain a number (e.g. "6", "0", "1,234").
      expect(transaction.confirmations).toMatch(/\d+/);
      // Fee should contain a numeric value (e.g. "0.00001 BTC" or "1,000 sats").
      expect(transaction.fee).toMatch(/[\d,.]+/);
    }

    // Verify the sort toggle changes the displayed transaction order.
    const firstRowBefore = await transactionHistoryPage.transactionRows.first().innerText();
    await transactionHistoryPage.sortToggle.click();
    await expect(transactionHistoryPage.transactionRows.first()).not.toHaveText(firstRowBefore, {
      timeout: 5000,
    });
    // Reset sort order before continuing.
    await transactionHistoryPage.sortToggle.click();

    // expectExpandedCoverageById handles expand internally — no separate expand call needed.
    await transactionHistoryPage.expectExpandedCoverageById('1');

    const expandedDetails = await transactionHistoryPage.getExpandedTransactionDetailsById('1');
    // Transaction hash should be a hex string of at least 8 characters.
    expect(expandedDetails.hash).toMatch(/[a-f0-9]{8,}/i);
    // Address in the detail panel should be a valid Bitcoin address format.
    expect(expandedDetails.address).toMatch(/^(bc1|tb1|[13])/);
    expect(expandedDetails.timestamp).toBeTruthy();
    // Block height is numeric for confirmed transactions; "Pending" for unconfirmed.
    expect(expandedDetails.block).toMatch(/\d+|Pending/i);
    // Fee in the detail panel should contain a numeric value.
    expect(expandedDetails.fee).toMatch(/[\d,.]+/);

    await transactionHistoryPage.collapseTransactionById('1');
    // Confirm the detail panel is no longer visible after collapse.
    await expect(transactionHistoryPage.transactionDetailById('1')).not.toBeVisible();
  });

  // Validates Connected Devices field coverage, status values, and all 3 device IDs.
  // Asserts: exact device count, status is within the known valid set, all per-device locators resolve.
  test('covers Connected Devices page object helpers', async ({ page }) => {
    const connectedDevicesPage = new ConnectedDevicesPage(page);

    await connectedDevicesPage.expectVisible();
    await connectedDevicesPage.expectFieldCoverage();

    const devices = await connectedDevicesPage.getDevices();
    // Assert the exact count matches the known number of devices on the staging instance.
    expect(devices).toHaveLength(EXPECTED_DEVICE_COUNT);
    for (const device of devices) {
      expect(device.name).toBeTruthy();
      // Status must be one of the three known values enforced by DeviceStatus.
      expect(['Active', 'Not Connected', 'Firmware Update Required']).toContain(device.status);
      expect(device.key).toBeTruthy();
      expect(device.firmware).toBeTruthy();
    }

    // Verify all three device rows are individually addressable by ID.
    for (const id of ['1', '2', '3']) {
      await expect(connectedDevicesPage.deviceRowById(id)).toBeVisible();
      await expect(connectedDevicesPage.deviceStatusDotById(id)).toBeVisible();
      await expect(connectedDevicesPage.deviceStatusTextById(id)).toBeVisible();
    }
  });

  // Validates Receiving Addresses row count, all 4 per-index locators, and action interactions.
  // expectFieldCoverage already validates Bitcoin address format for every row.
  test('covers Receiving Addresses page object helpers', async ({ page }) => {
    const receivingAddressesPage = new ReceivingAddressesPage(page);

    await receivingAddressesPage.expectVisible();
    // expectFieldCoverage asserts Bitcoin address format for every rendered row.
    await receivingAddressesPage.expectFieldCoverage();

    const addresses = await receivingAddressesPage.getAddresses();
    // Assert the exact count matches the known number of addresses on the staging instance.
    expect(addresses).toHaveLength(EXPECTED_ADDRESS_COUNT);

    // Verify all 4 address rows are individually addressable by index.
    for (const index of [0, 1, 2, 3]) {
      await expect(receivingAddressesPage.addressRowByIndex(index)).toBeVisible();
      await expect(receivingAddressesPage.addressTextByIndex(index)).toBeVisible();
      await expect(receivingAddressesPage.copyAddressButtonByIndex(index)).toBeEnabled();
      await expect(receivingAddressesPage.receiveAddressButtonByIndex(index)).toBeEnabled();
    }

    // Exercise copy and receive interactions on the first address.
    await receivingAddressesPage.copyAddressByIndex(0);
    await receivingAddressesPage.clickReceiveByIndex(0);
  });
});

