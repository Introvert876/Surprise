import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCRwg_4QZ1RTax0fR8YXHNUMKjTGlhoAFI",
  authDomain: "name-840f3.firebaseapp.com",
  projectId: "name-840f3",
  storageBucket: "name-840f3.firebasestorage.app",
  messagingSenderId: "522532386468",
  appId: "1:522532386468:web:1341b069b6c1fb919dd831",
  measurementId: "G-7NK90QTMCT"
};

// ============================================================
// BACKEND CONFIGURATION
// ============================================================

const BACKEND_URL =
  "https://script.google.com/macros/s/AKfycbwd5R1YTjVv1LfS8MxnFV69_sxosGRvxIyUR1sNUuWVnmAJHafcLASX-H96AaNicLU04g/exec";

const MINIMUM_PHOTOS = 30;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_BATCH_FILES = 100;

// Keep false until the backend security and upload contract
// have been tested.
const ENABLE_REAL_UPLOADS = true;

// ============================================================
// INITIALIZE FIREBASE
// ============================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);

let mode = "login";
let selectedFiles = [];
let busy = false;

// ============================================================
// STATUS AND UI HELPERS
// ============================================================

function showStatus(id, message, error = false) {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.style.color = error ? "#a4234d" : "#39764b";
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

function setBusy(value) {
  busy = value;

  if ($("auth-submit")) {
    $("auth-submit").disabled = value;
  }

  refreshUploadButton();

  if ($("reveal-button")) {
    $("reveal-button").disabled = value;
  }
}

function refreshUploadButton() {
  const button = $("upload-button");
  const consent = $("consent");

  if (!button || !consent) return;

  const hasImages = selectedFiles.some((file) =>
    file.type.startsWith("image/")
  );

  button.disabled =
    busy || !hasImages || !consent.checked;
}

function friendlyError(error) {
  const messages = {
    "auth/email-already-in-use":
      "An account already exists for this email.",

    "auth/invalid-email":
      "Enter a valid email address.",

    "auth/weak-password":
      "Use a password with at least 6 characters.",

    "auth/invalid-credential":
      "Email or password is incorrect.",

    "auth/user-not-found":
      "Email or password is incorrect.",

    "auth/wrong-password":
      "Email or password is incorrect.",

    "auth/too-many-requests":
      "Too many attempts. Wait and try again.",

    "auth/network-request-failed":
      "Network error. Check your internet connection."
  };

  return (
    messages[error?.code] ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

// ============================================================
// BACKEND REQUEST HELPER
// ============================================================

async function backendRequest(payload) {
  if (!BACKEND_URL) {
    throw new Error("Backend URL is not configured.");
  }

  if (!auth.currentUser) {
    throw new Error("Please sign in first.");
  }

  const idToken = await auth.currentUser.getIdToken();

  let response;

  try {
    response = await fetch(BACKEND_URL, {
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
  } catch (error) {
    console.error("Backend network error:", error);

    throw new Error(
      "Could not reach Apps Script. Check deployment and access settings."
    );
  }

  if (!response.ok) {
    throw new Error(
      `Backend request failed (HTTP ${response.status}).`
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      "Backend did not return JSON. Check the Apps Script deployment."
    );
  }

  if (!result || result.success !== true) {
    throw new Error(
      result?.error ||
      result?.message ||
      "Backend rejected the request."
    );
  }

  return result;
}

function resultBatchId(result) {
  return (
    result.batchId ||
    result.batch_id ||
    result.batch?.batch_id ||
    result.batch?.batchId ||
    null
  );
}

// ============================================================
// AUTHENTICATION MODE
// ============================================================

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
      ? "Sign in to continue."
      : "Create an account to continue.";

  showStatus("auth-status", "");
}

$("show-login").addEventListener("click", () => {
  setMode("login");
});

$("show-register").addEventListener("click", () => {
  setMode("register");
});

// ============================================================
// REGISTER AND LOGIN
// ============================================================

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (busy) return;

  const email = $("email").value.trim();
  const password = $("password").value;

  setBusy(true);

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

    } else {
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
    }

    await routeSignedInUser();

  } catch (error) {
    console.error("Authentication error:", error);

    showStatus(
      "auth-status",
      friendlyError(error),
      true
    );

  } finally {
    setBusy(false);
  }
});

// ============================================================
// PASSWORD RESET
// ============================================================

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
      friendlyError(error),
      true
    );
  }
});

// ============================================================
// SIGN OUT
// ============================================================

$("sign-out").addEventListener("click", async () => {
  try {
    await signOut(auth);

    resetSelection();
    showPanel("auth-panel");

  } catch (error) {
    console.error("Sign-out error:", error);

    showStatus(
      "upload-status",
      "Could not sign out. Please try again.",
      true
    );
  }
});

// ============================================================
// AUTHENTICATION STATE
// ============================================================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    resetSelection();
    showPanel("auth-panel");
    return;
  }

  $("signed-in-as").textContent =
    user.displayName
      ? `${user.displayName} (${user.email || ""})`
      : (user.email || "");

  await routeSignedInUser();
});

// ============================================================
// ROUTE AUTHENTICATED USERS
// ============================================================

async function routeSignedInUser() {
  if (!auth.currentUser) {
    showPanel("auth-panel");
    return;
  }

  $("signed-in-as").textContent =
    auth.currentUser.displayName
      ? `${auth.currentUser.displayName} (${auth.currentUser.email || ""})`
      : (auth.currentUser.email || "");

  if (!ENABLE_REAL_UPLOADS) {
    showPanel("upload-panel");

    showStatus(
      "upload-status",
      "Sign-in is available. Uploads and gallery access are disabled while backend security and compatibility are being checked."
    );

    refreshUploadButton();
    return;
  }

  try {
    const result = await backendRequest({
      action: "revealStatus"
    });

    const revealed = Boolean(
      result.revealed ||
      result.alreadyRevealed ||
      result.galleryRevealed ||
      result.hasRevealed
    );

    const eligible = Boolean(
      result.qualified ||
      result.eligible ||
      result.canReveal ||
      result.qualifies
    );

    if (revealed) {
      await loadGallery();

    } else if (eligible) {
      showPanel("reveal-panel");

      showStatus(
        "reveal-status",
        "Your photo challenge is complete. You can reveal the gallery."
      );

    } else {
      showPanel("upload-panel");

      showStatus(
        "upload-status",
        "Choose new photos to begin an attempt."
      );
    }

  } catch (error) {
    console.error("Reveal status error:", error);

    showPanel("upload-panel");

    showStatus(
      "upload-status",
      "Could not verify backend status. " + error.message,
      true
    );
  }
}

// ============================================================
// END OF PART 1
// ============================================================
// ============================================================
// PHOTO SELECTION
// ============================================================

function resetSelection() {
  selectedFiles = [];

  if ($("photos")) {
    $("photos").value = "";
  }

  if ($("consent")) {
    $("consent").checked = false;
  }

  if ($("selection-summary")) {
    $("selection-summary").textContent = "No files selected.";
  }

  refreshUploadButton();
}

$("photos").addEventListener("change", () => {
  selectedFiles = Array.from(
    $("photos").files || []
  );

  const images = selectedFiles.filter((file) =>
    file.type.startsWith("image/")
  );

  const nonImages =
    selectedFiles.length - images.length;

  const tooLarge = images.filter(
    (file) => file.size > MAX_FILE_SIZE_BYTES
  ).length;

  const totalBytes = images.reduce(
    (sum, file) => sum + file.size,
    0
  );

  let message =
    `${images.length} image(s) selected · ` +
    `${(totalBytes / 1048576).toFixed(1)} MB total.`;

  if (nonImages) {
    message +=
      ` ${nonImages} non-image file(s) will be ignored.`;
  }

  if (tooLarge) {
    message +=
      ` ${tooLarge} image(s) exceed the 5 MB limit.`;
  }

  $("selection-summary").textContent = message;

  refreshUploadButton();
});

// ============================================================
// UPLOAD CONSENT
// ============================================================

$("consent").addEventListener("change", () => {
  refreshUploadButton();
});

// ============================================================
// FILE CONVERSION
// ============================================================

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(
        new Error(`Could not read ${file.name}.`)
      );
    };

    reader.onload = () => {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");

      if (comma < 0) {
        reject(
          new Error(`Could not encode ${file.name}.`)
        );

        return;
      }

      resolve(value.slice(comma + 1));
    };

    reader.readAsDataURL(file);
  });
}

// ============================================================
// UPLOAD SELECTED PHOTOS
// ============================================================

$("upload-button").addEventListener("click", async () => {
  if (busy) return;

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

  // SECURITY LOCK:
  // Keep uploads disabled until backend verification is complete.

  if (!ENABLE_REAL_UPLOADS) {
    showStatus(
      "upload-status",
      "Uploads are disabled until backend security and deployment tests are complete. No photos were uploaded.",
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

  if (images.length > MAX_BATCH_FILES) {
    showStatus(
      "upload-status",
      `Choose no more than ${MAX_BATCH_FILES} images per attempt.`,
      true
    );

    return;
  }

  const oversized = images.find(
    (file) => file.size > MAX_FILE_SIZE_BYTES
  );

  if (oversized) {
    showStatus(
      "upload-status",
      `${oversized.name} exceeds the 5 MB per-image limit. Remove it and try again.`,
      true
    );

    return;
  }

  setBusy(true);

  let uploaded = 0;
  let duplicates = 0;
  let batchId = null;

  try {
    showStatus(
      "upload-status",
      "Starting a new upload attempt…"
    );

    // Consent is required by the Apps Script backend.
    const started = await backendRequest({
      action: "beginBatch",
      consent: true
    });

    batchId = resultBatchId(started);

    if (!batchId) {
      throw new Error(
        "Backend did not return a batch ID."
      );
    }

    // Five photos per request, with at most two requests running at once.
    // NOTE: Five 5 MB images can create a very large base64 payload.
    // If requests fail due to payload limits, reduce the per-image size
    // or the group size.
    const GROUP_SIZE = 5;
    const MAX_PARALLEL_GROUPS = 2;
    const groups = [];

    for (let start = 0; start < images.length; start += GROUP_SIZE) {
      groups.push(images.slice(start, start + GROUP_SIZE));
    }

    let nextGroupIndex = 0;
    let completedGroups = 0;
    let failure = null;

    async function uploadNextGroup() {
      while (true) {
        if (failure) return;

        const groupIndex = nextGroupIndex++;
        if (groupIndex >= groups.length) return;

        const group = groups[groupIndex];
        const groupNumber = groupIndex + 1;

        try {
          showStatus(
            "upload-status",
            `Preparing group ${groupNumber} of ${groups.length} (${group.length} photo(s))…`
          );

          const photos = await Promise.all(group.map(async (file) => ({
            originalFilename: file.name,
            mimeType: file.type,
            fileSize: file.size,
            base64Data: await fileToBase64(file)
          })));

          const result = await backendRequest({
            action: "uploadPhotoBatch",
            batchId: batchId,
            consent: true,
            photos: photos
          });

          if (
            !Array.isArray(result.results) ||
            result.results.length !== group.length
          ) {
            throw new Error(
              `Group ${groupNumber} returned an invalid response. Check backend records before retrying.`
            );
          }

          for (const item of result.results) {
            if (
              item.duplicate === true &&
              item.success === true
            ) {
              duplicates++;

            } else if (
              item.uploaded === true &&
              item.success === true
            ) {
              uploaded++;

            } else {
              throw new Error(
                `Upload result for ${item.filename || "a photo"} was not confirmed: ` +
                `${item.error || "check backend records before retrying."}`
              );
            }
          }

          completedGroups++;

          showStatus(
            "upload-status",
            `Completed ${completedGroups} of ${groups.length} groups. ` +
            `${uploaded} uploaded, ${duplicates} duplicates rejected.`
          );

        } catch (error) {
          failure = error;
          throw error;
        }
      }
    }

    const workers = Array.from(
      {
        length: Math.min(
          MAX_PARALLEL_GROUPS,
          groups.length
        )
      },
      () => uploadNextGroup()
    );

    const workerResults = await Promise.allSettled(workers);

    const failedWorker = workerResults.find(
      (item) => item.status === "rejected"
    );

    if (failedWorker) {
      throw failedWorker.reason;
    }

    showStatus(
      "upload-status",
      "Checking this attempt…"
    );

    const finished = await backendRequest({
      action: "finishBatch",
      batchId
    });

    // The server is the authority on qualification.
    const count = Number(
      finished.newUniquePhotos
    );

    const qualifies = finished.qualifies === true;

    if (!Number.isFinite(count)) {
      throw new Error(
        "The backend returned an invalid photo count."
      );
    }

    resetSelection();

    if (qualifies) {
      showPanel("reveal-panel");

      showStatus(
        "reveal-status",
        `This attempt qualifies with ${count} new unique photos. You can reveal the gallery.`
      );

    } else {
      showPanel("upload-panel");

      showStatus(
        "upload-status",
        `This attempt has ${count} new unique photos. At least ${MINIMUM_PHOTOS} are required in one attempt. Photos from an incomplete attempt cannot count toward another attempt.`,
        true
      );
    }

  } catch (error) {
    console.error("Upload error:", error);

    showStatus(
      "upload-status",
      `Upload stopped after ${uploaded} confirmed upload(s). ` +
      `${error.message} Check backend records before retrying.`,
      true
    );
      } finally {
    setBusy(false);
    refreshUploadButton();
  }
});

// ============================================================
// GALLERY REVEAL
// ============================================================

$("reveal-button").addEventListener("click", async () => {
  if (busy) return;

  if (!auth.currentUser) {
    showStatus(
      "reveal-status",
      "Please sign in first.",
      true
    );
    return;
  }

  if (!ENABLE_REAL_UPLOADS) {
    showStatus(
      "reveal-status",
      "Gallery reveal is disabled until backend security and deployment are verified.",
      true
    );
    return;
  }

  const confirmed = window.confirm(
    "Reveal the private gallery now? This action will be recorded."
  );

  if (!confirmed) return;

  setBusy(true);

  try {
    const result = await backendRequest({
      action: "revealGallery",
      consent: true
    });

    showStatus(
      "reveal-status",
      result.alreadyRevealed
        ? "Your gallery is already unlocked."
        : "Gallery unlocked successfully."
    );

    await loadGallery();

  } catch (error) {
    console.error("Gallery reveal error:", error);

    showStatus(
      "reveal-status",
      error.message || "Unable to unlock the gallery.",
      true
    );

  } finally {
    setBusy(false);
  }
});

// ============================================================
// LOAD PRIVATE GALLERY
// ============================================================

async function loadGallery() {
  if (!auth.currentUser) return;

  if (!ENABLE_REAL_UPLOADS) {
    showPanel("upload-panel");

    showStatus(
      "upload-status",
      "Gallery access is disabled until backend verification is complete.",
      true
    );

    return;
  }

  showPanel("gallery-panel");
  $("gallery").replaceChildren();

  const loading = document.createElement("p");
  loading.textContent = "Loading your private gallery…";
  $("gallery").appendChild(loading);

  try {
    const result = await backendRequest({
      action: "listGallery"
    });

    const images = Array.isArray(result.images)
      ? result.images
      : [];

    $("gallery").replaceChildren();

    if (images.length === 0) {
      const empty = document.createElement("p");

      empty.textContent =
        "The gallery is unlocked, but no pictures are available yet.";

      $("gallery").appendChild(empty);

      showStatus(
        "reveal-status",
        "Gallery unlocked, but no photos were found."
      );

      return;
    }

    for (const item of images) {
      if (!item.id) continue;

      const figure = document.createElement("figure");
      const image = document.createElement("img");
      const caption = document.createElement("figcaption");

      image.alt = item.name || "Private gallery photo";
      image.loading = "lazy";
      image.decoding = "async";

      caption.textContent = item.name || "Our memory";

      figure.append(image, caption);
      $("gallery").appendChild(figure);

      try {
        const imageResult = await backendRequest({
          action: "getGalleryImage",
          fileId: item.id
        });

        const allowedMimeTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif"
        ];

        const mimeType = allowedMimeTypes.includes(
          imageResult.mimeType
        )
          ? imageResult.mimeType
          : "image/jpeg";

        if (!imageResult.base64) {
          throw new Error("No image data was returned.");
        }

        image.src =
          `data:${mimeType};base64,${imageResult.base64}`;

      } catch (error) {
        console.error(
          "Gallery image load failed:",
          item.name,
          error
        );

        figure.remove();
      }
    }

    if (!$("gallery").children.length) {
      const message = document.createElement("p");

      message.textContent =
        "Gallery images could not be loaded. Please try again later.";

      $("gallery").appendChild(message);
    }

    showStatus(
      "reveal-status",
      "Your private gallery is ready."
    );

  } catch (error) {
    console.error("Gallery loading error:", error);

    showStatus(
      "reveal-status",
      error.message || "Unable to load the gallery.",
      true
    );
  }
}

// ============================================================
// REQUIRED HTML ELEMENT CHECK
// ============================================================

const requiredIds = [
  "auth-panel",
  "show-login",
  "show-register",
  "auth-form",
  "name-wrap",
  "display-name",
  "email",
  "password",
  "confirm-wrap",
  "confirm-password",
  "auth-note",
  "auth-submit",
  "reset-password",
  "auth-status",
  "upload-panel",
  "signed-in-as",
  "sign-out",
  "consent",
  "photos",
  "selection-summary",
  "upload-button",
  "upload-status",
  "reveal-panel",
  "reveal-button",
  "reveal-status",
  "gallery-panel",
  "gallery"
];

const missingIds = requiredIds.filter(
  (id) => !document.getElementById(id)
);

if (missingIds.length > 0) {
  console.error(
    "Missing HTML elements in index.html:",
    missingIds
  );
} else {
  console.log("All required HTML elements were found.");
}

// ============================================================
// END OF APP.JS
// ============================================================
