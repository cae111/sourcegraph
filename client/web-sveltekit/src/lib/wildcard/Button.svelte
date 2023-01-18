<script lang="ts">
	import type { BUTTON_DISPLAY, BUTTON_SIZES, BUTTON_VARIANTS } from "@sourcegraph/wildcard/src/components/Button";
    import {getButtonClassName} from '@sourcegraph/wildcard/src/components/Button/utils'

    export let variant: typeof BUTTON_VARIANTS[number]|undefined = undefined
    export let size: typeof BUTTON_SIZES[number]|undefined = undefined
    export let display: typeof BUTTON_DISPLAY[number]|undefined = undefined
    export let outline: boolean|undefined = undefined

    $: brandedButtonClassname = getButtonClassName({ variant, outline, display, size })
</script>

{#if $$slots.custom}
    <slot name="custom" className={brandedButtonClassname} />
{:else}
    <button class={brandedButtonClassname} {...$$restProps} on:click|preventDefault>
        <slot />
    </button>
{/if}
