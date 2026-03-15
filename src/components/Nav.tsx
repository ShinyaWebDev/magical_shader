import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Home" },
  { to: "/pitch", label: "Pitch" },
  { to: "/shaders", label: "Shaders" },
  { to: "/pitch-shaders", label: "Pitch & Shaders" },
];

export default function Nav() {
  return (
    <nav
      style={{
        position: "fixed",
        top: "1.25rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        gap: "0.25rem",
        background: "rgba(10, 8, 18, 0.55)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(180, 100, 255, 0.18)",
        borderRadius: "999px",
        padding: "0.35rem 0.5rem",
      }}
    >
      {links.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          style={({ isActive }) => ({
            color: isActive ? "rgba(220, 180, 255, 1)" : "rgba(200, 180, 220, 0.55)",
            background: isActive ? "rgba(160, 80, 255, 0.22)" : "transparent",
            border: "none",
            borderRadius: "999px",
            padding: "0.35rem 1.1rem",
            fontSize: "0.8rem",
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            textDecoration: "none",
            transition: "color 0.2s, background 0.2s",
            cursor: "pointer",
          })}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
