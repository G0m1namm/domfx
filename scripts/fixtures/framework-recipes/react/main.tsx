import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { FireButton } from './FireButton';

// Test harness: each control changes one prop of the documented recipe.
function App() {
  const [mounted, setMounted] = useState(true);
  const [clicks, setClicks] = useState(0);
  const [intensity, setIntensity] = useState(0.8);
  const [color, setColor] = useState<string>();
  const [flameReach, setFlameReach] = useState(0.5);
  const [tone, setTone] = useState<'calm' | 'alert'>('calm');
  return (
    <main>
      <button id="toggle" type="button" onClick={() => setMounted(!mounted)}>
        Toggle
      </button>
      <button id="intensity" type="button" onClick={() => setIntensity(0.4)}>
        Intensity
      </button>
      <button id="color" type="button" onClick={() => setColor('#22d3ee')}>
        Color
      </button>
      <button id="reach" type="button" onClick={() => setFlameReach(0.8)}>
        Reach
      </button>
      <button id="tone" type="button" onClick={() => setTone('alert')}>
        Tone
      </button>
      <output id="clicks">{clicks}</output>
      <div>
        {mounted && (
          <FireButton
            onClick={() => setClicks((count) => count + 1)}
            flameReach={flameReach}
            intensity={intensity}
            color={color}
            tone={tone}
          >
            Ignite
          </FireButton>
        )}
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root');
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
