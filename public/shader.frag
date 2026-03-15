precision highp float;

uniform float volume;
uniform vec3 noteColor;
uniform vec2 resolution;
uniform int trailCount;
uniform vec2 trail[30];
uniform int particleCount;
uniform vec3 particles[70];
uniform vec3 colors[70];

void main() {
  vec2 st = gl_FragCoord.xy / resolution.xy;
  float aspect = resolution.x / resolution.y;
  st.x *= aspect;

  float r = 0.0;
  float g = 0.0;
  float b = 0.0;

  // ── Trail ─────────────────────────────────────────────────────────────────
  for (int i = 0; i < 30; i++) {
    if (i < trailCount) {
      vec2 trailPos = trail[i];
      float d = distance(st, trailPos.xy);
      float age = float(i) / 30.0;

      float size = 0.004 + volume * 0.03;

      float core = age * size / (d + 0.001);
      float halo = age / (d * d + 0.00005) * size * 0.06;

      float totalTrail = core + halo;

      r += totalTrail * (noteColor.r * 0.8 + volume * 0.9);
      g += totalTrail * (noteColor.g * 0.8 + volume * 0.01);
      b += totalTrail * (noteColor.b * 0.8 + 1.0);
    }
  }

  // ── Particles ─────────────────────────────────────────────────────────────
  float mult = 0.0003;

  for (int i = 0; i < 70; i++) {
    if (i < particleCount) {
      vec3 particle = particles[i];
      vec2 pos = particle.xy;
      float mass = particle.z;
      vec3 color = colors[i];
      float d = distance(st, pos);

      float particleGlow = 1.0 / d * mult * mass * 0.5;
      r += color.r * particleGlow;
      g += color.g * particleGlow;
      b += color.b * particleGlow;

      float whiteCore = 1.0 / (d * d + 0.0002) * mult * mass * 0.0008;
      r += whiteCore;
      g += whiteCore;
      b += whiteCore;
    }
  }

  // ── Background nebula ─────────────────────────────────────────────────────
  float nebula = 0.03 + volume * 0.08;
  r += noteColor.r * nebula * 0.5;
  g += noteColor.g * nebula * 0.5;
  b += noteColor.b * nebula * 0.5;

  // ── Vignette ──────────────────────────────────────────────────────────────
  vec2 screenCentre = vec2(0.5 * aspect, 0.5);
  float vignette = 1.0 - smoothstep(0.3, 1.1, distance(st, screenCentre));
  r *= vignette;
  g *= vignette;
  b *= vignette;

  // ── Filmic tone mapping ───────────────────────────────────────────────────
  r = r / (r + 1.0);
  g = g / (g + 1.0);
  b = b / (b + 1.0);

  gl_FragColor = vec4(r, g, b, 1.0);
}
