<script lang="ts">
    export let ariaLabel: string
    export let svgPath: string
</script>

<svg height="24" width="24" viewBox="0 0 24 24" fill="currentColor" aria-label={ariaLabel}>
    <path d={svgPath} />
</svg>
