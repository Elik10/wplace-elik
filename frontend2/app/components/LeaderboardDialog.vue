<template>
	<Dialog
		modal
		dismissable-mask
		:draggable="false"
		:visible="isOpen"
		:style="{
			width: '50rem',
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
			<h2 class="leaderboard-dialog-title">Leaderboard</h2>
		</template>

		<div class="leaderboard-container">
			<Tabs v-model:value="category">
				<TabList>
					<Tab value="region">Regions</Tab>
					<Tab value="country">Countries</Tab>
					<Tab value="player">Players</Tab>
					<Tab value="alliance">Alliances</Tab>
				</TabList>
			</Tabs>

			<Tabs v-model:value="timePeriod">
				<TabList>
					<Tab value="today">Today</Tab>
					<Tab value="week">Week</Tab>
					<Tab value="month">Month</Tab>
					<Tab value="all-time">All Time</Tab>
				</TabList>
			</Tabs>

			<div v-if="category === 'region'" class="leaderboard-country-filter">
				<Select
					v-model="country"
					:options="countryOptions"
					option-label="label"
					option-value="value"
					placeholder="Select a country"
					class="leaderboard-country-select"
					fluid
					filter
					show-clear
				>
					<template #value="slotProps">
						<div v-if="slotProps.value" class="leaderboard-country-option">
							<FlagIcon :code="getCountryCode(slotProps.value) ?? ''" />
							<span>{{ getCountryName(slotProps.value) }}</span>
						</div>
						<span v-else>{{ slotProps.placeholder }}</span>
					</template>

					<template #option="slotProps">
						<div class="leaderboard-country-option">
							<FlagIcon :code="slotProps.option.code" />
							<span>{{ slotProps.option.label }}</span>
						</div>
					</template>
				</Select>
			</div>

			<div v-if="loading" class="leaderboard-loading-container">
				<ProgressSpinner />
			</div>

			<div v-else-if="error" class="leaderboard-error-container">
				<Message severity="error">{{ error }}</Message>
			</div>

			<div v-else-if="data && data.length > 0" class="leaderboard-content">
				<DataTable
					v-if="category === 'region'"
					:value="data"
					class="leaderboard-table"
				>
					<Column field="number" header="#" class="leaderboard-id" header-class="leaderboard-id">
						<template #body="slotProps">
							{{ slotProps.index + 1 }}
						</template>
					</Column>
					<Column field="name" header="Region">
						<template #body="slotProps">
							<div class="leaderboard-country-cell">
								<FlagIcon :code="getCountryCode(slotProps.data.countryId)" />
								<RouterLink
									v-tooltip.top="'Click to visit region'"
									class="leaderboard-navigate"
									:to="getRegionRoute(slotProps.data)"
									@click.prevent="navigateToRegion(slotProps.data)"
								>
									{{ slotProps.data.name }}
								</RouterLink>
							</div>
						</template>
					</Column>
					<Column field="pixelsPainted" header="Pixels Painted" class="leaderboard-count" header-class="leaderboard-count">
						<template #body="slotProps">
							{{ slotProps.data.pixelsPainted.toLocaleString() }}
						</template>
					</Column>
				</DataTable>

				<DataTable
					v-if="category === 'country'"
					:value="data"
					class="leaderboard-table"
				>
					<Column header="#" class="leaderboard-id" header-class="leaderboard-id">
						<template #body="slotProps">
							{{ slotProps.index + 1 }}
						</template>
					</Column>
					<Column field="id" header="Country">
						<template #body="slotProps">
							<div class="leaderboard-country-cell">
								<FlagIcon :code="getCountryCode(slotProps.data.id)" />
								<span>{{ getCountryName(slotProps.data.id) }}</span>
							</div>
						</template>
					</Column>
					<Column field="pixelsPainted" header="Pixels Painted" class="leaderboard-count" header-class="leaderboard-count">
						<template #body="slotProps">
							{{ slotProps.data.pixelsPainted.toLocaleString() }}
						</template>
					</Column>
				</DataTable>

				<DataTable
					v-if="category === 'player'"
					:value="data"
					class="leaderboard-table"
				>
					<Column header="#" class="leaderboard-id" header-class="leaderboard-id">
						<template #body="slotProps">
							{{ slotProps.index + 1 }}
						</template>
					</Column>
					<Column field="name" header="Player">
						<template #body="slotProps">
							<div class="leaderboard-player-cell">
								<UserLine :user="slotProps.data" :show-avatar="true" size="small" />
							</div>
						</template>
					</Column>
					<Column field="pixelsPainted" header="Pixels Painted" class="leaderboard-count" header-class="leaderboard-count">
						<template #body="slotProps">
							{{ slotProps.data.pixelsPainted.toLocaleString() }}
						</template>
					</Column>
				</DataTable>

				<DataTable
					v-if="category === 'alliance'"
					:value="data"
					class="leaderboard-table"
				>
					<Column header="#" class="leaderboard-id" header-class="leaderboard-id">
						<template #body="slotProps">
							{{ slotProps.index + 1 }}
						</template>
					</Column>
					<Column field="name" header="Alliance" />
					<Column field="pixelsPainted" header="Pixels Painted" class="leaderboard-count" header-class="leaderboard-count">
						<template #body="slotProps">
							{{ slotProps.data.pixelsPainted.toLocaleString() }}
						</template>
					</Column>
				</DataTable>
			</div>

			<div v-else class="leaderboard-empty">
				<p>No results</p>
			</div>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import Dialog from "primevue/dialog";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import Select from "primevue/select";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import ProgressSpinner from "primevue/progressspinner";
import Message from "primevue/message";
import { COUNTRIES } from "~/utils/country";

const props = defineProps<{
	isOpen: boolean;
}>();

const emit = defineEmits<{
	close: [];
	navigate: [coords: LngLat];
}>();

const config = useRuntimeConfig();

interface LeaderboardEntry {
	id?: number;
	name?: string;
	pixelsPainted: number;
	lastLatitude?: number;
	lastLongitude?: number;
	allianceName?: string;
	allianceId?: number;
	equippedFlag?: number;
	picture?: string;
	discord?: string;
	number?: number;
	cityId?: number;
	countryId?: number;
}

const category = ref<"region" | "country" | "player" | "alliance">("region");
const timePeriod = ref<"today" | "week" | "month" | "all-time">("today");
const country = ref<number | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const data = ref<LeaderboardEntry[]>([]);

const countryOptions = computed(() => COUNTRIES.map(country => ({
	label: country.name,
	value: country.id,
	code: country.code
})));

const getCountryCode = (countryId: number) => COUNTRIES.find((c) => c.id === countryId)?.code;
const getCountryName = (countryId: number) => COUNTRIES.find((c) => c.id === countryId)?.name;

const getRegionRoute = (region: LeaderboardEntry): string => {
	if (!region.lastLongitude || !region.lastLatitude) {
		return "";
	}

	const url = new URL(globalThis.location.href);
	url.searchParams.set("lng", region.lastLongitude.toFixed(6));
	url.searchParams.set("lat", region.lastLatitude.toFixed(6));
	url.searchParams.set("zoom", WIDE_ZOOM_LEVEL.toFixed(2));
	return url.pathname + url.search;
};

const fetchLeaderboard = async () => {
	loading.value = true;
	error.value = null;

	try {
		let url = `${config.public.backendUrl}/leaderboard/${category.value}/${timePeriod.value}`;
		if (category.value === "region") {
			url += country.value ? `/${country.value}` : "/0";
		}

		const res = await $fetch(url);
		data.value = Array.isArray(res) ? res : [];
	} catch (error_) {
		console.error("Error fetching leaderboard:", error_);
		error.value = error_ instanceof Error ? error_.message : "Failed to load leaderboard data";
		data.value = [];
	} finally {
		loading.value = false;
	}
};

watch([category, timePeriod, country], () => {
	if (props.isOpen) {
		fetchLeaderboard();
	}
});

watch(() => props.isOpen, (newValue) => {
	if (newValue) {
		fetchLeaderboard();
	}
});

const handleClose = () => emit("close");

const navigateToRegion = (region: LeaderboardEntry) => {
	if (!region.lastLatitude || !region.lastLongitude) {
		return;
	}

	emit("navigate", [region.lastLongitude, region.lastLatitude]);
	handleClose();
};
</script>

<style scoped>
.leaderboard-dialog-title {
	margin: 0;
	font-size: inherit;
}

.leaderboard-container {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
	height: 100%;
}

.leaderboard-country-option {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.leaderboard-loading-container,
.leaderboard-error-container,
.leaderboard-empty {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 3rem;
	text-align: center;
}

.leaderboard-content {
	flex: 1;
	overflow-y: auto;
}

.leaderboard-table {
	width: 100%;
}

:deep(.leaderboard-id),
:deep(.leaderboard-count) {
	width: 1px;
	font-feature-settings: "tnum";
	white-space: nowrap;
}

:deep(.leaderboard-count) {
	text-align: end;
}

.leaderboard-country-cell,
.leaderboard-player-cell {
	display: flex;
	align-items: center;
	gap: var(--p-datatable-body-cell-padding);
}

:deep(.flag-icon-wrapper) {
	font-size: 1.25em;
}

.leaderboard-navigate {
	display: block;
	width: 100%;
	color: var(--p-tabs-tab-active-color);
}
</style>
