import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { SourceMap } from 'node:module';
import { dirname, relative, resolve } from 'node:path';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const placementSource = (source) =>
  source.endsWith('/src/placement.ts') || source.endsWith('/src/placement-geometry.ts');
const floatingSource = (source) => source.includes('/@floating-ui/');

/** Read only the maps emitted for this isolated diagnostic consumer. */
export async function attributionSources(directory, libraryDirectory) {
  const scripts = new Map();
  for (const folder of [directory, libraryDirectory]) {
    for (const entry of await readdir(folder, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.js')) {
        continue;
      }
      const path = resolve(entry.parentPath, entry.name);
      const text = await readFile(path, 'utf8');
      const mapBytes = await readFile(`${path}.map`);
      scripts.set(path, {
        path,
        text,
        map: new SourceMap(JSON.parse(mapBytes)),
        scriptSha256: hash(text),
        sourceMapSha256: hash(mapBytes),
      });
    }
  }
  const scriptFor = (url) => scripts.get(resolve(directory, `.${new URL(url).pathname}`));
  function mapFrame(frame) {
    if (!frame.url || frame.lineNumber < 0 || frame.columnNumber < 0) {
      return undefined;
    }
    let script = scriptFor(frame.url);
    let line = frame.lineNumber;
    let column = frame.columnNumber;
    const visited = new Set();
    while (script && !visited.has(script.path)) {
      visited.add(script.path);
      const mapped = script.map.findEntry(line, column);
      if (typeof mapped?.originalSource !== 'string') {
        return undefined;
      }
      const source = resolve(dirname(script.path), mapped.originalSource);
      line = mapped.originalLine;
      column = mapped.originalColumn;
      script = scripts.get(source);
      if (!script) {
        return { source: source.replaceAll('\\', '/'), line, column };
      }
    }
  }
  return {
    scriptFor,
    mapFrame,
    identities: [...scripts.values()].map(({ path, scriptSha256, sourceMapSha256 }) => ({
      path: relative(directory, path),
      scriptSha256,
      sourceMapSha256,
    })),
  };
}

/** Precise function coverage is isolated from profiling: it disables optimization. */
export function placementInvocations(coverage, sources) {
  const matches = [];
  for (const script of coverage.result) {
    const compiled = script.url && sources.scriptFor(script.url);
    if (!compiled) {
      continue;
    }
    for (const fn of script.functions) {
      if (
        fn.functionName !== 'measureEffectPlacement' ||
        !fn.isBlockCoverage ||
        !fn.ranges.length
      ) {
        continue;
      }
      const range = fn.ranges[0];
      const prefix = compiled.text.slice(0, range.startOffset).split('\n');
      const mapped = sources.mapFrame({
        url: script.url,
        lineNumber: prefix.length - 1,
        columnNumber: prefix.at(-1).length,
      });
      if (!mapped?.source.endsWith('/src/placement.ts')) {
        continue;
      }
      matches.push({
        functionName: fn.functionName,
        url: script.url,
        ...range,
        mapped,
        scriptSha256: compiled.scriptSha256,
        sourceMapSha256: compiled.sourceMapSha256,
        generatedRangeSha256: hash(compiled.text.slice(range.startOffset, range.endOffset)),
      });
    }
  }
  if (matches.length !== 1) {
    throw new Error(`expected one source-mapped placement function, found ${matches.length}`);
  }
  return matches[0];
}

/** Inclusive stack attribution counts each sample once, including async resumes. */
export function placementCpuSamples(profile, mapFrame) {
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map();
  for (const node of profile.nodes) {
    for (const child of node.children ?? []) {
      parents.set(child, node.id);
    }
  }
  const sampledUs = deltas.reduce((sum, delta) => sum + delta, 0);
  const profileSpanUs = profile.endTime - profile.startTime;
  if (
    !samples.length ||
    samples.length !== deltas.length ||
    deltas.some((delta) => !Number.isFinite(delta) || delta < 0) ||
    samples.some((id) => !nodes.has(id)) ||
    !Number.isFinite(profileSpanUs) ||
    sampledUs > profileSpanUs
  ) {
    throw new Error('invalid CPU profile samples/timeDeltas');
  }
  let attributedSamples = 0;
  let attributedUs = 0;
  let mappedLeafSamples = 0;
  const leafFunctions = new Map();
  for (const [index, id] of samples.entries()) {
    let current = id;
    let attributed = false;
    let leaf = true;
    const visited = new Set();
    while (current !== undefined && !visited.has(current)) {
      visited.add(current);
      const node = nodes.get(current);
      const mapped = node && mapFrame(node.callFrame);
      const relevant = mapped && (placementSource(mapped.source) || floatingSource(mapped.source));
      if (leaf && mapped) {
        mappedLeafSamples += 1;
      }
      if (leaf && relevant) {
        const key = `${mapped.source}:${mapped.line}:${node.callFrame.functionName}`;
        const previous = leafFunctions.get(key) ?? {
          ...mapped,
          functionName: node.callFrame.functionName,
          samples: 0,
          estimatedUs: 0,
        };
        previous.samples += 1;
        previous.estimatedUs += deltas[index];
        leafFunctions.set(key, previous);
      }
      attributed ||= Boolean(relevant);
      leaf = false;
      current = parents.get(current);
    }
    if (attributed) {
      attributedSamples += 1;
      attributedUs += deltas[index];
    }
  }
  return {
    samples: samples.length,
    sampledUs,
    profileSpanUs,
    maxSampleDeltaUs: Math.max(...deltas),
    mappedLeafSamples,
    unmappedLeafSamples: samples.length - mappedLeafSamples,
    attributedSamples,
    attributedEstimatedMs: attributedUs / 1000,
    leafFunctions: [...leafFunctions.values()].sort((a, b) => b.samples - a.samples),
  };
}
