import { Link } from "react-router-dom";

const cards = [
  {
    to: "/pitch",
    title: "Pitch Detection",
    desc: "Sing or play an instrument — ml5 detects the pitch in real time and drives a p5.js particle shader.",
    tag: "p5 · ml5 · WebGL",
    accent: "#a855f7",
  },
  {
    to: "/shaders",
    title: "Shader Playground",
    desc: "Explore layered WebGPU shader effects: aurora, floating particles, cursor trails and more.",
    tag: "WebGPU · shaders",
    accent: "#06b6d4",
  },
  {
    to: "/pitch-shaders",
    title: "Pitch & Shaders",
    desc: "Your voice drives the aurora, plasma, and strands — pitch bends the waves, volume fuels the glow.",
    tag: "ml5 · WebGPU · shaders",
    accent: "#f472b6",
  },
];

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07060f",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: "2rem",
        gap: "3rem",
      }}
    >
      {/* Hero */}
      <div style={{ textAlign: "center", maxWidth: 560 }}>
        <p
          style={{
            color: "rgba(180, 100, 255, 0.85)",
            fontSize: "0.75rem",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            marginBottom: "1rem",
          }}
        >
          Visual Lab
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(2.2rem, 6vw, 4rem)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            background: "linear-gradient(135deg, #fff 30%, rgba(180,100,255,0.8))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Sound &amp; Light
        </h1>
        <p
          style={{
            marginTop: "1rem",
            color: "rgba(255,255,255,0.4)",
            fontSize: "1rem",
            lineHeight: 1.6,
          }}
        >
          A pair of audio-visual experiments — real-time pitch detection meets WebGPU shader effects.
        </p>
      </div>

      {/* Cards */}
      <div
        style={{
          display: "flex",
          gap: "1.25rem",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {cards.map(({ to, title, desc, tag, accent }) => (
          <Link
            key={to}
            to={to}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                width: 260,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid rgba(255,255,255,0.08)`,
                borderRadius: "1.25rem",
                padding: "1.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                cursor: "pointer",
                transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = "translateY(-4px)";
                el.style.borderColor = `${accent}55`;
                el.style.boxShadow = `0 0 32px ${accent}22`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = "translateY(0)";
                el.style.borderColor = "rgba(255,255,255,0.08)";
                el.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: `${accent}22`,
                  border: `1px solid ${accent}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: accent,
                    boxShadow: `0 0 8px ${accent}`,
                  }}
                />
              </div>
              <h2
                style={{
                  margin: 0,
                  color: "#fff",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                {title}
              </h2>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.45)", fontSize: "0.875rem", lineHeight: 1.55 }}>
                {desc}
              </p>
              <p
                style={{
                  margin: 0,
                  color: accent,
                  fontSize: "0.7rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  opacity: 0.8,
                }}
              >
                {tag}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
