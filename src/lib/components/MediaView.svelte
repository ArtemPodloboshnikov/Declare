<script lang="ts">
  import { buildSvgInnerShadowFilter } from '$lib/services/element-effects';
  import { squirclePath } from '$lib/services/squircle';
  import type { SlideElement } from '$lib/stores/presentation.svelte';

  let {
    element,
    src,
  }: {
    element: SlideElement;
    src: string;
  } = $props();

  const innerShadowFilterId = $derived(`img-inner-shadow-${element.id}`);
  const innerShadowFilter = $derived(
    buildSvgInnerShadowFilter(element, innerShadowFilterId)
  );
  const hasInnerShadow = $derived(Boolean(innerShadowFilter));

  const w = $derived(element.position.width);
  const h = $derived(element.position.height);

  const radius = $derived(element.transform?.borderRadius ?? 0);
  const smoothing = $derived(element.transform?.cornerSmoothing ?? 0);
  const clipId = $derived(`img-clip-${element.id}`);

  // Определяем, нужна ли обрезка внутри SVG
  const needsClip = $derived(radius > 0);

  // Squircle-путь (в пикселях канваса)
  const squirclePathData = $derived.by(() => {
    if (!needsClip) return '';
    if (smoothing > 0) {
      return squirclePath({
        width: w,
        height: h,
        cornerRadius: radius,
        cornerSmoothing: smoothing / 100
      });
    }
    return '';
  });
</script>

{#if hasInnerShadow}
  <svg
    class="media-svg"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 {w} {h}"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      {@html innerShadowFilter}

      {#if needsClip}
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          {#if squirclePathData}
            <path d={squirclePathData} />
          {:else}
            <rect
              x="0" y="0"
              width={w}
              height={h}
              rx={radius}
              ry={radius}
            />
          {/if}
        </clipPath>
      {/if}
    </defs>

    <foreignObject
      x="0" y="0"
      width={w}
      height={h}
      filter={`url(#${innerShadowFilterId})`}
      clip-path={needsClip ? `url(#${clipId})` : undefined}
    >
        <img
          xmlns="http://www.w3.org/1999/xhtml"
          src={src}
          alt=""
          style="width:100%;height:100%;object-fit:contain;display:block;"
          draggable="false"
        />
    </foreignObject>
  </svg>
{:else}
    <img class="el-image" src={src} alt="" draggable="false" />
{/if}

<style>
  .media-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
    filter: var(--element-filter, none);
    border-radius: var(--element-radius, 0);
    clip-path: var(--element-clip-path, none);
    outline: var(--element-outline-width, 0) solid var(--element-outline-color, transparent);
    outline-offset: 0;
  }

  .el-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    filter: var(--element-filter, none);
    border-radius: var(--element-radius, 0);
    clip-path: var(--element-clip-path, none);
    outline: var(--element-outline-width, 0) solid var(--element-outline-color, transparent);
    outline-offset: 0;
  }
</style>
