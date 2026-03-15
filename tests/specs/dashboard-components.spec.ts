import { expect, test } from '@playwright/test';
import { ConnectedDevicesPage } from '../pages/connected-devices.page';
import { ReceivingAddressesPage } from '../pages/receiving-addresses.page';
import { TransactionHistoryPage } from '../pages/transaction-history.page';
import { VaultSummaryPage } from '../pages/vault-summary.page';
import { getEnvInt } from '../utils/env';

// Expected data counts are environment-configurable so the same tests can run against
// different seeded datasets without requiring code changes.
const EXPECTED_TRANSACTION_COUNT = getEnvInt('EXPECTED_TRANSACTION_COUNT', 8);
const EXPECTED_DEVICE_COUNT = getEnvInt('EXPECTED_DEVICE_COUNT', 3);
const EXPECTED_ADDRESS_COUNT = getEnvInt('EXPECTED_ADDRESS_COUNT', 4);
const EXPECTED_KEY_COUNT = getEnvInt('EXPECTED_KEY_COUNT', 6);

test.describe('Vault Health Dashboard - Page Object Coverage', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/qa_hire_q1_2026', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('page')).toBeVisible({ timeout: 30000 });
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

    // Derive the first transaction ID from the DOM to avoid hardcoding tx identifiers.
    // data-testid format: "transaction-row-tx-<id>" — strip "transaction-row-tx-".
    const firstTransactionTestId = await transactionHistoryPage
      .transactionRows
      .first()
      .getAttribute('data-testid');
    expect(firstTransactionTestId).toMatch(/^transaction-row-tx-.+$/);
    const firstTransactionId = (firstTransactionTestId ?? '').replace(/^transaction-row-tx-/, '');

    // expectExpandedCoverageById handles expand internally — no separate expand call needed.
    await transactionHistoryPage.expectExpandedCoverageById(firstTransactionId);

    const expandedDetails = await transactionHistoryPage.getExpandedTransactionDetailsById(
      firstTransactionId,
    );
    // Transaction hash should be a hex string of at least 8 characters.
    expect(expandedDetails.hash).toMatch(/[a-f0-9]{8,}/i);
    // Address in the detail panel should be a valid Bitcoin address format.
    expect(expandedDetails.address).toMatch(/^(bc1|tb1|[13])/);
    expect(expandedDetails.timestamp).toBeTruthy();
    // Block height is numeric for confirmed transactions; "Pending" for unconfirmed.
    expect(expandedDetails.block).toMatch(/\d+|Pending/i);
    // Fee in the detail panel should contain a numeric value.
    expect(expandedDetails.fee).toMatch(/[\d,.]+/);

    await transactionHistoryPage.collapseTransactionById(firstTransactionId);
    // Confirm the detail panel is no longer visible after collapse.
    await expect(transactionHistoryPage.transactionDetailById(firstTransactionId)).not.toBeVisible();
  });

  // Validates Connected Devices field coverage, status values, and all rendered device IDs.
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

    // Derive IDs from the DOM rather than hardcoding them, so this loop stays valid
    // if EXPECTED_DEVICE_COUNT changes or device IDs are non-contiguous.
    // data-testid format: "device-device-<id>" — strip the "device-device-" prefix to get the bare ID.
    const deviceRowCount = await connectedDevicesPage.deviceRows.count();
    for (let index = 0; index < deviceRowCount; index += 1) {
      const row = connectedDevicesPage.deviceRows.nth(index);
      const testId = await row.getAttribute('data-testid');
      expect(testId).toMatch(/^device-device-.+$/);
      const deviceId = (testId ?? '').replace(/^device-device-/, '');
      await expect(connectedDevicesPage.deviceRowById(deviceId)).toBeVisible();
      await expect(connectedDevicesPage.deviceStatusDotById(deviceId)).toBeVisible();
      await expect(connectedDevicesPage.deviceStatusTextById(deviceId)).toBeVisible();
    }
  });

  // Validates Receiving Addresses row count, all rendered per-index locators, and action interactions.
  // expectFieldCoverage already validates Bitcoin address format for every row.
  test('covers Receiving Addresses page object helpers', async ({ page }) => {
    const receivingAddressesPage = new ReceivingAddressesPage(page);

    await receivingAddressesPage.expectVisible();
    // expectFieldCoverage asserts Bitcoin address format for every rendered row.
    await receivingAddressesPage.expectFieldCoverage();

    const addresses = await receivingAddressesPage.getAddresses();
    // Assert the exact count matches the known number of addresses on the staging instance.
    expect(addresses).toHaveLength(EXPECTED_ADDRESS_COUNT);

    // Verify every rendered address row is individually addressable by index.
    const addressRowCount = await receivingAddressesPage.addressRows.count();
    for (let index = 0; index < addressRowCount; index += 1) {
      await expect(receivingAddressesPage.addressRowByIndex(index)).toBeVisible();
      await expect(receivingAddressesPage.addressTextByIndex(index)).toBeVisible();
      await expect(receivingAddressesPage.copyAddressButtonByIndex(index)).toBeEnabled();
      await expect(receivingAddressesPage.receiveAddressButtonByIndex(index)).toBeEnabled();
    }

    // Exercise copy and receive interactions on the first rendered address row.
    const firstAddressRowTestId = await receivingAddressesPage
      .addressRows
      .first()
      .getAttribute('data-testid');
    expect(firstAddressRowTestId).toMatch(/^address-row-\d+$/);
    const firstAddressIndex = (firstAddressRowTestId ?? '').replace(/^address-row-/, '');
    await receivingAddressesPage.copyAddressByIndex(firstAddressIndex);
    await receivingAddressesPage.clickReceiveByIndex(firstAddressIndex);
  });
});

