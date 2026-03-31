(() => {
	let currentUser = null;
	let refreshTimer = null;
	let syncTimer = null;

	function requestJson(url, options = {}) {
		return fetch(url, options)
			.then(async (response) => {
				const payload = await response.json()
					.catch(() => ({}));

				if (!response.ok) {
					const error = new Error(payload.error || `Request failed (${response.status})`);
					error.status = response.status;
					throw error;
				}

				return payload;
			});
	}

	function removeCustomProfileBlocks() {
		document.getElementById("gplace-player-hub")?.remove();
		document.getElementById("gplace-player-panel")?.remove();
		document.querySelectorAll("[data-gplace-profile-extra]").forEach((element) => {
			element.remove();
		});
	}

	function isVisible(element) {
		if (!(element instanceof HTMLElement)) {
			return false;
		}

		const rect = element.getBoundingClientRect();
		if (rect.width < 220 || rect.height < 180) {
			return false;
		}

		const styles = window.getComputedStyle(element);
		return styles.display !== "none" && styles.visibility !== "hidden" && styles.opacity !== "0";
	}

	function isProfileMenuRoot(element) {
		if (!(element instanceof HTMLElement) || !isVisible(element) || !currentUser) {
			return false;
		}

		const text = element.textContent || "";
		return text.includes(currentUser.name) && text.includes("Log Out") && text.includes("Menu");
	}

	function findProfileMenuRoot() {
		return [...document.querySelectorAll("div, section, aside")]
			.filter((element) => isProfileMenuRoot(element))
			.sort((left, right) => {
				const leftRect = left.getBoundingClientRect();
				const rightRect = right.getBoundingClientRect();
				return leftRect.width * leftRect.height - rightRect.width * rightRect.height;
			})[0] || null;
	}

	function applyAvatarFallbacks() {
		if (!currentUser) {
			return;
		}

		const picture = currentUser.picture || "/img/gplace-logo.png";
		const images = new Set();
		const menuRoot = findProfileMenuRoot();
		if (menuRoot) {
			menuRoot.querySelectorAll("img").forEach((image) => images.add(image));
		}

		document.querySelectorAll("img[src^='data:image/png;base64,'], img[src*='logoold']").forEach((image) => {
			const rect = image.getBoundingClientRect();
			if (rect.top < Math.max(window.innerHeight * 0.45, 360) && rect.left > window.innerWidth * 0.55) {
				images.add(image);
			}
		});

		images.forEach((image) => {
			if (!(image instanceof HTMLImageElement)) {
				return;
			}

			const source = image.getAttribute("src") || "";
			const alt = image.getAttribute("alt") || "";
			const inProfileMenu = image.closest("aside, section, div");
			const profileLike = inProfileMenu && isProfileMenuRoot(inProfileMenu);
			const looksLikeProfileAvatar =
				profileLike ||
				alt.includes(currentUser.name) ||
				source.startsWith("data:image/png;base64,") ||
				source === "" ||
				source.includes("logoold");

			if (!looksLikeProfileAvatar) {
				return;
			}

			if (source !== picture) {
				image.src = picture;
			}
			image.style.imageRendering = "auto";
			image.style.objectFit = "cover";
		});
	}

	function syncProfileMenu() {
		removeCustomProfileBlocks();
		applyAvatarFallbacks();
	}

	async function loadCurrentUser() {
		try {
			currentUser = await requestJson("/me");
			syncProfileMenu();
		} catch (error) {
			if (error.status === 401) {
				currentUser = null;
				removeCustomProfileBlocks();
				return;
			}

			console.error("Failed to sync profile UI:", error);
		}
	}

	function scheduleSync(delay = 80) {
		if (syncTimer) {
			clearTimeout(syncTimer);
		}

		syncTimer = window.setTimeout(() => {
			syncTimer = null;
			syncProfileMenu();
		}, delay);
	}

	function beginRefreshLoop() {
		if (refreshTimer) {
			clearInterval(refreshTimer);
		}

		refreshTimer = window.setInterval(() => {
			void loadCurrentUser();
		}, 30000);
	}

	removeCustomProfileBlocks();

	document.addEventListener("click", (event) => {
		if (!(event.target instanceof Element)) {
			return;
		}

		if (event.target.closest("button, a, [role='button']")) {
			scheduleSync();
		}
	}, true);

	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) {
			void loadCurrentUser();
		}
	});

	window.addEventListener("gplace:profile-updated", (event) => {
		const nextUser = event instanceof CustomEvent ? event.detail?.user : null;
		if (nextUser) {
			currentUser = nextUser;
			syncProfileMenu();
			return;
		}

		void loadCurrentUser();
	});

	void loadCurrentUser();
	beginRefreshLoop();
})();
