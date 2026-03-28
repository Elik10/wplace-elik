<template>
	<Dialog
		:modal="isMobile"
		dismissable-mask
		:draggable="false"
		:position="isMobile ? 'top' : 'topright'"
		:visible="isOpen"
		:style="{
			marginRight: isMobile ? null : '4.5rem'
		}"
	>
		<template #container>
			<div class="search-box">
				<div class="search-input-container">
					<InputGroup class="search-input-group">
						<Button
							v-if="isMobile"
							v-tooltip.bottom="'Close'"
							severity="secondary"
							text
							@click="close"
						>
							<BackIcon />
						</Button>

						<AutoComplete
							id="q"
							ref="inputRef"
							v-model="query"
							:suggestions="results"
							class="search-input-box"
							placeholder="Search the world and more…"
							@complete="handleSearch"
							@item-select="onItemSelect"
							@keydown="handleKeyDown"
						>
							<template #option="{ option }">
								<div class="search-result-item">
									<div class="search-result-name">{{ option.name }}</div>
									<div class="search-result-country">{{ option.country }}</div>
								</div>
							</template>
						</AutoComplete>

						<Button
							v-tooltip.bottom="'Random location'"
							severity="secondary"
							text
							@click="goToRandom"
						>
							<RandomIcon />
						</Button>
					</InputGroup>
				</div>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import InputGroup from "primevue/inputgroup";
import AutoComplete from "primevue/autocomplete";
import Button from "primevue/button";
import { useErrorToast } from "~/composables/useErrorToast";
import { DEFAULT_LOCATIONS } from "~/utils/default-locations";
import BackIcon from "~/components/icons/BackIcon.vue";
import RandomIcon from "~/components/icons/RandomIcon.vue";

interface AutocompleteResult {
	type: "Feature";
	geometry: {
		type: "Point";
		coordinates: [number, number];
	};
	properties: {
		id: number;
		name: string;
		label: string;
	};
	bbox: [number, number, number, number];
}

interface AutocompleteResults {
	type: "FeatureCollection";
	features: AutocompleteResult[];
}

interface SearchResult {
	name: string;
	country: string;
	bbox: [number, number, number, number];
}

defineProps<{
	isOpen: boolean;
}>();

const emit = defineEmits<{
	close: [];
	select: [bbox: [number, number, number, number]];
	goToRandom: [];
}>();

const DEFAULT_RESULTS = DEFAULT_LOCATIONS.map((item): SearchResult => ({
	name: item.name,
	country: item.country,
	bbox: [
		item.coords[1] - 0.05,
		item.coords[0] - 0.05,
		item.coords[1] + 0.05,
		item.coords[0] + 0.05
	]
}));

const isMobile = ref(false);
const inputRef = ref();
const query = ref("");
const results = ref<SearchResult[]>(DEFAULT_RESULTS);

const { handleError } = useErrorToast();

onMounted(() => {
	const widthQuery = globalThis.matchMedia("(max-width: 768px)");
	isMobile.value = widthQuery.matches;

	const handleWidthChange = (e: MediaQueryListEvent) => isMobile.value = e.matches;
	widthQuery.addEventListener("change", handleWidthChange);

	onUnmounted(() => {
		widthQuery.removeEventListener("change", handleWidthChange);
	});
});

const handleSearch = async (event: { query: string }) => {
	const text = event.query.trim();
	if (text === "") {
		results.value = DEFAULT_RESULTS;
		return;
	}

	try {
		const config = useRuntimeConfig();
		const response = await $fetch<AutocompleteResults>(`${config.public.backendUrl}/v1/autocomplete`, {
			query: { text }
		});
		results.value = response.features?.map(item => ({
			name: item.properties.name,
			country: item.properties.label.split(", ")
				.pop() ?? "",
			bbox: item.bbox
		})) ?? [];
	} catch (error) {
		handleError(error);
		results.value = [];
	}
};

const onItemSelect = (event: { value: SearchResult }) => {
	emit("select", event.value.bbox);
	close();
};

const handleKeyDown = (e: KeyboardEvent) => {
	switch (e.key) {
	case "Escape":
		close();
		break;
	}
};

const close = () => {
	emit("close");
	query.value = "";
	results.value = DEFAULT_RESULTS;
};

const goToRandom = () => {
	emit("goToRandom");
	close();
};

const focusInput = async () => {
	await nextTick();

	// TODO: Is there really not a better way?
	const inputElement = inputRef.value?.$el?.querySelector("input");
	inputElement?.focus();
};

defineExpose({
	focusInput
});
</script>

<style scoped>
.search-box {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	max-width: 350px;
}

@media (min-width: 768px) {
	.search-box {
		width: 350px;
	}
}

.search-input-container {
	border-radius: var(--p-inputgroup-addon-border-radius);
}

.search-input-group {
	display: flex;
	width: 100%;
}

.search-input-box {
	flex: 1;
}

.search-result-item {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.search-result-name {
	font-weight: 500;
}

.search-result-country {
	font-size: 0.9em;
	color: var(--p-text-muted-color);
}
</style>
