(() => {
	let state = {
		currentUser: null,
		alliance: null,
		messages: { global: [], alliance: [] },
		primedChannels: { global: false, alliance: false },
		drafts: { global: "", alliance: "" },
		replyTargets: { global: null, alliance: null },
		activeChannel: "global",
		isOpen: false,
		isSending: false,
		refreshTimer: null,
		closedRefreshTimer: null,
		unseenCounts: { global: 0, alliance: 0 }
	};
	let paintSyncFrame = null;
	let paintVisibilityTimer = null;
	let refreshPromise = null;
	let closedRefreshPromise = null;

	function ensureStyles() {
		if (document.getElementById("gplace-chat-styles")) {
			return;
		}

		const link = document.createElement("link");
		link.id = "gplace-chat-styles";
		link.rel = "stylesheet";
		link.href = "/gplace-chat.css?v=20260401-1";
		document.head.appendChild(link);
	}

	function activeChannel() {
		return state.activeChannel === "alliance" && state.alliance ? "alliance" : "global";
	}

	function readDraft(channel) {
		try {
			return window.localStorage.getItem(`gplace-chat-draft-${channel}`) || "";
		} catch {
			return "";
		}
	}

	function saveDraft(channel, value) {
		state.drafts[channel] = String(value || "").slice(0, 280);
		try {
			if (state.drafts[channel]) {
				window.localStorage.setItem(`gplace-chat-draft-${channel}`, state.drafts[channel]);
			} else {
				window.localStorage.removeItem(`gplace-chat-draft-${channel}`);
			}
		} catch {
			// Ignore storage issues.
		}
	}

	function escapeHtml(value) {
		return String(value ?? "")
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll("\"", "&quot;")
			.replaceAll("'", "&#39;");
	}

	function isVisible(element) {
		if (!(element instanceof HTMLElement)) {
			return false;
		}

		const rect = element.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return false;
		}

		const styles = window.getComputedStyle(element);
		return styles.display !== "none" && styles.visibility !== "hidden" && styles.opacity !== "0";
	}

	function isPaintModeActive() {
		const paintSelectors = [
			'[title*="Paint pixel"]',
			'[aria-label*="Paint pixel"]',
			'[data-tip*="Paint pixel"]',
			'[title*="Cancel paint"]',
			'[aria-label*="Cancel paint"]'
		];

		if (paintSelectors.some((selector) => [...document.querySelectorAll(selector)].some(isVisible))) {
			return true;
		}

		return [...document.querySelectorAll("button, div, span, p, strong, h1, h2, h3")]
			.some((element) => {
				if (!isVisible(element)) {
					return false;
				}

				const text = (element.textContent || "").replace(/\s+/g, " ").trim();
				return /\bPaint pixel\b/i.test(text) || /\bPaint\s+\d+\s*\/\s*\d+\b/i.test(text);
			});
	}

	function syncPaintVisibility() {
		const trigger = ensureTrigger();
		const hidden = isPaintModeActive();
		document.body.classList.toggle("gpc-paint-active", hidden);
		if (trigger.hidden !== hidden) {
			trigger.hidden = hidden;
		}

		if (hidden && state.isOpen) {
			closeChat();
		}
	}

	function schedulePaintVisibilitySync() {
		if (paintSyncFrame) {
			return;
		}

		paintSyncFrame = window.requestAnimationFrame(() => {
			paintSyncFrame = null;
			syncPaintVisibility();
		});
	}

	function autoResize(textarea) {
		if (!(textarea instanceof HTMLTextAreaElement)) {
			return;
		}

		textarea.style.height = "0px";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
	}

	function formatRelativeTime(timestamp) {
		const date = new Date(timestamp);
		const diffMs = date.getTime() - Date.now();
		const seconds = Math.round(diffMs / 1000);
		const minutes = Math.round(diffMs / 60000);
		const hours = Math.round(diffMs / 3600000);
		const days = Math.round(diffMs / 86400000);

		if (Math.abs(days) >= 7) {
			return date.toLocaleDateString();
		}

		const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
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
	}

	function readMapLocation() {
		try {
			const raw = window.localStorage.getItem("location");
			if (!raw) {
				return null;
			}

			const parsed = JSON.parse(raw);
			if (typeof parsed?.lat !== "number" || typeof parsed?.lng !== "number") {
				return null;
			}

			return {
				lat: parsed.lat,
				lng: parsed.lng,
				zoom: typeof parsed.zoom === "number" ? parsed.zoom : 14.5
			};
		} catch {
			return null;
		}
	}

	function latLngToPathCoords(lat, lng) {
		const tileSize = 1000;
		const zoom = 11;
		const worldPixels = tileSize * Math.pow(2, zoom);
		const half = worldPixels / 2;
		const x = ((lng + 180) / 360) * worldPixels;
		const sin = Math.sin((lat * Math.PI) / 180);
		const y =
			(0.5 -
				Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) *
			worldPixels;

		return {
			x: Math.round(x - half),
			y: Math.round(y - half)
		};
	}

	function buildViewPathFromLocation(location) {
		if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
			return "";
		}

		const coords = latLngToPathCoords(location.lat, location.lng);
		const roundedZoom = Math.round(Number(location.zoom) || 14.5);
		return `/${coords.x},${coords.y},${roundedZoom}`;
	}

	function parseCoordinateToken(value) {
		const match = String(value || "")
			.trim()
			.replace(/^#/, "")
			.match(/^(-?\d+),(-?\d+),(-?\d+(?:\.\d+)?)$/);
		if (!match) {
			return null;
		}

		return {
			x: Number(match[1]),
			y: Number(match[2]),
			zoom: Number(match[3])
		};
	}

	function pathCoordsToLatLng(x, y) {
		const tileSize = 1000;
		const zoom = 11;
		const worldPixels = tileSize * Math.pow(2, zoom);
		const half = worldPixels / 2;
		const globalX = x + half + 0.5;
		const globalY = y + half + 0.5;
		const lng = (globalX / worldPixels) * 360 - 180;
		const mercator = Math.PI - (2 * Math.PI * globalY) / worldPixels;
		const lat = (180 / Math.PI) * Math.atan(Math.sinh(mercator));
		return { lat, lng };
	}

	function navigateToCoordinates(rawCoords) {
		const coords = parseCoordinateToken(rawCoords);
		if (!coords) {
			return;
		}

		const location = pathCoordsToLatLng(coords.x, coords.y);
		const path = `/${coords.x},${coords.y},${Math.round(coords.zoom)}`;

		try {
			window.localStorage.setItem("location", JSON.stringify({
				lat: location.lat,
				lng: location.lng,
				zoom: coords.zoom
			}));
		} catch {
			// Ignore storage issues.
		}

		window.history.replaceState(window.history.state, "", `${path}${window.location.hash || ""}`);

		const payload = {
			path,
			lat: location.lat,
			lng: location.lng,
			zoom: coords.zoom
		};
		if (typeof globalThis.gplaceNavigateCoordinates === "function") {
			globalThis.gplaceNavigateCoordinates(payload);
			return;
		}

		const map = globalThis.gplaceMap || globalThis.map || document.getElementById("map")?._map;
		if (map && typeof map.flyTo === "function") {
			map.flyTo({
				center: { lat: location.lat, lng: location.lng },
				zoom: coords.zoom,
				duration: 700,
				essential: true
			});
			return;
		}

		window.dispatchEvent(new CustomEvent("gplace:navigate-coordinates", {
			detail: payload
		}));
	}

	function currentViewLink() {
		const pathMatch = window.location.pathname.match(/^\/-?\d+,-?\d+(?:,\d+(?:\.\d+)?)?\/?$/);
		if (pathMatch) {
			return `${window.location.origin}${window.location.pathname}`;
		}

		const liveLocationPath = buildViewPathFromLocation(readMapLocation());
		if (liveLocationPath) {
			return `${window.location.origin}${liveLocationPath}`;
		}

		const url = new URL(window.location.href);
		const latitude = Number(url.searchParams.get("lat"));
		const longitude = Number(url.searchParams.get("lng"));
		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
			return "";
		}

		const shareUrl = new URL(window.location.pathname, window.location.origin);
		const fallbackPath = buildViewPathFromLocation({
			lat: latitude,
			lng: longitude,
			zoom: Number(url.searchParams.get("zoom") || url.searchParams.get("z") || 14.5)
		});
		if (fallbackPath) {
			return `${window.location.origin}${fallbackPath}`;
		}

		shareUrl.searchParams.set("lat", String(latitude));
		shareUrl.searchParams.set("lng", String(longitude));
		const zoom = url.searchParams.get("zoom") || url.searchParams.get("z");
		if (zoom) {
			shareUrl.searchParams.set("zoom", zoom);
		}
		return shareUrl.toString();
	}

	function activeDraft() {
		return state.drafts[activeChannel()];
	}

	function activeReplyTarget() {
		return state.replyTargets[activeChannel()];
	}

	function activeMessages() {
		return state.messages[activeChannel()];
	}

	function activeUnseenCount() {
		return state.unseenCounts[activeChannel()];
	}

	function totalUnseenCount() {
		return (state.unseenCounts.global || 0) + (state.unseenCounts.alliance || 0);
	}

	function buildAvatar(user) {
		if (user?.picture) {
			return `<img src="${escapeHtml(user.picture)}" alt="${escapeHtml(user.name || "User")}">`;
		}

		return escapeHtml(String(user?.name || "?").slice(0, 2).toUpperCase());
	}

	function enhanceMessageContent(content) {
		const coordinateParts = [];
		let escaped = escapeHtml(content || "");
		escaped = escaped.replace(/(?:https?:\/\/[^\s<]+)?\/(-?\d+,-?\d+,-?\d+(?:\.\d+)?)(?=$|\s)/g, (match, coords) => {
			const index = coordinateParts.push(
				`<button class="gpc-coordinate-link" type="button" data-chat-action="open-coords" data-chat-coords="${escapeHtml(coords)}">#${escapeHtml(coords)}</button>`
			) - 1;
			return `__GPC_COORD_${index}__`;
		});
		escaped = escaped.replace(/(^|\s)(@[\w-]{3,16})/g, (match, prefix, mention) => {
			const self = state.currentUser && mention.slice(1).toLowerCase() === String(state.currentUser.name || "").toLowerCase();
			return `${prefix}<span class="gpc-mention${self ? " is-self" : ""}">${mention}</span>`;
		});
		return escaped.replace(/__GPC_COORD_(\d+)__/g, (match, index) => coordinateParts[Number(index)] || "");
	}

	function truncateText(value, limit = 80) {
		const text = String(value || "").trim();
		return text.length <= limit ? text : `${text.slice(0, limit - 1)}...`;
	}

	function isNearBottom(element) {
		return element.scrollHeight - element.scrollTop - element.clientHeight < 72;
	}

	function ensureTrigger() {
		let trigger = document.getElementById("gplace-chat-trigger");
		if (trigger) {
			return trigger;
		}

		trigger = document.createElement("button");
		trigger.id = "gplace-chat-trigger";
		trigger.type = "button";
		trigger.className = "gpc-trigger";
		trigger.setAttribute("aria-label", "Open chat");
		trigger.setAttribute("aria-expanded", "false");
		trigger.innerHTML = `
			<span class="gpc-trigger__icon" aria-hidden="true">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="22" height="22" fill="currentColor"><path d="M120-160v-640q0-33 23.5-56.5T200-880h560q33 0 56.5 23.5T840-800v440q0 33-23.5 56.5T760-280H280L120-160Zm126-200h514v-440H200v484l46-44Zm-46 0v-440 440Z"/></svg>
			</span>
			<span class="gpc-trigger__copy"><span class="gpc-trigger__label">Chat</span></span>
			<span class="gpc-trigger__badge" data-chat-trigger-badge hidden></span>
		`;
		trigger.addEventListener("click", () => {
			if (state.isOpen) {
				closeChat();
				return;
			}

			openChat();
		});
		document.body.appendChild(trigger);
		syncTriggerBadge();
		syncPaintVisibility();
		return trigger;
	}

	function ensurePanel() {
		let panel = document.getElementById("gplace-chat-panel");
		if (panel) {
			return panel;
		}

		panel = document.createElement("div");
		panel.id = "gplace-chat-panel";
		panel.hidden = true;
		panel.innerHTML = `
			<div class="gpc-overlay">
				<button class="gpc-backdrop" type="button" data-chat-action="close" aria-label="Close chat"></button>
				<section class="gpc-drawer" role="dialog" aria-modal="true" aria-labelledby="gpc-chat-title">
					<header class="gpc-header">
						<div class="gpc-header__row">
							<h2 id="gpc-chat-title">Chat</h2>
							<button class="gpc-close" type="button" data-chat-action="close" aria-label="Close chat">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="18" height="18" fill="currentColor"><path d="m251.33-188-63.33-63.33L416.67-480 188-708.67 251.33-772 480-543.33 708.67-772 772-708.67 543.33-480 772-251.33 708.67-188 480-416.67 251.33-188Z"/></svg>
							</button>
						</div>
						<div class="gpc-tabs" data-chat-tabs></div>
						<div class="gpc-pinned" data-chat-pinned hidden></div>
					</header>
					<div class="gpc-surface">
						<div class="gpc-list-wrap">
							<div class="gpc-list" data-chat-list></div>
							<button class="gpc-jump" type="button" data-chat-action="jump" hidden>Jump to latest</button>
						</div>
						<footer class="gpc-footer">
							<div class="gpc-error" data-chat-error hidden></div>
							<div data-chat-composer></div>
						</footer>
					</div>
				</section>
			</div>
		`;
		panel.addEventListener("click", handleClick);
		panel.addEventListener("input", handleInput);
		panel.addEventListener("keydown", handleKeydown);
		panel.querySelector("[data-chat-list]")?.addEventListener("scroll", syncJumpButton);
		document.body.appendChild(panel);
		return panel;
	}

	function getRefs() {
		const panel = ensurePanel();
		return {
			panel,
			list: panel.querySelector("[data-chat-list]"),
			error: panel.querySelector("[data-chat-error]"),
			composer: panel.querySelector("[data-chat-composer]"),
			jumpButton: panel.querySelector("[data-chat-action='jump']"),
			tabs: panel.querySelector("[data-chat-tabs]"),
			pinned: panel.querySelector("[data-chat-pinned]")
		};
	}

	function setError(message) {
		const { error } = getRefs();
		if (!(error instanceof HTMLElement)) {
			return;
		}

		if (!message) {
			error.hidden = true;
			error.textContent = "";
			return;
		}

		error.hidden = false;
		error.textContent = message;
	}

	function syncTriggerBadge() {
		const trigger = ensureTrigger();
		const badge = trigger.querySelector("[data-chat-trigger-badge]");
		if (!(badge instanceof HTMLElement)) {
			return;
		}

		const total = totalUnseenCount();
		if (state.isOpen || total <= 0) {
			badge.hidden = true;
			badge.textContent = "";
			trigger.dataset.hasUnread = "false";
			return;
		}

		badge.hidden = false;
		badge.textContent = total > 9 ? "9+" : String(total);
		trigger.dataset.hasUnread = "true";
	}

	function renderTabs() {
		const { tabs } = getRefs();
		if (!(tabs instanceof HTMLElement)) {
			return;
		}

		const channels = [
			{ id: "global", label: "Global", available: true },
			{ id: "alliance", label: "Alliance", available: !!state.currentUser && !!state.alliance }
		];

		if (!channels.some((channel) => channel.id === state.activeChannel && channel.available)) {
			state.activeChannel = "global";
		}

		tabs.innerHTML = channels
			.filter((channel) => channel.available)
			.map((channel) => {
				const unread = state.unseenCounts[channel.id] || 0;
				return `
					<button class="gpc-tab ${state.activeChannel === channel.id ? "is-active" : ""}" type="button" data-chat-action="set-channel" data-channel="${channel.id}">
						<span>${channel.label}</span>
						${unread > 0 ? `<span class="gpc-tab__badge">${unread > 9 ? "9+" : unread}</span>` : ""}
					</button>
				`;
			})
			.join("");
	}

	function renderPinned() {
		const { pinned } = getRefs();
		if (!(pinned instanceof HTMLElement)) {
			return;
		}

		if (activeChannel() !== "alliance" || !state.alliance?.announcement) {
			pinned.hidden = true;
			pinned.innerHTML = "";
			return;
		}

		pinned.hidden = false;
		pinned.innerHTML = `
			<div class="gpc-pinned__label">Pinned</div>
			<div class="gpc-pinned__body">${escapeHtml(state.alliance.announcement)}</div>
		`;
	}

	function renderLoading() {
		const { list } = getRefs();
		if (!(list instanceof HTMLElement)) {
			return;
		}

		list.innerHTML = `
			<div class="gpc-loading">
				<div class="gpc-empty__card" aria-hidden="true">
					<div class="gpc-skeleton">
						<div class="gpc-skeleton__avatar"></div>
						<div class="gpc-skeleton__body">
							<div class="gpc-skeleton__line gpc-skeleton__line--short"></div>
							<div class="gpc-skeleton__line gpc-skeleton__line--long"></div>
						</div>
					</div>
					<div class="gpc-skeleton">
						<div class="gpc-skeleton__avatar"></div>
						<div class="gpc-skeleton__body">
							<div class="gpc-skeleton__line gpc-skeleton__line--short"></div>
							<div class="gpc-skeleton__line gpc-skeleton__line--medium"></div>
							<div class="gpc-skeleton__line gpc-skeleton__line--long"></div>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	function renderEmptyState(reason = "quiet") {
		const { list } = getRefs();
		if (!(list instanceof HTMLElement)) {
			return;
		}

		if (reason === "offline") {
			list.innerHTML = `
				<div class="gpc-empty">
					<div class="gpc-empty__card">
						<div class="gpc-empty__icon" aria-hidden="true">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="34" height="34" fill="currentColor"><path d="M480-80q-73 0-140.5-28.5T222-189q-50-50-78-117.5T115-447h80q12 117 94 199t191 94v80Zm285-367q-12-117-94-199t-191-94v-80q73 0 140.5 28.5T738-771q50 50 78.5 117.5T845-447h-80ZM680-80 560-200H360L240-80v-680h440v264l-80-80v-104H320v407l6-7h267l80 80Zm160 0L704-216q-23 16-49.5 24T600-184v-80q17 0 31.5-5t28.5-15L256-688l56-56 584 584-56 56ZM600-344l-80-80h80v80Z"/></svg>
						</div>
						<strong>Chat could not load</strong>
						<p>Try again.</p>
					</div>
				</div>
			`;
			return;
		}

		if (activeChannel() === "alliance" && !state.alliance) {
			list.innerHTML = `
				<div class="gpc-empty">
					<div class="gpc-empty__card">
						<div class="gpc-empty__icon" aria-hidden="true">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="34" height="34" fill="currentColor"><path d="M440-400h80v-160h-80v160Zm0 160h80v-80h-80v80Zm40 120q-140-35-230-162.5T160-560v-240l320-120 320 120v240q0 150-90 277.5T480-120Z"/></svg>
						</div>
						<strong>You are not in an alliance</strong>
						<p>Create one or join one to use alliance chat.</p>
					</div>
				</div>
			`;
			return;
		}

		list.innerHTML = `
			<div class="gpc-empty">
				<div class="gpc-empty__card">
					<div class="gpc-empty__icon" aria-hidden="true">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="34" height="34" fill="currentColor"><path d="M160-120v-520q0-33 23.5-56.5T240-720h480q33 0 56.5 23.5T800-640v520L640-280H240q-33 0-56.5-23.5T160-360Zm80-193 82-82h398v-245H240v327Zm0 0v-327 327Zm240-122q17 0 28.5-11.5T520-475q0-17-11.5-28.5T480-515q-17 0-28.5 11.5T440-475q0 17 11.5 28.5T480-435Zm-124 0q17 0 28.5-11.5T396-475q0-17-11.5-28.5T356-515q-17 0-28.5 11.5T316-475q0 17 11.5 28.5T356-435Zm248 0q17 0 28.5-11.5T644-475q0-17-11.5-28.5T604-515q-17 0-28.5 11.5T564-475q0 17 11.5 28.5T604-435Z"/></svg>
					</div>
					<strong>No messages yet</strong>
					<p>${activeChannel() === "alliance" ? "Send the first alliance message." : "Send the first message."}</p>
				</div>
			</div>
		`;
	}

	function renderMessages(options = {}) {
		const { list } = getRefs();
		if (!(list instanceof HTMLElement)) {
			return;
		}

		const messages = activeMessages();
		const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;

		if (messages.length === 0) {
			renderEmptyState(options.reason);
			syncJumpButton();
			return;
		}

		list.innerHTML = messages.map((message) => {
			const own = state.currentUser?.id === message.user?.id;
			const name = own ? "You" : escapeHtml(message.user?.name || "User");
			const replyBlock = message.replyTo
				? `
					<div class="gpc-reply-snippet">
						<strong>${escapeHtml(message.replyTo.user?.name || "User")}</strong>
						<span>${escapeHtml(truncateText(message.replyTo.content, 88))}</span>
					</div>
				`
				: "";

			return `
				<article class="gpc-message ${own ? "is-mine" : ""}">
					<div class="gpc-avatar">${buildAvatar(message.user)}</div>
					<div class="gpc-message__stack">
						<div class="gpc-message__meta">
							<strong>${name}</strong>
							<span>${escapeHtml(formatRelativeTime(message.createdAt))}</span>
						</div>
						${replyBlock}
						<div class="gpc-bubble">${enhanceMessageContent(message.content || "")}</div>
						<div class="gpc-message__tools">
							<button class="gpc-link" type="button" data-chat-action="reply" data-message-id="${message.id}">Reply</button>
							${!own ? `<button class="gpc-link" type="button" data-chat-action="mention" data-user-name="${escapeHtml(message.user?.name || "")}">Mention</button>` : ""}
						</div>
					</div>
				</article>
			`;
		}).join("");

		if (options.forceScroll || distanceFromBottom < 72) {
			list.scrollTop = list.scrollHeight;
		} else {
			list.scrollTop = Math.max(0, list.scrollHeight - list.clientHeight - distanceFromBottom);
		}

		syncJumpButton();
	}

	function renderComposer() {
		const { composer } = getRefs();
		if (!(composer instanceof HTMLElement)) {
			return;
		}

		if (!state.currentUser) {
			composer.innerHTML = `
				<div class="gpc-cta">
					<div class="gpc-cta__actions">
						<button type="button" data-chat-action="auth-login">Log in</button>
						<button type="button" data-chat-action="auth-register">Register</button>
					</div>
				</div>
			`;
			return;
		}

		if (activeChannel() === "alliance" && !state.alliance) {
			composer.innerHTML = `
				<div class="gpc-cta">
					<div class="gpc-cta__actions">
						<button type="button" data-chat-action="open-alliance">Open alliance</button>
						<button type="button" data-chat-action="set-channel" data-channel="global">Back to global</button>
					</div>
				</div>
			`;
			return;
		}

		const replyTarget = activeReplyTarget();
		const replyMarkup = replyTarget
			? `
				<div class="gpc-reply-box">
					<div>
						<strong>Replying to ${escapeHtml(replyTarget.user?.name || "User")}</strong>
						<p>${escapeHtml(truncateText(replyTarget.content, 96))}</p>
					</div>
					<button type="button" class="gpc-link" data-chat-action="cancel-reply">Cancel</button>
				</div>
			`
			: "";

		composer.innerHTML = `
			<div class="gpc-compose-wrap">
				${replyMarkup}
				<div class="gpc-compose">
					<textarea data-chat-input maxlength="280" placeholder="${activeChannel() === "alliance" ? "Message your alliance" : "Write to global chat"}"></textarea>
					<div class="gpc-compose__actions">
						<button type="button" class="gpc-compose__ghost" data-chat-action="share-view">Share view</button>
						<button type="button" data-chat-action="send" aria-label="Send message">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="18" height="18" fill="currentColor"><path d="M120-160v-640l760 320-760 320Zm80-120 474-200-474-200v142l240 58-240 60v140Zm0 0v-400 400Z"/></svg>
						</button>
					</div>
				</div>
			</div>
		`;

		syncComposerState();
		queueMicrotask(focusComposer);
	}

	function syncComposerState() {
		const { composer } = getRefs();
		const textarea = composer.querySelector("[data-chat-input]");
		const sendButton = composer.querySelector("[data-chat-action='send']");
		const shareButton = composer.querySelector("[data-chat-action='share-view']");

		if (!(textarea instanceof HTMLTextAreaElement) || !(sendButton instanceof HTMLButtonElement)) {
			return;
		}

		if (textarea.value !== activeDraft()) {
			textarea.value = activeDraft();
		}

		autoResize(textarea);
		sendButton.disabled = state.isSending || activeDraft().trim().length === 0;
		if (shareButton instanceof HTMLButtonElement) {
			shareButton.disabled = state.isSending;
		}
		sendButton.innerHTML = state.isSending
			? "..."
			: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="18" height="18" fill="currentColor"><path d="M120-160v-640l760 320-760 320Zm80-120 474-200-474-200v142l240 58-240 60v140Zm0 0v-400 400Z"/></svg>`;
	}

	function syncJumpButton() {
		const { list, jumpButton } = getRefs();
		if (!(list instanceof HTMLElement) || !(jumpButton instanceof HTMLButtonElement)) {
			return;
		}

		if (isNearBottom(list)) {
			state.unseenCounts[activeChannel()] = 0;
			renderTabs();
			syncTriggerBadge();
			jumpButton.hidden = true;
			jumpButton.textContent = "Jump to latest";
			return;
		}

		jumpButton.hidden = false;
		const unseen = activeUnseenCount();
		jumpButton.textContent = unseen > 0
			? unseen === 1 ? "1 new message" : `${unseen} new messages`
			: "Jump to latest";
	}

	function focusComposer() {
		const textarea = getRefs().composer.querySelector("[data-chat-input]");
		if (!(textarea instanceof HTMLTextAreaElement)) {
			return;
		}

		textarea.focus();
		textarea.selectionStart = textarea.value.length;
		textarea.selectionEnd = textarea.value.length;
	}

	async function fetchCurrentUser() {
		try {
			const response = await fetch("/me", {
				credentials: "include",
				headers: {
					"Accept": "application/json"
				}
			});
			if (!response.ok) {
				return null;
			}
			return await response.json();
		} catch {
			return null;
		}
	}

	async function fetchAlliance() {
		try {
			const response = await fetch("/alliance", {
				credentials: "include",
				headers: {
					"Accept": "application/json"
				}
			});
			const payload = await response.json().catch(() => ({}));
			return response.ok ? payload : null;
		} catch {
			return null;
		}
	}

	async function fetchMessages(channel) {
		const response = await fetch(`/chat/messages?channel=${encodeURIComponent(channel)}`, {
			credentials: "include",
			headers: {
				"Accept": "application/json"
			}
		});
		const payload = await response.json().catch(() => ({}));
		if (!response.ok || !Array.isArray(payload.messages)) {
			throw new Error(payload.error || "Failed to load chat.");
		}
		return payload;
	}

	function applyFetchedMessages(channel, payload, options, wasNearBottom) {
		const wasPrimed = state.primedChannels[channel];
		const previousIds = new Set((state.messages[channel] || []).map((message) => message.id));
		const nextMessages = Array.isArray(payload.messages) ? payload.messages : [];
		const addedMessages = nextMessages.filter((message) => !previousIds.has(message.id)).length;
		state.messages[channel] = nextMessages;
		state.primedChannels[channel] = true;

		if (channel === "alliance" && state.alliance) {
			state.alliance.announcement = payload.announcement || state.alliance.announcement || "";
		}

		if (!wasPrimed) {
			return;
		}

		if (!state.isOpen) {
			if (addedMessages > 0) {
				state.unseenCounts[channel] += addedMessages;
			}
			return;
		}

		if (channel === activeChannel()) {
			if (options.forceScroll === true || wasNearBottom) {
				state.unseenCounts[channel] = 0;
			} else if (addedMessages > 0) {
				state.unseenCounts[channel] += addedMessages;
			}
			return;
		}

		if (addedMessages > 0) {
			state.unseenCounts[channel] += addedMessages;
		}
	}

	async function refreshChat(options = {}) {
		if (refreshPromise) {
			return refreshPromise;
		}

		if (activeMessages().length === 0 && options.silent !== true) {
			renderLoading();
		}

		refreshPromise = (async () => {
			try {
				const refs = state.isOpen ? getRefs() : null;
				const wasNearBottom = !refs || !(refs.list instanceof HTMLElement) || isNearBottom(refs.list);
				const previousUserId = state.currentUser?.id ?? null;

				state.currentUser = await fetchCurrentUser();
				state.alliance = state.currentUser?.allianceId ? await fetchAlliance() : null;
				if (previousUserId !== (state.currentUser?.id ?? null)) {
					state.unseenCounts = { global: 0, alliance: 0 };
					state.primedChannels = { global: false, alliance: false };
					state.messages = { global: [], alliance: [] };
					state.replyTargets = { global: null, alliance: null };
				}

				const channels = state.alliance ? ["global", "alliance"] : ["global"];
				const results = await Promise.all(channels.map((channel) => fetchMessages(channel)));
				channels.forEach((channel, index) => {
					applyFetchedMessages(channel, results[index], options, wasNearBottom);
				});

				if (!state.alliance) {
					state.messages.alliance = [];
					state.replyTargets.alliance = null;
					state.unseenCounts.alliance = 0;
					state.primedChannels.alliance = false;
					if (state.activeChannel === "alliance") {
						state.activeChannel = "global";
					}
				}

				renderTabs();
				renderPinned();
				renderMessages({ forceScroll: options.forceScroll === true });
				renderComposer();
				if (previousUserId !== (state.currentUser?.id ?? null)) {
					renderComposer();
				}
				syncTriggerBadge();
				setError("");
			} catch (error) {
				setError(error instanceof Error ? error.message : "Failed to load chat.");
				if (activeMessages().length === 0) {
					renderEmptyState("offline");
				}
			} finally {
				refreshPromise = null;
			}
		})();

		return refreshPromise;
	}

	async function refreshClosedChat() {
		if (closedRefreshPromise || state.isOpen || document.hidden) {
			return closedRefreshPromise;
		}

		closedRefreshPromise = (async () => {
			try {
				const previousUserId = state.currentUser?.id ?? null;
				state.currentUser = await fetchCurrentUser();
				state.alliance = state.currentUser?.allianceId ? await fetchAlliance() : null;
				if (previousUserId !== (state.currentUser?.id ?? null)) {
					state.unseenCounts = { global: 0, alliance: 0 };
					state.primedChannels = { global: false, alliance: false };
					state.messages = { global: [], alliance: [] };
				}
				const channels = state.alliance ? ["global", "alliance"] : ["global"];
				const results = await Promise.all(channels.map((channel) => fetchMessages(channel)));
				channels.forEach((channel, index) => {
					applyFetchedMessages(channel, results[index], {}, false);
				});

				if (!state.alliance) {
					state.messages.alliance = [];
					state.unseenCounts.alliance = 0;
					state.primedChannels.alliance = false;
				}

				syncTriggerBadge();
			} catch {
				// Stay quiet while the drawer is closed.
			} finally {
				closedRefreshPromise = null;
			}
		})();

		return closedRefreshPromise;
	}

	async function sendMessage() {
		if (state.isSending) {
			return;
		}

		const channel = activeChannel();
		const content = activeDraft().trim();
		if (!content) {
			setError("Write a message first.");
			focusComposer();
			return;
		}

		state.isSending = true;
		setError("");
		syncComposerState();

		try {
			const response = await fetch("/chat/messages", {
				method: "POST",
				credentials: "include",
				headers: {
					"Accept": "application/json",
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					content,
					channel,
					replyToId: activeReplyTarget()?.id ?? null
				})
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok || !payload.message) {
				throw new Error(payload.error || "Failed to send message.");
			}

			state.messages[channel] = [...state.messages[channel], payload.message].slice(-50);
			state.replyTargets[channel] = null;
			saveDraft(channel, "");
			state.unseenCounts[channel] = 0;
			renderPinned();
			renderMessages({ forceScroll: true });
			renderComposer();
			window.setTimeout(() => {
				if (state.isOpen) {
					void refreshChat({ silent: true });
				}
			}, 900);
		} catch (error) {
			setError(error instanceof Error ? error.message : "Failed to send message.");
		} finally {
			state.isSending = false;
			syncComposerState();
			focusComposer();
		}
	}

	function stopPolling() {
		if (state.refreshTimer) {
			window.clearInterval(state.refreshTimer);
			state.refreshTimer = null;
		}
	}

	function stopClosedPolling() {
		if (state.closedRefreshTimer) {
			window.clearInterval(state.closedRefreshTimer);
			state.closedRefreshTimer = null;
		}
	}

	function startPolling() {
		stopPolling();
		state.refreshTimer = window.setInterval(() => {
			if (!state.isOpen || document.hidden) {
				return;
			}
			void refreshChat({ silent: true });
		}, 4000);
	}

	function startClosedPolling() {
		stopClosedPolling();
		state.closedRefreshTimer = window.setInterval(() => {
			void refreshClosedChat();
		}, 15000);
	}

	function openChat() {
		if (isPaintModeActive()) {
			syncPaintVisibility();
			return;
		}

		if (typeof window.gplaceCloseAllianceModal === "function") {
			window.gplaceCloseAllianceModal();
		}
		if (typeof window.gplaceCloseProfileModal === "function") {
			window.gplaceCloseProfileModal();
		}

		const panel = ensurePanel();
		state.isOpen = true;
		panel.hidden = false;
		ensureTrigger().setAttribute("aria-expanded", "true");
		stopClosedPolling();
		startPolling();
		renderTabs();
		renderPinned();
		activeMessages().length === 0 ? renderLoading() : renderMessages({ forceScroll: true });
		renderComposer();
		syncTriggerBadge();
		void refreshChat({ forceScroll: true });
	}

	function closeChat() {
		const panel = document.getElementById("gplace-chat-panel");
		if (!panel) {
			return;
		}

		state.isOpen = false;
		panel.hidden = true;
		ensureTrigger().setAttribute("aria-expanded", "false");
		stopPolling();
		startClosedPolling();
	}

	function appendCurrentViewToDraft() {
		const shareLink = currentViewLink();
		if (!shareLink) {
			setError("Move the map first, then share the current view.");
			focusComposer();
			return;
		}

		const channel = activeChannel();
		const nextValue = activeDraft().trim() ? `${activeDraft().trim()}\n${shareLink}` : shareLink;
		saveDraft(channel, nextValue);
		setError("");
		syncComposerState();
		focusComposer();
	}

	function setReplyTarget(messageId) {
		state.replyTargets[activeChannel()] = activeMessages().find((item) => item.id === messageId) || null;
		renderComposer();
	}

	function mentionUser(name) {
		const mention = `@${String(name || "").trim()} `;
		if (!mention.trim()) {
			return;
		}

		const channel = activeChannel();
		saveDraft(channel, activeDraft().trim() ? `${activeDraft().trim()} ${mention}` : mention);
		renderComposer();
	}

	function setChannel(channel) {
		if (channel !== "global" && channel !== "alliance") {
			return;
		}

		if (channel === "alliance" && !state.alliance) {
			if (typeof window.gplaceOpenAllianceModal === "function") {
				window.gplaceOpenAllianceModal("overview");
			}
			return;
		}

		state.activeChannel = channel;
		state.unseenCounts[channel] = 0;
		renderTabs();
		renderPinned();
		renderMessages({ forceScroll: true });
		renderComposer();
		syncTriggerBadge();
	}

	function handleClick(event) {
		const trigger = event.target instanceof Element ? event.target.closest("[data-chat-action]") : null;
		if (!trigger) {
			return;
		}

		const action = trigger.getAttribute("data-chat-action");
		switch (action) {
		case "close":
			closeChat();
			break;
		case "jump": {
			const { list } = getRefs();
			if (list instanceof HTMLElement) {
				list.scrollTop = list.scrollHeight;
			}
			state.unseenCounts[activeChannel()] = 0;
			renderTabs();
			syncJumpButton();
			syncTriggerBadge();
			break;
		}
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
		case "open-alliance":
			if (typeof window.gplaceOpenAllianceModal === "function") {
				window.gplaceOpenAllianceModal("overview");
			}
			break;
		case "set-channel":
			setChannel(trigger.getAttribute("data-channel") || "global");
			break;
		case "share-view":
			appendCurrentViewToDraft();
			break;
		case "open-coords":
			navigateToCoordinates(trigger.getAttribute("data-chat-coords") || "");
			break;
		case "send":
			void sendMessage();
			break;
		case "reply":
			setReplyTarget(Number(trigger.getAttribute("data-message-id")));
			break;
		case "cancel-reply":
			state.replyTargets[activeChannel()] = null;
			renderComposer();
			break;
		case "mention":
			mentionUser(trigger.getAttribute("data-user-name"));
			break;
		default:
			break;
		}
	}

	function handleInput(event) {
		const target = event.target;
		if (!(target instanceof HTMLTextAreaElement) || !target.hasAttribute("data-chat-input")) {
			return;
		}

		saveDraft(activeChannel(), target.value);
		target.value = activeDraft();
		syncComposerState();
	}

	function handleKeydown(event) {
		const target = event.target;
		if (!(target instanceof HTMLTextAreaElement) || !target.hasAttribute("data-chat-input")) {
			return;
		}

		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			void sendMessage();
		}
	}

	function startPaintVisibilityLoop() {
		if (paintVisibilityTimer) {
			return;
		}

		paintVisibilityTimer = window.setInterval(() => {
			if (!document.hidden) {
				syncPaintVisibility();
			}
		}, 500);
	}

	ensureStyles();
	ensureTrigger();
	ensurePanel();
	state.drafts.global = readDraft("global");
	state.drafts.alliance = readDraft("alliance");
	syncPaintVisibility();
	startPaintVisibilityLoop();
	startClosedPolling();
	void refreshClosedChat();

	document.addEventListener("visibilitychange", () => {
		schedulePaintVisibilitySync();
		if (document.hidden) {
			return;
		}

		if (state.isOpen) {
			void refreshChat({ silent: true });
			return;
		}

		void refreshClosedChat();
	});

	window.gplaceOpenChatModal = openChat;
	window.gplaceCloseChatModal = closeChat;
})();
