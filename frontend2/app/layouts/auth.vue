<template>
	<div>
		<canvas ref="bgCanvas" class="bg-canvas" />

		<div class="root">
			<Card class="root-card">
				<template #header>
					<RouterLink
						:to="returnTo"
						class="logo">
						<img
							src="/img/logo-512x512.png"
							alt=""
							width="64"
							height="64"
						>
					</RouterLink>
				</template>

				<template #content>
					<slot />
				</template>
			</Card>
		</div>
	</div>
</template>

<script setup lang="ts">
import "~/assets/common.scss";
import Card from "primevue/card";
import { palette } from "~/utils/palette";

const route = useRoute();

const bgCanvas = ref<HTMLCanvasElement | null>(null);
const returnTo = ref("/");

let lastReset = 0;
let resetTimer: ReturnType<typeof setTimeout> | null = null;
let tickTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
	returnTo.value = route.query.r as string ?? "/";

	resetCanvas();
	window.addEventListener("resize", resetCanvas);
});

onUnmounted(() => {
	window.removeEventListener("resize", resetCanvas);
});

const resetCanvas = () => {
	if (!bgCanvas.value) {
		return;
	}

	if (resetTimer) {
		clearTimeout(resetTimer);
	}

	if (lastReset + 100 > Date.now()) {
		resetTimer = setTimeout(resetCanvas, 100);
		return;
	}

	lastReset = Date.now();

	const ctx = bgCanvas.value.getContext("2d");
	if (!ctx) {
		return;
	}

	const oldImage = ctx.getImageData(0, 0, bgCanvas.value.width, bgCanvas.value.height);

	const width = bgCanvas.value.clientWidth / 10;
	const height = Math.floor((bgCanvas.value.clientHeight * width) / bgCanvas.value.clientWidth);
	bgCanvas.value.width = width;
	bgCanvas.value.height = height;

	ctx.putImageData(oldImage, 0, 0);

	if (tickTimer) {
		clearTimeout(tickTimer);
	}

	tickTimer = setTimeout(canvasTick, 200);
};

const canvasTick = () => {
	if (!bgCanvas.value) {
		return;
	}

	const ctx = bgCanvas.value.getContext("2d");
	if (!ctx) {
		return;
	}

	const width = bgCanvas.value.width;
	const height = bgCanvas.value.height;

	for (let i = 0; i < 5; i++) {
		const x = Math.floor(Math.random() * width);
		const y = Math.floor(Math.random() * height);
		const color = palette[Math.floor(Math.random() * palette.length)]!;
		ctx.fillStyle = `rgba(${color.rgba.join(",")})`;
		ctx.fillRect(x, y, 1, 1);
	}

	tickTimer = setTimeout(canvasTick, 25);
};
</script>

<style scoped>
.bg-canvas {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	width: 100%;
	height: 100%;
	z-index: 1;
	opacity: 0.75;
	background: #4169e1;
	image-rendering: pixelated;
	user-select: none;
	pointer-events: none;
}

.root {
	display: flex;
	position: relative;
	z-index: 2;
	min-height: 100svh;
	padding: 50px 1rem;
}

.root-card {
	width: 100%;
	max-width: 400px;
	margin: auto;
	box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);
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
	width: 3.15rem;
	height: 3.15rem;
}

:deep(.form) {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

:deep(.form > p) {
	margin-block: 0;
}

:deep(.head) {
	margin-bottom: 1.5rem;
	text-align: center;
	font-size: 1.75rem;
	font-weight: 600;
}

:deep(.agreement),
:deep(.reset-link) {
	font-size: 0.9rem;
}

:deep(.buttons-container) {
	display: flex;
	flex-direction: row;
	justify-content: stretch;
	gap: 1rem;
	width: 100%;
}

:deep(.buttons-container > *) {
	width: 100%;
}
</style>
