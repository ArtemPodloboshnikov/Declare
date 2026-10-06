<script lang="ts">
  import { buildSvgInnerShadowFilter } from '$lib/services/element-effects';
  import { getShapePath } from '$lib/services/shapes';
  import { presentation, type Slide, type SlideElement } from '$lib/stores/presentation.svelte';

  let {
    element,
    slide,
    /** 'non-scaling-stroke' — обводка фиксированной толщины (для Viewport).
     *  'none' — обводка масштабируется вместе с фигурой (для миниатюр). */
    vectorEffect = 'non-scaling-stroke'
  }: {
    element: SlideElement;
    slide?: Slide;
    vectorEffect?: 'non-scaling-stroke' | 'none';
  } = $props();

  // Базовый путь фигуры
  const basePath = $derived(
    element.shape?.customPath ?? getShapePath(element.shape?.kind ?? 'rect')
  );

  const isOutline = $derived(element.shape?.kind === 'line');
  const ctxSlide = $derived(slide ?? presentation.currentSlide);

  const outlineWidth = $derived(element.transform?.outlineWidth ?? 0);
  const outlineColor = $derived(element.transform?.outlineColor ?? '#7c6cf0');

  // Если есть обводка — применяем stroke к path
  const useOutline = $derived(outlineWidth > 0);

  // Если к этой фигуре привязано изображение — рендерим его внутри фигуры
  const targetElement = $derived.by<SlideElement | null>(() => {
    const targetId = element.shape?.maskTargetId;
    if (!targetId || !ctxSlide) return null;
    return ctxSlide.elements.find(e => e.id === targetId) ?? null;
  });

  const fill = $derived(isOutline ? 'none' : (element.style?.fill ?? '#7c6cf0'));
  const stroke = $derived(
    isOutline
      ? (element.style?.stroke ?? element.style?.fill ?? '#7c6cf0')
      : (element.style?.stroke ?? 'none')
  );
  const strokeWidth = $derived(
    isOutline
      ? (element.style?.strokeWidth ?? 3)
      : (element.style?.strokeWidth ?? 0)
  );

  const finalStroke = $derived(
    useOutline ? outlineColor : stroke
  );

  const finalStrokeWidth = $derived(
    useOutline ? outlineWidth : strokeWidth
  );

  const clipId = $derived(`clip-${element.id}`);
  const innerShadowFilterId = $derived(`inner-shadow-${element.id}`);
  const innerShadowFilter = $derived(
    buildSvgInnerShadowFilter(element, innerShadowFilterId)
  );

  // Есть ли активная внутренняя тень — используется для условного применения filter
  const hasInnerShadow = $derived(Boolean(innerShadowFilter));

  // Значение для атрибута filter на элементах
  const filterRef = $derived(hasInnerShadow ? `url(#${innerShadowFilterId})` : undefined);

  const maskId = $derived(`shape-mask-${element.id}`);
  const maskPath = $derived(
    element.shape?.customPath ?? getShapePath(element.shape?.kind ?? 'rect')
  );

  const needsMask = $derived(
    Boolean(element.effects?.backdropBlur?.enabled)
  );

  const w = $derived(element.position.width);
  const h = $derived(element.position.height);

  // path в координатах 0..100, scale(sx, sy) переводит в пиксели фрейма
  const sx = $derived(w / 100);
  const sy = $derived(h / 100);
</script>

{#if needsMask}
  <svg
    class="shape-mask-defs"
    width="0"
    height="0"
    style="position:absolute;pointer-events:none"
    aria-hidden="true"
  >
    <defs>
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        maskContentUnits="userSpaceOnUse"
        x="0" y="0"
        width={w} height={h}
      >
        <rect x="0" y="0" width={w} height={h} fill="black" />
        <g transform="translate(0, 0) scale({sx}, {sy})">
          <path d={maskPath} fill="white" />
        </g>
      </mask>
    </defs>
  </svg>
{/if}

<svg
  class="shape-svg"
  viewBox="0 0 100 100"
  preserveAspectRatio="none"
  xmlns="http://www.w3.org/2000/svg"
>
  {#if hasInnerShadow}
    <defs>
      {@html innerShadowFilter}
    </defs>
  {/if}

  {#if targetElement && (targetElement.type === 'image' || targetElement.type === 'video')}
    <defs>
      <clipPath id={clipId} clipPathUnits="objectBoundingBox">
        <path d={basePath} transform="scale(0.01)" />
      </clipPath>
    </defs>

    {#if targetElement.type === 'image'}
      <image
        href={targetElement.content}
        x="0" y="0" width="100" height="100"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#{clipId})"
        filter={filterRef}
      />
    {:else}
      <!-- видео в SVG через foreignObject -->
      <foreignObject
        x="0" y="0" width="100" height="100"
        clip-path="url(#{clipId})"
        filter={filterRef}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style="width:100%;height:100%;"
        >
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            src={targetElement.content}
            style="width:100%;height:100%;object-fit:cover;"
            muted
            playsinline
          ></video>
        </div>
      </foreignObject>
    {/if}

    <!-- Обводка поверх изображения -->
    {#if stroke !== 'none' && strokeWidth > 0}
      <path
        d={basePath}
        fill="none"
        stroke={finalStroke}
        stroke-width={finalStrokeWidth}
        vector-effect={vectorEffect}
      />
    {/if}
  {:else}
    <!-- Обычная фигура без маски -->
    <path
      d={basePath}
      {fill}
      stroke={finalStroke}
      stroke-width={finalStrokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect={vectorEffect}
      filter={filterRef}
    />
  {/if}
</svg>

<style>
  .shape-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }
</style>
