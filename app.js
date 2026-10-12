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

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCRwg_4QZ1RTax0fR8YXHNUMKjTGlhoAFI",
  authDomain: "name-840f3.firebaseapp.com",
  projectId: "name-840f3",
  storageBucket: "name-840f3.firebasestorage.app",
  messagingSenderId: "522532386468",
  appId: "1:522532386468:web:1341b069b6c1fb919dd831",
  measurementId: "G-7NK90QTMCT"
};

// Backend URL
const BACKEND_URL =
  "https://script.google.com/macros/s/AKfycbwd5R1YTjVv1LfS8MxnFV69_sxosGRvxIyUR1sNUuWVnmAJHafcLASX-H96AaNicLU04g/exec";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let mode = "login";
let selectedFiles = [];

const $ = (id) => document.getElementById(id);

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

// Switch between login and registration
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
      : "Create an account to continue.";

  showStatus("auth-status", "");
}

$("show-login").addEventListener("click", () => setMode("login"));
$("show-register").addEventListener("click", () => setMode("register"));

// Register and login
$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;

  $("auth-submit").disabled = true;

  try {
    if (mode === "register") {
      const name = $("display-name").value.trim();
      const confirmPassword = $("confirm-password").value;

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      if (name) {
        await updateProfile(result.user, {
          displayName: name
        });
      }

      // Redirect to the upload page immediately.
      $("signed-in-as").textContent = email;
      showPanel("upload-panel");

      showStatus(
        "upload-status",
        "Account created successfully! You can now continue."
      );

    } else {
      const result = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Redirect to the upload page after login.
      $("signed-in-as").textContent = result.user.email || email;
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

// Password reset
$("reset-password").addEventListener("click", async () => {
  const email = $("email").value.trim();

  if (!email) {
    showStatus("auth-status", "Enter your email address first.", true);
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
      error.message || "Unable to send the password reset email.",
      true
    );
  }
});

// Sign out
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

// Restore session when the page loads
onAuthStateChanged(auth, (user) => {
  if (user) {
    $("signed-in-as").textContent = user.email || "";
    showPanel("upload-panel");
  } else {
    showPanel("auth-panel");
  }
});

// Photo selection
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

// Upload consent
$("consent").addEventListener("change", () => {
  const hasImages = selectedFiles.some((file) =>
    file.type.startsWith("image/")
  );

  $("upload-button").disabled =
    !(hasImages && $("consent").checked);
});

// Upload placeholder
$("upload-button").addEventListener("click", () => {
  if (!auth.currentUser) {
    showStatus("upload-status", "Please sign in first.", true);
    return;
  }

  if (!$("consent").checked) {
    showStatus("upload-status", "Please agree to the upload terms.", true);
    return;
  }

  showStatus(
    "upload-status",
    "Account and navigation are working. Photo uploads will be enabled after the secure backend API is implemented.",
    true
  );
});

// Gallery reveal placeholder
$("reveal-button").addEventListener("click", () => {
  showStatus(
    "reveal-status",
    "Gallery reveal will be available after backend validation is implemented.",
    true
  );
});
