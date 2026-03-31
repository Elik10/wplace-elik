(() => {
	let state = {
		currentUser: null,
		alliance: null,
		members: [],
		membersPage: 0,
		membersHasNext: false,
		bannedMembers: [],
		bannedPage: 0,
		bannedHasNext: false,
		leaderboardEntries: [],
		leaderboardMode: "week",
		leaderboardLoading: false,
		joinRequests: [],
		requestsLoading: false,
		activityLogs: [],
		activityLoading: false,
		activeTab: "overview",
		contentAnimating: false,
		isOpen: false,
		loading: false,
		saving: false,
		notice: "",
		noticeTone: "info",
		noticeTimer: null,
		lastInviteLink: "",
		ownerLeaveTargetUserId: "",
		memberSearch: "",
		memberRoleFilter: "all",
		bannedSearch: "",
		createDraft: {
			name: "",
			tag: "",
			picture: "",
			banner: "",
			description: ""
		},
		settingsDraft: {
			name: "",
			tag: "",
			picture: "",
			banner: "",
			description: "",
			joinPolicy: "invite"
		},
		announcementDraft: "",
		permissionsDraft: {
			admin: {},
			mod: {},
			member: {}
		}
	};
	let contentAnimationTimer = null;
	let openAnimationFrame = null;
	let refreshRevision = 0;
	let leaderboardRevision = 0;
	let buttonSyncFrame = null;

	function ensureStyles() {
		if (document.getElementById("gplace-alliance-styles")) {
			return;
		}

		const link = document.createElement("link");
		link.id = "gplace-alliance-styles";
		link.rel = "stylesheet";
		link.href = "/gplace-alliance.css?v=20260331-1";
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

	function roleLabel(role) {
		switch (role) {
		case "owner":
			return "Owner";
		case "admin":
			return "Admin";
		case "mod":
			return "Mod";
		default:
			return "Member";
		}
	}

	function initials(name) {
		return String(name || "?")
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0] || "")
			.join("")
			.slice(0, 2)
			.toUpperCase() || "?";
	}

	function avatarMarkup(name, picture, className) {
		return `<div class="${className}"><img src="${escapeHtml(picture || "/img/gplace-logo.png")}" alt="${escapeHtml(name)}"></div>`;
	}

	function formatJoinedAt(value) {
		if (!value) {
			return "Joined recently";
		}

		try {
			return new Date(value).toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric"
			});
		} catch {
			return "Joined recently";
		}
	}

	function canInvite() {
		return !!state.alliance && hasPermission("manageInvites");
	}

	function canManageRoles() {
		return !!state.alliance && state.alliance.role === "owner";
	}

	function canModerateAlliance() {
		return !!state.alliance && hasPermission("moderateMembers");
	}

	function canReviewRequests() {
		return !!state.alliance && hasPermission("reviewJoinRequests");
	}

	function canEditAnnouncement() {
		return !!state.alliance && hasPermission("editAnnouncement");
	}

	function canViewActivity() {
		return !!state.alliance && hasPermission("viewActivityLog");
	}

	function canSetHeadquarters() {
		return !!state.alliance && hasPermission("setHeadquarters");
	}

	function hasPermission(permission) {
		if (!state.alliance) {
			return false;
		}

		if (state.alliance.role === "owner") {
			return true;
		}

		const permissions = state.alliance.permissions || {};
		return !!permissions?.[state.alliance.role]?.[permission];
	}

	function canKick(member) {
		if (!state.alliance || !state.currentUser || state.currentUser.id === member.id) {
			return false;
		}

		if (!hasPermission("moderateMembers")) {
			return false;
		}

		if (state.alliance.role === "owner") {
			return member.role !== "owner";
		}

		if (state.alliance.role === "admin") {
			return member.role === "member" || member.role === "mod";
		}

		if (state.alliance.role === "mod") {
			return member.role === "member";
		}

		return false;
	}

	function canBan(member) {
		return canModerateAlliance() && canKick(member);
	}

	function bannerStyle(url) {
		return url
			? ` style="background-image: linear-gradient(180deg, rgba(7, 12, 23, 0.18), rgba(7, 12, 23, 0.54)), url('${escapeHtml(url)}');"`
			: "";
	}

	function setNotice(message, tone) {
		if (state.noticeTimer) {
			clearTimeout(state.noticeTimer);
			state.noticeTimer = null;
		}

		state.notice = message || "";
		state.noticeTone = tone || "info";

		if (state.notice) {
			state.noticeTimer = window.setTimeout(() => {
				state.notice = "";
				state.noticeTimer = null;
				render();
			}, 3600);
		}

		render();
	}

	function noticeHtml() {
		if (!state.notice) {
			return "";
		}

		return `<div class="gpa-notice is-${escapeHtml(state.noticeTone)}">${escapeHtml(state.notice)}</div>`;
	}

	function loadingHtml() {
		return `
			<div class="gpa-loading">
				<div class="gpa-spinner" aria-hidden="true"></div>
			</div>
		`;
	}

	function loginHtml() {
		return `
			${noticeHtml()}
			<section class="gpa-empty gpa-card">
				<h3>Alliances let you build with other players.</h3>
				<p>Log in first. Then you can create an alliance, invite people, and manage everything from here.</p>
				<div class="gpa-cta-buttons">
					<button class="gpa-button is-primary" type="button" data-alliance-action="auth-register">Register</button>
					<button class="gpa-button is-secondary" type="button" data-alliance-action="auth-login">Log in</button>
				</div>
			</section>
		`;
	}

	function createHtml() {
		return `
			${noticeHtml()}
			<section class="gpa-create">
				<div class="gpa-card">
					<h3>Create your alliance</h3>
					<p>Choose a name, add a tag if you want, and set it up the way you like.</p>
				</div>
				<form class="gpa-card gpa-form" data-form="create" data-draft-form="create">
					<div class="gpa-form-grid">
						<label class="gpa-field">
							<span class="gpa-label">Alliance name</span>
							<input class="gpa-input" name="name" maxlength="16" placeholder="gplace team" value="${escapeHtml(state.createDraft.name)}" required>
						</label>
						<label class="gpa-field">
							<span class="gpa-label">Tag</span>
							<input class="gpa-input" name="tag" maxlength="6" placeholder="GPL" value="${escapeHtml(state.createDraft.tag)}">
						</label>
						<label class="gpa-field">
							<span class="gpa-label">Profile image URL</span>
							<input class="gpa-input" name="picture" placeholder="https://..." value="${escapeHtml(state.createDraft.picture)}">
						</label>
						<label class="gpa-field">
							<span class="gpa-label">Banner URL</span>
							<input class="gpa-input" name="banner" placeholder="https://..." value="${escapeHtml(state.createDraft.banner)}">
						</label>
						<label class="gpa-field gpa-field--full">
							<span class="gpa-label">Description</span>
							<textarea class="gpa-textarea" name="description" maxlength="500" placeholder="What are you building, defending, or known for?">${escapeHtml(state.createDraft.description)}</textarea>
						</label>
					</div>
					<p class="gpa-help">You can change the look, members, and roles later in settings.</p>
					<div class="gpa-actions">
						<button class="gpa-button is-primary" type="submit" ${state.saving ? "disabled" : ""}>${state.saving ? "Creating..." : "Create alliance"}</button>
					</div>
				</form>
			</section>
		`;
	}

	function currentMapCenter() {
		const url = new URL(window.location.href);
		const lat = Number(url.searchParams.get("lat"));
		const lng = Number(url.searchParams.get("lng"));

		if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
			return null;
		}

		return { latitude: lat, longitude: lng };
	}

	function locationLink(latitude, longitude) {
		const url = new URL(window.location.pathname, window.location.origin);
		url.searchParams.set("lat", String(Number(latitude).toFixed(6)));
		url.searchParams.set("lng", String(Number(longitude).toFixed(6)));
		return url.toString();
	}

	function filteredMembers() {
		const query = state.memberSearch.trim().toLowerCase();
		return state.members.filter((member) => {
			if (state.memberRoleFilter !== "all" && member.role !== state.memberRoleFilter) {
				return false;
			}

			if (!query) {
				return true;
			}

			return String(member.name || "").toLowerCase().includes(query);
		});
	}

	function filteredBannedMembers() {
		const query = state.bannedSearch.trim().toLowerCase();
		return state.bannedMembers.filter((member) => {
			if (!query) {
				return true;
			}

			return String(member.name || "").toLowerCase().includes(query);
		});
	}

	function ownerTransferCandidates() {
		if (!state.currentUser) {
			return [];
		}

		return state.members.filter((member) => member.id !== state.currentUser.id);
	}

	function syncOwnerLeaveTarget() {
		const candidates = ownerTransferCandidates();
		if (!candidates.length) {
			state.ownerLeaveTargetUserId = "";
			return;
		}

		const currentValue = String(state.ownerLeaveTargetUserId || "");
		if (candidates.some((member) => String(member.id) === currentValue)) {
			return;
		}

		state.ownerLeaveTargetUserId = String(candidates[0].id);
	}

	function leaderboardModeLabel(mode) {
		switch (mode) {
		case "today":
			return "Today";
		case "month":
			return "Month";
		case "all-time":
			return "All time";
		default:
			return "Week";
		}
	}

	function leaderboardModeButtons() {
		return ["today", "week", "month", "all-time"].map((mode) => {
			return `<button class="gpa-tab ${state.leaderboardMode === mode ? "is-active" : ""}" type="button" data-alliance-action="leaderboard-mode" data-mode="${mode}">${leaderboardModeLabel(mode)}</button>`;
		}).join("");
	}

	async function copyTextWithNotice(value, successMessage, failureMessage) {
		if (!navigator.clipboard || !navigator.clipboard.writeText) {
			setNotice(failureMessage, "error");
			return;
		}

		try {
			await navigator.clipboard.writeText(value);
			setNotice(successMessage, "success");
		} catch {
			setNotice(failureMessage, "error");
		}
	}

	function overviewHtml() {
		const alliance = state.alliance;
		const ownerCandidates = ownerTransferCandidates();
		const description = alliance.description
			? escapeHtml(alliance.description)
			: "This alliance has not added a description yet.";
		const headquartersTools = alliance.hq
			? `
					<button class="gpa-button is-secondary" type="button" data-alliance-action="open-hq">Open HQ</button>
					<button class="gpa-button is-secondary" type="button" data-alliance-action="copy-hq">Copy HQ link</button>
				`
			: "";
		const inviteTools = canInvite()
			? `
					<button class="gpa-button is-secondary" type="button" data-alliance-action="copy-invite">Copy invite link</button>
					${canSetHeadquarters() ? '<button class="gpa-button is-secondary" type="button" data-alliance-action="set-hq">Set HQ to current view</button>' : ""}
					${state.lastInviteLink ? `<span class="gpa-source">Invite: <a href="${escapeHtml(state.lastInviteLink)}" target="_blank" rel="noreferrer">${escapeHtml(state.lastInviteLink)}</a></span>` : ""}
				`
			: "";
		const ownerExitTools = alliance.role === "owner"
			? `
					<div class="gpa-owner-exit">
						<h4>Before you leave</h4>
						<p>You are the owner. Pass ownership to someone else first, or delete the alliance.</p>
						${ownerCandidates.length
			? `
									<label class="gpa-field">
										<span class="gpa-label">Pass ownership to</span>
										<select class="gpa-select" data-alliance-field="owner-leave-target">
											${ownerCandidates.map((member) => `
												<option value="${member.id}" ${String(state.ownerLeaveTargetUserId) === String(member.id) ? "selected" : ""}>
													${escapeHtml(member.name)} (${escapeHtml(roleLabel(member.role))})
												</option>
											`).join("")}
										</select>
									</label>
									<div class="gpa-actions">
										<button class="gpa-button is-secondary" type="button" data-alliance-action="leave-transfer" ${state.saving ? "disabled" : ""}>Pass owner and leave</button>
										<button class="gpa-button is-danger" type="button" data-alliance-action="delete-alliance" ${state.saving ? "disabled" : ""}>Delete this alliance</button>
									</div>
								`
			: `
									<div class="gpa-actions">
										<button class="gpa-button is-danger" type="button" data-alliance-action="delete-alliance" ${state.saving ? "disabled" : ""}>Delete this alliance</button>
									</div>
								`}
					</div>
				`
			: "";
		const ownerSettingsButton = alliance.role === "owner"
			? '<div class="gpa-actions"><button class="gpa-button is-secondary" type="button" data-alliance-action="open-settings">Edit alliance</button></div>'
			: "";
		const leaveButton = alliance.role === "owner"
			? ownerExitTools
			: `<div class="gpa-actions"><button class="gpa-button is-danger" type="button" data-alliance-action="leave-alliance">Leave alliance</button></div>`;

		return `
			<div class="gpa-section-grid">
				<div class="gpa-card">
					<h3>About</h3>
					<p>${description}</p>
					${ownerSettingsButton}
					${leaveButton}
				</div>
				<div class="gpa-card">
					<h3>At a glance</h3>
					<p>Your role: <strong>${escapeHtml(roleLabel(alliance.role))}</strong></p>
					<p>Tag: <strong>${escapeHtml(alliance.tag || "No tag yet")}</strong></p>
					<p>Home base: <strong>${alliance.hq ? `${alliance.hq.latitude.toFixed(4)}, ${alliance.hq.longitude.toFixed(4)}` : "Not set yet"}</strong></p>
					<p>Join flow: <strong>${alliance.joinPolicy === "request" ? "People request first, then you approve them." : "Invite links let people join right away."}</strong></p>
					${headquartersTools ? `<div class="gpa-actions">${headquartersTools}</div>` : ""}
				</div>
				<div class="gpa-card">
					<h3>Tools</h3>
					<p>Use invite links, set an HQ, and manage your member list here.</p>
					<div class="gpa-actions">
						${inviteTools}
					</div>
				</div>
			</div>
			<div class="gpa-section-grid">
				<div class="gpa-card">
					<h3>Pinned announcement</h3>
					<p>${escapeHtml(alliance.announcement || "There is no pinned message yet.")}</p>
					${canEditAnnouncement() ? `
						<form class="gpa-form" data-form="announcement">
							<label class="gpa-field">
								<span class="gpa-label">Pinned message</span>
								<textarea class="gpa-textarea" name="announcement" maxlength="500">${escapeHtml(state.announcementDraft)}</textarea>
							</label>
							<div class="gpa-actions">
								<button class="gpa-button is-primary" type="submit" ${state.saving ? "disabled" : ""}>${state.saving ? "Saving..." : "Save announcement"}</button>
							</div>
						</form>
					` : ""}
				</div>
				<div class="gpa-card">
					<h3>Today</h3>
					<p>${canReviewRequests()
		? `You currently have <strong>${escapeHtml(state.joinRequests.length)}</strong> pending join request${state.joinRequests.length === 1 ? "" : "s"}.`
		: "Use this space for alliance news and join settings."}</p>
					${canReviewRequests() ? `<div class="gpa-actions"><button class="gpa-button is-secondary" type="button" data-alliance-action="open-requests">Review join requests</button></div>` : ""}
					${canViewActivity() ? `<div class="gpa-actions"><button class="gpa-button is-secondary" type="button" data-alliance-action="open-activity">Open activity log</button></div>` : ""}
				</div>
			</div>
		`;
	}

	function settingsHtml() {
		if (!state.alliance) {
			return "";
		}

		if (state.alliance.role !== "owner") {
			return `
				<div class="gpa-card">
					<h3>Only the owner can edit this</h3>
					<p>Only the owner can change the name, tag, images, and roles. Admins can still help with invites, HQ, and moderation.</p>
					${canSetHeadquarters() ? `<div class="gpa-actions"><button class="gpa-button is-secondary" type="button" data-alliance-action="set-hq">Set HQ to current view</button></div>` : ""}
				</div>
			`;
		}

		return `
			<form class="gpa-card gpa-form" data-form="settings" data-draft-form="settings">
				<div class="gpa-form-grid">
					<label class="gpa-field">
						<span class="gpa-label">Alliance name</span>
						<input class="gpa-input" name="name" maxlength="16" value="${escapeHtml(state.settingsDraft.name)}" required>
					</label>
					<label class="gpa-field">
						<span class="gpa-label">Tag</span>
						<input class="gpa-input" name="tag" maxlength="6" value="${escapeHtml(state.settingsDraft.tag)}">
					</label>
					<label class="gpa-field">
						<span class="gpa-label">Profile image URL</span>
						<input class="gpa-input" name="picture" value="${escapeHtml(state.settingsDraft.picture)}" placeholder="https://...">
					</label>
					<label class="gpa-field">
						<span class="gpa-label">Banner URL</span>
						<input class="gpa-input" name="banner" value="${escapeHtml(state.settingsDraft.banner)}" placeholder="https://...">
					</label>
					<label class="gpa-field gpa-field--full">
						<span class="gpa-label">Description</span>
						<textarea class="gpa-textarea" name="description" maxlength="500">${escapeHtml(state.settingsDraft.description)}</textarea>
					</label>
					<label class="gpa-field">
						<span class="gpa-label">Join flow</span>
						<select class="gpa-select" name="joinPolicy">
							<option value="invite" ${state.settingsDraft.joinPolicy === "invite" ? "selected" : ""}>Invite links join instantly</option>
							<option value="request" ${state.settingsDraft.joinPolicy === "request" ? "selected" : ""}>Invite links create join requests</option>
						</select>
					</label>
				</div>
				<div class="gpa-actions">
					<button class="gpa-button is-primary" type="submit" ${state.saving ? "disabled" : ""}>${state.saving ? "Saving..." : "Save settings"}</button>
					<button class="gpa-button is-secondary" type="button" data-alliance-action="set-hq" ${state.saving ? "disabled" : ""}>Set HQ to current view</button>
				</div>
			</form>
		`;
	}

	function memberRoleOptions(selectedRole) {
		return ["member", "mod", "admin", "owner"].map((role) => {
			return `<option value="${role}" ${selectedRole === role ? "selected" : ""}>${roleLabel(role)}</option>`;
		}).join("");
	}

	function membersHtml() {
		if (!state.members.length) {
			return `
				<div class="gpa-card">
					<h3>No members to show yet</h3>
					<p>This alliance has no members to show right now.</p>
				</div>
			`;
		}

		const members = filteredMembers();

		return `
			<div class="gpa-list-toolbar">
				<label class="gpa-field">
					<span class="gpa-label">Find a member</span>
					<input class="gpa-input" type="search" value="${escapeHtml(state.memberSearch)}" placeholder="Find by name" data-alliance-field="member-search">
				</label>
				<label class="gpa-field">
					<span class="gpa-label">Role</span>
					<select class="gpa-select" data-alliance-field="member-role-filter">
						<option value="all" ${state.memberRoleFilter === "all" ? "selected" : ""}>Everyone</option>
						<option value="owner" ${state.memberRoleFilter === "owner" ? "selected" : ""}>Owner</option>
						<option value="admin" ${state.memberRoleFilter === "admin" ? "selected" : ""}>Admins</option>
						<option value="mod" ${state.memberRoleFilter === "mod" ? "selected" : ""}>Mods</option>
						<option value="member" ${state.memberRoleFilter === "member" ? "selected" : ""}>Members</option>
					</select>
				</label>
			</div>
			<div class="gpa-members">
				${members.length ? members.map((member) => {
		const meta = `
							<div class="gpa-member-meta">
								<span class="gpa-pill is-light">${escapeHtml(roleLabel(member.role))}</span>
								<span class="gpa-help">${escapeHtml(formatJoinedAt(member.joinedAt))}</span>
							</div>
						`;

		const roleControls = canManageRoles() && state.currentUser && state.currentUser.id !== member.id
			? `
								<form class="gpa-role-form" data-form="member-role" data-user-id="${member.id}">
									<select class="gpa-select" name="role">
										${memberRoleOptions(member.role)}
									</select>
									<button type="submit" ${state.saving ? "disabled" : ""}>Save role</button>
								</form>
							`
			: "";

		const kickButton = canKick(member)
			? `<button class="gpa-button is-danger" type="button" data-alliance-action="kick-member" data-user-id="${member.id}" ${state.saving ? "disabled" : ""}>Remove</button>`
			: "";
		const banButton = canBan(member)
			? `<button class="gpa-button is-secondary" type="button" data-alliance-action="ban-member" data-user-id="${member.id}" ${state.saving ? "disabled" : ""}>Ban</button>`
			: "";

		return `
						<article class="gpa-member">
							${avatarMarkup(member.name, member.picture, "gpa-member-avatar")}
							<div>
								<h4>${escapeHtml(member.name)}</h4>
							<p>${escapeHtml(state.currentUser && state.currentUser.id === member.id ? "This is you." : "Alliance member")}</p>
								${meta}
							</div>
							<div class="gpa-member-actions">
								${roleControls}
								${banButton}
								${kickButton}
							</div>
						</article>
					`;
	}).join("") : `
					<div class="gpa-card">
						<h3>No one matches this filter</h3>
						<p>Try a different name or switch the role filter back to everyone.</p>
					</div>
				`}
			</div>
			${state.membersHasNext ? '<div class="gpa-load-more"><button class="gpa-button is-secondary" type="button" data-alliance-action="load-more-members">Load more</button></div>' : ""}
		`;
	}

	function bannedHtml() {
		if (!canModerateAlliance()) {
			return `
				<div class="gpa-card">
					<h3>You cannot open this tab</h3>
					<p>Only the owner and admins can view the ban list or unban people.</p>
				</div>
			`;
		}

		if (!state.bannedMembers.length) {
			return `
				<div class="gpa-card">
					<h3>No one is banned</h3>
					<p>Your ban list is empty right now, which is usually a good sign.</p>
				</div>
			`;
		}

		const members = filteredBannedMembers();

		return `
			<div class="gpa-list-toolbar">
				<label class="gpa-field">
					<span class="gpa-label">Find a banned player</span>
					<input class="gpa-input" type="search" value="${escapeHtml(state.bannedSearch)}" placeholder="Find by name" data-alliance-field="banned-search">
				</label>
			</div>
			<div class="gpa-members">
				${members.length ? members.map((member) => `
					<article class="gpa-member">
						${avatarMarkup(member.name, member.picture, "gpa-member-avatar")}
						<div>
							<h4>${escapeHtml(member.name)}</h4>
							<p>This player cannot rejoin until someone removes the ban.</p>
						</div>
						<div class="gpa-member-actions">
							<button class="gpa-button is-secondary" type="button" data-alliance-action="unban-member" data-user-id="${member.id}" ${state.saving ? "disabled" : ""}>Unban</button>
						</div>
					</article>
				`).join("") : `
					<div class="gpa-card">
						<h3>No banned user matches</h3>
						<p>Try another name or clear the search box.</p>
					</div>
				`}
			</div>
			${state.bannedHasNext ? '<div class="gpa-load-more"><button class="gpa-button is-secondary" type="button" data-alliance-action="load-more-banned">Load more</button></div>' : ""}
		`;
	}

	function requestsHtml() {
		if (!canReviewRequests()) {
			return `
				<div class="gpa-card">
					<h3>You cannot open this tab</h3>
					<p>Only roles with join request permission can approve or deny people here.</p>
				</div>
			`;
		}

		if (state.requestsLoading) {
			return loadingHtml();
		}

		if (!state.joinRequests.length) {
			return `
				<div class="gpa-card">
					<h3>No pending requests</h3>
					<p>People who apply with a request link will show up here.</p>
				</div>
			`;
		}

		return `
			<div class="gpa-members">
				${state.joinRequests.map((request) => `
					<article class="gpa-member">
						${avatarMarkup(request.user.name, request.user.picture, "gpa-member-avatar")}
						<div>
							<h4>${escapeHtml(request.user.name)}</h4>
							<p>Level ${escapeHtml(request.user.level)} • ${escapeHtml(request.user.pixelsPainted)} painted • ${escapeHtml(request.user.country || "Unknown")}</p>
							${request.message ? `<div class="gpa-help">${escapeHtml(request.message)}</div>` : `<div class="gpa-help">Sent a request on ${escapeHtml(formatJoinedAt(request.createdAt))}.</div>`}
						</div>
						<div class="gpa-member-actions">
							<button class="gpa-button is-primary" type="button" data-alliance-action="approve-request" data-request-id="${request.id}" ${state.saving ? "disabled" : ""}>Approve</button>
							<button class="gpa-button is-secondary" type="button" data-alliance-action="deny-request" data-request-id="${request.id}" ${state.saving ? "disabled" : ""}>Deny</button>
						</div>
					</article>
				`).join("")}
			</div>
		`;
	}

	function activityHtml() {
		if (!canViewActivity()) {
			return `
				<div class="gpa-card">
					<h3>You cannot open this tab</h3>
					<p>Only roles with activity log access can read this history.</p>
				</div>
			`;
		}

		if (state.activityLoading) {
			return loadingHtml();
		}

		if (!state.activityLogs.length) {
			return `
				<div class="gpa-card">
					<h3>No activity yet</h3>
					<p>Moves like joins, approvals, role changes, bans, and pinned message edits will show up here.</p>
				</div>
			`;
		}

		return `
			<div class="gpa-log-list">
				${state.activityLogs.map((entry) => `
					<article class="gpa-log-item">
						<div class="gpa-log-item__time">${escapeHtml(formatJoinedAt(entry.createdAt))}</div>
						<div class="gpa-log-item__body">${escapeHtml(entry.message)}</div>
					</article>
				`).join("")}
			</div>
		`;
	}

	function permissionsHtml() {
		if (!state.alliance) {
			return "";
		}

		if (state.alliance.role !== "owner") {
			return `
				<div class="gpa-card">
					<h3>Only the owner can edit permissions</h3>
					<p>Only the owner can change role permissions.</p>
				</div>
			`;
		}

		const permissionRows = [
			["manageInvites", "Create invite links"],
			["reviewJoinRequests", "Approve join requests"],
			["moderateMembers", "Kick, ban, and unban"],
			["editAnnouncement", "Edit pinned announcement"],
			["setHeadquarters", "Update HQ"],
			["viewActivityLog", "Open activity log"],
			["useAllianceChat", "Use alliance chat"]
		];

		return `
			<form class="gpa-card gpa-form" data-form="permissions">
				<div class="gpa-permissions">
					<div class="gpa-permissions__head">Permission</div>
					<div class="gpa-permissions__head">Admin</div>
					<div class="gpa-permissions__head">Mod</div>
					<div class="gpa-permissions__head">Member</div>
					${permissionRows.map(([key, label]) => `
						<div class="gpa-permissions__label">${escapeHtml(label)}</div>
						<label class="gpa-permissions__cell"><input type="checkbox" data-alliance-permission="admin.${key}" ${state.permissionsDraft.admin?.[key] ? "checked" : ""}></label>
						<label class="gpa-permissions__cell"><input type="checkbox" data-alliance-permission="mod.${key}" ${state.permissionsDraft.mod?.[key] ? "checked" : ""}></label>
						<label class="gpa-permissions__cell"><input type="checkbox" data-alliance-permission="member.${key}" ${state.permissionsDraft.member?.[key] ? "checked" : ""}></label>
					`).join("")}
				</div>
				<div class="gpa-actions">
					<button class="gpa-button is-primary" type="submit" ${state.saving ? "disabled" : ""}>${state.saving ? "Saving..." : "Save permissions"}</button>
				</div>
			</form>
		`;
	}

	function leaderboardHtml() {
		if (state.leaderboardLoading) {
			return loadingHtml();
		}

		if (!state.leaderboardEntries.length) {
			return `
				<div class="gpa-card">
					<h3>No activity yet</h3>
					<p>This board will fill in once your members start placing pixels in the selected time range.</p>
					<div class="gpa-tabs gpa-tabs--inline">${leaderboardModeButtons()}</div>
				</div>
			`;
		}

		return `
			<div class="gpa-card">
				<h3>Top painters</h3>
				<p>See who painted the most today, this week, this month, or overall.</p>
				<div class="gpa-tabs gpa-tabs--inline">${leaderboardModeButtons()}</div>
			</div>
			<div class="gpa-members">
				${state.leaderboardEntries.map((member, index) => `
					<article class="gpa-member">
						<div class="gpa-rank">#${index + 1}</div>
						${avatarMarkup(member.name, member.picture, "gpa-member-avatar")}
						<div>
							<h4>${escapeHtml(member.name)}</h4>
							<p>${escapeHtml(String(member.pixelsPainted || 0))} pixels in ${escapeHtml(leaderboardModeLabel(state.leaderboardMode).toLowerCase())}</p>
						</div>
						<div class="gpa-member-actions">
							${member.lastLatitude !== undefined && member.lastLongitude !== undefined
			? `
									<button class="gpa-button is-secondary" type="button" data-alliance-action="open-location" data-lat="${escapeHtml(member.lastLatitude)}" data-lng="${escapeHtml(member.lastLongitude)}">Open last pixel</button>
									<button class="gpa-button is-secondary" type="button" data-alliance-action="copy-location" data-lat="${escapeHtml(member.lastLatitude)}" data-lng="${escapeHtml(member.lastLongitude)}">Copy location</button>
								`
			: '<span class="gpa-help">Last pixel hidden</span>'}
						</div>
					</article>
				`).join("")}
			</div>
		`;
	}

	function allianceHtml() {
		const alliance = state.alliance;
		const tab = state.activeTab;
		const body = tab === "settings"
			? settingsHtml()
			: tab === "permissions"
				? permissionsHtml()
			: tab === "activity"
				? activityHtml()
			: tab === "requests"
				? requestsHtml()
			: tab === "leaderboard"
				? leaderboardHtml()
			: tab === "banned"
				? bannedHtml()
			: tab === "members"
				? membersHtml()
				: overviewHtml();

		return `
			${noticeHtml()}
			<section class="gpa-hero ${alliance.banner ? "has-banner" : ""}"${bannerStyle(alliance.banner)}>
				<div class="gpa-hero__inner">
					${avatarMarkup(alliance.name, alliance.picture, "gpa-alliance-avatar")}
						<div>
							<div class="gpa-pills">
								${alliance.tag ? `<span class="gpa-pill">${escapeHtml(alliance.tag)}</span>` : ""}
								<span class="gpa-pill">${escapeHtml(roleLabel(alliance.role))}</span>
							</div>
							<h3>${escapeHtml(alliance.name)}</h3>
							<p>${escapeHtml(alliance.description || "Build together, defend together, or just keep your group in one place.")}</p>
						</div>
					</div>
				</section>
			<section class="gpa-stats">
				<div class="gpa-stat">
					<span>Members</span>
					<strong>${escapeHtml(alliance.members)}</strong>
				</div>
				<div class="gpa-stat">
					<span>Pixels painted</span>
					<strong>${escapeHtml(alliance.pixelsPainted)}</strong>
				</div>
				<div class="gpa-stat">
					<span>Your role</span>
					<strong>${escapeHtml(roleLabel(alliance.role))}</strong>
				</div>
			</section>
			<nav class="gpa-tabs" aria-label="Alliance sections">
				<button class="gpa-tab ${tab === "overview" ? "is-active" : ""}" type="button" data-alliance-action="set-tab" data-tab="overview">Overview</button>
				<button class="gpa-tab ${tab === "leaderboard" ? "is-active" : ""}" type="button" data-alliance-action="set-tab" data-tab="leaderboard">Leaderboard</button>
				<button class="gpa-tab ${tab === "members" ? "is-active" : ""}" type="button" data-alliance-action="set-tab" data-tab="members">Members</button>
				${canReviewRequests() ? `<button class="gpa-tab ${tab === "requests" ? "is-active" : ""}" type="button" data-alliance-action="set-tab" data-tab="requests">Requests${state.joinRequests.length ? ` (${state.joinRequests.length})` : ""}</button>` : ""}
				${canViewActivity() ? `<button class="gpa-tab ${tab === "activity" ? "is-active" : ""}" type="button" data-alliance-action="set-tab" data-tab="activity">Activity</button>` : ""}
				${canModerateAlliance() ? `<button class="gpa-tab ${tab === "banned" ? "is-active" : ""}" type="button" data-alliance-action="set-tab" data-tab="banned">Banned</button>` : ""}
				${state.alliance.role === "owner" ? `<button class="gpa-tab ${tab === "permissions" ? "is-active" : ""}" type="button" data-alliance-action="set-tab" data-tab="permissions">Permissions</button>` : ""}
				<button class="gpa-tab ${tab === "settings" ? "is-active" : ""}" type="button" data-alliance-action="set-tab" data-tab="settings">Settings</button>
			</nav>
			<div class="gpa-tab-panel ${state.contentAnimating ? "is-animating" : ""}" data-tab="${escapeHtml(tab)}">
				${body}
			</div>
		`;
	}

	function modalHtml() {
		return `
			<div class="gpa-overlay">
				<button class="gpa-backdrop" type="button" data-alliance-action="close" aria-label="Close alliance"></button>
				<section class="gpa-dialog" role="dialog" aria-modal="true" aria-labelledby="gplace-alliance-title">
					<header class="gpa-header">
						<div>
							<p class="gpa-eyebrow">Alliances</p>
							<h2 id="gplace-alliance-title">${escapeHtml(state.alliance?.name || "Alliance")}</h2>
						</div>
						<button class="gpa-close" type="button" aria-label="Close alliance" data-alliance-action="close">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="20" height="20" fill="currentColor"><path d="m251.33-188-63.33-63.33L416.67-480 188-708.67 251.33-772 480-543.33 708.67-772 772-708.67 543.33-480 772-251.33 708.67-188 480-416.67 251.33-188Z"/></svg>
						</button>
					</header>
					<div class="gpa-content">
						${state.loading ? loadingHtml() : !state.currentUser ? loginHtml() : !state.alliance ? createHtml() : allianceHtml()}
					</div>
				</section>
			</div>
		`;
	}

	function ensurePanel() {
		let panel = document.getElementById("gplace-alliance-panel");
		if (panel) {
			return panel;
		}

		panel = document.createElement("div");
		panel.id = "gplace-alliance-panel";
		panel.hidden = true;
		panel.dataset.state = "closed";
		panel.addEventListener("click", handleClick);
		panel.addEventListener("submit", handleSubmit);
		panel.addEventListener("input", handleInput);
		document.body.appendChild(panel);
		return panel;
	}

	function scheduleAllianceButtonsSync() {
		if (buttonSyncFrame) {
			return;
		}

		buttonSyncFrame = window.requestAnimationFrame(() => {
			buttonSyncFrame = null;
			syncAllianceButtons();
		});
	}

	function render() {
		if (!state.isOpen) {
			return;
		}

		const panel = ensurePanel();
		panel.innerHTML = modalHtml();
	}

	function renderAndRestoreField(field, selectionStart, selectionEnd) {
		render();
		const target = ensurePanel().querySelector(`[data-alliance-field="${field}"]`);
		if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
			return;
		}

		target.focus();
		if (target instanceof HTMLInputElement && typeof selectionStart === "number" && typeof selectionEnd === "number") {
			target.selectionStart = selectionStart;
			target.selectionEnd = selectionEnd;
		}
	}

	function animateTabContent() {
		if (contentAnimationTimer) {
			clearTimeout(contentAnimationTimer);
			contentAnimationTimer = null;
		}

		state.contentAnimating = true;
		render();
		contentAnimationTimer = window.setTimeout(() => {
			state.contentAnimating = false;
			contentAnimationTimer = null;
			render();
		}, 220);
	}

	function clearAllianceParam() {
		const url = new URL(window.location.href);
		if (!url.searchParams.has("alliance")) {
			return;
		}

		url.searchParams.delete("alliance");
		window.history.replaceState({}, "", url.toString());
	}

	function closeLegacyAllianceDialogs() {
		document.querySelectorAll("dialog.modal[open]").forEach((dialog) => {
			const text = (dialog.textContent || "").replace(/\s+/g, " ").trim();
			if (!/Alliance Name|Leave alliance|Alliances/i.test(text)) {
				return;
			}

			try {
				dialog.close();
			} catch {
				dialog.removeAttribute("open");
			}
		});
	}

	function openModal(tab) {
		if (typeof window.gplaceCloseProfileModal === "function") {
			window.gplaceCloseProfileModal();
		}
		if (typeof window.gplaceCloseChatModal === "function") {
			window.gplaceCloseChatModal();
		}
		ensureStyles();
		const panel = ensurePanel();
		if (openAnimationFrame) {
			window.cancelAnimationFrame(openAnimationFrame);
			openAnimationFrame = null;
		}
		refreshRevision += 1;
		leaderboardRevision += 1;
		state.isOpen = true;
		state.activeTab = tab || state.activeTab || "overview";
		panel.hidden = false;
		panel.dataset.state = "opening";
		document.body.classList.add("gplace-alliance-lock");
		clearAllianceParam();
		closeLegacyAllianceDialogs();
		render();
		openAnimationFrame = window.requestAnimationFrame(() => {
			panel.dataset.state = "open";
			openAnimationFrame = null;
		});
		void refreshAlliance();
	}

	function closeModal() {
		const panel = document.getElementById("gplace-alliance-panel");
		if (!panel) {
			return;
		}

		if (openAnimationFrame) {
			window.cancelAnimationFrame(openAnimationFrame);
			openAnimationFrame = null;
		}
		refreshRevision += 1;
		leaderboardRevision += 1;
		state.isOpen = false;
		state.contentAnimating = false;
		if (contentAnimationTimer) {
			clearTimeout(contentAnimationTimer);
			contentAnimationTimer = null;
		}
		panel.hidden = true;
		panel.dataset.state = "closed";
		document.body.classList.remove("gplace-alliance-lock");
	}

	async function request(path, options) {
		const init = {
			credentials: "include",
			headers: {
				"Accept": "application/json",
				...(options && options.body ? { "Content-Type": "application/json" } : {})
			},
			...(options || {})
		};

		const response = await fetch(path, init);
		const payload = await response.json().catch(() => ({}));
		return { response, payload };
	}

	async function fetchCurrentUser() {
		try {
			const { response, payload } = await request("/me");
			if (!response.ok) {
				return null;
			}
			return payload;
		} catch {
			return null;
		}
	}

	async function loadMembers(reset) {
		if (!state.alliance) {
			state.members = [];
			state.membersPage = 0;
			state.membersHasNext = false;
			return;
		}

		const page = reset ? 0 : state.membersPage + 1;
		const { response, payload } = await request(`/alliance/members/${page}`);
		if (!response.ok || !Array.isArray(payload.data)) {
			throw new Error(payload.error || "Could not load members.");
		}

		state.members = reset ? payload.data : state.members.concat(payload.data);
		state.membersPage = page;
		state.membersHasNext = !!payload.hasNext;
		syncOwnerLeaveTarget();
	}

	async function loadBanned(reset) {
		if (!state.alliance || !canModerateAlliance()) {
			state.bannedMembers = [];
			state.bannedPage = 0;
			state.bannedHasNext = false;
			return;
		}

		const page = reset ? 0 : state.bannedPage + 1;
		const { response, payload } = await request(`/alliance/members/banned/${page}`);
		if (!response.ok || !Array.isArray(payload.data)) {
			throw new Error(payload.error || "Could not load banned members.");
		}

		state.bannedMembers = reset ? payload.data : state.bannedMembers.concat(payload.data);
		state.bannedPage = page;
		state.bannedHasNext = !!payload.hasNext;
	}

	async function loadLeaderboard(mode) {
		const revision = ++leaderboardRevision;
		if (!state.alliance) {
			state.leaderboardEntries = [];
			return;
		}

		state.leaderboardLoading = true;
		state.leaderboardMode = mode || state.leaderboardMode;
		render();

		try {
			const { response, payload } = await request(`/alliance/leaderboard/${state.leaderboardMode}`);
			if (!response.ok || !Array.isArray(payload)) {
				throw new Error(payload.error || "Could not load leaderboard.");
			}

			if (revision !== leaderboardRevision || !state.isOpen) {
				return;
			}
			state.leaderboardEntries = payload;
		} finally {
			if (revision !== leaderboardRevision || !state.isOpen) {
				return;
			}
			state.leaderboardLoading = false;
			render();
		}
	}

	async function loadJoinRequests() {
		if (!state.alliance || !canReviewRequests()) {
			state.joinRequests = [];
			return;
		}

		state.requestsLoading = true;
		render();

		try {
			const { response, payload } = await request("/alliance/requests");
			if (!response.ok || !Array.isArray(payload)) {
				throw new Error(payload.error || "Could not load join requests.");
			}

			state.joinRequests = payload;
		} finally {
			state.requestsLoading = false;
			render();
		}
	}

	async function loadActivityLogs() {
		if (!state.alliance || !canViewActivity()) {
			state.activityLogs = [];
			return;
		}

		state.activityLoading = true;
		render();

		try {
			const { response, payload } = await request("/alliance/activity");
			if (!response.ok || !Array.isArray(payload)) {
				throw new Error(payload.error || "Could not load alliance activity.");
			}

			state.activityLogs = payload;
		} finally {
			state.activityLoading = false;
			render();
		}
	}

	function syncSettingsDraft() {
		if (!state.alliance) {
			return;
		}

		state.settingsDraft = {
			name: state.alliance.name || "",
			tag: state.alliance.tag || "",
			picture: state.alliance.picture || "",
			banner: state.alliance.banner || "",
			description: state.alliance.description || "",
			joinPolicy: state.alliance.joinPolicy || "invite"
		};
		state.announcementDraft = state.alliance.announcement || "";
		state.permissionsDraft = JSON.parse(JSON.stringify(state.alliance.permissions || {
			admin: {},
			mod: {},
			member: {}
		}));
	}

	async function refreshAlliance() {
		const revision = ++refreshRevision;
		state.loading = true;
		render();

		try {
			state.currentUser = await fetchCurrentUser();
			if (revision !== refreshRevision || !state.isOpen) {
				return;
			}
			if (!state.currentUser) {
				state.alliance = null;
				state.members = [];
				state.membersHasNext = false;
				state.bannedMembers = [];
				state.bannedHasNext = false;
				state.leaderboardEntries = [];
				state.lastInviteLink = "";
				state.ownerLeaveTargetUserId = "";
				state.activeTab = "overview";
				return;
			}

			const { response, payload } = await request("/alliance");
			if (revision !== refreshRevision || !state.isOpen) {
				return;
			}
			if (response.status === 404) {
				state.alliance = null;
				state.members = [];
				state.membersHasNext = false;
				state.bannedMembers = [];
				state.bannedHasNext = false;
				state.leaderboardEntries = [];
				state.lastInviteLink = "";
				state.ownerLeaveTargetUserId = "";
				state.activeTab = "overview";
				return;
			}

			if (!response.ok) {
				throw new Error(payload.error || "Could not load alliance.");
			}

			state.alliance = payload;
			syncSettingsDraft();
			await loadMembers(true);
			if (revision !== refreshRevision || !state.isOpen) {
				return;
			}
			syncOwnerLeaveTarget();
			await loadBanned(true);
			if (revision !== refreshRevision || !state.isOpen) {
				return;
			}
			if (canReviewRequests()) {
				await loadJoinRequests();
				if (revision !== refreshRevision || !state.isOpen) {
					return;
				}
			} else {
				state.joinRequests = [];
			}
			if (state.activeTab === "leaderboard") {
				await loadLeaderboard(state.leaderboardMode);
			}
			if (state.activeTab === "activity" && canViewActivity()) {
				await loadActivityLogs();
			}
			if (state.activeTab === "banned" && !canModerateAlliance()) {
				state.activeTab = "overview";
			}
			if (state.activeTab === "requests" && !canReviewRequests()) {
				state.activeTab = "overview";
			}
			if (state.activeTab === "activity" && !canViewActivity()) {
				state.activeTab = "overview";
			}
		} catch (error) {
			if (revision !== refreshRevision || !state.isOpen) {
				return;
			}
			setNotice(error instanceof Error ? error.message : "Could not load alliance.", "error");
		} finally {
			if (revision !== refreshRevision || !state.isOpen) {
				return;
			}
			state.loading = false;
			render();
		}
	}

	async function createAlliance() {
		state.saving = true;
		render();

		try {
			const { response, payload } = await request("/alliance", {
				method: "POST",
				body: JSON.stringify(state.createDraft)
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not create alliance.");
			}

			state.createDraft = {
				name: "",
				tag: "",
				picture: "",
				banner: "",
				description: ""
			};
			state.activeTab = "overview";
			await refreshAlliance();
			setNotice("Alliance created.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not create alliance.", "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	async function saveSettings() {
		state.saving = true;
		render();

		try {
			const { response, payload } = await request("/alliance/settings", {
				method: "POST",
				body: JSON.stringify(state.settingsDraft)
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not save settings.");
			}

			await refreshAlliance();
			setNotice("Alliance settings updated.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not save settings.", "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	async function saveAnnouncement() {
		state.saving = true;
		render();

		try {
			const { response, payload } = await request("/alliance/announcement", {
				method: "POST",
				body: JSON.stringify({
					announcement: state.announcementDraft
				})
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not update announcement.");
			}

			await refreshAlliance();
			setNotice(state.announcementDraft.trim() ? "Announcement updated." : "Announcement cleared.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not update announcement.", "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	async function savePermissions() {
		state.saving = true;
		render();

		try {
			const { response, payload } = await request("/alliance/permissions", {
				method: "POST",
				body: JSON.stringify({
					permissions: state.permissionsDraft
				})
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not update permissions.");
			}

			if (payload.permissions) {
				state.permissionsDraft = payload.permissions;
			}
			await refreshAlliance();
			setNotice("Role permissions updated.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not update permissions.", "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	async function saveMemberRole(userId, role) {
		state.saving = true;
		render();

		try {
			const { response, payload } = await request("/alliance/member-role", {
				method: "POST",
				body: JSON.stringify({
					targetUserId: userId,
					role
				})
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not update member role.");
			}

			await refreshAlliance();
			setNotice("Member role updated.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not update member role.", "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	async function kickMember(userId) {
		if (!window.confirm("Remove this member from the alliance?")) {
			return;
		}

		state.saving = true;
		render();

		try {
			const { response, payload } = await request("/alliance/kick", {
				method: "POST",
				body: JSON.stringify({
					targetUserId: userId
				})
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not remove member.");
			}

			await refreshAlliance();
			setNotice("Member removed.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not remove member.", "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	async function leaveAlliance() {
		if (!window.confirm("Leave this alliance?")) {
			return;
		}

		state.saving = true;
		render();

		try {
			const { response, payload } = await request("/alliance/leave", {
				method: "POST"
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not leave alliance.");
			}

			state.activeTab = "overview";
			await refreshAlliance();
			setNotice("You left the alliance.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not leave alliance.", "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	async function transferOwnershipAndLeave() {
		if (!state.ownerLeaveTargetUserId) {
			setNotice("Pick the next owner first.", "error");
			return;
		}

		if (!window.confirm("Leave the alliance and hand ownership to the selected member?")) {
			return;
		}

		state.saving = true;
		render();

		try {
			const { response, payload } = await request("/alliance/leave", {
				method: "POST",
				body: JSON.stringify({
					successorUserId: Number(state.ownerLeaveTargetUserId)
				})
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not hand over the alliance.");
			}

			state.activeTab = "overview";
			await refreshAlliance();
			setNotice("Ownership transferred and you left the alliance.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not hand over the alliance.", "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	async function deleteAlliance() {
		if (!window.confirm("Delete this alliance for everyone? This cannot be undone.")) {
			return;
		}

		state.saving = true;
		render();

		try {
			const { response, payload } = await request("/alliance/delete", {
				method: "POST"
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not delete alliance.");
			}

			state.activeTab = "overview";
			await refreshAlliance();
			setNotice("Alliance deleted.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not delete alliance.", "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	async function copyInvite() {
		try {
			const { response, payload } = await request("/alliance/invites");
			if (!response.ok || !Array.isArray(payload) || !payload[0]) {
				throw new Error("Could not create invite.");
			}

			const inviteUrl = `${window.location.origin}/alliance/join/${payload[0]}`;
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(inviteUrl);
			}
			state.lastInviteLink = inviteUrl;
			setNotice("Invite link copied.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not copy invite.", "error");
		}
	}

	async function banMember(userId) {
		if (!window.confirm("Ban this member from rejoining the alliance?")) {
			return;
		}

		state.saving = true;
		render();

		try {
			const { response, payload } = await request("/alliance/ban", {
				method: "POST",
				body: JSON.stringify({
					bannedUserId: userId
				})
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not ban member.");
			}

			await refreshAlliance();
			state.activeTab = "banned";
			setNotice("Member banned.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not ban member.", "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	async function unbanMember(userId) {
		state.saving = true;
		render();

		try {
			const { response, payload } = await request("/alliance/unban", {
				method: "POST",
				body: JSON.stringify({
					unbannedUserId: userId
				})
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not unban member.");
			}

			await loadBanned(true);
			render();
			setNotice("Member unbanned.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not unban member.", "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	async function reviewJoinRequest(requestId, decision) {
		state.saving = true;
		render();

		try {
			const { response, payload } = await request(`/alliance/requests/${requestId}/${decision}`, {
				method: "POST"
			});

			if (!response.ok) {
				throw new Error(payload.error || `Could not ${decision} the join request.`);
			}

			await loadJoinRequests();
			await loadMembers(true);
			setNotice(decision === "approve" ? "Join request approved." : "Join request denied.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : `Could not ${decision} the join request.`, "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	async function setHeadquartersFromView() {
		const center = currentMapCenter();
		if (!center) {
			setNotice("Move the map first so I can read the current view center.", "error");
			return;
		}

		state.saving = true;
		render();

		try {
			const { response, payload } = await request("/alliance/update-headquarters", {
				method: "POST",
				body: JSON.stringify(center)
			});

			if (!response.ok) {
				throw new Error(payload.error || "Could not update headquarters.");
			}

			await refreshAlliance();
			setNotice("Headquarters updated from the current map view.", "success");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Could not update headquarters.", "error");
		} finally {
			state.saving = false;
			render();
		}
	}

	function handleInput(event) {
		const target = event.target;
		if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLSelectElement)) {
			return;
		}

		const permissionPath = target.getAttribute("data-alliance-permission");
		if (permissionPath) {
			const [role, permission] = permissionPath.split(".");
			if (role && permission && state.permissionsDraft[role]) {
				state.permissionsDraft[role][permission] = !!target.checked;
			}
			return;
		}

		const field = target.getAttribute("data-alliance-field");
		if (field === "member-search") {
			state.memberSearch = target.value;
			renderAndRestoreField(field, target.selectionStart, target.selectionEnd);
			return;
		}

		if (field === "member-role-filter") {
			state.memberRoleFilter = target.value;
			renderAndRestoreField(field);
			return;
		}

		if (field === "owner-leave-target") {
			state.ownerLeaveTargetUserId = target.value;
			renderAndRestoreField(field);
			return;
		}

		if (field === "banned-search") {
			state.bannedSearch = target.value;
			renderAndRestoreField(field, target.selectionStart, target.selectionEnd);
			return;
		}

		const form = target.closest("[data-draft-form]");
		if (target.name === "announcement") {
			state.announcementDraft = target.value;
			return;
		}
		if (!form || !target.name) {
			return;
		}

		if (form.getAttribute("data-draft-form") === "create") {
			state.createDraft[target.name] = target.value;
			return;
		}

		if (form.getAttribute("data-draft-form") === "settings") {
			state.settingsDraft[target.name] = target.value;
		}
	}

	function handleClick(event) {
		const trigger = event.target instanceof Element
			? event.target.closest("[data-alliance-action]")
			: null;

		if (!trigger) {
			return;
		}

		const action = trigger.getAttribute("data-alliance-action");
		if (!action) {
			return;
		}

		switch (action) {
		case "close":
			closeModal();
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
		case "set-tab":
			if (state.activeTab === (trigger.getAttribute("data-tab") || "overview")) {
				return;
			}
			state.activeTab = trigger.getAttribute("data-tab") || "overview";
			animateTabContent();
			if (state.activeTab === "leaderboard") {
				void loadLeaderboard(state.leaderboardMode).catch((error) => {
					setNotice(error instanceof Error ? error.message : "Could not load leaderboard.", "error");
				});
				return;
			}
			if (state.activeTab === "requests" && canReviewRequests()) {
				void loadJoinRequests().catch((error) => {
					setNotice(error instanceof Error ? error.message : "Could not load join requests.", "error");
				});
				return;
			}
			if (state.activeTab === "activity" && canViewActivity()) {
				void loadActivityLogs().catch((error) => {
					setNotice(error instanceof Error ? error.message : "Could not load alliance activity.", "error");
				});
				return;
			}
			if (state.activeTab === "banned" && state.bannedMembers.length === 0 && canModerateAlliance()) {
				void loadBanned(true).then(() => render()).catch((error) => {
					setNotice(error instanceof Error ? error.message : "Could not load banned members.", "error");
				});
				return;
			}
			render();
			break;
		case "leaderboard-mode":
			animateTabContent();
			void loadLeaderboard(trigger.getAttribute("data-mode") || "week").catch((error) => {
				setNotice(error instanceof Error ? error.message : "Could not load leaderboard.", "error");
			});
			break;
		case "copy-invite":
			void copyInvite();
			break;
		case "leave-alliance":
			void leaveAlliance();
			break;
		case "leave-transfer":
			void transferOwnershipAndLeave();
			break;
		case "delete-alliance":
			void deleteAlliance();
			break;
		case "open-settings":
			if (state.activeTab === "settings") {
				return;
			}
			state.activeTab = "settings";
			animateTabContent();
			break;
		case "open-requests":
			state.activeTab = "requests";
			animateTabContent();
			void loadJoinRequests().catch((error) => {
				setNotice(error instanceof Error ? error.message : "Could not load join requests.", "error");
			});
			break;
		case "open-activity":
			state.activeTab = "activity";
			animateTabContent();
			void loadActivityLogs().catch((error) => {
				setNotice(error instanceof Error ? error.message : "Could not load activity log.", "error");
			});
			break;
		case "kick-member":
			void kickMember(Number(trigger.getAttribute("data-user-id")));
			break;
		case "ban-member":
			void banMember(Number(trigger.getAttribute("data-user-id")));
			break;
		case "unban-member":
			void unbanMember(Number(trigger.getAttribute("data-user-id")));
			break;
		case "approve-request":
			void reviewJoinRequest(Number(trigger.getAttribute("data-request-id")), "approve");
			break;
		case "deny-request":
			void reviewJoinRequest(Number(trigger.getAttribute("data-request-id")), "deny");
			break;
		case "set-hq":
			void setHeadquartersFromView();
			break;
		case "open-hq":
			if (state.alliance?.hq) {
				window.location.href = locationLink(state.alliance.hq.latitude, state.alliance.hq.longitude);
			}
			break;
		case "copy-hq":
			if (state.alliance?.hq) {
				void copyTextWithNotice(
					locationLink(state.alliance.hq.latitude, state.alliance.hq.longitude),
					"HQ link copied.",
					"Could not copy HQ link."
				);
			}
			break;
		case "open-location":
			window.location.href = locationLink(trigger.getAttribute("data-lat"), trigger.getAttribute("data-lng"));
			break;
		case "copy-location":
			void copyTextWithNotice(
				locationLink(trigger.getAttribute("data-lat"), trigger.getAttribute("data-lng")),
				"Location copied.",
				"Could not copy location."
			);
			break;
		case "load-more-members":
			void (async () => {
				try {
					await loadMembers(false);
					render();
				} catch (error) {
					setNotice(error instanceof Error ? error.message : "Could not load more members.", "error");
				}
			})();
			break;
		case "load-more-banned":
			void (async () => {
				try {
					await loadBanned(false);
					render();
				} catch (error) {
					setNotice(error instanceof Error ? error.message : "Could not load more banned members.", "error");
				}
			})();
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

		event.preventDefault();

		switch (form.getAttribute("data-form")) {
		case "create":
			void createAlliance();
			break;
		case "announcement":
			void saveAnnouncement();
			break;
		case "permissions":
			void savePermissions();
			break;
		case "settings":
			void saveSettings();
			break;
		case "member-role": {
			const select = form.querySelector("select[name='role']");
			const role = select instanceof HTMLSelectElement ? select.value : "member";
			void saveMemberRole(Number(form.getAttribute("data-user-id")), role);
			break;
		}
		default:
			break;
		}
	}

	function isAllianceButton(button) {
		if (!button || button.closest("#gplace-alliance-panel")) {
			return false;
		}

		const title = button.getAttribute("title") || button.getAttribute("aria-label") || "";
		return /alliance|alian/i.test(title);
	}

	function interceptAllianceEvent(event, button) {
		if (!isAllianceButton(button)) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		if (typeof event.stopImmediatePropagation === "function") {
			event.stopImmediatePropagation();
		}

		openModal("overview");
	}

	function bindAllianceTrigger(button) {
		if (button.dataset.gplaceAllianceBound === "true") {
			return;
		}

		const handler = (event) => {
			interceptAllianceEvent(event, button);
		};

		button.addEventListener("click", handler, true);
		button.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				interceptAllianceEvent(event, button);
			}
		}, true);
		button.dataset.gplaceAllianceBound = "true";
	}

	function syncAllianceButtons() {
		document.querySelectorAll("button[title], button[aria-label]").forEach((button) => {
			if (isAllianceButton(button)) {
				bindAllianceTrigger(button);
			}
		});
	}

	window.gplaceOpenAllianceModal = openModal;
	window.gplaceCloseAllianceModal = closeModal;

	ensureStyles();
	ensurePanel();
	syncAllianceButtons();

	if (new URL(window.location.href).searchParams.get("alliance")) {
		openModal("overview");
	}

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			closeModal();
		}
	});

	const observer = new MutationObserver(() => {
		scheduleAllianceButtonsSync();
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true
	});
})();
