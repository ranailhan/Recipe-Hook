# Recipe Hook

Modern, minimalist recipe finder with a glassmorphism header, image-first “Instagram-style” cards, and a smooth loading + toast UX. Built with **Tailwind CSS** and **Vanilla JavaScript**, powered by the **Spoonacular API**.

## Features

- **Ingredient search (comma-separated)** using Spoonacular `findByIngredients`
- **Responsive grid**: 1 column (mobile), 2 (tablet), 3–4 (desktop)
- **Vibe interactions**
  - Card hover: image `scale-105`, dark overlay, fade-in actions
  - Missing-ingredients badge (e.g. “2 missing items”)
- **Great UX states**
  - Skeleton loading screen
  - Toast notifications for errors / validation
  - Enter key submits search
  - Empty input triggers a subtle **shake** + temporary **red border**

## Tech Stack

- **HTML**
- **Tailwind CSS v4** (CSS-first import)
- **Vanilla JS** (ES Modules)
- **Spoonacular API**

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Add your Spoonacular API key

Open `app.js` and set:

- `SPOONACULAR_API_KEY = "YOUR_KEY_HERE"`

> Note: This demo uses the API key in the browser. For a real production app, proxy requests through a backend to keep keys private.

### 3) Build Tailwind CSS

```bash
npm run build
```

Or run in watch mode while you edit:

```bash
npm run dev
```

### 4) Run the app

This is a static site. Open `index.html` in your browser.

For best results (and to avoid any local file/module quirks), use a simple local server (for example via a VS Code “Live Server” extension).

## How It Works

- Search form submits ingredients (comma-separated).
- App calls:
  - `GET https://api.spoonacular.com/recipes/findByIngredients`
- Results render into square image cards (title + missed ingredient count).
- Optional enrichment (per-card):
  - `GET https://api.spoonacular.com/recipes/{id}/information`
  - Used to display **cooking time** (`readyInMinutes`) and enable the **View Recipe** link (`sourceUrl`).

## Project Structure

```text
Recipe-Hook/
  index.html          # UI + templates (cards, skeletons, toast host)
  app.js              # API calls + rendering + UX states
  src/styles.css      # Tailwind import + small custom CSS (shake/invalid)
  dist/styles.css     # Built Tailwind output
  package.json
```

## Notes / Limitations

- **API key exposure**: client-side keys can be viewed by users.
- **Quota**: enriching cooking time uses extra API calls (one per recipe card), which can impact rate limits/quota.
- **No recipe detail page yet**: “View Recipe” opens the `sourceUrl` from Spoonacular (when available).

## Roadmap Ideas

- Recipe details modal (ingredients list, steps, nutrition)
- Saved recipes (localStorage) + history
- Debounced search + ingredient chips UI
- Backend proxy for API key security + caching

## License

MIT

