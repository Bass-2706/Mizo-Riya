const SUPABASE_URL = "https://vvktvhczmnkpozrvitjh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2a3R2aGN6bW5rcG96cnZpdGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMDQxNjMsImV4cCI6MjA4ODg4MDE2M30.n7giAlNpj0oTmwYpk-HzHSGHQhNkTWLwomn-72aiVrg";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMessage = document.getElementById("authMessage");
const englishText = document.getElementById("englishText");
const mizoText = document.getElementById("mizoText");
const categoryInput = document.getElementById("category");
const notesInput = document.getElementById("notes");
const saveSentenceBtn = document.getElementById("saveSentenceBtn");
const saveMessage = document.getElementById("saveMessage");
const searchInput = document.getElementById("searchInput");
const sentenceList = document.getElementById("sentenceList");
const suggestionsBox = document.getElementById("suggestionsBox");

let allSentences = [];
let editingId = null;

function updateAuthUI(session) {
  const loggedIn = !!session;
  signupBtn.style.display = loggedIn ? "none" : "inline-block";
  loginBtn.style.display = loggedIn ? "none" : "inline-block";
  logoutBtn.style.display = loggedIn ? "inline-block" : "none";
  emailInput.style.display = loggedIn ? "none" : "block";
  passwordInput.style.display = loggedIn ? "none" : "block";
  if (loggedIn) {
    authMessage.textContent = "Logged in as " + (session.user.email || "");
  } else {
    authMessage.textContent = "Logged out.";
  }
}

function showAuthMessage(msg) { authMessage.textContent = msg; }
function showSaveMessage(msg) { saveMessage.textContent = msg; }

async function ensureMember(user) {
  if (!user) return;
  await supabaseClient.from("members").upsert({ user_id: user.id, email: user.email });
}

async function signUp() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) { showAuthMessage("Enter email and password."); return; }
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) { showAuthMessage(error.message); return; }
  if (data.user) await ensureMember(data.user);
  showAuthMessage("Signup successful. You can now login.");
}

async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) { showAuthMessage("Enter email and password."); return; }
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) { showAuthMessage(error.message); return; }
  if (data.user) await ensureMember(data.user);
  updateAuthUI(data.session);
  await loadSentences();
}

async function logout() {
  try {
    await supabaseClient.auth.signOut();
  } catch(e) {}
  // clear all supabase keys from localStorage
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith("sb-") || key.includes("supabase")) {
      localStorage.removeItem(key);
    }
  });
  window.location.href = window.location.href.split("?")[0];
}

function startEdit(id) {
  const item = allSentences.find(s => s.id === id);
  if (!item) return;
  editingId = id;
  englishText.value = item.english_text;
  mizoText.value = item.mizo_text;
  categoryInput.value = item.category || "";
  notesInput.value = item.notes || "";
  saveSentenceBtn.textContent = "Update sentence";
  saveSentenceBtn.style.background = "#f59e0b";
  showSaveMessage("Editing sentence. Change the fields and click Update.");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelEdit() {
  editingId = null;
  englishText.value = "";
  mizoText.value = "";
  categoryInput.value = "";
  notesInput.value = "";
  saveSentenceBtn.textContent = "Save sentence";
  saveSentenceBtn.style.background = "";
  showSaveMessage("");
}

async function saveSentence() {
  const english = englishText.value.trim();
  const mizo = mizoText.value.trim();
  const category = categoryInput.value.trim() || "general";
  const notes = notesInput.value.trim();
  if (!english || !mizo) { showSaveMessage("Enter both English and Mizo sentence."); return; }
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) { showSaveMessage("Please login first."); return; }
  if (editingId) {
    const { error } = await supabaseClient.from("sentences").update({
      english_text: english, mizo_text: mizo, category, notes
    }).eq("id", editingId);
    if (error) { showSaveMessage(error.message); return; }
    showSaveMessage("Sentence updated.");
    cancelEdit();
  } else {
    const { error } = await supabaseClient.from("sentences").insert({
      english_text: english, mizo_text: mizo, category, notes, created_by: user.id
    });
    if (error) { showSaveMessage(error.message); return; }
    englishText.value = ""; mizoText.value = "";
    categoryInput.value = ""; notesInput.value = "";
    showSaveMessage("Sentence saved.");
  }
  await loadSentences();
}

async function deleteSentence(id) {
  if (!confirm("Delete this sentence?")) return;
  const { error } = await supabaseClient.from("sentences").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  if (editingId === id) cancelEdit();
  await loadSentences();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderSentences(items) {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = items.filter(item =>
    item.english_text.toLowerCase().includes(q) ||
    item.mizo_text.toLowerCase().includes(q) ||
    (item.category || "").toLowerCase().includes(q) ||
    (item.notes || "").toLowerCase().includes(q)
  );
  if (filtered.length === 0) {
    sentenceList.innerHTML = "<p>No sentences found.</p>";
    return;
  }
  sentenceList.innerHTML = filtered.map(item => `
    <div class="sentence-item" id="sentence-${item.id}">
      <div><strong>English:</strong> ${escapeHtml(item.english_text)}</div>
      <div style="margin-top:8px;"><strong>Mizo:</strong> ${escapeHtml(item.mizo_text)}</div>
      <div class="meta">
        Category: ${escapeHtml(item.category || "general")}
        ${item.notes ? " &bull; Notes: " + escapeHtml(item.notes) : ""}
      </div>
      <div>
        <button class="small-btn" onclick="startEdit('${item.id}')">Edit</button>
        <button class="delete-btn small-btn" onclick="deleteSentence('${item.id}')">Delete</button>
      </div>
    </div>
  `).join("");
}

async function loadSentences() {
  const { data, error } = await supabaseClient
    .from("sentences").select("*").order("updated_at", { ascending: false });
  if (error) { sentenceList.innerHTML = `<p>${error.message}</p>`; return; }
  allSentences = data || [];
  renderSentences(allSentences);
}

function showSuggestions(query) {
  if (!query || query.length < 1) {
    suggestionsBox.classList.remove("visible");
    suggestionsBox.innerHTML = "";
    return;
  }
  const q = query.toLowerCase();
  const matches = allSentences.filter(item =>
    item.english_text.toLowerCase().includes(q) ||
    item.mizo_text.toLowerCase().includes(q)
  ).slice(0, 6);
  if (matches.length === 0) {
    suggestionsBox.classList.remove("visible");
    suggestionsBox.innerHTML = "";
    return;
  }
  suggestionsBox.innerHTML = matches.map(item => `
    <div class="suggestion-item" onclick="pickSuggestion('${item.id}')">
      <div class="suggestion-english">${escapeHtml(item.english_text)}</div>
      <div class="suggestion-mizo">${escapeHtml(item.mizo_text)}</div>
    </div>
  `).join("");
  suggestionsBox.classList.add("visible");
}

function pickSuggestion(id) {
  const item = allSentences.find(s => s.id === id);
  if (!item) return;
  suggestionsBox.classList.remove("visible");
  suggestionsBox.innerHTML = "";
  searchInput.value = "";
  document.getElementById("searchWrapper").classList.remove("open");
  renderSentences(allSentences);
  setTimeout(() => {
    const card = document.getElementById("sentence-" + id);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.style.outline = "2px solid #ff4fa3";
      setTimeout(() => { card.style.outline = "none"; }, 2000);
    }
  }, 100);
}

searchInput.addEventListener("input", () => {
  showSuggestions(searchInput.value.trim());
  renderSentences(allSentences);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-bar-wrapper")) {
    suggestionsBox.classList.remove("visible");
    suggestionsBox.innerHTML = "";
  }
});

const searchToggle = document.getElementById("searchToggle");
const searchWrapper = document.getElementById("searchWrapper");

searchToggle.addEventListener("click", () => {
  searchWrapper.classList.toggle("open");
  if (searchWrapper.classList.contains("open")) {
    searchInput.focus();
  } else {
    searchInput.value = "";
    suggestionsBox.classList.remove("visible");
    suggestionsBox.innerHTML = "";
    renderSentences(allSentences);
  }
});

signupBtn.addEventListener("click", signUp);
loginBtn.addEventListener("click", login);
logoutBtn.addEventListener("click", logout);
saveSentenceBtn.addEventListener("click", saveSentence);

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  updateAuthUI(session);
  if (session) {
    await loadSentences();
  } else {
    allSentences = [];
    renderSentences([]);
  }
});

supabaseClient
  .channel("sentences-live")
  .on("postgres_changes",
    { event: "*", schema: "public", table: "sentences" },
    async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) await loadSentences();
    }
  ).subscribe();

window.deleteSentence = deleteSentence;
window.startEdit = startEdit;
window.pickSuggestion = pickSuggestion;
