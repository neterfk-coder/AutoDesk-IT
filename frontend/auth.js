// ── Firebase Auth ─────────────────────────────────────────────────────────────
firebase.initializeApp(CONFIG.FIREBASE_CONFIG);

const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// Estado actual del usuario
let currentUser = null;

// ── Verificar sesión al cargar ────────────────────────────────────────────────
auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    showDashboard(user);
  } else {
    currentUser = null;
    showLoginScreen();
  }
});

// ── Mostrar login ─────────────────────────────────────────────────────────────
function showLoginScreen() {
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("app-wrapper").style.display = "none";
}

// ── Mostrar dashboard ─────────────────────────────────────────────────────────
function showDashboard(user) {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-wrapper").style.display = "flex";

  // Mostrar nombre y foto del usuario en el sidebar
  const nameEl = document.getElementById("user-name");
  const emailEl = document.getElementById("user-email");
  const photoEl = document.getElementById("user-photo");

  if (nameEl) nameEl.textContent = user.displayName || "User";
  if (emailEl) emailEl.textContent = user.email || "";
  if (photoEl && user.photoURL) {
    photoEl.src = user.photoURL;
    photoEl.style.display = "block";
  }
}

// ── Login con Google ──────────────────────────────────────────────────────────
async function loginWithGoogle() {
  const btn = document.getElementById("google-login-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Signing in...";
  }

  try {
    await auth.signInWithPopup(provider);
    // onAuthStateChanged se encarga del resto
  } catch (e) {
    console.error("Login error:", e);
    const errEl = document.getElementById("login-error");
    if (errEl) errEl.textContent = "Login failed. Please try again.";
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Sign in with Google";
    }
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function logout() {
  await auth.signOut();
  showLoginScreen();
}
