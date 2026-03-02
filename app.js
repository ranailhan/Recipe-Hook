// Recipe Hook — Vanilla JS "brain"
// Note: Using an API key in client-side JS exposes it to users.
// For production, proxy requests through a backend you control.

// --- Configuration & DOM lookups ---------------------------------------------------------

const SPOONACULAR_API_KEY = "0206a511923c4868837b16a4802fbee8";
const SPOONACULAR_ENDPOINT = "https://api.spoonacular.com/recipes/findByIngredients";
const SPOONACULAR_RECIPE_INFO_ENDPOINT = "https://api.spoonacular.com/recipes";

const els = {
  form: document.getElementById("searchForm"),
  input: document.getElementById("search"),
  searchShell: document.getElementById("searchShell"),
  button: document.getElementById("findBtn"),
  spinner: document.getElementById("btnSpinner"),
  grid: document.getElementById("resultsGrid"),
  title: document.getElementById("resultsTitle"),
  subtitle: document.getElementById("resultsSubtitle"),
  message: document.getElementById("resultsMessage"),
  toastHost: document.getElementById("toastHost"),
  tplCard: document.getElementById("recipeCardTemplate"),
  tplSkeleton: document.getElementById("skeletonCardTemplate"),
};

let currentRequest = null;

// --- API helpers -------------------------------------------------------------------------

async function fetchRecipeInfo(recipeId, { signal } = {}) {
  const url = new URL(`${SPOONACULAR_RECIPE_INFO_ENDPOINT}/${recipeId}/information`);
  url.searchParams.set("includeNutrition", "false");
  url.searchParams.set("apiKey", SPOONACULAR_API_KEY);

  const res = await fetch(url.toString(), {
    method: "GET",
    signal,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Recipe info failed: ${res.status}`);
  }

  return res.json();
}

async function hydrateRecipeInfo(recipes, { signal } = {}) {
  const ids = recipes
    .map((r) => r?.id)
    .filter((id) => Number.isFinite(id) || typeof id === "number" || typeof id === "string");

  // Small concurrency limit to keep requests polite.
  const concurrency = 3;
  let idx = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < ids.length) {
      const id = ids[idx++];
      if (signal?.aborted) return;

      try {
        const info = await fetchRecipeInfo(id, { signal });
        if (signal?.aborted) return;

        const card = document.querySelector(`[data-recipe-id="${CSS.escape(String(id))}"]`);
        if (!card) continue;

        const timeEl = card.querySelector("[data-time]");
        const viewEl = card.querySelector("[data-view]");

        const mins = Number.isFinite(info?.readyInMinutes) ? info.readyInMinutes : null;
        if (timeEl) timeEl.textContent = mins === null ? "— min" : `${mins} min`;

        if (viewEl) {
          const href = typeof info?.sourceUrl === "string" ? info.sourceUrl : null;
          if (href) {
            viewEl.setAttribute("href", href);
            viewEl.classList.remove("opacity-70", "pointer-events-none");
            viewEl.setAttribute("aria-disabled", "false");
          } else {
            viewEl.classList.add("opacity-70", "pointer-events-none");
            viewEl.setAttribute("aria-disabled", "true");
          }
        }
      } catch {
        // Ignore per-card failures; keep the rest responsive.
      }
    }
  });

  await Promise.allSettled(workers);
}

// --- Input helpers -----------------------------------------------------------------------

function normalizeIngredients(raw) {
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped.join(", ");
}

function markInputInvalid() {
  const shell = els.searchShell;
  if (!shell || !els.input) return;

  shell.classList.add("input-invalid", "shake-once");
  els.input.setAttribute("aria-invalid", "true");

  window.setTimeout(() => {
    shell.classList.remove("shake-once");
  }, 260);

  window.setTimeout(() => {
    shell.classList.remove("input-invalid");
    els.input.removeAttribute("aria-invalid");
  }, 900);
}

// --- UI helpers (grid, messages, toasts) ------------------------------------------------

function setLoading(isLoading) {
  els.grid?.setAttribute("aria-busy", String(isLoading));
  if (els.button) els.button.disabled = isLoading;
  if (els.spinner) els.spinner.classList.toggle("hidden", !isLoading);
}

function clearGrid() {
  if (!els.grid) return;
  els.grid.innerHTML = "";
}

function showMessage(isVisible, { title, subtitle } = {}) {
  if (!els.message) return;
  els.message.classList.toggle("hidden", !isVisible);

  if (!isVisible) return;

  const titleEl = els.message.querySelector("p:nth-of-type(1)");
  const subEl = els.message.querySelector("p:nth-of-type(2)");
  if (titleEl && title) titleEl.textContent = title;
  if (subEl && subtitle) subEl.textContent = subtitle;
}

function renderSkeletons(count = 6) {
  clearGrid();
  showMessage(false);
  if (!els.grid || !els.tplSkeleton) return;

  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const node = els.tplSkeleton.content.firstElementChild.cloneNode(true);
    frag.appendChild(node);
  }
  els.grid.appendChild(frag);
}

function renderRecipes(recipes) {
  clearGrid();
  showMessage(false);

  if (!els.grid || !els.tplCard) return;

  const frag = document.createDocumentFragment();

  for (const r of recipes) {
    const card = els.tplCard.content.firstElementChild.cloneNode(true);
    card.dataset.recipeId = String(r.id ?? "");

    const img = card.querySelector("[data-img]");
    const meta = card.querySelector("[data-meta]");
    const title = card.querySelector("[data-title]");
    const sub = card.querySelector("[data-sub]");
    const badge = card.querySelector("[data-badge]");
    const time = card.querySelector("[data-time]");
    const view = card.querySelector("[data-view]");

    if (img) {
      img.src = r.image || "";
      img.alt = r.title || "Recipe image";
    }

    if (title) title.textContent = r.title || "Untitled recipe";

    const missed = Number.isFinite(r.missedIngredientCount) ? r.missedIngredientCount : null;
    if (meta) {
      meta.textContent =
        missed === null
          ? "Ingredients match"
          : missed === 0
            ? "No missed ingredients"
            : `Missed ingredients: ${missed}`;
    }

    if (sub) {
      sub.textContent =
        missed === null
          ? "Tap to view details (coming soon)."
          : missed === 0
            ? "You’ve got what you need — looks cookable."
            : "Close match — add a couple items and you’re set.";
    }

    if (badge) {
      if (typeof missed === "number" && missed > 0) {
        badge.textContent = `${missed} missing item${missed === 1 ? "" : "s"}`;
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    }

    if (time) time.textContent = "— min";

    if (view) {
      view.classList.add("opacity-70", "pointer-events-none");
      view.setAttribute("aria-disabled", "true");
    }

    frag.appendChild(card);
  }

  els.grid.appendChild(frag);
}

// --- Toast system ------------------------------------------------------------------------

function toast({ title, message, tone = "neutral" }) {
  if (!els.toastHost) return;

  const tones = {
    neutral: "border-white/70 bg-white/80 text-zinc-900",
    error: "border-rose-200/70 bg-rose-50/90 text-rose-950",
    success: "border-emerald-200/70 bg-emerald-50/90 text-emerald-950",
  };

  const wrapper = document.createElement("div");
  wrapper.className = [
    "pointer-events-auto overflow-hidden rounded-2xl border shadow-[0_18px_45px_-30px_rgba(0,0,0,0.45)] backdrop-blur",
    "transition duration-300 ease-out",
    "translate-y-2 opacity-0",
    tones[tone] ?? tones.neutral,
  ].join(" ");

  wrapper.innerHTML = `
    <div class="flex gap-3 p-4">
      <div class="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current/40"></div>
      <div class="min-w-0">
        <p class="text-sm font-semibold tracking-tight">${escapeHtml(title ?? "Notice")}</p>
        ${
          message
            ? `<p class="mt-1 text-sm leading-relaxed text-current/75">${escapeHtml(message)}</p>`
            : ""
        }
      </div>
      <button class="ml-auto -mr-1 rounded-xl p-1 text-current/60 transition hover:text-current/90" aria-label="Dismiss">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `;

  const btn = wrapper.querySelector("button");
  btn?.addEventListener("click", () => dismiss());

  els.toastHost.appendChild(wrapper);
  requestAnimationFrame(() => {
    wrapper.classList.remove("translate-y-2", "opacity-0");
  });

  const timeout = window.setTimeout(() => dismiss(), 4200);

  function dismiss() {
    window.clearTimeout(timeout);
    wrapper.classList.add("translate-y-2", "opacity-0");
    window.setTimeout(() => wrapper.remove(), 250);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --- Search flow -------------------------------------------------------------------------

async function findRecipes(ingredientsText) {
  const ingredients = normalizeIngredients(ingredientsText);
  if (!ingredients) {
    markInputInvalid();
    toast({
      title: "Add ingredients",
      message: "Type a few ingredients separated by commas (e.g., eggs, spinach, feta).",
      tone: "neutral",
    });
    return;
  }

  if (!SPOONACULAR_API_KEY || SPOONACULAR_API_KEY.includes("YOUR_")) {
    toast({
      title: "Missing API key",
      message:
        "Set your Spoonacular key in app.js (SPOONACULAR_API_KEY) and refresh the page.",
      tone: "error",
    });
    return;
  }

  // Cancel any in-flight request
  currentRequest?.abort?.();
  const controller = new AbortController();
  currentRequest = controller;

  els.title.textContent = "Searching recipes";
  els.subtitle.textContent = `Ingredients: ${ingredients}`;

  setLoading(true);
  renderSkeletons(6);

  try {
    const url = new URL(SPOONACULAR_ENDPOINT);
    url.searchParams.set("ingredients", ingredients);
    url.searchParams.set("number", "9");
    url.searchParams.set("ranking", "1");
    url.searchParams.set("ignorePantry", "true");
    url.searchParams.set("apiKey", SPOONACULAR_API_KEY);

    const res = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      let details = "";
      try {
        const errJson = await res.json();
        details = errJson?.message ? ` (${errJson.message})` : "";
      } catch {
        // ignore parsing errors
      }
      throw new Error(`API request failed: ${res.status}${details}`);
    }

    const data = await res.json();
    const recipes = Array.isArray(data) ? data : [];

    if (recipes.length === 0) {
      els.title.textContent = "No results";
      els.subtitle.textContent = `Nothing found for: ${ingredients}`;
      clearGrid();
      showMessage(true, {
        title: "No recipes found",
        subtitle: "Try fewer ingredients, or remove very specific items.",
      });
      return;
    }

    els.title.textContent = "Recipe results";
    els.subtitle.textContent = `Showing ${recipes.length} match${recipes.length === 1 ? "" : "es"} for: ${ingredients}`;
    renderRecipes(recipes);
    // Enrich cards with cooking time + source URL (optional).
    void hydrateRecipeInfo(recipes, { signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") return;

    els.title.textContent = "Something went wrong";
    els.subtitle.textContent = "Please try again in a moment.";
    clearGrid();
    showMessage(true, {
      title: "Couldn’t load recipes",
      subtitle: "Check your API key, network connection, and try again.",
    });
    toast({
      title: "Fetch failed",
      message: err instanceof Error ? err.message : "Unknown error",
      tone: "error",
    });
  } finally {
    if (currentRequest === controller) currentRequest = null;
    setLoading(false);
  }
}

// --- Event wiring ------------------------------------------------------------------------

els.form?.addEventListener("submit", (e) => {
  e.preventDefault();
  findRecipes(els.input?.value ?? "");
});

els.input?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.isComposing || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) {
    return;
  }
  e.preventDefault();
  if (els.form?.requestSubmit) {
    els.form.requestSubmit();
  } else {
    els.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }
});

