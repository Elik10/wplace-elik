export const TILE_COUNT = 2048;
export const TILE_SIZE = 1000;
export const ZOOM_LEVEL = 11;
export const WIDE_ZOOM_LEVEL = 12.5;
export const CLOSE_ZOOM_LEVEL = 15;

// Radius of the Earth in metres
const R = 6_371_000;

export type Coords = [number, number];
export type LngLat = Coords;

export interface TileCoords {
	tile: Coords;
	pixel: Coords;
}

export interface MeasureArea {
	topLeft: TileCoords;
	bottomRight: TileCoords;
}

export interface RectCoords<T extends TileCoords | LngLat> {
	topLeft: T;
	topRight: T;
	bottomLeft: T;
	bottomRight: T;
}

export function lngLatToTileCoords(lngLat: LngLat): TileCoords {
	const [lng, lat] = lngLat;
	const n = Math.pow(2, ZOOM_LEVEL);

	const tileXFloat = (lng + 180) / 360 * n;
	const latRad = lat * Math.PI / 180;
	const tileYFloat = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;

	const [tileX, tileY] = [Math.floor(tileXFloat), Math.floor(tileYFloat)];
	const [x, y] = [Math.floor((tileXFloat - tileX) * TILE_SIZE), Math.floor((tileYFloat - tileY) * TILE_SIZE)];

	return {
		tile: [Math.max(0, Math.min(TILE_COUNT - 1, tileX)), Math.max(0, Math.min(TILE_COUNT - 1, tileY))],
		pixel: [Math.max(0, Math.min(TILE_SIZE - 1, x)), Math.max(0, Math.min(TILE_SIZE - 1, y))]
	};
}

export function tileCoordsToLngLat(coords: TileCoords): LngLat {
	const [tileX, tileY] = coords.tile;
	const [x, y] = coords.pixel;

	const [tileXFloat, tileYFloat] = [tileX + ((x + 0.5) / TILE_SIZE), tileY + ((y + 0.5) / TILE_SIZE)];

	// Web Mercator inverse projection
	const n = Math.pow(2, ZOOM_LEVEL);
	const lng = (tileXFloat / n * 360) - 180;
	const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * tileYFloat / n)));
	const lat = latRad * 180 / Math.PI;
	return [lng, lat];
}

export function snapToPixelGrid(lngLat: LngLat): LngLat {
	return tileCoordsToLngLat(lngLatToTileCoords(lngLat));
}

export function getPixelId(coords: TileCoords): string {
	const [tileX, tileY] = coords.tile;
	const [x, y] = coords.pixel;
	return `${tileX}-${tileY}-${x}-${y}`;
}

export function getPixelBounds(coords: TileCoords, inset = 0): RectCoords<LngLat> {
	const [tileX, tileY] = coords.tile;
	const [x, y] = coords.pixel;

	const [tileXLeft, tileYTop] = [tileX + ((x + inset) / TILE_SIZE), tileY + ((y + inset) / TILE_SIZE)];
	const [tileXRight, tileYBottom] = [tileX + ((x + 1 - inset) / TILE_SIZE), tileY + ((y + 1 - inset) / TILE_SIZE)];

	const n = Math.pow(2, ZOOM_LEVEL);

	const [lngLeft, lngRight] = [(tileXLeft / n * 360) - 180, (tileXRight / n * 360) - 180];
	const [latTopRad, latBottomRad] = [
		Math.atan(Math.sinh(Math.PI * (1 - 2 * tileYTop / n))),
		Math.atan(Math.sinh(Math.PI * (1 - 2 * tileYBottom / n)))
	];
	const [latTop, latBottom] = [latTopRad * 180 / Math.PI, latBottomRad * 180 / Math.PI];

	return {
		topLeft: [lngLeft, latTop],
		topRight: [lngRight, latTop],
		bottomLeft: [lngLeft, latBottom],
		bottomRight: [lngRight, latBottom]
	};
}

export function getPixelsBetween(from: TileCoords, to: TileCoords): TileCoords[] {
	const pixels: TileCoords[] = [];

	// TODO: Support pixels between tiles
	if (from.tile[0] !== to.tile[0] || from.tile[1] !== to.tile[1]) {
		return [to];
	}

	let [x0, y0] = from.pixel;
	const [x1, y1] = to.pixel;

	const [dx, dy] = [Math.abs(x1 - x0), Math.abs(y1 - y0)];
	const [sx, sy] = [x0 < x1 ? 1 : -1, y0 < y1 ? 1 : -1];
	let err = dx - dy;

	while (true) {
		pixels.push({
			tile: from.tile,
			pixel: [x0, y0]
		});

		if (x0 === x1 && y0 === y1) {
			break;
		}

		const e2 = err * 2;
		if (e2 > -dy) {
			err -= dy;
			x0 += sx;
		}
		if (e2 < dx) {
			err += dx;
			y0 += sy;
		}
	}

	return pixels;
}

export function getTileBounds(tileX: number, tileY: number): [LngLat, LngLat, LngLat, LngLat] {
	const { topLeft } = getPixelBounds({
		tile: [tileX, tileY],
		pixel: [0, 0]
	});

	const { topRight, bottomRight } = getPixelBounds({
		tile: [tileX, tileY],
		pixel: [TILE_SIZE - 1, TILE_SIZE - 1]
	});

	return [
		topLeft,
		[topRight[0], topLeft[1]],
		bottomRight,
		[topLeft[0], bottomRight[1]]
	];
}

export function getPixelsInArea(rectCoords: RectCoords<TileCoords>): TileCoords[] {
	const pixels: TileCoords[] = [];
	const { topLeft, bottomRight } = rectCoords;
	const [startTileX, startTileY] = topLeft.tile;
	const [endTileX, endTileY] = bottomRight.tile;

	for (let tileY = startTileY; tileY <= endTileY; tileY++) {
		for (let tileX = startTileX; tileX <= endTileX; tileX++) {
			const startX = tileX === startTileX ? topLeft.pixel[0] : 0;
			const endX = tileX === endTileX ? bottomRight.pixel[0] : TILE_SIZE - 1;
			const startY = tileY === startTileY ? topLeft.pixel[1] : 0;
			const endY = tileY === endTileY ? bottomRight.pixel[1] : TILE_SIZE - 1;

			for (let y = startY; y <= endY; y++) {
				for (let x = startX; x <= endX; x++) {
					pixels.push({
						tile: [tileX, tileY],
						pixel: [x, y]
					});
				}
			}
		}
	}

	return pixels;
}

export function createMeasureArea(topLeft: TileCoords, bottomRight: TileCoords): MeasureArea {
	const [minX, maxX] = [
		Math.min(topLeft.tile[0], bottomRight.tile[0]),
		Math.max(topLeft.tile[0], bottomRight.tile[0])
	];
	const [minY, maxY] = [
		Math.min(topLeft.tile[1], bottomRight.tile[1]),
		Math.max(topLeft.tile[1], bottomRight.tile[1])
	];

	const [minPixelX, maxPixelX] = [
		Math.min(topLeft.pixel[0], bottomRight.pixel[0]),
		Math.max(topLeft.pixel[0], bottomRight.pixel[0])
	];
	const [minPixelY, maxPixelY] = [
		Math.min(topLeft.pixel[1], bottomRight.pixel[1]),
		Math.max(topLeft.pixel[1], bottomRight.pixel[1])
	];

	return {
		topLeft: {
			tile: [minX, minY],
			pixel: [minPixelX, minPixelY]
		},
		bottomRight: {
			tile: [maxX, maxY],
			pixel: [maxPixelX, maxPixelY]
		}
	};
}

export function createRectCoords({ topLeft, bottomRight }: MeasureArea): RectCoords<TileCoords> {
	return {
		topLeft,
		topRight: {
			tile: [bottomRight.tile[0], topLeft.tile[1]],
			pixel: [bottomRight.pixel[0], topLeft.pixel[1]]
		},
		bottomLeft: {
			tile: [topLeft.tile[0], bottomRight.tile[1]],
			pixel: [topLeft.pixel[0], bottomRight.pixel[1]]
		},
		bottomRight
	};
}

export function calculateRectArea({ topLeft, bottomRight }: RectCoords<TileCoords>): number {
	const { topLeft: [lng1, lat1] } = getPixelBounds(topLeft);
	const { bottomRight: [lng2, lat2] } = getPixelBounds(bottomRight);

	const [phi1, phi2] = [
		lat1 * Math.PI / 180,
		lat2 * Math.PI / 180
	];
	const [lambda1, lambda2] = [
		lng1 * Math.PI / 180,
		lng2 * Math.PI / 180
	];

	return Math.pow(R, 2) * Math.abs(Math.sin(phi1) - Math.sin(phi2)) * Math.abs(lambda1 - lambda2);
}
