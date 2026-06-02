# Search-First Picker UX Plan

## Problem

The analyze page (`pages/analyze/`) uses native `<picker>` components for general (112 items) and tactic (174+ items) selection. Users must scroll through the entire unsorted list to find a specific item — no search, no filter, no grouping.

## Solution

Replace flat pickers with a search-first overlay component. User taps a general card or tactic field → a modal opens with a search input at top + scrollable result list below → type to filter → tap to select.

## Scope

- **General picker**: 3 slots × 112 items. Display: faction color dot + name + cost + quality.
- **Tactic picker**: 6 slots × 174+ items. Display: quality badge + name + type + troop limit.
- **Scenario/Troop pickers**: 3 and 5 items respectively — keep as native `<picker>` (no search needed).

## Architecture

### New file: `components/search-picker/`

A reusable WeChat custom component with:
- **Properties**: `type` ("generals" | "tactics"), `selectedId`, `visible`
- **Events**: `bind:select` (emits selected item ID), `bind:close`
- **Internal state**: `keyword`, `filtered` (search results), `scrollIntoView`
- **Search**: delegates to `catalog.searchRecords(type, keyword)`
- **Display limit**: 60 items (perf guard for WXML rendering)
- **Faction filter** (generals only): horizontal chip row for 魏/蜀/吴/群
- **Quality filter** (tactics only): horizontal chip row for S/A/B

Files:
- `components/search-picker/index.js`
- `components/search-picker/index.wxml`
- `components/search-picker/index.wxss`
- `components/search-picker/index.json`

### Modified: `pages/analyze/index.wxml`

- Replace `<picker range="{{generalOptions}}" ...>` with:
  ```xml
  <search-picker type="generals" selected-id="{{item.id}}" visible="{{pickerState.slot === slot && pickerState.type === 'generals'}}" bind:select="onGeneralPick" bind:close="closePicker" data-slot="{{slot}}" />
  ```
- Replace `<picker range="{{tacticOptions}}" ...>` with similar pattern.
- Keep the general card / tactic field as tap targets (bindtap opens picker).

### Modified: `pages/analyze/index.js`

- Add `pickerState: { visible: false, slot: -1, type: "" }` to data.
- Add `openPicker(slot, type)` — sets `pickerState`.
- Add `closePicker()` — clears `pickerState`.
- Add `onGeneralPick(e)` — receives `e.detail.id`, finds index in `generals` array, updates `selectedGeneralIndexes[slot]`, calls `refreshSelection()`.
- Add `onTacticPick(e)` — same pattern for tactics.
- Remove `generalOptions`/`tacticOptions` from data (no longer needed).
- Remove `onGeneralChange`/`onTacticChange` (replaced by pick handlers).

### Modified: `pages/analyze/index.json`

- Register the component:
  ```json
  { "usingComponents": { "search-picker": "/components/search-picker/index" } }
  ```

## UX Details

1. **Opening**: tap general card → picker modal slides up from bottom. Auto-focus search input.
2. **Searching**: real-time filtering as user types. Empty search shows all items (grouped by faction for generals, by quality for tactics).
3. **Selecting**: tap item → modal closes, selection updates, card re-renders.
4. **Closing**: tap backdrop or X button → modal closes, no change.
5. **Current selection highlight**: the currently selected item has a gold border/checkmark.
6. **Keyboard**: search input has `confirm-type="search"` and `auto-focus` on modal open.

## Files Changed

| File | Action |
|------|--------|
| `components/search-picker/index.js` | Create |
| `components/search-picker/index.wxml` | Create |
| `components/search-picker/index.wxss` | Create |
| `components/search-picker/index.json` | Create |
| `pages/analyze/index.js` | Modify (picker state, remove old picker handlers) |
| `pages/analyze/index.wxml` | Modify (replace pickers with component + tap targets) |
| `pages/analyze/index.json` | Modify (register component) |

## What Stays the Same

- `pages/analyze/index.wxss` — no changes needed (component has own styles)
- `utils/catalog.js` — `searchRecords` already works, no changes
- `utils/scoring.js` — untouched
- `services/api.js` — untouched
- `pages/analyze/index.js` → `analyze()`, `saveLineup()`, `refreshSelection()` — logic unchanged

## Risks

- **Performance**: 174 tactics in WXML list — mitigated by 60-item display cap + search-first (most queries return <10 results).
- **WeChat component auto-focus**: `auto-focus` on `<input>` inside a custom component may not work on all devices — fallback: show a "tap to search" prompt.
- **Picker state collision**: if user taps a general picker while a tactic picker is open — handled by single `pickerState` object (only one picker open at a time).
