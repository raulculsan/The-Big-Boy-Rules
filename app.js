const members = [
  {
    id: 1,
    username: "kike",
    password: "bigboy2026",
    name: "Kike",
    nickname: "The Administrator",
    role: "ADMINISTRADOR",
    roleKey: "admin",
    status: "Dirigiendo el club",
    bio: "Administrador de The Big Boy Rules. Gestiona el acceso, organiza la comunidad y mantiene el orden dentro del grupo.",
    tags: ["Administrador", "Fundador", "Control del club"],
    stats: ["412", "Mensajes"],
    bg: "linear-gradient(145deg, #4a3210, #0c0c0e 68%)"
  },
  {
    id: 2,
    username: "lizzy",
    password: "bigboy2026",
    name: "Lizzy",
    nickname: "The Golden Voice",
    role: "MIEMBRO",
    roleKey: "member",
    status: "Conectada",
    bio: "Miembro de The Big Boy Rules. Su espacio personal reúne sus mejores momentos, mensajes y recuerdos dentro del grupo.",
    tags: ["Miembro", "Momentos", "Comunidad"],
    stats: ["238", "Mensajes"],
    bg: "linear-gradient(145deg, #38233d, #0c0c0e 68%)"
  },
  {
    id: 3,
    username: "raul",
    password: "bigboy2026",
    name: "Raúl",
    nickname: "The Insider",
    role: "MIEMBRO",
    roleKey: "member",
    status: "En línea",
    bio: "Miembro de The Big Boy Rules. Tecnología, fútbol, música y las historias que terminan entrando en el archivo del grupo.",
    tags: ["Tecnología", "Real Madrid", "Música"],
    stats: ["348", "Mensajes"],
    bg: "linear-gradient(145deg, #2d2616, #0c0c0e 68%)"
  },
  {
    id: 4,
    username: "mario",
    password: "bigboy2026",
    name: "Mario",
    nickname: "The Wild Card",
    role: "MIEMBRO",
    roleKey: "member",
    status: "Preparando el próximo plan",
    bio: "Miembro del club y especialista en convertir cualquier plan sencillo en una historia para recordar.",
    tags: ["Planes", "Humor", "Lealtad"],
    stats: ["305", "Mensajes"],
    bg: "linear-gradient(145deg, #321b20, #0c0c0e 68%)"
  },
  {
    id: 5,
    username: "miguelangel",
    password: "bigboy2026",
    name: "Miguel Ángel",
    nickname: "The Strategist",
    role: "MIEMBRO",
    roleKey: "member",
    status: "Organizando ideas",
    bio: "Miembro de The Big Boy Rules. Siempre pensando en el siguiente movimiento y en cómo mejorar el próximo plan.",
    tags: ["Estrategia", "Planes", "Equipo"],
    stats: ["267", "Mensajes"],
    bg: "linear-gradient(145deg, #162d32, #0c0c0e 68%)"
  },
  {
    id: 6,
    username: "almudena",
    password: "bigboy2026",
    name: "Almudena",
    nickname: "The Diplomat",
    role: "MIEMBRO",
    roleKey: "member",
    status: "Manteniendo la paz",
    bio: "Miembro del club y punto de equilibrio del grupo. Su perfil conserva recuerdos, frases y momentos destacados.",
    tags: ["Calma", "Consejos", "Comunidad"],
    stats: ["214", "Mensajes"],
    bg: "linear-gradient(145deg, #2b243d, #0c0c0e 68%)"
  },
  {
    id: 7,
    username: "carlos",
    password: "bigboy2026",
    name: "Carlos",
    nickname: "The Machine",
    role: "MIEMBRO",
    roleKey: "member",
    status: "Siempre activo",
    bio: "Miembro de The Big Boy Rules. Energía constante, disponibilidad para cualquier plan y máxima participación.",
    tags: ["Energía", "Deporte", "Planes"],
    stats: ["289", "Mensajes"],
    bg: "linear-gradient(145deg, #303219, #0c0c0e 68%)"
  },
  {
    id: 8,
    username: "albertovelasco",
    password: "bigboy2026",
    name: "Alberto Velasco",
    nickname: "The Legend",
    role: "MIEMBRO",
    roleKey: "member",
    status: "Creando otra anécdota",
    bio: "Miembro del club con un archivo creciente de historias, frases memorables y momentos legendarios.",
    tags: ["Historias", "Humor", "Noche"],
    stats: ["331", "Mensajes"],
    bg: "linear-gradient(145deg, #3b2c14, #0c0c0e 68%)"
  },
  {
    id: 9,
    username: "caonaboalbero",
    password: "bigboy2026",
    name: "Caonabo Albero",
    nickname: "The Original",
    role: "MIEMBRO",
    roleKey: "member",
    status: "Dentro del círculo",
    bio: "Miembro de The Big Boy Rules. Personalidad propia, presencia inconfundible y parte esencial de la identidad del grupo.",
    tags: ["Original", "Lealtad", "Grupo"],
    stats: ["245", "Mensajes"],
    bg: "linear-gradient(145deg, #173225, #0c0c0e 68%)"
  }
];

const defaultMessages = [
  {member: 8, text: "Entonces, ¿queda confirmado lo del sábado o seguimos fingiendo que sabemos organizarnos?", time: "21:12"},
  {member: 4, text: "Yo ya he dicho que sí. El problema sois los que contestáis tres días después.", time: "21:14"},
  {member: 1, text: "Sábado confirmado. Luego subimos las fotos buenas a Momentos y las demás se quedan clasificadas.", time: "21:16"},
  {member: 3, text: "Perfecto. Esta vez no llego tarde… probablemente.", time: "21:18"}
];

const moments = [
  ["Noche de inauguración", "Donde empezó todo.", "linear-gradient(145deg,#4a2d10,#111)"],
  ["El viaje improvisado", "24 horas. Cero planificación.", "linear-gradient(145deg,#17334a,#111)"],
  ["La foto oficial", "Ocho miembros, una sola regla.", "linear-gradient(145deg,#353535,#111)"],
  ["Plan de domingo", "Terminó siendo lunes.", "linear-gradient(145deg,#44202f,#111)"],
  ["Entrada del nuevo miembro", "La ceremonia Big Boy.", "linear-gradient(145deg,#3d3212,#111)"],
  ["Archivo de memes", "Material altamente clasificado.", "linear-gradient(145deg,#18342a,#111)"]
];

const pageTitle = document.getElementById("pageTitle");
const sections = [...document.querySelectorAll(".page-section")];
const navLinks = [...document.querySelectorAll(".nav-link")];
const sidebar = document.getElementById("sidebar");

function getMember(id) {
  return members.find(member => member.id === Number(id));
}

function goTo(sectionId) {
  sections.forEach(section => section.classList.toggle("active", section.id === sectionId));
  navLinks.forEach(link => link.classList.toggle("active", link.dataset.section === sectionId));
  const titles = {
    inicio: "The Big Boy Rules",
    chat: "Chat del grupo",
    miembros: "Miembros",
    perfil: "Perfil del miembro",
    momentos: "Momentos",
    administracion: "Administración"
  };
  pageTitle.textContent = titles[sectionId] || "The Big Boy Rules";
  sidebar.classList.remove("open");
  window.scrollTo({top: 0, behavior: "smooth"});
  history.replaceState(null, "", `#${sectionId}`);
}

document.addEventListener("click", event => {
  const target = event.target.closest("[data-go]");
  if (target) goTo(target.dataset.go);
});

navLinks.forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    goTo(link.dataset.section);
  });
});

document.getElementById("menuButton").addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

document.getElementById("themeButton").addEventListener("click", () => {
  document.body.classList.toggle("light");
  localStorage.setItem("bb-theme", document.body.classList.contains("light") ? "light" : "dark");
});

if (localStorage.getItem("bb-theme") === "light") document.body.classList.add("light");

function renderFeatured() {
  document.getElementById("featuredMembers").innerHTML = members.slice(0, 4).map(member => `
    <button class="member-mini-card" data-profile="${member.id}">
      <div class="avatar">${member.name.charAt(0)}</div>
      <strong>${member.name}</strong>
      <small>${member.nickname}</small>
    </button>
  `).join("");
}

function renderActivity() {
  const activity = [
    [3, "ha enviado un mensaje en el chat.", "Hace 2 min"],
    [8, "ha añadido información al plan del sábado.", "Hace 8 min"],
    [1, "ha actualizado las reglas del grupo.", "Hace 1 h"],
    [5, "ha añadido un nuevo momento.", "Ayer"]
  ];
  document.getElementById("activityList").innerHTML = activity.map(([id, text, time]) => {
    const member = getMember(id);
    return `
      <div class="activity-item">
        <div class="avatar small">${member.name.charAt(0)}</div>
        <div class="activity-text">
          <strong>${member.name}</strong>
          <p>${text}</p>
        </div>
        <span class="activity-time">${time}</span>
      </div>
    `;
  }).join("");
}

function renderMembers() {
  document.getElementById("membersGrid").innerHTML = members.map(member => `
    <article class="member-card" style="--member-bg:${member.bg}" data-number="${String(member.id).padStart(2, "0")}">
      <span class="member-role">${member.role}</span>
      <h3>${member.name}</h3>
      <p>${member.nickname}</p>
      <button data-profile="${member.id}">Ver perfil →</button>
    </article>
  `).join("");

  document.getElementById("onlineMembers").innerHTML = members.map(member => `
    <div class="online-member">
      <div class="avatar">${member.name.charAt(0)}</div>
      <div>
        <strong>${member.name}</strong>
        <small>${member.status}</small>
      </div>
      <i></i>
    </div>
  `).join("");
}

function renderProfile(memberId) {
  const member = getMember(memberId);
  document.getElementById("profileContent").innerHTML = `
    <article class="profile-hero">
      <div class="profile-visual" style="--profile-bg:${member.bg}"></div>
      <div class="profile-info">
        <span class="profile-number">BIG BOY ${String(member.id).padStart(2, "0")}</span>
        <h2>${member.name}</h2>
        <div class="profile-nickname">${member.nickname.toUpperCase()}</div>
        <p>${member.bio}</p>
        <div class="profile-tags">${member.tags.map(tag => `<span>${tag}</span>`).join("")}</div>
        <div class="profile-stats">
          <div><strong>${member.stats[0]}</strong><small>${member.stats[1].toUpperCase()}</small></div>
          <div><strong>${member.id * 7 + 12}</strong><small>MOMENTOS</small></div>
          <div><strong>100%</strong><small>BIG BOY</small></div>
        </div>
      </div>
    </article>
  `;
  goTo("perfil");
}

document.addEventListener("click", event => {
  const target = event.target.closest("[data-profile]");
  if (target) renderProfile(target.dataset.profile);
});

function getMessages() {
  return JSON.parse(localStorage.getItem("bb-messages") || JSON.stringify(defaultMessages));
}

function renderMessages() {
  const messages = getMessages();
  document.getElementById("messages").innerHTML = messages.map(message => {
    const member = getMember(message.member);
    return `
      <div class="message">
        <div class="avatar">${member.name.charAt(0)}</div>
        <div>
          <div class="message-head">
            <strong>${member.name}</strong>
            <time>${message.time}</time>
          </div>
          <p>${escapeHtml(message.text)}</p>
        </div>
      </div>
    `;
  }).join("");
  const container = document.getElementById("messages");
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

document.getElementById("messageForm").addEventListener("submit", event => {
  event.preventDefault();
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text) return;

  const messages = getMessages();
  messages.push({
    member: getCurrentUser()?.id || 1,
    text,
    time: new Date().toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"})
  });
  localStorage.setItem("bb-messages", JSON.stringify(messages));
  input.value = "";
  renderMessages();
});

function renderMoments() {
  document.getElementById("momentsGrid").innerHTML = moments.map(([title, text, bg]) => `
    <article class="moment-card" style="--moment-bg:${bg}">
      <div>
        <h3>${title}</h3>
        <p>${text}</p>
      </div>
    </article>
  `).join("");
}

renderFeatured();
renderActivity();
renderMembers();
renderMessages();
renderMoments();

const initialSection = location.hash.replace("#", "");
if (["inicio", "chat", "miembros", "momentos"].includes(initialSection)) goTo(initialSection);




// ===== AUTHENTICATION AND USER SESSION =====
const AUTH_STORAGE_KEY = "bb-auth-session";
const AUTH_SESSION_KEY = "bb-auth-temporary";
let currentUser = null;

function normalizeUsername(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function getStoredSession() {
  const persistent = localStorage.getItem(AUTH_STORAGE_KEY);
  const temporary = sessionStorage.getItem(AUTH_SESSION_KEY);
  try {
    return JSON.parse(persistent || temporary || "null");
  } catch {
    return null;
  }
}

function getCurrentUser() {
  return currentUser;
}

function saveSession(user, remember) {
  const session = {
    userId: user.id,
    loginAt: new Date().toISOString()
  };
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(remember ? AUTH_STORAGE_KEY : AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  currentUser = null;
}

function applyUserInterface(user) {
  currentUser = user;
  document.body.classList.add("authenticated");
  document.getElementById("loginScreen")?.classList.add("login-hidden");

  const initial = user.name.charAt(0).toUpperCase();
  document.getElementById("sidebarAvatar").textContent = initial;
  document.getElementById("topbarAvatar").textContent = initial;
  document.getElementById("sidebarUserName").textContent = user.name;
  document.getElementById("topbarUserName").textContent = user.name;
  document.getElementById("sidebarUserRole").textContent =
    user.roleKey === "admin" ? "Administrador" : "Miembro";

  document.querySelectorAll(".admin-only").forEach(element => {
    element.style.display = user.roleKey === "admin" ? "" : "none";
  });

  renderMessages();
  renderAdminPanel();
}

function showLogin() {
  document.body.classList.remove("authenticated");
  document.getElementById("loginScreen")?.classList.remove("login-hidden");
  document.getElementById("userDropdown")?.classList.remove("open");
  goTo("inicio");
}

function authenticate(username, password) {
  const normalized = normalizeUsername(username);
  return members.find(user =>
    normalizeUsername(user.username) === normalized && user.password === password
  );
}

document.getElementById("loginForm")?.addEventListener("submit", event => {
  event.preventDefault();
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;
  const remember = document.getElementById("rememberSession").checked;
  const error = document.getElementById("loginError");
  const user = authenticate(username, password);

  if (!user) {
    error.textContent = "Usuario o contraseña incorrectos.";
    document.querySelector(".login-form")?.classList.remove("login-shake");
    requestAnimationFrame(() => document.querySelector(".login-form")?.classList.add("login-shake"));
    return;
  }

  error.textContent = "";
  saveSession(user, remember);
  localStorage.setItem(`bb-last-login-${user.id}`, new Date().toISOString());
  applyUserInterface(user);
});

document.getElementById("togglePassword")?.addEventListener("click", () => {
  const field = document.getElementById("loginPassword");
  field.type = field.type === "password" ? "text" : "password";
});

document.getElementById("userMenuButton")?.addEventListener("click", event => {
  event.stopPropagation();
  document.getElementById("userDropdown")?.classList.toggle("open");
});

document.addEventListener("click", () => {
  document.getElementById("userDropdown")?.classList.remove("open");
});

document.getElementById("logoutButton")?.addEventListener("click", () => {
  clearSession();
  showLogin();
  document.getElementById("loginPassword").value = "";
});

document.getElementById("myProfileButton")?.addEventListener("click", () => {
  if (currentUser) renderProfile(currentUser.id);
});

function renderAdminPanel() {
  const summary = document.getElementById("adminSummary");
  const table = document.getElementById("adminUsersTable");
  if (!summary || !table || currentUser?.roleKey !== "admin") return;

  const onlineCount = new Set(getMessages().slice(-12).map(message => message.member)).size;
  summary.innerHTML = `
    <div class="admin-stat-card">
      <span>USUARIOS</span>
      <strong>${members.length}</strong>
      <small>cuentas registradas</small>
    </div>
    <div class="admin-stat-card">
      <span>ADMINISTRADORES</span>
      <strong>${members.filter(user => user.roleKey === "admin").length}</strong>
      <small>con acceso total</small>
    </div>
    <div class="admin-stat-card">
      <span>ACTIVIDAD</span>
      <strong>${onlineCount}</strong>
      <small>usuarios recientes</small>
    </div>
  `;

  table.innerHTML = members.map(user => {
    const lastLogin = localStorage.getItem(`bb-last-login-${user.id}`);
    const lastLoginText = lastLogin
      ? new Date(lastLogin).toLocaleString("es-ES", {dateStyle: "short", timeStyle: "short"})
      : "Nunca";
    return `
      <tr>
        <td><code>@${user.username}</code></td>
        <td>
          <div class="table-user">
            <div class="avatar small">${user.name.charAt(0)}</div>
            <strong>${user.name}</strong>
          </div>
        </td>
        <td><span class="role-chip ${user.roleKey}">${user.roleKey === "admin" ? "Administrador" : "Miembro"}</span></td>
        <td><span class="account-status"><i></i> Activa</span></td>
        <td>${lastLoginText}</td>
      </tr>
    `;
  }).join("");
}

const savedSession = getStoredSession();
if (savedSession) {
  const savedUser = members.find(user => user.id === savedSession.userId);
  if (savedUser) {
    applyUserInterface(savedUser);
  } else {
    clearSession();
    showLogin();
  }
} else {
  showLogin();
}

// Premium experience animations
window.addEventListener("load", () => {
  const loader = document.getElementById("pageLoader");
  setTimeout(() => loader?.classList.add("hidden"), 450);
});

const cursorGlow = document.getElementById("cursorGlow");
document.addEventListener("pointermove", event => {
  if (!cursorGlow) return;
  cursorGlow.style.left = `${event.clientX}px`;
  cursorGlow.style.top = `${event.clientY}px`;
});

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

function observeReveals() {
  document.querySelectorAll(".reveal").forEach(element => {
    if (!element.classList.contains("visible")) revealObserver.observe(element);
  });
}

observeReveals();

document.addEventListener("click", event => {
  const button = event.target.closest("button, .nav-link, .member-card, .member-mini-card");
  if (!button) return;

  const ripple = document.createElement("span");
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.cssText = `
    position:absolute;
    width:${size}px;
    height:${size}px;
    left:${event.clientX - rect.left - size / 2}px;
    top:${event.clientY - rect.top - size / 2}px;
    border-radius:50%;
    pointer-events:none;
    background:rgba(243,210,122,.18);
    transform:scale(0);
    animation:bbRipple .6s ease-out forwards;
    z-index:20;
  `;
  if (getComputedStyle(button).position === "static") button.style.position = "relative";
  button.style.overflow = "hidden";
  button.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
});

const rippleStyle = document.createElement("style");
rippleStyle.textContent = `
  @keyframes bbRipple {
    to { transform: scale(2.3); opacity: 0; }
  }
`;
document.head.appendChild(rippleStyle);

const originalGoTo = goTo;
goTo = function(sectionId) {
  originalGoTo(sectionId);
  requestAnimationFrame(() => {
    document.querySelectorAll(`#${sectionId} .reveal`).forEach((el, index) => {
      el.classList.remove("visible");
      setTimeout(() => el.classList.add("visible"), 70 + index * 90);
    });
  });
};
