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
const memberSearchText = new WeakMap();

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

const appUpdateGate = globalThis.ClubAppUpdate?.start({client:db});

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
const MEMBER_CACHE_KEY = "bb-home-members-v1";
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
document.body.classList.toggle("native-ios", window.Capacitor?.getPlatform?.() === "ios" || window.__bigboysNativeKeyboardLayout === true);
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
let pendingWidgetEventId = null;
let calendarChatAnnouncements = [];
let channelAutomationMessages = [];
let calendarChatSyncDay = "";
let calendarChatRequest = null;
let chatChannels = [];
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
let achievementsLoading = false;
let achievementsRequest = null;
const realtimeRefreshTimers = new Map();
let initialLaunchCompleted = false;
let profileLoadGeneration = 0;

// On a cold start the room's sprites and masks are not in memory yet. Lifting the
// launch screen before they decode shows El Chota and parts of the room blinking in.
function roomMediaReady(limit = 1500) {
  const room = document.querySelector("#clubhouseContent .clubhouse-room");
  if (!room) return Promise.resolve();
  const urls = new Set();
  for (const node of [room, ...room.querySelectorAll("*")]) {
    if (node instanceof HTMLImageElement && node.getAttribute("src")) urls.add(node.currentSrc || node.src);
    for (const pseudo of [null, "::before", "::after"]) {
      const style = getComputedStyle(node, pseudo);
      for (const value of [style.backgroundImage, style.webkitMaskImage, style.maskImage]) {
        for (const match of String(value || "").matchAll(/url\("?([^")]+)"?\)/g)) urls.add(match[1]);
      }
    }
  }
  const decode = url => { const image = new Image(); image.src = url; return image.decode().catch(() => {}); };
  return Promise.race([Promise.allSettled([...urls].map(decode)), new Promise(resolve => setTimeout(resolve, limit))]);
}
function completeInitialLaunch() {
  if (initialLaunchCompleted) return;
  initialLaunchCompleted = true;
  void roomMediaReady().then(() => requestAnimationFrame(() => {
    document.getElementById("pageLoader")?.classList.add("hidden");
    requestAnimationFrame(() => {
      globalThis.ClubHealth?.mark("shell-ready");
      document.documentElement.dataset.launchReady = "true";
      document.dispatchEvent(new Event("bb:launch-ready"));
    });
  }));
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
    // Signing out can empty the queue after its idle callback was scheduled.
    if (!task) return;
    try { task.callback(); }
    finally {
      // Yield a painted frame between independent surfaces instead of one long
      // startup callback rendering contacts, messages, notices and administration.
      requestAnimationFrame(scheduleIdleStartup);
    }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, {timeout:idleStartupQueue[0].timeout});
  // WebKit versions without requestIdleCallback still yield a frame and obey
  // the editing guard; a fixed 300 ms per queued task delayed the whole startup.
  else window.setTimeout(run, 32);
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
  const navigationSection = sectionId === "privados" ? "chat" : ["sobres", "album", "catalogo"].includes(sectionId) ? "sobres" : sectionId === "hoy" ? "inicio" : sectionId;
  const index = navLinks.findIndex(link => link.dataset.section === navigationSection);
  if (index < 0) return;
  const tabBar = document.getElementById("floatingTabBar");
  tabBar?.style.setProperty("--active-tab-offset", `${index * 100}%`);
  globalThis.ClubMotion?.moveGlassSelection?.(tabBar,index);
}

async function transitionMessageView(update, {back = false} = {}) {
  if (messageViewTransitioning) return;
  messageViewTransitioning = true;
  let scene = null;
  try {
    const reducedMotion = (globalThis.ClubMotion?.media || window.matchMedia("(prefers-reduced-motion: reduce)")).matches;
    const fromInbox = document.body.classList.contains("chat-inbox-view") && !document.body.classList.contains("chat-focus");
    if (!isMobileSidebar() || reducedMotion || (!back && !fromInbox)) {
      if (back) await dismissChatComposerKeyboard({navigation: true});
      update();
      return;
    }
    // Compose the destination synchronously, then animate the live panel over the same inbox.
    if (!back) update();
    const panel = document.querySelector("#privados.active.conversation-open .private-conversation, #chat.active.conversation-open .group-conversation");
    scene = prepareChatBackScene(panel, {entering: !back});
    if (!scene) {
      if (back) {
        await dismissChatComposerKeyboard({navigation: true});
        update();
      }
      return;
    }
    scene.panel.classList.add("chat-back-button-exit");
    await settleChatBackScene(scene, back ? scene.width : 0);
    if (back) {
      await finishChatBackKeyboard(scene, false);
      await dismissChatComposerKeyboard({navigation: true});
      update();
    }
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
  if (sectionId === "chat") { renderPrivateContacts(); scheduleChatImageWarmup(); }
  globalThis.CardAlbum?.didNavigate(sectionId, currentSection);
  globalThis.AdminGrants?.didNavigate(sectionId);
  adminConsole?.didNavigate(sectionId);
  const navigationSection = sectionId === "privados" ? "chat" : ["sobres", "album", "catalogo"].includes(sectionId) ? "sobres" : sectionId === "hoy" ? "inicio" : sectionId;
  navLinks.forEach(link => {
    const active = link.dataset.section === navigationSection;
    link.classList.toggle("active", active);
    link.setAttribute("aria-current", active ? "page" : "false");
  });
  updateFloatingTabIndicator(navigationSection);
  if (switchingSection && !document.body.classList.contains("message-slide-transition") && !pageBackSettling && !activeChatMotionScene) {
    const tabOrder = ["inicio", "sobres", "chat", "perfil"], navigatingBack = backTarget?.id === sectionId;
    const fromTab = tabOrder.indexOf(currentSection), toTab = tabOrder.indexOf(sectionId);
    const direction = navigatingBack ? -1 : fromTab >= 0 && toTab >= 0 ? Math.sign(toTab - fromTab) : 1;
    globalThis.ClubMotion?.enterSection(document.getElementById(sectionId), direction);
  }
  document.body.classList.toggle("chat-focus", sectionId === "privados");
  document.body.classList.toggle("chat-inbox-view", sectionId === "chat");
  document.body.classList.toggle("achievement-management-open", ["admin-configuracion", "admin-diagnostico", "admin-cuentas", "admin-logros", "crear-logro", "asignar-logro", "editar-usuario"].includes(sectionId));
  if (sectionId === "ayuda") { globalThis.ClubDrafts?.begin("helpRequestForm", "new"); globalThis.ClubDrafts?.begin("helpReplyForm", globalThis.Tickets?.activeId() == null ? null : `request:${globalThis.Tickets.activeId()}`); }
  if (sectionId === "admin-logros") renderAdminAchievements();
  if (sectionId === "admin-diagnostico") globalThis.ClubHealth?.show();
  if (sectionId === "admin-cuentas" || sectionId === "administracion") renderAdminPanel();
  syncChatInboxAccessibility();
  syncMobileViewport();
  const titles = {
    "seccion-chat": "Sección del grupo", inicio: "El Club", chat: "Mensajes", miembros: "Miembros",
    privados: "Mensajes privados", perfil: "Perfil", calendario: "Calendario",
    noticias: "Noticias", administracion: "Administración", ayuda: "Tickets", sobres: "Colección", album: "Álbum", catalogo: "Cartas de la colección", hoy: "Hoy en el club",
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
      if (sectionId === "ayuda" && currentUser) globalThis.Tickets?.refresh();
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
  if (globalThis.ProfileAccountSheet) {
    globalThis.ProfileAccountSheet.open({menu, user:currentUser, trigger:document.querySelector(".profile-tab")});
  } else {
    menu.hidden = false;
    menu.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => { if (!menu.hidden) menu.classList.add("open"); });
  }
  document.querySelector(".profile-tab")?.setAttribute("aria-expanded", "true");
  navigator.vibrate?.(12);
}

function closeProfileQuickMenu({immediate = false} = {}) {
  if (globalThis.ProfileAccountSheet) {
    void globalThis.ProfileAccountSheet.close({immediate,restoreFocus:false});
    return;
  }
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

function dismissChatComposerKeyboard({navigation = false} = {}) {
  const focused = document.activeElement;
  const composer = focused?.closest?.(".message-form") ? focused : null;
  if (navigation && chatKeyboard?.dismissForNavigation && (composer || chatKeyboard.keyboardVisible
    || document.body.classList.contains("chat-keyboard-open"))) {
    return chatKeyboard.dismissForNavigation(composer);
  }
  if (!composer) return;
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
  scheduleChatImageWarmup();
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
  const bounds = panel.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width || window.innerWidth));
  const preview = document.querySelector("#chat .chat-inbox");
  const kind = panel.closest("#privados") ? "private" : "group";
  if (!preview || !width) return null;
  document.body.classList.add("chat-back-transition-active");
  panel.classList.add("chat-back-live-panel");
  const scene = {panel, preview, kind, width, offset: 0, animations: [],
    panelHeight: panel.style.height, previewHeight: preview.style.height};
  if (!entering && document.body.classList.contains("chat-keyboard-open")) {
    // The list has its resting size from the first frame; UIKit merely clips
    // it behind the keyboard. Removing the keyboard cannot reflow the list or
    // stretch the departing chat while the route commits.
    panel.style.height = `${Math.round(bounds.height)}px`;
    preview.style.height = `${Math.round(Math.max(bounds.height, mobileViewportBaseline - preview.getBoundingClientRect().top))}px`;
  }
  activeChatMotionScene = scene;
  scene.keyboardNavigation = !entering ? chatKeyboard?.beginBackNavigation?.(document.activeElement) : null;
  scene.keyboardReady = !scene.keyboardNavigation;
  if (scene.keyboardNavigation) {
    void scene.keyboardNavigation.ready.then(() => {
      scene.keyboardReady = true;
      if (activeChatMotionScene === scene) updateChatBackScene(scene, scene.offset);
    });
  }
  // The tab bar belongs to the inbox: it appears only in the strip the chat has uncovered.
  const tabBar = document.getElementById("floatingTabBar");
  const tabBounds = tabBar?.getBoundingClientRect();
  if (tabBounds?.width) Object.assign(scene, {tabBar, tabLeft: tabBounds.left, tabWidth: tabBounds.width});
  updateChatBackScene(scene, entering ? width : 0);
  return scene;
}

function chatBackTabClip(scene, offset) {
  return `inset(-24px ${Math.max(0, scene.tabWidth + scene.tabLeft - offset)}px -24px -24px)`;
}

function updateChatBackScene(scene, offset, {syncKeyboard = true} = {}) {
  if (!scene?.panel) return;
  const {offset: clamped, listOffset} = ChatMotion.position(offset, scene.width);
  scene.offset = clamped;
  if (scene.keyboardReady === false) return;
  scene.panel.style.setProperty("--chat-back-offset", `${clamped}px`);
  scene.preview.style.setProperty("--chat-back-list-offset", `${listOffset}px`);
  if (scene.tabBar) scene.tabBar.style.clipPath = chatBackTabClip(scene, clamped);
  if (syncKeyboard) scene.keyboardNavigation?.update(clamped, scene.width);
}

async function finishChatBackKeyboard(scene, restore) {
  if (!scene?.keyboardNavigation || scene.keyboardFinalized) return;
  scene.keyboardFinalized = true;
  await scene.keyboardNavigation.finish(restore);
}

function cleanupChatBackScene(scene) {
  if (!scene) return;
  if (scene.keyboardNavigation && !scene.keyboardFinalized) void finishChatBackKeyboard(scene, true);
  scene.animations.forEach(animation => animation.cancel());
  scene.panel?.classList.remove("chat-back-live-panel", "chat-back-button-exit");
  scene.panel?.style.removeProperty("--chat-back-offset");
  scene.preview?.style.removeProperty("--chat-back-list-offset");
  scene.tabBar?.style.removeProperty("clip-path");
  if (scene.panelHeight) scene.panel.style.height = scene.panelHeight;
  else scene.panel?.style.removeProperty("height");
  if (scene.previewHeight) scene.preview.style.height = scene.previewHeight;
  else scene.preview?.style.removeProperty("height");
  if (activeChatMotionScene === scene) {
    activeChatMotionScene = null;
    document.body.classList.remove("chat-back-transition-active");
  }
}

async function settleChatBackScene(scene, targetOffset) {
  if (!scene?.panel) return;
  await scene.keyboardNavigation?.ready;
  const from = ChatMotion.position(scene.offset, scene.width);
  const to = ChatMotion.position(targetOffset, scene.width);
  const reduced = (globalThis.ClubMotion?.media || window.matchMedia("(prefers-reduced-motion: reduce)")).matches;
  const duration = ChatMotion.duration(Math.abs(to.offset - from.offset), scene.width, reduced);
  updateChatBackScene(scene, to.offset, {syncKeyboard: false});
  const keyboardSettled = scene.keyboardNavigation?.settle(to.offset, scene.width, duration);
  if (!duration || !scene.panel.animate) { await keyboardSettled; return; }
  const options = {duration, easing: ChatMotion.easing, fill: "both"};
  scene.animations = [
    scene.panel.animate([
      {transform: `translate3d(${from.offset}px,0,0)`},
      {transform: `translate3d(${to.offset}px,0,0)`}
    ], options),
    scene.preview.animate([
      {transform: `translate3d(${from.listOffset}px,0,0)`},
      {transform: `translate3d(${to.listOffset}px,0,0)`}
    ], options),
    ...(scene.tabBar ? [scene.tabBar.animate([
      {clipPath: chatBackTabClip(scene, from.offset)},
      {clipPath: chatBackTabClip(scene, to.offset)}
    ], options)] : [])
  ];
  try {
    await Promise.all([...scene.animations.map(animation => animation.finished.catch(() => {})), keyboardSettled]);
  } finally {
    scene.animations.forEach(animation => animation.cancel());
    scene.animations = [];
  }
}

async function completeChatBackDestination(kind) {
  await dismissChatComposerKeyboard({navigation: true});
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
  const settled = settleChatBackScene(gesture.scene, 0);
  const restored = gesture.scene.keyboardNavigation ? settled.then(() => finishChatBackKeyboard(gesture.scene, true)) : settled;
  void restored.finally(() => {
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
    if (!gesture.touch) try { gesture.panel.setPointerCapture?.(event.pointerId); } catch { /* Pointer may already have been cancelled by the OS. */ }
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
    await finishChatBackKeyboard(gesture.scene, false);
    await completeChatBackDestination(gesture.scene.kind);
  } finally {
    cleanupChatBackScene(gesture.scene);
    messageViewTransitioning = false;
    window.setTimeout(() => { suppressChatGestureClick = false; }, 80);
  }
}

// Like the reply gesture, touch owns the drag once it exists. WebKit can drop the
// pointer stream mid-drag, without pointerup, which would strand the panel; only an
// active touchmove can claim the drag, and touchend always supplies the release.
function bindChatBackTouch(event) {
  const gesture = chatBackGesture;
  if (!gesture) return;
  if (event.touches.length !== 1) {
    resetChatBackGesture({settle: gesture.tracking});
    return;
  }
  gesture.touch = true;
  gesture.touchId = event.changedTouches[0].identifier;
}

function chatBackTouchEvent(event) {
  const gesture = chatBackGesture;
  if (!gesture?.touch) return null;
  const touch = [...event.changedTouches].find(item => item.identifier === gesture.touchId);
  if (!touch) return null;
  return {pointerId: gesture.pointerId, clientX: touch.clientX, clientY: touch.clientY, timeStamp: event.timeStamp,
    cancelable: event.cancelable, preventDefault: () => event.preventDefault()};
}

function moveChatBackTouch(event) {
  const gesture = chatBackGesture, point = chatBackTouchEvent(event);
  if (!point) return;
  // A noncancelable touchmove means native scrolling already won the drag.
  if (event.touches.length !== 1 || !event.cancelable) {
    resetChatBackGesture({settle: gesture.tracking});
    return;
  }
  moveChatBackGesture(point);
}

function endChatBackTouch(event) {
  const point = chatBackTouchEvent(event);
  return point ? finishChatBackGesture(point) : undefined;
}

function cancelChatBackTouch(event) {
  const gesture = chatBackGesture;
  if (chatBackTouchEvent(event)) resetChatBackGesture({settle: gesture.tracking});
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
  if (!node) return false;
  const previous = surfaceMarkup.get(node);
  if (previous?.markup === markup && previous.count === node.childNodes.length
    && previous.first === node.firstChild && previous.last === node.lastChild) return false;
  node.innerHTML = markup;
  surfaceMarkup.set(node, {markup, count: node.childNodes.length, first: node.firstChild, last: node.lastChild});
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
function memberTileMarkup(member, index) {
  return `
    <button class="club-member" type="button" data-profile="${member.id}" data-member-priority="${index < 2}" data-member-banner-user="${escapeHtml(member.authId || '')}" aria-label="Ver perfil de ${escapeHtml(member.name)}">
      <div class="club-member-hero"><div class="club-member-banner" aria-hidden="true"></div>${getAvatar(member, "avatar", index < 2)}</div>
      <span class="club-member-identity"><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(globalThis.ClubPlus?.statusFor(member.authId) || `@${member.username}`)}</small></span>
    </button>`;
}

// Last seen members paint the first frame; identical server data then changes nothing.
function readMemberCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(MEMBER_CACHE_KEY) || "null");
    return saved?.owner === currentAuthUser?.id && Array.isArray(saved.rows) ? saved.rows : [];
  } catch { return []; }
}

function saveMemberCache() {
  try {
    localStorage.setItem(MEMBER_CACHE_KEY, JSON.stringify({owner: currentAuthUser?.id, rows: members.filter(member => !member.hidden)
      .map(({id, authId, name, username, avatarUrl}) => ({id, authId, name, username, avatarUrl}))}));
  } catch {}
}

function renderMembers() {
  const grid = document.getElementById("membersGrid");
  if (!grid) return;
  const pending = backendReady && currentAuthUser?.id && memberProfilesOwner !== currentAuthUser.id;
  grid.setAttribute("aria-busy", String(Boolean(pending && memberProfilesFailedOwner !== currentAuthUser?.id)));
  const cachedMembers = pending ? readMemberCache() : [];
  if (cachedMembers.length) {
    grid.setAttribute("aria-busy", "false");
    updateSurfaceMarkup(grid, cachedMembers.map(memberTileMarkup).join(""));
    globalThis.BannerShop?.mountMembers(grid);
    return;
  }
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
  updateSurfaceMarkup(grid, members.filter(member => !member.hidden).map(memberTileMarkup).join(""));
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
  return `<button type="button" class="achievement-card tier-${escapeHtml(achievement.tier)}" data-open-achievement="${escapeHtml(achievement.id)}" aria-label="Ver logro: ${escapeHtml(achievement.name)}, ${escapeHtml(tier.label)}">
    <span class="achievement-emblem" aria-hidden="true">${achievementTrophyIcon(achievement.tier, achievement.icon)}</span>
    <span class="achievement-card-copy"><strong>${escapeHtml(achievement.name)}</strong></span>
  </button>`;
}

function renderMemberAchievements(member) {
  const tierOrder = {platinum: 0, gold: 1, silver: 2, bronze: 3};
  const assigned = achievementsForMember(member).sort((a, b) => (tierOrder[a.tier] ?? 4) - (tierOrder[b.tier] ?? 4) || String(a.name).localeCompare(String(b.name), "es"));
  const visible = assigned.slice(0, 8);
  const archived = assigned.slice(8);
  const pageKey = String(member.id);
  achievementProfilePages.delete(pageKey);
  if (archived.length) {
    achievementProfilePages.set(pageKey, {items: archived, offset: 0});
    while (achievementProfilePages.size > 8) achievementProfilePages.delete(achievementProfilePages.keys().next().value);
  }
  return `<section class="profile-achievements">
    <div class="profile-feed-heading"><div><h3>Logros</h3></div><span class="club-profile-achievement-summary"><span class="club-profile-earned"><strong>${assigned.length}</strong> ${assigned.length === 1 ? "conseguido" : "conseguidos"}</span>${renderAchievementChallengeTrigger(member)}</span></div>
    <div class="achievement-showcase">
      ${assigned.length ? visible.map(renderProfileAchievementCard).join("") : `<div class="empty-state compact achievement-empty"><strong>${achievementsLoading ? "Cargando logros…" : "Aún no hay logros"}</strong><span>Los logros conseguidos aparecerán aquí.</span></div>`}
    </div>
    ${archived.length ? `<button type="button" class="achievement-show-all" data-load-achievement-page="${escapeHtml(pageKey)}">Ver ${Math.min(8, archived.length)} más</button>` : ""}
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
      <span class="achievement-challenge-copy"><small>${escapeHtml(achievementLadderLabel(achievement))}</small><strong>${escapeHtml(achievement.name)}</strong>${renderPersonalAchievementProgress(achievement)}</span>
    </button>`).join("") : achievementProgressStatus === "ready" ? `<div class="achievement-challenges-complete"><strong>Todo conquistado</strong><span>Has conseguido todos los objetivos disponibles.</span></div>` : ""}</div>
  </section>`;
}

function renderAchievementChallengeTrigger(member) {
  if (!currentAuthUser || member.authId !== currentAuthUser.id || member.hidden || achievementProgressStatus === "unavailable") return "";
  const count = AchievementProgress.nextPending(achievements, achievementAwards, currentAuthUser.id).length;
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

function achievementLadderLabel(achievement) {
  const tier = achievementTier(achievement.tier).label;
  if (!achievement.trackKey) return tier;
  const steps = AchievementProgress.ladder(achievements, achievement).length;
  return `${AchievementProgress.trackLabel(achievement.trackKey)} · ${tier} · ${achievement.trackStep}/${steps}`;
}
// The whole ladder, so a member sees where this trophy sits and what comes next.
function renderAchievementLadder(achievement) {
  const steps = AchievementProgress.ladder(achievements, achievement);
  if (steps.length < 2) return "";
  const userId = currentAuthUser?.id || currentUser?.authId;
  const earned = new Set(achievementAwards.filter(award => award.userId === userId).map(award => String(award.achievementId)));
  const next = steps.find(step => !earned.has(String(step.id)));
  return `<div class="achievement-ladder"><span class="achievement-ladder-title">Escalera ${escapeHtml(AchievementProgress.trackLabel(achievement.trackKey))}</span>
    <ol>${steps.map(step => {
      const state = earned.has(String(step.id)) ? "earned" : step === next ? "next" : "locked";
      const goal = step.rule ? AchievementProgress.objective(step.rule) : "";
      return `<li data-state="${state}"${step.id === achievement.id ? ' aria-current="step"' : ""}><button type="button" class="tier-${escapeHtml(step.tier)}" data-open-achievement="${escapeHtml(step.id)}">
        <span class="achievement-ladder-icon" aria-hidden="true">${achievementTrophyIcon(step.tier, step.icon)}</span>
        <span class="achievement-ladder-copy"><strong>${escapeHtml(step.name)}</strong><small>${escapeHtml(goal)}</small></span>
        <span class="achievement-ladder-state">${state === "earned" ? "Conseguido" : state === "next" ? "Siguiente" : "Bloqueado"}</span>
      </button></li>`;
    }).join("")}</ol></div>`;
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
    <span class="achievement-detail-tier">${escapeHtml(achievement.trackKey ? achievementLadderLabel(achievement) : tier.label)} · ${earned ? "Conseguido" : achievement.trackKey ? "Pendiente" : "Logro del club"}</span>
    <h2 id="achievementDetailTitle">${escapeHtml(achievement.name)}</h2>
    <p id="achievementDetailDescription">${escapeHtml(achievement.description || "Un reconocimiento concedido por la administración del club.")}</p>
    ${renderPersonalAchievementProgress(achievement)}
    ${renderAchievementLadder(achievement)}
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
      ${member.hidden ? "" : `<div class="profile-chota" data-mood="${isOwnProfile ? "cheer" : "wave"}"><i class="profile-chota-sprite" aria-hidden="true"></i><p>${isOwnProfile ? "¡Este eres tú! Así te ve todo el club." : `Este es ${escapeHtml(String(member.name).split(" ")[0])}. ¿Le escribes algo?`}</p></div>`}
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
  globalThis.ClubSocial?.mountProfile(document.getElementById("profileContent"), member.authId, isOwnProfile);
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
          <button class="message-author" data-profile="${message.member}">${escapeHtml(globalThis.ChatCustom?.name("group", member) || member?.name || "Miembro")}</button>
        </div>`}
        ${renderChatQuote("group", message)}
        ${globalThis.PackExtras?.sharedId(message.text) ? globalThis.PackExtras.sharedMarkup(globalThis.PackExtras.sharedId(message.text)) : message.text ? `<p>${formatChatText(message.text)}</p>` : ""}${attachment}
        <div class="message-footer"><time class="private-message-time" datetime="${escapeHtml(message.createdAt)}" title="${escapeHtml(formatMessageDate(message.createdAt))}">${formatConversationTime(message.createdAt)}</time>${message.editedAt ? '<span class="message-edited">editado</span>' : ""}
        </div>
        ${globalThis.ChatCustom?.chips("group", message.id) || ""}
      </div>
    </div>`;
  }).join(""));
  globalThis.PackExtras?.hydrate(container);
  finishReading();
}


// Reply state belongs to a user and conversation; switching threads never leaks a quote.
// Histories are replaced on remote updates and appended on local sends. Index
// once per snapshot instead of scanning every message for every quoted reply.
const chatMessageIndexes = new WeakMap();
function chatMessageIndex(items) {
  let entry = chatMessageIndexes.get(items);
  if (!entry || entry.length !== items.length) {
    entry = {length: items.length, byId: new Map(items.map(item => [String(item.id), item]))};
    chatMessageIndexes.set(items, entry);
  }
  return entry.byId;
}
const chatReplies = new Map();
function chatReplyKey(kind) { return `${currentAuthUser?.id || ""}:${kind}:${kind === "private" ? activePrivateMemberId : activeChatChannelId}`; }
function chatReplyDescription(kind, message) {
  const author = kind === "group" ? getMember(message.member) : getMemberByAuthId(message.senderId);
  return {name: author?.name || "Miembro", text: String((globalThis.PackExtras?.sharedId(message.text || message.body) ? "Sobre compartido" : "") || message.text || message.body || (message.attachmentType?.startsWith("image/") ? "Imagen" : message.attachmentType?.startsWith("audio/") ? "Nota de voz" : message.attachmentType?.startsWith("video/") ? "Vídeo" : "Archivo adjunto")).slice(0, 180)};
}
function renderChatQuote(kind, message) {
  if (!message.replyToId) return "";
  const source = chatMessageIndex(kind === "private" ? privateMessages : messages).get(String(message.replyToId));
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
  chatKeyboard?.awaitLift?.(input.closest("form")?.previousElementSibling);
  // iOS stops painting from focus() until the keyboard starts to rise, about
  // 200 ms. Let the bubble's return reach the screen first; a short timer keeps
  // the gesture WebKit requires to open the keyboard, unlike a frame callback.
  setTimeout(() => input.focus({preventScroll: true}), 48);
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
    const message = chatMessageIndex(messages).get(target.id);
    return message && String(message.channelId || "") === String(activeChatChannelId || "") ? message : null;
  }
  const peer = getMember(activePrivateMemberId);
  if (!peer || !document.getElementById("privados").classList.contains("active") || !document.getElementById("privados").classList.contains("conversation-open")) return null;
  const message = chatMessageIndex(privateMessages).get(target.id);
  return message && ((message.senderId === currentAuthUser.id && message.recipientId === peer.authId) ||
    (message.senderId === peer.authId && message.recipientId === currentAuthUser.id)) ? message : null;
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
  const fade = globalThis.ClubMotion?.run(focus.layer,[{opacity: 1}, {opacity: 0}], {channel:"chat-focus",duration:160,cleanup:false})
    || focus.layer.animate([{opacity: 1}, {opacity: 0}], {duration: 150, easing: "ease-out", fill: "forwards"});
  fade.finished.catch(()=>{}).then(() => focus.layer.remove());
}
function focusChatMenuSource(menu, source) {
  releaseChatMenuFocus(menu, true);
  const rect = source.getBoundingClientRect();
  const menuWidth = menu.offsetWidth, menuHeight = menu.offsetHeight;
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
  const scale = rect.width > 0 && rect.height > 0 ? Math.min(1.025, (width - 32) / rect.width, Math.max(50, height - menuHeight - 44) / rect.height) : 1;
  const previewWidth = rect.width * scale, previewHeight = rect.height * scale;
  const left = Math.max(offsetLeft + 16, Math.min(rect.left - (previewWidth - rect.width) / 2, offsetLeft + width - previewWidth - 16));
  const top = Math.max(offsetTop + 16, Math.min(rect.top - 4, offsetTop + height - previewHeight - menuHeight - 28));
  preview.style.cssText = `left:${left}px;top:${top}px;width:${rect.width}px;height:${rect.height}px;transform:scale(${scale});transform-origin:top left;`;
  positionChatMenu(menu, Math.min(left + previewWidth - menuWidth, left), top + previewHeight, menuWidth, menuHeight);
  menu.style.transformOrigin = "top center";
  source.classList.add("chat-menu-source-hidden");
  chatMenuFocus.set(menu, {layer, source});
  if (!(globalThis.ClubMotion?.media || window.matchMedia("(prefers-reduced-motion: reduce)")).matches) {
    const run = globalThis.ClubMotion?.run || ((node,frames,options)=>node.animate(frames,options));
    run(layer,[{opacity: 0}, {opacity: 1}], {channel:"chat-focus",duration:160,easing:"ease-out"});
    // Keep layout fixed at the destination. Only the compositor follows the
    // touched bubble, including when the keyboard changes the visible viewport.
    run(preview,[
      {transform: `translate3d(${rect.left-left}px,${rect.top-top}px,0) scale(1)`},
      {transform: `translate3d(0,0,0) scale(${scale})`}
    ], {channel:"chat-preview",duration:280,easing:"cubic-bezier(.2,.8,.2,1)"});
  }
}
function animateChatMenu(menu, opening) {
  if (!menu || (!opening && menu.hidden)) return;
  const previous = chatMenuMotion.get(menu);
  if (!opening && menu.classList.contains("is-closing")) return;
  if (!globalThis.ClubMotion?.run) previous?.cancel();
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
  const frames = opening ? [
    {opacity: 0, transform: "translateY(-6px) scale(.96)"},
    {opacity: 1, transform: "translateY(0) scale(1)"}
  ] : [
    {opacity: 1, transform: "translateY(0) scale(1)"},
    {opacity: 0, transform: "translateY(-4px) scale(.98)"}
  ];
  const options = {channel:"chat-menu",duration:opening?260:160,easing:"cubic-bezier(.2,.8,.2,1)",fill:"both",cleanup:false};
  const animation = globalThis.ClubMotion?.run(menu,frames,options) || menu.animate(frames,options);
  chatMenuMotion.set(menu, animation);
  animation.finished.catch(()=>{}).then(() => {
    if (chatMenuMotion.get(menu) !== animation) return;
    menu.hidden = !opening;
    menu.classList.remove("is-closing");
    chatMenuMotion.delete(menu);
    animation.cancel();
  });
}
function positionChatMenu(menu, x, y, menuW = menu.offsetWidth, menuH = menu.offsetHeight) {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
  const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
  const menuLeft = Math.max(left + 12, Math.min(x, left + width - menuW - 12));
  const menuTop = Math.max(top + 12, Math.min(y + 8, top + height - menuH - 12));
  menu.style.left = `${menuLeft}px`;
  menu.style.top = `${menuTop}px`;
  menu.style.transformOrigin = `${Math.max(12, Math.min(menuW - 12, x - menuLeft))}px ${y > menuTop ? "bottom" : "top"}`;
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
  const reactionRow = (globalThis.ChatCustom?.emojis(target.kind) || []).map(emoji => `<button role="menuitem" type="button" data-message-action="react" data-emoji="${escapeHtml(emoji)}" aria-label="Reaccionar con ${escapeHtml(emoji)}">${escapeHtml(emoji)}</button>`).join("");
  const pinned = globalThis.ChatCustom?.isPinned(target.kind, target.id);
  menu.innerHTML = `${reactionRow ? `<div class="message-reaction-row">${reactionRow}</div>` : ""}<span class="message-context-caption">Mensaje</span><button role="menuitem" type="button" data-message-action="reply">Responder</button><button role="menuitem" type="button" data-message-action="pin">${pinned ? "Quitar fijado" : "Fijar"}</button>${target.kind === "group" && canManageSite() && (message.text || message.body) ? '<button role="menuitem" type="button" data-message-action="plan">Crear plan</button>' : ""}<button role="menuitem" type="button" data-message-action="info"><span aria-hidden="true">ⓘ</span>Información</button>${own && (message.text || message.body) ? '<button role="menuitem" type="button" data-message-action="edit"><span aria-hidden="true">✎</span>Editar mensaje</button>' : ""}${canDelete ? '<button role="menuitem" type="button" class="danger" data-message-action="delete"><span aria-hidden="true">⌫</span>Eliminar mensaje</button>' : ""}`;
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
const newsDateFormatter = new Intl.DateTimeFormat("es-ES", {day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"});
const shortMonthFormatter = new Intl.DateTimeFormat("es-ES", {month: "short"});
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
  warmChatImages(messages.filter(message => String(message.channelId || "") === String(id || "")), {explicit: true});
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
  input.placeholder = readOnly ? "Solo los administradores pueden publicar" : enabled ? "Mensaje…" : "El chat necesita conexión";
}

function renderPresence() {
  adminConsole?.refreshStats();
  const count = onlineUsers.length;
  const label = count === 1 ? "1 conectado" : `${count} conectados`;
  updateSurfaceMarkup(document.getElementById("chatOnlineStatus"), `<i></i> ${label}`);
  updateSurfaceMarkup(document.getElementById("heroOnlineStatus"), `<i></i> ${count ? `${label} ahora` : "Nadie conectado"}`);
  const panel = document.getElementById("onlineMembers");
  if (!panel) return;
  const others = onlineUsers.map(user => getMember(user.legacy_id)).filter(member => member && member.id !== currentUser?.id);
  panel.hidden = !others.length;
  updateSurfaceMarkup(panel, others.length ? `<h4>Conectados ahora</h4><div>${others.map(member => `<button type="button" data-private-member="${member.id}" aria-label="Escribir a ${escapeHtml(member.name)}"><span class="online-avatar">${getAvatar(member)}<i></i></span><small>${escapeHtml(member.name.split(" ")[0])}</small></button>`).join("")}</div>` : "");
  if (document.getElementById("chat")?.classList.contains("active")) renderPrivateContacts();
  const peerLabel = document.querySelector("#privateChatHeader .chat-username");
  const peer = getMember(activePrivateMemberId);
  if (peerLabel && peer) peerLabel.textContent = privatePresenceLabel(peer);
}

function memberIsOnline(member) {
  return onlineUsers.some(user => Number(user.legacy_id) === member.id);
}

function privatePresenceLabel(member) {
  return memberIsOnline(member) ? "En línea" : `@${member.username}`;
}

// Warm only the newest attachments while the inbox is open. Keep this small:
// full camera images can otherwise retain tens of megabytes each on iPhone.
const chatImageWarmCache = new Map();
let chatImageWarmOwner = null;
let chatImageWarmTimer = null;
function clearChatImageWarmCache() {
  clearTimeout(chatImageWarmTimer); chatImageWarmTimer = null;
  for (const entry of chatImageWarmCache.values()) {
    clearTimeout(entry.timer); entry.image.onload = entry.image.onerror = null;
    entry.image.removeAttribute("src");
  }
  chatImageWarmCache.clear(); chatImageWarmOwner = null;
}
function warmChatImages(items, {limit = 4, explicit = false} = {}) {
  const owner = currentAuthUser?.id;
  if (!owner || document.hidden) return;
  const connection = navigator.connection;
  if (!explicit && (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || ""))) return;
  if (chatImageWarmOwner !== owner) { clearChatImageWarmCache(); chatImageWarmOwner = owner; }
  const sources = [...new Set([...items].sort((a, b) => messageTimestamp(b) - messageTimestamp(a))
    .filter(message => message.attachmentType?.startsWith("image/") && !getSharedMediaReference(message))
    .map(message => chatImageSource(message.attachmentUrl)).filter(Boolean))].slice(0, Math.min(limit, 4));
  for (const source of sources) {
    if (chatImageWarmCache.has(source)) {
      const entry = chatImageWarmCache.get(source);
      chatImageWarmCache.delete(source); chatImageWarmCache.set(source, entry);
      continue;
    }
    while (chatImageWarmCache.size >= 4) {
      const key = chatImageWarmCache.keys().next().value, old = chatImageWarmCache.get(key);
      clearTimeout(old.timer); old.image.onload = old.image.onerror = null; old.image.removeAttribute("src");
      chatImageWarmCache.delete(key);
    }
    const image = new Image(), entry = {image, timer: null};
    image.decoding = "async"; image.fetchPriority = explicit ? "auto" : "low";
    const finish = failed => {
      clearTimeout(entry.timer); image.onload = image.onerror = null;
      // Oversized legacy files may stay in the HTTP cache without retaining a
      // decoded copy in our warm set. New uploads are bounded to 2048 pixels.
      if (failed || image.naturalWidth * image.naturalHeight > 4200000) {
        if (chatImageWarmCache.get(source) === entry) chatImageWarmCache.delete(source);
        image.removeAttribute("src");
      }
      let pixels = [...chatImageWarmCache.values()].reduce((sum, item) => sum + item.image.naturalWidth * item.image.naturalHeight, 0);
      for (const [key, old] of chatImageWarmCache) {
        if (pixels <= 6300000) break;
        if (old === entry || !old.image.naturalWidth) continue;
        pixels -= old.image.naturalWidth * old.image.naturalHeight;
        clearTimeout(old.timer); old.image.onload = old.image.onerror = null; old.image.removeAttribute("src");
        chatImageWarmCache.delete(key);
      }
    };
    image.onload = () => finish(false); image.onerror = () => finish(true);
    chatImageWarmCache.set(source, entry);
    entry.timer = setTimeout(() => finish(true), 15000); image.src = source;
    if (image.complete && image.naturalWidth) finish(false);
  }
}
function inboxChatImageWarmCandidates() {
  const owner = currentAuthUser?.id;
  const readyImage = message => message.attachmentType?.startsWith("image/")
    && !getSharedMediaReference(message) && chatImageSource(message.attachmentUrl);
  const group = messages.filter(message => String(message.channelId || "") === String(activeChatChannelId || "") && readyImage(message))
    .sort((a, b) => messageTimestamp(b) - messageTimestamp(a));
  const conversations = new Map();
  for (const message of privateMessages) {
    const peer = message.senderId === owner ? message.recipientId : message.recipientId === owner ? message.senderId : null;
    if (!peer) continue;
    let conversation = conversations.get(peer);
    if (!conversation) conversations.set(peer, conversation = {latest: 0, images: []});
    conversation.latest = Math.max(conversation.latest, messageTimestamp(message));
    if (readyImage(message)) conversation.images.push(message);
  }
  const queues = [...conversations.values()].sort((a, b) => b.latest - a.latest)
    .map(conversation => conversation.images.sort((a, b) => messageTimestamp(b) - messageTimestamp(a)));
  const direct = [];
  // Take one recent photo per conversation before taking a second from any of
  // them. Reserve private slots so a busy group cannot occupy the whole cache.
  for (let round = 0; direct.length < 4 && queues.some(queue => queue.length > round); round++) {
    for (const queue of queues) if (queue[round] && direct.length < 4) direct.push(queue[round]);
  }
  const privateSlots = group.length ? 3 : 4;
  const selected = direct.slice(0, privateSlots);
  selected.push(...group.slice(0, 4 - selected.length));
  if (selected.length < 4) selected.push(...direct.slice(privateSlots, privateSlots + 4 - selected.length));
  return selected;
}
function scheduleChatImageWarmup() {
  clearTimeout(chatImageWarmTimer);
  chatImageWarmTimer = setTimeout(() => {
    chatImageWarmTimer = null;
    if (document.getElementById("privados")?.classList.contains("active")) {
      const member = getMember(activePrivateMemberId);
      warmChatImages(privateMessages.filter(message => message.senderId === member?.authId || message.recipientId === member?.authId), {explicit: true});
    } else if (document.getElementById("chat")?.classList.contains("active")) {
      const conversationOpen = document.getElementById("chat").classList.contains("conversation-open");
      warmChatImages(conversationOpen
        ? messages.filter(message => String(message.channelId || "") === String(activeChatChannelId || ""))
        : inboxChatImageWarmCandidates());
    }
  }, 0);
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
function queueChatThumbnail(image) {
  const warm = chatImageWarmCache.get(image.dataset.imageSource)?.image;
  // A prepared photo can start before the first paint; IntersectionObserver
  // would otherwise deliberately leave a loading card for one more frame.
  if (warm?.complete && warm.naturalWidth) startChatThumbnail(image);
  else if (chatThumbnailObserver) chatThumbnailObserver.observe(image);
  else startChatThumbnail(image);
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
      queueChatThumbnail(image);
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
        queueChatThumbnail(cached);
      }
    } else queueChatThumbnail(image);
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
    if (privateAttachmentPath(message.attachmentUrl)) {
      void resolvePrivateAttachments();
      return `<span class="retired-content" aria-busy="true">Cargando adjunto…</span>`;
    }
    return `<span class="retired-content">Adjunto no disponible</span>`;
  }
  if (message.attachmentType === "text/news-link") {
    return `<a class="message-news-link" href="${escapeHtml(attachmentUrl)}" target="_blank" rel="noopener noreferrer"><span>NOTICIA</span><strong>${escapeHtml(message.attachmentName || "Abrir noticia")}</strong><small>Leer en ${escapeHtml(new URL(attachmentUrl).hostname.replace(/^www\./, ""))} →</small></a>`;
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
    <span class="private-contact-copy"><span><strong>${escapeHtml(siteSettings.group_name || "Bigboys")}</strong>${latestGroupMessage ? `<time datetime="${escapeHtml(latestGroupMessage.createdAt)}">${formatInboxTime(latestGroupMessage.createdAt)}</time>` : ""}</span><small><span class="inbox-group-label">Grupo · </span>${latestGroupChannel ? `#${escapeHtml(latestGroupChannel.name)} · ` : ""}${escapeHtml(groupPreview)}</small></span>
  </button>`;
  const privateContactsMarkup = contacts.map(({member, latest}) => {
    const unread = unreadByMember.get(member.authId) || 0;
    const favorite = userFavorites.has(String(member.authId));
    return `<button type="button" class="private-contact ${unread ? "has-unread" : ""} ${activePrivateMemberId === member.id ? "active" : ""}" data-private-member="${member.id}" data-kind="private" data-favorite-id="${escapeHtml(member.authId || "")}" data-favorite="${favorite}" data-search="${escapeHtml(`${member.name} ${member.username || ""}`)}" data-conversation="${Boolean(latest) || unread > 0}" data-unread="${unread}" aria-description="Mantén pulsado para gestionar favoritos">
      <span class="online-avatar">${getAvatar(member)}${memberIsOnline(member) ? '<i aria-label="En línea"></i>' : ""}</span>
      <span class="private-contact-copy"><span><strong>${escapeHtml(member.name)}</strong>${latest ? `<time datetime="${escapeHtml(latest.createdAt)}">${formatInboxTime(latest.createdAt)}</time>` : ""}</span><small>${latest ? `${latest.senderId === currentAuthUser?.id ? "Tú: " : ""}${escapeHtml(messagePreviewText(latest.body, latest.attachmentType))}` : "Iniciar conversación"}</small></span>
      ${unread ? `<span class="inbox-unread-count" aria-label="${unread} avisos sin leer">${unread > 99 ? "99+" : unread}</span>` : ""}
    </button>`;
  }).join("");
  updateSurfaceMarkup(panel, `${groupContact}${privateContactsMarkup}`);
  paintInboxChota([...unreadByMember.values()].reduce((sum, count) => sum + count, 0), contacts.filter(({member}) => memberIsOnline(member)).length);
  filterInboxContacts();
}

// El Chota sums up the inbox: unread first, then who is around.
function paintInboxChota(unread, online) {
  const node = document.querySelector(".inbox-chota");
  if (!node) return;
  const [mood, line] = unread ? ["cheer", `Tienes ${unread} ${unread === 1 ? "mensaje" : "mensajes"} sin leer. ¡No ${unread === 1 ? "lo dejes" : "los dejes"} en visto!`]
    : online ? ["wave", `${online} del club ${online === 1 ? "está" : "están"} conectado${online === 1 ? "" : "s"} ahora mismo.`]
    : ["calm", "Todo leído. Esto está muy tranquilo."];
  node.hidden = false;
  node.dataset.mood = mood;
  const text = node.querySelector("[data-inbox-chota]");
  if (text.textContent !== line) text.textContent = line;
}

function formatChatText(text) {
  const safe = escapeHtml(text);
  return globalThis.ChatMentions?.format(safe) ?? safe;
}

function messagePreviewText(body, attachmentType) {
  if (globalThis.PackExtras?.sharedId(body)) return "Ha compartido un sobre";
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
  warmChatImages(privateMessages.filter(message => message.senderId === member.authId || message.recipientId === member.authId), {explicit: true});
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
    updateSurfaceMarkup(emptyPrivateHeader, `<div><span class="eyebrow">MENSAJE DIRECTO</span><h3>Elige un miembro</h3></div>`);
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
  updateSurfaceMarkup(privateHeader, `
    <div class="private-chat-person">
      <button class="chat-back-button private-conversation-back" type="button" data-private-back aria-label="Volver a conversaciones"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button>
      <button type="button" class="private-chat-avatar" data-profile="${escapeHtml(String(member.id))}" aria-label="Ver perfil de ${escapeHtml(member.name)}">
        ${getAvatar(member)}
      </button>
      <div><h3>${escapeHtml(globalThis.ChatCustom?.name("private", member) || member.name)}</h3><span class="chat-username">${escapeHtml(privatePresenceLabel(member))}</span></div>
    </div>`);
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
        ${message.body ? `<p>${formatChatText(message.body)}</p>` : ""}
        ${message.attachmentUrl ? renderMessageAttachment(message) : ""}
        <div class="message-footer"><time class="private-message-time" datetime="${escapeHtml(message.createdAt)}" title="${escapeHtml(formatMessageDate(message.createdAt))}">${formatConversationTime(message.createdAt)}</time>${message.editedAt ? '<span class="message-edited">editado</span>' : ""}
        </div>
        ${globalThis.ChatCustom?.chips("private", message.id) || ""}
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
  if (compact) {
    // Month rows jump to their day; editing lives in the selected-day card.
    const day = new Date(calendarDate.getFullYear(), date.getMonth(), date.getDate());
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const detail = [birthday ? "Todo el día" : conversationTimeFormatter.format(date), event.location].filter(Boolean).map(escapeHtml).join(" · ");
    return `<button type="button" class="calendar-month-row ${birthday ? "birthday" : ""}" data-calendar-date="${key}"><time datetime="${key}"><strong>${day.getDate()}</strong><span>${calendarWeekdayFormatter.format(day).replace(".", "")}</span></time><span class="calendar-month-row-copy"><strong>${escapeHtml(event.title)}</strong><small>${detail}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>`;
  }
  return `<article class="calendar-agenda-event ${birthday ? "birthday" : ""} ${compact ? "compact" : ""}">
    <time class="calendar-event-date" datetime="${escapeHtml(event.startsAt)}"><strong>${date.getDate()}</strong><span>${shortMonthFormatter.format(date)}</span></time>
    <div class="calendar-event-copy"><span class="calendar-event-type">${birthday ? "Cumpleaños · Todo el día" : conversationTimeFormatter.format(date)}</span><h4>${escapeHtml(event.title)}</h4>${event.location ? `<p>${escapeHtml(event.location)}</p>` : ""}${!compact && event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}${!compact && !birthday && event.endsAt ? `<p>Hasta ${conversationTimeFormatter.format(new Date(event.endsAt))}</p>` : ""}${canEditCalendarEvent(event) ? `<button type="button" class="calendar-edit-event" data-edit-calendar-event="${escapeHtml(event.id)}">Editar</button>` : ""}${!compact ? `<button type="button" class="club-live-event-link" data-club-live-event="${escapeHtml(event.id)}" data-occurrence="${escapeHtml(activeCalendarDay)}">Plan en directo</button>${globalThis.GroupInteractions?.attendanceMarkup(event, activeCalendarDay) || ""}` : ""}</div>
  </article>`;
}

const calendarWeekdayFormatter = new Intl.DateTimeFormat("es-ES", {weekday: "short"});
// El Chota comments on the chosen day with a pose that matches it.
const calendarChotaPoses = {birthday: "60% 66.667%", plans: "60% 0%", free: "40% 100%", past: "0% 0%"};
function calendarChotaLine(events, date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const past = date < today, seed = date.getDate();
  const birthdays = events.filter(event => event.eventType === "birthday").map(event => String(event.title).replace(/^cumpleaños de\s+/i, ""));
  const plans = events.filter(event => event.eventType !== "birthday");
  if (birthdays.length) return {mood: "birthday", text: past ? `Ese día cumplió ${birthdays.join(" y ")}. Aún me quedan restos de tarta.` : [`¡Cumple ${birthdays.join(" y ")}! Yo pongo las velas.`, `Cumpleaños de ${birthdays.join(" y ")}. Ya estoy ensayando el cumpleaños feliz.`][seed % 2]};
  if (plans.length) {
    const first = plans[0], when = new Date(date); const start = new Date(first.startsAt); when.setHours(start.getHours(), start.getMinutes());
    const cached = tigretonComments.get(tigretonContextKey(first, when))?.comment;
    if (past) return {mood: "past", text: plans.length === 1 ? `Qué buen día aquel: «${first.title}».` : `${plans.length} planes ese día. No sé ni cómo llegué a casa.`};
    if (cached) return {mood: "plans", text: cached, event: first, when};
    return {mood: "plans", text: plans.length === 1 ? [`Me apunto a «${first.title}». ¿Te vienes?`, `«${first.title}». Lo tengo fichado.`][seed % 2] : `${plans.length} planes este día. Yo voy a todos, obvio.`, event: first, when};
  }
  return {mood: past ? "past" : "free", text: past ? "Ese día fue tranquilo. Ni me acuerdo." : ["Día libre. Me quedo en el sofá… ¿montamos algo?", "Nada en la agenda. Yo propongo pizza."][seed % 2]};
}
function calendarChotaMarkup(events, date) {
  const line = calendarChotaLine(events, date);
  const action = line.mood === "free" && canManageSite() ? `<button type="button" class="calendar-chota-action" data-calendar-new-plan="${escapeHtml(activeCalendarDay)}">Crear un plan</button>` : "";
  return `<div class="calendar-chota" data-mood="${line.mood}"><button type="button" class="calendar-chota-sprite" data-calendar-chota aria-label="Preguntar a El Chota por este día"><span style="background-position:${calendarChotaPoses[line.mood]}"></span></button><div class="calendar-chota-bubble"><strong>El Chota</strong><p>${escapeHtml(line.text)}</p>${action}</div></div>`;
}
async function askCalendarChota(button) {
  const date = new Date(`${activeCalendarDay}T12:00:00`);
  const events = groupEvents.filter(event => eventOccursOn(event, date)).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const line = calendarChotaLine(events, date), bubble = button.closest(".calendar-chota")?.querySelector("p");
  button.closest(".calendar-chota")?.classList.remove("is-bouncing"); void button.offsetWidth; button.closest(".calendar-chota")?.classList.add("is-bouncing");
  if (!line.event || !bubble || !currentAuthUser) return;
  const day = activeCalendarDay;
  bubble.textContent = "…";
  const result = await loadTigretonComment(line.event, line.when, tigretonContextKey(line.event, line.when)).catch(() => null);
  if (day === activeCalendarDay && bubble.isConnected) bubble.textContent = result?.comment || line.text;
}
document.addEventListener("click", event => {
  const chota = event.target.closest("[data-calendar-chota]");
  if (chota) void askCalendarChota(chota);
  const create = event.target.closest("[data-calendar-new-plan]");
  if (create) {
    openEventEditor();
    const start = document.getElementById("eventStartsAt");
    if (start) start.value = toLocalDateTime(new Date(`${create.dataset.calendarNewPlan}T21:00:00`));
  }
});

function renderCalendarSelectedDay() {
  const selectedDate = new Date(`${activeCalendarDay}T12:00:00`);
  const events = groupEvents.filter(event => eventOccursOn(event, selectedDate)).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  document.getElementById("calendarSelectedTitle").textContent = selectedDate.toLocaleDateString("es-ES", {weekday: "long", day: "numeric", month: "long"});
  const dayPlans = events.filter(event => event.eventType !== "birthday").length, dayBirthdays = events.length - dayPlans;
  document.getElementById("calendarDayCount").textContent = [dayPlans ? `${dayPlans} ${dayPlans === 1 ? "plan" : "planes"}` : "", dayBirthdays ? "Cumpleaños" : ""].filter(Boolean).join(" · ") || "Libre";
  document.getElementById("calendarSelectedEvents").innerHTML = calendarChotaMarkup(events, selectedDate) + events.map(event => calendarEventMarkup(event)).join("");
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
  const monthLabel = calendarDate.toLocaleDateString("es-ES", {month: "long"});
  const eventsByDay = new Map();
  for (const event of groupEvents) {
    const date = new Date(event.startsAt);
    if (date.getMonth() !== month || event.eventType !== "birthday" && date.getFullYear() !== year) continue;
    const day = date.getDate();
    if (!eventsByDay.has(day)) eventsByDay.set(day, []);
    eventsByDay.get(day).push(event);
  }
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
    const events = eventsByDay.get(day) || [];
    const calendarKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells += `<button class="calendar-day ${dateKey(date) === todayKey ? "today" : ""} ${events.length ? "has-events" : ""} ${events.some(event => event.eventType === "birthday") ? "has-birthday" : ""} ${date < new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? "is-past" : ""}" type="button" data-calendar-date="${calendarKey}" ${dateKey(date) === todayKey ? 'aria-current="date"' : ""} aria-label="${day} de ${monthLabel}, ${events.length} eventos${events.length ? `: ${escapeHtml(events.map(event => event.title).join(", "))}` : ""}"><span class="calendar-day-number">${day}</span><span class="calendar-dots" aria-hidden="true">${events.slice(0, 3).map(event => `<i class="${event.eventType === "birthday" ? "birthday" : ""}"></i>`).join("")}</span></button>`;
  }
  cells += Array.from({length: (7 - ((firstWeekday + days) % 7)) % 7}, () => `<div class="calendar-day outside" aria-hidden="true"></div>`).join("");
  document.getElementById("calendarGrid").innerHTML = cells;
  const monthEvents = [...eventsByDay.entries()].sort(([a], [b]) => a - b).flatMap(([, events]) => events);
  const monthBirthdays = monthEvents.filter(event => event.eventType === "birthday").length, monthPlans = monthEvents.length - monthBirthdays;
  document.getElementById("calendarMonthCount").textContent = [monthPlans ? `${monthPlans} ${monthPlans === 1 ? "plan" : "planes"}` : "", monthBirthdays ? `${monthBirthdays} ${monthBirthdays === 1 ? "cumpleaños" : "cumpleaños"}` : ""].filter(Boolean).join(" · ") || "Sin fechas";
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
let chotaRoomLightsOff = chotaSleeping;
let chotaSleepTimer = 0;
let chotaCommentSequence = 0;
let tigretonRenderedKey = "";
// One visible pet at a time: pause offscreen and cancel every timer on a rerender.
let tigretonMotion = null;
let tigretonMotionPet = null;
const tigretonReducedMotion = (globalThis.ClubMotion?.media || window.matchMedia("(prefers-reduced-motion: reduce)"));
// Decode optional animation sheets only when a pose needs them and editing is idle.
// Keep the resting pose while a shared request prepares the sheet.
const chotaTalkSprite = new Image();
const chotaPoseSprite = new Image();
const chotaDirectionalSprite = new Image();
let chotaDirectionalRequest = null;
function ensureChotaDirectionalSprite() {
  if (!chotaDirectionalRequest) {
    chotaDirectionalSprite.src = (globalThis.ChotaAppearance?.base?.("directional") || "icons/mascot/chota-v2/chota-directional-v1.webp");
    chotaDirectionalRequest = chotaDirectionalSprite.decode().then(() => chotaDirectionalSprite.naturalWidth > 0, () => false);
  }
  return chotaDirectionalRequest;
}
const chotaContextSprite = new Image();
let chotaContextRequest = null;
function ensureChotaContextSprite() {
  if (!chotaContextRequest) {
    chotaContextSprite.src = (globalThis.ChotaAppearance?.base?.("contextual") || "icons/mascot/chota-v2/chota-contextual-v1.webp");
    chotaContextRequest = chotaContextSprite.decode().then(() => chotaContextSprite.naturalWidth > 0, () => false);
  }
  return chotaContextRequest;
}
const chotaRoomSprite = new Image();
let chotaRoomRequest = null;
function ensureChotaRoomSprite() {
  if (!chotaRoomRequest) {
    chotaRoomSprite.src = (globalThis.ChotaAppearance?.base?.("room") || "icons/mascot/chota-v2/chota-room-life-v1.webp");
    chotaRoomRequest = chotaRoomSprite.decode().then(() => chotaRoomSprite.naturalWidth > 0, () => false);
  }
  return chotaRoomRequest;
}
let chotaSpritesRequest = null;
const chotaSpritesReady = {talk: false, poses: false};
function ensureChotaSprites() {
  if (!chotaSpritesRequest) {
    chotaSpritesRequest = new Promise(resolve => runWhenIdle(() => {
      chotaTalkSprite.src = (globalThis.ChotaAppearance?.base?.("talk") || "icons/mascot/chota-v2/chota-talk.webp");
      chotaPoseSprite.src = (globalThis.ChotaAppearance?.base?.("base") || "icons/mascot/chota-v2/chota-poses.webp");
      Promise.allSettled([
        chotaTalkSprite.decode().then(() => { chotaSpritesReady.talk = chotaTalkSprite.naturalWidth > 0; }),
        chotaPoseSprite.decode().then(() => { chotaSpritesReady.poses = chotaPoseSprite.naturalWidth > 0; })
      ]).then(resolve);
    }));
  }
  return chotaSpritesRequest;
}
function mountTigretonMotion(reactToPlan, event, date) {
  const pet = document.querySelector("#clubhouseContent .tigreton-agenda");
  if (pet && pet === tigretonMotionPet && tigretonMotion && !reactToPlan) { tigretonMotion.refresh(); return; }
  tigretonMotion?.destroy();
  tigretonMotion = null;
  tigretonMotionPet = pet;
  if (!pet) return;
  tigretonMotion = createTigretonMotion(pet, reactToPlan, event, date);
  globalThis.ChotaInteract?.welcome(tigretonMotion);
  if (document.getElementById("chotaViewer")?.open) tigretonMotion.pause();
}
// 2.5D room: x/y are floor coordinates, z is height above that floor.
// Footprints follow the illustration, not the transparent bounds of a sprite.
function chotaRoomObstacles() {
  return [
    {id:"sofa",x0:0,y0:.565,x1:.205,y1:.722},
    {id:"chair",x0:.807,y0:.585,x1:1,y1:.724},
    {id:"console",x0:.535,y0:.535,x1:.827,y1:.573},
    {id:"left-table",x0:0,y0:.723,x1:.167,y1:.904},
    {id:"right-table",x0:.891,y0:.665,x1:1,y1:.805},
    {id:"left-plant",x0:0,y0:.90,x1:.16,y1:1},
    {id:"right-plant",x0:.872,y0:.815,x1:1,y1:1},
  ];
}
function chotaRoomSegmentClear(a, b, obstacles, radius=.023) {
  // Slab intersection sweeps the whole segment; a delayed frame cannot tunnel.
  return obstacles.every(box => {
    let enter=0, leave=1;
    for (const axis of ["x","y"]) {
      const low=box[axis+"0"]-radius, high=box[axis+"1"]+radius, delta=b[axis]-a[axis];
      if (Math.abs(delta)<1e-9) { if (a[axis]<=low || a[axis]>=high) return true; }
      else { const t0=(low-a[axis])/delta,t1=(high-a[axis])/delta; enter=Math.max(enter,Math.min(t0,t1)); leave=Math.min(leave,Math.max(t0,t1)); }
    }
    return enter>=leave || leave<=0 || enter>=1;
  });
}
function chotaRoomRoute(from, to, obstacles=chotaRoomObstacles()) {
  const radius=.023, margin=radius+.001;
  const free=p=>p.x>=.025 && p.x<=.975 && p.y>=.59 && p.y<=.97 && obstacles.every(b=>p.x<=b.x0-radius || p.x>=b.x1+radius || p.y<=b.y0-radius || p.y>=b.y1+radius);
  const nodes=[from,to];
  for (const b of obstacles) for (const x of [b.x0-margin,b.x1+margin]) for (const y of [b.y0-margin,b.y1+margin]) if(free({x,y})) nodes.push({x,y});
  const distance=nodes.map(()=>Infinity),previous=[],visited=new Set();distance[0]=0;
  while(visited.size<nodes.length) {
    let i=-1;for(let j=0;j<nodes.length;j++) if(!visited.has(j)&&(i<0||distance[j]<distance[i])) i=j;
    if(i<0||!Number.isFinite(distance[i])||i===1) break;
    visited.add(i);
    for(let j=0;j<nodes.length;j++) if(!visited.has(j)&&chotaRoomSegmentClear(nodes[i],nodes[j],obstacles,radius)) {
      const d=distance[i]+Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y);
      if(d<distance[j]) {distance[j]=d;previous[j]=i;}
    }
  }
  if(!Number.isFinite(distance[1])) return [{...from}]; // A blocked destination never teleports through an object.
  const route=[];for(let i=1;i!==undefined;i=previous[i]) route.unshift({...nodes[i]});
  let travelled=0;return route.map((point,i)=>{if(i) travelled+=Math.hypot(point.x-route[i-1].x,point.y-route[i-1].y);return {...point,s:from.s+(to.s-from.s)*(distance[1]?travelled/distance[1]:1),z:0};});
}
function chotaRoomRoutePoint(route, progress) {
  const lengths=route.slice(1).map((p,i)=>Math.hypot(p.x-route[i].x,p.y-route[i].y));
  let remaining=lengths.reduce((sum,n)=>sum+n,0)*Math.max(0,Math.min(1,progress));
  for(let i=0;i<lengths.length;i++) {if(remaining<=lengths[i] || i===lengths.length-1) {const p=lengths[i]?remaining/lengths[i]:1,a=route[i],b=route[i+1];return {x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,s:a.s+(b.s-a.s)*p,z:0};}remaining-=lengths[i];}
  return {...route[0]};
}
function chotaRoomSupportPoint(from, to, progress) {
  const t=Math.max(0,Math.min(1,progress));
  // Constant downward acceleration, with a small hop to clear the cushion lip.
  return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,s:from.s+(to.s-from.s)*t,z:(from.z||0)+((to.z||0)-(from.z||0))*t+.07*4*t*(1-t),airborne:t>0&&t<1};
}
function chotaRoomVisitLayout(kind) {
  const width = kind === "sofa" ? .235 : kind === "board" ? .235 : .225;
  return {
    width,
    target:kind === "sofa" ? {x:.125,y:.755,z:.088,s:width/.28} : kind === "board" ? {x:.345,y:.605,z:0,s:width/.28} : {x:.77,y:.605,z:0,s:width/.28},
    approach:{x:.235,y:.755,z:0,s:width/.28},
  };
}
function chotaRoomTransform(point, home, size) {
  return `translate(${(point.x-home.x)*size}px,${(point.y-(point.z||0)-home.y)*size}px) scale(${point.s})`;
}
// Ambient gestures animate the existing separated rig, never the room/feet.
function chotaLifeCatalog() {
  return {
    "ear-flick-left":{family:"ears",cooldown:70000,familyCooldown:20000,duration:1550},
    "ear-flick-right":{family:"ears",cooldown:75000,familyCooldown:20000,duration:1700},
    "ear-scan":{family:"ears",cooldown:130000,familyCooldown:24000,duration:3400},
    "tail-sway":{family:"tail",cooldown:90000,familyCooldown:22000,duration:3700},
    "deep-breath":{family:"posture",cooldown:180000,familyCooldown:38000,duration:5200},
    "shake-off":{family:"reflex",cooldown:240000,familyCooldown:120000,duration:2300},
    "soft-blink":{family:"face",cooldown:95000,familyCooldown:23000,duration:2700},
    "paw-relax":{family:"selfcare",cooldown:150000,familyCooldown:34000,duration:3200},
    listen:{family:"orient",cooldown:95000,familyCooldown:26000,duration:3100},
    balance:{family:"posture",cooldown:125000,familyCooldown:38000,duration:3600},
    "check-tail":{family:"selfcare",cooldown:135000,familyCooldown:34000,duration:3400},
    "check-shoes":{family:"selfcare",cooldown:150000,familyCooldown:34000,duration:3200},
    sneeze:{family:"reflex",cooldown:240000,familyCooldown:120000,duration:1900},
    drowsy:{family:"rest",cooldown:180000,familyCooldown:95000,duration:4200},
  };
}
function chotaAttentionFamily(action) {
  return chotaLifeCatalog()[action]?.family || ({roomba:"orient",window:"orient",look:"orient",ears:"orient",tail:"selfcare",scratch:"selfcare",shirt:"selfcare",stretch:"posture",settle:"posture",plan:"orient"})[action] || action;
}
function chotaChooseLifeAction({now,moment,lastAction,times,families,lastTouchAt,outdoor=false,random=Math.random()}) {
  if(now-lastTouchAt<12000) return null;
  const choices=Object.entries(chotaLifeCatalog()).filter(([action,info])=>action!==lastAction &&
    (action!=="drowsy" || ["evening","night"].includes(moment)) &&
    now-(times.get(action)??-Infinity)>=info.cooldown && now-(families.get(info.family)??-Infinity)>=info.familyCooldown).map(([action])=>action);
  if(outdoor && choices.includes("listen")) return "listen";
  // Randomize among the three most rested eligible gestures: variety without a fixed cycle.
  const ages=choices.map(action=>times.get(action)??-Infinity).sort((a,b)=>a-b);
  const cutoff=ages[Math.min(2,ages.length-1)];
  const rested=choices.filter(action=>(times.get(action)??-Infinity)<=cutoff);
  return rested[Math.min(rested.length-1,Math.floor(random*rested.length))] || null;
}
function chotaLifeTracks(action, direction=1) {
  const t=(x=0,y=0,r=0)=>`translate(${x}%,${y}%) rotate(${r}deg)`;
  const track=points=>points.map(([offset,transform])=>({offset,transform,easing:"ease-in-out"}));
  const blink=points=>points.map(([offset,opacity])=>({offset,opacity,easing:"ease-in-out"}));
  const d=direction;
  // Local articulation: none of these tracks moves the actor or contact shoes.
  if(action==="ear-flick-left" || action==="ear-flick-right") {
    const left=action==="ear-flick-left", sign=left?-1:1;
    return {[left?"leftEar":"rightEar"]:track([[0,t()],[.16,t()],[.24,t(0,0,8*sign)],[.36,t(0,0,-3*sign)],[.5,t(0,0,3*sign)],[.7,t()],[1,t()]]),
      tail:track([[0,t()],[.6,t(0,0,-1.2)],[1,t()]])};
  }
  if(action==="ear-scan") return {
    leftEar:track([[0,t()],[.15,t(0,0,-8)],[.34,t(0,0,-8)],[.55,t(0,0,2)],[.8,t()],[1,t()]]),
    rightEar:track([[0,t()],[.3,t()],[.45,t(0,0,8)],[.69,t(0,0,5)],[.88,t(0,0,-1)],[1,t()]]),
    head:track([[0,t()],[.39,t()],[.58,t(.3,-.15,.7)],[.8,t(.3,-.15,.7)],[1,t()]]),
    tail:track([[0,t()],[.65,t(0,0,-2)],[1,t()]])};
  if(action==="tail-sway") return {
    tail:track([[0,t()],[.17,t(0,0,-4.5)],[.33,t(0,0,-2)],[.48,t(0,0,-5.5)],[.65,t(0,0,-3)],[.84,t(0,0,-1)],[1,t()]]),
    leftEar:track([[0,t()],[.55,t()],[.69,t(0,0,-2)],[1,t()]])};
  if(action==="deep-breath") return {
    body:track([[0,"scale(1)"],[.35,"scale(1.006,1.014)"],[.46,"scale(1.006,1.014)"],[.82,"scale(1)"],[1,"scale(1)"]]),
    head:track([[0,t()],[.35,t(0,-.35,-.45)],[.46,t(0,-.35,-.45)],[.82,t(0,.15,.3)],[1,t()]]),
    leftEar:track([[0,t()],[.6,t(0,0,2.4)],[1,t()]]),
    rightEar:track([[0,t()],[.65,t(0,0,-2)],[1,t()]]),
    lids:blink([[0,0],[.21,0],[.33,1],[.52,1],[.69,0],[1,0]])};
  if(action==="shake-off") return {
    head:track([[0,t()],[.14,t(0,.15,.6)],[.28,t(-.3,0,-2.2)],[.38,t(.3,0,2)],[.48,t(-.2,0,-1.3)],[.59,t(.15,0,.7)],[.74,t()],[1,t()]]),
    leftEar:track([[0,t()],[.27,t(0,0,5)],[.39,t(0,0,-6)],[.5,t(0,0,4)],[.64,t(0,0,-2)],[.82,t()],[1,t()]]),
    rightEar:track([[0,t()],[.31,t(0,0,6)],[.43,t(0,0,-5)],[.54,t(0,0,3)],[.68,t(0,0,-1)],[.86,t()],[1,t()]]),
    tail:track([[0,t()],[.4,t(0,0,-4)],[.64,t(0,0,2)],[1,t()]]),
    lids:blink([[0,0],[.18,0],[.27,1],[.62,1],[.78,0],[1,0]])};
  if(action==="soft-blink") return {
    lids:blink([[0,0],[.15,0],[.25,1],[.42,1],[.55,0],[.66,0],[.72,1],[.8,0],[1,0]]),
    head:track([[0,t()],[.36,t(0,.25,.45)],[.61,t(0,.25,.45)],[1,t()]]),
    leftEar:track([[0,t()],[.4,t(0,0,2)],[1,t()]]),
    rightEar:track([[0,t()],[.47,t(0,0,-1.5)],[1,t()]])};
  if(action==="paw-relax") return {
    paw:track([[0,t()],[.22,t(0,0,-3)],[.4,t(0,0,2.2)],[.58,t(0,0,-1.7)],[.78,t(0,0,.7)],[1,t()]]),
    head:track([[0,t()],[.25,t(.1,.45,.8)],[.5,t(.1,.45,.8)],[1,t()]]),
    tail:track([[0,t()],[.55,t(0,0,-2)],[1,t()]]),
    rightEar:track([[0,t()],[.4,t(0,0,2)],[1,t()]])};
  if(action==="listen") return {
    leftEar:track([[0,t()],[.12,t(0,0,-9*d)],[.32,t(0,0,-6*d)],[.7,t(0,0,-3*d)],[1,t()]]),
    rightEar:track([[0,t()],[.18,t(0,0,7*d)],[.34,t(0,0,4*d)],[.73,t(0,0,2*d)],[1,t()]]),
    head:track([[0,t()],[.22,t()],[.4,t(.7*d,-.3,2*d)],[.73,t(.6*d,-.2,1.6*d)],[1,t()]]),
    tail:track([[0,t()],[.3,t(0,0,-2*d)],[.75,t(0,0,-2*d)],[1,t()]]),
  };
  if(action==="balance") return {
    body:track([[0,t()],[.18,t(0,.15,-.2*d)],[.43,t(.2*d,0,.85*d)],[.72,t(.2*d,0,.85*d)],[1,t()]]),
    head:track([[0,t()],[.2,t()],[.47,t(-.25*d,.1,-1*d)],[.75,t(-.25*d,.1,-1*d)],[1,t()]]),
    tail:track([[0,t()],[.28,t(0,0,-2*d)],[.56,t(0,0,-5*d)],[.79,t(0,0,-3*d)],[1,t()]]),
    leftEar:track([[0,t()],[.45,t(0,0,2*d)],[1,t()]]),
  };
  if(action==="check-tail") return {
    tail:track([[0,t()],[.18,t(0,0,-7)],[.4,t(0,0,-4)],[.55,t(0,0,-7)],[.78,t(0,0,-3)],[1,t()]]),
    head:track([[0,t()],[.15,t()],[.35,t(-.8,.8,-2.5)],[.66,t(-.8,.8,-2.5)],[.83,t(-.3,.3,-1)],[1,t()]]),
    body:track([[0,t()],[.38,t(-.1,0,-.4)],[.72,t(-.1,0,-.4)],[1,t()]]),
    leftEar:track([[0,t()],[.3,t(0,0,-5)],[.7,t(0,0,-2)],[1,t()]]),
  };
  if(action==="check-shoes") return {
    head:track([[0,t()],[.16,t(0,-.2,-.4)],[.37,t(.2,1.6,4.2)],[.66,t(.2,1.6,4.2)],[.81,t(-.1,.4,.8)],[1,t()]]),
    body:track([[0,t()],[.32,t(0,.2,.6)],[.7,t(0,.2,.6)],[1,t()]]),
    rightEar:track([[0,t()],[.4,t(0,0,5)],[.72,t(0,0,3)],[1,t()]]),
    lids:blink([[0,0],[.23,0],[.37,.38],[.68,.38],[.85,0],[1,0]]),
  };
  if(action==="sneeze") return {
    head:track([[0,t()],[.2,t(0,-.4,-1.5)],[.36,t(0,-.6,-2)],[.43,t(.2,1.3,4)],[.51,t(-.2,-.25,-1)],[.65,t(.1,.2,.7)],[1,t()]]),
    body:track([[0,t()],[.34,t(0,-.1,-.25)],[.44,t(0,.35,1.2)],[.56,t(0,-.1,-.35)],[.72,t()],[1,t()]]),
    leftEar:track([[0,t()],[.34,t(0,0,-3)],[.45,t(0,0,8)],[.63,t(0,0,-2)],[1,t()]]),
    rightEar:track([[0,t()],[.34,t(0,0,3)],[.45,t(0,0,-7)],[.63,t(0,0,2)],[1,t()]]),
    tail:track([[0,t()],[.42,t()],[.54,t(0,0,6)],[.72,t(0,0,-2)],[1,t()]]),
    lids:blink([[0,0],[.21,.3],[.35,.6],[.41,1],[.54,1],[.66,0],[1,0]]),
  };
  return {
    head:track([[0,t()],[.22,t(0,.3,.4)],[.51,t(.1,1.1,2.2)],[.64,t(.1,1.1,2.2)],[.73,t(0,-.2,-.5)],[1,t()]]),
    body:track([[0,t()],[.45,t(0,.2,.3)],[.7,t(0,.2,.3)],[1,t()]]),
    tail:track([[0,t()],[.5,t(0,0,-3)],[.8,t(0,0,-2)],[1,t()]]),
    leftEar:track([[0,t()],[.5,t(0,0,5)],[.75,t(0,0,2)],[1,t()]]),
    rightEar:track([[0,t()],[.5,t(0,0,-4)],[.75,t(0,0,-2)],[1,t()]]),
    lids:blink([[0,0],[.23,.5],[.45,.85],[.58,1],[.68,.75],[.76,0],[.88,.25],[1,0]]),
  };
}
function createTigretonMotion(pet, reactToPlan, event, date) {
  const character = pet.querySelector(".tigreton-character");
  // A mirrored Chota swaps to the pre-mirrored outfit sheets (printed marks).
  if (character && typeof MutationObserver === "function") new MutationObserver(() => character.classList.toggle("is-mirrored", /scaleX\(-1\)/.test(character.style.transform))).observe(character, {attributes:true, attributeFilter:["style"]});
  globalThis.ChotaWardrobe?.mount(character);
  const shadow = pet.querySelector(".tigreton-shadow");
  const sleepMark = pet.querySelector(".tigreton-sleep-mark");
  const spark = pet.querySelector(".tigreton-spark");
  const isBirthday = event?.eventType === "birthday";
  const isToday = date && tigretonDaysUntil(date) === 0;
  const sequences = {
    greet: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [3, 2], [4, 2], [2, 2], [5, 2], [1, 2], [0, 3]],
    walk: [[0, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [0, 3]],
    jump: [[0, 2], [12, 1], [13, 2], [14, 1], [15, 2], [14, 1], [16, 2], [17, 2], [0, 3]],
    rest: [[0, 2], [18, 2], [19, 3], [20, 3], [21, 3], [22, 5], [23, 6], [22, 6], [23, 6], [22, 5], [21, 3], [20, 3], [19, 3], [18, 2], [0, 3]],
  };
  const idleHead = character.querySelector(".chota-idle-head");
  const idleBody = character.querySelector(".chota-idle-body");
  const idleTail = character.querySelector(".chota-idle-tail");
  const idlePaw = character.querySelector(".chota-idle-paw");
  const idleEars = [...character.querySelectorAll(".chota-idle-ear")];
  const eyelids = character.querySelector(".chota-idle-eyelids");
  const sleepChest = character.querySelector(".chota-sleep-chest");
  const sleepHead = character.querySelector(".chota-sleep-head");
  const sleepTail = character.querySelector(".chota-sleep-tail");
  let lastSleepMovement = "head";
  let inView = false, timer = 0, frameTimer = 0, blinkTimer = 0, animations = [], destroyed = false, paused = false, spriteRequest = 0;
  let bedtimeActive = false, bedtimeSwitch = null, wakingActive = false, wakingComplete = null, lastAmbientAction = "", frameRaf = 0;
  const attentionTimes = new Map(), familyTimes = new Map();
  const lifeCatalog=chotaLifeCatalog();
  let lifeAction=null, lastLifeAt=-Infinity;
  let lastRoomMoment = pet.closest(".clubhouse-room, .chota-viewer-room-scene")?.dataset.time || "";
  let lastPersonalAt = performance.now(), lastTouchAt = -Infinity;
  let pendingRoomState = null;
  let roomVisit = null, lastRoomVisitAt = performance.now() - 18000;
  let lastMoodAt = performance.now(), lastAnnoyedAt = -Infinity, gazeAnimation = null, gazeTimer = 0;
  const roomVisitTimes = new Map();
  const motionRoot = pet.querySelector(".chota-character-row") || pet;
  const active = () => !destroyed && !paused && inView && !document.hidden && !tigretonReducedMotion.matches && !isChotaSleeping() && !bedtimeActive && !wakingActive;
  function setFrame(frame) {
    character.classList.remove("is-directional", "is-contextual", "is-room-pose");
    character.style.backgroundPosition = `${(frame % 6) * 20}% ${Math.floor(frame / 6) * (100 / 3)}%`;
    globalThis.ChotaWardrobe?.frame(character,"base",frame);
  }
  function setDirectionalFrame(frame) {
    character.classList.remove("is-idling", "is-speaking", "is-contextual", "is-room-pose");
    character.classList.add("is-directional");
    character.style.backgroundPosition = `${(frame % 5) * 25}% ${Math.floor(frame / 5) * (100 / 3)}%`;
    globalThis.ChotaWardrobe?.frame(character,"directional",frame);
  }
  function stop() {
    const wakeDone = wakingComplete;
    wakingComplete = null;
    wakingActive = false;
    bedtimeActive = false;
    bedtimeSwitch = null;
    spriteRequest++;
    lifeAction=null;
    clearTimeout(timer);
    clearTimeout(frameTimer);
    clearTimeout(blinkTimer);
    clearTimeout(gazeTimer); gazeAnimation = null;
    if (frameRaf) { if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameRaf); else clearTimeout(frameRaf); frameRaf = 0; }
    animations.forEach(animation => animation.cancel());
    animations = [];
    pet.style.transform = "";
    pet.style.transformOrigin = "";
    motionRoot.style.transform = "";
    motionRoot.style.transformOrigin = "";
    character.style.transform = "";
    shadow.style.opacity = "";
    shadow.style.transform = "";
    const depth=pet.closest(".chota-room-depth");
    if(depth) {delete depth.dataset.sofaDepth;delete depth.dataset.chairDepth;}
    for(const prop of pet.closest(".clubhouse-room, .chota-viewer-room-scene")?.querySelectorAll(".chota-room-prop[data-chota-rest-z]")||[]) prop.style.zIndex=prop.dataset.chotaRestZ;
    roomVisit = null;
    pet.classList.remove("is-visiting-room", "is-sitting-on-sofa");
    pet.closest(".clubhouse-room, .chota-viewer-room-scene")?.classList.remove("is-chota-on-sofa");
    delete pet.dataset.attention;
    pet.closest(".clubhouse-room, .chota-viewer-room-scene")?.classList.remove("is-switch-pressed");
    pet.classList.remove("is-going-to-sleep", "is-falling-asleep", "is-waking-up", "is-walking");
    pet.classList.remove("is-awake", "is-sleeping", "is-sleep-reacting");
    character.classList.remove("is-speaking", "is-idling", "is-sleep-breathing");
    setFrame(0);
    wakeDone?.();
  }
  function animateIdle(target, frames, options) {
    if (!target) return;
    const animation = target.animate(frames, options);
    animations.push(animation);
    animation.onfinish = () => {
      // Filled poses remain cancellable when another action, sleep or visibility wins.
      if (!["forwards", "both"].includes(options.fill)) animations = animations.filter(item => item !== animation);
    };
    return animation;
  }
  function scheduleBlink() {
    clearTimeout(blinkTimer);
    if (!active() || !character.classList.contains("is-idling")) return;
    blinkTimer = setTimeout(() => {
      if (!active() || !character.classList.contains("is-idling")) return;
      const doubleBlink = Math.random() < .22;
      animateIdle(eyelids, doubleBlink ? [{opacity:0},{opacity:1,offset:.16},{opacity:0,offset:.32},{opacity:0,offset:.55},{opacity:1,offset:.72},{opacity:0}] : [{opacity:0}, {opacity:1,offset:.3}, {opacity:1,offset:.55}, {opacity:0}], {duration:doubleBlink ? 370 : 155,easing:"linear"});
      scheduleBlink();
    }, 3800 + Math.random() * 4800);
  }
  function canAttend(key, now, cooldown) {
    return key !== lastAmbientAction && now - (attentionTimes.get(key) ?? -Infinity) >= cooldown && now-(familyTimes.get(chotaAttentionFamily(key))??-Infinity)>=18000;
  }
  function chooseAttention(now) {
    const room = pet.closest(".clubhouse-room, .chota-viewer-room-scene");
    if (!room) return {action:"ears"};
    const moment = room.dataset.time || "";
    if (moment && moment !== lastRoomMoment) {
      lastRoomMoment = moment;
      return {action:"window", target:room.querySelector(".clubhouse-sky")};
    }
    // The season's mood colours his routine: tired rests, restless paces, happy jumps.
    if (now - lastMoodAt > 75000 && now - lastTouchAt > 15000 && globalThis.ChotaInteract) {
      lastMoodAt = now;
      const pick = globalThis.ChotaInteract.moodAction(globalThis.ChotaInteract.mood());
      if (pick) return {action:`mood-${pick}`};
    }
    const outdoor=room.querySelector(".club-outdoor-flyer, .club-outdoor-patrol");
    const lifeChoice=now-lastLifeAt>22000 ? chotaChooseLifeAction({now,moment,lastAction:lastAmbientAction,times:attentionTimes,families:familyTimes,lastTouchAt,outdoor:!!outdoor}) : null;
    // A busy agenda/window/vacuum must leave space for his own small gestures.
    // This is a maximum wait, not a forced cycle: eligible families stay random.
    if(lifeChoice && now-lastLifeAt>60000) return {action:lifeChoice,target:lifeChoice==="listen"?outdoor:null};
    const plan = room.querySelector(".clubhouse-plan:not(.clubhouse-plan-empty)");
    // Longer actions have destinations and generous pauses; a visible comment wins.
    if (now - lastRoomVisitAt > 105000 && now - lastTouchAt > 20000 && !room.querySelector('[aria-expanded="true"][data-chota-open]')) {
      const destinations = ["window", "sofa", ...(plan ? ["board"] : [])].filter(kind => now - (roomVisitTimes.get(kind) ?? -Infinity) > (kind === "sofa" ? 420000 : kind === "board" ? 300000 : 270000));
      if (destinations.length && Math.random() < .28) return {action:`visit-${destinations[Math.floor(Math.random() * destinations.length)]}`};
    }
    const days = date instanceof Date && Number.isFinite(date.getTime()) ? tigretonDaysUntil(date) : Infinity;
    if (plan && event?.id !== "clubhouse-idle" && days >= 0 && days <= 2 && canAttend("plan", now, 95000)) {
      return {action:"plan", target:plan};
    }
    const vacuum = room.querySelector(".chota-room-robot-vacuum");
    if (vacuum && canAttend("roomba", now, 48000)) {
      const target = vacuum.getBoundingClientRect(), body = character.getBoundingClientRect();
      const distance = Math.hypot(target.left + target.width / 2 - body.left - body.width / 2, target.top + target.height / 2 - body.top - body.height * .85);
      if (target.width > 0 && distance < room.clientWidth * .42) return {action:"roomba", target:vacuum};
    }
    if (["dawn", "evening"].includes(moment) && canAttend("window", now, 110000)) return {action:"window", target:room.querySelector(".clubhouse-sky")};
    if(lifeChoice && (outdoor || Math.random()<.65)) return {action:lifeChoice,target:lifeChoice==="listen"?outdoor:null};
    if (now - lastPersonalAt > 28000 && now - lastTouchAt > 12000) {
      const choices = ["scratch", "shirt", "stretch"].filter(action => canAttend(action, now, action === "stretch" ? 150000 : 90000));
      if (choices.length) return {action:choices[Math.floor(Math.random() * choices.length)]};
    }
    const choices = ["look", "ears", "tail", "settle"].filter(action => canAttend(action,now,30000));
    return {action:choices[Math.floor(Math.random() * choices.length)] || "quiet"};
  }
  function gazeAt(target, kind) {
    const body = character.getBoundingClientRect(), targetBox = target?.getBoundingClientRect();
    const direction = targetBox ? (targetBox.left + targetBox.width / 2 < body.left + body.width / 2 ? -1 : 1) : (Math.random() < .5 ? -1 : 1);
    const down = kind === "roomba", duration = down ? 3400 : 3900;
    const turn = direction * (down ? 2 : 1.8), vertical = down ? .8 : -.8;
    if (down && target) {
      let samples = 0, previous = null, from = "translate(0,0) rotate(0deg)";
      function followVacuum() {
        if (!active() || !character.classList.contains("is-idling")) return;
        previous?.cancel();
        const box = target.getBoundingClientRect(), body = character.getBoundingClientRect();
        const side = Math.max(-1, Math.min(1, (box.left + box.width / 2 - body.left - body.width / 2) / (body.width * .8)));
        const to = samples >= 4 ? "translate(0,0) rotate(0deg)" : `translate(${side * .8}%,.8%) rotate(${side * 2}deg)`;
        previous = animateIdle(idleHead, [{transform:from},{transform:to}], {duration:650,fill:"forwards",easing:"ease-in-out"});
        from = to;
        if (samples++ < 4) frameTimer = setTimeout(followVacuum, 650);
      }
      followVacuum();
    } else animateIdle(idleHead, [{transform:"translate(0,0) rotate(0deg)"},{transform:`translate(${direction * .8}%,${vertical}%) rotate(${turn}deg)`,offset:.23},{transform:`translate(${direction * .55}%,${vertical}%) rotate(${turn * .7}deg)`,offset:.72},{transform:"translate(0,0) rotate(0deg)"}], {duration,easing:"ease-in-out"});
    idleEars.forEach((ear,index) => animateIdle(ear, [{transform:"rotate(0deg)"},{transform:`rotate(${direction * (index ? 2 : 3)}deg)`,offset:.2},{transform:"rotate(0deg)"}], {duration:1800,delay:index*100,easing:"ease-in-out"}));
    animateIdle(idleTail, [{transform:"rotate(0deg)"},{transform:`rotate(${down ? -3 : 2}deg)`,offset:.5},{transform:"rotate(0deg)"}], {duration:duration+200,easing:"ease-in-out"});
    if (kind === "window") animateIdle(eyelids, [{opacity:0},{opacity:.5,offset:.35},{opacity:.5,offset:.55},{opacity:0}], {duration:2100,delay:700,easing:"ease-in-out"});
  }
  function playPersonal(action) {
    const request = ++spriteRequest;
    void ensureChotaContextSprite().then(ready => {
      if (request !== spriteRequest || !active()) return;
      if (!ready) { schedule(); return; }
      stop();
      pet.classList.add("is-awake");
      pet.dataset.attention = action;
      character.classList.add("is-contextual");
      const row = {plan:0, scratch:1, stretch:2, shirt:3}[action] ?? 0;
      const frames = action === "stretch" ? [[0,180],[1,220],[2,850],[3,650],[2,350],[1,220],[0,180]] : action === "scratch" ? [[0,150],[1,200],[2,300],[3,180],[2,180],[3,180],[2,280],[1,200],[0,180]] : action === "shirt" ? [[0,180],[2,350],[3,220],[2,320],[3,180],[2,250],[0,220]] : [[0,180],[1,200],[2,950],[3,550],[2,700],[1,180],[0,180]];
      const duration = frames.reduce((total, [, hold]) => total + hold, 0);
      animateIdle(character, [{transform:"rotate(0deg) scale(1)"},{transform:`rotate(${action === "scratch" ? .35 : -.2}deg) scale(1,${action === "stretch" ? 1.005 : 1.002})`,offset:.5},{transform:"rotate(0deg) scale(1)"}], {duration,easing:"ease-in-out"});
      let index = 0;
      function advancePersonal() {
        if (!active()) { refresh(); return; }
        if (index >= frames.length) { idle(); return; }
        const [column, hold] = frames[index++];
        character.style.backgroundPosition = `${column * (100 / 3)}% ${row * (100 / 3)}%`;
        globalThis.ChotaWardrobe?.frame(character,"contextual",row*4+column);
        frameTimer = setTimeout(advancePersonal, hold);
      }
      advancePersonal();
    });
  }
  function playLifeAction(action, {elapsed=0,direction=null,target=null}={}) {
    if(!active() || !lifeCatalog[action]) return;
    if(roomVisit) {returnFromRoom(()=>playLifeAction(action));return;}
    const info=lifeCatalog[action];
    if(elapsed>=info.duration) {idle();return;}
    if(direction===null) {
      const box=target?.getBoundingClientRect(),body=target?character.getBoundingClientRect():null;
      direction=box&&body ? (box.left+box.width*.5<body.left+body.width*.5?-1:1) : (Math.random()<.5?-1:1);
    }
    stop();
    const now=performance.now();
    lifeAction={action,direction,started:now-elapsed};
    lastLifeAt=now-elapsed;lastAmbientAction=action;attentionTimes.set(action,now-elapsed);familyTimes.set(info.family,now-elapsed);
    pet.classList.add("is-awake");character.classList.add("is-idling");pet.dataset.attention=action;
    const targets={head:idleHead,body:idleBody,tail:idleTail,paw:idlePaw,leftEar:idleEars[0],rightEar:idleEars[1],lids:eyelids};
    for(const [key,frames] of Object.entries(chotaLifeTracks(action,direction))) {
      const animation=animateIdle(targets[key],frames,{duration:info.duration,fill:"both",easing:"linear"});
      if(animation && elapsed) animation.currentTime=elapsed;
    }
    frameTimer=setTimeout(()=>{if(active() && lifeAction?.action===action) idle();},info.duration-elapsed);
  }
  function performAttention(choice) {
    const {action,target} = choice, now = performance.now();
    if(action==="quiet") {schedule();return;}
    if(action.startsWith("mood-")) {
      const mood=action.slice(5);pet.dataset.attention=action;lastAmbientAction=action;
      if(mood==="rest") play("rest"); else if(mood==="sofa") visitRoom("sofa"); else if(mood==="ears") playLifeAction("ear-scan");
      else if(mood==="pace") {if(!goTo({x:.22+Math.random()*.56,y:.79+Math.random()*.13},true)) schedule();}
      else play(mood==="jump"?"jump":"greet");
      return;
    }
    if(lifeCatalog[action]) {playLifeAction(action,{target});return;}
    familyTimes.set(chotaAttentionFamily(action),now);
    attentionTimes.set(action, now); lastAmbientAction = action;
    pet.dataset.attention = action;
    if (action.startsWith("visit-")) { visitRoom(action.slice(6)); return; }
    if (["plan","scratch","stretch","shirt"].includes(action)) {
      lastPersonalAt = now; playPersonal(action); return;
    }
    if (action === "roomba" || action === "window" || action === "look") gazeAt(target, action);
    else if (action === "ears") idleEars.forEach((ear,index) => animateIdle(ear, [{transform:"rotate(0deg)"},{transform:`rotate(${index ? 3 : -4}deg)`,offset:.2},{transform:`rotate(${index ? -2 : 2}deg)`,offset:.42},{transform:"rotate(0deg)",offset:.65},{transform:`rotate(${index ? 1 : -2}deg)`,offset:.8},{transform:"rotate(0deg)"}], {duration:1150,delay:index*140,easing:"ease-in-out"}));
    else if (action === "tail") animateIdle(idleTail, [{transform:"rotate(0deg)"},{transform:"rotate(-5deg)",offset:.22},{transform:"rotate(4deg)",offset:.5},{transform:"rotate(-2deg)",offset:.76},{transform:"rotate(0deg)"}], {duration:2900,easing:"ease-in-out"});
    else {
      animateIdle(idleBody, [{transform:"scale(1) rotate(0deg)"},{transform:"scale(1.006,1.004) rotate(.5deg)",offset:.38},{transform:"scale(1) rotate(0deg)"}], {duration:2400,easing:"ease-in-out"});
      animateIdle(idleHead, [{transform:"rotate(0deg)"},{transform:"rotate(-.8deg)",offset:.38},{transform:"rotate(0deg)"}], {duration:2400,easing:"ease-in-out"});
    }
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (!active() || !character.classList.contains("is-idling")) return;
    timer = setTimeout(() => {
      if (active() && character.classList.contains("is-idling")) performAttention(chooseAttention(performance.now()));
    }, 7000 + Math.random() * 6500);
  }
  function roomPose(frame) {
    character.classList.remove("is-directional", "is-idling", "is-speaking", "is-contextual");
    character.classList.add("is-room-pose");
    character.style.backgroundPosition = `${frame * (100 / 3)}% 0`;
    globalThis.ChotaWardrobe?.frame(character,"room",frame);
    character.style.transform = "";
  }
  function roomGeometry(room, size) {
    const bounds=room.getBoundingClientRect(), obstacles=chotaRoomObstacles(), props=[];
    for(const node of room.querySelectorAll(".chota-room-prop")) {
      if(node.classList.contains("chota-room-prop--decoration") && !node.classList.contains("chota-room-remote")) continue;
      const box=node.getBoundingClientRect();
      if(node.classList.contains("chota-room-remote") && (box.top-bounds.top)/size<.55) continue;
      if(!box.width) continue;
      const x=(box.left+box.width*.5-bounds.left)/size,y=(box.top+box.height*.9-bounds.top)/size;
      if(node.dataset.chotaRestZ===undefined) node.dataset.chotaRestZ=node.style.zIndex;
      props.push({node,y});
      if(node.classList.contains("chota-room-robot-vacuum")) obstacles.push({id:"vacuum-lane",x0:.315,y0:.84,x1:.56,y1:.925});
      else obstacles.push({id:"prop",x0:x-box.width/size*.38,y0:y-.014,x1:x+box.width/size*.38,y1:y+.014});
    }
    return {obstacles,props};
  }
  function roomDepth(point, room, props=[]) {
    // Only furniture in front of the actor cuts its silhouette. Seated actors
    // retain the back cushion behind them and the front arm in front of them.
    const seated=pet.classList.contains("is-sitting-on-sofa"), depth=pet.closest(".chota-room-depth");
    const sofa=seated?"seat":point.y<.745?"back":"front";
    if(depth) {if(depth.dataset.sofaDepth!==sofa) depth.dataset.sofaDepth=sofa;const chair=point.y<.748?"back":"front";if(depth.dataset.chairDepth!==chair) depth.dataset.chairDepth=chair;}
    for(const prop of props) prop.node.style.zIndex=prop.y>point.y?"4":"2";
  }
  function roomPosition(point) {
    if (!roomVisit) return;
    roomVisit.position = {...point};
    roomDepth(point, roomVisit.room, roomVisit.geometry?.props);
    const {home} = roomVisit;
    const size=roomVisit.size;
    motionRoot.style.transform = chotaRoomTransform(point, home, size);
    const height=point.z||0;
    shadow.style.transform=`translateY(${height*size/point.s}px) scaleX(${Math.max(.55,1-height*3)})`;
    shadow.style.opacity=pet.classList.contains("is-sitting-on-sofa")&&!point.airborne?"0":String(Math.max(.25,.6-height*2));
  }
  function roomWalk(from, to, progress, elapsed, away) {
    const visit=roomVisit;
    const key=[from.x,from.y,to.x,to.y].join(":");
    if(!visit.routes[key]) visit.routes[key]=chotaRoomRoute(from,to,visit.geometry.obstacles);
    const point=chotaRoomRoutePoint(visit.routes[key],progress),previous=visit.position;
    roomPosition(point);
    const mirror = away ? point.x>previous.x : point.x<previous.x;
    setDirectionalFrame((away ? 0 : 8) + Math.floor(elapsed / 125) % 8);
    if(Math.abs(point.x-previous.x)>.00001) character.style.transform=mirror?"scaleX(-1)":"";
  }
  function returnFromRoom(afterReturn) {
    if (!roomVisit) { afterReturn?.(); return; }
    roomVisit.afterReturn = afterReturn;
    if (roomVisit.returning) return;
    roomVisit.returning = {
      from:{...roomVisit.position}, started:performance.now(),
      rise:(roomVisit.position.z||0)>0 ? 650 : 0,
      duration:Math.min(3700, Math.max(1600, Math.hypot(roomVisit.position.x-roomVisit.home.x, roomVisit.position.y-roomVisit.home.y) * 10000)),
    };
  }
  // Geometry shared by commanded walks: where his feet are and how he shrinks with depth.
  function roomFooting() {
    const room = pet.closest(".clubhouse-room, .chota-viewer-room-scene");
    const roomBox = room?.getBoundingClientRect(), spriteBox = pet.querySelector(".tigreton-sprite")?.getBoundingClientRect();
    if (!roomBox?.width || !spriteBox?.width) return null;
    const home = roomVisit?.home || {x:(spriteBox.left + spriteBox.width * .5 - roomBox.left)/roomBox.width, y:(spriteBox.top + spriteBox.width * .945 - roomBox.top)/roomBox.width, s:1};
    const far = roomVisit?.far || .23 * roomBox.width / spriteBox.width;
    const scaleAt = y => 1 + (far - 1) * Math.max(-.35, Math.min(1, (home.y - y) / Math.max(.05, home.y - .605)));
    return {room, roomBox, home, far, scaleAt};
  }
  // Tap the floor: he walks to that point, waits a moment and comes back.
  function goTo(point, ambient = false) {
    if (!active() || bedtimeActive || wakingActive) return false;
    const footing = roomFooting();
    if (!footing) return false;
    const target = {x:Math.max(.05, Math.min(.95, point.x)), y:Math.max(.6, Math.min(.955, point.y)), z:0};
    target.s = footing.scaleAt(target.y);
    if (!ambient) lastTouchAt = performance.now();
    if (pet.classList.contains("is-sitting-on-sofa")) { returnFromRoom(() => goTo(point, ambient)); return true; }
    const from = roomVisit ? {...roomVisit.position} : footing.home;
    const geometry = roomVisit?.geometry || roomGeometry(footing.room, footing.roomBox.width);
    if (chotaRoomRoute(from, target, geometry.obstacles).length < 2) { if (!ambient) lookAt(footing.roomBox.left + point.x * footing.roomBox.width, footing.roomBox.top + point.y * footing.roomBox.width); return false; }
    if (roomVisit) {
      Object.assign(roomVisit, {kind:"spot", from, target, started:performance.now(), returning:null, afterReturn:null, routes:{}});
      pet.dataset.attention = "visit-spot"; pet.classList.add("is-walking");
      return true;
    }
    visitRoom("spot", target);
    return true;
  }
  function visitRoom(kind, spot = null) {
    const request = ++spriteRequest;
    void Promise.all([ensureChotaDirectionalSprite(), kind === "sofa" ? ensureChotaRoomSprite() : true]).then(ready => {
      if (request !== spriteRequest || !active()) return;
      if (!ready.every(Boolean)) { lastRoomVisitAt = performance.now(); schedule(); return; }
      const room = pet.closest(".clubhouse-room, .chota-viewer-room-scene");
      const roomBox = room?.getBoundingClientRect(), spriteBox = pet.querySelector(".tigreton-sprite")?.getBoundingClientRect();
      if (!roomBox?.width || !spriteBox?.width) { schedule(); return; }
      stop();
      lastRoomVisitAt = performance.now(); roomVisitTimes.set(kind, lastRoomVisitAt);
      const feetX = spriteBox.left + spriteBox.width * .5, feetY = spriteBox.top + spriteBox.width * .945;
      const home = {x:(feetX-roomBox.left)/roomBox.width, y:(feetY-roomBox.top)/roomBox.width, s:1};
      const layout = chotaRoomVisitLayout(kind === "spot" ? "window" : kind);
      const scale = layout.width * roomBox.width / spriteBox.width;
      const target = spot ? {...spot} : {...layout.target,s:scale}, approach = {...layout.approach,s:scale};
      const geometry=roomGeometry(room,roomBox.width);
      if(chotaRoomRoute(home,kind==="sofa"?approach:target,geometry.obstacles).length<2) {schedule();return;}
      roomVisit = {kind, home, far:.23 * roomBox.width / spriteBox.width, from:home, target, approach, position:home, size:roomBox.width, started:performance.now(), room, geometry, routes:{}, returning:null, afterReturn:null};
      motionRoot.style.transformOrigin = "50% 94.5%";
      pet.classList.add("is-awake", "is-visiting-room", "is-walking");
      pet.dataset.attention = `visit-${kind}`;
      advanceRoomVisit();
    });
  }
  function advanceRoomVisit() {
    frameRaf = 0;
    if (!roomVisit || !active()) { refresh(); return; }
    const visit = roomVisit, elapsed = performance.now() - visit.started;
    const {home,target,approach,kind,room} = visit;
    function seated(value) {
      pet.classList.toggle("is-sitting-on-sofa", value);
      room.classList.toggle("is-chota-on-sofa", value);
      shadow.style.opacity = value ? "0" : ".6";
    }
    function done() { const callback = visit.afterReturn; idle(); callback?.(); }
    if (visit.returning) {
      const back = visit.returning, t = performance.now() - back.started;
      if (t >= back.duration + back.rise) { done(); return; }
      if (t < back.rise) { seated(true); roomPosition(chotaRoomSupportPoint(back.from,approach,t/back.rise)); roomPose(3); }
      else {
        seated(false);
        const start = back.rise ? approach : back.from;
        roomWalk(start,home,(t-back.rise)/back.duration,t,start.y - home.y > Math.max(.03, Math.abs(home.x - start.x) * .7));
      }
    } else if (kind === "spot") {
      const from = visit.from || home, distance = Math.hypot(target.x-from.x, target.y-from.y);
      const travel = Math.min(4200, Math.max(700, distance * 9000));
      // Back view only when he mostly climbs the room; sideways walks keep his face.
      if (elapsed < travel) roomWalk(from,target,elapsed/travel,elapsed,from.y - target.y > Math.max(.03, Math.abs(target.x - from.x) * .7));
      else if (elapsed < travel + 5200) {
        // He stands where he was sent, facing the room, until called again.
        roomPosition(target); setFrame(0); character.style.transform = ""; pet.classList.remove("is-walking");
      } else { pet.classList.add("is-walking"); returnFromRoom(); }
    } else if (kind === "window" || kind === "board") {
      const travel = kind === "board" ? 4300 : 5600;
      const pause = kind === "board" ? 4500 : 5800;
      if (elapsed < travel) roomWalk(home,target,elapsed/travel,elapsed,true);
      else if (elapsed < travel + pause) {
        roomPosition(target);
        if (kind === "board") {
          // A real plan gives him something to read; he points once before returning.
          setDirectionalFrame(elapsed > travel + 2400 && elapsed < travel + 3300 ? 17 : 16);
          character.style.transform = "";
        } else {
          setDirectionalFrame(elapsed > 9700 && elapsed < 10500 ? 19 : 16);
          character.style.transform = "scaleX(-1)";
          // A quiet look through the glass, then a glance back into the room.
          if (elapsed < 9700) character.style.transform += ` rotate(${Math.sin((elapsed-5600)/1800)*.7}deg)`;
        }
      } else if (elapsed < travel * 2 + pause) roomWalk(target,home,(elapsed-travel-pause)/travel,elapsed-travel-pause,false);
      else { done(); return; }
    } else {
      if (elapsed < 4900) roomWalk(home,approach,elapsed/4900,elapsed,true);
      else if (elapsed < 6100) {
        if (elapsed < 5350) { roomPosition(approach); setDirectionalFrame(19); character.style.transform = ""; }
        else { seated(true); roomPosition(chotaRoomSupportPoint(approach,target,(elapsed-5350)/750)); roomPose(0); }
      } else if (elapsed < 13500) {
        seated(true); roomPosition(target); roomPose(elapsed > 8000 && elapsed < 11700 ? 2 : 1);
      } else if (elapsed < 14500) { seated(true); roomPosition(chotaRoomSupportPoint(target,approach,(elapsed-13500)/1000)); roomPose(elapsed < 14200 ? 3 : 0); }
      else if (elapsed < 15700) {
        seated(false); roomPosition(approach); setDirectionalFrame(19); character.style.transform = "";
      } else if (elapsed < 20600) roomWalk(approach,home,(elapsed-15700)/4900,elapsed-15700,false);
      else { done(); return; }
    }
    // Pixel-art gait changes at 8 fps; the path itself stays smooth at display speed.
    frameRaf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(advanceRoomVisit) : setTimeout(advanceRoomVisit, 16);
  }
  function noticeUser() {
    // Where and how insistently he was touched decides the reaction.
    const kind = globalThis.ChotaInteract?.takeTouch?.() || "greet", now = performance.now();
    if (!active()) return;
    if (kind === "annoyed" ? now - lastAnnoyedAt < 6000 : now - lastTouchAt < 3000) return;
    lastTouchAt = now; attentionTimes.set("user", now);
    if (kind === "annoyed") lastAnnoyedAt = now;
    const react = () => kind === "happy" ? play("jump") : kind === "shoes" ? playLifeAction("check-shoes") : kind === "annoyed" ? turnAway() : play("greet");
    if (roomVisit) { returnFromRoom(react); return; }
    react();
  }
  // Fed up with the poking: he turns his back for a moment, then peeks.
  function turnAway() {
    const request = ++spriteRequest;
    void ensureChotaDirectionalSprite().then(ready => {
      if (request !== spriteRequest || !active()) return;
      if (!ready) { play("greet"); return; }
      stop();
      pet.classList.add("is-awake"); pet.dataset.attention = "annoyed";
      setDirectionalFrame(16);
      frameTimer = setTimeout(() => { if (!active()) return; setDirectionalFrame(19); frameTimer = setTimeout(() => { if (active()) idle(); }, 650); }, 1700);
    });
  }
  // His head follows the finger while it touches the room.
  function lookAt(clientX, clientY) {
    if (!active() || !character.classList.contains("is-idling") || lifeAction || roomVisit || !idleHead) return;
    const body = character.getBoundingClientRect();
    if (!body.width) return;
    const dx = Math.max(-1, Math.min(1, (clientX - body.left - body.width * .5) / (body.width * 1.6)));
    const dy = Math.max(-1, Math.min(1, (clientY - body.top - body.height * .3) / (body.height * 1.6)));
    const to = `translate(${(dx * .9).toFixed(2)}%,${(dy * .6).toFixed(2)}%) rotate(${(dx * 2.2).toFixed(2)}deg)`;
    const previous = gazeAnimation;
    gazeAnimation = animateIdle(idleHead, [{transform:previous?.gazeTo || "translate(0,0) rotate(0deg)"},{transform:to}], {duration:260,fill:"forwards",easing:"ease-out"});
    if (gazeAnimation) gazeAnimation.gazeTo = to;
    if (previous) { previous.cancel(); animations = animations.filter(item => item !== previous); }
    clearTimeout(gazeTimer);
    gazeTimer = setTimeout(() => {
      const held = gazeAnimation; gazeAnimation = null;
      if (!held || !active() || !character.classList.contains("is-idling")) return;
      animateIdle(idleHead, [{transform:held.gazeTo},{transform:"translate(0,0) rotate(0deg)"}], {duration:520,easing:"ease-in-out"});
      held.cancel(); animations = animations.filter(item => item !== held);
    }, 1500);
  }
  function glance(target) {
    if (!active() || !character.classList.contains("is-idling") || lifeAction || roomVisit) return;
    lastTouchAt = performance.now(); gazeAt(target, "look");
  }
  function visit(kind) {
    if (!active() || !["window","sofa","board"].includes(kind)) return;
    lastTouchAt = performance.now();
    if (roomVisit) { if (roomVisit.kind === kind && !roomVisit.returning) return; returnFromRoom(() => visitRoom(kind)); return; }
    visitRoom(kind);
  }
  function welcome(kind) {
    if (!active() || !character.classList.contains("is-idling") || roomVisit) return false;
    if (kind === "excited") play("jump"); else if (kind === "sleepy") playLifeAction("drowsy"); else play("greet");
    return true;
  }
  function idle() {
    stop();
    if (!active()) return;
    pet.classList.add("is-awake");
    character.classList.add("is-idling");
    // The torso expands only a fraction; the shoes and contact shadow never slide.
    const breath = 4400 + Math.random() * 1000;
    animateIdle(idleBody, [{transform:"scale(1)"}, {transform:"scale(1.004,1.007)",offset:.48}, {transform:"scale(1)"}], {duration:breath,iterations:Infinity,easing:"ease-in-out"});
    animateIdle(idleHead, [{transform:"translateY(0)"}, {transform:"translateY(-.3%)",offset:.48}, {transform:"translateY(0)"}], {duration:breath,iterations:Infinity,easing:"ease-in-out"});
    scheduleBlink();
    schedule();
  }
  function play(gesture) {
    if (!active()) return;
    if (roomVisit) { returnFromRoom(() => play(gesture)); return; }
    if (lifeCatalog[gesture]) {playLifeAction(gesture);return;}
    if (gesture === "walk" || gesture === "shuffle") { playDirectionalWalk(); return; }
    if (!chotaSpritesReady.poses) {
      const request = ++spriteRequest;
      void ensureChotaSprites().then(() => { if (request === spriteRequest && active() && chotaSpritesReady.poses) play(gesture); });
      return;
    }
    stop();
    pet.classList.add("is-awake");
    const action = {look: "greet", nod: "greet", shuffle: "walk", celebrate: "jump", doze: "rest"}[gesture] || gesture;
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
      if (index >= frames.length) { idle(); return; }
      const [frame, ticks] = frames[index++];
      setFrame(frame);
      frameTimer = setTimeout(advance, ticks * (1000 / 12));
    }
    advance();
  }
  function playDirectionalWalk() {
    visitRoom("board");
  }
  function speak(text, gesture) {
    if (bedtimeActive || wakingActive) return;
    if (roomVisit) { returnFromRoom(() => speak(text, gesture)); return; }
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
        if (gesture) play(gesture); else idle();
        return;
      }
      const word = words[Math.min(words.length - 1, Math.floor(elapsed / duration * words.length))];
      const punctuation = /[.,;:!?]$/.test(word) && beat % 3 === 2;
      const mouth = punctuation ? 0 : mouths[beat++ % mouths.length];
      character.style.backgroundPosition = `${mouth * 50}% 0`;
      globalThis.ChotaWardrobe?.frame(character,"talk",mouth);
      frameTimer = setTimeout(advanceSpeech, punctuation ? 220 : 95 + (beat % 3) * 25);
    }
    advanceSpeech();
  }
  function scheduleSleepMovement() {
    clearTimeout(timer);
    if (destroyed || paused || !inView || document.hidden || tigretonReducedMotion.matches || !isChotaSleeping() || !character.classList.contains("is-sleep-breathing")) return;
    timer = setTimeout(() => {
      if (destroyed || paused || !inView || document.hidden || tigretonReducedMotion.matches || !isChotaSleeping() || !character.classList.contains("is-sleep-breathing")) return;
      lastSleepMovement = lastSleepMovement === "head" ? "tail" : "head";
      if (lastSleepMovement === "tail") {
        animateIdle(sleepTail, [
          {transform:"rotate(0deg)",offset:0},
          {transform:"rotate(-5deg)",offset:.3},
          {transform:"rotate(1.8deg)",offset:.52},
          {transform:"rotate(-1.5deg)",offset:.7},
          {transform:"rotate(0deg)",offset:1}
        ], {duration:1700,easing:"ease-in-out"});
      } else {
        animateIdle(sleepHead, [
          {transform:"translateY(0) rotate(0deg)",offset:0},
          {transform:"translateY(.35%) rotate(-1.3deg)",offset:.32},
          {transform:"translateY(.35%) rotate(-1.3deg)",offset:.52},
          {transform:"translateY(0) rotate(.25deg)",offset:.82},
          {transform:"translateY(0) rotate(0deg)",offset:1}
        ], {duration:2600,easing:"ease-in-out"});
      }
      scheduleSleepMovement();
    }, 7000 + Math.random() * 8500);
  }
  function captureRoomState() {
    if (pendingRoomState) return pendingRoomState;
    const now=performance.now(),ages=map=>[...map].map(([key,at])=>[key,now-at]);
    const ambient={lastAction:lastAmbientAction,times:ages(attentionTimes),families:ages(familyTimes),lifeAge:now-lastLifeAt,personalAge:now-lastPersonalAt,visitAge:now-lastRoomVisitAt,visits:ages(roomVisitTimes)};
    if (!roomVisit) return {kind:"ambient",ambient,life:lifeAction?{action:lifeAction.action,direction:lifeAction.direction,elapsed:now-lifeAction.started}:null};
    const {kind,home,target,approach,position,started,returning} = roomVisit;
    return {kind,ambient,home:{...home},target:{...target},approach:{...approach},position:{...position},elapsed:Math.max(0,now-started),returning:returning ? {from:{...returning.from},elapsed:Math.max(0,now-returning.started),rise:returning.rise,duration:returning.duration} : null};
  }
  function restoreRoomState(state) {
    const now=performance.now();
    if(state.ambient) {
      const history=state.ambient,restore=(map,values)=>{map.clear();for(const [key,age] of values||[]) map.set(key,now-age);};
      lastAmbientAction=history.lastAction||"";restore(attentionTimes,history.times);restore(familyTimes,history.families);restore(roomVisitTimes,history.visits);
      lastLifeAt=now-history.lifeAge;lastPersonalAt=now-history.personalAge;lastRoomVisitAt=now-history.visitAge;
    }
    if(state.kind==="ambient") {
      if(state.life && lifeCatalog[state.life.action]) playLifeAction(state.life.action,state.life); else idle();
      return true;
    }
    const room = pet.closest(".clubhouse-room, .chota-viewer-room-scene");
    const box = room?.getBoundingClientRect(), sprite = pet.querySelector(".tigreton-sprite")?.getBoundingClientRect();
    if (!box?.width || !sprite?.width) return false;
    roomVisit = {...state,room,size:box.width,geometry:roomGeometry(room,box.width),routes:{},started:now-state.elapsed,returning:state.returning ? {...state.returning,started:now-state.returning.elapsed} : null,afterReturn:null};
    motionRoot.style.transformOrigin = "50% 94.5%";
    pet.classList.add("is-awake","is-visiting-room","is-walking");
    pet.dataset.attention = `visit-${state.kind}`;
    lastRoomVisitAt = now; roomVisitTimes.set(state.kind,now);
    advanceRoomVisit();
    return true;
  }
  function refresh() {
    const validTransition = (bedtimeActive && isChotaSleeping()) || (wakingActive && !isChotaSleeping());
    if (validTransition && !destroyed && !paused && inView && !document.hidden && !tigretonReducedMotion.matches) return;
    // Agenda/light refreshes must not restart an inhale or pile up sleeping animations.
    if (character.classList.contains("is-sleep-breathing") && !destroyed && !paused && inView && !document.hidden && !tigretonReducedMotion.matches && isChotaSleeping()) return;
    if (bedtimeActive && bedtimeSwitch) bedtimeSwitch();
    stop();
    if (!destroyed && isChotaSleeping()) {
      // Hold the fully reclined frame, including with reduced motion enabled.
      pet.classList.add("is-sleeping");
      setFrame(22);
      if (!paused && inView && !document.hidden && !tigretonReducedMotion.matches) {
        character.classList.add("is-sleep-breathing");
        // The shirt rises with the chest; the face, folded paws and shoes stay supported.
        // Five source pixels at the shoulder remain visible at the room's small display size.
        animateIdle(sleepChest, [
          {transform:"scaleY(1)",offset:0},
          {transform:"scaleY(1.12)",offset:.42},
          {transform:"scaleY(1.12)",offset:.5},
          {transform:"scaleY(1)",offset:.92},
          {transform:"scaleY(1)",offset:1}
        ], {duration:4400,iterations:Infinity,easing:"ease-in-out"});
        scheduleSleepMovement();
      }
      return;
    }
    if (active()) {
      const state = pendingRoomState;
      pendingRoomState = null;
      if (!state || !restoreRoomState(state)) idle();
    }
  }
  function bedtime(switchLights) {
    if (destroyed || paused || !inView || document.hidden || tigretonReducedMotion.matches || !isChotaSleeping()) return false;
    const departure=roomVisit ? {position:{...roomVisit.position},approach:{...roomVisit.approach},home:{...roomVisit.home},size:roomVisit.size} : null;
    stop();
    if(departure) {motionRoot.style.transformOrigin="50% 94.5%";motionRoot.style.transform=chotaRoomTransform(departure.position,departure.home,departure.size);}
    bedtimeActive = true;
    bedtimeSwitch = switchLights;
    pet.classList.add("is-going-to-sleep");
    pet.classList.add("is-awake");
    void ensureChotaDirectionalSprite().then(ready => {
      if (!bedtimeActive || destroyed) return;
      if (!ready) { bedtimeSwitch?.(); bedtimeActive = false; refresh(); return; }
      startBedtime();
    });
    return true;
    function startBedtime() {
    motionRoot.style.transform="";
    const room = pet.closest(".clubhouse-room, .chota-viewer-room-scene");
    const switchBox = room?.querySelector(".clubhouse-light-switch")?.getBoundingClientRect();
    const petBox = pet.getBoundingClientRect(), spriteBox = pet.querySelector(".tigreton-sprite").getBoundingClientRect();
    const bounds=room?.getBoundingClientRect();
    if(!bounds?.width) {bedtimeSwitch?.();bedtimeActive=false;refresh();return;}
    const home={x:(spriteBox.left+spriteBox.width*.5-bounds.left)/bounds.width,y:(spriteBox.top+spriteBox.width*.945-bounds.top)/bounds.width,s:1,z:0};
    const width=.235, scale=width*bounds.width/spriteBox.width;
    // Directional press cell 18: map its fingertip to the actual wall rocker.
    const destination={x:switchBox?(switchBox.left+switchBox.width*.5-bounds.left)/bounds.width+(.5-30/256)*width:.408,
      y:switchBox?(switchBox.top+switchBox.height*.5-bounds.top)/bounds.width+(.945-80/256)*width:.648,s:scale,z:0};
    const geometry=roomGeometry(room,bounds.width),dismount=departure?.position.z>0?650:0;
    const floorStart=departure?(dismount?departure.approach:departure.position):home;
    const outbound=chotaRoomRoute(floorStart,destination,geometry.obstacles),inbound=chotaRoomRoute(home,destination,geometry.obstacles);
    motionRoot.style.transformOrigin="50% 94.5%";
    animateIdle(sleepMark, [{opacity:0}, {opacity:.2,offset:.35}, {opacity:.85}], {duration:3600,delay:14550,fill:"forwards",easing:"ease-in-out"});
    const started = performance.now();
    let switched = false, lastPose = -1;
    function advanceBedtime() {
      if (!bedtimeActive || destroyed) return;
      const raw=performance.now()-started;
      if(raw<dismount) {
        const point=chotaRoomSupportPoint(departure.position,departure.approach,raw/dismount);
        pet.classList.add("is-sitting-on-sofa");room?.classList.add("is-chota-on-sofa");
        motionRoot.style.transform=chotaRoomTransform(point,home,room.clientWidth||bounds.width);
        roomDepth(point,room,geometry.props);roomPose(3);shadow.style.opacity="0";
        frameTimer=setTimeout(advanceBedtime,95);return;
      }
      pet.classList.remove("is-sitting-on-sofa");room?.classList.remove("is-chota-on-sofa");shadow.style.opacity=".6";
      const elapsed = raw-dismount;
      if (elapsed >= 5950 && !switched) {
        switched = true;
        room?.classList.add("is-switch-pressed");
        bedtimeSwitch?.();
        bedtimeSwitch = null;
      }
      if (elapsed >= 18150) { bedtimeActive = false; refresh(); return; }
      const progress=elapsed<5200?Math.max(0,(elapsed-200)/5000):elapsed<6950?1:elapsed<11950?1-(elapsed-6950)/5000:0;
      const point=chotaRoomRoutePoint(elapsed<6950?outbound:inbound,progress);
      motionRoot.style.transform=chotaRoomTransform(point,home,room.clientWidth||bounds.width);
      roomDepth(point,room,geometry.props);
      if (elapsed < 200) setDirectionalFrame(16);
      else if (elapsed < 5200) setDirectionalFrame(Math.floor((elapsed - 200) / 125) % 8);
      else if (elapsed < 5500) setDirectionalFrame(16);
      else if (elapsed < 5850) setDirectionalFrame(17);
      else if (elapsed < 6150) setDirectionalFrame(18);
      else if (elapsed < 6400) setDirectionalFrame(17);
      else if (elapsed < 6650) setDirectionalFrame(16);
      else if (elapsed < 6950) setDirectionalFrame(19);
      else if (elapsed < 11950) setDirectionalFrame(8 + Math.floor((elapsed - 6950) / 125) % 8);
      else if (elapsed < 12150) setDirectionalFrame(19);
      else if (elapsed < 12350) setFrame(0);
      else {
        pet.classList.add("is-falling-asleep");
        // Give every real pose time to read: crouch, sit, lean on an elbow,
        // then close the eyes and settle into a slower sleeping breath.
        const pose = elapsed < 12900 ? 18 : elapsed < 13800 ? 19 : elapsed < 14950 ? 20 : elapsed < 16600 ? 21 : 22;
        setFrame(pose);
        if (pose !== lastPose) {
          lastPose = pose;
          animateIdle(character, [{transform:"translateY(-.4%) rotate(.3deg)"}, {transform:"translateY(0) rotate(0deg)"}], {duration:700,easing:"ease-out"});
        }
      }
      frameTimer = setTimeout(advanceBedtime, 95);
    }
    advanceBedtime();
    }
  }
  function wakeup(onComplete) {
    if (destroyed || paused || !inView || document.hidden || tigretonReducedMotion.matches || isChotaSleeping()) return false;
    stop();
    wakingActive = true;
    wakingComplete = onComplete;
    pet.classList.add("is-waking-up");
    // A reluctant wake-up: stir, prop up, doze off once more, sit and slowly stand.
    const poses = [[22,1000],[23,300],[22,650],[21,1350],[22,650],[21,1700],[20,1500],[19,1000],[18,800],[0,650]];
    const duration = poses.reduce((total, [, hold]) => total + hold, 0);
    const started = performance.now();
    let lastPose = -1;
    animateIdle(sleepMark, [{opacity:.85}, {opacity:.35,offset:.35}, {opacity:0}], {duration:3300,fill:"forwards",easing:"ease-in-out"});
    function advanceWakeup() {
      if (!wakingActive || destroyed) return;
      const elapsed = performance.now() - started;
      if (elapsed >= duration) { wakingActive = false; refresh(); return; }
      let boundary = 0;
      const [pose, hold] = poses.find(([, hold]) => (boundary += hold) > elapsed);
      setFrame(pose);
      if (pose !== lastPose) {
        lastPose = pose;
        animateIdle(character, [
          {transform:"translateY(0) rotate(0deg)"},
          {transform:`translateY(.25%) rotate(${pose === 21 ? -.8 : .45}deg)`,offset:.5},
          {transform:"translateY(0) rotate(0deg)"}
        ], {duration:Math.min(hold,1300),easing:"ease-in-out"});
      }
      frameTimer = setTimeout(advanceWakeup, Math.min(100, boundary - elapsed));
    }
    advanceWakeup();
    return true;
  }
  function reactSleeping() {
    if (destroyed || paused || !inView || document.hidden || !isChotaSleeping() || bedtimeActive || tigretonReducedMotion.matches || pet.classList.contains("is-sleep-reacting")) return;
    stop();
    pet.classList.add("is-sleeping");
    setFrame(22);
    pet.classList.add("is-sleep-reacting");
    animations.push(character.animate([
      {transform:"translateY(0) rotate(0deg)"},
      {transform:"translateY(-.7%) rotate(-.7deg)",offset:.28},
      {transform:"translateY(.3%) rotate(.35deg)",offset:.58},
      {transform:"translateY(0) rotate(0deg)"}
    ], {duration:760,easing:"ease-in-out"}));
    // Both poses keep the eyes shut; their ear/head shift is a brief sleepy stir.
    const frames = [[22,80],[23,150],[22,90],[23,110],[22,330]];
    let index = 0;
    function advanceSleepStir() {
      if (destroyed || paused || !inView || document.hidden || !isChotaSleeping()) { refresh(); return; }
      if (index >= frames.length) { refresh(); return; }
      const [frame, duration] = frames[index++];
      setFrame(frame);
      frameTimer = setTimeout(advanceSleepStir, duration);
    }
    advanceSleepStir();
  }
  const scene=pet.closest(".clubhouse-room, .chota-viewer-room-scene");
  const resizeObserver=typeof ResizeObserver==="function" && scene ? new ResizeObserver(entries=>{
    if(roomVisit && entries[0].contentRect.width) roomVisit.size=entries[0].contentRect.width;
  }) : null;
  resizeObserver?.observe(scene);
  const observer = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (inView) { void ensureChotaDirectionalSprite(); void ensureChotaContextSprite(); }
    refresh();
    // Entering the screen or receiving a new plan must not trigger a commanded action.
  }, {threshold: .25});
  observer.observe(pet);
  refresh();
  document.addEventListener("visibilitychange", refresh);
  tigretonReducedMotion.addEventListener("change", refresh);
  return {
    play,
    speak,
    reactSleeping,
    noticeUser,
    goTo, visit, lookAt, glance, welcome,
    cheer: () => { if (active() && !roomVisit) play("jump"); },
    bedtime,
    wakeup,
    isWaking: () => wakingActive,
    refresh,
    stopSpeaking: refresh,
    captureRoomState,
    pause() { paused = true; refresh(); },
    resume(state = null) { pendingRoomState = state; paused = false; refresh(); },
    react: () => play(isBirthday && isToday ? "jump" : "greet"),
    destroy() { if (bedtimeActive) bedtimeSwitch?.(); destroyed = true; stop(); observer.disconnect(); resizeObserver?.disconnect(); document.removeEventListener("visibilitychange", refresh); tigretonReducedMotion.removeEventListener("change", refresh); },
  };
}
function tigretonSpriteMarkup(interactive = false) {
  const tag = interactive ? "button" : "span";
  return `<${tag} class="tigreton-sprite" ${interactive ? 'type="button" data-chota-open aria-label="Mostrar comentario de El Chota sobre el próximo plan" aria-expanded="false" aria-keyshortcuts="Shift+Enter"' : 'role="img" aria-label="El Chota"'}><span class="tigreton-character" aria-hidden="true"><span class="chota-idle-tail"></span><span class="chota-idle-body"><span class="chota-idle-paw"></span></span><span class="chota-idle-feet"></span><span class="chota-idle-head"><span class="chota-idle-ear chota-idle-ear--left"></span><span class="chota-idle-ear chota-idle-ear--right"></span><svg class="chota-idle-eyelids" viewBox="0 0 256 256" aria-hidden="true"><path fill="#fa7906" d="M117 84Q126 81 136 93L141 99 138 105Q126 108 119 99Z M164 98Q174 94 182 100L184 105 180 113Q172 116 164 108Z"/><path fill="none" stroke="#27170f" stroke-width="1.7" stroke-linecap="round" d="M119 96q11 10 20 3m26 5q8 7 17 1"/></svg></span><span class="chota-sleep-base"></span><span class="chota-sleep-tail"></span><span class="chota-sleep-chest"></span><span class="chota-sleep-head"></span><span class="chota-sleep-foreground"></span></span><i class="tigreton-shadow" aria-hidden="true"></i><span class="tigreton-sleep-mark" aria-hidden="true">z</span><span class="tigreton-spark" aria-hidden="true">✦</span></${tag}>`;
}
let chotaViewerMotion = null;
// The touch layer (chota-interact.js) asks for the engine of the room it was touched in.
globalThis.ChotaRoom = Object.freeze({motion: room => room?.classList?.contains("chota-viewer-room-scene") ? chotaViewerMotion : tigretonMotion});
let chotaViewerMotionKey = "";
let chotaViewerTrigger = null;
let chotaBubbleFrame = 0;
function positionChotaBubbles() {
  chotaBubbleFrame = 0;
  document.querySelectorAll(".clubhouse-bubble:not([hidden]), .chota-viewer-status:not([hidden])").forEach(bubble => {
    const room = bubble.closest(".clubhouse-room, .chota-viewer-room-scene");
    const sprite = room?.querySelector(".tigreton-sprite");
    if (!sprite || !room.clientWidth) return;
    const roomBox = room.getBoundingClientRect(), spriteBox = sprite.getBoundingClientRect();
    const anchorX = spriteBox.left - roomBox.left + spriteBox.width * .52;
    const anchorY = spriteBox.top - roomBox.top + spriteBox.height * .16;
    const width = bubble.offsetWidth, height = bubble.offsetHeight;
    const left = Math.max(8, Math.min(room.clientWidth - width - 8, anchorX - width * .6));
    bubble.style.left = `${left}px`;
    bubble.style.top = `${Math.max(8, anchorY - height - 14)}px`;
    bubble.style.setProperty("--chota-tail-x", `${Math.max(8, Math.min(width - 26, anchorX - left - 9))}px`);
  });
}
function queueChotaBubblePosition() {
  if (!chotaBubbleFrame) chotaBubbleFrame = requestAnimationFrame(positionChotaBubbles);
}
window.addEventListener("resize", queueChotaBubblePosition, {passive:true});
function showChotaCommentLoading(bubble) {
  bubble.setAttribute("aria-busy", "true");
  bubble.innerHTML = '<span class="chota-loading-label">El Chota está pensando</span><span class="chota-loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
  bubble.hidden = false;
  queueChotaBubblePosition();
}
function showChotaCommentResult(bubble, comment) {
  const text = document.createElement("span");
  text.className = bubble.classList.contains("chota-viewer-status") ? "chota-viewer-comment" : "tigreton-comment";
  text.textContent = comment;
  bubble.replaceChildren(text);
  bubble.setAttribute("aria-busy", "false");
  queueChotaBubblePosition();
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
      const roomState = chotaViewerMotion?.captureRoomState();
      chotaViewerMotion?.pause();
      globalThis.ChotaShop?.unmountRoom(viewer.querySelector(".chota-viewer-room-scene"));
      globalThis.ClubOutdoor?.unmount(viewer.querySelector(".chota-viewer-room-scene"));
      tigretonMotion?.resume(roomState);
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
    ${clubhouseSkyMarkup()}
    ${clubhouseDaylightMarkup()}
    ${clubhouseSeasonalMarkup()}
    <span class="clubhouse-light-switch" aria-hidden="true"><i></i></span>
    <div class="chota-viewer-bubble-slot"><div class="tigreton-bubble chota-viewer-status" role="status" aria-live="polite" aria-atomic="true" hidden></div></div>
    <div class="chota-room-depth"><div class="tigreton-agenda chota-viewer-pet">
    <div class="chota-character-row"><button class="chota-viewer-touch" type="button" data-chota-action="nod" aria-label="Tocar a El Chota">${tigretonSpriteMarkup()}</button></div></div></div></div>
    <div class="chota-viewer-actions"><button type="button" data-chota-action="nod" >Saludar</button><button type="button" data-chota-action="shuffle">Pasitos</button><button type="button" data-chota-action="celebrate">Celebrar</button><button type="button" data-chota-action="doze">Descansar</button></div>`;
  viewer.querySelector(".chota-viewer-plan").textContent = next.event.title;
  viewer.querySelector(".chota-viewer-status").hidden = true;
  chotaViewerTrigger = trigger;
  const roomState = tigretonMotion?.captureRoomState();
  tigretonMotion?.pause();
  document.body.classList.add("chota-viewer-open");
  viewer.show();
  globalThis.ChotaShop?.mountRoom(viewer.querySelector(".chota-viewer-room-scene"));
  globalThis.ClubLive?.mountRoomDetails?.(viewer.querySelector(".chota-viewer-room-scene"));
  syncClubhouseDaylight();
  document.querySelector("main.app")?.setAttribute("aria-hidden", "true");
  if (!chotaViewerMotion || chotaViewerMotionKey !== key) {
    chotaViewerMotion?.destroy();
    chotaViewerMotion = createTigretonMotion(viewer.querySelector(".tigreton-agenda"), false, next.event, next.date);
    chotaViewerMotionKey = key;
  }
  chotaViewerMotion.resume(roomState);
  viewer.querySelector("[data-chota-close]").focus({preventScroll: true});
}
// A tap shows an agenda comment; releasing a held mascot opens its separate scene.
function showChotaAgendaComment(trigger) {
  if (isChotaSleeping()) { tigretonMotion?.reactSleeping(); return; }
  const next = chotaRoomContext();
  const bubble = trigger.closest(".clubhouse-room, .club-event-with-tigreton")?.querySelector(".tigreton-bubble");
  if (!next || !bubble) return;
  // A tap takes over the bubble from a line another feature asked him to say.
  if (bubble.dataset.roomLine) { clearTimeout(chotaRoomLineTimer); delete bubble.dataset.roomLine; }
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
  tigretonMotion?.noticeUser();
  const key = tigretonContextKey(next.event, next.date);
  void loadTigretonComment(next.event, next.date, key).then(result => {
    if (isChotaSleeping() || !trigger.isConnected || trigger.dataset.commentRequest !== requestKey || tigretonRenderedKey !== key || trigger.getAttribute("aria-expanded") !== "true") return;
    showChotaCommentResult(bubble, result.comment);
    tigretonMotion?.speak(result.comment);
  });
}
// Other features (the daily decision) can have the sede's Chota say a short
// line in his own bubble. A plan comment the member opened always wins.
let chotaRoomLineTimer = 0;
function chotaRoomSay(text, gesture = "nod") {
  const line = String(text || "").trim();
  if (!line || isChotaSleeping() || tigretonMotion?.isWaking() || document.getElementById("chotaViewer")?.open) return false;
  const room = document.querySelector("#clubhouseContent .clubhouse-room");
  const bubble = room?.querySelector(".clubhouse-bubble");
  const trigger = room?.querySelector("[data-chota-open]");
  if (!bubble || trigger?.getAttribute("aria-expanded") === "true") return false;
  clearTimeout(chotaRoomLineTimer);
  bubble.dataset.roomLine = "true";
  showChotaCommentResult(bubble, line);
  bubble.hidden = false;
  queueChotaBubblePosition();
  tigretonMotion?.speak(line, gesture);
  chotaRoomLineTimer = setTimeout(() => {
    if (!bubble.dataset.roomLine) return;
    delete bubble.dataset.roomLine;
    bubble.hidden = true;
  }, Math.min(9000, 3200 + line.length * 45));
  return true;
}
globalThis.ChotaRoom = Object.freeze({say: chotaRoomSay, play: gesture => tigretonMotion?.play(gesture), sleeping: () => isChotaSleeping()});
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
  if (isChotaSleeping()) { cancelChotaPress(true); chotaClickSuppression = null; return; }
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
// The agenda is already in memory; owned room objects hydrate separately while idle.
let clubhouseObserver = null;
function clubhouseSkyMarkup() {
  return '<div class="clubhouse-sky" aria-hidden="true"><i class="clubhouse-sky-dawn"></i><i class="clubhouse-sky-day"></i><i class="clubhouse-sky-evening"></i><i class="clubhouse-sky-night"></i><span class="clubhouse-sky-stars"></span></div>';
}
function clubhouseDaylightMarkup() {
  return '<div class="clubhouse-daylight" aria-hidden="true"><i></i></div>';
}
function clubhouseSeasonalMarkup() {
  return '<div class="clubhouse-seasonal" aria-hidden="true"></div>';
}
function clubhouseSeason(now = new Date()) {
  // Whole months, using the same local clock as the room and the sleep schedule.
  return ({1:"valentine",9:"halloween",11:"christmas"})[now.getMonth()] || "normal";
}
function syncClubhouseSeason(room, season) {
  if (room.dataset.season === season) return;
  const layer = room.querySelector(".clubhouse-seasonal");
  if (!layer) return;
  room.dataset.season = season;
  if (season === "normal") { layer.replaceChildren(); return; }
  const decoration = new Image(1024, 1024);
  decoration.alt = "";
  decoration.decoding = "async";
  decoration.src = `icons/clubhouse/decor-${season}-v1.svg`;
  layer.replaceChildren(decoration);
}
function clubhouseDaylight(now = new Date()) {
  // Seasonal daylight at the club's latitude, driven by the device's local clock.
  const year = now.getFullYear();
  const day = (Date.UTC(year, now.getMonth(), now.getDate()) - Date.UTC(year, 0, 0)) / 86400000;
  const declination = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + day) / 365.25);
  const latitude = 40.4168 * Math.PI / 180;
  const daylightHours = 24 * Math.acos((Math.sin(-.833 * Math.PI / 180) - Math.sin(latitude) * Math.sin(declination)) / (Math.cos(latitude) * Math.cos(declination))) / Math.PI;
  const standardOffset = Math.max(new Date(year, 0, 1).getTimezoneOffset(), new Date(year, 6, 1).getTimezoneOffset());
  const summerShift = (standardOffset - now.getTimezoneOffset()) / 60;
  const orbit = 2 * Math.PI * (day - 81) / 364;
  const equationOfTime = 9.87 * Math.sin(2 * orbit) - 7.53 * Math.cos(orbit) - 1.5 * Math.sin(orbit);
  const solarNoon = 13.2469 + summerShift - equationOfTime / 60;
  const sunrise = solarNoon - daylightHours / 2, sunset = solarNoon + daylightHours / 2;
  const stops = [[0,"night"],[sunrise-.75,"night"],[sunrise+.05,"dawn"],[sunrise+.9,"day"],[sunset-1.2,"day"],[sunset-.15,"evening"],[sunset+.7,"night"],[24,"night"]];
  const hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const index = Math.max(1, stops.findIndex(stop => stop[0] >= hour));
  const [start, from] = stops[index-1], [end, to] = stops[index];
  const mix = Math.max(0, Math.min(1, (hour-start) / (end-start || 1)));
  const weights = {dawn:0,day:0,evening:0,night:0};
  weights[from] += 1-mix; weights[to] += mix;
  const solarProgress = (hour-sunrise) / (sunset-sunrise);
  const sunHeight = solarProgress > 0 && solarProgress < 1 ? Math.sin(Math.PI * solarProgress) : 0;
  const daylight = weights.day + weights.dawn * .65 + weights.evening * .65;
  return {weights, moment:mix < .5 ? from : to, sunlight:{
    strength:.88 * Math.pow(sunHeight, .65) * daylight,
    reach:.82 + (1-sunHeight) * .38,
    saturation:.55 + (1-sunHeight) * .8
  }};
}
// The store window follows the same sun as the sede.
globalThis.ClubDaylight = clubhouseDaylight;
const clubhouseDateFormatter = new Intl.DateTimeFormat("es-ES", {weekday: "long", day: "numeric", month: "long"});
// Today's date sits in the sede's bottom-left corner; the 30 s room sync rolls it over at midnight.
function syncClubhouseDate(room, now) {
  let stamp = room.querySelector(".clubhouse-date");
  if (!stamp) {
    stamp = document.createElement("time");
    stamp.className = "clubhouse-date";
    room.append(stamp);
  }
  const key = tigretonDayKey(now);
  if (stamp.dateTime === key) return;
  const label = clubhouseDateFormatter.format(now);
  stamp.dateTime = key;
  stamp.textContent = label.charAt(0).toLocaleUpperCase("es-ES") + label.slice(1);
}
function syncClubhouseDaylight(now = new Date()) {
  const {weights, moment, sunlight} = clubhouseDaylight(now);
  const season = clubhouseSeason(now);
  document.querySelectorAll(".clubhouse-room, .chota-viewer-room-scene").forEach(room => {
    room.dataset.time = moment;
    syncClubhouseSeason(room, season);
    room.classList.toggle("is-sleeping", chotaRoomLightsOff);
    for (const [name, weight] of Object.entries(weights)) room.style.setProperty(`--club-sky-${name}`, weight.toFixed(4));
    room.style.setProperty("--club-sun-strength", sunlight.strength.toFixed(4));
    room.style.setProperty("--club-sun-reach", sunlight.reach.toFixed(4));
    room.style.setProperty("--club-sun-saturation", sunlight.saturation.toFixed(4));
    if (currentUser) globalThis.ClubOutdoor?.mount(room);
    if (room.classList.contains("clubhouse-room")) syncClubhouseDate(room, now);
  });
  globalThis.ClubOutdoor?.sync();
  const time = document.getElementById("clubhouseTime");
  if (time) time.textContent = {night:"Una noche en la sede",dawn:"Amanece en la sede",day:"Hoy en la sede",evening:"Cae la tarde"}[moment];
}
function chotaRoomContext() {
  return ClubModel.upcomingEvents(groupEvents)[0] || {event: {id: "clubhouse-idle", title: "La agenda está libre", eventType: "clubhouse"}, date: new Date()};
}
function renderClubhouse(upcoming) {
  const content = document.getElementById("clubhouseContent");
  if (!content) return;
  const next = upcoming[0];
  const birthday = next?.event.eventType === "birthday";
  const {moment} = clubhouseDaylight();
  const days = next ? tigretonDaysUntil(next.date) : 0;
  const countdown = !next ? "" : days === 0 ? "Es hoy" : days === 1 ? "Mañana" : `En ${days} días`;
  const date = next ? next.date.toLocaleDateString("es-ES", {day: "numeric", month: "short"}).replace(".", "") : "";
  const schedule = next ? (birthday ? "Cumpleaños" : conversationTimeFormatter.format(next.date)) : "";
  const signature = JSON.stringify([homeEventsReady, birthday, next?.event.id, next?.event.title, next?.event.description, next?.event.eventType, days, date, schedule]);
  if (content.dataset.roomSignature === signature && content.firstElementChild) {
    globalThis.ChotaShop?.mountRoom(content.firstElementChild);
    globalThis.ChotaGames?.mount(content.querySelector("#chotaArcadeEntry"));
    globalThis.ClubLive?.mountRoom?.(content.querySelector(".clubhouse-memory"));
    syncClubhouseDaylight();
    syncChotaSleepControls();
    return;
  }
  content.dataset.roomSignature = signature;
  const plan = next ? `<button class="clubhouse-plan" type="button" data-calendar-date="${tigretonDayKey(next.date)}" aria-label="Ver plan: ${escapeHtml(next.event.title)}"><span class="clubhouse-note-label">Próximo plan</span><strong>${escapeHtml(next.event.title)}</strong><span class="clubhouse-plan-date">${escapeHtml(date)} · ${escapeHtml(schedule)}</span><span class="clubhouse-plan-countdown">${countdown}</span></button>` : `<div class="clubhouse-plan clubhouse-plan-empty"><span class="clubhouse-note-label">La agenda</span><strong>${homeEventsReady ? "El próximo plan está por llegar" : "Consultando la agenda…"}</strong>${homeEventsReady ? '<button type="button" data-go="calendario">Ver calendario</button>' : ""}</div>`;
  const liveIcon = next ? `<button type="button" class="clubhouse-live-icon" data-club-live-event="${escapeHtml(next.event.id)}" aria-label="Abrir plan en directo: ${escapeHtml(next.event.title)}" title="Plan en directo"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.5"/><path d="M7.1 7.1a7 7 0 0 0 0 9.8m9.8-9.8a7 7 0 0 1 0 9.8M4 4a11.3 11.3 0 0 0 0 16M20 4a11.3 11.3 0 0 1 0 16"/></svg></button>` : "";
  const bunting = birthday ? '<div class="clubhouse-bunting" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>' : "";
  // An empty slot keeps the room in place when the first agenda arrives after launch.
  const planSlot = plan || '<span class="clubhouse-plan-slot" hidden></span>';
  const existing = content.firstElementChild;
  // Agenda news only swaps the note. Rebuilding would blank the art, Chota and every prop.
  if (existing?.querySelector(".clubhouse-plan, .clubhouse-plan-slot")) {
    existing.classList.toggle("is-birthday", birthday);
    existing.querySelectorAll(".clubhouse-live-icon,.clubhouse-bunting").forEach(node => node.remove());
    const note = existing.querySelector(".clubhouse-plan, .clubhouse-plan-slot");
    note.insertAdjacentHTML("afterend", liveIcon);
    note.insertAdjacentHTML("beforebegin", bunting);
    note.outerHTML = planSlot;
    globalThis.ChotaShop?.mountRoom(existing);
    globalThis.ChotaGames?.mount(content.querySelector("#chotaArcadeEntry"));
    globalThis.ClubLive?.mountRoom?.(content.querySelector(".clubhouse-memory"));
    syncClubhouseDaylight();
    syncChotaSleepControls();
    return;
  }
  clubhouseObserver?.disconnect();
  globalThis.ClubOutdoor?.unmount(existing);
  content.innerHTML = `<div class="clubhouse-room${birthday ? " is-birthday" : ""}" data-time="${moment}">
    <img class="clubhouse-art" src="icons/clubhouse/club-room-v1.webp" width="1024" height="1024" alt="La sede de Big Boy, una habitación con un tablón, una foto y una alfombra donde está El Chota" decoding="sync" fetchpriority="high">
    ${clubhouseSkyMarkup()}
    ${clubhouseDaylightMarkup()}
    ${clubhouseSeasonalMarkup()}
    <span class="clubhouse-light-switch" aria-hidden="true"><i></i></span>
    <div class="clubhouse-light-effects" aria-hidden="true"><div class="clubhouse-lamplight"></div><div class="clubhouse-dust"><i></i><i></i><i></i></div></div>
    ${bunting}
    ${planSlot}
    ${liveIcon}
    <div id="chotaArcadeEntry"></div>
    <p class="chota-story-line" data-chota-story hidden></p>
    <div class="clubhouse-memory"><span class="clubhouse-memory-label">Recuerdos del club</span><svg viewBox="0 0 40 32" aria-hidden="true"><path d="M4 8h8l3-5h10l3 5h8v21H4z"/><circle cx="20" cy="18" r="7"/></svg><strong>Aún no hay recuerdos compartidos</strong><span>Este sitio será para vuestra próxima foto.</span></div>
    <div class="chota-room-depth"><div class="tigreton-agenda clubhouse-pet"><span class="chota-character-row">${tigretonSpriteMarkup(true)}</span><small class="tigreton-name">El Chota</small></div></div>
    <button type="button" class="chota-expand" data-chota-expand aria-label="Ver a El Chota en pantalla completa"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M3 3l7 7M16 21h5v-5m0 5-7-7M16 3h5v5m0-5-7 7M8 21H3v-5m0 5 7-7"/></svg></button>
    <div class="tigreton-bubble clubhouse-bubble" hidden role="status" aria-live="polite" aria-atomic="true"></div>
  </div>`;
  const room = content.firstElementChild;
  // The motion engine starts later: the first frame must already hold the sleeping pose.
  if (isChotaSleeping()) {
    room.querySelector(".clubhouse-pet").classList.add("is-sleeping");
    room.querySelector(".tigreton-character").style.backgroundPosition = "80% 100%";
  }
  globalThis.ClubLive?.mountRoom?.(content.querySelector(".clubhouse-memory"));
  clubhouseObserver = new IntersectionObserver(entries => room.classList.toggle("is-in-view", entries[0].isIntersecting), {threshold: .15});
  clubhouseObserver.observe(room);
  globalThis.ChotaShop?.mountRoom(room);
  globalThis.ChotaGames?.mount(content.querySelector("#chotaArcadeEntry"));
  syncClubhouseDaylight();
  syncChotaSleepControls();
}
function syncChotaSleepControls() {
  const sleeping = isChotaSleeping();
  const waking = Boolean(tigretonMotion?.isWaking());
  document.querySelectorAll("[data-chota-open], [data-chota-expand], [data-chota-action]").forEach(button => {
    const sleepTouch = button.matches("[data-chota-open]");
    button.disabled = (sleeping && !sleepTouch) || waking;
    button.setAttribute("aria-disabled", String((sleeping && !sleepTouch) || waking));
    if (button.matches("[data-chota-open]")) {
      button.setAttribute("aria-label", waking ? "El Chota se está despertando poco a poco" : sleeping ? "Tocar suavemente a El Chota dormido; descansa hasta las 06:00" : "Mostrar comentario de El Chota sobre el próximo plan");
      if (sleeping) { delete button.dataset.commentRequest; button.setAttribute("aria-expanded", "false"); }
    }
    if (button.matches("[data-chota-expand]")) button.hidden = sleeping || waking;
  });
  if (sleeping) {
    document.querySelectorAll(".clubhouse-bubble, .chota-viewer-status").forEach(bubble => { bubble.hidden = true; bubble.setAttribute("aria-busy", "false"); });
  }
}
function refreshChotaSleepSchedule() {
  clearTimeout(chotaSleepTimer);
  const now = new Date();
  syncClubhouseDaylight(now);
  const sleeping = isChotaSleeping(now);
  if (sleeping !== chotaSleeping) {
    chotaSleeping = sleeping;
    cancelChotaPress(true);
    if (sleeping) {
      chotaRequestControllers.forEach(controller => controller.abort());
      const viewer = document.getElementById("chotaViewer");
      if (viewer?.open) viewer.close();
      const started = now.getHours() === 0 && now.getMinutes() < 1 && tigretonMotion?.bedtime(() => {
        chotaRoomLightsOff = true;
        syncClubhouseDaylight();
      });
      if (!started) chotaRoomLightsOff = true;
    } else {
      chotaRoomLightsOff = false;
      if (now.getHours() === 6 && now.getMinutes() < 1) tigretonMotion?.wakeup(syncChotaSleepControls);
    }
    syncClubhouseDaylight(now);
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
  if (pendingWidgetEventId && homeEventsReady && currentAuthUser) {
    const pendingId = pendingWidgetEventId; pendingWidgetEventId = null;
    const pendingEvent = groupEvents.find(item => String(item.id) === pendingId);
    if (pendingEvent) requestAnimationFrame(() => globalThis.GroupInteractions?.openPlan(pendingEvent));
    else goTo("calendario");
  }
  cancelChotaPress(true);
  const upcoming = ClubModel.upcomingEvents(groupEvents);
  const previousPlanKey = tigretonRenderedKey;
  const context = chotaRoomContext();
  tigretonRenderedKey = tigretonContextKey(context.event, context.date);
  renderClubhouse(upcoming);
  globalThis.ClubSocial?.mountGoal(document.querySelector(".clubhouse-room")?.parentElement);
  globalThis.PlanWidget?.sync({
    id: upcoming[0]?.event ? String(upcoming[0].event.id) : "", title: upcoming[0]?.event.title || "",
    startAt: upcoming[0]?.date?.toISOString() || null, endAt: upcoming[0]?.event.endsAt || null,
    location: upcoming[0]?.event.location || "", packCount: globalThis.DailyPacks?.snapshot()?.data?.available
  });
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
      <button class="club-live-event-link" type="button" data-club-live-event="${escapeHtml(event.id)}" data-occurrence="${escapeHtml(dateValue)}">Plan en directo</button>
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

function searchableMemberText(member) {
  const text = `${member.name} ${member.username} ${member.nickname}`;
  let entry = memberSearchText.get(member);
  if (entry?.text !== text) {
    entry = {text, normalized: normalizeUsername(text)};
    memberSearchText.set(member, entry);
  }
  return entry.normalized;
}
function performSearch(query) {
  const term = normalizeUsername(query);
  document.getElementById("searchResults").hidden = !term;
  if (!term) {
    updateSurfaceMarkup(document.getElementById("searchResults"), "");
    return;
  }
  const results = members
    .filter(member => !member.hidden && searchableMemberText(member).includes(term))
    .slice(0, 20);
  updateSurfaceMarkup(document.getElementById("searchResults"), results.length ? results.map(member => {
    const detail = `@${member.username}${member.nickname ? ` · ${member.nickname}` : ""}`;
    return `<button type="button" class="search-result member-search-result" data-profile="${member.id}">
      ${getAvatar(member, "avatar small")}
      <span class="search-result-copy"><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(detail)}</small></span>
    </button>`;
  }).join("") : `<div class="empty-state compact">No hay miembros para “${escapeHtml(query)}”.</div>`);
}

const accountRequests = globalThis.ClubAccountRequests?.create({client: db, canManage: canManageSite, owner: () => currentAuthUser?.id});

const adminConsole = globalThis.AdminConsole?.create({
  allowed: isSuperAdmin,
  releaseClient: db,
  rpc: (name, args) => db.rpc(name, args),
  refreshShop: () => Promise.all([globalThis.BannerShop?.refresh(true), globalThis.ChotaShop?.refresh(true)]),
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
  const onlineCount = visibleMembers.filter(user => onlineUsers.some(item => Number(item.legacy_id) === user.id)).length;
  const accSummary = document.getElementById("accSummary");
  if (accSummary) accSummary.innerHTML = [[visibleMembers.length, "miembros", "#5ac8fa"], [onlineCount, "en línea", "#30d158"], [visibleMembers.filter(item => item.roleKey === "admin").length, "admins", "#bf5af2"]]
    .map(([value, label, tone]) => `<div class="acc-stat" style="--tone:${tone}"><strong>${value}</strong><span>${label}</span></div>`).join("");
  // Rows carry their filter data as attributes, so styling never depends on legacy classes.
  table.innerHTML = visibleMembers.map(user => {
    const online = onlineUsers.some(item => Number(item.legacy_id) === user.id);
    const admin = user.roleKey === "admin";
    return `<button class="acc-card" type="button" data-edit-user="${user.id}" data-account-row data-online="${online}" data-role="${admin ? "admin" : "member"}" data-search="${escapeHtml(`${user.name} ${user.username}`)}" aria-label="Gestionar a ${escapeHtml(user.name)}">
      <span class="acc-avatar">${getAvatar(user, "avatar small")}<i class="acc-dot ${online ? "is-online" : ""}" aria-hidden="true"></i></span>
      <span class="acc-copy"><strong>${escapeHtml(user.name)}</strong><small>@${escapeHtml(user.username)}</small></span>
      <span class="acc-tags"><span class="acc-role ${admin ? "is-admin" : ""}">${admin ? "Admin" : "Miembro"}</span><small>${online ? "En línea" : "Desconectado"}</small></span>
      <svg class="acc-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
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
          db.from("achievements").select("id,name,description,tier,icon,created_by,created_at,track_key,track_step").is("retired_at", null).order("created_at", {ascending: false}),
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
          trackKey:item.track_key || null, trackStep:item.track_step || null,
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
          rememberAchievementSnapshot(userId);
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

// The profile paints the last known trophies at once; the network refresh replaces them.
const achievementSnapshotKey = userId => `bb:achievements:v1:${config.supabaseUrl || "local"}:${userId}`;
function rememberAchievementSnapshot(userId) {
  try { localStorage.setItem(achievementSnapshotKey(userId), JSON.stringify({achievements, achievementAwards, achievementProgress, achievementCardScopes})); } catch {}
}
function restoreAchievementSnapshot(userId) {
  if (achievementsLoaded) return;
  try {
    const saved = JSON.parse(localStorage.getItem(achievementSnapshotKey(userId)) || "null");
    if (![saved?.achievements, saved?.achievementAwards, saved?.achievementProgress].every(Array.isArray)) return;
    achievements = saved.achievements;
    achievementAwards = saved.achievementAwards;
    achievementProgress = saved.achievementProgress;
    achievementCardScopes = saved.achievementCardScopes || null;
    achievementProgressUserId = userId;
    achievementProgressStatus = "ready";
    achievementsLoaded = true;
  } catch {}
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
  restoreAchievementSnapshot(authUser.id);
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
    // A restored snapshot still needs its first network refresh.
    defer(() => loadAchievements());
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
    globalThis.ChotaShop?.reset();
    globalThis.ClubOutdoor?.reset();
    globalThis.ChotaGames?.reset();
    globalThis.ClubLive?.reset();
    globalThis.ClubNight?.close();
    globalThis.ClubSocial?.reset();
    globalThis.ClubCoinMissions?.reset();
    globalThis.ClubDay?.reset();
    globalThis.ClubPlus?.reset();
    globalThis.ChatCustom?.reset();
    globalThis.ClubSeasons?.reset();
    globalThis.PlanWidget?.clear();
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
  // The launch screen lifts onto a finished room, not an empty box that then jumps.
  renderClubhouse(ClubModel.upcomingEvents(groupEvents));
  renderMembers();
  globalThis.ClubDay?.paintEntry();
  completeInitialLaunch();
  // Authentication and role checks are already finished. Let the authenticated
  // shell paint before DOM-heavy surfaces or network completion callbacks run.
  await waitForStartupPaint();
  if (currentAuthUser?.id !== authUser?.id || currentUser !== user) return;
  refreshProfileSurfaces();
  runWhenIdle(() => { if (currentAuthUser?.id === authUser?.id) renderCalendar(); });
  runWhenIdle(() => { if (currentAuthUser?.id === authUser?.id) renderSpotify(); });
  for (const render of [renderNotifications, () => globalThis.Tickets?.render(), renderAdminAchievements]) {
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
    // The sede's Chota decorations appear at once from the last saved story.
    globalThis.ClubPlus?.prime?.();
    void hydrateAuthenticatedData(authUser);
    runWhenIdle(() => { if (currentAuthUser?.id === authUser.id) void globalThis.BannerShop?.refresh(); });
    runWhenIdle(() => { if (currentAuthUser?.id === authUser.id) void globalThis.ClubDay?.refresh(); });
    runWhenIdle(() => { if (currentAuthUser?.id === authUser.id) void globalThis.ClubPlus?.refresh(); });
    runWhenIdle(() => { if (currentAuthUser?.id === authUser.id) globalThis.ChatCustom?.start(); });
    runWhenIdle(() => { if (currentAuthUser?.id === authUser.id) void globalThis.ClubCoinMissions?.refresh(); });
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
  globalThis.CardCollection?.close();
  globalThis.ClubAccountSecurity?.reset();
  globalThis.ClubOnboarding?.reset();
  idleStartupQueue.length = 0;
  for (const timer of realtimeRefreshTimers.values()) clearTimeout(timer);
  realtimeRefreshTimers.clear();
  for (const ch of [presenceChannel, messageChannel, notificationsChannel, privateChannel, eventChannel, settingsChannel, chatChannelsRealtime, helpRealtime, achievementsRealtime, profilesRealtime]) {
    if (db && ch) db.removeChannel(ch);
  }
  presenceChannel = messageChannel = notificationsChannel = privateChannel = eventChannel = settingsChannel = chatChannelsRealtime = helpRealtime = achievementsRealtime = profilesRealtime = null;
  document.body.classList.remove("session-restoring");
  currentUser = null;
  globalThis.ClubDrafts?.suspend();
  currentAuthUser = null;
  adminConsole?.apply({});
  adminConsole?.sync();
  accountRequests?.sync();
  globalThis.ClubMotion?.configure(null);
  globalThis.DailyPacks?.reset();
  globalThis.BannerShop?.reset();
  globalThis.ChotaShop?.reset();
  globalThis.ClubOutdoor?.reset();
  globalThis.ChotaGames?.reset();
  globalThis.ClubLive?.reset();
    globalThis.ClubNight?.close();
    globalThis.ClubSocial?.reset();
    globalThis.ClubCoinMissions?.reset();
    globalThis.ClubDay?.reset();
    globalThis.ClubPlus?.reset();
    globalThis.ChatCustom?.reset();
  globalThis.ClubSeasons?.reset();
  globalThis.PlanWidget?.clear();
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
  globalThis.ChotaShop?.reset();
  globalThis.ClubOutdoor?.reset();
  globalThis.ChotaGames?.reset();
  globalThis.ClubLive?.reset();
    globalThis.ClubNight?.close();
    globalThis.ClubSocial?.reset();
    globalThis.ClubCoinMissions?.reset();
    globalThis.ClubDay?.reset();
    globalThis.ClubPlus?.reset();
    globalThis.ChatCustom?.reset();
  globalThis.ClubSeasons?.reset();
  globalThis.PlanWidget?.clear();
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
  // The Chota's saved outfit belongs to this member; forget it on sign-out.
  globalThis.ChotaAppearance?.reset();
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(AUTH_PROFILE_CACHE_KEY);
  localStorage.removeItem(MEMBER_CACHE_KEY);
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
  clearChatImageWarmCache();
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
  achievements = [];
  achievementAwards = [];
  achievementProgress = [];
  achievementProgressUserId = null;
  achievementProgressStatus = "loading";
  dailyParticipation.reset();
  achievementsLoaded = false;
  achievementsLoading = false;
  achievementsRequest = null;
  globalThis.Tickets?.reset();
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

async function measureSessionStartup(name, load) {
  const started = performance.now();
  try { return await load(); }
  finally { console.info(`[BigBoy startup] ${name}: ${Math.round(performance.now() - started)} ms`); }
}

async function beginAuthenticatedSession(authUser) {
  await appUpdateGate?.ready;
  if (appUpdateGate?.blocked()) { showLogin(); return; }
  // getUser reads the current server record, including non-user-editable app metadata.
  // A cached JWT/user_metadata/local flag must never waive a required change.
  const {data, error} = await measureSessionStartup("auth-user", () => db.auth.getUser());
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
    securityApproved = await measureSessionStartup("auth-security", () => globalThis.ClubAccountSecurity.gate(db, verifiedUser));
  } catch (securityError) {
    showLogin();
    throw securityError;
  }
  if (securityApproved === false) return;
  // Roles and account visibility must also come from the current server profile.
  const profile = await measureSessionStartup("auth-profile", () => profileForAuthUser(verifiedUser));
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
  await appUpdateGate?.ready;
  if (appUpdateGate?.blocked()) throw new Error("Instala la actualización para continuar.");
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
  saveMemberCache();
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
      .select("id,user_id,legacy_id,channel_id,body,reply_to_id,attachment_url,attachment_name,attachment_type,attachment_size,created_at,edited_at")
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
  scheduleChatImageWarmup();
  scheduleChatSurfaces({group: true});
}

function mapMessage(item) {
  return {
    id: item.id, userId: item.user_id, member: item.legacy_id, channelId: item.channel_id, text: item.body,
    replyToId: item.reply_to_id,
    attachmentUrl: item.attachment_url, attachmentName: item.attachment_name,
    attachmentType: item.attachment_type, attachmentSize: item.attachment_size,
    createdAt: item.created_at, createdTimestamp: chatDate(item.created_at).timestamp, editedAt: item.edited_at || null
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
  {key:"collection",title:"Sobres y colección",detail:"Sobres, intercambios, mercado y regalos del club",symbol:"◇"},
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
    group_mention:{title:who,kind:"Te ha mencionado en el grupo"},
    help_update:{title:who,kind:"Novedad en un ticket"},
    account_request:{title:"Solicitud de cuenta",kind:"Administración · acceso al club",system:true,symbol:"＋"},
    like:{title:who,kind:"Le gusta tu contenido"},reply:{title:who,kind:"Ha respondido a tu contenido"},media_created:{title:who,kind:item.targetType==="moment"?"Ha compartido una historia":"Ha publicado contenido"},
    event_created:{title:"Nuevo plan",kind:`Agenda · ${who}`,system:true,symbol:"◷"},
    pack_granted:{title:"Sobres recibidos",kind:"Tu colección",system:true,symbol:"◇"},
    news_update:{title:"Noticias del club",kind:"Actualidad · dentro de la app",system:true,symbol:"≋"},
    trade_offer:{title:"Propuesta de intercambio",kind:`Colección · ${who}`,system:true,symbol:"⇄"},
    trade_resolved:{title:"Intercambio actualizado",kind:"Tu colección",system:true,symbol:"⇄"},
    card_wanted:{title:"Buscan tu repetida",kind:`Colección · ${who}`,system:true,symbol:"♡"},
    card_sold:{title:"Carta vendida",kind:`Mercado · ${who}`,system:true,symbol:"◎"}
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
  else if (["pack_granted","trade_offer","trade_resolved","card_wanted","card_sold"].includes(item.type)) {
    if(item.type==="card_sold") {goTo("sobres");globalThis.CardEconomy?.openMarket();}
    else if(item.type.startsWith("trade_")||item.type==="card_wanted") globalThis.CollectionSocial?.openTrades();
    else goTo("sobres");
  } else if (item.type === "account_request" && canManageSite()) {goTo("administracion");document.querySelector("[data-open-account-requests]")?.click();}
  else if (item.type === "group_poll" || item.type === "group_mention") void openGroupConversation(item.targetId);
  else if (item.type === "help_update") { globalThis.Tickets?.show(item.targetId); goTo("ayuda"); }
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
    applyCachedPrivateAttachments(owner);
    globalThis.ClubFeedback?.set(anchor, "ready", "");
    refreshPrivateMessageSurfaces();
    // Text and the inbox must not wait for a Storage round trip. Reconcile the
    // attachment URLs when signing finishes, using the same account guard.
    void resolvePrivateAttachments({changed: true}).then(() => {
      if (owner === currentAuthUser?.id) refreshPrivateMessageSurfaces();
    });
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
function applyCachedPrivateAttachments(userId) {
  for (const message of privateMessages) {
    const path = privateAttachmentPath(message.attachmentRef || message.attachmentUrl);
    if (!path) continue;
    const cached = privateAttachmentCache.get(`${userId}:${path}`);
    message.attachmentUrl = cached?.expires > Date.now() ? cached.url : message.attachmentRef;
  }
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
    applyCachedPrivateAttachments(userId);
    } while (request.pending && currentAuthUser?.id === userId);
  })().catch(() => { /* Offline signing leaves a non-executable storage reference for later retry. */ }).finally(() => { if (privateAttachmentRequest === request) privateAttachmentRequest = null; });
  return request.promise;
}

function refreshPrivateMessageSurfaces() {
  scheduleChatImageWarmup();
  scheduleChatSurfaces({privateConversation: true});
}

function mapPrivateMessage(item) {
  return {
    id: item.id, senderId: item.sender_id, recipientId: item.recipient_id,
    replyToId: item.reply_to_id,
    body: item.body, attachmentRef: item.attachment_url, attachmentUrl: item.attachment_url, attachmentName: item.attachment_name,
    attachmentType: item.attachment_type, attachmentSize: item.attachment_size,
    createdAt: item.created_at, createdTimestamp: chatDate(item.created_at).timestamp, editedAt: item.edited_at || null
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
      if (globalThis.Tickets?.isLoaded() || document.getElementById("ayuda")?.classList.contains("active")) scheduleRealtimeRefresh("help", () => globalThis.Tickets?.refresh());
    })
    .on("postgres_changes", {event: "*", schema: "public", table: "help_messages"}, () => {
      if (globalThis.Tickets?.isLoaded() || document.getElementById("ayuda")?.classList.contains("active")) scheduleRealtimeRefresh("help", () => globalThis.Tickets?.refresh());
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
  }).select("id,user_id,legacy_id,channel_id,body,reply_to_id,attachment_url,attachment_name,attachment_type,attachment_size,created_at,edited_at").single();
  if (error) throw error;
  dispatchPush("group_message", data.id);
  globalThis.DailyPacks?.activityCompleted?.('message');
  return mapMessage(data);
}

// A shared pack opening is posted to the group's default channel as a token
// the chat draws as a strip of the six cards.
document.addEventListener("bb:share-pack", event => {
  const token = event.detail?.token;
  const channel = chatChannels.find(item => item.isDefault) || chatChannels[0];
  if (!token || !channel) return;
  void sendMessage(token, null, {destination: channel.id}).then(message => {
    if (message && !messages.some(item => String(item.id) === String(message.id))) { messages.push(message); if (String(activeChatChannelId) === String(channel.id)) renderMessages(); }
  }).catch(error => console.warn("No se pudo compartir el sobre:", error));
});

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
  }).select("id,sender_id,recipient_id,body,reply_to_id,attachment_url,attachment_name,attachment_type,attachment_size,created_at,edited_at").single();
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
      }).select("id,user_id,legacy_id,channel_id,body,reply_to_id,attachment_url,attachment_name,attachment_type,attachment_size,created_at,edited_at").single();
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
      }).select("id,sender_id,recipient_id,body,reply_to_id,attachment_url,attachment_name,attachment_type,attachment_size,created_at,edited_at").single();
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

function openEventEditor(eventId = null, requestedType = "event", draft = null) {
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
  if (draft && !event) {
    document.getElementById("eventTitle").value = String(draft.title || "").slice(0, 160);
    document.getElementById("eventDescription").value = String(draft.description || "").slice(0, 2000);
    document.getElementById("eventLocation").value = String(draft.location || "").slice(0, 200);
  }
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
  message.editedAt = new Date().toISOString();
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
  message.editedAt = new Date().toISOString();
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

// A publisher photo that fails to load leaves a text-only card, never an empty frame.
document.addEventListener("error", event => {
  if (!(event.target instanceof HTMLImageElement) || !event.target.matches("[data-news-photo]")) return;
  const card = event.target.closest(".news-card");
  const thumb = event.target.closest(".news-thumb");
  event.target.remove();
  thumb?.remove();
  card?.classList.remove("has-photo");
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
  const canShare = !isSuperAdmin();
  // Front page: one lead story, two highlights with thumbnails, then a timeline.
  const cards = sortedItems.map((item, index) => {
    const source = item.source || "Medio de comunicación";
    const cleanTitle = item.title.endsWith(` - ${source}`) ? item.title.slice(0, -(source.length + 3)) : item.title;
    item.cleanTitle = cleanTitle;
    const publishedTimestamp = newsTimestamp(item.published);
    const dateTime = publishedTimestamp ? new Date(publishedTimestamp).toISOString() : "";
    const image = safeNewsUrl(item.image);
    const summary = String(item.summary || "").replace(/<[^>]*>/g, "").trim();
    const link = escapeHtml(item.link);
    const photo = image ? `<img data-news-photo src="${escapeHtml(image)}" alt="" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" referrerpolicy="no-referrer">` : "";
    const share = canShare ? `<button class="media-share-button news-share-button" type="button" data-share-news="${index}" aria-label="Compartir: ${escapeHtml(cleanTitle)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></svg></button>` : "";
    const time = `<time${dateTime ? ` datetime="${dateTime}"` : ""}>${escapeHtml(index < 3 ? formatRelativeTime(publishedTimestamp || Date.now()) : newsClock(publishedTimestamp))}</time>`;
    const headline = `<h3><a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(cleanTitle)}</a></h3>`;
    if (index === 0) return `<article class="news-card news-lead${image ? " has-photo" : ""}">
      ${image ? `<div class="news-media">${photo}</div>` : ""}
      <div class="news-card-body"><div class="news-card-meta"><span class="news-chip">${escapeHtml(categoryName)}</span><span>${escapeHtml(source)}</span>${time}</div>
      ${headline}${summary && summary !== cleanTitle ? `<p class="news-summary">${escapeHtml(summary)}</p>` : ""}
      <div class="news-card-actions"><span class="news-read" aria-hidden="true">Leer noticia</span>${share}</div></div>
    </article>`;
    if (index < 3) return `<article class="news-card news-support${image ? " has-photo" : ""}">
      <div class="news-card-body"><div class="news-card-meta"><span>${escapeHtml(source)}</span>${time}</div>${headline}</div>
      ${image ? `<div class="news-thumb">${photo}</div>` : ""}${share}
    </article>`;
    return `<li class="news-card news-latest">${time}<div class="news-card-body"><span class="news-source">${escapeHtml(source)}</span>${headline}</div>${share}</li>`;
  });
  updateSurfaceMarkup(grid, cards.length ? `${cards.slice(0, 3).join("")}${cards.length > 3 ? `<section class="news-latest-block" aria-label="Última hora"><h4>Última hora</h4><ol class="news-latest-list">${cards.slice(3).join("")}</ol></section>` : ""}`
    : '<div class="empty-state"><strong>Sin titulares disponibles</strong><span>Actualiza para consultar las últimas noticias.</span></div>');
}

function newsTimestamp(value) {
  if (!value) return 0;
  const directTimestamp = Date.parse(value);
  if (Number.isFinite(directTimestamp)) return directTimestamp;
  const normalized = value.includes("T") ? value : value.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
  const fallbackTimestamp = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isFinite(fallbackTimestamp) ? fallbackTimestamp : 0;
}

// Timeline column: the hour for today, "Ayer", or a short date.
function newsClock(timestamp) {
  if (!timestamp) return "—";
  const date = new Date(timestamp), today = new Date();
  const day = value => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((day(today) - day(date)) / 86400000);
  if (days === 0) return date.toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"});
  if (days === 1) return "Ayer";
  return date.toLocaleDateString("es-ES", {day: "numeric", month: "short"});
}

function formatNewsDate(value) {
  const timestamp = newsTimestamp(value);
  if (!timestamp) return "Fecha no disponible";
  const date = new Date(timestamp);
  return newsDateFormatter.format(date);
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
    else achievementPageButton.textContent = `Ver ${Math.min(8, remaining)} más`;
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
    // Moving along a ladder inside the detail keeps the original return point.
    const returnFocus = achievementTarget.closest("#achievementChallengesDialog") ? achievementChallengesReturnFocus
      : achievementTarget.closest("#achievementDetail") ? achievementReturnFocus : document.activeElement;
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
  if (!event.target.closest("#profileQuickMenu, .profile-tab, .profile-account-sheet-panel")) closeProfileQuickMenu();
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
  hoy: ".packs-back",
  perfil: "[data-profile-back]",
  ayuda: null
};
let pageBackGesture = null;
let pageBackSettling = false;
let suppressPageBackClickUntil = 0;
Object.keys(pageBackControls).forEach(id => document.getElementById(id)?.setAttribute("data-edge-back", ""));
function pageBackAction(page) {
  if (page.id === "ayuda") return () => {
    if (globalThis.Tickets?.back()) return;
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
  const routes = {"admin-configuracion": "administracion", "admin-diagnostico": "admin-configuracion", "admin-cuentas": "admin-configuracion", "admin-logros": "admin-configuracion", "crear-logro": "admin-logros", "asignar-logro": "admin-logros", "editar-usuario": "admin-cuentas", sobres: "inicio", catalogo: "sobres", hoy: "inicio"};
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
  pageBackGesture = {page, back, id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,peak:0,velocity:0,samples:[{x:event.clientX,time:event.timeStamp??performance.now()}],frame:0,tracking:false};
}, {passive: true});
function samplePageBackGesture(gesture,event) {
  const time=event.timeStamp??performance.now();
  gesture.samples.push({x:event.clientX,time});
  gesture.samples=gesture.samples.filter(sample=>time-sample.time<=90);
  const first=gesture.samples[0],elapsed=time-first.time;
  gesture.velocity=elapsed>0?(event.clientX-first.x)/elapsed:0;
  gesture.dx=Math.max(0,event.clientX-gesture.x);
  gesture.peak=Math.max(gesture.peak,gesture.dx);
}
function paintPageBackGesture(gesture) {
  gesture.frame=0;
  const transform=`translate3d(${Math.min(gesture.dx,innerWidth)}px,0,0)`;
  gesture.page.style.transform=transform;
  if(gesture.scene?.sourceHeader)gesture.scene.sourceHeader.style.transform=transform;
}
document.addEventListener("pointermove", event => {
  const gesture = pageBackGesture;
  if (!gesture || gesture.id !== event.pointerId) return;
  samplePageBackGesture(gesture,event);
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
  if (!gesture.page.classList.contains("active") || (!gesture.tracking && (dx < -12 || Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)))) {
    if(gesture.frame)cancelAnimationFrame(gesture.frame);
    if(gesture.tracking){
      if(gesture.sourceTransform)gesture.page.style.transform=gesture.sourceTransform;else gesture.page.style.removeProperty("transform");
      cleanupPageBackPreview(gesture);
    }
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
  if (event.cancelable) event.preventDefault();
  try { gesture.page.setPointerCapture(event.pointerId); } catch { /* OS may cancel an edge gesture. */ }
  if(!gesture.frame)gesture.frame=requestAnimationFrame(()=>{if(pageBackGesture===gesture)paintPageBackGesture(gesture);});
}, {passive: false});
async function finishPageBackGesture(event) {
  const gesture = pageBackGesture;
  if (!gesture || gesture.id !== event.pointerId) return;
  samplePageBackGesture(gesture,event);
  if(gesture.frame)cancelAnimationFrame(gesture.frame);
  if(gesture.tracking)paintPageBackGesture(gesture);
  pageBackGesture = null;
  if (gesture.page.hasPointerCapture?.(gesture.id)) gesture.page.releasePointerCapture(gesture.id);
  if (!gesture.tracking) return;
  pageBackSettling = true;
  suppressPageBackClickUntil = Date.now() + 450;
  const dx=gesture.dx,reversed=gesture.peak-dx>=28;
  const commit=event.type==="pointerup" && gesture.page.classList.contains("active") && !reversed
    && (dx>=Math.min(84,innerWidth*.22) || dx>=32 && gesture.velocity>=.45);
  const reduced = (globalThis.ClubMotion?.media || matchMedia("(prefers-reduced-motion: reduce)")).matches;
  const animations = [];
  try {
    if (!reduced && gesture.page.animate) {
      const distance=Math.abs((commit?innerWidth:0)-gesture.dx);
      const duration=globalThis.ClubMotion?.settleDuration(distance,innerWidth,commit?gesture.velocity:-gesture.velocity) || (commit?180:150);
      for (const surface of [gesture.page, gesture.scene?.sourceHeader].filter(Boolean)) animations.push(surface.animate([
        {transform: `translate3d(${gesture.dx}px,0,0)`},
        {transform: `translate3d(${commit ? innerWidth : 0}px,0,0)`}
      ], {duration,easing:globalThis.ClubMotion?.ease||"cubic-bezier(.2,.8,.2,1)",fill:"both"}));
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
document.addEventListener("lostpointercapture", finishPageBackGesture, {passive: true});
document.addEventListener("click", event => {
  if (event.isTrusted && Date.now() < suppressPageBackClickUntil) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

document.addEventListener("pointerdown", startChatBackGesture, {passive: false});
document.addEventListener("pointermove", event => { if (!chatBackGesture?.touch) moveChatBackGesture(event); }, {passive: false});
document.addEventListener("pointerup", event => { if (!chatBackGesture?.touch) void finishChatBackGesture(event); }, {passive: true});
document.addEventListener("pointercancel", event => {
  if (chatBackGesture?.pointerId === event.pointerId && !chatBackGesture.touch) resetChatBackGesture({settle: true});
}, {passive: true});
document.addEventListener("lostpointercapture", event => {
  if (chatBackGesture?.pointerId === event.pointerId && !chatBackGesture.touch) resetChatBackGesture({settle: true});
}, {passive: true});
document.addEventListener("touchstart", bindChatBackTouch, {passive: true});
// Scoped to the conversations so other pages retain fast native scrolling.
document.querySelectorAll(".private-conversation, .group-conversation").forEach(panel => {
  panel.addEventListener("touchmove", moveChatBackTouch, {passive: false});
});
document.addEventListener("touchend", endChatBackTouch, {passive: true});
document.addEventListener("touchcancel", cancelChatBackTouch, {passive: true});
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
  const toggle = document.getElementById("togglePassword");
  toggle.setAttribute("aria-pressed", String(field.type === "text"));
  toggle.setAttribute("aria-label", field.type === "text" ? "Ocultar contraseña" : "Mostrar contraseña");
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
  const actionButton = event.target.closest("[data-message-action]");
  const action = actionButton?.dataset.messageAction;
  const target = messageMenuTarget;
  if (!action || !contextMessage(target)) return;
  closeMessageMenu(event.detail === 0);
  if (action === "plan") { const message = contextMessage(target); openEventEditor(null, "event", {title: (message.text || message.body || "").slice(0, 160), description: message.text || message.body || ""}); }
  else if (action === "reply") selectChatReply(target);
  else if (action === "react") void globalThis.ChatCustom?.react(target.kind, target.id, actionButton.dataset.emoji);
  else if (action === "pin") void globalThis.ChatCustom?.pin(target.kind, globalThis.ChatCustom.isPinned(target.kind, target.id) ? null : target.id);
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
document.getElementById("adminPanelButton")?.addEventListener("click", event => {
  // The administration account gets its menu (panel, club view, security, sign out); other admins go to the panel.
  if (isSuperAdmin()) adminConsole?.toggleMenu?.(event.currentTarget);
  else goTo("administracion");
});
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
  canCreatePlan: canManageSite,
  createPlan: draft => openEventEditor(null, "event", draft),
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

globalThis.ChotaShop?.initialize({
  cacheNamespace: config.supabaseUrl || "local",
  session: () => backendReady && currentAuthUser?.id,
  rpc: (name, args) => db.rpc(name, args),
  refreshWallet: () => globalThis.BannerShop?.refresh(),
});

globalThis.ClubStore?.initialize();

globalThis.ChotaGames?.initialize({
  session: () => backendReady && currentAuthUser?.id,
  getOwnedItems: () => globalThis.ChotaShop?.refresh(),
  openShop: () => {
    document.querySelector('[data-banner-shop]')?.click();
    document.getElementById('shopChotaTab')?.click();
  },
  rpc: (name, args) => db.rpc(name, args),
  startGame: async game => {
    const {data, error} = await db.rpc('start_chota_game', {target_game: game});
    if (error) throw error;
    return data;
  },
  submitScore: async (_game, score, sessionId, completed) => {
    const {data, error} = await db.rpc('submit_chota_game_score', {game_session_id: sessionId, submitted_score: score, completed_round: completed === true});
    if (error) throw error;
    if (data?.reward_status === 'awarded') void globalThis.DailyPacks?.refresh(true);
    return data;
  },
  leaderboard: async game => {
    const {data, error} = await db.rpc('get_chota_game_leaderboard', {target_game: game});
    if (error) throw error;
    return data;
  },
});

globalThis.ClubSocial?.init({db, getUser: () => currentAuthUser, refreshPacks: () => globalThis.DailyPacks?.refresh(true)});

globalThis.ClubCoinMissions?.init({
  db, getUser: () => currentAuthUser,
  refreshWallet: () => Promise.all([globalThis.BannerShop?.refresh(true), globalThis.ChotaShop?.refresh(true)]),
  navigate: goTo,
});

globalThis.ClubDay?.init({
  db, getUser: () => currentAuthUser, getMember: getMemberByAuthId, getMembers: () => members,
  avatar: getAvatar, canManage: canManageSite,
  refreshWallet: () => Promise.all([globalThis.BannerShop?.refresh(true), globalThis.ChotaShop?.refresh(true), globalThis.ClubCoinMissions?.refresh?.(true)]),
});

globalThis.ClubNight?.init({ db, getUser: () => currentAuthUser, getMember: getMemberByAuthId });
globalThis.ClubLive?.init({
  db,
  getUser: () => currentAuthUser,
  getEvents: () => groupEvents,
  getMember: getMemberByAuthId,
  canManage: canManageSite,
  onOpenCalendar: () => goTo("calendario"),
  onProposePlace: async draft => {
    const owner = currentAuthUser?.id;
    if (!owner) return;
    if (canManageSite()) return openEventEditor(null, "event", draft);
    const channel = chatChannels.find(item => !item.readOnly);
    if (!channel) return goTo("calendario");
    await openGroupConversation(channel.id);
    if (currentAuthUser?.id !== owner) return;
    const input = document.getElementById("messageInput");
    const proposal = `¿Repetimos en ${draft.location}?`;
    input.value = input.value.trim() ? `${input.value.trim()} ${proposal}` : proposal;
    input.dispatchEvent(new Event("input", {bubbles: true}));
    input.focus({preventScroll: true});
  },
});

globalThis.ClubSeasons?.initialize({db, session: () => currentAuthUser?.id, refreshPacks: () => globalThis.DailyPacks?.refresh(true), openAlbum: () => globalThis.CardAlbum?.open()});

globalThis.PlanWidget?.onOpen?.(eventId => {
  if (!homeEventsReady || !currentAuthUser) { pendingWidgetEventId = String(eventId); return; }
  const event = groupEvents.find(item => String(item.id) === String(eventId));
  if (event) globalThis.GroupInteractions?.openPlan(event);
  else goTo('calendario');
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
  buyShield: price => db.rpc("buy_streak_shield", {expected_price: price}),
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
    await appUpdateGate?.ready;
    if (appUpdateGate?.blocked()) { showLogin(); return; }
    if (navigator.onLine === false) {showLogin();return;}
    if (backendReady) {
      await globalThis.ClubNativeAuth?.resume(db);
      const {data, error} = await measureSessionStartup("auth-session", () => db.auth.getSession());
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
if (["inicio", "chat", "privados", "miembros", "contenido", "momentos", "publicaciones", "noticias", "buscar", "calendario", "perfil", "ayuda", "sobres", "album", "catalogo", "hoy"].includes(initialSection)) {
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
async function refreshCurrentPage() {
  if (!backendReady || !currentAuthUser) return;
  const active = document.querySelector(".app > .page-section.active")?.id;
  const tasks = [loadRemoteProfiles(), loadGroupEvents(), loadSiteSettings(), loadNotifications(),
    globalThis.BannerShop?.refresh(true), globalThis.DailyPacks?.refresh(true)];
  if (active === "inicio") tasks.push(loadNews(true));
  if (active === "hoy" || active === "inicio") tasks.push(globalThis.ClubDay?.refresh(), globalThis.ClubPlus?.refresh());
  if (active === "ayuda") tasks.push(globalThis.Tickets?.refresh());
  if (active === "chat") tasks.push(loadMessages(), loadPrivateMessages());
  await Promise.allSettled(tasks);
  if (active === "perfil" && currentUser) renderProfile(currentUser.id, false);
}

globalThis.Tickets?.init({
  db, getUser: () => currentAuthUser, getMember: getMemberByAuthId, canManage: canManageSite, avatar: getAvatar,
  leave() { const destination = helpReturnPage; goTo(destination?.id || "inicio"); restorePagePosition(destination); },
  drafts: id => globalThis.ClubDrafts?.begin("helpReplyForm", id == null ? null : `request:${id}`),
  clearDraft: id => globalThis.ClubDrafts?.clear(id, globalThis.ClubDrafts?.token(id)),
  onRead: () => loadNotifications(),
});

globalThis.PullRefresh?.init({
  onRefresh: refreshCurrentPage,
  // A conversation scrolls its own messages; dialogs and overlays keep their gestures.
  canPull: () => Boolean(currentAuthUser) && !document.querySelector("dialog[open], .conversation-open")
    && !document.body.classList.contains("chat-focus"),
});

globalThis.ClubPlus?.init({
  db, getUser: () => currentAuthUser, getMember: getMemberByAuthId, getMembers: () => members,
  upload: (file, folder) => uploadGroupMedia(file, folder),
  onChange() { globalThis.ClubDay?.paintEntry(); renderMembers(); },
});

globalThis.ChatMentions?.init({
  getSelf: () => currentUser, getPeer: () => getMember(activePrivateMemberId), getMembers: () => members, avatar: getAvatar,
});

globalThis.ChatCustom?.init({
  db, getUser: () => currentAuthUser, getChannel: () => activeChatChannelId, getPeer: () => getMember(activePrivateMemberId),
  getSelf: () => currentUser, getMembers: () => members, canManage: canManageSite,
  getGroupName: () => siteSettings.group_name || "Bigboys",
  getMessage(kind, id) {
    const message = (kind === "group" ? messages : privateMessages).find(item => String(item.id) === String(id));
    return message ? (message.text || message.body || "Adjunto") : null;
  },
  notify: text => globalThis.ClubFeatures?.feedback(text),
  openGroupPhoto: () => document.getElementById("editGroupAvatarButton")?.click(),
  async saveGroupName(value) {
    const {error} = await db.from("site_settings").upsert({key: "group_name", value, updated_by: currentAuthUser.id, updated_at: new Date().toISOString()});
    if (error) throw error;
    await loadSiteSettings();
    renderPrivateContacts();
  },
  onChange() {
    renderPrivateContacts();
    if (document.getElementById("chat")?.classList.contains("active")) renderMessages();
    if (activePrivateMemberId != null) renderPrivateConversation();
  },
});

globalThis.ChatThemes?.init({
  getShared: context => globalThis.ChatCustom?.sharedTheme(context),
  publish: (context, id) => globalThis.ChatCustom?.publishTheme(context, id),
  afterSync: kind => globalThis.ChatCustom?.sync(kind),
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
      const scope = form.id === 'helpRequestForm' ? 'new' : form.id === 'helpReplyForm' && globalThis.Tickets?.activeId() ? `request:${globalThis.Tickets.activeId()}` : null;
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
