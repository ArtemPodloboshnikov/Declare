import { importSlideFromHtml, importSlidesFromHtml } from '$lib/services/import-html';
import { presentation } from '$lib/stores/presentation.svelte';

export type ProviderId = 'ollama' | 'lmstudio' | 'openai' | 'anthropic';
export type ProviderKind = 'openai-compatible' | 'anthropic';

export interface AIProvider {
  id: ProviderId;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const DEFAULT_PROVIDERS: Record<ProviderId, AIProvider> = {
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    kind: 'openai-compatible',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    model: 'llama3'
  },
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio',
    kind: 'openai-compatible',
    baseUrl: 'http://localhost:1234/v1',
    apiKey: '',
    model: 'local-model'
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o'
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: '',
    model: 'claude-3-5-sonnet-20241022'
  }
};

function createAIStore() {
  let providers = $state<Record<ProviderId, AIProvider>>(
    structuredClone(DEFAULT_PROVIDERS)
  );
  let providerId = $state<ProviderId>('ollama');

  const provider = $derived(providers[providerId]);

  return {
    get providerId() { return providerId; },
    set providerId(v: ProviderId) { providerId = v; },
    get provider() { return provider; },
    get providers() { return providers; },
    get providerList() {
      return (Object.keys(providers) as ProviderId[]).map(id => ({
        id,
        name: providers[id].name
      }));
    },
    updateProvider(patch: Partial<Omit<AIProvider, 'id'>>) {
      Object.assign(providers[providerId], patch);
    },
    resetProvider() {
      providers[providerId] = structuredClone(DEFAULT_PROVIDERS[providerId]);
    }
  };
}

export const ai = createAIStore();

// ============================================================================
// СТРУКТУРА СЛАЙДА — 1:1 КАК В VIEWPORT
// ============================================================================

const SLIDE_INNER_SPEC = `
You are generating HTML for a presentation slide.

The slide canvas is EXACTLY 1280 x 720 px (16:9).
The canvas is rendered as:
  <div class="slide-canvas" style="width:1280px;height:720px;overflow:hidden;position:relative;">

Return ONLY the contents of that canvas (no <html>, <head>, <body>, <section>, no markdown).
Each element is a <div class="slide-element"> positioned absolutely inside the canvas.

ELEMENT SHELL (must match exactly):

  <div class="slide-element" style="position:absolute;left:Xpx;top:Ypx;width:Wpx;height:Hpx;">
    <div class="element-backdrop" style="position:absolute;inset:0;pointer-events:none;z-index:0;"></div>
    <div class="element-content" style="position:relative;width:100%;height:100%;z-index:1;overflow:visible;">
      ...content...
    </div>
  </div>

COORDINATE RULES:
- X, Y, W, H are INTEGERS in PIXELS.
- 0 <= X, 0 <= Y, X + W <= 1280, Y + H <= 720.
- Recommended margins: 60-100px from each edge.
- Usable area: X: 60..1220, Y: 60..660.
- Do NOT use em, rem, %, vw, vh for element position. Use px only.
- Do NOT scale coordinates.

Example of CORRECT shell:
  <div class="slide-element" style="position:absolute;left:80px;top:60px;width:1120px;height:120px;">
    <div class="element-backdrop" style="position:absolute;inset:0;pointer-events:none;z-index:0;"></div>
    <div class="element-content" style="position:relative;width:100%;height:100%;z-index:1;overflow:visible;">
      ...
    </div>
  </div>

Example of WRONG shell (scaled up, outside the canvas):
  <div class="slide-element" style="position:absolute;left:1024px;top:432px;width:14336px;height:1008px;">
`.trim();

// ============================================================================
// ПРИМЕРЫ ПО ТИПАМ
// ============================================================================

const EXAMPLE_TEXT = `
TEXT:

<div class="slide-element" style="position:absolute;left:80px;top:60px;width:1120px;height:140px;">
  <div class="element-backdrop" style="position:absolute;inset:0;pointer-events:none;z-index:0;"></div>
  <div class="element-content" style="position:relative;width:100%;height:100%;z-index:1;overflow:visible;">
    <div class="el-text" style="font-family:'Inter', sans-serif; font-size:56px; font-weight:700; color:#e8e8f0; text-align:left; line-height:1.2; padding:20px;">Slide title</div>
  </div>
</div>

RULES:
- The .el-text element inherits width:100% and height:100% from .element-content.
- Add padding: 20-32px for breathing room.
- Title: 48-72px. Subtitle: 32-40px. Body: 20-28px. Caption: 14-18px.
- NEVER use font-size larger than 120px.
- Reserve enough height: N lines × font-size × line-height × 1.2.
  Example: font-size:36px, line-height:1.5, 4 lines → height ≈ 260px.
- If the text doesn't fit, split it into a new slide.
`.trim();

const EXAMPLE_CARD = `
CARD (with glass effect, rounded corners, drop shadow):

<div class="slide-element" style="position:absolute;left:80px;top:240px;width:540px;height:400px;">
  <div class="element-backdrop" style="position:absolute;inset:0;pointer-events:none;z-index:0;border-radius:24px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);"></div>
  <div class="element-content" style="position:relative;width:100%;height:100%;z-index:1;overflow:visible;--element-radius:24px;--element-outline-width:1px;--element-outline-color:rgba(124,108,240,0.4);--element-filter:drop-shadow(0px 8px 24px rgba(0,0,0,0.4));">
    <div class="el-text" style="font-family:'Inter', sans-serif; font-size:22px; color:#e8e8f0; text-align:left; line-height:1.6; padding:32px;">
      <b style="color:#7c6cf0; font-size:26px;">Card title</b><br><br>
      Body text with rounded corners, glass effect and drop shadow.
    </div>
  </div>
</div>

RULES:
- Put border-radius on BOTH .element-backdrop and .element-content (via --element-radius).
- backdrop-filter MUST be on .element-backdrop (this is how glass works).
- drop-shadow via --element-filter on .element-content.
- Inner padding on .el-text: 24-40px.
`.trim();

const EXAMPLE_CHART = `
CHART:

<div class="slide-element" style="position:absolute;left:660px;top:240px;width:540px;height:400px;">
  <div class="element-backdrop" style="position:absolute;inset:0;pointer-events:none;z-index:0;border-radius:24px;"></div>
  <div class="element-content" style="position:relative;width:100%;height:100%;z-index:1;overflow:visible;--element-radius:24px;">
    <div class="chart-wrap" style="width:100%;height:100%;padding:8px;box-sizing:border-box;">
      <canvas data-chart='{"kind":"bar","labels":["Jan","Feb","Mar","Apr"],"values":[10,25,18,32],"datasetLabel":"Sales"}' data-show-dataset-label="true" data-dataset-label-color="#e8e8f0" data-dataset-label-size="14" data-show-legend="false" data-legend-color="#e8e8f0" data-legend-size="14" data-axis-label-color="#a0a0b8" data-axis-label-size="12" data-grid-color="rgba(255,255,255,0.05)" style="display:block;width:100%;height:100%;"></canvas>
    </div>
  </div>
</div>

RULES:
- Wrapper: <div class="chart-wrap" style="width:100%;height:100%;padding:8px;box-sizing:border-box;">
- Inside: <canvas data-chart='...JSON...'> with data-* attributes.
- data-chart JSON: {"kind":"bar"|"line"|"pie"|"doughnut","labels":[...],"values":[...],"datasetLabel":"..."}
- kind=pie/doughnut: no scales, legend optional.
- kind=bar/line: x and y scales, legend usually hidden.
`.trim();

const EXAMPLE_TABLE = `
TABLE:

<div class="slide-element" style="position:absolute;left:80px;top:200px;width:1120px;height:460px;">
  <div class="element-backdrop" style="position:absolute;inset:0;pointer-events:none;z-index:0;border-radius:24px;"></div>
  <div class="element-content" style="position:relative;width:100%;height:100%;z-index:1;overflow:visible;--element-radius:24px;">
    <table class="exp-table" data-show-header="true" data-header-bg="#1e1e28" data-header-color="#e8e8f0" data-cell-color="#e8e8f0" data-border-color="#2a2a38" data-border-width="1" data-striped="true" data-stripe-color="rgba(255, 255, 255, 0.02)" data-font-size="18" data-text-align="left" data-padding-x="14" data-padding-y="10" style="width:100%;border-collapse:collapse;font-size:18px;color:#e8e8f0">
      <thead>
        <tr>
          <th style="background:#1e1e28;color:#e8e8f0;border:1px solid #2a2a38;text-align:left;padding:10px 14px;">Header A</th>
          <th style="background:#1e1e28;color:#e8e8f0;border:1px solid #2a2a38;text-align:left;padding:10px 14px;">Header B</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="color:#e8e8f0;border:1px solid #2a2a38;text-align:left;padding:10px 14px;">Value 1</td>
          <td style="color:#e8e8f0;border:1px solid #2a2a38;text-align:left;padding:10px 14px;">Value 2</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

RULES:
- .exp-table MUST include all data-* attributes as shown above.
- Inline styles on <table>, <th>, <td> MUST match the data-* values.
- Keep font-size 16-20px, padding 8-14px.
`.trim();

const EXAMPLE_IMAGE = `
IMAGE:

<div class="slide-element" style="position:absolute;left:80px;top:240px;width:540px;height:400px;">
  <div class="element-backdrop" style="position:absolute;inset:0;pointer-events:none;z-index:0;border-radius:16px;"></div>
  <div class="element-content" style="position:relative;width:100%;height:100%;z-index:1;overflow:visible;--element-radius:16px;">
    <div class="media-wrapper" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
      <img src="https://picsum.photos/800/600" alt="" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;border-radius:16px;" />
    </div>
  </div>
</div>

RULES:
- Use ONLY https:// URLs.
- Wrapper: .media-wrapper with position:absolute;inset:0;display:flex;align-items:center;justify-content:center.
- <img> MUST have max-width:100%;max-height:100%;width:auto;height:auto;display:block.
`.trim();

const EXAMPLE_SHAPE = `
SHAPE:

<div class="slide-element" style="position:absolute;left:80px;top:240px;width:200px;height:200px;">
  <div class="element-backdrop" style="position:absolute;inset:0;pointer-events:none;z-index:0;"></div>
  <div class="element-content" style="position:relative;width:100%;height:100%;z-index:1;overflow:visible;">
    <div class="isolate-layer" style="width:100%;height:100%;position:relative;isolation:isolate;contain:layout style;transform:translateZ(0);">
      <svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;display:block;overflow:visible;">
        <path d="M 50 5 A 45 45 0 1 1 49.99 5 Z" fill="#7c6cf0" stroke="none" stroke-width="0" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      </svg>
    </div>
  </div>
</div>

RULES:
- Wrapper: .isolate-layer with isolation:isolate.
- <svg> MUST have viewBox="0 0 100 100" preserveAspectRatio="none".
- <path> uses 0..100 coordinates; the SVG scales to the element size.
- Common paths:
  - Circle:   M 50 5 A 45 45 0 1 1 49.99 5 Z
  - Rect:     M 5 5 H 95 V 95 H 5 Z
  - Triangle: M 50 5 L 95 95 L 5 95 Z
  - Diamond:  M 50 5 L 95 50 L 50 95 L 5 50 Z
  - Star:     M 50 5 L 61 38 L 95 38 L 67 59 L 78 92 L 50 71 L 22 92 L 33 59 L 5 38 L 39 38 Z
`.trim();

const EXAMPLE_FULL_SLIDE = `
FULL SLIDE EXAMPLE (title + two cards):

<div class="slide-inner">
  <div class="slide-element" style="position:absolute;left:80px;top:60px;width:1120px;height:140px;">
    <div class="element-backdrop" style="position:absolute;inset:0;pointer-events:none;z-index:0;border-radius:16px;"></div>
    <div class="element-content" style="position:relative;width:100%;height:100%;z-index:1;overflow:visible;--element-radius:16px;--element-filter:drop-shadow(0px 8px 24px rgba(0,0,0,0.4));">
      <div class="el-text" style="font-family:'Inter', sans-serif; font-size:56px; font-weight:700; color:#e8e8f0; text-align:left; line-height:1.2; padding:20px;">Title</div>
    </div>
  </div>

  <div class="slide-element" style="position:absolute;left:80px;top:240px;width:540px;height:400px;">
    <div class="element-backdrop" style="position:absolute;inset:0;pointer-events:none;z-index:0;border-radius:24px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);"></div>
    <div class="element-content" style="position:relative;width:100%;height:100%;z-index:1;overflow:visible;--element-radius:24px;--element-outline-width:1px;--element-outline-color:rgba(124,108,240,0.4);">
      <div class="el-text" style="font-family:'Inter', sans-serif; font-size:22px; color:#e8e8f0; text-align:left; line-height:1.6; padding:32px;">
        <b style="color:#7c6cf0; font-size:26px;">Card title</b><br><br>
        Body text here. Card has rounded corners and glass effect.
      </div>
    </div>
  </div>

  <div class="slide-element" style="position:absolute;left:660px;top:240px;width:540px;height:400px;">
    <div class="element-backdrop" style="position:absolute;inset:0;pointer-events:none;z-index:0;border-radius:24px;"></div>
    <div class="element-content" style="position:relative;width:100%;height:100%;z-index:1;overflow:visible;--element-radius:24px;">
      <div class="chart-wrap" style="width:100%;height:100%;padding:8px;box-sizing:border-box;">
        <canvas data-chart='{"kind":"bar","labels":["Q1","Q2","Q3","Q4"],"values":[12,19,3,5],"datasetLabel":"Sales"}' data-show-dataset-label="true" data-dataset-label-color="#e8e8f0" data-dataset-label-size="14" data-show-legend="false" data-legend-color="#e8e8f0" data-legend-size="14" data-axis-label-color="#a0a0b8" data-axis-label-size="12" data-grid-color="rgba(255,255,255,0.05)" style="display:block;width:100%;height:100%;"></canvas>
      </div>
    </div>
  </div>
</div>

LAYOUT VERIFICATION:
- Title: left:80  top:60  right:1200 bottom:200  (bottom 200, next starts at 240)
- Left card:  left:80  top:240 right:620  bottom:640
- Right card: left:660 top:240 right:1200 bottom:640
- All within 1280x720. Gaps: 20px horizontal, 40px vertical.
`.trim();

const STRICT_RULES = `
STRICT RULES:

- Return ONLY the contents of the slide canvas.
- No <html>, <head>, <body>, <section>, no markdown fences.
- Each element is <div class="slide-element"> with position:absolute;left/top/width/height in px.
- Coordinates are in the 1280x720 canvas space. Use raw values from 0 to 1280 and 0 to 720.
- Do NOT scale coordinates. Do NOT use em, rem, %, vw, vh for element position. Use px only.
- NEVER set left + width > 1280.
- NEVER set top + height > 720.
- NEVER set negative left/top (except full-bleed at 0,0).
- Keep elements inside: x: 60..1220, y: 60..660 (recommended).
- For long text: ensure height is enough. Split into a new slide if needed.
- Only the classes and data-attributes shown in the examples above.
- No extra wrappers, scripts, or styles outside .slide-element.
- Return raw HTML only.
`.trim();

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const SYSTEM_PROMPT_SINGLE = `
${SLIDE_INNER_SPEC}

${EXAMPLE_TEXT}

${EXAMPLE_CARD}

${EXAMPLE_CHART}

${EXAMPLE_TABLE}

${EXAMPLE_IMAGE}

${EXAMPLE_SHAPE}

${EXAMPLE_FULL_SLIDE}

${STRICT_RULES}
`.trim();

const SYSTEM_PROMPT_MULTI = `
You are a presentation generator.

Return MULTIPLE slides, each wrapped in <div class="slide-inner">...</div>.
No markdown fences. No <html>, <head>, <body>, <section>.

${SLIDE_INNER_SPEC}

STRUCTURE — each slide:

  <div class="slide-inner">
    ...elements...
  </div>
  <div class="slide-inner">
    ...elements...
  </div>

${EXAMPLE_TEXT}

${EXAMPLE_CARD}

${EXAMPLE_CHART}

${EXAMPLE_TABLE}

${EXAMPLE_IMAGE}

${EXAMPLE_SHAPE}

${EXAMPLE_FULL_SLIDE}

RULES (STRICT):

- Return EXACTLY the requested number of <div class="slide-inner"> blocks.
- Coordinates are in the 1280x720 canvas space. Use raw values from 0 to 1280 and 0 to 720.
- Do NOT scale coordinates. Do NOT use em, rem, %, vw, vh for position. Use px only.
- NEVER set left + width > 1280.
- NEVER set top + height > 720.
- NEVER set negative left/top (except full-bleed at 0,0).
- Only the classes and data-attributes shown in the examples above.
- If content doesn't fit, split into a new slide.
- Return raw HTML only.
`.trim();

// ============================================================================
// MANUAL PROMPT TEMPLATE
// ============================================================================

export function buildPromptTemplate(slideCount: number, userPrompt: string): string {
  const count = Math.max(1, Math.min(20, slideCount || 1));
  const topic = userPrompt.trim() || '[describe here what the slides should contain]';

  return `
You are an HTML markup generator for presentation slides.

TASK:
Create ${count} slide(s) on the topic:
${topic}

${SLIDE_INNER_SPEC}

RESPONSE FORMAT:

- HTML only, no markdown fences (no \`\`\`html).
- Each slide is a separate block:
  <div class="slide-inner">
    ...elements...
  </div>
- No <html>, <head>, <body>, <section class="slide">.
- Each .slide-inner is a 1280x720 canvas. Coordinates are in px relative to it.

${EXAMPLE_TEXT}

${EXAMPLE_CARD}

${EXAMPLE_CHART}

${EXAMPLE_TABLE}

${EXAMPLE_IMAGE}

${EXAMPLE_SHAPE}

${EXAMPLE_FULL_SLIDE}

${STRICT_RULES}

- Return EXACTLY ${count} <div class="slide-inner"> block(s).

Response:
`.trim();
}

// ============================================================================
// GENERATION
// ============================================================================

export async function generateSlideContent(prompt: string): Promise<string> {
  const p = ai.provider;
  const userPrompt = `
Create a slide with the following content:

${prompt}

Canvas: 1280x720. Use raw pixel coordinates within 0..1280 and 0..720.
Do NOT scale coordinates. Do NOT use em, rem, %, vw, vh.
`.trim();

  const raw = p.kind === 'anthropic'
    ? await callAnthropic(p, SYSTEM_PROMPT_SINGLE, userPrompt)
    : await callOpenAICompatible(p, SYSTEM_PROMPT_SINGLE, userPrompt);

  return stripCodeFences(raw);
}

export async function generatePresentationContent(
  prompt: string,
  slideCount: number
): Promise<string> {
  const p = ai.provider;
  const count = Math.max(1, Math.min(20, slideCount || 1));
  const userPrompt = `
Create a presentation with EXACTLY ${count} slides.

Topic / content:
${prompt}

Return ONLY the slide bodies concatenated, each wrapped in <div class="slide-inner">...</div>.
Each slide is a separate 1280x720 canvas. Use raw pixel coordinates within 0..1280 and 0..720.
Do NOT scale coordinates. Do NOT use em, rem, %, vw, vh.
No <section class="slide">, no <html>, no <body>, no markdown fences.
`.trim();

  const raw = p.kind === 'anthropic'
    ? await callAnthropic(p, SYSTEM_PROMPT_MULTI, userPrompt)
    : await callOpenAICompatible(p, SYSTEM_PROMPT_MULTI, userPrompt);

  return stripCodeFences(raw);
}

// ============================================================================
// INSERTION INTO PRESENTATION
// ============================================================================

export async function generateAndInsertSlide(prompt: string): Promise<void> {
  const html = await generateSlideContent(prompt);
  const slide = await importSlideFromHtml(html, 'AI Slide');

  const newIndex = presentation.slides.length;
  presentation.addSlide();
  presentation.currentSlideIndex = newIndex;
  presentation.replaceSlide(newIndex, slide);
}

export async function generateAndInsertPresentation(
  prompt: string,
  slideCount: number
): Promise<void> {
  const html = await generatePresentationContent(prompt, slideCount);
  const slides = await importSlidesFromHtml(html);

  if (!slides.length) {
    throw new Error('AI returned no slides');
  }

  slides.forEach((s, i) => {
    if (!s.title || s.title.startsWith('AI Slide')) {
      s.title = `AI Slide ${i + 1}`;
    }
  });

  presentation.replaceAllSlides(slides);
}

export async function applyPastedHtml(html: string): Promise<number> {
  const slides = await importSlidesFromHtml(html);
  if (!slides.length) {
    throw new Error('No slides found');
  }
  slides.forEach((s, i) => {
    if (!s.title || s.title.startsWith('AI Slide')) {
      s.title = `AI Slide ${i + 1}`;
    }
  });
  presentation.replaceAllSlides(slides);
  return slides.length;
}

// ============================================================================
// HTTP REQUESTS
// ============================================================================

async function callOpenAICompatible(
  p: AIProvider,
  system: string,
  user: string
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (p.apiKey) headers['Authorization'] = `Bearer ${p.apiKey}`;

  const response = await fetch(`${p.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: p.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`AI request failed: HTTP ${response.status} ${await safeText(response)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic(
  p: AIProvider,
  system: string,
  user: string
): Promise<string> {
  const response = await fetch(`${p.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': p.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: p.model,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: user }]
    })
  });

  if (!response.ok) {
    throw new Error(`AI request failed: HTTP ${response.status} ${await safeText(response)}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: any) => b.type === 'text');
  return textBlock?.text ?? '';
}

async function safeText(res: Response): Promise<string> {
  try { return await res.text(); } catch { return ''; }
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^\s*```(?:html)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}
