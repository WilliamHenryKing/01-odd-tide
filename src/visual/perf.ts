import {
  BoxGeometry,
  type BufferGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  Object3D,
  PerspectiveCamera,
  REVISION,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  type WebGLRenderer,
} from "three";
import { distribution, rgbaMipBytes } from "./perf-math";

type Adapter = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  begin(): void;
  frame(seconds: number): string;
  end(): void;
};
export type PerfOptions = {
  id: string;
  kind: "island" | "empty" | "draws" | "triangles" | "textures" | "combined";
  count?: number;
  textureCount?: number;
  textureSize?: number;
  segments?: number;
  dpr?: number;
  warmup?: number;
  seconds?: number;
  gpuQueries?: boolean;
  fullHD?: boolean;
};
type Sample = {
  t: number;
  segment: string;
  rafMs: number;
  cpuSubmitMs: number;
  gpuMs: number | null;
  calls: number;
  triangles: number;
};
type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
type MemoryPerformance = Performance & {
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
};
declare global {
  interface Window {
    __PERF__?: {
      run(options: PerfOptions): Promise<unknown>;
      stop(): void;
      status(): { running: boolean; progress: string };
      result: unknown;
    };
  }
}

async function workload(adapter: Adapter, options: PerfOptions, aborted: () => boolean) {
  const { renderer } = adapter;
  const scene = new Scene();
  scene.background = adapter.scene.background;
  scene.environment = adapter.scene.environment;
  scene.environmentIntensity = adapter.scene.environmentIntensity;
  for (const light of adapter.scene.children) {
    if ("isLight" in light && light.isLight) scene.add(light.clone());
  }
  const camera = new PerspectiveCamera(40, adapter.camera.aspect, 0.1, 100);
  camera.position.set(0, 4, 18);
  camera.lookAt(0, 0, 0);
  const group = new Group();
  scene.add(group);
  const textures: DataTexture[] = [];
  const materials: MeshStandardMaterial[] = [];
  let geometry: BufferGeometry | undefined;
  const dispose = () => {
    geometry?.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    scene.traverse((object) => {
      if (object instanceof InstancedMesh) object.dispose();
      if ("shadow" in object)
        (object as Object3D & { shadow?: { dispose(): void } }).shadow?.dispose();
    });
  };
  const textureCount =
    options.textureCount ?? (options.kind === "textures" ? (options.count ?? 1) : 0);
  const size = options.textureSize ?? 1024;
  // One reused CPU staging buffer, distinct GPU uploads. No allocation per animation frame.
  const pixels = textureCount ? new Uint8Array(size * size * 4) : null;
  try {
    for (let k = 0; k < textureCount; k++) {
      if (k % 4 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 16));
        if (aborted()) throw new Error("Texture setup cancelled");
      }
      if (!pixels) break;
      for (let i = 0; i < pixels.length; i += 4) {
        const noise = (i / 4 + k * 37) % 128;
        pixels[i] = k % 4 === 1 ? 128 : 80 + noise;
        pixels[i + 1] = k % 4 === 1 ? 128 : 80 + noise;
        pixels[i + 2] = k % 4 === 1 ? 255 : 80 + noise;
        pixels[i + 3] = 255;
      }
      const texture = new DataTexture(pixels, size, size);
      texture.colorSpace = k % 4 === 0 ? SRGBColorSpace : NoColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.needsUpdate = true;
      renderer.initTexture(texture);
      textures.push(texture);
    }
    const materialCount = Math.max(1, Math.ceil(textureCount / 4));
    for (let i = 0; i < materialCount; i++) {
      materials.push(
        new MeshStandardMaterial({
          color: 0xb6ad99,
          roughness: 0.62,
          metalness: 0.18,
          map: textures[i * 4] ?? null,
          normalMap: textures[i * 4 + 1] ?? null,
          roughnessMap: textures[i * 4 + 2] ?? null,
          aoMap: textures[i * 4 + 3] ?? null,
        }),
      );
    }
    const segments = options.segments ?? 32;
    geometry =
      options.kind === "draws" || options.kind === "textures"
        ? new BoxGeometry(0.6, 0.6, 0.6)
        : new SphereGeometry(0.38, segments, Math.max(4, segments / 2));
    const count =
      options.kind === "empty" ? 0 : options.kind === "textures" ? 384 : (options.count ?? 256);
    const columns = Math.ceil(Math.sqrt((count * 16) / 9));
    const rows = Math.ceil(count / columns);
    const dummy = new Object3D();
    const place = (object: Object3D, i: number) => {
      object.position.set(
        ((i % columns) / columns - 0.5) * 16,
        (Math.floor(i / columns) / rows - 0.5) * 9,
        Math.sin(i * 3.1) * 0.15,
      );
      object.rotation.set(i * 0.13, i * 0.21, 0);
      object.updateMatrix();
    };
    if (options.kind === "triangles") {
      const instanced = new InstancedMesh(geometry, materials[0], count);
      for (let i = 0; i < count; i++) {
        place(dummy, i);
        instanced.setMatrixAt(i, dummy.matrix);
      }
      instanced.castShadow = true;
      instanced.receiveShadow = true;
      instanced.frustumCulled = false;
      group.add(instanced);
    } else if (options.kind === "draws") {
      // 8192 identical boxes, same coverage/triangles; only batch count changes.
      let firstIndex = 0;
      const batchColumns = 128;
      for (let b = 0; b < count; b++) {
        const perBatch = Math.floor(8192 / count) + (b < 8192 % count ? 1 : 0);
        const mesh = new InstancedMesh(geometry, materials[0], perBatch);
        for (let j = 0; j < perBatch; j++) {
          const index = firstIndex + j;
          dummy.position.set(
            ((index % batchColumns) / batchColumns - 0.5) * 16,
            (Math.floor(index / batchColumns) / 64 - 0.5) * 9,
            0,
          );
          dummy.scale.setScalar(0.16);
          dummy.updateMatrix();
          mesh.setMatrixAt(j, dummy.matrix);
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        group.add(mesh);
        firstIndex += perBatch;
      }
    } else {
      for (let i = 0; i < count; i++) {
        const mesh = new Mesh(geometry, materials[i % materialCount]);
        place(mesh, i);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        group.add(mesh);
      }
    }
    return {
      scene,
      camera,
      texturePayloadBytes: textureCount * rgbaMipBytes(size, size),
      geometryPayloadBytes:
        Object.values(geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0) +
        (geometry.index?.array.byteLength ?? 0),
      render(seconds: number) {
        group.rotation.y = Math.sin((seconds * Math.PI) / 30) * 0.12;
        camera.position.x = Math.sin((seconds * Math.PI) / 30) * 0.7;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        return `${options.kind}-${Math.floor((seconds % 60) / 10)}`;
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

export function installPerf(adapter: Adapter) {
  const { renderer } = adapter;
  let running = false;
  let abort = false;
  let cancelCurrent: (() => void) | undefined;
  let progress = "Ready. Existing tier; fixed 60-second path, 10-second warm-up.";
  const panel = document.createElement("aside");
  panel.style.cssText =
    "position:fixed;z-index:10000;bottom:12px;left:12px;max-width:380px;padding:14px;background:#102b31;color:white;font:14px system-ui;border:1px solid #89c5b3;border-radius:8px";
  panel.innerHTML =
    "<strong>Local hardware performance test</strong><p data-status></p><button data-run>Run existing tier (70s)</button> <button data-stop>Stop</button> <button data-copy>Copy JSON</button>";
  document.body.append(panel);
  const label = panel.querySelector("[data-status]");
  const setProgress = (value: string) => {
    progress = value;
    if (label) label.textContent = value;
  };
  setProgress(progress);
  const api = {
    result: null as unknown,
    status: () => ({ running, progress }),
    stop: () => {
      abort = true;
      cancelCurrent?.();
    },
    async run(input: PerfOptions) {
      if (running) throw new Error("A performance run is already active");
      const options = { warmup: 10, seconds: 60, dpr: 1, gpuQueries: true, ...input };
      const textureCount =
        options.textureCount ?? (options.kind === "textures" ? (options.count ?? 1) : 0);
      const texturePayload =
        textureCount * rgbaMipBytes(options.textureSize ?? 1024, options.textureSize ?? 1024);
      if (
        Object.values(options).some((value) => typeof value === "number" && !Number.isFinite(value))
      )
        throw new Error("Non-finite benchmark option");
      if (
        options.seconds < 1 ||
        options.seconds > 900 ||
        options.warmup < 0 ||
        options.warmup > 60 ||
        options.dpr < 0.5 ||
        options.dpr > 2 ||
        (options.count ?? 0) > 8192 ||
        textureCount > 768 ||
        textureCount < 0 ||
        texturePayload > 4 * 1024 ** 3 ||
        !Number.isInteger(textureCount) ||
        (options.count ?? 1) < 1 ||
        !Number.isInteger(options.count ?? 1) ||
        (options.segments ?? 32) > 512 ||
        (options.segments ?? 32) < 8 ||
        ![256, 512, 1024, 2048].includes(options.textureSize ?? 1024)
      )
        throw new Error("Benchmark bounds exceeded");
      if (document.hidden) throw new Error("Benchmark page is hidden");
      running = true;
      abort = false;
      api.result = null;
      const memoryBefore = { ...renderer.info.memory };
      const started = new Date().toISOString();
      const oldRatio = renderer.getPixelRatio();
      const oldSize = renderer.getSize(new Vector2());
      const oldAspect = adapter.camera.aspect;
      adapter.begin();
      renderer.setPixelRatio(options.dpr);
      if (options.fullHD) {
        renderer.setSize(1920, 1080, false);
        adapter.camera.aspect = 1920 / 1080;
        adapter.camera.updateProjectionMatrix();
      }
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      const gpu = String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER));
      const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExtension | null;
      const records: Sample[] = [];
      const pending: { query: WebGLQuery; sample: Sample }[] = [];
      let disjointEvents = 0;
      let hiddenEvents = 0;
      const invalidReasons: string[] = [];
      const invalidate = (reason: string) => {
        invalidReasons.push(reason);
        abort = true;
        cancelCurrent?.();
      };
      const resized = () => invalidate("Viewport resized during run");
      const contextLost = () => invalidate("WebGL context lost");
      const visibility = () => {
        if (document.hidden) {
          hiddenEvents++;
          invalidate("Document became hidden");
        }
      };
      document.addEventListener("visibilitychange", visibility);
      window.addEventListener("resize", resized);
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      let stress: Awaited<ReturnType<typeof workload>> | undefined;
      const heapBefore = (performance as MemoryPerformance).memory?.usedJSHeapSize ?? null;
      const poll = () => {
        if (!ext) return;
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
          disjointEvents++;
          for (const item of pending.splice(0)) gl.deleteQuery(item.query);
          return;
        }
        while (pending[0] && gl.getQueryParameter(pending[0].query, gl.QUERY_RESULT_AVAILABLE)) {
          const item = pending.shift();
          if (!item) break;
          item.sample.gpuMs = Number(gl.getQueryParameter(item.query, gl.QUERY_RESULT)) / 1e6;
          gl.deleteQuery(item.query);
        }
      };
      try {
        if (/swiftshader|llvmpipe|software|warp/i.test(gpu))
          throw new Error(`Software backend: ${gpu}`);
        if (options.kind !== "island") stress = await workload(adapter, options, () => abort);
        await renderer.compileAsync(
          stress?.scene ?? adapter.scene,
          stress?.camera ?? adapter.camera,
        );
        // Compile all island states before warm-up. No timing samples from setup.
        if (!stress) for (let t = 0; t < 60; t += 6) adapter.frame(t);
        if (stress) stress.render(0);
        else adapter.frame(0);
        const setupFrame = renderer.domElement.toDataURL("image/png");
        const begin = performance.now();
        let last = begin;
        let previousSample: Sample | undefined;
        let lastLabel = -1;
        await new Promise<void>((resolve, reject) => {
          let request = 0;
          cancelCurrent = () => {
            cancelAnimationFrame(request);
            resolve();
          };
          const step = (now: number) => {
            try {
              // Attribute each interval to the render that preceded it, including terminal stalls.
              if (previousSample) {
                previousSample.rafMs = now - last;
                records.push(previousSample);
                previousSample = undefined;
              }
              if (abort || gl.isContextLost()) {
                abort = true;
                resolve();
                return;
              }
              const seconds = (now - begin) / 1000;
              if (seconds >= options.warmup + options.seconds) {
                resolve();
                return;
              }
              const elapsed = seconds - options.warmup;
              poll();
              const sample: Sample = {
                t: elapsed,
                segment: "",
                rafMs: now - last,
                cpuSubmitMs: 0,
                gpuMs: null,
                calls: 0,
                triangles: 0,
              };
              const query =
                elapsed >= 0 && ext && options.gpuQueries && pending.length < 16
                  ? gl.createQuery()
                  : null;
              if (query && ext) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
              const cpuStart = performance.now();
              let rendered = false;
              try {
                sample.segment = stress
                  ? stress.render(elapsed < 0 ? seconds : elapsed)
                  : adapter.frame(elapsed < 0 ? seconds : elapsed);
                sample.cpuSubmitMs = performance.now() - cpuStart;
                rendered = true;
              } finally {
                if (query && ext) {
                  gl.endQuery(ext.TIME_ELAPSED_EXT);
                  if (rendered) pending.push({ query, sample });
                  else gl.deleteQuery(query);
                }
              }
              sample.calls = renderer.info.render.calls;
              sample.triangles = renderer.info.render.triangles;
              if (elapsed >= 0) previousSample = sample;
              last = now;
              const currentLabel = Math.floor(seconds);
              if (lastLabel !== currentLabel) {
                lastLabel = currentLabel;
                setProgress(
                  `${options.id}: ${elapsed < 0 ? "warm-up" : "measuring"} ${Math.max(0, elapsed).toFixed(0)} / ${options.seconds}s`,
                );
              }
              request = requestAnimationFrame(step);
            } catch (error) {
              reject(error);
            }
          };
          request = requestAnimationFrame(step);
        });
        const endedMeasurement = performance.now();
        // Drain asynchronously; never gl.finish or a blocking readback inside a sample.
        for (let i = 0; pending.length && i < 120; i++) {
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
          poll();
        }
        const summarize = (rows: Sample[]) => ({
          frames: rows.length,
          rafMs: distribution(rows.map((s) => s.rafMs)),
          cpuSubmitMs: distribution(rows.map((s) => s.cpuSubmitMs)),
          gpuMs: distribution(rows.flatMap((s) => (s.gpuMs === null ? [] : [s.gpuMs]))),
          drawCalls: distribution(rows.map((s) => s.calls)),
          triangles: distribution(rows.map((s) => s.triangles)),
        });
        const info = renderer.info;
        api.result = {
          schema: 2,
          setupFrame,
          started,
          measurementStartedAt: new Date(
            performance.timeOrigin + begin + options.warmup * 1000,
          ).toISOString(),
          measurementEndedAt: new Date(performance.timeOrigin + endedMeasurement).toISOString(),
          options,
          aborted: abort,
          invalidReasons,
          measuredWallSeconds: (endedMeasurement - begin) / 1000 - options.warmup,
          gpu,
          backend: "WebGL2 / actual browser adapter",
          three: REVISION,
          browser: navigator.userAgent,
          display: {
            screenWidth: screen.width,
            screenHeight: screen.height,
            viewport: [innerWidth, innerHeight],
            devicePixelRatio,
            visibility: document.visibilityState,
            focused: document.hasFocus(),
          },
          renderer: {
            drawingBuffer: [renderer.domElement.width, renderer.domElement.height],
            dpr: renderer.getPixelRatio(),
            context: gl.getContextAttributes(),
            toneMapping: renderer.toneMapping,
            exposure: renderer.toneMappingExposure,
            shadowType: renderer.shadowMap.type,
            memory: { ...info.memory },
          },
          timing: {
            gpuExtension: !!ext,
            disjointEvents,
            hiddenEvents,
            unresolvedQueries: pending.length,
            gpuCoverage: records.length
              ? records.filter((s) => s.gpuMs !== null).length / records.length
              : 0,
            note: "rAF callback intervals are browser pacing, not GPU duration or confirmed display presentation. CPU includes JS update and WebGL submission; GPU query covers render commands, not DOM/compositing. Do not add CPU and GPU percentiles as a measured frame time.",
          },
          memory: {
            rendererBefore: memoryBefore,
            stressTexturePayloadBytes: stress?.texturePayloadBytes ?? 0,
            stressGeometryPayloadBytes: stress?.geometryPayloadBytes ?? 0,
            jsHeapBefore: heapBefore,
            jsHeapAfter: (performance as MemoryPerformance).memory?.usedJSHeapSize ?? null,
            note: "Payload estimates exclude render targets, driver/browser allocations. System-wide VRAM and available RAM are sampled by external telemetry; neither is process-attributed VRAM.",
          },
          summary: summarize(records),
          segments: Object.fromEntries(
            [...new Set(records.map((s) => s.segment))].map((name) => [
              name,
              summarize(records.filter((s) => s.segment === name)),
            ]),
          ),
          windows: Array.from({ length: Math.ceil(options.seconds / 10) }, (_, i) => ({
            seconds: [i * 10, (i + 1) * 10],
            ...summarize(records.filter((s) => s.t >= i * 10 && s.t < (i + 1) * 10)),
          })),
          samples: records,
        };
        setProgress(
          `${options.id}: ${abort ? "ABORTED" : "complete"}; ${records.length} frames. Copy JSON for evidence.`,
        );
        return api.result;
      } finally {
        for (const item of pending) gl.deleteQuery(item.query);
        // A failed shadow draw may leave its FBO bound. Unbind before disposal so the next
        // island render cannot recreate the disposed shadow textures through that stale target.
        renderer.setRenderTarget(null);
        renderer.resetState();
        stress?.dispose();
        if (api.result && typeof api.result === "object")
          Object.assign(api.result, { cleanupMemory: { ...renderer.info.memory } });
        renderer.setPixelRatio(oldRatio);
        renderer.setSize(oldSize.x, oldSize.y, false);
        adapter.camera.aspect = oldAspect;
        adapter.camera.updateProjectionMatrix();
        document.removeEventListener("visibilitychange", visibility);
        window.removeEventListener("resize", resized);
        renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        adapter.end();
        cancelCurrent = undefined;
        running = false;
      }
    },
  };
  window.__PERF__ = api;
  panel.querySelector("[data-run]")?.addEventListener("click", () => {
    void api.run({ id: "existing-local", kind: "island" });
  });
  panel.querySelector("[data-stop]")?.addEventListener("click", api.stop);
  panel.querySelector("[data-copy]")?.addEventListener("click", () => {
    void navigator.clipboard.writeText(JSON.stringify(api.result, null, 2));
  });
  return () => {
    abort = true;
    cancelCurrent?.();
    panel.remove();
    if (window.__PERF__ === api) delete window.__PERF__;
  };
}
