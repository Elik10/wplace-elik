import dotenv from "dotenv";
dotenv.config();

import { App, Handler, Response } from "@tinyhttp/app";
import { cookieParser } from "@tinyhttp/cookie-parser";
import fs from "fs/promises";
import { ServerResponse } from "http";
import { json } from "milliparsec";
import sirv from "sirv";
import admin from "./routes/admin.js";
import alliance from "./routes/alliance.js";
import auth from "./routes/auth.js";
import autocomplete from "./routes/autocomplete.js";
import challenge from "./routes/challenge.js";
import checkrobots from "./routes/checkrobots.js";
import discord from "./routes/discord.js";
import favoriteLocation from "./routes/favorite-location.js";
import health from "./routes/health.js";
import leaderboard from "./routes/leaderboard.js";
import me from "./routes/me.js";
import moderator from "./routes/moderator.js";
import notification from "./routes/notification.js";
import payment from "./routes/payment.js";
import pixel from "./routes/pixel.js";
import reportUser from "./routes/report-user.js";
import store from "./routes/store.js";
import { leaderboardService } from "./services/leaderboard.js";
import { discordBot } from "./discord/bot.js";

const isDev = process.env["NODE_ENV"] !== "production";

const noMatchPage = await fs.readFile("./frontend/404.html", "utf8");

const app = new App({
	settings: {
		networkExtensions: true,
		xPoweredBy: false
	},

	noMatchHandler: async (_req, res) => {
		return res.status(404)
			.set("Content-Type", "text/html")
			.send(noMatchPage);
	}
});

// Fix IP address handling early to prevent @tinyhttp errors
app.use((req, _res, next) => {
	// Ensure req.ip is always a valid IP address
	let ip = req.get("cf-connecting-ip") as string ??
	         req.get("x-forwarded-for") as string ??
	         req.connection?.remoteAddress ??
	         req.ip ??
	         "127.0.0.1";

	// Clean up IP address (remove port, handle multiple IPs)
	if (ip && ip.includes(",")) {
		ip = ip.split(",")[0]?.trim() ?? "";
	}
	if (ip && ip.includes(":")) {
		const parts = ip.split(":");
		ip = parts.length > 2
			? parts.join(":") // IPv6
			: parts[0] ?? ""; // IPv4 with port
	}

	// Validate IP format
	if (!ip || ip.length < 7 || (!ip.includes(".") && !ip.includes(":"))) {
		ip = "127.0.0.1";
	}

	req.ip = ip;
	next?.();
});

app.use(cookieParser());

const jsonMiddleware = json({
	payloadLimit: 50 * 1024 * 1024 // 50 MB
});

app.use((_req, res, next) => {
	res.set("cache-control", "private, must-revalidate");
	next?.();
});

app.use((req, res, next) => {
	const contentType = req.get("content-type")
		?.split(";")
		.at(0) ?? "";

	switch (contentType) {
	case "multipart/form-data":
		// Routes using form data handle their own parsing
		return next?.();

	case "application/json":
	case "text/plain":
		// text/plain is used because the frontend doesn't set a Content-Type...
		// Wrap JSON middleware with error handling
		try {
			return jsonMiddleware(req, res, next);
		} catch (error) {
			console.warn(`[${new Date()
				.toISOString()}] JSON parsing error for ${req.method} ${req.path} from ${req.ip}:`, error);
			return res.status(400)
				.json({ error: "Invalid JSON format" });
		}
	}

	return next?.();
});

// Logging
app.use((req, _res, next) => {
	// Log suspicious requests
	if (req.body && typeof req.body === "string" && req.body.length > 0) {
		console.warn(`[${new Date()
			.toISOString()}] Suspicious request body from ${req.ip} to ${req.method} ${req.path}:`, req.body.slice(0, 100));
	}
	return next?.();
});

// Strip /api prefix from paths for frontend2
app.use((req, _res, next) => {
	if (req.path.startsWith("/api")) {
		req.url = req.url.slice(4);
	}
	return next?.();
});

admin(app);
alliance(app);
auth(app);
autocomplete(app);
challenge(app);
checkrobots(app);
discord(app);
favoriteLocation(app);
health(app);
leaderboard(app);
me(app);
moderator(app);
notification(app);
payment(app);
pixel(app);
reportUser(app);
store(app);

// Proxy new frontend paths
const FRONTEND_HOST = process.env["FRONTEND_HOST"] ?? "localhost";
const FRONTEND_PORT = process.env["FRONTEND_PORT"] ?? "3001";

const frontendProxy: Handler = async (req, res, _next) => {
	try {
		const method = req.method ?? "GET";
		const res2 = await fetch(`http://${FRONTEND_HOST}:${FRONTEND_PORT}${req.url}`, {
			method,
			headers: req.headers as Record<string, string>,
			...(["GET", "HEAD"].includes(method)
				? {}
				: {
						body: JSON.stringify(req.body)
					})
		});
		res.status(res2.status);
		for (const [key, value] of res2.headers.entries()) {
			res.set(key, value);
		}
		return res.send(Buffer.from(await res2.arrayBuffer()));
	} catch (error) {
		console.error("Frontend proxy error:", error);
		return res.status(502)
			.send("Bad Gateway");
	}
};

app.get("/login", frontendProxy);
app.get("/login/*", frontendProxy);
app.get("/beta", frontendProxy);
app.get("/flags/*", frontendProxy);
app.get("/_nuxt/*", frontendProxy);

app.use(sirv("./frontend", {
	dev: isDev,
	setHeaders: (res: ServerResponse, _pathname, _stats) => {
		if (!isDev) {
			(res as Response).set("cache-control", `public, maxage=${5 * 60}, s-maxage=${5 * 60}, stale-while-revalidate=${5 * 60}, stale-if-error=${5 * 60}`);
		}
	}
}));

const port = Number(process.env["BACKEND_PORT"]) || 3000;

app.listen(port, async () => {
	console.log(`Server running on port ${port}`);

	console.log("Starting global leaderboard warmup scheduler (every 1 minute)");
	leaderboardService.warmupGlobalLeaderboards()
		.catch(error => {
			console.error("Initial warmup failed:", error);
		});

	setInterval(async () => {
		try {
			await leaderboardService.warmupGlobalLeaderboards();
			// const timestamp = new Date()
			// 	.toISOString();
			// console.log(`[${timestamp}] Global leaderboards warmup completed`);
		} catch (error) {
			const timestamp = new Date()
				.toISOString();
			console.error(`[${timestamp}] Leaderboard warmup error:`, error);
		}
	}, 1 * 60 * 1000);

	await discordBot.start();
});

async function shutdown() {
	await discordBot.stop();
	// eslint-disable-next-line unicorn/no-process-exit
	process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
