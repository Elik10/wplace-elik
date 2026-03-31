<template>
	<Dialog
		modal
		dismissable-mask
		:draggable="false"
		:visible="isOpen"
		:style="{
			width: '40rem',
			maxWidth: '100svw',
			height: 'calc(100svh - 4rem)',
		}"
		:breakpoints="{
			'500px': 'calc(100svw - 4rem)',
			'640px': '90svw',
		}"
		@update:visible="handleClose"
	>
		<template #header>
			<div />
		</template>

		<div>
			<div class="about-logo">
				<img
					src="/img/gplace-banner.png"
					alt="gplace"
				>
			</div>

			<div class="section">
				<p>
					gplace is a free unofficial open source backend for wplace. We aim to give the freedom and flexibility for all users to be able to make their own private wplace experience for themselves, their friends, or even their community.
				</p>

				<p v-if="isGplaceLive">
					<strong>This is the official gplace.live instance.</strong> Join our <a href="https://discord.gg/ZRC4DnP9Z2">Discord community</a>!
				</p>

				<p v-else>
					<strong>This is an instance of gplace.</strong> It is not affiliated with the gplace project. Please contact the administrators of this instance for any questions or issues.
				</p>
			</div>

			<div class="section">
				<h3>Rules</h3>

				<p>
					To keep gplace fair and safe for everyone, you are expected to follow these rules. Violations may result in a temporary or permanent ban.
				</p>

				<Rules :is-visible="isOpen" />
			</div>

			<p class="muted">
				gplace is developed in <a href="https://github.com/Elik10/wplace-elik" target="_blank">the gplace repository</a>. It uses maps hosted by <a href="https://openfreemap.org/" target="_blank">OpenFreeMap</a>.
			</p>

			<p class="muted">
				<a href="https://www.openmaptiles.org/" target="_blank">© OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>
			</p>

			<p class="muted">
				Satellite data © Google
			</p>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import Dialog from "primevue/dialog";

defineProps<{
	isOpen: boolean;
}>();

const emit = defineEmits<{
	close: [];
}>();

const isGplaceLive = ref(false);

onMounted(() => {
	isGplaceLive.value = location.hostname === "openplace.live";
});

const handleClose = () => {
	emit("close");
};
</script>

<style scoped>
.about-logo {
	display: flex;
	align-items: center;
	justify-content: center;
	margin: 0 0 3.5rem 0;
}

.about-logo img {
	width: min(100%, 21rem);
	height: auto;
	image-rendering: pixelated;
}

.section {
	margin: 3rem 0;
}

.muted {
	color: var(--p-text-muted-color);
	font-size: 0.85rem;
}

.muted a {
	color: inherit;
}
</style>
