import assert from 'node:assert/strict';
import { join } from 'node:path';

import ts from 'typescript';

const coreExports = [
  'CaptureFrame',
  'ClockMode',
  'EffectHandle',
  'EffectName',
  'EffectReason',
  'ManualEffectHandle',
  'classifyAlpha',
];
const browserExports = [
  ...coreExports.filter((name) => name !== 'classifyAlpha'),
  'CaptureError',
  'CaptureErrorCode',
  'BurnedPaperOptions',
  'DitherOptions',
  'ElectricityOptions',
  'FireOptions',
  'FrostOptions',
  'KineticOptions',
  'PatternEffect',
  'PatternOptions',
  'SlimeOptions',
  'attachBrushFringe',
  'attachBurnedPaper',
  'attachCircuits',
  'attachContourEchoes',
  'attachCrosshatch',
  'attachDiamonds',
  'attachDither',
  'attachElectricity',
  'attachEngraving',
  'attachFire',
  'attachFrost',
  'attachHalftone',
  'attachHexagons',
  'attachInterference',
  'attachKinetic',
  'attachScanlines',
  'attachShards',
  'attachSlime',
  'attachStarShimmer',
  'attachStipple',
  'attachWovenMesh',
  'captureElement',
];
for (const module of [ts.ModuleKind.NodeNext, ts.ModuleKind.ESNext]) {
  for (const name of ['core', 'browser']) {
    const program = ts.createProgram([join(import.meta.dirname, `${name}.ts`)], {
      target: ts.ScriptTarget.ES2022,
      module,
      moduleResolution:
        module === ts.ModuleKind.NodeNext
          ? ts.ModuleResolutionKind.NodeNext
          : ts.ModuleResolutionKind.Bundler,
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      types: [],
      lib:
        name === 'core'
          ? ['lib.es2022.d.ts']
          : ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => import.meta.dirname,
        getCanonicalFileName: (file) => file,
        getNewLine: () => '\n',
      }),
    );
    for (const file of program.getSourceFiles()) {
      assert.doesNotMatch(
        file.fileName,
        /\/(?:typegpu|@webgpu|gsap)\//,
        'Root declarations must not pull in renderer or animation types',
      );
      assert.doesNotMatch(file.fileName, /\/dist\/(?:gpu|experimental|renderer-service)\.d\.ts$/);
    }
    const checker = program.getTypeChecker();
    const source = program.getSourceFile(join(import.meta.dirname, `${name}.ts`));
    const symbol = checker.getSymbolAtLocation(source.statements[0].moduleSpecifier);
    assert.deepEqual(
      checker
        .getExportsOfModule(symbol)
        .map((item) => item.name)
        .sort(),
      (name === 'core' ? coreExports : browserExports).toSorted(),
    );
    console.log(`${name}: strict ${ts.ModuleKind[module]} declarations and root exports: PASS`);
  }
}
