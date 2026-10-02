/** Observe native resource ownership without replacing observer or frame delivery. */
export function installStressProbe() {
  const buffers = new Map<GPUBuffer, number>();
  const textures = new Set<GPUTexture>();
  const createBuffer = GPUDevice.prototype.createBuffer;
  const createTexture = GPUDevice.prototype.createTexture;
  let peakBufferBytes = 0;
  let peakTextures = 0;
  const bufferBytes = () => [...buffers.values()].reduce((sum, bytes) => sum + bytes, 0);
  GPUDevice.prototype.createBuffer = function (descriptor) {
    const buffer = createBuffer.call(this, descriptor);
    buffers.set(buffer, buffer.size);
    peakBufferBytes = Math.max(peakBufferBytes, bufferBytes());
    const destroy = buffer.destroy.bind(buffer);
    buffer.destroy = () => {
      buffers.delete(buffer);
      destroy();
    };
    return buffer;
  };
  GPUDevice.prototype.createTexture = function (descriptor) {
    const texture = createTexture.call(this, descriptor);
    textures.add(texture);
    peakTextures = Math.max(peakTextures, textures.size);
    const destroy = texture.destroy.bind(texture);
    texture.destroy = () => {
      textures.delete(texture);
      destroy();
    };
    return texture;
  };
  const mutations = new Set<MutationObserver>();
  const resizes = new Set<ResizeObserver>();
  const intersections = new Set<IntersectionObserver>();
  const mutationObserve = MutationObserver.prototype.observe;
  const mutationDisconnect = MutationObserver.prototype.disconnect;
  const resizeObserve = ResizeObserver.prototype.observe;
  const resizeDisconnect = ResizeObserver.prototype.disconnect;
  const intersectionObserve = IntersectionObserver.prototype.observe;
  const intersectionDisconnect = IntersectionObserver.prototype.disconnect;
  MutationObserver.prototype.observe = function (...args) {
    mutationObserve.apply(this, args);
    mutations.add(this);
  };
  MutationObserver.prototype.disconnect = function () {
    mutations.delete(this);
    mutationDisconnect.call(this);
  };
  ResizeObserver.prototype.observe = function (...args) {
    resizeObserve.apply(this, args);
    resizes.add(this);
  };
  ResizeObserver.prototype.disconnect = function () {
    resizes.delete(this);
    resizeDisconnect.call(this);
  };
  IntersectionObserver.prototype.observe = function (...args) {
    intersectionObserve.apply(this, args);
    intersections.add(this);
  };
  IntersectionObserver.prototype.disconnect = function () {
    intersections.delete(this);
    intersectionDisconnect.call(this);
  };
  const request = window.requestAnimationFrame.bind(window);
  const cancel = window.cancelAnimationFrame.bind(window);
  const pending = new Map<number, FrameRequestCallback>();
  const background = new Set<FrameRequestCallback>();
  let warming = true;
  window.requestAnimationFrame = (callback) => {
    if (warming) {
      background.add(callback);
    }
    const id = request((timestamp) => {
      pending.delete(id);
      callback(timestamp);
    });
    pending.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    pending.delete(id);
    cancel(id);
  };
  return {
    // Warm GSAP's ticker before attachment work; exclude that caller-owned callback.
    finishWarmup() {
      warming = false;
    },
    snapshot() {
      return {
        bufferBytes: bufferBytes(),
        textures: textures.size,
        mutationObservers: mutations.size,
        resizeObservers: resizes.size,
        intersectionObservers: intersections.size,
        scheduledFrames: [...pending.values()].filter((cb) => !background.has(cb)).length,
      };
    },
    peaks() {
      return { peakBufferBytes, peakTextures };
    },
    restore() {
      GPUDevice.prototype.createBuffer = createBuffer;
      GPUDevice.prototype.createTexture = createTexture;
      MutationObserver.prototype.observe = mutationObserve;
      MutationObserver.prototype.disconnect = mutationDisconnect;
      ResizeObserver.prototype.observe = resizeObserve;
      ResizeObserver.prototype.disconnect = resizeDisconnect;
      IntersectionObserver.prototype.observe = intersectionObserve;
      IntersectionObserver.prototype.disconnect = intersectionDisconnect;
      window.requestAnimationFrame = request;
      window.cancelAnimationFrame = cancel;
    },
  };
}
