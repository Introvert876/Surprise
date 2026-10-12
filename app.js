/*
 * Kirti Photo Website frontend starter.
 * IMPORTANT: Set FIREBASE_CONFIG and BACKEND_URL before use.
 * The Apps Script backend must verify Firebase ID tokens server-side before
 * accepting uploads. Do not deploy an unauthenticated public upload endpoint.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCRwg_4QZ1RTax0fR8YXHNUMKjTGlhoAFI",
  authDomain: "name-840f3.firebaseapp.com",
  projectId: "name-840f3",
  storageBucket: "name-840f3.firebasestorage.app",
  messagingSenderId: "522532386468",
  appId: "1:522532386468:web:1341b069b6c1fb919dd831",
  measurementId: "G-7NK90QTMCT"
};

// Paste the deployed Apps Script /exec URL here only after the backend is
// updated to verify Firebase ID tokens and enforce server-side rules.
const BACKEND_URL = "";

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);
let mode = "login";
let selectedFiles = [];

function showStatus(id, message, isError = false) {
  const el = $(id);
  el.textContent = message;
  el.style.color = isError ? "#a4234d" : "#39764b";
}
function showPanel(id) {
  ["auth-panel", "upload-panel", "reveal-panel", "gallery-panel"]
    .forEach(panel => $(panel).classList.toggle("hidden", panel !== id));
}
function setMode(next) {
  mode = next;
  $("show-login").classList.toggle("active", mode === "login");
  $("show-register").classList.toggle("active", mode === "register");
  $("name-wrap").classList.toggle("hidden", mode !== "register");
  $("confirm-wrap").classList.toggle("hidden", mode !== "register");
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("auth-submit").textContent = mode === "login" ? "Sign in ❤️" : "Create account ❤️";
  $("auth-note").textContent = mode === "login"
    ? "Sign in to continue to the private photo experience."
    : "Create an account and verify your email before continuing.";
  showStatus("auth-status", "");
}
$("show-login").addEventListener("click", () => setMode("login"));
$("show-register").addEventListener("click", () => setMode("register"));

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  try {
    $("auth-submit").disabled = true;
    if (mode === "register") {
      const name = $("display-name").value.trim();
      if (password !== $("confirm-password").value) throw new Error("Passwords do not match.");
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(result.user, { displayName: name });
      await sendEmailVerification(result.user);
      await signOut(auth);
      showStatus("auth-status", "Account created. Check your email for the verification link, then sign in.");
    } else {
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (!result.user.emailVerified) {
        await signOut(auth);
        throw new Error("Please verify your email using the link we sent before signing in.");
      }
      showStatus("auth-status", "Signed in successfully.");
    }
  } catch (error) {
    showStatus("auth-status", error.message || "Authentication failed.", true);
  } finally {
    $("auth-submit").disabled = false;
  }
});

$("reset-password").addEventListener("click", async () => {
  const email = $("email").value.trim();
  if (!email) return showStatus("auth-status", "Enter your email address first.", true);
  try {
    await sendPasswordResetEmail(auth, email);
    showStatus("auth-status", "If the account exists, a password reset email has been sent.");
  } catch (error) {
    showStatus("auth-status", error.message || "Could not send reset email.", true);
  }
});

$("sign-out").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user && user.emailVerified) {
    $("signed-in-as").textContent = user.email;
    showPanel("upload-panel");
  } else {
    showPanel("auth-panel");
  }
});

$("photos").addEventListener("change", () => {
  selectedFiles = Array.from($("photos").files || []);
  const images = selectedFiles.filter(f => f.type.startsWith("image/"));
  const totalBytes = images.reduce((sum, f) => sum + f.size, 0);
  $("selection-summary").textContent =
    `${images.length} image(s) selected · ${(totalBytes / 1024 / 1024).toFixed(1)} MB total. ` +
    "Previously uploaded duplicates will be rejected by the backend.";
  $("upload-button").disabled = !(images.length > 0 && $("consent").checked);
});
$("consent").addEventListener("change", () => {
  $("upload-button").disabled = !(selectedFiles.some(f => f.type.startsWith("image/")) && $("consent").checked);
});

$("upload-button").addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return showStatus("upload-status", "Sign in with a verified email first.", true);
  if (!$("consent").checked) return showStatus("upload-status", "Please agree to the upload terms first.", true);
  const files = selectedFiles.filter(f => f.type.startsWith("image/"));
  if (!files.length) return showStatus("upload-status", "Choose image files first.", true);
  if (!BACKEND_URL) {
    return showStatus("upload-status", "Backend not connected yet. We must secure the upload endpoint before enabling uploads.", true);
  }
  showStatus("upload-status", "Upload is not enabled until the backend verifies Firebase sign-in tokens securely.", true);
});

$("reveal-button").addEventListener("click", () => {
  showStatus("reveal-status", "Gallery unlock will be enabled after secure server-side upload tracking is implemented.", true);
});
