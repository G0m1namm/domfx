<script setup lang="ts">
import { useTemplateRef, watch } from 'vue';

import { attachFire } from '@domfx/browser';

import { useDomfxEffect } from './use-domfx-effect';

const {
  flameReach,
  intensity = 0.8,
  color,
  tone = 'calm',
} = defineProps<{
  /** Creation-only: a change replaces the effect. */
  flameReach?: number;
  /** Writable: applied to the live effect. */
  intensity?: number;
  color?: string;
  /** Styles the host, which the effect does not observe. */
  tone?: 'calm' | 'alert';
}>();
const emit = defineEmits<{ click: [] }>();

const host = useTemplateRef<HTMLDivElement>('host');
const target = useTemplateRef<HTMLButtonElement>('target');

const fire = useDomfxEffect(
  host,
  target,
  () => ({ flameReach }),
  (targetElement, hostElement, options) =>
    attachFire(targetElement, {
      host: hostElement,
      clock: 'auto',
      motion: 'respect',
      flameReach: options.flameReach,
      seed: 314,
    }),
  // Writable controls update the live effect without recapturing the target.
  () => ({ intensity, color }),
);

// Target changes refresh automatically; a host style change needs refresh().
watch(
  () => tone,
  () => {
    // Rejects after disposal or when the capture fails; fire.reason has the cause.
    fire.value?.refresh().catch(() => {});
  },
  { flush: 'post' },
);
</script>

<template>
  <div ref="host" class="fire-host" :data-tone="tone">
    <button ref="target" class="fire-target" type="button" @click="emit('click')">
      <slot />
    </button>
  </div>
</template>

<style>
/* The host is positioned and leaves room above the button for the flames. */
.fire-host {
  position: relative;
  display: inline-block;
  padding: 72px 32px 16px;
}

.fire-target {
  padding: 12px 20px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: #1f2937;
  font: 600 1rem/1 system-ui, sans-serif;
}

.fire-host[data-tone='alert'] .fire-target {
  background: #b91c1c;
}
</style>
