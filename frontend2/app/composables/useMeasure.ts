import { computed, ref } from "vue";
import { calculateRectArea, createMeasureArea, createRectCoords, TILE_SIZE, type TileCoords } from "~/utils/coordinates";

export enum MeasureState {
	Idle = "idle",
	SelectTopLeft = "select-top-left",
	SelectBottomRight = "select-bottom-right"
}

const measureState = ref(MeasureState.Idle);
const topLeftCoords = ref<TileCoords | null>(null);
const bottomRightCoords = ref<TileCoords | null>(null);

export const useMeasure = () => {
	const startMeasure = () => {
		measureState.value = MeasureState.SelectTopLeft;
		topLeftCoords.value = null;
		bottomRightCoords.value = null;
	};

	const cancelMeasure = () => {
		measureState.value = MeasureState.Idle;
		topLeftCoords.value = null;
		bottomRightCoords.value = null;
	};

	const selectCorner = (coords: TileCoords) => {
		if (measureState.value === MeasureState.SelectTopLeft) {
			topLeftCoords.value = coords;
			measureState.value = MeasureState.SelectBottomRight;
		} else if (measureState.value === MeasureState.SelectBottomRight) {
			bottomRightCoords.value = coords;
			measureState.value = MeasureState.Idle;
		}
	};

	const measureArea = computed(() => {
		if (!topLeftCoords.value || !bottomRightCoords.value) {
			return null;
		}

		return createMeasureArea(topLeftCoords.value, bottomRightCoords.value);
	});

	const rectCoords = computed(() => {
		if (!measureArea.value) {
			return null;
		}

		return createRectCoords(measureArea.value);
	});

	const areaSquareMeters = computed(() => {
		if (!rectCoords.value) {
			return 0;
		}

		return calculateRectArea(rectCoords.value);
	});

	const widthPixels = computed(() => {
		if (!measureArea.value) {
			return 0;
		}

		const { topLeft, bottomRight } = measureArea.value;
		const tileWidth = bottomRight.tile[0] - topLeft.tile[0];
		const pixelWidth = bottomRight.pixel[0] - topLeft.pixel[0];
		return tileWidth * TILE_SIZE + pixelWidth + 1;
	});

	const heightPixels = computed(() => {
		if (!measureArea.value) {
			return 0;
		}

		const { topLeft, bottomRight } = measureArea.value;
		const tileHeight = bottomRight.tile[1] - topLeft.tile[1];
		const pixelHeight = bottomRight.pixel[1] - topLeft.pixel[1];
		return tileHeight * TILE_SIZE + pixelHeight + 1;
	});

	const totalPixels = computed(() => widthPixels.value * heightPixels.value);

	const instruction = computed(() => {
		switch (measureState.value) {
		case MeasureState.Idle:
			return null;
		case MeasureState.SelectTopLeft:
			return "Select top-left corner";
		case MeasureState.SelectBottomRight:
			return "Select bottom-right corner";
		}
	});

	const isMeasuring = computed(() => measureState.value !== MeasureState.Idle);

	return {
		measureState,
		topLeftCoords,
		bottomRightCoords,
		measureArea,
		rectCoords,
		widthPixels,
		heightPixels,
		totalPixels,
		areaSquareMeters,
		instruction,
		isMeasuring,
		startMeasure,
		cancelMeasure,
		selectCorner
	};
};
