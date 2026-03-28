<template>
	<Menu
		ref="menu"
		:model="menuItems"
		:popup="true"
	>
		<template #start>
			<div class="user-menu-header">
				<div class="user-info">
					<div class="avatar-container">
						<UserAvatar
							:user="user"
							size="large"
						/>
					</div>
					<div class="user-details">
						<div class="user-name-row">
							<UserLine
								:user="userLine"
								:show-avatar="false"
							/>
						</div>
						<div class="user-stat">
							Pixels painted: {{ user?.pixelsPainted.toLocaleString() }}
						</div>
						<div class="user-stat">
							Level {{ level }} ({{ levelProgress }}%)
						</div>
					</div>
				</div>

				<div class="theme-selector">
					<SelectButton
						:model-value="currentTheme"
						:options="themeOptions"
						size="small"
						fluid
						option-label="label"
						option-value="value"
						aria-label="Theme selector"
						@update:model-value="setThemeFromButton"
					/>
				</div>
			</div>
		</template>

		<template #item="{ item }">
			<a
				class="menu-item-link"
				@click="(event) => item.command?.({ originalEvent: event, item })"
			>
				<span>{{ item.label }}</span>
			</a>
		</template>
	</Menu>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Menu from "primevue/menu";
import SelectButton from "primevue/selectbutton";
import { ThemeMode, useTheme } from "../composables/useTheme";

const props = defineProps<{
	isOpen: boolean;
	user: UserProfile | null;
	levelProgress: number | null;
}>();

const level = computed(() => Math.floor(props.user?.level ?? 0));

const userLine = computed(() => {
	const user = props.user;
	if (!user) {
		return null;
	}

	return {
		id: user?.id,
		name: user?.name,
		allianceId: 0,
		allianceName: "",
		equippedFlag: user?.equippedFlag,
		verified: user?.verified
	};
});

const emit = defineEmits<{
	close: [];
	logout: [];
	openNotifications: [];
}>();

const menu = ref();

const { currentTheme, setTheme } = useTheme();

const themeOptions = computed(() => [
	{
		label: "Light",
		value: ThemeMode.Light
	},
	{
		label: "Auto",
		value: ThemeMode.Auto
	},
	{
		label: "Dark",
		value: ThemeMode.Dark
	}
]);

const menuItems = computed(() => [
	{
		label: "Notifications",
		command: () => {
			emit("openNotifications");
		}
	},
	{
		label: "Log out",
		command: () => {
			emit("logout");
			emit("close");
		}
	}
]);

const setThemeFromButton = (value: ThemeMode) => {
	// For whatever reason, you can deselect all options in SelectButton…
	value ??= ThemeMode.Auto;
	if (value !== currentTheme.value) {
		setTheme(value);
	}
};

defineExpose({
	toggle: (event: Event) => {
		menu.value.toggle(event);
	}
});
</script>

<style scoped>
.user-menu-header {
	padding: 1rem 1rem 0.5rem 1rem;
	border-bottom: 1px solid var(--p-surface-border);
}

.user-info {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}

.user-details {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	flex: 1;
}

.user-name-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.user-name {
	font-weight: 600;
	font-size: 1.125rem;
}

.user-id {
	font-size: 0.9rem;
}

.user-stat {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	font-size: 0.875rem;
	color: var(--p-text-muted-color);
	font-feature-settings: "tnum";
}

.user-stat i {
	font-size: 0.75rem;
}

.menu-item-link {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.75rem 1rem;
	cursor: pointer;
	text-decoration: none;
	color: inherit;
}

.menu-item-link:hover {
	background-color: var(--p-menuitem-hover-background);
}

.user-verified {
	line-height: 0;
}

.country-flag {
	font-size: 1.25rem;
	margin-top: -0.1em;
	line-height: 0;
}

.theme-selector {
	margin-top: 1rem;
}
</style>
