import { useState } from "react";
import { Shader, Aurora, FloatingParticles, CursorTrail, Plasma, Strands } from "shaders/react";

const effects = [
  { key: "aurora", label: "Aurora" },
  { key: "plasma", label: "Plasma" },
  { key: "particles", label: "Particles" },
  { key: "strands", label: "Strands" },
  { key: "cursor", label: "Cursor Trail" },
] as const;

type EffectKey = (typeof effects)[number]["key"];

export default function ShaderPlayground() {
  const [active, setActive] = useState<Record<EffectKey, boolean>>({
    aurora: true,
    plasma: false,
    particles: true,
    strands: false,
    cursor: true,
  });

  const toggle = (key: EffectKey) =>
    setActive((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#030308" }}>
      {/* Full-screen shader canvas */}
      <Shader
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%" }}
        disableTelemetry
      >
        <Aurora
          visible={active.aurora}
          intensity={90}
          waviness={60}
          rayDensity={25}
          height={130}
          balance={50}
        />
        <Plasma
          visible={active.plasma}
          density={2.5}
          intensity={2}
          contrast={1.2}
          blendMode="screen"
        />
        <FloatingParticles
          visible={active.particles}
          particleSize={1.2}
          twinkle={0.7}
          blendMode="screen"
        />
        <Strands
          visible={active.strands}
          amplitude={1.5}
          lineCount={16}
          blendMode="screen"
        />
        <CursorTrail visible={active.cursor} blendMode="screen" />
      </Shader>

      {/* UI overlay */}
      <div
        style={{
          position: "fixed",
          bottom: "2rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {effects.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            style={{
              background: active[key] ? "rgba(6, 182, 212, 0.18)" : "rgba(10, 8, 20, 0.55)",
              border: active[key]
                ? "1px solid rgba(6, 182, 212, 0.6)"
                : "1px solid rgba(255,255,255,0.12)",
              color: active[key] ? "rgba(165, 243, 252, 0.95)" : "rgba(255,255,255,0.35)",
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

      {/* Hint */}
      <p
        style={{
          position: "fixed",
          top: "5rem",
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.18)",
          fontSize: "0.7rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        Move your cursor · Toggle effects below
      </p>
    </div>
  );
}
