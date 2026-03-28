<template>
	<Button
		severity="secondary"
		icon="_"
		raised
		rounded
		class="map-button"
	>
		<slot />
	</Button>
</template>

<style scoped>
.map-button {
	font-size: 1.15rem;
	aspect-ratio: 1;
}
</style>
