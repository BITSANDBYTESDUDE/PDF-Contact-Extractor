import { test, expect, type Download } from '@playwright/test';
import * as XLSX from 'xlsx';
import path from 'node:path';

async function downloadBytes(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test('real upload → review → edit → deduplicate → Excel and CSV downloads', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /Extract Names & Phone Numbers/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Extract contacts', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Try a sample', exact: true }).click();
  await page.getByRole('button', { name: /^Text-based PDF/ }).click();
  await expect(page.locator('.file-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Extract contacts', exact: true }).click();
  await expect(page.locator('.completion-banner')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.contacts-table tbody tr')).toHaveCount(9);
  await expect(page.locator('.stat-value').first()).toHaveText('9');
  await page.getByRole('button', { name: 'Preview contacts' }).click();
  await page.getByRole('textbox', { name: 'Search contacts' }).fill('Muhammad');
  await expect(page.locator('.contacts-table tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('combobox', { name: 'Filter contact status' }).selectOption('needs-review');
  await expect(page.locator('.contacts-table tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Edit 03011234567', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit full name' }).fill('Usman Tariq');
  await page.getByRole('button', { name: 'Save contact' }).click();
  await expect(page.locator('.contacts-table tbody tr')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Filter contact status' }).selectOption('all');
  await expect(page.getByText('Usman Tariq', { exact: true })).toBeVisible();
  await page.locator('.duplicate-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Remove 1 duplicate', exact: true }).click();
  await expect(page.locator('.contacts-table tbody tr')).toHaveCount(8);
  await expect(page.locator('.duplicate-button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete Emily Parker', exact: true }).click();
  await page.getByRole('button', { name: 'Remove contact', exact: true }).click();
  await expect(page.locator('.contacts-table tbody tr')).toHaveCount(7);
  await page
    .locator('[data-sonner-toast][data-front="true"]')
    .getByRole('button', { name: 'Undo', exact: true })
    .click();
  await expect(page.locator('.contacts-table tbody tr')).toHaveCount(8);
  await page.getByRole('checkbox', { name: 'Select Ahmed Khan', exact: true }).check();
  await page.getByRole('button', { name: 'Download Excel', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Selected contacts 1' })).toBeChecked();
  await page.getByRole('radio', { name: 'All contacts 8' }).check();
  const excelDownload = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Download Excel' }).click();
  const excel = await excelDownload;
  expect(excel.suggestedFilename()).toMatch(/^extracted-contacts-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const workbook = XLSX.read(await downloadBytes(excel), { type: 'buffer', cellNF: true });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Contacts);
  expect(rows).toHaveLength(8);
  expect(rows).toContainEqual({
    Name: 'Usman Tariq',
    'Phone Number': '03011234567',
    'Source File': 'sample-contacts.pdf',
  });
  expect(workbook.Sheets.Contacts.B2.t).toBe('s');
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Spreadsheet-safe phone numbers' }).uncheck();
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Download CSV' }).click();
  const csv = (await downloadBytes(await csvDownload)).toString('utf8');
  expect(csv).toContain('"Usman Tariq","03011234567","sample-contacts.pdf"');
  expect(csv).toContain('"+14155552671"');
  await page.screenshot({ path: 'test-results/desktop-results.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('multiple PDFs, pagination, source filters and bulk selection work', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page
    .getByLabel('Choose PDF files')
    .setInputFiles([
      path.resolve('backend/tests/fixtures/text-contacts.pdf'),
      path.resolve('backend/tests/fixtures/scanned-contacts.pdf'),
    ]);
  await page.getByRole('button', { name: 'Extract contacts', exact: true }).click();
  await expect(page.locator('.completion-banner')).toBeVisible({ timeout: 45000 });
  await expect(page.locator('.contacts-table tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('.contacts-table tbody tr')).toHaveCount(3);
  await page.getByRole('button', { name: 'Previous page' }).click();
  await page.getByRole('combobox', { name: 'Filter source file' }).selectOption('text-contacts.pdf');
  await expect(page.locator('.contacts-table tbody tr')).toHaveCount(9);
  await page.getByRole('combobox', { name: 'Filter source file' }).selectOption('all');
  await page.getByRole('button', { name: 'Full name', exact: true }).click();
  await expect(page.locator('.contacts-table tbody tr').first()).toContainText('Name not found');
  await page.getByRole('checkbox', { name: 'Select all contacts on this page' }).check();
  await page.getByRole('button', { name: 'Select all 13 matching' }).click();
  await expect(page.locator('.selection-bar')).toContainText('13 selected');
  await page.getByRole('button', { name: 'Delete selected' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove contacts', exact: true }).click();
  await expect(page.locator('.contacts-table tbody tr')).toHaveCount(0);
  await page
    .locator('[data-sonner-toast][data-front="true"]')
    .getByRole('button', { name: 'Undo', exact: true })
    .click();
  await expect(page.locator('.stat-value').first()).toHaveText('13');
});

test('mobile navigation and real scanned-PDF OCR work without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/mobile-initial.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('.nav-link').getByText('How it works', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Three simple steps');
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: 'Try a sample', exact: true }).click();
  await page.getByRole('button', { name: /^Scanned PDF/ }).click();
  await page.getByRole('button', { name: 'Extract contacts', exact: true }).click();
  await expect(page.locator('.completion-banner')).toBeVisible({ timeout: 45000 });
  await expect(page.locator('.contacts-table tbody tr')).toHaveCount(4);
  await expect(page.locator('.file-info')).toContainText('4 contacts · OCR');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-results.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('upload validation, individual removal, clear all and fresh start work', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page
    .getByLabel('Choose PDF files')
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a PDF') });
  await expect(page.locator('.error-alert')).toContainText('only PDF');
  await expect(page.getByRole('button', { name: 'Extract contacts', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Dismiss error' }).click();
  await page
    .getByLabel('Choose PDF files')
    .setInputFiles([
      path.resolve('backend/tests/fixtures/text-contacts.pdf'),
      path.resolve('backend/tests/fixtures/scanned-contacts.pdf'),
    ]);
  await page.getByRole('button', { name: 'Remove text-contacts.pdf' }).click();
  await expect(page.locator('.file-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.locator('.file-row')).toHaveCount(0);
  await page
    .getByLabel('Choose PDF files')
    .setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') });
  await page.getByRole('button', { name: 'Extract contacts', exact: true }).click();
  await expect(page.locator('.file-error')).toContainText('not a valid PDF', { timeout: 30000 });
  await page.getByRole('button', { name: 'New extraction', exact: true }).click();
  await page.getByRole('button', { name: 'Start fresh' }).click();
  await expect(page.locator('.file-row')).toHaveCount(0);
  await expect(page.locator('.error-alert')).toHaveCount(0);
});

test('workspace and help dialog meet automated WCAG checks and restore focus', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('networkidle');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  const trigger = page.getByRole('button', { name: 'Try a sample', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(trigger).toBeFocused();
});
