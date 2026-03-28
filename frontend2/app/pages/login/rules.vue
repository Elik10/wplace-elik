<template>
	<div class="form">
		<h2 class="head">First, let’s go over some rules..</h2>
		<p>These rules are to ensure you have a safe and enjoyable experience on gplace.</p>

		<div class="section">
			<Rules :is-visible="isVisible" />
		</div>

		<div class="buttons-container">
			<Button
				v-slot="slotProps"
				as-child
				severity="primary"
				type="submit"
			>
				<RouterLink
					:to="registerURL"
					:class="slotProps.class"
					:style="{ 'text-decoration': 'none' }"
				>
					Continue
				</RouterLink>
			</Button>
		</div>
	</div>
</template>

<script setup lang="ts">
import Button from "primevue/button";

definePageMeta({
	layout: "auth"
});

const route = useRoute();

const isVisible = ref(false);
const registerURL = ref("/login/register");

onMounted(async () => {
	const returnTo = route.query.r as string;
	if (returnTo) {
		const params = new URLSearchParams([["r", returnTo]]);
		registerURL.value = `/login/register?${params.toString()}`;
	}

	isVisible.value = true;
});
</script>

<style scoped>
/* */
</style>
