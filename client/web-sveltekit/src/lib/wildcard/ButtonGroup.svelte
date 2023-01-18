<script lang="ts">
	import type { BUTTON_GROUP_DIRECTION } from "@sourcegraph/wildcard/src/components/Button";
	import classNames from "classnames";
    import styles from '@sourcegraph/wildcard/src/components/Button/Button.module.scss'

    export let direction: typeof BUTTON_GROUP_DIRECTION[number] = 'horizontal'

    $: className = classNames(styles.btnGroup, direction === 'vertical' && styles.btnGroupVertical)
</script>

<slot name="custom" role="group" {className}>
    <div role="group" class={className}>
        <slot />
    </div>
</slot>
