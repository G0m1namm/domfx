import assert from 'node:assert/strict';
import { test } from 'node:test';

import { effectCreationFields, intensityField } from '../src/effect-extent.ts';
import {
  defaultEffectSettings,
  effectAttachmentOptions,
  effectSettingsDiffer,
  effectSettingsSearch,
  effectSliderStops,
  effectSnippet,
  encodeEffectSettings,
  marketingEffectSearch,
  parseEffectSettings,
  parseMarketingEffectSearch,
  snapEffectSliderValue,
  switchFireColorMode,
} from '../src/effect-settings.ts';
import { effects, findEffect } from '../src/effects.ts';

const fire = findEffect('fire');
const frost = findEffect('frost');
const slime = findEffect('slime');
const burnedPaper = findEffect('burned-paper');
const halftone = findEffect('halftone');

function parse(effect, search) {
  return parseEffectSettings(effect, new URLSearchParams(search));
}

/** A valid value away from each default; presets use a listed option. */
function changedOptions(effect) {
  const defaults = defaultEffectSettings(effect).options;
  const changed = { ...defaults };
  for (const field of effectCreationFields(effect)) {
    changed[field.name] = field.kind === 'preset' ? 0 : 0.27;
  }
  for (const name of ['mistOpacity', 'emberGlow']) {
    if (name in defaults) {
      changed[name] = 0.4;
    }
  }
  return changed;
}

function changedSettings(effect) {
  return {
    intensity: 0.45,
    seed: 2048,
    clock: 'manual',
    time: 7.3,
    motion: 'static',
    options: changedOptions(effect),
    color:
      effect.id === 'burned-paper' ? { mode: 'authored' } : { mode: 'single', color: '#336699' },
  };
}

test('catalog has the 21 effects these checks cover', () => {
  assert.equal(effects.length, 21);
});

for (const effect of effects) {
  test(`${effect.id}: defaults produce an empty link and no difference`, () => {
    const defaults = defaultEffectSettings(effect);
    assert.equal(defaults.seed, 314);
    assert.equal(defaults.time, 0);
    assert.equal(defaults.clock, 'auto');
    assert.equal(defaults.motion, 'respect');
    assert.equal(encodeEffectSettings(effect, defaults).toString(), '');
    assert.equal(effectSettingsDiffer(effect, defaults), false);
    assert.deepEqual(parse(effect, ''), defaults);
  });

  test(`${effect.id}: every changed setting survives the link round trip`, () => {
    const settings = changedSettings(effect);
    const params = encodeEffectSettings(effect, settings);
    assert.deepEqual(parseEffectSettings(effect, params), settings);
    assert.equal(effectSettingsDiffer(effect, settings), true);
    assert.equal(params.has('subject'), false);
    assert.equal(params.has('zoom'), false);
  });

  test(`${effect.id}: one changed setting encodes only that setting`, () => {
    const settings = { ...defaultEffectSettings(effect), seed: 7 };
    assert.equal(encodeEffectSettings(effect, settings).toString(), 'seed=7');
  });

  test(`${effect.id}: copied code lists its options from one source`, () => {
    for (const settings of [defaultEffectSettings(effect), changedSettings(effect)]) {
      const code = effectSnippet(effect, settings, 'en');
      assert.ok(code.startsWith(`import { ${effect.exportName} } from '@domfx/browser';\n`));
      assert.ok(code.includes(`const effect = ${effect.exportName}(target, {\n  host,\n`));
      assert.ok(code.endsWith('// On unmount: effect.dispose();'));
      assert.equal(code.includes('ambient'), false);
      const written = Object.fromEntries(
        [...code.matchAll(/^ {2}(\w+): (.+),$/gm)].map(([, name, value]) => [
          name,
          value.startsWith("'") ? value.slice(1, -1) : Number(value),
        ]),
      );
      assert.deepEqual(written, effectAttachmentOptions(effect, settings));
    }
  });
}

test('default options use existing metadata, including writable and preset fields', () => {
  assert.equal(defaultEffectSettings(fire).intensity, intensityField.defaultValue / 100);
  assert.deepEqual(defaultEffectSettings(fire).options, { flameReach: 0.2, emberDensity: 1 });
  assert.deepEqual(defaultEffectSettings(frost).options, {
    coatingDepth: 0.1,
    mistReach: 0.2,
    mistOpacity: 1,
  });
  assert.deepEqual(defaultEffectSettings(slime).options, {
    coatingDepth: 0.05,
    dripReach: 0.2,
    dripDensity: 0.56,
  });
  assert.deepEqual(defaultEffectSettings(halftone).options, { plumeReach: 0.1, bandDepth: 0.05 });
});

test('default Fire code matches the agreed layout in both languages', () => {
  const body = [
    "import { attachFire } from '@domfx/browser';",
    '',
    'const effect = attachFire(target, {',
    '  host,',
    "  clock: 'auto',",
    '  intensity: 1,',
    '  seed: 314,',
    '  flameReach: 0.2,',
    '  emberDensity: 1,',
    '});',
    '',
    '',
  ].join('\n');
  const defaults = defaultEffectSettings(fire);
  assert.equal(effectSnippet(fire, defaults, 'en'), `${body}// On unmount: effect.dispose();`);
  assert.equal(effectSnippet(fire, defaults, 'es'), `${body}// Al desmontar: effect.dispose();`);
});

test('code adds motion, time and colors only when relevant', () => {
  const defaults = defaultEffectSettings(fire);
  const plain = effectSnippet(fire, defaults, 'en');
  for (const name of ['motion', 'time', 'color', 'rootColor', 'tipColor']) {
    assert.equal(plain.includes(`${name}:`), false, name);
  }
  const held = { ...defaults, time: 5 };
  assert.equal(effectSnippet(fire, held, 'en').includes('time:'), false);
  const manual = effectSnippet(fire, { ...held, clock: 'manual' }, 'en');
  assert.match(manual, /clock: 'manual',\n {2}time: 5,/);
  const manualAtZero = effectSnippet(fire, { ...defaults, clock: 'manual' }, 'en');
  assert.match(manualAtZero, /time: 0,/);
  assert.match(effectSnippet(fire, { ...defaults, motion: 'static' }, 'en'), /motion: 'static',/);
  const oneSide = effectSnippet(
    fire,
    { ...defaults, color: { mode: 'root-and-tip', tipColor: '#336699' } },
    'en',
  );
  assert.match(oneSide, /tipColor: '#336699',/);
  assert.equal(oneSide.includes('rootColor'), false);
  assert.equal(oneSide.includes(' color:'), false);
});

test('Burned paper never emits a color and other effects never emit the pair', () => {
  const single = {
    ...defaultEffectSettings(burnedPaper),
    color: { mode: 'single', color: '#fff' },
  };
  assert.equal(effectAttachmentOptions(burnedPaper, single).color, undefined);
  const pair = {
    ...defaultEffectSettings(frost),
    color: { mode: 'root-and-tip', rootColor: '#336699' },
  };
  assert.equal(effectAttachmentOptions(frost, pair).rootColor, undefined);
});

test('link uses API names and values for Fire colors', () => {
  const defaults = defaultEffectSettings(fire);
  const single = { ...defaults, color: { mode: 'single', color: '#336699' } };
  assert.equal(encodeEffectSettings(fire, single).get('color'), '#336699');
  assert.deepEqual(
    parseEffectSettings(fire, encodeEffectSettings(fire, single)).color,
    single.color,
  );
  for (const color of [
    { mode: 'root-and-tip', rootColor: '#112233' },
    { mode: 'root-and-tip', tipColor: '#445566' },
    { mode: 'root-and-tip', rootColor: '#112233', tipColor: '#445566' },
  ]) {
    const settings = { ...defaults, color };
    assert.deepEqual(parseEffectSettings(fire, encodeEffectSettings(fire, settings)), settings);
  }
});

const invalidCases = [
  ['intensity above range', 'intensity=1.5'],
  ['intensity below range', 'intensity=-0.1'],
  ['intensity text', 'intensity=high'],
  ['empty number', 'intensity='],
  ['hexadecimal number', 'intensity=0x1'],
  ['infinite number', 'intensity=Infinity'],
  ['extent above range', 'flameReach=0.31'],
  ['extent below range', 'flameReach=-0.01'],
  ['preset value not offered', 'emberDensity=0.3'],
  ['seed text', 'seed=abc'],
  ['seed overflowing float32', 'seed=1e39'],
  ['seed overflowing a number', 'seed=1e999'],
  ['unknown clock', 'clock=sometimes'],
  ['legacy clock alias', 'clock=ambient'],
  ['unknown motion', 'motion=none'],
  ['color word', 'color=red'],
  ['color without a hash', 'color=336699'],
  ['color with alpha', 'color=%2333669980'],
  ['time above range under manual', 'clock=manual&time=20.1', { clock: 'manual' }],
  ['time below range under manual', 'clock=manual&time=-1', { clock: 'manual' }],
  ['time text under manual', 'clock=manual&time=soon', { clock: 'manual' }],
  ['time without manual', 'time=5'],
  ['time under auto', 'clock=auto&time=5'],
  ['option belonging to another effect', 'mistOpacity=0.5&dripReach=0.1'],
  ['unrelated params', 'subject=svg&zoom=2&pan=1&audience=agents&__proto__=1'],
];

for (const [label, search, expected = {}] of invalidCases) {
  test(`bad link input falls back quietly: ${label}`, () => {
    assert.deepEqual(parse(fire, search), { ...defaultEffectSettings(fire), ...expected });
  });
}

test('a bad value does not disturb a good one beside it', () => {
  const settings = parse(fire, 'seed=7&intensity=9&flameReach=0.1&emberDensity=9');
  assert.equal(settings.seed, 7);
  assert.equal(settings.intensity, 1);
  assert.deepEqual(settings.options, { flameReach: 0.1, emberDensity: 1 });
});

test('color is dropped when it arrives with the pair', () => {
  assert.deepEqual(parse(fire, 'color=%23336699&rootColor=%23112233').color, {
    mode: 'root-and-tip',
    rootColor: '#112233',
  });
  assert.deepEqual(parse(fire, 'color=%23336699&tipColor=%23445566&rootColor=bad').color, {
    mode: 'root-and-tip',
    tipColor: '#445566',
  });
  // An invalid side counts as absent, so it does not remove a valid color.
  assert.deepEqual(parse(fire, 'color=%23336699&rootColor=bad').color, {
    mode: 'single',
    color: '#336699',
  });
});

test('colors are normalized for the native picker', () => {
  assert.deepEqual(parse(fire, 'color=%23ABC').color, { mode: 'single', color: '#aabbcc' });
  assert.deepEqual(parse(fire, 'color=%2333AA99').color, { mode: 'single', color: '#33aa99' });
});

test('colors the effect cannot use are ignored', () => {
  assert.deepEqual(parse(burnedPaper, 'color=%23336699').color, { mode: 'authored' });
  assert.deepEqual(parse(frost, 'rootColor=%23112233').color, { mode: 'authored' });
});

test('boundary values are accepted', () => {
  assert.equal(parse(fire, 'flameReach=0.3').options.flameReach, 0.3);
  assert.equal(parse(fire, 'flameReach=0').options.flameReach, 0);
  assert.equal(parse(fire, 'intensity=0').intensity, 0);
  assert.equal(parse(fire, 'clock=manual&time=20').time, 20);
  assert.equal(parse(slime, 'dripDensity=0.2').options.dripDensity, 0.2);
});

test('marketing params open the named dialog and ignore unknown effects', () => {
  const opened = parseMarketingEffectSearch('?audience=agents&effect=fire&seed=7');
  assert.equal(opened?.effect, fire);
  assert.equal(opened?.settings.seed, 7);
  assert.equal(parseMarketingEffectSearch('?effect=plasma&seed=7'), undefined);
  assert.equal(parseMarketingEffectSearch('?effect=__proto__'), undefined);
  assert.equal(parseMarketingEffectSearch('?effect='), undefined);
  assert.equal(parseMarketingEffectSearch('?audience=agents'), undefined);
  assert.equal(parseMarketingEffectSearch(''), undefined);
});

test('marketing link keeps audience and replaces stale settings', () => {
  const settings = { ...defaultEffectSettings(frost), seed: 7 };
  const search = marketingEffectSearch(
    '?audience=agents&effect=fire&flameReach=0.1&seed=9&time=1',
    frost,
    settings,
  );
  const params = new URLSearchParams(search);
  assert.equal(params.get('audience'), 'agents');
  assert.equal(params.get('effect'), 'frost');
  assert.equal(params.get('seed'), '7');
  assert.equal(params.has('flameReach'), false);
  assert.equal(params.has('time'), false);
  const reopened = parseMarketingEffectSearch(search);
  assert.equal(reopened?.effect, frost);
  assert.deepEqual(reopened?.settings, settings);
  assert.equal(marketingEffectSearch('', frost, defaultEffectSettings(frost)), '?effect=frost');
});

test('page link omits effect, keeps other params and clears stale settings', () => {
  const settings = { ...defaultEffectSettings(fire), seed: 7 };
  assert.equal(
    effectSettingsSearch('?ref=a&seed=9&zoom=2', fire, settings),
    '?ref=a&zoom=2&seed=7',
  );
  assert.equal(effectSettingsSearch('?seed=9', fire, defaultEffectSettings(fire)), '');
});

test('Reset all compares effective output and returns defaults', () => {
  const defaults = defaultEffectSettings(fire);
  assert.equal(effectSettingsDiffer(fire, { ...defaults, intensity: 0.5 }), true);
  assert.equal(effectSettingsDiffer(fire, { ...defaults, clock: 'manual' }), true);
  assert.equal(effectSettingsDiffer(fire, { ...defaults, motion: 'static' }), true);
  assert.equal(
    effectSettingsDiffer(fire, { ...defaults, options: { ...defaults.options, emberDensity: 0 } }),
    true,
  );
  // A held time has no effect under Automatic animation.
  assert.equal(effectSettingsDiffer(fire, { ...defaults, time: 5 }), false);
  assert.deepEqual(defaultEffectSettings(fire), defaults);
  for (const name of ['subject', 'zoom', 'pan']) {
    assert.equal(name in defaults, false);
  }
});

test('Fire mode switching clears the other mode and an unset pair changes nothing', () => {
  const defaults = defaultEffectSettings(fire);
  const pair = switchFireColorMode(defaults, 'root-and-tip');
  assert.deepEqual(pair.color, { mode: 'root-and-tip' });
  assert.equal(effectSettingsDiffer(fire, pair), false);
  assert.deepEqual(effectAttachmentOptions(fire, pair), effectAttachmentOptions(fire, defaults));
  assert.equal(effectSnippet(fire, pair, 'en'), effectSnippet(fire, defaults, 'en'));

  const picked = { ...pair, color: { mode: 'root-and-tip', rootColor: '#112233' } };
  assert.deepEqual(switchFireColorMode(picked, 'single').color, { mode: 'single' });
  assert.deepEqual(switchFireColorMode(picked, 'authored').color, { mode: 'authored' });
  assert.equal(switchFireColorMode(picked, 'root-and-tip'), picked);
  const single = { ...defaults, color: { mode: 'single', color: '#336699' } };
  assert.deepEqual(switchFireColorMode(single, 'root-and-tip').color, { mode: 'root-and-tip' });
});

test('slider stops come from min, default and max without duplicates', () => {
  const [flameReach, emberDensity] = effectCreationFields(fire);
  assert.deepEqual(effectSliderStops(flameReach), [0, 20, 30]);
  assert.deepEqual(effectSliderStops(intensityField), [0, 100]);
  assert.deepEqual(effectSliderStops(emberDensity), []);
});

test('slider values snap to a stop within one step and stay continuous elsewhere', () => {
  const [flameReach, emberDensity] = effectCreationFields(fire);
  assert.equal(snapEffectSliderValue(flameReach, 19), 20);
  assert.equal(snapEffectSliderValue(flameReach, 21), 20);
  assert.equal(snapEffectSliderValue(flameReach, 18), 18);
  assert.equal(snapEffectSliderValue(flameReach, 1), 0);
  assert.equal(snapEffectSliderValue(flameReach, 29), 30);
  assert.equal(snapEffectSliderValue(flameReach, 18, 2), 20);
  assert.equal(snapEffectSliderValue(emberDensity, 50), 50);
});
