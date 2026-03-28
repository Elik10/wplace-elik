<template>
	<Card class="store-item">
		<template #title>
			<div class="store-item-title">
				<slot name="icon" />
				{{ title }}
			</div>
		</template>

		<template #subtitle>
			{{ subtitle }}
		</template>

		<template #content>
			<div class="store-item-quantity">
				<div class="store-item-quantity-controls">
					<Button
						icon="pi"
						rounded
						severity="secondary"
						outlined
						:disabled="loading || !canDecrement"
						@click="handleDecrement"
					>
						<ZoomOutIcon />
					</Button>

					<InputNumber
						v-model="quantity"
						:min="1"
						:max="999"
						rounded
						:use-grouping="false"
						class="store-item-quantity-field"
						:disabled="loading"
						@blur="validateQuantity"
					/>

					<Button
						icon="pi"
						rounded
						severity="secondary"
						outlined
						:disabled="loading || !canIncrement"
						@click="handleIncrement"
					>
						<ZoomInIcon />
					</Button>
				</div>

				<BuyButton
					:disabled="loading || !isValid"
					:cost="props.cost * quantity"
					@click="$emit('purchase')"
				/>
			</div>
		</template>
	</Card>
</template>

<script setup lang="ts">
import Card from "primevue/card";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import BuyButton from "./BuyButton.vue";
import ZoomInIcon from "~/components/icons/ZoomInIcon.vue";
import ZoomOutIcon from "~/components/icons/ZoomOutIcon.vue";

const props = defineProps<{
	modelValue: number;
	title: string;
	subtitle: string;
	cost: number;
	userDroplets: number;
	loading: boolean;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: number];
	purchase: [];
}>();

const quantity = computed({
	get: () => props.modelValue,
	set: (value: number) => emit("update:modelValue", value)
});

const canDecrement = computed(() => quantity.value > 1);
const canIncrement = computed(() => quantity.value * props.cost < props.userDroplets);

const isValid = computed(() => {
	if (quantity.value < 1) {
		return false;
	}
	if (quantity.value * props.cost > props.userDroplets) {
		return false;
	}
	return true;
});

const handleDecrement = () => {
	quantity.value = Math.max(1, quantity.value - 1);
};

const handleIncrement = () => {
	quantity.value = Math.min(Math.floor(props.userDroplets / props.cost), quantity.value + 1);
};

const validateQuantity = () => {
	if (quantity.value < 1) {
		quantity.value = 1;
	} else if (quantity.value * props.cost > props.userDroplets) {
		quantity.value = Math.floor(props.userDroplets / props.cost);
	}
};
</script>

<style scoped>
.store-item-title {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.store-item-title :deep(.icon-wrapper) {
	font-size: 1.5rem;
}

.store-item-quantity {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1rem;
}

.store-item-quantity-controls {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.store-item-quantity-field :deep(input) {
	width: 8rem;
	border-radius: 2rem;
	text-align: center;
	font-size: 1.25rem;
	font-weight: 500;
	font-feature-settings: "tnum";
}
</style>
