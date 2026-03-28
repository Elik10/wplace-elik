import { computed, onUnmounted, ref } from "vue";

export const useCharges = () => {
	// Server state
	const serverCharges = ref<number | null>(null);
	const maxCharges = ref<number | null>(null);
	const cooldownMs = ref<number | null>(null);

	// Local state
	const uncommittedPixels = ref(0);

	// Recharge timer
	const timeUntilNextCharge = ref(0);
	let lastRechargeTime = Date.now();
	let interval: ReturnType<typeof setInterval> | null = null;

	// Charges available
	const currentCharges = computed(() => {
		if (serverCharges.value === null) {
			return null;
		}
		return Math.floor(serverCharges.value) - uncommittedPixels.value;
	});

	const initialize = (chargeCount: number, maxChargesCount: number, cooldownMsCount: number) => {
		serverCharges.value = chargeCount;
		maxCharges.value = maxChargesCount;
		cooldownMs.value = cooldownMsCount;

		const fraction = chargeCount - Math.floor(chargeCount);
		const timeIntoCurrentRecharge = cooldownMsCount * (1 - fraction);
		lastRechargeTime = Date.now() - (cooldownMsCount - timeIntoCurrentRecharge);

		startChargeTimer();
	};

	const startChargeTimer = () => {
		if (interval) {
			clearInterval(interval);
		}

		if (serverCharges.value === null || maxCharges.value === null || cooldownMs.value === null) {
			return;
		}

		const updateTimer = () => {
			if (serverCharges.value === null || maxCharges.value === null || cooldownMs.value === null) {
				return;
			}

			if (serverCharges.value < maxCharges.value) {
				const elapsed = Date.now() - lastRechargeTime;
				const remaining = cooldownMs.value - elapsed;

				if (remaining <= 0) {
					serverCharges.value = Math.min(serverCharges.value + 1, maxCharges.value);
					lastRechargeTime = Date.now();
					timeUntilNextCharge.value = serverCharges.value < maxCharges.value ? Math.ceil(cooldownMs.value / 1000) : 0;
				} else {
					timeUntilNextCharge.value = Math.ceil(remaining / 1000);
				}
			} else {
				timeUntilNextCharge.value = 0;
			}
		};

		updateTimer();
		interval = setInterval(updateTimer, 500);
	};

	const decrementCharge = () => {
		uncommittedPixels.value++;
	};

	const incrementCharge = () => {
		if (uncommittedPixels.value > 0) {
			uncommittedPixels.value--;
		}
	};

	const commitPixels = () => {
		// Match what the server state should be (ignoring bonuses)
		if (serverCharges.value !== null) {
			serverCharges.value = Math.max(0, serverCharges.value - uncommittedPixels.value);
			uncommittedPixels.value = 0;

			if (maxCharges.value !== null && serverCharges.value < maxCharges.value) {
				lastRechargeTime = Date.now();
				startChargeTimer();
			}
		}
	};

	const formattedTime = computed(() => {
		const minutes = Math.floor(timeUntilNextCharge.value / 60);
		const seconds = timeUntilNextCharge.value % 60;
		return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
	});

	onUnmounted(() => {
		if (interval) {
			clearInterval(interval);
		}
	});

	return {
		currentCharges,
		maxCharges,
		cooldownMs,
		timeUntilNextCharge,
		formattedTime,
		uncommittedPixels,
		decrementCharge,
		incrementCharge,
		commitPixels,
		initialize
	};
};
