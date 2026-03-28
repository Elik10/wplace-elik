<template>
	<div class="avatar">
		<OverlayBadge
			v-if="level"
			:value="level"
			size="small"
			class="avatar-badge"
		>
			<Avatar
				:label="monogram ?? undefined"
				:image="user?.picture"
				:size="size"
				:class="['avatar-avatar', `avatar-avatar--${size ?? 'normal'}`]"
				shape="circle"
			/>
		</OverlayBadge>

		<Avatar
			v-else
			:label="monogram ?? undefined"
			:image="user?.picture"
			:size="size"
			:class="['avatar-avatar', `avatar-avatar--${size ?? 'normal'}`]"
			shape="circle"
		/>

		<div
			v-if="levelProgress"
			class="avatar-progress"
			:style="{
				'--progress': `${levelProgress}%`
			}"
		/>
	</div>
</template>

<script setup lang="ts">
import Avatar from "primevue/avatar";
import OverlayBadge from "primevue/overlaybadge";

const props = defineProps<{
	size?: "tiny" | "small" | "normal" | "large" | "xlarge";
	user: {
		name?: string;
		username?: string;
		level?: number;
		picture?: string;
	} | null;
	levelProgress?: number | null;
}>();

const level = computed(() => Math.floor(props.user?.level ?? 0));

const monogram = computed(() => {
	if (props.user?.picture) {
		return null;
	}

	return props.user?.name?.charAt(0)
		.toLocaleUpperCase();
});
</script>

<style scoped>
.avatar {
	position: relative;
	display: inline-block;
}

.avatar-progress {
	position: absolute;
	inset: -1px;
	z-index: 10;
	border-radius: 50%;
	background: conic-gradient(
		var(--p-primary-color) 0%,
		var(--p-primary-color) var(--progress),
		transparent var(--progress),
		transparent 100%
	);
	mask: radial-gradient(
		circle,
		transparent 0%,
		transparent calc(50% + 5px),
		black calc(50% + 5.5px),
		black 100%
	);
	pointer-events: none;
	transition: --progress 1s ease;
}

.avatar :deep(.p-overlaybadge .p-badge) {
	--p-badge-padding: 0 0.25rem;
	inset: auto 0 0 auto;
	z-index: 11;
	transform: translate(25%, 25%);
	transform-origin: 100% 100%;
	outline-width: 0;
	border-radius: 999px;
}

.avatar-avatar {
	vertical-align: bottom;
}

.avatar-avatar :deep(img) {
	image-rendering: pixelated;
}

.avatar-avatar--tiny {
	width: 16px;
	height: 16px;
	font-size: 0.7rem;
}

.avatar-avatar--small {
	width: 24px;
	height: 24px;
	font-size: 0.85rem;
}
</style>
