"use strict";
// code.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function isText(n) { return n.type === "TEXT"; }
const SCALE_COMPONENT_ID_KEY = "scaleComponentId";
const VALUE_NODE_NAME = "value";
const SCALE_COMPONENT_NAME = "FrameHeight->TextSync";
function ensureFontsFor(text) {
    return __awaiter(this, void 0, void 0, function* () {
        const fonts = [];
        if (text.fontName === figma.mixed) {
            for (const f of text.getRangeAllFontNames(0, text.characters.length))
                fonts.push(f);
        }
        else {
            fonts.push(text.fontName);
        }
        const uniq = new Map();
        for (const f of fonts)
            uniq.set(`${f.family}__${f.style}`, f);
        for (const f of uniq.values()) {
            try {
                yield figma.loadFontAsync(f);
            }
            catch (e) {
                console.warn('Font load failed:', e);
            }
        }
    });
}
function setText(text, s) {
    return __awaiter(this, void 0, void 0, function* () {
        yield ensureFontsFor(text);
        try {
            text.characters = s;
            text.locked = true;
        }
        catch (e) {
            console.warn('Text set failed:', e);
        }
    });
}
function px(n) { return `${Math.round(n)}px`; }
// Common styling constants
const COLORS = {
    background: { r: 1, g: 0, b: 0.3 },
    foreground: { r: 0.85, g: 0, b: 0.3 }
};
// Helper function to create and setup text node
function createTextNode(height_1) {
    return __awaiter(this, arguments, void 0, function* (height, rotation = 0) {
        const text = figma.createText();
        text.name = VALUE_NODE_NAME;
        yield figma.loadFontAsync({ family: "Inter", style: "Regular" }).catch(() => { });
        text.fontName = { family: "Inter", style: "Regular" };
        text.lineHeight = { value: 100, unit: "PERCENT" };
        text.fontSize = 14;
        text.characters = px(height);
        text.locked = true;
        text.rotation = rotation;
        text.fills = [{
                type: "SOLID",
                color: COLORS.foreground
            }];
        return text;
    });
}
// Helper function to create and setup line node
function createLineNode() {
    const line = figma.createLine();
    line.name = "Arrow";
    line.resize(80, 0);
    line.rotation = -90;
    line.strokes = [{
            type: "SOLID",
            color: COLORS.foreground
        }];
    line.strokeWeight = 1;
    line.strokeAlign = "CENTER";
    line.strokeCap = "ARROW_LINES";
    return line;
}
// Helper function to setup line positioning after adding to parent
function setupLinePositioning(line) {
    line.layoutPositioning = "ABSOLUTE";
    line.constraints = { horizontal: "SCALE", vertical: "SCALE" };
    line.x = 0;
    line.y = 0;
}
// Helper function to setup component base properties
function setupComponentBase(component, name, rotation = 0) {
    component.name = name;
    component.resizeWithoutConstraints(64, 80);
    component.layoutMode = "HORIZONTAL";
    component.primaryAxisSizingMode = "FIXED";
    component.counterAxisSizingMode = "FIXED";
    component.counterAxisAlignItems = "CENTER";
    component.primaryAxisAlignItems = "MIN";
    component.itemSpacing = 10;
    component.paddingLeft = component.paddingRight = component.paddingTop = component.paddingBottom = 10;
    component.fills = [{
            type: "SOLID",
            opacity: 0.1,
            color: COLORS.background
        }];
    component.strokes = [];
    component.rotation = rotation;
}
// Get stored scale component ID or null
function getStoredScaleComponentId() {
    return figma.root.getPluginData(SCALE_COMPONENT_ID_KEY) || null;
}
// Store scale component ID
function storeScaleComponentId(componentId) {
    figma.root.setPluginData(SCALE_COMPONENT_ID_KEY, componentId);
}
// Create the Scale component set (if not exists), return the component set and its variants
function getOrCreateScaleComponentSet() {
    return __awaiter(this, void 0, void 0, function* () {
        // Load all pages first for dynamic-page access
        yield figma.loadAllPagesAsync();
        // Check if any instances or the main component exist in current page
        const currentPageInstances = figma.currentPage.findAll(n => n.type === "INSTANCE");
        const hasInstancesInCurrentPage = yield Promise.all(currentPageInstances.map(inst => isScaleInstance(inst))).then(results => results.some(result => result));
        const currentPageComponents = figma.currentPage.findAll(n => n.type === "COMPONENT_SET" && n.name === SCALE_COMPONENT_NAME);
        const hasMainComponentInCurrentPage = currentPageComponents.length > 0;
        // If no instances or main components exist in current page, force regeneration
        if (!hasInstancesInCurrentPage && !hasMainComponentInCurrentPage) {
            // Clear stored ID to force regeneration
            figma.root.setPluginData(SCALE_COMPONENT_ID_KEY, "");
        }
        else {
            // Try find by stored Component ID first
            const storedId = getStoredScaleComponentId();
            if (storedId) {
                try {
                    const existing = yield figma.getNodeByIdAsync(storedId);
                    if (existing && existing.type === "COMPONENT_SET") {
                        const componentSet = existing;
                        const vertical = componentSet.children.find(c => c.type === "COMPONENT" && c.name.includes("Vertical"));
                        const horizontal = componentSet.children.find(c => c.type === "COMPONENT" && c.name.includes("Horizontal"));
                        if (vertical && horizontal) {
                            return { componentSet, vertical, horizontal };
                        }
                    }
                }
                catch (e) {
                    // Component was deleted, clear stored ID
                    figma.root.setPluginData(SCALE_COMPONENT_ID_KEY, "");
                }
            }
            // Fallback: Try find by name in document
            const existing = figma.root.findOne(n => n.type === "COMPONENT_SET" && n.name === SCALE_COMPONENT_NAME);
            if (existing) {
                // Store the ID for future reference
                storeScaleComponentId(existing.id);
                const vertical = existing.children.find(c => c.type === "COMPONENT" && c.name.includes("Vertical"));
                const horizontal = existing.children.find(c => c.type === "COMPONENT" && c.name.includes("Horizontal"));
                if (vertical && horizontal) {
                    return { componentSet: existing, vertical, horizontal };
                }
            }
        }
        // Create vertical component
        const vertical = figma.createComponent();
        setupComponentBase(vertical, "Orientation=Vertical", 0);
        const verticalText = yield createTextNode(vertical.height, 0);
        const verticalLine = createLineNode();
        vertical.appendChild(verticalText);
        vertical.appendChild(verticalLine);
        setupLinePositioning(verticalLine);
        // Create horizontal component
        const horizontal = figma.createComponent();
        setupComponentBase(horizontal, "Orientation=Horizontal", -90);
        const horizontalText = yield createTextNode(horizontal.height, 90);
        const horizontalLine = createLineNode();
        horizontal.appendChild(horizontalText);
        horizontal.appendChild(horizontalLine);
        setupLinePositioning(horizontalLine);
        // Create component set from the two components
        const componentSet = figma.combineAsVariants([vertical, horizontal], figma.currentPage);
        const vp = figma.viewport.center;
        componentSet.name = SCALE_COMPONENT_NAME;
        componentSet.layoutMode = "HORIZONTAL";
        componentSet.primaryAxisSizingMode = "AUTO";
        componentSet.counterAxisSizingMode = "AUTO";
        componentSet.counterAxisAlignItems = "CENTER";
        componentSet.primaryAxisAlignItems = "MIN";
        componentSet.itemSpacing = 10;
        componentSet.paddingLeft = componentSet.paddingRight = componentSet.paddingTop = componentSet.paddingBottom = 30;
        componentSet.x = vp.x - componentSet.width;
        componentSet.y = vp.y - componentSet.height;
        componentSet.strokes = [
            {
                type: "SOLID",
                color: COLORS.background
            }
        ];
        // Store the component set ID
        storeScaleComponentId(componentSet.id);
        return { componentSet, vertical, horizontal };
    });
}
// Insert one instance near selection center
function insertScaleInstance() {
    return __awaiter(this, void 0, void 0, function* () {
        const { componentSet, vertical } = yield getOrCreateScaleComponentSet();
        const inst = vertical.createInstance();
        inst.name = SCALE_COMPONENT_NAME;
        // Rename the text node in the instance to match VALUE_NODE_NAME
        const textNode = inst.findOne(n => isText(n));
        if (textNode) {
            textNode.name = VALUE_NODE_NAME;
        }
        // Drop near viewport center
        const vp = figma.viewport.center;
        inst.x = vp.x;
        inst.y = vp.y;
        figma.currentPage.appendChild(inst);
        figma.currentPage.selection = [inst];
        // figma.viewport.scrollAndZoomIntoView([inst]);
        // Initial sync
        yield syncOne(inst);
    });
}
// Find the "value" text inside an instance
function findValueText(inst) {
    return inst.findOne(n => isText(n) && n.name === VALUE_NODE_NAME);
}
// Check if instance is a scale instance (by component ID)
function isScaleInstance(inst) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const storedId = getStoredScaleComponentId();
        if (storedId) {
            const mainComp = yield inst.getMainComponentAsync();
            if (mainComp) {
                // Check if main component belongs to our stored component set
                return ((_a = mainComp.parent) === null || _a === void 0 ? void 0 : _a.id) === storedId;
            }
        }
        return false;
    });
}
// Sync a single instance's text to its own height
function syncOne(inst) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield isScaleInstance(inst))) {
            return;
        }
        const t = findValueText(inst);
        if (!t) {
            return;
        }
        const newText = px(inst.height);
        yield setText(t, newText);
        // Update stroke weight based on height
        const line = inst.findOne(n => n.type === "LINE" && n.name === "Arrow");
        if (line) {
            line.strokeWeight = inst.height <= 10 ? 0.5 : 1;
        }
    });
}
// Collect all scale instances in the document (optionally within selection)
function getScaleInstances() {
    return __awaiter(this, arguments, void 0, function* (scope = "all") {
        if (scope === "all") {
            yield figma.loadAllPagesAsync();
        }
        let roots;
        if (scope === "selection" && figma.currentPage.selection.length) {
            // 選択されたオブジェクト内を検索（選択されたオブジェクト自体も含む）
            roots = figma.currentPage.selection;
        }
        else if (scope === "all") {
            // 全ドキュメント検索
            roots = [figma.root];
        }
        else {
            // 現在のページ検索（selection modeで選択が空の場合）
            roots = [figma.currentPage];
        }
        const found = [];
        for (const r of roots) {
            // 選択されたオブジェクト自体がインスタンスかチェック
            if (r.type === "INSTANCE") {
                const inst = r;
                if (yield isScaleInstance(inst)) {
                    found.push(inst);
                }
            }
            // findAll を持つオブジェクトのみ子要素を検索
            if ("findAll" in r) {
                const instances = r.findAll(n => n.type === "INSTANCE");
                for (const inst of instances) {
                    if (yield isScaleInstance(inst)) {
                        found.push(inst);
                    }
                }
            }
        }
        // Remove duplicates (in case same instance is found multiple ways)
        const unique = Array.from(new Set(found));
        return unique;
    });
}
function syncAll() {
    return __awaiter(this, arguments, void 0, function* (scope = "all") {
        const list = yield getScaleInstances(scope);
        for (const inst of list)
            yield syncOne(inst);
        figma.notify(`Synced ${list.length} scale instance(s).`);
    });
}
// ---------- Auto mode while UI is open ----------
let autoMode = true;
let ticking = false;
let debounceTimer = null;
function onDocChange() {
    if (!autoMode)
        return;
    // Clear existing debounce timer
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    // Don't start new timer if already processing
    if (ticking)
        return;
    // Set debounce timer - longer delay to reduce updates during continuous resizing
    debounceTimer = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
        if (ticking)
            return;
        ticking = true;
        debounceTimer = null;
        try {
            yield syncAll("selection"); // 変更頻度を考慮して選択範囲優先。必要なら "all" に変更
        }
        finally {
            ticking = false;
        }
    }), 250); // Increased from 120ms to 250ms for better performance during resizing
}
function onSelChange() {
    if (!autoMode)
        return;
    syncAll("selection").catch(console.error);
}
// ---------- Commands ----------
figma.on("run", () => {
    // Always open UI when plugin is launched
    figma.showUI(__html__, { width: 240, height: 240 });
    figma.loadAllPagesAsync().then(() => __awaiter(void 0, void 0, void 0, function* () {
        // Sync all instances on startup (per new specification)
        yield syncAll("all");
        figma.on("documentchange", onDocChange);
        figma.on("selectionchange", onSelChange);
    }));
});
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === "INSERT") {
        yield insertScaleInstance();
        figma.notify("コンポーネントを作成しました！");
    }
    if (msg.type === "AUTO_SET") {
        autoMode = !!msg.value;
        figma.notify(`Auto Update: ${autoMode ? "ON" : "OFF"}`);
    }
});
