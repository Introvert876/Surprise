/*
 * Kirti Photo Website
 * Firebase Authentication + Google Apps Script backend configuration.
 *
 * SECURITY:
 * Photo uploads and gallery reveal remain disabled until the backend
 * securely verifies Firebase ID tokens and enforces the upload rules.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";


// ============================================
// FIREBASE CONFIGURATION
// ============================================

const FIREBASE_CONFIG = {
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


// ============================================
// INITIALIZE FIREBASE
// ============================================

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);


// ============================================
// APPLICATION STATE
// ============================================

let mode = "login";
let selectedFiles = [];


// ============================================
// HELPER FUNCTIONS
// ============================================

const $ = (id) => document.getElementById(id);


function showStatus(id, message, isError = false) {
  const element = $(id);

  if (!element) {
    console.warn(`Status element not found: ${id}`);
    return;
  }

  element.textContent = message;

  element.style.color = isError
    ? "#a4234d"
    : "#39764b";
}


function showPanel(id) {
  const panels = [
    "auth-panel",
    "upload-panel",
    "reveal-panel",
    "gallery-panel"
  ];

  panels.forEach((panelId) => {
    const element = $(panelId);

    if (element) {
      element.classList.toggle(
        "hidden",
        panelId !== id
      );
    }
  });
}


// ============================================
// LOGIN / REGISTRATION MODE
// ============================================

function setMode(nextMode) {
  mode = nextMode;

  $("show-login").classList.toggle(
    "active",
    mode === "login"
  );

  $("show-register").classList.toggle(
    "active",
    mode === "register"
  );

  $("name-wrap").classList.toggle(
    "hidden",
    mode !== "register"
  );

  $("confirm-wrap").classList.toggle(
    "hidden",
    mode !== "register"
  );

  $("password").autocomplete =
    mode === "login"
      ? "current-password"
      : "new-password";

  $("auth-submit").textContent =
    mode === "login"
      ? "Sign in ❤️"
      : "Create account ❤️";

  $("auth-note").textContent =
    mode === "login"
      ? "Sign in to continue to the private photo experience."
      : "Create an account and verify your email before continuing.";

  showStatus("auth-status", "");
}


$("show-login").addEventListener("click", () => {
  setMode("login");
});


$("show-register").addEventListener("click", () => {
  setMode("register");
});


// ============================================
// CREATE ACCOUNT / SIGN IN
// ============================================

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;

  try {
    $("auth-submit").disabled = true;

    if (mode === "register") {
      const name = $("display-name").value.trim();
      const confirmPassword =
        $("confirm-password").value;

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const result =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

      if (name) {
        await updateProfile(result.user, {
          displayName: name
        });
      }

      await sendEmailVerification(result.user);
      await signOut(auth);

      showStatus(
        "auth-status",
        "Account created successfully! Check your email and verify your address before signing in."
      );

    } else {
      const result =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      if (!result.user.emailVerified) {
        await signOut(auth);

        throw new Error(
          "Please verify your email using the verification link we sent you."
        );
      }

      showStatus(
        "auth-status",
        "Signed in successfully."
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

$("reset-password").addEventListener(
  "click",
  async () => {
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
      console.error("Password reset error:", error);

      showStatus(
        "auth-status",
        error.message || "Could not send the password reset email.",
        true
      );
    }
  }
);


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
    console.error("Sign-out error:", error);
  }
});


// ============================================
// AUTHENTICATION STATE
// ============================================

onAuthStateChanged(auth, async (user) => {
  if (user && user.emailVerified) {
    $("signed-in-as").textContent =
      user.email || "";

    showPanel("upload-panel");

  } else {
    showPanel("auth-panel");
  }
});


// ============================================
// PHOTO SELECTION
// ============================================

$("photos").addEventListener("change", () => {
  selectedFiles = Array.from(
    $("photos").files || []
  );

  const images = selectedFiles.filter((file) =>
    file.type.startsWith("image/")
  );

  const totalBytes = images.reduce(
    (total, file) => total + file.size,
    0
  );

  $("selection-summary").textContent =
    `${images.length} image(s) selected · ` +
    `${(totalBytes / 1024 / 1024).toFixed(1)} MB total. ` +
    "Previously uploaded duplicates will be rejected by the backend.";

  $("upload-button").disabled = !(
    images.length > 0 &&
    $("consent").checked
  );
});


// ============================================
// UPLOAD CONSENT
// ============================================

$("consent").addEventListener("change", () => {
  const hasImages = selectedFiles.some((file) =>
    file.type.startsWith("image/")
  );

  $("upload-button").disabled = !(
    hasImages &&
    $("consent").checked
  );
});


// ============================================
// PHOTO UPLOAD
// ============================================

$("upload-button").addEventListener(
  "click",
  async () => {
    const user = auth.currentUser;

    if (!user || !user.emailVerified) {
      showStatus(
        "upload-status",
        "Sign in with a verified email first.",
        true
      );

      return;
    }

    if (!$("consent").checked) {
      showStatus(
        "upload-status",
        "Please agree to the photo upload terms first.",
        true
      );

      return;
    }

    const files = selectedFiles.filter((file) =>
      file.type.startsWith("image/")
    );

    if (files.length === 0) {
      showStatus(
        "upload-status",
        "Choose image files first.",
        true
      );

      return;
    }

    if (!BACKEND_URL) {
      showStatus(
        "upload-status",
        "The backend URL has not been configured.",
        true
      );

      return;
    }

    /*
     * The backend URL is configured, but the upload API
     * has not yet been implemented.
     *
     * Do not upload photos until the backend verifies
     * Firebase ID tokens and enforces consent, duplicate
     * detection, batch rules, and private Drive storage.
     */

    showStatus(
      "upload-status",
      "The backend URL is configured. Photo uploads are not enabled yet because the secure upload API must be implemented first.",
      true
    );
  }
);


// ============================================
// ONE-TIME GALLERY REVEAL
// ============================================

$("reveal-button").addEventListener(
  "click",
  () => {
    showStatus(
      "reveal-status",
      "The gallery reveal feature will be enabled after secure server-side upload tracking and one-time access enforcement are implemented.",
      true
    );
  }
);
