<template>
	<Button
		severity="info"
		:size="size ?? 'large'"
		raised
		rounded
		:class="['buy-button', `buy-button--${size ?? 'large'}`]"
	>
		<DropletIcon class="buy-button-icon" />
		{{ cost.toLocaleString() }}
	</Button>
</template>

<script setup lang="ts">
import DropletIcon from "~/components/icons/DropletIcon.vue";

defineProps<{
	size?: "small" | "large";
	cost: number;
}>();
</script>

<style scoped>
.buy-button {
	font-weight: 500;
	font-feature-settings: "tnum";
	gap: 0.25rem;
	min-width: 6.5rem;
}

.buy-button--small {
	min-width: 6rem;
}

.buy-button-icon {
	font-size: 1.3em;
}
</style>
