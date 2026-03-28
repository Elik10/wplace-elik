import { PrismaClient } from "@prisma/client";
import markdownit from "markdown-it";

interface NotificationItem {
	id: number;
	read: boolean;
	createdAt: Date;
	type: string;
	icon: string;
	title: string;
	message: string;
	sendingUser: {
		id: number;
		name: string;
	};
	isSystem?: boolean;
}

interface NotificationPage {
	notifications: NotificationItem[];
	nextCursor?: number;
}

export class NotificationService {
	private readonly prisma: PrismaClient;
	private readonly md = markdownit();

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	async create(userId: number, icon: string, title: string, message: string): Promise<void> {
		await this.prisma.notification.create({
			data: {
				userId,
				icon,
				title,
				message
			}
		});
	}

	async createSystemNotification(icon: string, title: string, message: string): Promise<void> {
		await this.prisma.systemNotification.create({
			data: {
				icon,
				title,
				message
			}
		});
	}

	async getUnreadCount(userId: number): Promise<number> {
		const [user, system] = await Promise.all([
			this.prisma.notification.count({
				where: {
					userId,
					read: false
				}
			}),

			this.prisma.systemNotification.count({
				where: {
					readBy: {
						none: {
							userId
						}
					}
				}
			})
		]);

		return user + system;
	}

	async getPage(userId: number, limit = 10): Promise<NotificationPage> {
		const [user, system] = await Promise.all([
			this.prisma.notification.findMany({
				where: {
					userId
				},
				orderBy: {
					createdAt: "desc"
				},
				include: {
					sendingUser: {
						select: {
							id: true,
							name: true
						}
					}
				},
				take: limit
			}),

			this.prisma.systemNotification.findMany({
				orderBy: {
					createdAt: "desc"
				},
				include: {
					readBy: {
						where: {
							userId
						},
						select: {
							userId: true
						}
					}
				},
				take: limit
			})
		]);

		const allNotifications: NotificationItem[] = [
			...user.map(item => ({
				id: item.id,
				read: item.read,
				createdAt: item.createdAt,
				type: "report_feedback",
				icon: item.icon,
				title: item.title,
				message: this.md.render(item.message),
				sendingUser: {
					id: item.sendingUser.id,
					name: item.sendingUser.name
				},
				isSystem: false
			})),

			...system.map(item => ({
				id: -item.id,
				read: item.readBy.length > 0,
				createdAt: item.createdAt,
				type: "report_feedback",
				icon: item.icon,
				title: item.title,
				message: this.md.render(item.message),
				sendingUser: {
					id: -1,
					name: "System"
				},
				isSystem: true
			}))
		];

		allNotifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

		return {
			notifications: allNotifications.slice(0, limit)
			// nextCursor: null
		};
	}

	async markAsRead(userId: number, notificationIds: number[]): Promise<void> {
		const userNotificationIds: number[] = [];
		const systemNotificationIds: number[] = [];

		for (const id of notificationIds) {
			if (id < 0) {
				systemNotificationIds.push(-id);
			} else {
				userNotificationIds.push(id);
			}
		}

		if (userNotificationIds.length > 0) {
			await this.prisma.notification.updateMany({
				where: {
					id: {
						in: userNotificationIds
					},
					userId,
					read: false
				},
				data: {
					read: true
				}
			});
		}

		if (systemNotificationIds.length > 0) {
			await this.prisma.systemNotificationRead.createMany({
				data: systemNotificationIds.map(systemNotificationId => ({
					systemNotificationId,
					userId
				})),
				skipDuplicates: true
			});
		}
	}

	async markAllAsRead(userId: number): Promise<void> {
		await this.prisma.notification.updateMany({
			where: {
				userId,
				read: false
			},
			data: {
				read: true
			}
		});

		const unreadSystemNotifications = await this.prisma.systemNotification.findMany({
			where: {
				readBy: {
					none: {
						userId
					}
				}
			},
			select: {
				id: true
			}
		});

		await this.prisma.systemNotificationRead.createMany({
			data: unreadSystemNotifications.map(notif => ({
				systemNotificationId: notif.id,
				userId
			})),
			skipDuplicates: true
		});
	}
}
