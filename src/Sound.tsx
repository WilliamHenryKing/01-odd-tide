import { useEffect, useRef, useState } from "react";

// An original, deliberately quiet synthesis. Nothing is loaded or started before a press.
function seaAir() {
  const audio = new AudioContext();
  const master = audio.createGain();
  master.gain.value = 0.15;
  master.connect(audio.destination);
  const buffer = audio.createBuffer(1, audio.sampleRate * 5, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 916,
    previous = 0;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    previous = (previous + ((seed / 4294967296) * 2 - 1) * 0.035) / 1.025;
    data[i] = previous;
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1600;
  const swell = audio.createGain();
  swell.gain.value = 0.48;
  const wave = audio.createOscillator();
  wave.frequency.value = 0.13;
  const depth = audio.createGain();
  depth.gain.value = 0.24;
  wave.connect(depth).connect(swell.gain);
  source.connect(filter).connect(swell).connect(master);
  source.start();
  wave.start();
  let count = 0;
  const chime = () => {
    if (audio.state !== "running") return;
    const tone = audio.createOscillator();
    const envelope = audio.createGain();
    const now = audio.currentTime;
    tone.frequency.value = [523.25, 659.25, 783.99][count++ % 3] ?? 523.25;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.022, now + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    tone.connect(envelope).connect(master);
    tone.start(now);
    tone.stop(now + 2.3);
    tone.onended = () => {
      tone.disconnect();
      envelope.disconnect();
    };
  };
  const timer = window.setInterval(chime, 7200);
  const visibility = () => {
    void (document.hidden ? audio.suspend() : audio.resume());
  };
  document.addEventListener("visibilitychange", visibility);
  return {
    async start() {
      await audio.resume();
    },
    volume(value: number) {
      master.gain.setTargetAtTime(value * 0.3, audio.currentTime, 0.06);
    },
    dispose() {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      source.stop();
      wave.stop();
      void audio.close();
    },
  };
}

export function Sound() {
  const engine = useRef<ReturnType<typeof seaAir> | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [error, setError] = useState("");
  useEffect(() => () => engine.current?.dispose(), []);
  const toggle = async () => {
    if (engine.current) {
      engine.current.dispose();
      engine.current = null;
      setEnabled(false);
      return;
    }
    try {
      const next = seaAir();
      engine.current = next;
      next.volume(volume);
      await next.start();
      setEnabled(true);
      setError("");
    } catch {
      engine.current?.dispose();
      engine.current = null;
      setError("Sound is unavailable here. The island works just as well in silence.");
    }
  };
  return (
    <div className="sound-control">
      <button type="button" onClick={() => void toggle()} aria-pressed={enabled}>
        <span aria-hidden="true">{enabled ? "♫" : "≈"}</span> A little sea air · sound{" "}
        {enabled ? "on" : "off"}
      </button>
      {enabled && (
        <label>
          Volume{" "}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => {
              const value = Number(event.target.value);
              setVolume(value);
              engine.current?.volume(value);
            }}
          />
        </label>
      )}
      {error && <p role="status">{error}</p>}
    </div>
  );
}
