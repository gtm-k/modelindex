# Mobile Responsiveness Design Spec

**Date:** 2026-03-27
**Status:** Approved
**Scope:** Make ModelIndex usable on phones and tablets via CSS media queries and minimal JS additions. No architectural changes; desktop behavior stays identical.

---

## 1. Breakpoints

| Token | Range | Target |
|-------|-------|--------|
| `--bp-mobile` | `max-width: 768px` | Phones (portrait and landscape) |
| `--bp-tablet` | `769px - 1024px` | Tablets, small laptops |
| `--bp-desktop` | `> 1024px` | Current layout, unchanged |

All responsive behavior is driven by CSS `@media` rules in the existing `<style>` block. No JavaScript device detection.

---

## 2. Navigation: Bottom Tab Bar

**Current state:** Fixed 220px left sidebar with 4 nav items + sync status + theme toggle.

**Mobile (`<= 768px`):**
- Hide `#sidebar` (`display: none`).
- Show a new `#mobile-tab-bar` fixed to the bottom of the viewport.
- 4 tabs in a row: Registry, Builder, Indexes, Settings. Each tab is an icon (existing Lucide icons) + label text below it.
- Active tab highlighted with `--color-primary`.
- Sync status indicator moves into the top-right corner of `#main-content` (already exists there as `#sync-dot`).
- Theme toggle moves into Settings view on mobile.
- Tab bar height: 56px. Touch targets: 44px minimum per Apple/Google HIG.
- `#main-content` gets `padding-bottom: 56px` to avoid content being hidden behind the tab bar.

**Tablet (`769px - 1024px`):**
- Sidebar narrows to icon-only (56px width), with tooltips on hover. Labels hidden.
- No bottom tab bar.

**Desktop (`> 1024px`):**
- No changes.

**HTML change:** Add a `<nav id="mobile-tab-bar">` element after `#sidebar` in the markup, hidden by default, shown via media query.

**JS change:** Wire the same `showView()` click handlers to the mobile tab buttons. Keep `#sidebar` nav handlers intact for desktop.

---

## 3. Registry View: Card Layout

**Current state:** `<table>` with 12+ columns (checkbox, model, MCS, 10 factor scores, license, cost). Filter panel is a fixed 220px sidebar left of the table.

### 3.1 Model Cards (replaces table on mobile)

**Mobile (`<= 768px`):**
- Hide `.registry-table-wrap`.
- Show a new `.model-card-list` container with vertically stacked cards.
- Each card contains:
  - **Top row:** Model name (bold), provider name (muted).
  - **Score row:** MCS score (large, colored badge) + horizontal score bar.
  - **Tags row:** License badge + cost (if present).
  - **Tap to expand:** Expands to show all factor scores in a 2-column grid (factor label + score). Each score uses the same colored bar as the desktop table.
- Cards are rendered by iterating the same sorted/filtered model array used by the table renderer. No duplicate data logic.
- Expand/collapse is CSS-driven (`.model-card.expanded`) toggled by a click handler.
- Only one card expanded at a time (expanding one collapses the previous).

**Tablet (`769px - 1024px`):**
- Keep the table, but:
  - Horizontally scrollable with `overflow-x: auto` on `.registry-table-wrap`.
  - Model name column sticky (`position: sticky; left: 0`).
  - Reduce padding from 12px to 8px.

**Desktop (`> 1024px`):**
- No changes.

### 3.2 Filter Bottom Sheet

**Mobile (`<= 768px`):**
- Hide `#registry-filter-panel`.
- Show a floating action button (FAB) labeled "Filters" with a funnel icon, positioned bottom-right (above the tab bar).
- Tapping the FAB opens a bottom sheet overlay:
  - Semi-transparent backdrop (click to dismiss).
  - Sheet slides up from bottom, max-height 75vh, scrollable.
  - Contains the same filter controls: Provider checkboxes, License checkboxes, Min MCS slider, Show hardware toggle, Clear filters button, License Checker button.
  - "Apply" / "X" button at top to close.
- Active filter count shown as a badge on the FAB (e.g., "Filters (3)").

**CSS:** The bottom sheet uses `transform: translateY(100%)` hidden, `translateY(0)` visible, with a `transition` for the slide animation.

**JS additions:**
- `openFilterSheet()` / `closeFilterSheet()` toggle a class on the sheet element.
- Filter controls are cloned into the sheet on mount. Changes in the sheet call the same filter logic and refresh the card list.

**Tablet + Desktop:**
- No changes to filter panel.

### 3.3 Preset Tabs

**Mobile (`<= 768px`):**
- Preset row (All, General, Code Agent, Research, etc.) becomes horizontally scrollable.
- `overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch;` on the container.
- No visual change to individual pills, just scroll behavior.

**Tablet + Desktop:**
- No changes.

### 3.4 Toolbar (Compare, Export CSV, Sync All)

**Mobile (`<= 768px`):**
- Buttons become icon-only (hide text labels).
- Use `title` attributes for accessibility.
- Reduce button sizes to fit in a row.

**Tablet + Desktop:**
- No changes.

### 3.5 Score Provenance Panel

**Current state:** Fixed 380px panel slides in from the right when a score cell is clicked.

**Mobile (`<= 768px`):**
- Provenance becomes a full-width bottom sheet (same pattern as filter sheet).
- Slides up from bottom, max-height 80vh, scrollable.
- Close button at top-right.
- Backdrop click to dismiss.

**Tablet:**
- Keep right panel but reduce width to 320px.

**Desktop:**
- No changes.

---

## 4. Index Builder (Secondary)

**Current state:** 2-column layout — 200px step sidebar + main wizard body.

**Mobile (`<= 768px`):**
- Step sidebar becomes a horizontal stepper/progress bar at the top.
- Show step numbers (1-6) as circles in a row, with the active step highlighted.
- Step labels hidden (just numbers). Active step label shown as a heading above the wizard body.
- Wizard body goes full-width, reduced padding (16px instead of 24px).
- Model card grid: `minmax(200px, 1fr)` already somewhat responsive. Reduce to `minmax(160px, 1fr)`.
- Sensitivity chart: full-width, reduce height.

**Tablet:**
- Keep 2-column but narrow step sidebar to 160px.

**Desktop:**
- No changes.

---

## 5. My Indexes (Secondary)

**Current state:** List of saved indexes in card-like rows.

**Mobile (`<= 768px`):**
- Cards go full-width, stack vertically.
- Action buttons (delete, export) move below the card content instead of inline-right.
- Reduced padding.

**Tablet + Desktop:**
- No changes.

---

## 6. Settings (Secondary)

**Current state:** Form-like layout with sections.

**Mobile (`<= 768px`):**
- Full-width sections, reduced padding.
- Theme toggle relocated here from sidebar.
- Inputs and buttons go full-width.

**Tablet + Desktop:**
- No changes.

---

## 7. Global Mobile Adjustments

### Typography
- No responsive font scaling. Current 13px base is already readable on mobile.
- Headings may need minor reductions (h2 from 20px to 18px).

### Spacing
- View padding reduces from 24px to 16px on mobile.
- Card/section padding reduces from 16px to 12px.

### Touch Targets
- All interactive elements (buttons, checkboxes, nav items) must be minimum 44x44px tap targets.
- Checkbox rows in filters get increased height.

### Modals
- Max-width changes from 520px to `calc(100vw - 32px)` on mobile.
- Full-screen for modals with significant content (comparison modal).

### Domain Tab Bar (LLMs, Robotics, Weather, Materials)
- Horizontally scrollable, same treatment as preset tabs.

---

## 8. Implementation Approach

### What changes:
- **CSS:** Add `@media` blocks to the existing `<style>` element in `index.html`. Estimated 200-300 lines of media queries.
- **HTML:** Add `#mobile-tab-bar` nav element. Add bottom sheet wrapper elements for filters and provenance.
- **JS:** Add handlers for: mobile tab bar clicks, filter sheet open/close, card expand/collapse, provenance sheet on mobile. Estimated 50-80 lines.

### What does not change:
- All existing desktop CSS, HTML structure, and JS logic.
- Data flow, MCS computation, sync pipeline.
- Service worker, data files, build process.

### Rendering strategy:
- Both table and card list exist in DOM. CSS `display: none` / `display: block` based on media query controls which is visible.
- Card list is rendered by the same `refresh()` function that renders the table — a new `_renderMobileCards()` helper called alongside `_renderRows()`.

### Testing:
- Chrome DevTools device emulation for common phone widths (375px iPhone SE, 390px iPhone 14, 412px Pixel).
- Tablet widths (768px iPad Mini, 1024px iPad).
- Verify desktop unchanged at 1440px+.

---

## 9. Out of Scope

- Native app or PWA install prompt.
- Offline-first mobile experience (service worker already handles this).
- Gesture navigation (swipe between views).
- Mobile-specific data fetching optimizations.
- Landscape-specific layouts (portrait is the priority; landscape uses tablet breakpoint).
