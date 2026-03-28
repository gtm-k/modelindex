# Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ModelIndex usable on phones and tablets using CSS media queries and minimal JS, without changing any desktop behavior.

**Architecture:** All styling lives in a single `<style>` block in `public/index.html`. We add `@media` rules at the end of that block. New HTML elements (mobile tab bar, bottom sheet wrappers) are added to the markup and hidden by default — shown only via media queries. A small amount of JS handles interactions that CSS alone can't (card expand, sheet toggle).

**Tech Stack:** Vanilla CSS media queries, vanilla JS, existing Lucide icons. No frameworks or build tools.

**Spec:** `docs/superpowers/specs/2026-03-27-mobile-responsiveness-design.md`

---

## File Map

All changes are in a single file: `public/index.html`

| Section | Lines (approx) | What changes |
|---------|----------------|--------------|
| `<style>` block | 34-500 | Append ~300 lines of `@media` rules before `</style>` |
| After `</nav>` (sidebar) | After line 539 | Insert `#mobile-tab-bar` HTML |
| After `#modal-overlay` | After line 563 | Insert filter bottom sheet + backdrop HTML |
| `_render()` in registry view | ~1340-1382 | Add `_renderMobileCards()` call alongside table |
| `_renderTable()` return | ~1284-1306 | Wrap with class for conditional display |
| After `_renderTable()` | After ~1307 | Add `_renderMobileCards()` function |
| Event binding section | ~1384+ | Add mobile card expand/collapse + filter sheet handlers |
| `showView()` | ~711-724 | Also toggle `.active` on `#mobile-tab-bar` buttons |
| `showModal()` | ~758 | No change needed — CSS handles width |
| `public/sw.js` | Line 2 | Bump cache version |

---

### Task 1: Add Mobile CSS Media Queries — Layout & Navigation

**Files:**
- Modify: `public/index.html:497-500` (insert before `</style>`)

This task adds the core responsive CSS: hiding sidebar, showing bottom tab bar, adjusting main content padding, and responsive modal/panel widths.

- [ ] **Step 1: Add mobile and tablet media query blocks before `</style>`**

Insert the following CSS immediately before line 500 (`</style>`):

```css
    /* ── Mobile: <= 768px ──────────────────────────────────────────────── */
    @media (max-width: 768px) {
      #sidebar { display: none; }
      #mobile-tab-bar {
        display: flex;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 56px;
        background: var(--color-surface);
        border-top: 1px solid var(--color-border);
        z-index: 100;
        justify-content: space-around;
        align-items: center;
        padding-bottom: env(safe-area-inset-bottom, 0);
      }
      .mob-tab {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 6px 12px;
        background: none;
        border: none;
        color: var(--color-text-3);
        font-size: 10px;
        cursor: pointer;
        min-width: 44px;
        min-height: 44px;
        justify-content: center;
      }
      .mob-tab.active { color: var(--color-primary); }
      .mob-tab svg { width: 20px; height: 20px; }

      #main-content { padding-bottom: 56px; }
      .view { padding: 16px; }

      /* Domain tabs: horizontal scroll */
      .domain-tabs {
        overflow-x: auto !important;
        white-space: nowrap !important;
        -webkit-overflow-scrolling: touch;
        flex-wrap: nowrap !important;
      }

      /* Preset/best-for row: horizontal scroll */
      #best-for-row {
        overflow-x: auto !important;
        white-space: nowrap !important;
        -webkit-overflow-scrolling: touch;
        flex-wrap: nowrap !important;
      }

      /* Toolbar: icon-only buttons */
      .view-header { flex-wrap: wrap; gap: 8px; }
      .view-header .btn-secondary span.btn-label { display: none; }
      .view-header .btn-secondary { padding: 8px; min-width: 36px; min-height: 36px; }

      /* Registry layout: stack vertically, hide filter panel */
      #registry-layout { flex-direction: column; }
      #registry-filter-panel { display: none; }

      /* Table hidden, cards shown on mobile */
      .registry-table-wrap { display: none; }
      .model-card-list { display: block; }

      /* Filter FAB */
      .filter-fab {
        display: flex;
        position: fixed;
        bottom: 72px;
        right: 16px;
        z-index: 90;
        background: var(--color-primary);
        color: #fff;
        border: none;
        border-radius: 28px;
        padding: 10px 18px;
        font-size: 13px;
        font-weight: 600;
        align-items: center;
        gap: 6px;
        box-shadow: var(--shadow-lg);
        cursor: pointer;
        min-height: 44px;
      }
      .filter-fab svg { width: 16px; height: 16px; }
      .filter-badge {
        background: var(--color-danger, #e74c3c);
        color: #fff;
        border-radius: 10px;
        font-size: 11px;
        padding: 1px 6px;
        margin-left: 2px;
      }

      /* Bottom sheet (filters + provenance) */
      .bottom-sheet-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        z-index: 200;
      }
      .bottom-sheet-backdrop.open { display: block; }
      .bottom-sheet {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        max-height: 75vh;
        background: var(--color-surface);
        border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        box-shadow: var(--shadow-lg);
        z-index: 201;
        transform: translateY(100%);
        transition: transform 0.3s ease;
        overflow-y: auto;
        padding: 20px;
      }
      .bottom-sheet.open { transform: translateY(0); }
      .bottom-sheet-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--color-border);
      }
      .bottom-sheet-header h3 { margin: 0; font-size: 16px; }

      /* Provenance panel → bottom sheet on mobile */
      #provenance-panel {
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        top: auto !important;
        width: 100% !important;
        max-height: 80vh;
        border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        transform: translateY(100%);
        transition: transform 0.3s ease;
        z-index: 201;
      }
      #provenance-panel:not(.hidden) { transform: translateY(0); }

      /* Modal: full width on mobile */
      .modal { max-width: calc(100vw - 32px) !important; }

      /* Mobile cards */
      .model-card-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .mob-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: 14px;
        cursor: pointer;
      }
      .mob-card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
      }
      .mob-card-name { font-weight: 600; font-size: 14px; }
      .mob-card-provider { font-size: 12px; color: var(--color-text-3); }
      .mob-card-mcs {
        font-size: 18px;
        font-weight: 700;
        color: var(--color-primary);
        line-height: 1;
      }
      .mob-card-mcs small {
        display: block;
        font-size: 10px;
        font-weight: 400;
        color: var(--color-text-3);
        margin-top: 2px;
      }
      .mob-card-tags {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 6px;
      }
      .mob-card-factors {
        display: none;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--color-border);
      }
      .mob-card.expanded .mob-card-factors { display: block; }
      .mob-card-factor-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .mob-card-factor {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        padding: 4px 0;
      }
      .mob-card-factor-label {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--color-text-2);
      }
      .mob-card-factor-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }
      .mob-card-expand-hint {
        text-align: center;
        font-size: 11px;
        color: var(--color-text-3);
        margin-top: 6px;
      }
      .mob-card.expanded .mob-card-expand-hint { display: none; }

      /* Index Builder: horizontal stepper */
      #wizard-shell { flex-direction: column !important; gap: 16px !important; }
      #wizard-steps {
        width: 100% !important;
        flex-direction: row !important;
        justify-content: center;
        gap: 8px !important;
      }
      .wizard-step-item {
        width: 32px !important;
        height: 32px !important;
        border-radius: 50% !important;
        padding: 0 !important;
        justify-content: center !important;
        min-width: 32px;
      }
      .wizard-step-item .step-label { display: none; }
      .wizard-step-item .step-num {
        width: 24px; height: 24px;
        font-size: 12px;
      }
      #wizard-body { padding: 16px !important; }
      #model-card-grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)) !important;
      }
    }

    /* ── Tablet: 769px - 1024px ────────────────────────────────────────── */
    @media (min-width: 769px) and (max-width: 1024px) {
      #sidebar {
        width: 56px;
        overflow: hidden;
      }
      #sidebar .nav-label { display: none; }
      #sidebar .nav-item {
        justify-content: center;
        padding: 12px 0;
      }
      #sidebar .sidebar-header span,
      #sidebar .sidebar-footer > div:first-child { display: none; }
      .registry-table-wrap { overflow-x: auto; }
      .registry-table td,
      .registry-table th { padding: 6px 8px; }
      #provenance-panel { width: 320px !important; }
    }

    /* ── Desktop: hide mobile-only elements ────────────────────────────── */
    @media (min-width: 769px) {
      #mobile-tab-bar { display: none; }
      .filter-fab { display: none; }
      .model-card-list { display: none; }
    }
```

- [ ] **Step 2: Verify the CSS is syntactically valid by loading the page locally**

Open `public/index.html` in a browser. The desktop layout should look identical to before — no visible changes. The new CSS classes only apply at mobile/tablet widths.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat(mobile): add responsive CSS media queries for mobile/tablet"
```

---

### Task 2: Add Mobile Tab Bar HTML

**Files:**
- Modify: `public/index.html:539-542` (insert after `</nav>`, before `<main>`)

- [ ] **Step 1: Insert mobile tab bar markup after the sidebar closing tag**

Insert the following HTML between `</nav>` (line 539) and `<!-- ── Main Content -->` (line 541):

```html
  <!-- ── Mobile Tab Bar (shown only at <= 768px via CSS) ─────────────── -->
  <nav id="mobile-tab-bar">
    <button class="mob-tab active" data-view="registry">
      <i data-lucide="database"></i>
      <span>Registry</span>
    </button>
    <button class="mob-tab" data-view="index-builder">
      <i data-lucide="sliders-horizontal"></i>
      <span>Builder</span>
    </button>
    <button class="mob-tab" data-view="my-indexes">
      <i data-lucide="bookmark"></i>
      <span>Indexes</span>
    </button>
    <button class="mob-tab" data-view="settings">
      <i data-lucide="settings"></i>
      <span>Settings</span>
    </button>
  </nav>
```

- [ ] **Step 2: Wire mobile tab bar clicks into `showView()`**

Find the `showView()` function (line ~711). After the line `if (nav)  nav.classList.add('active');`, add:

```javascript
  // Sync mobile tab bar
  document.querySelectorAll('.mob-tab').forEach(t => t.classList.remove('active'));
  const mobTab = document.querySelector(`.mob-tab[data-view="${viewId}"]`);
  if (mobTab) mobTab.classList.add('active');
```

- [ ] **Step 3: Add click handler for mobile tabs**

Find the DOMContentLoaded or init section where sidebar nav click handlers are wired (look for `document.querySelectorAll('.nav-item').forEach`). Add this block next to it:

```javascript
  // Mobile tab bar navigation
  document.querySelectorAll('.mob-tab').forEach(tab => {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  });
```

- [ ] **Step 4: Test at 375px width in DevTools**

Resize browser to 375px width. The sidebar should disappear and the bottom tab bar should appear. Tapping each tab should switch views. The active tab should highlight in the primary color.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat(mobile): add bottom tab bar navigation"
```

---

### Task 3: Add Mobile Card List Renderer

**Files:**
- Modify: `public/index.html` — add `_renderMobileCards()` function after `_renderTable()` (after line ~1307), and call it from `_render()` (line ~1380)

- [ ] **Step 1: Add `_renderMobileCards()` function after `_renderTable()`**

Insert this function after the closing `}` of `_renderTable()` (after line ~1307):

```javascript
  function _renderMobileCards(enriched) {
    const schema = App.state.factorSchema || [];
    const baseline = App.state.baseline || {};

    const cards = enriched.map(m => {
      const modelScores = Object.values(_scores[m.model_id] || {});
      const factorScores = {};
      for (const s of modelScores) {
        const b = baseline[s.sub_metric];
        if (!b) continue;
        let n = b.max === b.min ? 50 : ((s.raw_score - b.min) / (b.max - b.min)) * 100;
        n = Math.max(0, Math.min(100, n));
        if (b.invert) n = 100 - n;
        if (!factorScores[s.factor_group]) factorScores[s.factor_group] = [];
        factorScores[s.factor_group].push(n);
      }

      const factorRows = schema.map(f => {
        const vals = factorScores[f.factor_id] || [];
        const avg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
        const display = avg != null ? avg.toFixed(1) : '\u2014';
        return `<div class="mob-card-factor">
          <span class="mob-card-factor-label">
            <span class="mob-card-factor-dot" style="background:var(--factor-${f.factor_id})"></span>
            ${f.label.split(/[&,]/)[0].trim()}
          </span>
          <span style="font-weight:600">${display}</span>
        </div>`;
      }).join('');

      const licClass = m.license === 'MIT' || m.license === 'Apache-2.0' ? 'lic-ok'
        : m.license === 'Proprietary' ? 'lic-warn' : 'badge-neutral';

      return `<div class="mob-card" data-model-id="${m.model_id}">
        <div class="mob-card-top">
          <div>
            <div class="mob-card-name">${m.name}</div>
            <div class="mob-card-provider">${m.provider || ''}</div>
          </div>
          <div class="mob-card-mcs">
            ${m.mcs != null ? m.mcs.toFixed(1) : '\u2014'}
            <small>MCS</small>
          </div>
        </div>
        <div class="mob-card-tags">
          <span class="badge ${licClass}">${m.license || '\u2014'}</span>
        </div>
        <div class="mob-card-expand-hint">Tap for details</div>
        <div class="mob-card-factors">
          <div class="mob-card-factor-grid">
            ${factorRows}
          </div>
        </div>
      </div>`;
    }).join('');

    return `<div class="model-card-list">${cards}</div>`;
  }
```

- [ ] **Step 2: Call `_renderMobileCards()` in `_render()`**

Find the line in `_render()` that calls `_renderTable(_filtered)` (line ~1380). It's inside a ternary. Change:

```javascript
            : _renderTable(_filtered)}
```

to:

```javascript
            : _renderTable(_filtered) + _renderMobileCards(_filtered)}
```

This renders both the table and the card list into the DOM. CSS controls which one is visible based on screen width.

- [ ] **Step 3: Add card expand/collapse handler**

Find the event binding section in the registry view (after `_render()` is called, around line ~1384 where `lucide.createIcons()` is called). Add this after the existing event bindings:

```javascript
    // Mobile card expand/collapse
    container.querySelectorAll('.mob-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('a, button, input')) return;
        const wasExpanded = card.classList.contains('expanded');
        container.querySelectorAll('.mob-card.expanded').forEach(c => c.classList.remove('expanded'));
        if (!wasExpanded) card.classList.add('expanded');
      });
    });
```

- [ ] **Step 4: Test at 375px width**

Resize to 375px. The table should be hidden and model cards should appear. Tapping a card should expand it to show all factor scores. Tapping again (or another card) should collapse it.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat(mobile): add model card list for mobile registry view"
```

---

### Task 4: Add Filter Bottom Sheet

**Files:**
- Modify: `public/index.html` — add sheet HTML after `#modal-overlay` (line ~563), add FAB to `_render()`, add JS handlers

- [ ] **Step 1: Add bottom sheet HTML after `#modal-overlay`**

Insert after `<div id="modal-overlay" class="hidden"></div>` (line 563):

```html
<!-- Filter bottom sheet (mobile only) -->
<div id="filter-sheet-backdrop" class="bottom-sheet-backdrop"></div>
<div id="filter-sheet" class="bottom-sheet">
  <div class="bottom-sheet-header">
    <h3>Filters</h3>
    <button class="btn-ghost" id="filter-sheet-close" style="padding:4px">
      <i data-lucide="x" style="width:18px;height:18px"></i>
    </button>
  </div>
  <div id="filter-sheet-content"></div>
</div>
```

- [ ] **Step 2: Add filter FAB to `_render()` output**

In `_render()`, find the line `<div id="registry-layout">` (line ~1372). Insert this line just before it:

```javascript
      <button class="filter-fab" id="filter-fab-btn">
        <i data-lucide="filter"></i>
        <span>Filters</span>
      </button>
```

- [ ] **Step 3: Add filter sheet JS handlers**

Add these handlers in the event binding section of the registry view (after the mobile card handlers from Task 3):

```javascript
    // Filter FAB + bottom sheet
    const filterFab = document.getElementById('filter-fab-btn');
    const filterSheet = document.getElementById('filter-sheet');
    const filterBackdrop = document.getElementById('filter-sheet-backdrop');
    const filterSheetContent = document.getElementById('filter-sheet-content');
    const filterSheetClose = document.getElementById('filter-sheet-close');

    function openFilterSheet() {
      // Clone filter panel content into sheet
      const panel = document.getElementById('registry-filter-panel');
      if (panel && filterSheetContent) {
        filterSheetContent.innerHTML = panel.innerHTML;
        // Re-bind filter controls inside the sheet
        filterSheetContent.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.addEventListener('change', () => {
            // Sync the change back to the hidden panel and re-render
            const original = panel.querySelector(`input[data-filter="${cb.dataset.filter}"][value="${cb.value}"]`);
            if (original) original.checked = cb.checked;
            _render();
            // Re-open the sheet since _render() rebuilds DOM
            requestAnimationFrame(() => openFilterSheet());
          });
        });
        const slider = filterSheetContent.querySelector('input[type="range"]');
        if (slider) {
          slider.addEventListener('input', (e) => {
            const orig = panel.querySelector('input[type="range"]');
            if (orig) { orig.value = e.target.value; orig.dispatchEvent(new Event('input')); }
          });
        }
      }
      filterSheet.classList.add('open');
      filterBackdrop.classList.add('open');
    }
    function closeFilterSheet() {
      filterSheet.classList.remove('open');
      filterBackdrop.classList.remove('open');
    }

    if (filterFab) filterFab.addEventListener('click', openFilterSheet);
    if (filterBackdrop) filterBackdrop.addEventListener('click', closeFilterSheet);
    if (filterSheetClose) filterSheetClose.addEventListener('click', closeFilterSheet);

    // Update FAB badge with active filter count
    if (filterFab) {
      const activeCount = _getActiveFilterCount();
      const existing = filterFab.querySelector('.filter-badge');
      if (existing) existing.remove();
      if (activeCount > 0) {
        filterFab.insertAdjacentHTML('beforeend',
          `<span class="filter-badge">${activeCount}</span>`);
      }
    }
```

- [ ] **Step 4: Add `_getActiveFilterCount()` helper**

Add this function near the other filter-related functions in the registry view:

```javascript
  function _getActiveFilterCount() {
    let count = 0;
    if (_providerFilter.size > 0) count += _providerFilter.size;
    if (_licenseFilter.size > 0) count += _licenseFilter.size;
    if (_minMcs > 0) count++;
    return count;
  }
```

- [ ] **Step 5: Test at 375px width**

At mobile width: the filter panel should be hidden, a "Filters" FAB should float bottom-right. Tapping it should slide up a bottom sheet with filter controls. Toggling a filter should update the card list. The FAB should show a badge count when filters are active. Tapping the backdrop or X should close the sheet.

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "feat(mobile): add filter bottom sheet with FAB trigger"
```

---

### Task 5: Toolbar Button Labels & Provenance Sheet

**Files:**
- Modify: `public/index.html` — wrap button text in spans, adjust provenance for mobile

- [ ] **Step 1: Wrap toolbar button text labels in `<span class="btn-label">`**

In `_render()`, find the Compare, Export CSV, and Sync All buttons (lines ~1353-1366). Wrap the text in each button with `<span class="btn-label">`:

Change the Compare button text from:
```
Compare${_compareSet.size >= 2 ? ` (${_compareSet.size})` : ''}
```
to:
```
<span class="btn-label">Compare${_compareSet.size >= 2 ? ` (${_compareSet.size})` : ''}</span>
```

Change `Export CSV` to `<span class="btn-label">Export CSV</span>`.

Change `Sync All` to `<span class="btn-label">Sync All</span>`.

The CSS from Task 1 already hides `.btn-label` on mobile via `.view-header .btn-secondary span.btn-label { display: none; }`.

- [ ] **Step 2: Add provenance backdrop for mobile**

The provenance panel already exists in the HTML (line 566). The CSS from Task 1 repositions it as a bottom sheet on mobile. No additional HTML needed — the existing `#provenance-panel.hidden` / not-hidden toggle already works.

However, add a backdrop. Insert after the provenance `</aside>` (line 574):

```html
<div id="provenance-backdrop" class="bottom-sheet-backdrop"></div>
```

- [ ] **Step 3: Wire provenance backdrop close behavior**

Find where the provenance panel is opened (search for `provenance-panel` class toggle, around lines ~1445-1455). Add backdrop toggle alongside the panel:

```javascript
  // When opening provenance:
  document.getElementById('provenance-backdrop')?.classList.add('open');
  // When closing provenance:
  document.getElementById('provenance-backdrop')?.classList.remove('open');
```

Add a click handler for the backdrop to close provenance:

```javascript
  document.getElementById('provenance-backdrop')?.addEventListener('click', () => {
    document.getElementById('provenance-panel')?.classList.add('hidden');
    document.getElementById('provenance-backdrop')?.classList.remove('open');
  });
```

- [ ] **Step 4: Add CSS for provenance backdrop (mobile only)**

This is already covered by the `.bottom-sheet-backdrop` styles in Task 1. The `#provenance-backdrop` uses the same class.

- [ ] **Step 5: Test at 375px width**

Toolbar buttons should show only icons. Tapping a model card's factor score (when expanded) should trigger provenance — on mobile it should slide up from the bottom as a sheet with a backdrop. Tapping the backdrop should close it.

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "feat(mobile): icon-only toolbar buttons + provenance bottom sheet"
```

---

### Task 6: Bump Service Worker Cache & Final Verification

**Files:**
- Modify: `public/sw.js:2`

- [ ] **Step 1: Bump service worker cache version**

Change:
```javascript
const CACHE_NAME = 'modelindex-v4';
```
to:
```javascript
const CACHE_NAME = 'modelindex-v5';
```

- [ ] **Step 2: Full mobile test at 375px**

Test the complete flow at 375px width in Chrome DevTools:
1. Page loads → bottom tab bar visible, sidebar hidden.
2. Registry view → model cards visible (not table), preset pills scroll horizontally, domain tabs scroll horizontally.
3. Filter FAB visible → tap opens bottom sheet → filter toggles work → badge updates.
4. Tap card → expands with factor scores → tap again → collapses.
5. Switch tabs (Builder, Indexes, Settings) → views load correctly.
6. Verify no horizontal overflow on the page body.

- [ ] **Step 3: Tablet test at 768px-1024px**

Test at 800px:
1. Sidebar shows icon-only (56px width).
2. Registry table visible with horizontal scroll.
3. Provenance panel is 320px.
4. No bottom tab bar.

- [ ] **Step 4: Desktop test at 1440px**

Verify nothing changed:
1. Full sidebar with labels.
2. Full table with all columns.
3. Filter panel visible as sidebar.
4. No mobile elements visible.

- [ ] **Step 5: Commit and push**

```bash
git add public/index.html public/sw.js
git commit -m "feat(mobile): bump SW cache, finalize mobile responsiveness"
git push origin master
```
