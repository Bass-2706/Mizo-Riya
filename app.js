const SUPABASE_URL = "https://vvktvhczmnkpozrvitjh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2a3R2aGN6bW5rcG96cnZpdGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMDQxNjMsImV4cCI6MjA4ODg4MDE2M30.n7giAlNpj0oTmwYpk-HzHSGHQhNkTWLwomn-72aiVrg";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

let allSentences = [];

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


function showAuthMessage(msg) {
  authMessage.textContent = msg;
}

function showSaveMessage(msg) {
  saveMessage.textContent = msg;
}

async function ensureMember(user) {
  if (!user) return;
  await supabaseClient.from("members").upsert({
    user_id: user.id,
    email: user.email
  });
}

async function signUp() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showAuthMessage("Enter email and password.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    showAuthMessage(error.message);
    return;
  }

  if (data.user) {
    await ensureMember(data.user);
  }

  showAuthMessage("Signup successful. If email confirmation is enabled, confirm email first.");
}

async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showAuthMessage("Enter email and password.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showAuthMessage(error.message);
    return;
  }

  if (data.user) {
    await ensureMember(data.user);
  }

  showAuthMessage("Logged in.");
  await loadSentences();
}

async function logout() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    showAuthMessage(error.message);
    return;
  }

  updateAuthUI(null);
allSentences = [];
renderSentences([]);

}

async function saveSentence() {
  const english = englishText.value.trim();
  const mizo = mizoText.value.trim();
  const category = categoryInput.value.trim() || "general";
  const notes = notesInput.value.trim();

  if (!english || !mizo) {
    showSaveMessage("Enter both English and Mizo sentence.");
    return;
  }

  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  if (!user) {
    showSaveMessage("Please login first.");
    return;
  }

  const { error } = await supabaseClient.from("sentences").insert({
    english_text: english,
    mizo_text: mizo,
    category,
    notes,
    created_by: user.id
  });

  if (error) {
    showSaveMessage(error.message);
    return;
  }

  englishText.value = "";
  mizoText.value = "";
  categoryInput.value = "";
  notesInput.value = "";
  showSaveMessage("Sentence saved.");
  await loadSentences();
}

async function deleteSentence(id) {
  const { error } = await supabaseClient
    .from("sentences")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadSentences();
}

function renderSentences(items) {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = items.filter((item) => {
    return (
      item.english_text.toLowerCase().includes(q) ||
      item.mizo_text.toLowerCase().includes(q) ||
      (item.category || "").toLowerCase().includes(q) ||
      (item.notes || "").toLowerCase().includes(q)
    );
  });

  if (filtered.length === 0) {
    sentenceList.innerHTML = "<p>No sentences found.</p>";
    return;
  }

  sentenceList.innerHTML = filtered
    .map(
      (item) => `
        <div class="sentence-item">
          <div><strong>English:</strong> ${escapeHtml(item.english_text)}</div>
          <div style="margin-top:8px;"><strong>Mizo:</strong> ${escapeHtml(item.mizo_text)}</div>
          <div class="meta">
            Category: ${escapeHtml(item.category || "general")}
            ${item.notes ? " • Notes: " + escapeHtml(item.notes) : ""}
          </div>
          <button class="delete-btn small-btn" onclick="deleteSentence('${item.id}')">Delete</button>
        </div>
      `
    )
    .join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function loadSentences() {
  const { data, error } = await supabaseClient
    .from("sentences")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    sentenceList.innerHTML = `<p>${error.message}</p>`;
    return;
  }

  allSentences = data || [];
  renderSentences(allSentences);
}

searchInput.addEventListener("input", () => renderSentences(allSentences));
signupBtn.addEventListener("click", signUp);
loginBtn.addEventListener("click", login);
logoutBtn.addEventListener("click", logout);
saveSentenceBtn.addEventListener("click", saveSentence);

supabaseClient.auth.getSession().then(async ({ data }) => {
  updateAuthUI(data.session);

  if (data.session) {
    await loadSentences();
  }
});

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
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "sentences" },
    async () => {
      await loadSentences();
    }
  )
  .subscribe();

window.deleteSentence = deleteSentence;
