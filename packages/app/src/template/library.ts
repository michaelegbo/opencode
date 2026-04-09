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

const app = `import { useMemo, useState } from "react"
import "./styles.css"

const items = [
  {
    title: "One clear value story",
    text: "Frame your product in a way that makes the first ten seconds obvious.",
  },
  {
    title: "Built-in social proof",
    text: "Mix metrics, trust markers, and visual rhythm so the page feels credible.",
  },
  {
    title: "Conversion-first CTA",
    text: "Keep the next action visible in the hero, pricing, and closing section.",
  },
]

export default function App() {
  const [open, setOpen] = useState(false)
  const stats = useMemo(
    () => [
      { label: "launches", value: "124" },
      { label: "lift in signups", value: "38%" },
      { label: "teams shipped", value: "42" },
    ],
    [],
  )

  return (
    <div className="shell">
      <header className="nav">
        <div className="brand">
          <span className="brand-mark">P</span>
          <span>__PADDIE_TEMPLATE_NAME__</span>
        </div>
        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#proof">Proof</a>
          <a href="#cta">Start</a>
        </nav>
        <button className="ghost" onClick={() => setOpen(true)}>
          Book demo
        </button>
      </header>

      <main className="page">
        <section className="hero" id="hero">
          <div className="hero-copy">
            <p className="eyebrow">Design systems for shipping products fast</p>
            <h1>Launch a sharper landing page without rebuilding your stack.</h1>
            <p className="lede">
              This starter combines narrative structure, modern spacing, and a strong CTA so teams can go from
              blank canvas to publishable page faster.
            </p>
            <div className="hero-actions">
              <button className="primary">Start free</button>
              <button className="ghost" onClick={() => setOpen(true)}>
                See the modal
              </button>
            </div>
            <div className="hero-metrics" id="proof">
              {stats.map((item) => (
                <div className="metric" key={item.label}>
                  <span>{item.value}</span>
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-card">
            <div className="card-head">
              <span className="pill">Campaign stack</span>
              <span className="muted">Updated 2m ago</span>
            </div>
            <div className="card-grid">
              <div>
                <strong>Messaging</strong>
                <p>Sharper value prop for conversion-focused pages.</p>
              </div>
              <div>
                <strong>UI kit</strong>
                <p>Token-ready sections with bolder hierarchy and spacing.</p>
              </div>
              <div>
                <strong>Preview loop</strong>
                <p>Fast iteration between code, preview, and assistant changes.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="features" id="features">
          {items.map((item) => (
            <article className="feature" key={item.title}>
              <div className="feature-mark" />
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </section>

        <section className="cta" id="cta">
          <div>
            <p className="eyebrow">Use this section as your closing push</p>
            <h2>Turn this template into your own product page with the assistant.</h2>
          </div>
          <button className="primary wide">Generate my first draft</button>
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
              <button className="ghost small" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <p className="modal-copy">
              Use this modal as a reference for layout, spacing, and content grouping when you ask the assistant to
              adapt it into your own project.
            </p>
            <div className="modal-actions">
              <button className="primary">Confirm</button>
              <button className="ghost small" onClick={() => setOpen(false)}>
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
  --bg: #0d0f14;
  --panel: rgba(19, 23, 33, 0.78);
  --panel-strong: rgba(26, 31, 45, 0.95);
  --line: rgba(255, 255, 255, 0.08);
  --text: #f6f7fb;
  --muted: #a6afc2;
  --accent: #64f0c8;
  --accent-strong: #14b8a6;
  --accent-soft: rgba(100, 240, 200, 0.14);
  --warn: #f59e0b;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(100, 240, 200, 0.14), transparent 24%),
    linear-gradient(180deg, #0d0f14 0%, #11141b 100%);
  color: var(--text);
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  font: inherit;
}

.shell {
  min-height: 100vh;
  padding: 28px;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin: 0 auto;
  max-width: 1180px;
  padding: 14px 18px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: rgba(10, 12, 18, 0.72);
  backdrop-filter: blur(14px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.brand-mark {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: linear-gradient(135deg, #64f0c8, #1f7ae0);
  color: #091017;
  font-weight: 700;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 22px;
  color: var(--muted);
}

.page {
  display: grid;
  gap: 32px;
  max-width: 1180px;
  margin: 32px auto 0;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 28px;
}

.hero-copy,
.hero-card,
.feature,
.cta,
.modal {
  border: 1px solid var(--line);
  background: var(--panel);
  backdrop-filter: blur(14px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.24);
}

.hero-copy {
  padding: 52px;
  border-radius: 34px;
}

.hero-copy h1,
.cta h2 {
  font-family: "Space Grotesk", "Segoe UI", sans-serif;
  line-height: 0.92;
  letter-spacing: -0.04em;
  margin: 0;
}

.hero-copy h1 {
  font-size: clamp(3.6rem, 6vw, 5.8rem);
  max-width: 10ch;
}

.lede,
.modal-copy,
.feature p,
.hero-card p {
  color: var(--muted);
  line-height: 1.7;
}

.eyebrow {
  margin: 0 0 18px;
  color: var(--accent);
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.hero-actions,
.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 28px;
}

.primary,
.ghost {
  min-height: 48px;
  border-radius: 999px;
  padding: 0 20px;
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background 180ms ease;
}

.primary {
  background: linear-gradient(135deg, var(--accent), #5cb7ff);
  color: #071017;
  font-weight: 700;
}

.primary:hover,
.ghost:hover {
  transform: translateY(-1px);
}

.ghost {
  background: var(--accent-soft);
  border-color: rgba(100, 240, 200, 0.26);
  color: var(--text);
}

.small {
  min-height: 40px;
  padding-inline: 16px;
}

.wide {
  min-width: 230px;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 34px;
}

.metric {
  padding: 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.metric span {
  display: block;
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 6px;
}

.metric small {
  color: var(--muted);
}

.hero-card {
  padding: 28px;
  border-radius: 30px;
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
}

.pill {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(20, 184, 166, 0.16);
  color: var(--accent);
}

.muted {
  color: var(--muted);
}

.card-grid {
  display: grid;
  gap: 18px;
  margin-top: 24px;
}

.card-grid > div {
  padding: 18px;
  border-radius: 22px;
  background: var(--panel-strong);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.feature {
  padding: 26px;
  border-radius: 26px;
}

.feature-mark {
  width: 44px;
  height: 44px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(100, 240, 200, 0.24), rgba(92, 183, 255, 0.12));
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.feature h2 {
  margin: 20px 0 10px;
  font-family: "Space Grotesk", "Segoe UI", sans-serif;
  font-size: 1.4rem;
}

.cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 34px;
  border-radius: 30px;
}

.cta h2 {
  font-size: clamp(2.3rem, 4vw, 3.6rem);
  max-width: 12ch;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(4, 6, 10, 0.6);
  backdrop-filter: blur(14px);
}

.modal {
  width: min(560px, 100%);
  padding: 28px;
  border-radius: 32px;
}

.modal-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 18px;
}

.modal h3 {
  margin: 8px 0 0;
  font-size: 2rem;
  font-family: "Space Grotesk", "Segoe UI", sans-serif;
}

@media (max-width: 980px) {
  .hero,
  .features,
  .cta {
    grid-template-columns: 1fr;
  }

  .nav {
    flex-wrap: wrap;
  }

  .hero-copy {
    padding: 36px;
  }
}

@media (max-width: 640px) {
  .shell {
    padding: 18px;
  }

  .hero-metrics {
    grid-template-columns: 1fr;
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
  <body>
    <div class="shell">
      <header class="nav">
        <div class="brand">
          <span class="brand-mark">P</span>
          <span>Paddie Landing</span>
        </div>
        <nav class="nav-links">
          <a href="#features">Features</a>
          <a href="#proof">Proof</a>
          <a href="#cta">Start</a>
        </nav>
        <button class="ghost" data-template-part="button">Book demo</button>
      </header>
      <main class="page">
        <section class="hero" id="hero" data-template-part="hero">
          <div class="hero-copy">
            <p class="eyebrow">Design systems for shipping products fast</p>
            <h1>Launch a sharper landing page without rebuilding your stack.</h1>
            <p class="lede">A curated landing page template for fast UI iteration in Studio.</p>
            <div class="hero-actions">
              <button class="primary" data-template-part="button">Start free</button>
              <button class="ghost" data-template-part="modal">See the modal</button>
            </div>
            <div class="hero-metrics" id="proof">
              <div class="metric"><span>124</span><small>launches</small></div>
              <div class="metric"><span>38%</span><small>lift in signups</small></div>
              <div class="metric"><span>42</span><small>teams shipped</small></div>
            </div>
          </div>
          <div class="hero-card">
            <div class="card-head">
              <span class="pill">Campaign stack</span>
              <span class="muted">Updated 2m ago</span>
            </div>
            <div class="card-grid">
              <div><strong>Messaging</strong><p>Sharper value prop for conversion-focused pages.</p></div>
              <div><strong>UI kit</strong><p>Token-ready sections with bolder hierarchy and spacing.</p></div>
              <div><strong>Preview loop</strong><p>Fast iteration between code, preview, and assistant changes.</p></div>
            </div>
          </div>
        </section>
        <section class="features" id="features" data-template-part="features">
          <article class="feature"><div class="feature-mark"></div><h2>One clear value story</h2><p>Frame your product in a way that makes the first ten seconds obvious.</p></article>
          <article class="feature"><div class="feature-mark"></div><h2>Built-in social proof</h2><p>Mix metrics, trust markers, and visual rhythm so the page feels credible.</p></article>
          <article class="feature"><div class="feature-mark"></div><h2>Conversion-first CTA</h2><p>Keep the next action visible in the hero, pricing, and closing section.</p></article>
        </section>
        <section class="cta" id="cta" data-template-part="cta">
          <div>
            <p class="eyebrow">Use this section as your closing push</p>
            <h2>Turn this template into your own product page with the assistant.</h2>
          </div>
          <button class="primary wide" data-template-part="button">Generate my first draft</button>
        </section>
      </main>
      <div class="modal-backdrop" data-template-part="modal">
        <div class="modal">
          <div class="modal-head">
            <div>
              <p class="eyebrow">Template modal</p>
              <h3>Schedule a guided onboarding run</h3>
            </div>
            <button class="ghost small">Close</button>
          </div>
          <p class="modal-copy">Use this modal as a reference for grouped content and action layout.</p>
          <div class="modal-actions">
            <button class="primary">Confirm</button>
            <button class="ghost small">Maybe later</button>
          </div>
        </div>
      </div>
    </div>
    <script>
      (() => {
        const post = (type, payload = {}) => parent.postMessage({ source: "paddie-studio-template", type, payload }, "*")
        let last
        const pick = (target) => target instanceof Element ? target.closest("[data-template-part]") : null
        const mark = (node) => {
          if (last === node) return
          if (last) last.style.outline = ""
          last = node
          if (node) node.style.outline = "2px solid #64f0c8"
        }
        document.addEventListener("mousemove", (event) => {
          const node = pick(event.target)
          if (!node) return
          mark(node)
        }, true)
        document.addEventListener("click", (event) => {
          const node = pick(event.target)
          if (!node) return
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()
          const id = node.getAttribute("data-template-part")
          if (!id) return
          post("pick", { id })
        }, true)
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

const list = [
  {
    id: "landing",
    name: "Landing Page Starter",
    description: "A polished React + Tailwind landing page starter with a hero, features, CTA, button style, and modal pattern.",
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
        description: "Large headline, supporting copy, CTA pair, and metric strip.",
        selectors: ["hero"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Map the narrative and CTA structure to the selected page section.",
      },
      {
        id: "features",
        name: "Features grid",
        description: "Three-card feature section with bold headings and compact supporting copy.",
        selectors: ["features"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Keep the visual rhythm and spacing while adapting content to the current app.",
      },
      {
        id: "cta",
        name: "Closing CTA",
        description: "Closing action band designed to push toward one clear next step.",
        selectors: ["cta"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Use this when the user wants a stronger final conversion section.",
      },
      {
        id: "button",
        name: "Primary button",
        description: "Rounded primary action pattern with secondary ghost action pairing.",
        selectors: ["button"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Use the style and spacing as reference for button treatments.",
      },
      {
        id: "modal",
        name: "Modal pattern",
        description: "Centered modal overlay for confirmation or onboarding flows.",
        selectors: ["modal"],
        files: ["src/App.tsx", "src/styles.css"],
        hint: "Adapt the structure for the current flow and keep existing state patterns where possible.",
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
