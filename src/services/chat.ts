import { PrismaClient } from "@prisma/client";
import { hasAlliancePermission } from "./alliance";

interface ChatMessageUser {
	id: number;
	name: string;
	picture: string | null;
	level: number;
}

interface ChatReplyRecord {
	id: number;
	content: string;
	createdAt: Date;
	user: ChatMessageUser;
}

interface ChatMessageRecord {
	id: number;
	content: string;
	channel: string;
	allianceId: number | null;
	createdAt: Date;
	user: ChatMessageUser;
	replyTo: ChatReplyRecord | null;
}

export interface ChatReplyItem {
	id: number;
	content: string;
	createdAt: Date;
	user: ChatMessageUser;
}

export interface ChatMessageItem {
	id: number;
	content: string;
	channel: "global" | "alliance";
	allianceId: number | null;
	createdAt: Date;
	user: ChatMessageUser;
	replyTo: ChatReplyItem | null;
	mentionedNames: string[];
}

const DEFAULT_PROFILE_PICTURE = "/img/gplace-logo.png";

export class ChatService {
	constructor(private readonly prisma: PrismaClient) {}

	private normalizeChannel(rawChannel?: string): "global" | "alliance" {
		return rawChannel === "alliance" ? "alliance" : "global";
	}

	private normalizeContent(rawContent: string): string {
		return rawContent
			.replaceAll("\r\n", "\n")
			.trim();
	}

	private parseMentionNames(content: string): string[] {
		const mentions = new Set<string>();
		const regex = /(?:^|\s)@([A-Za-z0-9_-]{3,16})\b/g;

		for (const match of content.matchAll(regex)) {
			const mention = match[1]?.trim();
			if (!mention) {
				continue;
			}

			mentions.add(mention);
			if (mentions.size >= 12) {
				break;
			}
		}

		return [...mentions];
	}

	private async getAllianceChatContext(userId: number) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				banned: true,
				allianceId: true,
				allianceRole: true,
				alliance: {
					select: {
						id: true,
						announcement: true,
						rolePermissions: true
					}
				}
			}
		});

		if (!user) {
			throw new Error("User not found");
		}

		if (user.banned) {
			throw new Error("Banned users cannot use chat");
		}

		if (!user.allianceId || !user.alliance) {
			throw new Error("No Alliance");
		}

		if (!hasAlliancePermission(user.allianceRole, user.alliance.rolePermissions, "useAllianceChat")) {
			throw new Error("Forbidden");
		}

		return user;
	}

	private serializeReply(reply: ChatReplyRecord | null): ChatReplyItem | null {
		if (!reply) {
			return null;
		}

		return {
			id: reply.id,
			content: reply.content,
			createdAt: reply.createdAt,
			user: {
				id: reply.user.id,
				name: reply.user.name,
				picture: reply.user.picture || DEFAULT_PROFILE_PICTURE,
				level: reply.user.level
			}
		};
	}

	private serializeMessage(message: ChatMessageRecord): ChatMessageItem {
		return {
			id: message.id,
			content: message.content,
			channel: message.channel === "alliance" ? "alliance" : "global",
			allianceId: message.allianceId ?? null,
			createdAt: message.createdAt,
			replyTo: this.serializeReply(message.replyTo),
			user: {
				id: message.user.id,
				name: message.user.name,
				picture: message.user.picture || DEFAULT_PROFILE_PICTURE,
				level: message.user.level
			},
			mentionedNames: this.parseMentionNames(message.content)
		};
	}

	async getRecentMessages(userId: number | null, rawChannel?: string): Promise<{ channel: "global" | "alliance"; announcement: string; messages: ChatMessageItem[]; }> {
		const channel = this.normalizeChannel(rawChannel);
		let allianceId: number | null = null;
		let announcement = "";

		if (channel === "alliance") {
			if (!userId) {
				throw new Error("Unauthorized");
			}

			const user = await this.getAllianceChatContext(userId);
			allianceId = user.allianceId;
			announcement = user.alliance?.announcement || "";
		}

		const messages = await this.prisma.chatMessage.findMany({
			where: channel === "alliance"
				? {
					channel: "alliance",
					allianceId
				}
				: {
					channel: "global"
				},
			orderBy: {
				createdAt: "desc"
			},
			take: 50,
			include: {
				user: {
					select: {
						id: true,
						name: true,
						picture: true,
						level: true
					}
				},
				replyTo: {
					select: {
						id: true,
						content: true,
						createdAt: true,
						user: {
							select: {
								id: true,
								name: true,
								picture: true,
								level: true
							}
						}
					}
				}
			}
		});

		return {
			channel,
			announcement,
			messages: messages
				.toReversed()
				.map((message) => this.serializeMessage(message))
		};
	}

	async createMessage(userId: number, rawContent: string, options?: { channel?: string; replyToId?: number | null; }) {
		const content = this.normalizeContent(rawContent);
		if (content.length === 0) {
			throw new Error("Message cannot be empty");
		}

		if (content.length > 280) {
			throw new Error("Message must be 280 characters or less");
		}

		const channel = this.normalizeChannel(options?.channel);
		const replyToId = Number.isFinite(options?.replyToId)
			? Number(options?.replyToId)
			: null;

		let allianceId: number | null = null;
		let senderName = `User #${userId}`;

		const [user, lastMessage] = await Promise.all([
			this.prisma.user.findUnique({
				where: {
					id: userId
				},
				select: {
					id: true,
					name: true,
					nickname: true,
					banned: true,
					allianceId: true,
					allianceRole: true,
					alliance: {
						select: {
							rolePermissions: true
						}
					}
				}
			}),
			this.prisma.chatMessage.findFirst({
				where: {
					userId
				},
				orderBy: {
					createdAt: "desc"
				},
				select: {
					createdAt: true
				}
			})
		]);

		if (!user) {
			throw new Error("User not found");
		}

		senderName = user.nickname || user.name || senderName;

		if (user.banned) {
			throw new Error("Banned users cannot use chat");
		}

		if (channel === "alliance") {
			if (!user.allianceId || !user.alliance) {
				throw new Error("No Alliance");
			}

			if (!hasAlliancePermission(user.allianceRole, user.alliance.rolePermissions, "useAllianceChat")) {
				throw new Error("Forbidden");
			}

			allianceId = user.allianceId;
		}

		if (lastMessage) {
			const elapsedMs = Date.now() - lastMessage.createdAt.getTime();
			if (elapsedMs < 3000) {
				const waitSeconds = Math.ceil((3000 - elapsedMs) / 1000);
				throw new Error(`Please wait ${waitSeconds}s before sending another message`);
			}
		}

		let replyToMessage: ChatMessageRecord | null = null;
		if (replyToId) {
			const replyCandidate = await this.prisma.chatMessage.findUnique({
				where: {
					id: replyToId
				},
				include: {
					user: {
						select: {
							id: true,
							name: true,
							picture: true,
							level: true
						}
					},
					replyTo: {
						select: {
							id: true,
							content: true,
							createdAt: true,
							user: {
								select: {
									id: true,
									name: true,
									picture: true,
									level: true
								}
							}
						}
					}
				}
			});

			if (!replyCandidate) {
				throw new Error("Reply target not found");
			}

			if (
				replyCandidate.channel !== channel ||
				(channel === "alliance" && replyCandidate.allianceId !== allianceId)
			) {
				throw new Error("Reply target not found");
			}

			replyToMessage = replyCandidate;
		}

		const message = await this.prisma.chatMessage.create({
			data: {
				userId,
				content,
				channel,
				allianceId,
				replyToId
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						picture: true,
						level: true
					}
				},
				replyTo: {
					select: {
						id: true,
						content: true,
						createdAt: true,
						user: {
							select: {
								id: true,
								name: true,
								picture: true,
								level: true
							}
						}
					}
				}
			}
		});

		const mentionNames = this.parseMentionNames(content);
		if (mentionNames.length > 0) {
			const mentionedUsers = await this.prisma.user.findMany({
				where: {
					id: {
						not: userId
					},
					...(channel === "alliance" && allianceId
						? {
							allianceId
						}
						: {}),
					OR: [
						{
							name: {
								in: mentionNames
							}
						},
						{
							nickname: {
								in: mentionNames
							}
						}
					]
				},
				select: {
					id: true
				}
			});

			if (mentionedUsers.length > 0) {
				await this.prisma.notification.createMany({
					data: mentionedUsers.map((mentionedUser) => ({
						userId: mentionedUser.id,
						sendingUserId: userId,
						icon: "alternate_email",
						title: channel === "alliance" ? "Mentioned in alliance chat" : "Mentioned in global chat",
						message: `${senderName} mentioned you in ${channel === "alliance" ? "alliance" : "global"} chat.`
					}))
				});
			}
		}

		if (replyToMessage && replyToMessage.user.id !== userId) {
			await this.prisma.notification.create({
				data: {
					userId: replyToMessage.user.id,
					sendingUserId: userId,
					icon: "reply",
					title: channel === "alliance" ? "New alliance reply" : "New reply",
					message: `${senderName} replied to your message.`
				}
			});
		}

		return this.serializeMessage(message);
	}
}
