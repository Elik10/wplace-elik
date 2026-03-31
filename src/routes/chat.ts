import { App } from "@tinyhttp/app";
import { prisma } from "../config/database.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../types/index.js";
import { createErrorResponse, HTTP_STATUS } from "../utils/response.js";
import { ChatService } from "../services/chat.js";

const chatService = new ChatService(prisma);

export default function (app: App) {
	app.get("/chat/messages", optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const channel = typeof req.query["channel"] === "string" ? req.query["channel"] : "global";
			const result = await chatService.getRecentMessages(req.user?.id ?? null, channel);
			return res.json(result);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to fetch chat messages";
			const status = message === "Unauthorized"
				? HTTP_STATUS.UNAUTHORIZED
				: message === "No Alliance"
					? HTTP_STATUS.NOT_FOUND
					: message === "Forbidden"
						? HTTP_STATUS.FORBIDDEN
						: HTTP_STATUS.INTERNAL_SERVER_ERROR;

			console.error("Failed to fetch chat messages:", error);
			return res.status(status)
				.json(createErrorResponse(message, status));
		}
	});

	app.post("/chat/messages", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const { content, channel, replyToId } = req.body ?? {};

			if (typeof content !== "string") {
				return res.status(HTTP_STATUS.BAD_REQUEST)
					.json(createErrorResponse("content must be a string", HTTP_STATUS.BAD_REQUEST));
			}

			const message = await chatService.createMessage(req.user!.id, content, {
				channel: typeof channel === "string" ? channel : "global",
				replyToId: typeof replyToId === "number"
					? replyToId
					: typeof replyToId === "string" && replyToId.trim()
						? Number(replyToId)
						: null
			});
			return res.status(HTTP_STATUS.CREATED)
				.json({ message });
		} catch (error) {
			const message = error instanceof Error
				? error.message
				: "Failed to send chat message";

			let status: number = HTTP_STATUS.BAD_REQUEST;

			if (message === "User not found") {
				status = HTTP_STATUS.NOT_FOUND;
			} else if (message === "Banned users cannot use chat") {
				status = HTTP_STATUS.FORBIDDEN;
			} else if (message === "No Alliance") {
				status = HTTP_STATUS.NOT_FOUND;
			} else if (message === "Forbidden") {
				status = HTTP_STATUS.FORBIDDEN;
			} else if (message.startsWith("Please wait ")) {
				status = HTTP_STATUS.TOO_MANY_REQUESTS;
			}

			return res.status(status)
				.json(createErrorResponse(message, status));
		}
	});
}
