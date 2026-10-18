import fragmentSource from './prism-folds.frag.glsl?raw';

// Decorative WebGL background, independent of domfx effect capture and rendering.
export function createPrismBackground(section: HTMLElement) {
  const canvas = section.querySelector('canvas');
  const button = section.querySelector<HTMLButtonElement>('.shader-motion');
  const status = section.querySelector<HTMLElement>('.shader-status');
  const gl = canvas?.getContext('webgl2', { alpha: false, antialias: false, depth: false });
  if (!canvas || !button || !status || !gl) {
    return () => {};
  }
  const shaders: WebGLShader[] = [];
  const program = gl.createProgram();
  function compile(type: number, source: string) {
    const shader = gl?.createShader(type);
    if (!shader || !gl) {
      throw new Error('Background shader unavailable');
    }
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('Background shader compilation failed');
    }
    return shader;
  }
  try {
    if (!program) {
      throw new Error('Background program unavailable');
    }
    gl.attachShader(
      program,
      compile(
        gl.VERTEX_SHADER,
        `#version 300 es
      void main() {
        vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
        gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
      }`,
      ),
    );
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Background shader link failed');
    }
  } catch {
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.deleteProgram(program);
    status.textContent = 'Still background';
    return () => {};
  }
  const resolution = gl.getUniformLocation(program, 'uResolution');
  const time = gl.getUniformLocation(program, 'uTime');
  const events = new AbortController();
  const options = { signal: events.signal };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = false;
  let visible = true;
  let lost = false;
  let frame = 0;
  let last = 0;
  let elapsed = 8;
  function reduced() {
    return motion.matches || document.documentElement.hasAttribute('data-reduced-motion');
  }
  function draw() {
    if (!canvas || !gl || lost) {
      return;
    }
    const rect = section.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 1.5);
    const scale = Math.min(1, Math.sqrt(1_000_000 / (rect.width * rect.height * dpr * dpr)));
    const width = Math.max(1, Math.floor(rect.width * dpr * scale));
    const height = Math.max(1, Math.floor(rect.height * dpr * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    gl.uniform2f(resolution, width, height);
    gl.uniform1f(time, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function update() {
    if (!button || !status) {
      return;
    }
    button.textContent = playing ? 'Pause background' : 'Animate background';
    button.setAttribute('aria-pressed', String(playing));
    button.disabled = reduced() || lost;
    status.textContent = reduced()
      ? 'Reduced motion: still background'
      : playing
        ? 'Background playing'
        : 'Still background';
  }
  function tick(now: number) {
    frame = 0;
    if (!playing || !visible || document.hidden || lost) {
      return;
    }
    if (now - last >= 1000 / 30) {
      elapsed += Math.min((now - last) / 1000, 0.05);
      last = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(frame);
    frame = 0;
    update();
  }
  button.addEventListener(
    'click',
    () => {
      if (playing) {
        pause();
      } else if (!reduced() && !lost && visible) {
        playing = true;
        last = performance.now();
        update();
        frame = requestAnimationFrame(tick);
      }
    },
    options,
  );
  motion.addEventListener('change', pause, options);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        pause();
      }
    },
    options,
  );
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      lost = true;
      canvas.hidden = true;
      pause();
    },
    options,
  );
  const resize = new ResizeObserver(draw);
  const visibility = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio > 0;
      if (!visible) {
        pause();
      }
    },
    { threshold: 0.01 },
  );
  const preferences = new MutationObserver(pause);
  preferences.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-reduced-motion'],
  });
  resize.observe(section);
  visibility.observe(section);
  canvas.hidden = false;
  button.hidden = false;
  update();
  draw();
  return () => {
    pause();
    events.abort();
    resize.disconnect();
    visibility.disconnect();
    preferences.disconnect();
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.deleteProgram(program);
    canvas.hidden = true;
    button.hidden = true;
  };
}
