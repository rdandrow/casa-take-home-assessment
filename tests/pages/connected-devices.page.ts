import { expect, Locator, Page } from '@playwright/test';

type DeviceStatus = 'Active' | 'Not Connected' | 'Firmware Update Required';

type ConnectedDevice = {
  name: string;
  status: DeviceStatus;
  key: string;
  firmware: string;
  lastConnected: string;
  raw: string;
};

export class ConnectedDevicesPage {
  readonly page: Page;

  readonly card: Locator;
  readonly sectionLabel: Locator;

  readonly deviceRows: Locator;
  readonly deviceStatusDots: Locator;
  readonly deviceStatusTexts: Locator;

  private static readonly statusRegex = /^(Active|Not Connected|Firmware Update Required)$/;

  constructor(page: Page) {
    this.page = page;

    this.card = page.getByTestId('connected-devices-card');
    this.sectionLabel = page.getByRole('heading', { name: 'Connected Devices' });

    this.deviceRows = this.card.locator('[data-testid^="device-device-"]');
    this.deviceStatusDots = this.card.locator('[data-testid^="device-status-dot-device-"]');
    this.deviceStatusTexts = this.card.locator('[data-testid^="device-status-text-device-"]');
  }

  private parseDeviceStatus(value: string): DeviceStatus {
    const normalizedValue = value.trim();

    if (!ConnectedDevicesPage.statusRegex.test(normalizedValue)) {
      throw new Error(`Unexpected device status: ${normalizedValue}`);
    }

    return normalizedValue as DeviceStatus;
  }

  private extractField(rawValue: string, label: 'Key' | 'Firmware' | 'Last Connected'): string {
    const match = rawValue.match(new RegExp(`${label}:\\s*([^\\n]+)`));
    return match?.[1]?.trim() ?? '';
  }

  private normalizeDeviceId(deviceId: string): string {
    return deviceId.startsWith('device-') ? deviceId : `device-${deviceId}`;
  }

  deviceRowById(deviceId: string): Locator {
    const normalizedDeviceId = this.normalizeDeviceId(deviceId);
    return this.page.getByTestId(`device-${normalizedDeviceId}`);
  }

  deviceStatusDotById(deviceId: string): Locator {
    const normalizedDeviceId = this.normalizeDeviceId(deviceId);
    return this.page.getByTestId(`device-status-dot-${normalizedDeviceId}`);
  }

  deviceStatusTextById(deviceId: string): Locator {
    const normalizedDeviceId = this.normalizeDeviceId(deviceId);
    return this.page.getByTestId(`device-status-text-${normalizedDeviceId}`);
  }

  async expectVisible(): Promise<void> {
    await expect(this.card).toBeVisible();
    await expect(this.sectionLabel).toBeVisible();
  }

  async expectFieldCoverage(): Promise<void> {
    await this.expectVisible();

    const rowCount = await this.deviceRows.count();
    expect(rowCount).toBeGreaterThan(0);

    await expect(this.deviceStatusDots).toHaveCount(rowCount);
    await expect(this.deviceStatusTexts).toHaveCount(rowCount);

    for (let index = 0; index < rowCount; index += 1) {
      const row = this.deviceRows.nth(index);
      const statusDot = this.deviceStatusDots.nth(index);
      const statusText = this.deviceStatusTexts.nth(index);

      await expect(row).toBeVisible();
      await expect(row).toContainText(/\S/);

      await expect(statusDot).toBeVisible();

      await expect(statusText).toBeVisible();
      await expect(statusText).toHaveText(ConnectedDevicesPage.statusRegex);
    }
  }

  async getDeviceRowsText(): Promise<string[]> {
    const rowCount = await this.deviceRows.count();
    const rows = await Promise.all(
      Array.from({ length: rowCount }, (_, index) => this.deviceRows.nth(index).innerText()),
    );

    return rows.map((value) => value.trim());
  }

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

      const name = lines[0] ?? '';

      devices.push({
        name,
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
