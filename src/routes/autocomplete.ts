import { App } from "@tinyhttp/app";
import { createErrorResponse } from "../utils/response.js";
import { prisma } from "../config/database.js";
import { RegionService } from "../services/region.js";
import { COUNTRIES } from "../utils/country.js";

const regionService = new RegionService(prisma);

export default function (app: App) {
	app.get("/v1/autocomplete", async (req, res) => {
		const text = req.query["text"] as string;
		if (typeof text !== "string" || text.length === 0) {
			return createErrorResponse("No query provided", 400);
		}

		const results = await regionService.findRegionsByQuery(text);

		return res.json({
			type: "FeatureCollection",
			features: results.map(region => {
				const country = COUNTRIES.find(item => item.id === region.countryId);
				return {
					type: "Feature",
					geometry: {
						type: "Point",
						coordinates: [region.longitude, region.latitude]
					},
					properties: {
						id: region.id,
						name: region.name,
						label: [region.name, country?.name]
							.filter(Boolean)
							.join(", ")
					},
					bbox: [
						region.longitude - 0.05,
						region.latitude - 0.05,
						region.longitude + 0.05,
						region.latitude + 0.05
					]
				};
			})
		});
	});
}
