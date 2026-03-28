<template>
	<Dialog
		modal
		dismissable-mask
		:draggable="false"
		:visible="isOpen"
		:header="dialogHeader"
		:style="{ width: '40rem', maxWidth: '90vw' }"
		@update:visible="handleClose"
	>
		<template #header>
			<div class="notification-dialog-header">
				<span>Notifications</span>

				<Button
					v-if="hasUnread"
					text
					size="small"
					severity="secondary"
					@click="handleMarkAllAsRead"
				>
					Mark all as read
				</Button>
			</div>
		</template>

		<div
			v-if="loading"
			class="notification-loading"
		>
			<ProgressSpinner />
		</div>

		<div
			v-else-if="notifications.length === 0"
			class="notification-empty"
		>
			<strong>No notifications</strong>
			<span>You'll receive notifications as you use gplace.</span>
		</div>

		<div
			v-else
			class="notification-list"
		>
			<div
				v-for="notification in notifications"
				:key="notification.id"
				class="notification-item"
				:class="{'notification-unread': !notification.read}"
				@click="handleNotificationClick(notification)"
			>
				<Avatar
					shape="circle"
					size="large"
				>
					<DynamicIcon :name="notification.icon" />
				</Avatar>
				<div class="notification-content">
					<div class="notification-title">
						{{ notification.title }}
					</div>
					<div class="notification-time">
						<span v-if="notification.sendingUser.id < 0">
							{{ notification.sendingUser.name }}
						</span>
						<span v-else>
							{{ notification.sendingUser.name }}#{{ notification.sendingUser.id }}
						</span>
						&middot;
						{{ formatTime(notification.createdAt) }}
					</div>
				</div>

				<NotificationDetailDialog
					:is-open="activeNotificationId === notification.id"
					:notification="notification"
					@close="activeNotificationId = null"
				/>
			</div>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Avatar from "primevue/avatar";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import ProgressSpinner from "primevue/progressspinner";
import { type Notification, useNotifications } from "../composables/useNotifications";

const props = defineProps<{
	isOpen: boolean;
}>();

const emit = defineEmits<{
	close: [];
	countUpdated: [count: number];
}>();

const { getPage, markAsRead, markAllAsRead } = useNotifications();

const notifications = ref<Notification[]>([]);
const loading = ref(false);
const activeNotificationId = ref<number | null>(null);

const hasUnread = computed(() => notifications.value.some(n => !n.read));

const dialogHeader = computed(() => {
	const unreadCount = notifications.value.filter(n => !n.read).length;
	return unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications";
});

const loadNotifications = async () => {
	loading.value = true;

	try {
		const result = await getPage();
		notifications.value = result.notifications;
	} catch (error) {
		console.error("Failed to load notifications:", error);
	}

	loading.value = false;
};

const handleNotificationClick = async (notification: Notification) => {
	activeNotificationId.value = notification.id;

	if (!notification.read) {
		try {
			await markAsRead([notification.id]);
			notification.read = true;
			updateUnreadCount();
		} catch (error) {
			console.error("Failed to mark notification as read:", error);
		}
	}
};

const handleMarkAllAsRead = async () => {
	try {
		await markAllAsRead();
		for (const item of notifications.value) {
			item.read = true;
		}
		updateUnreadCount();
	} catch (error) {
		console.error("Failed to mark all notifications as read:", error);
	}
};

const updateUnreadCount = () => {
	const count = notifications.value.filter(item => !item.read).length;
	emit("countUpdated", count);
};

const handleClose = () => {
	emit("close");
};

const formatTime = (timestamp: string): string => {
	const date = new Date(timestamp);
	const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
	const diffMs = date.getTime() - Date.now();
	const secs = Math.round(diffMs / 1000);
	const mins = Math.round(diffMs / 60_000);
	const hours = Math.round(diffMs / 3_600_000);
	const days = Math.round(diffMs / 86_400_000);

	if (Math.abs(days) >= 7) {
		return date.toLocaleDateString();
	} else if (Math.abs(days) >= 1) {
		return formatter.format(days, "day");
	} else if (Math.abs(hours) >= 1) {
		return formatter.format(hours, "hour");
	} else if (Math.abs(mins) >= 1) {
		return formatter.format(mins, "minute");
	} else {
		return formatter.format(secs, "second");
	}
};

watch(() => props.isOpen, (newVal) => {
	if (newVal) {
		loadNotifications();
	}
});

defineExpose({
	refresh: loadNotifications
});
</script>

<style scoped>
.notification-dialog-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	width: 100%;
	gap: 1rem;
}

.notification-loading,
.notification-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 3rem;
	color: var(--p-text-muted-color);
}

.notification-empty {
	gap: 1rem;
}

.notification-empty i {
	font-size: 3rem;
	opacity: 0.5;
}

.notification-list {
	display: flex;
	flex-direction: column;
	gap: 0;
	max-height: 60vh;
	overflow-y: auto;
}

.notification-item {
	display: flex;
	gap: 1rem;
	padding: 1rem;
	border-bottom: 1px solid var(--p-surface-border);
	cursor: pointer;
	transition: background-color 0.2s;
}

.notification-item:hover {
	background-color: var(--p-surface-hover);
}

.notification-item:last-child {
	border-bottom: none;
}

.notification-unread {
	background-color: var(--p-button-text-secondary-hover-background);
}

.notification-item :deep(.p-avatar) {
	background-color: var(--p-primary-color);
	color: white;
	flex-shrink: 0;
}

.notification-content {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.notification-title {
	font-weight: 600;
	font-size: 1rem;
}

.notification-message {
	color: var(--p-text-secondary-color);
	font-size: 0.875rem;
}

.notification-time {
	color: var(--p-text-muted-color);
	font-size: 0.75rem;
}
</style>
