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
let membersById = new Map();
let membersByAuthId = new Map();

function rebuildMemberIndexes() {
  membersById = new Map(members.map(member => [Number(member.id), member]));
  membersByAuthId = new Map(members.filter(member => member.authId).map(member => [member.authId, member]));
}

rebuildMemberIndexes();

const config = window.BIG_BOY_CONFIG || {};
const backendReady = Boolean(config.supabaseUrl && config.supabasePublishableKey && window.supabase);
const db = backendReady
  ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: window.localStorage,
      },
    })
  : null;

if (backendReady) {
  const backendOrigin = new URL(config.supabaseUrl).origin;
  ["preconnect", "dns-prefetch"].forEach(rel => {
    const link = document.createElement("link");
    link.rel = rel;
    link.href = backendOrigin;
    if (rel === "preconnect") link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  });
}
const AUTH_STORAGE_KEY = "bb-auth-session";
const AUTH_SESSION_KEY = "bb-auth-temporary";
const AUTH_PROFILE_CACHE_KEY = "bb-auth-profile";
const PROFILE_STORAGE_KEY = "bb-local-profiles";
const CHAT_FAVORITES_STORAGE_KEY = "bb-chat-favorites";
const GENERIC_PASSWORD = "bigboy2026";
const PASSWORD_CHANGE_STORAGE_PREFIX = "bb-password-change-required-";
const MEDIA_PERMISSION_STORAGE_KEY = "bb-media-permissions";
const NEWS_CACHE_DURATION = 2 * 60 * 1000;
const NEWS_REFRESH_INTERVAL = 2 * 60 * 1000;
const MEGABYTE = 1024 * 1024;
const FILE_LIMITS = Object.freeze({
  attachment: 50 * MEGABYTE
});
const ACHIEVEMENT_TIERS = Object.freeze({
  bronze: {label: "Bronce", symbol: "◆"},
  silver: {label: "Plata", symbol: "✦"},
  gold: {label: "Oro", symbol: "★"},
  platinum: {label: "Platino", symbol: "✧"},
});
const CHAT_BACK_GESTURE = Object.freeze({
  activationDistance: 8,
  triggerDistance: 92,
  completionRatio: .28,
  velocityThreshold: .42,
  maxVerticalDistance: 56,
});
const pageTitle = document.getElementById("pageTitle");
const sections = [...document.querySelectorAll(".page-section")];
const navLinks = [...document.querySelectorAll(".app-tab")];
const isStandaloneApp = window.__bigboysNativeKeyboardLayout === true || window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
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

function activePageScrollY() {
  // Mobile sections own their scroll; the document remains stationary behind the dock.
  const page = sections.find(section => section.classList.contains("active"));
  return Math.max(0, isMobileSidebar() ? page?.scrollTop || 0 : window.scrollY);
}

function syncMobileHeader() {
  mobileHeaderFrame = null;
  const currentScrollY = activePageScrollY();
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

function readMediaPermissionMemory() {
  try {
    const saved = JSON.parse(localStorage.getItem(MEDIA_PERMISSION_STORAGE_KEY) || "{}");
    return {
      camera: ["granted", "denied"].includes(saved.camera) ? saved.camera : "prompt",
      microphone: ["granted", "denied"].includes(saved.microphone) ? saved.microphone : "prompt",
    };
  } catch {
    return {camera: "prompt", microphone: "prompt"};
  }
}

function rememberMediaPermission(kind, state) {
  if (!["camera", "microphone"].includes(kind) || !["granted", "denied", "prompt"].includes(state)) return;
  mediaPermissionMemory = {...mediaPermissionMemory, [kind]: state};
  localStorage.setItem(MEDIA_PERMISSION_STORAGE_KEY, JSON.stringify(mediaPermissionMemory));
}

async function refreshMediaPermission(kind) {
  if (!navigator.permissions?.query) return mediaPermissionMemory[kind] || "prompt";
  try {
    const permission = await navigator.permissions.query({name: kind});
    rememberMediaPermission(kind, permission.state);
    permission.addEventListener?.("change", () => rememberMediaPermission(kind, permission.state), {once: true});
    return permission.state;
  } catch {
    return mediaPermissionMemory[kind] || "prompt";
  }
}

function mediaPermissionWasRemembered(kind) {
  return mediaPermissionMemory[kind] === "granted";
}

let currentUser = null;
let currentAuthUser = null;
let messages = [];
let notifications = [];
let privateMessages = [];
let groupEvents = [];
let chatChannels = [];
let helpRequests = [];
let helpMessages = [];
let achievements = [];
let achievementAwards = [];
let achievementProgress = [];
let achievementProgressStatus = "loading";
let achievementProgressUserId = null;
let newsItems = [];
let siteSettings = {};
let onlineUsers = [];
let presenceChannel = null;
let messageChannel = null;
let notificationsChannel = null;
let privateChannel = null;
let eventChannel = null;
let settingsChannel = null;
let chatChannelsRealtime = null;
let helpRealtime = null;
let achievementsRealtime = null;
let profilesRealtime = null;
let activeNewsCategory = "deportes";
let activeHelpRequestId = null;
let activeHelpFilter = "all";
let lastNewsRefreshAt = 0;
let newsLoadToken = 0;
let pendingPrivateMessageFile = null;
let activeAudioRecording = null;
let mediaPermissionMemory = readMediaPermissionMemory();
void Promise.all([refreshMediaPermission("camera"), refreshMediaPermission("microphone")]);
const attachmentPreviewUrls = {group: "", private: ""};
let pendingAvatarFile = null;
let removeAvatarRequested = false;
let avatarCropImage = null;
let avatarCropZoom = 1;
let avatarCropOffsetX = 0;
let avatarCropOffsetY = 0;
let avatarCropPointer = null;
let pendingGroupAvatarFile = null;
let groupAvatarPreviewUrl = "";
let inboxHoldTimer = 0;
let inboxHoldPointer = null;
let suppressInboxRowClick = false;
let pendingMessageFile = null;
let activeProfileId = null;
let editingProfileId = null;
let activePrivateMemberId = null;
let activeChatChannelId = null;
let calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let sectionBeforeChat = "inicio";
let viewportSyncFrame = null;
let chatKeyboard = null;
let navigationFrame = null;
let navigationWorkTimer = null;
let navigationGeneration = 0;
let profileRender = null;
let mobileViewportBaseline = window.innerHeight;
let cursorFrame = null;
let messageViewTransitioning = false;
let activeChatMotionScene = null;
let chatBackGesture = null;
let suppressChatGestureClick = false;
let sharingMedia = null;
let achievementsLoaded = false;
let helpCenterLoaded = false;
let achievementsLoading = false;
let achievementsRequest = null;
let helpCenterLoading = false;
const realtimeRefreshTimers = new Map();
let initialLaunchCompleted = false;

function completeInitialLaunch() {
  if (initialLaunchCompleted) return;
  initialLaunchCompleted = true;
  requestAnimationFrame(() => document.getElementById("pageLoader")?.classList.add("hidden"));
}
const pendingMediaLikes = new Set();

function runWhenIdle(callback, timeout = 1200) {
  if ("requestIdleCallback" in window) return window.requestIdleCallback(callback, {timeout});
  return window.setTimeout(callback, Math.min(timeout, 300));
}

function debounce(callback, delay = 90) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

function scheduleRealtimeRefresh(key, loader, delay = 180) {
  clearTimeout(realtimeRefreshTimers.get(key));
  realtimeRefreshTimers.set(key, setTimeout(() => {
    realtimeRefreshTimers.delete(key);
    loader();
  }, delay));
}

const HTML_ENTITIES = Object.freeze({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"});

function escapeHtml(value = "") {
  return (value == null ? "" : String(value)).replace(/[&<>"']/g, character => HTML_ENTITIES[character]);
}

function formatLimit(limit) {
  return `${Math.round(limit / MEGABYTE)} MB`;
}

function validateFileSize(file, limit) {
  if (!file || file.size <= limit) return;
  throw new Error(`El archivo supera el máximo de ${formatLimit(limit)}.`);
}

function uploadLimitForFolder() {
  return FILE_LIMITS.attachment;
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

function normalizeUsername(value = "") {
  return value.trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
}

function isSuperAdmin() {
  return currentUser?.roleKey === "superadmin" && currentUser?.hidden === true;
}

function canManageSite() {
  return currentUser?.roleKey === "admin" || isSuperAdmin();
}

function getMember(id) {
  return membersById.get(Number(id));
}

function getMemberByAuthId(id) {
  return membersByAuthId.get(id);
}

function getAvatar(member, className = "avatar") {
  if (member?.avatarUrl) {
    const initial = escapeHtml(member?.name?.charAt(0).toUpperCase() || "U");
    return `<div class="${className} has-image" data-avatar><span class="avatar-fallback" aria-hidden="true">${initial}</span><img src="${escapeHtml(member.avatarUrl)}" alt="Foto de ${escapeHtml(member.name)}" loading="lazy" decoding="async"></div>`;
  }
  return `<div class="${className}">${escapeHtml(member?.name?.charAt(0).toUpperCase() || "U")}</div>`;
}

// Public profile URLs can outlive their backing Storage object. Fall back to
// initials in every member surface instead of exposing the browser's broken-image glyph.
document.addEventListener("error", event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  const container = image.closest("[data-avatar]") || (image.hasAttribute("data-avatar-image") ? image.parentElement : null);
  if (!container) return;
  image.remove();
  container.classList.remove("has-image");
}, true);

function applyStoredProfiles() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "{}");
    members = members.map(member => ({...member, ...(stored[member.id] || {})}));
    rebuildMemberIndexes();
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
    const viewport = ChatKeyboard.viewport({height: viewportHeight, offset: viewportOffset,
      baseline: mobileViewportBaseline, focused: composerFocused,
      nativeLayout: chatKeyboard?.nativeLayout, nativeVisible: chatKeyboard?.keyboardVisible});
    document.documentElement.style.setProperty("--chat-viewport-height", `${viewport.height}px`);
    document.documentElement.style.setProperty("--chat-viewport-offset", `${viewport.offset}px`);
    document.body.classList.toggle("chat-keyboard-open", viewport.open);
  });
}

function resetSectionScroll(sectionId) {
  // Cancel any smooth scroll from the previous page before the next frame is painted.
  window.scrollTo({top: 0, left: 0, behavior: "instant"});
  document.getElementById(sectionId)?.scrollTo({top: 0, left: 0, behavior: "instant"});
  document.querySelector(".app")?.scrollTo({top: 0, left: 0, behavior: "instant"});
}

function updateFloatingTabIndicator(sectionId) {
  const navigationSection = sectionId === "privados" ? "chat" : sectionId === "sobres" ? "inicio" : sectionId;
  const index = navLinks.findIndex(link => link.dataset.section === navigationSection);
  if (index < 0) return;
  const tabBar = document.getElementById("floatingTabBar");
  tabBar?.style.setProperty("--active-tab-offset", `${index * 100}%`);
}

async function transitionMessageView(update, {back = false} = {}) {
  if (messageViewTransitioning) return;
  messageViewTransitioning = true;
  let scene = null;
  try {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fromInbox = document.body.classList.contains("chat-inbox-view") && !document.body.classList.contains("chat-focus");
    if (!isMobileSidebar() || reducedMotion || (!back && !fromInbox)) {
      update();
      return;
    }
    // Compose the destination synchronously, then animate the live panel over the same inbox.
    if (!back) update();
    const panel = document.querySelector("#privados.active.conversation-open .private-conversation, #chat.active.conversation-open .group-conversation");
    scene = prepareChatBackScene(panel, {entering: !back});
    if (!scene) {
      if (back) update();
      return;
    }
    scene.panel.classList.add("chat-back-button-exit");
    await settleChatBackScene(scene, back ? scene.width : 0);
    if (back) update();
  } finally {
    cleanupChatBackScene(scene);
    messageViewTransitioning = false;
  }
}

function goTo(sectionId) {
  if (["admin-logros", "crear-logro", "asignar-logro"].includes(sectionId) && !canManageSite()) sectionId = "inicio";
  const generation = ++navigationGeneration;
  cancelAnimationFrame(navigationFrame);
  clearTimeout(navigationWorkTimer);
  closeProfileQuickMenu({immediate: true});
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  showMobileHeader();
  mobileHeaderLastScrollY = 0;
  mobileHeaderScrollAnchor = 0;
  mobileHeaderDirection = null;
  const requestedSection = sectionId;
  if (sectionId === "buscar") sectionId = "calendario";
  const homeAnchor = sectionId === "miembros" || sectionId === "noticias" ? sectionId : null;
  if (homeAnchor) sectionId = "inicio";
  if (["contenido", "momentos", "publicaciones"].includes(sectionId)) sectionId = "inicio";
  const currentSection = sections.find(section => section.classList.contains("active"))?.id;
  const switchingSection = currentSection !== sectionId;
  const openingChat = sectionId === "chat" || sectionId === "privados";
  if (openingChat && currentSection && currentSection !== "chat" && currentSection !== "privados") {
    sectionBeforeChat = currentSection;
  }
  if (sectionId === "chat") document.getElementById("chat")?.classList.remove("conversation-open");
  if (switchingSection && !document.body.classList.contains("message-slide-transition")) {
    document.body.classList.add("tab-switching");
  }
  sections.forEach(section => {
    section.classList.toggle("active", section.id === sectionId);
    section.inert = section.id !== sectionId;
  });
  const navigationSection = sectionId === "privados" ? "chat" : sectionId === "sobres" ? "inicio" : sectionId;
  navLinks.forEach(link => {
    const active = link.dataset.section === navigationSection;
    link.classList.toggle("active", active);
    link.setAttribute("aria-current", active ? "page" : "false");
  });
  updateFloatingTabIndicator(navigationSection);
  document.body.classList.toggle("chat-focus", sectionId === "privados");
  document.body.classList.toggle("chat-inbox-view", sectionId === "chat");
  document.body.classList.toggle("achievement-management-open", ["admin-logros", "crear-logro", "asignar-logro"].includes(sectionId));
  if (sectionId === "admin-logros") renderAdminAchievements();
  syncChatInboxAccessibility();
  syncMobileViewport();
  const titles = {
    inicio: "El Club", chat: "Mensajes", miembros: "Miembros",
    privados: "Mensajes privados", perfil: "Perfil", calendario: "Calendario",
    noticias: "Noticias", administracion: "Administración", ayuda: "Ayuda y sugerencias", sobres: "Colección",
    "admin-logros": "Logros del club", "crear-logro": "Crear un logro", "asignar-logro": "Asignar logro"
  };
  pageTitle.textContent = titles[sectionId] || titles.inicio;
  resetSectionScroll(sectionId);
  navigationFrame = requestAnimationFrame(() => {
    if (generation !== navigationGeneration) return;
    navigationFrame = null;
    document.body.classList.remove("tab-switching");
    if (homeAnchor) document.getElementById(homeAnchor)?.scrollIntoView({behavior: "smooth", block: "start"});
    navigationWorkTimer = window.setTimeout(() => {
      if (generation !== navigationGeneration) return;
      navigationWorkTimer = null;
      // Coalesce URL/background work, not taps (Safari limits rapid history writes).
      try {
        history.replaceState(null, "", `#${homeAnchor || sectionId}`);
      } catch (error) {
        // A WebKit history quota must never stop rendering or refreshing the tab.
        if (error.name !== "SecurityError") throw error;
      }
      if ((requestedSection === "noticias" || sectionId === "inicio") && currentUser) loadNews(false);
      if (sectionId === "ayuda" && currentUser) loadHelpCenter();
      if (sectionId === "sobres" && currentUser) globalThis.DailyPacks?.refresh(true);
      if (["perfil", "administracion", "admin-logros", "crear-logro", "asignar-logro"].includes(sectionId) && currentUser && !achievementsLoaded) loadAchievements();
    }, 120);
  });
}

function openProfileQuickMenu() {
  if (!currentUser) return;
  const menu = document.getElementById("profileQuickMenu");
  menu.hidden = false;
  menu.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => { if (!menu.hidden) menu.classList.add("open"); });
  document.querySelector(".profile-tab")?.setAttribute("aria-expanded", "true");
  navigator.vibrate?.(12);
}

function closeProfileQuickMenu({immediate = false} = {}) {
  const menu = document.getElementById("profileQuickMenu");
  if (!menu || menu.hidden) return;
  menu.classList.remove("open");
  menu.setAttribute("aria-hidden", "true");
  document.querySelector(".profile-tab")?.setAttribute("aria-expanded", "false");
  if (immediate) {
    menu.hidden = true;
    return;
  }
  setTimeout(() => {
    if (!menu.classList.contains("open")) menu.hidden = true;
  }, 160);
}

async function exitChatView({animate = true} = {}) {
  const groupSection = document.getElementById("chat");
  if (groupSection?.classList.contains("active") && groupSection.classList.contains("conversation-open")) {
    const update = showGroupChatInbox;
    if (animate) await transitionMessageView(update, {back: true});
    else update();
    return;
  }
  const targetSection = sectionBeforeChat && sectionBeforeChat !== "chat" && sectionBeforeChat !== "privados" ? sectionBeforeChat : "inicio";
  if (animate) await transitionMessageView(() => goTo(targetSection), {back: true});
  else goTo(targetSection);
}

async function backFromPrivateConversation({animate = true} = {}) {
  const update = showPrivateChatInbox;
  if (animate) await transitionMessageView(update, {back: true});
  else update();
}

function showGroupChatInbox() {
  const groupSection = document.getElementById("chat");
  groupSection?.classList.remove("conversation-open");
  document.body.classList.remove("chat-focus");
  syncChatInboxAccessibility();
  syncMobileViewport();
  document.querySelectorAll("#privateContacts .private-contact.active").forEach(contact => contact.classList.remove("active"));
  history.replaceState(null, "", "#chat");
}

function showPrivateChatInbox() {
  activePrivateMemberId = null;
  renderPrivateConversation();
  goTo("chat");
  document.querySelectorAll("#privateContacts .private-contact.active").forEach(contact => contact.classList.remove("active"));
}

function restoreGroupConversation(channelId) {
  if (channelId != null) activeChatChannelId = channelId;
  const groupSection = document.getElementById("chat");
  goTo("chat");
  groupSection?.classList.add("conversation-open");
  document.body.classList.add("chat-focus");
  syncChatInboxAccessibility();
  renderChatChannels();
  renderMessages();
  syncMobileViewport();
  history.replaceState(null, "", "#chat");
}

function restorePrivateConversation(memberId) {
  activePrivateMemberId = memberId;
  renderPrivateContacts();
  renderPrivateConversation();
  goTo("privados");
}

function syncChatInboxAccessibility() {
  const inbox = document.querySelector("#chat .chat-inbox");
  if (inbox) inbox.inert = document.body.classList.contains("chat-focus");
}

function prepareChatBackScene(panel, {entering = false} = {}) {
  if (!panel) return null;
  const width = Math.max(1, Math.round(panel.getBoundingClientRect().width || window.innerWidth));
  const preview = document.querySelector("#chat .chat-inbox");
  const kind = panel.closest("#privados") ? "private" : "group";
  if (!preview || !width) return null;
  document.body.classList.add("chat-back-transition-active");
  panel.classList.add("chat-back-live-panel");
  const scene = {panel, preview, kind, width, offset: 0, animations: []};
  activeChatMotionScene = scene;
  updateChatBackScene(scene, entering ? width : 0);
  return scene;
}

function updateChatBackScene(scene, offset) {
  if (!scene?.panel) return;
  const {offset: clamped, listOffset} = ChatMotion.position(offset, scene.width);
  scene.offset = clamped;
  scene.panel.style.setProperty("--chat-back-offset", `${clamped}px`);
  scene.preview.style.setProperty("--chat-back-list-offset", `${listOffset}px`);
}

function cleanupChatBackScene(scene) {
  if (!scene) return;
  scene.animations.forEach(animation => animation.cancel());
  scene.panel?.classList.remove("chat-back-live-panel", "chat-back-button-exit");
  scene.panel?.style.removeProperty("--chat-back-offset");
  scene.preview?.style.removeProperty("--chat-back-list-offset");
  if (activeChatMotionScene === scene) {
    activeChatMotionScene = null;
    document.body.classList.remove("chat-back-transition-active");
  }
}

async function settleChatBackScene(scene, targetOffset) {
  if (!scene?.panel) return;
  const from = ChatMotion.position(scene.offset, scene.width);
  const to = ChatMotion.position(targetOffset, scene.width);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = ChatMotion.duration(Math.abs(to.offset - from.offset), scene.width, reduced);
  updateChatBackScene(scene, to.offset);
  if (!duration || !scene.panel.animate) return;
  const options = {duration, easing: ChatMotion.easing, fill: "both"};
  scene.animations = [
    scene.panel.animate([
      {transform: `translate3d(${from.offset}px,0,0)`},
      {transform: `translate3d(${to.offset}px,0,0)`}
    ], options),
    scene.preview.animate([
      {transform: `translate3d(${from.listOffset}px,0,0)`},
      {transform: `translate3d(${to.listOffset}px,0,0)`}
    ], options)
  ];
  try {
    await Promise.all(scene.animations.map(animation => animation.finished.catch(() => {})));
  } finally {
    scene.animations.forEach(animation => animation.cancel());
    scene.animations = [];
  }
}

function completeChatBackDestination(kind) {
  if (kind === "private") showPrivateChatInbox();
  else showGroupChatInbox();
}

function resetChatBackGesture({settle = false} = {}) {
  const gesture = chatBackGesture;
  chatBackGesture = null;
  if (!gesture) return;
  if (gesture.panel.hasPointerCapture?.(gesture.pointerId)) gesture.panel.releasePointerCapture(gesture.pointerId);
  if (gesture.frame) cancelAnimationFrame(gesture.frame);
  if (!gesture.scene) return;
  if (!settle) {
    cleanupChatBackScene(gesture.scene);
    messageViewTransitioning = false;
    return;
  }
  void settleChatBackScene(gesture.scene, 0).finally(() => {
    cleanupChatBackScene(gesture.scene);
    messageViewTransitioning = false;
  });
}

function startChatBackGesture(event) {
  if (!isMobileSidebar() || event.pointerType === "mouse" || event.isPrimary === false || messageViewTransitioning || chatBackGesture) return;
  if (event.target.closest(".message-form, button, a, input, textarea, select, audio, video, [contenteditable='true']")) return;
  const panel = event.target.closest("#privados.active.conversation-open .private-conversation, #chat.active.conversation-open .group-conversation");
  if (!panel || !event.target.closest(".messages, .chat-header")) return;
  chatBackGesture = {
    pointerId: event.pointerId,
    panel,
    sourcePanel: panel,
    kind: panel.closest("#privados") ? "private" : "group",
    memberId: activePrivateMemberId,
    channelId: activeChatChannelId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastTime: event.timeStamp || performance.now(),
    velocityX: 0,
    deltaX: 0,
    deltaY: 0,
    tracking: false,
    scene: null,
    frame: null,
    pendingOffset: 0,
  };
  try { panel.setPointerCapture?.(event.pointerId); } catch { /* Pointer may already have been cancelled by the OS. */ }
}

function moveChatBackGesture(event) {
  const gesture = chatBackGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const now = event.timeStamp || performance.now();
  const elapsed = Math.max(1, now - gesture.lastTime);
  gesture.velocityX = (event.clientX - gesture.lastX) / elapsed;
  gesture.lastX = event.clientX;
  gesture.lastTime = now;
  gesture.deltaX = event.clientX - gesture.startX;
  gesture.deltaY = event.clientY - gesture.startY;
  if (!gesture.tracking) {
    if (Math.abs(gesture.deltaY) > CHAT_BACK_GESTURE.maxVerticalDistance || gesture.deltaX < -18) {
      resetChatBackGesture();
      return;
    }
    if (gesture.deltaX < CHAT_BACK_GESTURE.activationDistance || Math.abs(gesture.deltaX) <= Math.abs(gesture.deltaY) * 1.12) return;
    gesture.tracking = true;
    gesture.scene = prepareChatBackScene(gesture.sourcePanel);
    if (!gesture.scene) {
      resetChatBackGesture();
      return;
    }
    messageViewTransitioning = true;
  }
  if (event.cancelable) event.preventDefault();
  gesture.pendingOffset = Math.max(0, gesture.deltaX);
  if (!gesture.frame) {
    gesture.frame = requestAnimationFrame(() => {
      gesture.frame = null;
      if (chatBackGesture === gesture) updateChatBackScene(gesture.scene, gesture.pendingOffset);
    });
  }
}

async function finishChatBackGesture(event) {
  const gesture = chatBackGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  if (gesture.frame) {
    cancelAnimationFrame(gesture.frame);
    gesture.frame = null;
    if (gesture.scene) updateChatBackScene(gesture.scene, gesture.pendingOffset);
  }
  const completionDistance = Math.min(CHAT_BACK_GESTURE.triggerDistance, gesture.scene?.width * CHAT_BACK_GESTURE.completionRatio || CHAT_BACK_GESTURE.triggerDistance);
  const shouldComplete = gesture.tracking
    && Math.abs(gesture.deltaY) <= CHAT_BACK_GESTURE.maxVerticalDistance
    && (gesture.deltaX >= completionDistance || gesture.velocityX >= CHAT_BACK_GESTURE.velocityThreshold);
  if (!shouldComplete) {
    resetChatBackGesture({settle: gesture.tracking});
    return;
  }
  chatBackGesture = null;
  if (gesture.panel.hasPointerCapture?.(gesture.pointerId)) gesture.panel.releasePointerCapture(gesture.pointerId);
  suppressChatGestureClick = true;
  try {
    await settleChatBackScene(gesture.scene, gesture.scene.width);
    completeChatBackDestination(gesture.scene.kind);
  } finally {
    cleanupChatBackScene(gesture.scene);
    messageViewTransitioning = false;
    window.setTimeout(() => { suppressChatGestureClick = false; }, 80);
  }
}

async function openGroupConversation(channelId = activeChatChannelId) {
  if (channelId != null && chatChannels.some(channel => String(channel.id) === String(channelId))) {
    activeChatChannelId = channelId;
  }
  const groupSection = document.getElementById("chat");
  await transitionMessageView(() => {
    goTo("chat");
    groupSection.classList.add("conversation-open");
    document.body.classList.add("chat-focus");
    syncChatInboxAccessibility();
    renderChatChannels();
    renderMessages();
    syncMobileViewport();
    history.replaceState(null, "", "#chat");
  });
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

function renderMembers() {
  document.getElementById("membersGrid").innerHTML = members.filter(member => !member.hidden).map(member => `
    <button class="club-member" type="button" data-profile="${member.id}">
      ${getAvatar(member)}
      <span><strong>${escapeHtml(member.name)}</strong><small>@${escapeHtml(member.username)}</small></span>
    </button>`).join("");
}

function memberDisplayNumber(member) {
  const visibleIndex = members.filter(item => !item.hidden).findIndex(item => item.id === member.id);
  return visibleIndex >= 0 ? visibleIndex + 1 : member.id;
}

function achievementTier(tier) {
  return ACHIEVEMENT_TIERS[tier] || ACHIEVEMENT_TIERS.bronze;
}

function achievementTrophyIcon(tier, customIcon = "") {
  const assetTier = Object.hasOwn(ACHIEVEMENT_TIERS, tier) ? tier : "bronze";
  const customMark = customIcon
    ? `<i class="achievement-custom-mark">${escapeHtml(String(customIcon).slice(0, 3))}</i>`
    : "";
  return `<span class="achievement-trophy" data-tier="${assetTier}">
    <img src="icons/trophies/${assetTier}.svg?v=20260903-132" width="512" height="512" alt="" decoding="async" draggable="false">${customMark}
  </span>`;
}

function achievementsForMember(member) {
  if (!member?.authId) return [];
  const assignedIds = new Set(achievementAwards.filter(award => award.userId === member.authId).map(award => String(award.achievementId)));
  return achievements.filter(achievement => assignedIds.has(String(achievement.id)));
}

function renderMemberAchievements(member) {
  const assigned = achievementsForMember(member);
  return `<section class="profile-achievements">
    <div class="profile-feed-heading"><div><h3>Tu vitrina</h3></div><span class="club-profile-achievement-summary"><span class="club-profile-earned"><strong>${assigned.length}</strong> ${assigned.length === 1 ? "logro" : "logros"}</span>${renderAchievementChallengeTrigger(member)}</span></div>
    <p class="club-vitrine-caption">Cada logro cuenta una historia.</p>
    <div class="achievement-showcase">
      ${assigned.length ? assigned.map(achievement => {
        const tier = achievementTier(achievement.tier);
        return `<button type="button" class="achievement-card tier-${escapeHtml(achievement.tier)}" data-open-achievement="${escapeHtml(achievement.id)}" aria-label="Ver logro: ${escapeHtml(achievement.name)}">
          <span class="achievement-emblem" aria-hidden="true">${achievementTrophyIcon(achievement.tier, achievement.icon)}</span>
          <span class="achievement-card-copy"><small>${escapeHtml(tier.label)}</small><strong>${escapeHtml(achievement.name)}</strong></span>
        </button>`;
      }).join("") : `<div class="empty-state compact achievement-empty"><strong>${achievementsLoading ? "Preparando los trofeos…" : "Tu próxima historia empieza aquí"}</strong><span>Los logros conseguidos aparecerán en este espacio.</span></div>`}
    </div>
  </section>`;
}

let activeAchievementId = null;
let achievementReturnFocus = null;

function renderPersonalAchievementProgress(achievement) {
  if (!achievement.rule) return "";
  const objective = AchievementProgress.objective(achievement.rule);
  const ownData = achievementProgressUserId === currentAuthUser?.id && achievementProgressStatus === "ready";
  if (!ownData) return `<span class="achievement-personal-progress"><span class="achievement-progress-objective">${escapeHtml(objective)}</span><small>Tu progreso no está disponible ahora. Se actualizará al recuperar la conexión.</small></span>`;
  const record = achievementProgress.find(item => String(item.achievementId) === String(achievement.id));
  const state = AchievementProgress.progress(achievement.rule, record);
  if (!state) return "";
  return `<span class="achievement-personal-progress"><span class="achievement-progress-objective">${escapeHtml(objective)}</span>
    <span class="achievement-progress-count"><strong>${state.complete ? "Objetivo completado" : "Tu progreso"}</strong><span>${state.value} / ${state.target} · ${state.percent}%</span></span>
    <progress max="${state.target}" value="${state.value}" aria-label="Tu progreso: ${escapeHtml(achievement.name)}"></progress>
  </span>`;
}

function renderPendingAchievements(member) {
  if (!currentAuthUser || member.authId !== currentAuthUser.id || member.hidden) return "";
  if (achievementProgressStatus === "unavailable") return ""; // Legacy installations keep manual trophies.
  const pending = AchievementProgress.orderedPending(achievements, achievementAwards, achievementProgress, currentAuthUser.id);
  return `<section class="achievement-challenges" aria-labelledby="achievementChallengesPanelTitle">
    <div class="achievement-challenges-intro"><span class="eyebrow">PASO A PASO</span><h3 id="achievementChallengesPanelTitle">Tus próximos logros</h3><p class="achievement-private-note">Ordenados desde el que tienes más cerca. Este progreso solo lo ves tú.</p></div>
    ${achievementProgressStatus !== "ready" ? `<p class="achievement-private-note" role="status">${achievementProgressStatus === "loading" ? "Cargando tus objetivos…" : "No se ha podido actualizar tu progreso. Inténtalo de nuevo."}</p><button type="button" class="secondary-button" data-reload-achievements>Actualizar progreso</button>` : ""}
    <div class="achievement-challenge-list">${pending.length ? pending.map(achievement => `<button type="button" class="achievement-challenge tier-${escapeHtml(achievement.tier)}" data-open-achievement="${escapeHtml(achievement.id)}" aria-label="Ver objetivo: ${escapeHtml(achievement.name)}">
      <span class="achievement-challenge-art" aria-hidden="true">${achievementTrophyIcon(achievement.tier, achievement.icon)}</span>
      <span class="achievement-challenge-copy"><small>${escapeHtml(achievementTier(achievement.tier).label)}</small><strong>${escapeHtml(achievement.name)}</strong>${renderPersonalAchievementProgress(achievement)}</span>
    </button>`).join("") : achievementProgressStatus === "ready" ? `<div class="achievement-challenges-complete"><strong>Todo conquistado</strong><span>Has conseguido todos los objetivos disponibles.</span></div>` : ""}</div>
  </section>`;
}

function renderAchievementChallengeTrigger(member) {
  if (!currentAuthUser || member.authId !== currentAuthUser.id || member.hidden || achievementProgressStatus === "unavailable") return "";
  const count = AchievementProgress.pending(achievements, achievementAwards, currentAuthUser.id).length;
  return `<button type="button" class="achievement-challenges-trigger" data-open-achievement-challenges aria-label="Ver tus próximos logros${count ? `: ${count} pendientes` : ""}">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
    ${count ? `<span>${count > 99 ? "99+" : count}</span>` : ""}
  </button>`;
}

let achievementChallengesReturnFocus = null;
function renderAchievementChallengesDialog() {
  const member = currentUser ? getMember(currentUser.id) || currentUser : null;
  const content = document.getElementById("achievementChallengesContent");
  if (member && content) content.innerHTML = renderPendingAchievements(member);
}
function openAchievementChallenges() {
  if (!currentUser) return;
  achievementChallengesReturnFocus = document.activeElement;
  renderAchievementChallengesDialog();
  const dialog = document.getElementById("achievementChallengesDialog");
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("achievement-challenges-open");
  document.getElementById("closeAchievementChallenges").focus({preventScroll:true});
}
function closeAchievementChallenges(restoreFocus = true) {
  const dialog = document.getElementById("achievementChallengesDialog");
  if (dialog.open) dialog.close();
  document.body.classList.remove("achievement-challenges-open");
  const focus = achievementChallengesReturnFocus;
  achievementChallengesReturnFocus = null;
  if (restoreFocus && focus?.isConnected) focus.focus({preventScroll:true});
}

function renderAchievementDetail() {
  if (!activeAchievementId) return;
  const achievement = achievements.find(item => String(item.id) === activeAchievementId);
  if (!achievement) { closeAchievementDetail(); return; }
  const {owners, total, percent} = ClubModel.achievementOwnership(achievement.id, members, achievementAwards);
  const tier = achievementTier(achievement.tier);
  const earned = achievementAwards.some(award => String(award.achievementId) === String(achievement.id) && award.userId === (currentAuthUser?.id || currentUser?.authId));
  const content = document.getElementById("achievementDetailContent");
  const visualKey = JSON.stringify([achievement.id, achievement.tier, achievement.icon]);
  const previousVisual = content.querySelector(".achievement-detail-visual");
  content.innerHTML = `
    <div class="achievement-detail-visual" data-visual-key="${escapeHtml(visualKey)}">
      <div class="achievement-detail-art tier-${escapeHtml(achievement.tier)}" data-motion-state="static" aria-hidden="true">
        ${achievementTrophyIcon(achievement.tier, achievement.icon)}<div class="trophy-lottie"></div>
      </div>
      <button type="button" class="trophy-replay" aria-label="Repetir animación del trofeo">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 8V3m0 5h-5M20 8a8 8 0 1 0 0 8"/></svg><span>Repetir animación</span>
      </button>
    </div>
    <span class="achievement-detail-tier">${escapeHtml(tier.label)} · ${earned ? "Conseguido" : "Logro del club"}</span>
    <h2 id="achievementDetailTitle">${escapeHtml(achievement.name)}</h2>
    <p id="achievementDetailDescription">${escapeHtml(achievement.description || "Un reconocimiento concedido por la administración del club.")}</p>
    ${renderPersonalAchievementProgress(achievement)}
    <div class="achievement-rarity"><strong>${total ? new Intl.NumberFormat("es-ES", {maximumFractionDigits: 1}).format(percent) + "%" : "—"}</strong><span>de los miembros del club</span>
      <progress max="100" value="${percent}" aria-label="Porcentaje de miembros con este logro"></progress>
      <small>${total ? `${owners} de ${total} miembros activos lo han conseguido` : "Aún no hay un censo de miembros disponible"}</small>
    </div>`;
  // Ownership/description updates must not restart an already playing trophy.
  if (previousVisual?.dataset.visualKey === visualKey) {
    content.querySelector(".achievement-detail-visual").replaceWith(previousVisual);
  } else {
    TrophyMotion.mount(content.querySelector(".achievement-detail-art"), Object.hasOwn(ACHIEVEMENT_TIERS, achievement.tier) ? achievement.tier : "bronze", content.querySelector(".trophy-replay"));
  }
}
function openAchievementDetail(id, returnFocus = document.activeElement) {
  activeAchievementId = String(id);
  achievementReturnFocus = returnFocus;
  renderAchievementDetail();
  if (!activeAchievementId) return;
  const dialog = document.getElementById("achievementDetail");
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("achievement-detail-open");
  document.getElementById("closeAchievementDetail").focus({preventScroll: true});
}
function closeAchievementDetail() {
  document.getElementById("achievementDetail").close();
}
function finishAchievementDetail() {
  TrophyMotion.destroy();
  document.getElementById("achievementDetailContent").replaceChildren();
  activeAchievementId = null;
  document.body.classList.remove("achievement-detail-open");
  const focus = achievementReturnFocus;
  achievementReturnFocus = null;
  if (focus?.isConnected) focus.focus({preventScroll: true});
}

function renderProfile(memberId, navigate = true) {
  const member = getMember(memberId) || (Number(currentUser?.id) === Number(memberId) ? currentUser : null);
  if (!member) return;
  activeProfileId = member.id;
  const isOwnProfile = currentUser?.id === member.id;
  const canEdit = isOwnProfile && !member.hidden;
  const canManageProfile = !member.hidden && (canEdit || isSuperAdmin());
  document.querySelector("#perfil .back-button").hidden = isOwnProfile;
  const markup = `
    <article class="club-profile">
      <div class="club-profile-topline"><span class="eyebrow">MIEMBRO DEL CLUB</span><span class="club-member-number">${member.hidden ? "ADMIN" : `N.º ${String(memberDisplayNumber(member)).padStart(2, "0")}`}</span></div>
      <div class="club-profile-identity">
        ${getAvatar(member, "avatar club-profile-avatar")}
        <div><span class="club-profile-handle">@${escapeHtml(member.username || member.name)}</span><h2>${escapeHtml(member.name)}</h2><span class="club-profile-role">${escapeHtml(member.role || "Miembro")}</span></div>
      </div>
      ${member.nickname ? `<p class="club-profile-nickname">${escapeHtml(member.nickname)}</p>` : ""}
      ${member.bio ? `<p class="club-profile-bio">${escapeHtml(member.bio)}</p>` : ""}
      <div class="profile-tags">${(member.tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="club-profile-bottom">
        <div class="profile-actions">
          ${canManageProfile ? `<button class="secondary-button" id="editProfileButton" type="button">${canEdit ? "Editar perfil" : "Gestionar perfil"}</button>` : ""}
          ${!isOwnProfile ? `<button class="primary-button" data-private-member="${member.id}" type="button">Enviar mensaje</button>` : ""}
        </div>
      </div>
    </article>
    ${renderMemberAchievements(member)}`;
  // Preserve decoded avatars, achievement nodes and listeners until data changes.
  if (profileRender?.id !== member.id || profileRender.markup !== markup) {
    document.getElementById("profileContent").innerHTML = markup;
    profileRender = {id: member.id, markup};
    document.getElementById("editProfileButton")?.addEventListener("click", () => openProfileEditor(member.id));
  }
  if (navigate) goTo("perfil");
}

function spotifyEmbedUrl(value = "") {
  const match = value.trim().match(/(?:open\.spotify\.com\/playlist\/|spotify:playlist:)([A-Za-z0-9]+)/);
  return match ? `https://open.spotify.com/embed/playlist/${match[1]}?utm_source=generator&theme=0` : "";
}

function renderSpotify() {
  const url = siteSettings.spotify_playlist || "";
  const embed = spotifyEmbedUrl(url);
  const player = document.getElementById("spotifyPlayer");
  if (player.dataset.embed === embed) return;
  player.dataset.embed = embed;
  if (embed) {
    player.innerHTML = `<iframe src="${escapeHtml(embed)}" title="Playlist de The Big Boy Rules en Spotify" width="100%" height="352" frameborder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
    document.getElementById("editSpotifyButton").textContent = "Cambiar playlist";
  } else {
    player.innerHTML = `<div class="empty-state"><strong>La música está por llegar.</strong><span>Aquí sonará la playlist del club.</span></div>`;
    document.getElementById("editSpotifyButton").textContent = "Vincular playlist";
  }
}

function groupAvatarMarkup(className = "chat-group-avatar") {
  const avatarUrl = siteSettings.group_avatar_url || "";
  return `<span class="${className}" data-group-avatar aria-hidden="true">${avatarUrl
    ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" decoding="async">`
    : "<b>BB</b>"}<i></i></span>`;
}

function renderGroupAvatarSurfaces() {
  document.querySelectorAll("[data-group-avatar]").forEach(node => {
    const avatarUrl = siteSettings.group_avatar_url || "";
    node.innerHTML = avatarUrl
      ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" decoding="async"><i></i>`
      : "<b>BB</b><i></i>";
    node.classList.toggle("has-image", Boolean(avatarUrl));
  });
  const editButton = document.getElementById("editGroupAvatarButton");
  if (editButton) {
    const editable = canManageSite();
    editButton.disabled = !editable;
    editButton.setAttribute("aria-label", editable ? "Cambiar foto del grupo" : "Foto del grupo");
    editButton.title = editable ? "Cambiar foto del grupo" : "Foto del grupo";
  }
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
      ${own ? "" : `<button class="message-avatar-link" type="button" data-profile="${message.member}" aria-label="Ver perfil de ${escapeHtml(member?.name || "miembro")}">${getAvatar(member)}</button>`}
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
  scrollConversationToLatest(container);
}

function scrollConversationToLatest(container) {
  if (!container) return;
  const requestId = String((Number(container.dataset.latestScrollRequest) || 0) + 1);
  container.dataset.latestScrollRequest = requestId;
  const apply = () => {
    if (container.dataset.latestScrollRequest !== requestId) return;
    container.scrollTop = container.scrollHeight;
  };
  apply();
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(apply);
  });
  [90, 240, 520].forEach(delay => window.setTimeout(apply, delay));
  container.querySelectorAll("img, video, audio").forEach(media => {
    ["load", "loadedmetadata", "durationchange"].forEach(type => media.addEventListener(type, apply, {once: true}));
  });
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
  if (sharedMedia) return `<span class="retired-content">Contenido compartido ya no disponible</span>`;
  if (message.attachmentType?.startsWith("image/")) {
    return `<a class="message-image" href="${escapeHtml(message.attachmentUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(message.attachmentUrl)}" alt="${escapeHtml(message.attachmentName || "Imagen adjunta")}" loading="lazy"></a>`;
  }
  if (message.attachmentType?.startsWith("video/")) {
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
  return encoded ? {kind: encoded[1], id: encoded[2]} : null;
}

function formatInboxTime(value, now = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"});
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return date.toLocaleDateString("es-ES", {day: "numeric", month: "short"});
}

function normalizeInboxSearch(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

function filterInboxContacts() {
  const inbox = document.querySelector(".chat-inbox");
  if (!inbox) return;
  const mode = inbox.dataset.filter || "all";
  const query = normalizeInboxSearch(document.getElementById("inboxSearchInput").value);
  let visible = 0;
  inbox.querySelectorAll(".private-contact").forEach(contact => {
    const matchesMode = mode === "new" ? !contact.hasAttribute("data-open-group-chat")
      : mode === "unread" ? Number(contact.dataset.unread) > 0
      : mode === "favorites" ? contact.dataset.favorite === "true"
      : mode === "groups" ? contact.dataset.kind === "group"
      : contact.dataset.conversation === "true" || Boolean(query);
    contact.hidden = !(matchesMode && normalizeInboxSearch(contact.dataset.search).includes(query));
    if (!contact.hidden) visible++;
  });
  inbox.querySelectorAll("[data-inbox-filter]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.inboxFilter === mode)));
  const empty = document.getElementById("inboxEmpty");
  empty.hidden = visible > 0;
  empty.textContent = query ? "No hay coincidencias. Prueba con otro nombre."
    : mode === "unread" ? "Estás al día. No tienes mensajes sin leer."
    : mode === "favorites" ? "Aún no tienes chats favoritos. Márcalos con la estrella."
    : mode === "groups" ? "No hay grupos para mostrar."
    : mode === "new" ? "No hay miembros que coincidan con tu búsqueda." : "Todavía no hay conversaciones.";
}

document.getElementById("inboxSearchInput").addEventListener("input", filterInboxContacts);
document.querySelectorAll("[data-inbox-filter]").forEach(button => button.addEventListener("click", () => {
  document.querySelector(".chat-inbox").dataset.filter = button.dataset.inboxFilter;
  const input = document.getElementById("inboxSearchInput");
  input.placeholder = button.dataset.inboxFilter === "new" ? "Buscar miembro para chatear" : "Buscar conversación";
  filterInboxContacts();
  if (button.dataset.inboxFilter === "new") input.focus({preventScroll: true});
}));

function closeInboxContextMenu() {
  const menu = document.getElementById("inboxContextMenu");
  if (menu && menu.parentElement !== document.body) document.body.append(menu);
  if (menu) menu.hidden = true;
}

function showInboxContextMenu(contact, x, y) {
  if (!contact?.isConnected) return;
  const menu = document.getElementById("inboxContextMenu");
  const action = document.getElementById("inboxFavoriteAction");
  if (!menu || !action) return;
  const rect = contact.getBoundingClientRect();
  const favoriteId = contact.dataset.favoriteId;
  if (!favoriteId) return;
  menu.dataset.favoriteId = favoriteId;
  action.textContent = contact.dataset.favorite === "true" ? "Quitar de favoritos" : "Añadir a favoritos";
  menu.hidden = false;
  const width = menu.offsetWidth || 224;
  const height = menu.offsetHeight || 56;
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, x || rect.right - width));
  const top = Math.max(12, Math.min(window.innerHeight - height - 12, y || rect.bottom + 4));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  suppressInboxRowClick = true;
  window.setTimeout(() => { suppressInboxRowClick = false; }, 900);
}

document.addEventListener("pointerdown", event => {
  if (event.target.closest?.("#inboxContextMenu")) return;
  closeInboxContextMenu();
  const contact = event.target.closest?.(".chat-inbox .private-contact");
  if (!contact) return;
  clearTimeout(inboxHoldTimer);
  inboxHoldPointer = {id: event.pointerId, x: event.clientX, y: event.clientY, contact};
  inboxHoldTimer = window.setTimeout(() => {
    showInboxContextMenu(contact, event.clientX, event.clientY);
    inboxHoldPointer = null;
  }, 480);
}, {passive: true});

document.addEventListener("pointermove", event => {
  if (!inboxHoldPointer || inboxHoldPointer.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - inboxHoldPointer.x, event.clientY - inboxHoldPointer.y) > 12) {
    clearTimeout(inboxHoldTimer);
    inboxHoldPointer = null;
  }
}, {passive: true});

function cancelInboxHold(event) {
  if (event && inboxHoldPointer && inboxHoldPointer.id !== event.pointerId) return;
  clearTimeout(inboxHoldTimer);
  inboxHoldPointer = null;
}
document.addEventListener("pointerup", cancelInboxHold, {passive: true});
document.addEventListener("pointercancel", cancelInboxHold, {passive: true});
document.addEventListener("contextmenu", event => {
  const contact = event.target.closest?.(".chat-inbox .private-contact");
  if (!contact) return;
  event.preventDefault();
  showInboxContextMenu(contact, event.clientX, event.clientY);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeInboxContextMenu();
  if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
  const contact = event.target.closest?.(".chat-inbox .private-contact");
  if (!contact) return;
  event.preventDefault();
  const rect = contact.getBoundingClientRect();
  showInboxContextMenu(contact, rect.right, rect.bottom + 4);
});
document.getElementById("inboxFavoriteAction")?.addEventListener("click", () => {
  const menu = document.getElementById("inboxContextMenu");
  const authId = currentAuthUser?.id;
  const targetId = menu?.dataset.favoriteId;
  if (!authId || !targetId) return;
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(CHAT_FAVORITES_STORAGE_KEY) || "{}"); } catch {}
  const next = new Set(Array.isArray(stored[authId]) ? stored[authId].map(String) : []);
  if (next.has(targetId)) next.delete(targetId); else next.add(targetId);
  stored[authId] = [...next];
  localStorage.setItem(CHAT_FAVORITES_STORAGE_KEY, JSON.stringify(stored));
  closeInboxContextMenu();
  renderPrivateContacts();
});

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
  const latestByMember = new Map();
  const unreadByMember = new Map();
  notifications.forEach(item => {
    if (item.type === "private_message" && !item.readAt) unreadByMember.set(item.actorId, (unreadByMember.get(item.actorId) || 0) + 1);
  });
  privateMessages.forEach(message => {
    const otherAuthId = message.senderId === currentAuthUser?.id ? message.recipientId
      : message.recipientId === currentAuthUser?.id ? message.senderId : null;
    if (otherAuthId) latestByMember.set(otherAuthId, message);
  });
  let storedFavorites = {};
  try { storedFavorites = JSON.parse(localStorage.getItem(CHAT_FAVORITES_STORAGE_KEY) || "{}"); } catch {}
  const userFavorites = new Set(Array.isArray(storedFavorites[currentAuthUser?.id]) ? storedFavorites[currentAuthUser.id].map(String) : []);
  const contacts = members.filter(member => member.id !== currentUser.id).map(member => ({
    member,
    latest: latestByMember.get(member.authId)
  })).sort((a, b) => {
    const aTime = a.latest ? new Date(a.latest.createdAt).getTime() : 0;
    const bTime = b.latest ? new Date(b.latest.createdAt).getTime() : 0;
    return bTime - aTime || a.member.name.localeCompare(b.member.name, "es");
  });
  const groupContact = `<button class="private-contact group-chat-contact ${document.getElementById("chat")?.classList.contains("conversation-open") ? "active" : ""}" type="button" data-open-group-chat data-kind="group" data-favorite-id="group" data-favorite="${userFavorites.has("group")}" data-search="Bigboys The Big Boy Rules grupo" data-conversation="true" data-unread="0" aria-description="Mantén pulsado para gestionar favoritos">
    ${groupAvatarMarkup()}
    <span class="private-contact-copy"><span><strong>Bigboys</strong>${latestGroupMessage ? `<time datetime="${escapeHtml(latestGroupMessage.createdAt)}">${formatInboxTime(latestGroupMessage.createdAt)}</time>` : ""}</span><small>${latestGroupChannel ? `#${escapeHtml(latestGroupChannel.name)} · ` : ""}${escapeHtml(groupPreview)}</small></span>
    <span class="inbox-group-label">Grupo</span>
  </button>`;
  const privateContactsMarkup = contacts.map(({member, latest}) => {
    const unread = unreadByMember.get(member.authId) || 0;
    const favorite = userFavorites.has(String(member.authId));
    return `<button type="button" class="private-contact ${unread ? "has-unread" : ""} ${activePrivateMemberId === member.id ? "active" : ""}" data-private-member="${member.id}" data-kind="private" data-favorite-id="${escapeHtml(member.authId || "")}" data-favorite="${favorite}" data-search="${escapeHtml(`${member.name} ${member.username || ""}`)}" data-conversation="${Boolean(latest) || unread > 0}" data-unread="${unread}" aria-description="Mantén pulsado para gestionar favoritos">
      ${getAvatar(member)}
      <span class="private-contact-copy"><span><strong>${escapeHtml(member.name)}</strong>${latest ? `<time datetime="${escapeHtml(latest.createdAt)}">${formatInboxTime(latest.createdAt)}</time>` : ""}</span><small>${latest ? `${latest.senderId === currentAuthUser?.id ? "Tú: " : ""}${escapeHtml(messagePreviewText(latest.body, latest.attachmentType))}` : "Iniciar conversación"}</small></span>
      ${unread ? `<span class="inbox-unread-count" aria-label="${unread} avisos sin leer">${unread > 99 ? "99+" : unread}</span>` : ""}
    </button>`;
  }).join("");
  panel.innerHTML = `${groupContact}${privateContactsMarkup}`;
  filterInboxContacts();
}

function messagePreviewText(body, attachmentType) {
  if (body?.trim()) return body.trim();
  if (attachmentType?.startsWith("audio/")) return "Nota de voz";
  if (attachmentType?.startsWith("image/")) return "Foto";
  if (attachmentType?.startsWith("video/")) return "Vídeo";
  return attachmentType ? "Archivo adjunto" : "Mensaje";
}

async function openPrivateConversation(memberId) {
  const member = getMember(memberId);
  if (!member || member.id === currentUser?.id) return;
  await transitionMessageView(() => {
    activePrivateMemberId = member.id;
    renderPrivateConversation();
    goTo("privados");
    scrollConversationToLatest(document.getElementById("privateMessages"));
  });
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
      <button class="private-chat-avatar" type="button" data-profile="${member.id}" aria-label="Ver perfil de ${escapeHtml(member.name)}">
        ${getAvatar(member)}
      </button>
      <div><h3>${escapeHtml(member.name)}</h3><span class="chat-username">@${escapeHtml(member.username)}</span></div>
    </div>`;
  const items = privateMessages.filter(message =>
    (message.senderId === currentAuthUser?.id && message.recipientId === member.authId)
    || (message.senderId === member.authId && message.recipientId === currentAuthUser?.id));
  container.innerHTML = items.length ? items.map(message => {
    const own = message.senderId === currentAuthUser?.id;
    return `<div class="message private-message ${own ? "own own-message" : ""}">
      <div class="message-bubble" data-message-bubble>
        ${message.body ? `<p>${escapeHtml(message.body)}</p>` : ""}
        ${message.attachmentUrl ? renderMessageAttachment(message) : ""}
        <time class="private-message-time" datetime="${escapeHtml(message.createdAt)}" title="${escapeHtml(formatMessageDate(message.createdAt))}">${formatInboxTime(message.createdAt)}</time>
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
  scrollConversationToLatest(container);
}

function renderCalendar() {
  renderUpcomingEvents();
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
    cells += `<button class="calendar-day ${dateKey(date) === todayKey ? "today" : ""} ${events.length ? "has-events" : ""}" type="button" data-calendar-date="${calendarKey}" ${dateKey(date) === todayKey ? 'aria-current="date"' : ""} aria-label="${day} de ${calendarDate.toLocaleDateString("es-ES", {month: "long"})}, ${events.length} eventos${events.length ? `: ${escapeHtml(events.map(event => event.title).join(", "))}` : ""}">
      <span>${day}</span><span class="calendar-dots" aria-hidden="true">${events.slice(0, 3).map(event => `<i class="${event.eventType === "birthday" ? "birthday" : ""}"></i>`).join("")}</span>
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

function renderUpcomingEvents() {
  const upcoming = ClubModel.upcomingEvents(groupEvents);
  document.getElementById("upcomingEvents").innerHTML = upcoming.length ? upcoming.map(({event, date}) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return `<button class="club-event" type="button" data-calendar-date="${key}">
      <time datetime="${key}"><strong>${date.getDate()}</strong><small>${date.toLocaleDateString("es-ES", {month: "short"}).replace(".", "")}</small></time>
      <span><strong>${escapeHtml(event.title)}</strong><small>${event.eventType === "birthday" ? "Cumpleaños · Todo el día" : date.toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"})}${event.location ? ` · ${escapeHtml(event.location)}` : ""}</small></span>
    </button>`;
  }).join("") : `<div class="club-plans-empty"><strong>Lo próximo está por escribir</strong><p>Los planes y cumpleaños del club aparecerán aquí.</p></div>`;
}

let activeCalendarDay = null;

function openCalendarDay(dateValue) {
  const [year, month, day] = String(dateValue).split("-").map(Number);
  if (!year || !month || !day) return;
  activeCalendarDay = dateValue;
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
  activeCalendarDay = null;
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
  document.getElementById("searchResults").hidden = !term;
  if (!term) {
    document.getElementById("searchResults").innerHTML = "";
    return;
  }
  const results = members
    .filter(member => !member.hidden && normalizeUsername(`${member.name} ${member.username} ${member.nickname}`).includes(term))
    .slice(0, 20);
  document.getElementById("searchResults").innerHTML = results.length ? results.map(member => {
    const detail = `@${member.username}${member.nickname ? ` · ${member.nickname}` : ""}`;
    return `<button type="button" class="search-result member-search-result" data-profile="${member.id}">
      ${getAvatar(member, "avatar small")}
      <span class="search-result-copy"><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(detail)}</small></span>
    </button>`;
  }).join("") : `<div class="empty-state compact">No hay miembros para “${escapeHtml(query)}”.</div>`;
}

function renderAdminPanel() {
  const summary = document.getElementById("adminSummary");
  const table = document.getElementById("adminUsersTable");
  const tools = document.getElementById("superAdminTools");
  tools?.classList.toggle("visible", canManageSite());
  if (!summary || !table) return;
  if (!canManageSite()) {
    summary.innerHTML = "";
    table.innerHTML = "";
    return;
  }
  const visibleMembers = members.filter(member => !member.hidden);
  summary.innerHTML = `
    <div class="admin-stat-card"><span>USUARIOS</span><strong>${visibleMembers.length}</strong><small>cuentas registradas</small></div>
    <div class="admin-stat-card"><span>ADMINISTRADORES</span><strong>${visibleMembers.filter(item => item.roleKey === "admin").length}</strong><small>visibles en el club</small></div>
    <div class="admin-stat-card"><span>EN LÍNEA</span><strong>${onlineUsers.length}</strong><small>presencia real ahora</small></div>`;
  table.innerHTML = visibleMembers.map(user => {
    const online = onlineUsers.some(item => Number(item.legacy_id) === user.id);
    return `<button class="admin-member-card" type="button" data-edit-user="${user.id}" aria-label="Gestionar a ${escapeHtml(user.name)}">
      <span class="admin-member-avatar">${getAvatar(user, "avatar small")}</span>
      <span class="admin-member-copy"><strong>${escapeHtml(user.name)}</strong><small>@${escapeHtml(user.username)}</small></span>
      <span class="role-chip ${user.roleKey}">${user.roleKey === "admin" ? "Administrador" : "Miembro"}</span>
      <span class="account-status ${online ? "" : "offline"}"><i></i>${online ? "En línea" : "Desconectado"}</span>
    </button>`;
  }).join("");
  renderAdminAchievements();
}

const dailyParticipation = AchievementProgress.createDailyVisitRecorder({
  session: () => backendReady && currentAuthUser?.id,
  visible: () => !document.hidden,
  rpc: () => db.rpc("record_daily_app_visit"),
});
function refreshDailyParticipation(force = false) {
  void globalThis.DailyPacks?.refresh(force);
  return dailyParticipation.record({force}).then(recorded => { if (recorded) return loadAchievements(); });
}

const achievementAdmin = AchievementAdmin.create({
  members: () => members, achievements: () => achievements, awards: () => achievementAwards,
  canManage: canManageSite, avatar: getAvatar, trophy: achievementTrophyIcon,
  tier: achievementTier, escape: escapeHtml, navigate: goTo, refresh: loadAchievements,
  progressStatus: () => achievementProgressStatus,
  createAward: payload => writeAchievement("create_achievement_with_awards", payload),
  createAutomatic: async payload => {
    const result = await writeAchievement("create_automatic_achievement", payload);
    if (!result.error) await dailyParticipation.record({force:true});
    return result;
  },
  assignAward: payload => writeAchievement("set_achievement_awards", payload),
});

function writeAchievement(method, payload) {
  if (!canManageSite() || !currentAuthUser || !db) throw new Error("No se puede guardar: comprueba tu conexión y tu sesión de administrador.");
  return db.rpc(method, payload);
}

function renderAdminAchievements() { achievementAdmin.render(); }
function openAchievementAssignments(id) { achievementAdmin.openAssignments(id); }
function closeAchievementAssignments() { achievementAdmin.closeAssignments(); }

function loadAchievements() {
  if (!backendReady || !currentAuthUser) return;
  void globalThis.DailyPacks?.refresh();
  const userId = currentAuthUser.id;
  if (achievementsRequest?.userId === userId) {
    achievementsRequest.pending = true;
    return achievementsRequest.promise;
  }
  const request = {userId, pending:false, promise:null};
  achievementsRequest = request;
  achievementsLoading = true;
  if (achievementProgressUserId !== userId) {
    achievementProgress = [];
    achievementProgressUserId = null;
    achievementProgressStatus = "loading";
  }
  const isCurrent = () => achievementsRequest === request && currentAuthUser?.id === userId;
  request.promise = (async () => {
    try {
      do {
        request.pending = false;
        await dailyParticipation.record();
        if (!isCurrent()) return;
        const [definitionsResult, awardsResult, rulesResult, progressResult] = await Promise.all([
          db.from("achievements").select("id,name,description,tier,icon,created_by,created_at").order("created_at", {ascending: false}),
          db.from("achievement_awards").select("id,achievement_id,user_id,awarded_by,awarded_at").order("awarded_at", {ascending: false}),
          db.from("achievement_rules").select("achievement_id,metric,target_count,created_at"),
          db.from("achievement_progress").select("achievement_id,current_value,completed_at").eq("user_id", userId),
        ]);
        if (!isCurrent()) return;
        if (definitionsResult.error || awardsResult.error) throw definitionsResult.error || awardsResult.error;
        const rules = new Map((rulesResult.data || []).map(r => [String(r.achievement_id), {metric:r.metric, target:r.target_count, createdAt:r.created_at}]));
        const previousRules = new Map(achievements.map(a => [String(a.id), a.rule]));
        achievements = (definitionsResult.data || []).map(item => ({
          id:item.id, name:item.name, description:item.description || "", tier:item.tier,
          icon:item.icon || "", createdBy:item.created_by, createdAt:item.created_at,
          rule:rulesResult.error ? previousRules.get(String(item.id)) : rules.get(String(item.id)),
        }));
        achievementAwards = (awardsResult.data || []).map(item => ({
          id:item.id, achievementId:item.achievement_id, userId:item.user_id,
          awardedBy:item.awarded_by, awardedAt:item.awarded_at,
        }));
        globalThis.TrophyUnlock?.observe(userId, achievements, achievementAwards);
        achievementsLoaded = true;
        const progressError = rulesResult.error || progressResult.error;
        if (progressError) {
          achievementProgressStatus = ["PGRST205", "42P01"].includes(progressError.code) ? "unavailable" : "error";
        } else {
          achievementProgress = (progressResult.data || []).map(item => ({achievementId:item.achievement_id, value:item.current_value, completedAt:item.completed_at}));
          achievementProgressUserId = userId;
          achievementProgressStatus = "ready";
        }
      } while (request.pending && isCurrent());
    } catch (error) {
      if (!isCurrent()) return;
      achievementProgressStatus = "error";
      const feedback = document.getElementById("achievementLibraryFeedback");
      if (feedback && canManageSite()) feedback.textContent = "No se han podido actualizar los logros. Comprueba la conexión y que el módulo esté activado.";
    } finally {
      if (isCurrent()) {
        achievementsLoading = false;
        achievementsRequest = null;
        renderAdminAchievements();
        if (activeProfileId && document.getElementById("perfil")?.classList.contains("active")) renderProfile(activeProfileId, false);
        if (document.getElementById("achievementChallengesDialog")?.open) renderAchievementChallengesDialog();
        renderAchievementDetail();
      }
    }
  })();
  return request.promise;
}

async function deleteAchievement(id, name) {
  if (!canManageSite() || !db || !window.confirm(`¿Eliminar el logro “${name}” y todas sus asignaciones?`)) return;
  const {error} = await db.from("achievements").delete().eq("id", id);
  if (error) return window.alert(error.message || "No se pudo eliminar el logro.");
  await loadAchievements();
}

function refreshProfileSurfaces() {
  renderFeatured();
  renderMembers();
  renderPresence();
  renderMessages();
  renderAdminPanel();
  if (currentUser) applyUserHeader(currentUser);
  if (activeProfileId && document.getElementById("perfil")?.classList.contains("active")) renderProfile(activeProfileId, false);
}

function applyUserHeader(user) {
  ["bottomNavAvatar"].forEach(id => {
    const node = document.getElementById(id);
    if (!node) return;
    const initial = escapeHtml(user.name?.charAt(0).toUpperCase() || "U");
    const avatarUrl = user.avatarUrl || getMember(user.id)?.avatarUrl || "";
    node.classList.toggle("has-image", Boolean(avatarUrl));
    node.innerHTML = avatarUrl ? `<img data-avatar-image src="${escapeHtml(avatarUrl)}" alt="">` : initial;
  });
  document.querySelectorAll(".admin-only").forEach(node => node.style.display = canManageSite() ? "" : "none");
  renderGroupAvatarSurfaces();
}

function getStoredSession() {
  try {
    const persistentSession = localStorage.getItem(AUTH_STORAGE_KEY);
    const temporarySession = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!persistentSession && temporarySession) {
      localStorage.setItem(AUTH_STORAGE_KEY, temporarySession);
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    }
    return JSON.parse(persistentSession || temporarySession || "null");
  } catch {
    return null;
  }
}

function saveLocalSession(user) {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({userId: user.id, loginAt: new Date().toISOString()})
  );
}

function cacheAuthenticatedProfile(user, authUser) {
  if (!user || !authUser?.id) return;
  localStorage.setItem(AUTH_PROFILE_CACHE_KEY, JSON.stringify({authId: authUser.id, profile: user}));
}

function getCachedAuthenticatedProfile(authId) {
  try {
    const cached = JSON.parse(localStorage.getItem(AUTH_PROFILE_CACHE_KEY) || "null");
    return cached?.authId === authId ? cached.profile : null;
  } catch {
    return null;
  }
}

async function hydrateAuthenticatedData(authUser) {
  try {
    await Promise.all([loadRemoteProfiles(), loadChatChannels()]);
    await Promise.all([
      loadMessages(), loadAchievements(),
      loadNotifications(), loadPrivateMessages(), loadGroupEvents(), loadSiteSettings()
    ]);
    if (currentAuthUser?.id === authUser.id) connectRealtime();
    runWhenIdle(() => {
      if (currentAuthUser?.id === authUser.id && !achievementsLoaded) loadAchievements();
    });
  } catch (error) {
    console.warn("No se pudieron actualizar todos los datos al iniciar:", error);
  }
}

async function applyUserInterface(user, authUser = null) {
  currentUser = user;
  currentAuthUser = authUser;
  if (authUser) cacheAuthenticatedProfile(user, authUser);
  document.documentElement.classList.add("auth-session-hint");
  document.body.classList.add("authenticated");
  document.getElementById("loginScreen")?.classList.add("login-hidden");
  applyUserHeader(user);
  refreshProfileSurfaces();
  renderPrivateContacts();
  renderPrivateConversation();
  renderCalendar();
  renderNotifications();
  renderSpotify();
  renderHelpCenter();
  renderAdminAchievements();
  completeInitialLaunch();
  if (backendReady && authUser) {
    void globalThis.DailyPacks?.refresh();
    void hydrateAuthenticatedData(authUser);
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
  globalThis.CardCollection?.close();
  globalThis.DailyPacks?.reset();
  globalThis.TrophyUnlock?.reset();
  closeProfileQuickMenu();
  closeAchievementChallenges(false);
  document.documentElement.classList.remove("auth-session-hint");
  document.body.classList.remove("authenticated");
  document.getElementById("loginScreen")?.classList.remove("login-hidden");
  onlineUsers = [];
  notifications = [];
  renderPresence();
  renderNotifications();
  closeNotifications();
  goTo("inicio");
  completeInitialLaunch();
}

async function logoutCurrentUser() {
  globalThis.CardCollection?.close();
  globalThis.DailyPacks?.reset();
  globalThis.TrophyUnlock?.reset();
  closeAchievementDetail();
  closeAchievementChallenges(false);
  if (activeAudioRecording) activeAudioRecording.cancelled = true;
  if (activeAudioRecording && activeAudioRecording.recorder.state !== "inactive") activeAudioRecording.recorder.stop();
  clearPendingChatFile("group");
  clearPendingChatFile("private");
  if (db) await db.auth.signOut();
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(AUTH_PROFILE_CACHE_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  currentUser = null;
  currentAuthUser = null;
  messages = [];
  notifications = [];
  privateMessages = [];
  groupEvents = [];
  chatChannels = [];
  helpRequests = [];
  helpMessages = [];
  achievements = [];
  achievementAwards = [];
  achievementProgress = [];
  achievementProgressUserId = null;
  achievementProgressStatus = "loading";
  dailyParticipation.reset();
  achievementsLoaded = false;
  helpCenterLoaded = false;
  achievementsLoading = false;
  achievementsRequest = null;
  helpCenterLoading = false;
  activeHelpRequestId = null;
  activeChatChannelId = null;
  if (db && presenceChannel) db.removeChannel(presenceChannel);
  if (db && messageChannel) db.removeChannel(messageChannel);
  if (db && notificationsChannel) db.removeChannel(notificationsChannel);
  if (db && privateChannel) db.removeChannel(privateChannel);
  if (db && eventChannel) db.removeChannel(eventChannel);
  if (db && settingsChannel) db.removeChannel(settingsChannel);
  if (db && chatChannelsRealtime) db.removeChannel(chatChannelsRealtime);
  if (db && helpRealtime) db.removeChannel(helpRealtime);
  if (db && achievementsRealtime) db.removeChannel(achievementsRealtime);
  if (db && profilesRealtime) db.removeChannel(profilesRealtime);
  showLogin();
  renderMessages();
  renderNotifications();
}

async function login(username, password) {
  if (!backendReady) {
    const user = members.find(item => normalizeUsername(item.username) === normalizeUsername(username) && item.password === password);
    if (!user) throw new Error("Usuario o contraseña incorrectos.");
    saveLocalSession(user);
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
  membersById.set(Number(member.id), member);
  if (member.authId) membersByAuthId.set(member.authId, member);
  return member;
}

async function loadRemoteProfiles() {
  const {data, error} = await db.from("profiles").select("*").order("legacy_id");
  if (error) return;
  const activeProfiles = data.filter(profile => !profile.is_hidden && profile.is_active !== false);
  const ids = new Set(activeProfiles.map(profile => Number(profile.legacy_id)));
  members = members.filter(member => ids.has(Number(member.id)));
  rebuildMemberIndexes();
  activeProfiles.forEach(profile => mergeRemoteProfile(profile));
  rebuildMemberIndexes();
  if (currentUser && !currentUser.hidden) currentUser = getMember(currentUser.id) || currentUser;
  refreshProfileSurfaces();
  renderAchievementDetail();
  performSearch(document.getElementById("globalSearchInput").value);
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
  refreshGroupMessageSurfaces();
}

function refreshGroupMessageSurfaces() {
  renderMessages();
  renderPrivateContacts();
}

function mapMessage(item) {
  return {
    id: item.id, userId: item.user_id, member: item.legacy_id, channelId: item.channel_id, text: item.body,
    attachmentUrl: item.attachment_url, attachmentName: item.attachment_name,
    attachmentType: item.attachment_type, attachmentSize: item.attachment_size,
    createdAt: item.created_at
  };
}

function applyRealtimeChange(collection, payload, mapper) {
  const record = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
  const id = record?.id;
  if (id == null) return collection;
  if (payload.eventType === "DELETE") return collection.filter(item => String(item.id) !== String(id));
  const mapped = mapper(record);
  const index = collection.findIndex(item => String(item.id) === String(id));
  if (index < 0) return [...collection, mapped];
  const updated = collection.slice();
  updated[index] = mapped;
  return updated;
}

function handleRealtimeMessage(payload) {
  messages = applyRealtimeChange(messages, payload, mapMessage)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  refreshGroupMessageSurfaces();
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

function renderNotifications() {
  renderPrivateContacts();
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
    const text = `${actorName} te ha enviado un mensaje`;
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
    .eq("type", "private_message").order("created_at", {ascending: false}).limit(100);
  notifications = error ? [] : data.map(mapNotification);
  renderNotifications();
}

function mapNotification(item) {
  return {
    id: item.id,
    actorId: item.actor_id,
    type: item.type,
    targetType: item.target_type,
    targetId: item.target_id,
    excerpt: item.excerpt || "",
    readAt: item.read_at,
    createdAt: item.created_at
  };
}

function handleRealtimeNotification(payload) {
  notifications = applyRealtimeChange(notifications, payload, mapNotification)
    .filter(item => item.type === "private_message")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);
  renderNotifications();
}

async function markNotificationsRead(id = null) {
  if (!currentAuthUser) return;
  const previous = notifications.map(item => ({...item}));
  const readAt = new Date().toISOString();
  notifications = notifications.map(item => id == null || String(item.id) === String(id) ? {...item, readAt: item.readAt || readAt} : item);
  renderNotifications();
  let query = db.from("notifications").update({read_at: readAt})
    .eq("user_id", currentAuthUser.id).is("read_at", null);
  if (id != null) query = query.eq("id", id);
  const {error} = await query;
  if (error) {
    notifications = previous;
    renderNotifications();
  }
}

async function deleteNotifications(id = null) {
  if (!currentAuthUser) return;
  const previous = notifications;
  notifications = id == null ? [] : notifications.filter(item => String(item.id) !== String(id));
  renderNotifications();
  let query = db.from("notifications").delete().eq("user_id", currentAuthUser.id);
  if (id != null) query = query.eq("id", id);
  const {error} = await query;
  if (error) {
    notifications = previous;
    renderNotifications();
  }
}

async function openNotification(id) {
  const item = notifications.find(notification => String(notification.id) === String(id));
  if (!item) return;
  if (!item.readAt) await markNotificationsRead(item.id);
  closeNotifications();
  if (item.type === "private_message") {
    const actor = getMemberByAuthId(item.actorId);
    if (actor) openPrivateConversation(actor.id);
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
  privateMessages = error ? [] : [...data].reverse().map(mapPrivateMessage);
  refreshPrivateMessageSurfaces();
}

function refreshPrivateMessageSurfaces() {
  renderPrivateContacts();
  renderPrivateConversation();
}

function mapPrivateMessage(item) {
  return {
    id: item.id, senderId: item.sender_id, recipientId: item.recipient_id,
    body: item.body, attachmentUrl: item.attachment_url, attachmentName: item.attachment_name,
    attachmentType: item.attachment_type, attachmentSize: item.attachment_size,
    createdAt: item.created_at
  };
}

function handleRealtimePrivateMessage(payload) {
  privateMessages = applyRealtimeChange(privateMessages, payload, mapPrivateMessage)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  refreshPrivateMessageSurfaces();
}

async function loadGroupEvents() {
  const {data, error} = await db.from("group_events").select("*").order("starts_at");
  groupEvents = error ? [] : data.map(item => ({
    id: item.id, title: item.title, description: item.description, startsAt: item.starts_at,
    endsAt: item.ends_at, location: item.location, createdBy: item.created_by,
    eventType: item.event_type || "event", annual: Boolean(item.annual)
  }));
  renderCalendar();
  if (activeCalendarDay) openCalendarDay(activeCalendarDay);
}

async function loadSiteSettings() {
  const {data, error} = await db.from("site_settings").select("key,value");
  siteSettings = error ? {} : Object.fromEntries(data.map(item => [item.key, item.value]));
  renderSpotify();
  renderGroupAvatarSurfaces();
  renderPrivateContacts();
}

function connectRealtime() {
  if (presenceChannel) db.removeChannel(presenceChannel);
  if (messageChannel) db.removeChannel(messageChannel);
  if (notificationsChannel) db.removeChannel(notificationsChannel);
  if (privateChannel) db.removeChannel(privateChannel);
  if (eventChannel) db.removeChannel(eventChannel);
  if (settingsChannel) db.removeChannel(settingsChannel);
  if (chatChannelsRealtime) db.removeChannel(chatChannelsRealtime);
  if (helpRealtime) db.removeChannel(helpRealtime);
  if (achievementsRealtime) db.removeChannel(achievementsRealtime);
  if (profilesRealtime) db.removeChannel(profilesRealtime);
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
    .on("postgres_changes", {event: "*", schema: "public", table: "messages"}, handleRealtimeMessage)
    .subscribe();
  notificationsChannel = db.channel(`notifications-${currentAuthUser.id}`)
    .on("postgres_changes", {event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${currentAuthUser.id}`}, handleRealtimeNotification)
    .subscribe();
  privateChannel = db.channel(`private-messages-${currentAuthUser.id}`)
    .on("postgres_changes", {event: "*", schema: "public", table: "private_messages"}, handleRealtimePrivateMessage)
    .subscribe();
  eventChannel = db.channel("group-events-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "group_events"}, () => scheduleRealtimeRefresh("events", loadGroupEvents))
    .subscribe();
  settingsChannel = db.channel("site-settings-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "site_settings"}, () => scheduleRealtimeRefresh("settings", loadSiteSettings))
    .subscribe();
  chatChannelsRealtime = db.channel("chat-channels-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "chat_channels"}, () => scheduleRealtimeRefresh("chat-channels", loadChatChannels))
    .subscribe();
  helpRealtime = db.channel("help-center-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "help_requests"}, () => {
      if (helpCenterLoaded || document.getElementById("ayuda")?.classList.contains("active")) scheduleRealtimeRefresh("help", loadHelpCenter);
    })
    .on("postgres_changes", {event: "*", schema: "public", table: "help_messages"}, () => {
      if (helpCenterLoaded || document.getElementById("ayuda")?.classList.contains("active")) scheduleRealtimeRefresh("help", loadHelpCenter);
    })
    .subscribe();
  achievementsRealtime = db.channel("achievements-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "achievements"}, () => {
      scheduleRealtimeRefresh("achievements", loadAchievements, 60);
    })
    .on("postgres_changes", {event: "*", schema: "public", table: "achievement_awards"}, () => {
      scheduleRealtimeRefresh("achievements", loadAchievements, 60);
    })
    .on("postgres_changes", {event: "*", schema: "public", table: "achievement_rules"}, () => {
      scheduleRealtimeRefresh("achievement-visit", () => refreshDailyParticipation(true), 60);
      scheduleRealtimeRefresh("achievements", loadAchievements, 60);
    })
    .on("postgres_changes", {event: "*", schema: "public", table: "achievement_progress", filter: `user_id=eq.${currentAuthUser.id}`}, () => {
      scheduleRealtimeRefresh("achievements", loadAchievements, 60);
    })
    .subscribe(status => {
      // Reconnects recover activity missed while the app was asleep/offline.
      if (status === "SUBSCRIBED") {
        scheduleRealtimeRefresh("achievement-visit", () => refreshDailyParticipation(true), 60);
        scheduleRealtimeRefresh("achievements", loadAchievements, 60);
      }
    });
  profilesRealtime = db.channel("profiles-live", {config: {broadcast: {self: false}}})
    .on("broadcast", {event: "profile-updated"}, () => {
      scheduleRealtimeRefresh("profiles", loadRemoteProfiles, 40);
    })
    .on("postgres_changes", {event: "*", schema: "public", table: "profiles"}, () => {
      scheduleRealtimeRefresh("profiles", loadRemoteProfiles, 60);
    })
    .subscribe();
}

async function uploadGroupMedia(file, folder) {
  validateFileSize(file, uploadLimitForFolder(folder));
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${currentAuthUser.id}/${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const {error} = await db.storage.from("group-media").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "31536000"
  });
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
    await refreshMediaPermission("microphone");
    stream = await navigator.mediaDevices.getUserMedia({audio: true});
    rememberMediaPermission("microphone", "granted");
  } catch (error) {
    if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") rememberMediaPermission("microphone", "denied");
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
  }).select("id,user_id,legacy_id,channel_id,body,attachment_url,attachment_name,attachment_type,attachment_size,created_at").single();
  if (error) throw error;
  dispatchPush("group_message", data.id);
  return mapMessage(data);
}

async function createChatChannel() {
  if (!canManageSite() || !currentAuthUser || !db) return window.alert("No hay una sesión conectada al servidor. Cierra sesión y vuelve a entrar.");
  const value = window.prompt("Nombre de la nueva sección:");
  if (value === null) return;
  const name = value.trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  if (!name) return window.alert("Escribe un nombre válido.");
  const {error} = await db.from("chat_channels").insert({
    name, created_by: currentAuthUser.id, position: chatChannels.length
  });
  if (error) {
    const message = error.code === "23505" ? "Ya existe una sección con ese nombre."
      : error.code === "42501" || error.code === "PGRST301" ? "Supabase ha rechazado la operación. Vuelve a iniciar sesión y verifica que tu cuenta conserve permisos de administración."
      : error.message || "No se pudo crear la sección.";
    window.alert(message);
  } else await loadChatChannels();
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
  }).select("id,sender_id,recipient_id,body,attachment_url,attachment_name,attachment_type,attachment_size,created_at").single();
  if (error) throw error;
  dispatchPush("private_message", data.id);
  return mapPrivateMessage(data);
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
  if (sharingMedia?.kind !== "news" || !currentAuthUser || !currentUser) return;
  const submit = form.querySelector("[type=submit]");
  const feedback = document.getElementById("shareMediaFeedback");
  const destinationType = document.getElementById("shareDestinationType").value;
  const destination = document.getElementById("shareDestination").value;
  const body = `Noticia compartida: ${sharingMedia.cleanTitle || sharingMedia.title}`;
  const attachmentType = "text/news-link";
  const attachmentUrl = sharingMedia.link;
  const attachmentName = sharingMedia.source;
  submit.disabled = true;
  feedback.textContent = "Compartiendo…";
  try {
    if (destinationType === "group") {
      const channel = chatChannels.find(item => String(item.id) === String(destination));
      if (!channel) throw new Error("Selecciona un canal válido.");
      const {data, error} = await db.from("messages").insert({
        user_id: currentAuthUser.id, legacy_id: currentUser.id, channel_id: channel.id, body,
        attachment_url: attachmentUrl, attachment_name: attachmentName,
        attachment_type: attachmentType, attachment_size: null
      }).select("id,user_id,legacy_id,channel_id,body,attachment_url,attachment_name,attachment_type,attachment_size,created_at").single();
      if (error) throw error;
      if (!messages.some(message => String(message.id) === String(data.id))) messages.push(mapMessage(data));
      closeShareMedia();
      activeChatChannelId = channel.id;
      openGroupConversation(channel.id);
    } else {
      const member = getMember(destination);
      if (!member?.authId) throw new Error("Selecciona un miembro válido.");
      const {data, error} = await db.from("private_messages").insert({
        sender_id: currentAuthUser.id, recipient_id: member.authId, body,
        attachment_url: attachmentUrl, attachment_name: attachmentName,
        attachment_type: attachmentType, attachment_size: null
      }).select("id,sender_id,recipient_id,body,attachment_url,attachment_name,attachment_type,attachment_size,created_at").single();
      if (error) throw error;
      if (!privateMessages.some(message => String(message.id) === String(data.id))) privateMessages.push(mapPrivateMessage(data));
      closeShareMedia();
      openPrivateConversation(member.id);
    }
  } catch (error) {
    feedback.textContent = error.message || "No se pudo compartir el contenido.";
  } finally {
    submit.disabled = false;
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

function setGroupAvatarPreview(url = "") {
  const preview = document.getElementById("groupAvatarPreview");
  preview.classList.toggle("has-image", Boolean(url));
  preview.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="Vista previa de la foto del grupo">` : "<b>BB</b>";
}

function openGroupAvatarEditor() {
  if (!canManageSite()) return;
  pendingGroupAvatarFile = null;
  if (groupAvatarPreviewUrl) URL.revokeObjectURL(groupAvatarPreviewUrl);
  groupAvatarPreviewUrl = "";
  document.getElementById("groupAvatarInput").value = "";
  document.getElementById("groupAvatarFeedback").textContent = "";
  document.getElementById("removeGroupAvatarButton").disabled = !siteSettings.group_avatar_url;
  setGroupAvatarPreview(siteSettings.group_avatar_url || "");
  const modal = document.getElementById("groupAvatarEditor");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("group-avatar-editor-open");
}

function closeGroupAvatarEditor() {
  const modal = document.getElementById("groupAvatarEditor");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("group-avatar-editor-open");
  pendingGroupAvatarFile = null;
  if (groupAvatarPreviewUrl) URL.revokeObjectURL(groupAvatarPreviewUrl);
  groupAvatarPreviewUrl = "";
}

async function saveGroupAvatar(form) {
  if (!canManageSite() || !currentAuthUser) return;
  const feedback = document.getElementById("groupAvatarFeedback");
  const submit = form.querySelector("[type=submit]");
  if (!pendingGroupAvatarFile) {
    feedback.textContent = "Elige una foto antes de guardar.";
    return;
  }
  submit.disabled = true;
  feedback.textContent = "Subiendo foto…";
  try {
    validateFileSize(pendingGroupAvatarFile, 3 * MEGABYTE);
    const avatarUrl = await uploadGroupMedia(pendingGroupAvatarFile, "group-profile");
    const {error} = await db.from("site_settings").upsert({
      key: "group_avatar_url", value: avatarUrl, updated_by: currentAuthUser.id, updated_at: new Date().toISOString()
    });
    if (error) throw error;
    closeGroupAvatarEditor();
    await loadSiteSettings();
  } catch (error) {
    feedback.textContent = error.message || "No se pudo guardar la foto del grupo.";
  } finally {
    submit.disabled = false;
  }
}

async function removeGroupAvatar() {
  if (!canManageSite() || !siteSettings.group_avatar_url) return;
  if (!window.confirm("¿Quitar la foto actual del grupo?")) return;
  const feedback = document.getElementById("groupAvatarFeedback");
  feedback.textContent = "Quitando foto…";
  const {error} = await db.from("site_settings").delete().eq("key", "group_avatar_url");
  if (error) {
    feedback.textContent = error.message || "No se pudo quitar la foto del grupo.";
    return;
  }
  closeGroupAvatarEditor();
  await loadSiteSettings();
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
  document.getElementById("adminProfileFields").hidden = false;
  document.getElementById("profileUsername").value = profile.username;
  document.getElementById("profileUsername").disabled = !managingAnotherUser;
  document.getElementById("profileUsernameHelp").textContent = managingAnotherUser
    ? "Entre 3 y 32 caracteres; letras, números, punto, guion o guion bajo."
    : "El @ solo puede cambiarlo un administrador.";
  document.getElementById("profileRoleField").hidden = !managingAnotherUser;
  document.querySelector("#adminProfileFields .admin-profile-fields-heading span").textContent = managingAnotherUser ? "GESTIÓN DE CUENTA" : "IDENTIDAD DE LA CUENTA";
  document.querySelector("#adminProfileFields .admin-profile-fields-heading small").textContent = managingAnotherUser ? "Solo visible para administradores" : "El @ solo puede cambiarlo un administrador";
  document.getElementById("profileRole").value = profile.roleKey === "admin" ? "admin" : "member";
  const adminActions = document.getElementById("profileAdminActions");
  adminActions.hidden = !managingAnotherUser;
  document.getElementById("adminMessageProfileButton").hidden = !managingAnotherUser || !profile.authId;
  document.getElementById("adminResetProfilePasswordButton").hidden = !managingAnotherUser || !profile.authId;
  document.getElementById("adminDeleteProfileButton").hidden = !managingAnotherUser || !profile.authId || !isSuperAdmin();
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
  modal.classList.toggle("admin-member-editor", managingAnotherUser);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("profile-editor-open");
}

function closeProfileEditor() {
  const modal = document.getElementById("profileEditor");
  modal.classList.remove("open");
  modal.classList.remove("admin-member-editor");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("profile-editor-open");
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
        const {error} = await db.storage.from("avatars").upload(path, croppedAvatarFile, {
          upsert: true,
          contentType: croppedAvatarFile.type,
          cacheControl: "86400"
        });
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
      profilesRealtime?.send({
        type: "broadcast",
        event: "profile-updated",
        payload: {userId: targetAuthId, updatedAt: Date.now()}
      });
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

function helpStatus(status) {
  return HELP_STATUS[status] || HELP_STATUS.new;
}

async function loadHelpCenter() {
  if (!backendReady || !currentAuthUser || helpCenterLoading) return;
  helpCenterLoading = true;
  const [requestResult, messageResult] = await Promise.all([
    db.from("help_requests").select("*").order("updated_at", {ascending: false}).limit(250),
    db.from("help_messages").select("*").order("created_at").limit(1000),
  ]);
  if (requestResult.error || messageResult.error) {
    const list = document.getElementById("helpRequestList");
    if (list) list.innerHTML = `<div class="empty-state compact"><strong>No se pudo abrir Ayuda</strong><span>${escapeHtml(requestResult.error?.message || messageResult.error?.message || "Inténtalo de nuevo.")}</span></div>`;
    helpCenterLoading = false;
    return;
  }
  helpCenterLoaded = true;
  const visibleRequests = canManageSite()
    ? (requestResult.data || [])
    : (requestResult.data || []).filter(item => item.user_id === currentAuthUser.id);
  helpRequests = visibleRequests.map(item => ({
    id: item.id, userId: item.user_id, type: item.request_type, status: item.status,
    handledBy: item.handled_by, createdAt: item.created_at, updatedAt: item.updated_at,
  }));
  const visibleRequestIds = new Set(helpRequests.map(item => String(item.id)));
  helpMessages = (messageResult.data || []).filter(item => visibleRequestIds.has(String(item.request_id))).map(item => ({
    id: item.id, requestId: item.request_id, senderId: item.sender_id,
    body: item.body, createdAt: item.created_at,
  }));
  if (activeHelpRequestId && !helpRequests.some(item => String(item.id) === String(activeHelpRequestId))) activeHelpRequestId = null;
  renderHelpCenter();
  helpCenterLoading = false;
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
  message.text = cleanBody;
  refreshGroupMessageSurfaces();
}

async function deleteGroupMessage(id) {
  if (!backendReady || !currentAuthUser) return;
  const message = messages.find(item => String(item.id) === String(id));
  if (!message || (message.userId !== currentAuthUser.id && !canManageSite())) return;
  if (!window.confirm("¿Quieres eliminar este mensaje?")) return;
  const {error} = await db.from("messages").delete().eq("id", id);
  if (error) return window.alert(error.message || "No se pudo eliminar el mensaje.");
  messages = messages.filter(item => String(item.id) !== String(id));
  refreshGroupMessageSurfaces();
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
  message.body = cleanBody;
  refreshPrivateMessageSurfaces();
}

async function deletePrivateMessage(id) {
  if (!backendReady || !currentAuthUser) return;
  const message = privateMessages.find(item => String(item.id) === String(id));
  if (!message || message.senderId !== currentAuthUser.id) return;
  if (!window.confirm("¿Quieres eliminar este mensaje privado?")) return;
  const {error} = await db.from("private_messages").delete()
    .eq("id", message.id).eq("sender_id", currentAuthUser.id);
  if (error) return window.alert(error.message || "No se pudo eliminar el mensaje.");
  privateMessages = privateMessages.filter(item => String(item.id) !== String(id));
  refreshPrivateMessageSurfaces();
}

async function invokeUserAdmin(action, values) {
  if (!canManageSite() || !db) throw new Error("No tienes permiso para administrar cuentas.");
  const {data, error} = await db.functions.invoke("admin-users", {body: {action, ...values}});
  if (error) {
    let detail = error.context?.error || error.message;
    try {
      if (typeof error.context?.json === "function") {
        const payload = await error.context.json();
        detail = payload?.error || detail;
      }
    } catch {}
    throw new Error(detail || "No se pudo completar la operación. Comprueba que la función admin-users esté desplegada.");
  }
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
    rebuildMemberIndexes();
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
  if (document.getElementById("newsCollapsible").hidden || !currentUser) return;
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
  const directTimestamp = Date.parse(value);
  if (Number.isFinite(directTimestamp)) return directTimestamp;
  const normalized = value.includes("T") ? value : value.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
  const fallbackTimestamp = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isFinite(fallbackTimestamp) ? fallbackTimestamp : 0;
}

function formatNewsDate(value) {
  const timestamp = newsTimestamp(value);
  if (!timestamp) return "Fecha no disponible";
  const date = new Date(timestamp);
  return date.toLocaleString("es-ES", {day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"});
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
  const shareNewsTarget = event.target.closest("[data-share-news]");
  if (shareNewsTarget) {
    event.preventDefault();
    event.stopPropagation();
    openShareNews(shareNewsTarget.dataset.shareNews);
    return;
  }
  const goTarget = event.target.closest("[data-go]");
  if (suppressInboxRowClick && event.target.closest(".chat-inbox .private-contact")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressInboxRowClick = false;
    return;
  }
  const achievementTarget = event.target.closest("[data-open-achievement]");
  if (achievementTarget) {
    const returnFocus = achievementTarget.closest("#achievementChallengesDialog") ? achievementChallengesReturnFocus : document.activeElement;
    if (achievementTarget.closest("#achievementChallengesDialog")) closeAchievementChallenges(false);
    openAchievementDetail(achievementTarget.dataset.openAchievement, returnFocus);
  }
  if (event.target.closest("[data-open-achievement-challenges]")) openAchievementChallenges();
  if (event.target.closest("[data-reload-achievements]")) loadAchievements();
  if (goTarget) goTo(goTarget.dataset.go);
  const profileTarget = event.target.closest("[data-profile]");
  if (profileTarget) {
    const profileId = profileTarget.dataset.profile;
    renderProfile(profileId);
  }
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
  const editUser = event.target.closest("[data-edit-user]");
  if (editUser) openProfileEditor(editUser.dataset.editUser);
  const manageAchievement = event.target.closest("[data-manage-achievement]");
  if (manageAchievement) openAchievementAssignments(manageAchievement.dataset.manageAchievement);
  const removeAchievement = event.target.closest("[data-delete-achievement]");
  if (removeAchievement) deleteAchievement(removeAchievement.dataset.deleteAchievement, removeAchievement.dataset.deleteAchievementName);
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
  if (profileTarget) closeGlobalSearch();
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
  }
});
bindTabNavigation(navLinks, {
  navigate(targetSection) {
    if (targetSection === "perfil" && currentUser) renderProfile(currentUser.id);
    else goTo(targetSection);
  },
  openProfileMenu: openProfileQuickMenu
});

document.addEventListener("pointerdown", startChatBackGesture, {passive: true});
document.addEventListener("pointermove", moveChatBackGesture, {passive: false});
document.addEventListener("pointerup", finishChatBackGesture, {passive: true});
document.addEventListener("pointercancel", () => resetChatBackGesture({settle: true}), {passive: true});
document.addEventListener("click", event => {
  if (!suppressChatGestureClick || event.target.closest(".floating-tab-bar")) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
document.getElementById("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const error = document.getElementById("loginError");
  const submit = event.currentTarget.querySelector("[type=submit]");
  error.textContent = "";
  submit.disabled = true;
  try {
    await login(
      document.getElementById("loginUsername").value,
      document.getElementById("loginPassword").value
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
async function submitChatMessage(kind, event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.sending) return;
  if (activeAudioRecording?.kind === kind) {
    activeAudioRecording.sendOnStop = true;
    activeAudioRecording.recorder.stop();
    return;
  }
  const input = form.querySelector('input[type="text"]');
  const submit = form.querySelector('[type="submit"]');
  const value = input.value;
  const text = value.trim();
  const file = pendingChatFile(kind);
  if (!text && !file) return;
  const destination = kind === "private" ? activePrivateMemberId : activeChatChannelId;
  const sameConversation = () => destination === (kind === "private" ? activePrivateMemberId : activeChatChannelId);
  form.dataset.sending = "true";
  submit.disabled = true;
  // Keep the editor focused and editable: disabling it dismisses the iOS keyboard.
  try {
    const sentMessage = await (kind === "private" ? sendPrivateMessage(text, file) : sendMessage(text, file));
    const collection = kind === "private" ? privateMessages : messages;
    if (sentMessage && !collection.some(message => String(message.id) === String(sentMessage.id))) {
      collection.push(sentMessage);
      if (kind === "private") refreshPrivateMessageSurfaces();
      else refreshGroupMessageSurfaces();
    }
    if (sentMessage && sameConversation()) {
      if (input.value === value) input.value = "";
      if (pendingChatFile(kind) === file) clearPendingChatFile(kind);
    }
  } catch (error) {
    if (sameConversation()) {
      input.setCustomValidity(error.message || "No se pudo enviar el mensaje.");
      input.reportValidity();
      input.setCustomValidity("");
    }
  } finally {
    delete form.dataset.sending;
    submit.disabled = input.disabled;
    syncComposerState(kind);
  }
}
document.getElementById("messageForm").addEventListener("submit", event => submitChatMessage("group", event));
document.getElementById("privateMessageForm").addEventListener("submit", event => submitChatMessage("private", event));
[["group", "messageInput"], ["private", "privateMessageInput"]].forEach(([kind, inputId]) => {
  document.getElementById(inputId).addEventListener("input", () => syncComposerState(kind));
});
chatKeyboard = ChatKeyboard.install({onViewportChange: syncMobileViewport});
window.visualViewport?.addEventListener("resize", () => syncMobileViewport());
window.visualViewport?.addEventListener("scroll", () => syncMobileViewport());
window.addEventListener("resize", () => syncMobileViewport());
window.addEventListener("resize", () => {
  if (!activeChatMotionScene || Math.abs(activeChatMotionScene.width - window.innerWidth) < 2) return;
  if (chatBackGesture) resetChatBackGesture();
  else activeChatMotionScene.animations.forEach(animation => animation.finish());
}, {passive: true});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  if (chatBackGesture) resetChatBackGesture();
  else activeChatMotionScene?.animations.forEach(animation => animation.finish());
});
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
document.getElementById("adminViewProfileButton").addEventListener("click", () => {
  const memberId = editingProfileId;
  closeProfileEditor();
  renderProfile(memberId);
});
document.getElementById("adminMessageProfileButton").addEventListener("click", () => {
  const memberId = editingProfileId;
  closeProfileEditor();
  openPrivateConversation(memberId);
});
document.getElementById("adminResetProfilePasswordButton").addEventListener("click", () => {
  const member = getMember(editingProfileId);
  if (member?.authId) resetClubUserPassword(member.authId, member.name);
});
document.getElementById("adminDeleteProfileButton").addEventListener("click", async () => {
  const member = getMember(editingProfileId);
  if (!member?.authId) return;
  await deleteClubUser(member.authId, member.name);
  if (!getMember(member.id)) {
    closeProfileEditor();
    goTo("administracion");
  }
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
  if (!collapsed) loadNews(false);
}
document.getElementById("toggleNewsButton").addEventListener("click", () => {
  setNewsCollapsed(!document.getElementById("noticias").classList.contains("is-collapsed"));
});
setNewsCollapsed(true);
document.getElementById("refreshNewsButton").addEventListener("click", () => loadNews(true));
// Also cover returning online and staying in the foreground across midnight.
window.addEventListener("online", () => { void refreshDailyParticipation(true); });
setInterval(() => { if (!document.hidden) void refreshDailyParticipation(); }, 60000);
setInterval(() => {
  if (!document.hidden && document.getElementById("inicio").classList.contains("active")) loadNews(true);
}, NEWS_REFRESH_INTERVAL);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void Promise.all([refreshMediaPermission("camera"), refreshMediaPermission("microphone")]);
  if (!document.hidden && currentAuthUser) void refreshDailyParticipation(true);
  if (!document.hidden && currentAuthUser) scheduleRealtimeRefresh("achievements", loadAchievements, 60);
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
function closeGlobalSearch() {
  document.getElementById("globalSearchInput")?.blur();
}
document.getElementById("adminPanelButton")?.addEventListener("click", () => goTo("administracion"));
const performSearchDebounced = debounce(value => performSearch(value));
document.getElementById("globalSearchInput").addEventListener("input", event => performSearchDebounced(event.target.value));
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeGlobalSearch();
    closeEventEditor();
    closeCalendarDayModal();
    closeSpotifyEditor();
    closeGroupAvatarEditor();
    closeAchievementAssignments();
  }
});
document.getElementById("previousMonthButton").addEventListener("click", () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById("calendarTodayButton").addEventListener("click", () => {
  calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  renderCalendar();
});
document.getElementById("closeAchievementDetail").addEventListener("click", closeAchievementDetail);
document.getElementById("achievementDetail").addEventListener("close", finishAchievementDetail);
document.getElementById("achievementDetail").addEventListener("click", event => {
  if (event.target === event.currentTarget) {
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeAchievementDetail();
  }
});
document.getElementById("closeAchievementChallenges").addEventListener("click", () => closeAchievementChallenges());
document.getElementById("achievementChallengesDialog").addEventListener("cancel", event => {
  event.preventDefault(); closeAchievementChallenges();
});
document.getElementById("achievementChallengesDialog").addEventListener("click", event => {
  const box = event.currentTarget.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeAchievementChallenges();
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
document.getElementById("editGroupAvatarButton").addEventListener("click", openGroupAvatarEditor);
document.getElementById("closeGroupAvatarEditor").addEventListener("click", closeGroupAvatarEditor);
document.getElementById("cancelGroupAvatarEditor").addEventListener("click", closeGroupAvatarEditor);
document.getElementById("groupAvatarEditor").addEventListener("click", event => {
  if (event.target.id === "groupAvatarEditor") closeGroupAvatarEditor();
});
document.getElementById("groupAvatarInput").addEventListener("change", event => {
  const file = event.target.files[0] || null;
  const feedback = document.getElementById("groupAvatarFeedback");
  pendingGroupAvatarFile = null;
  if (!file) return;
  if (!file.type.startsWith("image/") || file.size > 3 * MEGABYTE) {
    feedback.textContent = "Elige una imagen JPG, PNG o WebP de hasta 3 MB.";
    event.target.value = "";
    return;
  }
  if (groupAvatarPreviewUrl) URL.revokeObjectURL(groupAvatarPreviewUrl);
  groupAvatarPreviewUrl = URL.createObjectURL(file);
  pendingGroupAvatarFile = file;
  feedback.textContent = "";
  setGroupAvatarPreview(groupAvatarPreviewUrl);
});
document.getElementById("groupAvatarForm").addEventListener("submit", event => {
  event.preventDefault();
  saveGroupAvatar(event.currentTarget);
});
document.getElementById("removeGroupAvatarButton").addEventListener("click", removeGroupAvatar);

// The server validates the catalog, account and deduplication. No local award.
const pendingCardExplorations = new Set();
document.addEventListener('bb:card-explored', async event => {
  const userId = currentAuthUser?.id, cardId = event.detail?.cardId;
  if (!backendReady || !userId || !db || document.hidden || !globalThis.CardCollection?.catalog.some(card => card.id === cardId)) return;
  const key = `${userId}:${cardId}`;
  if (pendingCardExplorations.has(key)) return;
  pendingCardExplorations.add(key);
  try {
    const {data,error} = await db.rpc('record_card_exploration', {target_card_id:cardId});
    if (!error && data && currentAuthUser?.id === userId) scheduleRealtimeRefresh('achievements', loadAchievements, 60);
  } catch { /* Offline or migration pending: reopening retries, without inventing progress. */ }
  finally { pendingCardExplorations.delete(key); }
});

globalThis.DailyPacks?.initialize({
  session: () => backendReady && currentAuthUser?.id,
  visible: () => !document.hidden,
  rpc: signal => db.rpc("claim_daily_card_pack").abortSignal(signal),
});
globalThis.TrophyUnlock?.initialize({
  canShow: () => !!currentAuthUser && document.body.classList.contains("authenticated") && !activeAudioRecording,
  openDetail: id => openAchievementDetail(id),
});
applyStoredProfiles();
if (localStorage.getItem("bb-theme") === "light") document.body.classList.add("light");

(async function restoreSession() {
  try {
    if (backendReady) {
      const {data, error} = await db.auth.getSession();
      if (error) throw error;
      if (data.session?.user) {
        const cachedProfile = getCachedAuthenticatedProfile(data.session.user.id);
        if (cachedProfile) return applyUserInterface(cachedProfile, data.session.user);
        const profile = await profileForAuthUser(data.session.user);
        if (profile) return applyUserInterface(profile, data.session.user);
      }
    } else {
      const session = getStoredSession();
      const user = session && getMember(session.userId);
      if (user) return applyUserInterface(user);
    }
  } catch (error) {
    console.warn("No se pudo restaurar la sesión guardada:", error);
  }
  showLogin();
})();

const requestedInitialSection = location.hash.replace("#", "");
const initialSection = requestedInitialSection === "privados" ? "chat" : requestedInitialSection;
if (["inicio", "chat", "privados", "miembros", "contenido", "momentos", "publicaciones", "noticias", "buscar", "calendario", "perfil", "ayuda", "sobres"].includes(initialSection)) {
  if (initialSection === "perfil" && currentUser) renderProfile(currentUser.id);
  else goTo(initialSection);
}
window.addEventListener("scroll", scheduleMobileHeaderSync, {passive: true});
sections.forEach(section => section.addEventListener("scroll", () => {
  if (section.classList.contains("active")) scheduleMobileHeaderSync();
}, {passive: true}));
window.addEventListener("resize", () => {
  if (!isMobileSidebar()) showMobileHeader();
  mobileHeaderLastScrollY = activePageScrollY();
  mobileHeaderScrollAnchor = mobileHeaderLastScrollY;
  mobileHeaderDirection = null;
}, {passive: true});
window.setTimeout(completeInitialLaunch, 4500);
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
