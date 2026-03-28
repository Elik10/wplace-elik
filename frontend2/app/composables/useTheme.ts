import { computed, onMounted, ref } from "vue";

export enum ThemeMode {
	Light = "light",
	Dark = "dark",
	Auto = "auto"
}

const currentTheme = ref<ThemeMode>(ThemeMode.Auto);
const isDarkMode = ref(false);

export function useTheme() {
	let darkModeQuery: MediaQueryList | null = null;

	const initTheme = () => {
		const theme = localStorage["theme"] as ThemeMode ?? ThemeMode.Auto;
		currentTheme.value = theme;
		applyTheme(theme);
	};

	const applyTheme = (theme: ThemeMode) => {
		const html = document.documentElement;

		if (theme === ThemeMode.Auto) {
			const prefersDark = globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
			isDarkMode.value = prefersDark;
		} else {
			isDarkMode.value = theme === "dark";
		}

		html.classList.toggle("app-dark", isDarkMode.value);
		html.style.colorScheme = theme === ThemeMode.Auto ? "light dark" : theme;
	};

	const setTheme = (theme: ThemeMode) => {
		currentTheme.value = theme;
		localStorage["theme"] = theme;
		applyTheme(theme);
	};

	onMounted(() => {
		initTheme();

		darkModeQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
		darkModeQuery.addEventListener("change", themeChanged);
	});

	onUnmounted(() => {
		if (darkModeQuery) {
			darkModeQuery.removeEventListener("change", themeChanged);
			darkModeQuery = null;
		}
	});

	const themeChanged = (e: MediaQueryListEvent) => {
		if (currentTheme.value === ThemeMode.Auto) {
			isDarkMode.value = e.matches;
			applyTheme(ThemeMode.Auto);
		}
	};

	return {
		currentTheme: computed(() => currentTheme.value),
		isDarkMode,
		initTheme,
		setTheme
	};
}
