<script setup lang="ts">
import { ref } from 'vue';

import FireButton from './FireButton.vue';

// Test harness: each control changes one prop of the documented recipe.
const mounted = ref(true);
const clicks = ref(0);
const intensity = ref(0.8);
const color = ref<string>();
const flameReach = ref(0.5);
const tone = ref<'calm' | 'alert'>('calm');
</script>

<template>
  <main>
    <button id="toggle" type="button" @click="mounted = !mounted">Toggle</button>
    <button id="intensity" type="button" @click="intensity = 0.4">Intensity</button>
    <button id="color" type="button" @click="color = '#22d3ee'">Color</button>
    <button id="reach" type="button" @click="flameReach = 0.8">Reach</button>
    <button id="tone" type="button" @click="tone = 'alert'">Tone</button>
    <output id="clicks">{{ clicks }}</output>
    <div>
      <FireButton
        v-if="mounted"
        :flame-reach="flameReach"
        :intensity="intensity"
        :color="color"
        :tone="tone"
        @click="clicks++"
      >
        Ignite
      </FireButton>
    </div>
  </main>
</template>
