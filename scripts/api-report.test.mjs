import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { reportedPackages, runApiReport } from './api-report.mjs';

const root = resolve(import.meta.dirname, '..');

function withReportCopy(packagePath, callback) {
  const reportFolder = mkdtempSync(join(tmpdir(), 'domfx-api-report-'));
  try {
    cpSync(join(root, packagePath, 'api'), reportFolder, { recursive: true });
    callback(reportFolder);
  } finally {
    rmSync(reportFolder, { force: true, recursive: true });
  }
}

test('committed API reports match the built declarations', () => {
  for (const packagePath of reportedPackages) {
    const { apiReportChanged, succeeded } = runApiReport(packagePath);
    assert.equal(apiReportChanged, false, packagePath);
    assert.equal(succeeded, true, packagePath);
  }
});

test('a public API change without a reviewed report fails', () => {
  withReportCopy('packages/domfx', (reportFolder) => {
    const report = join(reportFolder, 'browser.api.md');
    writeFileSync(report, readFileSync(report, 'utf8').replace(/export function \w+/, '$&Renamed'));
    const { apiReportChanged, succeeded } = runApiReport('packages/domfx', { reportFolder });
    assert.equal(apiReportChanged, true);
    assert.equal(succeeded, false);
  });
});

test('the browser report leaves out /experimental', () => {
  const report = readFileSync(join(root, 'packages/domfx/api/browser.api.md'), 'utf8');
  assert.doesNotMatch(report, /captureElement|GpuExperiment/);
});
