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
