import { useToast } from "primevue/usetoast";
import { FetchError } from "ofetch";
import type { ToastMessageOptions } from "primevue/toast";

export const useErrorToast = () => {
	const toast = useToast();
	const lastToast = ref<ToastMessageOptions | null>(null);

	const showToast = (options: ToastMessageOptions) => {
		if (lastToast.value) {
			toast.remove(lastToast.value);
		}

		lastToast.value = {
			severity: "info",
			closable: false,
			life: 3000,
			...options
		};
		toast.add(lastToast.value);
	};

	const getErrorMessage = (error: unknown) => {
		let summary = error instanceof Error ? error.message : String(error);

		// If this is a fetch error, use message from the server if it exists
		if (error instanceof FetchError) {
			const status = error.statusCode ?? 0;
			if (status === 500) {
				summary = "A server error occurred. Try again later.";
			} else if (status >= 500 && status < 600) {
				summary = "The server is temporarily unavailable. Try again shortly.";
			} else {
				switch (status) {
				case 429:
					summary = "Try again in a minute, rate limit exceeded";
					break;

				case 403:
					summary = "You have been banned.";
					break;

				default:
					summary = `Unknown server error. Try again later.\n${summary}`;
					break;
				}
			}

			const data = error.data as { error?: string; };
			if (data?.error) {
				summary = data.error;
			}
		}

		return summary;
	};

	const handleError = (error: unknown) => {
		showToast({
			severity: "error",
			summary: getErrorMessage(error),
			life: 5000
		});
	};

	return {
		showToast,
		getErrorMessage,
		handleError
	};
};
