export interface Notification {
	id: number;
	read: boolean;
	createdAt: string;
	icon: string;
	title: string;
	message: string;
	summary: string;
	sendingUser: {
		id: number;
		name: string;
		profilePictureUrl: string | null;
	}
}

export interface NotificationPage {
	notifications: Notification[];
	nextCursor: null;
}

export const useNotifications = () => {
	const config = useRuntimeConfig();
	const baseURL = config.public.backendUrl;

	const getUnreadCount = async (): Promise<number> => {
		try {
			const { count } = await $fetch<{ count: number }>(`${baseURL}/notification/count`, {
				credentials: "include",
				headers: {
					"Content-Type": "application/json"
				}
			});
			return count;
		} catch (error) {
			console.error("Failed to fetch notification count:", error);
			return 0;
		}
	};

	const getPage = async (): Promise<NotificationPage> => {
		const data = await $fetch<NotificationPage>(`${baseURL}/notification/page`, {
			credentials: "include",
			headers: {
				"Content-Type": "application/json"
			}
		});

		return data;
	};

	const markAsRead = async (notificationIds: number[]): Promise<void> => {
		await $fetch(`${baseURL}/notification/mark-read`, {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ notificationIds })
		});
	};

	const markAllAsRead = async (): Promise<void> => {
		await $fetch(`${baseURL}/notification/mark-read/all`, {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json"
			}
		});
	};

	return {
		getUnreadCount,
		getPage,
		markAsRead,
		markAllAsRead
	};
};
