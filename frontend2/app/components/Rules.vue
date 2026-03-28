<template>
	<p v-if="rules === null">
		Loading…
	</p>

	<ul v-else class="rules-list">
		<li v-if="rules.isMultiAccountAllowed"><i>🔑</i> You may create more than one account.</li>
		<li v-else><i>🔑</i> Do not create more than one account. If multiple accounts are detected, all accounts will be banned.</li>

		<li v-if="rules.isOffensiveContentAllowed"><i>🫢</i> You may draw content that is likely to offend others.</li>
		<li v-else><i>🫢</i> Do not draw offensive content.</li>

		<li v-if="rules.isExplicitContentAllowed"><i>🔞</i> You may draw explicit or suggestive content.</li>
		<li v-else><i>🔞</i> Do not draw content that is explicit or suggestive.</li>

		<li v-if="rules.isGriefingAllowed"><i>🖍️</i> You may draw over existing artwork to obscure it (griefing).</li>
		<li v-else><i>🖍️</i> Do not draw over existing artwork to obscure it (griefing).</li>

		<li v-if="rules.isKindGriefingAllowed"><i>🤝</i> You may draw over existing artwork if you are complementing it.</li>
		<li v-else><i>🤝</i> Do not modify existing artwork, even to improve it.</li>

		<li v-if="rules.isPoliticalGriefingAllowed"><i>🏴‍☠️</i> You may draw over political flags or portraits.</li>

		<li v-if="!rules.isVPNAllowed"><i>🛜</i> Use of VPNs or proxies is not allowed on this instance.</li>

		<li v-if="rules.isBottingAllowed"><i>🤖</i> You may use bots to automate drawing on this instance.</li>
		<li v-else><i>🤖</i> Use of bots or any other automation is not allowed on this instance.</li>

		<li><i>⚠️</i> Do not create excessive traffic that may affect other people’s experience on this instance.</li>
	</ul>

	<p v-if="rules?.extraRules">{{ rules?.extraRules }}</p>
</template>

<script setup lang="ts">
const props = defineProps<{
	isVisible: boolean;
}>();

interface Rules {
	isMultiAccountAllowed: boolean;
	isOffensiveContentAllowed: boolean;
	isExplicitContentAllowed: boolean;
	isGriefingAllowed: boolean;
	isKindGriefingAllowed: boolean;
	isPoliticalGriefingAllowed: boolean;
	isVPNAllowed: boolean;
	isBottingAllowed: boolean;
	extraRules?: string;
}

const rules = ref<Rules | null>(null);

onMounted(async () => {
	if (props.isVisible) {
		await loadRules();
	}
});

watch(() => props.isVisible, async (newValue) => {
	if (newValue && rules.value === null) {
		await loadRules();
	}
});

const loadRules = async () => {
	const config = useRuntimeConfig();
	rules.value = await $fetch(`${config.public.backendUrl}/checkrobots`);
};
</script>

<style scoped>
.rules-list {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	list-style: none;
	padding: 0;
}

.rules-list li {
	display: flex;
	flex-direction: row;
	align-items: first baseline;
}

.rules-list i {
	font-style: normal;
	margin-right: 0.75rem;
}
</style>
