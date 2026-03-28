<template>
	<Dialog
		:draggable="false"
		:visible="isOpen"
		position="bottom"
	>
		<template #container>
			<div class="pixel-info-container">
				<div class="pixel-info-row pixel-info-header">
					<FlagIcon
						v-if="country"
						v-tooltip.top="country.name"
						:code="country.code"
						class="pixel-info-flag" />

					<span>{{ pixelData?.region.name }}</span>

					<div class="pixel-info-row pixel-info-coords">
						<GridIcon />
						<span
							v-tooltip.top="'Tile coordinates'"
							class="pixel-info-select"
						>
							{{ coords?.tile[0] }}&times;{{ coords?.tile[1] }}
						</span>
						<span
							v-tooltip.top="'Pixel coordinates'"
							class="pixel-info-select"
						>
							{{ (coords?.pixel[0] ?? 0) + 1 }}&times;{{ (coords?.pixel[1] ?? 0) + 1 }}
						</span>
					</div>

					<Button
						text
						rounded
						size="small"
						icon="_"
						severity="secondary"
						class="pixel-info-close-button"
						aria-label="Close"
						@click="$emit('close')"
					>
						<CloseIcon />
					</Button>
				</div>

				<div
					v-if="loading"
					class="pixel-info-content pixel-info-loading"
				>
					<ProgressSpinner
						:style="{
							width: '64px',
							height: '64px'
						}"
					/>
				</div>

				<div
					v-else-if="pixelData"
					class="pixel-info-content"
				>
					<div
						v-if="pixelData.paintedBy.id !== 0"
						class="pixel-info-section"
					>
						<div class="pixel-info-row">
							<UserLine
								:user="pixelData.paintedBy"
								:show-avatar="true"
								size="tiny"
							>
								<template #prefix>
									<span class="pixel-info-label">Painted by:</span>
								</template>
							</UserLine>
						</div>

						<div class="pixel-info-row pixel-info-date">
							<span
								v-tooltip.top="new Date(pixelData.paintedBy.paintedAt).toLocaleString(undefined, {
									dateStyle: 'long',
									timeStyle: 'short'
								})"
							>
								{{ moment(pixelData.paintedBy.paintedAt).fromNow() }}
							</span>
						</div>
					</div>

					<div
						v-else
						class="pixel-info-section"
					>
						<p class="pixel-info-empty">
							This pixel has not been painted yet.
						</p>
					</div>
				</div>

				<div
					v-else-if="failed"
					class="pixel-info-error"
				>
					<p>Failed to load pixel information</p>
				</div>

				<div
					v-if="pixelData"
					class="pixel-info-actions"
				>
					<Button
						size="small"
						:severity="isFavorite ? 'danger' : 'secondary'"
						:outlined="!isFavorite"
						@click="toggleFavorite"
					>
						<FavoriteOffIcon v-if="isFavorite" />
						<FavoriteOnIcon v-else />
						{{ isFavorite ? 'Unfavorite' : 'Favorite' }}
					</Button>

					<Button
						size="small"
						severity="danger"
						outlined
						@click="$emit('report')"
					>
						<ReportIcon />
						Report
					</Button>
				</div>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import ProgressSpinner from "primevue/progressspinner";
import moment from "moment";
import type { TileCoords } from "~/utils/coordinates";
import { tileCoordsToLngLat } from "~/utils/coordinates";
import { useFavorites } from "~/composables/useFavorites";
import { type UserProfile, useUserProfile } from "~/composables/useUserProfile";
import { useErrorToast } from "~/composables/useErrorToast";
import { COUNTRIES } from "~/utils/country";
import CloseIcon from "~/components/icons/CloseIcon.vue";
import FavoriteOffIcon from "~/components/icons/FavoriteOffIcon.vue";
import FavoriteOnIcon from "~/components/icons/FavoriteOnIcon.vue";
import GridIcon from "~/components/icons/GridIcon.vue";
import ReportIcon from "~/components/icons/ReportIcon.vue";

interface PixelData {
	paintedBy: {
		id: number;
		name: string;
		allianceId: number;
		allianceName: string;
		equippedFlag: number;
		discord?: string;
		paintedAt: string;
		verified?: boolean;
	};
	region: {
		id: number;
		cityId: number;
		name: string;
		number: number;
		countryId: number;
	};
}

const props = defineProps<{
	isOpen: boolean;
	coords: TileCoords | null;
}>();

const emit = defineEmits<{
	close: [];
	report: [];
	favoriteAdded: [];
	favoriteRemoved: [];
}>();

const pixelData = ref<PixelData | null>(null);
const loading = ref(false);
const failed = ref(false);
const favoriteId = ref<number | null>(null);
const userProfile = ref<UserProfile | null>(null);

const { addFavorite, removeFavorite } = useFavorites();
const { fetchUserProfile } = useUserProfile();
const { handleError } = useErrorToast();

const isFavorite = computed(() => favoriteId.value !== null);
const country = computed(() => COUNTRIES.find(c => c.id === pixelData.value?.region.countryId));

const checkIfFavorite = async () => {
	if (!props.coords) {
		return;
	}

	try {
		if (!userProfile.value) {
			favoriteId.value = null;
			return;
		}

		const [lng, lat] = tileCoordsToLngLat(props.coords);

		// Is this a favorite?
		const tolerance = 0.0001;
		const favorite = userProfile.value.favoriteLocations.find(
			item => Math.abs(item.latitude - lat) < tolerance && Math.abs(item.longitude - lng) < tolerance
		);

		favoriteId.value = favorite ? favorite.id : null;
	} catch (error: unknown) {
		console.error("Failed to check favorite status:", error);
		handleError(error);
		favoriteId.value = null;
	}
};

const fetchPixelData = async () => {
	if (!props.coords) {
		return;
	}

	const [tileX, tileY] = props.coords.tile;
	const [x, y] = props.coords.pixel;

	loading.value = true;
	failed.value = false;

	try {
		const config = useRuntimeConfig();
		pixelData.value = await $fetch(`${config.public.backendUrl}/s0/pixel/${tileX}/${tileY}`, {
			query: { x, y },
			credentials: "include"
		});

		// Check if this pixel is favorited
		await checkIfFavorite();
	} catch (error) {
		failed.value = true;
		console.error("Failed to fetch pixel data:", error);
		handleError(error);
	} finally {
		loading.value = false;
	}
};

const toggleFavorite = async () => {
	if (!props.coords) {
		return;
	}

	try {
		const [lng, lat] = tileCoordsToLngLat(props.coords);

		if (isFavorite.value && favoriteId.value !== null) {
			await removeFavorite(favoriteId.value);
			favoriteId.value = null;
			emit("favoriteRemoved");
		} else {
			const result = await addFavorite([lng, lat]);
			favoriteId.value = result.id;
			emit("favoriteAdded");
		}

		userProfile.value = await fetchUserProfile();
	} catch (error) {
		console.error("Failed to toggle favorite:", error);
		handleError(error);
	}
};

watch(() => props.isOpen, async (newValue) => {
	if (newValue) {
		userProfile.value = await fetchUserProfile();
		fetchPixelData();
	} else {
		pixelData.value = null;
		failed.value = false;
	}
});

watch(() => props.coords, () => {
	if (props.isOpen) {
		fetchPixelData();
	}
}, { deep: true });
</script>

<style scoped>
.pixel-info-container,
.pixel-info-content,
.pixel-info-section {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.pixel-info-container {
	padding: 1rem;
}

@media (min-width: 768px) {
	.pixel-info-container {
		width: 450px;
	}
}

.pixel-info-header {
	font-weight: 500;
	align-items: center;
	margin-block: calc(var(--p-button-sm-padding-x) * -0.5);
}

.pixel-info-close-button {
	margin-inline-start: calc(var(--p-button-sm-padding-x) * -0.5);
	margin-inline-end: calc(var(--p-button-sm-padding-x) * -1);
	aspect-ratio: 1;
}

.pixel-info-section {
	gap: 0.25rem;
}

.pixel-info-row {
	display: flex;
	gap: 0.5rem;
	font-size: 0.875rem;
}

.pixel-info-label {
	margin-inline-end: 0.25rem;
}

.pixel-info-empty {
	color: var(--p-text-muted-color);
	font-style: italic;
	margin: 0;
}

.pixel-info-error {
	padding: 1rem;
	text-align: center;
	color: var(--p-red-500);
}

.pixel-info-flag :deep(svg) {
	font-size: 1.25em;
}

.pixel-info-date {
	color: var(--p-text-muted-color);
	font-size: 0.8rem;
	font-weight: 300;
}

.pixel-info-coords {
	font-size: 0.8rem;
	margin-left: auto;
	gap: 0.5em;
	font-feature-settings: "tnum";
}

.pixel-info-select {
	user-select: text;
	cursor: auto;
}

.pixel-info-actions {
	display: flex;
	gap: 0.5rem;
	width: 100%;
}

.pixel-info-actions button {
	flex: 1;
}
</style>
