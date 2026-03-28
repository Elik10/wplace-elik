import { App } from "@tinyhttp/app";

export default function (app: App) {
	app.get("/health", async (_req, res) => {
		res.json({});
	});
}
