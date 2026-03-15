import { useEffect, useRef, useState } from "react";
import { Shader, Aurora, Plasma, FloatingParticles, Strands, CursorTrail } from "shaders/react";

declare global {
  interface Window {
    ml5: {
      pitchDetection: (
        modelUrl: string,
        audioContext: AudioContext,
        stream: MediaStream,
        callback: () => void
      ) => { getPitch: (cb: (err: unknown, freq: number | null) => void) => void };
    };
  }
}

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/";

const SCALE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const NOTE_ACCENT: Record<string, string> = {
  C: "#ff4455", "C#": "#ff7722", D: "#ffcc00", "D#": "#aaee00",
  E: "#44ee44", F: "#00eebb", "F#": "#00ddff", G: "#0088ff",
  "G#": "#4433ff", A: "#aa44ff", "A#": "#ff22cc", B: "#ff2266",
};

function freqToNoteName(freq: number): string {
  if (!freq || freq <= 0) return "—";
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  return SCALE[((midi % 12) + 12) % 12];
}

function freqToNoteLabel(freq: number): string {
  if (!freq || freq <= 0) return "—";
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  const note = SCALE[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

function mapClamp(v: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  const t = Math.max(0, Math.min(1, (v - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

const EFFECTS = [
  { key: "aurora", label: "Aurora" },
  { key: "plasma", label: "Plasma" },
  { key: "particles", label: "Particles" },
  { key: "strands", label: "Strands" },
  { key: "cursor", label: "Cursor Trail" },
] as const;
type EffectKey = (typeof EFFECTS)[number]["key"];

export default function PitchShaders() {
  const [started, setStarted] = useState(false);
  const [freq, setFreq] = useState(0);
  const [volume, setVolume] = useState(0);
  // Keep max 3 effects active at once to stay within TSL shader node limits
  const [active, setActive] = useState<Record<EffectKey, boolean>>({
    aurora: true,
    plasma: false,
    particles: true,
    strands: false,
    cursor: true,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{ getPitch: (cb: (e: unknown, f: number | null) => void) => void } | null>(null);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(false);
  const freqRef = useRef(0);
  const volumeRef = useRef(0);

  useEffect(() => {
    freqRef.current = freq;
  }, [freq]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Ensure ml5 script is loaded
  useEffect(() => {
    if (window.ml5) return;
    const s = document.createElement("script");
    s.src = "https://unpkg.com/ml5@0.12.2/dist/ml5.min.js";
    document.head.appendChild(s);
  }, []);

  const pollVolume = () => {
    if (!analyserRef.current || !runningRef.current) return;
    const data = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    setVolume(Math.sqrt(sum / data.length));
    rafRef.current = requestAnimationFrame(pollVolume);
  };

  const getPitch = () => {
    if (!detectorRef.current || !runningRef.current) return;
    detectorRef.current.getPitch((_, f) => {
      if (runningRef.current) {
        setFreq(f ?? 0);
        getPitch();
      }
    });
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);
      runningRef.current = true;
      setStarted(true);

      const waitForMl5 = () =>
        new Promise<void>((res) => {
          if (window.ml5) return res();
          const iv = setInterval(() => { if (window.ml5) { clearInterval(iv); res(); } }, 100);
        });
      await waitForMl5();

      const detector = window.ml5.pitchDetection(MODEL_URL, ctx, stream, () => {
        detectorRef.current = detector;
        getPitch();
        pollVolume();
      });
    } catch {
      alert("Microphone access denied or unavailable.");
    }
  };

  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  const toggle = (key: EffectKey) =>
    setActive((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Derived shader params (only floats — never change integer structural props) ──
  const vol = Math.min(volume, 0.6);
  const logFreq = freq > 0 ? Math.log2(Math.max(80, Math.min(freq, 2000)) / 80) : 0; // 0–4.64

  // Aurora: pitch → waviness, volume → intensity
  const auroraWaviness = mapClamp(logFreq, 0, 4.64, 10, 85);
  const auroraIntensity = mapClamp(vol, 0, 0.45, 8, 100);
  const auroraHeight = mapClamp(logFreq, 0, 4.64, 70, 150);

  // Plasma: volume → intensity (only visible when there's sound)
  const plasmaIntensity = mapClamp(vol, 0, 0.45, 0.2, 3.5);

  // Strands: pitch → amplitude (lineCount stays fixed at 14 — never change integer props)
  const strandsAmplitude = mapClamp(logFreq, 0, 4.64, 0.3, 3.5);

  // Particles: volume → twinkle
  const particleTwinkle = mapClamp(vol, 0, 0.45, 0.1, 1.0);

  const note = freqToNoteName(freq);
  const noteLabel = freqToNoteLabel(freq);
  const accent = NOTE_ACCENT[note] ?? "#a855f7";

  // Bloom opacity from volume
  const bloomHex = Math.round(mapClamp(vol, 0, 0.45, 0, 55)).toString(16).padStart(2, "0");

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#030308" }}>
      {/* Shader layer */}
      <Shader
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%" }}
        disableTelemetry
      >
        <Aurora
          visible={active.aurora}
          intensity={auroraIntensity}
          waviness={auroraWaviness}
          height={auroraHeight}
          rayDensity={22}
          balance={50}
        />
        <Plasma
          visible={active.plasma}
          intensity={plasmaIntensity}
          density={2.2}
          contrast={1.15}
          blendMode="screen"
        />
        <FloatingParticles
          visible={active.particles}
          particleSize={1.2}
          twinkle={particleTwinkle}
          blendMode="screen"
        />
        <Strands
          visible={active.strands}
          amplitude={strandsAmplitude}
          lineCount={14}
          blendMode="screen"
        />
        <CursorTrail visible={active.cursor} blendMode="screen" />
      </Shader>

      {/* Note colour bloom */}
      {started && freq > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(ellipse at 50% 55%, ${accent}${bloomHex} 0%, transparent 60%)`,
            transition: "background 0.12s",
          }}
        />
      )}

      {/* ── Start screen ── */}
      {!started && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
            zIndex: 200,
            fontFamily: "'Segoe UI', system-ui, sans-serif",
          }}
        >
          <p style={{
            color: "rgba(180,100,255,0.85)",
            fontSize: "0.7rem",
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            margin: 0,
          }}>
            Pitch &amp; Shaders
          </p>
          <h1 style={{
            margin: 0,
            fontSize: "clamp(1.8rem, 5vw, 3rem)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            textAlign: "center",
            background: "linear-gradient(135deg, #fff 30%, rgba(180,100,255,0.85))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Sing to the shaders
          </h1>
          <p style={{
            margin: 0,
            color: "rgba(255,255,255,0.35)",
            fontSize: "0.9rem",
            textAlign: "center",
            maxWidth: 340,
            lineHeight: 1.6,
          }}>
            Your voice bends the aurora, pulses the plasma, and stretches the strands — in real time.
          </p>
          <button
            onClick={start}
            style={{
              marginTop: "0.5rem",
              padding: "0.75rem 2.5rem",
              borderRadius: "999px",
              border: "1px solid rgba(168,85,247,0.45)",
              background: "rgba(168,85,247,0.15)",
              color: "rgba(220,180,255,0.95)",
              fontSize: "0.85rem",
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: "pointer",
              backdropFilter: "blur(12px)",
              transition: "all 0.2s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(168,85,247,0.28)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(168,85,247,0.7)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(168,85,247,0.15)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(168,85,247,0.45)";
            }}
          >
            Enable Mic
          </button>
        </div>
      )}

      {/* ── Effect toggles (bottom centre) ── */}
      {started && (
        <div style={{
          position: "fixed",
          bottom: "2rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.6rem",
        }}>
          <p style={{
            margin: 0,
            fontSize: "0.6rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.18)",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
          }}>
            Keep 3 or fewer active
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          {EFFECTS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggle(key)}
              style={{
                background: active[key] ? "rgba(168,85,247,0.18)" : "rgba(10,8,20,0.55)",
                border: active[key]
                  ? "1px solid rgba(168,85,247,0.6)"
                  : "1px solid rgba(255,255,255,0.12)",
                color: active[key] ? "rgba(220,180,255,0.95)" : "rgba(255,255,255,0.35)",
                borderRadius: "999px",
                padding: "0.4rem 1.1rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                cursor: "pointer",
                backdropFilter: "blur(12px)",
                transition: "all 0.2s",
                fontFamily: "'Segoe UI', system-ui, sans-serif",
              }}
            >
              {label}
            </button>
          ))}
          </div>
        </div>
      )}

      {/* ── Pitch readout (top centre, below nav) ── */}
      {started && (
        <div style={{
          position: "fixed",
          top: "5rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.3rem",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          pointerEvents: "none",
        }}>
          {/* Note name */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{
              fontSize: "2.4rem",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: freq > 0 ? accent : "rgba(255,255,255,0.15)",
              textShadow: freq > 0 ? `0 0 28px ${accent}99` : "none",
              transition: "color 0.1s, text-shadow 0.1s",
              lineHeight: 1,
            }}>
              {noteLabel}
            </span>
            {freq > 0 && (
              <span style={{
                fontSize: "0.72rem",
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "0.08em",
              }}>
                {Math.round(freq)} Hz
              </span>
            )}
          </div>

          {/* Volume bar */}
          <div style={{
            width: 120,
            height: 2,
            background: "rgba(255,255,255,0.07)",
            borderRadius: 99,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${Math.min(100, mapClamp(vol, 0, 0.45, 0, 100))}%`,
              background: freq > 0 ? accent : "rgba(255,255,255,0.3)",
              borderRadius: 99,
              transition: "width 0.05s, background 0.1s",
            }} />
          </div>

          <p style={{
            margin: 0,
            fontSize: "0.6rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.18)",
          }}>
            {freq > 0 ? "detecting" : "listening…"}
          </p>
        </div>
      )}
    </div>
  );
}
