export default defineNuxtPlugin(() => {
	const originalFetch = globalThis.$fetch;
	globalThis.$fetch = originalFetch.create({
		onResponseError: async ({ response }: { response: Response }) => {
			if (response?.status === 403 && response.headers.get("cf-mitigated") === "challenge") {
				const route = useRoute();
				const params = new URLSearchParams([["r", route.fullPath]]);
				location.href = `/challenge?${params.toString()}`;
			}
		}
	});
});
