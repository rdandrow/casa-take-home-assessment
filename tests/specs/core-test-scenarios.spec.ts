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

// Minimum number of block confirmations required before a transaction may be considered final
// and displayed with a Confirmed status. Industry standard is 6; Casa requires 20.
const MIN_CONFIRMATIONS_FOR_CONFIRMED = 20;

// Regex that matches only Bitcoin mainnet address prefixes.
// Mainnet: P2PKH (1...), P2SH (3...), native SegWit (bc1q/bc1p).
// Testnet addresses use: tb1, m, n, or 2 — none of which match this pattern.
const MAINNET_ADDRESS_REGEX = /^(1|3|bc1)/;

// All tests in this suite are declared with test.fail() — each one documents a confirmed
// bug found during exploratory testing of the staging dashboard. test.fail() inverts the
// assertion outcome: a test that fails at runtime is reported as passed (the bug is still
// present), while a test that unexpectedly passes is flagged (signaling the bug was fixed).
// This keeps the suite green while maintaining a living record of open defects.
test.describe('Vault Health Dashboard - Core Bug Scenarios', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('page').waitFor({ state: 'visible', timeout: 30000 });
  });

  // Validates that every transaction displayed with a Confirmed status has reached the minimum
  // block confirmation threshold before being marked as such.
  //
  // BUG IDENTIFIED: transaction-row-tx-1 is shown as Confirmed with 0 confirmations, which violates
  // the requirement that a transaction must have at least 20 block confirmations before being
  // considered final. Marked test.fail() to document the bug and ensure it is re-evaluated
  // if the staging data or confirmation logic is updated. If this test unexpectedly passes,
  // Playwright will flag it — signaling the bug has been resolved.
  test.fail(
    'confirmed transactions must have at least 20 block confirmations',
    async ({ page }) => {
      const transactionHistoryPage = new TransactionHistoryPage(page);

      const statusData = await transactionHistoryPage.getTransactionStatusData();
      expect(statusData).toHaveLength(EXPECTED_TRANSACTION_COUNT);

      for (const tx of statusData) {
        if (tx.status.toLowerCase() === 'confirmed') {
          // Each Confirmed transaction must meet the minimum confirmation threshold.
          // Failure message includes the txId and actual count for immediate diagnosis.
          expect(
            tx.confirmationCount,
            `${tx.txId} is marked Confirmed with only ${tx.confirmationCount} confirmation(s) — minimum required: ${MIN_CONFIRMATIONS_FOR_CONFIRMED}`,
          ).toBeGreaterThanOrEqual(MIN_CONFIRMATIONS_FOR_CONFIRMED);
        }
      }
    },
  );

  // Validates that every address displayed in the Transaction History table is a mainnet address.
  // Production wallets must never expose testnet addresses to users — testnet funds have no value
  // and mixing network types indicates a configuration or test-data seeding error.
  //
  // BUG IDENTIFIED: transaction-row-tx-3 contains a testnet address (tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx).
  // Marked test.fail() to document the confirmed staging defect. If this test unexpectedly
  // passes, Playwright will flag it — signaling the data has been corrected.
  test.fail(
    'transaction history addresses must all be mainnet',
    async ({ page }) => {
      const transactionHistoryPage = new TransactionHistoryPage(page);

      const detailAddresses = await transactionHistoryPage.getTransactionDetailAddresses();
      expect(detailAddresses).toHaveLength(EXPECTED_TRANSACTION_COUNT);

      for (const { txId, address } of detailAddresses) {
        // Each address must match a mainnet prefix (1, 3, or bc1).
        // Failure message includes the txId and full address for immediate diagnosis.
        expect(
          address,
          `${txId} contains a testnet address: ${address}`,
        ).toMatch(MAINNET_ADDRESS_REGEX);
      }
    },
  );

  // Validates that every address displayed in the Receiving Addresses table is a mainnet address.
  // Receiving addresses are what users share to receive funds — a testnet address here would
  // cause real funds sent to it to be permanently unrecoverable.
  //
  // BUG IDENTIFIED: address-text-1 contains a testnet address (tb1qrp33g0q5b5698ahp5jnf5yzjmgcem8tlculdaf).
  // Marked test.fail() to document the confirmed staging defect. If this test unexpectedly
  // passes, Playwright will flag it — signaling the data has been corrected.
  test.fail(
    'receiving addresses must all be mainnet',
    async ({ page }) => {
      const receivingAddressesPage = new ReceivingAddressesPage(page);

      const addressTexts = await receivingAddressesPage.getAddressTexts();
      expect(addressTexts).toHaveLength(EXPECTED_ADDRESS_COUNT);

      for (let index = 0; index < addressTexts.length; index += 1) {
        const address = addressTexts[index];
        // Each address must match a mainnet prefix (1, 3, or bc1).
        // Failure message includes the index and full address for immediate diagnosis.
        expect(
          address,
          `address-text-${index} contains a testnet address: ${address}`,
        ).toMatch(MAINNET_ADDRESS_REGEX);
      }
    },
  );

  // Validates that the net sum of all transaction amounts (receives minus sends) reconciles
  // with the displayed total balance in the Vault Summary card.
  //
  // KNOWN FINDING: Declared with test.fail() because the staging data contains a confirmed
  // discrepancy — the net transaction sum (1.82500000 BTC) does not match the displayed
  // total balance (1.84530000 BTC), a difference of 0.02030000 BTC. This could indicate
  // missing transactions in the history, an incorrect balance display, or a seeding error
  // in the test data. See Bug Documentation in the README for details.
  // If this test unexpectedly passes, Playwright will flag it — signaling the data was fixed.
  test.fail('transaction amounts sum reconciles with vault total balance', async ({ page }) => {
    const vaultSummaryPage = new VaultSummaryPage(page);
    const transactionHistoryPage = new TransactionHistoryPage(page);

    // Parse the displayed total balance as a numeric BTC value.
    const totalBalanceBtc = await vaultSummaryPage.getTotalBalanceBtc();

    // Collect the signed amount for every transaction row.
    // Receives are positive (+), sends are negative (-).
    const amounts = await transactionHistoryPage.getTransactionAmounts();
    expect(amounts).toHaveLength(EXPECTED_TRANSACTION_COUNT);

    // Sum in satoshis (integer arithmetic) to eliminate floating point drift.
    // 1 BTC = 100,000,000 satoshis; all displayed amounts have exactly 8 decimal places.
    const netSatoshis = amounts.reduce((sum, amount) => sum + Math.round(amount * 1e8), 0);
    const balanceSatoshis = Math.round(totalBalanceBtc * 1e8);

    // The net sum of all displayed transaction amounts should equal the current wallet balance.
    expect(netSatoshis).toBe(balanceSatoshis);
  });

  // Validates that no address appearing in the Transaction History detail panels is also
  // surfaced as a current Receiving Address — a pattern known as Bitcoin address reuse.
  //
  // Address reuse is a privacy and security anti-pattern: it links all past and future
  // transactions to a known address, making the wallet's full balance and history visible
  // to anyone who observes the chain. A production Bitcoin UI must never present a
  // previously-used address as available to receive new funds.
  //
  // BUG IDENTIFIED: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy' appears in both the Feb 18 transaction
  // (transaction-row-tx-1) and the Receiving Addresses list (address-text-0).
  // Marked test.fail() to document the confirmed defect. If this test unexpectedly passes,
  // Playwright will flag it — signaling the reuse has been resolved.
  test.fail(
    'receiving addresses must not overlap with previously used transaction addresses',
    async ({ page }) => {
      const transactionHistoryPage = new TransactionHistoryPage(page);
      const receivingAddressesPage = new ReceivingAddressesPage(page);

      // Collect all addresses from both sections in parallel.
      const [detailAddresses, receivingAddressTexts] = await Promise.all([
        transactionHistoryPage.getTransactionDetailAddresses(),
        receivingAddressesPage.getAddressTexts(),
      ]);

      const usedAddresses = new Set(detailAddresses.map(({ address }) => address));
      const receivingSet = new Set(receivingAddressTexts);

      // Find every address that appears in both the transaction history and the receiving list.
      const reusedAddresses = [...receivingSet].filter((address) => usedAddresses.has(address));

      // No overlap is acceptable — any match is a reuse violation.
      // Failure message enumerates all reused addresses for immediate diagnosis.
      expect(
        reusedAddresses,
        `The following address(es) appear in both transaction history and the receiving list (address reuse): ${reusedAddresses.join(', ')}`,
      ).toHaveLength(0);
    },
  );

  // Validates that no key assigned to a 'Not Connected' device reports a 'Healthy' status
  // with a recent last-checked date in the Key Health section.
  //
  // A disconnected device cannot participate in a health check — the vault must communicate
  // with the physical device to verify it is accessible and operational. A 'Healthy' status
  // alongside a recent last-checked date for a disconnected device is therefore self-contradictory
  // and indicates a data integrity failure between the two sections.
  //
  // Cross-reference logic: each Connected Device row contains a 'Key: <name>' field that maps
  // directly to a Key Health entry by name. This test drives that join from the live DOM data
  // rather than hardcoded names, so it remains valid if device assignments change.
  //
  // BUG IDENTIFIED: device-device-3 (Coldcard Q) is 'Not Connected' and its assigned key is 'SAFE Key'.
  // Key Health shows 'SAFE Key | Healthy · Last checked Feb 14, 2026' — contradicting the
  // device's disconnected state. Marked test.fail() to document the defect. If this test
  // unexpectedly passes, Playwright will flag it — signaling the inconsistency has been resolved.
  test.fail(
    'disconnected devices must not have a Healthy key health status with a recent last-checked date',
    async ({ page }) => {
      const vaultSummaryPage = new VaultSummaryPage(page);
      const connectedDevicesPage = new ConnectedDevicesPage(page);

      // Read both sections in parallel — they are independent DOM regions.
      const [devices, keyHealthEntries] = await Promise.all([
        connectedDevicesPage.getDevices(),
        vaultSummaryPage.getKeyHealthEntries(),
      ]);

      // Index key health entries by name for O(1) lookup during the device loop.
      const keyHealthByName = new Map(
        keyHealthEntries.map((entry) => [entry.keyName.trim(), entry]),
      );

      for (const device of devices) {
        if (device.status !== 'Not Connected') continue;

        // The device row's 'key' field (parsed via extractField) names its assigned Key Health entry.
        const assignedKeyName = device.key.trim();
        const keyEntry = keyHealthByName.get(assignedKeyName);

        if (!keyEntry) continue; // No matching key health entry — nothing to contradict.

        // A Not Connected device cannot have undergone a health check.
        // If its key shows Healthy with a last-checked date, the two sections are contradictory.
        const isHealthyWithDate = keyEntry.healthStatus === 'Healthy' && keyEntry.lastChecked.length > 0;

        expect(
          isHealthyWithDate,
          `Device '${device.name}' is Not Connected, but its assigned key '${assignedKeyName}' ` +
          `shows status '${keyEntry.healthStatus}' with last checked '${keyEntry.lastChecked}'. ` +
          `A disconnected device cannot have been health-checked.`,
        ).toBe(false);
      }
    },
  );

  // Validates that every device's connection status maps to the expected key health status
  // across the Connected Devices and Key Health sections.
  //
  // Business rule: the health of a signing key is only meaningful if the device holding it
  // is reachable and up-to-date. Any device that cannot be communicated with — whether
  // disconnected or pending a firmware update — must have its assigned key reported as
  // 'Needs Health Check', not 'Healthy'.
  //
  // Expected status mapping:
  //   Active                   → Healthy             (device is operational and current)
  //   Not Connected            → Needs Health Check  (device is unreachable; key cannot be verified)
  //   Firmware Update Required → Needs Health Check  (device is out-of-date; key cannot be trusted)
  //
  // Cross-reference logic: the 'Key: <name>' field in each Connected Device row is used to
  // join against Key Health entries by name. Driven entirely from live DOM data — no
  // hardcoded names — so the test remains valid if device assignments change.
  //
  // BUG IDENTIFIED: device-device-3 (Coldcard Q) has status 'Not Connected' and is assigned
  // 'SAFE Key', which shows 'Healthy · Last checked Feb 14, 2026' in Key Health.
  // Per the mapping above, a non-Active device must not have a Healthy key.
  // Note: device-device-2 (Trezor Model T) correctly shows 'Needs Health Check' for
  // its 'OFFICE Key', which demonstrates the expected behavior for Firmware Update Required.
  // Marked test.fail() to document the defect. If this test unexpectedly passes,
  // Playwright will flag it — signaling all status inconsistencies have been resolved.
  test.fail(
    'connected device status and key health status must be consistent for all devices',
    async ({ page }) => {
      const vaultSummaryPage = new VaultSummaryPage(page);
      const connectedDevicesPage = new ConnectedDevicesPage(page);

      // Read both sections in parallel — they are independent DOM regions.
      const [devices, keyHealthEntries] = await Promise.all([
        connectedDevicesPage.getDevices(),
        vaultSummaryPage.getKeyHealthEntries(),
      ]);

      // Defines the expected key health status for each device connection status.
      // Any device status not listed here is considered unmapped and skipped.
      const expectedKeyHealthForDeviceStatus: Record<string, string> = {
        'Not Connected': 'Needs Health Check',
        'Firmware Update Required': 'Needs Health Check',
      };

      // Index key health entries by name for O(1) lookup during the device loop.
      const keyHealthByName = new Map(
        keyHealthEntries.map((entry) => [entry.keyName.trim(), entry]),
      );

      for (const device of devices) {
        const expectedKeyHealth = expectedKeyHealthForDeviceStatus[device.status];
        if (!expectedKeyHealth) continue; // 'Active' and any future statuses not in the map are skipped.

        const assignedKeyName = device.key.trim();
        const keyEntry = keyHealthByName.get(assignedKeyName);
        if (!keyEntry) continue; // No matching key health entry — nothing to validate.

        // Assert the key health status matches what the device status requires.
        // Failure message identifies the device, its status, the assigned key, and what was found vs expected.
        expect(
          keyEntry.healthStatus,
          `Device '${device.name}' has status '${device.status}', but its assigned key '${assignedKeyName}' ` +
          `shows '${keyEntry.healthStatus}' in Key Health. ` +
          `Expected '${expectedKeyHealth}' — a ${device.status} device cannot have a verified healthy key.`,
        ).toBe(expectedKeyHealth);
      }
    },
  );

  // Validates that the number of keys listed in the Key Health section matches the total
  // key count implied by the vault type label in the Vault Summary card.
  //
  // The vault type string follows the pattern 'M-of-N Multisig', where N is the total number
  // of signing keys that make up the vault. The Key Health section must list exactly N keys —
  // more or fewer would indicate either the label or the key list is incorrect, leaving users
  // with an inaccurate understanding of their vault's signing structure.
  //
  // BUG IDENTIFIED: Vault Type displays '3-of-5 Multisig' (implying 5 total keys), but Key Health
  // lists 6 keys: Mobile Key, HOME Key, OFFICE Key, SAFE Key, Casa Recovery Key, and Backup
  // Mobile Key. Either the vault type label understates the key count, or an extra key has
  // been added to the vault without updating the label. Marked test.fail() to document the
  // defect. If this test unexpectedly passes, Playwright will flag it — signaling the
  // label and key list are now consistent.
  test.fail(
    'key health key count must match the total key count stated in the vault type label',
    async ({ page }) => {
      const vaultSummaryPage = new VaultSummaryPage(page);

      // Read vault type and key health entries in parallel — both live in the summary card.
      const [summaryValues, keyHealthEntries] = await Promise.all([
        vaultSummaryPage.getSummaryValues(),
        vaultSummaryPage.getKeyHealthEntries(),
      ]);

      const { vaultType } = summaryValues;

      // Parse the total key count (N) from the 'M-of-N Multisig' vault type label.
      // The regex captures the second integer in the pattern (total signers, not threshold).
      const match = vaultType.match(/\d+-of-(\d+)/i);
      expect(
        match,
        `Could not parse a key count from vault type label: '${vaultType}'. Expected format: 'M-of-N Multisig'.`,
      ).not.toBeNull();

      const expectedKeyCount = parseInt(match![1], 10);
      const actualKeyCount = keyHealthEntries.length;

      // The number of keys in Key Health must equal the N in 'M-of-N'.
      expect(
        actualKeyCount,
        `Vault Type '${vaultType}' implies ${expectedKeyCount} total keys, ` +
        `but Key Health lists ${actualKeyCount} key(s): ` +
        keyHealthEntries.map((e) => e.keyName).join(', ') + '.',
      ).toBe(expectedKeyCount);
    },
  );

  // Validates that the number of connected devices matches the total key count implied
  // by the vault type label in the Vault Summary card.
  //
  // In a multisig vault, each signing key is associated with a distinct hardware or
  // software device. An 'M-of-N Multisig' vault requires N devices — one per key —
  // so the Connected Devices section must list exactly N devices. Fewer devices means
  // some keys have no registered device, which would block signing.
  //
  // BUG IDENTIFIED: Vault Type displays '3-of-5 Multisig' (implying 5 total devices), but
  // Connected Devices lists only 3: Trezor Model T, Casa App (Mobile), and Coldcard Q.
  // Marked test.fail() to document the defect. If this test unexpectedly passes,
  // Playwright will flag it — signaling the device list and vault label are now consistent.
  test.fail(
    'connected device count must match the total key count stated in the vault type label',
    async ({ page }) => {
      const vaultSummaryPage = new VaultSummaryPage(page);
      const connectedDevicesPage = new ConnectedDevicesPage(page);

      // Read vault type and device list in parallel — they are independent sections.
      const [summaryValues, devices] = await Promise.all([
        vaultSummaryPage.getSummaryValues(),
        connectedDevicesPage.getDevices(),
      ]);

      const { vaultType } = summaryValues;

      // Parse the total key/device count (N) from the 'M-of-N Multisig' vault type label.
      const match = vaultType.match(/\d+-of-(\d+)/i);
      expect(
        match,
        `Could not parse a device count from vault type label: '${vaultType}'. Expected format: 'M-of-N Multisig'.`,
      ).not.toBeNull();

      const expectedDeviceCount = parseInt(match![1], 10);
      const actualDeviceCount = devices.length;

      // The number of connected devices must equal the N in 'M-of-N'.
      expect(
        actualDeviceCount,
        `Vault Type '${vaultType}' implies ${expectedDeviceCount} devices, ` +
        `but Connected Devices lists ${actualDeviceCount} device(s): ` +
        devices.map((d) => d.name).join(', ') + '.',
      ).toBe(expectedDeviceCount);
    },
  );
});
