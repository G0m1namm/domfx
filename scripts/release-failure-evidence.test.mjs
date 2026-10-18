import assert from 'node:assert/strict';
import { test } from 'node:test';

import { captureFailureEvidence } from './release-failure-evidence.mjs';

test('captures a recipe failure without a lifecycle report', async () => {
  const screenshots = [];
  const page = {
    evaluate: async () => null,
    screenshot: async (options) => screenshots.push(options.path),
  };
  const consumer = { errors: [] };

  await captureFailureEvidence(page, consumer, '/tmp/recipe-failure.png');

  assert.equal(consumer.pageReport, null);
  assert.deepEqual(screenshots, ['/tmp/recipe-failure.png']);
  assert.deepEqual(consumer.errors, []);
});

test('still captures a screenshot when report collection fails', async () => {
  const screenshots = [];
  const page = {
    evaluate: async () => {
      throw new Error('report unavailable');
    },
    screenshot: async (options) => screenshots.push(options.path),
  };
  const consumer = { errors: [] };

  await captureFailureEvidence(page, consumer, '/tmp/failure.png');

  assert.deepEqual(screenshots, ['/tmp/failure.png']);
  assert.match(consumer.errors[0], /report unavailable/);
});

test('records a screenshot failure when the page cannot be captured', async () => {
  const page = {
    evaluate: async () => '{"outcome":"FAIL"}',
    screenshot: async () => {
      throw new Error('page closed');
    },
  };
  const consumer = { errors: [] };

  await captureFailureEvidence(page, consumer, '/tmp/failure.png');

  assert.equal(consumer.pageReport, '{"outcome":"FAIL"}');
  assert.match(consumer.errors[0], /page closed/);
});
