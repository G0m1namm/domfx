<script setup lang="ts">
import { useTemplateRef } from 'vue';

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

const { lifecycle } = useDomfxEffect({
  host,
  target,
  attach: attachFire,
  options: () => ({ clock: 'auto', flameReach }),
  controls: () => ({ intensity, color }),
  refreshOn: () => tone,
});
</script>

<template>
  <div ref="host" class="fire-host" :data-tone="tone" :data-effect="lifecycle">
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

/* Without a live effect, a static glow keeps the button's look. */
.fire-host:is([data-effect='unavailable'], [data-effect='suspended']) .fire-target {
  box-shadow: 0 -4px 24px #f97316;
}
</style>
