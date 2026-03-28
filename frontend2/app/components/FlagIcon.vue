<template>
	<IconWrapper
		v-tooltip.top="name"
		class="flag-icon-wrapper">
		<svg :class="['flag-icon', useSvg ? 'flag-icon--svg' : null]" viewBox="0 0 36 36">
			<use
				v-if="useSvg"
				:href="`/flags/${code}.svg`"
			/>

			<text
				v-else
				x="50%"
				y="50%"
				dominant-baseline="central"
				text-anchor="middle"
				font-size="40"
			>
				{{ emoji }}
			</text>
		</svg>
	</IconWrapper>
</template>

<script setup lang="ts">
import { COUNTRIES } from "~/utils/country";

const props = defineProps<{
	code?: string;
}>();

const useSvg = ref(false);

const name = computed(() => COUNTRIES.find(item => item.code === props.code)?.name);
const emoji = computed(() => props.code ? String.fromCodePoint(...[...props.code].map(c => 0x1_F1_E6 - 65 + (c.codePointAt(0) ?? 0))) : "");

onMounted(() => {
	// Windows still doesn’t have flag emoji
	if (import.meta.client) {
		useSvg.value = navigator.userAgent.includes(" Windows NT ");
	}
});
</script>

<style scoped>
.flag-icon-wrapper {
	overflow: hidden;
	aspect-ratio: 36 / 27;
}

.flag-icon-wrapper :deep(svg) {
	width: 1em;
	height: 1em;
}

.flag-icon--svg {
	filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.2)) drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.2));
}
</style>
