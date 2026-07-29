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
let onlineUsers = [];
let presenceChannel = null;
let messageChannel = null;
let momentChannel = null;
let postChannel = null;
let activeNewsCategory = "espana";
let pendingAvatarFile = null;
let removeAvatarRequested = false;
let pendingMessageFile = null;
let mediaUploadMode = "post";
let activeProfileId = null;

function escapeHtml(value = "") {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

function normalizeUsername(value = "") {
  return value.trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
}

function getMember(id) {
  return members.find(member => member.id === Number(id));
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
    perfil: "Perfil del miembro", momentos: "Momentos", noticias: "Noticias",
    administracion: "Administración"
  };
  pageTitle.textContent = titles[sectionId] || titles.inicio;
  sidebar.classList.remove("open");
  window.scrollTo({top: 0, behavior: "smooth"});
  history.replaceState(null, "", `#${sectionId}`);
  if (sectionId === "noticias") loadNews(false);
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
        ${canEdit ? `<button class="primary-button edit-profile-button" id="editProfileButton">Editar mi perfil</button>` : ""}
      </div>
    </article>
    <section class="profile-feed">
      <div class="profile-feed-heading">
        <div><span class="eyebrow">PUBLICACIONES</span><h3>${posts.length} ${posts.length === 1 ? "publicación" : "publicaciones"}</h3></div>
        ${canEdit ? `<button class="primary-button" id="addProfilePostButton" type="button">＋ Nueva publicación</button>` : ""}
      </div>
      <div class="profile-posts-grid">
        ${posts.length ? posts.map(post => renderMediaCard(post, canEdit, "post")).join("") :
          `<div class="empty-state profile-empty"><strong>Aún no hay publicaciones</strong><span>${canEdit ? "Comparte tu primera foto para empezar tu perfil." : `${escapeHtml(member.name)} todavía no ha publicado fotos.`}</span></div>`}
      </div>
    </section>`;
  document.getElementById("editProfileButton")?.addEventListener("click", openProfileEditor);
  document.getElementById("addProfilePostButton")?.addEventListener("click", () => openMediaUploader("post"));
  goTo("perfil");
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
  setChatEnabled(Boolean(currentUser));
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
      </div>${message.text ? `<p>${escapeHtml(message.text)}</p>` : ""}${attachment}</div>
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
  grid.innerHTML = moments.map(item => renderMediaCard(item, item.userId === currentAuthUser?.id, "moment")).join("");
}

function renderAdminPanel() {
  const summary = document.getElementById("adminSummary");
  const table = document.getElementById("adminUsersTable");
  if (!summary || !table || currentUser?.roleKey !== "admin") return;
  summary.innerHTML = `
    <div class="admin-stat-card"><span>USUARIOS</span><strong>${members.length}</strong><small>cuentas registradas</small></div>
    <div class="admin-stat-card"><span>ADMINISTRADORES</span><strong>${members.filter(item => item.roleKey === "admin").length}</strong><small>con acceso total</small></div>
    <div class="admin-stat-card"><span>EN LÍNEA</span><strong>${onlineUsers.length}</strong><small>presencia real ahora</small></div>`;
  table.innerHTML = members.map(user => `
    <tr><td><code>@${user.username}</code></td><td><div class="table-user">${getAvatar(user, "avatar small")}<strong>${escapeHtml(user.name)}</strong></div></td>
    <td><span class="role-chip ${user.roleKey}">${user.roleKey === "admin" ? "Administrador" : "Miembro"}</span></td>
    <td><span class="account-status ${onlineUsers.some(item => Number(item.legacy_id) === user.id) ? "" : "offline"}"><i></i>${onlineUsers.some(item => Number(item.legacy_id) === user.id) ? "En línea" : "Desconectado"}</span></td>
    <td>—</td></tr>`).join("");
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
  document.getElementById("sidebarUserRole").textContent = user.roleKey === "admin" ? "Administrador" : "Miembro";
  document.querySelectorAll(".admin-only").forEach(node => node.style.display = user.roleKey === "admin" ? "" : "none");
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
  if (backendReady && authUser) {
    await loadRemoteProfiles();
    await Promise.all([loadMessages(), loadMoments(), loadProfilePosts()]);
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
  const user = await profileForAuthUser(data.user);
  if (!user) {
    await db.auth.signOut();
    throw new Error("Esta cuenta todavía no tiene un perfil del club.");
  }
  await applyUserInterface(user, data.user);
}

async function profileForAuthUser(authUser) {
  const {data, error} = await db.from("profiles").select("*").eq("id", authUser.id).single();
  if (error) return null;
  return mergeRemoteProfile(data);
}

function mergeRemoteProfile(profile) {
  const member = getMember(profile.legacy_id);
  if (!member) return null;
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
  currentUser = getMember(currentUser.id);
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

function connectRealtime() {
  if (presenceChannel) db.removeChannel(presenceChannel);
  if (messageChannel) db.removeChannel(messageChannel);
  if (momentChannel) db.removeChannel(momentChannel);
  if (postChannel) db.removeChannel(postChannel);
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
        await presenceChannel.track({
          user_id: currentAuthUser.id,
          legacy_id: currentUser.id,
          name: currentUser.name,
          online_at: new Date().toISOString()
        });
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
  if (!item || item.userId !== currentAuthUser.id) return;
  const {error} = await db.from(table).delete().eq("id", item.id).eq("user_id", currentAuthUser.id);
  if (error) return;
  if (kind === "moment") await loadMoments();
  else await loadProfilePosts();
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
  const feed = activeNewsCategory === "espana" ? config.news?.espanaFeed : config.news?.mundoFeed;
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
    const items = payload.items.slice(0, 12).map(item => ({
      title: item.title, link: item.link, published: item.pubDate,
      source: extractNewsSource(item.title), image: item.thumbnail || item.enclosure?.link || ""
    }));
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
  document.getElementById("newsStatus").textContent = `Actualizado ahora · Fuente agregada: ${feedTitle}`;
  document.getElementById("newsGrid").innerHTML = items.map((item, index) => {
    const cleanTitle = item.title.replace(new RegExp(` - ${item.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
    return `<article class="news-card ${index === 0 ? "featured" : ""}">
      <div class="news-card-meta"><span>${escapeHtml(item.source)}</span><time>${formatNewsDate(item.published)}</time></div>
      <h3>${escapeHtml(cleanTitle)}</h3>
      <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">Leer en la fuente →</a>
    </article>`;
  }).join("");
}

function formatNewsDate(value) {
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
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
document.getElementById("myProfileButton").addEventListener("click", () => currentUser && renderProfile(currentUser.id));
document.getElementById("logoutButton").addEventListener("click", async () => {
  if (db) await db.auth.signOut();
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  currentUser = null;
  currentAuthUser = null;
  messages = [];
  moments = [];
  profilePosts = [];
  if (presenceChannel) db.removeChannel(presenceChannel);
  if (messageChannel) db.removeChannel(messageChannel);
  if (momentChannel) db.removeChannel(momentChannel);
  if (postChannel) db.removeChannel(postChannel);
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

applyStoredProfiles();
if (localStorage.getItem("bb-theme") === "light") document.body.classList.add("light");
renderFeatured();
renderMembers();
renderMoments();
renderActivity();
renderMessages();
renderPresence();
renderMoments();
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
if (["inicio", "chat", "miembros", "momentos", "noticias"].includes(initialSection)) goTo(initialSection);
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
