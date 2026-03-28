import { TILE_SIZE } from "../services/pixel";

export function validateSeason(season: string): boolean {
	return season === "s0";
}

export function validateTileCoordinates(tileX: number, tileY: number): boolean {
	return Number.isInteger(tileX) && Number.isInteger(tileY);
}

export function validatePixelCoordinates(x: number, y: number): boolean {
	return Number.isInteger(x) && Number.isInteger(y) &&
		   x >= 0 && x < TILE_SIZE &&
		   y >= 0 && y < TILE_SIZE;
}

export function validatePaginationPage(page: number): boolean {
	return Number.isInteger(page) && page >= 0;
}
