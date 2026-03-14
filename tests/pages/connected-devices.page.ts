import { expect, Locator, Page } from '@playwright/test';

// Typed union of all valid device connection/health statuses.
// Tests will throw if an unexpected status is encountered, surfacing app regressions early.
type DeviceStatus = 'Active' | 'Not Connected' | 'Firmware Update Required';

// Typed return shape for getDevices() — structured representation of a single device row.
type ConnectedDevice = {
  name: string;
  status: DeviceStatus;
  key: string;
  firmware: string;
  lastConnected: string;
  raw: string;
};

/**
 * Page object for the Connected Devices section of the Vault Health Dashboard.
 *
 * Covers:
 *  - Device rows (name, key, firmware, last connected date)
 *  - Per-device status dot indicator and status text label
 *
 * All locators are scoped to `connected-devices-card` to prevent false matches
 * from other sections rendered on the same page.
 */
export class ConnectedDevicesPage {
  readonly page: Page;

  // The outer Connected Devices section card — used as locator scope anchor.
  readonly card: Locator;

  // Semantic heading — confirms the section is rendered and visible.
  readonly sectionLabel: Locator;

  // Dynamic collection of all device rows matched by prefix.
  // Scoped to card to avoid matching rows in other sections.
  readonly deviceRows: Locator;

  // Dynamic collection of per-device status indicator dots (colored badge).
  readonly deviceStatusDots: Locator;

  // Dynamic collection of per-device status text labels (e.g. "Active").
  readonly deviceStatusTexts: Locator;

  // Anchored regex used for both assertion (toHaveText) and parsing (parseDeviceStatus).
  private static readonly statusRegex = /^(Active|Not Connected|Firmware Update Required)$/;

  constructor(page: Page) {
    this.page = page;

    // Card anchor — all scoped locators below reference this element as their root.
    this.card = page.getByTestId('connected-devices-card');

    // Role-based heading locator — resilient to DOM structure changes around the element.
    this.sectionLabel = page.getByRole('heading', { name: 'Connected Devices' });

    // Prefix-based collections scoped to the card for isolation.
    this.deviceRows = this.card.locator('[data-testid^="device-device-"]');
    this.deviceStatusDots = this.card.locator('[data-testid^="device-status-dot-device-"]');
    this.deviceStatusTexts = this.card.locator('[data-testid^="device-status-text-device-"]');
  }

  // Validates the raw status string against known values and narrows the type.
  // Throws with a clear message if an unexpected status is introduced in the app.
  private parseDeviceStatus(value: string): DeviceStatus {
    const normalizedValue = value.trim();

    if (!ConnectedDevicesPage.statusRegex.test(normalizedValue)) {
      throw new Error(`Unexpected device status: ${normalizedValue}`);
    }

    return normalizedValue as DeviceStatus;
  }

  // Regex-based field extraction from raw multi-line device row text.
  // Using a regex over line-split guards against inconsistent whitespace/line-break formats.
  private extractField(rawValue: string, label: 'Key' | 'Firmware' | 'Last Connected'): string {
    const match = rawValue.match(new RegExp(`${label}:\\s*([^\\n]+)`));
    return match?.[1]?.trim() ?? '';
  }

  // Normalizes device ID input to accept both bare IDs ("1") and prefixed ("device-1").
  private normalizeDeviceId(deviceId: string): string {
    return deviceId.startsWith('device-') ? deviceId : `device-${deviceId}`;
  }

  // Returns the full device row locator for a specific device. Scoped to card.
  deviceRowById(deviceId: string): Locator {
    const normalizedDeviceId = this.normalizeDeviceId(deviceId);
    return this.card.getByTestId(`device-${normalizedDeviceId}`);
  }

  // Returns the status dot locator for a specific device. Scoped to card.
  deviceStatusDotById(deviceId: string): Locator {
    const normalizedDeviceId = this.normalizeDeviceId(deviceId);
    return this.card.getByTestId(`device-status-dot-${normalizedDeviceId}`);
  }

  // Returns the status text locator for a specific device. Scoped to card.
  deviceStatusTextById(deviceId: string): Locator {
    const normalizedDeviceId = this.normalizeDeviceId(deviceId);
    return this.card.getByTestId(`device-status-text-${normalizedDeviceId}`);
  }

  // Asserts the section card and heading are visible — used as a pre-condition
  // before running deeper coverage checks.
  async expectVisible(): Promise<void> {
    await expect(this.card).toBeVisible();
    await expect(this.sectionLabel).toBeVisible();
  }

  // Deep coverage assertion over all device rows. Validates that:
  //  - At least one row is rendered
  //  - Status dots and texts align 1:1 with device rows
  //  - Each row is visible and non-empty
  //  - Each status matches one of the known valid values exactly
  async expectFieldCoverage(): Promise<void> {
    await this.expectVisible();

    const rowCount = await this.deviceRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Confirm all three locator collections have the same count as device rows.
    await expect(this.deviceStatusDots).toHaveCount(rowCount);
    await expect(this.deviceStatusTexts).toHaveCount(rowCount);

    for (let index = 0; index < rowCount; index += 1) {
      const row = this.deviceRows.nth(index);
      const statusDot = this.deviceStatusDots.nth(index);
      const statusText = this.deviceStatusTexts.nth(index);

      await expect(row).toBeVisible();
      // /\S/ confirms the row has rendered content beyond whitespace.
      await expect(row).toContainText(/\S/);

      await expect(statusDot).toBeVisible();

      await expect(statusText).toBeVisible();
      // Anchored full-text match — guards against partial matches or typos in status values.
      await expect(statusText).toHaveText(ConnectedDevicesPage.statusRegex);
    }
  }

  // Returns raw trimmed text for every device row. Used as a lightweight row dump
  // or as input to further assertions in tests.
  async getDeviceRowsText(): Promise<string[]> {
    const rowCount = await this.deviceRows.count();
    const rows = await Promise.all(
      Array.from({ length: rowCount }, (_, index) => this.deviceRows.nth(index).innerText()),
    );

    return rows.map((value) => value.trim());
  }

  // Returns a structured ConnectedDevice object for every row. For each row, reads
  // the row text and status text in parallel, then parses fields with regex extraction.
  async getDevices(): Promise<ConnectedDevice[]> {
    const rowCount = await this.deviceRows.count();
    const devices: ConnectedDevice[] = [];

    for (let index = 0; index < rowCount; index += 1) {
      const [rowText, statusText] = await Promise.all([
        this.deviceRows.nth(index).innerText(),
        this.deviceStatusTexts.nth(index).innerText(),
      ]);

      const lines = rowText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      // First non-empty line is always the device name (e.g. "Ledger Nano X").
      const name = lines[0] ?? '';

      devices.push({
        name,
        // parseDeviceStatus narrows to DeviceStatus and throws on unknown values.
        status: this.parseDeviceStatus(statusText),
        key: this.extractField(rowText, 'Key'),
        firmware: this.extractField(rowText, 'Firmware'),
        lastConnected: this.extractField(rowText, 'Last Connected'),
        raw: rowText.trim(),
      });
    }

    return devices;
  }
}
