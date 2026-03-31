import { Prisma, PrismaClient } from "@prisma/client";
import { UserService } from "./user";
import { ValidationError } from "../utils/error";
import { RegionService } from "./region";
import { PixelService } from "./pixel";

type LeaderboardMode = "today" | "week" | "month" | "all-time";
export type AllianceMemberRole = "owner" | "admin" | "mod" | "member";
export type AlliancePermissionKey =
	| "manageInvites"
	| "reviewJoinRequests"
	| "moderateMembers"
	| "editAnnouncement"
	| "setHeadquarters"
	| "viewActivityLog"
	| "useAllianceChat";

export type AlliancePermissionConfig = Record<Exclude<AllianceMemberRole, "owner">, Record<AlliancePermissionKey, boolean>>;
const DEFAULT_PROFILE_PICTURE = "/img/gplace-logo.png";

function getDateFilter(mode: LeaderboardMode): any {
	const now = new Date();

	switch (mode) {
	case "today": {
		const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		startOfDay.setHours(0, 0, 0, 0);
		return { paintedAt: { gte: startOfDay } };
	}
	case "week": {
		const startOfWeek = new Date(now);
		startOfWeek.setDate(now.getDate() - 7);
		startOfWeek.setHours(0, 0, 0, 0);
		return { paintedAt: { gte: startOfWeek } };
	}
	case "month": {
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		startOfMonth.setHours(0, 0, 0, 0);
		return { paintedAt: { gte: startOfMonth } };
	}
	case "all-time":
		return {};
	default:
		return {};
	}
}

export interface CreateAllianceInput {
	name: string;
	tag?: string;
	description?: string;
	picture?: string;
	banner?: string;
}

export interface UpdateAllianceDescriptionInput {
	description: string;
}

export interface UpdateAllianceSettingsInput {
	name: string;
	tag?: string;
	description?: string;
	picture?: string;
	banner?: string;
	joinPolicy?: string;
}

export interface UpdateAllianceHQInput {
	latitude: number;
	longitude: number;
}

type DbClient = PrismaClient | Prisma.TransactionClient;

const PAGINATION_CONSTANTS = {
	PAGE_SIZE: 50
} as const;

const rolePriority: Record<AllianceMemberRole, number> = {
	owner: 4,
	admin: 3,
	mod: 2,
	member: 1
};

function humanRoleLabel(role: AllianceMemberRole): string {
	switch (role) {
	case "owner":
		return "owner";
	case "admin":
		return "admin";
	case "mod":
		return "mod";
	default:
		return "member";
	}
}

const defaultAlliancePermissionConfig: AlliancePermissionConfig = {
	admin: {
		manageInvites: true,
		reviewJoinRequests: true,
		moderateMembers: true,
		editAnnouncement: true,
		setHeadquarters: true,
		viewActivityLog: true,
		useAllianceChat: true
	},
	mod: {
		manageInvites: false,
		reviewJoinRequests: false,
		moderateMembers: true,
		editAnnouncement: false,
		setHeadquarters: false,
		viewActivityLog: true,
		useAllianceChat: true
	},
	member: {
		manageInvites: false,
		reviewJoinRequests: false,
		moderateMembers: false,
		editAnnouncement: false,
		setHeadquarters: false,
		viewActivityLog: false,
		useAllianceChat: true
	}
};

export function getAlliancePermissionConfig(rawPermissions: unknown): AlliancePermissionConfig {
	const config = JSON.parse(JSON.stringify(defaultAlliancePermissionConfig)) as AlliancePermissionConfig;

	if (!rawPermissions || typeof rawPermissions !== "object" || Array.isArray(rawPermissions)) {
		return config;
	}

	const source = rawPermissions as Record<string, unknown>;

	for (const role of ["admin", "mod", "member"] as const) {
		const roleConfig = source[role] as Record<string, unknown> | undefined;
		if (!roleConfig || typeof roleConfig !== "object" || Array.isArray(roleConfig)) {
			continue;
		}

		for (const permission of Object.keys(config[role]) as AlliancePermissionKey[]) {
			if (typeof roleConfig[permission] === "boolean") {
				config[role][permission] = roleConfig[permission];
			}
		}
	}

	return config;
}

export function hasAlliancePermission(role: string | null | undefined, rawPermissions: unknown, permission: AlliancePermissionKey): boolean {
	const normalizedRole = role === "owner" || role === "admin" || role === "mod" || role === "member"
		? role
		: "member";

	if (normalizedRole === "owner") {
		return true;
	}

	const config = getAlliancePermissionConfig(rawPermissions);
	return !!config[normalizedRole][permission];
}

export class AllianceService {
	private pixelService: PixelService;

	constructor(private prisma: PrismaClient) {
		this.pixelService = new PixelService(prisma);
	}

	static isValidAllianceName(name: string): boolean {
		return name.length > 0 && name.length <= 16;
	}

	static isValidAllianceTag(tag: string): boolean {
		return /^[A-Za-z0-9]{2,6}$/.test(tag);
	}

	private normalizeName(name: string): string {
		return name.trim();
	}

	private normalizeTag(tag?: string): string | null {
		if (typeof tag !== "string") {
			return null;
		}

		const normalized = tag.trim().toUpperCase();
		return normalized.length > 0 ? normalized : null;
	}

	private sanitizeAssetUrl(url?: string): string | null {
		if (typeof url !== "string") {
			return null;
		}

		const trimmed = url.trim();
		if (!trimmed) {
			return null;
		}

		if (trimmed.length > 2_048) {
			throw new ValidationError("invalid_asset_url");
		}

		try {
			const parsed = new URL(trimmed);
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
				throw new Error("invalid-protocol");
			}
			return parsed.toString();
		} catch {
			throw new ValidationError("invalid_asset_url");
		}
	}

	private async ensureAllianceOwner(allianceId: number): Promise<number | null> {
		const alliance = await this.prisma.alliance.findUnique({
			where: { id: allianceId },
			select: { ownerId: true }
		});

		if (alliance?.ownerId) {
			const owner = await this.prisma.user.findUnique({
				where: { id: alliance.ownerId },
				select: { id: true, allianceId: true, allianceRole: true }
			});

			if (owner?.allianceId === allianceId) {
				if (owner.allianceRole !== "owner") {
					await this.prisma.user.update({
						where: { id: owner.id },
						data: { allianceRole: "owner" }
					});
				}
				return owner.id;
			}
		}

		const members = await this.prisma.user.findMany({
			where: { allianceId },
			select: {
				id: true,
				allianceRole: true,
				allianceJoinedAt: true
			},
			orderBy: [
				{ allianceJoinedAt: "asc" },
				{ id: "asc" }
			]
		});

		if (members.length === 0) {
			return null;
		}

		const nextOwner = [...members].sort((left, right) => {
			const leftRole = left.allianceRole as AllianceMemberRole;
			const rightRole = right.allianceRole as AllianceMemberRole;
			return rolePriority[rightRole] - rolePriority[leftRole];
		})[0];

		if (!nextOwner) {
			return null;
		}

		await this.prisma.$transaction(async (tx) => {
			await tx.alliance.update({
				where: { id: allianceId },
				data: { ownerId: nextOwner.id }
			});

			if (nextOwner.allianceRole !== "owner") {
				await tx.user.update({
					where: { id: nextOwner.id },
					data: { allianceRole: "owner" }
				});
			}
		});

		return nextOwner.id;
	}

	private async requireAllianceMember(userId: number, missingError = "Forbidden") {
		let user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				allianceId: true,
				allianceRole: true
			}
		});

		if (!user || !user.allianceId) {
			throw new Error(missingError);
		}

		await this.ensureAllianceOwner(user.allianceId);

		user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				allianceId: true,
				allianceRole: true
			}
		});

		if (!user || !user.allianceId) {
			throw new Error(missingError);
		}

		return user;
	}

	private ensureRoleAtLeast(role: string | null | undefined, minimumRole: AllianceMemberRole) {
		const normalizedRole = role && role in rolePriority
			? role as AllianceMemberRole
			: "member";

		return rolePriority[normalizedRole] >= rolePriority[minimumRole];
	}

	private sanitizeDescription(desc?: string): string {
		if (typeof desc !== "string") {
			return "";
		}

		return desc.replaceAll(/["&'<>]/g, (char) => {
			const escapeMap: Record<string, string> = {
				"<": "&lt;",
				">": "&gt;",
				"'": "&#39;",
				"\"": "&quot;",
				"&": "&amp;"
			};
			return escapeMap[char] || char;
		})
			.trim();
	}

	private normalizeJoinPolicy(joinPolicy?: string): "invite" | "request" {
		return joinPolicy === "request" ? "request" : "invite";
	}

	private sanitizeAnnouncement(rawAnnouncement?: string): string | null {
		if (typeof rawAnnouncement !== "string") {
			return null;
		}

		const value = this.sanitizeDescription(rawAnnouncement);
		if (!value) {
			return null;
		}

		if (value.length > 500) {
			throw new ValidationError("announcement_too_long");
		}

		return value;
	}

	private sanitizePermissionConfig(rawPermissions: unknown): AlliancePermissionConfig {
		return getAlliancePermissionConfig(rawPermissions);
	}

	private async writeActivityLog(
		client: DbClient,
		allianceId: number,
		type: string,
		message: string,
		actorUserId?: number | null,
		targetUserId?: number | null,
		metadata?: Prisma.InputJsonValue
	) {
		const data: Prisma.AllianceActivityLogUncheckedCreateInput = {
			allianceId,
			type,
			message,
			actorUserId: actorUserId ?? null,
			targetUserId: targetUserId ?? null
		};

		if (metadata !== undefined) {
			data.metadata = metadata;
		}

		await client.allianceActivityLog.create({
			data
		});
	}

	private async getAllianceDisplayName(userId: number): Promise<string> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				name: true,
				nickname: true
			}
		});

		return user?.nickname || user?.name || `User #${userId}`;
	}

	private async getAllianceContext(userId: number, missingError = "Forbidden") {
		const user = await this.requireAllianceMember(userId, missingError);
		const alliance = await this.prisma.alliance.findUnique({
			where: { id: user.allianceId! },
			select: {
				id: true,
				description: true,
				picture: true,
				banner: true,
				ownerId: true,
				hqLatitude: true,
				hqLongitude: true,
				pixelsPainted: true,
				createdAt: true,
				updatedAt: true,
				rolePermissions: true,
				joinPolicy: true,
				announcement: true,
				announcementUpdatedAt: true,
				tag: true,
				name: true
			}
		});

		if (!alliance) {
			throw new Error(missingError);
		}

		return {
			user,
			alliance,
			permissions: this.sanitizePermissionConfig(alliance.rolePermissions)
		};
	}

	private ensureAlliancePermission(role: string | null | undefined, rawPermissions: unknown, permission: AlliancePermissionKey) {
		if (!hasAlliancePermission(role, rawPermissions, permission)) {
			throw new Error("Forbidden");
		}
	}

	private async getAllianceMemberOrThrow(allianceId: number, memberId: number) {
		const member = await this.prisma.user.findUnique({
			where: { id: memberId },
			select: {
				id: true,
				allianceId: true,
				allianceRole: true,
				allianceJoinedAt: true,
				nickname: true,
				name: true,
				picture: true
			}
		});

		if (!member || member.allianceId !== allianceId) {
			throw new ValidationError("member_not_in_alliance");
		}

		return member;
	}

	async getUserAlliance(userId: number) {
		const { user, alliance, permissions } = await this.getAllianceContext(userId, "No Alliance");

		if (!alliance) {
			throw new Error("No Alliance");
		}

		const memberCount = await this.prisma.user.count({
			where: { allianceId: alliance.id }
		});

		return {
			id: alliance.id,
			name: alliance.name,
			tag: alliance.tag,
			description: alliance.description || "",
			picture: alliance.picture || null,
			banner: alliance.banner || null,
			joinPolicy: alliance.joinPolicy || "invite",
			announcement: alliance.announcement || "",
			announcementUpdatedAt: alliance.announcementUpdatedAt?.toISOString() || null,
			permissions,
			ownerId: alliance.ownerId,
			hq: alliance.hqLatitude !== null && alliance.hqLongitude !== null
				? {
						latitude: alliance.hqLatitude,
						longitude: alliance.hqLongitude
					}
				: null,
			members: memberCount,
			pixelsPainted: alliance.pixelsPainted || 0,
			role: user.allianceRole,
			createdAt: alliance.createdAt.toISOString(),
			updatedAt: alliance.updatedAt.toISOString()
		};
	}

	async createAlliance(userId: number, input: CreateAllianceInput) {
		if (!input.name || typeof input.name !== "string") {
			throw new ValidationError("empty_name");
		}

		const user = await this.prisma.user.findUnique({
			where: { id: userId }
		});

		if (!user) {
			throw new Error("User not found");
		}

		if (user.allianceId) {
			throw new ValidationError("Already in alliance");
		}

		const name = this.normalizeName(input.name);
		const tag = this.normalizeTag(input.tag);
		const description = this.sanitizeDescription(input.description);
		const picture = this.sanitizeAssetUrl(input.picture);
		const banner = this.sanitizeAssetUrl(input.banner);

		if (!AllianceService.isValidAllianceName(name) || !UserService.isAcceptableUsername(name)) {
			throw new ValidationError("max_characters");
		}

		if (tag && !AllianceService.isValidAllianceTag(tag)) {
			throw new ValidationError("invalid_tag");
		}

		if (description.length > 500) {
			throw new ValidationError("description_too_long");
		}

		const existingAlliance = await this.prisma.alliance.findFirst({
			where: {
				OR: [
					{ name },
					...(tag ? [{ tag }] : [])
				]
			}
		});

		if (existingAlliance?.name === name) {
			throw new ValidationError("name_taken");
		}

		if (tag && existingAlliance?.tag === tag) {
			throw new ValidationError("tag_taken");
		}

		const result = await this.prisma.$transaction(async (tx) => {
			const alliance = await tx.alliance.create({
				data: {
					name,
					tag,
					description,
					picture,
					banner,
					joinPolicy: "invite",
					rolePermissions: defaultAlliancePermissionConfig,
					pixelsPainted: 0
				}
			});

			await tx.user.update({
				where: { id: userId },
				data: {
					allianceId: alliance.id,
					allianceRole: "owner",
					allianceJoinedAt: new Date()
				}
			});

			await tx.alliance.update({
				where: { id: alliance.id },
				data: { ownerId: userId }
			});

			await this.writeActivityLog(
				tx,
				alliance.id,
				"alliance_created",
				`${user.nickname || user.name} created the alliance.`,
				userId
			);

			return { id: alliance.id };
		});

		await this.pixelService.updateUserRegionStatsForAllianceChange(userId, null, result.id);
		return result;
	}

	async updateDescription(userId: number, input: UpdateAllianceDescriptionInput) {
		const user = await this.requireAllianceMember(userId);
		if (!this.ensureRoleAtLeast(user.allianceRole, "admin")) {
			throw new Error("Forbidden");
		}

		const description = this.sanitizeDescription(input.description);
		if (description.length > 500) {
			throw new ValidationError("description_too_long");
		}

		await this.prisma.alliance.update({
			where: { id: user.allianceId! },
			data: { description }
		});

		return { success: true };
	}

	async updateSettings(userId: number, input: UpdateAllianceSettingsInput) {
		const user = await this.requireAllianceMember(userId);
		if (user.allianceRole !== "owner") {
			throw new Error("Forbidden");
		}

		const name = this.normalizeName(input.name);
		const tag = this.normalizeTag(input.tag);
		const description = this.sanitizeDescription(input.description);
		const picture = this.sanitizeAssetUrl(input.picture);
		const banner = this.sanitizeAssetUrl(input.banner);
		const joinPolicy = this.normalizeJoinPolicy(input.joinPolicy);

		if (!AllianceService.isValidAllianceName(name) || !UserService.isAcceptableUsername(name)) {
			throw new ValidationError("max_characters");
		}

		if (tag && !AllianceService.isValidAllianceTag(tag)) {
			throw new ValidationError("invalid_tag");
		}

		if (description.length > 500) {
			throw new ValidationError("description_too_long");
		}

		const existingAlliance = await this.prisma.alliance.findFirst({
			where: {
				NOT: { id: user.allianceId! },
				OR: [
					{ name },
					...(tag ? [{ tag }] : [])
				]
			}
		});

		if (existingAlliance?.name === name) {
			throw new ValidationError("name_taken");
		}

		if (tag && existingAlliance?.tag === tag) {
			throw new ValidationError("tag_taken");
		}

		await this.prisma.alliance.update({
			where: { id: user.allianceId! },
			data: {
				name,
				tag,
				description,
				picture,
				banner,
				joinPolicy
			}
		});

		const actorName = await this.getAllianceDisplayName(userId);
		await this.writeActivityLog(
			this.prisma,
			user.allianceId!,
			"settings_updated",
			`${actorName} updated the alliance settings.`,
			userId
		);

		return { success: true };
	}

	async getInvites(userId: number) {
		const { user, permissions } = await this.getAllianceContext(userId);
		this.ensureAlliancePermission(user.allianceRole, permissions, "manageInvites");

		let invite = await this.prisma.allianceInvite.findFirst({
			where: { allianceId: user.allianceId! }
		});

		if (!invite) {
			invite = await this.prisma.allianceInvite.create({
				data: { allianceId: user.allianceId! }
			});

			const actorName = await this.getAllianceDisplayName(userId);
			await this.writeActivityLog(
				this.prisma,
				user.allianceId!,
				"invite_created",
				`${actorName} created a join link for the alliance.`,
				userId
			);
		}

		return [invite.id];
	}

	async joinAlliance(userId: number, inviteId: string) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId }
		});

		if (!user) {
			throw new Error("User not found");
		}

		if (!inviteId) {
			throw new ValidationError("Invalid invite");
		}

		const inviteRecord = await this.prisma.allianceInvite.findUnique({
			where: { id: inviteId },
			include: {
				alliance: {
					select: {
						id: true,
						name: true,
						joinPolicy: true
					}
				}
			}
		});

		if (!inviteRecord) {
			throw new Error("Not Found");
		}

		if (user.allianceId === inviteRecord.allianceId) {
			return { success: "true", status: "joined" };
		}

		if (user.allianceId) {
			throw new ValidationError("Already Reported");
		}

		const bannedUser = await this.prisma.bannedUser.findUnique({
			where: {
				userId_allianceId: {
					userId,
					allianceId: inviteRecord.allianceId
				}
			}
		});

		if (bannedUser) {
			throw new Error("Forbidden");
		}

		if (inviteRecord.alliance.joinPolicy === "request") {
			const actorName = user.nickname || user.name || `User #${userId}`;
			await this.prisma.allianceJoinRequest.upsert({
				where: {
					allianceId_userId: {
						allianceId: inviteRecord.allianceId,
						userId
					}
				},
				update: {
					status: "pending",
					reviewedAt: null,
					reviewedById: null
				},
				create: {
					allianceId: inviteRecord.allianceId,
					userId,
					status: "pending"
				}
			});

			await this.writeActivityLog(
				this.prisma,
				inviteRecord.allianceId,
				"join_request_created",
				`${actorName} asked to join the alliance.`,
				userId
			);

			return {
				success: "true",
				status: "requested"
			};
		}

		await this.prisma.user.update({
			where: { id: userId },
			data: {
				allianceId: inviteRecord.allianceId,
				allianceRole: "member",
				allianceJoinedAt: new Date()
			}
		});

		await this.pixelService.updateUserRegionStatsForAllianceChange(userId, null, inviteRecord.allianceId);

		await this.writeActivityLog(
			this.prisma,
			inviteRecord.allianceId,
			"member_joined",
			`${user.nickname || user.name || `User #${userId}`} joined the alliance.`,
			userId
		);

		return { success: "true", status: "joined" };
	}

	async leaveAlliance(userId: number, successorUserId?: number | null) {
		const user = await this.requireAllianceMember(userId);
		const allianceId = user.allianceId!;
		const actorName = await this.getAllianceDisplayName(userId);
		const normalizedSuccessorId = Number.isFinite(successorUserId)
			? Number(successorUserId)
			: null;

		await this.prisma.$transaction(async (tx) => {
			const remainingMembers = await tx.user.findMany({
				where: {
					allianceId,
					id: { not: userId }
				},
				select: {
					id: true,
					name: true,
					nickname: true,
					allianceRole: true,
					allianceJoinedAt: true
				},
				orderBy: [
					{ allianceJoinedAt: "asc" },
					{ id: "asc" }
				]
			});

			if (user.allianceRole === "owner") {
				if (remainingMembers.length === 0) {
					throw new ValidationError("Delete the alliance if you want to leave as the only owner");
				}

				if (!normalizedSuccessorId) {
					throw new ValidationError("Pick a new owner before leaving the alliance");
				}

				const nextOwner = remainingMembers.find((member) => member.id === normalizedSuccessorId);
				if (!nextOwner) {
					throw new ValidationError("Pick someone from the alliance to become the next owner");
				}

				await tx.user.update({
					where: { id: nextOwner.id },
					data: { allianceRole: "owner" }
				});

				await tx.alliance.update({
					where: { id: allianceId },
					data: { ownerId: nextOwner.id }
				});

				await this.writeActivityLog(
					tx,
					allianceId,
					"owner_transferred",
					`${actorName} passed ownership to ${nextOwner.nickname || nextOwner.name || `User #${nextOwner.id}`}.`,
					userId,
					nextOwner.id
				);
			}

			await tx.user.update({
				where: { id: userId },
				data: {
					allianceId: null,
					allianceRole: "member",
					allianceJoinedAt: null
				}
			});

			await this.writeActivityLog(
				tx,
				allianceId,
				"member_left",
				`${actorName} left the alliance.`,
				userId
			);
		});

		await this.pixelService.updateUserRegionStatsForAllianceChange(userId, allianceId, null);

		return { success: true };
	}

	async deleteAlliance(userId: number) {
		const user = await this.requireAllianceMember(userId);
		if (user.allianceRole !== "owner") {
			throw new Error("Forbidden");
		}

		const allianceId = user.allianceId!;
		const actorName = await this.getAllianceDisplayName(userId);
		const members = await this.prisma.user.findMany({
			where: { allianceId },
			select: { id: true }
		});

		await this.prisma.$transaction(async (tx) => {
			await this.writeActivityLog(
				tx,
				allianceId,
				"alliance_deleted",
				`${actorName} deleted the alliance.`,
				userId
			);

			await tx.allianceInvite.deleteMany({
				where: { allianceId }
			});

			await tx.bannedUser.deleteMany({
				where: { allianceId }
			});

			await tx.allianceJoinRequest.deleteMany({
				where: { allianceId }
			});

			await tx.chatMessage.deleteMany({
				where: { channel: "alliance", allianceId }
			});

			await tx.allianceActivityLog.deleteMany({
				where: { allianceId }
			});

			await tx.user.updateMany({
				where: { allianceId },
				data: {
					allianceId: null,
					allianceRole: "member",
					allianceJoinedAt: null
				}
			});

			await tx.alliance.delete({
				where: { id: allianceId }
			});
		});

		await Promise.all(
			members.map((member) => this.pixelService.updateUserRegionStatsForAllianceChange(member.id, allianceId, null))
		);

		return { success: true };
	}

	async updateHeadquarters(userId: number, input: UpdateAllianceHQInput) {
		const { latitude, longitude } = input;

		if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
			throw new ValidationError("invalid_coordinates");
		}

		const { user, permissions } = await this.getAllianceContext(userId);
		this.ensureAlliancePermission(user.allianceRole, permissions, "setHeadquarters");

		await this.prisma.alliance.update({
			where: { id: user.allianceId! },
			data: {
				hqLatitude: latitude,
				hqLongitude: longitude
			}
		});

		const actorName = await this.getAllianceDisplayName(userId);
		await this.writeActivityLog(
			this.prisma,
			user.allianceId!,
			"hq_updated",
			`${actorName} updated the alliance headquarters.`,
			userId,
			null,
			{
				latitude,
				longitude
			}
		);

		return { success: true };
	}

	async getMembers(userId: number, page: number) {
		const pageSize = PAGINATION_CONSTANTS.PAGE_SIZE;
		const user = await this.requireAllianceMember(userId);

		const members = await this.prisma.user.findMany({
			where: { allianceId: user.allianceId! },
			skip: page * pageSize,
			take: pageSize + 1,
			select: {
				id: true,
				name: true,
				nickname: true,
				picture: true,
				allianceRole: true,
				allianceJoinedAt: true
			},
			orderBy: [
				{ allianceJoinedAt: "asc" },
				{ id: "asc" }
			]
		});

		const hasNext = members.length > pageSize;
		const data = (hasNext ? members.slice(0, -1) : members).sort((left, right) => {
			const leftRole = left.allianceRole as AllianceMemberRole;
			const rightRole = right.allianceRole as AllianceMemberRole;
			return rolePriority[rightRole] - rolePriority[leftRole];
		});

		return {
			data: data.map(member => ({
				id: member.id,
				name: member.nickname || member.name || "Unknown",
				picture: member.picture || DEFAULT_PROFILE_PICTURE,
				role: member.allianceRole,
				joinedAt: member.allianceJoinedAt?.toISOString() || null
			})),
			hasNext
		};
	}

	async getBannedMembers(userId: number, page: number) {
		const pageSize = PAGINATION_CONSTANTS.PAGE_SIZE;
		const { user, permissions } = await this.getAllianceContext(userId);
		this.ensureAlliancePermission(user.allianceRole, permissions, "moderateMembers");

		const bannedUsers = await this.prisma.bannedUser.findMany({
			where: { allianceId: user.allianceId! },
			skip: page * pageSize,
			take: pageSize + 1,
			orderBy: { createdAt: "desc" }
		});

		const userIds = bannedUsers.map(banned => banned.userId);
		const users = await this.prisma.user.findMany({
			where: { id: { in: userIds } },
			select: {
				id: true,
				nickname: true,
				name: true,
				picture: true
			}
		});

		const userMap = new Map(users.map(u => [u.id, u]));

		const hasNext = bannedUsers.length > pageSize;
		const data = hasNext ? bannedUsers.slice(0, -1) : bannedUsers;

		return {
			data: data.map(banned => {
				const user = userMap.get(banned.userId);
				return {
					id: banned.userId,
					name: user?.nickname || user?.name || "Unknown",
					picture: user?.picture || DEFAULT_PROFILE_PICTURE
				};
			}),
			hasNext
		};
	}

	async promoteUser(userId: number, promotedUserId: number) {
		await this.setMemberRole(userId, promotedUserId, "admin");
	}

	async setMemberRole(userId: number, targetUserId: number, role: AllianceMemberRole) {
		const user = await this.requireAllianceMember(userId);
		if (user.allianceRole !== "owner") {
			throw new Error("Forbidden");
		}

		if (!["owner", "admin", "mod", "member"].includes(role)) {
			throw new ValidationError("invalid_role");
		}

		const target = await this.getAllianceMemberOrThrow(user.allianceId!, targetUserId);
		const actorName = await this.getAllianceDisplayName(userId);
		const targetName = target.nickname || target.name || `User #${target.id}`;
		if (target.id === user.id && role !== "owner") {
			throw new ValidationError("cannot_change_own_role");
		}

		if (role === "owner") {
			if (target.id === user.id) {
				return { success: true };
			}

			await this.prisma.$transaction(async (tx) => {
				await tx.user.update({
					where: { id: user.id },
					data: { allianceRole: "admin" }
				});

				await tx.user.update({
					where: { id: target.id },
					data: { allianceRole: "owner" }
				});

				await tx.alliance.update({
					where: { id: user.allianceId! },
					data: { ownerId: target.id }
				});

				await this.writeActivityLog(
					tx,
					user.allianceId!,
					"owner_transferred",
					`${actorName} made ${targetName} the new owner.`,
					userId,
					target.id
				);
			});

			return { success: true };
		}

		if (target.allianceRole === "owner") {
			throw new ValidationError("cannot_change_owner_role");
		}

		await this.prisma.user.update({
			where: { id: target.id },
			data: { allianceRole: role }
		});

		await this.writeActivityLog(
			this.prisma,
			user.allianceId!,
			"role_updated",
			`${actorName} changed ${targetName}'s role to ${humanRoleLabel(role)}.`,
			userId,
			target.id,
			{
				role
			}
		);

		return { success: true };
	}

	async kickUser(userId: number, targetUserId: number) {
		const { user, permissions } = await this.getAllianceContext(userId);
		this.ensureAlliancePermission(user.allianceRole, permissions, "moderateMembers");

		const target = await this.getAllianceMemberOrThrow(user.allianceId!, targetUserId);
		const targetRole = target.allianceRole as AllianceMemberRole;
		const actingRole = user.allianceRole as AllianceMemberRole;
		const actorName = await this.getAllianceDisplayName(userId);
		const targetName = target.nickname || target.name || `User #${target.id}`;

		if (target.id === user.id) {
			throw new ValidationError("use_leave_for_self");
		}

		if (targetRole === "owner") {
			throw new Error("Forbidden");
		}

		if (actingRole === "admin" && !["member", "mod"].includes(targetRole)) {
			throw new Error("Forbidden");
		}

		await this.prisma.user.update({
			where: { id: target.id },
			data: {
				allianceId: null,
				allianceRole: "member",
				allianceJoinedAt: null
			}
		});

		await this.pixelService.updateUserRegionStatsForAllianceChange(target.id, user.allianceId!, null);
		await this.writeActivityLog(
			this.prisma,
			user.allianceId!,
			"member_kicked",
			`${actorName} removed ${targetName} from the alliance.`,
			userId,
			target.id
		);
		return { success: true };
	}

	async banUser(userId: number, bannedUserId: number) {
		const { user, permissions } = await this.getAllianceContext(userId);
		this.ensureAlliancePermission(user.allianceRole, permissions, "moderateMembers");

		const target = await this.getAllianceMemberOrThrow(user.allianceId!, bannedUserId);
		const targetRole = target.allianceRole as AllianceMemberRole;
		const actingRole = user.allianceRole as AllianceMemberRole;
		const actorName = await this.getAllianceDisplayName(userId);
		const targetName = target.nickname || target.name || `User #${target.id}`;

		if (target.id === user.id || targetRole === "owner") {
			throw new Error("Forbidden");
		}

		if (actingRole === "admin" && !["member", "mod"].includes(targetRole)) {
			throw new Error("Forbidden");
		}

		await this.prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: target.id },
				data: {
					allianceId: null,
					allianceRole: "member",
					allianceJoinedAt: null
				}
			});

			await tx.bannedUser.upsert({
				where: {
					userId_allianceId: {
						userId: target.id,
						allianceId: user.allianceId!
					}
				},
				update: {},
				create: {
					userId: target.id,
					allianceId: user.allianceId!
				}
			});

			await this.writeActivityLog(
				tx,
				user.allianceId!,
				"member_banned",
				`${actorName} banned ${targetName} from the alliance.`,
				userId,
				target.id
			);
		});

		await this.pixelService.updateUserRegionStatsForAllianceChange(target.id, user.allianceId!, null);
		return { success: true };
	}

	async unbanUser(userId: number, unbannedUserId: number) {
		const { user, permissions } = await this.getAllianceContext(userId);
		this.ensureAlliancePermission(user.allianceRole, permissions, "moderateMembers");

		const targetName = await this.getAllianceDisplayName(unbannedUserId);
		const actorName = await this.getAllianceDisplayName(userId);

		await this.prisma.bannedUser.deleteMany({
			where: {
				userId: unbannedUserId,
				allianceId: user.allianceId!
			}
		});

		await this.writeActivityLog(
			this.prisma,
			user.allianceId!,
			"member_unbanned",
			`${actorName} removed the ban for ${targetName}.`,
			userId,
			unbannedUserId
		);

		return { success: true };
	}

	async getJoinRequests(userId: number) {
		const { user, permissions } = await this.getAllianceContext(userId);
		this.ensureAlliancePermission(user.allianceRole, permissions, "reviewJoinRequests");

		const requests = await this.prisma.allianceJoinRequest.findMany({
			where: {
				allianceId: user.allianceId!,
				status: "pending"
			},
			orderBy: {
				createdAt: "asc"
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						nickname: true,
						picture: true,
						level: true,
						pixelsPainted: true,
						country: true
					}
				}
			}
		});

		return requests.map((request) => ({
			id: request.id,
			message: request.message || "",
			createdAt: request.createdAt.toISOString(),
			user: {
				id: request.user.id,
				name: request.user.nickname || request.user.name || `User #${request.user.id}`,
				picture: request.user.picture || DEFAULT_PROFILE_PICTURE,
				level: Math.max(1, Math.round(request.user.level * 100) / 100),
				pixelsPainted: request.user.pixelsPainted,
				country: request.user.country
			}
		}));
	}

	async approveJoinRequest(userId: number, requestId: number) {
		const { user, permissions } = await this.getAllianceContext(userId);
		this.ensureAlliancePermission(user.allianceRole, permissions, "reviewJoinRequests");

		const request = await this.prisma.allianceJoinRequest.findFirst({
			where: {
				id: requestId,
				allianceId: user.allianceId!,
				status: "pending"
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						nickname: true,
						allianceId: true
					}
				}
			}
		});

		if (!request) {
			throw new ValidationError("join_request_not_found");
		}

		if (request.user.allianceId) {
			throw new ValidationError("request_user_already_in_alliance");
		}

		await this.prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: request.user.id },
				data: {
					allianceId: user.allianceId!,
					allianceRole: "member",
					allianceJoinedAt: new Date()
				}
			});

			await tx.allianceJoinRequest.update({
				where: { id: request.id },
				data: {
					status: "approved",
					reviewedById: userId,
					reviewedAt: new Date()
				}
			});

			await this.writeActivityLog(
				tx,
				user.allianceId!,
				"join_request_approved",
				`${await this.getAllianceDisplayName(userId)} approved ${request.user.nickname || request.user.name || `User #${request.user.id}`}'s join request.`,
				userId,
				request.user.id
			);
		});

		await this.pixelService.updateUserRegionStatsForAllianceChange(request.user.id, null, user.allianceId!);
		return { success: true };
	}

	async denyJoinRequest(userId: number, requestId: number) {
		const { user, permissions } = await this.getAllianceContext(userId);
		this.ensureAlliancePermission(user.allianceRole, permissions, "reviewJoinRequests");

		const request = await this.prisma.allianceJoinRequest.findFirst({
			where: {
				id: requestId,
				allianceId: user.allianceId!,
				status: "pending"
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						nickname: true
					}
				}
			}
		});

		if (!request) {
			throw new ValidationError("join_request_not_found");
		}

		await this.prisma.$transaction(async (tx) => {
			await tx.allianceJoinRequest.update({
				where: { id: request.id },
				data: {
					status: "denied",
					reviewedById: userId,
					reviewedAt: new Date()
				}
			});

			await this.writeActivityLog(
				tx,
				user.allianceId!,
				"join_request_denied",
				`${await this.getAllianceDisplayName(userId)} denied ${request.user.nickname || request.user.name || `User #${request.user.id}`}'s join request.`,
				userId,
				request.user.id
			);
		});

		return { success: true };
	}

	async updateAnnouncement(userId: number, rawAnnouncement?: string) {
		const { user, alliance, permissions } = await this.getAllianceContext(userId);
		this.ensureAlliancePermission(user.allianceRole, permissions, "editAnnouncement");

		const announcement = this.sanitizeAnnouncement(rawAnnouncement);
		const actorName = await this.getAllianceDisplayName(userId);

		await this.prisma.alliance.update({
			where: { id: alliance.id },
			data: {
				announcement,
				announcementUpdatedAt: announcement ? new Date() : null
			}
		});

		await this.writeActivityLog(
			this.prisma,
			alliance.id,
			announcement ? "announcement_updated" : "announcement_cleared",
			announcement
				? `${actorName} updated the alliance announcement.`
				: `${actorName} cleared the alliance announcement.`,
			userId
		);

		return { success: true };
	}

	async getActivityLogs(userId: number) {
		const { user, permissions } = await this.getAllianceContext(userId);
		this.ensureAlliancePermission(user.allianceRole, permissions, "viewActivityLog");

		const logs = await this.prisma.allianceActivityLog.findMany({
			where: {
				allianceId: user.allianceId!
			},
			orderBy: {
				createdAt: "desc"
			},
			take: 80
		});

		return logs.map((log) => ({
			id: log.id,
			type: log.type,
			message: log.message,
			createdAt: log.createdAt.toISOString(),
			actorUserId: log.actorUserId,
			targetUserId: log.targetUserId
		}));
	}

	async updatePermissions(userId: number, rawPermissions: unknown) {
		const user = await this.requireAllianceMember(userId);
		if (user.allianceRole !== "owner") {
			throw new Error("Forbidden");
		}

		const permissions = this.sanitizePermissionConfig(rawPermissions);
		await this.prisma.alliance.update({
			where: { id: user.allianceId! },
			data: {
				rolePermissions: permissions
			}
		});

		await this.writeActivityLog(
			this.prisma,
			user.allianceId!,
			"permissions_updated",
			`${await this.getAllianceDisplayName(userId)} updated the alliance role permissions.`,
			userId
		);

		return {
			success: true,
			permissions
		};
	}

	async getLeaderboard(userId: number, mode: string) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId }
		});

		if (!user || !user.allianceId) {
			throw new Error("Forbidden");
		}

		const dateFilter = getDateFilter(mode as LeaderboardMode);

		if (mode === "all-time") {
			// Get all members of this alliance
			const members = await this.prisma.user.findMany({
				where: { allianceId: user.allianceId },
				select: {
					id: true,
					name: true,
					nickname: true,
					picture: true,
					equippedFlag: true,
					showLastPixel: true,
					allianceJoinedAt: true
				}
			});

			// Calculate pixels painted by each member after joining alliance
			const memberStats = await Promise.all(members.map(async (member) => {
				if (!member.allianceJoinedAt) return null;

				const pixelsPainted = await this.prisma.pixel.count({
					where: {
						paintedBy: member.id,
						paintedAt: { gte: member.allianceJoinedAt }
					}
				});

				return {
					...member,
					pixelsPainted
				};
			}));

			// Filter out members with no pixels and sort by pixels painted
			const validMembers = memberStats
				.filter(m => m && m.pixelsPainted > 0)
				.sort((a, b) => b!.pixelsPainted - a!.pixelsPainted)
				.slice(0, 50);

			const lastPixels = new Map<number, { latitude: number; longitude: number }>();
			await Promise.all(validMembers.map(async (m) => {
				if (!m?.showLastPixel) return;

				const last = await this.prisma.pixel.findFirst({
					where: { paintedBy: m.id },
					orderBy: [{ paintedAt: "desc" }, { id: "desc" }],
					select: { tileX: true, tileY: true, x: true, y: true }
				});
				if (last) {
					const coords = RegionService.pixelsToCoordinates([last.tileX, last.tileY], [last.x, last.y]);
					lastPixels.set(m.id, coords);
				}
			}));

			return validMembers.map(member => {
				const memberLastPixels = member?.showLastPixel ? lastPixels.get(member.id) : undefined;
				return {
					userId: member!.id,
					name: member!.nickname || member!.name || "Unknown",
					picture: member!.picture || DEFAULT_PROFILE_PICTURE,
					equippedFlag: member!.equippedFlag,
					pixelsPainted: member!.pixelsPainted,
					lastLatitude: memberLastPixels?.latitude,
					lastLongitude: memberLastPixels?.longitude
				};
			});
		}

		// Get all members of this alliance
		const members = await this.prisma.user.findMany({
			where: { allianceId: user.allianceId },
			select: {
				id: true,
				name: true,
				nickname: true,
				picture: true,
				equippedFlag: true,
				showLastPixel: true,
				allianceJoinedAt: true
			}
		});

		// Calculate pixels painted by each member after joining alliance within the time period
		const memberStats = await Promise.all(members.map(async (member) => {
			if (!member.allianceJoinedAt) return null;

			// Combine alliance join date with time period filter
			const paintedAtFilter: any = { gte: member.allianceJoinedAt };

			// Add time period filter if it exists (today/week/month)
			if (dateFilter && "paintedAt" in dateFilter && dateFilter.paintedAt) {
				// Use the later date between alliance join date and time period start
				const timePeriodStart = dateFilter.paintedAt.gte;
				if (timePeriodStart && timePeriodStart > member.allianceJoinedAt) {
					paintedAtFilter.gte = timePeriodStart;
				}
			}

			const pixelsPainted = await this.prisma.pixel.count({
				where: {
					paintedBy: member.id,
					paintedAt: paintedAtFilter
				}
			});

			return {
				...member,
				pixelsPainted
			};
		}));

		// Filter out members with no pixels and sort by pixels painted
		const validMembers = memberStats
			.filter(m => m && m.pixelsPainted > 0)
			.sort((a, b) => b!.pixelsPainted - a!.pixelsPainted)
			.slice(0, 50);

		const lastPixels = new Map<number, { latitude: number; longitude: number }>();
		await Promise.all(validMembers.map(async (m) => {
			if (!m?.showLastPixel) return;

			const last = await this.prisma.pixel.findFirst({
				where: { paintedBy: m.id },
				orderBy: [{ paintedAt: "desc" }, { id: "desc" }],
				select: { tileX: true, tileY: true, x: true, y: true }
			});
			if (last) {
				const coords = RegionService.pixelsToCoordinates([last.tileX, last.tileY], [last.x, last.y]);
				lastPixels.set(m.id, coords);
			}
		}));

		return validMembers.map(member => {
			const memberLastPixels = member?.showLastPixel ? lastPixels.get(member.id) : undefined;
			return {
				userId: member!.id,
				name: member!.nickname || member!.name || "Unknown",
				picture: member!.picture || DEFAULT_PROFILE_PICTURE,
				equippedFlag: member!.equippedFlag,
				pixelsPainted: member!.pixelsPainted,
				lastLatitude: memberLastPixels?.latitude,
				lastLongitude: memberLastPixels?.longitude
			};
		});
	}
}
