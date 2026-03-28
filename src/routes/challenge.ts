import { App } from "@tinyhttp/app";

export default function (app: App) {
	app.get("/challenge", async (req, res) => {
		// Handle post-WAF challenge redirect back to the app
		let returnTo = req.query["r"] as string ?? "/";
		if (!returnTo.startsWith("/")) {
			returnTo = "/";
		}

		return res.redirect(returnTo);
	});
}
