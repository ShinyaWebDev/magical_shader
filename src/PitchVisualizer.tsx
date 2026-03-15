import { useEffect, useRef, useState } from "react";
import p5 from "p5";

// ── ml5 types ────────────────────────────────────────────────────────────────
declare global {
  interface Window {
    ml5: {
      pitchDetection: (
        modelUrl: string,
        audioContext: AudioContext,
        stream: MediaStream,
        callback: () => void
      ) => {
        getPitch: (cb: (err: unknown, frequency: number | null) => void) => void;
      };
    };
  }
}

type P5Ex = p5 & {
  preload: () => void;
  setup: () => void;
  draw: () => void;
  windowResized: () => void;
};

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_PARTICLE_COUNT = 70;
const MAX_TRAIL_COUNT = 30;
const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/";
const COLOR_SCHEME = ["#E69F66", "#DF843A", "#D8690F", "#B1560D", "#8A430A"];
const SCALE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_COLORS: Record<string, [number, number, number]> = {
  C: [1.0, 0.0, 0.0], "C#": [1.0, 0.5, 0.0], D: [1.0, 1.0, 0.0],
  "D#": [0.5, 1.0, 0.0], E: [0.0, 1.0, 0.0], F: [0.0, 1.0, 0.5],
  "F#": [0.0, 1.0, 1.0], G: [0.0, 0.5, 1.0], "G#": [0.0, 0.0, 1.0],
  A: [0.5, 0.0, 1.0], "A#": [1.0, 0.0, 1.0], B: [1.0, 0.0, 0.5],
};

const PHASE_DURATION = 5000; // ms per phase

// ── Phase config ─────────────────────────────────────────────────────────────
const PHASES = [
  {
    id: 1,
    icon: "↑",
    action: "GO AS HIGH",
    sub: "AS YOU CAN",
    hint: "Sing or play your highest possible note",
    accent: "rgba(255, 90, 150, 1)",
    accentDim: "rgba(255, 90, 150, 0.15)",
    glow: "rgba(255, 60, 120, 0.5)",
    label: "HIGHEST PITCH",
  },
  {
    id: 2,
    icon: "↓",
    action: "GO AS LOW",
    sub: "AS YOU CAN",
    hint: "Sing or play your lowest possible note",
    accent: "rgba(80, 170, 255, 1)",
    accentDim: "rgba(80, 170, 255, 0.15)",
    glow: "rgba(40, 130, 255, 0.5)",
    label: "LOWEST PITCH",
  },
  {
    id: 3,
    icon: "◉",
    action: "GO AS LOUD",
    sub: "AS YOU CAN",
    hint: "Make your loudest sound — shout, clap, or play loud",
    accent: "rgba(140, 255, 100, 1)",
    accentDim: "rgba(140, 255, 100, 0.15)",
    glow: "rgba(100, 255, 60, 0.5)",
    label: "PEAK VOLUME",
  },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────
function freqToNoteLabel(freq: number): string {
  if (!freq || freq <= 0) return "—";
  const midiNum = Math.round(12 * Math.log2(freq / 440) + 69);
  const note = SCALE[((midiNum % 12) + 12) % 12];
  const octave = Math.floor(midiNum / 12) - 1;
  return `${note}${octave}`;
}
function formatHz(freq: number): string {
  if (!freq || freq <= 0) return "";
  return `${Math.round(freq)} Hz`;
}

// ── Types ────────────────────────────────────────────────────────────────────
interface ParticleObj {
  pos: p5.Vector; vel: p5.Vector; mass: number;
  airDrag: number; colorIndex: number; move(): void;
}
type AudioContextWithAnalyser = AudioContext & { _analyser?: AnalyserNode };

// ── Stepper dots ─────────────────────────────────────────────────────────────
function StepDots({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
      {PHASES.map((ph) => {
        const done = current > ph.id;
        const active = current === ph.id;
        return (
          <div
            key={ph.id}
            style={{
              width: active ? "28px" : "8px",
              height: "8px",
              borderRadius: "4px",
              background: done
                ? "rgba(255,255,255,0.5)"
                : active
                ? PHASES[ph.id - 1].accent
                : "rgba(255,255,255,0.15)",
              boxShadow: active ? `0 0 10px ${PHASES[ph.id - 1].glow}` : "none",
              transition: "all 0.35s ease",
            }}
          />
        );
      })}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export default function PitchVisualizer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("");
  const [currentNote, setCurrentNote] = useState("");
  const [started, setStarted] = useState(false);

  // calPhase: 0=idle, 1=high, 2=low, 3=loud, 4=complete-flash, 5=done
  const [calPhase, setCalPhase] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [phaseDisplay, setPhaseDisplay] = useState({
    currentFreq: 0, currentVol: 0,
    bestHigh: 0, bestLow: 0, bestVol: 0,
  });

  const audioContextRef = useRef<AudioContextWithAnalyser | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pitchRef = useRef<ReturnType<Window["ml5"]["pitchDetection"]> | null>(null);
  const volumesRef = useRef(0);
  const audioControlledXRef = useRef(0);
  const audioControlledYRef = useRef(0);
  const currentNoteRef = useRef("");
  const startedRef = useRef(false);
  const calPhaseRef = useRef(0);
  const calDoneRef = useRef(false);
  const calMinFreqRef = useRef(Infinity);
  const calMaxFreqRef = useRef(0);
  const calMaxVolRef = useRef(0);

  // Custom cursor
  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    const move = (e: MouseEvent) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  // Phase countdown
  useEffect(() => {
    if (calPhase < 1 || calPhase > 3) return;
    const start = Date.now();
    setPhaseProgress(0);
    const interval = setInterval(() => {
      const progress = Math.min((Date.now() - start) / PHASE_DURATION, 1) * 100;
      setPhaseProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        if (calPhase < 3) {
          const next = (calPhase + 1) as 2 | 3;
          calPhaseRef.current = next;
          setCalPhase(next);
        } else {
          // All phases done — flash complete screen then hide
          calPhaseRef.current = 4;
          calDoneRef.current = true;
          setCalPhase(4);
          setTimeout(() => {
            calPhaseRef.current = 5;
            setCalPhase(5);
            setStatus("");
          }, 1800);
        }
      }
    }, 50);
    return () => clearInterval(interval);
  }, [calPhase]);

  const handleStart = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
    window.dispatchEvent(new Event("start-audio"));
  };

  useEffect(() => {
    if (!containerRef.current) return;
    let p5Instance: p5;

    const sketch = (p: p5) => {
      const px = p as P5Ex;
      let theShader: p5.Shader;
      let shaderTexture: p5.Graphics;
      const trail: [number, number][] = [];
      const particles: ParticleObj[] = [];

      function createParticle(x: number): ParticleObj {
        const pos = p.createVector(x, p.height);
        const vel = p.createVector(p.random(-1, 1), p.random(-1, -10));
        vel.mult(p.random(10));
        vel.rotate(p.radians(p.random(-25, 25)));
        const mass = p.random(1, 20);
        const airDrag = p.random(0.92, 0.98);
        const colorIndex = p.int(p.random(COLOR_SCHEME.length));
        return {
          pos, vel, mass, airDrag, colorIndex,
          move() { this.vel.mult(this.airDrag); this.pos.add(this.vel); },
        };
      }

      function serializeSketch() {
        const data = { trails: [] as number[], particles: [] as number[], colors: [] as number[] };
        const aspect = p.width / p.height;
        for (let i = 0; i < trail.length; i++) {
          data.trails.push(
            p.map(trail[i][0] * aspect, 0, p.width, 0.0, 1.0),
            p.map(trail[i][1], 0, p.height, 1.0, 0.0)
          );
        }
        for (let i = 0; i < particles.length; i++) {
          data.particles.push(
            p.map(particles[i].pos.x * aspect, 0, p.width, 0.0, 1.0),
            p.map(particles[i].pos.y, 0, p.height, 1.0, 0.0),
            (particles[i].mass * particles[i].vel.mag()) / 100
          );
          const c = COLOR_SCHEME[particles[i].colorIndex];
          data.colors.push(p.red(c) / 255, p.green(c) / 255, p.blue(c) / 255);
        }
        return data;
      }

      function getPitch() {
        if (!pitchRef.current) return;
        pitchRef.current.getPitch((_, frequency) => {
          const ctx = audioContextRef.current;
          let volume = 0;
          if (ctx?._analyser) {
            const buf = new Float32Array(ctx._analyser.fftSize);
            ctx._analyser.getFloatTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
            volume = Math.sqrt(sum / buf.length);
          }
          volumesRef.current = volume;
          const freq = frequency ?? 0;
          const phase = calPhaseRef.current;

          // Collect calibration data per phase
          if (phase >= 1 && phase <= 3) {
            if (phase === 1 && freq > 50 && freq > calMaxFreqRef.current) {
              calMaxFreqRef.current = freq;
            }
            if (phase === 2 && freq > 50 && (calMinFreqRef.current === Infinity || freq < calMinFreqRef.current)) {
              calMinFreqRef.current = freq;
            }
            if (phase === 3 && volume > calMaxVolRef.current) {
              calMaxVolRef.current = volume;
            }
            setPhaseDisplay({
              currentFreq: freq,
              currentVol: volume,
              bestHigh: calMaxFreqRef.current,
              bestLow: calMinFreqRef.current === Infinity ? 0 : calMinFreqRef.current,
              bestVol: calMaxVolRef.current,
            });
          }

          // Mapping ranges (calibrated or defaults)
          const hasCalibration = calDoneRef.current
            && calMinFreqRef.current < Infinity
            && calMaxFreqRef.current > 0;
          const minLog = hasCalibration ? Math.log(calMinFreqRef.current * 0.9) : Math.log(80);
          const maxLog = hasCalibration ? Math.log(calMaxFreqRef.current * 1.1) : Math.log(1000);
          const maxVol = hasCalibration && calMaxVolRef.current > 0 ? calMaxVolRef.current : 0.1;

          if (currentNoteRef.current) {
            audioControlledXRef.current = p.map(
              p.constrain(Math.log(freq || 1), minLog, maxLog),
              minLog, maxLog, 0, p.windowWidth
            );
          }
          audioControlledYRef.current = p.constrain(
            p.map(volume, 0, maxVol, p.windowHeight, 0),
            0, p.windowHeight
          );

          if (freq) {
            const midiNum = Math.round(12 * Math.log2(freq / 440) + 69);
            const note = SCALE[((midiNum % 12) + 12) % 12];
            currentNoteRef.current = note;
            setCurrentNote(note);
          }

          getPitch();
        });
      }

      function modelLoaded() {
        setStatus("");
        calPhaseRef.current = 1;
        setCalPhase(1);
        getPitch();
      }

      function handleStartAudio() {
        setStatus("Requesting mic…");
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          .then((stream) => {
            mediaStreamRef.current = stream;
            const ctx = new AudioContext() as AudioContextWithAnalyser;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            ctx.createMediaStreamSource(stream).connect(analyser);
            ctx._analyser = analyser;
            audioContextRef.current = ctx;
            setStatus("Loading model…");
            pitchRef.current = window.ml5.pitchDetection(MODEL_URL, ctx, stream, modelLoaded);
          })
          .catch((err) => {
            console.error("Mic error:", err);
            setStatus("Mic access denied");
          });
      }

      window.addEventListener("start-audio", handleStartAudio, { once: true });

      px.preload = () => {
        theShader = p.loadShader("/shader.vert", "/shader.frag") as unknown as p5.Shader;
      };
      px.setup = () => {
        p.pixelDensity(1);
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
        (canvas as unknown as { canvas: HTMLCanvasElement }).canvas.oncontextmenu = () => false;
        p.noCursor();
        shaderTexture = p.createGraphics(p.width, p.height, p.WEBGL);
        (shaderTexture as unknown as { noStroke(): void }).noStroke();
      };
      px.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        (shaderTexture as unknown as { resizeCanvas(w: number, h: number): void })
          .resizeCanvas(p.width, p.height);
      };
      px.draw = () => {
        p.background(0);
        p.noStroke();
        const volumes = volumesRef.current;
        const audioControlledX = audioControlledXRef.current;
        const audioControlledY = audioControlledYRef.current;
        if (volumes > 0.001) trail.push([audioControlledX, audioControlledY]);
        if (trail.length > MAX_TRAIL_COUNT) trail.splice(0, 1);
        if (volumes > 0.09 && particles.length < MAX_PARTICLE_COUNT) {
          const mouse = p.createVector(audioControlledX, 20);
          mouse.sub(p.pmouseX, p.pmouseY);
          if (mouse.mag() > 10) particles.push(createParticle(audioControlledX));
        }
        p.translate(-p.windowWidth / 2, -p.windowHeight / 2);
        for (let i = particles.length - 1; i >= 0; i--) {
          particles[i].move();
          if (particles[i].vel.mag() < 0.1) particles.splice(i, 1);
        }
        (shaderTexture as unknown as p5).shader(theShader);
        const data = serializeSketch();
        const detectedNoteColor: [number, number, number] =
          NOTE_COLORS[currentNoteRef.current] ?? [0.0, 0.0, 0.0];
        theShader.setUniform("noteColor", detectedNoteColor);
        theShader.setUniform("resolution", [p.windowWidth, p.windowHeight]);
        theShader.setUniform("trailCount", trail.length);
        theShader.setUniform("trail", data.trails);
        theShader.setUniform("particleCount", particles.length);
        theShader.setUniform("particles", data.particles);
        theShader.setUniform("colors", data.colors);
        theShader.setUniform("volume", volumes);
        (shaderTexture as unknown as p5).rect(0, 0, p.width, p.height);
        p.texture(shaderTexture);
        p.rect(0, 0, p.width, p.height);
      };
    };

    p5Instance = new p5(sketch, containerRef.current);
    return () => {
      p5Instance.remove();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, []);

  // ── Derived UI values ────────────────────────────────────────────────────
  const activePhase = PHASES.find((ph) => ph.id === calPhase);
  const secsLeft = Math.ceil((PHASE_DURATION * (1 - phaseProgress / 100)) / 1000);
  const currentVolPct = Math.min((phaseDisplay.currentVol / 0.15) * 100, 100);
  const bestVolPct = Math.min((phaseDisplay.bestVol / 0.15) * 100, 100);
  const showCalibration = calPhase >= 1 && calPhase <= 4;

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#000" }}>
      {/* Custom cursor */}
      <div
        ref={cursorRef}
        style={{
          position: "fixed", width: 18, height: 18, borderRadius: "50%",
          background: "rgba(255,255,255,0.9)",
          boxShadow: "0 0 8px 4px rgba(255,255,255,0.8), 0 0 20px 8px rgba(180,100,255,0.6)",
          transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 9999,
          transition: "transform 0.05s ease",
        }}
      />
      <div ref={containerRef} style={{ position: "fixed", inset: 0, zIndex: 0 }} />

      {/* ── Calibration overlay ─────────────────────────────────────────── */}
      {showCalibration && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 30,
            background: "rgba(0,0,0,0.92)",
            backdropFilter: "blur(16px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: "0",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            transition: "opacity 0.4s ease",
          }}
        >
          {/* ── Phase 1-3: active calibration ── */}
          {activePhase && calPhase <= 3 && (
            <>
              {/* Step dots */}
              <div style={{ marginBottom: "2.5rem" }}>
                <StepDots current={calPhase} />
              </div>

              {/* Big icon */}
              <div
                style={{
                  fontSize: "4rem",
                  lineHeight: 1,
                  color: activePhase.accent,
                  textShadow: `0 0 40px ${activePhase.glow}, 0 0 80px ${activePhase.glow}`,
                  marginBottom: "1.2rem",
                  transition: "all 0.4s ease",
                  fontWeight: 300,
                }}
              >
                {activePhase.icon}
              </div>

              {/* Action title */}
              <div style={{ textAlign: "center", marginBottom: "0.4rem" }}>
                <div
                  style={{
                    fontSize: "2.6rem",
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    color: activePhase.accent,
                    textShadow: `0 0 28px ${activePhase.glow}`,
                    lineHeight: 1.1,
                    transition: "all 0.4s ease",
                  }}
                >
                  {activePhase.action}
                </div>
                <div
                  style={{
                    fontSize: "2.6rem",
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.88)",
                    lineHeight: 1.1,
                  }}
                >
                  {activePhase.sub}
                </div>
              </div>

              {/* Hint */}
              <p
                style={{
                  color: "rgba(255,255,255,0.35)",
                  fontSize: "0.82rem",
                  letterSpacing: "0.06em",
                  margin: "0.8rem 0 2.2rem",
                  textAlign: "center",
                }}
              >
                {activePhase.hint}
              </p>

              {/* Live readout */}
              {calPhase <= 2 ? (
                // Pitch phases: show note + hz
                <div style={{ display: "flex", gap: "1.5rem", marginBottom: "2rem", alignItems: "flex-end" }}>
                  {/* Current */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.6rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: "0.4rem" }}>
                      Current
                    </div>
                    <div style={{ fontSize: "2.2rem", fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em", minWidth: "80px", textAlign: "center" }}>
                      {freqToNoteLabel(phaseDisplay.currentFreq)}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em", marginTop: "0.2rem" }}>
                      {formatHz(phaseDisplay.currentFreq)}
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ width: "1px", height: "48px", background: "rgba(255,255,255,0.08)", marginBottom: "12px" }} />

                  {/* Best */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.6rem", letterSpacing: "0.2em", color: activePhase.accent, textTransform: "uppercase", marginBottom: "0.4rem", fontWeight: 600 }}>
                      {activePhase.label}
                    </div>
                    <div
                      style={{
                        fontSize: "2.2rem", fontWeight: 700, letterSpacing: "0.04em",
                        color: "rgba(255,255,255,0.95)", minWidth: "80px", textAlign: "center",
                        textShadow: `0 0 20px ${activePhase.glow}`,
                      }}
                    >
                      {calPhase === 1
                        ? freqToNoteLabel(phaseDisplay.bestHigh)
                        : freqToNoteLabel(phaseDisplay.bestLow)}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", marginTop: "0.2rem" }}>
                      {calPhase === 1 ? formatHz(phaseDisplay.bestHigh) : formatHz(phaseDisplay.bestLow)}
                    </div>
                  </div>
                </div>
              ) : (
                // Volume phase: show bar
                <div style={{ width: "360px", marginBottom: "2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.6rem" }}>
                    <span style={{ color: "rgba(255,255,255,0.35)" }}>Live</span>
                    <span style={{ color: activePhase.accent, fontWeight: 600 }}>{activePhase.label}</span>
                  </div>
                  {/* Live bar */}
                  <div style={{ height: "10px", background: "rgba(255,255,255,0.06)", borderRadius: "5px", overflow: "hidden", marginBottom: "6px" }}>
                    <div style={{
                      height: "100%", width: `${currentVolPct}%`,
                      background: `linear-gradient(90deg, ${activePhase.accentDim.replace("0.15", "0.6")}, ${activePhase.accent})`,
                      boxShadow: `0 0 12px ${activePhase.glow}`,
                      borderRadius: "5px", transition: "width 0.05s ease",
                    }} />
                  </div>
                  {/* Best bar */}
                  <div style={{ height: "6px", background: "rgba(255,255,255,0.04)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${bestVolPct}%`,
                      background: activePhase.accent,
                      boxShadow: `0 0 16px ${activePhase.glow}`,
                      borderRadius: "3px", transition: "width 0.15s ease",
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.55rem", color: "rgba(255,255,255,0.2)", marginTop: "4px", letterSpacing: "0.1em" }}>
                    <span>0</span><span>BEST: {Math.round(bestVolPct)}%</span><span>MAX</span>
                  </div>
                </div>
              )}

              {/* Countdown bar */}
              <div style={{ width: "320px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "0.5rem" }}>
                  <span>Step {calPhase} of 3</span>
                  <span>{secsLeft}s</span>
                </div>
                <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${phaseProgress}%`,
                    background: `linear-gradient(90deg, ${activePhase.accentDim.replace("0.15","0.5")}, ${activePhase.accent})`,
                    boxShadow: `0 0 8px ${activePhase.glow}`,
                    borderRadius: "2px", transition: "width 0.05s linear",
                  }} />
                </div>
              </div>
            </>
          )}

          {/* ── Phase 4: complete flash ── */}
          {calPhase === 4 && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
              <div style={{ fontSize: "3rem", lineHeight: 1 }}>✓</div>
              <div style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.9)", textShadow: "0 0 30px rgba(180,100,255,0.8)" }}>
                ALL SET!
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                {[
                  { label: "Highest", value: freqToNoteLabel(phaseDisplay.bestHigh), hz: formatHz(phaseDisplay.bestHigh), color: PHASES[0].accent },
                  { label: "Lowest", value: freqToNoteLabel(phaseDisplay.bestLow), hz: formatHz(phaseDisplay.bestLow), color: PHASES[1].accent },
                  { label: "Peak Volume", value: `${Math.round(bestVolPct)}%`, hz: "", color: PHASES[2].accent },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", gap: "0.8rem", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: item.color, minWidth: "80px", textAlign: "right" }}>{item.label}</span>
                    <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{item.value}</span>
                    {item.hz && <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}>{item.hz}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Normal HUD ──────────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 10, pointerEvents: "none",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "flex-end",
          paddingBottom: "2.5rem", gap: "1rem",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div style={{
          color: "rgba(255,255,255,0.85)", fontSize: "2.4rem", fontWeight: 600,
          letterSpacing: "0.12em",
          textShadow: "0 0 18px rgba(160,80,255,0.9), 0 0 40px rgba(100,0,255,0.5)",
          minHeight: "3rem", textAlign: "center", transition: "color 0.2s ease",
        }}>
          {currentNote && calPhase >= 5 ? `Current Note: ${currentNote}` : ""}
        </div>

        {!started && (
          <button
            onClick={handleStart}
            style={{
              pointerEvents: "all", background: "transparent",
              border: "2px solid rgba(180,100,255,0.7)",
              color: "rgba(220,180,255,0.95)", fontSize: "1rem", fontWeight: 600,
              letterSpacing: "0.2em", textTransform: "uppercase",
              padding: "0.65rem 2.2rem", borderRadius: "999px", cursor: "pointer",
              boxShadow: "0 0 14px rgba(160,80,255,0.45), inset 0 0 10px rgba(160,80,255,0.1)",
            }}
            onMouseEnter={(e) => {
              const btn = e.target as HTMLButtonElement;
              btn.style.background = "rgba(160,80,255,0.18)";
              btn.style.boxShadow = "0 0 28px rgba(180,80,255,0.7), inset 0 0 14px rgba(180,80,255,0.2)";
            }}
            onMouseLeave={(e) => {
              const btn = e.target as HTMLButtonElement;
              btn.style.background = "transparent";
              btn.style.boxShadow = "0 0 14px rgba(160,80,255,0.45), inset 0 0 10px rgba(160,80,255,0.1)";
            }}
          >
            Start
          </button>
        )}

        <p style={{
          color: "rgba(255,255,255,0.4)", fontSize: "0.75rem",
          letterSpacing: "0.15em", textTransform: "uppercase",
          margin: 0, minHeight: "1.1rem",
        }}>
          {status}
        </p>
      </div>
    </div>
  );
}
