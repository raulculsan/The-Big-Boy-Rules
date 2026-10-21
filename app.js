function passwordValidationError(password, displayName = "", username = "") {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) return "La contraseña debe tener entre 8 y 128 caracteres.";
  // Whitespace alone does not satisfy the symbol requirement.
  if (!/[^\p{L}\p{N}\s\p{M}]/u.test(password)) return "Añade al menos un carácter especial, por ejemplo !, @ o #.";
  const normalize = value => String(value || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const normalizedPassword = normalize(password);
  const nameParts = String(displayName || "").split(/[^\p{L}\p{N}]+/u).map(normalize)
    .filter(part => part.length >= 2 && !["de", "del", "la", "las", "los", "el", "y"].includes(part));
  const identityParts = [normalize(username), normalize(displayName), ...nameParts].filter(Boolean);
  if (identityParts.some(part => normalizedPassword.includes(part))) return "La contraseña no puede contener tu nombre, apellidos ni nombre de usuario.";
  return "";
}

// Programmatic focus can inherit :focus-visible after a touch on WebKit.
// Track input modality so touch surfaces stay clean and keyboard focus stays visible.
document.documentElement.dataset.inputModality = "keyboard";
document.addEventListener("pointerdown", () => {
  if (document.documentElement.dataset.inputModality !== "pointer") document.documentElement.dataset.inputModality = "pointer";
}, {capture: true, passive: true});
document.addEventListener("keydown", event => {
  if (!event.metaKey && !event.ctrlKey && !event.altKey && ["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape"].includes(event.key)) {
    if (document.documentElement.dataset.inputModality !== "keyboard") document.documentElement.dataset.inputModality = "keyboard";
  }
}, {capture: true});

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
        flowType: "pkce",
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
  triggerDistance: 80,
  completionRatio: .25,
  velocityThreshold: .42,
  minimumFlickDistance: 24,
  reversalDistance: 24,
  velocityWindow: 120,
  intentRatio: 1.12,
});
const pageTitle = document.getElementById("pageTitle");
const sections = [...document.querySelectorAll(".page-section")];
const navLinks = [...document.querySelectorAll(".app-tab")];
document.body.classList.toggle("native-android", window.Capacitor?.getPlatform?.() === "android");
const isStandaloneApp = window.Capacitor?.isNativePlatform?.() === true || window.__bigboysNativeKeyboardLayout === true || window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
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
let notificationReadState = null;
let notificationFilter = "all";
let notificationPreferences = null, notificationPreferencesOwner = null, notificationPreferencesLoading = false, notificationPreferencesSaving = false, notificationPreferencesError = "";
let newsNoticePending = false;
let privateMessages = [];
let groupEvents = [];
let calendarChatAnnouncements = [];
let channelAutomationMessages = [];
let calendarChatSyncDay = "";
let calendarChatRequest = null;
let chatChannels = [];
let helpRequests = [];
let helpMessages = [];
let achievements = [];
let achievementAwards = [];
let achievementProgress = [];
let achievementCardScopes = null;
let achievementVisitFailed = false;
let achievementProgressStatus = "loading";
let achievementProgressUserId = null;
let newsItems = [];
let siteSettings = {};
let homeEventsReady = !backendReady;
let homeSettingsReady = !backendReady;
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
const chatSendAttempts = new Map();
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
let pendingHomeAnchorGeneration = null;
// A direct gesture takes ownership before a deferred subsection jump.
document.addEventListener("pointerdown", () => { pendingHomeAnchorGeneration = null; }, {passive: true});
let profileRender = null;
let profileChatReturn = null;
let profilePageReturn = null;
let chatInboxScroll = null;
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
let profileLoadGeneration = 0;

function completeInitialLaunch() {
  if (initialLaunchCompleted) return;
  initialLaunchCompleted = true;
  requestAnimationFrame(() => {
    document.getElementById("pageLoader")?.classList.add("hidden");
    requestAnimationFrame(() => {
      globalThis.ClubHealth?.mark("shell-ready");
      document.documentElement.dataset.launchReady = "true";
      document.dispatchEvent(new Event("bb:launch-ready"));
    });
  });
}
function waitForStartupPaint() {
  if (document.hidden) return Promise.resolve();
  return new Promise(resolve => {
    let frame = 0;
    const finish = () => { clearTimeout(timer); cancelAnimationFrame(frame); resolve(); };
    // rAF is suspended in background tabs and during some WebKit transitions.
    const timer = setTimeout(finish, 160);
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(finish); });
  });
}
const pendingMediaLikes = new Set();

const idleStartupQueue = [];
let idleStartupScheduled = false;
let lastStartupInputAt = -Infinity;
for (const type of ["focusin", "input", "pointerdown"]) document.addEventListener(type, event => {
  if (isEditableAppTarget(event.target)) lastStartupInputAt = performance.now();
}, {capture:true, passive:true});
function runWhenIdle(callback, timeout = 1200) {
  idleStartupQueue.push({callback, timeout});
  scheduleIdleStartup();
}
function scheduleIdleStartup() {
  if (idleStartupScheduled || !idleStartupQueue.length) return;
  idleStartupScheduled = true;
  const run = () => {
    idleStartupScheduled = false;
    // Never interrupt typing or keyboard presentation. A focused but idle field
    // must not starve chat/realtime initialization until the user leaves it.
    const editing = isEditableAppTarget(document.activeElement) && performance.now() - lastStartupInputAt < 900;
    if (document.hidden || editing || navigator.scheduling?.isInputPending?.()) {
      idleStartupScheduled = true;
      setTimeout(() => { idleStartupScheduled = false; scheduleIdleStartup(); }, 250);
      return;
    }
    const task = idleStartupQueue.shift();
    try { task.callback(); }
    finally {
      // Yield a painted frame between independent surfaces instead of one long
      // startup callback rendering contacts, messages, notices and administration.
      requestAnimationFrame(scheduleIdleStartup);
    }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, {timeout:idleStartupQueue[0].timeout});
  else window.setTimeout(run, 300);
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

let nativePushBridge;
let nativePushSetup;
let nativePushTapPending = null;
// Enable only after paid Apple signing and APNs secrets are configured.
const NATIVE_IOS_PUSH_ENABLED = false;
const NATIVE_PUSH_KEY = "club-native-push";
function nativePush() {
  if (!NATIVE_IOS_PUSH_ENABLED || window.Capacitor?.getPlatform?.() !== "ios") return null;
  return nativePushBridge ||= window.Capacitor.registerPlugin("ClubPush");
}
function nativePushRecord() {
  try { return JSON.parse(localStorage.getItem(NATIVE_PUSH_KEY) || "null"); } catch { return null; }
}
function routeNativePush(payload) {
  if (!currentAuthUser) { nativePushTapPending = payload; return; }
  const section = String(payload?.url || "").split("#")[1];
  if (["inicio", "chat", "calendario", "sobres", "contenido", "momentos", "publicaciones"].includes(section)) goTo(section);
}
async function saveNativePushToken(result, userId) {
  if (!result.token || !["sandbox", "production"].includes(result.environment) || currentAuthUser?.id !== userId) return;
  const {error} = await db.rpc("register_native_push_device", {p_token: result.token, p_environment: result.environment});
  if (error) throw error;
  localStorage.setItem(NATIVE_PUSH_KEY, JSON.stringify({...result, userId}));
}
async function setupNativePush() {
  const bridge = nativePush();
  if (!bridge || !currentAuthUser) return;
  if (!nativePushSetup) nativePushSetup = (async () => {
    await bridge.addListener("notificationTap", payload => {
      routeNativePush(payload);
      void bridge.consumeTap();
    });
    await bridge.addListener("registration", async () => {
      const userId = currentAuthUser?.id;
      if (!userId || nativePushRecord()?.userId !== userId) return;
      try { await saveNativePushToken(await bridge.status(), userId); } catch (error) { console.warn("No se pudo actualizar el registro de avisos", error.message); }
    });
  })();
  await nativePushSetup;
  const saved = nativePushRecord();
  const userId = currentAuthUser.id;
  if (saved?.userId === userId) {
    const state = await bridge.status();
    if (state.permission === "granted") await saveNativePushToken(await bridge.register(), userId);
  }
  const pending = nativePushTapPending || await bridge.consumeTap();
  nativePushTapPending = null;
  if (pending?.url) routeNativePush(pending);
}
async function removeNativePushDevice() {
  const saved = nativePushRecord();
  // The native copy survives cleared WebView storage and protects account switches.
  const state = await nativePush()?.status();
  const tokens = [...new Set([saved?.token, state?.token].filter(Boolean))];
  if (tokens.length && currentAuthUser?.id) {
    const {error} = await db.from("native_push_devices").delete().in("token", tokens).eq("user_id", currentAuthUser.id);
    if (error) throw new Error("No se pudieron desconectar los avisos de este iPhone. Reinténtalo con conexión.");
  }
  localStorage.removeItem(NATIVE_PUSH_KEY);
  await nativePush()?.unregister();
}

function pushSupported() {
  if (window.Capacitor?.getPlatform?.() === "android") return false;
  return Boolean(nativePush()) || "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(config.vapidPublicKey);
}

async function currentPushSubscription() {
  if (nativePush() || !pushSupported()) return null;
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
    status.textContent = window.Capacitor?.getPlatform?.() === "android" ? "Los avisos del teléfono estarán disponibles próximamente." : "Instala la PWA en un dispositivo compatible.";
    return;
  }
  if (nativePush()) {
    try {
      const state = await nativePush().status();
      const saved = nativePushRecord();
      const enabled = state.permission === "granted" && saved?.userId === currentAuthUser?.id;
      button.disabled = false;
      button.classList.toggle("enabled", enabled);
      button.textContent = enabled ? "Desactivar" : state.permission === "denied" ? "Abrir ajustes" : "Activar";
      if (testButton) testButton.hidden = !enabled;
      status.textContent = enabled ? "Avisos activados en este iPhone, también con la app cerrada." : state.permission === "denied" ? "Permite los avisos de Big Boy en Ajustes del iPhone." : "Actívalos para recibir avisos en la pantalla bloqueada y el centro de notificaciones.";
    } catch { button.disabled = true; status.textContent = "Actualiza la app desde Xcode para activar los avisos del iPhone."; }
    return;
  }
  const subscription = await currentPushSubscription();
  button.disabled = false;
  button.classList.toggle("enabled", Boolean(subscription));
  if (testButton) testButton.hidden = !subscription;
  button.textContent = subscription ? "Desactivar" : "Activar";
  status.textContent = subscription ? "Avisos activados en este dispositivo. Elige las categorías que quieres recibir." : Notification.permission === "denied" ? "El permiso está bloqueado en los ajustes del dispositivo." : "Actívalos para recibir avisos aunque la aplicación esté cerrada.";
}

async function togglePushNotifications() {
  if (!backendReady || !currentAuthUser || !pushSupported()) return syncPushNotificationState();
  const button = document.getElementById("pushNotificationButton");
  button.disabled = true;
  try {
    if (nativePush()) {
      const state = await nativePush().status();
      if (state.permission === "denied") { await nativePush().openSettings(); return; }
      if (nativePushRecord()?.userId === currentAuthUser.id) await removeNativePushDevice();
      else {
        const userId = currentAuthUser.id;
        await saveNativePushToken(await nativePush().register(), userId);
      }
      return;
    }
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
  else if (result?.data?.configurationMissing) status.textContent = "Falta configurar el envío de Apple en el servidor. El permiso del iPhone ya está preparado.";
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
  if (backendReady && !currentAuthUser) return false;
  return currentUser?.roleKey === "admin" || isSuperAdmin();
}

function getMember(id) {
  return membersById.get(Number(id));
}

function getMemberByAuthId(id) {
  return membersByAuthId.get(id);
}

function getAvatar(member, className = "avatar", priority = false) {
  if (member?.avatarUrl) {
    const initial = escapeHtml(member?.name?.charAt(0).toUpperCase() || "U");
    return `<div class="${className} has-image" data-avatar><span class="avatar-fallback" aria-hidden="true">${initial}</span><img src="${escapeHtml(member.avatarUrl)}" alt="Foto de ${escapeHtml(member.name)}" loading="${priority ? "eager" : "lazy"}" fetchpriority="${priority ? "high" : "auto"}" decoding="async" referrerpolicy="no-referrer"></div>`;
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
    members = members.map(member => {
      const {password: retiredPassword, ...profile} = stored[member.id] || {};
      return {...member, ...profile};
    });
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

// Keyboard animation emits resize + scroll events for the same geometry. Avoid
// invalidating inherited root styles again on every event (and every typed key).
function setViewportProperty(element, property, value) {
  if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
}
function syncMobileViewport() {
  if (viewportSyncFrame) return;
  viewportSyncFrame = requestAnimationFrame(() => {
    viewportSyncFrame = null;
    syncEventEditorViewport();
    if (window.innerWidth > 760) {
      document.documentElement.style.removeProperty("--chat-viewport-height");
      document.documentElement.style.removeProperty("--chat-viewport-offset");
      document.body.classList.remove("chat-keyboard-open");
      return;
    }
    const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight);
    const viewportOffset = Math.round(window.visualViewport?.offsetTop || 0);
    const composerFocused = Boolean(document.activeElement?.closest?.(".message-form, #inboxSearchInput"));
    if (!composerFocused) mobileViewportBaseline = Math.max(window.innerHeight, viewportHeight);
    const viewport = ChatKeyboard.viewport({height: viewportHeight, offset: viewportOffset,
      baseline: mobileViewportBaseline, focused: composerFocused,
      nativeLayout: chatKeyboard?.nativeLayout, nativeVisible: chatKeyboard?.keyboardVisible});
    setViewportProperty(document.documentElement, "--chat-viewport-height", `${viewport.height}px`);
    setViewportProperty(document.documentElement, "--chat-viewport-offset", `${viewport.offset}px`);
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
  const navigationSection = sectionId === "privados" ? "chat" : ["sobres", "album", "catalogo"].includes(sectionId) ? "inicio" : sectionId;
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
    const reducedMotion = (globalThis.ClubMotion?.media || window.matchMedia("(prefers-reduced-motion: reduce)")).matches;
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

let helpReturnPage = null;
const pageBackPositions = new Map();
let featureNavigationRequest = 0;

function goTo(sectionId) {
  const featureRequest = ++featureNavigationRequest;
  // Keep the current screen painted while an optional section's code/styles load.
  // Chat navigation remains synchronous because its push/pop gesture owns the frame.
  if (globalThis.ClubFeatures && !globalThis.ClubFeatures.routeReady(sectionId)) {
    void globalThis.ClubFeatures.forRoute(sectionId).then(() => {
      if (featureRequest === featureNavigationRequest) goTo(sectionId);
    }).catch(error => {
      if (featureRequest === featureNavigationRequest) globalThis.ClubFeatures.feedback(error.message, () => goTo(sectionId));
    });
    return;
  }
  void globalThis.ClubFeatures?.forRoute(sectionId).catch(error => globalThis.ClubFeatures.feedback(error.message));
  const leavingPage = sections.find(section => section.classList.contains("active"));
  if (leavingPage) pageBackPositions.set(leavingPage.id, {...capturePagePosition(leavingPage.id), layout: capturePageBackLayout(leavingPage)});
  // A back button and its edge gesture resolve the same route and restore the
  // same scroll owner. Forward navigation still starts at the top.
  const backTarget = leavingPage?.hasAttribute("data-edge-back") ? pageBackDestination(leavingPage) : null;
  const backId = ["miembros", "noticias"].includes(backTarget?.id) ? "inicio" : backTarget?.id;
  const returnPosition = backTarget?.id === sectionId ? (backTarget.top != null ? {...pageBackPositions.get(backId), ...backTarget, id: backId} : pageBackPositions.get(backId)) : null;
  if (sectionId === "ayuda") {
    const source = sections.find(section => section.classList.contains("active"));
    if (source && source.id !== "ayuda") helpReturnPage = capturePagePosition(source.id);
  }
  if (sectionId !== "perfil") { profileChatReturn = null; profilePageReturn = null; }
  cancelActiveAudioRecording();
  closeMessageUI();
  globalThis.ChatThemes?.close();
  if (["admin-configuracion", "admin-diagnostico", "admin-cuentas", "admin-logros", "crear-logro", "asignar-logro", "editar-usuario", "seccion-chat"].includes(sectionId) && !canManageSite()) sectionId = "inicio";
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
  pendingHomeAnchorGeneration = homeAnchor ? generation : null;
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
  // Realtime keeps data current while hidden; build the inbox only on entry.
  if (sectionId === "chat") renderPrivateContacts();
  globalThis.CardAlbum?.didNavigate(sectionId, currentSection);
  globalThis.AdminGrants?.didNavigate(sectionId);
  adminConsole?.didNavigate(sectionId);
  const navigationSection = sectionId === "privados" ? "chat" : ["sobres", "album", "catalogo"].includes(sectionId) ? "inicio" : sectionId;
  navLinks.forEach(link => {
    const active = link.dataset.section === navigationSection;
    link.classList.toggle("active", active);
    link.setAttribute("aria-current", active ? "page" : "false");
  });
  updateFloatingTabIndicator(navigationSection);
  document.body.classList.toggle("chat-focus", sectionId === "privados");
  document.body.classList.toggle("chat-inbox-view", sectionId === "chat");
  document.body.classList.toggle("achievement-management-open", ["admin-configuracion", "admin-diagnostico", "admin-cuentas", "admin-logros", "crear-logro", "asignar-logro", "editar-usuario"].includes(sectionId));
  if (sectionId === "ayuda") { globalThis.ClubDrafts?.begin("helpRequestForm", "new"); globalThis.ClubDrafts?.begin("helpReplyForm", activeHelpRequestId == null ? null : `request:${activeHelpRequestId}`); }
  if (sectionId === "admin-logros") renderAdminAchievements();
  if (sectionId === "admin-diagnostico") globalThis.ClubHealth?.show();
  if (sectionId === "admin-cuentas" || sectionId === "administracion") renderAdminPanel();
  syncChatInboxAccessibility();
  syncMobileViewport();
  const titles = {
    "seccion-chat": "Sección del grupo", inicio: "El Club", chat: "Mensajes", miembros: "Miembros",
    privados: "Mensajes privados", perfil: "Perfil", calendario: "Calendario",
    noticias: "Noticias", administracion: "Administración", ayuda: "Ayuda y sugerencias", sobres: "Colección", album: "Álbum", catalogo: "Cartas de la colección",
    "admin-configuracion": "Configuración", "admin-diagnostico": "Rendimiento y diagnóstico", "admin-cuentas": "Control de cuentas", "admin-logros": "Configuración de logros", "crear-logro": "Crear un logro", "asignar-logro": "Asignar logro", "editar-usuario": "Editar usuario"
  };
  pageTitle.textContent = titles[sectionId] || titles.inicio;
  // Subsections retain the current Home position until the one target jump.
  if (!homeAnchor) resetSectionScroll(sectionId);
  if (returnPosition) restorePagePosition(returnPosition);
  navigationFrame = requestAnimationFrame(() => {
    if (generation !== navigationGeneration) return;
    navigationFrame = null;
    document.body.classList.remove("tab-switching");
    if (returnPosition) {
      pendingHomeAnchorGeneration = null;
      restorePagePosition(returnPosition);
    } else if (homeAnchor && pendingHomeAnchorGeneration === generation) {
      const target = document.getElementById(homeAnchor);
      const home = document.getElementById("inicio");
      if (target && home) {
        // Only the section scrolls on mobile; scrollIntoView also scrolls its
        // ancestors in WebKit and can fight a swipe after navigation.
        const top = target.getBoundingClientRect().top;
        if (isMobileSidebar()) home.scrollTo({top: home.scrollTop + top - home.getBoundingClientRect().top, behavior: "instant"});
        else window.scrollTo({top: window.scrollY + top, behavior: "instant"});
      }
      pendingHomeAnchorGeneration = null;
    }
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
      if (sectionId === "inicio" && currentUser) renderSpotify();
      if ((requestedSection === "noticias" || sectionId === "inicio") && currentUser) loadNews(false);
      if (sectionId === "ayuda" && currentUser) loadHelpCenter();
      if (sectionId === "sobres" && currentUser) { void globalThis.BannerShop?.refresh(true); void globalThis.DailyPacks?.refresh(true); }
      if (["perfil", "administracion", "admin-logros", "crear-logro", "asignar-logro"].includes(sectionId) && currentUser && !achievementsLoaded) loadAchievements();
    }, 120);
  });
}

document.getElementById("quickSecurityButton")?.addEventListener("click", () => {
  closeProfileQuickMenu();
  if (currentAuthUser && db) void globalThis.ClubAccountSecurity?.open(db, currentAuthUser);
});

document.getElementById("adminSecurityButton")?.addEventListener("click", () => {
  if (isSuperAdmin() && currentAuthUser && db) void globalThis.ClubAccountSecurity?.open(db, currentAuthUser);
});

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
  cancelActiveAudioRecording();
  closeMessageUI();
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
  cancelActiveAudioRecording();
  closeMessageUI();
  const update = showPrivateChatInbox;
  if (animate) await transitionMessageView(update, {back: true});
  else update();
}

function dismissChatComposerKeyboard() {
  const composer = document.activeElement;
  if (!composer?.closest?.(".message-form")) return;
  composer.blur();
  chatKeyboard?.dismiss?.();
  syncMobileViewport();
}

function capturePagePosition(id) {
  const node = document.getElementById(id);
  return {id, top: node?.scrollTop || 0, windowTop: window.scrollY, inboxTop: id === "chat" ? document.querySelector("#chat .chat-inbox")?.scrollTop || 0 : null};
}
function restorePagePosition(position) {
  if (!position) return;
  const generation = navigationGeneration;
  const apply = () => {
    if (generation !== navigationGeneration) return;
    document.getElementById(position.id)?.scrollTo({top: position.top, behavior: "instant"});
    if (position.inboxTop != null) document.querySelector("#chat .chat-inbox")?.scrollTo({top: position.inboxTop, behavior: "instant"});
    if (!isMobileSidebar()) window.scrollTo({top: position.windowTop, behavior: "instant"});
  };
  apply(); requestAnimationFrame(() => { apply(); requestAnimationFrame(apply); });
}
function rememberInboxPosition() {
  if (document.getElementById("chat")?.classList.contains("active") && !document.body.classList.contains("chat-focus")) chatInboxScroll = capturePagePosition("chat");
}
function showGroupChatInbox() {
  dismissChatComposerKeyboard();
  const groupSection = document.getElementById("chat");
  groupSection?.classList.remove("conversation-open");
  document.body.classList.remove("chat-focus");
  syncChatInboxAccessibility();
  syncMobileViewport();
  document.querySelectorAll("#privateContacts .private-contact.active").forEach(contact => contact.classList.remove("active"));
  history.replaceState(null, "", "#chat");
  restorePagePosition(chatInboxScroll);
}

function showPrivateChatInbox() {
  dismissChatComposerKeyboard();
  globalThis.ClubDrafts?.flush();
  activePrivateMemberId = null;
  renderPrivateConversation();
  goTo("chat");
  restorePagePosition(chatInboxScroll);
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
  markVisibleConversationRead({includeHistory: true});
}

function restorePrivateConversation(memberId) {
  activePrivateMemberId = memberId;
  void resolvePrivateAttachments().then(refreshPrivateMessageSurfaces);
  renderPrivateContacts();
  renderPrivateConversation();
  goTo("privados");
  markVisibleConversationRead({includeHistory: true});
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
  const reduced = (globalThis.ClubMotion?.media || window.matchMedia("(prefers-reduced-motion: reduce)")).matches;
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
  if (event.target.closest(".message-form, [data-message-bubble], button, a, input, textarea, select, audio, video, [contenteditable='true']")) return;
  const panel = event.target.closest("#privados.active.conversation-open .private-conversation, #chat.active.conversation-open .group-conversation");
  if (!panel || !event.target.closest(".messages, .chat-header")) return;
  const composer = document?.activeElement;
  if (panel.contains?.(composer) && composer?.closest?.(".message-form") && event.cancelable) {
    // Keep editing focus until the return is committed. WebKit's default focus
    // change can dismiss the keyboard and interrupt the pointer stream mid-drag.
    // Pointer defaults do not control native panning; touch-action still allows pan-y.
    event.preventDefault();
  }
  chatBackGesture = {
    pointerId: event.pointerId,
    panel,
    sourcePanel: panel,
    kind: panel.closest("#privados") ? "private" : "group",
    memberId: activePrivateMemberId,
    channelId: activeChatChannelId,
    startX: event.clientX,
    startY: event.clientY,
    samples: [{x: event.clientX, time: event.timeStamp ?? performance.now()}],
    peakDeltaX: 0,
    velocityX: 0,
    deltaX: 0,
    deltaY: 0,
    tracking: false,
    scene: null,
    frame: null,
    pendingOffset: 0,
  };
}

// Measure the recent movement, including release coordinates. One noisy final
// pointermove should not decide a flick, and a paused finger has no stale velocity.
function sampleChatBackGesture(gesture, event) {
  const now = event.timeStamp ?? performance.now();
  gesture.samples.push({x: event.clientX, time: now});
  gesture.samples = gesture.samples.filter(sample => now - sample.time <= CHAT_BACK_GESTURE.velocityWindow);
  const first = gesture.samples[0];
  const elapsed = now - first.time;
  gesture.velocityX = elapsed > 0 ? (event.clientX - first.x) / elapsed : 0;
  gesture.deltaX = event.clientX - gesture.startX;
  gesture.deltaY = event.clientY - gesture.startY;
  gesture.peakDeltaX = Math.max(gesture.peakDeltaX, gesture.deltaX);
}

function moveChatBackGesture(event) {
  const gesture = chatBackGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  sampleChatBackGesture(gesture, event);
  if (!gesture.tracking) {
    if ((Math.abs(gesture.deltaY) >= CHAT_BACK_GESTURE.activationDistance
      && Math.abs(gesture.deltaY) > Math.abs(gesture.deltaX) * CHAT_BACK_GESTURE.intentRatio) || gesture.deltaX < -18) {
      resetChatBackGesture();
      return;
    }
    if (gesture.deltaX < CHAT_BACK_GESTURE.activationDistance || Math.abs(gesture.deltaX) <= Math.abs(gesture.deltaY) * CHAT_BACK_GESTURE.intentRatio) return;
    gesture.tracking = true;
    gesture.scene = prepareChatBackScene(gesture.sourcePanel);
    if (!gesture.scene) {
      resetChatBackGesture();
      return;
    }
    try { gesture.panel.setPointerCapture?.(event.pointerId); } catch { /* Pointer may already have been cancelled by the OS. */ }
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
  sampleChatBackGesture(gesture, event);
  if (gesture.frame) {
    cancelAnimationFrame(gesture.frame);
    gesture.frame = null;
  }
  if (gesture.scene) updateChatBackScene(gesture.scene, Math.max(0, gesture.deltaX));
  const completionDistance = Math.min(CHAT_BACK_GESTURE.triggerDistance, gesture.scene?.width * CHAT_BACK_GESTURE.completionRatio || CHAT_BACK_GESTURE.triggerDistance);
  // Once horizontal intent is established, diagonal drift is natural. A deliberate
  // pull back still cancels, even if the panel previously crossed the threshold.
  const reversed = gesture.peakDeltaX - gesture.deltaX >= CHAT_BACK_GESTURE.reversalDistance;
  const shouldComplete = gesture.tracking && !reversed
    && (gesture.deltaX >= completionDistance || (gesture.deltaX >= CHAT_BACK_GESTURE.minimumFlickDistance
      && gesture.velocityX >= CHAT_BACK_GESTURE.velocityThreshold));
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
  const owner = currentAuthUser?.id;
  if (!owner) return;
  rememberInboxPosition();
  if (channelId != null && chatChannels.some(channel => String(channel.id) === String(channelId))) {
    activeChatChannelId = channelId;
  }
  const groupSection = document.getElementById("chat");
  await transitionMessageView(() => {
    if (owner !== currentAuthUser?.id) return;
    goTo("chat");
    groupSection.classList.add("conversation-open");
    document.body.classList.add("chat-focus");
    syncChatInboxAccessibility();
    renderChatChannels();
    renderMessages();
    globalThis.GroupInteractions?.mountPolls(document.getElementById("groupPolls"), activeChatChannelId);
    syncMobileViewport();
    history.replaceState(null, "", "#chat");
    markVisibleConversationRead({includeHistory: true});
  });
}

// Repeated hydration/realtime updates often produce identical UI. Preserve live
// DOM nodes (decoded avatars, banner animations and scroll/focus state).
const surfaceMarkup = new WeakMap();
function updateSurfaceMarkup(node, markup) {
  if (!node || surfaceMarkup.get(node) === markup) return false;
  node.innerHTML = markup;
  surfaceMarkup.set(node, markup);
  return true;
}

function renderFeatured() {
  const featured = document.getElementById("featuredMembers");
  if (!featured) return;
  updateSurfaceMarkup(featured, members.slice(0, 4).map(member => `
    <button class="member-mini-card ${member.countryFlag ? "has-country-flag" : ""}" data-profile="${member.id}">
      ${member.countryFlag ? `<span class="member-mini-flag" aria-hidden="true">${escapeHtml(member.countryFlag)}</span>` : ""}
      ${getAvatar(member)}
      <span class="member-mini-copy">
        <strong>${escapeHtml(member.name)}</strong>
        <small>${escapeHtml(member.nickname)}</small>
      </span>
    </button>`).join(""));
}

let memberProfilesOwner = null, memberProfilesFailedOwner = null;
function renderMembers() {
  const grid = document.getElementById("membersGrid");
  if (!grid) return;
  const pending = backendReady && currentAuthUser?.id && memberProfilesOwner !== currentAuthUser.id;
  grid.setAttribute("aria-busy", String(Boolean(pending && memberProfilesFailedOwner !== currentAuthUser?.id)));
  if (pending) {
    if (memberProfilesFailedOwner === currentAuthUser.id) {
      if (updateSurfaceMarkup(grid, '<p class="club-placeholder" role="status">No se pudieron cargar los miembros. <button type="button" class="text-button" data-members-retry>Reintentar</button></p>')) {
        grid.querySelector('[data-members-retry]')?.addEventListener('click', () => { memberProfilesFailedOwner = null; renderMembers(); void loadRemoteProfiles(); });
      }
    } else {
      updateSurfaceMarkup(grid, Array.from({length:2}, () => '<div class="club-member is-loading" aria-hidden="true"><div class="club-member-hero"><div class="club-member-banner"></div><div class="avatar"></div></div><span class="club-member-identity"><strong>&nbsp;</strong><small>&nbsp;</small></span></div>').join(''));
    }
    return;
  }
  updateSurfaceMarkup(grid, members.filter(member => !member.hidden).map((member, index) => `
    <button class="club-member" type="button" data-profile="${member.id}" data-member-priority="${index < 2}" data-member-banner-user="${escapeHtml(member.authId || '')}" aria-label="Ver perfil de ${escapeHtml(member.name)}">
      <div class="club-member-hero"><div class="club-member-banner" aria-hidden="true"></div>${getAvatar(member, "avatar", index < 2)}</div>
      <span class="club-member-identity"><strong>${escapeHtml(member.name)}</strong><small>@${escapeHtml(member.username)}</small></span>
    </button>`).join(""));
  // Rebind after session resets even when identity markup is unchanged.
  globalThis.BannerShop?.mountMembers(grid);
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

const achievementProfilePages = new Map();
function renderProfileAchievementCard(achievement) {
  const tier = achievementTier(achievement.tier);
  return `<button type="button" class="achievement-card tier-${escapeHtml(achievement.tier)}" data-open-achievement="${escapeHtml(achievement.id)}" aria-label="Ver logro: ${escapeHtml(achievement.name)}">
    <span class="achievement-emblem" aria-hidden="true">${achievementTrophyIcon(achievement.tier, achievement.icon)}</span>
    <span class="achievement-card-copy"><small>${escapeHtml(tier.label)}</small><strong>${escapeHtml(achievement.name)}</strong></span>
  </button>`;
}

function renderMemberAchievements(member) {
  const tierOrder = {platinum: 0, gold: 1, silver: 2, bronze: 3};
  const assigned = achievementsForMember(member).sort((a, b) => (tierOrder[a.tier] ?? 4) - (tierOrder[b.tier] ?? 4) || String(a.name).localeCompare(String(b.name), "es"));
  const visible = assigned.slice(0, 4);
  const archived = assigned.slice(4);
  const pageKey = String(member.id);
  achievementProfilePages.delete(pageKey);
  if (archived.length) {
    achievementProfilePages.set(pageKey, {items: archived, offset: 0});
    while (achievementProfilePages.size > 8) achievementProfilePages.delete(achievementProfilePages.keys().next().value);
  }
  const tierSummary = Object.entries({platinum:"Platino",gold:"Oro",silver:"Plata",bronze:"Bronce"})
    .map(([tier, label]) => [tier, label, assigned.filter(item => item.tier === tier).length])
    .filter(([, , count]) => count)
    .map(([tier, label, count]) => `<span class="achievement-tier-count tier-${tier}"><i aria-hidden="true"></i>${label} <strong>${count}</strong></span>`).join("");
  return `<section class="profile-achievements">
    <div class="profile-feed-heading"><div><h3>Logros</h3></div><span class="club-profile-achievement-summary"><span class="club-profile-earned"><strong>${assigned.length}</strong> ${assigned.length === 1 ? "conseguido" : "conseguidos"}</span>${renderAchievementChallengeTrigger(member)}</span></div>
    ${assigned.length ? `<div class="achievement-tier-summary" aria-label="Logros por categoría">${tierSummary}</div>` : ""}
    <div class="achievement-showcase">
      ${assigned.length ? visible.map(renderProfileAchievementCard).join("") : `<div class="empty-state compact achievement-empty"><strong>${achievementsLoading ? "Cargando logros…" : "Aún no hay logros"}</strong><span>Los logros conseguidos aparecerán aquí.</span></div>`}
    </div>
    ${archived.length ? `<button type="button" class="achievement-show-all" data-load-achievement-page="${escapeHtml(pageKey)}">Cargar ${Math.min(8, archived.length)} más · ${archived.length} pendientes</button>` : ""}
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
  if (navigate) {
    const origin = sections.find(section => section.classList.contains("active"));
    if (origin && !["perfil", "chat", "privados"].includes(origin.id)) profilePageReturn = capturePagePosition(origin.id);
    if (origin?.id === "privados" && activePrivateMemberId != null || origin?.id === "chat" && origin.classList.contains("conversation-open")) {
      const scroller = document.getElementById(origin.id === "privados" ? "privateMessages" : "messages");
      profileChatReturn = {section: origin.id, memberId: activePrivateMemberId, channelId: activeChatChannelId, scrollTop: scroller.scrollTop, sectionBeforeChat};
    } else if (origin?.id !== "perfil") profileChatReturn = null;
  }
  activeProfileId = member.id;
  const isOwnProfile = currentUser?.id === member.id;
  const canEdit = isOwnProfile && !member.hidden;
  const canManageProfile = !member.hidden && (canEdit || isSuperAdmin());
  const backButton = document.querySelector("#perfil .back-button");
  backButton.hidden = isOwnProfile && !profileChatReturn;
  backButton.textContent = profileChatReturn ? "← Volver al chat" : "← Volver a miembros";
  const markup = `
    <article class="club-profile">
      <div class="club-profile-topline"><span class="eyebrow">MIEMBRO DEL CLUB</span><span class="club-member-number">${member.hidden ? "ADMIN" : `N.º ${String(memberDisplayNumber(member)).padStart(2, "0")}`}</span></div>
      <div class="club-profile-identity">
        ${getAvatar(member, "avatar club-profile-avatar")}
        <div class="club-profile-copy"><span class="club-profile-handle">@${escapeHtml(member.username || member.name)}</span><h2>${escapeHtml(member.name)}</h2><span class="club-profile-role">${escapeHtml(member.role || "Miembro")}</span></div>
        ${canManageProfile ? `<button class="secondary-button profile-edit-compact" id="editProfileButton" type="button">${canEdit ? "Editar perfil" : "Gestionar"}</button>` : ""}
      </div>
      ${member.nickname ? `<p class="club-profile-nickname">${escapeHtml(member.nickname)}</p>` : ""}
      ${member.bio ? `<p class="club-profile-bio">${escapeHtml(member.bio)}</p>` : ""}
      <div class="profile-tags">${(member.tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="club-profile-bottom">
        <div class="profile-actions">
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
  globalThis.BannerShop?.mountProfile(document.querySelector("#profileContent .club-profile"), member.authId, isOwnProfile);
  if (navigate) goTo("perfil");
}

function backFromMemberProfile() {
  const destination = profileChatReturn;
  const page = profilePageReturn;
  profileChatReturn = null; profilePageReturn = null;
  if (!destination) { goTo(page?.id || "miembros"); restorePagePosition(page); return; }
  if (destination.section === "privados") {
    if (!getMember(destination.memberId)) { goTo("chat"); return; }
    restorePrivateConversation(destination.memberId);
  } else {
    if (!chatChannels.some(channel => String(channel.id) === String(destination.channelId))) { goTo("chat"); return; }
    restoreGroupConversation(destination.channelId);
  }
  // Returning from a profile is not a new entry into chat from another tab.
  sectionBeforeChat = destination.sectionBeforeChat;
  const generation = navigationGeneration;
  const scroller = document.getElementById(destination.section === "privados" ? "privateMessages" : "messages");
  // Invalidate delayed auto-scroll work created while re-rendering the conversation.
  scroller.dataset.latestScrollRequest = String((Number(scroller.dataset.latestScrollRequest) || 0) + 1);
  const restore = () => { if (generation === navigationGeneration) scroller.scrollTop = destination.scrollTop; };
  restore();
  requestAnimationFrame(() => { restore(); requestAnimationFrame(restore); });
}

function spotifyEmbedUrl(value = "") {
  const match = value.trim().match(/(?:open\.spotify\.com\/playlist\/|spotify:playlist:)([A-Za-z0-9]+)/);
  return match ? `https://open.spotify.com/embed/playlist/${match[1]}?utm_source=generator&theme=0` : "";
}

let spotifyViewportObserver = null;
let spotifyMountRequest = 0;
function spotifySurfaceVisible(player) {
  if (!currentUser || document.hidden || !document.getElementById("inicio")?.classList.contains("active") || player.closest(".club-section-disabled")) return false;
  const rect = player.getBoundingClientRect();
  const page = document.getElementById("inicio").getBoundingClientRect();
  return rect.width > 0 && rect.top < Math.min(window.innerHeight, page.bottom) + 80 && rect.bottom > Math.max(0, page.top);
}
function renderSpotify() {
  const player = document.getElementById("spotifyPlayer");
  const editor = document.getElementById("editSpotifyButton");
  if (!spotifyViewportObserver && typeof IntersectionObserver === "function") {
    spotifyViewportObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) renderSpotify();
    }, {rootMargin:"80px 0px"});
    spotifyViewportObserver.observe(player);
  }
  if (!homeSettingsReady) {
    if (!player.childElementCount) player.innerHTML = '<div class="home-loading-state" role="status">Cargando playlist…</div>';
    editor.hidden = true;
    return;
  }
  editor.hidden = false;
  const url = siteSettings.spotify_playlist || "";
  editor.textContent = spotifyEmbedUrl(url) ? "Cambiar playlist" : "Vincular playlist";
  if (!spotifySurfaceVisible(player)) return;
  const owner = currentAuthUser?.id || "", token = ++spotifyMountRequest;
  void globalThis.ClubFeatures?.load("spotify").then(() => {
    if (token !== spotifyMountRequest || owner !== (currentAuthUser?.id || "") || !spotifySurfaceVisible(player)) return;
    return globalThis.ClubSpotify?.mount(player, url, owner);
  }).catch(() => {
    if (token !== spotifyMountRequest) return;
    player.innerHTML = '<div class="home-loading-state" role="status">No se pudo cargar Spotify. <button type="button" data-spotify-retry>Cargar de nuevo</button></div>';
  });
}
document.addEventListener("click", event => { if (event.target.closest("[data-spotify-retry]")) renderSpotify(); });

function groupAvatarMarkup(className = "chat-group-avatar") {
  const avatarUrl = siteSettings.group_avatar_url || "";
  return `<span class="${className}" data-group-avatar aria-hidden="true">${avatarUrl
    ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" decoding="async">`
    : "<b>BB</b>"}<i></i></span>`;
}

function renderGroupAvatarSurfaces() {
  document.querySelectorAll("[data-group-avatar]").forEach(node => {
    const avatarUrl = siteSettings.group_avatar_url || "";
    updateSurfaceMarkup(node, avatarUrl
      ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" decoding="async"><i></i>`
      : "<b>BB</b><i></i>");
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
  reconcileMessageUI("group");
  renderChatReplyComposer("group");
  globalThis.ChatThemes?.sync("group");
  const container = document.getElementById("messages");
  if (!backendReady) {
    container.innerHTML = `<div class="empty-state"><strong>Chat real pendiente de conexión</strong><span>Configura Supabase para compartir mensajes entre todos. No mostramos conversaciones ficticias.</span></div>`;
    setChatEnabled(false);
    return;
  }
  setChatEnabled(Boolean(currentUser) && !isSuperAdmin());
  const finishReading = preserveConversationReading(container, `group:${activeChatChannelId}`);
  const channelMessages = [...messages, ...calendarChatAnnouncements, ...channelAutomationMessages]
    .filter(message => String(message.channelId || "") === String(activeChatChannelId || ""))
    .sort((a, b) => messageTimestamp(a) - messageTimestamp(b));
  if (!channelMessages.length) {
    container.innerHTML = `<div class="empty-state"><strong>Aún no hay mensajes</strong><span>Sé la primera persona en escribir al grupo.</span></div>`;
    return;
  }
  setChatMessageMarkup(container, channelMessages.map((message, index) => {
    if (message.systemAnnouncement) return `${conversationDayDivider(message.createdAt, channelMessages[index - 1]?.createdAt)}<div class="calendar-chat-announcement" role="note"><span class="calendar-chat-announcement-label">${escapeHtml(message.automation ? "Sección · Automático" : "Agenda · Bigboys")}</span><p>${escapeHtml(message.text)}</p></div>`;
    const member = getMember(message.member);
    const attachment = message.attachmentUrl ? renderMessageAttachment(message) : "";
    const own = message.userId === currentAuthUser?.id;
    return `${conversationDayDivider(message.createdAt, channelMessages[index - 1]?.createdAt)}<div class="message ${own ? "own own-message" : ""}">
      ${own ? "" : `<button type="button" class="message-avatar-link" data-profile="${escapeHtml(String(member?.id || message.member))}" aria-label="Ver perfil de ${escapeHtml(member?.name || "miembro")}">${getAvatar(member)}</button>`}
      <div class="message-bubble" data-message-bubble data-message-kind="group" data-message-id="${escapeHtml(String(message.id))}" tabindex="0" role="button" aria-haspopup="menu" aria-label="Mensaje de ${escapeHtml(member?.name || "Miembro")}: ${escapeHtml(String(message.text || "Adjunto").slice(0, 160))}. Mantén pulsado para ver opciones">
        ${own ? "" : `<div class="message-head">
          <button class="message-author" data-profile="${message.member}">${escapeHtml(member?.name || "Miembro")}</button>
        </div>`}
        ${renderChatQuote("group", message)}
        ${message.text ? `<p>${escapeHtml(message.text)}</p>` : ""}${attachment}
        <div class="message-footer"><time class="private-message-time" datetime="${escapeHtml(message.createdAt)}" title="${escapeHtml(formatMessageDate(message.createdAt))}">${formatConversationTime(message.createdAt)}</time>
        </div>
      </div>
    </div>`;
  }).join(""));
  finishReading();
}


// Reply state belongs to a user and conversation; switching threads never leaks a quote.
const chatReplies = new Map();
function chatReplyKey(kind) { return `${currentAuthUser?.id || ""}:${kind}:${kind === "private" ? activePrivateMemberId : activeChatChannelId}`; }
function chatReplyDescription(kind, message) {
  const author = kind === "group" ? getMember(message.member) : getMemberByAuthId(message.senderId);
  return {name: author?.name || "Miembro", text: String(message.text || message.body || (message.attachmentType?.startsWith("image/") ? "Imagen" : message.attachmentType?.startsWith("audio/") ? "Nota de voz" : message.attachmentType?.startsWith("video/") ? "Vídeo" : "Archivo adjunto")).slice(0, 180)};
}
function renderChatQuote(kind, message) {
  if (!message.replyToId) return "";
  const source = (kind === "private" ? privateMessages : messages).find(item => String(item.id) === String(message.replyToId));
  const quote = source ? chatReplyDescription(kind, source) : {name: "Respuesta", text: "Mensaje anterior no disponible"};
  return `<button type="button" class="chat-message-quote" data-chat-quote="${escapeHtml(String(message.replyToId))}" data-quote-kind="${kind}" aria-label="Ver mensaje al que responde"><strong>${escapeHtml(quote.name)}</strong><span>${escapeHtml(quote.text)}</span></button>`;
}
function renderChatReplyComposer(kind) {
  const form = document.getElementById(kind === "private" ? "privateMessageForm" : "messageForm");
  if (!form) return;
  let preview = form.previousElementSibling;
  if (!preview?.matches("[data-chat-reply-composer]")) {
    preview = document.createElement("div"); preview.className = "chat-reply-composer";
    preview.dataset.chatReplyComposer = kind; preview.setAttribute("role", "status"); preview.setAttribute("aria-live", "polite");
    form.before(preview);
  }
  const reply = chatReplies.get(chatReplyKey(kind));
  preview.hidden = !reply;
  if (!reply) { preview.replaceChildren(); preview._replyMarkup = null; return; }
  const source = contextMessage({kind, id: String(reply.id)});
  if (!source) { chatReplies.delete(chatReplyKey(kind)); preview.hidden = true; preview.replaceChildren(); preview._replyMarkup = null; return; }
  const quote = chatReplyDescription(kind, source);
  const markup = `<div><strong>Responder a ${escapeHtml(quote.name)}</strong><span>${escapeHtml(quote.text)}</span></div><button type="button" data-cancel-chat-reply="${kind}" aria-label="Cancelar respuesta">×</button>`;
  if (preview._replyMarkup !== markup) { preview.innerHTML = markup; preview._replyMarkup = markup; }
}
function selectChatReply(target) {
  const message = contextMessage(target);
  const input = document.getElementById(target.kind === "private" ? "privateMessageInput" : "messageInput");
  if (!message || !input || input.disabled) return;
  chatReplies.set(chatReplyKey(target.kind), {id: message.id});
  cancelMessageHold(); closeMessageMenu(); renderChatReplyComposer(target.kind);
  input.focus({preventScroll: true});
}
document.addEventListener("click", event => {
  const cancel = event.target.closest("[data-cancel-chat-reply]");
  if (cancel) { const kind = cancel.dataset.cancelChatReply; chatReplies.delete(chatReplyKey(kind)); renderChatReplyComposer(kind); return; }
  const quote = event.target.closest("[data-chat-quote]");
  if (!quote) return;
  const container = document.getElementById(quote.dataset.quoteKind === "private" ? "privateMessages" : "messages");
  if (!container) return;
  const source = [...container.querySelectorAll("[data-message-bubble]")].find(node => node.dataset.messageId === quote.dataset.chatQuote);
  if (!source) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  source.scrollIntoView({block: "center", behavior: reduced ? "instant" : "smooth"});
  source._replyHighlight?.cancel();
  if (!reduced && source.animate) source._replyHighlight = source.animate(
    [{filter: "brightness(1.4)"}, {filter: "brightness(1)"}], {duration: 700, easing: "ease-out"});
});

let messageReplyGesture = null;
const messageReplySpringTimers = new WeakMap();
function stopMessageReplySpring(bubble) {
  clearTimeout(messageReplySpringTimers.get(bubble));
  messageReplySpringTimers.delete(bubble);
  bubble.classList.remove("is-reply-springing");
  for (const property of ["--message-reply-start", "--message-reply-start-scale", "--message-reply-offset", "--message-reply-scale"])
    bubble.style.removeProperty(property);
}
function paintMessageReplyGesture(gesture) {
  gesture.frame = 0;
  if (messageReplyGesture !== gesture || !gesture.bubble.isConnected) return;
  // Only transforms change during a drag. Width/position are read once, before
  // any drag styles, rather than triggering layout for every pointer sample.
  gesture.bubble.style.setProperty("--message-reply-offset", `${gesture.offset}px`);
  gesture.bubble.style.setProperty("--message-reply-scale", String(gesture.scale));
  gesture.bubble.classList.toggle("is-reply-ready", gesture.ready);
}
function sampleMessageReplyGesture(gesture, event) {
  const x = event.clientX - gesture.x, y = event.clientY - gesture.y;
  const now = event.timeStamp ?? performance.now();
  gesture.samples.push({x: event.clientX, time: now});
  // Include the release sample: WebKit may deliver a short flick as just a
  // pointerdown and pointerup, without any intermediate pointermove.
  gesture.samples = gesture.samples.filter(sample => now - sample.time <= 120);
  const first = gesture.samples[0];
  const elapsed = now - first.time;
  const velocity = elapsed > 0 ? (event.clientX - first.x) / elapsed : 0;
  gesture.peakX = Math.max(gesture.peakX, x);
  gesture.offset = Math.max(0, Math.min(96, x > 64 ? 64 + (x - 64) * .22 : x));
  gesture.scale = 1 + Math.min(gesture.offset / gesture.width, .24);
  // Arm from the movement, not the speed of the final release sample. A quick
  // flick naturally slows (or pauses) before pointerup and must still reply.
  if (x >= 44 || (x >= 28 && velocity >= .35)) gesture.armed = true;
  // Allow normal diagonal drift after horizontal intent locks. Only a clear
  // pull back towards the starting point cancels an already armed reply.
  const returned = x < 14 || gesture.peakX - x > Math.max(28, gesture.peakX * .55);
  gesture.ready = gesture.armed && !returned && Math.abs(y) < Math.max(80, x);
}
function activateMessageReplyGesture(gesture, event, capture = true) {
  if (gesture.tracking) return true;
  const x = event.clientX - gesture.x, y = event.clientY - gesture.y;
  if (x < 10 || x < Math.abs(y) * 1.25) return false;
  gesture.tracking = true;
  cancelMessageHold();
  gesture.bubble.classList.add("is-reply-dragging");
  if (capture && gesture.source === "pointer") {
    try { gesture.bubble.setPointerCapture(event.pointerId); } catch { /* Detached during live refresh. */ }
  }
  return true;
}
function resetMessageReplyGesture(commit = false) {
  const gesture = messageReplyGesture;
  messageReplyGesture = null;
  if (!gesture) return;
  if (gesture.frame) cancelAnimationFrame(gesture.frame);
  const bubble = gesture.bubble;
  // Release capture before opening the keyboard. Otherwise a live render or
  // viewport resize can strand the pointer on an old message element.
  if (gesture.source === "pointer") {
    try { if (bubble.hasPointerCapture(gesture.pointerId)) bubble.releasePointerCapture(gesture.pointerId); } catch { /* Detached by realtime. */ }
  }
  const spring = gesture.tracking && gesture.offset > 0 && bubble.isConnected;
  bubble.style.setProperty("--message-reply-start", `${gesture.offset}px`);
  bubble.style.setProperty("--message-reply-start-scale", String(gesture.scale));
  bubble.classList.remove("is-reply-dragging", "is-reply-ready");
  bubble.classList.toggle("is-reply-springing", spring);
  bubble.style.removeProperty("--message-reply-offset");
  bubble.style.removeProperty("--message-reply-scale");
  if (spring) messageReplySpringTimers.set(bubble, setTimeout(() => stopMessageReplySpring(bubble), 540));
  else stopMessageReplySpring(bubble);
  if (gesture.tracking) messageClickSuppression = {bubble, released: true, until: performance.now() + 550};
  if (commit && gesture.tracking && gesture.ready && bubble.isConnected)
    selectChatReply({kind: bubble.dataset.messageKind, id: bubble.dataset.messageId});
}
// Touch owns its complete lifecycle. WebKit can cancel the compatibility
// pointer stream when it starts panning; preventing pointermove cannot prevent
// that. An active touchmove listener claims only horizontal drags, and touchend
// supplies the release even when pointerup/capture have already disappeared.
const messageReplyUsesTouchEvents = "ontouchstart" in window;
function beginMessageReplyGesture(target, point, source, id) {
  resetMessageReplyGesture();
  const bubble = target.closest("[data-message-bubble]");
  if (!bubble || target.closest("button:not([data-chat-image]):not([data-chat-quote]), a, input, textarea, audio, video") || messageMenuTarget) return;
  const input = document.getElementById(bubble.dataset.messageKind === "private" ? "privateMessageInput" : "messageInput");
  if (!input || input.disabled) return;
  stopMessageReplySpring(bubble);
  const width = Math.max(80, bubble.getBoundingClientRect().width);
  messageReplyGesture = {bubble, source, pointerId: source === "pointer" ? id : null, touchId: source === "touch" ? id : null,
    x: point.clientX, y: point.clientY, width, offset: 0, scale: 1, frame: 0, tracking: false, ready: false, armed: false, peakX: 0,
    samples: [{x: point.clientX, time: point.timeStamp ?? performance.now()}]};
}
function moveMessageReplyGesture(gesture, point, event) {
  if (!gesture.bubble.isConnected) { resetMessageReplyGesture(); return; }
  const x = point.clientX - gesture.x, y = point.clientY - gesture.y;
  if (Math.hypot(x, y) > 11) cancelMessageHold();
  if (!gesture.tracking) {
    if ((Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) || x < -12) { resetMessageReplyGesture(); return; }
    if (!activateMessageReplyGesture(gesture, point)) return;
  }
  // A noncancelable touchmove means native scrolling already won. Do not turn
  // the end of a scroll into a reply, even if its later movement is horizontal.
  if (gesture.source === "touch" && !event.cancelable) { resetMessageReplyGesture(); return; }
  if (event.cancelable) event.preventDefault();
  sampleMessageReplyGesture(gesture, point);
  if (!gesture.frame) gesture.frame = requestAnimationFrame(() => paintMessageReplyGesture(gesture));
}
function finishMessageReplyGesture(gesture, point) {
  // A short flick may have no move events. Resolve intent from its release;
  // always resample so a deliberate pull back still cancels an armed reply.
  if (activateMessageReplyGesture(gesture, point, false)) sampleMessageReplyGesture(gesture, point);
  resetMessageReplyGesture(true);
}
function messageReplyTouchPoint(touch, event) {
  return {clientX: touch.clientX, clientY: touch.clientY, timeStamp: event.timeStamp};
}
document.addEventListener("touchstart", event => {
  if (event.touches.length !== 1) { resetMessageReplyGesture(); cancelMessageHold(); return; }
  const touch = event.changedTouches[0];
  if (touch) beginMessageReplyGesture(event.target, messageReplyTouchPoint(touch, event), "touch", touch.identifier);
}, {passive: true});
// Scope the blocking listener to the transcripts so unrelated pages retain
// their native fast scrolling. touch-action: pan-y still permits vertical scroll.
for (const container of [document.getElementById("messages"), document.getElementById("privateMessages")]) {
  container?.addEventListener("touchmove", event => {
    const gesture = messageReplyGesture;
    if (!gesture || gesture.source !== "touch") return;
    if (event.touches.length !== 1) { resetMessageReplyGesture(); return; }
    const touch = [...event.changedTouches].find(item => item.identifier === gesture.touchId);
    if (touch) moveMessageReplyGesture(gesture, messageReplyTouchPoint(touch, event), event);
  }, {passive: false});
}
document.addEventListener("touchend", event => {
  const gesture = messageReplyGesture;
  if (!gesture || gesture.source !== "touch") return;
  const touch = [...event.changedTouches].find(item => item.identifier === gesture.touchId);
  if (!touch) return;
  if (event.touches.length) { resetMessageReplyGesture(); return; }
  finishMessageReplyGesture(gesture, messageReplyTouchPoint(touch, event));
}, {passive: true});
document.addEventListener("touchcancel", event => {
  if (messageReplyGesture?.source === "touch" && [...event.changedTouches].some(touch => touch.identifier === messageReplyGesture.touchId)) resetMessageReplyGesture();
}, {passive: true});
document.addEventListener("pointerdown", event => {
  if (event.pointerType === "touch" && messageReplyUsesTouchEvents) return;
  if (event.isPrimary === false || event.button !== 0) { resetMessageReplyGesture(); return; }
  beginMessageReplyGesture(event.target, event, "pointer", event.pointerId);
}, {passive: true});
document.addEventListener("pointermove", event => {
  const gesture = messageReplyGesture;
  if (!gesture || gesture.source !== "pointer" || event.pointerId !== gesture.pointerId) return;
  if (event.pointerType === "mouse" && event.buttons === 0) { resetMessageReplyGesture(); return; }
  moveMessageReplyGesture(gesture, event, event);
}, {passive: false});
document.addEventListener("pointerup", event => {
  const gesture = messageReplyGesture;
  if (gesture?.source === "pointer" && gesture.pointerId === event.pointerId) finishMessageReplyGesture(gesture, event);
}, {passive: true});
for (const type of ["pointercancel", "lostpointercapture"]) document.addEventListener(type, event => {
  if (messageReplyGesture?.source === "pointer" && messageReplyGesture.pointerId === event.pointerId) resetMessageReplyGesture();
}, {passive: true});
window.addEventListener("blur", () => resetMessageReplyGesture());
document.addEventListener("scroll", event => { if (messageReplyGesture && event.target.contains?.(messageReplyGesture.bubble)) resetMessageReplyGesture(); }, {capture: true, passive: true});

// Message actions use a stationary hold, leaving native vertical scrolling and
// the existing horizontal chat gesture untouched until the hold completes.
let messageHold = null;
let messageMenuTarget = null;
let messageInfoTarget = null;
let messageClickSuppression = null;
function cancelMessageHold() {
  if (messageHold) clearTimeout(messageHold.timer);
  messageHold = null;
}
function contextMessage(target) {
  if (!currentAuthUser || !target) return null;
  if (target.kind === "group") {
    if (!document.getElementById("chat").classList.contains("active") || !document.getElementById("chat").classList.contains("conversation-open")) return null;
    return messages.find(item => String(item.id) === target.id && String(item.channelId || "") === String(activeChatChannelId || "")) || null;
  }
  const peer = getMember(activePrivateMemberId);
  if (!peer || !document.getElementById("privados").classList.contains("active") || !document.getElementById("privados").classList.contains("conversation-open")) return null;
  return privateMessages.find(item => String(item.id) === target.id &&
    ((item.senderId === currentAuthUser.id && item.recipientId === peer.authId) ||
    (item.senderId === peer.authId && item.recipientId === currentAuthUser.id))) || null;
}
// One lifecycle for both long-press menus, including interrupted/repeated holds.
const chatMenuMotion = new WeakMap();
function isEditableAppTarget(target) {
  return target instanceof Element && (target.closest("input, textarea") || target.isContentEditable);
}
document.addEventListener("selectstart", event => {
  if (!isEditableAppTarget(event.target)) event.preventDefault();
});
document.addEventListener("contextmenu", event => {
  if (!isEditableAppTarget(event.target)) event.preventDefault();
});
const chatMenuFocus = new WeakMap();
function releaseChatMenuFocus(menu, immediate = false) {
  const focus = chatMenuFocus.get(menu);
  if (!focus) return;
  chatMenuFocus.delete(menu);
  focus.source.classList.remove("chat-menu-source-hidden");
  if (immediate || (globalThis.ClubMotion?.media || window.matchMedia("(prefers-reduced-motion: reduce)")).matches) {
    focus.layer.remove();
    return;
  }
  const fade = focus.layer.animate([{opacity: 1}, {opacity: 0}], {duration: 150, easing: "ease-out", fill: "forwards"});
  fade.onfinish = () => focus.layer.remove();
}
function focusChatMenuSource(menu, source) {
  releaseChatMenuFocus(menu, true);
  const rect = source.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.className = "chat-menu-focus-layer";
  layer.setAttribute("aria-hidden", "true");
  const preview = document.createElement("div");
  preview.className = "chat-menu-focus-preview";
  const clone = source.cloneNode(true);
  clone.querySelectorAll("img").forEach(image => { image.loading = "eager"; image.decoding = "async"; });
  // Freeze its appearance before leaving the conversation's layout/theme.
  const styleProperties = ["display", "color", "background", "font", "line-height", "letter-spacing", "text-align", "padding", "margin", "border", "border-radius", "box-shadow", "width", "height", "min-width", "max-width", "min-height", "max-height", "gap", "flex", "flex-direction", "align-items", "justify-content", "object-fit", "overflow", "white-space", "word-break", "overflow-wrap"];
  // Read the root once; descendants retain their CSS and inherit typography.
  // Copy theme variables so moving to the overlay keeps the conversation palette.
  const computed = getComputedStyle(source);
  for (const property of styleProperties) clone.style.setProperty(property, computed.getPropertyValue(property));
  for (let i = 0; i < computed.length; i++) {
    const property = computed[i];
    if (property.startsWith("--chat-")) clone.style.setProperty(property, computed.getPropertyValue(property));
  }
  const appearance = source.matches(".message-bubble") ? source.parentElement?.cloneNode(false) : null;
  if (appearance) appearance.removeAttribute("id");
  [clone, ...clone.querySelectorAll("[id], [tabindex], [autoplay], [data-message-bubble]")].forEach(copy => {
    for (const attribute of ["id", "tabindex", "autoplay", "data-message-bubble"]) copy.removeAttribute(attribute);
  });
  clone.style.margin = "0";
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.opacity = "1";
  const theme = source.closest("[data-chat-theme]");
  const themeWrapper = document.createElement("div");
  if (theme) { themeWrapper.className = "messages"; themeWrapper.dataset.chatTheme = theme.dataset.chatTheme; }
  themeWrapper.style.cssText = "display:block;margin:0;padding:0;background:transparent;overflow:visible;min-height:0;height:auto;width:100%;";
  if (appearance) { appearance.style.margin = "0"; appearance.append(clone); themeWrapper.append(appearance); }
  else themeWrapper.append(clone);
  preview.append(themeWrapper);
  layer.append(preview);
  document.body.append(layer);
  const viewport = window.visualViewport;
  const offsetLeft = viewport?.offsetLeft || 0, offsetTop = viewport?.offsetTop || 0;
  const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
  const scale = Math.min(1.025, (width - 32) / rect.width, Math.max(50, height - menu.offsetHeight - 44) / rect.height);
  const previewWidth = rect.width * scale, previewHeight = rect.height * scale;
  const left = Math.max(offsetLeft + 16, Math.min(rect.left - (previewWidth - rect.width) / 2, offsetLeft + width - previewWidth - 16));
  const top = Math.max(offsetTop + 16, Math.min(rect.top - 4, offsetTop + height - previewHeight - menu.offsetHeight - 28));
  preview.style.cssText = `left:${left}px;top:${top}px;width:${rect.width}px;height:${rect.height}px;transform:scale(${scale});transform-origin:top left;`;
  positionChatMenu(menu, Math.min(left + previewWidth - menu.offsetWidth, left), top + previewHeight);
  menu.style.transformOrigin = "top center";
  source.classList.add("chat-menu-source-hidden");
  chatMenuFocus.set(menu, {layer, source});
  if (!(globalThis.ClubMotion?.media || window.matchMedia("(prefers-reduced-motion: reduce)")).matches) {
    layer.animate([{opacity: 0}, {opacity: 1}], {duration: 220, easing: "ease-out"});
    preview.animate([
      {transform: "scale(1)", left: `${rect.left}px`, top: `${rect.top}px`},
      {transform: `scale(${scale})`, left: `${left}px`, top: `${top}px`}
    ], {duration: 300, easing: "cubic-bezier(.2,.75,.25,1)"});
  }
}
function animateChatMenu(menu, opening) {
  if (!menu || (!opening && menu.hidden)) return;
  const previous = chatMenuMotion.get(menu);
  if (!opening && menu.classList.contains("is-closing")) return;
  previous?.cancel();
  if (!opening) releaseChatMenuFocus(menu);
  menu.classList.toggle("is-closing", !opening);
  menu.setAttribute("aria-hidden", String(!opening));
  if (opening) {
    menu.hidden = false;
    if (!isEditableAppTarget(document.activeElement)) window.getSelection()?.removeAllRanges();
  }
  if ((globalThis.ClubMotion?.media || window.matchMedia("(prefers-reduced-motion: reduce)")).matches || !menu.animate) {
    menu.hidden = !opening;
    menu.classList.remove("is-closing");
    chatMenuMotion.delete(menu);
    return;
  }
  const animation = menu.animate(opening ? [
    {opacity: 0, transform: "translateY(-8px) scale(.84)"},
    {opacity: 1, transform: "translateY(1px) scale(1.015)", offset: .76},
    {opacity: 1, transform: "translateY(0) scale(1)"}
  ] : [
    {opacity: 1, transform: "translateY(0) scale(1)"},
    {opacity: 0, transform: "translateY(-4px) scale(.94)"}
  ], {duration: opening ? 300 : 150, easing: opening ? "cubic-bezier(.2,.75,.25,1)" : "ease-out", fill: "both"});
  chatMenuMotion.set(menu, animation);
  animation.onfinish = () => {
    if (chatMenuMotion.get(menu) !== animation) return;
    menu.hidden = !opening;
    menu.classList.remove("is-closing");
    chatMenuMotion.delete(menu);
    animation.cancel();
  };
}
function positionChatMenu(menu, x, y) {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
  const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
  const menuLeft = Math.max(left + 12, Math.min(x, left + width - menu.offsetWidth - 12));
  const menuTop = Math.max(top + 12, Math.min(y + 8, top + height - menu.offsetHeight - 12));
  menu.style.left = `${menuLeft}px`;
  menu.style.top = `${menuTop}px`;
  menu.style.transformOrigin = `${Math.max(12, Math.min(menu.offsetWidth - 12, x - menuLeft))}px ${y > menuTop ? "bottom" : "top"}`;
}
function closeMessageMenu(restoreFocus = false) {
  const target = messageMenuTarget;
  messageMenuTarget = null;
  const menu = document.getElementById("messageContextMenu");
  if (!menu || (!target && menu.hidden)) return;
  animateChatMenu(menu, false);
  if (!isEditableAppTarget(document.activeElement)) window.getSelection()?.removeAllRanges();
  if (target?.bubble?.isConnected && restoreFocus) target.bubble.focus({preventScroll: true});
  else if (menu.contains(document.activeElement) || document.activeElement === target?.bubble) document.activeElement.blur();
}
function closeMessageUI() {
  resetMessageReplyGesture();
  closeInboxContextMenu();
  for (const id of ["messageContextMenu", "inboxContextMenu"]) {
    const menu = document.getElementById(id);
    if (menu) releaseChatMenuFocus(menu, true);
  }
  closeChatImageViewer();
  cancelMessageHold(); closeMessageMenu(); messageClickSuppression = null;
  const dialog = document.getElementById("messageInfoDialog");
  if (dialog?.open) dialog.close();
  messageInfoTarget = null;
}
function reconcileMessageUI(kind) {
  if (chatImageTarget?.kind === kind) {
    const imageMessage = contextMessage(chatImageTarget);
    if (!imageMessage || chatImageSource(imageMessage.attachmentUrl) !== chatImageTarget.source) closeChatImageViewer();
  }
  if (messageHold?.bubble.dataset.messageKind === kind) cancelMessageHold();
  if (messageMenuTarget?.kind === kind) closeMessageMenu();
  if (messageInfoTarget?.kind === kind && !contextMessage(messageInfoTarget)) {
    document.getElementById("messageInfoDialog").close(); messageInfoTarget = null;
  }
}
function showMessageMenu(bubble, x, y) {
  resetMessageReplyGesture();
  cancelMessageHold();
  if (!bubble?.isConnected) return;
  const target = {kind: bubble.dataset.messageKind, id: bubble.dataset.messageId, bubble};
  const message = contextMessage(target);
  if (!message) return;
  resetChatBackGesture({settle: false});
  closeMessageMenu();
  const own = (target.kind === "group" ? message.userId : message.senderId) === currentAuthUser.id;
  const canDelete = own || (target.kind === "group" && canManageSite());
  const menu = document.getElementById("messageContextMenu");
  menu.innerHTML = `<span class="message-context-caption">Mensaje</span><button role="menuitem" type="button" data-message-action="reply">Responder</button><button role="menuitem" type="button" data-message-action="info"><span aria-hidden="true">ⓘ</span>Información</button>${own && (message.text || message.body) ? '<button role="menuitem" type="button" data-message-action="edit"><span aria-hidden="true">✎</span>Editar mensaje</button>' : ""}${canDelete ? '<button role="menuitem" type="button" class="danger" data-message-action="delete"><span aria-hidden="true">⌫</span>Eliminar mensaje</button>' : ""}`;
  messageMenuTarget = target; menu.hidden = false;
  positionChatMenu(menu, x, y);
  focusChatMenuSource(menu, bubble);
  animateChatMenu(menu, true);
  menu.querySelector("button")?.focus({preventScroll: true});
}
function showMessageInfo(target) {
  const message = contextMessage(target);
  if (!message) return;
  const author = target.kind === "group" ? getMember(message.member) : getMemberByAuthId(message.senderId);
  const peer = getMember(activePrivateMemberId);
  const channel = chatChannels.find(item => String(item.id) === String(message.channelId));
  const date = new Date(message.createdAt);
  const time = Number.isNaN(date.getTime()) ? "Fecha no disponible" : date.toLocaleString("es-ES", {dateStyle: "full", timeStyle: "short"});
  const attachment = message.attachmentUrl ? (message.attachmentType?.startsWith("image/") ? "Imagen" : message.attachmentType?.startsWith("audio/") ? "Audio" : message.attachmentType?.startsWith("video/") ? "Vídeo" : "Archivo") : "Texto";
  const rows = [["Autor", author?.name || "Miembro"], ["Enviado", time], ["Conversación", target.kind === "group" ? `Grupo${channel?.name ? " · " + channel.name : ""}` : `Chat con ${peer?.name || "miembro"}`], ["Contenido", attachment]];
  if (message.attachmentName) rows.push(["Archivo", message.attachmentName]);
  document.getElementById("messageInfoContent").innerHTML = `${getAvatar(author, "avatar message-info-avatar")}<dl>${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
  messageInfoTarget = target;
  document.getElementById("messageInfoDialog").showModal();
}
document.addEventListener("pointerdown", event => {
  // A new pointer press is a deliberate menu selection, unlike the click
  // synthesized when the original long press is released over the menu.
  if (messageClickSuppression && (messageClickSuppression.released || performance.now() >= messageClickSuppression.until)) messageClickSuppression = null;
  if (!event.target.closest("#messageContextMenu")) closeMessageMenu();
  cancelMessageHold();
  const bubble = event.target.closest("[data-message-bubble]");
  if (!bubble || event.button !== 0 || event.isPrimary === false || event.target.closest("audio, video, input, textarea, select")) return;
  const hold = {bubble, pointerId: event.pointerId, x: event.clientX, y: event.clientY, timer: null};
  messageHold = hold;
  hold.timer = setTimeout(() => {
    if (messageHold !== hold || !bubble.isConnected) return;
    messageClickSuppression = {bubble, released: false, until: performance.now() + 1500};
    showMessageMenu(bubble, hold.x, hold.y);
  }, 480);
}, {passive: true});
document.addEventListener("pointermove", event => {
  if (messageHold && event.pointerId === messageHold.pointerId && Math.hypot(event.clientX - messageHold.x, event.clientY - messageHold.y) > 11) cancelMessageHold();
}, {passive: true});
document.addEventListener("pointerup", () => {
  cancelMessageHold();
  if (messageClickSuppression) { messageClickSuppression.released = true; messageClickSuppression.until = performance.now() + 550; }
}, {passive: true});
document.addEventListener("pointercancel", () => {
  cancelMessageHold();
  if (messageClickSuppression) { messageClickSuppression.released = true; messageClickSuppression.until = performance.now() + 550; }
}, {passive: true});
document.addEventListener("scroll", () => { cancelMessageHold(); closeMessageMenu(); }, {capture: true, passive: true});
window.addEventListener("blur", closeMessageUI);
document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelActiveAudioRecording(); closeMessageUI(); } });
window.visualViewport?.addEventListener("resize", () => { cancelMessageHold(); closeMessageMenu(); });
document.addEventListener("click", event => {
  const suppressed = messageClickSuppression;
  if (suppressed && performance.now() < suppressed.until && suppressed.bubble.contains(event.target)) {
    messageClickSuppression = null; event.preventDefault(); event.stopImmediatePropagation();
  }
}, true);
document.addEventListener("contextmenu", event => {
  const bubble = event.target.closest("[data-message-bubble]");
  if (!bubble) return;
  event.preventDefault();
  if (messageMenuTarget?.bubble === bubble) return;
  const rect = bubble.getBoundingClientRect();
  showMessageMenu(bubble, event.clientX || rect.left + 20, event.clientY || rect.top + 20);
});
document.addEventListener("keydown", event => {
  const bubble = event.target.closest("[data-message-bubble]");
  if (bubble && event.target === bubble && (event.key === "Enter" || event.key === " " || event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
    event.preventDefault(); const rect = bubble.getBoundingClientRect(); showMessageMenu(bubble, rect.left + 20, rect.top + 20);
  }
  if (event.key === "Escape" && messageMenuTarget) { event.preventDefault(); closeMessageMenu(true); }
});
// Pointer taps leave messages at rest. Assistive activation still opens actions;
// physical keyboards are handled by the keydown listener above.
document.addEventListener("click", event => {
  const bubble = event.target.closest("[data-message-bubble]");
  if (event.detail !== 0 || !bubble || event.target !== bubble) return;
  const rect = bubble.getBoundingClientRect();
  showMessageMenu(bubble, rect.left + 20, rect.top + 20);
});

const conversationTimeFormatter = new Intl.DateTimeFormat("es-ES", {hour: "2-digit", minute: "2-digit"});
const inboxDateFormatter = new Intl.DateTimeFormat("es-ES", {day: "numeric", month: "short"});
const notificationDateFormatter = new Intl.DateTimeFormat("es-ES", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});

const conversationDayFormatter = new Intl.DateTimeFormat("es-ES", {day: "numeric", month: "long", year: "numeric"});
const messageDateFormatter = new Intl.DateTimeFormat("es-ES", {day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"});
// Bounded by timestamps, so repeated renders reuse parsing and locale strings
// without retaining whole messages or growing with a long-running session.
const chatDateCache = new Map();
function chatDate(value) {
  if (chatDateCache.has(value)) return chatDateCache.get(value);
  const date = new Date(value), timestamp = date.getTime();
  const metadata = {date, timestamp, day: Number.isFinite(timestamp) ? date.toDateString() : ""};
  if (chatDateCache.size >= 1024) chatDateCache.delete(chatDateCache.keys().next().value);
  chatDateCache.set(value, metadata);
  return metadata;
}
function messageTimestamp(message) {
  return message.createdTimestamp ?? chatDate(message.createdAt).timestamp;
}
function formatConversationTime(value) {
  const metadata = chatDate(value);
  return metadata.time ??= metadata.day ? conversationTimeFormatter.format(metadata.date) : "";
}

function conversationDayDivider(value, previousValue) {
  const metadata = chatDate(value);
  if (!metadata.day || (previousValue && metadata.day === chatDate(previousValue).day)) return "";
  // Keep "Hoy" dynamic across midnight; only the absolute date is cached.
  const label = metadata.day === new Date().toDateString() ? "Hoy"
    : (metadata.label ??= conversationDayFormatter.format(metadata.date));
  return `<div class="conversation-day-divider"><span>${escapeHtml(label)}</span></div>`;
}

function preserveConversationReading(container, key) {
  const sameConversation = container.dataset.conversationKey === key;
  const top = container.scrollTop;
  const follow = !sameConversation || container.scrollHeight - container.clientHeight - top < 100;
  container.dataset.conversationKey = key;
  return () => {
    if (follow) scrollConversationToLatest(container);
    else {
      container.dataset.latestScrollRequest = String((Number(container.dataset.latestScrollRequest) || 0) + 1);
      container.scrollTop = top;
    }
  };
}
const chatLatestScrollWork = new WeakMap();
function scrollConversationToLatest(container) {
  if (!container) return;
  // Realtime refreshes can happen before old delayed scrolls/media listeners
  // settle. Cancel that work instead of accumulating it over a long chat.
  chatLatestScrollWork.get(container)?.();
  const controller = new AbortController();
  const timers = [];
  let frame = 0;
  const cleanup = () => {
    controller.abort();
    if (frame) cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
  };
  chatLatestScrollWork.set(container, cleanup);
  const requestId = String((Number(container.dataset.latestScrollRequest) || 0) + 1);
  container.dataset.latestScrollRequest = requestId;
  const apply = () => {
    if (!container.isConnected || container.dataset.latestScrollRequest !== requestId || container.dataset.readerScrolled === requestId) return;
    container.scrollTop = container.scrollHeight;
  };
  if (container._stopLatestScroll) container.removeEventListener("scroll", container._stopLatestScroll);
  container._stopLatestScroll = () => {
    if (container.scrollHeight - container.clientHeight - container.scrollTop > 80) {
      container.dataset.readerScrolled = requestId;
      cleanup();
    }
  };
  container.addEventListener("scroll", container._stopLatestScroll, {passive: true, signal: controller.signal});
  apply();
  frame = requestAnimationFrame(() => { frame = 0; apply(); });
  timers.push(setTimeout(apply, 90));
  container.querySelectorAll("img, video, audio").forEach(media => {
    const image = media.tagName === "IMG";
    if (image ? media.complete : media.readyState >= 1) return;
    media.addEventListener(image ? "load" : "loadedmetadata", apply, {once: true, signal: controller.signal});
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
  globalThis.ClubDrafts?.begin("messageForm", `channel:${activeChatChannelId}`);
  const active = chatChannels.find(channel => String(channel.id) === String(activeChatChannelId));
  document.getElementById("activeChannelName").textContent = `# ${active?.name || "general"}`;
  const description = document.getElementById("activeChannelDescription");
  description.textContent = active?.description || ""; description.hidden = !active?.description;
  document.getElementById("editChatChannelButton").hidden = !canManageSite();
  container.innerHTML = chatChannels.map(channel => `
    <button class="chat-channel ${String(channel.id) === String(activeChatChannelId) ? "active" : ""}" type="button" data-chat-channel="${channel.id}">
      <span>#</span>${escapeHtml(channel.name)}
      ${canManageSite() && !channel.isDefault ? `<i data-delete-channel="${channel.id}" title="Eliminar sección">×</i>` : ""}
    </button>`).join("");
}

function selectChatChannel(id) {
  if (!chatChannels.some(channel => String(channel.id) === String(id))) return;
  if (String(activeChatChannelId) !== String(id)) cancelActiveAudioRecording();
  activeChatChannelId = id;
  renderChatChannels();
  renderMessages();
  globalThis.GroupInteractions?.mountPolls(document.getElementById("groupPolls"), activeChatChannelId);
  renderPrivateContacts();
  syncComposerState("group");
}

function setChatEnabled(enabled) {
  const readOnly = chatChannels.find(channel => String(channel.id) === String(activeChatChannelId))?.readOnly && !canManageSite();
  enabled = enabled && !readOnly;
  const input = document.getElementById("messageInput");
  const button = document.querySelector(".message-form .send-button");
  const attach = document.getElementById("attachMessageButton");
  const media = document.getElementById("attachMessageMediaButton");
  const camera = document.getElementById("captureMessageCameraButton");
  const audio = document.getElementById("recordGroupAudioButton");
  input.disabled = !enabled;
  button.disabled = !enabled || document.getElementById("messageForm").hasAttribute("data-sending");
  attach.disabled = !enabled;
  media.disabled = !enabled;
  camera.disabled = !enabled;
  audio.disabled = !enabled;
  input.placeholder = readOnly ? "Solo los administradores pueden publicar" : enabled ? "Mensaje..." : "El chat necesita conexión";
}

function renderPresence() {
  adminConsole?.refreshStats();
  const count = onlineUsers.length;
  const label = count === 1 ? "1 conectado" : `${count} conectados`;
  updateSurfaceMarkup(document.getElementById("chatOnlineStatus"), `<i></i> ${label}`);
  updateSurfaceMarkup(document.getElementById("heroOnlineStatus"), `<i></i> ${count ? `${label} ahora` : "Nadie conectado"}`);
  const panel = document.getElementById("onlineMembers");
  if (!panel) return;
  if (!count) {
    updateSurfaceMarkup(panel, `<div class="empty-state compact">Nadie conectado ahora.</div>`);
    return;
  }
  updateSurfaceMarkup(panel, onlineUsers.map(user => {
    const member = getMember(user.legacy_id);
    return `<div class="online-member">
      ${getAvatar(member)}
      <div><strong>${escapeHtml(member?.name || user.name || "Miembro")}</strong><small>En línea ahora</small></div><i></i>
    </div>`;
  }).join(""));
}

const chatThumbnailLoads = new WeakMap();
const chatThumbnailObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
    chatThumbnailObserver.unobserve(entry.target);
    startChatThumbnail(entry.target);
  }
}, {rootMargin: "300px"}) : null;
function startChatThumbnail(image) {
  if (!image?.isConnected) return;
  const previous = chatThumbnailLoads.get(image);
  if (previous) { clearTimeout(previous.timer); image.onload = image.onerror = null; }
  const button = image.closest(".message-image");
  const state = button.querySelector(".chat-image-state");
  button.classList.remove("image-failed");
  state.hidden = false; state.textContent = "Cargando imagen…";
  const load = {};
  chatThumbnailLoads.set(image, load);
  const finish = failed => {
    if (chatThumbnailLoads.get(image) !== load) return;
    clearTimeout(load.timer); image.onload = image.onerror = null;
    button.classList.toggle("image-failed", failed);
    state.hidden = !failed; state.textContent = "No se pudo cargar · Toca para reintentar";
    if (failed) image.removeAttribute("src");
  };
  image.onload = () => finish(false);
  image.onerror = () => finish(true);
  load.timer = setTimeout(() => finish(true), 15000);
  image.src = image.dataset.imageSource;
  if (image.complete && image.naturalWidth) finish(false);
}
const chatMarkupSnapshots = new WeakMap();
function setChatMessageMarkup(container, markup) {
  const previous = chatMarkupSnapshots.get(container);
  const intact = previous && previous.count === container.childNodes.length
    && previous.first === container.firstChild && previous.last === container.lastChild;
  if (intact && previous.markup === markup) return;
  // Realtime inserts normally extend the chronological transcript. Preserve live
  // audio/video, focus and decoded images instead of rebuilding the whole chat.
  if (intact && previous.markup && markup.startsWith(previous.markup)) {
    const template = document.createElement("template");
    template.innerHTML = markup.slice(previous.markup.length);
    const images = [...template.content.querySelectorAll("[data-chat-thumbnail]")];
    const incomingRows = [...template.content.querySelectorAll('.message')];
    const animateIncoming = incomingRows.length <= 3 && !document.hidden
      && container.closest('.page-section.active') && container.scrollHeight - container.scrollTop - container.clientHeight < 100
      && !(globalThis.ClubMotion?.media || matchMedia('(prefers-reduced-motion: reduce)')).matches;
    container.append(template.content);
    // Only live additions animate: reopening a conversation and syncing its
    // history must not replay the transcript or move its reading position.
    if (animateIncoming) for (const row of incomingRows) row.animate([
      {opacity:0, transform:'translateY(7px)'},
      {opacity:1, transform:'translateY(0)'}
    ], {duration:180, easing:'cubic-bezier(.22,1,.36,1)'});
    for (const image of images) {
      if (chatThumbnailObserver) chatThumbnailObserver.observe(image);
      else startChatThumbnail(image);
    }
    rememberChatMarkup(container, markup);
    return;
  }
  // Keep the actual image nodes and their requests alive while messages update.
  // Replacing a loading image on every realtime render can prevent it finishing.
  const retained = new Map();
  container.querySelectorAll("[data-chat-thumbnail]").forEach(image => {
    chatThumbnailObserver?.unobserve(image);
    const source = image.dataset.imageSource;
    const images = retained.get(source) || [];
    images.push(image);
    retained.set(source, images);
  });
  if (messageReplyGesture && container.contains(messageReplyGesture.bubble)) resetMessageReplyGesture();
  container.innerHTML = markup;
  container.querySelectorAll("[data-chat-thumbnail]").forEach(image => {
    const cached = retained.get(image.dataset.imageSource)?.shift();
    if (cached) {
      const button = cached.closest(".message-image");
      image.closest(".message-image").replaceWith(button);
      // An image outside the viewport may not have started yet.
      if (!cached.hasAttribute("src") && !button.classList.contains("image-failed")) {
        if (chatThumbnailObserver) chatThumbnailObserver.observe(cached);
        else startChatThumbnail(cached);
      }
    } else if (chatThumbnailObserver) chatThumbnailObserver.observe(image);
    else startChatThumbnail(image);
  });
  for (const images of retained.values()) for (const image of images) {
    const load = chatThumbnailLoads.get(image);
    if (load) clearTimeout(load.timer);
    chatThumbnailLoads.delete(image);
    image.onload = image.onerror = null;
    image.removeAttribute("src");
  }
  rememberChatMarkup(container, markup);
}

function rememberChatMarkup(container, markup) {
  chatMarkupSnapshots.set(container, {markup, count: container.childNodes.length,
    first: container.firstChild, last: container.lastChild});
}

function safeAttachmentUrl(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const url = new URL(value, location.href);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function renderMessageAttachment(message) {
  const attachmentUrl = safeAttachmentUrl(message.attachmentUrl);
  if (!attachmentUrl) {
    if (privateAttachmentPath(message.attachmentUrl)) void resolvePrivateAttachments();
    return `<span class="retired-content">Adjunto no disponible</span>`;
  }
  if (message.attachmentType === "text/news-link") {
    return `<a class="message-news-link" href="${escapeHtml(attachmentUrl)}" target="_blank" rel="noopener noreferrer"><span>NOTICIA</span><strong>${escapeHtml(message.attachmentName || "Abrir noticia")}</strong><small>Leer en la fuente →</small></a>`;
  }
  const sharedMedia = getSharedMediaReference(message);
  if (sharedMedia) return `<span class="retired-content">Contenido compartido ya no disponible</span>`;
  if (message.attachmentType?.startsWith("image/")) {
    const source = chatImageSource(attachmentUrl);
    if (!source) return `<span class="retired-content">Imagen no disponible</span>`;
    return `<button class="message-image" type="button" data-chat-image aria-label="Ampliar imagen adjunta"><img data-chat-thumbnail data-image-source="${escapeHtml(source)}" alt="${escapeHtml(message.attachmentName || "Imagen adjunta")}" decoding="async" draggable="false"><span class="chat-image-state">Cargando imagen…</span></button>`;
  }
  if (message.attachmentType?.startsWith("video/")) {
    return `<video class="message-video" src="${escapeHtml(attachmentUrl)}" controls preload="metadata"></video>`;
  }
  if (message.attachmentType?.startsWith("audio/")) {
    return renderVoiceNote(attachmentUrl);
  }
  return `<a class="message-file" href="${escapeHtml(attachmentUrl)}" target="_blank" rel="noopener" download>
    <span>↧</span><div><strong>${escapeHtml(message.attachmentName || "Archivo adjunto")}</strong><small>${formatFileSize(message.attachmentSize)}</small></div>
  </a>`;
}

let chatImageTarget = null;
let chatImageGeneration = 0;
let chatViewerLoadTimer = null;
function chatImageSource(value) {
  return safeAttachmentUrl(value);
}

function closeChatImageViewer() {
  const viewer = document.getElementById("chatImageViewer");
  if (viewer?.open) viewer.close();
  resetChatImageViewer();
}
function resetChatImageViewer() {
  const target = chatImageTarget; chatImageTarget = null; ++chatImageGeneration;
  clearTimeout(chatViewerLoadTimer); chatViewerLoadTimer = null;
  document.querySelector("#chatImageViewerStage img")?.removeAttribute("src");
  document.getElementById("chatImageViewerStage")?.replaceChildren();
  const status = document.getElementById("chatImageViewerStatus");
  if (status) status.hidden = true;
  if (target?.trigger?.isConnected) {
    if (target.restoreFocus) target.trigger.focus({preventScroll: true});
    else {
      target.trigger.blur();
      // WebKit may restore a dialog's previous focus after close(). Clear it
      // again after restoration, without moving focus away from another control.
      requestAnimationFrame(() => {
        if (!document.getElementById("chatImageViewer").open && document.activeElement === target.trigger) target.trigger.blur();
      });
    }
  }
  if (document.documentElement.dataset.inputModality === "pointer") {
    const focusedImage = document.activeElement?.closest("[data-chat-image]");
    focusedImage?.blur();
    if (!isEditableAppTarget(document.activeElement)) window.getSelection()?.removeAllRanges();
  }
}
function openChatImageViewer(trigger) {
  const bubble = trigger.closest("[data-message-bubble]");
  if (!bubble) return;
  const target = {kind: bubble.dataset.messageKind, id: bubble.dataset.messageId, trigger};
  const message = contextMessage(target);
  const source = message?.attachmentType?.startsWith("image/") && chatImageSource(message.attachmentUrl);
  if (!source) return;
  resetChatBackGesture({settle: false});
  cancelMessageHold(); closeMessageMenu();
  closeChatImageViewer();
  const generation = ++chatImageGeneration;
  chatImageTarget = {...target, source, restoreFocus: document.documentElement.dataset.inputModality !== "pointer"};
  const image = document.createElement("img");
  image.alt = message.attachmentName || "Imagen adjunta";
  image.className = "chat-viewer-image";
  image.draggable = false;
  image.decoding = "async";
  const status = document.getElementById("chatImageViewerStatus");
  status.textContent = "Cargando imagen…"; status.hidden = false;
  image.addEventListener("load", () => { if (generation === chatImageGeneration) { clearTimeout(chatViewerLoadTimer); status.hidden = true; } });
  image.addEventListener("error", () => {
    if (generation !== chatImageGeneration) return;
    clearTimeout(chatViewerLoadTimer);
    image.hidden = true; status.textContent = "No se pudo cargar la imagen. Cierra y vuelve a intentarlo."; status.hidden = false;
  });
  document.getElementById("chatImageViewerStage").replaceChildren(image);
  chatViewerLoadTimer = setTimeout(() => {
    if (generation !== chatImageGeneration) return;
    image.removeAttribute("src"); image.hidden = true;
    status.textContent = "La imagen está tardando demasiado. Cierra y vuelve a intentarlo."; status.hidden = false;
  }, 15000);
  image.src = source;
  const viewer = document.getElementById("chatImageViewer");
  viewer.showModal();
  document.getElementById("closeChatImageViewer").focus({preventScroll: true});
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
      <div class="voice-note-time"><span data-voice-remaining>--:--</span></div>
    </div>
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
  player.querySelector("[data-voice-remaining]").textContent = duration ? formatAudioClock(Math.max(0, duration - elapsed)) : "--:--";
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
  const metadata = chatDate(value);
  if (!metadata.day) return "";
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (metadata.day === now.toDateString()) return formatConversationTime(value);
  if (metadata.day === yesterday.toDateString()) return "Ayer";
  return metadata.inbox ??= inboxDateFormatter.format(metadata.date);
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
  if (menu) animateChatMenu(menu, false);
}

function showInboxContextMenu(contact, x, y) {
  if (!contact?.isConnected) return;
  const menu = document.getElementById("inboxContextMenu");
  const action = document.getElementById("inboxFavoriteAction");
  if (!menu || !action) return;
  if (menu.parentElement !== document.body) document.body.append(menu);
  const rect = contact.getBoundingClientRect();
  const favoriteId = contact.dataset.favoriteId;
  if (!favoriteId) return;
  menu.dataset.favoriteId = favoriteId;
  action.textContent = contact.dataset.favorite === "true" ? "Quitar de favoritos" : "Añadir a favoritos";
  menu.hidden = false;
  positionChatMenu(menu, x || rect.right - menu.offsetWidth, y || rect.bottom);
  focusChatMenuSource(menu, contact);
  animateChatMenu(menu, true);
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
  const latestGroupMessage = [...messages, ...calendarChatAnnouncements, ...channelAutomationMessages]
    .reduce((latest, message) => !latest || messageTimestamp(message) >= messageTimestamp(latest) ? message : latest, null);
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
    const aTime = a.latest ? messageTimestamp(a.latest) : 0;
    const bTime = b.latest ? messageTimestamp(b.latest) : 0;
    return bTime - aTime || a.member.name.localeCompare(b.member.name, "es");
  });
  const groupContact = `<button class="private-contact group-chat-contact ${document.getElementById("chat")?.classList.contains("conversation-open") ? "active" : ""}" type="button" data-open-group-chat data-kind="group" data-favorite-id="group" data-favorite="${userFavorites.has("group")}" data-search="Bigboys The Big Boy Rules grupo" data-conversation="true" data-unread="0" aria-description="Mantén pulsado para gestionar favoritos">
    ${groupAvatarMarkup()}
    <span class="private-contact-copy"><span><strong>Bigboys</strong>${latestGroupMessage ? `<time datetime="${escapeHtml(latestGroupMessage.createdAt)}">${formatInboxTime(latestGroupMessage.createdAt)}</time>` : ""}</span><small><span class="inbox-group-label">Grupo · </span>${latestGroupChannel ? `#${escapeHtml(latestGroupChannel.name)} · ` : ""}${escapeHtml(groupPreview)}</small></span>
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
  updateSurfaceMarkup(panel, `${groupContact}${privateContactsMarkup}`);
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
  const owner = currentAuthUser?.id;
  if (!owner) return;
  rememberInboxPosition();
  const member = getMember(memberId);
  if (!member || member.id === currentUser?.id) return;
  if (activePrivateMemberId !== member.id) cancelActiveAudioRecording();
  void resolvePrivateAttachments().then(refreshPrivateMessageSurfaces);
  await transitionMessageView(() => {
    if (owner !== currentAuthUser?.id) return;
    activePrivateMemberId = member.id;
    renderPrivateConversation();
    goTo("privados");
    scrollConversationToLatest(document.getElementById("privateMessages"));
    markVisibleConversationRead({includeHistory: true});
  });
}

function renderPrivateConversation() {
  globalThis.ClubDrafts?.begin("privateMessageForm", activePrivateMemberId == null ? null : `member:${activePrivateMemberId}`);
  reconcileMessageUI("private");
  renderChatReplyComposer("private");
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
    syncComposerState("private");
    globalThis.ChatThemes?.sync("private");
    return;
  }
  const privateHeader = document.getElementById("privateChatHeader");
  privateHeader.innerHTML = `
    <div class="private-chat-person">
      <button class="chat-back-button private-conversation-back" type="button" data-private-back aria-label="Volver a conversaciones"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button>
      <button type="button" class="private-chat-avatar" data-profile="${escapeHtml(String(member.id))}" aria-label="Ver perfil de ${escapeHtml(member.name)}">
        ${getAvatar(member)}
      </button>
      <div><h3>${escapeHtml(member.name)}</h3><span class="chat-username">@${escapeHtml(member.username)}</span></div>
    </div>`;
  globalThis.ChatThemes?.sync("private");
  const finishReading = preserveConversationReading(container, `private:${member.id}`);
  const items = privateMessages.filter(message =>
    (message.senderId === currentAuthUser?.id && message.recipientId === member.authId)
    || (message.senderId === member.authId && message.recipientId === currentAuthUser?.id));
  setChatMessageMarkup(container, items.length ? items.map((message, index) => {
    const own = message.senderId === currentAuthUser?.id;
    return `${conversationDayDivider(message.createdAt, items[index - 1]?.createdAt)}<div class="message private-message ${own ? "own own-message" : ""}">
      <div class="message-bubble" data-message-bubble data-message-kind="private" data-message-id="${escapeHtml(String(message.id))}" tabindex="0" role="button" aria-haspopup="menu" aria-label="Mensaje de ${escapeHtml(own ? currentUser?.name || "Tú" : member.name)}: ${escapeHtml(String(message.body || "Adjunto").slice(0, 160))}. Mantén pulsado para ver opciones">
        ${renderChatQuote("private", message)}
        ${message.body ? `<p>${escapeHtml(message.body)}</p>` : ""}
        ${message.attachmentUrl ? renderMessageAttachment(message) : ""}
        <div class="message-footer"><time class="private-message-time" datetime="${escapeHtml(message.createdAt)}" title="${escapeHtml(formatMessageDate(message.createdAt))}">${formatConversationTime(message.createdAt)}</time>
        </div>
      </div>
    </div>`;
  }).join("") : `<div class="empty-state"><strong>Sin mensajes todavía</strong><span>Esta conversación es privada entre ${escapeHtml(currentUser.name)} y ${escapeHtml(member.name)}.</span></div>`);
  input.disabled = false;
  submit.disabled = document.getElementById("privateMessageForm").hasAttribute("data-sending");
  attach.disabled = false;
  media.disabled = false;
  camera.disabled = false;
  audio.disabled = false;
  syncComposerState("private");
  finishReading();
}

function calendarEventMarkup(event, compact = false) {
  const date = new Date(event.startsAt);
  const birthday = event.eventType === "birthday";
  return `<article class="calendar-agenda-event ${birthday ? "birthday" : ""} ${compact ? "compact" : ""}">
    <time class="calendar-event-date" datetime="${escapeHtml(event.startsAt)}"><strong>${date.getDate()}</strong><span>${date.toLocaleDateString("es-ES", {month: "short"})}</span></time>
    <div class="calendar-event-copy"><span class="calendar-event-type">${birthday ? "Cumpleaños · Todo el día" : conversationTimeFormatter.format(date)}</span><h4>${escapeHtml(event.title)}</h4>${event.location ? `<p>${escapeHtml(event.location)}</p>` : ""}${!compact && event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}${!compact && !birthday && event.endsAt ? `<p>Hasta ${new Date(event.endsAt).toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"})}</p>` : ""}${canEditCalendarEvent(event) ? `<button type="button" class="calendar-edit-event" data-edit-calendar-event="${escapeHtml(event.id)}">Editar</button>` : ""}${!compact ? globalThis.GroupInteractions?.attendanceMarkup(event, activeCalendarDay) || "" : ""}</div>
  </article>`;
}

function renderCalendarSelectedDay() {
  const selectedDate = new Date(`${activeCalendarDay}T12:00:00`);
  const events = groupEvents.filter(event => eventOccursOn(event, selectedDate)).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  document.getElementById("calendarSelectedTitle").textContent = selectedDate.toLocaleDateString("es-ES", {weekday: "long", day: "numeric", month: "long"});
  document.getElementById("calendarDayCount").textContent = events.length ? `${events.length} ${events.length === 1 ? "plan" : "planes"}` : "Libre";
  document.getElementById("calendarSelectedEvents").innerHTML = events.length ? events.map(event => calendarEventMarkup(event)).join("") : `<div class="calendar-empty-day"><span aria-hidden="true">◇</span><strong>Un día por escribir.</strong><p>No hay planes ni cumpleaños para esta fecha.</p></div>`;
  void globalThis.GroupInteractions?.hydrateAttendance(document.getElementById("calendarSelectedEvents"));
  document.querySelectorAll("#calendarGrid [data-calendar-date]").forEach(cell => {
    const selected = cell.dataset.calendarDate === activeCalendarDay;
    cell.classList.toggle("selected", selected);
    cell.setAttribute("aria-pressed", String(selected));
  });
}

function renderCalendar() {
  adminConsole?.refreshStats();
  renderUpcomingEvents();
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  document.getElementById("calendarMonthTitle").textContent = calendarDate.toLocaleDateString("es-ES", {month: "long", year: "numeric"});
  const ownBirthday = groupEvents.find(event => event.eventType === "birthday" && event.createdBy === currentAuthUser?.id);
  const birthdayButton = document.getElementById("addBirthdayButton");
  birthdayButton.dataset.birthdayEventId = ownBirthday?.id || "";
  birthdayButton.textContent = ownBirthday ? "✦ Mi cumpleaños" : "✦ Añadir mi cumpleaños";
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayKey = dateKey(today);
  const selectedDate = activeCalendarDay ? new Date(`${activeCalendarDay}T12:00:00`) : null;
  if (!selectedDate || selectedDate.getMonth() !== month || selectedDate.getFullYear() !== year) activeCalendarDay = `${year}-${String(month + 1).padStart(2, "0")}-${String(today.getMonth() === month && today.getFullYear() === year ? today.getDate() : 1).padStart(2, "0")}`;
  let cells = ["L", "M", "X", "J", "V", "S", "D"].map(day => `<div class="calendar-weekday">${day}</div>`).join("");
  cells += Array.from({length: firstWeekday}, () => `<div class="calendar-day outside" aria-hidden="true"></div>`).join("");
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(year, month, day);
    const events = groupEvents.filter(event => eventOccursOn(event, date));
    const calendarKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells += `<button class="calendar-day ${dateKey(date) === todayKey ? "today" : ""} ${events.length ? "has-events" : ""}" type="button" data-calendar-date="${calendarKey}" ${dateKey(date) === todayKey ? 'aria-current="date"' : ""} aria-label="${day} de ${calendarDate.toLocaleDateString("es-ES", {month: "long"})}, ${events.length} eventos${events.length ? `: ${escapeHtml(events.map(event => event.title).join(", "))}` : ""}"><span class="calendar-day-number">${day}</span><span class="calendar-dots" aria-hidden="true">${events.slice(0, 3).map(event => `<i class="${event.eventType === "birthday" ? "birthday" : ""}"></i>`).join("")}</span></button>`;
  }
  cells += Array.from({length: (7 - ((firstWeekday + days) % 7)) % 7}, () => `<div class="calendar-day outside" aria-hidden="true"></div>`).join("");
  document.getElementById("calendarGrid").innerHTML = cells;
  const monthEvents = groupEvents.filter(event => {
    const date = new Date(event.startsAt);
    return date.getMonth() === month && (event.eventType === "birthday" || date.getFullYear() === year);
  }).sort((a, b) => new Date(a.startsAt).getDate() - new Date(b.startsAt).getDate());
  document.getElementById("calendarMonthCount").textContent = monthEvents.length;
  document.getElementById("calendarEventList").innerHTML = monthEvents.length ? monthEvents.map(event => calendarEventMarkup(event, true)).join("") : `<p class="calendar-month-empty">Todavía no hay fechas en la agenda.</p>`;
  renderCalendarSelectedDay();
}

// Calendar dates are compared as UTC day ordinals, avoiding 23/25-hour DST days.
function tigretonDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function tigretonDaysUntil(date, now = new Date()) {
  const ordinal = value => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  return Math.max(0, Math.round((ordinal(date) - ordinal(now)) / 86400000));
}
function tigretonFallback(event, date) {
  const title = String(event.title || "El próximo plan");
  const context = `${title} ${event.description || ""}`.toLowerCase();
  const place = event.location ? ` en ${event.location}` : "";
  if (event.eventType === "birthday") return `Se viene ${title}.`;
  if (/llamada|videollamada|videoconferencia|zoom|teams/.test(context)) return `${title}. Que no se nos pase la hora.`;
  if (/quedada|cena|comida|cerveza|salir|reunión|reunion/.test(context)) return `${title}${place}. Lo tengo fichado.`;
  return `${title}${place}, a las ${conversationTimeFormatter.format(date)}.`;
}
const tigretonComments = new Map();
const tigretonRequests = new Map();
const chotaRequestControllers = new Set();
function isChotaSleeping(now = new Date()) { return now.getHours() < 6; }
let chotaSleeping = isChotaSleeping();
let chotaSleepTimer = 0;
let chotaCommentSequence = 0;
let tigretonRenderedKey = "";
// One visible pet at a time: pause offscreen and cancel every timer on a rerender.
let tigretonMotion = null;
const tigretonReducedMotion = (globalThis.ClubMotion?.media || window.matchMedia("(prefers-reduced-motion: reduce)"));
// Decode optional animation sheets only when a pose needs them and editing is idle.
// Keep the resting pose while a shared request prepares the sheet.
const chotaTalkSprite = new Image();
const chotaPoseSprite = new Image();
let chotaSpritesRequest = null;
const chotaSpritesReady = {talk: false, poses: false};
function ensureChotaSprites() {
  if (!chotaSpritesRequest) {
    chotaSpritesRequest = new Promise(resolve => runWhenIdle(() => {
      chotaTalkSprite.src = "icons/mascot/chota-v2/chota-talk.webp";
      chotaPoseSprite.src = "icons/mascot/chota-v2/chota-poses.webp";
      Promise.allSettled([
        chotaTalkSprite.decode().then(() => { chotaSpritesReady.talk = chotaTalkSprite.naturalWidth > 0; }),
        chotaPoseSprite.decode().then(() => { chotaSpritesReady.poses = chotaPoseSprite.naturalWidth > 0; })
      ]).then(resolve);
    }));
  }
  return chotaSpritesRequest;
}
function mountTigretonMotion(reactToPlan, event, date) {
  tigretonMotion?.destroy();
  tigretonMotion = null;
  const pet = document.querySelector("#clubhouseContent .tigreton-agenda");
  if (!pet) return;
  tigretonMotion = createTigretonMotion(pet, reactToPlan, event, date);
  if (document.getElementById("chotaViewer")?.open) tigretonMotion.pause();
}
function createTigretonMotion(pet, reactToPlan, event, date) {
  const character = pet.querySelector(".tigreton-character");
  const shadow = pet.querySelector(".tigreton-shadow");
  const sleepMark = pet.querySelector(".tigreton-sleep-mark");
  const spark = pet.querySelector(".tigreton-spark");
  const isBirthday = event?.eventType === "birthday";
  const isToday = date && tigretonDaysUntil(date) === 0;
  const isCall = /llamada|videollamada|zoom|teams/.test(`${event?.title || ""} ${event?.description || ""}`.toLowerCase());
  const hour = new Date().getHours();
  const canDoze = !isToday && (hour >= 21 || hour < 8);
  const sequences = {
    greet: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [3, 2], [4, 2], [2, 2], [5, 2], [1, 2], [0, 3]],
    walk: [[0, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [0, 3]],
    jump: [[0, 2], [12, 1], [13, 2], [14, 1], [15, 2], [14, 1], [16, 2], [17, 2], [0, 3]],
    rest: [[0, 2], [18, 2], [19, 3], [20, 3], [21, 3], [22, 5], [23, 6], [22, 6], [23, 6], [22, 5], [21, 3], [20, 3], [19, 3], [18, 2], [0, 3]],
  };
  let inView = false, timer = 0, frameTimer = 0, animations = [], destroyed = false, lastGesture = "", paused = false, spriteRequest = 0;
  const active = () => !destroyed && !paused && inView && !document.hidden && !tigretonReducedMotion.matches && !isChotaSleeping();
  function setFrame(frame) {
    character.style.backgroundPosition = `${(frame % 6) * 20}% ${Math.floor(frame / 6) * (100 / 3)}%`;
  }
  function stop() {
    spriteRequest++;
    clearTimeout(timer);
    clearTimeout(frameTimer);
    animations.forEach(animation => animation.cancel());
    animations = [];
    pet.classList.remove("is-awake", "is-sleeping");
    character.classList.remove("is-speaking");
    setFrame(0);
  }
  function schedule() {
    clearTimeout(timer);
    if (!active()) return;
    timer = setTimeout(() => {
      const choices = ["greet", "greet", "walk"];
      if (isBirthday || (isToday && !isCall)) choices.push("jump");
      if (isCall) choices.push("greet");
      if (canDoze) choices.push("rest");
      const available = choices.filter(gesture => gesture !== lastGesture);
      play(available[Math.floor(Math.random() * available.length)]);
    }, 2800 + Math.random() * 5200);
  }
  function play(gesture) {
    if (!active()) return;
    if (!chotaSpritesReady.poses) {
      const request = ++spriteRequest;
      void ensureChotaSprites().then(() => { if (request === spriteRequest && active() && chotaSpritesReady.poses) play(gesture); });
      return;
    }
    stop();
    pet.classList.add("is-awake");
    const action = {look: "greet", nod: "greet", shuffle: "walk", celebrate: "jump", doze: "rest"}[gesture] || gesture;
    lastGesture = action;
    const frames = sequences[action] || sequences.greet;
    const duration = frames.reduce((total, [, ticks]) => total + ticks, 0) * (1000 / 12);
    if (action === "walk") {
      animations.push(character.animate([{transform: "translateX(-5%)"}, {transform: "translateX(6%)", offset: .5}, {transform: "translateX(0)"}], {duration, easing: "ease-in-out"}));
      animations.push(shadow.animate([{transform: "translateX(-5%)"}, {transform: "translateX(6%)", offset: .5}, {transform: "translateX(0)"}], {duration}));
    } else if (action === "jump") {
      animations.push(shadow.animate([{transform: "scaleX(1)", opacity: .6}, {transform: "scaleX(.65)", opacity: .3, offset: .48}, {transform: "scaleX(1)", opacity: .6}], {duration}));
      animations.push(spark.animate([{opacity: 0, transform: "scale(.6)"}, {opacity: 1, offset: .45}, {opacity: 0, transform: "scale(1.1)"}], {duration}));
    } else if (action === "rest") {
      animations.push(sleepMark.animate([{opacity: 0}, {opacity: .85, offset: .4}, {opacity: .85, offset: .72}, {opacity: 0}], {duration}));
    }
    let index = 0;
    function advance() {
      if (!active()) return;
      if (index >= frames.length) { stop(); schedule(); return; }
      const [frame, ticks] = frames[index++];
      setFrame(frame);
      frameTimer = setTimeout(advance, ticks * (1000 / 12));
    }
    advance();
  }
  function speak(text, gesture) {
    stop();
    if (!active() || !String(text || "").trim()) return;
    if (!chotaSpritesReady.talk) {
      const request = ++spriteRequest;
      void ensureChotaSprites().then(() => { if (request === spriteRequest && active() && chotaSpritesReady.talk) speak(text, gesture); });
      return;
    }
    pet.classList.add("is-awake");
    character.classList.add("is-speaking");
    const words = String(text).trim().split(/\s+/);
    const duration = Math.min(3600, Math.max(1400, words.length * 175));
    const started = performance.now();
    const mouths = [0, 1, 2, 1, 0, 2, 1];
    let beat = 0;
    function advanceSpeech() {
      if (!active()) { stop(); return; }
      const elapsed = performance.now() - started;
      if (elapsed >= duration) {
        stop();
        if (gesture) play(gesture); else schedule();
        return;
      }
      const word = words[Math.min(words.length - 1, Math.floor(elapsed / duration * words.length))];
      const punctuation = /[.,;:!?]$/.test(word) && beat % 3 === 2;
      const mouth = punctuation ? 0 : mouths[beat++ % mouths.length];
      character.style.backgroundPosition = `${mouth * 50}% 0`;
      frameTimer = setTimeout(advanceSpeech, punctuation ? 220 : 95 + (beat % 3) * 25);
    }
    advanceSpeech();
  }
  function refresh() {
    stop();
    if (!destroyed && isChotaSleeping()) {
      // Hold the fully reclined frame, including with reduced motion enabled.
      pet.classList.add("is-sleeping");
      setFrame(22);
      return;
    }
    if (active()) { pet.classList.add("is-awake"); schedule(); }
  }
  const observer = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    refresh();
    if (inView && reactToPlan) { reactToPlan = false; play(isBirthday || (isToday && !isCall) ? "jump" : "greet"); }
  }, {threshold: .25});
  observer.observe(pet);
  refresh();
  document.addEventListener("visibilitychange", refresh);
  tigretonReducedMotion.addEventListener("change", refresh);
  return {
    play,
    speak,
    refresh,
    stopSpeaking: refresh,
    pause() { paused = true; refresh(); },
    resume() { paused = false; refresh(); },
    react: () => play(isBirthday && isToday ? "jump" : "greet"),
    destroy() { destroyed = true; stop(); observer.disconnect(); document.removeEventListener("visibilitychange", refresh); tigretonReducedMotion.removeEventListener("change", refresh); },
  };
}
function tigretonSpriteMarkup(interactive = false) {
  const tag = interactive ? "button" : "span";
  return `<${tag} class="tigreton-sprite" ${interactive ? 'type="button" data-chota-open aria-label="Mostrar comentario de El Chota sobre el próximo plan" aria-expanded="false" aria-keyshortcuts="Shift+Enter"' : 'role="img" aria-label="El Chota"'}><span class="tigreton-character" aria-hidden="true"></span><i class="tigreton-shadow" aria-hidden="true"></i><span class="tigreton-sleep-mark" aria-hidden="true">z</span><span class="tigreton-spark" aria-hidden="true">✦</span></${tag}>`;
}
let chotaViewerMotion = null;
let chotaViewerMotionKey = "";
let chotaViewerTrigger = null;
function showChotaCommentLoading(bubble) {
  bubble.setAttribute("aria-busy", "true");
  bubble.innerHTML = '<span class="chota-loading-label">El Chota está pensando</span><span class="chota-loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
  bubble.hidden = false;
}
function showChotaCommentResult(bubble, comment) {
  const text = document.createElement("span");
  text.className = bubble.classList.contains("chota-viewer-status") ? "chota-viewer-comment" : "tigreton-comment";
  text.textContent = comment;
  bubble.replaceChildren(text);
  bubble.setAttribute("aria-busy", "false");
}
function openChotaViewer(trigger) {
  if (isChotaSleeping()) return;
  const next = chotaRoomContext();
  let viewer = document.getElementById("chotaViewer");
  if (!viewer) {
    viewer = document.createElement("dialog");
    viewer.id = "chotaViewer";
    viewer.className = "chota-viewer";
    viewer.setAttribute("aria-labelledby", "chotaViewerTitle");
    viewer.setAttribute("aria-modal", "true");
    document.body.append(viewer);
    viewer.addEventListener("click", event => {
      if (event.target === viewer) { viewer.close(); return; }
      if (event.target.closest("[data-chota-close]")) viewer.close();
      const action = event.target.closest("[data-chota-action]");
      if (action && !isChotaSleeping()) {
        const next = chotaRoomContext();
        const status = viewer.querySelector(".chota-viewer-status");
        if (next) {
          const contextKey = tigretonContextKey(next.event, next.date);
          const actionName = action.dataset.chotaAction;
          const requestKey = String(++chotaCommentSequence);
          viewer.dataset.requestKey = requestKey;
          showChotaCommentLoading(status);
          chotaViewerMotion?.stopSpeaking();
          chotaViewerMotion?.play(actionName);
          void loadTigretonComment(next.event, next.date, contextKey, actionName).then(result => {
            if (isChotaSleeping() || !viewer.open || viewer.dataset.contextKey !== contextKey || viewer.dataset.requestKey !== requestKey || tigretonRenderedKey !== contextKey) return;
            showChotaCommentResult(status, result.comment);
            chotaViewerMotion?.speak(result.comment, actionName);
          });
        }
      }
    });
    viewer.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); viewer.close(); return; }
      if (event.key !== "Tab") return;
      const buttons = [...viewer.querySelectorAll("button:not([disabled])")];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    viewer.addEventListener("close", () => {
      document.body.classList.remove("chota-viewer-open");
      document.querySelector("main.app")?.removeAttribute("aria-hidden");
      delete viewer.dataset.requestKey;
      chotaViewerMotion?.pause();
      tigretonMotion?.resume();
      const focusTarget = chotaViewerTrigger?.isConnected ? chotaViewerTrigger : document.querySelector("[data-chota-open]");
      focusTarget?.focus({preventScroll: true});
      chotaViewerTrigger = null;
    });
  }
  if (viewer.open) return;
  const key = tigretonContextKey(next.event, next.date);
  viewer.dataset.contextKey = key;
  delete viewer.dataset.requestKey;
  if (!viewer.children.length) viewer.innerHTML = `<header class="chota-viewer-heading"><div><small>LA SEDE DEL CLUB</small><h2 id="chotaViewerTitle">El Chota</h2></div><button type="button" data-chota-close aria-label="Cerrar">×</button></header>
    <p class="chota-viewer-plan">${escapeHtml(next.event.title)}</p>
    <div class="chota-viewer-room-scene">
    <img class="chota-viewer-room-art" src="icons/clubhouse/club-room-v1.webp" width="1024" height="1024" alt="" aria-hidden="true" decoding="async">
    <div class="tigreton-agenda chota-viewer-pet">
    <div class="chota-viewer-bubble-slot"><div class="tigreton-bubble chota-viewer-status" role="status" aria-live="polite" aria-atomic="true" hidden></div></div>
    <div class="chota-character-row"><button class="chota-viewer-touch" type="button" data-chota-action="nod" aria-label="Tocar a El Chota">${tigretonSpriteMarkup()}</button></div></div></div>
    <div class="chota-viewer-actions"><button type="button" data-chota-action="nod" >Saludar</button><button type="button" data-chota-action="shuffle">Pasitos</button><button type="button" data-chota-action="celebrate">Celebrar</button><button type="button" data-chota-action="doze">Descansar</button></div>`;
  viewer.querySelector(".chota-viewer-plan").textContent = next.event.title;
  viewer.querySelector(".chota-viewer-status").hidden = true;
  chotaViewerTrigger = trigger;
  tigretonMotion?.pause();
  document.body.classList.add("chota-viewer-open");
  viewer.show();
  document.querySelector("main.app")?.setAttribute("aria-hidden", "true");
  if (!chotaViewerMotion || chotaViewerMotionKey !== key) {
    chotaViewerMotion?.destroy();
    chotaViewerMotion = createTigretonMotion(viewer.querySelector(".tigreton-agenda"), false, next.event, next.date);
    chotaViewerMotionKey = key;
  } else chotaViewerMotion.resume();
  viewer.querySelector("[data-chota-close]").focus({preventScroll: true});
}
// A tap shows an agenda comment; releasing a held mascot opens its separate scene.
function showChotaAgendaComment(trigger) {
  if (isChotaSleeping()) return;
  const next = chotaRoomContext();
  const bubble = trigger.closest(".clubhouse-room, .club-event-with-tigreton")?.querySelector(".tigreton-bubble");
  if (!next || !bubble) return;
  if (trigger.getAttribute("aria-expanded") === "true") {
    delete trigger.dataset.commentRequest;
    bubble.hidden = true;
    bubble.setAttribute("aria-busy", "false");
    trigger.setAttribute("aria-expanded", "false");
    tigretonMotion?.stopSpeaking();
    return;
  }
  const requestKey = String(++chotaCommentSequence);
  trigger.dataset.commentRequest = requestKey;
  trigger.setAttribute("aria-expanded", "true");
  showChotaCommentLoading(bubble);
  const key = tigretonContextKey(next.event, next.date);
  void loadTigretonComment(next.event, next.date, key).then(result => {
    if (isChotaSleeping() || !trigger.isConnected || trigger.dataset.commentRequest !== requestKey || tigretonRenderedKey !== key || trigger.getAttribute("aria-expanded") !== "true") return;
    showChotaCommentResult(bubble, result.comment);
    tigretonMotion?.speak(result.comment);
  });
}
function chotaActionComment(action, event, date) {
  const title = String(event.title || "el próximo plan");
  const days = tigretonDaysUntil(date);
  const when = days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`;
  const place = event.location ? ` en ${event.location}` : "";
  const birthday = event.eventType === "birthday";
  const call = /llamada|videollamada|videoconferencia|zoom|teams/.test(`${title} ${event.description || ""}`.toLowerCase());
  const time = conversationTimeFormatter.format(date);
  if (action === "shuffle") return call ? `${title}, ${when} a las ${time}. Doy una vuelta antes de conectarme.` : `${title}${place}, ${when}. Voy calentando las piernas para llegar.`;
  if (action === "celebrate") return birthday ? `${title} es ${when}. ¡Eso merece unos saltos!` : call ? `Tenemos ${title} ${when} a las ${time}. ¡Vamos con todo!` : `¡${title}${place} ${when}! Ya hay ganas.`;
  if (action === "doze") return days === 0 ? `${title} es hoy${call ? ` a las ${time}` : ""}. Una cabezadita corta y me levanto.` : `Descanso un rato; ${title} llega ${when}${place}.`;
  return birthday ? `Ey, ${title} es ${when}. Hay que acordarse de felicitar.` : call ? `Ey, ${title} ${when}, a las ${time}. Lo tengo apuntado.` : `Ey, nos vemos para ${title}${place} ${when}.`;
}
const CHOTA_HOLD_MS = 650;
let chotaPress = null;
let chotaClickSuppression = null;
function suppressChotaClick(target) {
  // Bound suppression so a cancelled gesture cannot swallow a later activation.
  chotaClickSuppression = {target, until: performance.now() + 800};
}
function cancelChotaPress(suppressClick = false) {
  const press = chotaPress;
  chotaPress = null;
  if (!press) return;
  clearTimeout(press.holdTimer);
  press.target.classList.remove("chota-hold-ready");
  if (suppressClick) suppressChotaClick(press.target);
  if (press.target.hasPointerCapture(press.pointerId)) press.target.releasePointerCapture(press.pointerId);
}
document.addEventListener("pointerdown", event => {
  if (!event.isPrimary) { cancelChotaPress(true); return; }
  const target = event.target.closest("[data-chota-open]");
  if (!target || event.button !== 0) return;
  if (isChotaSleeping()) { cancelChotaPress(true); return; }
  cancelChotaPress(true);
  chotaClickSuppression = null;
  chotaPress = {target, x: event.clientX, y: event.clientY, pointerId: event.pointerId, started: event.timeStamp, armed: false, holdTimer: 0};
  const press = chotaPress;
  press.holdTimer = setTimeout(() => {
    if (isChotaSleeping() || chotaPress !== press || document.hidden) return;
    press.armed = true;
    target.classList.add("chota-hold-ready");
  }, CHOTA_HOLD_MS);
  // Capture the release without disabling native vertical scrolling.
  target.setPointerCapture(event.pointerId);
});
document.addEventListener("pointermove", event => {
  if (chotaPress && event.pointerId === chotaPress.pointerId && Math.hypot(event.clientX - chotaPress.x, event.clientY - chotaPress.y) > 10) cancelChotaPress(true);
}, {passive: true});
document.addEventListener("pointerup", event => {
  const press = chotaPress;
  if (!press || event.pointerId !== press.pointerId) return;
  const held = press.armed && event.timeStamp - press.started >= CHOTA_HOLD_MS;
  const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10;
  cancelChotaPress(held || moved);
  if (isChotaSleeping() || !held || moved || !press.target.isConnected || document.hidden) return;
  // Opening only after release avoids moving the active touch into a modal.
  event.preventDefault();
  openChotaViewer(press.target);
});
["pointercancel", "lostpointercapture"].forEach(type => document.addEventListener(type, event => {
  if (chotaPress?.pointerId === event.pointerId) cancelChotaPress(true);
}));
document.addEventListener("scroll", () => cancelChotaPress(true), {capture: true, passive: true});
document.addEventListener("visibilitychange", () => { if (document.hidden) cancelChotaPress(true); });
document.addEventListener("click", event => {
  const target = event.target.closest("[data-chota-open]");
  if (event.detail !== 0 && target && chotaClickSuppression?.target === target && performance.now() <= chotaClickSuppression.until) {
    event.preventDefault(); event.stopImmediatePropagation(); chotaClickSuppression = null;
  }
}, true);
document.addEventListener("contextmenu", event => {
  if (event.target.closest("[data-chota-open]")) event.preventDefault();
});
document.addEventListener("keydown", event => {
  const target = event.target.closest("[data-chota-open]");
  if (target && ((event.shiftKey && event.key === "Enter") || event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
    event.preventDefault();
    if (!event.repeat) { cancelChotaPress(true); openChotaViewer(target); }
  }
});
window.addEventListener("blur", () => cancelChotaPress(true));

function tigretonContextKey(event, date) {
  return JSON.stringify([currentAuthUser?.id || "", tigretonDayKey(), tigretonDayKey(date), event.id, event.title, event.description, event.startsAt, event.endsAt, event.location, event.eventType]);
}
async function loadTigretonComment(event, date, contextKey, action = "agenda") {
  if (isChotaSleeping()) return {comment: "", source: "agenda"};
  const key = action === "agenda" ? contextKey : JSON.stringify([contextKey, action]);
  const fallback = () => ({comment: action === "agenda" ? tigretonFallback(event, date) : chotaActionComment(action, event, date), source: "agenda"});
  if (event.eventType === "clubhouse") return {comment: action === "agenda" ? "La agenda está libre. Por aquí me quedo hasta el próximo plan." : ({nod: "Ey, ya estás por casa.", shuffle: "Voy a estirar las piernas un rato.", celebrate: "¡Así se entra en la sede!", doze: "Me quedo descansando por aquí."}[action] || "Ey, ya estás por casa."), source: "agenda"};
  if (!db || !currentAuthUser) return fallback();
  // Share an in-flight call, but never pin one AI sentence for the entire day.
  if (tigretonRequests.has(key)) return tigretonRequests.get(key);
  const previous = tigretonComments.get(key);
  if (previous?.source === "ai" && Date.now() - previous.savedAt < 45000) return previous;
  const variation = previous ? (previous.variation + 1) % 12 : Math.floor(Math.random() * 12);
  const request = (async () => {
    const controller = new AbortController();
    chotaRequestControllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const {data, error} = await db.functions.invoke("tigreton-agenda", {
        body: {eventId: event.id, action, variation, previousComment: previous?.comment || "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid"},
        signal: controller.signal,
      });
      const comment = !error && typeof data?.comment === "string" ? data.comment.replace(/[<>]/g, "").trim().slice(0, 160) : "";
      const result = comment ? {comment, source: data.source === "ai" ? "ai" : "agenda"} : fallback();
      tigretonComments.set(key, {...result, variation, savedAt: Date.now()});
      return result;
    } catch {
      return fallback();
    } finally {
      clearTimeout(timeout);
      chotaRequestControllers.delete(controller);
      tigretonRequests.delete(key);
    }
  })();
  tigretonRequests.set(key, request);
  return request;
}
// The room reads the agenda already in memory; it never adds a startup request.
let clubhouseObserver = null;
function chotaRoomContext() {
  return ClubModel.upcomingEvents(groupEvents)[0] || {event: {id: "clubhouse-idle", title: "La agenda está libre", eventType: "clubhouse"}, date: new Date()};
}
function renderClubhouse(upcoming) {
  const content = document.getElementById("clubhouseContent");
  if (!content) return;
  clubhouseObserver?.disconnect();
  const next = upcoming[0];
  const birthday = next?.event.eventType === "birthday";
  const hour = new Date().getHours();
  const moment = hour < 7 || hour >= 22 ? "night" : hour < 19 ? "day" : "evening";
  const time = document.getElementById("clubhouseTime");
  if (time) time.textContent = moment === "night" ? "Una noche en la sede" : moment === "day" ? "Hoy en la sede" : "Cae la tarde";
  const days = next ? tigretonDaysUntil(next.date) : 0;
  const countdown = !next ? "" : days === 0 ? "Es hoy" : days === 1 ? "Mañana" : `En ${days} días`;
  const date = next ? next.date.toLocaleDateString("es-ES", {day: "numeric", month: "short"}).replace(".", "") : "";
  const schedule = next ? (birthday ? "Cumpleaños" : conversationTimeFormatter.format(next.date)) : "";
  const plan = next ? `<button class="clubhouse-plan" type="button" data-calendar-date="${tigretonDayKey(next.date)}" aria-label="Ver plan: ${escapeHtml(next.event.title)}"><span class="clubhouse-note-label">Próximo plan</span><strong>${escapeHtml(next.event.title)}</strong><span class="clubhouse-plan-date">${escapeHtml(date)} · ${escapeHtml(schedule)}</span><span class="clubhouse-plan-countdown">${countdown}</span></button>` : `<div class="clubhouse-plan clubhouse-plan-empty"><span class="clubhouse-note-label">La agenda</span><strong>${homeEventsReady ? "El próximo plan está por llegar" : "Consultando la agenda…"}</strong>${homeEventsReady ? '<button type="button" data-go="calendario">Ver calendario</button>' : ""}</div>`;
  content.innerHTML = `<div class="clubhouse-room${birthday ? " is-birthday" : ""}" data-time="${moment}">
    <img class="clubhouse-art" src="icons/clubhouse/club-room-v1.webp" width="1024" height="1024" alt="La sede de Big Boy, una habitación con un tablón, una foto y una alfombra donde está El Chota" decoding="async" fetchpriority="low">
    <div class="clubhouse-lamplight" aria-hidden="true"></div><div class="clubhouse-dust" aria-hidden="true"><i></i><i></i><i></i></div>
    ${birthday ? '<div class="clubhouse-bunting" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>' : ""}
    ${plan}
    <div class="clubhouse-memory"><span class="clubhouse-memory-label">Recuerdos del club</span><svg viewBox="0 0 40 32" aria-hidden="true"><path d="M4 8h8l3-5h10l3 5h8v21H4z"/><circle cx="20" cy="18" r="7"/></svg><strong>Aún no hay recuerdos compartidos</strong><span>Este sitio será para vuestra próxima foto.</span></div>
    <div class="tigreton-agenda clubhouse-pet"><span class="chota-character-row">${tigretonSpriteMarkup(true)}</span><small class="tigreton-name">El Chota</small><button type="button" class="chota-expand" data-chota-expand aria-label="Ver a El Chota en pantalla completa"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M3 3l7 7M16 21h5v-5m0 5-7-7M16 3h5v5m0-5-7 7M8 21H3v-5m0 5 7-7"/></svg></button></div>
    <div class="tigreton-bubble clubhouse-bubble" hidden role="status" aria-live="polite" aria-atomic="true"></div>
  </div>`;
  const room = content.firstElementChild;
  clubhouseObserver = new IntersectionObserver(entries => room.classList.toggle("is-in-view", entries[0].isIntersecting), {threshold: .15});
  clubhouseObserver.observe(room);
  syncChotaSleepControls();
}
function syncChotaSleepControls() {
  const sleeping = isChotaSleeping();
  document.querySelectorAll("[data-chota-open], [data-chota-expand], [data-chota-action]").forEach(button => {
    button.disabled = sleeping;
    button.setAttribute("aria-disabled", String(sleeping));
    if (button.matches("[data-chota-open]")) {
      button.setAttribute("aria-label", sleeping ? "El Chota está durmiendo hasta las 06:00" : "Mostrar comentario de El Chota sobre el próximo plan");
      if (sleeping) { delete button.dataset.commentRequest; button.setAttribute("aria-expanded", "false"); }
    }
    if (button.matches("[data-chota-expand]")) button.hidden = sleeping;
  });
  document.querySelector("#clubhouseContent .clubhouse-room")?.classList.toggle("is-sleeping", sleeping);
  if (sleeping) {
    document.querySelectorAll(".clubhouse-bubble, .chota-viewer-status").forEach(bubble => { bubble.hidden = true; bubble.setAttribute("aria-busy", "false"); });
  }
}
function refreshChotaSleepSchedule() {
  clearTimeout(chotaSleepTimer);
  const now = new Date();
  const sleeping = isChotaSleeping(now);
  if (sleeping !== chotaSleeping) {
    chotaSleeping = sleeping;
    cancelChotaPress(true);
    if (sleeping) {
      chotaRequestControllers.forEach(controller => controller.abort());
      const viewer = document.getElementById("chotaViewer");
      if (viewer?.open) viewer.close();
    }
    syncChotaSleepControls();
    tigretonMotion?.refresh();
    chotaViewerMotion?.refresh();
  }
  // One boundary timeout; the existing foreground check also catches clock changes.
  const boundary = new Date(now);
  if (sleeping) boundary.setHours(6, 0, 0, 0);
  else { boundary.setDate(boundary.getDate() + 1); boundary.setHours(0, 0, 0, 0); }
  chotaSleepTimer = setTimeout(refreshChotaSleepSchedule, Math.max(100, boundary.getTime() - now.getTime()));
}
function renderUpcomingEvents() {
  cancelChotaPress(true);
  const upcoming = ClubModel.upcomingEvents(groupEvents);
  const previousPlanKey = tigretonRenderedKey;
  const context = chotaRoomContext();
  tigretonRenderedKey = tigretonContextKey(context.event, context.date);
  renderClubhouse(upcoming);
  const viewer = document.getElementById("chotaViewer");
  if (viewer?.open && viewer.dataset.contextKey !== tigretonRenderedKey) viewer.close();
  mountTigretonMotion(previousPlanKey !== tigretonRenderedKey, context.event, context.date);
  if (homeEventsReady && upcoming.length && previousPlanKey !== tigretonRenderedKey && currentAuthUser) {
    const expected = tigretonRenderedKey, first = upcoming[0];
    const warm = () => { if (!document.hidden && expected === tigretonRenderedKey && !tigretonComments.has(expected)) void loadTigretonComment(first.event, first.date, expected); };
    if (window.requestIdleCallback) requestIdleCallback(warm,{timeout:2500}); else setTimeout(warm,900);
  }
}

let tigretonLastDay = tigretonDayKey();
function refreshTigretonDay() {
  const today = tigretonDayKey();
  if (today === tigretonLastDay) return;
  tigretonLastDay = today;
  tigretonComments.clear();
  renderUpcomingEvents();
  void loadCalendarChatAnnouncements();
}
refreshChotaSleepSchedule();
setInterval(() => { if (!document.hidden) { refreshChotaSleepSchedule(); refreshTigretonDay(); renderGroupChatEventNotice(); } }, 30000);
window.addEventListener("focus", refreshChotaSleepSchedule);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { refreshChotaSleepSchedule(); refreshTigretonDay(); renderGroupChatEventNotice(); if (currentAuthUser && backendReady) { void loadCalendarChatAnnouncements(); void loadChannelAutomations({visit: true}); } } });

let activeCalendarDay = null;

function openCalendarDay(dateValue) {
  const [year, month, day] = String(dateValue).split("-").map(Number);
  if (!year || !month || !day) return;
  activeCalendarDay = dateValue;
  if (document.getElementById("calendario").classList.contains("active")) {
    renderCalendarSelectedDay();
    return;
  }
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
      ${canEditCalendarEvent(event) ? `<button class="secondary-button" type="button" data-edit-calendar-event="${event.id}">Editar</button>` : ""}
      ${globalThis.GroupInteractions?.attendanceMarkup(event, dateValue) || ""}
    </article>`).join("") : `<div class="empty-state compact"><strong>No hay nada programado</strong><span>Este día no tiene eventos ni cumpleaños.</span></div>`;
  void globalThis.GroupInteractions?.hydrateAttendance(document.getElementById("calendarDayDetailList"));
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

const accountRequests = globalThis.ClubAccountRequests?.create({client: db, canManage: canManageSite, owner: () => currentAuthUser?.id});

const adminConsole = globalThis.AdminConsole?.create({
  allowed: isSuperAdmin,
  rpc: (name, args) => db.rpc(name, args),
  refreshShop: () => globalThis.BannerShop?.refresh(true),
  owner: () => currentAuthUser?.id,
  username: () => currentUser?.username || "admin",
  settings: () => siteSettings,
  ready: () => homeSettingsReady && Boolean(currentAuthUser?.id),
  stats: () => ({
    members: members.filter(member => !member.hidden).length,
    online: onlineUsers.length,
    admins: members.filter(member => !member.hidden && member.roleKey === "admin").length,
    events: groupEvents.filter(event => event.eventType !== "birthday" && new Date(event.endsAt || event.startsAt) >= new Date()).length,
  }),
  navigate: goTo,
  reload: loadSiteSettings,
  logout: logoutCurrentUser,
  save: async (key, value) => {
    if (!isSuperAdmin() || !currentAuthUser || key !== "club_presentation_v1") throw new Error("Acceso no autorizado");
    const owner = currentAuthUser.id;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const {error} = await db.from("site_settings").upsert({key, value, updated_by: owner, updated_at: new Date().toISOString()}).abortSignal(controller.signal);
      if (error) throw error;
    } finally { clearTimeout(timeout); }
    if (currentAuthUser?.id !== owner || !isSuperAdmin()) return;
    siteSettings = {...siteSettings, [key]: value};
    adminConsole?.apply(siteSettings);
    adminConsole?.sync();
    accountRequests?.sync();
  },
});

function renderAdminPanel() {
  adminConsole?.sync();
  accountRequests?.sync();
  globalThis.AdminGrants?.render();
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
  onStatus: status => {
    achievementVisitFailed = status === "error";
    if (achievementVisitFailed) {
      const feedback = document.getElementById("achievementAutomationStatus");
      if (feedback) feedback.textContent = "No se pudo registrar el día de hoy. Se volverá a intentar al recuperar la conexión.";
    }
  },
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
  cardScopes: () => achievementCardScopes,
  visitFailed: () => achievementVisitFailed,
  createAward: payload => writeAchievement("create_achievement_with_awards", payload),
  createAutomatic: async payload => {
    const acquisition = payload.new_metric === "cards_acquired";
    const args = {...payload};
    if (acquisition) delete args.new_metric;
    const result = await writeAchievement(acquisition ? "create_card_acquisition_achievement" : "create_automatic_achievement", args);
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
  const force = arguments[0]?.force === true;
  if (!backendReady || !currentAuthUser) return;
  const userId = currentAuthUser.id;
  if (achievementsRequest?.userId === userId) {
    if (force) achievementsRequest.pending = true;
    return achievementsRequest.promise;
  }
  void globalThis.DailyPacks?.refresh();
  const request = {userId, pending:false, promise:null};
  achievementsRequest = request;
  achievementsLoading = true;
  if (achievementProgressUserId !== userId) {
    achievementProgress = [];
    achievementCardScopes = null;
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
        const [definitionsResult, awardsResult, rulesResult, progressResult, scopesResult] = await Promise.all([
          db.from("achievements").select("id,name,description,tier,icon,created_by,created_at").is("retired_at", null).order("created_at", {ascending: false}),
          db.from("achievement_awards").select("id,achievement_id,user_id,awarded_by,awarded_at").order("awarded_at", {ascending: false}),
          db.from("achievement_rules").select("achievement_id,metric,target_count,created_at,collection_key,card_edition,card_kind"),
          db.from("achievement_progress").select("achievement_id,current_value,completed_at").eq("user_id", userId),
          db.rpc("get_card_achievement_scopes"),
        ]);
        if (!isCurrent()) return;
        if (definitionsResult.error || awardsResult.error) throw definitionsResult.error || awardsResult.error;
        achievementCardScopes = !scopesResult.error && scopesResult.data ? scopesResult.data : null;
        const collectionNames = new Map((achievementCardScopes?.collections || []).map(c=>[c.key,c.name]));
        const rules = new Map((rulesResult.data || []).map(r => [String(r.achievement_id), {metric:r.metric, target:r.target_count, createdAt:r.created_at, collectionKey:r.collection_key, collectionName:collectionNames.get(r.collection_key), edition:r.card_edition, kind:r.card_kind}]));
        const previousRules = new Map(achievements.map(a => [String(a.id), a.rule]));
        achievements = (definitionsResult.data || []).map(item => ({
          id:item.id, name:item.name, description:item.description || "", tier:item.tier,
          icon:item.icon || "", createdBy:item.created_by, createdAt:item.created_at,
          rule:rulesResult.error ? previousRules.get(String(item.id)) : rules.get(String(item.id)),
        }));
        const visibleAchievementIds = new Set(achievements.map(item=>String(item.id)));
        const previousOwnAwards = new Set(achievementAwards.filter(item => item.userId === userId).map(item => String(item.id)));
        const hadAchievementSnapshot = achievementsLoaded;
        achievementAwards = (awardsResult.data || []).filter(item=>visibleAchievementIds.has(String(item.achievement_id))).map(item => ({
          id:item.id, achievementId:item.achievement_id, userId:item.user_id,
          awardedBy:item.awarded_by, awardedAt:item.awarded_at,
        }));
        globalThis.TrophyUnlock?.observe(userId, achievements, achievementAwards);
        if (hadAchievementSnapshot && achievementAwards.some(item => item.userId === userId && !previousOwnAwards.has(String(item.id)))) {
          // Trophy packs are granted in the database. Refresh the local counters
          // once when an award first appears, without coupling to shop onChange.
          void globalThis.BannerShop?.refresh?.(true);
          void globalThis.DailyPacks?.refresh?.(true);
        }
        achievementsLoaded = true;
        const progressError = rulesResult.error || progressResult.error || (achievementVisitFailed ? {code:"VISIT_RETRY"} : null);
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

let profileSurfaceGeneration = 0;
function refreshProfileSurfaces() {
  const generation = ++profileSurfaceGeneration, owner = currentAuthUser?.id;
  if (currentUser) applyUserHeader(currentUser);
  // Give each independent surface its own frame. A profile response used to
  // rebuild Home, every member, the inbox and administration in one task.
  const homeVisible = document.getElementById("inicio")?.classList.contains("active");
  // Home's main content must not wait behind 300 ms idle slots (or be
  // repeatedly cancelled when remote profiles arrive during startup).
  if (homeVisible) renderMembers();
  const renders = homeVisible ? [renderFeatured, renderPresence] : [renderFeatured, renderMembers, renderPresence];
  if (document.getElementById("chat")?.matches(".active.conversation-open")) renders.unshift(renderMessages);
  if (document.getElementById("privados")?.classList.contains("active")) renders.unshift(renderPrivateConversation);
  if (["administracion", "admin-cuentas"].some(id => document.getElementById(id)?.classList.contains("active"))) renders.push(renderAdminPanel);
  for (const render of renders) runWhenIdle(() => {
    if (generation === profileSurfaceGeneration && currentAuthUser?.id === owner) render();
  });
  runWhenIdle(() => {
    if (generation === profileSurfaceGeneration && currentAuthUser?.id === owner && activeProfileId && document.getElementById("perfil")?.classList.contains("active")) renderProfile(activeProfileId, false);
  });
}

function applyUserHeader(user) {
  ["bottomNavAvatar"].forEach(id => {
    const node = document.getElementById(id);
    if (!node) return;
    const initial = escapeHtml(user.name?.charAt(0).toUpperCase() || "U");
    const avatarUrl = user.avatarUrl || getMember(user.id)?.avatarUrl || "";
    node.classList.toggle("has-image", Boolean(avatarUrl));
    updateSurfaceMarkup(node, avatarUrl ? `<img data-avatar-image src="${escapeHtml(avatarUrl)}" alt="" decoding="async" referrerpolicy="no-referrer">` : initial);
  });
  document.querySelectorAll(".admin-only").forEach(node => node.style.display = canManageSite() ? "" : "none");
  renderGroupAvatarSurfaces();
  adminConsole?.sync();
  accountRequests?.sync();
}

async function hydrateAuthenticatedData(authUser) {
  const isCurrent = () => currentAuthUser?.id === authUser.id;
  // Only the visible Home's data and unread badges compete for the initial
  // connection. Other requests start independently once input/rendering is idle.
  const reportLoadFailure = (name, error) => console.warn(`[BigBoy startup] ${name} failed (${String(error?.code || error?.name || "unknown").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)})`);
  const defer = loader => runWhenIdle(() => {
    if (!isCurrent()) return;
    Promise.resolve().then(loader).catch(error => reportLoadFailure(loader.name || "deferred-section", error));
  });
  const loadChats = async () => {
    await loadChatChannels({refreshMessages: false});
    if (!isCurrent()) return;
    defer(() => loadChannelAutomations({visit: true}));
    await loadMessages();
  };
  try {
    const chatVisible = ["chat", "privados"].some(id => document.getElementById(id)?.classList.contains("active"));
    const primaryNames = ["profiles", "events", "settings", "notifications"];
    const measureLoad = async (name, loader) => {
      const started = performance.now();
      try { return await loader(); }
      finally { console.info(`[BigBoy startup] load-${name}: ${Math.round(performance.now() - started)} ms`); }
    };
    const primary = [loadRemoteProfiles, loadGroupEvents, loadSiteSettings, loadNotifications].map((loader, index) => measureLoad(primaryNames[index], loader));
    if (chatVisible) primary.push(loadChats(), loadPrivateMessages());
    else { defer(loadChats); defer(loadPrivateMessages); }
    defer(loadNotificationPreferences);
    defer(connectRealtime);
    defer(() => { if (!achievementsLoaded) return loadAchievements(); });
    const results = await Promise.allSettled(primary);
    if (!isCurrent()) return;
    globalThis.ClubHealth?.mark("home-ready");
    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") reportLoadFailure(primaryNames[index] || "chats", result.reason);
    }
  } catch (error) {
    console.warn("No se pudieron actualizar todos los datos al iniciar:", error);
  }
}

async function applyUserInterface(user, authUser = null, {restoring = false} = {}) {
  if (currentAuthUser?.id !== authUser?.id) {
    memberProfilesOwner = null; memberProfilesFailedOwner = null;
    globalThis.ClubDrafts?.suspend();
    globalThis.ClubOnboarding?.reset();
    globalThis.BannerShop?.reset();
    globalThis.AdminGrants?.reset();
    globalThis.GroupInteractions?.reset();
    globalThis.PendingActions?.reset();
  }
  currentUser = user;
  currentAuthUser = authUser;
  if (authUser?.id && user) {
    try {
      localStorage.setItem(AUTH_PROFILE_CACHE_KEY, JSON.stringify({
        userId: authUser.id,
        profile: {id: user.id, username: user.username, name: user.name},
      }));
    } catch {}
  }
  globalThis.ClubMotion?.configure(authUser?.id);
  document.documentElement.classList.add("auth-session-hint");
  document.body.classList.add("authenticated");
  globalThis.ClubHealth?.mark("authenticated");
  document.getElementById("loginScreen")?.classList.add("login-hidden");
  applyUserHeader(user);
  if (isSuperAdmin() && document.getElementById("inicio")?.classList.contains("active")) goTo("administracion");
  completeInitialLaunch();
  // Authentication and role checks are already finished. Let the authenticated
  // shell paint before DOM-heavy surfaces or network completion callbacks run.
  await waitForStartupPaint();
  if (currentAuthUser?.id !== authUser?.id || currentUser !== user) return;
  refreshProfileSurfaces();
  runWhenIdle(() => { if (currentAuthUser?.id === authUser?.id) renderCalendar(); });
  runWhenIdle(() => { if (currentAuthUser?.id === authUser?.id) renderSpotify(); });
  for (const render of [renderNotifications, renderHelpCenter, renderAdminAchievements]) {
    runWhenIdle(() => { if (currentUser === user) render(); });
  }
  if (document.getElementById("chat")?.classList.contains("active")) runWhenIdle(() => { if (currentUser === user) renderPrivateContacts(); });
  if (document.getElementById("privados")?.classList.contains("active")) runWhenIdle(() => { if (currentUser === user) renderPrivateConversation(); });
  if (restoring) {
    document.body.classList.add("session-restoring");
    return;
  }
  document.body.classList.remove("session-restoring");
  runWhenIdle(() => { if (currentAuthUser?.id === authUser?.id && currentUser === user) globalThis.ClubOnboarding?.ready({userId:authUser?.id || `local:${user.id}`, navigate:goTo}); });
  if (backendReady && authUser) {
    void hydrateAuthenticatedData(authUser);
    runWhenIdle(() => { if (currentAuthUser?.id === authUser.id) void globalThis.BannerShop?.refresh(); });
  } else {
    onlineUsers = [{legacy_id: user.id, name: user.name}];
    renderPresence();
    renderAdminPanel();
  }
  if (document.getElementById("inicio")?.classList.contains("active")) loadNews(false);
  if (location.hash === "#perfil") renderProfile(currentUser.id);
  window.scrollTo({top: 0, behavior: "auto"});
  void setupNativePush().catch(error => console.warn("No se pudieron restaurar los avisos del iPhone", error.message)).finally(syncPushNotificationState);
  syncPushNotificationState();
  if (document.getElementById("privados")?.classList.contains("active") && activePrivateMemberId == null) goTo("chat");
}

function updateOfflineAlbumAccess() {
  const button=document.getElementById('offlineAlbumAccess');
  if(button)button.hidden=navigator.onLine!==false || !!currentAuthUser || !globalThis.BannerShop?.offlineInventory();
}
window.addEventListener('online',updateOfflineAlbumAccess);
window.addEventListener('offline',updateOfflineAlbumAccess);
document.addEventListener('bb:offline-album-change',updateOfflineAlbumAccess);
document.getElementById('offlineAlbumAccess')?.addEventListener('click',async event=>{
  if(currentAuthUser || currentUser || navigator.onLine!==false)return;
  const snapshot=globalThis.BannerShop?.offlineInventory(), trigger=event.currentTarget;
  if (!snapshot) return;
  try {
    await globalThis.ClubFeatures?.load('collection');
    if (!currentAuthUser && !currentUser) globalThis.CardAlbum?.openOffline(snapshot,trigger);
  } catch (error) { globalThis.ClubFeatures?.feedback(error.message); }
});

function showLogin() {
  globalThis.ClubAccountSecurity?.reset();
  globalThis.ClubOnboarding?.reset();
  document.body.classList.remove("session-restoring");
  currentUser = null;
  globalThis.ClubDrafts?.suspend();
  currentAuthUser = null;
  adminConsole?.apply({});
  adminConsole?.sync();
  accountRequests?.sync();
  globalThis.ClubMotion?.configure(null);
  globalThis.CardCollection?.close();
  globalThis.DailyPacks?.reset();
  globalThis.BannerShop?.reset();
  globalThis.AdminGrants?.reset();
  globalThis.GroupInteractions?.reset();
  globalThis.PendingActions?.reset();
  globalThis.TrophyUnlock?.reset();
  closeProfileQuickMenu();
  closeAchievementChallenges(false);
  document.documentElement.classList.remove("auth-session-hint");
  document.body.classList.remove("authenticated");
  document.getElementById("loginScreen")?.classList.remove("login-hidden");
  onlineUsers = [];
  notifications = [];
  notificationReadState = null;
  resetNotificationPreferences();
  renderPresence();
  renderNotifications();
  closeNotifications();
  goTo("inicio");
  completeInitialLaunch();
  updateOfflineAlbumAccess();
}

async function logoutCurrentUser() {
  globalThis.CardAlbum?.closeOffline();
  globalThis.BannerShop?.forgetOfflineInventory();
  try { if (nativePush()) await removeNativePushDevice(); }
  catch (error) { window.alert(error.message); return; }
  chatSendAttempts.clear();
  closeMessageUI();
  await globalThis.ClubSpotify?.disconnect();
  globalThis.CardCollection?.close();
  globalThis.DailyPacks?.reset();
  globalThis.BannerShop?.reset();
  globalThis.AdminGrants?.reset();
  globalThis.GroupInteractions?.reset();
  globalThis.PendingActions?.reset();
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
  globalThis.ClubDrafts?.suspend();
  currentAuthUser = null;
  adminConsole?.apply({});
  adminConsole?.sync();
  accountRequests?.sync();
  globalThis.ClubMotion?.configure(null);
  globalThis.AdminGrants?.render();
  messages = [];
  notifications = [];
  notificationReadState = null;
  resetNotificationPreferences();
  privateMessages = [];
  privateAttachmentCache.clear();
  privateAttachmentRequest = null;
  groupEvents = [];
  calendarChatAnnouncements = [];
  channelAutomationMessages = [];
  calendarChatSyncDay = "";
  calendarChatRequest = null;
  renderGroupChatEventNotice();
  homeEventsReady = !backendReady;
  homeSettingsReady = !backendReady;
  siteSettings = {};
  adminConsole?.apply(siteSettings);
  adminConsole?.sync();
  accountRequests?.sync();
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

async function beginAuthenticatedSession(authUser) {
  // getUser reads the current server record, including non-user-editable app metadata.
  // A cached JWT/user_metadata/local flag must never waive a required change.
  const {data, error} = await db.auth.getUser();
  if (error || !data.user || data.user.id !== authUser.id) throw new Error("La sesión ya no está disponible. Vuelve a iniciar sesión.");
  const verifiedUser = data.user;
  if (await accountRequests?.handleAuthUser(verifiedUser)) { showLogin(); return; }
  if (verifiedUser.app_metadata?.must_change_password === true) {
    showLogin();
    currentAuthUser = verifiedUser;
    openRequiredPasswordChange();
    return;
  }
  // Finish identity/MFA before reading protected club tables. The status RPC and
  // Auth APIs are intentionally available while the account is being secured.
  let securityApproved;
  try {
    if (!globalThis.ClubAccountSecurity) throw new Error("No se pudo cargar la seguridad del acceso. Actualiza la aplicación e inténtalo de nuevo.");
    securityApproved = await globalThis.ClubAccountSecurity.gate(db, verifiedUser);
  } catch (securityError) {
    showLogin();
    throw securityError;
  }
  if (securityApproved === false) return;
  // Roles and account visibility must also come from the current server profile.
  const profile = await profileForAuthUser(verifiedUser);
  if (!profile) {
    globalThis.ClubDrafts?.suspend();
    currentAuthUser = null;
    globalThis.ClubMotion?.configure(null);
    await db.auth.signOut();
    throw new Error("Esta cuenta todavía no tiene un perfil del club.");
  }
  await applyUserInterface(profile, verifiedUser);
}

async function login(username, password) {
  if (!backendReady) throw new Error("No se puede conectar con el servicio de acceso. Inténtalo de nuevo cuando haya conexión.");
  // A password sign-in starts a new flow. An abandoned Google-link attempt
  // must not sign out this user when the account security gate opens.
  localStorage.removeItem("bb-identity-link");
  // Resolve usernames on the server: the Auth email can change when linking a
  // real address. A stale session must not be attached to this public endpoint.
  const response = await fetch(`${config.supabaseUrl}/functions/v1/account-requests`, {
    method: "POST",
    headers: {"Content-Type":"application/json", apikey:config.supabasePublishableKey},
    body: JSON.stringify({action:"login", username:String(username || "").trim().toLowerCase().replace(/^@/, ""), password}),
    signal: AbortSignal.timeout(20000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.session) throw new Error(result.error || "No se pudo iniciar sesión. Inténtalo de nuevo.");
  const restored = await db.auth.setSession(result.session);
  if (restored.error || !restored.data.user) throw new Error("No se pudo iniciar sesión. Inténtalo de nuevo.");
  await beginAuthenticatedSession(restored.data.user);
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
  const policyError = passwordValidationError(password, currentAuthUser?.user_metadata?.display_name, currentAuthUser?.email?.split("@")[0]);
  if (policyError) {
    feedback.textContent = policyError;
    return;
  }
  if (password !== confirmation) {
    feedback.textContent = "Las dos contraseñas no coinciden.";
    return;
  }
  submit.disabled = true;
  feedback.textContent = "Guardando la nueva contraseña…";
  let passwordSaved = false;
  try {
    if (!backendReady || !currentAuthUser?.email) throw new Error("La sesión ya no está disponible. Vuelve a iniciar sesión.");
    const {id: expectedUserId, email} = currentAuthUser;
    await invokeUserAdmin("change-password", {password});
    passwordSaved = true;
    // GoTrue may invalidate the previous session after a password change.
    // Start a fresh session with the new password instead of refreshing that token.
    const {data: signedIn, error: signInError} = await db.auth.signInWithPassword({email, password});
    if (signInError || signedIn.user?.id !== expectedUserId) {
      throw new Error("La contraseña se ha guardado. Vuelve a iniciar sesión con la nueva contraseña para continuar.");
    }
    const {data: verified, error: verificationError} = await db.auth.getUser();
    if (verificationError || verified.user?.id !== expectedUserId) {
      throw new Error("La contraseña se ha guardado, pero no se pudo verificar la nueva sesión. Comprueba la conexión y vuelve a iniciar sesión.");
    }
    if (verified.user.app_metadata?.must_change_password === true) throw new Error("La contraseña se ha guardado, pero no se ha podido completar la actualización de seguridad. Contacta con administración.");
    await beginAuthenticatedSession(verified.user);
    form.reset();
    document.getElementById("requiredPasswordChange").classList.remove("open");
    document.getElementById("requiredPasswordChange").setAttribute("aria-hidden", "true");
  } catch (error) {
    if (passwordSaved) {
      form.reset();
      document.getElementById("requiredPasswordChange").classList.remove("open");
      document.getElementById("requiredPasswordChange").setAttribute("aria-hidden", "true");
      showLogin();
      document.getElementById("loginPassword").value = "";
      const message = error.message || "Vuelve a iniciar sesión con la nueva contraseña.";
      document.getElementById("loginError").textContent = message.startsWith("La contraseña se ha guardado") ? message : `La contraseña se ha guardado. ${message}`;
    } else {
      feedback.textContent = error.message || "No se pudo cambiar la contraseña.";
    }
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
      id: Number(profile.legacy_id), username: profile.username,
      name: profile.display_name || profile.username, nickname: profile.nickname || "The Big Boy",
      roleKey: profile.role, role: profile.role === "admin" ? "ADMINISTRADOR" : "MIEMBRO",
      bio: profile.bio || "", tags: Array.isArray(profile.tags) ? profile.tags : [],
      countryFlag: profile.country_flag || "",
      avatarUrl: "", bg: "linear-gradient(145deg, #262018, #0c0c0e 68%)"
    };
    members.push(member);
  }
  Object.assign(member, {
    username: profile.username,
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
  const generation = ++profileLoadGeneration;
  const authId = currentAuthUser?.id;
  let data, error;
  try {
    ({data, error} = await db.from("profiles").select("*").order("legacy_id"));
  } catch (failure) {
    error = failure || new Error("No se pudieron cargar los perfiles.");
  }
  if (generation !== profileLoadGeneration || currentAuthUser?.id !== authId) return;
  if (error || !Array.isArray(data)) {
    memberProfilesFailedOwner = authId;
    renderMembers();
    return;
  }
  memberProfilesOwner = authId; memberProfilesFailedOwner = null;
  const activeProfiles = data.filter(profile => !profile.is_hidden && profile.is_active !== false);
  const ids = new Set(activeProfiles.map(profile => Number(profile.legacy_id)));
  members = members.filter(member => ids.has(Number(member.id)));
  rebuildMemberIndexes();
  activeProfiles.forEach(profile => mergeRemoteProfile(profile));
  rebuildMemberIndexes();
  if (currentUser && !currentUser.hidden) {
    currentUser = getMember(currentUser.id) || currentUser;
  }
  refreshProfileSurfaces();
  renderAchievementDetail();
  performSearch(document.getElementById("globalSearchInput").value);
}

async function loadMessages() {
  const owner = currentAuthUser?.id;
  const anchor = document.getElementById("messages");
  globalThis.ClubFeedback?.set(anchor, "loading", messages.length ? "Actualizando mensajes…" : "Cargando mensajes…");
  try {
    const {data, error} = await db.from("messages")
      .select("id,user_id,legacy_id,channel_id,body,reply_to_id,attachment_url,attachment_name,attachment_type,attachment_size,created_at")
      .order("created_at").limit(200);
    if (owner !== currentAuthUser?.id) return;
    if (error) throw error;
    messages = (data || []).map(mapMessage);
    globalThis.ClubFeedback?.set(anchor, "ready", "");
    refreshGroupMessageSurfaces();
    markVisibleConversationRead();
  } catch {
    if (owner === currentAuthUser?.id) globalThis.ClubFeedback?.set(anchor, "error", messages.length ? "No se pudo actualizar. Mostramos los últimos mensajes." : "No se pudieron cargar los mensajes. Comprueba la conexión.", () => void loadMessages());
  }
}

// Data loaders and realtime events can settle together. Render their shared
// inbox once per frame, while direct navigation keeps its immediate renders.
let chatSurfaceRefresh = null;
function scheduleChatSurfaces({group = false, privateConversation = false, contacts = true} = {}) {
  const owner = currentAuthUser?.id;
  if (!owner) return;
  if (chatSurfaceRefresh?.owner !== owner) {
    if (chatSurfaceRefresh) cancelAnimationFrame(chatSurfaceRefresh.frame);
    chatSurfaceRefresh = {owner, group: false, privateConversation: false, contacts: false, frame: null};
  }
  const pending = chatSurfaceRefresh;
  pending.group ||= group;
  pending.privateConversation ||= privateConversation;
  pending.contacts ||= contacts;
  if (pending.frame !== null) return;
  pending.frame = requestAnimationFrame(() => {
    if (chatSurfaceRefresh !== pending) return;
    chatSurfaceRefresh = null;
    if (currentAuthUser?.id !== owner) return;
    // Keep the data hot without reconciling hundreds of hidden message nodes.
    // Opening a conversation already renders its current data synchronously.
    if (pending.group && document.getElementById("chat")?.matches(".active.conversation-open")) renderMessages();
    if (pending.privateConversation && document.getElementById("privados")?.classList.contains("active")) renderPrivateConversation();
    if (pending.contacts && document.getElementById("chat")?.classList.contains("active")) renderPrivateContacts();
  });
}

function refreshGroupMessageSurfaces() {
  scheduleChatSurfaces({group: true});
}

function mapMessage(item) {
  return {
    id: item.id, userId: item.user_id, member: item.legacy_id, channelId: item.channel_id, text: item.body,
    replyToId: item.reply_to_id,
    attachmentUrl: item.attachment_url, attachmentName: item.attachment_name,
    attachmentType: item.attachment_type, attachmentSize: item.attachment_size,
    createdAt: item.created_at, createdTimestamp: chatDate(item.created_at).timestamp
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
    .sort((a, b) => messageTimestamp(a) - messageTimestamp(b));
  refreshGroupMessageSurfaces();
  markVisibleConversationRead();
}

async function loadChatChannels({refreshMessages = true} = {}) {
  const owner = currentAuthUser?.id;
  const anchor = document.getElementById("privateContacts");
  globalThis.ClubFeedback?.set(anchor, "loading", chatChannels.length ? "Actualizando conversaciones…" : "Cargando conversaciones…");
  try {
    const {data, error} = await db.from("chat_channels").select("*").order("position").order("created_at");
    if (owner !== currentAuthUser?.id) return;
    if (error) throw error;
    chatChannels = (data || []).map(item => ({id: item.id, name: item.name, isDefault: item.is_default, position: item.position, description: item.description || "", readOnly: Boolean(item.read_only)}));
    globalThis.ClubFeedback?.set(anchor, "ready", "");
    // Establish the active channel immediately. Initial hydration loads its
    // messages next, avoiding a redundant render of the empty conversation.
    renderChatChannels();
    scheduleChatSurfaces({group: refreshMessages});
    if (document.getElementById("chat")?.classList.contains("conversation-open")) {
      globalThis.GroupInteractions?.mountPolls(document.getElementById("groupPolls"), activeChatChannelId);
    }
  } catch {
    if (owner === currentAuthUser?.id) globalThis.ClubFeedback?.set(anchor, "error", "No se pudieron actualizar las conversaciones. Comprueba la conexión.", () => void loadChatChannels());
  }
}

const notificationPreferenceCategories = [
  {key:"chats",title:"Chats",detail:"Mensajes privados y de grupo",symbol:"↗"},
  {key:"agenda",title:"Agenda",detail:"Nuevos planes y cumpleaños",symbol:"◷"},
  {key:"collection",title:"Sobres y colección",detail:"Sobres diarios y regalos del club",symbol:"◇"},
  {key:"news",title:"Noticias",detail:"Avisos al abrir o actualizar las noticias · sin push",symbol:"≋"},
  {key:"activity",title:"Actividad",detail:"Me gusta, respuestas y publicaciones",symbol:"♡"}
];
function resetNotificationPreferences() {
  notificationPreferences = null; notificationPreferencesOwner = null; notificationPreferencesLoading = false; notificationPreferencesSaving = false; notificationPreferencesError = ""; newsNoticePending = false;renderNotificationPreferences();
}
function renderNotificationPreferences() {
  const host = document.getElementById("notificationPreferenceOptions"), status = document.getElementById("notificationPreferencesStatus");
  if (!host || !status) return;
  const ready = notificationPreferencesOwner === currentAuthUser?.id && !!notificationPreferences;
  status.textContent = notificationPreferencesError || (notificationPreferencesSaving ? "Guardando tu elección…" : notificationPreferencesLoading ? "Cargando tus preferencias…" : ready ? "Se guardan en tu cuenta. Los avisos anteriores se conservan." : "Conecta tu cuenta para ajustar tus avisos.");
  host.innerHTML = notificationPreferenceCategories.map(category => `<label class="notification-preference-row"><span class="notification-preference-symbol" aria-hidden="true">${category.symbol}</span><span class="notification-preference-copy"><strong>${category.title}</strong><small>${category.detail}</small></span><span class="notification-preference-switch"><input type="checkbox" role="switch" data-notification-preference="${category.key}" aria-label="${category.title}" ${ready && notificationPreferences[category.key] ? "checked" : ""} ${!ready || notificationPreferencesLoading || notificationPreferencesSaving ? "disabled" : ""}><span aria-hidden="true"></span></span></label>`).join("");
  document.getElementById("retryNotificationPreferences").hidden = !notificationPreferencesError;
}
async function loadNotificationPreferences() {
  const owner = currentAuthUser?.id;
  if (!db || !owner || notificationPreferencesLoading || notificationPreferencesSaving) return;
  notificationPreferencesLoading = true;notificationPreferencesError = "";renderNotificationPreferences();
  try {const {data,error}=await db.rpc("get_notification_preferences");if(error)throw error;if(owner!==currentAuthUser?.id)return;notificationPreferences=data;notificationPreferencesOwner=owner;}
  catch(error){if(owner===currentAuthUser?.id)notificationPreferencesError=["PGRST202","42883","42P01"].includes(error.code)?"Las preferencias todavía no están activadas en el servidor.":"No se pudieron cargar las preferencias. Reintenta cuando tengas conexión.";}
  finally{if(owner===currentAuthUser?.id){notificationPreferencesLoading=false;renderNotificationPreferences();}}
}
async function saveNotificationPreference(category,enabled) {
  const owner=currentAuthUser?.id;
  if(!owner || notificationPreferencesOwner!==owner || notificationPreferencesSaving || !notificationPreferenceCategories.some(item=>item.key===category))return;
  notificationPreferencesSaving=true;notificationPreferencesError="";renderNotificationPreferences();
  try{const {data,error}=await db.rpc("set_notification_preference",{category,enabled});if(error)throw error;if(owner!==currentAuthUser?.id)return;notificationPreferences=data;}
  catch{if(owner===currentAuthUser?.id)notificationPreferencesError="No se guardó el cambio. Tu preferencia anterior se mantiene.";}
  finally{if(owner===currentAuthUser?.id){notificationPreferencesSaving=false;renderNotificationPreferences();document.querySelector(`[data-notification-preference="${category}"]`)?.focus({preventScroll:true});}}
}
async function registerNewsNotification(items) {
  const owner=currentAuthUser?.id, latest=Math.max(0,...items.map(item=>newsTimestamp(item.published)));
  if(!owner||!db||!latest||newsNoticePending)return;newsNoticePending=true;
  try{await db.rpc("register_news_update",{latest_at:new Date(latest).toISOString(),new_count:Math.min(100,items.length)});}
  catch{}finally{if(owner===currentAuthUser?.id)newsNoticePending=false;}
}
function notificationPresentation(item,actor) {
  const who=actor?.name || "Un miembro";
  const values={
    private_message:{title:who,kind:"Te ha enviado un mensaje"},
    group_message:{title:who,kind:"Mensaje en el grupo"},
    group_poll:{title:who,kind:"Nueva encuesta en el grupo"},
    account_request:{title:"Solicitud de cuenta",kind:"Administración · acceso al club",system:true,symbol:"＋"},
    like:{title:who,kind:"Le gusta tu contenido"},reply:{title:who,kind:"Ha respondido a tu contenido"},media_created:{title:who,kind:item.targetType==="moment"?"Ha compartido una historia":"Ha publicado contenido"},
    event_created:{title:"Nuevo plan",kind:`Agenda · ${who}`,system:true,symbol:"◷"},
    pack_granted:{title:"Sobres recibidos",kind:"Tu colección",system:true,symbol:"◇"},
    news_update:{title:"Noticias del club",kind:"Actualidad · dentro de la app",system:true,symbol:"≋"},
    trade_offer:{title:"Propuesta de intercambio",kind:`Colección · ${who}`,system:true,symbol:"⇄"},
    trade_resolved:{title:"Intercambio actualizado",kind:"Tu colección",system:true,symbol:"⇄"}
  };return values[item.type] || {title:"Actividad del club",kind:"Nuevo aviso",system:true,symbol:"◇"};
}
document.getElementById("notificationPreferenceOptions")?.addEventListener("change",event=>{const input=event.target.closest("[data-notification-preference]");if(input)void saveNotificationPreference(input.dataset.notificationPreference,input.checked);});
document.getElementById("retryNotificationPreferences")?.addEventListener("click",()=>void loadNotificationPreferences());

function renderNotifications(refreshContacts = true) {
  if (refreshContacts) scheduleChatSurfaces();
  const list = document.getElementById("notificationsList");
  const badge = document.getElementById("notificationCount");
  const unread = notifications.filter(item => !item.readAt).length;
  const chatTabAlert = document.getElementById("chatTabAlert");
  if (chatTabAlert) chatTabAlert.hidden = !notifications.some(item => !item.readAt && item.type === "private_message");
  badge.hidden = unread === 0;
  badge.textContent = unread > 99 ? "99+" : String(unread);
  document.getElementById("markAllNotificationsRead").disabled = unread === 0;
  document.getElementById("clearAllNotifications").disabled = notifications.length === 0;
  document.getElementById("notificationsUnreadSummary").textContent = unread ? `${unread} ${unread === 1 ? "notificación sin leer" : "notificaciones sin leer"}` : "Todo al día";
  document.getElementById("notificationsFilterCount").textContent = unread;
  document.querySelectorAll("[data-notification-filter]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.notificationFilter === notificationFilter)));
  const visible = notifications.filter(item => notificationFilter !== "unread" || !item.readAt);
  if (!visible.length) {
    list.innerHTML = `<div class="notifications-empty"><div class="notifications-empty-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-8"/></svg></div><strong>Todo al día</strong><p>${notificationFilter === "unread" ? "No tienes notificaciones pendientes de leer." : "Los avisos del club aparecerán aquí."}</p></div>`;
    return;
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups = [[], [], []];
  for (const item of visible) {
    const date = new Date(item.createdAt);
    groups[date >= today ? 0 : date >= yesterday ? 1 : 2].push(item);
  }
  list.innerHTML = groups.map((items, index) => !items.length ? "" : `<section class="notifications-day"><h3>${["Hoy", "Ayer", "Anteriores"][index]}</h3>${items.map(item => {
    const actor = getMemberByAuthId(item.actorId);
    const presentation = notificationPresentation(item, actor);
    const actorName = presentation.title;
    const date = new Date(item.createdAt);
    const time = Number.isNaN(date.getTime()) ? "" : (index < 2 ? conversationTimeFormatter : notificationDateFormatter).format(date);
    return `<article class="notification-item ${item.readAt ? "" : "unread"}">
      <button class="notification-open" type="button" data-notification-id="${escapeHtml(String(item.id))}">
        <span class="notification-avatar">${presentation.system ? `<span class="notification-system-symbol" aria-hidden="true">${presentation.symbol}</span>` : getAvatar(actor, "avatar tiny")}<span class="notification-message-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 5h14v11H9l-4 4z"/></svg></span></span>
        <span class="notification-copy"><span class="notification-row-title"><strong>${escapeHtml(actorName)}</strong>${item.readAt ? "" : '<i class="notification-unread-dot" aria-label="Sin leer"></i>'}</span><span class="notification-kind">${escapeHtml(presentation.kind)}</span>${item.excerpt ? `<small>${escapeHtml(item.excerpt)}</small>` : ""}<time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(time)}</time></span>
      </button>
      <button class="notification-delete" type="button" data-delete-notification="${escapeHtml(String(item.id))}" aria-label="Eliminar notificación de ${escapeHtml(actorName)}" title="Eliminar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8 8 8M16 8l-8 8"/></svg></button>
    </article>`;
  }).join("")}</section>`).join("");
}

async function loadNotifications() {
  const owner = currentAuthUser?.id;
  if (!owner || !db) return;
  const readState = conversationReadState();
  const {data, error} = await db.from("notifications").select("*").eq("user_id", owner)
    .order("created_at", {ascending: false}).limit(100);
  if (owner !== currentAuthUser?.id || readState !== notificationReadState) return;
  if (!error) notifications = (data || []).map(mapNotification).map(item => preserveNotificationRead(item, readState));
  const late = notifications.filter(item => !item.readAt && item.type === "private_message"
    && new Date(item.createdAt) <= new Date(readState.privateThrough.get(String(item.actorId)) || 0));
  if (late.length) void persistNotificationReads(late.map(item => item.id), new Date().toISOString(), readState);
  markVisibleConversationRead();
  renderNotifications();
  globalThis.CollectionSocial?.receiveNotification();
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

// Keep optimistic receipts over older fetch/realtime results. State identity also
// prevents a request from a previous login restoring another account's badges.
function conversationReadState() {
  const owner = currentAuthUser?.id;
  if (!owner) return null;
  if (notificationReadState?.owner !== owner) notificationReadState = {owner, receipts: new Map(), privateThrough: new Map()};
  return notificationReadState;
}

function preserveNotificationRead(item, state) {
  const receipt = state?.receipts.get(String(item.id));
  return receipt && !item.readAt ? {...item, readAt: receipt.readAt} : item;
}

function visibleConversation() {
  if (!currentAuthUser || document.hidden) return null;
  if (document.getElementById("privados")?.classList.contains("active")) {
    const actorId = getMember(activePrivateMemberId)?.authId;
    return actorId ? {type: "private_message", actorId} : null;
  }
  const group = document.getElementById("chat");
  return group?.classList.contains("active") && group.classList.contains("conversation-open")
    ? {type: "group_message", channelId: activeChatChannelId} : null;
}

function markVisibleConversationRead({includeHistory = false} = {}) {
  const state = conversationReadState(), conversation = visibleConversation();
  if (!state || !conversation || !db) return;
  const readAt = new Date().toISOString();
  if (conversation.actorId) state.privateThrough.set(String(conversation.actorId), readAt);
  const ids = notifications.filter(item => {
    if (item.readAt || item.type !== conversation.type) return false;
    if (conversation.actorId) return String(item.actorId) === String(conversation.actorId);
    // Group notification targets are message IDs. Never clear another section.
    return messages.some(message => String(message.id) === String(item.targetId)
      && String(message.channelId) === String(conversation.channelId));
  }).map(item => item.id);
  if (ids.length || (includeHistory && conversation.actorId)) void persistNotificationReads(ids, readAt, state, false,
    includeHistory ? conversation.actorId : null);
}

function handleRealtimeNotification(payload) {
  if (!currentAuthUser || (payload.new?.user_id && payload.new.user_id !== currentAuthUser.id)) return;
  if (["trade_offer", "trade_resolved"].includes(payload.new?.type)) globalThis.CollectionSocial?.receiveNotification();
  if (payload.new?.type === "account_request") void accountRequests?.refresh();
  const state = conversationReadState();
  notifications = applyRealtimeChange(notifications, payload, mapNotification)
    .map(item => preserveNotificationRead(item, state))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);
  // The notification can arrive after its message or after leaving the chat.
  const late = notifications.filter(item => !item.readAt && item.type === "private_message"
    && new Date(item.createdAt) <= new Date(state.privateThrough.get(String(item.actorId)) || 0));
  if (late.length) void persistNotificationReads(late.map(item => item.id), new Date().toISOString(), state);
  markVisibleConversationRead();
  renderNotifications();
}

async function persistNotificationReads(ids, readAt, state = conversationReadState(), all = false, privateActorId = null) {
  if (!state || !db || state !== notificationReadState || state.owner !== currentAuthUser?.id) return;
  const keys = new Set(ids.map(String));
  const operation = {readAt};
  const previous = new Map();
  notifications = notifications.map(item => {
    if (!keys.has(String(item.id)) || item.readAt) return item;
    previous.set(String(item.id), item.readAt);
    state.receipts.set(String(item.id), operation);
    return {...item, readAt};
  });
  renderNotifications();
  try {
    let query = db.from("notifications").update({read_at: readAt}).eq("user_id", state.owner).is("read_at", null);
    if (privateActorId) query = query.eq("type", "private_message").eq("actor_id", privateActorId).lte("created_at", readAt);
    else query = all ? query.lte("created_at", readAt) : query.in("id", ids);
    const {error} = await query;
    if (error) throw error;
    if (state.receipts.size > 500) {
      const loaded = new Set(notifications.map(item => String(item.id)));
      for (const key of state.receipts.keys()) {
        if (!loaded.has(key)) state.receipts.delete(key);
        if (state.receipts.size <= 300) break;
      }
    }
  } catch {
    if (state !== notificationReadState || state.owner !== currentAuthUser?.id) return;
    // Roll back only this operation, preserving arrivals and unrelated reads.
    notifications = notifications.map(item => {
      const key = String(item.id);
      if (state.receipts.get(key) !== operation) return item;
      state.receipts.delete(key);
      return {...item, readAt: previous.get(key) || null};
    });
    renderNotifications();
  }
}

async function markNotificationsRead(id = null) {
  const state = conversationReadState();
  if (!state) return;
  const ids = notifications.filter(item => !item.readAt && (id == null || String(item.id) === String(id))).map(item => item.id);
  if (!ids.length && id != null) return;
  await persistNotificationReads(ids, new Date().toISOString(), state, id == null);
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
  } else if (item.type === "event_created") goTo("calendario");
  else if (["pack_granted","trade_offer","trade_resolved"].includes(item.type)) {
    if(item.type.startsWith("trade_")) globalThis.CollectionSocial?.openTrades();
    else goTo("sobres");
  } else if (item.type === "account_request" && canManageSite()) {goTo("administracion");document.querySelector("[data-open-account-requests]")?.click();}
  else if (item.type === "group_poll") void openGroupConversation(item.targetId);
  else if (item.type === "group_message") goTo("chat");
  else if (item.type === "news_update") {goTo("inicio");document.getElementById("noticias")?.classList.remove("is-collapsed");document.getElementById("noticias")?.scrollIntoView({behavior:(globalThis.ClubMotion?.media || matchMedia("(prefers-reduced-motion: reduce)")).matches?"instant":"smooth",block:"start"});}
  else {
    const actor = getMemberByAuthId(item.actorId);
    if (actor) renderProfile(actor.id);
    else goTo("inicio");
  }
}

function setNotificationsOpen(open, restoreFocus = false) {
  const dropdown = document.getElementById("notificationsDropdown");
  const backdrop = document.getElementById("notificationsBackdrop");
  // Place the dialog outside the mobile header, whose scroll transform creates
  // a containing block and otherwise clips fixed sheets below the safe area.
  if (dropdown.parentElement !== document.body) {
    document.body.append(backdrop, dropdown);
  }
  if (open) {
    void loadNotificationPreferences();
    const anchor = document.getElementById("notificationsButton").getBoundingClientRect();
    dropdown.style.setProperty("--notifications-top", `${anchor.bottom + 12}px`);
    dropdown.style.setProperty("--notifications-right", `${Math.max(16, innerWidth - anchor.right)}px`);
  }
  if (!open && (restoreFocus || dropdown.contains(document.activeElement))) document.getElementById("notificationsButton").focus({preventScroll: true});
  dropdown.classList.toggle("open", open);
  dropdown.setAttribute("aria-hidden", String(!open));
  dropdown.inert = !open;
  document.getElementById("notificationsBackdrop").hidden = !open;
  document.getElementById("notificationsButton").setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("notifications-visible", open);
  if (open) {
    dropdown.scrollTop = 0;
    document.getElementById("notificationsList").scrollTop = 0;
    document.getElementById("closeNotifications").focus({preventScroll: true});
  }

}

function closeNotifications(restoreFocus = false) {
  setNotificationsOpen(false, restoreFocus);
}

async function loadPrivateMessages() {
  const owner = currentAuthUser?.id;
  const anchor = document.getElementById("privateMessages");
  globalThis.ClubFeedback?.set(anchor, "loading", privateMessages.length ? "Actualizando mensajes…" : "Cargando mensajes…");
  try {
    const {data, error} = await db.from("private_messages").select("*").order("created_at", {ascending: false}).limit(300);
    if (owner !== currentAuthUser?.id) return;
    if (error) throw error;
    privateMessages = [...(data || [])].reverse().map(mapPrivateMessage);
    await resolvePrivateAttachments({changed: true});
    if (owner !== currentAuthUser?.id) return;
    globalThis.ClubFeedback?.set(anchor, "ready", "");
    refreshPrivateMessageSurfaces();
  } catch {
    if (owner === currentAuthUser?.id) globalThis.ClubFeedback?.set(anchor, "error", privateMessages.length ? "No se pudo actualizar. Mostramos los últimos mensajes." : "No se pudieron cargar los mensajes. Comprueba la conexión.", () => void loadPrivateMessages());
  }
}

const privateAttachmentCache = new Map();
let privateAttachmentRequest = null;
function privateAttachmentPath(value) {
  const prefix = "storage://private-chat/";
  return typeof value === "string" && value.startsWith(prefix) ? value.slice(prefix.length) : null;
}
async function resolvePrivateAttachments({changed = false} = {}) {
  if (!currentAuthUser || !backendReady) return;
  const userId = currentAuthUser.id;
  if (privateAttachmentRequest?.userId === userId) {
    if (changed) privateAttachmentRequest.pending = true;
    return privateAttachmentRequest.promise;
  }
  const request = {userId, promise: null, pending: false};
  privateAttachmentRequest = request;
  request.promise = (async () => {
    do {
    request.pending = false;
    const paths = [...new Set(privateMessages.map(m => privateAttachmentPath(m.attachmentRef || m.attachmentUrl)).filter(Boolean))];
    const stale = paths.filter(path => (privateAttachmentCache.get(`${userId}:${path}`)?.expires || 0) < Date.now());
    if (stale.length) {
      const {data, error} = await db.storage.from("private-chat").createSignedUrls(stale, 3600);
      if (!error && currentAuthUser?.id === userId) for (const result of data || []) {
        if (result.signedUrl) privateAttachmentCache.set(`${userId}:${result.path}`, {url: result.signedUrl, expires: Date.now() + 3300000});
      }
    }
    if (currentAuthUser?.id !== userId) return;
    for (const message of privateMessages) {
      const path = privateAttachmentPath(message.attachmentRef || message.attachmentUrl);
      if (path) message.attachmentUrl = privateAttachmentCache.get(`${userId}:${path}`)?.url || message.attachmentRef;
    }
    } while (request.pending && currentAuthUser?.id === userId);
  })().catch(() => { /* Offline signing leaves a non-executable storage reference for later retry. */ }).finally(() => { if (privateAttachmentRequest === request) privateAttachmentRequest = null; });
  return request.promise;
}

function refreshPrivateMessageSurfaces() {
  scheduleChatSurfaces({privateConversation: true});
}

function mapPrivateMessage(item) {
  return {
    id: item.id, senderId: item.sender_id, recipientId: item.recipient_id,
    replyToId: item.reply_to_id,
    body: item.body, attachmentRef: item.attachment_url, attachmentUrl: item.attachment_url, attachmentName: item.attachment_name,
    attachmentType: item.attachment_type, attachmentSize: item.attachment_size,
    createdAt: item.created_at, createdTimestamp: chatDate(item.created_at).timestamp
  };
}

function schedulePrivateMessageSurfaces() {
  refreshPrivateMessageSurfaces();
}

function handleRealtimePrivateMessage(payload) {
  privateMessages = applyRealtimeChange(privateMessages, payload, mapPrivateMessage)
    .sort((a, b) => messageTimestamp(a) - messageTimestamp(b));
  schedulePrivateMessageSurfaces();
  // Text-only events need no signing or second render. Cached signed URLs may
  // resolve immediately, so both updates share the same animation frame.
  if (!privateMessages.some(message => privateAttachmentPath(message.attachmentRef))) return;
  const userId = currentAuthUser?.id;
  const before = privateMessages.map(message => message.attachmentUrl).join("\n");
  void resolvePrivateAttachments({changed: true}).then(() => {
    if (currentAuthUser?.id === userId && before !== privateMessages.map(message => message.attachmentUrl).join("\n")) {
      schedulePrivateMessageSurfaces();
    }
  });
}

// Calendar notices share the transparent header with polls, in a fixed order.
const calendarChatDateFormatter = new Intl.DateTimeFormat("sv-SE", {timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit"});
function renderGroupChatEventNotice() {
  const notice = document.getElementById("groupEventNotice");
  if (!notice) return;
  const now = new Date();
  const upcoming = groupEvents.filter(event => {
    if (event.eventType === "birthday") return false;
    const start = new Date(event.startsAt), end = event.endsAt ? new Date(event.endsAt) : null;
    return Number.isFinite(start.getTime()) && (end && Number.isFinite(end.getTime()) ? end >= now : start >= now);
  }).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const event = upcoming[0];
  notice.hidden = !event;
  if (!event) { notice.replaceChildren(); delete notice.dataset.eventId; return; }
  notice.dataset.eventId = String(event.id);
  const start = new Date(event.startsAt);
  const day = start.toLocaleDateString("es-ES", {timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short", ...(start.getFullYear() !== now.getFullYear() ? {year: "numeric"} : {})});
  const time = start.toLocaleTimeString("es-ES", {timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit"});
  const markup = `<span class="group-event-notice-title">${escapeHtml(event.title)}</span><span class="group-event-notice-date">${escapeHtml(day)} · ${escapeHtml(time)}</span>`;
  if (notice.innerHTML !== markup) notice.innerHTML = markup;
}

async function loadChannelAutomations({visit = false} = {}) {
  if (!db || !currentAuthUser) return;
  const owner = currentAuthUser.id;
  if (visit) await db.rpc("register_chat_channel_visit");
  const {data, error} = await db.from("chat_channel_automation_messages").select("id,channel_id,body,created_at").order("created_at", {ascending: false}).limit(200);
  if (error || owner !== currentAuthUser?.id) return;
  channelAutomationMessages = (data || []).map(item => ({id: `automation:${item.id}`, channelId: item.channel_id, text: item.body, createdAt: item.created_at, createdTimestamp: chatDate(item.created_at).timestamp, systemAnnouncement: true, automation: true}));
  refreshGroupMessageSurfaces();
}
async function loadCalendarChatAnnouncements({sync = true} = {}) {
  if (!backendReady || !currentAuthUser) return;
  if (calendarChatRequest) return calendarChatRequest;
  const owner = currentAuthUser.id;
  const request = (async () => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const today = calendarChatDateFormatter.format(new Date());
      if (sync && calendarChatSyncDay !== `${owner}:${today}`) {
        const {error} = await db.rpc("sync_calendar_chat").abortSignal(controller.signal);
        if (!error && owner === currentAuthUser?.id) calendarChatSyncDay = `${owner}:${today}`;
      }
      const {data, error} = await db.from("calendar_chat_announcements")
        .select("id,channel_id,body,created_at").order("created_at", {ascending: false}).limit(200).abortSignal(controller.signal);
      if (error || owner !== currentAuthUser?.id) return;
      const next = (data || []).map(item => ({id: `calendar:${item.id}`, channelId: item.channel_id, text: item.body, createdAt: item.created_at, createdTimestamp: chatDate(item.created_at).timestamp, systemAnnouncement: true}));
      if (JSON.stringify(next) !== JSON.stringify(calendarChatAnnouncements)) {
        calendarChatAnnouncements = next;
        refreshGroupMessageSurfaces();
      }
    } catch { /* The normal chat stays available while the calendar service reconnects. */ }
    finally { clearTimeout(timeout); }
  })();
  calendarChatRequest = request;
  try { await request; } finally { if (calendarChatRequest === request) calendarChatRequest = null; }
}

async function loadGroupEvents() {
  const {data, error} = await db.from("group_events").select("*").order("starts_at");
  if (error) {
    if (!homeEventsReady) {
      const agendaLabel = document.querySelector("#clubhouseContent .clubhouse-plan strong");
      if (agendaLabel) agendaLabel.textContent = "No se pudo cargar la agenda";
    }
    return;
  }
  homeEventsReady = true;
  groupEvents = data.map(item => ({
    id: item.id, title: item.title, description: item.description, startsAt: item.starts_at,
    endsAt: item.ends_at, location: item.location, createdBy: item.created_by,
    eventType: item.event_type || "event", annual: Boolean(item.annual)
  }));
  renderCalendar();
  renderGroupChatEventNotice();
  globalThis.GroupInteractions?.refreshPlan(groupEvents);
  void loadCalendarChatAnnouncements();
  if (activeCalendarDay && document.getElementById("calendarDayModal").classList.contains("open")) openCalendarDay(activeCalendarDay);
}

async function loadSiteSettings() {
  const settingsOwner = currentAuthUser?.id;
  if (!settingsOwner) return;
  const settingsController = new AbortController();
  const settingsTimeout = setTimeout(() => settingsController.abort(), 15000);
  let settingsResult;
  try { settingsResult = await db.from("site_settings").select("key,value").abortSignal(settingsController.signal); }
  finally { clearTimeout(settingsTimeout); }
  const {data, error} = settingsResult;
  if (currentAuthUser?.id !== settingsOwner) return;
  if (error) {
    if (!homeSettingsReady) document.getElementById("spotifyPlayer").innerHTML = '<div class="home-loading-state" role="status">No se pudo cargar la playlist. Comprueba la conexión.</div>';
    return;
  }
  homeSettingsReady = true;
  siteSettings = Object.fromEntries(data.map(item => [item.key, item.value]));
  adminConsole?.apply(siteSettings);
  adminConsole?.sync();
  accountRequests?.sync();
  renderSpotify();
  renderGroupAvatarSurfaces();
  scheduleChatSurfaces();
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
      if (["administracion", "admin-cuentas"].some(id => document.getElementById(id)?.classList.contains("active"))) renderAdminPanel();
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
    .on("postgres_changes", {event: "INSERT", schema: "public", table: "chat_channel_automation_messages"}, () => scheduleRealtimeRefresh("channel-automations", () => loadChannelAutomations()))
    .on("postgres_changes", {event: "*", schema: "public", table: "calendar_chat_announcements"}, () => scheduleRealtimeRefresh("calendar-chat", () => loadCalendarChatAnnouncements({sync: false})))
    .on("postgres_changes", {event: "*", schema: "public", table: "messages"}, handleRealtimeMessage)
    .subscribe();
  const notificationOwner = currentAuthUser.id;
  notificationsChannel = db.channel(`notifications-${currentAuthUser.id}`)
    .on("postgres_changes", {event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${currentAuthUser.id}`}, payload => {
      if (notificationOwner === currentAuthUser?.id) handleRealtimeNotification(payload);
    })
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
  let achievementsRealtimeSubscribedOnce = false;
  achievementsRealtime = db.channel("achievements-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "achievements"}, () => {
      scheduleRealtimeRefresh("achievements", () => loadAchievements({force: true}), 100);
    })
    .on("postgres_changes", {event: "*", schema: "public", table: "achievement_awards"}, () => {
      scheduleRealtimeRefresh("achievements", () => loadAchievements({force: true}), 100);
    })
    .on("postgres_changes", {event: "*", schema: "public", table: "achievement_rules"}, () => {
      scheduleRealtimeRefresh("achievement-visit", () => refreshDailyParticipation(true), 60);
      scheduleRealtimeRefresh("achievements", () => loadAchievements({force: true}), 100);
    })
    .on("postgres_changes", {event: "*", schema: "public", table: "achievement_progress", filter: `user_id=eq.${currentAuthUser.id}`}, () => {
      scheduleRealtimeRefresh("achievements", () => loadAchievements({force: true}), 100);
    })
    .subscribe(status => {
      // Reconnects recover activity missed while the app was asleep/offline.
      if (status === "SUBSCRIBED") {
        const reconnecting = achievementsRealtimeSubscribedOnce;
        achievementsRealtimeSubscribedOnce = true;
        if (reconnecting || (!achievementsLoaded && !achievementsLoading)) {
          scheduleRealtimeRefresh("achievement-visit", () => refreshDailyParticipation(true), 60);
          scheduleRealtimeRefresh("achievements", () => loadAchievements({force: reconnecting}), 100);
        }
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

async function prepareChatImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 500000) return file;
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = objectUrl; await image.decode();
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", .85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {type: "image/webp"}) : file;
  } catch { return file; }
  finally { URL.revokeObjectURL(objectUrl); }
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
  renderChatSendStatus(kind);
}

let chatGalleryPlugin;
let chatGalleryOpening = false;
let chatAttachmentMenu = null;

function closeChatAttachmentMenu(restoreFocus = false) {
  if (!chatAttachmentMenu) return;
  const {menu, trigger} = chatAttachmentMenu;
  menu.remove();
  trigger.setAttribute("aria-expanded", "false");
  chatAttachmentMenu = null;
  if (restoreFocus) trigger.focus({preventScroll: true});
}

function positionChatAttachmentMenu() {
  if (!chatAttachmentMenu) return;
  const {menu, trigger} = chatAttachmentMenu;
  if (trigger.disabled || !trigger.getClientRects().length) { closeChatAttachmentMenu(); return; }
  const anchor = trigger.getBoundingClientRect();
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0;
  const top = viewport?.offsetTop || 0;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;
  menu.style.left = `${Math.max(left + 12, Math.min(anchor.right - menu.offsetWidth, left + width - menu.offsetWidth - 12))}px`;
  menu.style.top = `${Math.max(top + 12, Math.min(anchor.top - menu.offsetHeight - 10, top + height - menu.offsetHeight - 12))}px`;
}

function toggleChatAttachmentMenu(kind, trigger) {
  const wasOpen = chatAttachmentMenu?.trigger === trigger;
  closeChatAttachmentMenu();
  if (wasOpen || trigger.disabled) return;
  const menu = document.createElement("div");
  menu.className = "chat-attachment-menu";
  menu.id = "chatAttachmentActions";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Adjuntar al mensaje");
  menu.innerHTML = `<button type="button" role="menuitem" data-attachment-action="file"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 14h8M8 17h5"/></svg><span>Subir archivo</span></button><button type="button" role="menuitem" data-attachment-action="gif"><span class="chat-gif-label" aria-hidden="true">GIF</span><span>GIFs</span></button>${kind === "private" || (chatChannels.find(channel => String(channel.id) === String(activeChatChannelId))?.readOnly && !canManageSite()) ? "" : `<button type="button" role="menuitem" data-attachment-action="poll"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V11m7 9V4m7 16v-6"/></svg><span>Encuesta</span></button>`}`;
  document.body.append(menu);
  trigger.setAttribute("aria-controls", menu.id);
  trigger.setAttribute("aria-expanded", "true");
  chatAttachmentMenu = {menu, trigger};
  positionChatAttachmentMenu();
  menu.addEventListener("click", event => {
    const item = event.target.closest("[data-attachment-action]");
    if (!item) return;
    const action = item.dataset.attachmentAction;
    closeChatAttachmentMenu();
    if (action === "poll" && kind !== "private") {
      globalThis.GroupInteractions?.openPollComposer(activeChatChannelId);
      return;
    }
    const prefix = kind === "private" ? "privateMessage" : "message";
    const picker = document.getElementById(`${prefix}${action === "gif" ? "GifAttachment" : "Attachment"}`);
    picker.value = "";
    picker.click();
  });
  menu.addEventListener("keydown", event => {
    const items = [...menu.querySelectorAll('[role="menuitem"]')];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const current = items.indexOf(document.activeElement);
      items[(current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus({preventScroll: true});
    } else if (event.key === "Tab") closeChatAttachmentMenu();
  });
  menu.querySelector("button").focus({preventScroll: true});
}

document.addEventListener("pointerdown", event => {
  if (chatAttachmentMenu && !chatAttachmentMenu.menu.contains(event.target) && !chatAttachmentMenu.trigger.contains(event.target)) closeChatAttachmentMenu();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && chatAttachmentMenu) { event.preventDefault(); closeChatAttachmentMenu(true); }
});
window.addEventListener("resize", positionChatAttachmentMenu);
window.visualViewport?.addEventListener("resize", positionChatAttachmentMenu);
window.visualViewport?.addEventListener("scroll", positionChatAttachmentMenu);

async function openChatGallery(kind) {
  closeChatAttachmentMenu();
  if (!window.Capacitor?.isPluginAvailable?.("ClubGallery")) {
    const picker = attachmentContext(kind).mediaInput;
    picker.value = "";
    picker.click();
    return;
  }
  if (chatGalleryOpening) return;
  chatGalleryOpening = true;
  const conversation = kind === "private" ? activePrivateMemberId : activeChatChannelId;
  let picked;
  try {
    chatGalleryPlugin ||= window.Capacitor.registerPlugin("ClubGallery");
    picked = await chatGalleryPlugin.pickMedia();
    if (picked.cancelled || !picked.path) return;
    const response = await fetch(window.Capacitor.convertFileSrc(picked.path));
    if (!response.ok) throw new Error("No se pudo cargar el archivo de la galería.");
    const blob = await response.blob();
    // A gallery selection belongs to the conversation that opened it.
    if (conversation !== (kind === "private" ? activePrivateMemberId : activeChatChannelId)) return;
    setPendingChatFile(kind, new File([blob], picked.name || "Galería.jpg", {type: picked.type || blob.type, lastModified: Date.now()}));
  } catch (error) {
    if (error.code === "PHOTO_PERMISSION_DENIED") {
      if (window.confirm("La galería necesita permiso para acceder a tus fotos. ¿Quieres abrir los ajustes de Big Boy para activarlo?")) await chatGalleryPlugin.openSettings();
    } else window.alert(error.message || "No se pudo abrir la galería. Inténtalo de nuevo.");
  } finally {
    if (picked?.path) await chatGalleryPlugin.releaseFile({path: picked.path}).catch(() => {});
    chatGalleryOpening = false;
  }
}

function selectChatGif(kind, input) {
  const file = input.files[0];
  if (!file) return;
  if (file.type !== "image/gif" && !/\.gif$/i.test(file.name)) {
    input.value = "";
    window.alert("Elige un archivo GIF animado.");
    return;
  }
  setPendingChatFile(kind, file.type === "image/gif" ? file : new File([file], file.name, {type: "image/gif", lastModified: file.lastModified}));
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

function cancelActiveAudioRecording() {
  if (activeAudioRecording) cancelAudioRecording(activeAudioRecording.kind);
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

async function sendMessage(text, file = null, attempt = {}) {
  if (!db || !currentAuthUser) throw new Error("Vuelve a iniciar sesión para enviar el mensaje.");
  const channelId = attempt.destination ?? activeChatChannelId;
  if (chatChannels.find(channel => String(channel.id) === String(channelId))?.readOnly && !canManageSite()) throw new Error("Esta sección es solo de lectura.");
  let attachmentUrl = null;
  if (file) {
    attempt.phase?.("Preparando archivo…");
    file = attempt.preparedFile ||= await prepareChatImage(file);
    attempt.phase?.("Subiendo archivo…");
    attachmentUrl = attempt.attachmentUrl ||= await uploadGroupMedia(file, "chat");
  }
  attempt.phase?.("Enviando mensaje…");
  const {data, error} = await db.from("messages").insert({
    user_id: currentAuthUser.id, legacy_id: currentUser.id, channel_id: channelId, body: text, reply_to_id: attempt.replyToId || null,
    attachment_url: attachmentUrl, attachment_name: file?.name || null,
    attachment_type: file?.type || null, attachment_size: file?.size || null
  }).select("id,user_id,legacy_id,channel_id,body,reply_to_id,attachment_url,attachment_name,attachment_type,attachment_size,created_at").single();
  if (error) throw error;
  dispatchPush("group_message", data.id);
  globalThis.DailyPacks?.activityCompleted?.('message');
  return mapMessage(data);
}

let editingChatChannel = null;
let channelEditorRequest = 0;
function closeChannelEditor() {
  channelEditorRequest++;
  restoreGroupConversation(activeChatChannelId);
}
async function createChatChannel(channelId = null) {
  if (!canManageSite() || !currentAuthUser || !db) return;
  const channel = chatChannels.find(item => String(item.id) === String(channelId));
  globalThis.ClubDrafts?.flush();
  editingChatChannel = channel || null;
  const request = ++channelEditorRequest;
  const form = document.getElementById("channelSetupForm");
  form.reset();
  form.elements.channelName.value = channel?.name || "";
  form.elements.description.value = channel?.description || "";
  form.elements.readOnly.checked = Boolean(channel?.readOnly);
  document.getElementById("channelSetupTitle").textContent = channel ? "Configurar sección" : "Nueva sección";
  document.getElementById("channelSetupStatus").textContent = "";
  form.querySelector('[type="submit"]').disabled = Boolean(channel);
  updateChannelSetupFields();
  goTo("seccion-chat");
  if (channel) {
    const {data, error} = await db.from("chat_channel_automations").select("*").eq("channel_id", channel.id);
    if (request !== channelEditorRequest) return;
    if (error) {
      document.getElementById("channelSetupStatus").textContent = "No se pudieron cargar las automatizaciones. Vuelve a abrir la sección para no sobrescribirlas.";
      return;
    }
    for (const rule of data || []) {
      const group = form.querySelector(`[data-automation="${rule.kind}"]`);
      if (!group) continue;
      group.querySelector('[data-rule="enabled"]').checked = rule.enabled;
      group.querySelector('[data-rule="body"]').value = rule.body;
      if (rule.kind === "once") {
        const date = new Date(rule.scheduled_at);
        group.querySelector('[data-rule="date"]').value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
      }
      if (rule.kind === "recurring") {
        group.querySelector('[data-rule="cadence"]').value = rule.cadence;
        group.querySelector('[data-rule="weekday"]').value = rule.weekday;
        group.querySelector('[data-rule="time"]').value = rule.local_time.slice(0,5);
      }
    }
  }
  globalThis.ClubDrafts?.begin("channelSetupForm", channel ? `channel:${channel.id}` : "new", {reopen:true});
  form.querySelector('[type="submit"]').disabled = false;
  updateChannelSetupFields();
}
function updateChannelSetupFields() {
  document.querySelectorAll("#channelSetupForm [data-automation]").forEach(group => {
    const enabled = group.querySelector('[data-rule="enabled"]').checked;
    group.classList.toggle("is-enabled", enabled);
    group.querySelectorAll(".channel-rule-fields input, .channel-rule-fields textarea, .channel-rule-fields select").forEach(input => {
      input.disabled = !enabled;
      input.required = enabled && input.dataset.rule !== "weekday";
    });
    const weekday = group.querySelector('[data-rule="weekday"]');
    if (weekday) weekday.closest("label").hidden = group.querySelector('[data-rule="cadence"]').value !== "weekly";
  });
}
async function saveChatChannel(event) {
  event.preventDefault();
  if (!canManageSite() || !currentAuthUser) return;
  const request = channelEditorRequest, owner = currentAuthUser.id;
  const draftToken = globalThis.ClubDrafts?.token("channelSetupForm");
  const form = event.currentTarget, status = document.getElementById("channelSetupStatus"), submit = form.querySelector('[type="submit"]');
  const name = form.elements.channelName.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0,32);
  if (!name) { status.textContent = "Escribe un nombre para la sección."; return; }
  const rules = [...form.querySelectorAll("[data-automation]")].map(group => {
    const value = key => group.querySelector(`[data-rule="${key}"]`)?.value;
    return {kind: group.dataset.automation, enabled: group.querySelector('[data-rule="enabled"]').checked, body: value("body")?.trim() || "", scheduled_at: value("date") ? new Date(value("date")).toISOString() : null, cadence: value("cadence") || "daily", weekday: Number(value("weekday") || 1), local_time: value("time") || "09:00"};
  });
  if (rules.some(rule => rule.enabled && (!rule.body || (rule.kind === "once" && (!rule.scheduled_at || Date.parse(rule.scheduled_at) <= Date.now()))))) {
    status.textContent = "Añade el texto de los mensajes activos y una fecha futura para el envío único."; return;
  }
  submit.disabled = true; status.textContent = "Guardando sección…";
  try {
    const {data, error} = await db.rpc("save_chat_channel_configuration", {p_id: editingChatChannel?.id || null, p_name: name, p_description: form.elements.description.value.trim(), p_read_only: form.elements.readOnly.checked, p_rules: rules});
    if (error) throw error;
    await loadChatChannels();
    if (request !== channelEditorRequest || owner !== currentAuthUser?.id) return;
    globalThis.ClubDrafts?.clear("channelSetupForm", draftToken);
    activeChatChannelId = data; closeChannelEditor(); selectChatChannel(data);
  } catch (error) { if (request !== channelEditorRequest || owner !== currentAuthUser?.id) return; status.textContent = error.code === "23505" ? "Ya hay una sección con este nombre." : error.message || "No se pudo guardar. Inténtalo de nuevo."; }
  finally { if (request === channelEditorRequest) submit.disabled = false; }
}

async function deleteChatChannel(id) {
  const channel = chatChannels.find(item => String(item.id) === String(id));
  if (!canManageSite() || !channel || channel.isDefault) return;
  if (!window.confirm(`¿Eliminar la sección #${channel.name} y todos sus mensajes?`)) return;
  const {error} = await db.from("chat_channels").delete().eq("id", channel.id);
  if (error) window.alert(error.message || "No se pudo eliminar la sección.");
  else await loadChatChannels();
}

async function sendPrivateMessage(text, file = null, attempt = {}) {
  const recipient = getMember(attempt.destination ?? activePrivateMemberId);
  if (!recipient?.authId || !currentAuthUser) throw new Error("No se ha seleccionado un destinatario.");
  let attachmentUrl = null;
  if (file) {
    attempt.phase?.("Preparando archivo…");
    file = attempt.preparedFile ||= await prepareChatImage(file);
    attempt.phase?.("Subiendo archivo…");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${currentAuthUser.id}/${crypto.randomUUID()}-${safeName}`;
    validateFileSize(file, FILE_LIMITS.attachment);
    if (!attempt.attachmentUrl) {
      const {error: uploadError} = await db.storage.from("private-chat").upload(path, file, {contentType: file.type, cacheControl: "3600"});
      if (uploadError) throw uploadError;
      attempt.attachmentUrl = `storage://private-chat/${path}`;
    }
    attachmentUrl = attempt.attachmentUrl;
  }
  attempt.phase?.("Enviando mensaje…");
  const {data, error} = await db.from("private_messages").insert({
    sender_id: currentAuthUser.id, recipient_id: recipient.authId, body: text, reply_to_id: attempt.replyToId || null,
    attachment_url: attachmentUrl, attachment_name: file?.name || null,
    attachment_type: file?.type || null, attachment_size: file?.size || null
  }).select("id,sender_id,recipient_id,body,reply_to_id,attachment_url,attachment_name,attachment_type,attachment_size,created_at").single();
  if (error) throw error;
  dispatchPush("private_message", data.id);
  const message = mapPrivateMessage(data);
  if (privateAttachmentPath(message.attachmentUrl)) {
    // Delivery has already succeeded. A temporary preview signing failure must
    // never present the message as failed and invite a duplicate retry.
    try {
      const {data: signed} = await db.storage.from("private-chat").createSignedUrl(privateAttachmentPath(message.attachmentUrl), 3600);
      if (signed?.signedUrl) message.attachmentUrl = signed.signedUrl;
    } catch { /* The attachment renderer can request a fresh signed URL. */ }
  }
  return message;
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
      }).select("id,user_id,legacy_id,channel_id,body,reply_to_id,attachment_url,attachment_name,attachment_type,attachment_size,created_at").single();
      if (error) throw error;
      if (!messages.some(message => String(message.id) === String(data.id))) messages.push(mapMessage(data));
      globalThis.DailyPacks?.activityCompleted?.('message');
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
      }).select("id,sender_id,recipient_id,body,reply_to_id,attachment_url,attachment_name,attachment_type,attachment_size,created_at").single();
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
  const type = document.getElementById("eventType");
  const birthday = type.value === "birthday";
  const editing = Boolean(document.getElementById("eventId").value);
  document.getElementById("eventEditor").classList.toggle("is-birthday", birthday);
  document.getElementById("eventEditorTitle").textContent = birthday ? (editing ? "Tu cumpleaños" : "Una fecha especial.") : (editing ? "Editar el plan" : "Hagamos un plan.");
  document.getElementById("eventEditorIntro").textContent = birthday ? "Que nadie se olvide de celebrarlo contigo." : "Pon fecha al próximo encuentro del club.";
  document.getElementById("eventTitleLabel").textContent = birthday ? "¿A quién celebramos?" : "¿Qué vamos a hacer?";
  document.getElementById("eventTitle").placeholder = birthday ? "Cumpleaños de…" : "Cena, escapada, partido…";
  document.getElementById("eventDescription").placeholder = birthday ? "Una nota para el club, si te apetece" : "Todo lo que el grupo necesita saber";
  document.getElementById("eventSaveButton").textContent = editing ? "Guardar cambios" : birthday ? "Guardar cumpleaños" : "Crear plan";
  document.querySelectorAll("[data-event-kind]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.eventKind === type.value));
    button.disabled = type.disabled;
  });
  document.getElementById("birthdayDateField").hidden = !birthday;
  document.getElementById("birthdayAllDayNote").hidden = !birthday;
  document.getElementById("eventDateFields").hidden = birthday;
  document.getElementById("eventStartsAt").required = !birthday;
  document.getElementById("birthdayDate").required = birthday;
  document.getElementById("eventLocation").closest("label").hidden = birthday;
}

// The editor scrolls inside the keyboard-sized viewport. Never move the whole page
// to reveal a field: that also moves the fixed dialog in WKWebView.
function syncEventEditorViewport() {
  const modal = document.getElementById("eventEditor");
  if (!modal?.classList.contains("open")) return;
  const nativeLayout = window.__bigboysNativeKeyboardLayout === true;
  const viewport = window.visualViewport;
  setViewportProperty(modal, "--event-editor-height", `${nativeLayout ? window.innerHeight : viewport?.height || window.innerHeight}px`);
  setViewportProperty(modal, "--event-editor-offset", `${nativeLayout ? 0 : viewport?.offsetTop || 0}px`);
  const field = document.activeElement;
  const scroller = modal.querySelector(".calendar-editor");
  if (!field?.matches?.("input:not([type=hidden]),textarea,select") || !scroller.contains(field)) return;
  const frame = scroller.getBoundingClientRect();
  const bounds = field.getBoundingClientRect();
  const padding = 16;
  const top = frame.top + padding;
  const bottom = frame.bottom - padding;
  if (bounds.bottom > bottom) scroller.scrollTop += bounds.bottom - bottom;
  else if (bounds.top < top) scroller.scrollTop -= top - bounds.top;
}

function openEventEditor(eventId = null, requestedType = "event") {
  globalThis.ClubDrafts?.flush();
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
  globalThis.ClubDrafts?.begin("eventForm", event ? `event:${event.id}` : `new:${eventType}`, {reopen:true});
  updateEventEditorType();
  const modal = document.getElementById("eventEditor");
  document.body.classList.add("event-editor-open");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  syncMobileViewport();
}

function closeEventEditor() {
  const modal = document.getElementById("eventEditor");
  if (modal.contains(document.activeElement)) document.activeElement.blur();
  document.body.classList.remove("event-editor-open");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

async function saveEvent(form) {
  const draftToken = globalThis.ClubDrafts?.token(form.id);
  const feedback = document.getElementById("eventFeedback");
  const submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  feedback.textContent = "Guardando…";
  submit.textContent = "Guardando…";
  form.setAttribute("aria-busy", "true");
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
    if (eventType !== "birthday" && values.ends_at && new Date(values.ends_at) < new Date(values.starts_at)) throw new Error("La hora de finalización debe ser posterior al inicio.");
    const query = id ? db.from("group_events").update(values).eq("id", id) : db.from("group_events").insert(values);
    const {data: savedEvent, error} = await query.select("id").single();
    if (error) throw error;
    if (!id && savedEvent?.id) void dispatchPush("event_created", String(savedEvent.id));
    globalThis.ClubDrafts?.clear("eventForm", draftToken);
    closeEventEditor();
    await loadGroupEvents();
  } catch (error) {
    feedback.textContent = error.message || "No se pudo guardar el evento.";
  } finally {
    submit.disabled = false;
    form.removeAttribute("aria-busy");
    updateEventEditorType();
  }
}

async function deleteEvent() {
  const id = document.getElementById("eventId").value;
  const event = groupEvents.find(item => String(item.id) === String(id));
  if (!id || !canEditCalendarEvent(event)) return;
  const {error} = await db.from("group_events").delete().eq("id", id);
  if (!error) {
    globalThis.ClubDrafts?.clear("eventForm");
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
  globalThis.ClubDrafts?.flush();
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
  preview.innerHTML = profile.avatarUrl ? `<img src="${escapeHtml(profile.avatarUrl)}" alt="" referrerpolicy="no-referrer">` : profile.name.charAt(0);
  globalThis.ClubDrafts?.begin("profileForm", `profile:${profile.id}`, {reopen:true});
  document.getElementById("bioCount").textContent = document.getElementById("profileBio").value.length;
  globalThis.ClubMotion?.mount(document.getElementById("profileForm"));
  const motionPreference = document.querySelector("#profileForm .motion-preference");
  if (motionPreference) motionPreference.hidden = managingAnotherUser;
  const modal = document.getElementById("profileEditor");
  modal.classList.toggle("admin-member-editor", managingAnotherUser);
  globalThis.BannerShop?.openEditor(!managingAnotherUser);
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
  globalThis.BannerShop?.closeEditor();
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
  const draftToken = globalThis.ClubDrafts?.token(form.id);
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
        // An older in-flight read must not undo the confirmed rename.
        profileLoadGeneration += 1;
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
    if (profile.id === currentUser.id) {
      Object.assign(currentUser, updates);
    }
    if (!backendReady) persistLocalProfile(profile);
    refreshProfileSurfaces();
    renderProfile(profile.id);
    globalThis.ClubDrafts?.clear("profileForm", draftToken);
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
  const isAdmin = canManageSite();
  let requestsQuery = db.from("help_requests").select("*").order("updated_at", {ascending: false}).limit(250);
  if (!isAdmin) requestsQuery = requestsQuery.eq("user_id", currentAuthUser.id);
  const requestResult = await requestsQuery;
  let messageResult = {data: [], error: null};
  if (!requestResult.error) {
    const requestIds = (requestResult.data || []).map(item => item.id);
    if (isAdmin) {
      messageResult = await db.from("help_messages").select("*").order("created_at").limit(1000);
    } else if (requestIds.length) {
      messageResult = await db.from("help_messages").select("*").in("request_id", requestIds).order("created_at").limit(1000);
    }
  }
  if (requestResult.error || messageResult.error) {
    const list = document.getElementById("helpRequestList");
    if (list) list.innerHTML = `<div class="empty-state compact"><strong>No se pudo abrir Ayuda</strong><span>${escapeHtml(requestResult.error?.message || messageResult.error?.message || "Inténtalo de nuevo.")}</span></div>`;
    helpCenterLoading = false;
    return;
  }
  helpCenterLoaded = true;
  const visibleRequests = isAdmin
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
  globalThis.ClubDrafts?.begin("helpReplyForm", active ? `request:${active.id}` : null);
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
  const draftToken = globalThis.ClubDrafts?.token(form.id);
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
    globalThis.ClubDrafts?.clear("helpRequestForm", draftToken);
    if (globalThis.ClubDrafts?.token(form.id) === draftToken) form.reset();
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
  const draftToken = globalThis.ClubDrafts?.token(form.id);
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
  globalThis.ClubDrafts?.clear("helpReplyForm", draftToken);
  if (globalThis.ClubDrafts?.token(form.id) === draftToken) form.reset();
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
  if (!db || (action === "change-password" ? !currentAuthUser?.id : !canManageSite())) throw new Error("No tienes permiso para esta operación.");
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
    const policyError = passwordValidationError(document.getElementById("newUserPassword").value, document.getElementById("newDisplayName").value, document.getElementById("newUsername").value);
    if (policyError) throw new Error(policyError);
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
  const password = window.prompt(`Escribe la nueva contraseña provisional para ${name} (8–128 caracteres, un símbolo y sin su nombre):`);
  if (password == null) return;
  const confirmation = window.prompt("Repítela para confirmar:");
  const target = members.find(member => member.authId === authId);
  const policyError = passwordValidationError(password, target?.name || name, target?.username);
  if (policyError || password !== confirmation) return window.alert(policyError || "Las contraseñas no coinciden.");
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
  const feedback = (state, message, retry) => globalThis.ClubFeedback?.set(grid, state, message, retry);
  feedback("loading", force ? "Actualizando noticias…" : "Cargando noticias…");
  const cacheKey = `bb-news-visual-${activeNewsCategory}`;
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
  const cacheAge = cachedNews?.savedAt ? Date.now() - cachedNews.savedAt : Infinity;
  if (cachedNews?.items?.length) {
    lastNewsRefreshAt = cachedNews.savedAt;
    renderNews(cachedNews.items, cachedNews.feedTitle, cachedNews.savedAt);
    if (!force && cacheAge < NEWS_CACHE_DURATION) return;
    // Keep useful headlines on screen while the edge function refreshes RSS.
    status.textContent = "Actualizando titulares…";
    grid.setAttribute("aria-busy", "true");
  } else {
    grid.innerHTML = `<div class="news-loading" aria-hidden="true">${[0, 1, 2].map(index => `<div class="news-skeleton ${index === 0 ? "news-skeleton-lead" : ""}"><i></i><span></span><span></span><span></span></div>`).join("")}</div>`;
    grid.setAttribute("aria-busy", "true");
    status.textContent = "Preparando la actualidad…";
  }
  if (!backendReady || !db || !currentAuthUser) {
    feedback("error", "Las noticias estarán disponibles al iniciar sesión.");
    status.textContent = "Las noticias se cargarán al iniciar sesión.";
    if (!cachedNews?.items?.length) grid.innerHTML = "";
    grid.removeAttribute("aria-busy");
    return;
  }
  try {
    const {data, error} = await db.functions.invoke("news-feed", {body: {category: activeNewsCategory}});
    if (error) throw new Error(error.context?.body?.error || error.message || "El servicio de noticias no responde.");
    if (!data?.items?.length) throw new Error(data?.error || "No se recibieron titulares.");
    const combined = data.items.map(item => ({
      title: item.title, link: safeNewsUrl(item.link), published: item.published,
      source: item.source || extractNewsSource(item.title), image: safeNewsUrl(item.image), summary: item.summary || ""
    }));
    const seenNews = new Set();
    const items = combined.sort((a, b) => newsTimestamp(b.published) - newsTimestamp(a.published)).filter(item => {
      const key = normalizeUsername(item.title.replace(/\s+-\s+[^-]+$/, ""));
      if (!key || !item.link || seenNews.has(key)) return false;
      seenNews.add(key);
      return true;
    }).slice(0, 30);
    if (requestToken !== newsLoadToken || requestedCategory !== activeNewsCategory) return;
    const savedAt = Date.now();
    lastNewsRefreshAt = savedAt;
    const feedTitle = `${data.sources || 1} fuentes de actualidad`;
    try { sessionStorage.setItem(cacheKey, JSON.stringify({savedAt, items, feedTitle})); } catch {}
    renderNews(items, feedTitle, savedAt);
  } catch (error) {
    if (requestToken !== newsLoadToken || requestedCategory !== activeNewsCategory) return;
    if (cachedNews?.items?.length) {
      renderNews(cachedNews.items, cachedNews.feedTitle, cachedNews.savedAt);
      feedback("error", "No se pudo actualizar. Mostramos las últimas noticias.", () => void loadNews(true));
      return;
    }
    grid.removeAttribute("aria-busy");
    status.textContent = "";
    feedback("error", "No se pudieron cargar las noticias. Comprueba la conexión.", () => void loadNews(true));
    grid.innerHTML = `<div class="empty-state"><strong>Sin titulares disponibles</strong><span>Inténtalo de nuevo en unos minutos.</span></div>`;
  }
}

function extractNewsSource(title) {
  const parts = title.split(" - ");
  return parts.length > 1 ? parts.pop() : "Medio de comunicación";
}

function safeNewsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

function newsArtwork(category) {
  const artwork = {
    deportes: '<circle cx="180" cy="95" r="59"/><path d="m180 67 27 20-10 31h-34l-10-31 27-20ZM137 55l11 21M224 55l-12 21M124 119l25-2M236 119l-25-2M165 151l4-25M196 151l-4-25"/>',
    espana: '<path d="M100 156V85h34V56h32v100M188 156V33h35v123M245 156V96h28v60M87 157h199M142 69h12M142 88h12M200 51h12M200 71h12M200 91h12M200 111h12"/>',
    mundo: '<circle cx="180" cy="95" r="62"/><ellipse cx="180" cy="95" rx="26" ry="62"/><path d="M118 95h124M128 62h104M128 128h104"/>'
  };
  return `<svg viewBox="0 0 360 190" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2">${artwork[category] || artwork.mundo}</g></svg>`;
}

// Keep genuine photos and editorial category artwork distinct, including failed image loads.
document.addEventListener("error", event => {
  if (!(event.target instanceof HTMLImageElement) || !event.target.matches("[data-news-photo]")) return;
  const media = event.target.closest(".news-media");
  event.target.remove();
  media?.classList.remove("has-photo");
}, true);

function renderNews(items, feedTitle, refreshedAt = Date.now()) {
  // A bounded first view keeps DOM creation and image painting predictable on mobile.
  const sortedItems = [...items].filter(item => safeNewsUrl(item.link)).sort((a, b) => newsTimestamp(b.published) - newsTimestamp(a.published)).slice(0, 24);
  newsItems = sortedItems;
  void registerNewsNotification(sortedItems);
  const sourceCount = new Set(sortedItems.map(item => item.source)).size;
  document.getElementById("newsStatus").textContent = `Actualizado ${formatRelativeTime(refreshedAt).toLowerCase()} · ${sourceCount} ${sourceCount === 1 ? "medio" : "medios"} · Actualización automática`;
  const grid = document.getElementById("newsGrid");
  globalThis.ClubFeedback?.set(grid, "ready", "");
  grid.removeAttribute("aria-busy");
  const categoryName = {deportes: "Deportes", espana: "España", mundo: "Mundo"}[activeNewsCategory] || "Actualidad";
  grid.innerHTML = sortedItems.map((item, index) => {
    const source = item.source || "Medio de comunicación";
    const cleanTitle = item.title.endsWith(` - ${source}`) ? item.title.slice(0, -(source.length + 3)) : item.title;
    item.cleanTitle = cleanTitle;
    const publishedTimestamp = newsTimestamp(item.published);
    const dateTime = publishedTimestamp ? new Date(publishedTimestamp).toISOString() : "";
    const image = safeNewsUrl(item.image);
    const summary = String(item.summary || "").replace(/<[^>]*>/g, "").trim();
    const cardClass = index === 0 ? "news-lead" : index < 3 ? "news-support" : "news-latest";
    const media = `<div class="news-media ${image ? "has-photo" : ""}">
      <div class="news-artwork">${newsArtwork(activeNewsCategory)}<span>${escapeHtml(categoryName)} · Actualidad</span></div>
      ${image ? `<img data-news-photo src="${escapeHtml(image)}" alt="Imagen publicada por ${escapeHtml(source)}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" referrerpolicy="no-referrer">` : ""}
      ${index === 0 ? `<span class="news-lead-label">En portada</span>` : ""}</div>`;
    return `${index === 3 ? '<div class="news-latest-heading"><span>Última hora</span><i></i></div>' : ""}<article class="news-card ${cardClass}">
      <a class="news-media-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" aria-label="Leer: ${escapeHtml(cleanTitle)}">${media}</a>
      <div class="news-card-body"><div class="news-card-meta"><span>${escapeHtml(source)}</span><time${dateTime ? ` datetime="${dateTime}"` : ""}>${escapeHtml(formatNewsDate(item.published))}</time></div>
      <h3><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(cleanTitle)}</a></h3>
      ${summary && index < 3 && summary !== cleanTitle ? `<p class="news-summary">${escapeHtml(summary)}</p>` : ""}
      <div class="news-card-actions"><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">Leer noticia</a>${!isSuperAdmin() ? `<button class="media-share-button news-share-button" type="button" data-share-news="${index}" aria-label="Compartir: ${escapeHtml(cleanTitle)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></svg></button>` : ""}</div></div>
    </article>`;
  }).join("") || '<div class="empty-state"><strong>Sin titulares disponibles</strong><span>Actualiza para consultar las últimas noticias.</span></div>';
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
  const metadata = chatDate(value);
  return metadata.title ??= metadata.day ? messageDateFormatter.format(metadata.date) : "Invalid Date";
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
  if (event.target.closest("[data-profile-back]")) { backFromMemberProfile(); return; }
  const chatBack = event.target.closest("[data-chat-back]");
  if (chatBack) exitChatView();
  const privateBack = event.target.closest("[data-private-back]");
  if (privateBack) backFromPrivateConversation();
  const imageTarget = event.target.closest("[data-chat-image]");
  if (imageTarget) {
    event.preventDefault();
    if (imageTarget.classList.contains("image-failed")) startChatThumbnail(imageTarget.querySelector("[data-chat-thumbnail]"));
    else openChatImageViewer(imageTarget);
    return;
  }
  const shareNewsTarget = event.target.closest("[data-share-news]");
  if (shareNewsTarget) {
    event.preventDefault();
    event.stopPropagation();
    openShareNews(shareNewsTarget.dataset.shareNews);
    return;
  }
  const achievementPageButton = event.target.closest("[data-load-achievement-page]");
  if (achievementPageButton) {
    const state = achievementProfilePages.get(achievementPageButton.dataset.loadAchievementPage);
    const showcase = achievementPageButton.parentElement.querySelector(".achievement-showcase");
    if (!state || !showcase) return;
    const next = state.items.slice(state.offset, state.offset + 8);
    showcase.insertAdjacentHTML("beforeend", next.map(renderProfileAchievementCard).join(""));
    state.offset += next.length;
    const remaining = state.items.length - state.offset;
    if (!remaining) achievementPageButton.remove();
    else achievementPageButton.textContent = `Cargar ${Math.min(8, remaining)} más · ${remaining} pendientes`;
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
    closeMessageUI();
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
  if (editUser) globalThis.AdminGrants?.open(editUser.dataset.editUser);
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
  // Opening the RSVP notice carries an event ID too; editing is an explicit action.
  const eventTarget = event.target.closest("button[data-edit-calendar-event]");
  if (eventTarget) openEventEditor(eventTarget.dataset.editCalendarEvent);
  const chotaTarget = event.target.closest("[data-chota-open]");
  if (chotaTarget) showChotaAgendaComment(chotaTarget);
  const chotaExpand = event.target.closest("[data-chota-expand]");
  if (chotaExpand) openChotaViewer(chotaExpand);
  const calendarDayTarget = event.target.closest("[data-calendar-date]");
  if (calendarDayTarget && !chotaTarget) openCalendarDay(calendarDayTarget.dataset.calendarDate);
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

// Edge navigation is deliberately limited to these drill-down pages. Reuse
// their back controls so form confirmations and chat/profile return state survive.
const pageBackControls = {
  "seccion-chat": "#channelSetupBack",
  "admin-configuracion": ".achievement-back",
  "admin-diagnostico": ".achievement-back",
  "admin-cuentas": ".achievement-back",
  "admin-logros": ".achievement-back",
  "crear-logro": "#cancelAchievementCreate",
  "asignar-logro": "#closeAchievementAssignment",
  "editar-usuario": "[data-account-back]",
  sobres: ".packs-back",
  catalogo: ".packs-back",
  perfil: "[data-profile-back]",
  ayuda: null
};
let pageBackGesture = null;
let pageBackSettling = false;
let suppressPageBackClickUntil = 0;
Object.keys(pageBackControls).forEach(id => document.getElementById(id)?.setAttribute("data-edge-back", ""));
function pageBackAction(page) {
  if (page.id === "ayuda") return () => {
    const destination = helpReturnPage;
    goTo(destination?.id || "inicio");
    restorePagePosition(destination);
  };
  const button = page.querySelector(pageBackControls[page.id]);
  return button && !button.hidden && !button.disabled && button.getClientRects().length ? () => button.click() : null;
}
function pageBackDestination(page) {
  if (page.id === "seccion-chat") return {id: "chat", chat: {section: "chat", channelId: activeChatChannelId}};
  if (page.id === "perfil") return profileChatReturn ? {id: profileChatReturn.section, chat: profileChatReturn} : profilePageReturn || {id: "inicio"};
  if (page.id === "ayuda") return helpReturnPage || {id: "inicio"};
  const routes = {"admin-configuracion": "administracion", "admin-diagnostico": "admin-configuracion", "admin-cuentas": "admin-configuracion", "admin-logros": "admin-configuracion", "crear-logro": "admin-logros", "asignar-logro": "admin-logros", "editar-usuario": "admin-cuentas", sobres: "inicio", catalogo: "sobres"};
  const button = page.querySelector(pageBackControls[page.id]);
  return {id: button?.dataset.go || routes[page.id]};
}
function capturePageBackLayout(page) {
  const appRect = document.querySelector(".app").getBoundingClientRect();
  const frame = node => {
    const rect = node.getBoundingClientRect();
    return {top: rect.top - appRect.top, left: rect.left - appRect.left, right: appRect.right - rect.right, bottom: appRect.bottom - rect.bottom, height: rect.height};
  };
  const header = document.querySelector(".app > .topbar:not(.page-back-header-preview)");
  const headerVisible = header && header.getClientRects().length && getComputedStyle(header).display !== "none";
  const chrome = headerVisible ? {frame: frame(header), markup: header.cloneNode(true)} : null;
  return {frame: frame(page), chrome};
}
function placePageBackSurface(node, frame, {fixedHeight = false} = {}) {
  // The app itself can be offset/transformed for the safe area or keyboard.
  // Use its local coordinates rather than interpreting viewport pixels as fixed offsets.
  const appRect = document.querySelector(".app").getBoundingClientRect();
  node.style.setProperty("top", `${frame.top}px`);
  node.style.setProperty("left", `${frame.left}px`);
  node.style.setProperty("width", `${Math.max(1, appRect.width - frame.left - frame.right)}px`);
  node.style.setProperty("height", `${Math.max(1, fixedHeight ? frame.height : appRect.height - frame.top - frame.bottom)}px`);
}
function preparePageBackPreview(page) {
  const target = pageBackDestination(page);
  const id = ["miembros", "noticias"].includes(target.id) ? "inicio" : target.id;
  const preview = document.getElementById(id);
  if (!preview || preview === page || preview.classList.contains("active")) return null;
  const saved = pageBackPositions.get(id);
  const position = target.top != null ? {...saved, ...target, id} : saved || {id, top: 0};
  const sourceLayout = capturePageBackLayout(page);
  const layout = saved?.layout || sourceLayout;
  const header = document.querySelector(".app > .topbar:not(.page-back-header-preview)");
  const scene = {preview, position, style: preview.getAttribute("style"), ariaHidden: preview.getAttribute("aria-hidden"), scrollTop: preview.scrollTop, childScrolls: [...preview.querySelectorAll(".messages, .chat-inbox")].map(node => [node, node.scrollTop]), sourceHeader: sourceLayout.chrome ? header : null, sourceHeaderStyle: header?.getAttribute("style")};
  // Destination geometry comes from its own last live layout, including its
  // topbar and safe-area space. A full-screen settings source has different chrome.
  preview.classList.add("page-back-preview");
  preview.setAttribute("aria-hidden", "true");
  placePageBackSurface(preview, layout.frame);
  if (layout.chrome) {
    const chrome = layout.chrome.markup.cloneNode(true);
    chrome.removeAttribute("id");
    chrome.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
    chrome.classList.add("page-back-header-preview");
    chrome.inert = true;
    chrome.setAttribute("aria-hidden", "true");
    preview.parentElement.append(chrome);
    placePageBackSurface(chrome, layout.chrome.frame, {fixedHeight: true});
    scene.headerPreview = chrome;
  }
  scene.sourceHeader?.classList.add("page-back-source-header");
  const conversation = target.chat || (preview.classList.contains("conversation-open") ? {section: id} : null);
  if (conversation && ["chat", "privados"].includes(id)) {
    preview.classList.add("page-back-chat-preview");
    const messages = preview.querySelector(".messages");
    if (messages && conversation.scrollTop != null) messages.scrollTop = conversation.scrollTop;
  }
  preview.scrollTop = position.top || 0;
  if (position.inboxTop != null) preview.querySelector(".chat-inbox")?.scrollTo({top: position.inboxTop, behavior: "instant"});
  page.classList.add("page-back-source");
  return scene;
}
function cleanupPageBackPreview(gesture, {committed = false} = {}) {
  gesture.page.classList.remove("page-back-source");
  const scene = gesture.scene;
  if (!scene) return;
  scene.headerPreview?.remove();
  if (scene.sourceHeader) {
    scene.sourceHeader.classList.remove("page-back-source-header");
    if (scene.sourceHeaderStyle == null) scene.sourceHeader.removeAttribute("style");
    else scene.sourceHeader.setAttribute("style", scene.sourceHeaderStyle);
  }
  scene.preview.classList.remove("page-back-preview", "page-back-chat-preview");
  if (scene.style == null) scene.preview.removeAttribute("style");
  else scene.preview.setAttribute("style", scene.style);
  if (scene.ariaHidden == null) scene.preview.removeAttribute("aria-hidden");
  else scene.preview.setAttribute("aria-hidden", scene.ariaHidden);
  // A committed route has already restored its destination scroll. Reverting
  // the preview snapshot here would briefly expose the wrong content again.
  if (!committed) {
    scene.preview.scrollTop = scene.scrollTop;
    scene.childScrolls.forEach(([node, top]) => { node.scrollTop = top; });
  }
}
document.addEventListener("pointerdown", event => {
  if (!isMobileSidebar() || event.pointerType === "mouse" || !event.isPrimary || pageBackGesture || pageBackSettling) return;
  if (document.querySelector("dialog[open]") || event.target.closest("button, a, input, textarea, select, audio, video, [contenteditable='true']")) return;
  const page = event.target.closest(".page-section.active[data-edge-back]");
  if (!page || event.clientX > Math.max(0, page.getBoundingClientRect().left) + 36) return;
  const back = pageBackAction(page);
  if (!back) return;
  pageBackGesture = {page, back, id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, tracking: false};
}, {passive: true});
document.addEventListener("pointermove", event => {
  const gesture = pageBackGesture;
  if (!gesture || gesture.id !== event.pointerId) return;
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
  if (!gesture.page.classList.contains("active") || (!gesture.tracking && (dx < -12 || Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)))) {
    pageBackGesture = null;
    return;
  }
  if (!gesture.tracking && (dx < 12 || dx < Math.abs(dy) * 1.4)) return;
  if (!gesture.tracking) {
    gesture.sourceTransform = gesture.page.style.transform;
    gesture.sourceLayout = capturePageBackLayout(gesture.page);
    gesture.scene = preparePageBackPreview(gesture.page);
  }
  gesture.tracking = true;
  gesture.dx = Math.max(0, dx);
  if (event.cancelable) event.preventDefault();
  try { gesture.page.setPointerCapture(event.pointerId); } catch { /* OS may cancel an edge gesture. */ }
  const transform = `translate3d(${Math.min(gesture.dx, innerWidth)}px,0,0)`;
  gesture.page.style.transform = transform;
  if (gesture.scene?.sourceHeader) gesture.scene.sourceHeader.style.transform = transform;
}, {passive: false});
async function finishPageBackGesture(event) {
  const gesture = pageBackGesture;
  if (!gesture || gesture.id !== event.pointerId) return;
  pageBackGesture = null;
  if (gesture.page.hasPointerCapture?.(gesture.id)) gesture.page.releasePointerCapture(gesture.id);
  if (!gesture.tracking) return;
  pageBackSettling = true;
  suppressPageBackClickUntil = Date.now() + 450;
  const dx = Math.max(0, event.clientX - gesture.x);
  const commit = event.type === "pointerup" && gesture.page.classList.contains("active") && dx >= Math.min(84, innerWidth * .22);
  const reduced = (globalThis.ClubMotion?.media || matchMedia("(prefers-reduced-motion: reduce)")).matches;
  const animations = [];
  try {
    if (!reduced && gesture.page.animate) {
      for (const surface of [gesture.page, gesture.scene?.sourceHeader].filter(Boolean)) animations.push(surface.animate([
        {transform: `translate3d(${gesture.dx}px,0,0)`},
        {transform: `translate3d(${commit ? innerWidth : 0}px,0,0)`}
      ], {duration: commit ? 180 : 150, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both"}));
      await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
    }
    // Keep the source offscreen and the live destination underneath until the
    // back control commits its route. Cleanup-first exposes the departing page
    // again and can persist its translated geometry for the next navigation.
    if (commit && gesture.page.classList.contains("active")) gesture.back();
  } finally {
    const committed = !gesture.page.classList.contains("active");
    if (committed && gesture.sourceLayout) {
      const saved = pageBackPositions.get(gesture.page.id);
      if (saved) pageBackPositions.set(gesture.page.id, {...saved, layout: gesture.sourceLayout});
    }
    animations.forEach(animation => animation.cancel());
    if (gesture.sourceTransform) gesture.page.style.transform = gesture.sourceTransform;
    else gesture.page.style.removeProperty("transform");
    cleanupPageBackPreview(gesture, {committed});
    pageBackSettling = false;
  }
}
document.addEventListener("pointerup", finishPageBackGesture, {passive: true});
document.addEventListener("pointercancel", finishPageBackGesture, {passive: true});
document.addEventListener("click", event => {
  if (event.isTrusted && Date.now() < suppressPageBackClickUntil) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

document.addEventListener("pointerdown", startChatBackGesture, {passive: false});
document.addEventListener("pointermove", moveChatBackGesture, {passive: false});
document.addEventListener("pointerup", finishChatBackGesture, {passive: true});
document.addEventListener("pointercancel", event => {
  if (chatBackGesture?.pointerId === event.pointerId) resetChatBackGesture({settle: true});
}, {passive: true});
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
document.getElementById("closeChatImageViewer").addEventListener("click", closeChatImageViewer);
document.getElementById("chatImageViewer").addEventListener("click", event => {
  if (event.target === event.currentTarget || event.target.id === "chatImageViewerStage") closeChatImageViewer();
});
document.getElementById("chatImageViewer").addEventListener("close", () => {
  // A delayed close event must not clear a freshly reopened viewer.
  if (!document.getElementById("chatImageViewer").open) resetChatImageViewer();
});
document.getElementById("messageContextMenu").addEventListener("click", event => {
  event.stopPropagation();
  const action = event.target.closest("[data-message-action]")?.dataset.messageAction;
  const target = messageMenuTarget;
  if (!action || !contextMessage(target)) return;
  closeMessageMenu(event.detail === 0);
  if (action === "reply") selectChatReply(target);
  else if (action === "info") showMessageInfo({...target, restoreFocus: event.detail === 0});
  else if (action === "edit") (target.kind === "group" ? editGroupMessage : editPrivateMessage)(target.id);
  else if (action === "delete") (target.kind === "group" ? deleteGroupMessage : deletePrivateMessage)(target.id);
});
document.getElementById("messageContextMenu").addEventListener("keydown", event => {
  const buttons = [...event.currentTarget.querySelectorAll("button")];
  const index = buttons.indexOf(document.activeElement);
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault(); buttons[event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  }
  if (event.key === "Tab") closeMessageMenu(true);
});
document.getElementById("closeMessageInfo").addEventListener("click", () => document.getElementById("messageInfoDialog").close());
document.getElementById("messageInfoDialog").addEventListener("click", event => {
  if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close(); }
});
document.getElementById("messageInfoDialog").addEventListener("close", () => {
  const target = messageInfoTarget; messageInfoTarget = null;
  if (target?.bubble?.isConnected && target.restoreFocus) target.bubble.focus({preventScroll: true});
  else if (document.activeElement?.closest("[data-message-bubble]")) document.activeElement.blur();
});
document.getElementById("notificationsButton").addEventListener("click", event => {
  event.stopPropagation();
  const dropdown = document.getElementById("notificationsDropdown");
  const open = !dropdown.classList.contains("open");
  setNotificationsOpen(open, !open);
});
document.getElementById("closeNotifications").addEventListener("click", () => closeNotifications(true));
document.getElementById("notificationsBackdrop").addEventListener("click", event => { event.stopPropagation(); closeNotifications(true); });
document.getElementById("notificationsDropdown").addEventListener("keydown", event => {
  if (event.key === "Escape") { event.preventDefault(); closeNotifications(true); return; }
  if (event.key !== "Tab") return;
  const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled), summary")].filter(element => !element.hidden && element.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
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
  const filter = event.target.closest("[data-notification-filter]");
  if (filter) { notificationFilter = filter.dataset.notificationFilter; renderNotifications(false); return; }
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
  globalThis.ClubDrafts?.begin("helpReplyForm", `request:${activeHelpRequestId}`);
  renderHelpCenter();
});
// Failed sends retain their exact draft and destination until retried or dismissed.
// Other conversations remain usable while an upload is in progress.
function chatSendKey(kind, destination = kind === "private" ? activePrivateMemberId : activeChatChannelId) {
  return `${currentAuthUser?.id || "signed-out"}:${kind}:${destination}`;
}
function renderChatSendStatus(kind) {
  const privateChat = kind === "private";
  const form = document.getElementById(privateChat ? "privateMessageForm" : "messageForm");
  const status = document.getElementById(privateChat ? "privateMessageSendStatus" : "messageSendStatus");
  const attempt = chatSendAttempts.get(chatSendKey(kind));
  const sending = Boolean(attempt?.sending);
  form.toggleAttribute("data-sending", sending);
  form.setAttribute("aria-busy", String(sending));
  const input = form.querySelector('input[type="text"]');
  form.querySelector('[type="submit"]').disabled = input.disabled || sending;
  if (!status) return;
  status.hidden = !attempt;
  status.classList.toggle("has-error", Boolean(attempt?.error));
  status.querySelector("[data-send-label]").textContent = attempt?.error || attempt?.label || "";
  status.querySelector("[data-retry-send]").hidden = !attempt?.error;
  status.querySelector("[data-dismiss-send]").hidden = !attempt?.error;
}
async function submitChatMessage(kind, event, retry = null) {
  event.preventDefault();
  const form = event.currentTarget;
  const draftToken = globalThis.ClubDrafts?.token(form.id);
  const destination = kind === "private" ? activePrivateMemberId : activeChatChannelId;
  const key = chatSendKey(kind, destination);
  if (chatSendAttempts.get(key)?.sending) return;
  if (activeAudioRecording?.kind === kind) {
    activeAudioRecording.sendOnStop = true;
    activeAudioRecording.recorder.stop();
    return;
  }
  const input = form.querySelector('input[type="text"]');
  const value = retry ? retry.value : input.value;
  const text = value.trim();
  const file = retry ? retry.file : pendingChatFile(kind);
  if ((!text && !file) || input.disabled) return;
  const authId = currentAuthUser?.id;
  const sameSession = () => authId && currentAuthUser?.id === authId;
  const sameConversation = () => sameSession() && key === chatSendKey(kind);
  const attempt = retry || {destination, value, file, replyToId: chatReplies.get(chatReplyKey(kind))?.id || null};
  Object.assign(attempt, {sending: true, error: "", label: file ? "Preparando archivo…" : "Enviando mensaje…", phase(label) {
    if (!sameSession()) throw new Error("La sesión ha cambiado.");
    this.label = label;
    if (sameConversation()) renderChatSendStatus(kind);
  }});
  chatSendAttempts.set(key, attempt);
  renderChatSendStatus(kind);
  try {
    if (!navigator.onLine) throw new Error("Sin conexión. Tu mensaje sigue guardado aquí.");
    const sentMessage = await (kind === "private" ? sendPrivateMessage(text, file, attempt) : sendMessage(text, file, attempt));
    if (!sameSession()) return;
    const collection = kind === "private" ? privateMessages : messages;
    if (sentMessage && !collection.some(message => String(message.id) === String(sentMessage.id))) {
      collection.push(sentMessage);
      if (kind === "private") refreshPrivateMessageSurfaces();
      else refreshGroupMessageSurfaces();
    }
    chatSendAttempts.delete(key);
    if (sentMessage) globalThis.ClubDrafts?.clearSent(form.id, draftToken, value);
    if (sentMessage && sameConversation()) {
      if (String(chatReplies.get(chatReplyKey(kind))?.id || "") === String(attempt.replyToId || "")) {
        chatReplies.delete(chatReplyKey(kind)); renderChatReplyComposer(kind);
      }
      if (input.value === value) input.value = "";
      if (pendingChatFile(kind) === file) clearPendingChatFile(kind);
    }
  } catch (error) {
    if (!sameSession()) return;
    attempt.error = !navigator.onLine ? "Sin conexión. Tu mensaje sigue guardado aquí." : "No se pudo enviar. Tu mensaje y archivo se conservan.";
    console.warn("No se pudo enviar el mensaje", error?.code || error?.name || "send-error");
  } finally {
    attempt.sending = false;
    if (sameSession()) syncComposerState(kind);
  }
}
[["group", "messageForm", "messageSendStatus"], ["private", "privateMessageForm", "privateMessageSendStatus"]].forEach(([kind, formId, statusId]) => {
  document.getElementById(statusId).addEventListener("click", event => {
    const key = chatSendKey(kind), attempt = chatSendAttempts.get(key);
    if (!attempt || attempt.sending) return;
    if (event.target.closest("[data-retry-send]")) void submitChatMessage(kind, {preventDefault() {}, currentTarget: document.getElementById(formId)}, attempt);
    if (event.target.closest("[data-dismiss-send]")) { chatSendAttempts.delete(key); renderChatSendStatus(kind); }
  });
});
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
  if (event.target.closest(".message-form input, #inboxSearchInput, #eventForm")) syncMobileViewport();
});
document.addEventListener("focusout", event => {
  if (!event.target.closest(".message-form input, #inboxSearchInput")) return;
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
  if (member?.authId) {
    closeProfileEditor();
    globalThis.AdminGrants?.open(member.id);
  }
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
let lastForegroundRefreshAt = 0;
window.addEventListener("online", () => { void refreshDailyParticipation(true); });
window.addEventListener("focus", () => {
  if (currentAuthUser && !document.hidden && Date.now() - lastForegroundRefreshAt >= 15000) {
    lastForegroundRefreshAt = Date.now();
    void refreshDailyParticipation(true);
  }
});
setInterval(() => { if (!document.hidden) void refreshDailyParticipation(); }, 60000);
setInterval(() => {
  if (!document.hidden && document.getElementById("inicio").classList.contains("active")) loadNews(true);
}, NEWS_REFRESH_INTERVAL);
window.addEventListener("online", () => markVisibleConversationRead());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) markVisibleConversationRead();
  if (!document.hidden) void Promise.all([refreshMediaPermission("camera"), refreshMediaPermission("microphone")]);
  if (!document.hidden && currentAuthUser && Date.now() - lastForegroundRefreshAt >= 15000) {
    lastForegroundRefreshAt = Date.now();
    void refreshDailyParticipation(true);
    scheduleRealtimeRefresh("achievements", () => loadAchievements({force: true}), 100);
  }
  if (!document.hidden
    && document.getElementById("inicio").classList.contains("active")
    && Date.now() - lastNewsRefreshAt >= NEWS_CACHE_DURATION) {
    loadNews(true);
  }
});
document.getElementById("attachMessageButton").addEventListener("click", event => toggleChatAttachmentMenu("group", event.currentTarget));
document.getElementById("attachPrivateMessageButton").addEventListener("click", event => toggleChatAttachmentMenu("private", event.currentTarget));
document.getElementById("attachMessageMediaButton").addEventListener("click", () => openChatGallery("group"));
document.getElementById("attachPrivateMessageMediaButton").addEventListener("click", () => openChatGallery("private"));
document.getElementById("captureMessageCameraButton").addEventListener("click", () => document.getElementById("messageCameraAttachment").click());
document.getElementById("capturePrivateMessageCameraButton").addEventListener("click", () => document.getElementById("privateMessageCameraAttachment").click());
document.getElementById("recordGroupAudioButton").addEventListener("click", () => toggleAudioRecording("group"));
document.getElementById("recordPrivateAudioButton").addEventListener("click", () => toggleAudioRecording("private"));
document.getElementById("pauseGroupAudioButton").addEventListener("click", () => pauseAudioRecording("group"));
document.getElementById("pausePrivateAudioButton").addEventListener("click", () => pauseAudioRecording("private"));
document.getElementById("cancelGroupAudioButton").addEventListener("click", () => cancelAudioRecording("group"));
document.getElementById("cancelPrivateAudioButton").addEventListener("click", () => cancelAudioRecording("private"));
document.getElementById("privateMessageGifAttachment").addEventListener("change", event => selectChatGif("private", event.target));
document.getElementById("privateMessageAttachment").addEventListener("change", event => { if (event.target.files[0]) setPendingChatFile("private", event.target.files[0]); });
document.getElementById("privateMessageMediaAttachment").addEventListener("change", event => { if (event.target.files[0]) setPendingChatFile("private", event.target.files[0]); });
document.getElementById("privateMessageCameraAttachment").addEventListener("change", event => setPendingChatFile("private", event.target.files[0] || null));
document.getElementById("addChatChannelButton").addEventListener("click", () => createChatChannel());
document.getElementById("editChatChannelButton").addEventListener("click", () => createChatChannel(activeChatChannelId));
document.getElementById("channelSetupBack").addEventListener("click", closeChannelEditor);
document.getElementById("channelSetupForm").addEventListener("submit", saveChatChannel);
document.getElementById("channelSetupForm").addEventListener("change", updateChannelSetupFields);
document.getElementById("messageGifAttachment").addEventListener("change", event => selectChatGif("group", event.target));
document.getElementById("messageAttachment").addEventListener("change", event => { if (event.target.files[0]) setPendingChatFile("group", event.target.files[0]); });
document.getElementById("messageMediaAttachment").addEventListener("change", event => { if (event.target.files[0]) setPendingChatFile("group", event.target.files[0]); });
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
  activeCalendarDay = null;
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
new ResizeObserver(() => {
  if (document.getElementById("eventEditor").classList.contains("open")) syncMobileViewport();
}).observe(document.querySelector("#eventEditor .calendar-editor"));
document.getElementById("eventType").addEventListener("change", updateEventEditorType);
document.querySelectorAll("[data-event-kind]").forEach(button => button.addEventListener("click", () => {
  const type = document.getElementById("eventType");
  if (type.disabled) return;
  type.value = button.dataset.eventKind;
  updateEventEditorType();
}));
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

globalThis.PendingActions?.configure({
  db, session: () => backendReady && currentAuthUser?.id,
  closeNotifications,
  canVote: channelId => {const channel=chatChannels.find(channel => String(channel.id) === String(channelId));return !!channel && (!channel.readOnly || canManageSite());},
});

globalThis.GroupInteractions?.init({
  db,
  getUser: () => currentAuthUser ? {id: currentAuthUser.id, isAdmin: canManageSite()} : null,
  getChannelId: () => activeChatChannelId,
  canWriteChannel: channelId => !chatChannels.find(channel => String(channel.id) === String(channelId))?.readOnly || canManageSite(),
  getMember: getMemberByAuthId,
});

globalThis.BannerShop?.initialize({
  cacheNamespace: config.supabaseUrl || "local",
  session: () => backendReady && currentAuthUser?.id,
  rpc: async (name, args) => {
    const owner = currentAuthUser?.id;
    const result = await db.rpc(name, args);
    if (name === "open_owned_card_pack" && !result.error && owner && currentAuthUser?.id === owner) scheduleRealtimeRefresh("achievements", () => loadAchievements({force: true}), 100);
    return result;
  },
  synchronizePacks: force => globalThis.DailyPacks?.refresh(force),
  openInventory: () => goTo("sobres"),
  navigate: goTo,
});

globalThis.CollectionSocial?.configurePush(dispatchPush);

globalThis.AdminGrants?.initialize({
  members: () => members,
  canManage: canManageSite,
  session: () => backendReady && currentAuthUser?.id,
  rpc: (name, args) => db.rpc(name, args),
  refreshOwn: () => Promise.all([globalThis.BannerShop?.refresh(true), globalThis.DailyPacks?.refresh(true)]),
  dispatchPush,
  navigate: goTo,
  avatar: getAvatar,
  changePassword: (member, password) => {
    const policyError = passwordValidationError(password, member.name, member.username);
    if (policyError) throw new Error(policyError);
    return invokeUserAdmin("reset-password", {userId:member.authId, password});
  },
  saveProfile: async (member, values) => {
    if (!canManageSite() || !backendReady || !currentAuthUser) throw new Error("Comprueba tu conexión y tu sesión de administrador.");
    const actor = currentAuthUser.id;
    const username = values.username ? normalizeUsername(values.username.trim()) : member.username;
    const requestedRole = values.role || member.roleKey;
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("El @ debe tener entre 3 y 32 caracteres válidos.");
    if (members.some(item => item.id !== member.id && normalizeUsername(item.username) === username)) throw new Error("Ese @ ya pertenece a otro usuario.");
    try {
      if (username !== member.username) {
        await invokeUserAdmin("rename", {userId:member.authId, username});
        if (currentAuthUser?.id !== actor) return;
        profileLoadGeneration += 1;
        member.username = username;
      }
      if (requestedRole !== member.roleKey) {
        const {error} = await db.rpc("set_club_member_role", {target_user_id:member.authId,new_role:requestedRole});
        if (error) throw error;
        if (currentAuthUser?.id !== actor) return;
        member.roleKey = requestedRole;
        member.role = requestedRole === "admin" ? "ADMINISTRADOR" : "MIEMBRO";
      }
      const updates = {name:values.displayName.trim(),nickname:values.nickname.trim(),bio:values.bio.trim(),tags:values.tags.split(",").map(tag=>tag.trim()).filter(Boolean).slice(0,6),countryFlag:values.countryFlag};
      const {error} = await db.from("profiles").update({display_name:updates.name,nickname:updates.nickname,bio:updates.bio,tags:updates.tags,country_flag:updates.countryFlag,updated_at:new Date().toISOString()}).eq("id",member.authId);
      if (error) throw error;
      if (currentAuthUser?.id !== actor) return;
      Object.assign(member,updates);
      if (member.id === currentUser?.id) Object.assign(currentUser,updates);
      profilesRealtime?.send({type:"broadcast",event:"profile-updated",payload:{userId:member.authId,updatedAt:Date.now()}});
      refreshProfileSurfaces();
    } catch (error) {
      if (currentAuthUser?.id === actor) { try { await loadRemoteProfiles(); } catch {} }
      throw error;
    }
  },
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
  // Keep the launch/login surface until both the Auth record and profile have
  // been verified. A cached identity cannot authorize or reveal the club UI.
  try {
    if (navigator.onLine === false) {showLogin();return;}
    if (backendReady) {
      const {data, error} = await db.auth.getSession();
      if (error) throw error;
      if (data.session?.user) {
        return await beginAuthenticatedSession(data.session.user);
      }
    }
  } catch (error) {
    console.warn("No se pudo restaurar la sesión guardada:", error);
    showLogin();
    document.getElementById("loginError").textContent = error.message || "No se pudo comprobar el acceso. Vuelve a iniciar sesión.";
    return;
  }
  showLogin();
})();

const requestedInitialSection = location.hash.replace("#", "");
const initialSection = requestedInitialSection === "privados" ? "chat" : requestedInitialSection;
if (["inicio", "chat", "privados", "miembros", "contenido", "momentos", "publicaciones", "noticias", "buscar", "calendario", "perfil", "ayuda", "sobres", "album", "catalogo"].includes(initialSection)) {
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

// Wallpaper preferences are personal and never enter the shared message backend.
globalThis.ChatThemes?.init({
  getContext(kind) {
    const userId = currentAuthUser?.id || currentUser?.authId || currentUser?.id;
    const member = kind === "private" ? getMember(activePrivateMemberId) : null;
    return {userId, kind, conversationId: kind === "private" ? (member?.authId || member?.id) : activeChatChannelId};
  }
});

// The chat notice opens this exact plan, even when several share the same day.
document.getElementById("groupEventNotice")?.addEventListener("click", event => {
  const plan=groupEvents.find(plan=>String(plan.id)===event.currentTarget.dataset.eventId);
  if(plan)globalThis.GroupInteractions?.openPlan(plan);
});


/* Text drafts are private to the signed-in account on this device. Never serialize a form wholesale. */
(() => {
  const forms = new Map(), prefix = 'bb-draft-v1:', lifetime = 7 * 86400000;
  const whitelist = {
    messageForm:['#messageInput'], privateMessageForm:['#privateMessageInput'],
    eventForm:['#eventTitle','#eventDescription','#eventStartsAt','#eventEndsAt','#eventLocation','#birthdayDate'],
    profileForm:['#profileName','#profileNickname','#profileBio','#profileTags','#profileFlag'],
    helpRequestForm:['#helpRequestMessage','#helpRequestType'], helpReplyForm:['#helpReplyMessage'],
    channelSetupForm:['[name="channelName"]','[name="description"]','[name="readOnly"]','[data-rule]']
  };
  let timer;
  const account = () => currentAuthUser?.id || null;
  const fields = form => [...form.querySelectorAll(whitelist[form.id].join(','))].filter(field => !['password','file','hidden'].includes(field.type));
  const keyFor = (id,scope,owner) => `${prefix}${owner}:${id}:${scope}`;
  function flush() {
    clearTimeout(timer);
    for (const [id,state] of forms) {
      if (!state.dirty || state.owner !== account()) continue;
      const form = document.getElementById(id); if (!form) continue;
      const values = fields(form).map(field => field.type === 'checkbox' ? field.checked : field.value.slice(0,12000));
      try {
        if (values.some(value => typeof value === 'string' && value.trim())) localStorage.setItem(state.key, JSON.stringify({at:Date.now(),values}));
        else localStorage.removeItem(state.key);
        state.dirty = false;
      } catch { /* Storage can be disabled; typing and sending still work. */ }
    }
  }
  function begin(id,scope,{reopen=false}={}) {
    const form = document.getElementById(id), owner = account();
    if (!form || !whitelist[id]) return;
    const next = owner && scope != null ? keyFor(id,scope,owner) : null;
    const previous = forms.get(id);
    if (previous?.key === next && !reopen) return;
    flush();
    forms.delete(id);
    if (id === 'messageForm' || id === 'privateMessageForm' || id === 'helpReplyForm') fields(form).forEach(field => field.value = '');
    if (!next) return;
    forms.set(id,{key:next,owner,dirty:false});
    form.querySelector('.form-draft-note')?.remove();
    const baseline=fields(form).map(field => field.type==='checkbox' ? field.checked : field.value);
    try {
      const saved = JSON.parse(localStorage.getItem(next) || 'null');
      if (!saved) return;
      if (!Number.isFinite(saved.at) || Date.now()-saved.at > lifetime || !Array.isArray(saved.values)) { localStorage.removeItem(next); return; }
      fields(form).forEach((field,index) => {
        const value = saved.values[index];
        if (field.type === 'checkbox') { if (typeof value === 'boolean') field.checked = value; }
        else if (typeof value === 'string') field.value = value.slice(0,field.maxLength > 0 ? field.maxLength : 12000);
      });
      if (!['messageForm','privateMessageForm'].includes(id)) {
        const note=document.createElement('div'); note.className='form-draft-note';
        const label=document.createElement('span'); label.textContent='Borrador recuperado';
        const button=document.createElement('button'); button.type='button'; button.textContent='Descartar';
        button.onclick=()=>{ globalThis.ClubDrafts.clear(id,next); fields(form).forEach((field,index)=>{if(field.type==='checkbox')field.checked=baseline[index];else field.value=baseline[index];}); note.remove(); form.dispatchEvent(new CustomEvent('draftrestored',{bubbles:true})); };
        note.append(label,button); form.append(note);
      }
      // Let counters/autosizing refresh without pretending the draft is a new edit.
      form.dispatchEvent(new CustomEvent('draftrestored', {bubbles:true}));
    } catch {}
  }
  function changed(event) {
    if (!event.isTrusted) return;
    const form = event.target.form;
    if (!form || !whitelist[form.id] || !fields(form).includes(event.target)) return;
    if (!forms.has(form.id)) {
      const scope = form.id === 'helpRequestForm' ? 'new' : form.id === 'helpReplyForm' && activeHelpRequestId ? `request:${activeHelpRequestId}` : null;
      if (!scope || !account()) return;
      // Bind without restoring over the user's first typed character.
      forms.set(form.id,{key:keyFor(form.id,scope,account()),owner:account(),dirty:false});
    }
    const state = forms.get(form.id);
    if (state.owner !== account()) return;
    state.dirty = true; clearTimeout(timer); timer = setTimeout(flush,250);
  }
  document.addEventListener('input',changed); document.addEventListener('change',changed);
  document.addEventListener('draftrestored',event => {
    if (event.target.id==='profileForm') document.getElementById('bioCount').textContent=document.getElementById('profileBio').value.length;
    if (event.target.id==='channelSetupForm') updateChannelSetupFields();
  });
  document.addEventListener('visibilitychange',() => { if(document.hidden) flush(); });
  window.addEventListener('pagehide',flush);
  globalThis.ClubDrafts = {
    begin,flush,
    touch(id) { const state=forms.get(id); if(!state || state.owner!==account()) return; state.dirty=true; clearTimeout(timer); timer=setTimeout(flush,250); },
    register(id,selectors) { if (typeof id === 'string' && Array.isArray(selectors) && selectors.every(selector => typeof selector === 'string')) whitelist[id]=selectors; },
    saved(id,scope) { try { const owner=account(); if(!owner) return null; const value=JSON.parse(localStorage.getItem(keyFor(id,scope,owner)) || 'null'); return value && Number.isFinite(value.at) && Date.now()-value.at<lifetime && Array.isArray(value.values) ? value.values : null; } catch { return null; } },
    release(id) { flush(); forms.delete(id); },
    token(id) { return forms.get(id)?.key; },
    clear(id,token) {
      const state = forms.get(id), key = token || state?.key;
      if (!key) return;
      if (state?.key === key) state.dirty=false;
      try { localStorage.removeItem(key); } catch {}
      if (state?.key === key) document.getElementById(id)?.querySelector('.form-draft-note')?.setAttribute('hidden','');
    },
    clearSent(id,token,value) {
      if (!token) return;
      const state=forms.get(id), form=document.getElementById(id);
      if (state?.key === token && fields(form)[0]?.value !== value) { state.dirty=true; flush(); return; }
      try { const saved=JSON.parse(localStorage.getItem(token)||'null'); if (!saved || saved.values?.[0] === value) localStorage.removeItem(token); } catch {}
      if(state?.key === token) state.dirty=false;
    },
    suspend() { flush(); for (const id of forms.keys()) if (['messageForm','privateMessageForm','helpReplyForm'].includes(id)) fields(document.getElementById(id)).forEach(field => field.value=''); forms.clear(); }
  };
  // Expiry bounds retained data without scanning storage on every keystroke.
  const prune = () => { try { for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) { try { const saved=JSON.parse(localStorage.getItem(key)); if (!saved?.at || Date.now()-saved.at>lifetime) localStorage.removeItem(key); } catch { localStorage.removeItem(key); } } } catch {} };
  if (window.requestIdleCallback) requestIdleCallback(prune,{timeout:5000}); else setTimeout(prune,3000);
})();
