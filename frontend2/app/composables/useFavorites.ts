export interface FavoriteLocation {
	id: number;
	name: string;
	latitude: number;
	longitude: number;
}

export const useFavorites = () => {
	const config = useRuntimeConfig();

	const addFavorite = async (coords: LngLat): Promise<{ id: number; success: boolean }> => {
		const [lng, lat] = coords;
		return await $fetch(`${config.public.backendUrl}/favorite-location`, {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				latitude: lat,
				longitude: lng
			})
		});
	};

	const removeFavorite = async (id: number): Promise<{ success: boolean }> => {
		return await $fetch(`${config.public.backendUrl}/favorite-location/delete`, {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ id })
		});
	};

	return {
		addFavorite,
		removeFavorite
	};
};
