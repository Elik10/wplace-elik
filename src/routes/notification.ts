import { App } from "@tinyhttp/app";
import { authMiddleware } from "../middleware/auth.js";
import { handleServiceError } from "../middleware/errorHandler.js";
import { NotificationService } from "../services/notification.js";
import { createErrorResponse, HTTP_STATUS } from "../utils/response.js";
import { AuthenticatedRequest } from "../types/index.js";
import { prisma } from "../config/database.js";

const notificationService = new NotificationService(prisma);

export default function (app: App) {
	app.get("/notification/count", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const count = await notificationService.getUnreadCount(req.user!.id);
			return res.json({ count });
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.get("/notification/page", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const result = await notificationService.getPage(req.user!.id);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/notification/mark-read", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const { notificationIds } = req.body;

			if (!Array.isArray(notificationIds)) {
				return res.status(HTTP_STATUS.BAD_REQUEST)
					.json(createErrorResponse("notificationIds must be an array", HTTP_STATUS.BAD_REQUEST));
			}

			if (!notificationIds.every(id => typeof id === "number")) {
				return res.status(HTTP_STATUS.BAD_REQUEST)
					.json(createErrorResponse("Invalid notification IDs", HTTP_STATUS.BAD_REQUEST));
			}

			await notificationService.markAsRead(req.user!.id, notificationIds);
			return res.json({ success: true });
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/notification/mark-read/all", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			await notificationService.markAllAsRead(req.user!.id);
			return res.json({ success: true });
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});
}
