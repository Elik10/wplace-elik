<template>
	<div class="user-line">
		<span v-if="$slots.prefix">
			<slot name="prefix" />
		</span>

		<span
			v-if="showAvatar ?? true"
			class="user-line-avatar"
		>
			<UserAvatar
				:user="user"
				:size="size"
			/>
		</span>

		<span class="user-line-name user-line-select">
			<b>{{ user.name }}</b>
			<i>#</i>
			<span>{{ user.id }}</span>
		</span>

		<VerifiedIcon
			v-if="user.verified"
			v-tooltip.top="'This player has been verified by an administrator of this instance.'"
			class="user-line-verified"
		/>

		<FlagIcon
			v-if="country"
			v-tooltip.top="country.name"
			class="user-line-flag"
			:code="country.code"
		/>

		<span
			v-if="user.discord"
			class="user-line-discord user-line-select">
			<DiscordIcon />

			<a
				v-if="user.discordUserId"
				:href="`https://discord.com/users/${user.discordUserId}`"
				target="_blank"
			>
				@{{ user.discord }}
			</a>

			<span
				v-else
				v-tooltip.top="'This Discord username has not been verified.'"
			>
				@{{ user.discord }}
			</span>
		</span>

		<span
			v-if="user.allianceName"
			class="user-line-alliance"
		>
			{{ user.allianceName }}
		</span>
	</div>
</template>

<script setup lang="ts">
import { COUNTRIES } from "~/utils/country";
import DiscordIcon from "~/components/icons/DiscordIcon.vue";
import VerifiedIcon from "~/components/icons/VerifiedIcon.vue";

export interface UserLineUser {
	id: number;
	name?: string;
	username?: string;
	allianceId?: number;
	allianceName?: string;
	equippedFlag: number;
	discord?: string;
	discordUserId?: string;
	verified?: boolean;
}

const props = defineProps<{
	user: UserLineUser;
	size?: "tiny" | "small" | "normal" | "large" | "xlarge";
	showAvatar?: boolean;
}>();

const country = computed(() => COUNTRIES.find(item => item.id === props.user?.equippedFlag));
</script>

<style scoped>
.user-line,
.user-line-discord {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 0.1rem 0.25rem;
}

.user-line-select {
	user-select: text;
	cursor: auto;
}

.user-line-avatar {
	line-height: 0;
	margin-inline-end: 0.25rem;
}

.user-line-name {
	display: flex;
	align-items: baseline;
}

.user-line-name b {
	font-weight: 500;
}

.user-line-name i {
	color: var(--p-text-muted-color);
	margin-left: 0.25em;
	margin-right: 0.1em;
}

.user-line-name i,
.user-line-name span {
	font-size: 0.9em;
	font-feature-settings: "tnum";
}

.user-line-discord {
	display: flex;
	align-items: center;
	gap: 0.375em;
	color: #5865f2;
	border-radius: 2rem;
	font-size: 0.85em;
}

.user-line-discord a {
	color: inherit;
	text-decoration: none;
}

.user-line-flag {
	margin-inline: 0.25rem;
	font-size: 1.15em;
}

.user-line-alliance {
	margin-start: auto;
	color: var(--p-blue-700);
	background: var(--p-blue-100);
	border-radius: 2rem;
	font-size: 0.85em;
	margin-inline: 0.25rem;
	padding: 0 0.5rem;
}
</style>
