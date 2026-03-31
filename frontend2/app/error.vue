<template>
	<div class="root">
		<Card
			:class="['root-card', isDev ? 'root-card-dev' : '']">
			<template #header>
				<RouterLink
					to="/"
					class="logo">
					<img
						src="/img/gplace-banner.png"
						alt="gplace"
					>
				</RouterLink>
			</template>

			<template #content>
				<h2 class="head">{{ error.statusCode }}</h2>
				<p class="subhead">{{ error.statusMessage }}</p>

				<div v-if="isDev">
					<p class="message">{{ error.message }}</p>
					<pre class="stack">{{ error.stack }}</pre>
				</div>

				<Button
					v-slot="slotProps"
					as-child
					severity="primary"
					variant="link"
					fluid
				>
					<RouterLink
						to="/"
						:class="slotProps.class"
						:style="{ 'text-decoration': 'none' }"
					>
						Back to gplace &rarr;
					</RouterLink>
				</Button>
			</template>
		</Card>
	</div>
</template>

<script setup lang="ts">
import "~/assets/common.scss";
import Card from "primevue/card";
import type { NuxtError } from "#app";

const isDev = process.env.NODE_ENV === "development";

defineProps<{
	error: NuxtError
}>();
</script>

<style scoped>
:deep(html),
:deep(body) {
	min-height: 100svh;
}

.root {
	display: flex;
	position: relative;
	z-index: 2;
	min-height: 100svh;
	padding: 50px 1rem;
	background: #4169e1;
}

.root-card {
	width: 100%;
	max-width: 400px;
	margin: auto;
	box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);
}

.root-card.root-card-dev {
	max-width: 800px;
}

.logo {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	margin: 2rem 0 1.25rem 0;
	color: inherit;
	text-decoration: none;
}

.logo img {
	width: min(100%, 14rem);
	height: auto;
	image-rendering: pixelated;
}

.head,
.subhead {
	margin-bottom: 1rem;
	text-align: center;
	font-size: 1.75rem;
	font-weight: 600;
}

.subhead {
	font-size: 1.25rem;
}

.message {
	text-align: center;
	font-size: 0.9rem;
	overflow-wrap: anywhere;
}

.stack {
	font-size: 0.75rem;
}
</style>
