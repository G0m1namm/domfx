import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { summarizeEvidence } from './evidence-inspection.mjs';

test('large sessions retain failure text and references without their payloads', (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'domfx-evidence-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, 'worker.jsonl');
  const contents = [
    JSON.stringify({
      event: 'worker',
      message: 'focused check started',
      prompt: 'PRIVATE_WORKER_PROMPT'.repeat(10_000),
      image: `data:image/png;base64,${'a'.repeat(100_000)}`,
      tool_payload: 'PRIVATE_TOOL_PAYLOAD'.repeat(10_000),
    }),
    JSON.stringify({ status: 'failed', error: { message: 'expected layout assertion' } }),
    JSON.stringify({ message: 'large text '.repeat(10_000) }),
  ].join('\n');
  writeFileSync(path, contents);
  const result = summarizeEvidence([path], { entryChars: 180, totalChars: 400 });
  assert.ok(contents.length > 500_000);
  assert.ok(result.preview.length <= 400);
  assert.ok(result.entries.every((entry) => entry.preview.length <= 180));
  assert.match(result.preview, /worker\.jsonl:2 status=failed error=expected layout assertion/);
  assert.doesNotMatch(result.preview, /PRIVATE_|data:image|base64/);
  assert.deepEqual(result.fullEvidence, [path]);
});

test('CLI bounds the entire output including many full-evidence paths', (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'domfx-evidence-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const paths = Array.from({ length: 24 }, (_, index) => {
    const path = join(root, `worker-${index}.log`);
    writeFileSync(path, 'FAIL: expected layout assertion\n');
    return path;
  });
  const stdout = execFileSync(
    process.execPath,
    [fileURLToPath(new URL('./evidence-inspection.mjs', import.meta.url)), ...paths],
    { encoding: 'utf8' },
  );
  assert.ok(stdout.length <= 1_201, `unbounded stdout: ${stdout.length} characters`);
  assert.match(stdout, /worker-0\.log:1 FAIL/);
});
