// ── Firebase Auth ─────────────────────────────────────────────────────────────
firebase.initializeApp(CONFIG.FIREBASE_CONFIG);

const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let currentUser = null;

// ── Auth state ────────────────────────────────────────────────────────────────
auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    showDashboard(user);
  } else {
    currentUser = null;
    showLoginScreen();
  }
});

// ── Show/hide screens ─────────────────────────────────────────────────────────
function showLoginScreen() {
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("app-wrapper").style.display = "none";
}

function showDashboard(user) {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-wrapper").style.display = "flex";

  const nameEl = document.getElementById("user-name");
  const emailEl = document.getElementById("user-email");
  const photoEl = document.getElementById("user-photo");

  if (nameEl) nameEl.textContent = user.displayName || user.email.split("@")[0];
  if (emailEl) emailEl.textContent = user.email;
  if (photoEl && user.photoURL) {
    photoEl.src = user.photoURL;
    photoEl.style.display = "block";
  }
}

// ── Tab switch ────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById("form-signin").style.display =
    tab === "signin" ? "block" : "none";
  document.getElementById("form-signup").style.display =
    tab === "signup" ? "block" : "none";
  document
    .getElementById("tab-signin")
    .classList.toggle("active", tab === "signin");
  document
    .getElementById("tab-signup")
    .classList.toggle("active", tab === "signup");
  clearError();
}

// ── Google login ──────────────────────────────────────────────────────────────
async function loginWithGoogle() {
  clearError();
  try {
    await auth.signInWithPopup(provider);
  } catch (e) {
    console.error("Google login error:", e);
    showError(getFriendlyError(e.code));
  }
}

// ── Email login ───────────────────────────────────────────────────────────────
async function loginWithEmail() {
  clearError();
  const email = document.getElementById("signin-email").value.trim();
  const password = document.getElementById("signin-password").value;

  if (!email || !password) {
    showError("Please enter your email and password.");
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (e) {
    console.error("Email login error:", e);
    showError(getFriendlyError(e.code));
  }
}

// ── Register ──────────────────────────────────────────────────────────────────
async function registerWithEmail() {
  clearError();
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  if (!name || !email || !password) {
    showError("Please fill in all fields.");
    return;
  }

  if (password.length < 8) {
    showError("Password must be at least 8 characters.");
    return;
  }

  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    await result.user.updateProfile({ displayName: name });
  } catch (e) {
    console.error("Register error:", e);
    showError(getFriendlyError(e.code));
  }
}

// ── Reset password ────────────────────────────────────────────────────────────
async function resetPassword() {
  clearError();
  const email = document.getElementById("signin-email").value.trim();
  if (!email) {
    showError("Enter your email first, then click Forgot password.");
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);
    showError("✅ Reset email sent — check your inbox.");
  } catch (e) {
    showError(getFriendlyError(e.code));
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function logout() {
  await auth.signOut();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById("login-error");
  if (el) el.textContent = msg;
}

function clearError() {
  const el = document.getElementById("login-error");
  if (el) el.textContent = "";
}

function getFriendlyError(code) {
  const errors = {
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Try again.",
    "auth/email-already-in-use":
      "This email is already registered. Sign in instead.",
    "auth/weak-password": "Password must be at least 8 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment.",
    "auth/popup-closed-by-user": "Sign in was cancelled.",
    "auth/unauthorized-domain": "Add localhost to Firebase authorized domains.",
    "auth/invalid-credential": "Invalid email or password.",
  };
  return errors[code] || "Something went wrong. Please try again.";
}
// ── Guest access ──────────────────────────────────────────────────────────────
function continueAsGuest() {
  // Mostrar dashboard directamente sin autenticación
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-wrapper").style.display = "flex";

  // Configurar como guest
  const nameEl = document.getElementById("user-name");
  const emailEl = document.getElementById("user-email");
  const photoEl = document.getElementById("user-photo");

  if (nameEl) nameEl.textContent = "Guest User";
  if (emailEl) emailEl.textContent = "guest · view only";
  if (photoEl) {
    photoEl.style.display = "none";
  }

  // Reemplazar botón de logout por "Sign In"
  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) {
    logoutBtn.title = "Sign in";
    logoutBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
        <polyline points="10 17 15 12 10 7"/>
        <line x1="15" y1="12" x2="3" y2="12"/>
      </svg>`;
    logoutBtn.onclick = () => {
      document.getElementById("app-wrapper").style.display = "none";
      document.getElementById("login-screen").style.display = "flex";
    };
  }

  // Mostrar banner de guest en el dashboard
  showGuestBanner();
}

function showGuestBanner() {
  const banner = document.createElement("div");
  banner.id = "guest-banner";
  banner.style.cssText = `
    position: fixed;
    top: 0; left: var(--sidebar-w); right: 0;
    background: linear-gradient(90deg, rgba(124,58,237,0.15), rgba(59,130,246,0.15));
    border-bottom: 1px solid rgba(124,58,237,0.3);
    padding: 8px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 200;
    font-size: 12px;
    color: var(--purple-lt);
  `;
  banner.innerHTML = `
    <span>
      👤 You're browsing as a <strong>Guest</strong> —
      data is read-only. Sign in to manage tickets.
    </span>
    <button onclick="document.getElementById('app-wrapper').style.display='none';
      document.getElementById('login-screen').style.display='flex';
      document.getElementById('guest-banner').remove()"
      style="background:var(--purple);color:white;border:none;
        border-radius:6px;padding:4px 12px;font-size:11px;
        cursor:pointer;font-family:var(--font);font-weight:600">
      Sign In
    </button>
  `;
  document.body.appendChild(banner);

  // Ajustar topbar para dar espacio al banner
  const topbar = document.querySelector(".topbar");
  if (topbar) topbar.style.marginTop = "37px";
}
