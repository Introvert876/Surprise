/*
 * Kirti Photo Website
 * Firebase email/password authentication without email verification.
 *
 * Photo uploads and gallery reveal remain disabled until the backend
 * securely verifies Firebase ID tokens and enforces the upload rules.
 */

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

const $ = (id) => document.getElementById(id);

let mode = "login";
let selectedFiles = [];


// ============================================
// STATUS MESSAGES
// ============================================

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


// ============================================
// PAGE NAVIGATION
// ============================================

function showPanel(id) {
  [
    "auth-panel",
    "upload-panel",
    "reveal-panel",
    "gallery-panel"
  ].forEach((panelId) => {
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
      : "Create an account to continue to the photo upload page.";

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
  const submitButton = $("auth-submit");

  submitButton.disabled = true;
  showStatus("auth-status", "");

  try {
    if (mode === "register") {
      const name = $("display-name").value.trim();
      const confirmPassword = $("confirm-password").value;

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      // Create the account without sending a verification email.
      const credential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

      // Save the display name.
      if (name) {
        await updateProfile(credential.user, {
          displayName: name
        });
      }

      // Firebase automatically signs in the newly created user.
      $("signed-in-as").textContent =
        credential.user.email || email;

      // Navigate to the upload page.
      showPanel("upload-panel");

      showStatus(
        "upload-status",
        "Account created successfully. Welcome!"
      );

    } else {
      // Sign in without requiring email verification.
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      $("signed-in-as").textContent =
        credential.user.email || email;

      // Navigate to the upload page.
      showPanel("upload-panel");

      showStatus(
        "upload-status",
        "Signed in successfully!"
      );
    }

  } catch (error) {
    console.error("Authentication error:", error);

    const messages = {
      "auth/email-already-in-use":
        "An account already exists for this email. Please sign in instead.",

      "auth/invalid-email":
        "Please enter a valid email address.",

      "auth/weak-password":
        "Please choose a stronger password with at least 6 characters.",

      "auth/invalid-credential":
        "Email or password is incorrect. Please try again.",

      "auth/user-disabled":
        "This account has been disabled.",

      "auth/too-many-requests":
        "Too many attempts. Please wait and try again.",

      "auth/network-request-failed":
        "Network error. Check your internet connection and try again."
    };

    showStatus(
      "auth-status",
      messages[error.code] ||
        error.message ||
        "Authentication failed.",
      true
    );

  } finally {
    submitButton.disabled = false;
  }
});


// ============================================
// FORGOT PASSWORD
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
      "If an account exists for that email, a password reset email has been sent."
    );

  } catch (error) {
    console.error("Password reset error:", error);

    showStatus(
      "auth-status",
      error.message ||
        "Could not send the password reset email.",
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

    if ($("selection-summary")) {
      $("selection-summary").textContent = "";
    }

    showPanel("auth-panel");

    showStatus(
      "auth-status",
      "You have been signed out."
    );

  } catch (error) {
    console.error("Sign-out error:", error);

    showStatus(
      "upload-status",
      "Could not sign out. Please try again.",
      true
    );
  }
});


// ============================================
// RESTORE LOGIN SESSION
// ============================================

onAuthStateChanged(auth, (user) => {
  if (user) {
    if ($("signed-in-as")) {
      $("signed-in-as").textContent =
        user.email || "Signed in";
    }

    // Automatically open the upload page after login
    // or when a signed-in user refreshes the website.
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
    (sum, file) => sum + file.size,
    0
  );

  $("selection-summary").textContent =
    `${images.length} image(s) selected · ` +
    `${(totalBytes / 1024 / 1024).toFixed(1)} MB total. ` +
    "Previously uploaded duplicates must be rejected by the backend.";

  $("upload-button").disabled = !(
    images.length > 0 &&
    $("consent").checked
  );
});


// ============================================
// PHOTO UPLOAD CONSENT
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
      "Please agree to the photo upload terms first.",
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

  if (!BACKEND_URL) {
    showStatus(
      "upload-status",
      "Backend URL is not configured.",
      true
    );

    return;
  }

  // Uploading remains disabled until the backend API
  // securely verifies Firebase ID tokens, validates consent,
  // detects duplicates, and enforces the batch requirements.

  showStatus(
    "upload-status",
    "Your account is ready. Photo uploads are not enabled yet because the secure upload API must be implemented first.",
    true
  );
});


// ============================================
// ONE-TIME GALLERY REVEAL
// ============================================

$("reveal-button").addEventListener("click", () => {
  showStatus(
    "reveal-status",
    "Gallery reveal is not enabled yet. The backend must enforce the one-time reveal rule first.",
    true
  );
});
