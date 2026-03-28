<template>
	<span class="icon-wrapper">
		<slot />
	</span>
</template>

<style scoped>
.icon-wrapper {
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.icon-wrapper :deep(svg) {
	display: inline-block;
	width: 1em;
	height: 1em;
}
</style>
