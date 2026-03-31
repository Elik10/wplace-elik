(() => {
	let latestPixelInfo = null;
	let copiedButtonReset = null;
	let lastLocationKey = "";
	let enhanceTimer = null;
	let latestPixelRequestId = 0;
	let latestPublicProfileRequestId = 0;
	let latestProfileModalOpenedAt = 0;

	function ensureStyles() {
		if (document.getElementById("gplace-pixel-info-styles")) {
			return;
		}

		const link = document.createElement("link");
		link.id = "gplace-pixel-info-styles";
		link.rel = "stylesheet";
		link.href = "/gplace-pixel-info.css?v=20260331-4";
		document.head.appendChild(link);
	}

	function escapeHtml(value) {
		return String(value ?? "")
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;")
			.replaceAll("'", "&#39;");
	}

	function formatRelativeTime(timestamp) {
		if (!timestamp) {
			return "just now";
		}

		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) {
			return "just now";
		}

		const seconds = Math.round((date.getTime() - Date.now()) / 1000);
		const minutes = Math.round(seconds / 60);
		const hours = Math.round(minutes / 60);
		const days = Math.round(hours / 24);
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

		return formatter.format(seconds || 0, "second");
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

	function tilePixelToPathCoords(tileX, tileY, pixelX, pixelY) {
		const tileSize = 1000;
		const zoom = 11;
		const worldPixels = tileSize * Math.pow(2, zoom);
		const half = worldPixels / 2;
		return {
			x: tileX * tileSize + pixelX - half,
			y: tileY * tileSize + pixelY - half
		};
	}

	function tilePixelToLatLng(tileX, tileY, pixelX, pixelY) {
		const tileSize = 1000;
		const zoom = 11;
		const worldPixels = tileSize * Math.pow(2, zoom);
		const globalX = tileX * tileSize + pixelX + 0.5;
		const globalY = tileY * tileSize + pixelY + 0.5;
		const lng = (globalX / worldPixels) * 360 - 180;
		const mercator = Math.PI - (2 * Math.PI * globalY) / worldPixels;
		const lat = (180 / Math.PI) * Math.atan(Math.sinh(mercator));
		return { lat, lng };
	}

	function buildPath(lat, lng, zoom) {
		const coords = latLngToPathCoords(lat, lng);
		const roundedZoom = Math.round(Number(zoom) || 14.5);
		return `/${coords.x},${coords.y},${roundedZoom}`;
	}

	function buildPixelPath(info, zoom) {
		const coords = tilePixelToPathCoords(info.tileX, info.tileY, info.x, info.y);
		const roundedZoom = Math.round(Number(zoom) || 16);
		return `/${coords.x},${coords.y},${roundedZoom}`;
	}

	function buildCurrentUrlPath() {
		const path = /^\/-?\d+,-?\d+,-?\d+(?:\.\d+)?\/?$/.test(window.location.pathname)
			? window.location.pathname
			: buildCurrentPath() || "/";
		return `${window.location.origin}${path}`;
	}

	function parseCoordinatePath(pathname) {
		const match = pathname.match(/^\/(-?\d+),(-?\d+),(-?\d+(?:\.\d+)?)\/?$/);
		if (!match) {
			return null;
		}

		return {
			x: Number(match[1]),
			y: Number(match[2]),
			zoom: Number(match[3])
		};
	}

	function buildCurrentPath() {
		const location = readMapLocation();
		if (latestPixelInfo) {
			return buildPixelPath(latestPixelInfo, location?.zoom ?? 16);
		}

		if (!location) {
			return null;
		}

		return buildPath(location.lat, location.lng, location.zoom);
	}

	function syncLocationPath() {
		const path = buildCurrentPath();
		if (!path || path === lastLocationKey) {
			return;
		}

		lastLocationKey = path;
		if (window.location.pathname === path) {
			return;
		}

		window.history.replaceState(window.history.state, "", `${path}${window.location.hash}`);
	}

	function setCopiedState(button, text) {
		if (!(button instanceof HTMLButtonElement)) {
			return;
		}

		if (copiedButtonReset) {
			window.clearTimeout(copiedButtonReset);
			copiedButtonReset = null;
		}

		button.dataset.copied = "true";
		button.textContent = text;
		copiedButtonReset = window.setTimeout(() => {
			button.dataset.copied = "false";
			button.textContent = "Copy link";
		}, 1500);
	}

	function swallowInteraction(event) {
		if (!event) {
			return;
		}

		if (typeof event.preventDefault === "function") {
			event.preventDefault();
		}
		if (typeof event.stopPropagation === "function") {
			event.stopPropagation();
		}
		if (typeof event.stopImmediatePropagation === "function") {
			event.stopImmediatePropagation();
		}
	}

	function stopBubbling(event) {
		if (!event) {
			return;
		}

		if (typeof event.stopPropagation === "function") {
			event.stopPropagation();
		}
		if (typeof event.stopImmediatePropagation === "function") {
			event.stopImmediatePropagation();
		}
	}

	function bindInteractiveAction(element, handler) {
		if (!(element instanceof HTMLElement)) {
			return;
		}

		const block = (event) => {
			stopBubbling(event);
		};

		element.addEventListener("pointerdown", block);
		element.addEventListener("mousedown", block);
		element.addEventListener("touchstart", block);
		element.addEventListener("click", async (event) => {
			swallowInteraction(event);
			await handler(element, event);
		});
	}

	function bindShellActions(shell, actionRow) {
		if (!(shell instanceof HTMLElement) || shell.dataset.gpiBound === "true") {
			return;
		}

		const selector = "[data-gpi-open-profile], [data-gpi-open-spot], [data-gpi-copy-inline]";
		const findAction = (target) => (
			target instanceof HTMLElement ? target.closest(selector) : null
		);

		const block = (event) => {
			if (findAction(event.target)) {
				stopBubbling(event);
			}
		};

		shell.addEventListener("pointerdown", block);
		shell.addEventListener("mousedown", block);
		shell.addEventListener("touchstart", block);
		shell.addEventListener("click", async (event) => {
			const action = findAction(event.target);
			if (!(action instanceof HTMLElement)) {
				return;
			}

			swallowInteraction(event);

			if (action.matches("[data-gpi-open-profile]")) {
				const userId = Number(action.getAttribute("data-gpi-open-profile"));
				if (Number.isFinite(userId) && userId > 0) {
					await openPublicProfile(userId);
				}
				return;
			}

			if (action.matches("[data-gpi-open-spot]")) {
				triggerPaintAction(actionRow);
				return;
			}

			if (action.matches("[data-gpi-copy-inline]")) {
				try {
					await copyPixelLink(action);
				} catch {
					// Ignore clipboard failures.
				}
			}
		});

		shell.dataset.gpiBound = "true";
	}

	async function copyText(text) {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}

		const input = document.createElement("textarea");
		input.value = text;
		input.setAttribute("readonly", "");
		input.style.position = "fixed";
		input.style.opacity = "0";
		input.style.pointerEvents = "none";
		document.body.appendChild(input);
		input.select();
		input.setSelectionRange(0, input.value.length);
		const copied = document.execCommand("copy");
		input.remove();
		return copied;
	}

	async function copyPixelLink(button) {
		const zoom = readMapLocation()?.zoom ?? 16;
		const pathname = latestPixelInfo
			? buildPixelPath(latestPixelInfo, zoom)
			: /^\/-?\d+,-?\d+,-?\d+(?:\.\d+)?\/?$/.test(window.location.pathname)
				? window.location.pathname
				: buildCurrentPath() || "/";
		const url = `${window.location.origin}${pathname}`;
		await copyText(url);
		setCopiedState(button, "Copied");
	}

	function formatRegionNumber(value) {
		if (typeof value === "number" && Number.isFinite(value)) {
			return `#${value}`;
		}

		if (typeof value === "string" && value.trim()) {
			return value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`;
		}

		return "";
	}

	function parseCountry(root, info) {
		const flagNode = root.querySelector(".font-flag[data-tip]");
		const flag = (flagNode?.textContent || "").trim();
		const country = flagNode?.getAttribute("data-tip") || "";
		const chip = flagNode?.closest("button");
		let region = info?.region?.name?.trim() || "";
		let number = formatRegionNumber(info?.region?.number);

		if (chip) {
			const spans = [...chip.querySelectorAll("span")];
			region ||= (spans[1]?.textContent || "").trim();
			number ||= formatRegionNumber((spans[2]?.textContent || "").trim());
		}

		return { flag, country, region, number };
	}

	function parseLegacyPaintedCard(root) {
		const paintedSection = [...root.querySelectorAll("div, span, p")]
			.find((element) => {
				const text = (element.textContent || "").replace(/\s+/g, " ").trim();
				return text.startsWith("Painted by:");
			});
		const paintedText = (paintedSection?.textContent || root.textContent || "")
			.replace(/\s+/g, " ")
			.trim();
		const match = paintedText.match(/Painted by:\s*(.+?)\s*#(\d+)/i);
		if (!match) {
			return null;
		}

		const allianceBadge = paintedSection?.parentElement?.querySelector(".badge.badge-sm")
			|| root.querySelector(".badge.badge-sm");
		return {
			id: Number(match[2]),
			name: match[1].trim(),
			allianceName: (allianceBadge?.textContent || "").trim(),
			picture: "/img/gplace-logo.png",
			verified: false,
			paintedAt: null
		};
	}

	function buildFlagEmoji(countryCode) {
		if (typeof countryCode !== "string" || countryCode.length !== 2) {
			return "";
		}

		return countryCode
			.toUpperCase()
			.replaceAll(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
	}

	function buildAvatar(user, options = {}) {
		const picture = user?.picture || "/img/gplace-logo.png";
		const label = user?.name || "gplace";
		if (options.clickable && Number(user?.id) > 0) {
			return `<button type="button" class="gpi-avatar gpi-avatar-button" data-gpi-open-profile="${escapeHtml(user.id)}"><img src="${escapeHtml(picture)}" alt="${escapeHtml(label)}"></button>`;
		}

		return `<div class="gpi-avatar"><img src="${escapeHtml(picture)}" alt="${escapeHtml(label)}"></div>`;
	}

	function buildProfileModal(profile) {
		const countryFlag = buildFlagEmoji(profile?.country?.code);
		const countryLabel = [countryFlag, profile?.country?.name].filter(Boolean).join(" ").trim();
		const lastPixelPath = profile?.lastPixel
			? buildPixelPath(profile.lastPixel, 16)
			: "";

		return `
			<div class="gpi-profile-header">
				<div class="gpi-profile-avatar">
					<img src="${escapeHtml(profile?.picture || "/img/gplace-logo.png")}" alt="${escapeHtml(profile?.name || "Player")}">
				</div>
				<div class="gpi-profile-main">
					<p class="gpi-profile-kicker">Player profile</p>
					<h3>${escapeHtml(profile?.name || "Unknown player")}</h3>
					<div class="gpi-profile-badges">
						${profile?.verified ? '<span class="gpi-badge">Verified</span>' : ""}
						${profile?.alliance?.name ? `<span class="gpi-badge gpi-badge--alliance">${escapeHtml(profile.alliance.name)}</span>` : ""}
						${countryLabel ? `<span class="gpi-badge">${escapeHtml(countryLabel)}</span>` : ""}
					</div>
				</div>
			</div>
			<div class="gpi-profile-stats">
				<div class="gpi-profile-stat">
					<span>Pixels painted</span>
					<strong>${escapeHtml(profile?.pixelsPainted ?? 0)}</strong>
				</div>
				<div class="gpi-profile-stat">
					<span>Level</span>
					<strong>${escapeHtml(profile?.level ?? 1)}</strong>
				</div>
			</div>
			${profile?.discord ? `<p class="gpi-profile-note">Discord: ${escapeHtml(profile.discord)}</p>` : ""}
			${profile?.lastPixel ? `
				<div class="gpi-profile-last">
					<div class="gpi-profile-last-copy">
						<p class="gpi-profile-last-label">Last visible pixel</p>
						<p class="gpi-profile-last-time">${escapeHtml(formatRelativeTime(profile.lastPixel.paintedAt))}</p>
						<p class="gpi-profile-last-path">${escapeHtml(lastPixelPath)}</p>
					</div>
					<div class="gpi-profile-last-actions">
						<button type="button" data-gpi-open-last="${escapeHtml(lastPixelPath)}">Open last pixel</button>
						<button type="button" data-gpi-copy-profile-path="${escapeHtml(lastPixelPath)}">Copy link</button>
					</div>
				</div>
			` : `
				<p class="gpi-profile-note">This player keeps their last pixel private.</p>
			`}
		`;
	}

	function ensureProfileModal() {
		let modal = document.getElementById("gpi-profile-modal");
		if (modal instanceof HTMLElement) {
			return modal;
		}

		modal = document.createElement("div");
		modal.id = "gpi-profile-modal";
		modal.className = "gpi-profile-modal";
		modal.innerHTML = `
			<div class="gpi-profile-backdrop" data-gpi-close-profile></div>
			<div class="gpi-profile-dialog" role="dialog" aria-modal="true" aria-label="Player profile">
				<button type="button" class="gpi-profile-close" data-gpi-close-profile>&times;</button>
				<div class="gpi-profile-content"></div>
			</div>
		`;
		const backdrop = modal.querySelector(".gpi-profile-backdrop");
		const dialog = modal.querySelector(".gpi-profile-dialog");
		const closeButton = modal.querySelector(".gpi-profile-close");
		const content = modal.querySelector(".gpi-profile-content");

		backdrop?.addEventListener("pointerdown", stopBubbling);
		backdrop?.addEventListener("click", (event) => {
			swallowInteraction(event);
			if (Date.now() - latestProfileModalOpenedAt < 320) {
				return;
			}
			closeProfileModal();
		});

		closeButton?.addEventListener("pointerdown", stopBubbling);
		closeButton?.addEventListener("click", (event) => {
			swallowInteraction(event);
			closeProfileModal();
		});

		dialog?.addEventListener("pointerdown", stopBubbling);
		dialog?.addEventListener("click", swallowInteraction);

		content?.addEventListener("click", async (event) => {
			swallowInteraction(event);
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			const copyButton = target.closest("[data-gpi-copy-profile-path]");
			if (copyButton instanceof HTMLButtonElement) {
				try {
					await copyText(`${window.location.origin}${copyButton.dataset.gpiCopyProfilePath || "/"}`);
					setCopiedState(copyButton, "Copied");
				} catch {
					// Ignore clipboard failures.
				}
				return;
			}

			const openLastButton = target.closest("[data-gpi-open-last]");
			if (openLastButton instanceof HTMLButtonElement && openLastButton.dataset.gpiOpenLast) {
				window.location.assign(openLastButton.dataset.gpiOpenLast);
			}
		});
		document.body.appendChild(modal);
		return modal;
	}

	function closeProfileModal() {
		const modal = document.getElementById("gpi-profile-modal");
		if (!(modal instanceof HTMLElement)) {
			return;
		}

		modal.classList.remove("is-open");
		document.body.classList.remove("gpi-profile-open");
	}

	async function openPublicProfile(userId) {
		const modal = ensureProfileModal();
		const content = modal.querySelector(".gpi-profile-content");
		if (!(content instanceof HTMLElement)) {
			return;
		}

		const requestId = latestPublicProfileRequestId + 1;
		latestPublicProfileRequestId = requestId;
		content.innerHTML = `
			<div class="gpi-profile-loading">
				<p>Loading profile...</p>
			</div>
		`;
		latestProfileModalOpenedAt = Date.now();
		modal.classList.add("is-open");
		document.body.classList.add("gpi-profile-open");

		try {
			const response = await fetch(`/users/${userId}/public`);
			if (!response.ok) {
				throw new Error("Could not load profile");
			}

			const profile = await response.json();
			if (requestId !== latestPublicProfileRequestId) {
				return;
			}

			content.innerHTML = buildProfileModal(profile);
		} catch {
			if (requestId !== latestPublicProfileRequestId) {
				return;
			}

			content.innerHTML = `
				<div class="gpi-profile-loading">
					<p>Could not open this profile right now.</p>
				</div>
			`;
		}
	}

	function triggerPaintAction(actionRow) {
		const paintButton = [...actionRow.querySelectorAll("button, a")]
			.find((element) => /paint/i.test(element.textContent || ""))
			|| actionRow.querySelector("button, a");
		if (paintButton instanceof HTMLElement) {
			paintButton.click();
		}
	}

	function isActiveInfoCurrent(activeInfo) {
		if (!activeInfo) {
			return false;
		}

		const currentPath = parseCoordinatePath(window.location.pathname);
		if (!currentPath) {
			return true;
		}

		const coords = tilePixelToPathCoords(activeInfo.tileX, activeInfo.tileY, activeInfo.x, activeInfo.y);
		return Math.abs(coords.x - currentPath.x) <= 2 && Math.abs(coords.y - currentPath.y) <= 2;
	}

	function buildSummary(root, activeInfo) {
		const info = activeInfo?.payload;
		const paintedBy = info?.paintedBy || parseLegacyPaintedCard(root);
		const countryBits = parseCountry(root, info);
		const location = readMapLocation();
		const pathText = activeInfo
			? `${window.location.origin}${buildPixelPath(activeInfo, location?.zoom ?? 16)}`
			: buildCurrentUrlPath();
		const regionLabel = [countryBits.region, countryBits.number].filter(Boolean).join(" ").trim();

		if (!paintedBy || Number(paintedBy.id) === 0) {
			return `
				<div class="gpi-summary gpi-empty">
					${buildAvatar({ picture: "/img/gplace-logo.png", name: countryBits.region || "gplace" })}
					<div class="gpi-body">
						<div class="gpi-topline">
							<p class="gpi-title">This pixel is still not claimed</p>
							${countryBits.country ? `<span class="gpi-badge gpi-region-chip">${escapeHtml(countryBits.flag)} ${escapeHtml(countryBits.country)}</span>` : ""}
							<div class="gpi-copy">
								<button type="button" data-gpi-copy-inline>Copy link</button>
							</div>
						</div>
						<p class="gpi-path">${escapeHtml(pathText)}</p>
						<div class="gpi-meta">
							${regionLabel ? `<span class="gpi-badge">${escapeHtml(regionLabel)}</span>` : ""}
							<button type="button" class="gpi-pill-action" data-gpi-open-spot>Paint here</button>
						</div>
					</div>
				</div>
			`;
		}

		return `
			<div class="gpi-summary gpi-painted">
				${buildAvatar(paintedBy, { clickable: true })}
				<div class="gpi-body">
					<div class="gpi-topline">
						<p class="gpi-title">This pixel is already taken</p>
						${paintedBy.allianceName ? `<span class="gpi-badge gpi-badge--alliance">${escapeHtml(paintedBy.allianceName)}</span>` : ""}
						${countryBits.country ? `<span class="gpi-badge gpi-region-chip">${escapeHtml(countryBits.flag)} ${escapeHtml(countryBits.country)}</span>` : ""}
						<div class="gpi-copy">
							<button type="button" data-gpi-copy-inline>Copy link</button>
						</div>
					</div>
					<div class="gpi-inline-player">
						<span>Painted by</span>
						<button type="button" class="gpi-name-button" data-gpi-open-profile="${escapeHtml(paintedBy.id)}">${escapeHtml(paintedBy.name || "Unknown player")}</button>
						${paintedBy.paintedAt ? `<span>${escapeHtml(formatRelativeTime(paintedBy.paintedAt))}</span>` : ""}
					</div>
					<p class="gpi-subtitle">Tap the name to open the player profile.</p>
					<p class="gpi-path">${escapeHtml(pathText)}</p>
					<div class="gpi-meta">
						${regionLabel ? `<span class="gpi-badge">${escapeHtml(regionLabel)}</span>` : ""}
						${paintedBy.verified ? '<span class="gpi-badge">Verified</span>' : ""}
						<button type="button" class="gpi-pill-action" data-gpi-open-profile="${escapeHtml(paintedBy.id)}">View profile</button>
					</div>
				</div>
			</div>
		`;
	}

	function findPixelCard() {
		const candidates = [...document.querySelectorAll("div, section, article, aside")]
			.filter((element) => {
				if (!(element instanceof HTMLElement)) {
					return false;
				}

				const rect = element.getBoundingClientRect();
				if (rect.width <= 0 || rect.height <= 0) {
					return false;
				}

				const styles = window.getComputedStyle(element);
				if (styles.display === "none" || styles.visibility === "hidden" || styles.opacity === "0") {
					return false;
				}

				const text = (element.textContent || "").replace(/\s+/g, " ").trim();
				return /Pixel:\s*-?\d+,\s*-?\d+/.test(text) && text.includes("Share");
			})
			.sort((left, right) => {
				const a = left.getBoundingClientRect();
				const b = right.getBoundingClientRect();
				return a.width * a.height - b.width * b.height;
			});

		return candidates[0] || null;
	}

	function isEmptyPixelCard(root) {
		const text = (root?.textContent || "").replace(/\s+/g, " ").trim();
		return text.includes("Not painted");
	}

	function restoreLegacyCard(root) {
		root.classList.remove("gpi-enhanced");
		root.querySelector(".gpi-shell")?.remove();

		const actionRow = root.querySelector(".hide-scrollbar");
		if (actionRow instanceof HTMLElement) {
			actionRow.classList.remove("gpi-actions");
			actionRow.querySelector("[data-gpi-copy-action]")?.remove();
		}

		for (const child of [...root.children]) {
			if (child instanceof HTMLElement && child.dataset.gpiHidden === "true") {
				child.style.display = "";
				delete child.dataset.gpiHidden;
			}
		}
	}

	function enhancePixelCard() {
		if (document.body.classList.contains("gpi-profile-open")) {
			return;
		}

		const root = findPixelCard();
		if (!(root instanceof HTMLElement)) {
			return;
		}

		root.classList.add("gpi-enhanced");
		const header = root.firstElementChild;
		const actionRow = root.querySelector(".hide-scrollbar");
		if (!(actionRow instanceof HTMLElement)) {
			return;
		}

		const activeInfo = isActiveInfoCurrent(latestPixelInfo) ? latestPixelInfo : null;
		const legacyPainted = parseLegacyPaintedCard(root);
		if (!activeInfo && !isEmptyPixelCard(root) && !legacyPainted) {
			restoreLegacyCard(root);
			return;
		}

		actionRow.classList.add("gpi-actions");

		let shell = root.querySelector(".gpi-shell");
		if (!(shell instanceof HTMLElement)) {
			shell = document.createElement("div");
			shell.className = "gpi-shell";
			if (header instanceof HTMLElement) {
				header.insertAdjacentElement("afterend", shell);
			} else {
				root.prepend(shell);
			}
		}
		bindShellActions(shell, actionRow);

		for (const child of [...root.children]) {
			if (!(child instanceof HTMLElement) || child === header || child === shell || child === actionRow) {
				continue;
			}

			child.dataset.gpiHidden = "true";
			child.style.display = "none";
		}

		const summaryHtml = buildSummary(root, activeInfo);
		if (shell.dataset.gpiSummaryHtml !== summaryHtml) {
			shell.innerHTML = summaryHtml;
			shell.dataset.gpiSummaryHtml = summaryHtml;
		}

		let copyAction = actionRow.querySelector("[data-gpi-copy-action]");
		if (!(copyAction instanceof HTMLButtonElement)) {
			copyAction = document.createElement("button");
			copyAction.type = "button";
			copyAction.className = "gpi-copy-action";
			copyAction.dataset.gpiCopyAction = "true";
			copyAction.textContent = "Copy link";
			bindInteractiveAction(copyAction, async () => {
				try {
					await copyPixelLink(copyAction);
				} catch {
					// Ignore clipboard failures.
				}
			});
			actionRow.appendChild(copyAction);
		}
	}

	function scheduleEnhance() {
		if (enhanceTimer) {
			return;
		}

		enhanceTimer = window.setTimeout(() => {
			enhanceTimer = null;
			enhancePixelCard();
		}, 120);
	}

	function rememberPixelInfo(url, payload, requestId) {
		const match = url.pathname.match(/^\/s(\d+)\/pixel\/(\d+)\/(\d+)$/);
		const x = Number(url.searchParams.get("x"));
		const y = Number(url.searchParams.get("y"));
		if (!match || !Number.isFinite(x) || !Number.isFinite(y)) {
			return;
		}

		if (requestId < latestPixelRequestId) {
			return;
		}

		latestPixelRequestId = requestId;

		latestPixelInfo = {
			season: Number(match[1]),
			tileX: Number(match[2]),
			tileY: Number(match[3]),
			x,
			y,
			payload
		};
		syncLocationPath();
		scheduleEnhance();
	}

	function wrapFetch() {
		if (window.__gplacePixelInfoWrapped) {
			return;
		}

		window.__gplacePixelInfoWrapped = true;
		const originalFetch = window.fetch.bind(window);
		window.fetch = async (...args) => {
			let pixelRequestUrl = null;
			let pixelRequestId = 0;
			try {
				const input = args[0];
				const url = new URL(
					typeof input === "string"
						? input
						: input instanceof Request
							? input.url
							: String(input),
					window.location.origin
				);

				if (/^\/s\d+\/pixel\/\d+\/\d+$/.test(url.pathname) && url.searchParams.has("x") && url.searchParams.has("y")) {
					pixelRequestUrl = url;
					pixelRequestId = latestPixelRequestId + 1;
				}
			} catch {
				// Ignore fetch parsing issues.
			}

			const response = await originalFetch(...args);

			try {
				if (pixelRequestUrl && response.ok) {
					const payload = await response.clone().json();
					rememberPixelInfo(pixelRequestUrl, payload, pixelRequestId);
				}
			} catch {
				// Ignore fetch parsing issues.
			}

			return response;
		};
	}

	ensureStyles();
	wrapFetch();
	enhancePixelCard();
	window.gplacePixelInfoBootVersion = "20260331-10";
	window.gplaceDebugOpenPublicProfile = openPublicProfile;
	window.gplaceDebugClosePublicProfile = closeProfileModal;
	window.setInterval(syncLocationPath, 700);
	window.setInterval(scheduleEnhance, 600);

	const observer = new MutationObserver(() => {
		scheduleEnhance();
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true
	});

	document.addEventListener("click", scheduleEnhance, true);
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			closeProfileModal();
		}
	});
})();
