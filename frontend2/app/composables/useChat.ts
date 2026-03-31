export interface ChatMessage {
	id: number;
	content: string;
	createdAt: string;
	user: {
		id: number;
		name: string;
		picture: string | null;
		level: number;
	};
}

interface ChatPage {
	messages: ChatMessage[];
}

export const useChat = () => {
	const config = useRuntimeConfig();
	const baseURL = config.public.backendUrl;

	const getMessages = async (): Promise<ChatPage> => {
		return await $fetch<ChatPage>(`${baseURL}/chat/messages`, {
			credentials: "include",
			headers: {
				"Content-Type": "application/json"
			}
		});
	};

	const sendMessage = async (content: string): Promise<ChatMessage> => {
		const { message } = await $fetch<{ message: ChatMessage; }>(`${baseURL}/chat/messages`, {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ content })
		});

		return message;
	};

	return {
		getMessages,
		sendMessage
	};
};
