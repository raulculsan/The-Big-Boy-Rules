const baseMembers = [
  ["kike", "Kike", "The Administrator", "admin", "Administrador de The Big Boy Rules.", ["Administrador", "Fundador", "Club"], "#4a3210"],
  ["lizzy", "Lizzy", "The Golden Voice", "member", "Miembro de The Big Boy Rules.", ["Música", "Momentos", "Comunidad"], "#38233d"],
  ["raul", "Raúl", "The Insider", "member", "Tecnología, fútbol, música y buenas historias.", ["Tecnología", "Fútbol", "Música"], "#2d2616"],
  ["mario", "Mario", "The Wild Card", "member", "Especialista en convertir cualquier plan en una historia.", ["Planes", "Humor", "Lealtad"], "#321b20"],
  ["miguelangel", "Miguel Ángel", "The Strategist", "member", "Siempre pensando en el siguiente movimiento.", ["Estrategia", "Planes", "Equipo"], "#162d32"],
  ["almudena", "Almudena", "The Diplomat", "member", "Punto de equilibrio del grupo.", ["Calma", "Consejos", "Comunidad"], "#2b243d"],
  ["carlos", "Carlos", "The Machine", "member", "Energía constante y disponibilidad para cualquier plan.", ["Energía", "Deporte", "Planes"], "#303219"],
  ["albertovelasco", "Alberto Velasco", "The Legend", "member", "Un archivo creciente de historias y frases memorables.", ["Historias", "Humor", "Noche"], "#3b2c14"],
  ["caonaboalbero", "Caonabo Albero", "The Original", "member", "Personalidad propia y presencia inconfundible.", ["Original", "Lealtad", "Grupo"], "#173225"]
];

let members = baseMembers.map((item, index) => ({
  id: index + 1,
  username: item[0],
  password: "bigboy2026",
  name: item[1],
  nickname: item[2],
  roleKey: item[3],
  role: item[3] === "admin" ? "ADMINISTRADOR" : "MIEMBRO",
  bio: item[4],
  tags: item[5],
  countryFlag: "",
  avatarUrl: "",
  bg: `linear-gradient(145deg, ${item[6]}, #0c0c0e 68%)`
}));

const config = window.BIG_BOY_CONFIG || {};
const backendReady = Boolean(config.supabaseUrl && config.supabasePublishableKey && window.supabase);
const db = backendReady
  ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey)
  : null;
const AUTH_STORAGE_KEY = "bb-auth-session";
const AUTH_SESSION_KEY = "bb-auth-temporary";
const PROFILE_STORAGE_KEY = "bb-local-profiles";
const GENERIC_PASSWORD = "bigboy2026";
const PASSWORD_CHANGE_STORAGE_PREFIX = "bb-password-change-required-";
const NEWS_CACHE_DURATION = 2 * 60 * 1000;
const NEWS_REFRESH_INTERVAL = 2 * 60 * 1000;
const MEGABYTE = 1024 * 1024;
const FILE_LIMITS = Object.freeze({
  attachment: 50 * MEGABYTE,
  media: 100 * MEGABYTE
});
const STORY_GESTURE = Object.freeze({horizontalThreshold: 45, dismissThreshold: 90, holdDelay: 250});
const pageTitle = document.getElementById("pageTitle");
const sections = [...document.querySelectorAll(".page-section")];
const navLinks = [...document.querySelectorAll(".app-tab")];
const isStandaloneApp = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
document.body.classList.toggle("standalone-app", isStandaloneApp);
let mobileHeaderLastScrollY = Math.max(0, window.scrollY);
let mobileHeaderScrollAnchor = mobileHeaderLastScrollY;
let mobileHeaderDirection = null;
let mobileHeaderFrame = null;

function isMobileSidebar() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function mobileHeaderMustStayVisible() {
  return document.body.classList.contains("chat-focus")
    || document.querySelector(".modal-backdrop.open")
    || document.getElementById("notificationsDropdown")?.getAttribute("aria-hidden") === "false";
}

function showMobileHeader() {
  document.body.classList.remove("mobile-header-hidden");
}

function syncMobileHeader() {
  mobileHeaderFrame = null;
  const currentScrollY = Math.max(0, window.scrollY);
  if (!isMobileSidebar() || mobileHeaderMustStayVisible() || currentScrollY < 72) {
    showMobileHeader();
    mobileHeaderLastScrollY = currentScrollY;
    mobileHeaderScrollAnchor = currentScrollY;
    mobileHeaderDirection = null;
    return;
  }
  const movement = currentScrollY - mobileHeaderLastScrollY;
  if (movement > 2) {
    if (mobileHeaderDirection !== "down") {
      mobileHeaderDirection = "down";
      mobileHeaderScrollAnchor = mobileHeaderLastScrollY;
    }
    if (currentScrollY > 120 && currentScrollY - mobileHeaderScrollAnchor > 64) {
      document.body.classList.add("mobile-header-hidden");
    }
  } else if (movement < -2) {
    if (mobileHeaderDirection !== "up") {
      mobileHeaderDirection = "up";
      mobileHeaderScrollAnchor = mobileHeaderLastScrollY;
    }
    if (mobileHeaderScrollAnchor - currentScrollY > 18) showMobileHeader();
  }
  mobileHeaderLastScrollY = currentScrollY;
}

function scheduleMobileHeaderSync() {
  if (mobileHeaderFrame) return;
  mobileHeaderFrame = requestAnimationFrame(syncMobileHeader);
}

let currentUser = null;
let currentAuthUser = null;
let messages = [];
let moments = [];
let profilePosts = [];
let mediaLikes = [];
let mediaLikesIndex = new Map();
let notifications = [];
let privateMessages = [];
let groupEvents = [];
let chatChannels = [];
let helpRequests = [];
let helpMessages = [];
let newsItems = [];
let siteSettings = {};
let onlineUsers = [];
let presenceChannel = null;
let messageChannel = null;
let momentChannel = null;
let postChannel = null;
let mediaLikesChannel = null;
let notificationsChannel = null;
let privateChannel = null;
let eventChannel = null;
let settingsChannel = null;
let chatChannelsRealtime = null;
let helpRealtime = null;
let activeNewsCategory = "deportes";
let activeHelpRequestId = null;
let activeHelpFilter = "all";
let lastNewsRefreshAt = 0;
let newsLoadToken = 0;
let pendingPrivateMessageFile = null;
let activeAudioRecording = null;
const attachmentPreviewUrls = {group: "", private: ""};
let pendingAvatarFile = null;
let removeAvatarRequested = false;
let avatarCropImage = null;
let avatarCropZoom = 1;
let avatarCropOffsetX = 0;
let avatarCropOffsetY = 0;
let avatarCropPointer = null;
let mediaCropImage = null;
let mediaCropZoom = 1;
let mediaCropOffsetX = 0;
let mediaCropOffsetY = 0;
let mediaCropPointer = null;
let mediaFilter = "none";
let mediaOverlayText = "";
let pendingMediaUploadFile = null;
let mediaPreviewObjectUrl = "";
let storyCameraStream = null;
let storyCameraFacingMode = "environment";
let storyCameraTorchEnabled = false;
let storyCameraOpeningToken = 0;
let storyRecorder = null;
let storyRecordingChunks = [];
let storyRecordingStartedAt = 0;
let storyRecordingTimer = null;
let storyShutterHoldTimer = null;
let storyShutterPointerId = null;
let storyRecordingDiscard = false;
let mediaUploaderBackToCamera = false;
let cameraCaptureMode = "moment";
let storyCaptureInProgress = false;
let pendingMessageFile = null;
let mediaUploadMode = "post";
let activeProfileId = null;
let editingProfileId = null;
let activePrivateMemberId = null;
let activeChatChannelId = null;
let calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let sectionBeforeChat = "inicio";
let activeContentTab = "publicaciones";
let viewportSyncFrame = null;
let mobileViewportBaseline = window.innerHeight;
let cursorFrame = null;
let profileQuickMenuPressTimer = null;
let profileQuickMenuPointer = null;
let suppressProfileTabClick = false;
let sharingMedia = null;
let activeMomentSequence = [];
let activeMomentIndex = -1;
let momentAdvanceTimer = null;
let momentAdvanceDeadline = 0;
let momentAdvanceRemaining = 6000;
let momentGesture = null;
let momentPressStartedAt = 0;
let suppressMomentNavigationClick = false;
let replyingMedia = null;
const realtimeRefreshTimers = new Map();

function scheduleRealtimeRefresh(key, loader, delay = 180) {
  clearTimeout(realtimeRefreshTimers.get(key));
  realtimeRefreshTimers.set(key, setTimeout(() => {
    realtimeRefreshTimers.delete(key);
    loader();
  }, delay));
}

function escapeHtml(value = "") {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

function formatLimit(limit) {
  return `${Math.round(limit / MEGABYTE)} MB`;
}

function validateFileSize(file, limit) {
  if (!file || file.size <= limit) return;
  throw new Error(`El archivo supera el máximo de ${formatLimit(limit)}.`);
}

function uploadLimitForFolder(folder) {
  return ["moments", "posts"].includes(folder) ? FILE_LIMITS.media : FILE_LIMITS.attachment;
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
}

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(config.vapidPublicKey);
}

async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function syncPushNotificationState() {
  const button = document.getElementById("pushNotificationButton");
  const testButton = document.getElementById("pushNotificationTestButton");
  const status = document.getElementById("pushNotificationStatus");
  if (!button || !status) return;
  if (!pushSupported()) {
    button.disabled = true;
    if (testButton) testButton.hidden = true;
    button.textContent = "No disponible";
    status.textContent = "Instala la PWA en un dispositivo compatible.";
    return;
  }
  const subscription = await currentPushSubscription();
  button.disabled = false;
  button.classList.toggle("enabled", Boolean(subscription));
  if (testButton) testButton.hidden = !subscription;
  button.textContent = subscription ? "Desactivar" : "Activar";
  status.textContent = subscription ? "Recibirás mensajes, Me gusta y respuestas." : Notification.permission === "denied" ? "El permiso está bloqueado en los ajustes del dispositivo." : "Actívalos para recibir avisos aunque la aplicación esté cerrada.";
}

async function togglePushNotifications() {
  if (!backendReady || !currentAuthUser || !pushSupported()) return syncPushNotificationState();
  const button = document.getElementById("pushNotificationButton");
  button.disabled = true;
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await db.from("push_subscriptions").delete().eq("endpoint", existing.endpoint).eq("user_id", currentAuthUser.id);
      await existing.unsubscribe();
    } else {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("No se ha concedido permiso para mostrar notificaciones.");
      const subscription = await registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey)});
      const serialized = subscription.toJSON();
      const {error} = await db.from("push_subscriptions").upsert({user_id: currentAuthUser.id, endpoint: subscription.endpoint, p256dh: serialized.keys.p256dh, auth: serialized.keys.auth, user_agent: navigator.userAgent, updated_at: new Date().toISOString()}, {onConflict: "endpoint"});
      if (error) {
        await subscription.unsubscribe();
        throw error;
      }
    }
  } catch (error) {
    window.alert(error.message || "No se pudieron configurar las notificaciones.");
  } finally {
    await syncPushNotificationState();
  }
}

async function dispatchPush(kind, entityId) {
  if (!backendReady || !currentAuthUser || !entityId) return;
  const {data, error} = await db.functions.invoke("push-dispatch", {body: {kind, entityId}});
  if (error) console.warn("No se pudo enviar la notificación push", error);
  return {data, error};
}

async function testPushNotifications() {
  const button = document.getElementById("pushNotificationTestButton");
  const status = document.getElementById("pushNotificationStatus");
  button.disabled = true;
  status.textContent = "Enviando notificación de prueba…";
  const result = await dispatchPush("test", "self");
  if (result?.error) status.textContent = "No se pudo enviar. Vuelve a activar los avisos.";
  else if (result?.data?.delivered) status.textContent = "Prueba enviada. Debe aparecer en unos segundos.";
  else if (result?.data?.subscriptions) status.textContent = "Apple ha rechazado el envío. Desactiva y vuelve a activar los avisos.";
  else status.textContent = "No hay una suscripción guardada. Desactiva y vuelve a activar los avisos.";
  button.disabled = false;
}

function classifyStoryGesture(gesture, endX, endY, elapsed) {
  const distanceX = endX - gesture.x;
  const distanceY = endY - gesture.y;
  if (distanceY >= STORY_GESTURE.dismissThreshold && distanceY > Math.abs(distanceX) * 1.1) {
    return {action: "dismiss"};
  }
  if (Math.abs(distanceX) >= STORY_GESTURE.horizontalThreshold) {
    return {action: distanceX < 0 ? "next" : "previous"};
  }
  return {action: "release", held: elapsed >= STORY_GESTURE.holdDelay};
}

function normalizeUsername(value = "") {
  return value.trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
}

function resolveMediaMention() {
  const selected = document.getElementById("mediaMention")?.value;
  if (selected) return selected;
  const searchable = `${document.getElementById("mediaOverlayText")?.value || ""} ${document.getElementById("mediaUploadCaption")?.value || ""}`;
  const username = searchable.match(/(?:^|\s)@([a-zA-Z0-9._-]{3,32})/)?.[1];
  return username ? members.find(member => normalizeUsername(member.username) === normalizeUsername(username))?.authId || null : null;
}

function isSuperAdmin() {
  return currentUser?.roleKey === "superadmin" && currentUser?.hidden === true;
}

function canManageSite() {
  return currentUser?.roleKey === "admin" || isSuperAdmin();
}

function getMember(id) {
  return members.find(member => member.id === Number(id));
}

function getMemberByAuthId(id) {
  return members.find(member => member.authId === id);
}

function getAvatar(member, className = "avatar") {
  if (member?.avatarUrl) {
    return `<div class="${className} has-image"><img src="${escapeHtml(member.avatarUrl)}" alt="Foto de ${escapeHtml(member.name)}" decoding="async"></div>`;
  }
  return `<div class="${className}">${escapeHtml(member?.name?.charAt(0).toUpperCase() || "U")}</div>`;
}

function applyStoredProfiles() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "{}");
    members = members.map(member => ({...member, ...(stored[member.id] || {})}));
  } catch {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  }
}

function persistLocalProfile(member) {
  const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "{}");
  stored[member.id] = {
    name: member.name, nickname: member.nickname, bio: member.bio,
    tags: member.tags, countryFlag: member.countryFlag, avatarUrl: member.avatarUrl
  };
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(stored));
}

function syncMobileViewport() {
  if (viewportSyncFrame) return;
  viewportSyncFrame = requestAnimationFrame(() => {
    viewportSyncFrame = null;
    const visualViewport = window.visualViewport;
    const storyCameraOpen = document.getElementById("storyCamera")?.classList.contains("open");
    if (storyCameraOpen) {
      document.documentElement.style.setProperty("--story-viewport-width", `${Math.ceil(visualViewport?.width || window.innerWidth)}px`);
      document.documentElement.style.setProperty("--story-viewport-height", `${Math.ceil(visualViewport?.height || window.innerHeight)}px`);
      document.documentElement.style.setProperty("--story-viewport-left", `${Math.floor(visualViewport?.offsetLeft || 0)}px`);
      document.documentElement.style.setProperty("--story-viewport-top", `${Math.floor(visualViewport?.offsetTop || 0)}px`);
      fitStoryCameraPreview();
    } else {
      ["--story-viewport-width", "--story-viewport-height", "--story-viewport-left", "--story-viewport-top"]
        .forEach(property => document.documentElement.style.removeProperty(property));
    }
    if (window.innerWidth > 760) {
      document.documentElement.style.removeProperty("--chat-viewport-height");
      document.documentElement.style.removeProperty("--chat-viewport-offset");
      document.body.classList.remove("chat-keyboard-open");
      return;
    }
    const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight);
    const viewportOffset = Math.round(window.visualViewport?.offsetTop || 0);
    const composerFocused = Boolean(document.activeElement?.closest?.(".message-form"));
    if (!composerFocused) mobileViewportBaseline = Math.max(window.innerHeight, viewportHeight);
    const keyboardOpen = composerFocused && mobileViewportBaseline - viewportHeight > 120;
    document.documentElement.style.setProperty("--chat-viewport-height", `${viewportHeight}px`);
    document.documentElement.style.setProperty("--chat-viewport-offset", `${viewportOffset}px`);
    document.body.classList.toggle("chat-keyboard-open", keyboardOpen);
  });
}

function selectContentTab(tabName) {
  activeContentTab = tabName === "publicaciones" ? "publicaciones" : "momentos";
  document.querySelectorAll("[data-content-tab]").forEach(button => {
    const active = button.dataset.contentTab === activeContentTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-content-panel]").forEach(panel => { panel.hidden = false; });
  const momentsGrid = document.getElementById("momentsGrid");
  const publicationsFeed = document.getElementById("publicationsFeed");
  const momentSignature = moments.map(item => `${item.id}:${getMediaLikes("moment", item.id).length}`).join("|");
  const postSignature = profilePosts.map(item => `${item.id}:${getMediaLikes("post", item.id).length}`).join("|");
  if (momentsGrid?.dataset.renderSignature !== momentSignature) {
    renderMoments();
    momentsGrid.dataset.renderSignature = momentSignature;
  }
  if (publicationsFeed?.dataset.renderSignature !== postSignature) {
    renderPublications();
    publicationsFeed.dataset.renderSignature = postSignature;
  }
}

function goTo(sectionId) {
  closeProfileQuickMenu();
  showMobileHeader();
  mobileHeaderLastScrollY = 0;
  mobileHeaderScrollAnchor = 0;
  mobileHeaderDirection = null;
  const requestedSection = sectionId;
  if (sectionId === "calendario") sectionId = "buscar";
  const homeAnchor = sectionId === "miembros" || sectionId === "noticias" ? sectionId : null;
  if (homeAnchor) sectionId = "inicio";
  if (sectionId === "momentos" || sectionId === "publicaciones") {
    activeContentTab = sectionId;
    sectionId = "contenido";
  }
  const currentSection = sections.find(section => section.classList.contains("active"))?.id;
  const openingChat = sectionId === "chat" || sectionId === "privados";
  if (openingChat && currentSection && currentSection !== "chat" && currentSection !== "privados") {
    sectionBeforeChat = currentSection;
  }
  if (sectionId === "chat") document.getElementById("chat")?.classList.remove("conversation-open");
  sections.forEach(section => section.classList.toggle("active", section.id === sectionId));
  const navigationSection = sectionId === "privados" ? "chat" : sectionId;
  navLinks.forEach(link => {
    const active = link.dataset.section === navigationSection;
    link.classList.toggle("active", active);
    link.setAttribute("aria-current", active ? "page" : "false");
  });
  document.body.classList.toggle("chat-focus", sectionId === "privados");
  syncMobileViewport();
  const titles = {
    inicio: "El Club", chat: "Mensajes", miembros: "Miembros",
    privados: "Mensajes privados", perfil: "Perfil", contenido: "Para ti",
    noticias: "Noticias", buscar: "Buscar", administracion: "Administración", ayuda: "Ayuda y sugerencias"
  };
  pageTitle.textContent = titles[sectionId] || titles.inicio;
  if (homeAnchor) requestAnimationFrame(() => document.getElementById(homeAnchor)?.scrollIntoView({behavior: "smooth", block: "start"}));
  else window.scrollTo({top: 0, behavior: "auto"});
  history.replaceState(null, "", `#${homeAnchor || sectionId}`);
  if ((requestedSection === "noticias" || sectionId === "inicio") && currentUser) loadNews(false);
  if (sectionId === "buscar") renderCalendar();
  if (sectionId === "contenido") selectContentTab(activeContentTab);
  if (sectionId === "ayuda" && currentUser) loadHelpCenter();
}

function openProfileQuickMenu() {
  if (!currentUser) return;
  const menu = document.getElementById("profileQuickMenu");
  menu.hidden = false;
  menu.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => menu.classList.add("open"));
  document.querySelector(".profile-tab")?.setAttribute("aria-expanded", "true");
  navigator.vibrate?.(12);
}

function closeProfileQuickMenu() {
  const menu = document.getElementById("profileQuickMenu");
  if (!menu || menu.hidden) return;
  menu.classList.remove("open");
  menu.setAttribute("aria-hidden", "true");
  document.querySelector(".profile-tab")?.setAttribute("aria-expanded", "false");
  setTimeout(() => {
    if (!menu.classList.contains("open")) menu.hidden = true;
  }, 160);
}

function exitChatView() {
  const groupSection = document.getElementById("chat");
  if (groupSection?.classList.contains("active") && groupSection.classList.contains("conversation-open")) {
    groupSection.classList.remove("conversation-open");
    document.body.classList.remove("chat-focus");
    syncMobileViewport();
    renderPrivateContacts();
    history.replaceState(null, "", "#chat");
    return;
  }
  goTo(sectionBeforeChat && sectionBeforeChat !== "chat" && sectionBeforeChat !== "privados" ? sectionBeforeChat : "inicio");
}

function backFromPrivateConversation() {
  activePrivateMemberId = null;
  renderPrivateConversation();
  goTo("chat");
  renderPrivateContacts();
}

function openGroupConversation(channelId = activeChatChannelId) {
  if (channelId != null && chatChannels.some(channel => String(channel.id) === String(channelId))) {
    activeChatChannelId = channelId;
  }
  goTo("chat");
  const groupSection = document.getElementById("chat");
  groupSection.classList.add("conversation-open");
  document.body.classList.add("chat-focus");
  renderChatChannels();
  renderMessages();
  syncMobileViewport();
  history.replaceState(null, "", "#chat");
}

function renderFeatured() {
  const featured = document.getElementById("featuredMembers");
  if (!featured) return;
  featured.innerHTML = members.slice(0, 4).map(member => `
    <button class="member-mini-card ${member.countryFlag ? "has-country-flag" : ""}" data-profile="${member.id}">
      ${member.countryFlag ? `<span class="member-mini-flag" aria-hidden="true">${escapeHtml(member.countryFlag)}</span>` : ""}
      ${getAvatar(member)}
      <span class="member-mini-copy">
        <strong>${escapeHtml(member.name)}</strong>
        <small>${escapeHtml(member.nickname)}</small>
      </span>
    </button>`).join("");
}

function renderActivity() {
  const list = document.getElementById("activityList");
  if (!messages.length) {
    list.innerHTML = `<div class="empty-state">Todavía no hay actividad real en el chat.</div>`;
    return;
  }
  list.innerHTML = messages.slice(-4).reverse().map(message => {
    const member = getMember(message.member);
    return `<div class="activity-item">
      ${getAvatar(member, "avatar small")}
      <div class="activity-text"><strong>${escapeHtml(member?.name || "Miembro")}</strong><p>ha enviado un mensaje en el chat.</p></div>
      <span class="activity-time">${formatRelativeTime(message.createdAt)}</span>
    </div>`;
  }).join("");
}

function renderMembers() {
  document.getElementById("membersGrid").innerHTML = members.map(member => `
    <article class="member-card ${member.avatarUrl ? "with-photo" : ""}"
      style="--member-bg:${member.avatarUrl ? `url('${escapeHtml(member.avatarUrl)}')` : member.bg}"
      data-member-username="${escapeHtml(member.username)}" data-number="${String(memberDisplayNumber(member)).padStart(2, "0")}">
      <span class="member-role">${member.role}</span>
      <h3>${escapeHtml(member.name)}</h3>
      <p>${escapeHtml(member.nickname)}</p>
      <button data-profile="${member.id}">Ver perfil →</button>
    </article>`).join("");
}

function memberDisplayNumber(member) {
  const visibleIndex = members.filter(item => !item.hidden).findIndex(item => item.id === member.id);
  return visibleIndex >= 0 ? visibleIndex + 1 : member.id;
}

function renderProfile(memberId) {
  const member = getMember(memberId)
    || (Number(currentUser?.id) === Number(memberId) ? currentUser : null);
  if (!member) return;
  activeProfileId = member.id;
  const isOwnProfile = currentUser?.id === member.id;
  const canEdit = isOwnProfile && !member.hidden;
  const canManageProfile = !member.hidden && (canEdit || isSuperAdmin());
  const canDeletePosts = canEdit || isSuperAdmin();
  const posts = profilePosts.filter(post => post.member === member.id);
  const memberMoments = moments.filter(moment => moment.member === member.id);
  document.querySelector("#perfil .back-button").hidden = isOwnProfile;
  document.getElementById("profileContent").innerHTML = `
    <article class="profile-hero">
      <div class="profile-visual ${member.avatarUrl ? "has-photo" : ""}"
        style="--profile-bg:${member.avatarUrl ? `url('${escapeHtml(member.avatarUrl)}')` : member.bg}"></div>
      <div class="profile-info">
        <span class="profile-number">${member.hidden ? "ADMINISTRACIÓN" : `BIG BOY ${String(memberDisplayNumber(member)).padStart(2, "0")}`}</span>
        <h2>${member.countryFlag ? `<span class="profile-country-flag" title="País">${escapeHtml(member.countryFlag)}</span>` : ""}${escapeHtml(member.name)}</h2>
        <div class="profile-nickname">${escapeHtml(member.nickname.toUpperCase())}</div>
        <p>${escapeHtml(member.bio)}</p>
        <div class="profile-tags">${member.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="profile-actions">
          ${canManageProfile ? `<button class="primary-button edit-profile-button" id="editProfileButton">${canEdit ? "Editar mi perfil" : "Editar perfil"}</button>` : ""}
          ${!canEdit ? `<button class="secondary-button edit-profile-button" data-private-member="${member.id}">✉ Enviar mensaje</button>` : ""}
        </div>
      </div>
    </article>
    <section class="profile-stories">
      <div class="profile-feed-heading">
        <div><span class="eyebrow">HISTORIAS ACTIVAS</span><h3>${memberMoments.length} ${memberMoments.length === 1 ? "historia" : "historias"}</h3></div>
        ${canEdit ? `<button class="secondary-button" id="addProfileMomentButton" type="button">＋ Nueva historia</button>` : ""}
      </div>
      <div class="profile-stories-strip">
        ${memberMoments.length ? memberMoments.map(moment => `
          <button class="profile-story-tile" type="button" data-open-moment="${moment.id}" aria-label="Abrir historia">
            <span class="profile-story-media">${moment.mediaType === "video"
              ? `<video src="${escapeHtml(moment.mediaUrl)}" muted playsinline preload="metadata"></video>`
              : `<img src="${escapeHtml(moment.mediaUrl)}" alt="" loading="lazy" decoding="async">`}</span>
            <small>${formatRelativeTime(moment.createdAt)}</small>
          </button>`).join("") : `<div class="empty-state compact profile-stories-empty"><strong>Sin historias activas</strong><span>${canEdit ? "Comparte una historia desde tu perfil." : `${escapeHtml(member.name)} no tiene historias activas.`}</span></div>`}
      </div>
    </section>
    <section class="profile-feed">
      <div class="profile-feed-heading">
        <div><span class="eyebrow">PUBLICACIONES</span><h3>${posts.length} ${posts.length === 1 ? "publicación" : "publicaciones"}</h3></div>
        ${canEdit ? `<button class="primary-button" id="addProfilePostButton" type="button">＋ Nueva publicación</button>` : ""}
      </div>
      <div class="profile-posts-grid">
        ${posts.length ? posts.map(post => renderMediaCard(post, canDeletePosts, "post")).join("") :
          `<div class="empty-state profile-empty"><strong>Aún no hay publicaciones</strong><span>${canEdit ? "Comparte tu primera foto para empezar tu perfil." : `${escapeHtml(member.name)} todavía no ha publicado fotos.`}</span></div>`}
      </div>
    </section>`;
  document.getElementById("editProfileButton")?.addEventListener("click", () => openProfileEditor(member.id));
  document.getElementById("addProfileMomentButton")?.addEventListener("click", () => openStoryCamera("moment"));
  document.getElementById("addProfilePostButton")?.addEventListener("click", () => openStoryCamera("post"));
  goTo("perfil");
}

function spotifyEmbedUrl(value = "") {
  const match = value.trim().match(/(?:open\.spotify\.com\/playlist\/|spotify:playlist:)([A-Za-z0-9]+)/);
  return match ? `https://open.spotify.com/embed/playlist/${match[1]}?utm_source=generator&theme=0` : "";
}

function renderSpotify() {
  const url = siteSettings.spotify_playlist || "";
  const embed = spotifyEmbedUrl(url);
  const player = document.getElementById("spotifyPlayer");
  if (embed) {
    player.innerHTML = `<iframe src="${escapeHtml(embed)}" title="Playlist de The Big Boy Rules en Spotify" width="100%" height="352" frameborder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
    document.getElementById("editSpotifyButton").textContent = "Cambiar playlist";
  } else {
    player.innerHTML = `<div class="empty-state"><strong>Todavía no hay una playlist vinculada</strong><span>La administración puede añadir un enlace público de Spotify.</span></div>`;
    document.getElementById("editSpotifyButton").textContent = "Vincular playlist";
  }
}

function renderMediaCard(item, canDelete, kind, cardIndex = 0) {
  const member = getMember(item.member);
  const likes = getMediaLikes(kind, item.id);
  const liked = Boolean(currentAuthUser && likes.some(like => like.userId === currentAuthUser.id));
  const media = item.mediaType === "video"
    ? `<video src="${escapeHtml(item.mediaUrl)}" controls preload="metadata"></video>`
    : kind === "moment"
      ? `<button class="media-view-button" type="button" data-view-media="${escapeHtml(item.mediaUrl)}" data-view-caption="${escapeHtml(item.caption || `Momento de ${member?.name || "miembro"}`)}"><img src="${escapeHtml(item.mediaUrl)}" alt="${escapeHtml(item.caption || `Momento de ${member?.name || "miembro"}`)}" loading="lazy" decoding="async"><span>Ver momento</span></button>`
      : `<button class="media-view-button" type="button" data-open-content-kind="post" data-open-content-id="${item.id}" aria-label="Abrir publicación"><img src="${escapeHtml(item.mediaUrl)}" alt="${escapeHtml(item.caption || `Publicación de ${member?.name || "miembro"}`)}" loading="lazy" decoding="async"></button>`;
  return `<article class="${kind === "moment" ? "story-card" : "profile-post-card"}" data-media-card-kind="${kind}" data-media-card-id="${item.id}"${kind === "moment" ? ` style="--story-index:${cardIndex}"` : ""}>
    ${canDelete && kind === "moment" ? `<button class="delete-media-button moment-delete-button" data-delete-moment="${item.id}" type="button" title="Eliminar este momento" aria-label="Eliminar este momento">× <span>Eliminar</span></button>` : ""}
    ${kind === "moment" ? `<div class="story-progress" aria-hidden="true"><span></span></div>` : ""}
    <div class="media-frame">${media}</div>
    <div class="media-card-info">
      <button class="media-author" data-profile="${item.member}">${getAvatar(member, "avatar tiny")}<strong>${escapeHtml(member?.name || "Miembro")}</strong></button>
      ${item.caption ? `<p>${escapeHtml(item.caption)}</p>` : ""}
      ${item.mentionedUserId ? `<button class="media-mention" type="button" data-profile="${getMemberByAuthId(item.mentionedUserId)?.id || ""}">@${escapeHtml(getMemberByAuthId(item.mentionedUserId)?.username || "miembro")}</button>` : ""}
      <time datetime="${escapeHtml(item.createdAt)}">${kind === "moment" ? `Caduca ${formatExpiry(item.expiresAt)}` : formatRelativeTime(item.createdAt)}</time>
      <button class="media-like-button ${liked ? "liked" : ""}" type="button" data-like-media="${item.id}" data-like-kind="${kind}" aria-pressed="${liked}" aria-label="${liked ? "Quitar Me gusta" : "Dar Me gusta"}">
        <span aria-hidden="true">${liked ? "♥" : "♡"}</span>${likes.length ? `<strong>${likes.length}</strong>` : ""}<small>Me gusta</small>
      </button>
      ${!isSuperAdmin() ? `<button class="media-share-button" type="button" data-share-media="${item.id}" data-share-kind="${kind}" aria-label="Compartir en un chat"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></svg><small>Compartir</small></button>` : ""}
      ${!isSuperAdmin() ? `<button class="media-reply-button" type="button" data-reply-media="${item.id}" data-reply-kind="${kind}" aria-label="Responder"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.7 9.7 0 0 1-4-.9L3 21l1.7-4.6A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 12h8M8 8.5h5"/></svg><small>Responder</small></button>` : ""}
      ${kind === "moment" && isMediaOwner(item) ? `<button class="media-views-button" type="button" data-moment-viewers="${item.id}">Visualizaciones</button>` : ""}
      ${canDelete && kind !== "moment" ? `<button class="delete-media-button" data-delete-${kind}="${item.id}" type="button" title="Eliminar esta publicación">Eliminar</button>` : ""}
    </div>
  </article>`;
}

function renderMessages() {
  const container = document.getElementById("messages");
  if (!backendReady) {
    container.innerHTML = `<div class="empty-state"><strong>Chat real pendiente de conexión</strong><span>Configura Supabase para compartir mensajes entre todos. No mostramos conversaciones ficticias.</span></div>`;
    setChatEnabled(false);
    return;
  }
  setChatEnabled(Boolean(currentUser) && !isSuperAdmin());
  const channelMessages = messages.filter(message => String(message.channelId || "") === String(activeChatChannelId || ""));
  if (!channelMessages.length) {
    container.innerHTML = `<div class="empty-state"><strong>Aún no hay mensajes</strong><span>Sé la primera persona en escribir al grupo.</span></div>`;
    return;
  }
  container.innerHTML = channelMessages.map(message => {
    const member = getMember(message.member);
    const attachment = message.attachmentUrl ? renderMessageAttachment(message) : "";
    const own = message.userId === currentAuthUser?.id;
    const canDelete = own || canManageSite();
    return `<div class="message ${own ? "own own-message" : ""}">
      ${own ? "" : getAvatar(member)}
      <div class="message-bubble" data-message-bubble>
        ${own ? "" : `<div class="message-head">
          <button class="message-author" data-profile="${message.member}">${escapeHtml(member?.name || "Miembro")}</button>
          <time datetime="${escapeHtml(message.createdAt)}">${formatMessageDate(message.createdAt)}</time>
        </div>`}
        ${message.text ? `<p>${escapeHtml(message.text)}</p>` : ""}${attachment}
        ${(own && message.text) || canDelete ? `<div class="message-actions">
          ${own && message.text ? `<button type="button" data-edit-group-message="${message.id}">Editar</button>` : ""}
          ${canDelete ? `<button type="button" class="danger" data-delete-group-message="${message.id}">Eliminar</button>` : ""}
        </div>` : ""}
      </div>
    </div>`;
  }).join("");
  container.scrollTop = container.scrollHeight;
  renderPrivateContacts();
}

function renderChatChannels() {
  const container = document.getElementById("chatChannels");
  if (!container) return;
  if (!chatChannels.length) {
    container.innerHTML = `<span class="channel-empty">Sin secciones</span>`;
    return;
  }
  if (!chatChannels.some(channel => String(channel.id) === String(activeChatChannelId))) {
    activeChatChannelId = chatChannels[0].id;
  }
  const active = chatChannels.find(channel => String(channel.id) === String(activeChatChannelId));
  document.getElementById("activeChannelName").textContent = `# ${active?.name || "general"}`;
  container.innerHTML = chatChannels.map(channel => `
    <button class="chat-channel ${String(channel.id) === String(activeChatChannelId) ? "active" : ""}" type="button" data-chat-channel="${channel.id}">
      <span>#</span>${escapeHtml(channel.name)}
      ${canManageSite() && !channel.isDefault ? `<i data-delete-channel="${channel.id}" title="Eliminar sección">×</i>` : ""}
    </button>`).join("");
}

function selectChatChannel(id) {
  if (!chatChannels.some(channel => String(channel.id) === String(id))) return;
  activeChatChannelId = id;
  renderChatChannels();
  renderMessages();
  renderPrivateContacts();
}

function setChatEnabled(enabled) {
  const input = document.getElementById("messageInput");
  const button = document.querySelector(".message-form .send-button");
  const attach = document.getElementById("attachMessageButton");
  const media = document.getElementById("attachMessageMediaButton");
  const camera = document.getElementById("captureMessageCameraButton");
  const audio = document.getElementById("recordGroupAudioButton");
  input.disabled = !enabled;
  button.disabled = !enabled;
  attach.disabled = !enabled;
  media.disabled = !enabled;
  camera.disabled = !enabled;
  audio.disabled = !enabled;
  input.placeholder = enabled ? "Mensaje..." : "El chat necesita conexión";
}

function renderPresence() {
  const count = onlineUsers.length;
  const label = count === 1 ? "1 conectado" : `${count} conectados`;
  document.getElementById("chatOnlineStatus").innerHTML = `<i></i> ${label}`;
  document.getElementById("chatInboxOnlineStatus").innerHTML = `<i></i> ${label}`;
  document.getElementById("heroOnlineStatus").innerHTML = `<i></i> ${count ? `${label} ahora` : "Nadie conectado"}`;
  const panel = document.getElementById("onlineMembers");
  if (!panel) return;
  if (!count) {
    panel.innerHTML = `<div class="empty-state compact">Nadie conectado ahora.</div>`;
    return;
  }
  panel.innerHTML = onlineUsers.map(user => {
    const member = getMember(user.legacy_id);
    return `<div class="online-member">
      ${getAvatar(member)}
      <div><strong>${escapeHtml(member?.name || user.name || "Miembro")}</strong><small>En línea ahora</small></div><i></i>
    </div>`;
  }).join("");
}

function renderMessageAttachment(message) {
  if (message.attachmentType === "text/news-link") {
    return `<a class="message-news-link" href="${escapeHtml(message.attachmentUrl)}" target="_blank" rel="noopener noreferrer"><span>NOTICIA</span><strong>${escapeHtml(message.attachmentName || "Abrir noticia")}</strong><small>Leer en la fuente →</small></a>`;
  }
  const sharedMedia = getSharedMediaReference(message);
  if (message.attachmentType?.startsWith("image/")) {
    if (sharedMedia) {
      return `<button class="message-image shared-message-media" type="button" data-open-shared-kind="${sharedMedia.kind}" data-open-shared-id="${sharedMedia.id}" aria-label="Abrir ${sharedMedia.kind === "moment" ? "momento" : "publicación"} original"><img src="${escapeHtml(message.attachmentUrl)}" alt="${sharedMedia.kind === "moment" ? "Momento compartido" : "Publicación compartida"}" loading="lazy"><span>Ver original →</span></button>`;
    }
    return `<a class="message-image" href="${escapeHtml(message.attachmentUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(message.attachmentUrl)}" alt="${escapeHtml(message.attachmentName || "Imagen adjunta")}" loading="lazy"></a>`;
  }
  if (message.attachmentType?.startsWith("video/")) {
    if (sharedMedia) {
      return `<button class="shared-message-media shared-message-video" type="button" data-open-shared-kind="${sharedMedia.kind}" data-open-shared-id="${sharedMedia.id}" aria-label="Abrir ${sharedMedia.kind === "moment" ? "momento" : "publicación"} original"><video src="${escapeHtml(message.attachmentUrl)}" muted playsinline preload="metadata"></video><span>Ver original →</span></button>`;
    }
    return `<video class="message-video" src="${escapeHtml(message.attachmentUrl)}" controls preload="metadata"></video>`;
  }
  if (message.attachmentType?.startsWith("audio/")) {
    return renderVoiceNote(message.attachmentUrl);
  }
  return `<a class="message-file" href="${escapeHtml(message.attachmentUrl)}" target="_blank" rel="noopener" download>
    <span>↧</span><div><strong>${escapeHtml(message.attachmentName || "Archivo adjunto")}</strong><small>${formatFileSize(message.attachmentSize)}</small></div>
  </a>`;
}

function voiceWaveformBars() {
  const heights = [8, 13, 19, 11, 25, 16, 29, 20, 12, 24, 34, 18, 27, 15, 31, 21, 12, 25, 17, 10, 22, 14, 9, 18];
  return heights.map(height => `<i style="--bar-height:${height}px"></i>`).join("");
}

function renderVoiceNote(url) {
  const bars = voiceWaveformBars();
  return `<div class="voice-note" data-voice-note style="--voice-progress:0%">
    <button class="voice-note-toggle" type="button" data-voice-toggle aria-label="Reproducir nota de voz">
      <svg class="voice-play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 9 5-9 5Z"/></svg>
      <svg class="voice-pause-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7v10M15 7v10"/></svg>
    </button>
    <div class="voice-note-main">
      <div class="voice-waveform-shell">
        <span class="voice-waveform voice-waveform-base" aria-hidden="true">${bars}</span>
        <span class="voice-waveform voice-waveform-progress" aria-hidden="true">${bars}</span>
        <input class="voice-note-seek" data-voice-seek type="range" min="0" max="0" value="0" step="0.01" aria-label="Posición de la nota de voz">
      </div>
      <div class="voice-note-time"><span data-voice-elapsed>0:00</span><span data-voice-duration>--:--</span></div>
    </div>
    <span class="voice-note-info" aria-hidden="true">i</span>
    <audio src="${escapeHtml(url)}" preload="metadata"></audio>
  </div>`;
}

function syncVoiceNotePlayer(audio) {
  const player = audio.closest("[data-voice-note]");
  if (!player) return;
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const elapsed = Math.min(audio.currentTime || 0, duration || audio.currentTime || 0);
  const seek = player.querySelector("[data-voice-seek]");
  seek.max = String(duration || 0);
  seek.value = String(elapsed);
  player.querySelector("[data-voice-elapsed]").textContent = formatAudioClock(elapsed);
  player.querySelector("[data-voice-duration]").textContent = formatAudioClock(duration);
  player.style.setProperty("--voice-progress", `${duration ? (elapsed / duration) * 100 : 0}%`);
  player.classList.toggle("is-playing", !audio.paused && !audio.ended);
  player.querySelector("[data-voice-toggle]").setAttribute("aria-label", audio.paused ? "Reproducir nota de voz" : "Pausar nota de voz");
}

function toggleVoiceNote(button) {
  const audio = button.closest("[data-voice-note]")?.querySelector("audio");
  if (!audio) return;
  if (audio.paused) {
    document.querySelectorAll("[data-voice-note] audio").forEach(other => {
      if (other !== audio) other.pause();
    });
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
  syncVoiceNotePlayer(audio);
}

function getSharedMediaReference(message) {
  const encoded = String(message.attachmentName || "").match(/^bb-share:(moment|post):(.+)$/);
  if (encoded) return {kind: encoded[1], id: encoded[2]};
  const moment = moments.find(item => item.mediaUrl === message.attachmentUrl);
  if (moment) return {kind: "moment", id: String(moment.id)};
  const post = profilePosts.find(item => item.mediaUrl === message.attachmentUrl);
  return post ? {kind: "post", id: String(post.id)} : null;
}

function openSharedMedia(kind, id) {
  const collection = kind === "moment" ? moments : profilePosts;
  const item = collection.find(media => String(media.id) === String(id));
  if (!item) {
    window.alert(kind === "moment" ? "Este momento ya no está disponible." : "Esta publicación ya no está disponible.");
    return;
  }
  goTo("contenido");
  selectContentTab(kind === "moment" ? "momentos" : "publicaciones");
  requestAnimationFrame(() => {
    const card = [...document.querySelectorAll("[data-media-card-kind][data-media-card-id]")]
      .find(node => node.dataset.mediaCardKind === kind && String(node.dataset.mediaCardId) === String(id));
    if (!card) return;
    card.classList.add("shared-media-highlight");
    card.scrollIntoView({behavior: "smooth", block: "center", inline: "center"});
    window.setTimeout(() => card.classList.remove("shared-media-highlight"), 2200);
  });
}

function renderMoments() {
  const grid = document.getElementById("momentsGrid");
  const status = document.getElementById("momentsStatus");
  status.textContent = moments.length ? `${moments.length} ${moments.length === 1 ? "historia activa" : "historias activas"}` : "";
  if (!moments.length) {
    grid.innerHTML = `<div class="stories-empty"><strong>Sin momentos</strong><span>Sube el primero.</span></div>`;
    return;
  }
  const groups = new Map();
  moments.forEach(item => {
    const key = storyOwnerKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  grid.innerHTML = [...groups.values()].map((items, index) => {
    items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const firstUnseen = items.find(item => !hasViewedMoment(item.id));
    const openingItem = firstUnseen || items[0];
    const member = getMember(openingItem.member);
    const hasUnseen = Boolean(firstUnseen);
    return `<div class="story-bubble-item" data-media-card-kind="moment" data-media-card-id="${openingItem.id}" style="--story-index:${index}">
      <button class="story-bubble" type="button" data-open-moment="${openingItem.id}" aria-label="Ver ${items.length} ${items.length === 1 ? "historia" : "historias"} de ${escapeHtml(member?.name || "miembro")}">
        <span class="story-avatar-ring ${hasUnseen ? "unseen" : "seen"}">${getAvatar(member)}</span><strong>${escapeHtml(member?.name || "Miembro")}</strong>
        ${items.length > 1 ? `<small class="story-count">${items.length}</small>` : ""}
      </button>
    </div>`;
  }).join("");
  grid.querySelectorAll("[data-open-moment]").forEach(button => {
    let press = null;
    let ignoreClick = false;
    button.addEventListener("pointerdown", event => {
      press = {x: event.clientX, y: event.clientY, at: Date.now()};
    });
    button.addEventListener("pointerup", event => {
      if (!press) return;
      const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      ignoreClick = Date.now() - press.at >= 300 || moved > 14;
      press = null;
    });
    button.addEventListener("pointercancel", () => {
      press = null;
      ignoreClick = true;
    });
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (ignoreClick) {
        ignoreClick = false;
        return;
      }
      openMoment(button.dataset.openMoment);
    });
  });
}

function renderPublications() {
  const feed = document.getElementById("publicationsFeed");
  if (!feed) return;
  if (!profilePosts.length) {
    feed.innerHTML = `<div class="empty-state publications-empty"><strong>Todavía no hay publicaciones</strong><span>Comparte una foto desde aquí o desde tu perfil.</span></div>`;
    return;
  }
  feed.innerHTML = profilePosts.map(item => renderMediaCard(
    item,
    isMediaOwner(item) || isSuperAdmin(),
    "post"
  )).join("");
}

function renderPrivateContacts() {
  const panel = document.getElementById("privateContacts");
  if (!panel || !currentUser) return;
  const latestGroupMessage = messages.at(-1);
  const latestGroupChannel = latestGroupMessage
    ? chatChannels.find(channel => String(channel.id) === String(latestGroupMessage.channelId))
    : null;
  const groupPreview = latestGroupMessage
    ? messagePreviewText(latestGroupMessage.text, latestGroupMessage.attachmentType)
    : "Empieza la conversación del grupo";
  const contacts = members.filter(member => member.id !== currentUser.id).map(member => {
    const conversation = privateMessages.filter(message =>
      [message.senderId, message.recipientId].includes(member.authId));
    const latest = conversation.at(-1);
    return {member, latest};
  }).sort((a, b) => {
    const aTime = a.latest ? new Date(a.latest.createdAt).getTime() : 0;
    const bTime = b.latest ? new Date(b.latest.createdAt).getTime() : 0;
    return bTime - aTime || a.member.name.localeCompare(b.member.name, "es");
  });
  const groupContact = `<button class="private-contact group-chat-contact ${document.getElementById("chat")?.classList.contains("conversation-open") ? "active" : ""}" type="button" data-open-group-chat>
    <span class="chat-group-avatar" aria-hidden="true"><b>BB</b><i></i></span>
    <span class="private-contact-copy"><span><strong>The Big Boy Rules</strong>${latestGroupMessage ? `<time datetime="${escapeHtml(latestGroupMessage.createdAt)}">${formatRelativeTime(latestGroupMessage.createdAt)}</time>` : ""}</span><small>${latestGroupChannel ? `#${escapeHtml(latestGroupChannel.name)} · ` : ""}${escapeHtml(groupPreview)}</small></span>
    <span class="chat-row-chevron" aria-hidden="true">›</span>
  </button>`;
  const privateContactsMarkup = contacts.map(({member, latest}) =>
    `<button class="private-contact ${activePrivateMemberId === member.id ? "active" : ""}" data-private-member="${member.id}">
      ${getAvatar(member)}
      <span class="private-contact-copy"><span><strong>${escapeHtml(member.name)}</strong>${latest ? `<time datetime="${escapeHtml(latest.createdAt)}">${formatRelativeTime(latest.createdAt)}</time>` : ""}</span><small>${latest ? escapeHtml(messagePreviewText(latest.body, latest.attachmentType)) : "Iniciar conversación"}</small></span>
      <span class="chat-row-chevron" aria-hidden="true">›</span>
    </button>`).join("");
  panel.innerHTML = `${groupContact}<div class="chat-list-divider"><span>Mensajes privados</span></div>${privateContactsMarkup}`;
}

function messagePreviewText(body, attachmentType) {
  if (body?.trim()) return body.trim();
  if (attachmentType?.startsWith("audio/")) return "Nota de voz";
  if (attachmentType?.startsWith("image/")) return "Foto";
  if (attachmentType?.startsWith("video/")) return "Vídeo";
  return attachmentType ? "Archivo adjunto" : "Mensaje";
}

function openPrivateConversation(memberId) {
  const member = getMember(memberId);
  if (!member || member.id === currentUser?.id) return;
  activePrivateMemberId = member.id;
  renderPrivateContacts();
  renderPrivateConversation();
  goTo("privados");
}

function renderPrivateConversation() {
  const member = getMember(activePrivateMemberId);
  const container = document.getElementById("privateMessages");
  const input = document.getElementById("privateMessageInput");
  const submit = document.querySelector("#privateMessageForm .send-button");
  const attach = document.getElementById("attachPrivateMessageButton");
  const media = document.getElementById("attachPrivateMessageMediaButton");
  const camera = document.getElementById("capturePrivateMessageCameraButton");
  const audio = document.getElementById("recordPrivateAudioButton");
  document.getElementById("privados").classList.toggle("conversation-open", Boolean(member));
  if (!member) {
    const emptyPrivateHeader = document.getElementById("privateChatHeader");
    emptyPrivateHeader.innerHTML = `<div><span class="eyebrow">MENSAJE DIRECTO</span><h3>Elige un miembro</h3></div>`;
    container.innerHTML = `<div class="empty-state">Selecciona un miembro para comenzar una conversación privada.</div>`;
    input.disabled = true;
    submit.disabled = true;
    attach.disabled = true;
    media.disabled = true;
    camera.disabled = true;
    audio.disabled = true;
    return;
  }
  const privateHeader = document.getElementById("privateChatHeader");
  privateHeader.innerHTML = `
    <div class="private-chat-person">
      <button class="chat-back-button private-conversation-back" type="button" data-private-back aria-label="Volver a conversaciones">←</button>
      <div class="private-chat-avatar">
        ${getAvatar(member)}
      </div>
      <div><h3>${escapeHtml(member.name)}</h3><span class="chat-username">@${escapeHtml(member.username)}</span></div>
    </div>
    <button class="text-button" data-profile="${member.id}">Perfil</button>`;
  const items = privateMessages.filter(message =>
    (message.senderId === currentAuthUser?.id && message.recipientId === member.authId)
    || (message.senderId === member.authId && message.recipientId === currentAuthUser?.id));
  container.innerHTML = items.length ? items.map(message => {
    const sender = getMemberByAuthId(message.senderId);
    const own = message.senderId === currentAuthUser?.id;
    return `<div class="message private-message ${own ? "own own-message" : ""}">
      ${own ? "" : getAvatar(sender)}
      <div class="message-bubble" data-message-bubble>
        ${own ? "" : `<div class="message-head"><strong>${escapeHtml(sender?.name || "Miembro")}</strong><time>${formatMessageDate(message.createdAt)}</time></div>`}
        ${message.body ? `<p>${escapeHtml(message.body)}</p>` : ""}
        ${message.attachmentUrl ? renderMessageAttachment(message) : ""}
        ${own ? `<div class="message-actions">
          <button type="button" data-edit-private-message="${message.id}">Editar</button>
          <button type="button" class="danger" data-delete-private-message="${message.id}">Eliminar</button>
        </div>` : ""}
      </div>
    </div>`;
  }).join("") : `<div class="empty-state"><strong>Sin mensajes todavía</strong><span>Esta conversación es privada entre ${escapeHtml(currentUser.name)} y ${escapeHtml(member.name)}.</span></div>`;
  input.disabled = false;
  submit.disabled = false;
  attach.disabled = false;
  media.disabled = false;
  camera.disabled = false;
  audio.disabled = false;
  container.scrollTop = container.scrollHeight;
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  document.getElementById("calendarMonthTitle").textContent = calendarDate.toLocaleDateString("es-ES", {month: "long", year: "numeric"});
  const ownBirthday = groupEvents.find(event => event.eventType === "birthday" && event.createdBy === currentAuthUser?.id);
  const birthdayButton = document.getElementById("addBirthdayButton");
  birthdayButton.dataset.birthdayEventId = ownBirthday?.id || "";
  birthdayButton.textContent = ownBirthday ? "🎂 Editar mi cumpleaños" : "🎂 Añadir mi cumpleaños";
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(new Date());
  let cells = ["L", "M", "X", "J", "V", "S", "D"].map(day => `<div class="calendar-weekday">${day}</div>`).join("");
  cells += Array.from({length: firstWeekday}, () => `<div class="calendar-day outside" aria-hidden="true"></div>`).join("");
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(year, month, day);
    const events = groupEvents.filter(event => eventOccursOn(event, date));
    const calendarKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells += `<button class="calendar-day ${dateKey(date) === todayKey ? "today" : ""}" type="button" data-calendar-date="${calendarKey}" aria-label="Ver ${day} de ${calendarDate.toLocaleDateString("es-ES", {month: "long"})}">
      <span>${day}</span>${events.slice(0, 3).map(event => `<i class="calendar-event-pill ${event.eventType === "birthday" ? "birthday" : ""}" title="${escapeHtml(event.title)}">${event.eventType === "birthday" ? "🎂 " : ""}${escapeHtml(event.title)}</i>`).join("")}
      ${events.length > 3 ? `<small>+${events.length - 3} más</small>` : ""}
    </button>`;
  }
  document.getElementById("calendarGrid").innerHTML = cells;
  const monthEvents = groupEvents.filter(event => {
    const date = new Date(event.startsAt);
    return date.getMonth() === month && (event.eventType === "birthday" || date.getFullYear() === year);
  }).sort((a, b) => new Date(a.startsAt).getDate() - new Date(b.startsAt).getDate());
  document.getElementById("calendarEventList").innerHTML = monthEvents.length ? monthEvents.map(event => `
    <article class="calendar-event-card">
      <time>${event.eventType === "birthday" ? `🎂 ${new Date(event.startsAt).toLocaleDateString("es-ES", {day: "numeric", month: "long"})}` : formatEventDate(event.startsAt)}</time><h4>${escapeHtml(event.title)}</h4>
      ${event.location ? `<p>⌖ ${escapeHtml(event.location)}</p>` : ""}
      ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
      ${canEditCalendarEvent(event) ? `<button class="text-button" data-event-id="${event.id}">Editar</button>` : ""}
    </article>`).join("") : `<div class="empty-state compact">No hay eventos este mes.</div>`;
}

function openCalendarDay(dateValue) {
  const [year, month, day] = String(dateValue).split("-").map(Number);
  if (!year || !month || !day) return;
  const selectedDate = new Date(year, month - 1, day);
  const events = groupEvents.filter(event => eventOccursOn(event, selectedDate));
  document.getElementById("calendarDayTitle").textContent = selectedDate.toLocaleDateString("es-ES", {weekday: "long", day: "numeric", month: "long", year: "numeric"});
  document.getElementById("calendarDayDetailList").innerHTML = events.length ? events.map(event => `
    <article class="calendar-day-detail-card ${event.eventType === "birthday" ? "birthday" : ""}">
      <div class="calendar-day-detail-time">${event.eventType === "birthday" ? "🎂 Todo el día" : formatEventDate(event.startsAt)}</div>
      <h3>${escapeHtml(event.title)}</h3>
      ${event.eventType !== "birthday" && event.endsAt ? `<p class="calendar-day-detail-duration">Hasta ${new Date(event.endsAt).toLocaleString("es-ES", {hour: "2-digit", minute: "2-digit"})}</p>` : ""}
      ${event.location ? `<p>⌖ ${escapeHtml(event.location)}</p>` : ""}
      ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
      ${canEditCalendarEvent(event) ? `<button class="secondary-button" type="button" data-event-id="${event.id}">Editar</button>` : ""}
    </article>`).join("") : `<div class="empty-state compact"><strong>No hay nada programado</strong><span>Este día no tiene eventos ni cumpleaños.</span></div>`;
  const modal = document.getElementById("calendarDayModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeCalendarDayModal() {
  const modal = document.getElementById("calendarDayModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function eventOccursOn(event, date) {
  const starts = new Date(event.startsAt);
  if (event.eventType === "birthday") {
    return starts.getMonth() === date.getMonth() && starts.getDate() === date.getDate();
  }
  return dateKey(starts) === dateKey(date);
}

function canEditCalendarEvent(event) {
  return Boolean(event && (canManageSite() || event.eventType === "birthday" && event.createdBy === currentAuthUser?.id));
}

function dateKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatEventDate(value) {
  return new Date(value).toLocaleString("es-ES", {weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});
}

function performSearch(query) {
  const term = normalizeUsername(query);
  const results = [];
  if (!term) {
    document.getElementById("searchResults").innerHTML = `<div class="empty-state compact">Empieza a escribir para buscar en el club.</div>`;
    return;
  }
  members.filter(member => normalizeUsername(`${member.name} ${member.username} ${member.nickname} ${member.bio} ${member.tags.join(" ")}`).includes(term))
    .forEach(member => results.push({type: "Miembro", title: member.name, detail: member.nickname, profile: member.id}));
  messages.filter(message => normalizeUsername(message.text).includes(term)).slice(-6).forEach(message => {
    const member = getMember(message.member);
    results.push({type: "Chat", title: message.text, detail: member?.name || "Miembro", section: "chat"});
  });
  profilePosts.filter(post => normalizeUsername(post.caption).includes(term)).slice(0, 6).forEach(post => {
    results.push({type: "Publicación", title: post.caption || "Foto", detail: getMember(post.member)?.name || "", section: "publicaciones"});
  });
  groupEvents.filter(event => normalizeUsername(`${event.title} ${event.description} ${event.location}`).includes(term)).forEach(event => {
    results.push({type: "Evento", title: event.title, detail: formatEventDate(event.startsAt), section: "buscar"});
  });
  newsItems.filter(item => normalizeUsername(`${item.title} ${item.source}`).includes(term)).slice(0, 6).forEach(item => {
    results.push({type: "Noticia", title: item.title, detail: item.source, url: item.link});
  });
  document.getElementById("searchResults").innerHTML = results.length ? results.slice(0, 20).map(result => {
    const content = `<span>${result.type}</span><strong>${escapeHtml(result.title)}</strong><small>${escapeHtml(result.detail)}</small><b aria-hidden="true">→</b>`;
    if (result.url) {
      return `<a class="search-result" href="${escapeHtml(result.url)}" target="_blank" rel="noopener noreferrer" data-search-url>${content}</a>`;
    }
    return `<button type="button" class="search-result" ${result.profile ? `data-profile="${result.profile}"` : `data-search-section="${result.section}"`}>${content}</button>`;
  }).join("") : `<div class="empty-state compact">No hay resultados para “${escapeHtml(query)}”.</div>`;
}

function renderAdminPanel() {
  const summary = document.getElementById("adminSummary");
  const table = document.getElementById("adminUsersTable");
  const tools = document.getElementById("superAdminTools");
  tools?.classList.toggle("visible", isSuperAdmin());
  if (!summary || !table) return;
  if (!canManageSite()) {
    summary.innerHTML = "";
    table.innerHTML = "";
    return;
  }
  summary.innerHTML = `
    <div class="admin-stat-card"><span>USUARIOS</span><strong>${members.length}</strong><small>cuentas registradas</small></div>
    <div class="admin-stat-card"><span>ADMINISTRADORES</span><strong>${members.filter(item => item.roleKey === "admin").length}</strong><small>visibles en el club</small></div>
    <div class="admin-stat-card"><span>EN LÍNEA</span><strong>${onlineUsers.length}</strong><small>presencia real ahora</small></div>`;
  table.innerHTML = members.map(user => `
    <tr><td><code>@${user.username}</code></td><td><div class="table-user">${getAvatar(user, "avatar small")}<strong>${escapeHtml(user.name)}</strong></div></td>
    <td><span class="role-chip ${user.roleKey}">${user.roleKey === "admin" ? "Administrador" : "Miembro"}</span></td>
    <td><span class="account-status ${onlineUsers.some(item => Number(item.legacy_id) === user.id) ? "" : "offline"}"><i></i>${onlineUsers.some(item => Number(item.legacy_id) === user.id) ? "En línea" : "Desconectado"}</span></td>
    <td>—</td><td><div class="admin-user-actions">
      <button class="text-button" type="button" data-profile="${user.id}">Ver perfil</button>
      ${user.id !== currentUser?.id ? `<button class="text-button" type="button" data-admin-message="${user.id}">Mensaje</button>` : ""}
      ${canManageSite() && (isSuperAdmin() || user.id !== currentUser?.id) ? `<button class="text-button" type="button" data-edit-user="${user.id}">Editar perfil</button>` : ""}
      ${canManageSite() && user.authId && user.id !== currentUser?.id ? `<button class="text-button" type="button" data-reset-password="${user.authId}" data-reset-password-name="${escapeHtml(user.name)}">Nueva contraseña</button>` : ""}
      ${isSuperAdmin() && user.authId ? `<button class="text-button danger" type="button" data-delete-user="${user.authId}" data-delete-user-name="${escapeHtml(user.name)}">Eliminar</button>` : ""}
    </div></td></tr>`).join("");
}

function refreshProfileSurfaces() {
  renderFeatured();
  renderMembers();
  renderPresence();
  renderMessages();
  renderActivity();
  renderAdminPanel();
  if (currentUser) applyUserHeader(currentUser);
}

function applyUserHeader(user) {
  ["bottomNavAvatar"].forEach(id => {
    const node = document.getElementById(id);
    if (!node) return;
    node.classList.toggle("has-image", Boolean(user.avatarUrl));
    node.innerHTML = user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt="">` : escapeHtml(user.name.charAt(0));
  });
  document.querySelectorAll(".admin-only").forEach(node => node.style.display = canManageSite() ? "" : "none");
}

function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveLocalSession(user, remember) {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  (remember ? localStorage : sessionStorage).setItem(
    remember ? AUTH_STORAGE_KEY : AUTH_SESSION_KEY,
    JSON.stringify({userId: user.id, loginAt: new Date().toISOString()})
  );
}

async function applyUserInterface(user, authUser = null) {
  currentUser = user;
  currentAuthUser = authUser;
  document.body.classList.add("authenticated");
  document.getElementById("loginScreen")?.classList.add("login-hidden");
  applyUserHeader(user);
  refreshProfileSurfaces();
  renderPrivateContacts();
  renderPrivateConversation();
  renderCalendar();
  if (backendReady && authUser) {
    await loadRemoteProfiles();
    await loadChatChannels();
    await Promise.all([loadMessages(), loadMoments(), loadProfilePosts(), loadMediaLikes(), loadNotifications(), loadPrivateMessages(), loadGroupEvents(), loadSiteSettings(), loadHelpCenter()]);
    connectRealtime();
  } else {
    onlineUsers = [{legacy_id: user.id, name: user.name}];
    renderPresence();
    renderAdminPanel();
  }
  if (authUser?.user_metadata?.must_change_password) requirePasswordChange(authUser.id);
  if (passwordChangeIsRequired(authUser?.id || user.id)) openRequiredPasswordChange();
  if (document.getElementById("inicio")?.classList.contains("active")) loadNews(false);
  if (location.hash === "#perfil") renderProfile(currentUser.id);
  window.scrollTo({top: 0, behavior: "auto"});
  syncPushNotificationState();
  if (document.getElementById("privados")?.classList.contains("active") && activePrivateMemberId == null) goTo("chat");
}

function showLogin() {
  closeProfileQuickMenu();
  document.body.classList.remove("authenticated");
  document.getElementById("loginScreen")?.classList.remove("login-hidden");
  onlineUsers = [];
  notifications = [];
  renderPresence();
  renderNotifications();
  closeNotifications();
  goTo("contenido");
}

async function logoutCurrentUser() {
  closeStoryCamera();
  if (activeAudioRecording) activeAudioRecording.cancelled = true;
  if (activeAudioRecording?.recorder.state !== "inactive") activeAudioRecording.recorder.stop();
  clearPendingChatFile("group");
  clearPendingChatFile("private");
  if (db) await db.auth.signOut();
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  currentUser = null;
  currentAuthUser = null;
  messages = [];
  moments = [];
  profilePosts = [];
  mediaLikes = [];
  mediaLikesIndex = new Map();
  notifications = [];
  privateMessages = [];
  groupEvents = [];
  chatChannels = [];
  helpRequests = [];
  helpMessages = [];
  activeHelpRequestId = null;
  activeChatChannelId = null;
  if (db && presenceChannel) db.removeChannel(presenceChannel);
  if (db && messageChannel) db.removeChannel(messageChannel);
  if (db && momentChannel) db.removeChannel(momentChannel);
  if (db && postChannel) db.removeChannel(postChannel);
  if (db && mediaLikesChannel) db.removeChannel(mediaLikesChannel);
  if (db && notificationsChannel) db.removeChannel(notificationsChannel);
  if (db && privateChannel) db.removeChannel(privateChannel);
  if (db && eventChannel) db.removeChannel(eventChannel);
  if (db && settingsChannel) db.removeChannel(settingsChannel);
  if (db && chatChannelsRealtime) db.removeChannel(chatChannelsRealtime);
  if (db && helpRealtime) db.removeChannel(helpRealtime);
  showLogin();
  renderMessages();
  renderNotifications();
}

async function login(username, password, remember) {
  if (!backendReady) {
    const user = members.find(item => normalizeUsername(item.username) === normalizeUsername(username) && item.password === password);
    if (!user) throw new Error("Usuario o contraseña incorrectos.");
    saveLocalSession(user, remember);
    if (password === GENERIC_PASSWORD) requirePasswordChange(user.id);
    await applyUserInterface(user);
    return;
  }
  const email = `${normalizeUsername(username)}@bigboyrules.local`;
  const {data, error} = await db.auth.signInWithPassword({email, password});
  if (error) throw new Error("Usuario o contraseña incorrectos.");
  currentAuthUser = data.user;
  const user = await profileForAuthUser(data.user);
  if (!user) {
    currentAuthUser = null;
    await db.auth.signOut();
    throw new Error("Esta cuenta todavía no tiene un perfil del club.");
  }
  if (password === GENERIC_PASSWORD) requirePasswordChange(data.user.id);
  await applyUserInterface(user, data.user);
}

function passwordChangeStorageKey(userId) {
  return `${PASSWORD_CHANGE_STORAGE_PREFIX}${userId}`;
}

function requirePasswordChange(userId) {
  if (userId != null) localStorage.setItem(passwordChangeStorageKey(userId), "true");
}

function passwordChangeIsRequired(userId) {
  return userId != null && localStorage.getItem(passwordChangeStorageKey(userId)) === "true";
}

function openRequiredPasswordChange() {
  const modal = document.getElementById("requiredPasswordChange");
  const form = document.getElementById("requiredPasswordChangeForm");
  form.reset();
  document.getElementById("requiredPasswordFeedback").textContent = "";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => document.getElementById("requiredNewPassword").focus(), 50);
}

async function saveRequiredPasswordChange(form) {
  const password = document.getElementById("requiredNewPassword").value;
  const confirmation = document.getElementById("requiredNewPasswordConfirmation").value;
  const feedback = document.getElementById("requiredPasswordFeedback");
  const submit = form.querySelector("[type=submit]");
  feedback.textContent = "";
  if (password.length < 8) {
    feedback.textContent = "La nueva contraseña debe tener al menos 8 caracteres.";
    return;
  }
  if (password !== confirmation) {
    feedback.textContent = "Las dos contraseñas no coinciden.";
    return;
  }
  if (password === GENERIC_PASSWORD) {
    feedback.textContent = "Elige una contraseña diferente de la contraseña provisional.";
    return;
  }
  submit.disabled = true;
  feedback.textContent = "Guardando la nueva contraseña…";
  try {
    if (!backendReady || !currentAuthUser) {
      if (!currentUser) throw new Error("La sesión ya no está disponible.");
      currentUser.password = password;
    } else {
      const {error} = await db.auth.updateUser({password, data: {must_change_password: false}});
      if (error) throw error;
    }
    const userId = currentAuthUser?.id || currentUser?.id;
    localStorage.removeItem(passwordChangeStorageKey(userId));
    form.reset();
    document.getElementById("requiredPasswordChange").classList.remove("open");
    document.getElementById("requiredPasswordChange").setAttribute("aria-hidden", "true");
  } catch (error) {
    feedback.textContent = error.message || "No se pudo cambiar la contraseña.";
  } finally {
    submit.disabled = false;
  }
}

async function profileForAuthUser(authUser) {
  const {data, error} = await db.from("profiles").select("*").eq("id", authUser.id).single();
  if (error) return null;
  return mergeRemoteProfile(data, authUser.id);
}

function mergeRemoteProfile(profile, expectedAuthId = currentAuthUser?.id) {
  if (profile.is_hidden) {
    if (profile.id !== expectedAuthId) return null;
    return {
      id: Number(profile.legacy_id), authId: profile.id, username: profile.username,
      name: profile.display_name || "Administración", nickname: "Control total",
      roleKey: profile.role, role: "CONTROL TOTAL", bio: "", tags: [],
      countryFlag: profile.country_flag || "", avatarUrl: "",
      bg: "linear-gradient(145deg, #4a3210, #0c0c0e 68%)", hidden: true
    };
  }
  let member = getMember(profile.legacy_id);
  if (!member) {
    member = {
      id: Number(profile.legacy_id), username: profile.username, password: "",
      name: profile.display_name || profile.username, nickname: profile.nickname || "The Big Boy",
      roleKey: profile.role, role: profile.role === "admin" ? "ADMINISTRADOR" : "MIEMBRO",
      bio: profile.bio || "", tags: Array.isArray(profile.tags) ? profile.tags : [],
      countryFlag: profile.country_flag || "",
      avatarUrl: "", bg: "linear-gradient(145deg, #262018, #0c0c0e 68%)"
    };
    members.push(member);
  }
  Object.assign(member, {
    authId: profile.id,
    roleKey: profile.role,
    role: profile.role === "admin" ? "ADMINISTRADOR" : profile.role === "superadmin" ? "CONTROL TOTAL" : "MIEMBRO",
    name: profile.display_name || member.name,
    nickname: profile.nickname || member.nickname,
    bio: profile.bio || member.bio,
    tags: Array.isArray(profile.tags) ? profile.tags : member.tags,
    countryFlag: profile.country_flag || "",
    avatarUrl: profile.avatar_url || ""
  });
  return member;
}

async function loadRemoteProfiles() {
  const {data, error} = await db.from("profiles").select("*").order("legacy_id");
  if (error) return;
  data.forEach(mergeRemoteProfile);
  if (!currentUser.hidden) currentUser = getMember(currentUser.id);
  refreshProfileSurfaces();
}

async function loadMessages() {
  const {data, error} = await db.from("messages")
    .select("id,user_id,legacy_id,channel_id,body,attachment_url,attachment_name,attachment_type,attachment_size,created_at")
    .order("created_at").limit(200);
  if (error) {
    document.getElementById("messages").innerHTML = `<div class="empty-state"><strong>No se pudo cargar el chat</strong><span>${escapeHtml(error.message)}</span></div>`;
    return;
  }
  messages = data.map(mapMessage);
  renderMessages();
  renderPrivateContacts();
  renderActivity();
}

function mapMessage(item) {
  return {
    id: item.id, userId: item.user_id, member: item.legacy_id, channelId: item.channel_id, text: item.body,
    attachmentUrl: item.attachment_url, attachmentName: item.attachment_name,
    attachmentType: item.attachment_type, attachmentSize: item.attachment_size,
    createdAt: item.created_at
  };
}

async function loadChatChannels() {
  const {data, error} = await db.from("chat_channels").select("*").order("position").order("created_at");
  chatChannels = error ? [] : data.map(item => ({
    id: item.id, name: item.name, isDefault: item.is_default, position: item.position
  }));
  renderChatChannels();
  renderMessages();
  renderPrivateContacts();
}

function mapMedia(item) {
  return {
    id: item.id, userId: item.user_id, member: item.legacy_id, caption: item.caption,
    mediaUrl: item.media_url, mediaType: item.media_type, createdAt: item.created_at,
    expiresAt: item.expires_at, mentionedUserId: item.mentioned_user_id
  };
}

function getMediaLikes(kind, mediaId) {
  return mediaLikesIndex.get(`${kind}:${mediaId}`) || [];
}

async function loadMediaLikes() {
  const {data, error} = await db.from("media_likes").select("id,user_id,moment_id,profile_post_id");
  mediaLikes = error ? [] : data.map(item => ({
    id: item.id,
    userId: item.user_id,
    kind: item.moment_id != null ? "moment" : "post",
    mediaId: item.moment_id ?? item.profile_post_id
  }));
  mediaLikesIndex = new Map();
  mediaLikes.forEach(like => {
    const key = `${like.kind}:${like.mediaId}`;
    const indexed = mediaLikesIndex.get(key) || [];
    indexed.push(like);
    mediaLikesIndex.set(key, indexed);
  });
  if (document.getElementById("contenido")?.classList.contains("active")) selectContentTab(activeContentTab);
  if (activeProfileId && document.getElementById("perfil")?.classList.contains("active")) renderProfile(activeProfileId);
}

async function toggleMediaLike(kind, mediaId, button) {
  if (!backendReady || !currentAuthUser || !["moment", "post"].includes(kind)) return;
  const existing = getMediaLikes(kind, mediaId).find(like => like.userId === currentAuthUser.id);
  button.disabled = true;
  try {
    let result;
    if (existing) result = await db.from("media_likes").delete().eq("id", existing.id).eq("user_id", currentAuthUser.id);
    else result = await db.from("media_likes").insert({user_id: currentAuthUser.id, moment_id: kind === "moment" ? mediaId : null, profile_post_id: kind === "post" ? mediaId : null}).select("id").single();
    const {data, error} = result;
    if (error) throw error;
    if (!existing) dispatchPush("like", data?.id);
    await loadMediaLikes();
  } catch (error) {
    window.alert(error.message || "No se pudo guardar el Me gusta.");
  } finally {
    button.disabled = false;
  }
}

async function loadMoments() {
  const {data, error} = await db.from("moments").select("*")
    .gt("expires_at", new Date().toISOString()).order("created_at", {ascending: false});
  if (error) {
    document.getElementById("momentsStatus").textContent = "No se pudieron cargar las historias.";
    moments = [];
  } else {
    moments = data.map(mapMedia);
  }
  if (document.getElementById("contenido")?.classList.contains("active") && activeContentTab === "momentos") renderMoments();
}

async function loadProfilePosts() {
  const {data, error} = await db.from("profile_posts").select("*").order("created_at", {ascending: false});
  profilePosts = error ? [] : data.map(mapMedia);
  if (document.getElementById("contenido")?.classList.contains("active") && activeContentTab === "publicaciones") renderPublications();
  if (activeProfileId && document.getElementById("perfil")?.classList.contains("active")) renderProfile(activeProfileId);
}

function renderNotifications() {
  const list = document.getElementById("notificationsList");
  const badge = document.getElementById("notificationCount");
  const markAll = document.getElementById("markAllNotificationsRead");
  const clearAll = document.getElementById("clearAllNotifications");
  const unread = notifications.filter(item => !item.readAt).length;
  const chatTabAlert = document.getElementById("chatTabAlert");
  if (chatTabAlert) chatTabAlert.hidden = !notifications.some(item => !item.readAt && item.type === "private_message");
  badge.hidden = unread === 0;
  badge.textContent = unread > 99 ? "99+" : String(unread);
  markAll.disabled = unread === 0;
  clearAll.disabled = notifications.length === 0;
  if (!notifications.length) {
    list.innerHTML = `<div class="empty-state compact">No tienes notificaciones.</div>`;
    return;
  }
  list.innerHTML = notifications.map(item => {
    const actor = getMemberByAuthId(item.actorId);
    const actorName = actor?.name || "Un miembro";
    const text = item.type === "private_message"
      ? `${actorName} te ha enviado un mensaje`
      : item.type === "media_created"
        ? `${actorName} ha subido ${item.targetType === "moment" ? "una historia" : "una publicación"}`
        : item.type === "reply"
          ? `${actorName} ha respondido a tu ${item.targetType === "moment" ? "historia" : "publicación"}`
          : `${actorName} ha dado Me gusta a tu ${item.targetType === "moment" ? "historia" : "publicación"}`;
    return `<article class="notification-item ${item.readAt ? "" : "unread"}">
      <button class="notification-open" type="button" data-notification-id="${item.id}">
        ${getAvatar(actor, "avatar tiny")}
        <span><strong>${escapeHtml(text)}</strong>${item.excerpt ? `<small>${escapeHtml(item.excerpt)}</small>` : ""}<time datetime="${escapeHtml(item.createdAt)}">${formatRelativeTime(item.createdAt)}</time></span>
        ${item.readAt ? "" : `<i aria-label="Sin leer"></i>`}
      </button>
      <button class="notification-delete" type="button" data-delete-notification="${item.id}" aria-label="Eliminar notificación" title="Eliminar">×</button>
    </article>`;
  }).join("");
}

async function loadNotifications() {
  const {data, error} = await db.from("notifications").select("*")
    .order("created_at", {ascending: false}).limit(100);
  notifications = error ? [] : data.map(item => ({
    id: item.id,
    actorId: item.actor_id,
    type: item.type,
    targetType: item.target_type,
    targetId: item.target_id,
    excerpt: item.excerpt || "",
    readAt: item.read_at,
    createdAt: item.created_at
  }));
  renderNotifications();
}

async function markNotificationsRead(id = null) {
  if (!currentAuthUser) return;
  let query = db.from("notifications").update({read_at: new Date().toISOString()})
    .eq("user_id", currentAuthUser.id).is("read_at", null);
  if (id != null) query = query.eq("id", id);
  const {error} = await query;
  if (!error) await loadNotifications();
}

async function deleteNotifications(id = null) {
  if (!currentAuthUser) return;
  let query = db.from("notifications").delete().eq("user_id", currentAuthUser.id);
  if (id != null) query = query.eq("id", id);
  const {error} = await query;
  if (!error) await loadNotifications();
}

async function openNotification(id) {
  const item = notifications.find(notification => String(notification.id) === String(id));
  if (!item) return;
  if (!item.readAt) await markNotificationsRead(item.id);
  closeNotifications();
  if (item.type === "private_message") {
    const actor = getMemberByAuthId(item.actorId);
    if (actor) openPrivateConversation(actor.id);
  } else if (item.targetType === "moment") {
    goTo("momentos");
    if (["media_created", "reply", "like"].includes(item.type)) setTimeout(() => openMoment(item.targetId), 120);
  } else if (item.targetType === "post") {
    goTo("publicaciones");
  }
}

function closeNotifications() {
  const dropdown = document.getElementById("notificationsDropdown");
  dropdown.classList.remove("open");
  dropdown.setAttribute("aria-hidden", "true");
  document.getElementById("notificationsButton").setAttribute("aria-expanded", "false");
}

async function loadPrivateMessages() {
  const {data, error} = await db.from("private_messages").select("*").order("created_at", {ascending: false}).limit(300);
  privateMessages = error ? [] : [...data].reverse().map(item => ({
    id: item.id, senderId: item.sender_id, recipientId: item.recipient_id,
    body: item.body, attachmentUrl: item.attachment_url, attachmentName: item.attachment_name,
    attachmentType: item.attachment_type, attachmentSize: item.attachment_size,
    createdAt: item.created_at
  }));
  renderPrivateContacts();
  renderPrivateConversation();
}

async function loadGroupEvents() {
  const {data, error} = await db.from("group_events").select("*").order("starts_at");
  groupEvents = error ? [] : data.map(item => ({
    id: item.id, title: item.title, description: item.description, startsAt: item.starts_at,
    endsAt: item.ends_at, location: item.location, createdBy: item.created_by,
    eventType: item.event_type || "event", annual: Boolean(item.annual)
  }));
  renderCalendar();
}

async function loadSiteSettings() {
  const {data, error} = await db.from("site_settings").select("key,value");
  siteSettings = error ? {} : Object.fromEntries(data.map(item => [item.key, item.value]));
  renderSpotify();
}

function connectRealtime() {
  if (presenceChannel) db.removeChannel(presenceChannel);
  if (messageChannel) db.removeChannel(messageChannel);
  if (momentChannel) db.removeChannel(momentChannel);
  if (postChannel) db.removeChannel(postChannel);
  if (privateChannel) db.removeChannel(privateChannel);
  if (eventChannel) db.removeChannel(eventChannel);
  if (settingsChannel) db.removeChannel(settingsChannel);
  if (chatChannelsRealtime) db.removeChannel(chatChannelsRealtime);
  if (helpRealtime) db.removeChannel(helpRealtime);
  if (settingsChannel) db.removeChannel(settingsChannel);
  presenceChannel = db.channel("big-boy-presence", {config: {presence: {key: currentAuthUser.id}}});
  presenceChannel
    .on("presence", {event: "sync"}, () => {
      const state = presenceChannel.presenceState();
      onlineUsers = Object.values(state).flat().filter(Boolean)
        .filter((item, index, list) => list.findIndex(other => other.user_id === item.user_id) === index);
      renderPresence();
      renderAdminPanel();
    })
    .subscribe(async status => {
      if (status === "SUBSCRIBED") {
        if (!isSuperAdmin()) {
          await presenceChannel.track({
            user_id: currentAuthUser.id,
            legacy_id: currentUser.id,
            name: currentUser.name,
            online_at: new Date().toISOString()
          });
        }
      }
    });
  messageChannel = db.channel("messages-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "messages"}, () => scheduleRealtimeRefresh("messages", loadMessages))
    .subscribe();
  momentChannel = db.channel("moments-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "moments"}, () => scheduleRealtimeRefresh("moments", loadMoments))
    .subscribe();
  postChannel = db.channel("profile-posts-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "profile_posts"}, () => scheduleRealtimeRefresh("posts", loadProfilePosts))
    .subscribe();
  mediaLikesChannel = db.channel("media-likes-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "media_likes"}, () => scheduleRealtimeRefresh("likes", loadMediaLikes))
    .subscribe();
  notificationsChannel = db.channel(`notifications-${currentAuthUser.id}`)
    .on("postgres_changes", {event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${currentAuthUser.id}`}, () => scheduleRealtimeRefresh("notifications", loadNotifications))
    .subscribe();
  privateChannel = db.channel(`private-messages-${currentAuthUser.id}`)
    .on("postgres_changes", {event: "*", schema: "public", table: "private_messages"}, () => scheduleRealtimeRefresh("private", loadPrivateMessages))
    .subscribe();
  eventChannel = db.channel("group-events-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "group_events"}, () => loadGroupEvents())
    .subscribe();
  settingsChannel = db.channel("site-settings-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "site_settings"}, () => loadSiteSettings())
    .subscribe();
  chatChannelsRealtime = db.channel("chat-channels-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "chat_channels"}, () => loadChatChannels())
    .subscribe();
  helpRealtime = db.channel("help-center-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "help_requests"}, () => scheduleRealtimeRefresh("help", loadHelpCenter))
    .on("postgres_changes", {event: "*", schema: "public", table: "help_messages"}, () => scheduleRealtimeRefresh("help", loadHelpCenter))
    .subscribe();
}

async function uploadGroupMedia(file, folder) {
  validateFileSize(file, uploadLimitForFolder(folder));
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${currentAuthUser.id}/${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const {error} = await db.storage.from("group-media").upload(path, file, {contentType: file.type || "application/octet-stream"});
  if (error) throw error;
  return db.storage.from("group-media").getPublicUrl(path).data.publicUrl;
}

function attachmentContext(kind) {
  const privateChat = kind === "private";
  return {
    preview: document.getElementById(privateChat ? "privateMessageAttachmentPreview" : "messageAttachmentPreview"),
    fileInput: document.getElementById(privateChat ? "privateMessageAttachment" : "messageAttachment"),
    mediaInput: document.getElementById(privateChat ? "privateMessageMediaAttachment" : "messageMediaAttachment"),
    cameraInput: document.getElementById(privateChat ? "privateMessageCameraAttachment" : "messageCameraAttachment"),
  };
}

function pendingChatFile(kind) {
  return kind === "private" ? pendingPrivateMessageFile : pendingMessageFile;
}

function syncComposerState(kind) {
  const privateChat = kind === "private";
  const form = document.getElementById(privateChat ? "privateMessageForm" : "messageForm");
  const input = document.getElementById(privateChat ? "privateMessageInput" : "messageInput");
  form?.classList.toggle("has-content", Boolean(input?.value.trim() || pendingChatFile(kind)));
}

function setPendingChatFile(kind, file) {
  if (file && file.size > FILE_LIMITS.attachment) {
    clearPendingChatFile(kind);
    window.alert(`El archivo supera el máximo de ${formatLimit(FILE_LIMITS.attachment)}.`);
    return false;
  }
  if (kind === "private") pendingPrivateMessageFile = file || null;
  else pendingMessageFile = file || null;
  renderChatAttachmentPreview(kind);
  syncComposerState(kind);
  return true;
}

function clearPendingChatFile(kind) {
  if (kind === "private") pendingPrivateMessageFile = null;
  else pendingMessageFile = null;
  const context = attachmentContext(kind);
  context.fileInput.value = "";
  context.mediaInput.value = "";
  context.cameraInput.value = "";
  context.preview.hidden = true;
  context.preview.innerHTML = "";
  context.preview.classList.remove("voice-attachment-preview");
  if (attachmentPreviewUrls[kind]) URL.revokeObjectURL(attachmentPreviewUrls[kind]);
  attachmentPreviewUrls[kind] = "";
  syncComposerState(kind);
}

function renderChatAttachmentPreview(kind) {
  const file = pendingChatFile(kind);
  const {preview} = attachmentContext(kind);
  if (attachmentPreviewUrls[kind]) URL.revokeObjectURL(attachmentPreviewUrls[kind]);
  attachmentPreviewUrls[kind] = "";
  if (!file) {
    preview.hidden = true;
    preview.innerHTML = "";
    return;
  }
  const isAudio = file.type.startsWith("audio/");
  const audio = isAudio
    ? (() => {
        attachmentPreviewUrls[kind] = URL.createObjectURL(file);
        return renderVoiceNote(attachmentPreviewUrls[kind]);
      })()
    : "";
  preview.classList.toggle("voice-attachment-preview", isAudio);
  preview.innerHTML = isAudio
    ? `<div class="attachment-preview-content"><small>LISTA PARA ENVIAR · ${formatFileSize(file.size)}</small>${audio}</div><button class="voice-preview-remove" type="button" data-clear-chat-attachment="${kind}" aria-label="Descartar nota de voz">×</button>`
    : `<div class="attachment-preview-content"><span>Adjunto: <strong>${escapeHtml(file.name)}</strong> · ${formatFileSize(file.size)}</span></div><button type="button" data-clear-chat-attachment="${kind}">Quitar</button>`;
  preview.hidden = false;
}

function preferredRecordingMimeType() {
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find(type => window.MediaRecorder?.isTypeSupported?.(type)) || "";
}

function recordingFileExtension(mimeType) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function formatAudioClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const rounded = Math.floor(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function recordingElapsedSeconds(session) {
  const end = session.pausedAt || Date.now();
  return Math.max(0, Math.floor((end - session.startedAt - session.pausedTotal) / 1000));
}

function updateRecordingUi(kind, recording, seconds = 0, paused = false) {
  const privateChat = kind === "private";
  const button = document.getElementById(privateChat ? "recordPrivateAudioButton" : "recordGroupAudioButton");
  const time = document.getElementById(privateChat ? "privateRecordingTime" : "groupRecordingTime");
  const wave = document.getElementById(privateChat ? "privateRecordingWave" : "groupRecordingWave");
  const pause = document.getElementById(privateChat ? "pausePrivateAudioButton" : "pauseGroupAudioButton");
  const cancel = document.getElementById(privateChat ? "cancelPrivateAudioButton" : "cancelGroupAudioButton");
  const form = document.getElementById(privateChat ? "privateMessageForm" : "messageForm");
  button.classList.toggle("recording", recording);
  button.setAttribute("aria-label", recording ? "Enviar nota de voz" : "Grabar nota de voz");
  button.title = recording ? "Enviar nota de voz" : "Grabar nota de voz";
  time.hidden = !recording;
  wave.hidden = !recording;
  pause.hidden = !recording;
  cancel.hidden = !recording;
  time.textContent = formatAudioClock(seconds);
  pause.setAttribute("aria-label", paused ? "Continuar grabación" : "Pausar grabación");
  pause.title = paused ? "Continuar" : "Pausar";
  form.classList.toggle("is-recording", recording);
  form.classList.toggle("is-recording-paused", recording && paused);
}

function pauseAudioRecording(kind) {
  const session = activeAudioRecording;
  if (!session || session.kind !== kind) return;
  if (session.recorder.state === "recording") {
    session.recorder.pause();
    session.pausedAt = Date.now();
  } else if (session.recorder.state === "paused") {
    session.recorder.resume();
    session.pausedTotal += Date.now() - session.pausedAt;
    session.pausedAt = 0;
  }
  updateRecordingUi(kind, true, recordingElapsedSeconds(session), session.recorder.state === "paused");
}

function cancelAudioRecording(kind) {
  const session = activeAudioRecording;
  if (!session || session.kind !== kind) return;
  session.cancelled = true;
  session.sendOnStop = false;
  if (session.recorder.state !== "inactive") session.recorder.stop();
}

async function toggleAudioRecording(kind) {
  if (activeAudioRecording) {
    if (activeAudioRecording.kind !== kind) {
      window.alert("Termina la grabación actual antes de iniciar otra.");
      return;
    }
    activeAudioRecording.sendOnStop = true;
    if (activeAudioRecording.recorder.state !== "inactive") activeAudioRecording.recorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    window.alert("Este dispositivo no permite grabar audio desde el navegador.");
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({audio: true});
  } catch {
    window.alert("Necesitamos permiso para usar el micrófono y grabar la nota de voz.");
    return;
  }
  const mimeType = preferredRecordingMimeType();
  let recorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
  } catch {
    stream.getTracks().forEach(track => track.stop());
    window.alert("No se pudo iniciar la grabación de audio en este dispositivo.");
    return;
  }
  const session = {kind, recorder, stream, chunks: [], startedAt: Date.now(), pausedAt: 0, pausedTotal: 0, timer: null, sendOnStop: false};
  activeAudioRecording = session;
  recorder.addEventListener("dataavailable", event => {
    if (event.data?.size) session.chunks.push(event.data);
  });
  recorder.addEventListener("stop", () => {
    clearInterval(session.timer);
    session.stream.getTracks().forEach(track => track.stop());
    updateRecordingUi(kind, false);
    if (activeAudioRecording === session) activeAudioRecording = null;
    if (session.cancelled || !session.chunks.length) return;
    const resolvedType = recorder.mimeType || session.chunks[0].type || mimeType || "audio/webm";
    const blob = new Blob(session.chunks, {type: resolvedType});
    const filename = `nota-de-voz-${new Date().toISOString().replace(/[:.]/g, "-")}.${recordingFileExtension(resolvedType)}`;
    setPendingChatFile(kind, new File([blob], filename, {type: resolvedType, lastModified: Date.now()}));
    if (session.sendOnStop) requestAnimationFrame(() => document.getElementById(kind === "private" ? "privateMessageForm" : "messageForm")?.requestSubmit());
  }, {once: true});
  recorder.addEventListener("error", () => {
    clearInterval(session.timer);
    session.stream.getTracks().forEach(track => track.stop());
    updateRecordingUi(kind, false);
    if (activeAudioRecording === session) activeAudioRecording = null;
    window.alert("La grabación se ha interrumpido. Inténtalo de nuevo.");
  }, {once: true});
  clearPendingChatFile(kind);
  recorder.start(250);
  updateRecordingUi(kind, true, 0);
  session.timer = setInterval(() => {
    updateRecordingUi(kind, true, recordingElapsedSeconds(session), recorder.state === "paused");
  }, 1000);
}

async function sendMessage(text, file = null) {
  if (!db || !currentAuthUser) return;
  let attachmentUrl = null;
  if (file) attachmentUrl = await uploadGroupMedia(file, "chat");
  const {data, error} = await db.from("messages").insert({
    user_id: currentAuthUser.id, legacy_id: currentUser.id, channel_id: activeChatChannelId, body: text,
    attachment_url: attachmentUrl, attachment_name: file?.name || null,
    attachment_type: file?.type || null, attachment_size: file?.size || null
  }).select("id").single();
  if (error) throw error;
  dispatchPush("group_message", data.id);
}

async function createChatChannel() {
  if (!canManageSite() || !currentAuthUser) return;
  const value = window.prompt("Nombre de la nueva sección:");
  if (value === null) return;
  const name = value.trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  if (!name) return window.alert("Escribe un nombre válido.");
  const {error} = await db.from("chat_channels").insert({
    name, created_by: currentAuthUser.id, position: chatChannels.length
  });
  if (error) window.alert(error.message || "No se pudo crear la sección.");
  else await loadChatChannels();
}

async function deleteChatChannel(id) {
  const channel = chatChannels.find(item => String(item.id) === String(id));
  if (!canManageSite() || !channel || channel.isDefault) return;
  if (!window.confirm(`¿Eliminar la sección #${channel.name} y todos sus mensajes?`)) return;
  const {error} = await db.from("chat_channels").delete().eq("id", channel.id);
  if (error) window.alert(error.message || "No se pudo eliminar la sección.");
  else await loadChatChannels();
}

async function sendPrivateMessage(text, file = null) {
  const recipient = getMember(activePrivateMemberId);
  if (!recipient?.authId || !currentAuthUser) throw new Error("No se ha seleccionado un destinatario.");
  let attachmentUrl = null;
  if (file) attachmentUrl = await uploadGroupMedia(file, "private-chat");
  const {data, error} = await db.from("private_messages").insert({
    sender_id: currentAuthUser.id, recipient_id: recipient.authId, body: text,
    attachment_url: attachmentUrl, attachment_name: file?.name || null,
    attachment_type: file?.type || null, attachment_size: file?.size || null
  }).select("id").single();
  if (error) throw error;
  dispatchPush("private_message", data.id);
}

function updateShareDestinations() {
  const type = document.getElementById("shareDestinationType").value;
  const select = document.getElementById("shareDestination");
  document.getElementById("shareDestinationLabel").textContent = type === "group" ? "Canal del grupo" : "Miembro";
  if (type === "group") {
    select.innerHTML = chatChannels.map(channel => `<option value="${channel.id}"># ${escapeHtml(channel.name)}</option>`).join("");
  } else {
    select.innerHTML = members.filter(member => member.id !== currentUser?.id && member.authId && !member.hidden)
      .map(member => `<option value="${member.id}">${escapeHtml(member.name)} · @${escapeHtml(member.username)}</option>`).join("");
  }
  select.disabled = !select.options.length;
  document.querySelector("#shareMediaForm [type=submit]").disabled = !select.options.length;
}

function openShareMedia(kind, id) {
  const collection = kind === "moment" ? moments : profilePosts;
  const item = collection.find(media => String(media.id) === String(id));
  if (!item || !currentAuthUser || isSuperAdmin()) return;
  sharingMedia = {...item, kind};
  document.getElementById("shareDestinationType").value = "group";
  document.getElementById("shareMediaFeedback").textContent = "";
  document.getElementById("shareMediaPreview").innerHTML = item.mediaType === "video"
    ? `<video src="${escapeHtml(item.mediaUrl)}" controls preload="metadata"></video>`
    : `<img src="${escapeHtml(item.mediaUrl)}" alt="Vista previa" decoding="async">`;
  updateShareDestinations();
  const modal = document.getElementById("shareMediaModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function openShareNews(index) {
  const item = newsItems[Number(index)];
  if (!item || !currentAuthUser || isSuperAdmin()) return;
  sharingMedia = {...item, kind: "news", id: String(index)};
  document.getElementById("shareDestinationType").value = "group";
  document.getElementById("shareMediaFeedback").textContent = "";
  document.getElementById("shareMediaPreview").innerHTML = `<div class="share-news-preview"><span>${escapeHtml(item.source)}</span><strong>${escapeHtml(item.cleanTitle || item.title)}</strong><small>${formatNewsDate(item.published)}</small></div>`;
  updateShareDestinations();
  const modal = document.getElementById("shareMediaModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeShareMedia() {
  sharingMedia = null;
  const modal = document.getElementById("shareMediaModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.getElementById("shareMediaPreview").innerHTML = "";
}

async function shareMediaToChat(form) {
  if (!sharingMedia || !currentAuthUser || !currentUser) return;
  const submit = form.querySelector("[type=submit]");
  const feedback = document.getElementById("shareMediaFeedback");
  const destinationType = document.getElementById("shareDestinationType").value;
  const destination = document.getElementById("shareDestination").value;
  const isNews = sharingMedia.kind === "news";
  const label = sharingMedia.kind === "moment" ? "momento" : sharingMedia.kind === "post" ? "publicación" : "noticia";
  const body = isNews ? `Noticia compartida: ${sharingMedia.cleanTitle || sharingMedia.title}` : `Ha compartido un ${label}${sharingMedia.caption ? `: ${sharingMedia.caption}` : "."}`;
  const attachmentType = isNews ? "text/news-link" : sharingMedia.mediaType === "video" ? "video/mp4" : "image/jpeg";
  const attachmentUrl = isNews ? sharingMedia.link : sharingMedia.mediaUrl;
  const attachmentName = isNews ? sharingMedia.source : `bb-share:${sharingMedia.kind}:${sharingMedia.id}`;
  submit.disabled = true;
  feedback.textContent = "Compartiendo…";
  try {
    if (destinationType === "group") {
      const channel = chatChannels.find(item => String(item.id) === String(destination));
      if (!channel) throw new Error("Selecciona un canal válido.");
      const {error} = await db.from("messages").insert({
        user_id: currentAuthUser.id, legacy_id: currentUser.id, channel_id: channel.id, body,
        attachment_url: attachmentUrl, attachment_name: attachmentName,
        attachment_type: attachmentType, attachment_size: null
      });
      if (error) throw error;
      closeShareMedia();
      activeChatChannelId = channel.id;
      await loadMessages();
      openGroupConversation(channel.id);
    } else {
      const member = getMember(destination);
      if (!member?.authId) throw new Error("Selecciona un miembro válido.");
      const {error} = await db.from("private_messages").insert({
        sender_id: currentAuthUser.id, recipient_id: member.authId, body,
        attachment_url: attachmentUrl, attachment_name: attachmentName,
        attachment_type: attachmentType, attachment_size: null
      });
      if (error) throw error;
      closeShareMedia();
      await loadPrivateMessages();
      openPrivateConversation(member.id);
    }
  } catch (error) {
    feedback.textContent = error.message || "No se pudo compartir el contenido.";
  } finally {
    submit.disabled = false;
  }
}

async function renameClubUser(memberId) {
  const member = getMember(memberId);
  if (!canManageSite() || !member?.authId) return;
  const value = window.prompt(`Nuevo @ para ${member.name}:`, member.username);
  if (value == null) return;
  const username = normalizeUsername(value.trim());
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return window.alert("El @ debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.");
  }
  if (username === member.username) return;
  if (members.some(item => item.id !== member.id && normalizeUsername(item.username) === username)) {
    return window.alert("Ese @ ya pertenece a otro usuario.");
  }
  try {
    await invokeUserAdmin("rename", {userId: member.authId, username});
    await loadRemoteProfiles();
    window.alert(`El usuario ahora es @${username}. Deberá usar este nuevo @ al iniciar sesión.`);
  } catch (error) {
    window.alert(error.message || "No se pudo cambiar el @.");
  }
}

async function changeClubUserRole(memberId) {
  const member = getMember(memberId);
  if (!canManageSite() || !member?.authId || member.hidden || member.id === currentUser?.id) return;
  const nextRole = member.roleKey === "admin" ? "member" : "admin";
  const nextLabel = nextRole === "admin" ? "administrador" : "miembro";
  if (!window.confirm(`¿Cambiar el rango de ${member.name} a ${nextLabel}?`)) return;
  try {
    const {error} = await db.rpc("set_club_member_role", {target_user_id: member.authId, new_role: nextRole});
    if (error) throw error;
    await loadRemoteProfiles();
    window.alert(`${member.name} ahora tiene rango de ${nextLabel}.`);
  } catch (error) {
    window.alert(error.message || "No se pudo cambiar el rango.");
  }
}

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function updateEventEditorType() {
  const birthday = document.getElementById("eventType").value === "birthday";
  document.getElementById("birthdayDateField").hidden = !birthday;
  document.getElementById("birthdayAllDayNote").hidden = !birthday;
  document.getElementById("eventDateFields").hidden = birthday;
  document.getElementById("eventStartsAt").required = !birthday;
  document.getElementById("birthdayDate").required = birthday;
  document.getElementById("eventLocation").closest("label").hidden = birthday;
}

function openEventEditor(eventId = null, requestedType = "event") {
  const event = groupEvents.find(item => String(item.id) === String(eventId));
  const eventType = event?.eventType || requestedType;
  if (event && !canEditCalendarEvent(event)) return;
  if (!event && eventType !== "birthday" && !canManageSite()) return;
  closeCalendarDayModal();
  document.getElementById("eventEditorTitle").textContent = eventType === "birthday" ? (event ? "Editar cumpleaños" : "Añadir cumpleaños") : (event ? "Editar evento" : "Nuevo evento");
  document.getElementById("eventId").value = event?.id || "";
  document.getElementById("eventTitle").value = event?.title || "";
  document.getElementById("eventDescription").value = event?.description || "";
  document.getElementById("eventStartsAt").value = toLocalDateTime(event?.startsAt || new Date(Date.now() + 3600000));
  document.getElementById("eventEndsAt").value = toLocalDateTime(event?.endsAt);
  document.getElementById("eventLocation").value = event?.location || "";
  document.getElementById("eventType").value = eventType;
  document.getElementById("eventType").disabled = Boolean(event) || !canManageSite();
  document.getElementById("eventTypeField").hidden = !canManageSite() && eventType === "birthday";
  document.getElementById("birthdayDate").value = eventType === "birthday" && event ? new Date(event.startsAt).toISOString().slice(0, 10) : "";
  if (!event && eventType === "birthday") {
    document.getElementById("eventTitle").value = `Cumpleaños de ${currentUser?.name || "miembro"}`;
  }
  updateEventEditorType();
  document.getElementById("eventFeedback").textContent = "";
  document.getElementById("deleteEventButton").hidden = !event || !canEditCalendarEvent(event);
  const modal = document.getElementById("eventEditor");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeEventEditor() {
  const modal = document.getElementById("eventEditor");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

async function saveEvent(form) {
  const feedback = document.getElementById("eventFeedback");
  const submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  feedback.textContent = "Guardando…";
  try {
    const id = document.getElementById("eventId").value;
    const eventType = document.getElementById("eventType").value;
    const birthdayValue = document.getElementById("birthdayDate").value;
    const birthdayStartsAt = birthdayValue ? new Date(`${birthdayValue}T12:00:00`).toISOString() : null;
    const values = {
      title: document.getElementById("eventTitle").value.trim(),
      description: document.getElementById("eventDescription").value.trim(),
      starts_at: eventType === "birthday" ? birthdayStartsAt : new Date(document.getElementById("eventStartsAt").value).toISOString(),
      ends_at: eventType === "birthday" ? null : document.getElementById("eventEndsAt").value ? new Date(document.getElementById("eventEndsAt").value).toISOString() : null,
      location: eventType === "birthday" ? "" : document.getElementById("eventLocation").value.trim(),
      event_type: eventType, annual: eventType === "birthday",
      created_by: currentAuthUser.id, updated_at: new Date().toISOString()
    };
    const query = id ? db.from("group_events").update(values).eq("id", id) : db.from("group_events").insert(values);
    const {error} = await query;
    if (error) throw error;
    closeEventEditor();
    await loadGroupEvents();
  } catch (error) {
    feedback.textContent = error.message || "No se pudo guardar el evento.";
  } finally {
    submit.disabled = false;
  }
}

async function deleteEvent() {
  const id = document.getElementById("eventId").value;
  const event = groupEvents.find(item => String(item.id) === String(id));
  if (!id || !canEditCalendarEvent(event)) return;
  const {error} = await db.from("group_events").delete().eq("id", id);
  if (!error) {
    closeEventEditor();
    await loadGroupEvents();
  }
}

function openSpotifyEditor() {
  if (!canManageSite()) return;
  document.getElementById("spotifyPlaylistUrl").value = siteSettings.spotify_playlist || "";
  document.getElementById("spotifyFeedback").textContent = "";
  const modal = document.getElementById("spotifyEditor");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeSpotifyEditor() {
  const modal = document.getElementById("spotifyEditor");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

async function saveSpotifyPlaylist(value) {
  const feedback = document.getElementById("spotifyFeedback");
  if (!spotifyEmbedUrl(value)) {
    feedback.textContent = "Pega un enlace válido de una playlist pública de Spotify.";
    return;
  }
  feedback.textContent = "Guardando…";
  const {error} = await db.from("site_settings").upsert({
    key: "spotify_playlist", value: value.trim(), updated_by: currentAuthUser.id, updated_at: new Date().toISOString()
  });
  if (error) {
    feedback.textContent = error.message || "No se pudo guardar la playlist.";
    return;
  }
  closeSpotifyEditor();
  await loadSiteSettings();
}

async function removeSpotifyPlaylist() {
  const {error} = await db.from("site_settings").delete().eq("key", "spotify_playlist");
  if (!error) {
    closeSpotifyEditor();
    await loadSiteSettings();
  }
}

function openProfileEditor(memberId = currentUser?.id) {
  const profile = getMember(memberId);
  if (!profile || (profile.id !== currentUser?.id && !canManageSite())) return;
  editingProfileId = profile.id;
  pendingAvatarFile = null;
  removeAvatarRequested = false;
  resetAvatarCropEditor();
  document.getElementById("profileAvatar").value = "";
  document.getElementById("profileName").value = profile.name;
  const managingAnotherUser = canManageSite() && profile.id !== currentUser?.id;
  document.querySelector("#profileEditor .eyebrow").textContent = managingAnotherUser ? "ADMINISTRACIÓN" : "MI PERFIL";
  document.getElementById("profileEditorTitle").textContent = managingAnotherUser ? `Editar a ${profile.name}` : "Editar perfil";
  document.getElementById("adminProfileFields").hidden = !managingAnotherUser;
  document.getElementById("profileUsername").value = profile.username;
  document.getElementById("profileRole").value = profile.roleKey === "admin" ? "admin" : "member";
  document.getElementById("profileNickname").value = profile.nickname;
  document.getElementById("profileFlag").value = profile.countryFlag || "";
  document.getElementById("profileBio").value = profile.bio;
  document.getElementById("profileTags").value = profile.tags.join(", ");
  document.getElementById("bioCount").textContent = profile.bio.length;
  document.getElementById("profileFeedback").textContent = "";
  const preview = document.getElementById("avatarPreview");
  preview.classList.toggle("has-image", Boolean(profile.avatarUrl));
  preview.innerHTML = profile.avatarUrl ? `<img src="${escapeHtml(profile.avatarUrl)}" alt="">` : profile.name.charAt(0);
  const modal = document.getElementById("profileEditor");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeProfileEditor() {
  const modal = document.getElementById("profileEditor");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  editingProfileId = null;
  resetAvatarCropEditor();
}

function resetAvatarCropEditor() {
  avatarCropImage = null;
  avatarCropZoom = 1;
  avatarCropOffsetX = 0;
  avatarCropOffsetY = 0;
  avatarCropPointer = null;
  const cropper = document.getElementById("avatarCropper");
  const zoom = document.getElementById("avatarZoom");
  const stage = document.getElementById("avatarCropStage");
  if (cropper) cropper.hidden = true;
  if (zoom) zoom.value = "1";
  if (stage) stage.classList.remove("dragging");
}

function clampAvatarCrop() {
  if (!avatarCropImage) return;
  const canvas = document.getElementById("avatarCropCanvas");
  const baseScale = Math.max(canvas.width / avatarCropImage.naturalWidth, canvas.height / avatarCropImage.naturalHeight);
  const scale = baseScale * avatarCropZoom;
  const maxX = Math.max(0, (avatarCropImage.naturalWidth * scale - canvas.width) / 2);
  const maxY = Math.max(0, (avatarCropImage.naturalHeight * scale - canvas.height) / 2);
  avatarCropOffsetX = Math.max(-maxX, Math.min(maxX, avatarCropOffsetX));
  avatarCropOffsetY = Math.max(-maxY, Math.min(maxY, avatarCropOffsetY));
}

function drawAvatarCrop() {
  if (!avatarCropImage) return;
  clampAvatarCrop();
  const canvas = document.getElementById("avatarCropCanvas");
  const context = canvas.getContext("2d");
  const baseScale = Math.max(canvas.width / avatarCropImage.naturalWidth, canvas.height / avatarCropImage.naturalHeight);
  const scale = baseScale * avatarCropZoom;
  const width = avatarCropImage.naturalWidth * scale;
  const height = avatarCropImage.naturalHeight * scale;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    avatarCropImage,
    (canvas.width - width) / 2 + avatarCropOffsetX,
    (canvas.height - height) / 2 + avatarCropOffsetY,
    width,
    height
  );
}

function loadAvatarCrop(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      avatarCropImage = image;
      avatarCropZoom = 1;
      avatarCropOffsetX = 0;
      avatarCropOffsetY = 0;
      document.getElementById("avatarZoom").value = "1";
      document.getElementById("avatarCropper").hidden = false;
      drawAvatarCrop();
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo abrir la imagen seleccionada."));
    };
    image.src = objectUrl;
  });
}

function createCroppedAvatarFile() {
  return new Promise((resolve, reject) => {
    const canvas = document.getElementById("avatarCropCanvas");
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error("No se pudo preparar la foto."));
        return;
      }
      resolve(new File([blob], "avatar.webp", {type: "image/webp"}));
    }, "image/webp", .9);
  });
}

async function saveProfile(form) {
  const profile = getMember(editingProfileId);
  if (!profile || (profile.id !== currentUser?.id && !canManageSite())) return;
  const feedback = document.getElementById("profileFeedback");
  const submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  feedback.textContent = "Guardando…";
  try {
    const managingAnotherUser = canManageSite() && profile.id !== currentUser?.id;
    if (managingAnotherUser) {
      const username = normalizeUsername(document.getElementById("profileUsername").value.trim());
      const requestedRole = document.getElementById("profileRole").value;
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("El @ debe tener entre 3 y 32 caracteres válidos.");
      if (members.some(item => item.id !== profile.id && normalizeUsername(item.username) === username)) throw new Error("Ese @ ya pertenece a otro usuario.");
      if (username !== profile.username) {
        await invokeUserAdmin("rename", {userId: profile.authId, username});
        profile.username = username;
      }
      if (requestedRole !== profile.roleKey) {
        const {error: roleError} = await db.rpc("set_club_member_role", {target_user_id: profile.authId, new_role: requestedRole});
        if (roleError) throw roleError;
        profile.roleKey = requestedRole;
        profile.role = requestedRole === "admin" ? "ADMINISTRADOR" : "MIEMBRO";
      }
    }
    let avatarUrl = profile.avatarUrl;
    const targetAuthId = profile.authId || currentAuthUser?.id;
    if (removeAvatarRequested) {
      if (backendReady && targetAuthId) {
        const {data} = await db.storage.from("avatars").list(targetAuthId);
        if (data?.length) {
          await db.storage.from("avatars").remove(data.map(item => `${targetAuthId}/${item.name}`));
        }
      }
      avatarUrl = "";
    } else if (pendingAvatarFile) {
      const croppedAvatarFile = avatarCropImage ? await createCroppedAvatarFile() : pendingAvatarFile;
      if (backendReady) {
        const extension = croppedAvatarFile.name.split(".").pop().toLowerCase();
        const path = `${targetAuthId}/avatar.${extension}`;
        const {error} = await db.storage.from("avatars").upload(path, croppedAvatarFile, {upsert: true, contentType: croppedAvatarFile.type});
        if (error) throw error;
        avatarUrl = `${db.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
      } else {
        avatarUrl = await fileToDataUrl(croppedAvatarFile);
      }
    }
    const updates = {
      name: document.getElementById("profileName").value.trim(),
      nickname: document.getElementById("profileNickname").value.trim(),
      bio: document.getElementById("profileBio").value.trim(),
      tags: document.getElementById("profileTags").value.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 6),
      countryFlag: document.getElementById("profileFlag").value,
      avatarUrl
    };
    if (backendReady) {
      const {error} = await db.from("profiles").update({
        display_name: updates.name, nickname: updates.nickname, bio: updates.bio,
        tags: updates.tags, country_flag: updates.countryFlag,
        avatar_url: updates.avatarUrl, updated_at: new Date().toISOString()
      }).eq("id", targetAuthId);
      if (error) throw error;
    }
    Object.assign(profile, updates);
    if (profile.id === currentUser.id) Object.assign(currentUser, updates);
    if (!backendReady) persistLocalProfile(profile);
    refreshProfileSurfaces();
    renderProfile(profile.id);
    closeProfileEditor();
  } catch (error) {
    feedback.textContent = error.message || "No se pudo guardar el perfil.";
  } finally {
    submit.disabled = false;
  }
}

function stopStoryCameraStream() {
  const preview = document.getElementById("storyCameraPreview");
  preview.pause();
  preview.srcObject = null;
  preview.removeAttribute("src");
  preview.load();
  storyCameraStream?.getTracks().forEach(track => track.stop());
  storyCameraStream = null;
}

function renewStoryCameraPreview() {
  const previous = document.getElementById("storyCameraPreview");
  const preview = document.createElement("video");
  preview.id = "storyCameraPreview";
  preview.autoplay = true;
  preview.muted = true;
  preview.playsInline = true;
  preview.setAttribute("autoplay", "");
  preview.setAttribute("muted", "");
  preview.setAttribute("playsinline", "");
  preview.addEventListener("loadedmetadata", fitStoryCameraPreview);
  preview.addEventListener("resize", fitStoryCameraPreview);
  previous.replaceWith(preview);
  return preview;
}

function fitStoryCameraPreview() {
  const preview = document.getElementById("storyCameraPreview");
  const shell = document.getElementById("cameraCaptureDialog");
  if (!preview || !shell?.classList || !document.getElementById("storyCamera")?.classList.contains("open")) return;
  const bounds = shell.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const sourceWidth = preview.videoWidth || bounds.width;
  const sourceHeight = preview.videoHeight || bounds.height;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = bounds.width / bounds.height;
  const renderedWidth = sourceRatio > targetRatio ? bounds.height * sourceRatio : bounds.width;
  const renderedHeight = sourceRatio > targetRatio ? bounds.height : bounds.width / sourceRatio;
  preview.style.setProperty("width", `${Math.ceil(renderedWidth)}px`, "important");
  preview.style.setProperty("height", `${Math.ceil(renderedHeight)}px`, "important");
  preview.setAttribute("width", String(Math.ceil(renderedWidth)));
  preview.setAttribute("height", String(Math.ceil(renderedHeight)));
}

function clearStoryRecordingTimer() {
  if (storyRecordingTimer) window.clearInterval(storyRecordingTimer);
  storyRecordingTimer = null;
}

function formatStoryRecordingTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function setStoryRecordingUI(recording) {
  const camera = document.getElementById("storyCamera");
  const indicator = document.getElementById("storyRecordingIndicator");
  camera.classList.toggle("recording", recording);
  indicator.hidden = !recording;
  document.getElementById("switchStoryCamera").disabled = recording;
  document.getElementById("toggleStoryFlash").disabled = recording;
  document.getElementById("storyGalleryInput").disabled = recording;
  if (!recording) document.getElementById("storyRecordingTime").textContent = "00:00";
}

function resetStoryRecordingState() {
  if (storyShutterHoldTimer) window.clearTimeout(storyShutterHoldTimer);
  storyShutterHoldTimer = null;
  storyShutterPointerId = null;
  storyCaptureInProgress = false;
  clearStoryRecordingTimer();
  setStoryRecordingUI(false);
  document.getElementById("captureStoryPhoto")?.classList.remove("holding");
}

function setStoryCameraStatus(message = "", isError = false) {
  const status = document.getElementById("storyCameraStatus");
  status.textContent = message;
  status.hidden = !message;
  status.classList.toggle("error", isError);
}

async function startStoryCamera() {
  const token = ++storyCameraOpeningToken;
  stopStoryCameraStream();
  const preview = renewStoryCameraPreview();
  setStoryCameraStatus("Activando cámara…");
  const shutter = document.getElementById("captureStoryPhoto");
  const switchButton = document.getElementById("switchStoryCamera");
  const flashButton = document.getElementById("toggleStoryFlash");
  shutter.disabled = true;
  switchButton.disabled = true;
  flashButton.hidden = true;
  storyCameraTorchEnabled = false;
  flashButton.classList.remove("active");
  flashButton.setAttribute("aria-pressed", "false");
  if (!navigator.mediaDevices?.getUserMedia) {
    setStoryCameraStatus("La cámara no está disponible aquí. Puedes elegir una foto o vídeo desde la galería.", true);
    return;
  }
  try {
    const video = {facingMode: {ideal: storyCameraFacingMode}, width: {ideal: 1920}, height: {ideal: 1080}};
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({video, audio: {echoCancellation: true, noiseSuppression: true}});
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({video, audio: false});
    }
    if (token !== storyCameraOpeningToken || !document.getElementById("storyCamera").classList.contains("open")) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    storyCameraStream = stream;
    preview.muted = true;
    preview.playsInline = true;
    preview.srcObject = stream;
    fitStoryCameraPreview();
    await preview.play();
    fitStoryCameraPreview();
    requestAnimationFrame(fitStoryCameraPreview);
    document.querySelector(".story-camera-shell").classList.toggle("front-camera", storyCameraFacingMode === "user");
    shutter.disabled = false;
    switchButton.disabled = false;
    setStoryCameraStatus();
    const track = stream.getVideoTracks()[0];
    const capabilities = track?.getCapabilities?.() || {};
    flashButton.hidden = !capabilities.torch;
  } catch (error) {
    if (token !== storyCameraOpeningToken) return;
    switchButton.disabled = false;
    const denied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
    setStoryCameraStatus(denied
      ? "Necesitamos permiso para usar la cámara. También puedes continuar desde la galería."
      : "No se pudo abrir la cámara. Puedes seleccionar una foto o vídeo desde la galería.", true);
  }
}

function openStoryCamera(mode = "moment") {
  if (!currentUser) return;
  closeMediaUploader();
  cameraCaptureMode = mode === "post" ? "post" : "moment";
  const camera = document.getElementById("storyCamera");
  storyCameraFacingMode = "environment";
  document.getElementById("cameraCaptureLabel").textContent = cameraCaptureMode === "post" ? "PUBLICACIÓN" : "HISTORIA";
  document.getElementById("cameraCaptureDialog").setAttribute("aria-label", cameraCaptureMode === "post" ? "Cámara de publicaciones" : "Cámara de historias");
  camera.classList.add("open");
  camera.setAttribute("aria-hidden", "false");
  document.body.classList.add("story-camera-open");
  syncMobileViewport();
  requestAnimationFrame(fitStoryCameraPreview);
  document.getElementById("storyGalleryInput").value = "";
  resetStoryRecordingState();
  startStoryCamera();
}

function closeStoryCamera() {
  storyCameraOpeningToken += 1;
  if (storyRecorder && storyRecorder.state !== "inactive") {
    storyRecordingDiscard = true;
    storyRecorder.stop();
  }
  resetStoryRecordingState();
  stopStoryCameraStream();
  const camera = document.getElementById("storyCamera");
  camera.classList.remove("open");
  camera.setAttribute("aria-hidden", "true");
  document.body.classList.remove("story-camera-open");
  syncMobileViewport();
  setStoryCameraStatus();
}

async function switchStoryCamera() {
  storyCameraFacingMode = storyCameraFacingMode === "environment" ? "user" : "environment";
  await startStoryCamera();
}

async function toggleStoryFlash() {
  const track = storyCameraStream?.getVideoTracks?.()[0];
  if (!track) return;
  const button = document.getElementById("toggleStoryFlash");
  try {
    storyCameraTorchEnabled = !storyCameraTorchEnabled;
    await track.applyConstraints({advanced: [{torch: storyCameraTorchEnabled}]});
    button.classList.toggle("active", storyCameraTorchEnabled);
    button.setAttribute("aria-pressed", String(storyCameraTorchEnabled));
    button.setAttribute("aria-label", storyCameraTorchEnabled ? "Desactivar flash" : "Activar flash");
  } catch {
    storyCameraTorchEnabled = false;
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
    setStoryCameraStatus("El flash no está disponible con esta cámara.", true);
  }
}

async function useStoryMediaFile(file) {
  if (!file) return;
  const mode = cameraCaptureMode;
  const cameraWasOpen = document.getElementById("storyCamera")?.classList.contains("open");
  if (cameraWasOpen) document.body.classList.add("camera-editor-transition");
  openMediaUploader(mode, {backToCamera: true});
  try {
    await prepareMediaUploadFile(file);
  } finally {
    if (cameraWasOpen) {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      closeStoryCamera();
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.body.classList.remove("camera-editor-transition");
    }));
  }
}

function supportedStoryRecordingMimeType() {
  if (!window.MediaRecorder?.isTypeSupported) return "";
  return ["video/mp4;codecs=h264,aac", "video/mp4", "video/webm;codecs=vp8,opus", "video/webm"]
    .find(type => MediaRecorder.isTypeSupported(type)) || "";
}

function finishStoryVideoRecording() {
  if (!storyRecorder || storyRecorder.state === "inactive") return;
  storyRecorder.stop();
}

function startStoryVideoRecording() {
  storyShutterHoldTimer = null;
  if (!storyCameraStream || !window.MediaRecorder) {
    setStoryCameraStatus("Este dispositivo no permite grabar vídeo desde la web. Puedes elegirlo desde la galería.", true);
    document.getElementById("captureStoryPhoto").classList.remove("holding");
    return;
  }
  try {
    const mimeType = supportedStoryRecordingMimeType();
    let recorder;
    try {
      recorder = new MediaRecorder(storyCameraStream, mimeType ? {mimeType, videoBitsPerSecond: 6000000} : undefined);
    } catch {
      recorder = new MediaRecorder(storyCameraStream, mimeType ? {mimeType} : undefined);
    }
    storyRecorder = recorder;
    storyRecordingChunks = [];
    storyRecordingDiscard = false;
    storyRecordingStartedAt = Date.now();
    recorder.addEventListener("dataavailable", event => {
      if (event.data?.size) storyRecordingChunks.push(event.data);
    });
    recorder.addEventListener("stop", () => {
      const discard = storyRecordingDiscard;
      const chunks = storyRecordingChunks;
      const recordedType = recorder.mimeType || mimeType || "video/webm";
      storyRecorder = null;
      storyRecordingChunks = [];
      storyRecordingDiscard = false;
      resetStoryRecordingState();
      if (discard) return;
      if (!chunks.length) {
        setStoryCameraStatus("La grabación fue demasiado corta. Mantén pulsado un poco más.", true);
        return;
      }
      const extension = recordedType.includes("mp4") ? "mp4" : "webm";
      const prefix = cameraCaptureMode === "post" ? "publicacion" : "historia";
      useStoryMediaFile(new File([new Blob(chunks, {type: recordedType})], `${prefix}-${Date.now()}.${extension}`, {type: recordedType, lastModified: Date.now()}));
    }, {once: true});
    recorder.start(200);
    setStoryRecordingUI(true);
    document.getElementById("storyRecordingTime").textContent = "00:00";
    storyRecordingTimer = window.setInterval(() => {
      const elapsed = Date.now() - storyRecordingStartedAt;
      document.getElementById("storyRecordingTime").textContent = formatStoryRecordingTime(elapsed);
      if (elapsed >= 60000) finishStoryVideoRecording();
    }, 200);
  } catch (error) {
    resetStoryRecordingState();
    setStoryCameraStatus(error.message || "No se pudo iniciar la grabación.", true);
  }
}

function beginStoryShutterGesture(event) {
  if (event.currentTarget.disabled || storyRecorder || storyCaptureInProgress) return;
  event.preventDefault();
  storyShutterPointerId = event.pointerId;
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.currentTarget.classList.add("holding");
  storyShutterHoldTimer = window.setTimeout(startStoryVideoRecording, 320);
}

function endStoryShutterGesture(event) {
  if (storyShutterPointerId !== event.pointerId) return;
  event.preventDefault();
  const wasWaitingForHold = Boolean(storyShutterHoldTimer);
  if (storyShutterHoldTimer) window.clearTimeout(storyShutterHoldTimer);
  storyShutterHoldTimer = null;
  storyShutterPointerId = null;
  event.currentTarget.classList.remove("holding");
  if (storyRecorder?.state === "recording") finishStoryVideoRecording();
  else if (wasWaitingForHold) captureStoryPhoto();
}

function cancelStoryShutterGesture(event) {
  if (storyShutterPointerId !== event.pointerId) return;
  event.preventDefault();
  if (storyShutterHoldTimer) window.clearTimeout(storyShutterHoldTimer);
  storyShutterHoldTimer = null;
  storyShutterPointerId = null;
  event.currentTarget.classList.remove("holding");
  if (storyRecorder?.state === "recording") finishStoryVideoRecording();
}

function captureStoryPhoto() {
  const preview = document.getElementById("storyCameraPreview");
  if (storyCaptureInProgress || !storyCameraStream || !preview.videoWidth || !preview.videoHeight) return;
  storyCaptureInProgress = true;
  const shutter = document.getElementById("captureStoryPhoto");
  shutter.disabled = true;
  setStoryCameraStatus("Preparando foto…");
  const canvas = document.getElementById("storyCameraCanvas");
  const scale = Math.min(1, 2560 / Math.max(preview.videoWidth, preview.videoHeight));
  canvas.width = Math.round(preview.videoWidth * scale);
  canvas.height = Math.round(preview.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (storyCameraFacingMode === "user") {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(preview, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => {
    if (!blob) {
      storyCaptureInProgress = false;
      shutter.disabled = false;
      setStoryCameraStatus("No se pudo preparar la foto. Inténtalo de nuevo.", true);
      return;
    }
    const prefix = cameraCaptureMode === "post" ? "publicacion" : "historia";
    useStoryMediaFile(new File([blob], `${prefix}-${Date.now()}.jpg`, {type: "image/jpeg", lastModified: Date.now()}));
  }, "image/jpeg", .92);
}

function openMediaUploader(mode, {backToCamera = false} = {}) {
  if (!currentUser) return;
  mediaUploadMode = mode;
  mediaUploaderBackToCamera = backToCamera;
  pendingMediaUploadFile = null;
  if (mediaPreviewObjectUrl) URL.revokeObjectURL(mediaPreviewObjectUrl);
  mediaPreviewObjectUrl = "";
  const isMoment = mode === "moment";
  document.getElementById("mediaUploaderEyebrow").textContent = isMoment ? "NUEVO MOMENTO" : "NUEVA PUBLICACIÓN";
  document.getElementById("mediaUploaderTitle").textContent = isMoment ? "Compartir una historia" : "Compartir en mi perfil";
  document.getElementById("mediaUploadHelp").textContent = isMoment
    ? `La historia desaparecerá en 24 horas · original o personalizada · máximo ${formatLimit(FILE_LIMITS.media)}`
    : `Se mostrará en tu perfil · original o personalizada · máximo ${formatLimit(FILE_LIMITS.media)}`;
  document.getElementById("mediaUploadFile").value = "";
  document.getElementById("mediaUploadCaption").value = "";
  document.getElementById("mediaMention").innerHTML = `<option value="">Nadie</option>${members.filter(member => !member.hidden && member.authId && member.id !== currentUser.id).map(member => `<option value="${escapeHtml(member.authId)}">@${escapeHtml(member.username)} · ${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("mediaUploadPreview").innerHTML = "";
  document.getElementById("mediaDropzone").hidden = false;
  document.getElementById("mediaUploadPreview").hidden = false;
  resetMediaCropEditor();
  document.getElementById("mediaUploadFeedback").textContent = "";
  const modal = document.getElementById("mediaUploader");
  modal.classList.remove("has-media", "has-video");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  const closeButton = document.getElementById("closeMediaUploader");
  closeButton.textContent = backToCamera ? "←" : "×";
  closeButton.setAttribute("aria-label", backToCamera ? "Volver a la cámara" : "Cerrar");
}

function closeMediaUploader() {
  const modal = document.getElementById("mediaUploader");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("has-media", "has-video");
  document.getElementById("mediaDropzone").hidden = false;
  document.getElementById("mediaUploadPreview").hidden = false;
  pendingMediaUploadFile = null;
  if (mediaPreviewObjectUrl) URL.revokeObjectURL(mediaPreviewObjectUrl);
  mediaPreviewObjectUrl = "";
  mediaUploaderBackToCamera = false;
  resetMediaCropEditor();
}

function dismissMediaUploader({returnToCamera = false} = {}) {
  const mode = mediaUploadMode;
  const shouldReturnToCamera = returnToCamera && mediaUploaderBackToCamera;
  closeMediaUploader();
  if (shouldReturnToCamera) openStoryCamera(mode);
}

async function prepareMediaUploadFile(file) {
  const input = document.getElementById("mediaUploadFile");
  const preview = document.getElementById("mediaUploadPreview");
  const dropzone = document.getElementById("mediaDropzone");
  const uploader = document.getElementById("mediaUploader");
  const feedback = document.getElementById("mediaUploadFeedback");
  pendingMediaUploadFile = file || null;
  if (mediaPreviewObjectUrl) URL.revokeObjectURL(mediaPreviewObjectUrl);
  mediaPreviewObjectUrl = "";

  if (!file) {
    preview.innerHTML = "";
    dropzone.hidden = false;
    preview.hidden = false;
    uploader.classList.remove("has-media", "has-video");
    feedback.textContent = "";
    resetMediaCropEditor();
    return;
  }
  if (file.size > FILE_LIMITS.media) {
    input.value = "";
    pendingMediaUploadFile = null;
    feedback.textContent = `El archivo supera el máximo de ${formatLimit(FILE_LIMITS.media)}.`;
    return;
  }

  feedback.textContent = "";
  dropzone.hidden = true;
  uploader.classList.add("has-media");
  if (file.type.startsWith("video/")) {
    resetMediaCropEditor();
    uploader.classList.add("has-video");
    preview.hidden = false;
    mediaPreviewObjectUrl = URL.createObjectURL(file);
    preview.innerHTML = `<video src="${mediaPreviewObjectUrl}" controls playsinline preload="metadata"></video>`;
    return;
  }

  uploader.classList.remove("has-video");
  preview.innerHTML = "";
  preview.hidden = true;
  try {
    await loadMediaCrop(file);
    document.getElementById("mediaUploadForm").scrollTo({top: 0, behavior: "instant"});
  } catch (error) {
    pendingMediaUploadFile = null;
    uploader.classList.remove("has-media", "has-video");
    dropzone.hidden = false;
    preview.hidden = false;
    feedback.textContent = error.message || "No se pudo preparar el archivo.";
  }
}

function resetMediaCropEditor() {
  mediaCropImage = null;
  mediaCropZoom = 1;
  mediaCropOffsetX = 0;
  mediaCropOffsetY = 0;
  mediaCropPointer = null;
  mediaFilter = "none";
  mediaOverlayText = "";
  const cropper = document.getElementById("mediaCropper");
  const stage = document.getElementById("mediaCropStage");
  if (cropper) cropper.hidden = true;
  if (stage) stage.classList.remove("dragging");
  const zoom = document.getElementById("mediaCropZoom");
  if (zoom) zoom.value = "1";
  const filter = document.getElementById("mediaFilter");
  const overlay = document.getElementById("mediaOverlayText");
  const original = document.getElementById("mediaKeepOriginal");
  if (filter) filter.value = "none";
  document.querySelectorAll("[data-editor-filter]").forEach(button => button.classList.toggle("active", button.dataset.editorFilter === "none"));
  document.querySelectorAll("[data-media-tool]").forEach(button => {
    button.classList.remove("active");
    button.setAttribute("aria-expanded", "false");
  });
  document.querySelectorAll("[data-media-panel]").forEach(panel => panel.classList.remove("active"));
  if (overlay) overlay.value = "";
  if (original) original.checked = true;
}

function configureMediaCropCanvas() {
  const canvas = document.getElementById("mediaCropCanvas");
  const isMoment = mediaUploadMode === "moment";
  canvas.width = isMoment ? 540 : 720;
  canvas.height = isMoment ? 840 : 720;
  document.getElementById("mediaCropStage").classList.toggle("is-square", !isMoment);
}

function clampMediaCrop() {
  if (!mediaCropImage) return;
  const canvas = document.getElementById("mediaCropCanvas");
  const baseScale = Math.min(canvas.width / mediaCropImage.naturalWidth, canvas.height / mediaCropImage.naturalHeight);
  const scale = baseScale * mediaCropZoom;
  const maxX = Math.max(0, (mediaCropImage.naturalWidth * scale - canvas.width) / 2);
  const maxY = Math.max(0, (mediaCropImage.naturalHeight * scale - canvas.height) / 2);
  mediaCropOffsetX = Math.max(-maxX, Math.min(maxX, mediaCropOffsetX));
  mediaCropOffsetY = Math.max(-maxY, Math.min(maxY, mediaCropOffsetY));
}

function drawMediaCrop() {
  if (!mediaCropImage) return;
  clampMediaCrop();
  const canvas = document.getElementById("mediaCropCanvas");
  const context = canvas.getContext("2d");
  const baseScale = Math.min(canvas.width / mediaCropImage.naturalWidth, canvas.height / mediaCropImage.naturalHeight);
  const scale = baseScale * mediaCropZoom;
  const width = mediaCropImage.naturalWidth * scale;
  const height = mediaCropImage.naturalHeight * scale;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const filters = {none: "none", vivid: "saturate(1.35) contrast(1.08)", warm: "sepia(.18) saturate(1.2)", cool: "hue-rotate(175deg) saturate(.85)", mono: "grayscale(1)", vintage: "sepia(.45) contrast(.9)"};
  context.filter = filters[mediaFilter] || "none";
  context.drawImage(mediaCropImage, (canvas.width - width) / 2 + mediaCropOffsetX, (canvas.height - height) / 2 + mediaCropOffsetY, width, height);
  context.filter = "none";
  if (mediaOverlayText) {
    context.font = `700 ${Math.max(28, canvas.width * .055)}px Inter, sans-serif`;
    context.textAlign = "center";
    context.lineWidth = 8;
    context.strokeStyle = "rgba(0,0,0,.75)";
    context.fillStyle = "white";
    context.strokeText(mediaOverlayText, canvas.width / 2, canvas.height * .88, canvas.width * .86);
    context.fillText(mediaOverlayText, canvas.width / 2, canvas.height * .88, canvas.width * .86);
  }
}

function loadMediaCrop(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      mediaCropImage = image;
      mediaCropZoom = 1;
      mediaCropOffsetX = 0;
      mediaCropOffsetY = 0;
      configureMediaCropCanvas();
      document.getElementById("mediaCropZoom").value = "1";
      document.getElementById("mediaCropper").hidden = false;
      const form = document.getElementById("mediaUploadForm");
      form.scrollTop = 0;
      drawMediaCrop();
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo abrir la foto seleccionada."));
    };
    image.src = objectUrl;
  });
}

function createCroppedMediaFile() {
  return new Promise((resolve, reject) => {
    document.getElementById("mediaCropCanvas").toBlob(blob => {
      if (!blob) return reject(new Error("No se pudo preparar la foto."));
      resolve(new File([blob], "momento.webp", {type: "image/webp"}));
    }, "image/webp", .9);
  });
}

async function publishMedia(form) {
  const file = pendingMediaUploadFile || document.getElementById("mediaUploadFile").files[0];
  const feedback = document.getElementById("mediaUploadFeedback");
  const submit = form.querySelector("[type=submit]");
  if (!file) return;
  submit.disabled = true;
  feedback.textContent = "Subiendo…";
  try {
    if (!backendReady || !currentAuthUser) throw new Error("Necesitas la conexión compartida para publicar.");
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) throw new Error("Selecciona una imagen o vídeo compatible.");
    const keepOriginal = document.getElementById("mediaKeepOriginal")?.checked && mediaFilter === "none" && !mediaOverlayText;
    const mediaFile = file.type.startsWith("image/") && mediaCropImage && !keepOriginal ? await createCroppedMediaFile() : file;
    const mediaUrl = await uploadGroupMedia(mediaFile, mediaUploadMode === "moment" ? "moments" : "posts");
    const record = {
      user_id: currentAuthUser.id, legacy_id: currentUser.id,
      caption: document.getElementById("mediaUploadCaption").value.trim(),
      mentioned_user_id: resolveMediaMention(),
      media_url: mediaUrl, media_type: file.type.startsWith("video/") ? "video" : "image"
    };
    const table = mediaUploadMode === "moment" ? "moments" : "profile_posts";
    const {data, error} = await db.from(table).insert(record).select("id").single();
    if (error) throw error;
    dispatchPush("media_created", `${mediaUploadMode}:${data.id}`);
    closeMediaUploader();
    if (mediaUploadMode === "moment") {
      await loadMoments();
      goTo("momentos");
    } else {
      await loadProfilePosts();
      goTo("publicaciones");
    }
  } catch (error) {
    feedback.textContent = error.message || "No se pudo publicar el archivo.";
  } finally {
    submit.disabled = false;
  }
}

async function deleteMedia(kind, id) {
  if (!backendReady || !currentAuthUser) return;
  const table = kind === "moment" ? "moments" : "profile_posts";
  const collection = kind === "moment" ? moments : profilePosts;
  const item = collection.find(entry => String(entry.id) === String(id));
  const isOwner = isMediaOwner(item);
  if (!item || (!isOwner && !isSuperAdmin())) return;
  if (!window.confirm(`¿Quieres eliminar ${kind === "moment" ? "este momento" : "esta publicación"}?`)) return;
  let query = db.from(table).delete().eq("id", item.id);
  if (!isSuperAdmin()) query = query.eq("user_id", currentAuthUser.id);
  const {error} = await query;
  if (error) return;
  if (kind === "moment") await loadMoments();
  else await loadProfilePosts();
}

function isMediaOwner(item) {
  if (!item || !currentUser) return false;
  const mediaAuthId = String(item.userId || "").toLowerCase();
  const sessionAuthId = String(currentAuthUser?.id || "").toLowerCase();
  const profileAuthId = String(currentUser.authId || "").toLowerCase();
  return Boolean(mediaAuthId && (mediaAuthId === sessionAuthId || mediaAuthId === profileAuthId))
    || (item.member != null && String(item.member) === String(currentUser.id));
}

function storyOwnerKey(item) {
  return String(item?.userId || `legacy-${item?.member ?? "unknown"}`);
}

function viewedMomentsStorageKey() {
  return `bb-viewed-moments-${currentAuthUser?.id || currentUser?.id || "guest"}`;
}

function getViewedMomentIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(viewedMomentsStorageKey()) || "[]").map(String));
  } catch {
    return new Set();
  }
}

function hasViewedMoment(id) {
  return getViewedMomentIds().has(String(id));
}

function markMomentViewed(id) {
  const viewed = getViewedMomentIds();
  viewed.add(String(id));
  localStorage.setItem(viewedMomentsStorageKey(), JSON.stringify([...viewed].slice(-500)));
}

function openMediaViewer(url, caption = "Momento", mediaType = "image") {
  const viewer = document.getElementById("mediaViewer");
  const image = document.getElementById("mediaViewerImage");
  const video = document.getElementById("mediaViewerVideo");
  const isVideo = mediaType === "video";
  image.hidden = isVideo;
  video.hidden = !isVideo;
  image.src = isVideo ? "" : url;
  image.alt = caption;
  video.src = isVideo ? url : "";
  document.getElementById("mediaViewerCaption").textContent = caption;
  viewer.classList.add("open");
  viewer.setAttribute("aria-hidden", "false");
}

function closeMediaViewer() {
  clearTimeout(momentAdvanceTimer);
  momentAdvanceTimer = null;
  momentAdvanceDeadline = 0;
  momentAdvanceRemaining = 6000;
  activeMomentSequence = [];
  activeMomentIndex = -1;
  suppressMomentNavigationClick = false;
  const viewer = document.getElementById("mediaViewer");
  viewer.classList.remove("open");
  viewer.setAttribute("aria-hidden", "true");
  document.getElementById("mediaViewerImage").src = "";
  const video = document.getElementById("mediaViewerVideo");
  video.pause();
  video.src = "";
  document.getElementById("momentProgress").hidden = true;
  document.getElementById("previousMoment").hidden = true;
  document.getElementById("nextMoment").hidden = true;
  document.getElementById("momentOptionsButton").hidden = true;
  document.getElementById("momentOptionsButton").setAttribute("aria-expanded", "false");
  document.getElementById("momentOptionsMenu").hidden = true;
  if (typeof clearMomentGesture === "function") clearMomentGesture();
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function openMoment(momentId) {
  const item = moments.find(moment => String(moment.id) === String(momentId));
  if (!item) return window.alert("Este momento ya no está disponible.");
  activeMomentSequence = moments
    .filter(moment => storyOwnerKey(moment) === storyOwnerKey(item))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  activeMomentIndex = activeMomentSequence.findIndex(moment => String(moment.id) === String(momentId));
  showActiveMoment();
}

function showActiveMoment() {
  const item = activeMomentSequence[activeMomentIndex];
  if (!item) return closeMediaViewer();
  clearTimeout(momentAdvanceTimer);
  momentAdvanceTimer = null;
  momentAdvanceDeadline = 0;
  momentAdvanceRemaining = 6000;
  const member = getMember(item.member);
  markMomentViewed(item.id);
  registerMomentView(item);
  openMediaViewer(item.mediaUrl, item.caption || `Momento de ${member?.name || "miembro"}`, item.mediaType);
  const progress = document.getElementById("momentProgress");
  progress.classList.remove("paused");
  progress.hidden = false;
  progress.innerHTML = activeMomentSequence.map((_, index) => `<span class="${index < activeMomentIndex ? "complete" : index === activeMomentIndex ? "active" : ""}"><i></i></span>`).join("");
  document.getElementById("previousMoment").hidden = activeMomentIndex === 0;
  document.getElementById("nextMoment").hidden = false;
  const canDeleteMoment = isMediaOwner(item) || isSuperAdmin();
  document.getElementById("momentOptionsButton").hidden = !canDeleteMoment;
  document.getElementById("momentOptionsButton").setAttribute("aria-expanded", "false");
  document.getElementById("momentOptionsMenu").hidden = true;
  renderMoments();
  if (item.mediaType !== "video") scheduleMomentAdvance();
}

function scheduleMomentAdvance(delay = momentAdvanceRemaining) {
  clearTimeout(momentAdvanceTimer);
  momentAdvanceRemaining = Math.max(80, delay);
  momentAdvanceDeadline = Date.now() + momentAdvanceRemaining;
  momentAdvanceTimer = setTimeout(nextMoment, momentAdvanceRemaining);
}

function pauseActiveMoment() {
  const item = activeMomentSequence[activeMomentIndex];
  if (!item || item.mediaType === "video" || !momentAdvanceTimer) return;
  momentAdvanceRemaining = Math.max(80, momentAdvanceDeadline - Date.now());
  clearTimeout(momentAdvanceTimer);
  momentAdvanceTimer = null;
  document.getElementById("momentProgress").classList.add("paused");
}

function resumeActiveMoment() {
  const item = activeMomentSequence[activeMomentIndex];
  if (!item || item.mediaType === "video" || momentAdvanceTimer) return;
  document.getElementById("momentProgress").classList.remove("paused");
  scheduleMomentAdvance();
}

function nextMoment() {
  if (!activeMomentSequence.length) return;
  if (activeMomentIndex >= activeMomentSequence.length - 1) return closeMediaViewer();
  activeMomentIndex += 1;
  showActiveMoment();
}

function previousMoment() {
  if (!activeMomentSequence.length || activeMomentIndex <= 0) return;
  activeMomentIndex -= 1;
  showActiveMoment();
}

async function deleteActiveMoment() {
  const item = activeMomentSequence[activeMomentIndex];
  if (!item || (!isMediaOwner(item) && !isSuperAdmin()) || !backendReady || !currentAuthUser) return;
  if (!window.confirm("¿Quieres eliminar esta historia?")) return;
  let query = db.from("moments").delete().eq("id", item.id);
  if (!isSuperAdmin()) query = query.eq("user_id", currentAuthUser.id);
  const {error} = await query;
  if (error) return window.alert(error.message || "No se pudo eliminar la historia.");
  activeMomentSequence.splice(activeMomentIndex, 1);
  moments = moments.filter(moment => String(moment.id) !== String(item.id));
  if (!activeMomentSequence.length) closeMediaViewer();
  else {
    activeMomentIndex = Math.min(activeMomentIndex, activeMomentSequence.length - 1);
    showActiveMoment();
  }
  await loadMoments();
}

function openContent(kind, id) {
  const item = (kind === "moment" ? moments : profilePosts).find(entry => String(entry.id) === String(id));
  if (!item) return window.alert("Este contenido ya no está disponible.");
  if (kind === "moment") registerMomentView(item);
  openMediaViewer(item.mediaUrl, item.caption || (kind === "moment" ? "Momento" : "Publicación"), item.mediaType);
}

async function registerMomentView(item) {
  if (!backendReady || !currentAuthUser || item.userId === currentAuthUser.id) return;
  await db.from("moment_views").upsert({moment_id: item.id, viewer_id: currentAuthUser.id}, {onConflict: "moment_id,viewer_id"});
}

async function replyToMedia(kind, id) {
  if (!backendReady || !currentAuthUser || isSuperAdmin()) return;
  const item = (kind === "moment" ? moments : profilePosts).find(entry => String(entry.id) === String(id));
  if (!item) return;
  replyingMedia = {kind, id, item};
  const member = getMember(item.member);
  document.getElementById("mediaReplyTitle").textContent = `Responder ${kind === "moment" ? "historia" : "publicación"}`;
  document.getElementById("mediaReplyContext").innerHTML = `${item.mediaUrl ? `<img src="${escapeHtml(item.mediaUrl)}" alt="">` : ""}<div><strong>${escapeHtml(member?.name || "Miembro")}</strong><small>${escapeHtml(item.caption || (kind === "moment" ? "Historia" : "Publicación"))}</small></div>`;
  document.getElementById("mediaReplyBody").value = "";
  document.getElementById("mediaReplyFeedback").textContent = "";
  openModal("mediaReplyModal");
  setTimeout(() => document.getElementById("mediaReplyBody").focus(), 80);
}

function closeMediaReply() {
  replyingMedia = null;
  closeModal("mediaReplyModal");
}

async function submitMediaReply(form) {
  if (!replyingMedia) return;
  const body = document.getElementById("mediaReplyBody").value.trim();
  if (!body) return;
  const submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  const {kind, id} = replyingMedia;
  const record = {user_id: currentAuthUser.id, body, moment_id: kind === "moment" ? id : null, profile_post_id: kind === "post" ? id : null};
  const {data, error} = await db.from("media_replies").insert(record).select("id").single();
  submit.disabled = false;
  if (error) return void (document.getElementById("mediaReplyFeedback").textContent = error.message || "No se pudo enviar la respuesta.");
  dispatchPush("reply", data.id);
  closeMediaReply();
}

const HELP_STATUS = Object.freeze({
  new: {label: "Nueva", className: "new"},
  in_progress: {label: "En proceso", className: "in-progress"},
  answered: {label: "Respondida", className: "answered"},
  closed: {label: "Cerrada", className: "closed"},
});
const HELP_TYPES = Object.freeze({help: "Ayuda", suggestion: "Sugerencia", complaint: "Queja"});

function helpStatus(status) {
  return HELP_STATUS[status] || HELP_STATUS.new;
}

async function loadHelpCenter() {
  if (!backendReady || !currentAuthUser) return;
  const [requestResult, messageResult] = await Promise.all([
    db.from("help_requests").select("*").order("updated_at", {ascending: false}).limit(250),
    db.from("help_messages").select("*").order("created_at").limit(1000),
  ]);
  if (requestResult.error || messageResult.error) {
    const list = document.getElementById("helpRequestList");
    if (list) list.innerHTML = `<div class="empty-state compact"><strong>No se pudo abrir Ayuda</strong><span>${escapeHtml(requestResult.error?.message || messageResult.error?.message || "Inténtalo de nuevo.")}</span></div>`;
    return;
  }
  helpRequests = (requestResult.data || []).map(item => ({
    id: item.id, userId: item.user_id, type: item.request_type, status: item.status,
    handledBy: item.handled_by, createdAt: item.created_at, updatedAt: item.updated_at,
  }));
  helpMessages = (messageResult.data || []).map(item => ({
    id: item.id, requestId: item.request_id, senderId: item.sender_id,
    body: item.body, createdAt: item.created_at,
  }));
  if (activeHelpRequestId && !helpRequests.some(item => String(item.id) === String(activeHelpRequestId))) activeHelpRequestId = null;
  renderHelpCenter();
}

function renderHelpCenter() {
  const list = document.getElementById("helpRequestList");
  if (!list) return;
  const isAdmin = canManageSite();
  document.getElementById("helpCenterTitle").textContent = isAdmin ? "Bandeja de administración." : "Ayuda y sugerencias.";
  document.getElementById("helpCenterDescription").textContent = isAdmin
    ? "Todas las peticiones del club llegan aquí. Respóndelas y actualiza su estado sin mezclarlas con los mensajes privados."
    : "Crea una petición privada para el equipo de administración y sigue aquí todas sus respuestas.";
  document.getElementById("helpInboxEyebrow").textContent = isAdmin ? "TODAS LAS PETICIONES" : "MIS PETICIONES";
  document.getElementById("helpRequestCount").textContent = String(helpRequests.length);

  const filtered = activeHelpFilter === "all" ? helpRequests : helpRequests.filter(item => item.status === activeHelpFilter);
  list.innerHTML = filtered.length ? filtered.map(item => {
    const status = helpStatus(item.status);
    const author = getMemberByAuthId(item.userId);
    const latest = [...helpMessages].reverse().find(message => String(message.requestId) === String(item.id));
    return `<button class="help-request-card ${String(activeHelpRequestId) === String(item.id) ? "active" : ""}" type="button" data-help-request="${item.id}">
      <span class="help-request-card-top"><b>${escapeHtml(HELP_TYPES[item.type] || "Ayuda")} · #${item.id}</b><i class="help-status-badge ${status.className}">${status.label}</i></span>
      ${isAdmin ? `<strong>${escapeHtml(author?.name || "Miembro")}</strong>` : ""}
      <small>${escapeHtml(latest?.body || "Petición creada")}</small>
      <time datetime="${escapeHtml(item.updatedAt)}">${formatRelativeTime(item.updatedAt)}</time>
    </button>`;
  }).join("") : `<div class="empty-state compact">No hay peticiones en este estado.</div>`;

  const active = helpRequests.find(item => String(item.id) === String(activeHelpRequestId));
  const conversation = document.getElementById("helpConversation");
  const empty = document.getElementById("helpConversationEmpty");
  conversation.hidden = !active;
  empty.hidden = Boolean(active);
  if (!active) {
    document.getElementById("helpClosedNotice").hidden = true;
    const replyForm = document.getElementById("helpReplyForm");
    replyForm.hidden = false;
    replyForm.querySelector("textarea").disabled = false;
    replyForm.querySelector("button").disabled = false;
    document.getElementById("helpRequestStatus").disabled = false;
    document.getElementById("helpAdminStatus").classList.remove("locked");
    return;
  }

  const status = helpStatus(active.status);
  const isClosed = active.status === "closed";
  const author = getMemberByAuthId(active.userId);
  document.getElementById("helpConversationMeta").textContent = `PETICIÓN #${active.id} · ${HELP_TYPES[active.type] || "AYUDA"}`;
  document.getElementById("helpConversationTitle").textContent = isAdmin ? author?.name || "Miembro" : HELP_TYPES[active.type] || "Ayuda";
  document.getElementById("helpConversationAuthor").textContent = isAdmin ? `@${author?.username || "usuario"}` : "Conversación privada con administración";
  const adminStatus = document.getElementById("helpAdminStatus");
  adminStatus.hidden = !isAdmin;
  const statusSelect = document.getElementById("helpRequestStatus");
  statusSelect.value = active.status;
  statusSelect.disabled = isClosed;
  adminStatus.classList.toggle("locked", isClosed);
  const memberStatus = document.getElementById("helpMemberStatus");
  memberStatus.hidden = isAdmin;
  memberStatus.className = `help-status-badge ${status.className}`;
  memberStatus.textContent = status.label;

  const messages = helpMessages.filter(message => String(message.requestId) === String(active.id));
  const messageList = document.getElementById("helpMessageList");
  messageList.innerHTML = messages.map(message => {
    const sender = getMemberByAuthId(message.senderId);
    const own = message.senderId === currentAuthUser?.id;
    const senderIsAdmin = sender?.roleKey === "admin" || sender?.roleKey === "superadmin";
    return `<article class="help-message ${own ? "own" : ""} ${senderIsAdmin ? "from-admin" : ""}">
      ${getAvatar(sender, "avatar tiny")}<div><span><strong>${escapeHtml(sender?.name || (senderIsAdmin ? "Administración" : "Miembro"))}</strong><time datetime="${escapeHtml(message.createdAt)}">${formatMessageDate(message.createdAt)}</time></span><p>${escapeHtml(message.body).replace(/\n/g, "<br>")}</p></div>
    </article>`;
  }).join("");
  document.getElementById("helpClosedNotice").hidden = !isClosed;
  const replyForm = document.getElementById("helpReplyForm");
  replyForm.hidden = isClosed;
  replyForm.querySelector("textarea").disabled = isClosed;
  replyForm.querySelector("button").disabled = isClosed;
  document.getElementById("helpReplyFeedback").textContent = "";
  requestAnimationFrame(() => { messageList.scrollTop = messageList.scrollHeight; });
}

async function submitHelpRequest(form) {
  if (!backendReady || !currentAuthUser) return;
  const message = document.getElementById("helpRequestMessage").value.trim();
  const type = document.getElementById("helpRequestType").value;
  const feedback = document.getElementById("helpRequestFeedback");
  if (!message) return;
  const submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  feedback.textContent = "Enviando petición…";
  try {
    const {data: requestId, error} = await db.rpc("create_help_request", {new_type: type, initial_body: message});
    if (error) throw error;
    form.reset();
    feedback.textContent = "Petición enviada a todos los administradores.";
    activeHelpRequestId = requestId;
    activeHelpFilter = "all";
    document.querySelectorAll("[data-help-filter]").forEach(button => button.classList.toggle("active", button.dataset.helpFilter === "all"));
    await loadHelpCenter();
  } catch (error) {
    feedback.textContent = error.message || "No se pudo enviar la petición.";
  } finally {
    submit.disabled = false;
  }
}

async function submitHelpReply(form) {
  const body = document.getElementById("helpReplyMessage").value.trim();
  const feedback = document.getElementById("helpReplyFeedback");
  if (!body || !activeHelpRequestId || !currentAuthUser) return;
  const active = helpRequests.find(item => String(item.id) === String(activeHelpRequestId));
  if (active?.status === "closed") {
    feedback.textContent = "Esta petición está cerrada y ya no admite respuestas.";
    return;
  }
  const submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  feedback.textContent = "Enviando…";
  const {error} = await db.from("help_messages").insert({request_id: activeHelpRequestId, sender_id: currentAuthUser.id, body});
  submit.disabled = false;
  if (error) return void (feedback.textContent = error.message || "No se pudo enviar la respuesta.");
  form.reset();
  feedback.textContent = "";
  await loadHelpCenter();
}

async function updateHelpRequestStatus(status) {
  if (!canManageSite() || !activeHelpRequestId || !HELP_STATUS[status]) return;
  const active = helpRequests.find(item => String(item.id) === String(activeHelpRequestId));
  const select = document.getElementById("helpRequestStatus");
  if (!active || active.status === "closed") {
    if (active) select.value = active.status;
    return window.alert("Una petición cerrada no puede volver a abrirse ni modificarse.");
  }
  if (status === "closed" && !window.confirm("¿Cerrar esta petición definitivamente? Después no se podrá responder ni cambiar su estado.")) {
    select.value = active.status;
    return;
  }
  const values = {status, handled_by: status === "new" ? null : currentAuthUser.id, updated_at: new Date().toISOString()};
  const {data, error} = await db.from("help_requests").update(values).eq("id", activeHelpRequestId).neq("status", "closed").select("id").maybeSingle();
  if (error) return window.alert(error.message || "No se pudo cambiar el estado.");
  if (!data) return void window.alert("La petición ya estaba cerrada y no puede modificarse.");
  await loadHelpCenter();
}

async function showMomentViewers(id) {
  const moment = moments.find(item => String(item.id) === String(id));
  if (!moment || !isMediaOwner(moment)) return;
  const {data, error} = await db.from("moment_views").select("viewer_id,viewed_at").eq("moment_id", id).order("viewed_at", {ascending: false}).limit(250);
  if (error) return window.alert(error.message);
  const names = (data || []).map(view => members.find(member => member.authId === view.viewer_id)?.name || "Miembro");
  window.alert(names.length ? `Visto por ${names.length}:\n\n${names.join("\n")}` : "Todavía nadie ha visto este momento.");
}

async function editGroupMessage(id) {
  if (!backendReady || !currentAuthUser) return;
  const message = messages.find(item => String(item.id) === String(id));
  if (!message || message.userId !== currentAuthUser.id || !message.text) return;
  const body = window.prompt("Edita tu mensaje:", message.text);
  if (body == null) return;
  const cleanBody = body.trim();
  if (!cleanBody || cleanBody.length > 1200 || cleanBody === message.text) return;
  const {error} = await db.from("messages").update({body: cleanBody}).eq("id", message.id).eq("user_id", currentAuthUser.id);
  if (error) return window.alert(error.message || "No se pudo editar el mensaje.");
  await loadMessages();
}

async function deleteGroupMessage(id) {
  if (!backendReady || !currentAuthUser) return;
  const message = messages.find(item => String(item.id) === String(id));
  if (!message || (message.userId !== currentAuthUser.id && !canManageSite())) return;
  if (!window.confirm("¿Quieres eliminar este mensaje?")) return;
  const {error} = await db.from("messages").delete().eq("id", id);
  if (error) return window.alert(error.message || "No se pudo eliminar el mensaje.");
  await loadMessages();
}

async function editPrivateMessage(id) {
  if (!backendReady || !currentAuthUser) return;
  const message = privateMessages.find(item => String(item.id) === String(id));
  if (!message || message.senderId !== currentAuthUser.id) return;
  const body = window.prompt("Edita tu mensaje privado:", message.body);
  if (body == null) return;
  const cleanBody = body.trim();
  if (!cleanBody || cleanBody.length > 1200 || cleanBody === message.body) return;
  const {error} = await db.from("private_messages").update({body: cleanBody})
    .eq("id", message.id).eq("sender_id", currentAuthUser.id);
  if (error) return window.alert(error.message || "No se pudo editar el mensaje.");
  await loadPrivateMessages();
}

async function deletePrivateMessage(id) {
  if (!backendReady || !currentAuthUser) return;
  const message = privateMessages.find(item => String(item.id) === String(id));
  if (!message || message.senderId !== currentAuthUser.id) return;
  if (!window.confirm("¿Quieres eliminar este mensaje privado?")) return;
  const {error} = await db.from("private_messages").delete()
    .eq("id", message.id).eq("sender_id", currentAuthUser.id);
  if (error) return window.alert(error.message || "No se pudo eliminar el mensaje.");
  await loadPrivateMessages();
}

async function invokeUserAdmin(action, values) {
  if (!canManageSite() || !db) throw new Error("No tienes permiso para administrar cuentas.");
  const {data, error} = await db.functions.invoke("admin-users", {body: {action, ...values}});
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

async function createClubUser(form) {
  const feedback = document.getElementById("createUserFeedback");
  const submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  feedback.textContent = "Creando cuenta…";
  try {
    await invokeUserAdmin("create", {
      username: document.getElementById("newUsername").value,
      displayName: document.getElementById("newDisplayName").value,
      password: document.getElementById("newUserPassword").value
    });
    form.reset();
    feedback.textContent = "Usuario creado correctamente.";
    await loadRemoteProfiles();
  } catch (error) {
    feedback.textContent = error.message || "No se pudo crear el usuario.";
  } finally {
    submit.disabled = false;
  }
}

async function deleteClubUser(authId, name) {
  if (!isSuperAdmin() || !authId) return;
  const confirmations = [
    `¿Seguro que quieres eliminar la cuenta de ${name}?`,
    `Segunda confirmación: se eliminarán también sus mensajes y publicaciones. ¿Continuar?`,
    `Última confirmación: esta acción es definitiva. ¿Eliminar a ${name}?`
  ];
  for (const message of confirmations) {
    if (!window.confirm(message)) return;
  }
  try {
    await invokeUserAdmin("delete", {userId: authId});
    members = members.filter(member => member.authId !== authId);
    await loadRemoteProfiles();
  } catch (error) {
    window.alert(error.message || "No se pudo eliminar la cuenta.");
  }
}

async function resetClubUserPassword(authId, name) {
  if (!canManageSite() || !authId) return;
  const password = window.prompt(`Escribe la nueva contraseña provisional para ${name} (mínimo 8 caracteres):`);
  if (password == null) return;
  const confirmation = window.prompt("Repítela para confirmar:");
  if (password.length < 8 || password !== confirmation) return window.alert("Las contraseñas no coinciden o son demasiado cortas.");
  if (!window.confirm(`¿Cambiar la contraseña de ${name}? Al entrar tendrá que crear una personal.`)) return;
  try {
    await invokeUserAdmin("reset-password", {userId: authId, password});
    window.alert("Contraseña provisional actualizada.");
  } catch (error) {
    window.alert(error.message || "No se pudo cambiar la contraseña.");
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadNews(force = false) {
  const grid = document.getElementById("newsGrid");
  const status = document.getElementById("newsStatus");
  const cacheKey = `bb-news-${activeNewsCategory}`;
  const requestedCategory = activeNewsCategory;
  const requestToken = ++newsLoadToken;
  let cachedNews = null;
  if (!force) {
    try {
      cachedNews = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      if (cachedNews && Date.now() - cachedNews.savedAt < NEWS_CACHE_DURATION) {
        lastNewsRefreshAt = cachedNews.savedAt;
        renderNews(cachedNews.items, cachedNews.feedTitle, cachedNews.savedAt);
        return;
      }
    } catch {}
  } else {
    try {
      cachedNews = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    } catch {}
  }
  grid.innerHTML = "";
  status.textContent = "Cargando titulares desde fuentes reales…";
  if (!backendReady || !db || !currentAuthUser) {
    status.textContent = "Las noticias se cargarán al iniciar sesión.";
    return;
  }
  try {
    const {data, error} = await db.functions.invoke("news-feed", {body: {category: activeNewsCategory}});
    if (error) throw new Error(error.context?.body?.error || error.message || "El servicio de noticias no responde.");
    if (!data?.items?.length) throw new Error(data?.error || "No se recibieron titulares.");
    const combined = data.items.map(item => ({
      title: item.title, link: item.link, published: item.published,
      source: item.source || extractNewsSource(item.title), image: item.image || ""
    }));
    const seenNews = new Set();
    const items = combined.sort((a, b) => newsTimestamp(b.published) - newsTimestamp(a.published)).filter(item => {
      const key = normalizeUsername(item.title.replace(/\s+-\s+[^-]+$/, ""));
      if (!key || seenNews.has(key)) return false;
      seenNews.add(key);
      return true;
    }).slice(0, 30);
    if (requestToken !== newsLoadToken || requestedCategory !== activeNewsCategory) return;
    const savedAt = Date.now();
    lastNewsRefreshAt = savedAt;
    const feedTitle = `${data.sources || 1} fuentes de actualidad`;
    sessionStorage.setItem(cacheKey, JSON.stringify({savedAt, items, feedTitle}));
    renderNews(items, feedTitle, savedAt);
  } catch (error) {
    if (requestToken !== newsLoadToken || requestedCategory !== activeNewsCategory) return;
    if (cachedNews?.items?.length) {
      renderNews(cachedNews.items, cachedNews.feedTitle, cachedNews.savedAt);
      status.textContent = `${status.textContent} · No se pudo conectar; mostrando los últimos titulares guardados`;
      return;
    }
    status.textContent = `No se pudieron actualizar las noticias: ${error.message}`;
    grid.innerHTML = `<div class="empty-state"><strong>Sin titulares disponibles</strong><span>Inténtalo de nuevo en unos minutos.</span></div>`;
  }
}

function extractNewsSource(title) {
  const parts = title.split(" - ");
  return parts.length > 1 ? parts.pop() : "Medio de comunicación";
}

function renderNews(items, feedTitle, refreshedAt = Date.now()) {
  const sortedItems = [...items].sort((a, b) => newsTimestamp(b.published) - newsTimestamp(a.published));
  newsItems = sortedItems;
  const sourceCount = new Set(sortedItems.map(item => item.source)).size;
  document.getElementById("newsStatus").textContent = `Actualizado ${formatRelativeTime(refreshedAt).toLowerCase()} · Refresco automático cada 2 min · ${sourceCount} medios · ${feedTitle}`;
  document.getElementById("newsGrid").innerHTML = sortedItems.map((item, index) => {
    const cleanTitle = item.title.replace(new RegExp(` - ${item.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
    item.cleanTitle = cleanTitle;
    const publishedTimestamp = newsTimestamp(item.published);
    const publishedDateTime = publishedTimestamp ? new Date(publishedTimestamp).toISOString() : "";
    return `<article class="news-card ${index === 0 ? "featured" : ""}">
      <div class="news-card-meta"><span>${escapeHtml(item.source)}</span><time${publishedDateTime ? ` datetime="${publishedDateTime}"` : ""}>${formatNewsDate(item.published)}</time></div>
      <h3>${escapeHtml(cleanTitle)}</h3>
      <div class="news-card-actions"><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">Leer en la fuente →</a>${!isSuperAdmin() ? `<button class="media-share-button news-share-button" type="button" data-share-news="${index}" aria-label="Compartir noticia"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></svg><small>Compartir</small></button>` : ""}</div>
    </article>`;
  }).join("");
}

function newsTimestamp(value) {
  if (!value) return 0;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatNewsDate(value) {
  const timestamp = newsTimestamp(value);
  if (!timestamp) return "Fecha no disponible";
  const date = new Date(timestamp);
  return date.toLocaleString("es-ES", {day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"});
}

function formatMessageDate(value) {
  const date = new Date(value);
  return date.toLocaleString("es-ES", {day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"});
}

function formatRelativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Ahora";
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
  return new Date(value).toLocaleDateString("es-ES");
}

function formatExpiry(value) {
  const minutes = Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 60000));
  if (minutes < 60) return `en ${minutes} min`;
  return `en ${Math.ceil(minutes / 60)} h`;
}

function formatFileSize(bytes) {
  if (!bytes) return "Archivo";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

document.addEventListener("click", event => {
  const chatBack = event.target.closest("[data-chat-back]");
  if (chatBack) exitChatView();
  const privateBack = event.target.closest("[data-private-back]");
  if (privateBack) backFromPrivateConversation();
  const messageBubble = event.target.closest("[data-message-bubble]");
  if (messageBubble && !event.target.closest("button,a")) {
    const wasOpen = messageBubble.classList.contains("actions-open");
    document.querySelectorAll("[data-message-bubble].actions-open").forEach(item => item.classList.remove("actions-open"));
    messageBubble.classList.toggle("actions-open", !wasOpen);
  } else if (!event.target.closest(".message-actions")) {
    document.querySelectorAll("[data-message-bubble].actions-open").forEach(item => item.classList.remove("actions-open"));
  }
  const likeMedia = event.target.closest("[data-like-media]");
  if (likeMedia) {
    event.preventDefault();
    event.stopPropagation();
    toggleMediaLike(likeMedia.dataset.likeKind, likeMedia.dataset.likeMedia, likeMedia);
    return;
  }
  const shareMediaTarget = event.target.closest("[data-share-media]");
  if (shareMediaTarget) {
    event.preventDefault();
    event.stopPropagation();
    openShareMedia(shareMediaTarget.dataset.shareKind, shareMediaTarget.dataset.shareMedia);
    return;
  }
  const shareNewsTarget = event.target.closest("[data-share-news]");
  if (shareNewsTarget) {
    event.preventDefault();
    event.stopPropagation();
    openShareNews(shareNewsTarget.dataset.shareNews);
    return;
  }
  const sharedMediaTarget = event.target.closest("[data-open-shared-kind]");
  if (sharedMediaTarget) {
    event.preventDefault();
    event.stopPropagation();
    openSharedMedia(sharedMediaTarget.dataset.openSharedKind, sharedMediaTarget.dataset.openSharedId);
    return;
  }
  const momentTarget = event.target.closest("[data-open-moment]");
  if (momentTarget) {
    event.preventDefault();
    openMoment(momentTarget.dataset.openMoment);
    return;
  }
  const openContentTarget = event.target.closest("[data-open-content-kind]");
  if (openContentTarget) openContent(openContentTarget.dataset.openContentKind, openContentTarget.dataset.openContentId);
  const replyMediaTarget = event.target.closest("[data-reply-media]");
  if (replyMediaTarget) replyToMedia(replyMediaTarget.dataset.replyKind, replyMediaTarget.dataset.replyMedia);
  const viewersTarget = event.target.closest("[data-moment-viewers]");
  if (viewersTarget) showMomentViewers(viewersTarget.dataset.momentViewers);
  const goTarget = event.target.closest("[data-go]");
  if (goTarget) goTo(goTarget.dataset.go);
  const profileTarget = event.target.closest("[data-profile]");
  if (profileTarget) renderProfile(profileTarget.dataset.profile);
  const deleteMoment = event.target.closest("[data-delete-moment]");
  if (deleteMoment) deleteMedia("moment", deleteMoment.dataset.deleteMoment);
  const viewMedia = event.target.closest("[data-view-media]");
  if (viewMedia) openMediaViewer(viewMedia.dataset.viewMedia, viewMedia.dataset.viewCaption);
  const deletePost = event.target.closest("[data-delete-post]");
  if (deletePost) deleteMedia("post", deletePost.dataset.deletePost);
  const notificationTarget = event.target.closest("[data-notification-id]");
  if (notificationTarget) openNotification(notificationTarget.dataset.notificationId);
  const editGroupTarget = event.target.closest("[data-edit-group-message]");
  if (editGroupTarget) editGroupMessage(editGroupTarget.dataset.editGroupMessage);
  const deleteGroupTarget = event.target.closest("[data-delete-group-message]");
  if (deleteGroupTarget) deleteGroupMessage(deleteGroupTarget.dataset.deleteGroupMessage);
  const editPrivateTarget = event.target.closest("[data-edit-private-message]");
  if (editPrivateTarget) editPrivateMessage(editPrivateTarget.dataset.editPrivateMessage);
  const deletePrivateTarget = event.target.closest("[data-delete-private-message]");
  if (deletePrivateTarget) deletePrivateMessage(deletePrivateTarget.dataset.deletePrivateMessage);
  const deleteUser = event.target.closest("[data-delete-user]");
  if (deleteUser) deleteClubUser(deleteUser.dataset.deleteUser, deleteUser.dataset.deleteUserName);
  const resetPassword = event.target.closest("[data-reset-password]");
  if (resetPassword) resetClubUserPassword(resetPassword.dataset.resetPassword, resetPassword.dataset.resetPasswordName);
  const editUser = event.target.closest("[data-edit-user]");
  if (editUser) openProfileEditor(editUser.dataset.editUser);
  const renameUser = event.target.closest("[data-rename-user]");
  if (renameUser) renameClubUser(renameUser.dataset.renameUser);
  const changeRole = event.target.closest("[data-change-role]");
  if (changeRole) changeClubUserRole(changeRole.dataset.changeRole);
  const adminMessage = event.target.closest("[data-admin-message]");
  if (adminMessage) openPrivateConversation(adminMessage.dataset.adminMessage);
  const channelTarget = event.target.closest("[data-chat-channel]");
  if (channelTarget && !event.target.closest("[data-delete-channel]")) selectChatChannel(channelTarget.dataset.chatChannel);
  const deleteChannel = event.target.closest("[data-delete-channel]");
  if (deleteChannel) deleteChatChannel(deleteChannel.dataset.deleteChannel);
  const privateTarget = event.target.closest("[data-private-member]");
  if (privateTarget) openPrivateConversation(privateTarget.dataset.privateMember);
  const groupChatTarget = event.target.closest("[data-open-group-chat]");
  if (groupChatTarget) openGroupConversation();
  const clearChatAttachment = event.target.closest("[data-clear-chat-attachment]");
  if (clearChatAttachment) clearPendingChatFile(clearChatAttachment.dataset.clearChatAttachment);
  const eventTarget = event.target.closest("[data-event-id]");
  if (eventTarget) openEventEditor(eventTarget.dataset.eventId);
  const calendarDayTarget = event.target.closest("[data-calendar-date]");
  if (calendarDayTarget) openCalendarDay(calendarDayTarget.dataset.calendarDate);
  const searchSection = event.target.closest("[data-search-section]");
  if (searchSection) goTo(searchSection.dataset.searchSection);
  const searchUrl = event.target.closest("[data-search-url]");
  if (profileTarget || searchSection || searchUrl) closeGlobalSearch();
});

document.addEventListener("click", event => {
  const voiceToggle = event.target.closest("[data-voice-toggle]");
  if (voiceToggle) toggleVoiceNote(voiceToggle);
  if (!event.target.closest("#profileQuickMenu, .profile-tab")) closeProfileQuickMenu();
});
document.addEventListener("input", event => {
  const seek = event.target.closest("[data-voice-seek]");
  if (!seek) return;
  const audio = seek.closest("[data-voice-note]")?.querySelector("audio");
  if (!audio || !Number.isFinite(audio.duration)) return;
  audio.currentTime = Number(seek.value);
  syncVoiceNotePlayer(audio);
});
["loadedmetadata", "durationchange", "timeupdate", "play", "pause", "ended"].forEach(type => {
  document.addEventListener(type, event => {
    if (event.target.matches?.("[data-voice-note] audio")) syncVoiceNotePlayer(event.target);
  }, true);
});

const profileTab = document.querySelector(".profile-tab");
function clearProfileQuickMenuPress() {
  clearTimeout(profileQuickMenuPressTimer);
  profileQuickMenuPressTimer = null;
  profileQuickMenuPointer = null;
}
profileTab.addEventListener("pointerdown", event => {
  if (event.button !== 0 || !currentUser) return;
  profileQuickMenuPointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
  profileQuickMenuPressTimer = setTimeout(() => {
    suppressProfileTabClick = true;
    openProfileQuickMenu();
  }, 480);
});
profileTab.addEventListener("pointermove", event => {
  if (!profileQuickMenuPointer || profileQuickMenuPointer.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - profileQuickMenuPointer.x, event.clientY - profileQuickMenuPointer.y) > 12) clearProfileQuickMenuPress();
});
["pointerup", "pointercancel", "pointerleave"].forEach(type => profileTab.addEventListener(type, clearProfileQuickMenuPress));
profileTab.addEventListener("contextmenu", event => {
  event.preventDefault();
  openProfileQuickMenu();
});
profileTab.addEventListener("click", event => {
  if (!suppressProfileTabClick) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  suppressProfileTabClick = false;
}, true);
document.getElementById("quickHelpButton").addEventListener("click", () => {
  closeProfileQuickMenu();
  goTo("ayuda");
});
document.getElementById("quickLogoutButton").addEventListener("click", () => {
  closeProfileQuickMenu();
  logoutCurrentUser();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeProfileQuickMenu();
    if (document.getElementById("storyCamera")?.classList.contains("open")) closeStoryCamera();
    else if (document.getElementById("mediaUploader")?.classList.contains("open")) dismissMediaUploader({returnToCamera: true});
  }
});
window.addEventListener("pagehide", closeStoryCamera);
navLinks.forEach(link => link.addEventListener("click", event => {
  event.preventDefault();
  if (link.dataset.section === "perfil" && currentUser) renderProfile(currentUser.id);
  else goTo(link.dataset.section);
}));
document.getElementById("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const error = document.getElementById("loginError");
  const submit = event.currentTarget.querySelector("[type=submit]");
  error.textContent = "";
  submit.disabled = true;
  try {
    await login(
      document.getElementById("loginUsername").value,
      document.getElementById("loginPassword").value,
      document.getElementById("rememberSession").checked
    );
  } catch (loginError) {
    error.textContent = loginError.message;
  } finally {
    submit.disabled = false;
  }
});
document.getElementById("togglePassword").addEventListener("click", () => {
  const field = document.getElementById("loginPassword");
  field.type = field.type === "password" ? "text" : "password";
});
document.getElementById("requiredPasswordChangeForm").addEventListener("submit", event => {
  event.preventDefault();
  saveRequiredPasswordChange(event.currentTarget);
});
document.getElementById("notificationsButton").addEventListener("click", event => {
  event.stopPropagation();
  const dropdown = document.getElementById("notificationsDropdown");
  const open = !dropdown.classList.contains("open");
  dropdown.classList.toggle("open", open);
  dropdown.setAttribute("aria-hidden", String(!open));
  event.currentTarget.setAttribute("aria-expanded", String(open));
});
document.getElementById("pushNotificationButton").addEventListener("click", event => {
  event.stopPropagation();
  togglePushNotifications();
});
document.getElementById("pushNotificationTestButton").addEventListener("click", event => {
  event.stopPropagation();
  testPushNotifications();
});
document.getElementById("shareDestinationType").addEventListener("change", updateShareDestinations);
document.getElementById("closeShareMediaModal").addEventListener("click", closeShareMedia);
document.getElementById("cancelShareMedia").addEventListener("click", closeShareMedia);
document.getElementById("shareMediaModal").addEventListener("click", event => {
  if (event.target.id === "shareMediaModal") closeShareMedia();
});
document.getElementById("shareMediaForm").addEventListener("submit", event => {
  event.preventDefault();
  shareMediaToChat(event.currentTarget);
});
document.getElementById("notificationsDropdown").addEventListener("click", event => {
  event.stopPropagation();
  const deleteTarget = event.target.closest("[data-delete-notification]");
  if (deleteTarget) {
    deleteNotifications(deleteTarget.dataset.deleteNotification);
    return;
  }
  const target = event.target.closest("[data-notification-id]");
  if (target) openNotification(target.dataset.notificationId);
});
document.getElementById("markAllNotificationsRead").addEventListener("click", () => markNotificationsRead());
document.getElementById("clearAllNotifications").addEventListener("click", event => {
  event.stopPropagation();
  if (notifications.length && window.confirm("¿Quieres limpiar todas las notificaciones?")) deleteNotifications();
});
document.addEventListener("click", () => {
  closeNotifications();
});
document.getElementById("helpRequestForm").addEventListener("submit", event => { event.preventDefault(); submitHelpRequest(event.currentTarget); });
document.getElementById("helpReplyForm").addEventListener("submit", event => { event.preventDefault(); submitHelpReply(event.currentTarget); });
document.getElementById("helpRequestStatus").addEventListener("change", event => updateHelpRequestStatus(event.target.value));
document.getElementById("helpStatusTabs").addEventListener("click", event => {
  const button = event.target.closest("[data-help-filter]");
  if (!button) return;
  activeHelpFilter = button.dataset.helpFilter;
  document.querySelectorAll("[data-help-filter]").forEach(item => item.classList.toggle("active", item === button));
  renderHelpCenter();
});
document.getElementById("helpRequestList").addEventListener("click", event => {
  const request = event.target.closest("[data-help-request]");
  if (!request) return;
  activeHelpRequestId = request.dataset.helpRequest;
  renderHelpCenter();
});
document.getElementById("closeMediaReplyModal").addEventListener("click", closeMediaReply);
document.getElementById("cancelMediaReply").addEventListener("click", closeMediaReply);
document.getElementById("mediaReplyModal").addEventListener("click", event => { if (event.target.id === "mediaReplyModal") closeMediaReply(); });
document.getElementById("mediaReplyForm").addEventListener("submit", event => { event.preventDefault(); submitMediaReply(event.currentTarget); });
document.getElementById("messageForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (activeAudioRecording?.kind === "group") {
    activeAudioRecording.sendOnStop = true;
    activeAudioRecording.recorder.stop();
    return;
  }
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text && !pendingMessageFile) return;
  input.disabled = true;
  try {
    await sendMessage(text, pendingMessageFile);
    input.value = "";
    clearPendingChatFile("group");
  } catch (error) {
    input.setCustomValidity(error.message || "No se pudo enviar el mensaje.");
    input.reportValidity();
    input.setCustomValidity("");
  } finally {
    input.disabled = false;
    input.focus();
  }
});
document.getElementById("privateMessageForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (activeAudioRecording?.kind === "private") {
    activeAudioRecording.sendOnStop = true;
    activeAudioRecording.recorder.stop();
    return;
  }
  const input = document.getElementById("privateMessageInput");
  const text = input.value.trim();
  if (!text && !pendingPrivateMessageFile) return;
  input.disabled = true;
  try {
    await sendPrivateMessage(text, pendingPrivateMessageFile);
    input.value = "";
    clearPendingChatFile("private");
    await loadPrivateMessages();
  } catch (error) {
    input.setCustomValidity(error.message || "No se pudo enviar el mensaje.");
    input.reportValidity();
    input.setCustomValidity("");
  } finally {
    input.disabled = false;
    input.focus();
  }
});
[["group", "messageInput"], ["private", "privateMessageInput"]].forEach(([kind, inputId]) => {
  document.getElementById(inputId).addEventListener("input", () => syncComposerState(kind));
});
window.visualViewport?.addEventListener("resize", () => syncMobileViewport());
window.visualViewport?.addEventListener("scroll", () => syncMobileViewport());
window.addEventListener("resize", () => syncMobileViewport());
window.addEventListener("orientationchange", () => setTimeout(() => syncMobileViewport(), 250));
document.addEventListener("focusin", event => {
  if (event.target.closest(".message-form input")) syncMobileViewport();
});
document.addEventListener("focusout", event => {
  if (!event.target.closest(".message-form input")) return;
  setTimeout(() => syncMobileViewport(), 80);
  setTimeout(() => syncMobileViewport(), 350);
});
document.getElementById("closeProfileEditor").addEventListener("click", closeProfileEditor);
document.getElementById("cancelProfileEditor").addEventListener("click", closeProfileEditor);
document.getElementById("profileEditor").addEventListener("click", event => {
  if (event.target.id === "profileEditor") closeProfileEditor();
});
document.getElementById("profileBio").addEventListener("input", event => {
  document.getElementById("bioCount").textContent = event.target.value.length;
});
document.getElementById("profileAvatar").addEventListener("change", async event => {
  pendingAvatarFile = event.target.files[0] || null;
  if (!pendingAvatarFile) return;
  if (pendingAvatarFile.size > 3 * 1024 * 1024) {
    document.getElementById("profileFeedback").textContent = "La imagen supera el máximo de 3 MB.";
    pendingAvatarFile = null;
    event.target.value = "";
    return;
  }
  removeAvatarRequested = false;
  document.getElementById("profileFeedback").textContent = "";
  try {
    await loadAvatarCrop(pendingAvatarFile);
  } catch (error) {
    document.getElementById("profileFeedback").textContent = error.message;
  }
});
document.getElementById("avatarZoom").addEventListener("input", event => {
  const previousZoom = avatarCropZoom;
  avatarCropZoom = Number(event.target.value);
  if (previousZoom) {
    avatarCropOffsetX *= avatarCropZoom / previousZoom;
    avatarCropOffsetY *= avatarCropZoom / previousZoom;
  }
  drawAvatarCrop();
});
document.getElementById("resetAvatarCrop").addEventListener("click", () => {
  avatarCropZoom = 1;
  avatarCropOffsetX = 0;
  avatarCropOffsetY = 0;
  document.getElementById("avatarZoom").value = "1";
  drawAvatarCrop();
});
const avatarCropStage = document.getElementById("avatarCropStage");
avatarCropStage.addEventListener("pointerdown", event => {
  if (!avatarCropImage) return;
  avatarCropPointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
  avatarCropStage.setPointerCapture(event.pointerId);
  avatarCropStage.classList.add("dragging");
});
avatarCropStage.addEventListener("pointermove", event => {
  if (!avatarCropPointer || avatarCropPointer.id !== event.pointerId) return;
  const scale = document.getElementById("avatarCropCanvas").width / avatarCropStage.getBoundingClientRect().width;
  avatarCropOffsetX += (event.clientX - avatarCropPointer.x) * scale;
  avatarCropOffsetY += (event.clientY - avatarCropPointer.y) * scale;
  avatarCropPointer.x = event.clientX;
  avatarCropPointer.y = event.clientY;
  drawAvatarCrop();
});
function stopAvatarCropDrag(event) {
  if (!avatarCropPointer || avatarCropPointer.id !== event.pointerId) return;
  avatarCropPointer = null;
  avatarCropStage.classList.remove("dragging");
}
avatarCropStage.addEventListener("pointerup", stopAvatarCropDrag);
avatarCropStage.addEventListener("pointercancel", stopAvatarCropDrag);
document.getElementById("removeAvatarButton").addEventListener("click", () => {
  removeAvatarRequested = true;
  pendingAvatarFile = null;
  document.getElementById("profileAvatar").value = "";
  resetAvatarCropEditor();
  const preview = document.getElementById("avatarPreview");
  preview.classList.remove("has-image");
  preview.textContent = getMember(editingProfileId)?.name?.charAt(0) || "U";
});
document.getElementById("profileForm").addEventListener("submit", event => {
  event.preventDefault();
  saveProfile(event.currentTarget);
});
document.querySelectorAll("[data-news-category]").forEach(button => button.addEventListener("click", () => {
  activeNewsCategory = button.dataset.newsCategory;
  document.querySelectorAll("[data-news-category]").forEach(item => item.classList.toggle("active", item === button));
  loadNews(false);
}));
function setNewsCollapsed(collapsed) {
  const section = document.getElementById("noticias");
  const button = document.getElementById("toggleNewsButton");
  const content = document.getElementById("newsCollapsible");
  if (!section || !button || !content) return;
  section.classList.toggle("is-collapsed", collapsed);
  content.hidden = collapsed;
  button.setAttribute("aria-expanded", String(!collapsed));
  button.querySelector("span").textContent = collapsed ? "Ver noticias" : "Ocultar noticias";
}
document.getElementById("toggleNewsButton").addEventListener("click", () => {
  setNewsCollapsed(!document.getElementById("noticias").classList.contains("is-collapsed"));
});
setNewsCollapsed(false);
document.getElementById("refreshNewsButton").addEventListener("click", () => loadNews(true));
setInterval(() => {
  if (!document.hidden && document.getElementById("inicio").classList.contains("active")) loadNews(true);
}, NEWS_REFRESH_INTERVAL);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden
    && document.getElementById("inicio").classList.contains("active")
    && Date.now() - lastNewsRefreshAt >= NEWS_CACHE_DURATION) {
    loadNews(true);
  }
});
document.getElementById("attachMessageButton").addEventListener("click", () => document.getElementById("messageAttachment").click());
document.getElementById("attachPrivateMessageButton").addEventListener("click", () => document.getElementById("privateMessageAttachment").click());
document.getElementById("attachMessageMediaButton").addEventListener("click", () => document.getElementById("messageMediaAttachment").click());
document.getElementById("attachPrivateMessageMediaButton").addEventListener("click", () => document.getElementById("privateMessageMediaAttachment").click());
document.getElementById("captureMessageCameraButton").addEventListener("click", () => document.getElementById("messageCameraAttachment").click());
document.getElementById("capturePrivateMessageCameraButton").addEventListener("click", () => document.getElementById("privateMessageCameraAttachment").click());
document.getElementById("recordGroupAudioButton").addEventListener("click", () => toggleAudioRecording("group"));
document.getElementById("recordPrivateAudioButton").addEventListener("click", () => toggleAudioRecording("private"));
document.getElementById("pauseGroupAudioButton").addEventListener("click", () => pauseAudioRecording("group"));
document.getElementById("pausePrivateAudioButton").addEventListener("click", () => pauseAudioRecording("private"));
document.getElementById("cancelGroupAudioButton").addEventListener("click", () => cancelAudioRecording("group"));
document.getElementById("cancelPrivateAudioButton").addEventListener("click", () => cancelAudioRecording("private"));
document.getElementById("privateMessageAttachment").addEventListener("change", event => setPendingChatFile("private", event.target.files[0] || null));
document.getElementById("privateMessageMediaAttachment").addEventListener("change", event => setPendingChatFile("private", event.target.files[0] || null));
document.getElementById("privateMessageCameraAttachment").addEventListener("change", event => setPendingChatFile("private", event.target.files[0] || null));
document.getElementById("addChatChannelButton").addEventListener("click", createChatChannel);
document.getElementById("messageAttachment").addEventListener("change", event => setPendingChatFile("group", event.target.files[0] || null));
document.getElementById("messageMediaAttachment").addEventListener("change", event => setPendingChatFile("group", event.target.files[0] || null));
document.getElementById("messageCameraAttachment").addEventListener("change", event => setPendingChatFile("group", event.target.files[0] || null));
document.getElementById("addMomentButton").addEventListener("click", () => openStoryCamera("moment"));
document.getElementById("closeStoryCamera").addEventListener("click", closeStoryCamera);
document.getElementById("captureStoryPhoto").addEventListener("pointerdown", beginStoryShutterGesture);
document.getElementById("captureStoryPhoto").addEventListener("pointerup", endStoryShutterGesture);
document.getElementById("captureStoryPhoto").addEventListener("pointercancel", cancelStoryShutterGesture);
document.getElementById("captureStoryPhoto").addEventListener("contextmenu", event => event.preventDefault());
document.getElementById("switchStoryCamera").addEventListener("click", switchStoryCamera);
document.getElementById("toggleStoryFlash").addEventListener("click", toggleStoryFlash);
document.getElementById("storyGalleryInput").addEventListener("change", event => useStoryMediaFile(event.target.files[0] || null));
document.getElementById("closeMediaUploader").addEventListener("click", () => dismissMediaUploader({returnToCamera: true}));
document.getElementById("cancelMediaUploader").addEventListener("click", () => dismissMediaUploader({returnToCamera: true}));
document.getElementById("mediaUploader").addEventListener("click", event => {
  if (event.target.id === "mediaUploader" && !event.currentTarget.classList.contains("has-media")) dismissMediaUploader();
});
document.getElementById("mediaUploadFile").addEventListener("change", event => prepareMediaUploadFile(event.target.files[0] || null));
document.getElementById("mediaCropZoom").addEventListener("input", event => {
  document.getElementById("mediaKeepOriginal").checked = false;
  const previousZoom = mediaCropZoom;
  mediaCropZoom = Number(event.target.value);
  if (previousZoom) {
    mediaCropOffsetX *= mediaCropZoom / previousZoom;
    mediaCropOffsetY *= mediaCropZoom / previousZoom;
  }
  drawMediaCrop();
});
document.getElementById("mediaFilter").addEventListener("change", event => { mediaFilter = event.target.value; drawMediaCrop(); });
document.getElementById("mediaOverlayText").addEventListener("input", event => { mediaOverlayText = event.target.value.trim(); drawMediaCrop(); });
function toggleMediaTool(toolName) {
  const targetPanel = document.querySelector(`[data-media-panel="${toolName}"]`);
  const targetButton = document.querySelector(`[data-media-tool="${toolName}"]`);
  const willOpen = targetPanel && !targetPanel.classList.contains("active");
  document.querySelectorAll("[data-media-panel]").forEach(panel => panel.classList.remove("active"));
  document.querySelectorAll("[data-media-tool]").forEach(button => {
    button.classList.remove("active");
    button.setAttribute("aria-expanded", "false");
  });
  if (!willOpen) return;
  targetPanel.classList.add("active");
  targetButton.classList.add("active");
  targetButton.setAttribute("aria-expanded", "true");
  const field = targetPanel.querySelector("input:not([type=range]):not([type=checkbox]), textarea, select");
  if (field && !window.matchMedia("(max-width: 760px)").matches) {
    requestAnimationFrame(() => field.focus({preventScroll: true}));
  }
}
// Extrae solo los paneles interactivos. El antiguo contenedor lateral no debe
// participar en el layout móvil ni crear una segunda columna vacía.
const mediaControlsContainer = document.querySelector("#mediaUploader .media-crop-controls");
const mediaToolPortal = document.createElement("div");
mediaToolPortal.className = "media-tool-portal";
mediaToolPortal.setAttribute("aria-live", "polite");
mediaControlsContainer?.querySelectorAll("[data-media-panel]").forEach(panel => mediaToolPortal.appendChild(panel));
mediaControlsContainer?.remove();
document.getElementById("mediaUploader").appendChild(mediaToolPortal);
document.querySelectorAll("[data-media-tool]").forEach(button => button.addEventListener("click", () => toggleMediaTool(button.dataset.mediaTool)));
document.querySelectorAll("[data-editor-filter]").forEach(button => button.addEventListener("click", () => {
  mediaFilter = button.dataset.editorFilter;
  document.getElementById("mediaFilter").value = mediaFilter;
  document.querySelectorAll("[data-editor-filter]").forEach(item => {
    const selected = item === button;
    item.classList.toggle("active", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  requestAnimationFrame(() => {
    drawMediaCrop();
    const canvas = document.getElementById("mediaCropCanvas");
    canvas.classList.remove("filter-previewing");
    requestAnimationFrame(() => canvas.classList.add("filter-previewing"));
  });
}));
document.getElementById("resetMediaCrop").addEventListener("click", () => {
  mediaCropZoom = 1;
  mediaCropOffsetX = 0;
  mediaCropOffsetY = 0;
  document.getElementById("mediaCropZoom").value = "1";
  drawMediaCrop();
});
const mediaCropStage = document.getElementById("mediaCropStage");
mediaCropStage.addEventListener("pointerdown", event => {
  if (!mediaCropImage) return;
  mediaCropPointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
  mediaCropStage.setPointerCapture(event.pointerId);
  mediaCropStage.classList.add("dragging");
});
mediaCropStage.addEventListener("pointermove", event => {
  if (!mediaCropPointer || mediaCropPointer.id !== event.pointerId) return;
  const canvas = document.getElementById("mediaCropCanvas");
  const scaleX = canvas.width / mediaCropStage.getBoundingClientRect().width;
  const scaleY = canvas.height / mediaCropStage.getBoundingClientRect().height;
  mediaCropOffsetX += (event.clientX - mediaCropPointer.x) * scaleX;
  mediaCropOffsetY += (event.clientY - mediaCropPointer.y) * scaleY;
  mediaCropPointer.x = event.clientX;
  mediaCropPointer.y = event.clientY;
  drawMediaCrop();
});
function stopMediaCropDrag(event) {
  if (!mediaCropPointer || mediaCropPointer.id !== event.pointerId) return;
  mediaCropPointer = null;
  mediaCropStage.classList.remove("dragging");
}
mediaCropStage.addEventListener("pointerup", stopMediaCropDrag);
mediaCropStage.addEventListener("pointercancel", stopMediaCropDrag);
document.getElementById("mediaUploadForm").addEventListener("submit", event => {
  event.preventDefault();
  publishMedia(event.currentTarget);
});
document.getElementById("closeMediaViewer").addEventListener("click", closeMediaViewer);
document.getElementById("momentOptionsButton").addEventListener("click", event => {
  event.stopPropagation();
  const menu = document.getElementById("momentOptionsMenu");
  menu.hidden = !menu.hidden;
  event.currentTarget.setAttribute("aria-expanded", String(!menu.hidden));
});
document.getElementById("deleteViewedMoment").addEventListener("click", event => {
  event.stopPropagation();
  deleteActiveMoment();
});
document.getElementById("previousMoment").addEventListener("click", event => {
  event.stopPropagation();
  if (suppressMomentNavigationClick) return void (suppressMomentNavigationClick = false);
  previousMoment();
});
document.getElementById("nextMoment").addEventListener("click", event => {
  event.stopPropagation();
  if (suppressMomentNavigationClick) return void (suppressMomentNavigationClick = false);
  nextMoment();
});
document.getElementById("mediaViewerVideo").addEventListener("ended", () => {
  if (activeMomentSequence.length) nextMoment();
});
const storyViewerDialog = document.querySelector("#mediaViewer .media-viewer-dialog");

function clearMomentGesture(keepVisual = false) {
  momentGesture = null;
  momentPressStartedAt = 0;
  if (keepVisual) return;
  storyViewerDialog.classList.remove("swiping-down", "dismissed-down");
  storyViewerDialog.style.removeProperty("--story-drag-y");
  storyViewerDialog.style.removeProperty("--story-drag-opacity");
}

function dismissMomentDown() {
  storyViewerDialog.classList.add("dismissed-down");
  storyViewerDialog.style.setProperty("--story-drag-y", "100dvh");
  storyViewerDialog.style.setProperty("--story-drag-opacity", "0");
  suppressMomentNavigationClick = true;
  clearTimeout(momentAdvanceTimer);
  setTimeout(() => {
    closeMediaViewer();
    clearMomentGesture();
  }, 180);
}

storyViewerDialog.addEventListener("pointerdown", event => {
  if (!activeMomentSequence.length || event.target.closest("button:not(.moment-navigation),video")) return;
  momentGesture = {id: event.pointerId, x: event.clientX, y: event.clientY};
  momentPressStartedAt = Date.now();
  storyViewerDialog.setPointerCapture?.(event.pointerId);
  pauseActiveMoment();
});

storyViewerDialog.addEventListener("pointermove", event => {
  if (!momentGesture || momentGesture.id !== event.pointerId || !activeMomentSequence.length) return;
  const distanceY = Math.max(0, event.clientY - momentGesture.y);
  const distanceX = Math.abs(event.clientX - momentGesture.x);
  if (distanceY < 8 || distanceY <= distanceX) return;
  event.preventDefault();
  storyViewerDialog.classList.add("swiping-down");
  storyViewerDialog.style.setProperty("--story-drag-y", `${distanceY}px`);
  storyViewerDialog.style.setProperty("--story-drag-opacity", String(Math.max(.35, 1 - distanceY / 420)));
});

storyViewerDialog.addEventListener("pointerup", event => {
  if (!momentGesture || momentGesture.id !== event.pointerId || !activeMomentSequence.length) return;
  const result = classifyStoryGesture(momentGesture, event.clientX, event.clientY, Date.now() - momentPressStartedAt);
  if (result.action === "dismiss") {
    clearMomentGesture(true);
    dismissMomentDown();
    return;
  }
  clearMomentGesture();
  if (result.action === "release") {
    suppressMomentNavigationClick = result.held;
    resumeActiveMoment();
    return;
  }
  if (result.action === "next") nextMoment();
  else previousMoment();
});

storyViewerDialog.addEventListener("pointercancel", () => {
  clearMomentGesture();
  resumeActiveMoment();
});
document.getElementById("mediaViewer").addEventListener("click", event => {
  if (event.target.id === "mediaViewer") closeMediaViewer();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && document.getElementById("mediaViewer").classList.contains("open")) closeMediaViewer();
});
function openGlobalSearch() {
  goTo("buscar");
  document.getElementById("globalSearchInput").focus();
}
function closeGlobalSearch() {
  document.getElementById("globalSearchInput")?.blur();
}
document.getElementById("adminPanelButton")?.addEventListener("click", () => goTo("administracion"));
document.getElementById("globalSearchInput").addEventListener("input", event => performSearch(event.target.value));
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeGlobalSearch();
    closeEventEditor();
    closeCalendarDayModal();
    closeSpotifyEditor();
  }
});
document.getElementById("previousMonthButton").addEventListener("click", () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById("nextMonthButton").addEventListener("click", () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  renderCalendar();
});
document.getElementById("addEventButton").addEventListener("click", () => openEventEditor());
document.getElementById("addBirthdayButton").addEventListener("click", event => {
  openEventEditor(event.currentTarget.dataset.birthdayEventId || null, "birthday");
});
document.getElementById("eventType").addEventListener("change", updateEventEditorType);
document.getElementById("addPublicationButton").addEventListener("click", () => openStoryCamera("post"));
document.querySelectorAll("[data-content-tab]").forEach(button => {
  button.addEventListener("click", () => selectContentTab(button.dataset.contentTab));
});
document.getElementById("closeEventEditor").addEventListener("click", closeEventEditor);
document.getElementById("cancelEventEditor").addEventListener("click", closeEventEditor);
document.getElementById("eventEditor").addEventListener("click", event => {
  if (event.target.id === "eventEditor") closeEventEditor();
});
document.getElementById("closeCalendarDayModal").addEventListener("click", closeCalendarDayModal);
document.getElementById("calendarDayModal").addEventListener("click", event => {
  if (event.target.id === "calendarDayModal") closeCalendarDayModal();
});
document.getElementById("eventForm").addEventListener("submit", event => {
  event.preventDefault();
  saveEvent(event.currentTarget);
});
document.getElementById("deleteEventButton").addEventListener("click", deleteEvent);
document.getElementById("createUserForm")?.addEventListener("submit", event => {
  event.preventDefault();
  createClubUser(event.currentTarget);
});
document.getElementById("editSpotifyButton").addEventListener("click", openSpotifyEditor);
document.getElementById("closeSpotifyEditor").addEventListener("click", closeSpotifyEditor);
document.getElementById("cancelSpotifyEditor").addEventListener("click", closeSpotifyEditor);
document.getElementById("spotifyEditor").addEventListener("click", event => {
  if (event.target.id === "spotifyEditor") closeSpotifyEditor();
});
document.getElementById("spotifyForm").addEventListener("submit", event => {
  event.preventDefault();
  saveSpotifyPlaylist(document.getElementById("spotifyPlaylistUrl").value);
});
document.getElementById("removeSpotifyButton").addEventListener("click", removeSpotifyPlaylist);

applyStoredProfiles();
if (localStorage.getItem("bb-theme") === "light") document.body.classList.add("light");
renderFeatured();
renderMembers();
renderMoments();
renderActivity();
renderMessages();
renderPresence();
renderPublications();
renderNotifications();
renderPrivateContacts();
renderPrivateConversation();
renderCalendar();
renderSpotify();
renderHelpCenter();
loadNews(false);

(async function restoreSession() {
  if (backendReady) {
    const {data} = await db.auth.getSession();
    if (data.session?.user) {
      const profile = await profileForAuthUser(data.session.user);
      if (profile) return applyUserInterface(profile, data.session.user);
    }
  } else {
    const session = getStoredSession();
    const user = session && getMember(session.userId);
    if (user) return applyUserInterface(user);
  }
  showLogin();
})();

const requestedInitialSection = location.hash.replace("#", "");
const initialSection = requestedInitialSection === "privados" ? "chat" : requestedInitialSection;
if (["inicio", "chat", "privados", "miembros", "contenido", "momentos", "publicaciones", "noticias", "buscar", "calendario", "perfil", "ayuda"].includes(initialSection)) {
  if (initialSection === "perfil" && currentUser) renderProfile(currentUser.id);
  else goTo(initialSection);
}
window.addEventListener("scroll", scheduleMobileHeaderSync, {passive: true});
window.addEventListener("resize", () => {
  if (!isMobileSidebar()) showMobileHeader();
  mobileHeaderLastScrollY = Math.max(0, window.scrollY);
  mobileHeaderScrollAnchor = mobileHeaderLastScrollY;
  mobileHeaderDirection = null;
}, {passive: true});
window.addEventListener("load", () => setTimeout(() => document.getElementById("pageLoader")?.classList.add("hidden"), 450));
const cursorGlow = document.getElementById("cursorGlow");
document.addEventListener("pointermove", event => {
  if (!cursorGlow || cursorFrame || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const {clientX, clientY} = event;
  cursorFrame = requestAnimationFrame(() => {
    cursorGlow.style.transform = `translate3d(${clientX - 150}px, ${clientY - 150}px, 0)`;
    cursorFrame = null;
  });
}, {passive: true});
const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) {
    entry.target.classList.add("visible");
    revealObserver.unobserve(entry.target);
  }
}), {threshold: 0.12});
document.querySelectorAll(".reveal").forEach(element => revealObserver.observe(element));
