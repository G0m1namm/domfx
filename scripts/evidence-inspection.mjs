import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const selectedFields = [
  'event',
  'type',
  'status',
  'message',
  'error',
  'reason',
  'command',
  'durationMs',
  'exitCode',
  'signal',
];
const omittedField = /base64|image|payload|prompt|result|screenshot|tool/i;

function truncate(text, limit) {
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1))}…`;
}

function textValue(value) {
  if (typeof value === 'string') {
    return value.startsWith('data:image/') ? '' : sanitize(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value && typeof value === 'object' && typeof value.message === 'string') {
    return textValue(value.message);
  }
  return '';
}

function sanitize(text) {
  return text
    .replace(/data:[^\s;]+;base64,[^\s]+/gi, '')
    .replace(/(?:base64|tool payload)\s*[:=]\s*[^\s]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function jsonPreview(line) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return sanitize(line);
  }
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return '';
  }
  return selectedFields
    .filter((field) => field in entry && !omittedField.test(field))
    .map((field) => {
      const value = textValue(entry[field]);
      return value ? `${field}=${value}` : '';
    })
    .filter(Boolean)
    .join(' ');
}

function sourceLabel(path, line) {
  const local = relative(process.cwd(), path);
  return `${local && !local.startsWith('..') ? local : path}:${line}`;
}

/**
 * Select bounded, human-readable entries from local JSONL or text evidence.
 * The returned fullEvidence paths retain access to the unmodified local files.
 */
export function summarizeEvidence(paths, { entryChars = 240, totalChars = 1_200 } = {}) {
  if (
    !Number.isInteger(entryChars) ||
    entryChars < 1 ||
    !Number.isInteger(totalChars) ||
    totalChars < 1
  ) {
    throw new Error('entryChars and totalChars must be positive integers');
  }
  const fullEvidence = paths.map((path) => realpathSync(resolve(path)));
  const entries = [];
  let remaining = totalChars;
  for (const path of fullEvidence) {
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (!line.trim() || remaining === 0) {
        continue;
      }
      const content = jsonPreview(line);
      if (!content) {
        continue;
      }
      const source = sourceLabel(path, index + 1);
      const separatorChars = entries.length === 0 ? 0 : 1;
      if (remaining <= separatorChars) {
        continue;
      }
      const preview = truncate(
        `${source} ${content}`,
        Math.min(entryChars, remaining - separatorChars),
      );
      entries.push({ source, preview });
      remaining -= separatorChars + preview.length;
    }
  }
  return { fullEvidence, entries, preview: entries.map((entry) => entry.preview).join('\n') };
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  fileURLToPath(import.meta.url) === realpathSync(process.argv[1])
) {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error('Usage: node scripts/evidence-inspection.mjs <log-or-jsonl>...');
    process.exitCode = 1;
  } else {
    const result = summarizeEvidence(paths);
    console.log(result.preview);
    console.log(`\nFull local evidence:\n${result.fullEvidence.join('\n')}`);
  }
}
