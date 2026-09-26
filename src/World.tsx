import { useEffect, useRef, useState } from "react";
import type { LensId, StayId } from "./domain";
import type { Island, IslandState } from "./world/island";

export function World({
  state,
  onSelect,
  onCapture,
  onCollect,
}: {
  state: IslandState;
  onSelect(id: StayId): void;
  onCapture(capture: (() => string) | null): void;
  onCollect(id: LensId): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const island = useRef<Island | null>(null);
  const latest = useRef({ state, onSelect, onCapture, onCollect });
  latest.current = { state, onSelect, onCapture, onCollect };
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter deliberately recreates a failed WebGL scene.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void import("./world/island")
      .then(({ createIsland }) => {
        if (cancelled || !host.current) return;
        const created = createIsland(
          host.current,
          (id) => latest.current.onSelect(id),
          () => {
            setStatus("failed");
            latest.current.onCapture(null);
            island.current?.dispose();
            island.current = null;
          },
          () => setStatus("ready"),
          (id) => latest.current.onCollect(id),
          latest.current.state,
        );
        if (cancelled) {
          created.dispose();
          return;
        }
        island.current = created;
        created.update(latest.current.state);
        latest.current.onCapture(() => created.capture());
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
      latest.current.onCapture(null);
      island.current?.dispose();
      island.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    island.current?.update(state);
  }, [state]);
  return (
    <div className={`island-surface ${status}`}>
      <div className="world-poster" aria-hidden="true">
        <picture>
          <source
            media="(max-width: 1100px)"
            srcSet={`/plates/island-${state.hour >= 18 ? "night" : "day"}-phone.jpg`}
          />
          <img
            src={
              state.hour >= 18
                ? "/plates/island-night.jpg"
                : `/plates/${state.selected ?? "island"}-day.jpg`
            }
            width="1440"
            height="770"
            alt=""
            fetchPriority="high"
          />
        </picture>
      </div>
      <div className="world-canvas" ref={host} />
      {status === "loading" && (
        <p className="scene-status" role="status">
          Finding our little island…
        </p>
      )}
      {status === "failed" && (
        <div className="scene-status" role="status">
          <p>
            This is a saved view: the live island could not open. You can still explore stays and
            plan your day.
          </p>
          <button type="button" onClick={() => setAttempt(attempt + 1)}>
            Try the island again
          </button>
        </div>
      )}
    </div>
  );
}
