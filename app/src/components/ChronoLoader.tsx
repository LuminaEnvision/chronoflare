import { useEffect, useRef, useState } from "react";

type Step = [number, string];

const STEPS: Step[] = [
  [0, "Preparing data…"],
  [25, "Loading detections…"],
  [55, "Aligning MODIS and VIIRS…"],
  [82, "Building the view…"],
];

function messageFor(progress: number, override?: string): string {
  if (override) return override;
  return STEPS.filter(([p]) => p <= progress).at(-1)?.[1] ?? STEPS[0][1];
}

type ChronoLoaderProps = {
  open: boolean;
  /** 0–100. When omitted, progress eases toward 90% while open. */
  progress?: number;
  message?: string;
  label?: string;
  /** fullscreen covers the viewport; panel fills its parent. */
  variant?: "fullscreen" | "panel";
};

type Colors = { dot: string; glow: string; sat: string };
type Flare = { i: number; l: number };

const TAU = Math.PI * 2;
const N = 1100;
const TILT = 0.41;
const INC = 1.05;
const NODE = 0.6;
const RO = 1.5;

const PTS: [number, number, number][] = [];
for (let i = 0; i < N; i++) {
  const y = 1 - (2 * (i + 0.5)) / N;
  const r = Math.sqrt(1 - y * y);
  const f = i * 2.39996323;
  PTS.push([Math.cos(f) * r, y, Math.sin(f) * r]);
}

function tilt(x: number, y: number, z: number): [number, number, number] {
  const c = Math.cos(TILT);
  const s = Math.sin(TILT);
  return [x, y * c - z * s, y * s + z * c];
}

function spin(
  p: [number, number, number],
  a: number,
): [number, number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return tilt(p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c);
}

function orbit(th: number): [number, number, number] {
  let x = RO * Math.cos(th);
  let z = RO * Math.sin(th);
  const y = -z * Math.sin(INC);
  z *= Math.cos(INC);
  const c = Math.cos(NODE);
  const s = Math.sin(NODE);
  return tilt(x * c + z * s, y, -x * s + z * c);
}

/**
 * Full-screen (or panel) globe loader ported from Jorge’s ChronoLoader HTML.
 * Call with open while data loads; progress may be driven or indeterminate.
 */
export function ChronoLoader({
  open,
  progress: progressProp,
  message,
  label = "ChronoFlare",
  variant = "fullscreen",
}: ChronoLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(open);
  const [hiding, setHiding] = useState(false);
  const [autoProgress, setAutoProgress] = useState(0);

  const progress =
    progressProp !== undefined
      ? Math.max(0, Math.min(100, progressProp))
      : autoProgress;
  const status = messageFor(progress, message);

  // Indeterminate progress while open and no explicit progress.
  useEffect(() => {
    if (!open || progressProp !== undefined) return;
    setAutoProgress(0);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const u = Math.min((now - t0) / 5200, 1);
      setAutoProgress(90 * (1 - Math.pow(1 - u, 2.4)));
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, progressProp]);

  // Show immediately; on close, ease to 100% then fade out.
  useEffect(() => {
    if (open) {
      setVisible(true);
      setHiding(false);
      return;
    }
    if (!visible) return;
    setHiding(true);
    if (progressProp === undefined) setAutoProgress(100);
    const fade = window.setTimeout(() => {
      setVisible(false);
      setHiding(false);
      setAutoProgress(0);
    }, 900);
    return () => clearTimeout(fade);
  }, [open, visible, progressProp]);

  // Canvas globe animation.
  useEffect(() => {
    if (!visible) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;
    let col: Colors = { dot: "222,92,10", glow: "240,151,99", sat: "39,104,86" };
    let W = 0;
    let k = 1;
    let dpr = 1;
    let raf = 0;
    let running = true;
    let last = performance.now();
    let T = 0;
    let flares: Flare[] = [];

    const readColors = () => {
      const s = getComputedStyle(root);
      col = {
        dot: s.getPropertyValue("--cf-loader-dot").trim() || col.dot,
        glow: s.getPropertyValue("--cf-loader-glow").trim() || col.glow,
        sat: s.getPropertyValue("--cf-loader-sat").trim() || col.sat,
      };
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.getBoundingClientRect().width;
      cv.width = cv.height = Math.round(W * dpr);
      k = W / 460;
    };

    const dot = (
      x: number,
      y: number,
      r: number,
      a: number,
      c: string,
    ) => {
      ctx.fillStyle = `rgba(${c},${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    };

    const draw = (dt: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, W);
      const cx = W / 2;
      const cy = W / 2;
      const R = W / 2 / 1.62;
      const a = T * (reduce.matches ? 0.18 : 0.55);
      const amp = reduce.matches ? 0.15 : 0.45;

      for (let i = 0; i < N; i++) {
        const [x, y, z] = spin(PTS[i], a);
        const d = (z + 1) / 2;
        const tw =
          1 -
          amp +
          amp * Math.sin(T * (1.5 + (i % 7) * 0.45) + i * 1.7);
        dot(
          cx + x * R,
          cy - y * R,
          (0.8 + 1.2 * d) * k * 1.15,
          (0.1 + 0.9 * Math.pow(d, 1.8)) * tw,
          col.dot,
        );
      }

      if (
        flares.length < (reduce.matches ? 6 : 26) &&
        Math.random() < dt * (reduce.matches ? 4 : 16)
      ) {
        flares.push({ i: (Math.random() * N) | 0, l: 0 });
      }
      flares = flares.filter((f) => (f.l += dt / 1.2) < 1);
      for (const f of flares) {
        const [x, y, z] = spin(PTS[f.i], a);
        if (z < -0.1) continue;
        const al = Math.sin(Math.PI * f.l);
        const px = cx + x * R;
        const py = cy - y * R;
        dot(px, py, (5 + 8 * al) * k, al * 0.25, col.dot);
        dot(px, py, (2 + 3 * al) * k, al * 0.95, col.glow);
      }

      for (let j = 0; j < 180; j++) {
        const [x, y, z] = orbit((j / 180) * TAU);
        dot(
          cx + x * R,
          cy - y * R,
          0.9 * k,
          z > 0 ? 0.32 : 0.1,
          col.sat,
        );
      }

      const th = T * 1.1;
      for (let j = 1; j <= 34; j++) {
        const [x, y, z] = orbit(th - j * 0.03);
        dot(
          cx + x * R,
          cy - y * R,
          1.9 * (1 - j / 40) * k,
          (1 - j / 34) * 0.7 * (z > 0 ? 1 : 0.35),
          col.sat,
        );
      }
      const s = orbit(th);
      const n = orbit(th + 0.02);
      const sx = cx + s[0] * R;
      const sy = cy - s[1] * R;
      const ang = Math.atan2(-(n[1] - s[1]), n[0] - s[0]);
      const hidden = s[2] < 0 && Math.hypot(s[0], s[1]) < 1;

      if (!hidden) {
        const ph = (T % 1.6) / 1.6;
        ctx.strokeStyle = `rgba(${col.sat},${(1 - ph) * 0.5})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(sx, sy, ph * 26 * k, 0, TAU);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.scale(k * 1.1, k * 1.1);
      ctx.globalAlpha = hidden ? 0.25 : 1;
      ctx.fillStyle = `rgb(${col.sat})`;
      ctx.fillRect(-4, -2.5, 8, 5);
      ctx.globalAlpha *= 0.85;
      ctx.fillRect(-2.5, -10, 5, 6);
      ctx.fillRect(-2.5, 4, 5, 6);
      ctx.restore();
    };

    const frame = (ts: number) => {
      if (!running) return;
      const dt = Math.min((ts - last) / 1000 || 0, 0.05);
      last = ts;
      T += dt;
      draw(dt);
      // Decorative loop: stop continuous motion when the user prefers reduced motion.
      if (!reduce.matches) raf = requestAnimationFrame(frame);
    };

    readColors();
    resize();
    if (reduce.matches) {
      T = 0.8;
      draw(0);
    } else {
      raf = requestAnimationFrame(frame);
    }
    const onResize = () => {
      resize();
      if (reduce.matches) draw(0);
    };
    const onMotion = () => {
      cancelAnimationFrame(raf);
      if (reduce.matches) {
        T = 0.8;
        draw(0);
      } else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    window.addEventListener("resize", onResize);
    reduce.addEventListener("change", onMotion);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      reduce.removeEventListener("change", onMotion);
    };
  }, [visible]);

  if (!visible) return null;

  const rounded = Math.round(progress);

  return (
    <div
      className={`chrono-loader chrono-loader--${variant}${hiding ? " is-hidden" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy={!hiding}
      aria-label={`${label}: ${status} ${rounded}%`}
    >
      <div className="chrono-loader-stage">
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
      <div className="chrono-loader-status">
        <div className="chrono-loader-brand" translate="no">
          {label}
        </div>
        <p className="chrono-loader-msg">{status}</p>
        <div className="chrono-loader-row">
          <div
            className="chrono-loader-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={rounded}
            aria-label="Load progress"
          >
            <div
              className="chrono-loader-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="chrono-loader-pct" aria-hidden="true">
            {rounded}%
          </span>
        </div>
      </div>
    </div>
  );
}
