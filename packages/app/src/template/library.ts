export type File = {
  path: string
  content: string
}

export type Part = {
  id: string
  name: string
  description: string
  selectors: string[]
  files: string[]
  hint?: string
}

export type Template = {
  id: string
  name: string
  description: string
  stack: string
  thumb?: string
  preview: string
  files: File[]
  parts: Part[]
}

/* =====================================================================
   Landing Page Starter (React + custom CSS)
   ===================================================================== */

const app = `import { useMemo, useState } from "react"
import "./styles.css"

const items = [
  {
    icon: "bolt",
    title: "One clear value story",
    text: "Frame your product so the first ten seconds feel obvious and unforgettable.",
  },
  {
    icon: "chart",
    title: "Built-in social proof",
    text: "Weave metrics, trust markers, and visual rhythm into a page that radiates credibility.",
  },
  {
    icon: "target",
    title: "Conversion-first CTA",
    text: "Keep the next action visible at every scroll point — hero, pricing, and closing.",
  },
]

const logos = ["Vercel", "Linear", "Raycast", "Resend", "Supabase"]

export default function App() {
  const [open, setOpen] = useState(false)
  const stats = useMemo(
    () => [
      { label: "launches shipped", value: "124+" },
      { label: "lift in signups", value: "38%" },
      { label: "teams building", value: "42" },
    ],
    [],
  )

  return (
    <div className="shell">
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />

      <header className="nav">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">__PADDIE_TEMPLATE_NAME__</span>
        </div>
        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#proof">Proof</a>
          <a href="#cta">Start</a>
        </nav>
        <button className="primary sm" onClick={() => setOpen(true)}>
          Book demo
        </button>
      </header>

      <main className="page">
        <section className="hero" id="hero">
          <div className="hero-copy">
            <div className="badge">
              <span className="badge-dot" />
              New release — v2.4 just shipped
            </div>
            <h1>
              Launch a sharper landing page{" "}
              <span className="gradient-text">without rebuilding</span>{" "}
              your stack.
            </h1>
            <p className="lede">
              This starter combines narrative structure, modern spacing, and a strong CTA so teams can go from blank
              canvas to publishable page in minutes — not months.
            </p>
            <div className="hero-actions">
              <button className="primary lg">
                Start free
                <svg className="btn-icon" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button className="ghost lg" onClick={() => setOpen(true)}>
                See the modal
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-card">
              <div className="card-head">
                <span className="pill">
                  <span className="pill-dot" />
                  Campaign stack
                </span>
                <span className="muted sm-text">Updated 2m ago</span>
              </div>
              <div className="card-grid">
                <div className="card-item">
                  <div className="card-item-icon icon-msg" />
                  <div>
                    <strong>Messaging</strong>
                    <p>Sharper value prop for conversion-focused pages.</p>
                  </div>
                </div>
                <div className="card-item">
                  <div className="card-item-icon icon-ui" />
                  <div>
                    <strong>UI kit</strong>
                    <p>Token-ready sections with bolder hierarchy.</p>
                  </div>
                </div>
                <div className="card-item">
                  <div className="card-item-icon icon-loop" />
                  <div>
                    <strong>Preview loop</strong>
                    <p>Fast code-preview-assistant iteration.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="hero-metrics" id="proof">
              {stats.map((item) => (
                <div className="metric" key={item.label}>
                  <span className="metric-value">{item.value}</span>
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="trust">
          <p className="trust-label">Trusted by forward-thinking teams</p>
          <div className="trust-logos">
            {logos.map((name) => (
              <span className="trust-logo" key={name}>{name}</span>
            ))}
          </div>
        </section>

        <section className="features" id="features">
          <div className="section-head">
            <p className="eyebrow">Features</p>
            <h2 className="section-title">Everything you need to ship faster</h2>
            <p className="section-sub">Three patterns that turn a blank page into a high-converting landing experience.</p>
          </div>
          <div className="features-grid">
            {items.map((item) => (
              <article className="feature" key={item.title}>
                <div className={"feature-icon fi-" + item.icon} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cta" id="cta">
          <p className="eyebrow">Ready to launch?</p>
          <h2>Turn this template into your own product page with the assistant.</h2>
          <button className="primary lg wide">
            Generate my first draft
            <svg className="btn-icon" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </section>
      </main>

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">Template modal</p>
                <h3>Schedule a guided onboarding run</h3>
              </div>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="modal-copy">
              Use this modal as a reference for layout, spacing, and content grouping when you ask the assistant to
              adapt it into your own project.
            </p>
            <div className="modal-actions">
              <button className="primary">Confirm</button>
              <button className="ghost sm" onClick={() => setOpen(false)}>
                Maybe later
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
`

const css = `:root {
  color-scheme: dark;
  --bg: #060810;
  --surface: rgba(12, 15, 28, 0.55);
  --surface-strong: rgba(18, 22, 40, 0.85);
  --border: rgba(255, 255, 255, 0.06);
  --border-hover: rgba(255, 255, 255, 0.12);
  --text: #eef0f6;
  --muted: #6b7394;
  --accent: #818cf8;
  --accent-2: #22d3ee;
  --accent-soft: rgba(129, 140, 248, 0.1);
  font-family: "Inter", -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  overflow-x: hidden;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  font: inherit;
  cursor: pointer;
}

html.__paddie_template_pick,
html.__paddie_template_pick * {
  cursor: crosshair !important;
}

.__paddie_template_target {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.shell {
  position: relative;
  min-height: 100vh;
  padding: 24px;
}

.orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(120px);
  pointer-events: none;
  z-index: 0;
  animation: orb-float 20s ease-in-out infinite;
}

.orb-1 {
  width: 600px;
  height: 600px;
  top: -12%;
  left: -8%;
  background: rgba(99, 102, 241, 0.15);
}

.orb-2 {
  width: 500px;
  height: 500px;
  top: 40%;
  right: -8%;
  background: rgba(34, 211, 238, 0.08);
  animation-delay: -7s;
}

.orb-3 {
  width: 400px;
  height: 400px;
  bottom: -10%;
  left: 30%;
  background: rgba(168, 85, 247, 0.07);
  animation-delay: -14s;
}

@keyframes orb-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.05); }
  66% { transform: translate(-20px, 15px) scale(0.95); }
}

.nav {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  max-width: 1120px;
  margin: 0 auto;
  padding: 12px 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(8, 10, 20, 0.7);
  backdrop-filter: blur(20px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: -0.01em;
}

.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: linear-gradient(135deg, #818cf8, #22d3ee);
  flex-shrink: 0;
}

.brand-name {
  white-space: nowrap;
}

.nav-links {
  display: flex;
  gap: 28px;
  font-size: 0.875rem;
  color: var(--muted);
}

.nav-links a {
  transition: color 0.2s;
}

.nav-links a:hover {
  color: var(--text);
}

.primary,
.ghost {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 18px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.primary {
  background: linear-gradient(135deg, #818cf8, #6366f1);
  color: #fff;
  box-shadow:
    0 0 20px rgba(99, 102, 241, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.primary:hover {
  transform: translateY(-1px);
  box-shadow:
    0 0 30px rgba(99, 102, 241, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.ghost {
  background: var(--accent-soft);
  border-color: rgba(129, 140, 248, 0.2);
  color: var(--text);
}

.ghost:hover {
  border-color: rgba(129, 140, 248, 0.35);
  background: rgba(129, 140, 248, 0.15);
  transform: translateY(-1px);
}

.sm {
  height: 36px;
  padding: 0 14px;
  font-size: 0.8125rem;
}

.lg {
  height: 48px;
  padding: 0 24px;
  font-size: 0.9375rem;
  border-radius: 12px;
}

.wide {
  min-width: 240px;
  justify-content: center;
}

.btn-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  transition: all 0.2s;
  flex-shrink: 0;
}

.icon-btn:hover {
  color: var(--text);
  border-color: var(--border-hover);
}

.icon-btn svg {
  width: 14px;
  height: 14px;
}

.page {
  position: relative;
  z-index: 1;
  max-width: 1120px;
  margin: 48px auto 0;
  display: grid;
  gap: 80px;
}

.hero {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 32px;
  align-items: start;
}

.hero-copy {
  padding-top: 32px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--accent-soft);
  border: 1px solid rgba(129, 140, 248, 0.15);
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 28px;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.hero-copy h1 {
  font-family: "Space Grotesk", -apple-system, sans-serif;
  font-size: clamp(2.8rem, 5vw, 4.2rem);
  line-height: 1.05;
  letter-spacing: -0.035em;
  font-weight: 700;
  margin: 0;
}

.gradient-text {
  background: linear-gradient(135deg, #818cf8, #22d3ee);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.lede {
  margin-top: 20px;
  font-size: 1.05rem;
  line-height: 1.7;
  color: var(--muted);
  max-width: 48ch;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 32px;
}

.hero-visual {
  display: grid;
  gap: 14px;
}

.hero-card {
  position: relative;
  padding: 24px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
  backdrop-filter: blur(16px);
  overflow: hidden;
}

.hero-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 20%;
  right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.5), rgba(34, 211, 238, 0.3), transparent);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(34, 211, 238, 0.1);
  color: var(--accent-2);
  font-size: 0.75rem;
  font-weight: 500;
}

.pill-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent-2);
}

.sm-text {
  font-size: 0.8125rem;
}

.card-grid {
  display: grid;
  gap: 10px;
}

.card-item {
  display: flex;
  gap: 14px;
  padding: 14px;
  border-radius: 14px;
  background: var(--surface-strong);
  border: 1px solid rgba(255, 255, 255, 0.03);
  transition: border-color 0.2s;
}

.card-item:hover {
  border-color: var(--border-hover);
}

.card-item-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.icon-msg {
  background: linear-gradient(135deg, rgba(129, 140, 248, 0.25), rgba(129, 140, 248, 0.05));
}

.icon-ui {
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.25), rgba(34, 211, 238, 0.05));
}

.icon-loop {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(168, 85, 247, 0.05));
}

.card-item strong {
  font-size: 0.875rem;
}

.card-item p {
  font-size: 0.8125rem;
  color: var(--muted);
  line-height: 1.5;
  margin: 2px 0 0;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.metric {
  padding: 16px;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  backdrop-filter: blur(16px);
  text-align: center;
  transition: border-color 0.2s;
}

.metric:hover {
  border-color: var(--border-hover);
}

.metric-value {
  display: block;
  font-family: "Space Grotesk", -apple-system, sans-serif;
  font-size: 1.6rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--text), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.metric small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 0.75rem;
}

.trust {
  text-align: center;
  padding: 10px 0;
}

.trust-label {
  font-size: 0.8125rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0 0 24px;
}

.trust-logos {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 40px;
}

.trust-logo {
  font-size: 1.05rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.12);
  letter-spacing: 0.02em;
  transition: color 0.3s;
}

.trust-logo:hover {
  color: rgba(255, 255, 255, 0.3);
}

.features {
  text-align: center;
}

.eyebrow {
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin: 0 0 12px;
}

.section-head {
  margin-bottom: 48px;
}

.section-title {
  font-family: "Space Grotesk", -apple-system, sans-serif;
  font-size: clamp(1.8rem, 3.5vw, 2.6rem);
  letter-spacing: -0.03em;
  font-weight: 700;
  line-height: 1.15;
  margin: 0;
}

.section-sub {
  margin: 12px auto 0;
  color: var(--muted);
  font-size: 1rem;
  line-height: 1.6;
  max-width: 52ch;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.feature {
  position: relative;
  padding: 32px 28px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
  backdrop-filter: blur(16px);
  text-align: left;
  overflow: hidden;
  transition: all 0.3s ease;
}

.feature::before {
  content: "";
  position: absolute;
  top: 0;
  left: 20%;
  right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.4), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}

.feature:hover {
  border-color: var(--border-hover);
  transform: translateY(-3px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 40px rgba(99, 102, 241, 0.05);
}

.feature:hover::before {
  opacity: 1;
}

.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  margin-bottom: 20px;
}

.fi-bolt {
  background: linear-gradient(135deg, rgba(250, 204, 21, 0.2), rgba(250, 204, 21, 0.05));
}

.fi-chart {
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.05));
}

.fi-target {
  background: linear-gradient(135deg, rgba(129, 140, 248, 0.2), rgba(129, 140, 248, 0.05));
}

.feature h3 {
  font-family: "Space Grotesk", -apple-system, sans-serif;
  font-size: 1.2rem;
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}

.feature p {
  color: var(--muted);
  line-height: 1.6;
  font-size: 0.9rem;
  margin: 0;
}

.cta {
  position: relative;
  text-align: center;
  padding: 64px 40px;
  border-radius: 24px;
  border: 1px solid var(--border);
  background: var(--surface);
  backdrop-filter: blur(16px);
  overflow: hidden;
}

.cta::before {
  content: "";
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle at center, rgba(99, 102, 241, 0.06), transparent 50%);
  pointer-events: none;
}

.cta::after {
  content: "";
  position: absolute;
  top: 0;
  left: 15%;
  right: 15%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.4), rgba(34, 211, 238, 0.2), transparent);
}

.cta .eyebrow {
  position: relative;
}

.cta h2 {
  position: relative;
  font-family: "Space Grotesk", -apple-system, sans-serif;
  font-size: clamp(1.8rem, 3.5vw, 2.8rem);
  letter-spacing: -0.03em;
  line-height: 1.1;
  max-width: 16ch;
  margin: 12px auto 32px;
}

.cta .primary {
  position: relative;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(3, 4, 8, 0.7);
  backdrop-filter: blur(16px);
  z-index: 100;
  animation: fadeIn 0.2s ease;
}

.modal-backdrop[hidden] {
  display: none;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  width: min(520px, 100%);
  padding: 28px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface-strong);
  backdrop-filter: blur(20px);
  box-shadow: 0 40px 100px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.25s ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.modal-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}

.modal h3 {
  font-family: "Space Grotesk", -apple-system, sans-serif;
  font-size: 1.5rem;
  letter-spacing: -0.02em;
  margin: 6px 0 0;
}

.modal-copy {
  margin: 16px 0 0;
  color: var(--muted);
  line-height: 1.7;
  font-size: 0.9375rem;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}

.muted {
  color: var(--muted);
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .hero-metrics {
    grid-template-columns: repeat(3, 1fr);
  }

  .nav {
    flex-wrap: wrap;
  }

  .page {
    gap: 56px;
  }
}

@media (max-width: 640px) {
  .shell {
    padding: 16px;
  }

  .hero-metrics {
    grid-template-columns: 1fr;
  }

  .trust-logos {
    gap: 24px;
  }

  .cta {
    padding: 40px 24px;
  }

  .nav-links {
    display: none;
  }
}
`

const preview = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Paddie Studio Template</title>
    <style>${css}</style>
  </head>
  <body data-paddie-template="true">
    <div class="shell">
      <div class="orb orb-1" aria-hidden="true"></div>
      <div class="orb orb-2" aria-hidden="true"></div>
      <div class="orb orb-3" aria-hidden="true"></div>
      <header class="nav" data-template-part="nav">
        <div class="brand">
          <span class="brand-mark"></span>
          <span class="brand-name">Paddie Landing</span>
        </div>
        <nav class="nav-links">
          <a href="#features">Features</a>
          <a href="#proof">Proof</a>
          <a href="#cta">Start</a>
        </nav>
        <button class="primary sm" data-template-part="button" data-template-open="modal">Book demo</button>
      </header>
      <main class="page">
        <section class="hero" id="hero" data-template-part="hero">
          <div class="hero-copy">
            <div class="badge"><span class="badge-dot"></span> New release — v2.4 just shipped</div>
            <h1>Launch a sharper landing page <span class="gradient-text">without rebuilding</span> your stack.</h1>
            <p class="lede">This starter combines narrative structure, modern spacing, and a strong CTA so teams can go from blank canvas to publishable page in minutes — not months.</p>
            <div class="hero-actions">
              <button class="primary lg" data-template-part="button">Start free <svg class="btn-icon" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button class="ghost lg" data-template-part="modal" data-template-open="modal">See the modal</button>
            </div>
          </div>
          <div class="hero-visual">
            <div class="hero-card">
              <div class="card-head">
                <span class="pill"><span class="pill-dot"></span> Campaign stack</span>
                <span class="muted sm-text">Updated 2m ago</span>
              </div>
              <div class="card-grid">
                <div class="card-item"><div class="card-item-icon icon-msg"></div><div><strong>Messaging</strong><p>Sharper value prop for conversion-focused pages.</p></div></div>
                <div class="card-item"><div class="card-item-icon icon-ui"></div><div><strong>UI kit</strong><p>Token-ready sections with bolder hierarchy.</p></div></div>
                <div class="card-item"><div class="card-item-icon icon-loop"></div><div><strong>Preview loop</strong><p>Fast code-preview-assistant iteration.</p></div></div>
              </div>
            </div>
            <div class="hero-metrics" id="proof" data-template-part="metrics">
              <div class="metric"><span class="metric-value">124+</span><small>launches shipped</small></div>
              <div class="metric"><span class="metric-value">38%</span><small>lift in signups</small></div>
              <div class="metric"><span class="metric-value">42</span><small>teams building</small></div>
            </div>
          </div>
        </section>
        <section class="trust">
          <p class="trust-label">Trusted by forward-thinking teams</p>
          <div class="trust-logos">
            <span class="trust-logo">Vercel</span><span class="trust-logo">Linear</span><span class="trust-logo">Raycast</span><span class="trust-logo">Resend</span><span class="trust-logo">Supabase</span>
          </div>
        </section>
        <section class="features" id="features" data-template-part="features">
          <div class="section-head">
            <p class="eyebrow">Features</p>
            <h2 class="section-title">Everything you need to ship faster</h2>
            <p class="section-sub">Three patterns that turn a blank page into a high-converting landing experience.</p>
          </div>
          <div class="features-grid">
            <article class="feature"><div class="feature-icon fi-bolt"></div><h3>One clear value story</h3><p>Frame your product so the first ten seconds feel obvious and unforgettable.</p></article>
            <article class="feature"><div class="feature-icon fi-chart"></div><h3>Built-in social proof</h3><p>Weave metrics, trust markers, and visual rhythm into a page that radiates credibility.</p></article>
            <article class="feature"><div class="feature-icon fi-target"></div><h3>Conversion-first CTA</h3><p>Keep the next action visible at every scroll point — hero, pricing, and closing.</p></article>
          </div>
        </section>
        <section class="cta" id="cta" data-template-part="cta">
          <p class="eyebrow">Ready to launch?</p>
          <h2>Turn this template into your own product page with the assistant.</h2>
          <button class="primary lg wide" data-template-part="button">Generate my first draft <svg class="btn-icon" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </section>
      </main>
      <div class="modal-backdrop" data-template-part="modal" data-template-modal hidden>
        <div class="modal">
          <div class="modal-head">
            <div><p class="eyebrow">Template modal</p><h3>Schedule a guided onboarding run</h3></div>
            <button class="icon-btn" data-template-close="modal"><svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
          </div>
          <p class="modal-copy">Use this modal as a reference for grouped content and action layout.</p>
          <div class="modal-actions">
            <button class="primary" data-template-close="modal">Confirm</button>
            <button class="ghost sm" data-template-close="modal">Maybe later</button>
          </div>
        </div>
      </div>
    </div>
    <script>
      (() => {
        const post = (type, payload = {}) => parent.postMessage({ source: "paddie-studio-template", type, payload }, "*")
        const esc = window.CSS && CSS.escape ? CSS.escape.bind(CSS) : (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&")
        const root = document.documentElement
        const modal = document.querySelector("[data-template-modal]")
        let on = false
        let last
        const ok = (el) => el instanceof Element && !["HTML", "BODY", "SCRIPT", "STYLE", "LINK", "META"].includes(el.tagName)
        const find = (target) => {
          if (!(target instanceof Element)) return
          const hit = target.closest("*")
          if (!ok(hit)) return
          return hit
        }
        const part = (el) => el.closest("[data-template-part]")?.getAttribute("data-template-part") || undefined
        const nth = (el) => {
          const parent = el.parentElement
          if (!parent) return ""
          const list = Array.from(parent.children).filter((item) => item.tagName === el.tagName)
          if (list.length <= 1) return ""
          return ":nth-of-type(" + (list.indexOf(el) + 1) + ")"
        }
        const cls = (el) => {
          const list = Array.from(el.classList).slice(0, 2)
          if (list.length === 0) return ""
          return list.map((item) => "." + esc(item)).join("")
        }
        const line = (el) => {
          let out = el.tagName.toLowerCase()
          if (el.id) out += "#" + el.id
          const list = Array.from(el.classList).slice(0, 2)
          if (list.length) out += "." + list.join(".")
          return out
        }
        const path = (el) => {
          const out = []
          let cur = el
          while (ok(cur)) {
            let item = cur.tagName.toLowerCase()
            if (cur.id) {
              out.unshift(item + "#" + esc(cur.id))
              break
            }
            item += cls(cur) + nth(cur)
            out.unshift(item)
            cur = cur.parentElement
          }
          return out.join(" > ")
        }
        const text = (el) => (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 240)
        const mark = (node) => {
          if (last === node) return
          if (last) last.classList.remove("__paddie_template_target")
          last = node
          if (node) node.classList.add("__paddie_template_target")
        }
        const set = (next) => {
          on = next
          root.classList.toggle("__paddie_template_pick", on)
          if (!on) mark(null)
        }
        const show = () => { if (modal instanceof HTMLElement) modal.hidden = false }
        const hide = () => { if (modal instanceof HTMLElement) modal.hidden = true }
        document.querySelectorAll("[data-template-open=modal]").forEach((node) => { node.addEventListener("click", () => { if (!on) show() }) })
        document.querySelectorAll("[data-template-close=modal]").forEach((node) => { node.addEventListener("click", () => { if (!on) hide() }) })
        if (modal instanceof HTMLElement) { modal.addEventListener("click", (event) => { if (!on && event.target === modal) hide() }) }
        document.addEventListener("mousemove", (event) => { if (!on) return; mark(find(event.target)) }, true)
        document.addEventListener("click", (event) => {
          if (!on) return
          const node = find(event.target)
          if (!node) return
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()
          post("pick", { id: part(node), selector: path(node), label: line(node), text: text(node) || undefined, html: (node.outerHTML || "").replace(/\\s+/g, " ").trim().slice(0, 4000) })
        }, true)
        document.addEventListener("keydown", (event) => { if (!on || event.key !== "Escape") return; event.preventDefault(); event.stopPropagation(); set(false); post("cancel") }, true)
        window.addEventListener("message", (event) => { if (event.source !== parent) return; const data = event.data; if (!data || typeof data !== "object" || data.source !== "paddie-studio-template-host" || data.type !== "pick") return; set(Boolean(data.active)) })
        post("ready")
      })()
    </script>
  </body>
</html>
`

const files = [
  {
    path: "package.json",
    content: `{
  "name": "__PADDIE_TEMPLATE_SLUG__",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.4",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.1.4",
    "typescript": "^5.7.2",
    "vite": "^6.1.0"
  }
}`,
  },
  {
    path: "index.html",
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>__PADDIE_TEMPLATE_NAME__</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
  },
  {
    path: "tsconfig.json",
    content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": []
}`,
  },
  {
    path: "vite.config.ts",
    content: `import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
})`,
  },
  {
    path: "src/main.tsx",
    content: `import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
  },
  { path: "src/App.tsx", content: app },
  { path: "src/styles.css", content: css },
] satisfies File[]

/* =====================================================================
   AI Landing (React + Tailwind)
   ===================================================================== */

const aiApp = `import "./styles.css"

const testimonials = [
  {
    name: "John Doe",
    role: "CEO of Something",
    image: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1700&q=80",
    quote: "This is a no-brainer if you want to take your business to the next level. If you are looking for the ultimate toolset, this is it!",
  },
  {
    name: "Jane Doe",
    role: "CTO of Business",
    image: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=2547&q=80",
    quote: "Thanks for creating this service. My life is so much easier. Thanks for making such a great product.",
  },
  {
    name: "John Smith",
    role: "Creator of Stuff",
    image: "https://images.unsplash.com/photo-1545167622-3a6ac756afa4?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1256&q=80",
    quote: "Packed with awesome content and exactly what I was looking for. I would highly recommend this to anyone.",
  },
]

const plans = [
  { name: "Basic", price: "$19", desc: "The basic plan is a good fit for smaller teams and startups", featured: false },
  { name: "Plus", price: "$39", desc: "The plus plan is a good fit for medium-size to larger companies", featured: true },
  { name: "Pro", price: "$59", desc: "The pro plan is a good fit for larger and enterprise companies.", featured: false },
]

const footerLinks = ["About", "Blog", "Team", "Pricing", "Contact", "Terms"]

function Check() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 mr-2 text-white bg-yellow-300 rounded-full">
      <span className="text-sm font-bold">\\u2713</span>
    </span>
  )
}

export default function App() {
  return (
    <>
      <section className="w-full px-8 text-gray-700 bg-white">
        <div className="container flex flex-col flex-wrap items-center justify-between py-5 mx-auto md:flex-row max-w-7xl">
          <div className="relative flex flex-col md:flex-row">
            <a href="#" className="flex items-center mb-5 font-medium text-gray-900 lg:w-auto lg:items-center lg:justify-center md:mb-0">
              <span className="mx-auto text-xl font-black leading-none text-gray-900 select-none">__PADDIE_TEMPLATE_NAME__</span>
            </a>
            <nav className="flex flex-wrap items-center mb-5 text-base md:mb-0 md:pl-8 md:ml-8 md:border-l md:border-gray-200">
              <a href="#" className="mr-5 font-medium leading-6 text-gray-600 hover:text-gray-900">Home</a>
              <a href="#" className="mr-5 font-medium leading-6 text-gray-600 hover:text-gray-900">Features</a>
              <a href="#" className="mr-5 font-medium leading-6 text-gray-600 hover:text-gray-900">Pricing</a>
              <a href="#" className="mr-5 font-medium leading-6 text-gray-600 hover:text-gray-900">Blog</a>
            </nav>
          </div>
          <div className="inline-flex items-center ml-5 space-x-6 lg:justify-end">
            <a href="#" className="text-base font-medium leading-6 text-gray-600 whitespace-nowrap transition duration-150 ease-in-out hover:text-gray-900">Sign in</a>
            <a href="#" className="inline-flex items-center justify-center px-4 py-2 text-base font-medium leading-6 text-white whitespace-nowrap bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">Sign up</a>
          </div>
        </div>
      </section>

      <section className="px-2 py-32 bg-white md:px-0">
        <div className="container items-center max-w-6xl px-8 mx-auto xl:px-5">
          <div className="flex flex-wrap items-center sm:-mx-3">
            <div className="w-full md:w-1/2 md:px-3">
              <div className="w-full pb-6 space-y-6 sm:max-w-md lg:max-w-lg md:space-y-4 lg:space-y-8 xl:space-y-9 sm:pr-5 lg:pr-0 md:pb-0">
                <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-4xl lg:text-5xl xl:text-6xl">
                  <span className="block xl:inline">Useful Tools to</span>
                  <span className="block text-indigo-600 xl:inline"> Help You Build Faster.</span>
                </h1>
                <p className="mx-auto text-base text-gray-500 sm:max-w-md lg:text-xl md:max-w-3xl">
                  It's never been easier to build beautiful websites that convey your message and tell your story.
                </p>
                <div className="relative flex flex-col sm:flex-row sm:space-x-4">
                  <a href="#" className="flex items-center w-full px-6 py-3 mb-3 text-lg text-white bg-indigo-600 rounded-md sm:mb-0 hover:bg-indigo-700 sm:w-auto">
                    Try It Free
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </a>
                  <a href="#" className="flex items-center px-6 py-3 text-gray-500 bg-gray-100 rounded-md hover:bg-gray-200 hover:text-gray-600">Learn More</a>
                </div>
              </div>
            </div>
            <div className="w-full md:w-1/2">
              <div className="w-full h-auto overflow-hidden rounded-md shadow-xl sm:rounded-xl">
                <img src="https://images.unsplash.com/photo-1498049860654-af1a5c566876?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1050&q=80" alt="Developer workspace" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full bg-white pt-7 pb-7 md:pt-20 md:pb-24">
        <div className="box-border flex flex-col items-center content-center px-8 mx-auto leading-6 text-black border-0 border-gray-300 border-solid md:flex-row max-w-7xl lg:px-16">
          <div className="box-border relative w-full max-w-md px-4 mt-5 mb-4 -ml-5 text-center bg-no-repeat bg-contain border-solid md:ml-0 md:mt-0 md:max-w-none lg:mb-0 md:w-1/2 xl:pl-10">
            <img src="https://cdn.devdojo.com/images/december2020/productivity.png" className="p-2 pl-6 pr-5 xl:pl-16 xl:pr-20" alt="Productivity illustration" />
          </div>
          <div className="box-border order-first w-full text-black border-solid md:w-1/2 md:pl-10 md:order-none">
            <h2 className="m-0 text-xl font-semibold leading-tight border-0 border-gray-300 lg:text-3xl md:text-2xl">Boost Productivity</h2>
            <p className="pt-4 pb-8 m-0 leading-7 text-gray-700 border-0 border-gray-300 sm:pr-12 xl:pr-32 lg:text-lg">Build an atmosphere that creates productivity in your organization and your company culture.</p>
            <ul className="p-0 m-0 leading-6 border-0 border-gray-300">
              <li className="box-border relative py-1 pl-0 text-left text-gray-500 border-solid"><Check />Maximize productivity and growth</li>
              <li className="box-border relative py-1 pl-0 text-left text-gray-500 border-solid"><Check />Speed past your competition</li>
              <li className="box-border relative py-1 pl-0 text-left text-gray-500 border-solid"><Check />Learn the top techniques</li>
            </ul>
          </div>
        </div>

        <div className="box-border flex flex-col items-center content-center px-8 mx-auto mt-2 leading-6 text-black border-0 border-gray-300 border-solid md:mt-20 xl:mt-0 md:flex-row max-w-7xl lg:px-16">
          <div className="box-border w-full text-black border-solid md:w-1/2 md:pl-6 xl:pl-32">
            <h2 className="m-0 text-xl font-semibold leading-tight border-0 border-gray-300 lg:text-3xl md:text-2xl">Automated Tasks</h2>
            <p className="pt-4 pb-8 m-0 leading-7 text-gray-700 border-0 border-gray-300 sm:pr-10 lg:text-lg">Save time and money with our revolutionary services. We are the leaders in the industry.</p>
            <ul className="p-0 m-0 leading-6 border-0 border-gray-300">
              <li className="box-border relative py-1 pl-0 text-left text-gray-500 border-solid"><Check />Automated task management workflow</li>
              <li className="box-border relative py-1 pl-0 text-left text-gray-500 border-solid"><Check />Detailed analytics for your data</li>
              <li className="box-border relative py-1 pl-0 text-left text-gray-500 border-solid"><Check />Some awesome integrations</li>
            </ul>
          </div>
          <div className="box-border relative w-full max-w-md px-4 mt-10 mb-4 text-center bg-no-repeat bg-contain border-solid md:mt-0 md:max-w-none lg:mb-0 md:w-1/2">
            <img src="https://cdn.devdojo.com/images/december2020/settings.png" className="pl-4 sm:pr-10 xl:pl-10 lg:pr-32" alt="Automation illustration" />
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="container items-center max-w-6xl px-4 px-10 mx-auto sm:px-20 md:px-32 lg:px-16">
          <div className="flex flex-wrap items-center -mx-3">
            <div className="order-1 w-full px-3 lg:w-1/2 lg:order-0">
              <div className="w-full lg:max-w-md">
                <h2 className="mb-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl font-heading">Jam-packed with all the tools you need to succeed!</h2>
                <p className="mb-4 font-medium tracking-tight text-gray-400 xl:mb-6">It's never been easier to build a business of your own. Our tools will help you with the following:</p>
                <ul>
                  <li className="flex items-center py-2 space-x-4 xl:py-3">
                    <svg className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                    <span className="font-medium text-gray-500">Faster Processing and Delivery</span>
                  </li>
                  <li className="flex items-center py-2 space-x-4 xl:py-3">
                    <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    <span className="font-medium text-gray-500">Out of the Box Tracking and Monitoring</span>
                  </li>
                  <li className="flex items-center py-2 space-x-4 xl:py-3">
                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    <span className="font-medium text-gray-500">100% Protection and Security for Your App</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="w-full px-3 mb-12 lg:w-1/2 order-0 lg:order-1 lg:mb-0">
              <img className="mx-auto sm:max-w-sm lg:max-w-full" src="https://cdn.devdojo.com/images/november2020/feature-graphic.png" alt="Feature graphic" />
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center py-20 bg-white min-w-screen">
        <div className="px-16 bg-white">
          <div className="container flex flex-col items-start mx-auto lg:items-center">
            <p className="relative flex items-start justify-start w-full text-lg font-bold tracking-wider text-purple-500 uppercase lg:justify-center lg:items-center">Don't just take our word for it</p>
            <h2 className="relative flex items-start justify-start w-full max-w-3xl text-5xl font-bold lg:justify-center">See what others are saying</h2>
            <div className="block w-full h-0.5 max-w-lg mt-6 bg-purple-100 rounded-full" />
            <div className="items-center justify-center w-full mt-12 mb-4 lg:flex">
              {testimonials.map((t, i) => (
                <div key={t.name} className={"flex flex-col items-start justify-start w-full h-auto mb-12 lg:w-1/3 lg:mb-0" + (i === 1 ? " px-0 mx-0 border-l border-r border-transparent lg:px-8 lg:mx-8 lg:border-gray-200" : "")}>
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 mr-4 overflow-hidden bg-gray-200 rounded-full">
                      <img src={t.image} className="object-cover w-full h-full" alt={t.name} />
                    </div>
                    <div className="flex flex-col items-start justify-center">
                      <h4 className="font-bold text-gray-800">{t.name}</h4>
                      <p className="text-gray-600">{t.role}</p>
                    </div>
                  </div>
                  <blockquote className="mt-8 text-lg text-gray-500">"{t.quote}"</blockquote>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="box-border py-8 leading-7 text-gray-900 bg-white border-0 border-gray-200 border-solid sm:py-12 md:py-16 lg:py-24">
        <div className="box-border max-w-6xl px-4 pb-12 mx-auto border-solid sm:px-6 md:px-6 lg:px-4">
          <div className="flex flex-col items-center leading-7 text-center text-gray-900">
            <h2 className="box-border m-0 text-3xl font-semibold leading-tight tracking-tight text-black border-solid sm:text-4xl md:text-5xl">Pricing Options</h2>
            <p className="box-border mt-4 text-2xl leading-normal text-gray-900 border-solid">We've got a plan for companies of any size</p>
          </div>
          <div className="grid max-w-md mx-auto mt-6 overflow-hidden leading-7 text-gray-900 border border-b-4 border-gray-300 border-blue-600 rounded-xl md:max-w-lg lg:max-w-none sm:mt-10 lg:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.name} className={"box-border px-4 py-8 mb-6 text-center border-solid lg:mb-0 sm:px-4 sm:py-8 md:px-8 md:py-12 lg:px-10" + (plan.featured ? " bg-gray-100 border border-gray-300" : " bg-white")}>
                <h3 className="m-0 text-2xl font-semibold leading-tight tracking-tight text-black border-0 border-solid sm:text-3xl md:text-4xl">{plan.name}</h3>
                <p className="mt-3 leading-7 text-gray-900 border-0 border-solid">{plan.desc}</p>
                <div className="flex items-center justify-center mt-6 leading-7 text-gray-900 border-0 border-solid sm:mt-8">
                  <p className="box-border m-0 text-6xl font-semibold leading-normal text-center border-0 border-gray-200">{plan.price}</p>
                  <p className="box-border my-0 ml-4 mr-0 text-xs text-left border-0 border-gray-200">per user <span className="block">per month</span></p>
                </div>
                <button className={"inline-flex items-center justify-center w-full py-3 mt-6 font-sans text-sm leading-none text-center no-underline rounded cursor-pointer sm:text-base sm:mt-8 md:text-lg" + (plan.featured ? " text-white bg-blue-600 border-b-4 border-blue-700 hover:text-white" : " text-blue-600 bg-transparent border border-b-2 border-blue-600 hover:bg-blue-600 hover:border-blue-600 hover:text-white")}>
                  Select Plan
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="max-w-screen-xl px-4 py-12 mx-auto space-y-8 overflow-hidden sm:px-6 lg:px-8">
          <nav className="flex flex-wrap justify-center -mx-5 -my-2">
            {footerLinks.map((link) => (
              <div key={link} className="px-5 py-2"><a href="#" className="text-base leading-6 text-gray-500 hover:text-gray-900">{link}</a></div>
            ))}
          </nav>
          <div className="flex justify-center mt-8 space-x-6">
            <a href="#" className="text-gray-400 hover:text-gray-500"><span className="sr-only">Facebook</span><svg className="w-6 h-6" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg></a>
            <a href="#" className="text-gray-400 hover:text-gray-500"><span className="sr-only">Twitter</span><svg className="w-6 h-6" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg></a>
            <a href="#" className="text-gray-400 hover:text-gray-500"><span className="sr-only">GitHub</span><svg className="w-6 h-6" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg></a>
          </div>
          <p className="mt-8 text-base leading-6 text-center text-gray-400">&copy; 2025 __PADDIE_TEMPLATE_NAME__. All rights reserved.</p>
        </div>
      </section>
    </>
  )
}
`

const aiCss = `@import "tailwindcss";
`

const aiPreview = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Landing Template</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.9/tailwind.min.css" />
    <style>
      html.__paddie_template_pick, html.__paddie_template_pick * { cursor: crosshair !important; }
      .__paddie_template_target { outline: 2px solid #6366f1 !important; outline-offset: 2px !important; }
    </style>
  </head>
  <body data-paddie-template="true">
    <section data-template-part="nav" class="w-full px-8 text-gray-700 bg-white">
      <div class="container flex flex-col flex-wrap items-center justify-between py-5 mx-auto md:flex-row max-w-7xl">
        <div class="relative flex flex-col md:flex-row">
          <a href="#" class="flex items-center mb-5 font-medium text-gray-900 lg:w-auto lg:items-center lg:justify-center md:mb-0">
            <span class="mx-auto text-xl font-black leading-none text-gray-900 select-none">AI<span class="text-indigo-600">.</span></span>
          </a>
          <nav class="flex flex-wrap items-center mb-5 text-base md:mb-0 md:pl-8 md:ml-8 md:border-l md:border-gray-200">
            <a href="#" class="mr-5 font-medium leading-6 text-gray-600 hover:text-gray-900">Home</a>
            <a href="#" class="mr-5 font-medium leading-6 text-gray-600 hover:text-gray-900">Features</a>
            <a href="#" class="mr-5 font-medium leading-6 text-gray-600 hover:text-gray-900">Pricing</a>
            <a href="#" class="mr-5 font-medium leading-6 text-gray-600 hover:text-gray-900">Blog</a>
          </nav>
        </div>
        <div class="inline-flex items-center ml-5 space-x-6 lg:justify-end">
          <a href="#" class="text-base font-medium leading-6 text-gray-600 whitespace-no-wrap transition duration-150 ease-in-out hover:text-gray-900">Sign in</a>
          <a href="#" class="inline-flex items-center justify-center px-4 py-2 text-base font-medium leading-6 text-white whitespace-no-wrap bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">Sign up</a>
        </div>
      </div>
    </section>
    <section data-template-part="hero" class="px-2 py-32 bg-white md:px-0">
      <div class="container items-center max-w-6xl px-8 mx-auto xl:px-5">
        <div class="flex flex-wrap items-center sm:-mx-3">
          <div class="w-full md:w-1/2 md:px-3">
            <div class="w-full pb-6 space-y-6 sm:max-w-md lg:max-w-lg md:space-y-4 lg:space-y-8 xl:space-y-9 sm:pr-5 lg:pr-0 md:pb-0">
              <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-4xl lg:text-5xl xl:text-6xl">
                <span class="block xl:inline">Useful Tools to</span>
                <span class="block text-indigo-600 xl:inline"> Help You Build Faster.</span>
              </h1>
              <p class="mx-auto text-base text-gray-500 sm:max-w-md lg:text-xl md:max-w-3xl">It's never been easier to build beautiful websites that convey your message and tell your story.</p>
              <div data-template-part="hero-cta" class="relative flex flex-col sm:flex-row sm:space-x-4">
                <a href="#" class="flex items-center w-full px-6 py-3 mb-3 text-lg text-white bg-indigo-600 rounded-md sm:mb-0 hover:bg-indigo-700 sm:w-auto">Try It Free
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </a>
                <a href="#" class="flex items-center px-6 py-3 text-gray-500 bg-gray-100 rounded-md hover:bg-gray-200 hover:text-gray-600">Learn More</a>
              </div>
            </div>
          </div>
          <div class="w-full md:w-1/2">
            <div class="w-full h-auto overflow-hidden rounded-md shadow-xl sm:rounded-xl">
              <img src="https://images.unsplash.com/photo-1498049860654-af1a5c566876?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1050&q=80" alt="Developer workspace" />
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="w-full bg-white pt-7 pb-7 md:pt-20 md:pb-24">
      <div data-template-part="productivity" class="box-border flex flex-col items-center content-center px-8 mx-auto leading-6 text-black border-0 border-gray-300 border-solid md:flex-row max-w-7xl lg:px-16">
        <div class="box-border relative w-full max-w-md px-4 mt-5 mb-4 -ml-5 text-center bg-no-repeat bg-contain border-solid md:ml-0 md:mt-0 md:max-w-none lg:mb-0 md:w-1/2 xl:pl-10">
          <img src="https://cdn.devdojo.com/images/december2020/productivity.png" class="p-2 pl-6 pr-5 xl:pl-16 xl:pr-20" alt="Productivity illustration" />
        </div>
        <div class="box-border order-first w-full text-black border-solid md:w-1/2 md:pl-10 md:order-none">
          <h2 class="m-0 text-xl font-semibold leading-tight border-0 border-gray-300 lg:text-3xl md:text-2xl">Boost Productivity</h2>
          <p class="pt-4 pb-8 m-0 leading-7 text-gray-700 border-0 border-gray-300 sm:pr-12 xl:pr-32 lg:text-lg">Build an atmosphere that creates productivity in your organization and your company culture.</p>
          <ul class="p-0 m-0 leading-6 border-0 border-gray-300">
            <li class="box-border relative py-1 pl-0 text-left text-gray-500 border-solid"><span class="inline-flex items-center justify-center w-6 h-6 mr-2 text-white bg-yellow-300 rounded-full"><span class="text-sm font-bold">&#10003;</span></span>Maximize productivity and growth</li>
            <li class="box-border relative py-1 pl-0 text-left text-gray-500 border-solid"><span class="inline-flex items-center justify-center w-6 h-6 mr-2 text-white bg-yellow-300 rounded-full"><span class="text-sm font-bold">&#10003;</span></span>Speed past your competition</li>
            <li class="box-border relative py-1 pl-0 text-left text-gray-500 border-solid"><span class="inline-flex items-center justify-center w-6 h-6 mr-2 text-white bg-yellow-300 rounded-full"><span class="text-sm font-bold">&#10003;</span></span>Learn the top techniques</li>
          </ul>
        </div>
      </div>
      <div data-template-part="automation" class="box-border flex flex-col items-center content-center px-8 mx-auto mt-2 leading-6 text-black border-0 border-gray-300 border-solid md:mt-20 xl:mt-0 md:flex-row max-w-7xl lg:px-16">
        <div class="box-border w-full text-black border-solid md:w-1/2 md:pl-6 xl:pl-32">
          <h2 class="m-0 text-xl font-semibold leading-tight border-0 border-gray-300 lg:text-3xl md:text-2xl">Automated Tasks</h2>
          <p class="pt-4 pb-8 m-0 leading-7 text-gray-700 border-0 border-gray-300 sm:pr-10 lg:text-lg">Save time and money with our revolutionary services. We are the leaders in the industry.</p>
          <ul class="p-0 m-0 leading-6 border-0 border-gray-300">
            <li class="box-border relative py-1 pl-0 text-left text-gray-500 border-solid"><span class="inline-flex items-center justify-center w-6 h-6 mr-2 text-white bg-yellow-300 rounded-full"><span class="text-sm font-bold">&#10003;</span></span>Automated task management workflow</li>
            <li class="box-border relative py-1 pl-0 text-left text-gray-500 border-solid"><span class="inline-flex items-center justify-center w-6 h-6 mr-2 text-white bg-yellow-300 rounded-full"><span class="text-sm font-bold">&#10003;</span></span>Detailed analytics for your data</li>
            <li class="box-border relative py-1 pl-0 text-left text-gray-500 border-solid"><span class="inline-flex items-center justify-center w-6 h-6 mr-2 text-white bg-yellow-300 rounded-full"><span class="text-sm font-bold">&#10003;</span></span>Some awesome integrations</li>
          </ul>
        </div>
        <div class="box-border relative w-full max-w-md px-4 mt-10 mb-4 text-center bg-no-repeat bg-contain border-solid md:mt-0 md:max-w-none lg:mb-0 md:w-1/2">
          <img src="https://cdn.devdojo.com/images/december2020/settings.png" class="pl-4 sm:pr-10 xl:pl-10 lg:pr-32" alt="Automation illustration" />
        </div>
      </div>
    </section>
    <section data-template-part="features" class="py-20 bg-gray-50">
      <div class="container items-center max-w-6xl px-4 px-10 mx-auto sm:px-20 md:px-32 lg:px-16">
        <div class="flex flex-wrap items-center -mx-3">
          <div class="order-1 w-full px-3 lg:w-1/2 lg:order-0">
            <div class="w-full lg:max-w-md">
              <h2 class="mb-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl font-heading">Jam-packed with all the tools you need to succeed!</h2>
              <p class="mb-4 font-medium tracking-tight text-gray-400 xl:mb-6">It's never been easier to build a business of your own.</p>
              <ul>
                <li class="flex items-center py-2 space-x-4 xl:py-3"><svg class="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg><span class="font-medium text-gray-500">Faster Processing and Delivery</span></li>
                <li class="flex items-center py-2 space-x-4 xl:py-3"><svg class="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg><span class="font-medium text-gray-500">Out of the Box Tracking and Monitoring</span></li>
                <li class="flex items-center py-2 space-x-4 xl:py-3"><svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg><span class="font-medium text-gray-500">100% Protection and Security for Your App</span></li>
              </ul>
            </div>
          </div>
          <div class="w-full px-3 mb-12 lg:w-1/2 order-0 lg:order-1 lg:mb-0">
            <img class="mx-auto sm:max-w-sm lg:max-w-full" src="https://cdn.devdojo.com/images/november2020/feature-graphic.png" alt="Feature graphic" />
          </div>
        </div>
      </div>
    </section>
    <section data-template-part="testimonials" class="flex items-center justify-center py-20 bg-white min-w-screen">
      <div class="px-16 bg-white">
        <div class="container flex flex-col items-start mx-auto lg:items-center">
          <p class="relative flex items-start justify-start w-full text-lg font-bold tracking-wider text-purple-500 uppercase lg:justify-center lg:items-center">Don't just take our word for it</p>
          <h2 class="relative flex items-start justify-start w-full max-w-3xl text-5xl font-bold lg:justify-center">See what others are saying</h2>
          <div class="block w-full h-0.5 max-w-lg mt-6 bg-purple-100 rounded-full"></div>
          <div class="items-center justify-center w-full mt-12 mb-4 lg:flex">
            <div class="flex flex-col items-start justify-start w-full h-auto mb-12 lg:w-1/3 lg:mb-0">
              <div class="flex items-center justify-center"><div class="w-16 h-16 mr-4 overflow-hidden bg-gray-200 rounded-full"><img src="https://images.unsplash.com/photo-1527980965255-d3b416303d12?ixlib=rb-1.2.1&amp;ixid=eyJhcHBfaWQiOjEyMDd9&amp;auto=format&amp;fit=crop&amp;w=1700&amp;q=80" class="object-cover w-full h-full" alt="John Doe" /></div><div class="flex flex-col items-start justify-center"><h4 class="font-bold text-gray-800">John Doe</h4><p class="text-gray-600">CEO of Something</p></div></div>
              <blockquote class="mt-8 text-lg text-gray-500">"This is a no-brainer if you want to take your business to the next level."</blockquote>
            </div>
            <div class="flex flex-col items-start justify-start w-full h-auto px-0 mx-0 mb-12 border-l border-r border-transparent lg:w-1/3 lg:mb-0 lg:px-8 lg:mx-8 lg:border-gray-200">
              <div class="flex items-center justify-center"><div class="w-16 h-16 mr-4 overflow-hidden bg-gray-200 rounded-full"><img src="https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?ixlib=rb-1.2.1&amp;ixid=eyJhcHBfaWQiOjEyMDd9&amp;auto=format&amp;fit=crop&amp;w=2547&amp;q=80" class="object-cover w-full h-full" alt="Jane Doe" /></div><div class="flex flex-col items-start justify-center"><h4 class="font-bold text-gray-800">Jane Doe</h4><p class="text-gray-600">CTO of Business</p></div></div>
              <blockquote class="mt-8 text-lg text-gray-500">"Thanks for creating this service. My life is so much easier."</blockquote>
            </div>
            <div class="flex flex-col items-start justify-start w-full h-auto lg:w-1/3">
              <div class="flex items-center justify-center"><div class="w-16 h-16 mr-4 overflow-hidden bg-gray-200 rounded-full"><img src="https://images.unsplash.com/photo-1545167622-3a6ac756afa4?ixlib=rb-1.2.1&amp;ixid=eyJhcHBfaWQiOjEyMDd9&amp;auto=format&amp;fit=crop&amp;w=1256&amp;q=80" class="object-cover w-full h-full" alt="John Smith" /></div><div class="flex flex-col items-start justify-center"><h4 class="font-bold text-gray-800">John Smith</h4><p class="text-gray-600">Creator of Stuff</p></div></div>
              <blockquote class="mt-8 text-lg text-gray-500">"Packed with awesome content and exactly what I was looking for."</blockquote>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section data-template-part="pricing" class="box-border py-8 leading-7 text-gray-900 bg-white border-0 border-gray-200 border-solid sm:py-12 md:py-16 lg:py-24">
      <div class="box-border max-w-6xl px-4 pb-12 mx-auto border-solid sm:px-6 md:px-6 lg:px-4">
        <div class="flex flex-col items-center leading-7 text-center text-gray-900">
          <h2 class="box-border m-0 text-3xl font-semibold leading-tight tracking-tight text-black border-solid sm:text-4xl md:text-5xl">Pricing Options</h2>
          <p class="box-border mt-4 text-2xl leading-normal text-gray-900 border-solid">We've got a plan for companies of any size</p>
        </div>
        <div class="grid max-w-md mx-auto mt-6 overflow-hidden leading-7 text-gray-900 border border-b-4 border-gray-300 border-blue-600 rounded-xl md:max-w-lg lg:max-w-none sm:mt-10 lg:grid-cols-3">
          <div class="box-border px-4 py-8 mb-6 text-center bg-white border-solid lg:mb-0 sm:px-4 sm:py-8 md:px-8 md:py-12 lg:px-10"><h3 class="m-0 text-2xl font-semibold leading-tight tracking-tight text-black sm:text-3xl md:text-4xl">Basic</h3><p class="mt-3 leading-7 text-gray-900">The basic plan is a good fit for smaller teams and startups</p><div class="flex items-center justify-center mt-6 sm:mt-8"><p class="m-0 text-6xl font-semibold leading-normal text-center">$19</p><p class="my-0 ml-4 mr-0 text-xs text-left">per user <span class="block">per month</span></p></div><button class="inline-flex items-center justify-center w-full py-3 mt-6 text-sm leading-none text-center text-blue-600 bg-transparent border border-b-2 border-blue-600 rounded-md cursor-pointer hover:bg-blue-600 hover:border-blue-600 hover:text-white sm:text-base sm:mt-8 md:text-lg">Select Plan</button></div>
          <div class="box-border px-4 py-8 mb-6 text-center bg-gray-100 border border-gray-300 border-solid lg:mb-0 sm:px-4 sm:py-8 md:px-8 md:py-12 lg:px-10"><h3 class="m-0 text-2xl font-semibold leading-tight tracking-tight text-black sm:text-3xl md:text-4xl">Plus</h3><p class="mt-3 leading-7 text-gray-900">The plus plan is a good fit for medium-size to larger companies</p><div class="flex items-center justify-center mt-6 sm:mt-8"><p class="m-0 text-6xl font-semibold leading-normal text-center">$39</p><p class="my-0 ml-4 mr-0 text-xs text-left">per user <span class="block">per month</span></p></div><button class="inline-flex items-center justify-center w-full py-3 mt-6 text-sm leading-none text-center text-white bg-blue-600 border-b-4 border-blue-700 rounded cursor-pointer hover:text-white sm:text-base sm:mt-8 md:text-lg">Select Plan</button></div>
          <div class="box-border px-4 py-8 text-center bg-white border-solid sm:px-4 sm:py-8 md:px-8 md:py-12 lg:px-10"><h3 class="m-0 text-2xl font-semibold leading-tight tracking-tight text-black sm:text-3xl md:text-4xl">Pro</h3><p class="mt-3 leading-7 text-gray-900">The pro plan is a good fit for larger and enterprise companies.</p><div class="flex items-center justify-center mt-6 sm:mt-8"><p class="m-0 text-6xl font-semibold leading-normal text-center">$59</p><p class="my-0 ml-4 mr-0 text-xs text-center">per user <span class="block">per month</span></p></div><button class="inline-flex items-center justify-center w-full py-3 mt-6 text-sm leading-none text-center text-blue-600 bg-transparent border border-b-2 border-blue-600 rounded cursor-pointer hover:bg-blue-600 hover:border-blue-600 hover:text-white sm:text-base sm:mt-8 md:text-lg">Select Plan</button></div>
        </div>
      </div>
    </section>
    <section data-template-part="footer" class="bg-white">
      <div class="max-w-screen-xl px-4 py-12 mx-auto space-y-8 overflow-hidden sm:px-6 lg:px-8">
        <nav class="flex flex-wrap justify-center -mx-5 -my-2">
          <div class="px-5 py-2"><a href="#" class="text-base leading-6 text-gray-500 hover:text-gray-900">About</a></div>
          <div class="px-5 py-2"><a href="#" class="text-base leading-6 text-gray-500 hover:text-gray-900">Blog</a></div>
          <div class="px-5 py-2"><a href="#" class="text-base leading-6 text-gray-500 hover:text-gray-900">Team</a></div>
          <div class="px-5 py-2"><a href="#" class="text-base leading-6 text-gray-500 hover:text-gray-900">Pricing</a></div>
          <div class="px-5 py-2"><a href="#" class="text-base leading-6 text-gray-500 hover:text-gray-900">Contact</a></div>
          <div class="px-5 py-2"><a href="#" class="text-base leading-6 text-gray-500 hover:text-gray-900">Terms</a></div>
        </nav>
        <div class="flex justify-center mt-8 space-x-6">
          <a href="#" class="text-gray-400 hover:text-gray-500"><span class="sr-only">Facebook</span><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clip-rule="evenodd"></path></svg></a>
          <a href="#" class="text-gray-400 hover:text-gray-500"><span class="sr-only">Twitter</span><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path></svg></a>
          <a href="#" class="text-gray-400 hover:text-gray-500"><span class="sr-only">GitHub</span><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"></path></svg></a>
        </div>
        <p class="mt-8 text-base leading-6 text-center text-gray-400">&copy; 2025 AI Landing. All rights reserved.</p>
      </div>
    </section>
    <script>
      (() => {
        const esc = window.CSS && CSS.escape ? CSS.escape.bind(CSS) : (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&")
        const ok = (value) => value instanceof Element && !["HTML", "BODY", "SCRIPT", "STYLE", "LINK", "META"].includes(value.tagName)
        const hit = (value) => { if (!(value instanceof Element)) return; const node = value.closest("*"); if (!ok(node)) return; return node }
        const part = (value) => value.closest("[data-template-part]")?.getAttribute("data-template-part") || "full"
        const nth = (value) => { const parent = value.parentElement; if (!parent) return ""; const kids = Array.from(parent.children).filter((item) => item.tagName === value.tagName); if (kids.length <= 1) return ""; return ":nth-of-type(" + (kids.indexOf(value) + 1) + ")" }
        const cls = (value) => { const list = Array.from(value.classList).slice(0, 2); if (list.length === 0) return ""; return list.map((item) => "." + esc(item)).join("") }
        const path = (value) => { const out = []; let node = value; while (ok(node)) { let item = node.tagName.toLowerCase(); if (node.id) { out.unshift(item + "#" + esc(node.id)); break } item += cls(node) + nth(node); out.unshift(item); node = node.parentElement } return out.join(" > ") }
        const line = (value) => { let out = value.tagName.toLowerCase(); if (value.id) out += "#" + value.id; const list = Array.from(value.classList).slice(0, 2); if (list.length) out += "." + list.join("."); return out }
        const text = (value) => (value.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 240)
        const post = (type, payload = {}) => parent.postMessage({ source: "paddie-studio-template", type, payload }, "*")
        let last; let on = false
        const mark = (value) => { if (last === value) return; if (last) last.classList.remove("__paddie_template_target"); last = value; if (value) value.classList.add("__paddie_template_target") }
        const set = (value) => { on = value; document.documentElement.classList.toggle("__paddie_template_pick", value); if (!value) mark() }
        document.addEventListener("mousemove", (event) => { if (!on) return; mark(hit(event.target)) }, true)
        document.addEventListener("click", (event) => { if (!on) return; const node = hit(event.target); if (!node) return; event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); post("pick", { id: part(node), selector: path(node), label: line(node), text: text(node) || undefined, html: (node.outerHTML || "").replace(/\\s+/g, " ").trim().slice(0, 4000) }) }, true)
        document.addEventListener("keydown", (event) => { if (!on || event.key !== "Escape") return; event.preventDefault(); event.stopPropagation(); set(false); post("cancel") }, true)
        window.addEventListener("message", (event) => { if (event.source !== parent) return; const data = event.data; if (!data || typeof data !== "object" || data.source !== "paddie-studio-template-host" || data.type !== "pick") return; set(Boolean(data.active)) })
        post("ready")
      })()
    </script>
  </body>
</html>
`

const aiFiles = [
  {
    path: "package.json",
    content: `{
  "name": "__PADDIE_TEMPLATE_SLUG__",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.4",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.1.4",
    "typescript": "^5.7.2",
    "vite": "^6.1.0"
  }
}`,
  },
  {
    path: "index.html",
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>__PADDIE_TEMPLATE_NAME__</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
  },
  {
    path: "tsconfig.json",
    content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": []
}`,
  },
  {
    path: "vite.config.ts",
    content: `import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
})`,
  },
  {
    path: "src/main.tsx",
    content: `import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
  },
  { path: "src/App.tsx", content: aiApp },
  { path: "src/styles.css", content: aiCss },
] satisfies File[]

/* =====================================================================
   Template registry
   ===================================================================== */

const list = [
  {
    id: "landing",
    name: "Landing Page Starter",
    description: "A polished React + Tailwind landing page starter with hero, trust strip, features grid, CTA, and modal — featuring gradient accents, glass morphism, and animated background orbs.",
    stack: "React + Tailwind",
    preview,
    files,
    parts: [
      {
        id: "full",
        name: "Full template",
        description: "Use the full landing page as a reference starter.",
        selectors: ["hero", "features", "cta", "button", "modal"],
        files: files.map((item) => item.path),
        hint: "Adapt the layout and copy to the current product instead of copying the wording verbatim.",
      },
      {
        id: "hero",
        name: "Hero section",
        description: "Large headline with gradient accent, badge, CTA pair, and visual card with metrics.",
        selectors: ["hero"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Map the narrative and CTA structure to the selected page section.",
      },
      {
        id: "nav",
        name: "Navigation bar",
        description: "Frosted glass navigation with brand, links, and right-aligned action.",
        selectors: ["nav"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Adapt the navigation structure and spacing to the current product.",
      },
      {
        id: "metrics",
        name: "Metric strip",
        description: "Compact stat cards with gradient values for traction, proof, or key product numbers.",
        selectors: ["metrics"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Use this when the page needs a quick proof band or KPI summary.",
      },
      {
        id: "features",
        name: "Features grid",
        description: "Three-card feature section with section header, gradient icons, and hover-lift cards.",
        selectors: ["features"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Keep the visual rhythm and spacing while adapting content to the current app.",
      },
      {
        id: "cta",
        name: "Closing CTA",
        description: "Centered closing action band with radial glow and gradient top accent.",
        selectors: ["cta"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Use this when the user wants a stronger final conversion section.",
      },
      {
        id: "button",
        name: "Primary button",
        description: "Gradient primary button with glow shadow and arrow icon, paired with ghost variant.",
        selectors: ["button"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Use the style and spacing as reference for button treatments.",
      },
      {
        id: "modal",
        name: "Modal pattern",
        description: "Centered modal overlay with slide-up animation for confirmation or onboarding flows.",
        selectors: ["modal"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Adapt the structure for the current flow and keep existing state patterns where possible.",
      },
    ],
  },
  {
    id: "ai-landing",
    name: "AI Landing",
    description: "A multi-section marketing landing page with nav, hero, feature rows, testimonials, pricing, and footer.",
    stack: "React + Tailwind",
    preview: aiPreview,
    files: aiFiles,
    parts: [
      {
        id: "full",
        name: "Full template",
        description: "Use the full marketing landing page as a reference starter.",
        selectors: ["nav", "hero", "hero-cta", "productivity", "automation", "features", "testimonials", "pricing", "footer"],
        files: aiFiles.map((item) => item.path),
        hint: "Adapt the structure and section flow to the current product instead of copying the copy verbatim.",
      },
      {
        id: "nav",
        name: "Navigation bar",
        description: "Top navigation with brand, links, and auth CTA pair.",
        selectors: ["nav"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Use this for simple marketing navs with left links and right-side actions.",
      },
      {
        id: "hero",
        name: "Hero section",
        description: "Large marketing headline, support copy, image, and CTA row.",
        selectors: ["hero"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Map the message hierarchy and hero layout to the selected page section.",
      },
      {
        id: "hero-cta",
        name: "Hero CTA row",
        description: "Primary and secondary hero action buttons.",
        selectors: ["hero-cta"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Use this for call-to-action styling and button grouping.",
      },
      {
        id: "productivity",
        name: "Productivity section",
        description: "Image-left feature story with checklist benefits.",
        selectors: ["productivity"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Use this for explanatory split layouts with visual support.",
      },
      {
        id: "automation",
        name: "Automation section",
        description: "Image-right feature story with checklist benefits.",
        selectors: ["automation"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Use this for alternating product feature sections.",
      },
      {
        id: "features",
        name: "Feature list",
        description: "Icon-led benefits block with supporting image.",
        selectors: ["features"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Use this for compact feature explanations and trust-building benefits.",
      },
      {
        id: "testimonials",
        name: "Testimonials",
        description: "Three-up testimonial layout with avatar, role, and quote.",
        selectors: ["testimonials"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Use this when the page needs social proof and customer quotes.",
      },
      {
        id: "pricing",
        name: "Pricing table",
        description: "Three-tier pricing comparison with emphasis on the middle plan.",
        selectors: ["pricing"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Use this for plan comparisons and pricing section structure.",
      },
      {
        id: "footer",
        name: "Footer",
        description: "Simple footer with nav links and social icons.",
        selectors: ["footer"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Use this for lightweight marketing footers and social link rows.",
      },
    ],
  },
] satisfies Template[]

export const templates = () => list

export const template = (id: string) => list.find((item) => item.id === id)

export const part = (tpl: Template, id?: string) => tpl.parts.find((item) => item.id === (id || "full"))

export const filesFor = (tpl: Template, item?: Part) => {
  const pick = new Set((item?.files.length ? item.files : tpl.files.map((file) => file.path)).map((path) => path))
  return tpl.files.filter((file) => pick.has(file.path))
}

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "paddie-site"

export const materialize = (tpl: Template, name: string) => {
  const id = slug(name)
  return tpl.files.map((file) => ({
    path: file.path,
    content: file.content.replaceAll("__PADDIE_TEMPLATE_NAME__", name).replaceAll("__PADDIE_TEMPLATE_SLUG__", id),
  }))
}
