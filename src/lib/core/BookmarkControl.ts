import "../styles/common.css";
import "../styles/bookmark-control.css";
import type {
  IControl,
  Map as MapLibreMap,
  ControlPosition,
} from "maplibre-gl";
import type {
  BookmarkControlOptions,
  BookmarkControlState,
  BookmarkEvent,
  BookmarkEventHandler,
  BookmarkExportMode,
  MapBookmark,
} from "./types";
import { generateId } from "../utils/helpers";

/**
 * Default options for the BookmarkControl.
 */
const DEFAULT_OPTIONS: Required<BookmarkControlOptions> = {
  position: "top-right",
  className: "",
  visible: true,
  collapsed: true,
  bookmarks: [],
  storageKey: "",
  maxBookmarks: 20,
  generateThumbnails: false,
  flyToDuration: 1500,
  panelWidth: 260,
  maxHeight: 500,
  backgroundColor: "",
  borderRadius: 4,
  fontSize: 12,
  fontColor: "",
  minzoom: 0,
  maxzoom: 24,
  resizable: true,
  reorderable: true,
  selectable: false,
  captureState: () => undefined,
  restoreState: () => {},
  captureStateLabel: "",
  captureStateDefault: true,
  captureStateTooltip: "",
  showMetadata: true,
  showExportAll: false,
  exportLabel: "Export",
  exportSelectedLabel: "Export Selected",
  exportAllLabel: "Export All",
};

/**
 * SVG icon for the bookmark button.
 */
const BOOKMARK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

/**
 * SVG icon for close button.
 */
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

/**
 * SVG icon for add/plus.
 */
const PLUS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

/**
 * SVG icon for trash/delete.
 */
const TRASH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

/**
 * SVG icon for edit/pencil.
 */
const EDIT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;

/**
 * SVG icon for map/location.
 */
const MAP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`;

/**
 * SVG icon for the drag-to-reorder grip handle.
 */
const GRIP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>`;

/**
 * SVG icon for download/export.
 */
const DOWNLOAD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

/**
 * SVG icon for upload/import.
 */
const UPLOAD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

/**
 * SVG icon for an information hint.
 */
const INFO_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

/**
 * Format a date for display.
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * A control for saving and restoring map bookmarks/views.
 *
 * @example
 * ```typescript
 * const bookmarkControl = new BookmarkControl({
 *   storageKey: 'my-map-bookmarks',
 *   flyToDuration: 2000,
 * });
 * map.addControl(bookmarkControl, 'top-right');
 *
 * bookmarkControl.on('select', (event) => {
 *   console.log('Selected bookmark:', event.bookmark);
 * });
 * ```
 */
export class BookmarkControl implements IControl {
  private _container?: HTMLElement;
  private _button?: HTMLButtonElement;
  private _panel?: HTMLElement;
  private _options: Required<BookmarkControlOptions>;
  private _state: BookmarkControlState;
  private _eventHandlers: Map<BookmarkEvent, Set<BookmarkEventHandler>> =
    new Map();
  private _map?: MapLibreMap;
  private _handleZoom?: () => void;
  private _zoomVisible: boolean = true;
  /** Whether the next added bookmark should capture host state (467). */
  private _captureEnabled: boolean;
  /** IDs of bookmarks ticked for selective export (470). */
  private _exportSelection: Set<string> = new Set();
  /** ID of the bookmark currently being dragged for reordering (471). */
  private _dragId: string | null = null;

  // DOM elements
  private _listEl?: HTMLElement;
  private _nameInput?: HTMLInputElement;

  /**
   * Creates a new BookmarkControl instance.
   */
  constructor(options?: BookmarkControlOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._captureEnabled = this._options.captureStateDefault;
    this._state = {
      visible: this._options.visible,
      collapsed: this._options.collapsed,
      bookmarks: [...this._options.bookmarks],
      selectedId: null,
    };

    // Load from localStorage if storageKey is set
    if (this._options.storageKey) {
      this._loadFromStorage();
    }
  }

  /**
   * Called when the control is added to the map.
   */
  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._container = this._createContainer();
    this._setupZoomHandler();

    if (!this._state.collapsed) {
      this._showPanel();
    }

    return this._container;
  }

  /**
   * Called when the control is removed from the map.
   */
  onRemove(): void {
    if (this._handleZoom && this._map) {
      this._map.off("zoom", this._handleZoom);
    }

    this._container?.remove();
    this._container = undefined;
    this._map = undefined;
  }

  /**
   * Get the default position for this control.
   */
  getDefaultPosition(): ControlPosition {
    return this._options.position as ControlPosition;
  }

  /**
   * Register an event handler.
   */
  on(event: BookmarkEvent, handler: BookmarkEventHandler): this {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
    return this;
  }

  /**
   * Remove an event handler.
   */
  off(event: BookmarkEvent, handler: BookmarkEventHandler): this {
    this._eventHandlers.get(event)?.delete(handler);
    return this;
  }

  /**
   * Emit an event to registered handlers.
   */
  private _emit(
    event: BookmarkEvent,
    extra?: { bookmark?: MapBookmark },
  ): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const eventData = {
        type: event,
        state: { ...this._state },
        ...extra,
      };
      handlers.forEach((handler) => handler(eventData));
    }
  }

  /**
   * Create the control container.
   */
  private _createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = `maplibregl-ctrl maplibre-gl-bookmark-control ${this._options.className}`;

    if (!this._state.visible) {
      container.style.display = "none";
    }

    // Main button
    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.className = "bookmark-button";
    this._button.title = "Bookmarks";
    this._button.innerHTML = BOOKMARK_ICON;
    this._button.addEventListener("click", () => this._togglePanel());
    container.appendChild(this._button);

    return container;
  }

  /**
   * Create the panel content.
   */
  private _createPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = `bookmark-panel ${this._options.position.includes("left") ? "right" : "left"}`;
    if (this._options.resizable) {
      panel.classList.add("resizable");
    }
    panel.style.width = `${this._options.panelWidth}px`;
    // When resizable, the user controls the height by dragging, so we leave the
    // height to the CSS (`resize: both` with a viewport-relative cap) instead of
    // pinning it. When fixed, cap the height and let the list scroll within.
    if (
      !this._options.resizable &&
      this._options.maxHeight &&
      this._options.maxHeight > 0
    ) {
      panel.style.maxHeight = `${this._options.maxHeight}px`;
    }
    // Only force colors when explicitly provided; otherwise the CSS custom
    // properties drive them so the panel adapts to the system theme.
    if (this._options.backgroundColor) {
      panel.style.background = this._options.backgroundColor;
    }
    panel.style.borderRadius = `${this._options.borderRadius}px`;
    panel.style.fontSize = `${this._options.fontSize}px`;
    if (this._options.fontColor) {
      panel.style.color = this._options.fontColor;
    }

    // Header
    const header = document.createElement("div");
    header.className = "bookmark-header";
    header.innerHTML = `
      <span>Bookmarks</span>
      <button type="button" class="bookmark-close" title="Close">${CLOSE_ICON}</button>
    `;
    header
      .querySelector(".bookmark-close")
      ?.addEventListener("click", () => this._togglePanel());
    panel.appendChild(header);

    // Content
    const content = document.createElement("div");
    content.className = "bookmark-content";

    // Add form
    const addForm = document.createElement("div");
    addForm.className = "bookmark-add-form";
    addForm.innerHTML = `
      <input type="text" class="bookmark-name-input" placeholder="Bookmark name..." maxlength="50">
      <button type="button" class="bookmark-add-btn" title="Add bookmark">${PLUS_ICON}</button>
    `;
    this._nameInput = addForm.querySelector(
      ".bookmark-name-input",
    ) as HTMLInputElement;
    this._nameInput.style.color = "var(--bm-input-text)";
    const addBtn = addForm.querySelector(".bookmark-add-btn")!;

    // Handle add
    const handleAdd = () => {
      const name =
        this._nameInput?.value.trim() ||
        `Bookmark ${this._state.bookmarks.length + 1}`;
      this._addBookmark(name);
      if (this._nameInput) this._nameInput.value = "";
    };

    addBtn.addEventListener("click", handleAdd);
    this._nameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleAdd();
    });

    content.appendChild(addForm);

    // Optional "capture current state" toggle (e.g. include visible layers).
    // Shown only when the host opts in by supplying a label.
    if (this._options.captureStateLabel) {
      const toggle = document.createElement("label");
      toggle.className = "bookmark-capture-toggle";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "bookmark-capture-checkbox";
      checkbox.checked = this._captureEnabled;
      const text = document.createElement("span");
      text.textContent = this._options.captureStateLabel;
      toggle.appendChild(checkbox);
      toggle.appendChild(text);
      // Optional info icon clarifying how the toggle behaves (e.g. that it
      // applies per bookmark rather than as a global setting).
      if (this._options.captureStateTooltip) {
        const info = document.createElement("span");
        info.className = "bookmark-capture-info";
        info.innerHTML = INFO_ICON;
        info.title = this._options.captureStateTooltip;
        info.setAttribute("aria-label", this._options.captureStateTooltip);
        info.setAttribute("role", "img");
        // The icon lives inside the toggle's <label>, so clicking it would
        // otherwise flip the checkbox. Hovering still surfaces the tooltip.
        info.addEventListener("click", (e) => e.preventDefault());
        toggle.appendChild(info);
      }
      checkbox.addEventListener("change", () => {
        this._captureEnabled = checkbox.checked;
      });
      content.appendChild(toggle);
    }

    // Bookmarks list
    this._listEl = document.createElement("div");
    this._listEl.className = "bookmark-list";
    this._updateList();
    content.appendChild(this._listEl);

    panel.appendChild(content);

    // Footer with import/export and clear buttons. Import uses a downward arrow
    // (data coming into the app) and Export an upward one (data leaving it),
    // matching the convention used by most desktop GIS and design tools.
    const footer = document.createElement("div");
    footer.className = "bookmark-footer";
    const exportAll = this._options.showExportAll;
    footer.innerHTML = `
      <div class="bookmark-footer-actions">
        <button type="button" class="bookmark-import-btn" title="Import bookmarks">
          ${DOWNLOAD_ICON}
          <span>Import</span>
        </button>
        ${
          exportAll
            ? `<button type="button" class="bookmark-export-all-btn" title="${this._escapeHtml(this._options.exportAllLabel)}">
          ${UPLOAD_ICON}
          <span>${this._escapeHtml(this._options.exportAllLabel)}</span>
        </button>`
            : `<button type="button" class="bookmark-export-btn" title="Export bookmarks">
          ${UPLOAD_ICON}
          <span>${this._escapeHtml(this._options.exportLabel)}</span>
        </button>`
        }
      </div>
      ${
        this._state.bookmarks.length > 0
          ? `
        <button type="button" class="bookmark-clear-btn">
          ${TRASH_ICON}
          <span>Clear All</span>
        </button>
      `
          : ""
      }
    `;
    footer
      .querySelector(".bookmark-import-btn")
      ?.addEventListener("click", () => this._importFromFile());
    footer
      .querySelector(".bookmark-export-btn")
      ?.addEventListener("click", () => this._exportToFile());
    footer
      .querySelector(".bookmark-export-all-btn")
      ?.addEventListener("click", () => this._exportToFile("all"));
    footer
      .querySelector(".bookmark-clear-btn")
      ?.addEventListener("click", () => this._clearAll());
    panel.appendChild(footer);

    return panel;
  }

  /**
   * Expand the panel.
   */
  expand(): void {
    if (!this._state.collapsed) return;
    this._state.collapsed = false;
    this._showPanel();
    this._emit("expand");
  }

  /**
   * Collapse the panel.
   */
  collapse(): void {
    if (this._state.collapsed) return;
    this._state.collapsed = true;
    this._hidePanel();
    this._emit("collapse");
  }

  /**
   * Toggle the panel visibility.
   */
  private _togglePanel(): void {
    if (this._state.collapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  /**
   * Show the panel.
   */
  private _showPanel(): void {
    if (!this._panel && this._container) {
      this._panel = this._createPanel();
      this._container.appendChild(this._panel);
    }
    this._button?.classList.add("active");
  }

  /**
   * Hide the panel.
   */
  private _hidePanel(): void {
    this._panel?.remove();
    this._panel = undefined;
    this._button?.classList.remove("active");
  }

  /**
   * Update the bookmarks list display.
   */
  private _updateList(): void {
    if (!this._listEl) return;

    if (this._state.bookmarks.length === 0) {
      this._listEl.innerHTML = `
        <div class="bookmark-empty">
          ${MAP_ICON}
          <div>No bookmarks yet</div>
          <div>Save your current view</div>
        </div>
      `;
      return;
    }

    const reorderable = this._options.reorderable;
    const selectable = this._options.selectable;

    this._listEl.innerHTML = this._state.bookmarks
      .map(
        (b) => `
        <div class="bookmark-item ${this._state.selectedId === b.id ? "active" : ""}" data-id="${b.id}"${reorderable ? ' draggable="true"' : ""}>
          ${
            reorderable
              ? `<div class="bookmark-grip" title="Drag to reorder">${GRIP_ICON}</div>`
              : ""
          }
          ${
            selectable
              ? `<input type="checkbox" class="bookmark-select" title="Select for export"${this._exportSelection.has(b.id) ? " checked" : ""}>`
              : ""
          }
          ${
            b.thumbnail
              ? `<img class="bookmark-thumbnail" src="${b.thumbnail}" alt="${b.name}">`
              : `<div class="bookmark-icon">${MAP_ICON}</div>`
          }
          <div class="bookmark-info">
            <div class="bookmark-name">${this._escapeHtml(b.name)}</div>
            ${
              this._options.showMetadata
                ? `<div class="bookmark-meta">z${b.zoom.toFixed(1)} · ${formatDate(b.createdAt)}</div>`
                : ""
            }
          </div>
          <div class="bookmark-actions">
            <button type="button" class="bookmark-action-btn rename" title="Rename">${EDIT_ICON}</button>
            <button type="button" class="bookmark-action-btn delete" title="Delete">${TRASH_ICON}</button>
          </div>
        </div>
      `,
      )
      .join("");

    // Add event listeners
    this._listEl.querySelectorAll(".bookmark-item").forEach((item) => {
      const id = (item as HTMLElement).dataset.id!;

      // Click to go to bookmark
      item.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (target.closest(".bookmark-actions")) return;
        if (target.closest(".bookmark-select")) return;
        if (target.closest(".bookmark-grip")) return;
        this._goToBookmark(id);
      });

      // Rename button
      item.querySelector(".rename")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this._startRename(id);
      });

      // Delete button
      item.querySelector(".delete")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this._removeBookmark(id);
      });

      // Export-selection checkbox
      const selectBox = item.querySelector(
        ".bookmark-select",
      ) as HTMLInputElement | null;
      selectBox?.addEventListener("click", (e) => e.stopPropagation());
      selectBox?.addEventListener("change", () => {
        if (selectBox.checked) {
          this._exportSelection.add(id);
        } else {
          this._exportSelection.delete(id);
        }
        this._updateExportButton();
      });

      if (reorderable) {
        this._setupItemReorder(item as HTMLElement, id);
      }
    });

    this._updateExportButton();
  }

  /**
   * Wire drag-and-drop reordering for a single bookmark item.
   */
  private _setupItemReorder(item: HTMLElement, id: string): void {
    item.addEventListener("dragstart", (e) => {
      this._dragId = id;
      item.classList.add("dragging");
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
      }
    });
    item.addEventListener("dragend", () => {
      this._dragId = null;
      this._listEl
        ?.querySelectorAll(".bookmark-item")
        .forEach((el) => el.classList.remove("dragging", "drag-over"));
    });
    item.addEventListener("dragover", (e) => {
      if (this._dragId === null || this._dragId === id) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      item.classList.add("drag-over");
    });
    item.addEventListener("dragleave", () => {
      item.classList.remove("drag-over");
    });
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      item.classList.remove("drag-over");
      this._reorderBookmark(this._dragId, id);
    });
  }

  /**
   * Move the dragged bookmark so it sits at the target bookmark's position.
   */
  private _reorderBookmark(fromId: string | null, toId: string): void {
    if (!fromId || fromId === toId) return;
    const bookmarks = this._state.bookmarks;
    const from = bookmarks.findIndex((b) => b.id === fromId);
    const to = bookmarks.findIndex((b) => b.id === toId);
    if (from === -1 || to === -1) return;

    const [moved] = bookmarks.splice(from, 1);
    bookmarks.splice(to, 0, moved);

    this._saveToStorage();
    this._updateList();
    this._emit("reorder", { bookmark: moved });
  }

  /**
   * Reflect the current export selection on the footer's export controls. With
   * a single Export button it morphs the label between "Export" and "Export
   * Selected"; with a dedicated "Export All" button it shows/hides a separate
   * "Export Selected" button that appears only while a subset is ticked.
   */
  private _updateExportButton(): void {
    if (!this._panel) return;
    const count = this._options.selectable ? this._exportSelection.size : 0;

    if (this._options.showExportAll) {
      const actions = this._panel.querySelector(".bookmark-footer-actions");
      if (!actions) return;
      let btn = actions.querySelector(
        ".bookmark-export-selected-btn",
      ) as HTMLElement | null;
      if (count > 0) {
        if (!btn) {
          btn = document.createElement("button");
          btn.setAttribute("type", "button");
          btn.className = "bookmark-export-selected-btn";
          btn.innerHTML = `${UPLOAD_ICON}<span>${this._escapeHtml(this._options.exportSelectedLabel)}</span>`;
          btn.addEventListener("click", () => this._exportToFile("selected"));
          actions.appendChild(btn);
        }
        btn.title = `${this._options.exportSelectedLabel} (${count})`;
      } else if (btn) {
        btn.remove();
      }
      return;
    }

    // Single Export button: morph its label and title with the selection.
    const btn = this._panel.querySelector(
      ".bookmark-export-btn",
    ) as HTMLElement | null;
    if (!btn) return;
    const label = btn.querySelector("span");
    if (count > 0) {
      if (label) label.textContent = this._options.exportSelectedLabel;
      btn.title = `${this._options.exportSelectedLabel} (${count})`;
    } else {
      if (label) label.textContent = this._options.exportLabel;
      btn.title = "Export bookmarks";
    }
  }

  /**
   * Escape HTML for safe rendering.
   */
  private _escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Add a new bookmark.
   */
  private _addBookmark(name: string): void {
    if (!this._map) return;

    if (this._state.bookmarks.length >= this._options.maxBookmarks) {
      console.warn(`Maximum bookmarks (${this._options.maxBookmarks}) reached`);
      return;
    }

    const center = this._map.getCenter();
    const bookmark: MapBookmark = {
      id: generateId("bookmark"),
      name,
      lng: center.lng,
      lat: center.lat,
      zoom: this._map.getZoom(),
      pitch: this._map.getPitch(),
      bearing: this._map.getBearing(),
      createdAt: Date.now(),
    };

    // Capture host-defined state (e.g. visible layers) when enabled. The
    // checkbox gates capture only when the host supplied a label for it.
    const captureEnabled = this._options.captureStateLabel
      ? this._captureEnabled
      : true;
    if (captureEnabled) {
      const extra = this._options.captureState();
      if (extra !== undefined) {
        bookmark.extra = extra;
      }
    }

    // Generate thumbnail if enabled
    if (this._options.generateThumbnails) {
      try {
        const canvas = this._map.getCanvas();
        const thumbnailCanvas = document.createElement("canvas");
        const scale = 80 / canvas.width;
        thumbnailCanvas.width = 80;
        thumbnailCanvas.height = canvas.height * scale;
        const ctx = thumbnailCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(
            canvas,
            0,
            0,
            thumbnailCanvas.width,
            thumbnailCanvas.height,
          );
          bookmark.thumbnail = thumbnailCanvas.toDataURL("image/jpeg", 0.7);
        }
      } catch {
        // Thumbnail generation failed, continue without it
      }
    }

    this._state.bookmarks.unshift(bookmark);
    this._saveToStorage();
    this._updateList();
    this._updateFooter();
    this._emit("add", { bookmark });
  }

  /**
   * Remove a bookmark by ID.
   */
  private _removeBookmark(id: string): void {
    const index = this._state.bookmarks.findIndex((b) => b.id === id);
    if (index === -1) return;

    const bookmark = this._state.bookmarks[index];
    this._state.bookmarks.splice(index, 1);

    if (this._state.selectedId === id) {
      this._state.selectedId = null;
    }
    this._exportSelection.delete(id);

    this._saveToStorage();
    this._updateList();
    this._updateFooter();
    this._emit("remove", { bookmark });
  }

  /**
   * Go to a bookmark.
   */
  private _goToBookmark(id: string): void {
    const bookmark = this._state.bookmarks.find((b) => b.id === id);
    if (!bookmark || !this._map) return;

    this._state.selectedId = id;
    this._updateList();

    this._map.flyTo({
      center: [bookmark.lng, bookmark.lat],
      zoom: bookmark.zoom,
      pitch: bookmark.pitch,
      bearing: bookmark.bearing,
      duration: this._options.flyToDuration,
    });

    // Restore host-defined state captured with the bookmark (e.g. layers).
    if (bookmark.extra) {
      this._options.restoreState(bookmark.extra);
    }

    this._emit("select", { bookmark });
  }

  /**
   * Start renaming a bookmark.
   */
  private _startRename(id: string): void {
    const bookmark = this._state.bookmarks.find((b) => b.id === id);
    if (!bookmark) return;

    const item = this._listEl?.querySelector(`[data-id="${id}"]`);
    const nameEl = item?.querySelector(".bookmark-name");
    if (!nameEl) return;

    const currentName = bookmark.name;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "bookmark-rename-input";
    input.style.color = "var(--bm-input-text)";
    input.value = currentName;
    input.maxLength = 50;

    nameEl.innerHTML = "";
    nameEl.appendChild(input);
    input.focus();
    input.select();

    const finishRename = () => {
      const newName = input.value.trim() || currentName;
      bookmark.name = newName;
      this._saveToStorage();
      this._updateList();
      this._emit("rename", { bookmark });
    };

    input.addEventListener("blur", finishRename);
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        input.blur();
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        input.value = currentName;
        input.blur();
      }
    });
  }

  /**
   * Clear all bookmarks.
   */
  private _clearAll(): void {
    this._state.bookmarks = [];
    this._state.selectedId = null;
    this._exportSelection.clear();
    this._saveToStorage();
    this._updateList();
    this._updateFooter();
    this._emit("clear");
  }

  /**
   * Update the footer (show/hide Clear All based on bookmark count).
   */
  private _updateFooter(): void {
    const footer = this._panel?.querySelector(".bookmark-footer");
    if (!footer) return;

    const existingClearBtn = footer.querySelector(".bookmark-clear-btn");
    if (this._state.bookmarks.length > 0 && !existingClearBtn) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "bookmark-clear-btn";
      clearBtn.innerHTML = `${TRASH_ICON}<span>Clear All</span>`;
      clearBtn.addEventListener("click", () => this._clearAll());
      footer.appendChild(clearBtn);
    } else if (this._state.bookmarks.length === 0 && existingClearBtn) {
      existingClearBtn.remove();
    }
  }

  /**
   * Export bookmarks to a JSON file download. The mode controls which
   * bookmarks are written (see {@link exportBookmarks}).
   */
  private _exportToFile(mode: BookmarkExportMode = "auto"): void {
    const json = this.exportBookmarks(mode);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bookmarks.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this._emit("export");
  }

  /**
   * The bookmarks an Export should write, in list order. With mode "all" every
   * bookmark is written; "selected" writes only the ticked subset; "auto" (the
   * default) writes the ticked subset when any are selected and selection is
   * enabled, otherwise every bookmark.
   */
  private _bookmarksForExport(mode: BookmarkExportMode = "auto"): MapBookmark[] {
    const useSelection =
      this._options.selectable &&
      this._exportSelection.size > 0 &&
      (mode === "selected" || mode === "auto");
    if (useSelection) {
      return this._state.bookmarks.filter((b) =>
        this._exportSelection.has(b.id),
      );
    }
    return [...this._state.bookmarks];
  }

  /**
   * Import bookmarks from a JSON file via file picker.
   */
  private _importFromFile(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.style.display = "none";

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (!Array.isArray(data)) {
            console.warn("BookmarkControl: imported data is not an array");
            return;
          }
          // Validate that items look like bookmarks
          const valid = data.filter(
            (b: MapBookmark) =>
              b &&
              typeof b.name === "string" &&
              typeof b.lng === "number" &&
              typeof b.lat === "number" &&
              typeof b.zoom === "number",
          ) as MapBookmark[];
          if (valid.length === 0) {
            console.warn("BookmarkControl: no valid bookmarks found in file");
            return;
          }
          this.importBookmarks(valid);
          this._emit("import");
        } catch {
          console.warn("BookmarkControl: failed to parse imported file");
        }
      };
      reader.readAsText(file);
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  /**
   * Save bookmarks to localStorage.
   */
  private _saveToStorage(): void {
    if (!this._options.storageKey) return;

    try {
      localStorage.setItem(
        this._options.storageKey,
        JSON.stringify(this._state.bookmarks),
      );
    } catch {
      // localStorage not available or full
    }
  }

  /**
   * Load bookmarks from localStorage.
   */
  private _loadFromStorage(): void {
    if (!this._options.storageKey) return;

    try {
      const stored = localStorage.getItem(this._options.storageKey);
      if (stored) {
        const bookmarks = JSON.parse(stored) as MapBookmark[];
        this._state.bookmarks = bookmarks;
      }
    } catch {
      // localStorage not available or invalid data
    }
  }

  /**
   * Set up zoom-based visibility handling.
   */
  private _setupZoomHandler(): void {
    if (!this._map) return;

    this._handleZoom = () => {
      const zoom = this._map!.getZoom();
      const shouldShow =
        zoom >= this._options.minzoom && zoom <= this._options.maxzoom;

      if (shouldShow !== this._zoomVisible) {
        this._zoomVisible = shouldShow;
        if (this._container) {
          this._container.style.display =
            shouldShow && this._state.visible ? "" : "none";
        }
      }
    };

    this._map.on("zoom", this._handleZoom);
    this._handleZoom();
  }

  // Public API methods

  /**
   * Show the control.
   */
  show(): this {
    this._state.visible = true;
    if (this._container && this._zoomVisible) {
      this._container.style.display = "";
    }
    this._emit("show");
    return this;
  }

  /**
   * Hide the control.
   */
  hide(): this {
    this._state.visible = false;
    if (this._container) {
      this._container.style.display = "none";
    }
    this._emit("hide");
    return this;
  }

  /**
   * Get the current state.
   */
  getState(): BookmarkControlState {
    return { ...this._state };
  }

  /**
   * Get all bookmarks.
   */
  getBookmarks(): MapBookmark[] {
    return [...this._state.bookmarks];
  }

  /**
   * Add a bookmark programmatically.
   */
  addBookmark(name?: string): this {
    this._addBookmark(name || `Bookmark ${this._state.bookmarks.length + 1}`);
    return this;
  }

  /**
   * Remove a bookmark by ID.
   */
  removeBookmark(id: string): this {
    this._removeBookmark(id);
    return this;
  }

  /**
   * Go to a bookmark by ID.
   */
  goTo(id: string): this {
    this._goToBookmark(id);
    return this;
  }

  /**
   * Clear all bookmarks.
   */
  clear(): this {
    this._clearAll();
    return this;
  }

  /**
   * Import bookmarks from an array.
   */
  importBookmarks(bookmarks: MapBookmark[]): this {
    const remaining = this._options.maxBookmarks - this._state.bookmarks.length;
    const toImport = bookmarks.slice(0, remaining);
    this._state.bookmarks.push(...toImport);
    this._saveToStorage();
    this._updateList();
    this._updateFooter();
    return this;
  }

  /**
   * Export bookmarks as a JSON string. With mode "all" every bookmark is
   * serialized; "selected" serializes only the ticked subset; "auto" (the
   * default) serializes the ticked subset when export selection is enabled and
   * a subset is ticked, otherwise every bookmark.
   */
  exportBookmarks(mode: BookmarkExportMode = "auto"): string {
    return JSON.stringify(this._bookmarksForExport(mode), null, 2);
  }

  /**
   * Get the IDs currently ticked for selective export.
   */
  getSelectedIds(): string[] {
    return [...this._exportSelection];
  }

  /**
   * Replace the set of bookmark IDs ticked for selective export. IDs that do
   * not match an existing bookmark are ignored.
   */
  setSelectedIds(ids: string[]): this {
    const valid = new Set(this._state.bookmarks.map((b) => b.id));
    this._exportSelection = new Set(ids.filter((id) => valid.has(id)));
    if (this._panel) this._updateList();
    return this;
  }
}
