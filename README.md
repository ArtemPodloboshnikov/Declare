# Declare

<p align="center">
  <img src="/src-tauri/icons/128x128@2x.png" alt="Declare logo" />
</p>

**Declare** is a desktop presentation editor with AI-powered slide generation, HTML editing, HTML/PDF export, and a rich set of visual effects. Runs locally — no cloud, no subscriptions.

<p align="center">
  <img src="/screenshots/main.png" alt="Declare logo" />
</p>

---

## ✨ Features

### 🎨 Slide editor
- 1280×720 slides (16:9), unlimited count.
- Elements: **text, images, audio, video, charts, tables, shapes**.
- Drag, resize, rotate, multi-select (Shift+click).
- **Smart guides** snap to edges and centers of other elements.
- **Shift+drag** — move along a single axis.
- **Arrow keys** — nudge by 1px, **Shift+arrows** — by 10px.
- Layers, lock, hide elements.
- Shortcuts: `Ctrl+Z` / `Ctrl+Shift+Z`, `Ctrl+S` (export HTML), `Ctrl+Shift+S` (export PDF), `Ctrl+O`, `Ctrl+V`, `F5` (preview), `Shift+F5` (present from current slide).

### 🎬 Media
- Drag-and-drop images, audio, and video.
- **Embed videos** from YouTube, Rutube, VK, Dzen via embed links.
- Audio and video settings: autoplay, loop, volume, playback range, player style.
- Masks for images and videos: any shape can act as a mask.

### 📊 Data
- **Charts** (Chart.js): bar, line, pie, doughnut.
- **Tables** with a data editor and style presets.
- Import data from CSV / Excel.
- Fine-grained control over colors, sizes, legend, axes.

### 🎭 Effects & transforms
- Drop shadow, inner shadow, blur, **backdrop-blur**.
- Corner radius and **squircle** (like iOS icons).
- Outline, blend modes, opacity.
- **Entrance animations**: fade, slide, zoom, rotate, flip, bounce, spin, wipe, grow, shrink, drop, rise, pulse.
- Animation triggers: on click, with previous, after previous.

### 🤖 AI generation
- Supports **OpenAI, Anthropic, Ollama, LM Studio**.
- Generate a **single slide** or an **entire presentation** from a text prompt.
- **Prompt template** for manual generation in any AI — copy, paste the response, apply.
- Configurable URL, model, and API key per provider.

### 💾 Export & import
- **Export to HTML** — self-contained file with inlined assets and interactive elements.
- **Export to PDF** — via the system print dialog (Save as PDF).
- **Import HTML presentations** — reverse-compatible with the export.
- **Slide HTML editor** — edit markup manually with live preview.
- **Preview** directly in the browser, starting from the current slide.

### 🌍 Misc
- Localization: **Russian, English**.
- Dark theme.
- Works **offline** — everything is stored locally.
- Cross-platform: **Windows, macOS, Linux**.

---

## 📥 Installation

Download the latest version for your platform from the [**Releases**](https://github.com/ArtemPodloboshnikov/Declare/releases) page:

| Platform | Format |
|---|---|
| **Windows** | `.exe` |
| **macOS** | `.dmg` or `.app` |
| **Linux** | `.AppImage`, `.deb`, or `.rpm` |

### Windows
1. Download the `.exe` installer.
2. Run it and follow the instructions.
3. Done — Declare is in the Start menu.

### macOS
1. Download the `.dmg` (recommended) or `.app` bundle.
- **For `.dmg`:** open the image and drag **Declare** into **Applications**.
- **For `.app`:** move the app to **Applications** manually — drag the `.app` file into the **Applications** folder in Finder.
2. On first launch you may need to allow the app in **System Settings → Privacy & Security**.
3. If macOS blocks the app with "damaged and can't be opened", run in Terminal:
   ```bash
   xattr -cr /Applications/Declare.app
   ```

### Linux
- **AppImage**: make it executable (`chmod +x Declare*.AppImage`) and run.
- **deb**: `sudo dpkg -i declare_*.deb`
- **rpm**: `sudo rpm -i declare-*.rpm`

---

## 🚀 Quick start

1. Launch **Declare**.
2. Create your first slide (the «+» button on the empty canvas).
3. Add elements from the **Tools** panel on the left.
4. Adjust the element's appearance in the right panel — effects, transforms, animations.
5. Use the **AI panel** to generate slides from a text description.
6. Export to **HTML** (`Ctrl+S`) or **PDF** (`Ctrl+Shift+S`).
7. Preview — `F5` (from the start) or `Shift+F5` (from the current slide).

---

## ⌨️ Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `←` `→` `↑` `↓` | Nudge selection by 1px |
| `Shift` + arrows | Nudge by 10px |
| `Shift` + drag | Move along one axis |
| `Shift` + resize | Keep proportions |
| `Shift` + rotate | Snap to 15° |
| `Delete` / `Backspace` | Delete selection |
| `Escape` | Deselect |
| `Space` + drag | Pan canvas |
| `Ctrl` + wheel | Zoom canvas |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+S` | Export HTML |
| `Ctrl+Shift+S` | Export PDF |
| `Ctrl+O` | Open presentation |
| `Ctrl+V` | Paste file / text / data |
| `F5` | Preview in browser |
| `Shift+F5` | Present from current slide |

You can always find it in the bottom **Tools**.

---

## 🛠 Tech stack

- **[Svelte 5](https://svelte.dev/)** — UI and reactivity (runes).
- **[Tauri 2](https://tauri.app/)** — desktop shell (Rust + WebView).
- **[Chart.js](https://www.chartjs.org/)** — charts.
- **[Lucide](https://lucide.dev/)** — icons.
- **TypeScript**, **Vite**.

---

## 🐛 Bug reports

Found a bug or have a suggestion? Open an [**issue**](https://github.com/ArtemPodloboshnikov/Declare/issues) describing:

- What you were doing.
- What you expected to happen.
- What actually happened.
- Your OS and Declare version.
- A screenshot or video (if possible).

---

## ❤️ Support the project

If Declare saves you time or brings you joy, you can support its development.

<details>
<summary><b>₿ Crypto</b></summary>

<br>

| Network | Address |
|---|---|
| **Ethereum / Linea / Base / Arbitrum / BNB / OP / Polygon / Monad** | `0x714062d38022B3E8F65A932E42f29DcB911A536E` |
| **Bitcoin** | `bc1qg22n2vxem86ekqsrpyehxvxy2v6mwgkfnarx6f` |
| **Solana** | `4LPf8go2Yq7znK9eQML3y3UZSomNaCRYQwGaZjzVabPS` |
| **Tron** | `TUi6WmLjPtshqGZbPW1SbvT3Vj86ADoDRJ` |

</details>

<details>
<summary><b>💳 T-Bank</b></summary>

<br>

[Pay via T-Bank](https://t.tb.ru/pm_short/3m0r2sANeq5)

</details>
