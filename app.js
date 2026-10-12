import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// ============================================
// FIREBASE CONFIGURATION
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyCRwg_4QZ1RTax0fR8YXHNUMKjTGlhoAFI",
  authDomain: "name-840f3.firebaseapp.com",
  projectId: "name-840f3",
  storageBucket: "name-840f3.firebasestorage.app",
  messagingSenderId: "522532386468",
  appId: "1:522532386468:web:1341b069b6c1fb919dd831",
  measurementId: "G-7NK90QTMCT"
};

// ============================================
// GOOGLE APPS SCRIPT BACKEND
// ============================================

const BACKEND_URL =
  "https://script.google.com/macros/s/AKfycbwd5R1YTjVv1LfS8MxnFV69_sxosGRvxIyUR1sNUuWVnmAJHafcLASX-H96AaNicLU04g/exec";

const MINIMUM_PHOTOS = 30;

// ============================================
// INITIALIZE FIREBASE
// ============================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);

let mode = "login";
let selectedFiles = [];

// ============================================
// STATUS HELPERS
// ============================================

function showStatus(id, message, isError = false) {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#a4234d" : "#39764b";
}

function showPanel(id) {
  [
    "auth-panel",
    "upload-panel",
    "reveal-panel",
    "gallery-panel"
  ].forEach((panelId) => {
    const element = $(panelId);
    if (element) {
      element.classList.toggle("hidden", panelId !== id);
    }
  });
}

// ============================================
// BACKEND REQUEST HELPER
// ============================================

async function backendRequest(payload) {
  if (!BACKEND_URL) {
    throw new Error("Backend URL is not configured.");
  }

  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in first.");
  }

  const idToken = await user.getIdToken();

  /*
   * This helper is prepared for the backend API.
   * The current backend still rejects upload requests.
   */

  const response = await fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      ...payload,
      idToken
    }),
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(
      `Backend request failed with status ${response.status}.`
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.error || "The backend rejected the request."
    );
  }

  return result;
}

// ============================================
// LOGIN / REGISTRATION MODE
// ============================================

function setMode(nextMode) {
  mode = nextMode;

  $("show-login").classList.toggle("active", mode === "login");
  $("show-register").classList.toggle("active", mode === "register");

  $("name-wrap").classList.toggle("hidden", mode !== "register");
  $("confirm-wrap").classList.toggle("hidden", mode !== "register");

  $("password").autocomplete =
    mode === "login" ? "current-password" : "new-password";

  $("auth-submit").textContent =
    mode === "login" ? "Sign in ❤️" : "Create account ❤️";

  $("auth-note").textContent =
    mode === "login"
      ? "Sign in to continue to the private photo experience."
      : "Create an account to continue to the photo upload page.";

  showStatus("auth-status", "");
}

$("show-login").addEventListener("click", () => setMode("login"));
$("show-register").addEventListener("click", () => setMode("register"));

// ============================================
// REGISTER / SIGN IN
// ============================================

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;

  $("auth-submit").disabled = true;

  try {
    if (mode === "register") {
      const name = $("display-name").value.trim();

      if (password !== $("confirm-password").value) {
        throw new Error("Passwords do not match.");
      }

      const credential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

      if (name) {
        await updateProfile(credential.user, {
          displayName: name
        });
      }

      $("signed-in-as").textContent =
        credential.user.email || email;

      showPanel("upload-panel");

      showStatus(
        "upload-status",
        "Account created successfully!"
      );

    } else {
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      $("signed-in-as").textContent =
        credential.user.email || email;

      showPanel("upload-panel");

      showStatus(
        "upload-status",
        "Signed in successfully!"
      );
    }

  } catch (error) {
    console.error("Authentication error:", error);

    showStatus(
      "auth-status",
      error.message || "Authentication failed.",
      true
    );

  } finally {
    $("auth-submit").disabled = false;
  }
});

// ============================================
// PASSWORD RESET
// ============================================

$("reset-password").addEventListener("click", async () => {
  const email = $("email").value.trim();

  if (!email) {
    showStatus(
      "auth-status",
      "Enter your email address first.",
      true
    );
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);

    showStatus(
      "auth-status",
      "If the account exists, a password reset email has been sent."
    );

  } catch (error) {
    showStatus(
      "auth-status",
      error.message || "Could not send the reset email.",
      true
    );
  }
});

// ============================================
// SIGN OUT
// ============================================

$("sign-out").addEventListener("click", async () => {
  try {
    await signOut(auth);

    selectedFiles = [];

    if ($("photos")) {
      $("photos").value = "";
    }

    showPanel("auth-panel");

  } catch (error) {
    showStatus(
      "upload-status",
      "Could not sign out.",
      true
    );
  }
});

// ============================================
// RESTORE AUTHENTICATION SESSION
// ============================================

onAuthStateChanged(auth, (user) => {
  if (user) {
    $("signed-in-as").textContent = user.email || "";
    showPanel("upload-panel");
  } else {
    showPanel("auth-panel");
  }
});

// ============================================
// PHOTO SELECTION
// ============================================

$("photos").addEventListener("change", () => {
  selectedFiles = Array.from($("photos").files || []);

  const images = selectedFiles.filter((file) =>
    file.type.startsWith("image/")
  );

  const totalBytes = images.reduce(
    (total, file) => total + file.size,
    0
  );

  $("selection-summary").textContent =
    `${images.length} image(s) selected · ` +
    `${(totalBytes / 1024 / 1024).toFixed(1)} MB total.`;

  $("upload-button").disabled =
    !(images.length > 0 && $("consent").checked);
});

// ============================================
// CONSENT
// ============================================

$("consent").addEventListener("change", () => {
  const hasImages = selectedFiles.some((file) =>
    file.type.startsWith("image/")
  );

  $("upload-button").disabled =
    !(hasImages && $("consent").checked);
});

// ============================================
// UPLOAD SELECTED PHOTOS
// ============================================

$("upload-button").addEventListener("click", async () => {
  if (!auth.currentUser) {
    showStatus(
      "upload-status",
      "Please sign in first.",
      true
    );
    return;
  }

  if (!$("consent").checked) {
    showStatus(
      "upload-status",
      "Please agree to the photo upload terms.",
      true
    );
    return;
  }

  const images = selectedFiles.filter((file) =>
    file.type.startsWith("image/")
  );

  if (!images.length) {
    showStatus(
      "upload-status",
      "Choose image files first.",
      true
    );
    return;
  }

  /*
   * Do not send images yet.
   *
   * The current Apps Script backend does not yet have a
   * production-ready upload flow and one-time reveal API.
   */

  showStatus(
    "upload-status",
    "Your account and backend configuration are ready. Photo uploads will be enabled after the secure upload and batch APIs are verified.",
    true
  );
});

// ============================================
// ONE-TIME REVEAL PLACEHOLDER
// ============================================

$("reveal-button").addEventListener("click", () => {
  showStatus(
    "reveal-status",
    "Gallery reveal is not enabled until the backend can securely enforce one-time access.",
    true
  );
});
