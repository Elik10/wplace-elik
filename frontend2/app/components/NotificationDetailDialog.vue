<template>
	<Dialog
		modal
		dismissable-mask
		:draggable="false"
		:visible="isOpen"
		:style="{ width: '50rem', maxWidth: '100vw' }"
		@update:visible="handleClose"
	>
		<template #header>
			Notification
		</template>

		<div class="notification-item">
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
				<!-- eslint-disable vue/no-v-html -->
				<div
					class="notification-message"
					v-html="notification.message" />
				<!-- eslint-enable vue/no-v-html -->
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
		</div>
	</Dialog>
</template>

<script setup lang="ts">
import Avatar from "primevue/avatar";
import Dialog from "primevue/dialog";
import type { Notification } from "../composables/useNotifications";

const _props = defineProps<{
	isOpen: boolean;
	notification: Notification;
}>();

const emit = defineEmits<{
	close: [];
	countUpdated: [count: number];
}>();

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
</script>

<style scoped>
.notification-item {
	display: flex;
	gap: 1rem;
	padding: 1rem;
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
