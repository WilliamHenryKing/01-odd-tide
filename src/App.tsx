import { gsap } from "gsap";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACTIVITIES,
  type ActivityId,
  activityFor,
  DEFAULT_PLAN,
  hourLabel,
  type LensId,
  lensReady,
  money,
  moodPlan,
  nights,
  type Plan,
  pathOpen,
  planQuery,
  readPlan,
  repairSchedule,
  STAYS,
  type StayId,
  stayFor,
  totals,
  validatePlan,
  waterHeight,
} from "./domain";
import { whenRevealed } from "./loader";
import { pageTitle, ROUTES } from "./routes";
import { Sound } from "./Sound";
import { World } from "./World";
import "./style.css";

function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "brand small" : "brand"}>
      odd<span className="brand-wave">~</span>tide<span className="brand-dot">✳</span>
    </span>
  );
}
function Arrow() {
  return <span aria-hidden="true">↗</span>;
}
/**
 * The sea clock: the sun (or moon) travels the rim through the day and the dial fills with
 * the tide, both driven by the same hour as the island.
 */
function SeaDial({ hour }: { hour: number }) {
  const level = Math.min(1, Math.max(0, (waterHeight(hour) - 0.16) / 0.86));
  const day = hour >= 6.2 && hour <= 19.2;
  const t = day ? (hour - 6.2) / 13 : ((hour < 6.2 ? hour + 24 : hour) - 19.2) / 11;
  const angle = Math.PI * (1 - Math.min(1, Math.max(0, t)));
  const bx = 22 + Math.cos(angle) * 17;
  const by = 22 - Math.sin(angle) * 17;
  const waterTop = 38 - level * 22;
  return (
    <svg className="sea-dial" viewBox="0 0 44 44" aria-hidden="true">
      <defs>
        <clipPath id="sea-dial-clip">
          <circle cx="22" cy="22" r="17" />
        </clipPath>
      </defs>
      <circle cx="22" cy="22" r="17" className="sea-dial-face" />
      <g clipPath="url(#sea-dial-clip)">
        <path
          className="sea-dial-water"
          d={`M0 ${waterTop} q5.5 -2.2 11 0 t11 0 t11 0 t11 0 V44 H0 Z`}
        />
      </g>
      <circle cx="22" cy="22" r="17" className="sea-dial-rim" />
      <circle
        cx={bx}
        cy={by}
        r={day ? 3.6 : 3}
        className={day ? "sea-dial-sun" : "sea-dial-moon"}
      />
    </svg>
  );
}

/** How each stay opens, for the portrait's second still and the gallery caption. */
const OPENING: Record<StayId, string> = {
  "weather-house": "The roof slope lifted on its gas struts",
  "nap-observatory": "The dome folded back to the sky",
  "lantern-lodge": "The roof raised on its brass screw jacks",
};

/**
 * A stay's portrait, rendered from the island itself: the closed still, with the open one
 * crossfading in on hover or focus (or, on touch screens, as the card scrolls into view).
 */
function StayPortrait({ stay }: { stay: StayId }) {
  return (
    <span className="portrait">
      <img
        className="portrait-closed"
        src={`/plates/${stay}-portrait.webp`}
        width={1500}
        height={1000}
        alt={`${stayFor(stay).name} in afternoon light`}
        loading="lazy"
        decoding="async"
      />
      <img
        className="portrait-open"
        src={`/plates/${stay}-open.webp`}
        width={1500}
        height={1000}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

export function App({ initialPath = "/" }: { initialPath?: string }) {
  const [path, setPath] = useState(initialPath);
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const [configured, setConfigured] = useState(false);
  const [opened, setOpened] = useState(false),
    [paused, setPaused] = useState(false),
    [reduced, setReduced] = useState(false);
  const [message, setMessage] = useState(""),
    [found, setFound] = useState<LensId[]>([]),
    [discover, setDiscover] = useState(false);
  const [menu, setMenu] = useState(false);
  const capture = useRef<(() => string) | null>(null),
    content = useRef<HTMLElement>(null);
  const selected: StayId | null = path.startsWith("/stays/")
    ? (STAYS.find((stay) => `/stays/${stay.id}` === path)?.id ?? null)
    : path === "/summary"
      ? plan.stay
      : null;
  const stay = stayFor(selected ?? plan.stay);
  const issues = validatePlan(plan),
    price = totals(plan);
  // "Watch the day go by": a time-lapse drives the island's hour without touching the plan
  // (or the address bar) until it stops.
  const [liveHour, setLiveHour] = useState<number | null>(null);
  const timelapse = useRef<{ tween: gsap.core.Tween; proxy: { hour: number } } | null>(null);
  const shownHour = liveHour ?? plan.hour;
  const sceneState = useMemo(
    () => ({ hour: shownHour, selected, opened, paused, reduced, found, discover }),
    [shownHour, selected, opened, paused, reduced, found, discover],
  );
  const stopDay = useCallback((commit = true) => {
    const running = timelapse.current;
    if (!running) return;
    running.tween.kill();
    timelapse.current = null;
    if (commit) {
      const hour = Math.min(22, Math.max(6, Math.round(running.proxy.hour * 4) / 4));
      setPlan((current) => ({ ...current, hour }));
    }
    setLiveHour(null);
  }, []);
  const playDay = () => {
    if (timelapse.current) {
      stopDay();
      return;
    }
    const start = plan.hour >= 21.75 ? 6 : plan.hour;
    const proxy = { hour: start };
    const hours = 22 - start;
    setLiveHour(start);
    const tween = gsap.to(proxy, {
      hour: 22,
      duration: hours * 1.5,
      // Gentle motion: the day advances an hour at a time instead of sweeping.
      ease: reduced ? `steps(${Math.max(1, Math.ceil(hours))})` : "none",
      onUpdate: () => setLiveHour(Math.round(proxy.hour * 20) / 20),
      onComplete: () => stopDay(),
    });
    timelapse.current = { tween, proxy };
  };
  useEffect(() => () => stopDay(false), [stopDay]);
  const update = (change: Partial<Plan>) => setPlan((current) => ({ ...current, ...change }));
  useEffect(() => {
    if (!import.meta.env.DEV && import.meta.env.MODE !== "visual-test") return;
    const apply = (event: Event) => {
      const state = (event as CustomEvent<typeof sceneState>).detail;
      setPlan((current) => ({
        ...current,
        hour: state.hour,
        stay: state.selected ?? current.stay,
      }));
      setPath(state.selected ? `/stays/${state.selected}` : "/");
      setOpened(state.opened);
      setPaused(state.paused);
      setReduced(state.reduced);
      setFound(state.found);
      setDiscover(state.discover);
    };
    window.addEventListener("odd-tide-visual-state", apply);
    return () => window.removeEventListener("odd-tide-visual-state", apply);
  }, []);
  const navigate = useCallback(
    (next: string) => {
      history.pushState(null, "", `${next}?${planQuery(plan)}`);
      setPath(next);
      setOpened(false);
      setMenu(false);
      window.scrollTo({ top: 0, behavior: "instant" });
      window.requestAnimationFrame(() => content.current?.focus({ preventScroll: true }));
    },
    [plan],
  );
  const Link = ({
    to,
    children,
    className = "",
  }: {
    to: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a
      href={`${to}?${planQuery(plan)}`}
      className={className}
      aria-current={path === to ? "page" : undefined}
      onClick={(event) => {
        if (
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          navigate(to);
        }
      }}
    >
      {children}
    </a>
  );
  useEffect(() => {
    setPath(location.pathname.replace(/\/$/, "") || "/");
    setPlan(readPlan(location.search));
    setConfigured(true);
    const pop = () => {
      setPath(location.pathname.replace(/\/$/, "") || "/");
      setPlan(readPlan(location.search));
      setOpened(false);
    };
    window.addEventListener("popstate", pop);
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const motion = () => setReduced(query.matches);
    query.addEventListener("change", motion);
    return () => {
      window.removeEventListener("popstate", pop);
      query.removeEventListener("change", motion);
    };
  }, []);
  useEffect(() => {
    if (configured) history.replaceState(null, "", `${path}?${planQuery(plan)}`);
    document.title = pageTitle(path);
  }, [path, plan, configured]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Each route renders its own cards.
  useEffect(() => {
    // Touch screens have no hover: a portrait opens its roof as its card scrolls into view.
    if (!window.matchMedia("(hover: none)").matches) return;
    const cards = content.current?.querySelectorAll(".stay-card");
    if (!cards?.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          entry.target.classList.toggle("in-view", entry.intersectionRatio > 0.65);
      },
      { threshold: [0, 0.65, 1] },
    );
    for (const card of cards) observer.observe(card);
    return () => observer.disconnect();
  }, [path]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A route change introduces new arrival elements to animate.
  useEffect(() => {
    // On first load the copy arrives as the loader lifts, not unseen behind it.
    let context: gsap.Context | null = null;
    let cancelled = false;
    void whenRevealed().then(() => {
      if (cancelled) return;
      context = arrive();
    });
    return () => {
      cancelled = true;
      context?.revert();
    };
  }, [path, reduced]);
  const arrive = () =>
    gsap.context(() => {
      const card = content.current?.querySelector(".postcard");
      if (card)
        gsap.fromTo(
          card,
          { y: reduced ? 0 : 60, rotation: reduced ? -1.2 : -7, opacity: 0 },
          {
            y: 0,
            rotation: -1.2,
            opacity: 1,
            duration: reduced ? 0 : 1.1,
            delay: reduced ? 0 : 0.25,
            ease: "back.out(1.4)",
          },
        );
      const targets = content.current?.querySelectorAll(
        ".arrival-line, .page-section > h1, .page-section > .eyebrow",
      );
      if (!targets?.length) return;
      gsap.fromTo(
        targets,
        { y: reduced ? 0 : 25, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: reduced ? 0 : 0.12,
          duration: reduced ? 0 : 0.8,
          ease: "power2.out",
        },
      );
    }, content);
  const onSelect = (id: StayId) => {
    update({ stay: id });
    navigate(`/stays/${id}`);
  };
  const collect = (id: LensId) => {
    if (!lensReady(id, plan.hour)) return;
    const next = found.includes(id) ? found : [...found, id];
    setFound(next);
    setMessage(
      next.length === 3
        ? "The lens is whole again. Turn the day to evening and watch the lighthouse shine."
        : "A piece of the lighthouse lens, found.",
    );
  };
  const save = () => {
    try {
      localStorage.setItem("odd-tide-plan-v1", planQuery(plan));
      setMessage("Your island day is saved on this browser.");
    } catch {
      setMessage("Browser storage is unavailable. Your choices are still in this page's address.");
    }
  };
  const restore = () => {
    try {
      const saved = localStorage.getItem("odd-tide-plan-v1");
      if (saved === null) {
        setMessage("No saved day yet. Make a little plan first.");
        return;
      }
      setPlan(readPlan(saved));
      setMessage("Your saved island day is back.");
    } catch {
      setMessage("Browser storage is unavailable. You can still plan your day here.");
    }
  };
  const postcard = async () => {
    try {
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 1100;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setMessage(
          "Postcard export is unavailable in this browser. Your plan is still ready to print.",
        );
        return;
      }
      ctx.fillStyle = "#f4f0e4";
      ctx.fillRect(0, 0, 1600, 1100);
      {
        const image = new Image();
        // The chosen stay at dusk, rendered from the island (the art direction's payoff frame).
        image.src = `/plates/${plan.stay}-dusk.webp`;
        await image.decode();
        const scale = Math.min(1528 / image.width, 750 / image.height);
        ctx.drawImage(
          image,
          36 + (1528 - image.width * scale) / 2,
          36 + (750 - image.height * scale) / 2,
          image.width * scale,
          image.height * scale,
        );
      }
      ctx.fillStyle = "#234939";
      ctx.font = "70px Young Serif, Georgia";
      ctx.fillText("A little time, out of time.", 60, 865);
      ctx.font = "28px DM Sans, sans-serif";
      ctx.fillText(
        `${stayFor(plan.stay).name} · ${plan.arrival} — ${plan.departure} · ${plan.guests} guests`,
        60,
        925,
      );
      ctx.font = "24px DM Sans, sans-serif";
      ctx.fillText(
        plan.activities
          .map((slot) => `${hourLabel(slot.hour)} ${activityFor(slot.id).name}`)
          .join("  /  ")
          .slice(0, 116),
        60,
        973,
      );
      ctx.fillText("ODD TIDE — a fictional island. A demo plan, not a reservation.", 60, 1050);
      const link = document.createElement("a");
      link.download = "my-odd-tide-postcard.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      setMessage("Your postcard has been prepared for download.");
    } catch {
      setMessage(
        "The postcard could not be drawn here. You can still print your plan or keep its address.",
      );
    }
  };
  const addActivity = (id: ActivityId) => {
    if (!plan.activities.some((slot) => slot.id === id))
      update({
        activities: [
          ...plan.activities,
          { id, hour: id === "stars" ? 20 : id === "lanterns" ? 18 : plan.hour },
        ],
      });
  };
  const known = path !== "/404" && ROUTES.includes(path);
  const hasWorld = path === "/" || !!selected;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to the island guide
      </a>
      <header className="site-header">
        <Link to="/" className="logo">
          <Mark small />
        </Link>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menu}
          aria-controls="main-nav"
          onClick={() => setMenu(!menu)}
        >
          Menu {menu ? "−" : "+"}
        </button>
        <nav id="main-nav" className={menu ? "open" : ""} aria-label="Main navigation">
          <Link to="/">The island</Link>
          <Link to="/stays">Our little stays</Link>
          <Link to="/about">Good to know</Link>
          <Link to="/plan" className="nav-plan">
            Make yourself at home <Arrow />
          </Link>
        </nav>
      </header>
      <main id="main" tabIndex={-1} ref={content}>
        {hasWorld && (
          <section
            className={`hero ${selected ? "close-view" : ""} ${plan.hour >= 18 ? "evening" : ""}`}
            aria-label="Explore Odd Tide"
          >
            <World
              state={sceneState}
              onSelect={onSelect}
              onCollect={collect}
              onCapture={(fn) => {
                capture.current = fn;
              }}
            />
            <div className="hero-copy">
              <p className="eyebrow arrival-line">A small island. A different kind of time.</p>
              <h1 className="arrival-line">
                {selected ? (
                  stay.name
                ) : (
                  <>
                    Somewhere <br />
                    between here <br />& the sea<span className="coral">.</span>
                  </>
                )}
              </h1>
              <p className="hero-description arrival-line">
                {selected
                  ? stay.short
                  : "Three curious places to stay. A sea that rearranges the paths. And all the time in the world to do very little."}
              </p>
              <div className="hero-actions arrival-line">
                {selected ? (
                  <>
                    <button
                      className="button primary"
                      type="button"
                      onClick={() => setOpened(!opened)}
                    >
                      {opened ? "Tuck the roof back in" : "Take a peek inside"} <Arrow />
                    </button>
                    <button className="text-button" type="button" onClick={() => navigate("/")}>
                      ← Back to the island
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/stays" className="button primary">
                      Find your little escape <Arrow />
                    </Link>
                    <span className="small-note">Or tap a cabin. We left the doors open.</span>
                  </>
                )}
              </div>
            </div>
            {!selected && (
              <div className="island-note">
                <span className="note-star">✳</span>
                <span>
                  A place to get
                  <br />a little lost.
                </span>
                <svg viewBox="0 0 80 60" aria-hidden="true">
                  <path d="M8 3q0 38 58 41m-13-15 15 16-21 8" />
                </svg>
              </div>
            )}
            <div className="scene-tools">
              {discover && (
                <span className="hunt-count">
                  {found.length === 3
                    ? "✳ Lighthouse restored"
                    : `Find the warm glints · ${found.length}/3`}
                </span>
              )}
              <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused}>
                {paused ? "Resume the ripples" : "Pause the ripples"}
              </button>
              <button type="button" onClick={() => setReduced(!reduced)} aria-pressed={reduced}>
                Gentle motion {reduced ? "on" : "off"}
              </button>
            </div>
            <div className="tide-instrument">
              <SeaDial hour={shownHour} />
              <div className="tide-label">
                <span className="eyebrow">The island keeps sea time</span>
                <strong>
                  {hourLabel(shownHour)}{" "}
                  <span>
                    ·{" "}
                    {shownHour >= 18
                      ? "Evening settles in"
                      : pathOpen(shownHour)
                        ? "The path is yours"
                        : "The sea has the right of way"}
                  </span>
                </strong>
              </div>
              <div className="time-range">
                <div className="time-range-head">
                  <label htmlFor="island-time">Turn the day</label>
                  <button
                    type="button"
                    className="play-day"
                    aria-pressed={liveHour !== null}
                    onClick={playDay}
                  >
                    <span aria-hidden="true">{liveHour !== null ? "❚❚" : "▶"}</span>
                    {liveHour !== null ? "Pause the day" : "Watch the day go by"}
                  </button>
                </div>
                <input
                  id="island-time"
                  type="range"
                  min="6"
                  max="22"
                  step="0.25"
                  value={shownHour}
                  onChange={(event) => {
                    stopDay(false);
                    update({ hour: Number(event.target.value) });
                  }}
                />
                <div>
                  <span>06:00 · Morning</span>
                  <span>22:00 · Goodnight</span>
                </div>
              </div>
              <p className="access-status" aria-live={liveHour === null ? "polite" : "off"}>
                <i className={pathOpen(shownHour) ? "open-dot" : "closed-dot"} />
                {pathOpen(shownHour) ? "Bath causeway open" : "Bath causeway underwater"}
                <small>Fictional tide cycle</small>
              </p>
            </div>
          </section>
        )}
        {path === "/" && (
          <>
            <section className="welcome section-pad">
              <p className="eyebrow">Welcome to nowhere in particular</p>
              <h2>
                Nothing urgent.
                <br />
                Quite a lot to discover.
              </h2>
              <div>
                <p>
                  Here, the tide makes the timetable. A path appears, a warm bath waits, and
                  somewhere a gull has borrowed your hat.
                </p>
                <p>Pick a cabin. Follow your curiosity. Let the rest of the day find you.</p>
                <Link to="/plan" className="underline-link">
                  Make a day of it <Arrow />
                </Link>
              </div>
            </section>
            <section className="stays-section section-pad">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Small stays, big personalities</p>
                  <h2>Find your kind of quiet.</h2>
                </div>
                <Link to="/stays" className="underline-link">
                  Compare our stays <Arrow />
                </Link>
              </div>
              <div className="stay-grid">
                {STAYS.map((item, i) => (
                  <article className={`stay-card card-${i}`} key={item.id}>
                    <button
                      type="button"
                      className="portrait-button"
                      onClick={() => onSelect(item.id)}
                      aria-label={`Explore ${item.name}`}
                    >
                      <StayPortrait stay={item.id} />
                      <span className="step-chip">
                        Step inside <Arrow />
                      </span>
                    </button>
                    <p className="eyebrow">
                      0{i + 1} / {item.mood}
                    </p>
                    <h3>
                      <Link to={`/stays/${item.id}`}>{item.name}</Link>
                    </h3>
                    <p>{item.short}</p>
                    <div className="stay-meta">
                      <span>Sleeps {item.capacity}</span>
                      <span>From {money(item.price)} / night</span>
                    </div>
                  </article>
                ))}
              </div>
              <p className="demo-note">
                An imaginary island, with illustrative prices. No real stays are sold here.
              </p>
            </section>
            <section className="discovery section-pad">
              <div>
                <p className="eyebrow">A small, optional detour</p>
                <h2>
                  The lighthouse
                  <br />
                  has lost its sparkle.
                </h2>
                <p>
                  Three little pieces of its lens have wandered off. The island has a few ideas
                  about where.
                </p>
                <button
                  type="button"
                  className="button outlined"
                  onClick={() => setDiscover(!discover)}
                >
                  {discover ? "Put the clues away" : "Follow a little curiosity"} <Arrow />
                </button>
              </div>
              <div className={`lens-art${found.length === 3 ? " lit" : ""}`}>
                <img
                  className="lens-dark"
                  src="/plates/lighthouse-dark.webp"
                  width={1100}
                  height={1100}
                  alt={
                    found.length === 3
                      ? ""
                      : "The island's little lighthouse at twilight, its lamp dark"
                  }
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="lens-lit"
                  src="/plates/lighthouse-lit.webp"
                  width={1100}
                  height={1100}
                  alt={found.length === 3 ? "The little lighthouse, lit again at twilight" : ""}
                  loading="lazy"
                  decoding="async"
                />
                <span aria-hidden="true">
                  LOST & FOUND
                  <br />
                  ISLAND DEPARTMENT
                </span>
              </div>
              {discover && (
                <div className="clue-list">
                  <div className="clue-controls">
                    <label htmlFor="clue-time">
                      Look at the island at {hourLabel(plan.hour)}
                      <input
                        id="clue-time"
                        type="range"
                        min="6"
                        max="22"
                        step="0.25"
                        value={plan.hour}
                        onChange={(event) => update({ hour: Number(event.target.value) })}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
                      }}
                    >
                      Look for glints on the island ↑
                    </button>
                    <p>Tap the warm glints in the scene, or use the collection buttons below.</p>
                  </div>
                  {(
                    [
                      {
                        id: "bath",
                        title: "A glint beside the bath",
                        clue: "The sea borrowed this one. Turn the day until the bath causeway is open.",
                        ready: pathOpen(plan.hour),
                      },
                      {
                        id: "weather",
                        title: "Something in the wind",
                        clue: "The weather vane catches the morning light. Look between 06:00 and 11:00.",
                        ready: plan.hour < 11,
                      },
                      {
                        id: "stars",
                        title: "The last little star",
                        clue: "Some things only shine after supper. Look again at 19:00 or later.",
                        ready: plan.hour >= 19,
                      },
                    ] as const
                  ).map((clue) => (
                    <div key={clue.id}>
                      <h3>{clue.title}</h3>
                      <p>{clue.clue}</p>
                      <button
                        type="button"
                        disabled={!clue.ready || found.includes(clue.id)}
                        aria-label={`${found.includes(clue.id) ? "Found" : "Collect"} lens piece: ${clue.title}`}
                        onClick={() => collect(clue.id)}
                      >
                        {found.includes(clue.id)
                          ? "Piece found ✓"
                          : clue.ready
                            ? "Collect the glint"
                            : "Wait for its moment"}
                      </button>
                    </div>
                  ))}
                  <p aria-live="polite">
                    {found.length === 3
                      ? "Three pieces, one little light. The lighthouse is glowing again. Thank you, Keeper of Small Things."
                      : `${found.length} of 3 pieces found. Your stay never depends on this little detour.`}
                  </p>
                  {found.length === 3 && (
                    <button type="button" onClick={() => setFound([])}>
                      Hide the pieces and play again
                    </button>
                  )}
                </div>
              )}
            </section>
          </>
        )}
        {path === "/stays" && (
          <section className="section-pad page-section">
            <p className="eyebrow">Room for a different pace</p>
            <h1>
              Three ways
              <br />
              to stay a while.
            </h1>
            <div className="page-intro">
              <p>
                Each cabin has a character of its own. They all come with sea air, a slower clock,
                and a very good reason to put your phone down.
              </p>
              <label className="inline-field">
                Your party
                <select
                  value={plan.guests}
                  onChange={(event) => update({ guests: Number(event.target.value) })}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "guest" : "guests"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="stay-grid">
              {STAYS.map((item) => (
                <article className="stay-card" key={item.id}>
                  <StayPortrait stay={item.id} />
                  <p className="eyebrow">{item.mood}</p>
                  <h2>{item.name}</h2>
                  <p>{item.detail}</p>
                  <ul>
                    {item.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <p>
                    Sleeps {item.capacity} · {money(item.price)} / night
                  </p>
                  {plan.guests > item.capacity && (
                    <p className="field-error">Your party needs a little more room.</p>
                  )}
                  <button
                    type="button"
                    className="button outlined"
                    onClick={() => onSelect(item.id)}
                  >
                    Explore this stay <Arrow />
                  </button>
                </article>
              ))}
            </div>
            <p className="demo-note">
              All rooms, availability and prices are fictional demonstrations.
            </p>
          </section>
        )}
        {selected && path !== "/summary" && (
          <section className="section-pad cabin-details">
            <div>
              <p className="eyebrow">{stay.mood}</p>
              <h2>
                A room with
                <br />
                room to breathe.
              </h2>
              <p>{stay.detail}</p>
              <ul>
                {stay.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
            <aside>
              <span>Sleeps {stay.capacity}</span>
              <h3>
                {money(stay.price)}
                <small> per night</small>
              </h3>
              <p>Illustrative price · October 2026 sample season</p>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  update({ stay: selected });
                  navigate("/plan");
                }}
              >
                Make this your little place <Arrow />
              </button>
              <Link to="/stays" className="underline-link">
                Compare all three stays
              </Link>
            </aside>
          </section>
        )}
        {selected && path !== "/summary" && (
          <section className="section-pad stay-gallery" aria-label={`${stay.name}, three ways`}>
            <figure>
              <img
                src={`/plates/${stay.id}-portrait.webp`}
                width={1500}
                height={1000}
                alt={`${stay.name} in afternoon light, closed up`}
                loading="lazy"
                decoding="async"
              />
              <figcaption>Afternoon, all tucked in</figcaption>
            </figure>
            <figure>
              <img
                src={`/plates/${stay.id}-open.webp`}
                width={1500}
                height={1000}
                alt={`${stay.name} opened up: ${OPENING[stay.id].toLowerCase()}`}
                loading="lazy"
                decoding="async"
              />
              <figcaption>{OPENING[stay.id]}</figcaption>
            </figure>
            <figure>
              <img
                src={`/plates/${stay.id}-dusk.webp`}
                width={1500}
                height={1000}
                alt={`${stay.name} at dusk with its lamps on`}
                loading="lazy"
                decoding="async"
              />
              <figcaption>Lamps on at dusk</figcaption>
            </figure>
          </section>
        )}
        {path === "/plan" && (
          <section className="section-pad page-section planner">
            <p className="eyebrow">A little plan, a lot of possibility</p>
            <h1>
              Make yourself
              <br />
              at home.
            </h1>
            <p className="page-intro">
              Choose a place, leave room for wandering, and mind the tide. This is a fictional stay
              planner; nothing is booked or sent.
            </p>
            <div className="planner-layout">
              <div className="planner-fields">
                <fieldset>
                  <legend>
                    <span>01</span> Pick your little place
                  </legend>
                  <div className="room-choice">
                    {STAYS.map((item) => (
                      <label key={item.id} className={plan.stay === item.id ? "selected" : ""}>
                        <input
                          type="radio"
                          name="stay"
                          value={item.id}
                          checked={plan.stay === item.id}
                          onChange={() => update({ stay: item.id })}
                        />
                        <span>
                          {item.name}
                          <small>
                            Sleeps {item.capacity} · {money(item.price)} / night
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>
                    <span>02</span> Take your time
                  </legend>
                  <div className="date-fields">
                    <label>
                      Arrive
                      <input
                        type="date"
                        aria-invalid={issues.some(
                          (issue) => issue.field === "dates" || issue.field === "availability",
                        )}
                        aria-describedby="stay-notes"
                        min="2026-10-01"
                        max="2026-10-31"
                        value={plan.arrival}
                        onChange={(event) => update({ arrival: event.target.value })}
                      />
                    </label>
                    <label>
                      Leave
                      <input
                        type="date"
                        aria-invalid={issues.some(
                          (issue) => issue.field === "dates" || issue.field === "availability",
                        )}
                        aria-describedby="stay-notes"
                        min="2026-10-02"
                        max="2026-11-01"
                        value={plan.departure}
                        onChange={(event) => update({ departure: event.target.value })}
                      />
                    </label>
                    <label>
                      Guests
                      <select
                        value={plan.guests}
                        aria-invalid={issues.some((issue) => issue.field === "guests")}
                        aria-describedby="stay-notes"
                        onChange={(event) => update({ guests: Number(event.target.value) })}
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="small-note">1–7 nights in our sample October 2026 season.</p>
                  <div id="stay-notes" aria-live="polite">
                    {issues
                      .filter((issue) => issue.field !== "activities")
                      .map((issue) => (
                        <p className="field-error" key={issue.field}>
                          {issue.message}
                        </p>
                      ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>
                    <span>03</span> What kind of day?
                  </legend>
                  <p>These activities make one island day during your stay.</p>
                  <div className="mood-buttons">
                    {[
                      ["wander", "A little adventure"],
                      ["quiet", "Very little, please"],
                      ["stars", "Stay up for the stars"],
                    ].map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => update({ activities: moodPlan(value ?? "quiet") })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="activity-list">
                    {ACTIVITIES.map((activity) => (
                      <div key={activity.id}>
                        <div>
                          <h3>{activity.name}</h3>
                          <p>{activity.description}</p>
                          <small>
                            {activity.price ? `${money(activity.price)} / guest` : "Included"} · 1
                            hour
                          </small>
                        </div>
                        <button
                          type="button"
                          disabled={plan.activities.some((slot) => slot.id === activity.id)}
                          onClick={() => addActivity(activity.id)}
                        >
                          {plan.activities.some((slot) => slot.id === activity.id)
                            ? "Added ✓"
                            : "Add +"}
                        </button>
                      </div>
                    ))}
                  </div>
                </fieldset>
              </div>
              <aside className="day-ledger">
                <p className="eyebrow">Your island day</p>
                <h2>
                  A little room
                  <br />
                  for lovely things.
                </h2>
                {plan.activities.length === 0 && (
                  <p>A wonderfully empty day. Add a little adventure, or leave it that way.</p>
                )}
                <ol>
                  {[...plan.activities]
                    .sort((a, b) => a.hour - b.hour)
                    .map((slot) => (
                      <li key={slot.id}>
                        <label>
                          <span>{activityFor(slot.id).name}</span>
                          <select
                            aria-label={`${activityFor(slot.id).name} start time`}
                            aria-invalid={issues.some((issue) => issue.id === slot.id)}
                            aria-describedby="activity-notes"
                            value={slot.hour}
                            onChange={(event) =>
                              update({
                                activities: plan.activities.map((item) =>
                                  item.id === slot.id
                                    ? { ...item, hour: Number(event.target.value) }
                                    : item,
                                ),
                              })
                            }
                          >
                            {Array.from({ length: 65 }, (_, i) => 6 + i / 4).map((hour) => (
                              <option value={hour} key={hour}>
                                {hourLabel(hour)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="remove"
                          aria-label={`Remove ${activityFor(slot.id).name}`}
                          onClick={() =>
                            update({
                              activities: plan.activities.filter((item) => item.id !== slot.id),
                            })
                          }
                        >
                          ×
                        </button>
                      </li>
                    ))}
                </ol>
                <div id="activity-notes" aria-live="polite">
                  {issues
                    .filter((issue) => issue.field === "activities")
                    .map((issue) => (
                      <p className="field-error" key={`${issue.id}-${issue.message}`}>
                        {issue.message}
                      </p>
                    ))}
                </div>
                {issues.some((issue) => issue.field === "activities") && (
                  <button
                    type="button"
                    className="repair"
                    onClick={() => {
                      update({ activities: repairSchedule(plan.activities) });
                      setMessage(
                        "Your activities have been fitted around the tide and each other.",
                      );
                    }}
                  >
                    Find a time that works ↻
                  </button>
                )}
                <div className="cost-lines">
                  <span>
                    {nights(plan)} nights at {stayFor(plan.stay).name}
                    <strong>{money(price.accommodation)}</strong>
                  </span>
                  <span>
                    Little adventures · {plan.guests} guests
                    <strong>{money(price.activities)}</strong>
                  </span>
                  <span className="total">
                    Illustrative total<strong>{money(price.total)}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  className="button primary"
                  disabled={issues.length > 0}
                  onClick={() => navigate("/summary")}
                >
                  See your island plan <Arrow />
                </button>
                {issues.length > 0 && (
                  <p className="small-note">Resolve the notes above to finish your plan.</p>
                )}
                <div className="save-actions">
                  <button type="button" onClick={save}>
                    Save on this browser
                  </button>
                  <button type="button" onClick={restore}>
                    Restore a saved day
                  </button>
                </div>
                <p className="demo-note">No payment. No personal details. No reservation.</p>
              </aside>
            </div>
          </section>
        )}
        {path === "/summary" && (
          <section className="section-pad summary-section">
            <p className="eyebrow">A postcard from a possible day</p>
            <h2>{issues.length ? "A little adjustment first." : "Consider yourself elsewhere."}</h2>
            {issues.length ? (
              <>
                <p>Your current choices need a little attention before this plan is ready.</p>
                <button type="button" className="button primary" onClick={() => navigate("/plan")}>
                  Back to your plan <Arrow />
                </button>
              </>
            ) : (
              <>
                <figure className="postcard">
                  <img
                    src={`/plates/${plan.stay}-dusk.webp`}
                    width={1500}
                    height={1000}
                    alt={`${stayFor(plan.stay).name} at dusk, lamps on`}
                    decoding="async"
                  />
                  <span className="postcard-stamp" aria-hidden="true">
                    ODD
                    <br />
                    TIDE
                  </span>
                  <span className="postcard-mark" aria-hidden="true">
                    Island post · {plan.arrival}
                  </span>
                </figure>
                <p>
                  {stayFor(plan.stay).name} · {plan.arrival} to {plan.departure}
                  <br />
                  {plan.guests} guests, {nights(plan)} slow nights.
                </p>
                <div className="summary-timeline">
                  {[...plan.activities]
                    .sort((a, b) => a.hour - b.hour)
                    .map((slot) => (
                      <div key={slot.id}>
                        <strong>{hourLabel(slot.hour)}</strong>
                        <span>{activityFor(slot.id).name}</span>
                      </div>
                    ))}
                </div>
                <p className="summary-total">
                  {money(price.total)} <small>illustrative total</small>
                </p>
                <div className="hero-actions">
                  <button type="button" className="button primary" onClick={() => void postcard()}>
                    Take a postcard with you <Arrow />
                  </button>
                  <button type="button" className="button outlined" onClick={() => window.print()}>
                    Print your plan
                  </button>
                  <button type="button" className="text-button" onClick={() => navigate("/plan")}>
                    A little rearranging
                  </button>
                </div>
                <p className="demo-note">
                  This is a demonstration plan for a fictional island. It is not a reservation,
                  ticket or travel offer.
                </p>
              </>
            )}
          </section>
        )}
        {path === "/about" && (
          <section className="section-pad page-section about">
            <p className="eyebrow">A real little piece of imagination</p>
            <h1>Good to know.</h1>
            <h2>Is this a real place?</h2>
            <p>
              ODD TIDE is an original interactive portfolio experience. The island, cabins, tide
              schedule, availability and prices are fictional. You can explore and prepare a demo
              plan here; you cannot make a real reservation or payment.
            </p>
            <h2>What happens to my plan?</h2>
            <p>
              Your choices stay in this page's address. If you press “Save on this browser”, they
              are stored locally on your device. We ask for no personal details and send no bookings
              or messages. A downloaded postcard is created locally.
            </p>
            <h2>Moving at your pace.</h2>
            <p>
              The island has pause and gentle-motion controls. Every important action is also
              available as a labelled button or form field. If the live island cannot load, the
              stays and planner remain available.
            </p>
            <h2>A note on sea time.</h2>
            <p>
              The repeating tide cycle is an authored rule for this imaginary island. It is not a
              tide forecast or guidance for real coastal activities.
            </p>
            <Link to="/" className="button primary">
              Back to our little island <Arrow />
            </Link>
          </section>
        )}
        {!known && (
          <section className="section-pad page-section">
            <p className="eyebrow">A small wrong turn · 404</p>
            <h1>
              The sea moved
              <br />
              this page.
            </h1>
            <p>Or it was never here. Either way, the island is just over there.</p>
            <Link to="/" className="button primary">
              Find your way home <Arrow />
            </Link>
          </section>
        )}
      </main>
      <div className={`toast ${message ? "visible" : ""}`} role="status">
        {message && (
          <>
            {message}
            <button type="button" aria-label="Dismiss message" onClick={() => setMessage("")}>
              ×
            </button>
          </>
        )}
      </div>
      <footer>
        <div className="footer-brand">
          <Mark />
          <p>Somewhere between here and the sea.</p>
        </div>
        <div className="footer-links">
          <Link to="/">The island</Link>
          <Link to="/stays">Our little stays</Link>
          <Link to="/plan">Plan your day</Link>
          <Link to="/about">About this demo</Link>
        </div>
        <Sound />
        <p className="footer-fine">
          An original fictional island · Portfolio demonstration · 26 September 2026
          <br />
          All prices, availability and tides are illustrative. No real bookings.
        </p>
        <span className="footer-sun" aria-hidden="true">
          ✳
        </span>
      </footer>
    </>
  );
}
