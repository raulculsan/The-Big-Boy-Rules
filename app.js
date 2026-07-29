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
const pageTitle = document.getElementById("pageTitle");
const sections = [...document.querySelectorAll(".page-section")];
const navLinks = [...document.querySelectorAll(".nav-link")];
const sidebar = document.getElementById("sidebar");

let currentUser = null;
let currentAuthUser = null;
let messages = [];
let moments = [];
let profilePosts = [];
let privateMessages = [];
let groupEvents = [];
let newsItems = [];
let siteSettings = {};
let onlineUsers = [];
let presenceChannel = null;
let messageChannel = null;
let momentChannel = null;
let postChannel = null;
let privateChannel = null;
let eventChannel = null;
let settingsChannel = null;
let activeNewsCategory = "deportes";
let pendingAvatarFile = null;
let removeAvatarRequested = false;
let pendingMessageFile = null;
let mediaUploadMode = "post";
let activeProfileId = null;
let activePrivateMemberId = null;
let calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function escapeHtml(value = "") {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
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
  return members.find(member => member.id === Number(id));
}

function getMemberByAuthId(id) {
  return members.find(member => member.authId === id);
}

function getAvatar(member, className = "avatar") {
  if (member?.avatarUrl) {
    return `<div class="${className} has-image"><img src="${escapeHtml(member.avatarUrl)}" alt="Foto de ${escapeHtml(member.name)}"></div>`;
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
    tags: member.tags, avatarUrl: member.avatarUrl
  };
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(stored));
}

function goTo(sectionId) {
  sections.forEach(section => section.classList.toggle("active", section.id === sectionId));
  navLinks.forEach(link => link.classList.toggle("active", link.dataset.section === sectionId));
  const titles = {
    inicio: "The Big Boy Rules", chat: "Chat del grupo", miembros: "Miembros",
    privados: "Mensajes privados", perfil: "Perfil del miembro", momentos: "Momentos",
    noticias: "Noticias", calendario: "Calendario", administracion: "Administración"
  };
  pageTitle.textContent = titles[sectionId] || titles.inicio;
  sidebar.classList.remove("open");
  window.scrollTo({top: 0, behavior: "smooth"});
  history.replaceState(null, "", `#${sectionId}`);
  if (sectionId === "noticias") loadNews(false);
  if (sectionId === "calendario") renderCalendar();
}

function renderFeatured() {
  document.getElementById("featuredMembers").innerHTML = members.slice(0, 4).map(member => `
    <button class="member-mini-card" data-profile="${member.id}">
      ${getAvatar(member)}
      <strong>${escapeHtml(member.name)}</strong>
      <small>${escapeHtml(member.nickname)}</small>
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
      data-number="${String(member.id).padStart(2, "0")}">
      <span class="member-role">${member.role}</span>
      <h3>${escapeHtml(member.name)}</h3>
      <p>${escapeHtml(member.nickname)}</p>
      <button data-profile="${member.id}">Ver perfil →</button>
    </article>`).join("");
}

function renderProfile(memberId) {
  const member = getMember(memberId);
  if (!member) return;
  activeProfileId = member.id;
  const canEdit = currentUser?.id === member.id;
  const canDeletePosts = canEdit || isSuperAdmin();
  const posts = profilePosts.filter(post => post.member === member.id);
  document.getElementById("profileContent").innerHTML = `
    <article class="profile-hero">
      <div class="profile-visual ${member.avatarUrl ? "has-photo" : ""}"
        style="--profile-bg:${member.avatarUrl ? `url('${escapeHtml(member.avatarUrl)}')` : member.bg}"></div>
      <div class="profile-info">
        <span class="profile-number">BIG BOY ${String(member.id).padStart(2, "0")}</span>
        <h2>${escapeHtml(member.name)}</h2>
        <div class="profile-nickname">${escapeHtml(member.nickname.toUpperCase())}</div>
        <p>${escapeHtml(member.bio)}</p>
        <div class="profile-tags">${member.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="profile-actions">
          ${canEdit
            ? `<button class="primary-button edit-profile-button" id="editProfileButton">Editar mi perfil</button>`
            : `<button class="primary-button edit-profile-button" data-private-member="${member.id}">✉ Enviar mensaje</button>`}
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
  document.getElementById("editProfileButton")?.addEventListener("click", openProfileEditor);
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

function renderMediaCard(item, canDelete, kind) {
  const member = getMember(item.member);
  const media = item.mediaType === "video"
    ? `<video src="${escapeHtml(item.mediaUrl)}" controls preload="metadata"></video>`
    : `<img src="${escapeHtml(item.mediaUrl)}" alt="${escapeHtml(item.caption || `Publicación de ${member?.name || "miembro"}`)}" loading="lazy">`;
  return `<article class="${kind === "moment" ? "story-card" : "profile-post-card"}">
    <div class="media-frame">${media}</div>
    <div class="media-card-info">
      ${kind === "moment" ? `<button class="media-author" data-profile="${item.member}">${getAvatar(member, "avatar tiny")}<strong>${escapeHtml(member?.name || "Miembro")}</strong></button>` : ""}
      ${item.caption ? `<p>${escapeHtml(item.caption)}</p>` : ""}
      <time datetime="${escapeHtml(item.createdAt)}">${kind === "moment" ? `Caduca ${formatExpiry(item.expiresAt)}` : formatRelativeTime(item.createdAt)}</time>
      ${canDelete ? `<button class="delete-media-button" data-delete-${kind}="${item.id}" type="button">Eliminar</button>` : ""}
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
  if (!messages.length) {
    container.innerHTML = `<div class="empty-state"><strong>Aún no hay mensajes</strong><span>Sé la primera persona en escribir al grupo.</span></div>`;
    return;
  }
  container.innerHTML = messages.map(message => {
    const member = getMember(message.member);
    const attachment = message.attachmentUrl ? renderMessageAttachment(message) : "";
    return `<div class="message">
      ${getAvatar(member)}
      <div><div class="message-head">
        <button class="message-author" data-profile="${message.member}">${escapeHtml(member?.name || "Miembro")}</button>
        <time datetime="${escapeHtml(message.createdAt)}">${formatMessageDate(message.createdAt)}</time>
      </div>${message.text ? `<p>${escapeHtml(message.text)}</p>` : ""}${attachment}
      ${isSuperAdmin() ? `<button class="delete-media-button" data-delete-message="${message.id}" type="button">Eliminar mensaje</button>` : ""}</div>
    </div>`;
  }).join("");
  container.scrollTop = container.scrollHeight;
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
  if (message.attachmentType?.startsWith("image/")) {
    return `<a class="message-image" href="${escapeHtml(message.attachmentUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(message.attachmentUrl)}" alt="${escapeHtml(message.attachmentName || "Imagen adjunta")}" loading="lazy"></a>`;
  }
  return `<a class="message-file" href="${escapeHtml(message.attachmentUrl)}" target="_blank" rel="noopener" download>
    <span>↧</span><div><strong>${escapeHtml(message.attachmentName || "Archivo adjunto")}</strong><small>${formatFileSize(message.attachmentSize)}</small></div>
  </a>`;
}

function renderMoments() {
  const grid = document.getElementById("momentsGrid");
  const status = document.getElementById("momentsStatus");
  status.textContent = moments.length ? `${moments.length} ${moments.length === 1 ? "historia activa" : "historias activas"}` : "";
  if (!moments.length) {
    grid.innerHTML = `<div class="empty-state moments-empty"><strong>Todavía no hay momentos</strong><span>Sé la primera persona en compartir una historia con el grupo.</span></div>`;
    return;
  }
  grid.innerHTML = moments.map(item => renderMediaCard(item, item.userId === currentAuthUser?.id || isSuperAdmin(), "moment")).join("");
}

function renderPrivateContacts() {
  const panel = document.getElementById("privateContacts");
  if (!currentUser) return;
  panel.innerHTML = members.filter(member => member.id !== currentUser.id).map(member => {
    const conversation = privateMessages.filter(message =>
      [message.senderId, message.recipientId].includes(member.authId));
    const latest = conversation.at(-1);
    return `<button class="private-contact ${activePrivateMemberId === member.id ? "active" : ""}" data-private-member="${member.id}">
      ${getAvatar(member)}
      <span><strong>${escapeHtml(member.name)}</strong><small>${latest ? escapeHtml(latest.body) : "Iniciar conversación"}</small></span>
    </button>`;
  }).join("");
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
  if (!member) {
    document.getElementById("privateChatHeader").innerHTML = `<div><span class="eyebrow">MENSAJE DIRECTO</span><h3>Elige un miembro</h3></div>`;
    container.innerHTML = `<div class="empty-state">Selecciona un miembro para comenzar una conversación privada.</div>`;
    input.disabled = true;
    submit.disabled = true;
    return;
  }
  document.getElementById("privateChatHeader").innerHTML = `<div class="private-chat-person">${getAvatar(member, "avatar small")}<div><span class="eyebrow">MENSAJE DIRECTO</span><h3>${escapeHtml(member.name)}</h3></div></div><button class="text-button" data-profile="${member.id}">Ver perfil →</button>`;
  const items = privateMessages.filter(message =>
    (message.senderId === currentAuthUser?.id && message.recipientId === member.authId)
    || (message.senderId === member.authId && message.recipientId === currentAuthUser?.id));
  container.innerHTML = items.length ? items.map(message => {
    const sender = getMemberByAuthId(message.senderId);
    const own = message.senderId === currentAuthUser?.id;
    return `<div class="message private-message ${own ? "own" : ""}">
      ${getAvatar(sender)}
      <div><div class="message-head"><strong>${escapeHtml(sender?.name || "Miembro")}</strong><time>${formatMessageDate(message.createdAt)}</time></div><p>${escapeHtml(message.body)}</p></div>
    </div>`;
  }).join("") : `<div class="empty-state"><strong>Sin mensajes todavía</strong><span>Esta conversación es privada entre ${escapeHtml(currentUser.name)} y ${escapeHtml(member.name)}.</span></div>`;
  input.disabled = false;
  submit.disabled = false;
  container.scrollTop = container.scrollHeight;
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  document.getElementById("calendarMonthTitle").textContent = calendarDate.toLocaleDateString("es-ES", {month: "long", year: "numeric"});
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(new Date());
  let cells = ["L", "M", "X", "J", "V", "S", "D"].map(day => `<div class="calendar-weekday">${day}</div>`).join("");
  cells += Array.from({length: firstWeekday}, () => `<div class="calendar-day outside"></div>`).join("");
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(year, month, day);
    const events = groupEvents.filter(event => dateKey(new Date(event.startsAt)) === dateKey(date));
    cells += `<div class="calendar-day ${dateKey(date) === todayKey ? "today" : ""}">
      <span>${day}</span>${events.slice(0, 3).map(event => `<button data-event-id="${event.id}" title="${escapeHtml(event.title)}">${escapeHtml(event.title)}</button>`).join("")}
      ${events.length > 3 ? `<small>+${events.length - 3} más</small>` : ""}
    </div>`;
  }
  document.getElementById("calendarGrid").innerHTML = cells;
  const monthEvents = groupEvents.filter(event => {
    const date = new Date(event.startsAt);
    return date.getFullYear() === year && date.getMonth() === month;
  });
  document.getElementById("calendarEventList").innerHTML = monthEvents.length ? monthEvents.map(event => `
    <article class="calendar-event-card">
      <time>${formatEventDate(event.startsAt)}</time><h4>${escapeHtml(event.title)}</h4>
      ${event.location ? `<p>⌖ ${escapeHtml(event.location)}</p>` : ""}
      ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
      ${canManageSite() ? `<button class="text-button" data-event-id="${event.id}">Editar</button>` : ""}
    </article>`).join("") : `<div class="empty-state compact">No hay eventos este mes.</div>`;
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
    results.push({type: "Publicación", title: post.caption || "Foto", detail: getMember(post.member)?.name || "", profile: post.member});
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
    <td>—</td><td>${isSuperAdmin() && user.authId ? `<button class="text-button danger" type="button" data-delete-user="${user.authId}" data-delete-user-name="${escapeHtml(user.name)}">Eliminar</button>` : "—"}</td></tr>`).join("");
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
    await Promise.all([loadMessages(), loadMoments(), loadProfilePosts(), loadPrivateMessages(), loadGroupEvents(), loadSiteSettings()]);
    connectRealtime();
  } else {
    onlineUsers = [{legacy_id: user.id, name: user.name}];
    renderPresence();
    renderAdminPanel();
  }
}

function showLogin() {
  document.body.classList.remove("authenticated");
  document.getElementById("loginScreen")?.classList.remove("login-hidden");
  document.getElementById("userDropdown")?.classList.remove("open");
  onlineUsers = [];
  renderPresence();
  goTo("inicio");
}

async function login(username, password, remember) {
  if (!backendReady) {
    const user = members.find(item => normalizeUsername(item.username) === normalizeUsername(username) && item.password === password);
    if (!user) throw new Error("Usuario o contraseña incorrectos.");
    saveLocalSession(user, remember);
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
  await applyUserInterface(user, data.user);
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
      roleKey: profile.role, role: "CONTROL TOTAL", bio: "", tags: [], avatarUrl: "",
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
    .select("id,user_id,legacy_id,body,attachment_url,attachment_name,attachment_type,attachment_size,created_at")
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
    id: item.id, userId: item.user_id, member: item.legacy_id, text: item.body,
    attachmentUrl: item.attachment_url, attachmentName: item.attachment_name,
    attachmentType: item.attachment_type, attachmentSize: item.attachment_size,
    createdAt: item.created_at
  };
}

function mapMedia(item) {
  return {
    id: item.id, userId: item.user_id, member: item.legacy_id, caption: item.caption,
    mediaUrl: item.media_url, mediaType: item.media_type, createdAt: item.created_at,
    expiresAt: item.expires_at
  };
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
  renderMoments();
}

async function loadProfilePosts() {
  const {data, error} = await db.from("profile_posts").select("*").order("created_at", {ascending: false});
  profilePosts = error ? [] : data.map(mapMedia);
  if (activeProfileId) renderProfile(activeProfileId);
}

async function loadPrivateMessages() {
  const {data, error} = await db.from("private_messages").select("*").order("created_at").limit(500);
  privateMessages = error ? [] : data.map(item => ({
    id: item.id, senderId: item.sender_id, recipientId: item.recipient_id,
    body: item.body, createdAt: item.created_at
  }));
  renderPrivateContacts();
  renderPrivateConversation();
}

async function loadGroupEvents() {
  const {data, error} = await db.from("group_events").select("*").order("starts_at");
  groupEvents = error ? [] : data.map(item => ({
    id: item.id, title: item.title, description: item.description, startsAt: item.starts_at,
    endsAt: item.ends_at, location: item.location, createdBy: item.created_by
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
    .on("postgres_changes", {event: "INSERT", schema: "public", table: "messages"}, payload => {
      const item = payload.new;
      if (messages.some(message => message.id === item.id)) return;
      messages.push(mapMessage(item));
      renderMessages();
      renderActivity();
    }).subscribe();
  momentChannel = db.channel("moments-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "moments"}, () => loadMoments())
    .subscribe();
  postChannel = db.channel("profile-posts-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "profile_posts"}, () => loadProfilePosts())
    .subscribe();
  privateChannel = db.channel(`private-messages-${currentAuthUser.id}`)
    .on("postgres_changes", {event: "INSERT", schema: "public", table: "private_messages"}, () => loadPrivateMessages())
    .subscribe();
  eventChannel = db.channel("group-events-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "group_events"}, () => loadGroupEvents())
    .subscribe();
  settingsChannel = db.channel("site-settings-live")
    .on("postgres_changes", {event: "*", schema: "public", table: "site_settings"}, () => loadSiteSettings())
    .subscribe();
}

async function uploadGroupMedia(file, folder) {
  if (file.size > 15 * 1024 * 1024) throw new Error("El archivo supera el máximo de 15 MB.");
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
    user_id: currentAuthUser.id, legacy_id: currentUser.id, body: text,
    attachment_url: attachmentUrl, attachment_name: file?.name || null,
    attachment_type: file?.type || null, attachment_size: file?.size || null
  });
  if (error) throw error;
}

async function sendPrivateMessage(text) {
  const recipient = getMember(activePrivateMemberId);
  if (!recipient?.authId || !currentAuthUser) throw new Error("No se ha seleccionado un destinatario.");
  const {error} = await db.from("private_messages").insert({
    sender_id: currentAuthUser.id, recipient_id: recipient.authId, body: text
  });
  if (error) throw error;
}

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function openEventEditor(eventId = null) {
  if (!canManageSite()) return;
  const event = groupEvents.find(item => String(item.id) === String(eventId));
  document.getElementById("eventEditorTitle").textContent = event ? "Editar evento" : "Nuevo evento";
  document.getElementById("eventId").value = event?.id || "";
  document.getElementById("eventTitle").value = event?.title || "";
  document.getElementById("eventDescription").value = event?.description || "";
  document.getElementById("eventStartsAt").value = toLocalDateTime(event?.startsAt || new Date(Date.now() + 3600000));
  document.getElementById("eventEndsAt").value = toLocalDateTime(event?.endsAt);
  document.getElementById("eventLocation").value = event?.location || "";
  document.getElementById("eventFeedback").textContent = "";
  document.getElementById("deleteEventButton").hidden = !event;
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
    const values = {
      title: document.getElementById("eventTitle").value.trim(),
      description: document.getElementById("eventDescription").value.trim(),
      starts_at: new Date(document.getElementById("eventStartsAt").value).toISOString(),
      ends_at: document.getElementById("eventEndsAt").value ? new Date(document.getElementById("eventEndsAt").value).toISOString() : null,
      location: document.getElementById("eventLocation").value.trim(),
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
  if (!id || !canManageSite()) return;
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

function openProfileEditor() {
  if (!currentUser) return;
  pendingAvatarFile = null;
  removeAvatarRequested = false;
  document.getElementById("profileAvatar").value = "";
  document.getElementById("profileName").value = currentUser.name;
  document.getElementById("profileNickname").value = currentUser.nickname;
  document.getElementById("profileBio").value = currentUser.bio;
  document.getElementById("profileTags").value = currentUser.tags.join(", ");
  document.getElementById("bioCount").textContent = currentUser.bio.length;
  document.getElementById("profileFeedback").textContent = "";
  const preview = document.getElementById("avatarPreview");
  preview.classList.toggle("has-image", Boolean(currentUser.avatarUrl));
  preview.innerHTML = currentUser.avatarUrl ? `<img src="${escapeHtml(currentUser.avatarUrl)}" alt="">` : currentUser.name.charAt(0);
  const modal = document.getElementById("profileEditor");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeProfileEditor() {
  const modal = document.getElementById("profileEditor");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

async function saveProfile(form) {
  const feedback = document.getElementById("profileFeedback");
  const submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  feedback.textContent = "Guardando…";
  try {
    let avatarUrl = currentUser.avatarUrl;
    if (removeAvatarRequested) {
      if (backendReady && currentAuthUser) {
        const {data} = await db.storage.from("avatars").list(currentAuthUser.id);
        if (data?.length) {
          await db.storage.from("avatars").remove(data.map(item => `${currentAuthUser.id}/${item.name}`));
        }
      }
      avatarUrl = "";
    } else if (pendingAvatarFile) {
      if (pendingAvatarFile.size > 3 * 1024 * 1024) throw new Error("La imagen supera el máximo de 3 MB.");
      if (backendReady) {
        const extension = pendingAvatarFile.name.split(".").pop().toLowerCase();
        const path = `${currentAuthUser.id}/avatar.${extension}`;
        const {error} = await db.storage.from("avatars").upload(path, pendingAvatarFile, {upsert: true, contentType: pendingAvatarFile.type});
        if (error) throw error;
        avatarUrl = `${db.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
      } else {
        avatarUrl = await fileToDataUrl(pendingAvatarFile);
      }
    }
    const updates = {
      name: document.getElementById("profileName").value.trim(),
      nickname: document.getElementById("profileNickname").value.trim(),
      bio: document.getElementById("profileBio").value.trim(),
      tags: document.getElementById("profileTags").value.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 6),
      avatarUrl
    };
    if (backendReady) {
      const {error} = await db.from("profiles").update({
        display_name: updates.name, nickname: updates.nickname, bio: updates.bio,
        tags: updates.tags, avatar_url: updates.avatarUrl, updated_at: new Date().toISOString()
      }).eq("id", currentAuthUser.id);
      if (error) throw error;
    }
    Object.assign(currentUser, updates);
    if (!backendReady) persistLocalProfile(currentUser);
    refreshProfileSurfaces();
    renderProfile(currentUser.id);
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
    ? "La historia desaparecerá en 24 horas · máximo 15 MB"
    : "Se mostrará de forma permanente en tu perfil · máximo 15 MB";
  document.getElementById("mediaUploadFile").value = "";
  document.getElementById("mediaUploadCaption").value = "";
  document.getElementById("mediaUploadPreview").innerHTML = "";
  document.getElementById("mediaUploadFeedback").textContent = "";
  const modal = document.getElementById("mediaUploader");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeMediaUploader() {
  const modal = document.getElementById("mediaUploader");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
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
    const mediaUrl = await uploadGroupMedia(file, mediaUploadMode === "moment" ? "moments" : "posts");
    const record = {
      user_id: currentAuthUser.id, legacy_id: currentUser.id,
      caption: document.getElementById("mediaUploadCaption").value.trim(),
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
      renderProfile(currentUser.id);
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
  if (!item || (item.userId !== currentAuthUser.id && !isSuperAdmin())) return;
  let query = db.from(table).delete().eq("id", item.id);
  if (!isSuperAdmin()) query = query.eq("user_id", currentAuthUser.id);
  const {error} = await query;
  if (error) return;
  if (kind === "moment") await loadMoments();
  else await loadProfilePosts();
}

async function deleteGroupMessage(id) {
  if (!isSuperAdmin() || !backendReady) return;
  const {error} = await db.from("messages").delete().eq("id", id);
  if (!error) await loadMessages();
}

async function invokeUserAdmin(action, values) {
  if (!isSuperAdmin() || !db) throw new Error("No tienes permiso para administrar cuentas.");
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
  if (!window.confirm(`¿Eliminar definitivamente la cuenta de ${name}?`)) return;
  try {
    await invokeUserAdmin("delete", {userId: authId});
    members = members.filter(member => member.authId !== authId);
    await loadRemoteProfiles();
  } catch (error) {
    window.alert(error.message || "No se pudo eliminar la cuenta.");
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
  if (!force) {
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.savedAt < 10 * 60 * 1000) {
        renderNews(cached.items, cached.feedTitle);
        return;
      }
    } catch {}
  }
  grid.innerHTML = "";
  status.textContent = "Cargando titulares desde fuentes reales…";
  const feeds = {
    deportes: config.news?.deportesFeed,
    espana: config.news?.espanaFeed,
    mundo: config.news?.mundoFeed
  };
  const feed = feeds[activeNewsCategory];
  if (!feed) {
    status.textContent = "No hay una fuente configurada para esta categoría.";
    return;
  }
  try {
    const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`;
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("El servicio de noticias no responde.");
    const payload = await response.json();
    if (payload.status !== "ok" || !payload.items?.length) throw new Error(payload.message || "No se recibieron titulares.");
    const items = payload.items.map(item => ({
      title: item.title, link: item.link, published: item.pubDate,
      source: extractNewsSource(item.title), image: item.thumbnail || item.enclosure?.link || ""
    })).sort((a, b) => newsTimestamp(b.published) - newsTimestamp(a.published)).slice(0, 12);
    sessionStorage.setItem(cacheKey, JSON.stringify({savedAt: Date.now(), items, feedTitle: payload.feed?.title || "Google News"}));
    renderNews(items, payload.feed?.title || "Google News");
  } catch (error) {
    status.textContent = `No se pudieron actualizar las noticias: ${error.message}`;
    grid.innerHTML = `<div class="empty-state"><strong>Sin titulares disponibles</strong><span>Inténtalo de nuevo en unos minutos.</span></div>`;
  }
}

function extractNewsSource(title) {
  const parts = title.split(" - ");
  return parts.length > 1 ? parts.pop() : "Medio de comunicación";
}

function renderNews(items, feedTitle) {
  const sortedItems = [...items].sort((a, b) => newsTimestamp(b.published) - newsTimestamp(a.published));
  newsItems = sortedItems;
  document.getElementById("newsStatus").textContent = `Actualizado ahora · Fuente agregada: ${feedTitle}`;
  document.getElementById("newsGrid").innerHTML = sortedItems.map((item, index) => {
    const cleanTitle = item.title.replace(new RegExp(` - ${item.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
    const publishedTimestamp = newsTimestamp(item.published);
    const publishedDateTime = publishedTimestamp ? new Date(publishedTimestamp).toISOString() : "";
    return `<article class="news-card ${index === 0 ? "featured" : ""}">
      <div class="news-card-meta"><span>${escapeHtml(item.source)}</span><time${publishedDateTime ? ` datetime="${publishedDateTime}"` : ""}>${formatNewsDate(item.published)}</time></div>
      <h3>${escapeHtml(cleanTitle)}</h3>
      <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">Leer en la fuente →</a>
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
  const goTarget = event.target.closest("[data-go]");
  if (goTarget) goTo(goTarget.dataset.go);
  const profileTarget = event.target.closest("[data-profile]");
  if (profileTarget) renderProfile(profileTarget.dataset.profile);
  const deleteMoment = event.target.closest("[data-delete-moment]");
  if (deleteMoment) deleteMedia("moment", deleteMoment.dataset.deleteMoment);
  const deletePost = event.target.closest("[data-delete-post]");
  if (deletePost) deleteMedia("post", deletePost.dataset.deletePost);
  const deleteMessage = event.target.closest("[data-delete-message]");
  if (deleteMessage) deleteGroupMessage(deleteMessage.dataset.deleteMessage);
  const deleteUser = event.target.closest("[data-delete-user]");
  if (deleteUser) deleteClubUser(deleteUser.dataset.deleteUser, deleteUser.dataset.deleteUserName);
  const privateTarget = event.target.closest("[data-private-member]");
  if (privateTarget) openPrivateConversation(privateTarget.dataset.privateMember);
  const eventTarget = event.target.closest("[data-event-id]");
  if (eventTarget) openEventEditor(eventTarget.dataset.eventId);
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
document.getElementById("userMenuButton").addEventListener("click", event => {
  event.stopPropagation();
  document.getElementById("userDropdown").classList.toggle("open");
});
document.addEventListener("click", () => document.getElementById("userDropdown")?.classList.remove("open"));
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
  privateMessages = [];
  groupEvents = [];
  if (presenceChannel) db.removeChannel(presenceChannel);
  if (messageChannel) db.removeChannel(messageChannel);
  if (momentChannel) db.removeChannel(momentChannel);
  if (postChannel) db.removeChannel(postChannel);
  if (privateChannel) db.removeChannel(privateChannel);
  if (eventChannel) db.removeChannel(eventChannel);
  showLogin();
  renderMessages();
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
  if (!text) return;
  input.disabled = true;
  try {
    await sendPrivateMessage(text);
    input.value = "";
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
  removeAvatarRequested = false;
  const previewUrl = await fileToDataUrl(pendingAvatarFile);
  const preview = document.getElementById("avatarPreview");
  preview.classList.add("has-image");
  preview.innerHTML = `<img src="${previewUrl}" alt="Vista previa">`;
});
document.getElementById("removeAvatarButton").addEventListener("click", () => {
  removeAvatarRequested = true;
  pendingAvatarFile = null;
  document.getElementById("profileAvatar").value = "";
  const preview = document.getElementById("avatarPreview");
  preview.classList.remove("has-image");
  preview.textContent = currentUser?.name?.charAt(0) || "U";
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
document.getElementById("attachMessageButton").addEventListener("click", () => document.getElementById("messageAttachment").click());
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
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    event.target.value = "";
    document.getElementById("mediaUploadFeedback").textContent = "El archivo supera el máximo de 15 MB.";
    return;
  }
  const url = URL.createObjectURL(file);
  preview.innerHTML = file.type.startsWith("video/")
    ? `<video src="${url}" controls></video>`
    : `<img src="${url}" alt="Vista previa">`;
});
document.getElementById("mediaUploadForm").addEventListener("submit", event => {
  event.preventDefault();
  publishMedia(event.currentTarget);
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
document.getElementById("closeSearchButton").addEventListener("click", closeGlobalSearch);
document.getElementById("globalSearchInput").addEventListener("input", event => performSearch(event.target.value));
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeGlobalSearch();
    closeEventEditor();
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
document.getElementById("closeEventEditor").addEventListener("click", closeEventEditor);
document.getElementById("cancelEventEditor").addEventListener("click", closeEventEditor);
document.getElementById("eventEditor").addEventListener("click", event => {
  if (event.target.id === "eventEditor") closeEventEditor();
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
renderMoments();
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
if (["inicio", "chat", "privados", "miembros", "momentos", "noticias", "calendario"].includes(initialSection)) goTo(initialSection);
window.addEventListener("load", () => setTimeout(() => document.getElementById("pageLoader")?.classList.add("hidden"), 450));
const cursorGlow = document.getElementById("cursorGlow");
document.addEventListener("pointermove", event => {
  if (!cursorGlow) return;
  cursorGlow.style.left = `${event.clientX}px`;
  cursorGlow.style.top = `${event.clientY}px`;
});
const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) {
    entry.target.classList.add("visible");
    revealObserver.unobserve(entry.target);
  }
}), {threshold: 0.12});
document.querySelectorAll(".reveal").forEach(element => revealObserver.observe(element));
