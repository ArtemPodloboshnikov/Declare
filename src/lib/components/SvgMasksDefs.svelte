<script lang="ts">
  import { getShapePath } from '$lib/services/shapes';
  import { presentation } from '$lib/stores/presentation.svelte';

  const masks = $derived.by(() => {
    const slide = presentation.currentSlide;
    if (!slide) return [];
    return slide.elements
      .filter(el => el.type === 'shape' && el.shape?.maskTargetId)
      .map(el => ({
        id: el.id,
        path: el.shape?.customPath ?? getShapePath(el.shape?.kind ?? 'rect'),
        position: el.position
      }));
  });
</script>

<svg width="0" height="0" style="position:absolute;pointer-events:none" aria-hidden="true">
  <defs>
    {#each masks as m (m.id)}
      <mask
        id="mask-{m.id}"
        maskUnits="userSpaceOnUse"
        maskContentUnits="userSpaceOnUse"
      >
        <!-- Чёрный фон = маска скрывает -->
        <rect x="0" y="0" width="1280" height="720" fill="black" />
        <!-- Белая фигура = маска показывает -->
        <g transform="translate({m.position.x}, {m.position.y})">
          <g transform="scale({m.position.width / 100}, {m.position.height / 100})">
            <path d={m.path} fill="white" />
          </g>
        </g>
      </mask>
    {/each}
  </defs>
</svg>
