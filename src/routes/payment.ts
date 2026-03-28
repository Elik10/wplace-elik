import { App } from "@tinyhttp/app";

export default function (app: App) {
	app.post("/payment/create-checkout-session", async (_req, res) => {
		return res.status(404)
			.end("Payments are not implemented");
	});
}
