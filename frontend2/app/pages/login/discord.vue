<template>
	<form
		class="form"
		:disabled="loading ? 'disabled' : null"
		@submit="submit"
	>
		<h2 v-if="welcome" class="head">One more step..</h2>
		<h2 v-else class="head">Link Discord Account</h2>

		<div
			v-if="discordUserId"
			class="form"
		>
			<p>
				<strong>Discord Username:</strong>
				{{ discordUsername }}
			</p>

			<Message
				v-if="boost"
				severity="success"
			>
				<strong v-if="boost === 'booster'">
					Thank you for contributing to our server!
				</strong>

				<strong v-else-if="boost === 'active'">
					Thanks for being an active server member!
				</strong>

				<strong v-else-if="boost === 'special'">
					You have special member status!
				</strong>

				Your paint cooldown has been set to {{ cooldown }} seconds.
			</Message>

			<Message
				v-else
				severity="info"
			>
				You’re not eligible for any boosts at this time. You will receive a notification when you become eligible.
			</Message>

			<p>Do you want to unlink your Discord account?</p>
			<p>After unlinking, you will be able to edit your Discord username field again.</p>
		</div>

		<div
			v-else
			class="form"
		>
			<p>Connect your Discord account to gplace.</p>
			<p>When you link your Discord account to gplace, you will receive exclusive perks such as shortened cooldown times, account recovery, and much more.</p>
			<p>Your Discord username on your profile cannot be changed while linked. You can unlink at any time.</p>
		</div>

		<Message
			v-if="errorMessage"
			severity="error"
		>
			{{ errorMessage }}
		</Message>

		<div class="buttons-container">
			<Button
				v-if="discordUserId"
				severity="danger"
				type="submit"
				:disabled="loading"
			>
				Unlink Discord Account
			</Button>

			<Button
				v-else
				severity="primary"
				type="submit"
				:disabled="loading"
			>
				Link Discord Account
			</Button>
		</div>

		<div v-if="welcome" class="buttons-container">
			<Button
				v-slot="slotProps"
				as-child
				severity="secondary"
				:disabled="loading"
			>
				<RouterLink
					:to="returnTo"
					:class="slotProps.class"
					:style="{ 'text-decoration': 'none' }"
				>
					Not now
				</RouterLink>
			</Button>
		</div>

		<div v-if="!welcome" class="reset-link">
			<RouterLink
				v-if="returnTo !== '/'"
				:to="returnTo"
			>
				Cancel
			</RouterLink>
		</div>
	</form>
</template>

<script setup lang="ts">
import Button from "primevue/button";
import Message from "primevue/message";
import { useErrorToast } from "~/composables/useErrorToast";
import { useUserProfile } from "~/composables/useUserProfile";
import { FetchError } from "ofetch";

const { getErrorMessage } = useErrorToast();
const { fetchUserProfile } = useUserProfile();

interface DiscordAuthURLResponse {
	url: string;
}

definePageMeta({
	layout: "auth"
});

const route = useRoute();

const loading = ref(false);
const discordUserId = ref<string | null>(null);
const discordUsername = ref<string | null>(null);
const cooldown = ref(0);
const boost = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const welcome = ref(false);
const returnTo = ref("/");

onMounted(async () => {
	returnTo.value = route.query.r as string ?? "/";
	errorMessage.value = route.query.error as string;
	welcome.value = route.query.for === "welcome";
	loading.value = true;

	try {
		const config = useRuntimeConfig();
		await $fetch(`${config.public.backendUrl}/discord/configured`);
	} catch (error: unknown) {
		errorMessage.value = error instanceof FetchError && error.statusCode === 503
			? "Discord linking is not available on this instance."
			: getErrorMessage(error);
		return;
	}

	await updateProfile();
	loading.value = false;
});

const updateProfile = async () => {
	const user = await fetchUserProfile();
	discordUserId.value = user?.discordUserId ?? null;
	discordUsername.value = user?.discord ?? null;
	cooldown.value = Math.floor((user?.charges?.cooldownMs ?? 0) / 1000);
	boost.value = user?.charges?.boost ?? null;
};

const submit = async (e: Event) => {
	e.preventDefault();
	loading.value = true;
	errorMessage.value = null;

	try {
		const config = useRuntimeConfig();
		if (discordUserId.value) {
			// Unlink
			await $fetch(`${config.public.backendUrl}/discord/unlink`, {
				method: "POST",
				credentials: "include"
			});
			await updateProfile();
		} else {
			// Link
			const { url } = await $fetch<DiscordAuthURLResponse>(`${config.public.backendUrl}/discord/auth-url`, {
				method: "POST",
				credentials: "include"
			});

			location.href = url;
		}
	} catch (error: unknown) {
		errorMessage.value = getErrorMessage(error);
	}

	loading.value = false;
};
</script>

<style scoped>
/* */
</style>
