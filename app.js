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
const pageTitle = document.getElementById("pageTitle");
const sections = [...document.querySelectorAll(".page-section")];
const navLinks = [...document.querySelectorAll(".nav-link")];
const sidebar = document.getElementById("sidebar");
const SIDEBAR_COMPACT_KEY = "bb-sidebar-compact";
if (localStorage.getItem(SIDEBAR_COMPACT_KEY) === "1") document.body.classList.add("sidebar-compact");

function syncSidebarCollapseButton() {
  const compact = document.body.classList.contains("sidebar-compact");
  const button = document.getElementById("sidebarCollapseButton");
  button.setAttribute("aria-expanded", String(!compact));
  button.setAttribute("aria-label", compact ? "Ampliar menú lateral" : "Reducir menú lateral");
  button.title = compact ? "Ampliar menú" : "Reducir menú";
}
syncSidebarCollapseButton();

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
let activeNewsCategory = "deportes";
let lastNewsRefreshAt = 0;
let newsLoadToken = 0;
let pendingPrivateMessageFile = null;
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
let cursorFrame = null;
let sharingMedia = null;
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
    if (window.innerWidth > 760) {
      document.documentElement.style.removeProperty("--chat-viewport-height");
      document.documentElement.style.removeProperty("--chat-viewport-offset");
      return;
    }
    const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight);
    const viewportOffset = Math.round(window.visualViewport?.offsetTop || 0);
    document.documentElement.style.setProperty("--chat-viewport-height", `${viewportHeight}px`);
    document.documentElement.style.setProperty("--chat-viewport-offset", `${viewportOffset}px`);
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
  renderMoments();
  renderPublications();
}

function goTo(sectionId) {
  const requestedSection = sectionId;
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
  sections.forEach(section => section.classList.toggle("active", section.id === sectionId));
  navLinks.forEach(link => link.classList.toggle("active", link.dataset.section === (sectionId === "privados" ? "chat" : sectionId)));
  document.body.classList.toggle("chat-focus", openingChat);
  syncMobileViewport();
  const titles = {
    inicio: "The Big Boy Rules", chat: "Chats", miembros: "Miembros",
    privados: "Mensajes privados", perfil: "Perfil del miembro", contenido: "Publicaciones",
    noticias: "Noticias", calendario: "Calendario", administracion: "Administración"
  };
  pageTitle.textContent = titles[sectionId] || titles.inicio;
  sidebar.classList.remove("open");
  if (homeAnchor) requestAnimationFrame(() => document.getElementById(homeAnchor)?.scrollIntoView({behavior: "smooth", block: "start"}));
  else window.scrollTo({top: 0, behavior: "smooth"});
  history.replaceState(null, "", `#${homeAnchor || sectionId}`);
  if ((requestedSection === "noticias" || sectionId === "inicio") && currentUser) loadNews(false);
  if (sectionId === "calendario") renderCalendar();
  if (sectionId === "contenido") selectContentTab(activeContentTab);
}

function exitChatView() {
  goTo(sectionBeforeChat && sectionBeforeChat !== "chat" && sectionBeforeChat !== "privados"
    ? sectionBeforeChat
    : "inicio");
}

function backFromPrivateConversation() {
  if (activePrivateMemberId != null) {
    activePrivateMemberId = null;
    renderPrivateContacts();
    renderPrivateConversation();
    return;
  }
  exitChatView();
}

function renderFeatured() {
  document.getElementById("featuredMembers").innerHTML = members.slice(0, 4).map(member => `
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
  const member = getMember(memberId);
  if (!member) return;
  activeProfileId = member.id;
  const canEdit = currentUser?.id === member.id;
  const canManageProfile = canEdit || isSuperAdmin();
  const canDeletePosts = canEdit || isSuperAdmin();
  const posts = profilePosts.filter(post => post.member === member.id);
  document.getElementById("profileContent").innerHTML = `
    <article class="profile-hero">
      <div class="profile-visual ${member.avatarUrl ? "has-photo" : ""}"
        style="--profile-bg:${member.avatarUrl ? `url('${escapeHtml(member.avatarUrl)}')` : member.bg}"></div>
      <div class="profile-info">
        <span class="profile-number">BIG BOY ${String(memberDisplayNumber(member)).padStart(2, "0")}</span>
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
  document.getElementById("addProfilePostButton")?.addEventListener("click", () => openMediaUploader("post"));
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
      ${!isSuperAdmin() ? `<button class="media-reply-button" type="button" data-reply-media="${item.id}" data-reply-kind="${kind}">Responder</button>` : ""}
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
    return `<div class="message ${own ? "own" : ""}">
      ${getAvatar(member)}
      <div class="message-bubble" data-message-bubble>
        <div class="message-head">
          <button class="message-author" data-profile="${message.member}">${escapeHtml(member?.name || "Miembro")}</button>
          <time datetime="${escapeHtml(message.createdAt)}">${formatMessageDate(message.createdAt)}</time>
        </div>
        ${message.text ? `<p>${escapeHtml(message.text)}</p>` : ""}${attachment}
        ${(own && message.text) || canDelete ? `<div class="message-actions">
          ${own && message.text ? `<button type="button" data-edit-group-message="${message.id}">Editar</button>` : ""}
          ${canDelete ? `<button type="button" class="danger" data-delete-group-message="${message.id}">Eliminar</button>` : ""}
        </div>` : ""}
      </div>
    </div>`;
  }).join("");
  container.scrollTop = container.scrollHeight;
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
}

function setChatEnabled(enabled) {
  const input = document.getElementById("messageInput");
  const button = document.querySelector(".message-form .send-button");
  const attach = document.getElementById("attachMessageButton");
  input.disabled = !enabled;
  button.disabled = !enabled;
  attach.disabled = !enabled;
  input.placeholder = enabled ? "Escribe algo al grupo..." : "El chat necesita la conexión compartida";
}

function renderPresence() {
  const count = onlineUsers.length;
  const label = count === 1 ? "1 conectado" : `${count} conectados`;
  document.getElementById("chatOnlineStatus").innerHTML = `<i></i> ${label}`;
  document.getElementById("heroOnlineStatus").innerHTML = `<i></i> ${count ? `${label} ahora` : "Nadie conectado"}`;
  const panel = document.getElementById("onlineMembers");
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
  return `<a class="message-file" href="${escapeHtml(message.attachmentUrl)}" target="_blank" rel="noopener" download>
    <span>↧</span><div><strong>${escapeHtml(message.attachmentName || "Archivo adjunto")}</strong><small>${formatFileSize(message.attachmentSize)}</small></div>
  </a>`;
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
  grid.innerHTML = moments.map((item, index) => {
    const member = getMember(item.member);
    return `<div class="story-bubble-item" data-media-card-kind="moment" data-media-card-id="${item.id}" style="--story-index:${index}">
      <button class="story-bubble" type="button" data-open-moment="${item.id}" aria-label="Ver momento de ${escapeHtml(member?.name || "miembro")}">
        <span class="story-avatar-ring">${getAvatar(member)}</span><strong>${escapeHtml(member?.name || "Miembro")}</strong>
      </button>
      ${(isMediaOwner(item) || isSuperAdmin()) ? `<button class="story-bubble-delete" type="button" data-delete-moment="${item.id}" aria-label="Eliminar momento">×</button>` : ""}
    </div>`;
  }).join("");
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
  if (!currentUser) return;
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
  panel.innerHTML = contacts.map(({member, latest}) =>
    `<button class="private-contact ${activePrivateMemberId === member.id ? "active" : ""}" data-private-member="${member.id}">
      ${getAvatar(member)}
      <span><strong>${escapeHtml(member.name)}</strong><small>${latest ? escapeHtml(latest.body) : "Iniciar conversación"}</small></span>
    </button>`).join("");
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
  document.getElementById("privados").classList.toggle("conversation-open", Boolean(member));
  if (!member) {
    const emptyPrivateHeader = document.getElementById("privateChatHeader");
    emptyPrivateHeader.classList.remove("has-country-flag");
    emptyPrivateHeader.innerHTML = `<div><span class="eyebrow">MENSAJE DIRECTO</span><h3>Elige un miembro</h3></div>`;
    container.innerHTML = `<div class="empty-state">Selecciona un miembro para comenzar una conversación privada.</div>`;
    input.disabled = true;
    submit.disabled = true;
    attach.disabled = true;
    return;
  }
  const privateHeader = document.getElementById("privateChatHeader");
  privateHeader.classList.toggle("has-country-flag", Boolean(member.countryFlag));
  privateHeader.innerHTML = `
    ${member.countryFlag ? `<span class="private-chat-header-flag" aria-hidden="true">${escapeHtml(member.countryFlag)}</span>` : ""}
    <div class="private-chat-person">
      <button class="chat-back-button private-conversation-back" type="button" data-private-back aria-label="Volver a conversaciones">←</button>
      <div class="private-chat-avatar">
        ${getAvatar(member)}
      </div>
      <div><span class="eyebrow">MENSAJE DIRECTO</span><h3>${escapeHtml(member.name)}</h3></div>
    </div>
    <button class="text-button" data-profile="${member.id}">Ver perfil →</button>`;
  const items = privateMessages.filter(message =>
    (message.senderId === currentAuthUser?.id && message.recipientId === member.authId)
    || (message.senderId === member.authId && message.recipientId === currentAuthUser?.id));
  container.innerHTML = items.length ? items.map(message => {
    const sender = getMemberByAuthId(message.senderId);
    const own = message.senderId === currentAuthUser?.id;
    return `<div class="message private-message ${own ? "own" : ""}">
      ${getAvatar(sender)}
      <div class="message-bubble" data-message-bubble>
        <div class="message-head"><strong>${escapeHtml(sender?.name || "Miembro")}</strong><time>${formatMessageDate(message.createdAt)}</time></div>
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
    results.push({type: "Evento", title: event.title, detail: formatEventDate(event.startsAt), section: "calendario"});
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
  ["sidebarAvatar", "topbarAvatar"].forEach(id => {
    const node = document.getElementById(id);
    node.classList.toggle("has-image", Boolean(user.avatarUrl));
    node.innerHTML = user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt="">` : escapeHtml(user.name.charAt(0));
  });
  document.getElementById("sidebarUserName").textContent = user.name;
  document.getElementById("topbarUserName").textContent = user.name;
  document.getElementById("sidebarUserRole").textContent = isSuperAdmin() ? "Control total" : user.roleKey === "admin" ? "Administrador" : "Miembro";
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
    await Promise.all([loadMessages(), loadMoments(), loadProfilePosts(), loadMediaLikes(), loadNotifications(), loadPrivateMessages(), loadGroupEvents(), loadSiteSettings()]);
    connectRealtime();
  } else {
    onlineUsers = [{legacy_id: user.id, name: user.name}];
    renderPresence();
    renderAdminPanel();
  }
  if (authUser?.user_metadata?.must_change_password) requirePasswordChange(authUser.id);
  if (passwordChangeIsRequired(authUser?.id || user.id)) openRequiredPasswordChange();
  if (document.getElementById("inicio")?.classList.contains("active")) loadNews(false);
}

function showLogin() {
  document.body.classList.remove("authenticated");
  document.getElementById("loginScreen")?.classList.remove("login-hidden");
  document.getElementById("userDropdown")?.classList.remove("open");
  onlineUsers = [];
  notifications = [];
  renderPresence();
  renderNotifications();
  closeNotifications();
  goTo("inicio");
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
    const query = existing
      ? db.from("media_likes").delete().eq("id", existing.id).eq("user_id", currentAuthUser.id)
      : db.from("media_likes").insert({
          user_id: currentAuthUser.id,
          moment_id: kind === "moment" ? mediaId : null,
          profile_post_id: kind === "post" ? mediaId : null
        });
    const {error} = await query;
    if (error) throw error;
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
  const unread = notifications.filter(item => !item.readAt).length;
  badge.hidden = unread === 0;
  badge.textContent = unread > 99 ? "99+" : String(unread);
  markAll.disabled = unread === 0;
  if (!notifications.length) {
    list.innerHTML = `<div class="empty-state compact">No tienes notificaciones.</div>`;
    return;
  }
  list.innerHTML = notifications.map(item => {
    const actor = getMemberByAuthId(item.actorId);
    const text = item.type === "private_message"
      ? `${actor?.name || "Un miembro"} te ha enviado un mensaje`
      : `${actor?.name || "Un miembro"} ha dado Me gusta a tu ${item.targetType === "moment" ? "momento" : "publicación"}`;
    return `<button class="notification-item ${item.readAt ? "" : "unread"}" type="button" data-notification-id="${item.id}">
      ${getAvatar(actor, "avatar tiny")}
      <span><strong>${escapeHtml(text)}</strong>${item.excerpt ? `<small>${escapeHtml(item.excerpt)}</small>` : ""}<time datetime="${escapeHtml(item.createdAt)}">${formatRelativeTime(item.createdAt)}</time></span>
      ${item.readAt ? "" : `<i aria-label="Sin leer"></i>`}
    </button>`;
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
}

async function uploadGroupMedia(file, folder) {
  if (file.size > 30 * 1024 * 1024) throw new Error("El archivo supera el máximo de 30 MB.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${currentAuthUser.id}/${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const {error} = await db.storage.from("group-media").upload(path, file, {contentType: file.type || "application/octet-stream"});
  if (error) throw error;
  return db.storage.from("group-media").getPublicUrl(path).data.publicUrl;
}

async function sendMessage(text, file = null) {
  if (!db || !currentAuthUser) return;
  let attachmentUrl = null;
  if (file) attachmentUrl = await uploadGroupMedia(file, "chat");
  const {error} = await db.from("messages").insert({
    user_id: currentAuthUser.id, legacy_id: currentUser.id, channel_id: activeChatChannelId, body: text,
    attachment_url: attachmentUrl, attachment_name: file?.name || null,
    attachment_type: file?.type || null, attachment_size: file?.size || null
  });
  if (error) throw error;
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
  const {error} = await db.from("private_messages").insert({
    sender_id: currentAuthUser.id, recipient_id: recipient.authId, body: text,
    attachment_url: attachmentUrl, attachment_name: file?.name || null,
    attachment_type: file?.type || null, attachment_size: file?.size || null
  });
  if (error) throw error;
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
      goTo("chat");
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

function openMediaUploader(mode) {
  if (!currentUser) return;
  mediaUploadMode = mode;
  const isMoment = mode === "moment";
  document.getElementById("mediaUploaderEyebrow").textContent = isMoment ? "NUEVO MOMENTO" : "NUEVA PUBLICACIÓN";
  document.getElementById("mediaUploaderTitle").textContent = isMoment ? "Compartir una historia" : "Compartir en mi perfil";
  document.getElementById("mediaUploadHelp").textContent = isMoment
    ? "La historia desaparecerá en 24 horas · original o personalizada · máximo 30 MB"
    : "Se mostrará en tu perfil · original o personalizada · máximo 30 MB";
  document.getElementById("mediaUploadFile").value = "";
  document.getElementById("mediaUploadCaption").value = "";
  document.getElementById("mediaMention").innerHTML = `<option value="">Nadie</option>${members.filter(member => !member.hidden && member.authId && member.id !== currentUser.id).map(member => `<option value="${escapeHtml(member.authId)}">@${escapeHtml(member.username)} · ${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("mediaUploadPreview").innerHTML = "";
  resetMediaCropEditor();
  document.getElementById("mediaUploadFeedback").textContent = "";
  const modal = document.getElementById("mediaUploader");
  modal.classList.remove("has-media");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeMediaUploader() {
  const modal = document.getElementById("mediaUploader");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("has-media");
  resetMediaCropEditor();
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
  const file = document.getElementById("mediaUploadFile").files[0];
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
    const {error} = await db.from(table).insert(record);
    if (error) throw error;
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
  const viewer = document.getElementById("mediaViewer");
  viewer.classList.remove("open");
  viewer.setAttribute("aria-hidden", "true");
  document.getElementById("mediaViewerImage").src = "";
  const video = document.getElementById("mediaViewerVideo");
  video.pause();
  video.src = "";
}

function openMoment(momentId) {
  const item = moments.find(moment => String(moment.id) === String(momentId));
  if (!item) return window.alert("Este momento ya no está disponible.");
  const member = getMember(item.member);
  registerMomentView(item);
  openMediaViewer(item.mediaUrl, item.caption || `Momento de ${member?.name || "miembro"}`, item.mediaType);
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
  const body = window.prompt(`Responder a esta ${kind === "moment" ? "historia" : "publicación"}:`);
  if (!body?.trim()) return;
  const record = {user_id: currentAuthUser.id, body: body.trim(), moment_id: kind === "moment" ? id : null, profile_post_id: kind === "post" ? id : null};
  const {error} = await db.from("media_replies").insert(record);
  if (error) return window.alert(error.message || "No se pudo enviar la respuesta.");
  window.alert("Respuesta enviada.");
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
  const feeds = {
    deportes: config.news?.deportesFeeds || [config.news?.deportesFeed, config.news?.deportesFallbackFeed],
    espana: config.news?.espanaFeeds || [config.news?.espanaFeed],
    mundo: config.news?.mundoFeeds || [config.news?.mundoFeed]
  };
  const feedList = [...new Set((feeds[activeNewsCategory] || []).filter(Boolean))];
  if (!feedList.length) {
    status.textContent = "No hay una fuente configurada para esta categoría.";
    return;
  }
  try {
    const responses = await Promise.allSettled(feedList.map(fetchNewsPayload));
    const payloads = responses.filter(result => result.status === "fulfilled").map(result => result.value);
    if (!payloads.length) throw responses.find(result => result.status === "rejected")?.reason || new Error("No se recibieron titulares.");
    const combined = payloads.flatMap(payload => payload.items.map(item => ({
      title: item.title, link: item.link, published: item.pubDate,
      source: extractNewsSource(item.title), image: item.thumbnail || item.enclosure?.link || ""
    })));
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
    const feedTitle = `${payloads.length} fuentes de actualidad`;
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

async function fetchNewsPayload(feed) {
  const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`;
  const response = await fetch(endpoint, {cache: "no-store"});
  if (!response.ok) throw new Error("El servicio de noticias no responde.");
  const payload = await response.json();
  if (payload.status !== "ok" || !payload.items?.length) throw new Error(payload.message || "No se recibieron titulares.");
  return payload;
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
  const eventTarget = event.target.closest("[data-event-id]");
  if (eventTarget) openEventEditor(eventTarget.dataset.eventId);
  const calendarDayTarget = event.target.closest("[data-calendar-date]");
  if (calendarDayTarget) openCalendarDay(calendarDayTarget.dataset.calendarDate);
  const searchSection = event.target.closest("[data-search-section]");
  if (searchSection) goTo(searchSection.dataset.searchSection);
  const searchUrl = event.target.closest("[data-search-url]");
  if (profileTarget || searchSection || searchUrl) closeGlobalSearch();
});
navLinks.forEach(link => link.addEventListener("click", event => {
  event.preventDefault();
  goTo(link.dataset.section);
}));
document.getElementById("menuButton").addEventListener("click", () => sidebar.classList.toggle("open"));
document.getElementById("sidebarCollapseButton").addEventListener("click", () => {
  const compact = document.body.classList.toggle("sidebar-compact");
  localStorage.setItem(SIDEBAR_COMPACT_KEY, compact ? "1" : "0");
  syncSidebarCollapseButton();
});
document.getElementById("themeButton").addEventListener("click", () => {
  document.body.classList.toggle("light");
  localStorage.setItem("bb-theme", document.body.classList.contains("light") ? "light" : "dark");
});
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
document.getElementById("userMenuButton").addEventListener("click", event => {
  event.stopPropagation();
  closeNotifications();
  document.getElementById("userDropdown").classList.toggle("open");
});
document.getElementById("notificationsButton").addEventListener("click", event => {
  event.stopPropagation();
  document.getElementById("userDropdown")?.classList.remove("open");
  const dropdown = document.getElementById("notificationsDropdown");
  const open = !dropdown.classList.contains("open");
  dropdown.classList.toggle("open", open);
  dropdown.setAttribute("aria-hidden", String(!open));
  event.currentTarget.setAttribute("aria-expanded", String(open));
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
  const target = event.target.closest("[data-notification-id]");
  if (target) openNotification(target.dataset.notificationId);
});
document.getElementById("markAllNotificationsRead").addEventListener("click", () => markNotificationsRead());
document.addEventListener("click", () => {
  document.getElementById("userDropdown")?.classList.remove("open");
  closeNotifications();
});
document.getElementById("myProfileButton").addEventListener("click", () => {
  if (isSuperAdmin()) goTo("administracion");
  else if (currentUser) renderProfile(currentUser.id);
});
document.getElementById("logoutButton").addEventListener("click", async () => {
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
  activeChatChannelId = null;
  if (presenceChannel) db.removeChannel(presenceChannel);
  if (messageChannel) db.removeChannel(messageChannel);
  if (momentChannel) db.removeChannel(momentChannel);
  if (postChannel) db.removeChannel(postChannel);
  if (mediaLikesChannel) db.removeChannel(mediaLikesChannel);
  if (notificationsChannel) db.removeChannel(notificationsChannel);
  if (privateChannel) db.removeChannel(privateChannel);
  if (eventChannel) db.removeChannel(eventChannel);
  if (settingsChannel) db.removeChannel(settingsChannel);
  if (chatChannelsRealtime) db.removeChannel(chatChannelsRealtime);
  showLogin();
  renderMessages();
  renderNotifications();
});
document.getElementById("messageForm").addEventListener("submit", async event => {
  event.preventDefault();
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text && !pendingMessageFile) return;
  input.disabled = true;
  try {
    await sendMessage(text, pendingMessageFile);
    input.value = "";
    pendingMessageFile = null;
    document.getElementById("messageAttachment").value = "";
    document.getElementById("messageAttachmentPreview").hidden = true;
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
  const input = document.getElementById("privateMessageInput");
  const text = input.value.trim();
  if (!text && !pendingPrivateMessageFile) return;
  input.disabled = true;
  try {
    await sendPrivateMessage(text, pendingPrivateMessageFile);
    input.value = "";
    pendingPrivateMessageFile = null;
    document.getElementById("privateMessageAttachment").value = "";
    document.getElementById("privateMessageAttachmentPreview").hidden = true;
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
document.getElementById("privateMessageAttachment").addEventListener("change", event => {
  pendingPrivateMessageFile = event.target.files[0] || null;
  const preview = document.getElementById("privateMessageAttachmentPreview");
  if (!pendingPrivateMessageFile) {
    preview.hidden = true;
    return;
  }
  if (pendingPrivateMessageFile.size > 15 * 1024 * 1024) {
    pendingPrivateMessageFile = null;
    event.target.value = "";
    preview.hidden = true;
    return window.alert("El archivo supera el máximo de 15 MB.");
  }
  preview.innerHTML = `${escapeHtml(pendingPrivateMessageFile.name)} · ${formatFileSize(pendingPrivateMessageFile.size)} <button type="button" id="removePrivateMessageAttachment">Quitar</button>`;
  preview.hidden = false;
});
document.getElementById("privateMessageAttachmentPreview").addEventListener("click", event => {
  if (event.target.id !== "removePrivateMessageAttachment") return;
  pendingPrivateMessageFile = null;
  document.getElementById("privateMessageAttachment").value = "";
  event.currentTarget.hidden = true;
});
document.getElementById("addChatChannelButton").addEventListener("click", createChatChannel);
document.getElementById("messageAttachment").addEventListener("change", event => {
  pendingMessageFile = event.target.files[0] || null;
  const preview = document.getElementById("messageAttachmentPreview");
  if (!pendingMessageFile) {
    preview.hidden = true;
    return;
  }
  if (pendingMessageFile.size > 15 * 1024 * 1024) {
    event.target.value = "";
    pendingMessageFile = null;
    preview.hidden = false;
    preview.innerHTML = `<span>El archivo supera el máximo de 15 MB.</span>`;
    return;
  }
  preview.hidden = false;
  preview.innerHTML = `<span>Adjunto: <strong>${escapeHtml(pendingMessageFile.name)}</strong> · ${formatFileSize(pendingMessageFile.size)}</span><button type="button" id="clearMessageAttachment">Quitar</button>`;
  document.getElementById("clearMessageAttachment").addEventListener("click", () => {
    pendingMessageFile = null;
    document.getElementById("messageAttachment").value = "";
    preview.hidden = true;
  });
});
document.getElementById("addMomentButton").addEventListener("click", () => openMediaUploader("moment"));
document.getElementById("closeMediaUploader").addEventListener("click", closeMediaUploader);
document.getElementById("cancelMediaUploader").addEventListener("click", closeMediaUploader);
document.getElementById("mediaUploader").addEventListener("click", event => {
  if (event.target.id === "mediaUploader") closeMediaUploader();
});
document.getElementById("mediaUploadFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  const preview = document.getElementById("mediaUploadPreview");
  if (!file) {
    preview.innerHTML = "";
    resetMediaCropEditor();
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    event.target.value = "";
    document.getElementById("mediaUploadFeedback").textContent = "El archivo supera el máximo de 30 MB.";
    return;
  }
  document.getElementById("mediaUploadFeedback").textContent = "";
  if (file.type.startsWith("video/")) {
    resetMediaCropEditor();
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<video src="${url}" controls></video>`;
  } else {
    preview.innerHTML = "";
    try {
      await loadMediaCrop(file);
      document.getElementById("mediaUploader").classList.add("has-media");
    } catch (error) {
      document.getElementById("mediaUploadFeedback").textContent = error.message;
    }
  }
});
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
document.querySelectorAll("[data-editor-filter]").forEach(button => button.addEventListener("click", () => {
  mediaFilter = button.dataset.editorFilter;
  document.getElementById("mediaFilter").value = mediaFilter;
  document.querySelectorAll("[data-editor-filter]").forEach(item => item.classList.toggle("active", item === button));
  drawMediaCrop();
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
document.getElementById("mediaViewer").addEventListener("click", event => {
  if (event.target.id === "mediaViewer") closeMediaViewer();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && document.getElementById("mediaViewer").classList.contains("open")) closeMediaViewer();
});
function openGlobalSearch() {
  const search = document.getElementById("globalSearch");
  search.classList.add("open");
  search.setAttribute("aria-hidden", "false");
  document.getElementById("globalSearchInput").focus();
}
function closeGlobalSearch() {
  const search = document.getElementById("globalSearch");
  search.classList.remove("open");
  search.setAttribute("aria-hidden", "true");
}
document.getElementById("searchButton").addEventListener("click", event => {
  event.stopPropagation();
  openGlobalSearch();
});
document.getElementById("adminPanelButton")?.addEventListener("click", () => goTo("administracion"));
document.getElementById("closeSearchButton").addEventListener("click", closeGlobalSearch);
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
document.getElementById("addPublicationButton").addEventListener("click", () => openMediaUploader("post"));
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

const initialSection = location.hash.replace("#", "");
if (["inicio", "chat", "privados", "miembros", "contenido", "momentos", "publicaciones", "noticias", "calendario"].includes(initialSection)) goTo(initialSection);
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
