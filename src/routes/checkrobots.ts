import { App } from "@tinyhttp/app";

function getRule(key: string, defaultValue = false): boolean {
	const value = process.env[key];
	if (value === undefined) {
		return defaultValue;
	}
	return value === "1" || value === "true";
}

const rules = {
	isMultiAccountAllowed: getRule("ALLOW_MULTI_ACCOUNT"),
	isOffensiveContentAllowed: getRule("ALLOW_OFFENSIVE_CONTENT"),
	isExplicitContentAllowed: getRule("ALLOW_EXPLICIT_CONTENT"),
	isGriefingAllowed: getRule("ALLOW_GRIEFING"),
	isKindGriefingAllowed: getRule("ALLOW_KIND_GRIEFING", true),
	isPoliticalGriefingAllowed: getRule("ALLOW_POLITICAL_GRIEFING"),
	isVPNAllowed: getRule("ALLOW_VPN"),
	isBottingAllowed: getRule("ALLOW_BOTS"),
	extraRules: process.env["EXTRA_RULES"]
};

export default function (app: App) {
	app.get("/checkrobots", (_req, res) => res.json(rules));
}
