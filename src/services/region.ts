import { PrismaClient } from "@prisma/client";
import { iso1A2Code } from "country-coder";
import { TILE_SIZE } from "./pixel";
import { COUNTRIES } from "../utils/country.js";

export interface Region {
	id: number;
	cityId: number;
	name: string;
	number: number;
	countryId: number;
	flagId: number;
}

interface Point {
	latitude: number;
	longitude: number;
	id: number;
	cityId: number;
	name: string;
	number: number;
	countryId: number;
}

interface ReverseLocalityResult {
	countryId: number | null;
	name: string | null;
}

const countryIdsByCode = new Map(COUNTRIES.map((country) => [country.code.toUpperCase(), country.id]));
export class RegionService {
	constructor(private prisma: PrismaClient) {}

	private cache = new Map<string, Region>();
	private inflight = new Map<string, Promise<Region>>();
	private reverseCountryCache = new Map<string, number | null>();
	private reverseCountryInflight = new Map<string, Promise<number | null>>();
	private reverseLocalityCache = new Map<string, ReverseLocalityResult>();
	private reverseLocalityInflight = new Map<string, Promise<ReverseLocalityResult>>();
	private static indexLoaded = false;
	private static indexLoadingPromise: Promise<void> | null = null;
	private static binSizeDeg = 1;
	private static bins = new Map<string, {
		id: number;
		cityId: number;
		name: string;
		number: number;
		countryId: number;
		latitude: number;
		longitude: number
	}[]>();
	private static kd: { nearest: (pt: { latitude: number; longitude: number }) => Point | null } | null = null;
	private staticKey(lat: number, lon: number): string {
		const rLat = Math.round(lat * 10_000) / 10_000;
		const rLon = Math.round(lon * 10_000) / 10_000;
		return `${rLat}:${rLon}`;
	}
	private countryLookupKey(lat: number, lon: number): string {
		const rLat = Math.round(lat * 1000) / 1000;
		const rLon = Math.round(lon * 1000) / 1000;
		return `${rLat}:${rLon}`;
	}
	private localityLookupKey(lat: number, lon: number): string {
		const rLat = Math.round(lat * 100) / 100;
		const rLon = Math.round(lon * 100) / 100;
		return `${rLat}:${rLon}`;
	}
	private static binKey(lat: number, lon: number): string {
		const s = RegionService.binSizeDeg;
		const bLat = Math.floor(lat / s) * s;
		const bLon = Math.floor(lon / s) * s;
		return `${bLat}:${bLon}`;
	}
	private static neighbors(lat: number, lon: number, radiusBins: number): string[] {
		const s = RegionService.binSizeDeg;
		const bLat = Math.floor(lat / s);
		const bLon = Math.floor(lon / s);
		const keys: string[] = [];
		for (let dy = -radiusBins; dy <= radiusBins; dy++) {
			for (let dx = -radiusBins; dx <= radiusBins; dx++) {
				keys.push(`${(bLat + dy) * s}:${(bLon + dx) * s}`);
			}
		}
		return keys;
	}
	private static async ensureIndex(prisma: PrismaClient): Promise<void> {
		if (RegionService.indexLoaded) return;
		if (RegionService.indexLoadingPromise) {
			await RegionService.indexLoadingPromise;
			return;
		}
		RegionService.indexLoadingPromise = (async () => {
			const rows = await prisma.region.findMany({
				select: {
					id: true,
					cityId: true,
					name: true,
					number: true,
					countryId: true,
					latitude: true,
					longitude: true
				}
			});
			for (const r of rows) {
				const key = RegionService.binKey(r.latitude as unknown as number, r.longitude as unknown as number);
				if (!RegionService.bins.has(key)) RegionService.bins.set(key, []);
				RegionService.bins.get(key)!.push({
					id: r.id,
					cityId: r.cityId,
					name: r.name,
					number: r.number,
					countryId: r.countryId,
					latitude: r.latitude as unknown as number,
					longitude: r.longitude as unknown as number
				});
			}

			// FORGIVE ME FATHER FOR I HAVE SINNED T.T
			// Build a lightweight KD-Tree (2D) for fast nearest lookup (lazy version no lib)
			// TODO: Lazy-calculate neighbors and cache to database instead of in-memory
			const pts: Point[] = rows.map(r => ({
				latitude: r.latitude as unknown as number,
				longitude: r.longitude as unknown as number,
				id: r.id,
				cityId: r.cityId,
				name: r.name,
				number: r.number,
				countryId: r.countryId
			}));

			interface Node { p: Point; axis: 0 | 1; left: Node | null; right: Node | null }

			function build(points: Point[], depth: number): Node | null {
				if (points.length === 0) return null;
				const axis: 0 | 1 = (depth % 2) as 0 | 1;
				points.sort((a, b) => (axis === 0 ? a.latitude - b.latitude : a.longitude - b.longitude));
				const mid = Math.floor(points.length / 2);
				const node: Node = {
					p: points[mid] as Point,
					axis,
					left: build(points.slice(0, mid), depth + 1),
					right: build(points.slice(mid + 1), depth + 1)
				};
				return node;
			}
			const root = build(pts, 0);
			function sq(a: number) { return a * a }
			function dist2(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
				return sq(a.latitude - b.latitude) + sq(a.longitude - b.longitude);
			}
			function nearest(pt: { latitude: number; longitude: number }): Point | null {
				let best: Point | null = null;
				let bestD = Number.POSITIVE_INFINITY;
				function search(node: Node | null) {
					if (!node) return;
					const np = node.p as Point;
					const d = dist2(pt, np);
					if (d < bestD) { bestD = d; best = np }
					const axis = node.axis;
					const delta = (axis === 0 ? pt.latitude - np.latitude : pt.longitude - np.longitude);
					const first = delta < 0 ? node.left : node.right;
					const second = delta < 0 ? node.right : node.left;
					search(first);
					if (delta * delta < bestD) search(second);
				}
				search(root);
				return best;
			}
			RegionService.kd = { nearest: (pt) => nearest(pt) };

			RegionService.indexLoaded = true;
		})()
			.finally(() => {
				RegionService.indexLoadingPromise = null;
			});
		await RegionService.indexLoadingPromise;
	}

	static pixelsToCoordinates(tile: [number, number], pixel: [number, number], { tileSize, canonicalZ }: { tileSize?: number; canonicalZ?: number } = {}): { latitude: number; longitude: number } {
		const [tileX, tileY] = tile;
		const [pixelX, pixelY] = pixel;

		tileSize ??= TILE_SIZE;
		canonicalZ ??= 11;
		const worldPixels = tileSize * Math.pow(2, canonicalZ);

		const [globalX, globalY] = [tileX * tileSize + pixelX + 0.5, tileY * tileSize + pixelY + 0.5];
		const [normX, normY] = [globalX / worldPixels, globalY / worldPixels];

		const longitude = normX * 360 - 180;
		const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * normY))) * 180 / Math.PI;

		return { latitude, longitude };
	}

	async getRegionForCoordinates(tile: [number, number], pixel: [number, number]): Promise<Region> {
		const { latitude, longitude } = RegionService.pixelsToCoordinates(tile, pixel);

		const key = this.staticKey(latitude, longitude);
		const cached = this.cache.get(key);
		if (cached) return cached;
		const existing = this.inflight.get(key);
		if (existing) return existing;

		const work = (async () => {
			const nearest = await this.findNearestRegionByDistance(latitude, longitude);
			if (nearest) {
				// console.log("nearest", nearest);
				const result = {
					id: nearest.id,
					cityId: nearest.cityId,
					name: nearest.name,
					number: nearest.number,
					countryId: nearest.countryId,
					flagId: nearest.countryId
				} as Region;

				this.cache.set(key, result);
				return result;
			}

			const fallback = await this.getLocalityForCoordinates(latitude, longitude);
			const countryId = fallback.countryId ?? await this.getCountryIdForCoordinates(latitude, longitude) ?? 13;

			return {
				id: 0,
				cityId: 0,
				name: fallback.name ?? "gplace",
				number: 0,
				countryId,
				flagId: countryId
			};
		})();

		this.inflight.set(key, work);
		try {
			const r = await work;
			return r;
		} finally {
			this.inflight.delete(key);
		}
	}

	private deg2rad(v: number): number { return v * Math.PI / 180 }

	// ref: https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula
	private getDistanceFromLatLon(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
		const R = 6_371_000;
		const dLat = this.deg2rad(b.latitude - a.latitude);
		const dLon = this.deg2rad(b.longitude - a.longitude);
		const lat1 = this.deg2rad(a.latitude);
		const lat2 = this.deg2rad(b.latitude);
		const sinDLat = Math.sin(dLat / 2);
		const sinDLon = Math.sin(dLon / 2);
		const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
		return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
	}

	private async findNearestRegionByDistance(latitude: number, longitude: number) {
		await RegionService.ensureIndex(this.prisma);
		if (RegionService.kd) {
			const p = RegionService.kd.nearest({ latitude, longitude });
			if (p) return {
				id: p.id,
				cityId:
				p.cityId,
				name: p.name,
				number: p.number,
				countryId: p.countryId,
				latitude: p.latitude,
				longitude: p.longitude
			};
		}
		let radius = 0;
		for (let iter = 0; iter < 6; iter++) {
			const keys = RegionService.neighbors(latitude, longitude, radius);
			let best: { id: number; cityId: number; name: string; number: number; countryId: number; latitude: number; longitude: number } | null = null;
			let bestD = Number.POSITIVE_INFINITY;
			for (const k of keys) {
				const bucket = RegionService.bins.get(k);
				if (!bucket) continue;
				for (const region of bucket) {
					const d = this.getDistanceFromLatLon(
						{ latitude, longitude }, {
							latitude: region.latitude,
							longitude: region.longitude
						});
					if (d < bestD) {
						bestD = d;
						best = region;
					}
				}
			}
			if (best) return best;
			radius += 1;
		}
		return null;
	}

	private async getCountryIdForCoordinates(latitude: number, longitude: number): Promise<number | null> {
		const key = this.countryLookupKey(latitude, longitude);
		if (this.reverseCountryCache.has(key)) {
			return this.reverseCountryCache.get(key) ?? null;
		}

		const inflight = this.reverseCountryInflight.get(key);
		if (inflight) {
			return inflight;
		}

		const work = (async () => {
			const countryCode = iso1A2Code([longitude, latitude]);
			const countryId = countryCode ? countryIdsByCode.get(countryCode.toUpperCase()) ?? null : null;
			this.reverseCountryCache.set(key, null);
			if (countryId) {
				this.reverseCountryCache.set(key, countryId);
				return countryId;
			}
			return null;
		})();

		this.reverseCountryInflight.set(key, work);
		try {
			return await work;
		} finally {
			this.reverseCountryInflight.delete(key);
		}
	}

	private normalizeLocalityName(value: unknown): string | null {
		if (typeof value !== "string") {
			return null;
		}

		const normalized = value
			.replace(/\s+/g, " ")
			.replace(/\s*,\s*/g, ", ")
			.trim();
		if (!normalized) {
			return null;
		}

		const cleaned = normalized
			.replace(/^city of\s+/i, "")
			.replace(/^province of\s+/i, "")
			.replace(/^district of\s+/i, "")
			.trim();
		return cleaned || null;
	}

	private pickLocalityName(payload: any): string | null {
		const address = payload?.address;
		const candidates = [
			address?.city,
			address?.town,
			address?.village,
			address?.municipality,
			address?.city_district,
			address?.suburb,
			address?.county,
			address?.state_district,
			address?.province,
			address?.state,
			payload?.name
		];

		for (const candidate of candidates) {
			const normalized = this.normalizeLocalityName(candidate);
			if (normalized) {
				return normalized;
			}
		}

		const displayName = this.normalizeLocalityName(payload?.display_name);
		if (!displayName) {
			return null;
		}

		const firstPart = displayName.split(",")[0]?.trim();
		return this.normalizeLocalityName(firstPart);
	}

	private async reverseLookupLocality(latitude: number, longitude: number): Promise<ReverseLocalityResult> {
		const controller = new AbortController();
		const timer = setTimeout(() => {
			controller.abort();
		}, 1800);

		try {
			const url = new URL("https://nominatim.openstreetmap.org/reverse");
			url.searchParams.set("format", "jsonv2");
			url.searchParams.set("lat", String(latitude));
			url.searchParams.set("lon", String(longitude));
			url.searchParams.set("zoom", "10");
			url.searchParams.set("addressdetails", "1");
			url.searchParams.set("accept-language", "en");

			const response = await fetch(url, {
				headers: {
					accept: "application/json",
					"user-agent": "gplace-local-dev/1.0 (+https://github.com/Elik10/wplace-elik)"
				},
				signal: controller.signal
			});

			if (!response.ok) {
				return { countryId: null, name: null };
			}

			const payload: any = await response.json();
			const countryCode = typeof payload?.address?.country_code === "string"
				? payload.address.country_code.toUpperCase()
				: null;
			const countryId = countryCode ? countryIdsByCode.get(countryCode) ?? null : null;
			const name = this.pickLocalityName(payload);

			return { countryId, name };
		} catch {
			return { countryId: null, name: null };
		} finally {
			clearTimeout(timer);
		}
	}

	private async getLocalityForCoordinates(latitude: number, longitude: number): Promise<ReverseLocalityResult> {
		const key = this.localityLookupKey(latitude, longitude);
		const cached = this.reverseLocalityCache.get(key);
		if (cached) {
			return cached;
		}

		const inflight = this.reverseLocalityInflight.get(key);
		if (inflight) {
			return inflight;
		}

		const work = (async () => {
			const reverse = await this.reverseLookupLocality(latitude, longitude);
			if (reverse.countryId || reverse.name) {
				this.reverseLocalityCache.set(key, reverse);
				return reverse;
			}

			const fallbackCountryId = await this.getCountryIdForCoordinates(latitude, longitude);
			const fallback = {
				countryId: fallbackCountryId,
				name: null
			};
			this.reverseLocalityCache.set(key, fallback);
			return fallback;
		})();

		this.reverseLocalityInflight.set(key, work);
		try {
			return await work;
		} finally {
			this.reverseLocalityInflight.delete(key);
		}
	}

	public async findRegionsByQuery(query: string): Promise<Point[]> {
		const queryLowercase = query.toLowerCase();
		const results = await this.prisma.region.findMany({
			where: {
				name: { contains: queryLowercase }
			},
			orderBy: {
				population: "desc"
			},
			take: 20
		});

		// Sort by relevance: exact match -> population -> starts with -> name length
		const sorted = results.sort((a, b) => {
			const aName = a.name.toLowerCase();
			const bName = b.name.toLowerCase();

			const aExact = aName === queryLowercase ? 0 : 1;
			const bExact = bName === queryLowercase ? 0 : 1;
			if (aExact !== bExact) {
				return aExact - bExact;
			}

			const aStarts = aName.startsWith(queryLowercase) ? 0 : 1;
			const bStarts = bName.startsWith(queryLowercase) ? 0 : 1;
			if (aStarts !== bStarts) {
				return aStarts - bStarts;
			}

			const aPopulation = a.population ?? 0;
			const bPopulation = b.population ?? 0;
			if (aPopulation !== bPopulation) {
				return bPopulation - aPopulation;
			}

			return aName.length - bName.length;
		})
			.slice(0, 10);

		return sorted.map(item => ({
			latitude: item.latitude,
			longitude: item.longitude,
			id: item.id,
			cityId: item.cityId,
			name: item.name,
			number: item.number,
			countryId: item.countryId,
			flagId: item.countryId
		}));
	}
}
