<template>
	<Dialog
		modal
		dismissable-mask
		:draggable="false"
		:visible="isOpen"
		:style="{ width: '28rem', maxWidth: '96vw' }"
		@update:visible="handleClose"
	>
		<template #container>
			<section class="chat-sheet">
				<header class="chat-sheet__header">
					<h2>Chat</h2>

					<Button
						text
						rounded
						aria-label="Close chat"
						class="chat-sheet__close"
						@click="handleClose"
					>
						<CloseIcon />
					</Button>
				</header>

				<div class="chat-sheet__body">
					<div class="chat-sheet__stream-wrap">
						<div
							ref="messagesRef"
							class="chat-sheet__stream"
							@scroll="handleStreamScroll"
						>
							<div
								v-if="loading && messages.length === 0"
								class="chat-state"
							>
								<ProgressSpinner />
							</div>

							<div
								v-else-if="messages.length === 0"
								class="chat-state"
							>
								<div class="chat-empty">
									<div class="chat-empty__icon">
										<ChatIcon />
									</div>
									<strong>Room is quiet</strong>
									<span>Start the first conversation on the map.</span>
								</div>
							</div>

							<div
								v-else
								class="chat-list"
							>
								<article
									v-for="message in messages"
									:key="message.id"
									:class="[
										'chat-group',
										isOwnMessage(message) ? 'chat-group--mine' : null
									]"
								>
									<UserAvatar
										v-if="!isOwnMessage(message)"
										size="small"
										:user="message.user"
									/>

									<div class="chat-message__stack">
										<div :class="['chat-message__meta', isOwnMessage(message) ? 'chat-message__meta--mine' : null]">
											<strong v-if="!isOwnMessage(message)">{{ message.user.name }}</strong>
											<span>{{ formatTime(message.createdAt) }}</span>
										</div>

										<div class="chat-message__bubbles">
											<div class="chat-message__bubble">
												{{ message.content }}
											</div>
										</div>
									</div>

									<UserAvatar
										v-if="isOwnMessage(message)"
										size="small"
										:user="message.user"
									/>
								</article>
							</div>
						</div>

						<button
							v-if="showJumpToLatest"
							class="chat-sheet__jump"
							type="button"
							@click="scrollToBottom"
						>
							Jump to latest
						</button>
					</div>

					<footer class="chat-sheet__composer">
						<div
							v-if="errorMessage"
							class="chat-sheet__error"
						>
							{{ errorMessage }}
						</div>

						<div
							v-if="!isLoggedIn"
							class="chat-cta"
						>
							<div class="chat-cta__actions">
								<Button
									severity="secondary"
									raised
									rounded
									label="Log in"
									@click="emit('login')"
								/>

								<Button
									raised
									rounded
									label="Register"
									@click="emit('register')"
								/>
							</div>
						</div>

						<div
							v-else
							class="chat-compose"
						>
							<textarea
								ref="textareaRef"
								v-model="draft"
								maxlength="280"
								placeholder="Write a message"
								class="chat-compose__textarea"
								@keydown="handleComposerKeydown"
								@input="handleDraftInput"
							/>

							<div class="chat-compose__actions">
								<Button
									:disabled="!canSend"
									:loading="sending"
									rounded
									aria-label="Send message"
									class="chat-compose__send"
									@click="handleSend"
								>
									<template #icon>
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="18" height="18" fill="currentColor"><path d="M120-160v-640l760 320-760 320Zm80-120 474-200-474-200v142l240 58-240 60v140Zm0 0v-400 400Z"/></svg>
									</template>
								</Button>
							</div>
						</div>
					</footer>
				</div>
			</section>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import ProgressSpinner from "primevue/progressspinner";
import { type ChatMessage, useChat } from "~/composables/useChat";
import ChatIcon from "~/components/icons/ChatIcon.vue";
import CloseIcon from "~/components/icons/CloseIcon.vue";

const props = defineProps<{
	isOpen: boolean;
	isLoggedIn: boolean;
	currentUserId: number | null;
}>();

const emit = defineEmits<{
	close: [];
	login: [];
	register: [];
}>();

const { getMessages, sendMessage } = useChat();

const messages = ref<ChatMessage[]>([]);
const loading = ref(false);
const sending = ref(false);
const draft = ref("");
const errorMessage = ref("");
const messagesRef = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const showJumpToLatest = ref(false);

let refreshTimer: ReturnType<typeof setInterval> | null = null;

const canSend = computed(() => {
	const trimmedDraft = draft.value.trim();
	return props.isLoggedIn && trimmedDraft.length > 0 && trimmedDraft.length <= 280 && !sending.value;
});

const isOwnMessage = (message: ChatMessage) => {
	return props.currentUserId !== null && message.user.id === props.currentUserId;
};

const isNearBottom = () => {
	if (!messagesRef.value) {
		return true;
	}

	return messagesRef.value.scrollHeight - messagesRef.value.scrollTop - messagesRef.value.clientHeight < 72;
};

const syncJumpButton = () => {
	showJumpToLatest.value = !isNearBottom();
};

const autoResizeComposer = () => {
	if (!textareaRef.value) {
		return;
	}

	textareaRef.value.style.height = "0px";
	textareaRef.value.style.height = `${Math.min(textareaRef.value.scrollHeight, 180)}px`;
};

const focusComposer = async () => {
	await nextTick();

	if (!textareaRef.value) {
		return;
	}

	textareaRef.value.focus();
	textareaRef.value.selectionStart = textareaRef.value.value.length;
	textareaRef.value.selectionEnd = textareaRef.value.value.length;
};

const scrollToBottom = async () => {
	await nextTick();

	if (messagesRef.value) {
		messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
		syncJumpButton();
	}
};

const loadMessages = async (options: { forceScroll?: boolean; silent?: boolean; } = {}) => {
	const previousDistanceFromBottom = messagesRef.value
		? messagesRef.value.scrollHeight - messagesRef.value.scrollTop - messagesRef.value.clientHeight
		: 0;

	if (!options.silent && messages.value.length === 0) {
		loading.value = true;
	}

	try {
		const { messages: chatMessages } = await getMessages();
		messages.value = chatMessages;
		errorMessage.value = "";
		await nextTick();

		if (messagesRef.value) {
			messagesRef.value.scrollTop = options.forceScroll || previousDistanceFromBottom < 72
				? messagesRef.value.scrollHeight
				: Math.max(
					0,
					messagesRef.value.scrollHeight - messagesRef.value.clientHeight - previousDistanceFromBottom
				);
		}

		syncJumpButton();
	} catch (error) {
		console.error("Failed to load chat messages:", error);
		const fetchError = error as { data?: { error?: string; }; message?: string; };
		errorMessage.value = fetchError.data?.error ?? fetchError.message ?? "Failed to load chat messages.";
	} finally {
		loading.value = false;
	}
};

const startPolling = () => {
	stopPolling();
	refreshTimer = setInterval(() => {
		void loadMessages({ silent: true });
	}, 4000);
};

const stopPolling = () => {
	if (refreshTimer) {
		clearInterval(refreshTimer);
		refreshTimer = null;
	}
};

const handleSend = async () => {
	if (!canSend.value) {
		return;
	}

	sending.value = true;
	errorMessage.value = "";

	try {
		const message = await sendMessage(draft.value);
		messages.value = [...messages.value, message].slice(-50);
		draft.value = "";
		await scrollToBottom();

		setTimeout(() => {
			if (props.isOpen) {
				void loadMessages({ silent: true });
			}
		}, 800);
	} catch (error) {
		console.error("Failed to send chat message:", error);

		const fetchError = error as { data?: { error?: string; }; message?: string; };
		errorMessage.value = fetchError.data?.error ?? fetchError.message ?? "Failed to send message.";
	} finally {
		sending.value = false;
		autoResizeComposer();
		await focusComposer();
	}
};

const handleComposerKeydown = (event: KeyboardEvent) => {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		void handleSend();
	}
};

const handleDraftInput = () => {
	autoResizeComposer();
};

const handleStreamScroll = () => {
	syncJumpButton();
};

const handleClose = () => {
	stopPolling();
	emit("close");
};

const formatTime = (timestamp: string): string => {
	const date = new Date(timestamp);
	const diffMs = date.getTime() - Date.now();
	const seconds = Math.round(diffMs / 1000);
	const minutes = Math.round(diffMs / 60_000);
	const hours = Math.round(diffMs / 3_600_000);
	const days = Math.round(diffMs / 86_400_000);
	const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

	if (Math.abs(days) >= 7) {
		return date.toLocaleDateString();
	}

	if (Math.abs(days) >= 1) {
		return formatter.format(days, "day");
	}

	if (Math.abs(hours) >= 1) {
		return formatter.format(hours, "hour");
	}

	if (Math.abs(minutes) >= 1) {
		return formatter.format(minutes, "minute");
	}

	return formatter.format(seconds, "second");
};

watch(() => props.isOpen, async (isOpen) => {
	if (isOpen) {
		await loadMessages({ forceScroll: true });
		startPolling();
		if (props.isLoggedIn) {
			await focusComposer();
		}
	} else {
		stopPolling();
	}
});

watch(() => draft.value, () => {
	autoResizeComposer();
});

watch(() => props.isLoggedIn, async () => {
	if (props.isOpen && props.isLoggedIn) {
		await focusComposer();
	}
});

onUnmounted(() => {
	stopPolling();
});
</script>

<style scoped>
.chat-sheet {
	display: grid;
	grid-template-rows: auto minmax(0, 1fr);
	width: min(28rem, 96vw);
	height: min(72vh, 44rem);
	overflow: hidden;
	border: 1px solid rgba(148, 163, 184, 0.2);
	border-radius: 1.15rem;
	background: #f8fafc;
	color: #1f304a;
	box-shadow: 0 1.25rem 3rem rgba(12, 22, 44, 0.14);
}

.chat-sheet__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
	padding: 1rem 1.1rem 0.9rem;
	border-bottom: 1px solid #e7ebf1;
	background: #fff;
	color: #111827;
}

.chat-sheet__header h2 {
	margin: 0;
	font-size: 1.25rem;
	font-weight: 700;
	line-height: 1;
}

.chat-sheet__close {
	width: 2rem;
	height: 2rem;
	padding: 0;
	background: transparent;
	color: #6b7280;
}

.chat-sheet__body {
	display: grid;
	grid-template-rows: minmax(0, 1fr) auto;
	min-height: 0;
	background: #f8fafc;
}

.chat-sheet__stream-wrap {
	position: relative;
	min-height: 0;
	padding: 0.75rem 0.65rem 0;
}

.chat-sheet__stream {
	height: 100%;
	min-height: 14rem;
	overflow-y: auto;
	padding-right: 0.35rem;
}

.chat-state {
	display: grid;
	place-items: center;
	min-height: 100%;
}

.chat-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.75rem;
	max-width: 18rem;
	text-align: center;
	color: #5f6d84;
}

.chat-empty strong {
	color: #20314c;
	font-size: 1.1rem;
}

.chat-empty__icon {
	display: grid;
	place-items: center;
	width: 3rem;
	height: 3rem;
	border-radius: 0.9rem;
	background: #f3f4f6;
	color: #6b7280;
}

.chat-list {
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
}

.chat-group {
	display: flex;
	align-items: flex-end;
	gap: 0.65rem;
	padding: 0.45rem 0.6rem;
	border-radius: 0.85rem;
	transition: background 120ms ease;
}

.chat-group:hover {
	background: #eef2f6;
}

.chat-message__stack {
	display: flex;
	flex: 0 1 auto;
	flex-direction: column;
	gap: 0.35rem;
	min-width: 0;
	max-width: min(78%, 17.5rem);
}

.chat-group--mine {
	justify-content: flex-end;
}

.chat-group--mine .chat-message__stack {
	align-items: flex-end;
}

.chat-message__meta {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.35rem;
	color: #5f6d84;
	font-size: 0.72rem;
	font-weight: 600;
	padding-inline: 0.1rem;
}

.chat-message__meta strong {
	color: #111827;
	font-size: 0.76rem;
}

.chat-message__meta--mine {
	justify-content: flex-end;
}

.chat-message__bubbles {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	align-items: flex-start;
	width: 100%;
}

.chat-group--mine .chat-message__bubbles {
	align-items: flex-end;
}

.chat-message__bubble {
	display: inline-block;
	width: fit-content;
	max-width: 100%;
	padding: 0.55rem 0.75rem;
	border: 1px solid #e5eaf1;
	border-radius: 1rem 1rem 1rem 0.35rem;
	background: #fff;
	color: #1f2937;
	text-align: left;
	white-space: pre-wrap;
	word-break: break-word;
	line-height: 1.45;
	font-size: 0.82rem;
}

.chat-group--mine .chat-message__bubble {
	border-color: #dbe3ef;
	border-radius: 1rem 1rem 0.35rem 1rem;
	background: #2563eb;
	color: #fff;
}

.chat-sheet__jump {
	position: absolute;
	right: 1.45rem;
	bottom: 1rem;
	border: 0;
	border-radius: 999px;
	padding: 0.6rem 0.9rem;
	background: rgba(17, 24, 39, 0.94);
	color: #fff;
	cursor: pointer;
	font: 700 0.74rem/1 "Mona Sans Variable", system-ui, sans-serif;
	box-shadow: 0 0.9rem 1.5rem rgba(17, 24, 39, 0.16);
}

.chat-sheet__composer {
	padding: 0.75rem;
	border-top: 1px solid #e7ebf1;
	background: #fff;
}

.chat-sheet__error {
	margin-bottom: 0.8rem;
	padding: 0.75rem 0.85rem;
	border-radius: 1rem;
	background: rgba(255, 88, 88, 0.12);
	color: #b42318;
	font-size: 0.82rem;
	font-weight: 600;
}

.chat-cta,
.chat-compose {
	display: flex;
	flex-direction: row;
	align-items: flex-end;
	gap: 0.65rem;
}

.chat-cta__actions {
	display: flex;
	gap: 0.75rem;
}

.chat-compose__textarea {
	flex: 1;
	width: 100%;
	min-height: 2.7rem;
	max-height: 8.5rem;
	resize: none;
	border: 1px solid #d8e0ec;
	border-radius: 0.9rem;
	padding: 0.75rem 0.85rem;
	background: #f8fafc;
	color: #20314c;
	font: 500 0.84rem/1.45 "Mona Sans Variable", system-ui, sans-serif;
}

.chat-compose__textarea:focus {
	outline: 2px solid rgba(65, 105, 225, 0.16);
	border-color: rgba(65, 105, 225, 0.4);
}

.chat-compose__actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.65rem;
}

.chat-compose__send {
	width: 2.5rem;
	height: 2.5rem;
	padding: 0;
}

@media (max-width: 640px) {
	.chat-sheet {
		height: min(82vh, 44rem);
		border-radius: 1rem;
	}

	.chat-cta__actions,
	.chat-compose__actions {
		align-items: stretch;
	}

	.chat-message__stack {
		max-width: calc(100% - 2.5rem);
	}

	.chat-compose__send {
		width: 2.5rem;
		height: 2.5rem;
		padding: 0;
	}
}
</style>
