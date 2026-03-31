(() => {
	let state = {
		isOpen: false,
		loading: false,
		saving: false,
		uploading: false,
		notice: "",
		noticeTone: "success",
		user: null,
		form: {
			name: "",
			discord: "",
			showLastPixel: true
		}
	};
	let loadRevision = 0;
	let latestProfileOpenedAt = 0;

	function ensureStyles() {
		if (document.getElementById("gplace-profile-styles")) {
			return;
		}

		const link = document.createElement("link");
		link.id = "gplace-profile-styles";
		link.rel = "stylesheet";
		link.href = "/gplace-profile.css?v=20260330-1";
		document.head.appendChild(link);
	}

	function escapeHtml(value) {
		return String(value ?? "")
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll("\"", "&quot;")
			.replaceAll("'", "&#39;");
	}

	function profilePicture() {
		return state.user?.picture || "/img/gplace-logo.png";
	}

	function syncFormFromUser() {
		if (!state.user) {
			return;
		}

		state.form = {
			name: state.user.name || "",
			discord: state.user.discord || "",
			showLastPixel: state.user.showLastPixel !== false
		};
	}

	function ensurePanel() {
		let panel = document.getElementById("gplace-profile-panel");
		if (panel) {
			return panel;
		}

		panel = document.createElement("div");
		panel.id = "gplace-profile-panel";
		panel.hidden = true;
		panel.addEventListener("click", handleClick);
		panel.addEventListener("submit", handleSubmit);
		panel.addEventListener("input", handleInput);
		panel.addEventListener("change", handleChange);
		document.body.appendChild(panel);
		return panel;
	}

	function setNotice(message, tone) {
		state.notice = message || "";
		state.noticeTone = tone || "success";
		render();
	}

	function request(path, options = {}) {
		const init = {
			credentials: "include",
			headers: {
				"Accept": "application/json",
				...(options.body instanceof FormData ? {} : options.body ? { "Content-Type": "application/json" } : {})
			},
			...(options || {})
		};

		return fetch(path, init).then(async (response) => {
			const payload = await response.json().catch(() => ({}));
			return { response, payload };
		});
	}

	function noticeHtml() {
		if (!state.notice) {
			return "";
		}

		return `<div class="gpp-notice is-${escapeHtml(state.noticeTone)}">${escapeHtml(state.notice)}</div>`;
	}

	function bodyHtml() {
		if (state.loading && !state.user) {
			return `
				<div class="gpp-card">
					<h3>Loading profile</h3>
					<p>Your current settings are being pulled in.</p>
				</div>
			`;
		}

		if (!state.user) {
			return `
				<div class="gpp-card">
					<h3>Log in first</h3>
					<p>You need an account before you can edit your profile.</p>
					<div class="gpp-actions">
						<button class="gpp-button is-primary" type="button" data-profile-action="auth-login">Log in</button>
						<button class="gpp-button is-secondary" type="button" data-profile-action="auth-register">Register</button>
					</div>
				</div>
			`;
		}

		return `
			<div class="gpp-grid">
				<section class="gpp-card">
					<div class="gpp-avatar-stack">
						<div class="gpp-avatar">
							<img src="${escapeHtml(profilePicture())}" alt="${escapeHtml(state.form.name || "Profile")}">
						</div>
						<div class="gpp-avatar-actions">
							<button class="gpp-button is-primary" type="button" data-profile-action="choose-image" ${state.uploading ? "disabled" : ""}>
								${state.uploading ? "Uploading..." : "Upload image"}
							</button>
							<button class="gpp-button is-secondary" type="button" data-profile-action="reset-image" ${state.uploading ? "disabled" : ""}>Use gplace logo</button>
						</div>
						<input class="gpp-hidden-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-profile-file>
					</div>
				</section>
				<section class="gpp-card">
					<form class="gpp-form" data-profile-form="save">
						<div class="gpp-form-grid">
							<label class="gpp-field">
								<span class="gpp-label">Display name</span>
								<input class="gpp-input" type="text" name="name" maxlength="16" value="${escapeHtml(state.form.name)}" placeholder="Your name">
							</label>
							<label class="gpp-field">
								<span class="gpp-label">Discord</span>
								<input class="gpp-input" type="text" name="discord" maxlength="64" value="${escapeHtml(state.form.discord)}" placeholder="Discord username">
							</label>
							<label class="gpp-field gpp-field--full">
								<div class="gpp-toggle">
									<input type="checkbox" name="showLastPixel" ${state.form.showLastPixel ? "checked" : ""}>
								<div>
									<strong>Show my last painted pixel</strong>
									<span>Turn this on if you want other people to see the last pixel you painted.</span>
								</div>
							</div>
						</label>
						</div>
						<div class="gpp-actions">
							<button class="gpp-button is-primary" type="submit" ${state.saving ? "disabled" : ""}>
								${state.saving ? "Saving..." : "Save profile"}
							</button>
							<button class="gpp-button is-secondary" type="button" data-profile-action="close">Close</button>
						</div>
					</form>
				</section>
			</div>
			<section class="gpp-card" style="margin-top:18px;">
				<div class="gpp-meta">
					<h3>Profile picture</h3>
					<p>You can upload a normal image now. It will show up in chat, alliance members, and leaderboards.</p>
				</div>
			</section>
		`;
	}

	function modalHtml() {
		return `
			<div class="gpp-overlay">
				<button class="gpp-backdrop" type="button" data-profile-action="close" aria-label="Close profile"></button>
				<section class="gpp-dialog" role="dialog" aria-modal="true" aria-labelledby="gplace-profile-title">
					<div class="gpp-shell">
						<header class="gpp-header">
							<div>
								<h2 id="gplace-profile-title">Your profile</h2>
								<p>Edit your name, picture, and profile settings.</p>
							</div>
							<button class="gpp-close" type="button" data-profile-action="close" aria-label="Close profile">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="18" height="18" fill="currentColor"><path d="m251.33-188-63.33-63.33L416.67-480 188-708.67 251.33-772 480-543.33 708.67-772 772-708.67 543.33-480 772-251.33 708.67-188 480-416.67 251.33-188Z"/></svg>
							</button>
						</header>
						${noticeHtml()}
						${bodyHtml()}
					</div>
				</section>
			</div>
		`;
	}

	function render() {
		if (!state.isOpen) {
			return;
		}

		const panel = ensurePanel();
		panel.innerHTML = modalHtml();
	}

	async function loadProfile() {
		const revision = ++loadRevision;
		state.loading = true;
		render();

		try {
			const { response, payload } = await request("/me");
			if (revision !== loadRevision || !state.isOpen) {
				return;
			}
			if (!response.ok) {
				state.user = null;
				return;
			}

			state.user = payload;
			syncFormFromUser();
		} catch {
			if (revision !== loadRevision || !state.isOpen) {
				return;
			}
			state.user = null;
			setNotice("Could not load your profile right now.", "error");
		} finally {
			if (revision !== loadRevision || !state.isOpen) {
				return;
			}
			state.loading = false;
			render();
		}
	}

	function notifyProfileUpdated() {
		window.dispatchEvent(new CustomEvent("gplace:profile-updated", {
			detail: {
				user: state.user
			}
		}));
	}

	async function saveProfile() {
		state.saving = true;
		render();

		try {
			const { response, payload } = await request("/me/update", {
				method: "POST",
				body: JSON.stringify({
					name: state.form.name,
					discord: state.form.discord,
					showLastPixel: state.form.showLastPixel
				})
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not save profile.");
			}

			if (state.user) {
				state.user = {
					...state.user,
					name: state.form.name,
					discord: state.form.discord,
					showLastPixel: state.form.showLastPixel
				};
			}

			notifyProfileUpdated();
			setNotice("Profile updated.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not save profile.", "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	async function uploadProfilePicture(file) {
		if (!(file instanceof File)) {
			return;
		}

		if (!file.type.startsWith("image/")) {
			setNotice("Please choose an image file.", "error");
			return;
		}

		if (file.size > 10 * 1024 * 1024) {
			setNotice("Image file too large. Maximum is 10 MB.", "error");
			return;
		}

		state.uploading = true;
		render();

		try {
			const formData = new FormData();
			formData.append("image", file);

			const { response, payload } = await request("/me/profile-picture", {
				method: "POST",
				body: formData
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not upload image.");
			}

			if (state.user) {
				state.user = {
					...state.user,
					picture: payload.pictureUrl || state.user.picture
				};
			}

			notifyProfileUpdated();
			setNotice("Profile image updated.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not upload image.", "error");
		} finally {
			state.uploading = false;
			render();
		}
	}

	async function resetProfilePicture() {
		state.uploading = true;
		render();

		try {
			const { response, payload } = await request("/me/profile-picture/change", {
				method: "POST",
				body: JSON.stringify({})
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not reset profile image.");
			}

			if (state.user) {
				state.user = {
					...state.user,
					picture: "/img/gplace-logo.png"
				};
			}

			notifyProfileUpdated();
			setNotice("Profile image reset.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not reset profile image.", "error");
		} finally {
			state.uploading = false;
			render();
		}
	}

	function openModal() {
		if (state.isOpen) {
			return;
		}

		if (typeof window.gplaceCloseAllianceModal === "function") {
			window.gplaceCloseAllianceModal();
		}
		if (typeof window.gplaceCloseChatModal === "function") {
			window.gplaceCloseChatModal();
		}
		ensureStyles();
		const panel = ensurePanel();
		state.notice = "";
		state.isOpen = true;
		latestProfileOpenedAt = Date.now();
		panel.hidden = false;
		document.body.classList.add("gplace-profile-lock");
		render();
		void loadProfile();
	}

	function closeModal() {
		loadRevision += 1;
		state.isOpen = false;
		const panel = document.getElementById("gplace-profile-panel");
		if (panel) {
			panel.hidden = true;
		}
		document.body.classList.remove("gplace-profile-lock");
	}

	function handleInput(event) {
		const target = event.target;
		if (!(target instanceof HTMLInputElement)) {
			return;
		}

		if (target.name === "name") {
			state.form.name = target.value;
			return;
		}

		if (target.name === "discord") {
			state.form.discord = target.value;
		}
	}

	function handleChange(event) {
		const target = event.target;
		if (target instanceof HTMLInputElement && target.name === "showLastPixel") {
			state.form.showLastPixel = target.checked;
			return;
		}

		if (target instanceof HTMLInputElement && target.matches("[data-profile-file]")) {
			void uploadProfilePicture(target.files?.[0] || null);
			target.value = "";
		}
	}

	function handleClick(event) {
		const trigger = event.target instanceof Element
			? event.target.closest("[data-profile-action]")
			: null;

		if (!trigger) {
			return;
		}

		const action = trigger.getAttribute("data-profile-action");
		switch (action) {
		case "close":
			if (
				trigger.classList.contains("gpp-backdrop")
				&& Date.now() - latestProfileOpenedAt < 320
			) {
				return;
			}
			closeModal();
			break;
		case "choose-image": {
			const input = ensurePanel().querySelector("[data-profile-file]");
			if (input instanceof HTMLInputElement) {
				input.click();
			}
			break;
		}
		case "reset-image":
			void resetProfilePicture();
			break;
		case "auth-login":
			if (typeof window.gplaceOpenAuthModal === "function") {
				window.gplaceOpenAuthModal("login");
			}
			break;
		case "auth-register":
			if (typeof window.gplaceOpenAuthModal === "function") {
				window.gplaceOpenAuthModal("register");
			}
			break;
		default:
			break;
		}
	}

	function handleSubmit(event) {
		const form = event.target;
		if (!(form instanceof HTMLFormElement)) {
			return;
		}

		if (form.getAttribute("data-profile-form") !== "save") {
			return;
		}

		event.preventDefault();
		void saveProfile();
	}

	function interceptLegacyProfileEntry(event) {
		const target = event.target instanceof Element
			? event.target.closest("a[href='/profile-picture']")
			: null;

		if (!target) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		if (typeof event.stopImmediatePropagation === "function") {
			event.stopImmediatePropagation();
		}
		openModal();
	}

	document.addEventListener("click", interceptLegacyProfileEntry, true);
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			closeModal();
		}
	}, true);

	if (new URL(window.location.href).searchParams.get("profile") === "1") {
		const url = new URL(window.location.href);
		url.searchParams.delete("profile");
		window.history.replaceState({}, "", url.toString());
		window.setTimeout(openModal, 60);
	}

	window.gplaceOpenProfileModal = openModal;
	window.gplaceCloseProfileModal = closeModal;
})();
