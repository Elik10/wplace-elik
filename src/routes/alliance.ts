import { App } from "@tinyhttp/app";
import { authMiddleware } from "../middleware/auth.js";
import { handleServiceError } from "../middleware/errorHandler.js";
import { AllianceService } from "../services/alliance.js";
import { validatePaginationPage } from "../validators/common.js";
import { createErrorResponse, HTTP_STATUS } from "../utils/response.js";
import { prisma } from "../config/database.js";
import { AuthenticatedRequest } from "../types/index.js";

const allianceService = new AllianceService(prisma);

export default function (app: App) {
	app.get("/alliance", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const result = await allianceService.getUserAlliance(req.user!.id);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const { name, tag, description, picture, banner } = req.body;
			if (typeof name !== "string") {
				return res.status(HTTP_STATUS.BAD_REQUEST)
					.json(createErrorResponse("Alliance name is required", HTTP_STATUS.BAD_REQUEST));
			}

			const result = await allianceService.createAlliance(req.user!.id, {
				name,
				tag,
				description,
				picture,
				banner
			});
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/settings", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const { name, tag, description, picture, banner, joinPolicy } = req.body;
			if (typeof name !== "string") {
				return res.status(HTTP_STATUS.BAD_REQUEST)
					.json(createErrorResponse("Alliance name is required", HTTP_STATUS.BAD_REQUEST));
			}

			const result = await allianceService.updateSettings(req.user!.id, {
				name,
				tag,
				description,
				picture,
				banner,
				joinPolicy
			});
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/update-description", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const { description } = req.body;
			const result = await allianceService.updateDescription(req.user!.id, { description });
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.get("/alliance/invites", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const result = await allianceService.getInvites(req.user!.id);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.get("/alliance/join/:invite", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			// TODO: validation
			const invite = req.params["invite"] as string;
			const result = await allianceService.joinAlliance(req.user!.id, invite);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/update-headquarters", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			// TODO: validation
			const { latitude, longitude } = req.body;
			if (typeof latitude !== "number" || typeof longitude !== "number") {
				return res.status(HTTP_STATUS.BAD_REQUEST)
					.json(createErrorResponse("Bad Request", HTTP_STATUS.BAD_REQUEST));
			}

			const result = await allianceService.updateHeadquarters(req.user!.id, { latitude, longitude });
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.get("/alliance/members/:page", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const page = Number.parseInt(req.params["page"] as string) || 0;

			if (!validatePaginationPage(page)) {
				return res.status(HTTP_STATUS.BAD_REQUEST)
					.json(createErrorResponse("Bad Request", HTTP_STATUS.BAD_REQUEST));
			}

			const result = await allianceService.getMembers(req.user!.id, page);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.get("/alliance/members/banned/:page", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const page = Number.parseInt(req.params["page"] as string) || 0;

			if (!validatePaginationPage(page)) {
				return res.status(HTTP_STATUS.BAD_REQUEST)
					.json(createErrorResponse("Bad Request", HTTP_STATUS.BAD_REQUEST));
			}

			const result = await allianceService.getBannedMembers(req.user!.id, page);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/leave", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const { successorUserId } = req.body ?? {};
			const normalizedSuccessorUserId = typeof successorUserId === "number"
				? successorUserId
				: typeof successorUserId === "string" && successorUserId.trim()
					? Number(successorUserId)
					: null;

			const result = await allianceService.leaveAlliance(req.user!.id, normalizedSuccessorUserId);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/delete", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const result = await allianceService.deleteAlliance(req.user!.id);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/give-admin", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const { promotedUserId } = req.body;
			await allianceService.promoteUser(req.user!.id, Number(promotedUserId));
			return res.status(HTTP_STATUS.OK)
				.json({});
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/member-role", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const { targetUserId, role } = req.body;
			const result = await allianceService.setMemberRole(req.user!.id, Number(targetUserId), role);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/kick", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const { targetUserId } = req.body;
			const result = await allianceService.kickUser(req.user!.id, Number(targetUserId));
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/ban", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const { bannedUserId } = req.body;
			const result = await allianceService.banUser(req.user!.id, Number(bannedUserId));
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/unban", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const { unbannedUserId } = req.body;
			const result = await allianceService.unbanUser(req.user!.id, Number(unbannedUserId));
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.get("/alliance/leaderboard/:mode", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			// TODO: validation
			const mode = req.params["mode"] as string;

			const result = await allianceService.getLeaderboard(req.user!.id, mode);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.get("/alliance/requests", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const result = await allianceService.getJoinRequests(req.user!.id);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/requests/:id/approve", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const requestId = Number(req.params["id"]);
			const result = await allianceService.approveJoinRequest(req.user!.id, requestId);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/requests/:id/deny", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const requestId = Number(req.params["id"]);
			const result = await allianceService.denyJoinRequest(req.user!.id, requestId);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.get("/alliance/activity", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const result = await allianceService.getActivityLogs(req.user!.id);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/announcement", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const { announcement } = req.body ?? {};
			const result = await allianceService.updateAnnouncement(
				req.user!.id,
				typeof announcement === "string" ? announcement : ""
			);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});

	app.post("/alliance/permissions", authMiddleware, async (req: AuthenticatedRequest, res) => {
		try {
			const result = await allianceService.updatePermissions(req.user!.id, req.body?.permissions);
			return res.json(result);
		} catch (error) {
			return handleServiceError(error as Error, res);
		}
	});
}
