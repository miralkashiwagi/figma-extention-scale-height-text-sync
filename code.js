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
// Get stored scale component ID or null
function getStoredScaleComponentId() {
    return figma.root.getPluginData(SCALE_COMPONENT_ID_KEY) || null;
}
// Store scale component ID
function storeScaleComponentId(componentId) {
    figma.root.setPluginData(SCALE_COMPONENT_ID_KEY, componentId);
}
// Create the Scale component set (if not exists), return vertical and horizontal components
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
                const existing = yield figma.getNodeByIdAsync(storedId);
                if (existing && existing.type === "COMPONENT_SET") {
                    const componentSet = existing;
                    const vertical = componentSet.children.find(c => c.type === "COMPONENT" && c.name.includes("Vertical"));
                    const horizontal = componentSet.children.find(c => c.type === "COMPONENT" && c.name.includes("Horizontal"));
                    if (vertical && horizontal) {
                        return { vertical, horizontal };
                    }
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
                    return { vertical, horizontal };
                }
            }
        }
        // Create vertical component first
        const vertical = figma.createComponent();
        vertical.name = `Orientation=Vertical`;
        vertical.resizeWithoutConstraints(49, 96);
        vertical.layoutMode = "HORIZONTAL";
        vertical.primaryAxisSizingMode = "AUTO";
        vertical.counterAxisSizingMode = "FIXED";
        vertical.counterAxisAlignItems = "CENTER";
        vertical.primaryAxisAlignItems = "MIN";
        vertical.itemSpacing = 10;
        vertical.paddingLeft = vertical.paddingRight = vertical.paddingTop = vertical.paddingBottom = 10;
        // Background fill: semi-transparent red
        vertical.fills = [{
                type: "SOLID",
                opacity: 0.2,
                color: { r: 1, g: 0, b: 0.3486238718032837 }
            }];
        // Remove stroke
        vertical.strokes = [];
        const verticalText = figma.createText();
        verticalText.name = VALUE_NODE_NAME;
        yield figma.loadFontAsync({ family: "Inter", style: "Regular" }).catch(() => { });
        verticalText.fontName = { family: "Inter", style: "Regular" };
        verticalText.lineHeight = { value: 100, unit: "PERCENT" };
        verticalText.fontSize = 12;
        verticalText.characters = px(vertical.height);
        verticalText.locked = true;
        // Text color: dark pink
        verticalText.fills = [{
                type: "SOLID",
                color: { r: 0.8548077940940857, g: 0, b: 0.2991827130317688 }
            }];
        vertical.appendChild(verticalText);
        // Create line for vertical component
        const verticalLine = figma.createLine();
        verticalLine.name = "Arrow";
        verticalLine.resize(96, 0);
        verticalLine.rotation = -90;
        verticalLine.strokes = [{
                type: "SOLID",
                color: { r: 0.8548077940940857, g: 0, b: 0.2991827130317688 }
            }];
        verticalLine.strokeWeight = 1;
        verticalLine.strokeAlign = "CENTER";
        verticalLine.strokeCap = "ARROW_LINES";
        vertical.appendChild(verticalLine);
        // Set line constraints and positioning
        verticalLine.layoutPositioning = "ABSOLUTE";
        verticalLine.constraints = { horizontal: "SCALE", vertical: "SCALE" };
        verticalLine.x = 0;
        verticalLine.y = 0;
        // Create horizontal component
        const horizontal = figma.createComponent();
        horizontal.name = `Orientation=Horizontal`;
        horizontal.resizeWithoutConstraints(49, 96);
        horizontal.layoutMode = "HORIZONTAL";
        horizontal.primaryAxisSizingMode = "AUTO";
        horizontal.counterAxisSizingMode = "FIXED";
        horizontal.counterAxisAlignItems = "CENTER";
        horizontal.primaryAxisAlignItems = "MIN";
        horizontal.itemSpacing = 10;
        horizontal.paddingLeft = horizontal.paddingRight = horizontal.paddingTop = horizontal.paddingBottom = 10;
        // Background fill: semi-transparent red
        horizontal.fills = [{
                type: "SOLID",
                opacity: 0.2,
                color: { r: 1, g: 0, b: 0.3486238718032837 }
            }];
        // Remove stroke
        horizontal.strokes = [];
        // Rotate the horizontal component 90 degrees
        horizontal.rotation = -90; // 90 degrees in radians
        const horizontalText = figma.createText();
        horizontalText.name = VALUE_NODE_NAME;
        yield figma.loadFontAsync({ family: "Inter", style: "Regular" }).catch(() => { });
        horizontalText.fontName = { family: "Inter", style: "Regular" };
        horizontalText.lineHeight = { value: 100, unit: "PERCENT" };
        horizontalText.fontSize = 12;
        horizontalText.characters = px(horizontal.height);
        horizontalText.locked = true;
        horizontalText.rotation = 90;
        // Text color: dark pink
        horizontalText.fills = [{
                type: "SOLID",
                color: { r: 0.8548077940940857, g: 0, b: 0.2991827130317688 }
            }];
        horizontal.appendChild(horizontalText);
        // Create line for vertical component
        const horizontalLine = figma.createLine();
        horizontalLine.name = "Arrow";
        horizontalLine.resize(96, 0);
        horizontalLine.rotation = -90;
        horizontalLine.strokes = [{
                type: "SOLID",
                color: { r: 0.8548077940940857, g: 0, b: 0.2991827130317688 }
            }];
        horizontalLine.strokeWeight = 1;
        horizontalLine.strokeAlign = "CENTER";
        horizontalLine.strokeCap = "ARROW_LINES";
        horizontal.appendChild(horizontalLine);
        // Set line constraints and positioning
        horizontalLine.layoutPositioning = "ABSOLUTE";
        horizontalLine.constraints = { horizontal: "SCALE", vertical: "SCALE" };
        horizontalLine.x = 0;
        horizontalLine.y = 0;
        // Create component set from the two components
        const componentSet = figma.combineAsVariants([vertical, horizontal], figma.currentPage);
        componentSet.name = SCALE_COMPONENT_NAME;
        componentSet.layoutMode = "HORIZONTAL";
        componentSet.primaryAxisSizingMode = "AUTO";
        componentSet.counterAxisSizingMode = "FIXED";
        componentSet.counterAxisAlignItems = "CENTER";
        componentSet.primaryAxisAlignItems = "MIN";
        componentSet.itemSpacing = 10;
        componentSet.paddingLeft = componentSet.paddingRight = componentSet.paddingTop = componentSet.paddingBottom = 10;
        // Store the component set ID
        storeScaleComponentId(componentSet.id);
        // Place in a "Components" page if available, else keep in current
        let targetPage = figma.root.children.find(p => p.type === "PAGE" && p.name.toLowerCase().includes("components"));
        if (!targetPage)
            targetPage = figma.currentPage;
        const prev = figma.currentPage;
        if (targetPage !== figma.currentPage) {
            yield figma.setCurrentPageAsync(targetPage);
        }
        // Move component set to target page if different
        if (targetPage !== figma.currentPage) {
            targetPage.appendChild(componentSet);
        }
        if (targetPage !== prev) {
            yield figma.setCurrentPageAsync(prev);
        }
        return { vertical, horizontal };
    });
}
// Insert one instance near selection center
function insertScaleInstance() {
    return __awaiter(this, void 0, void 0, function* () {
        const { vertical } = yield getOrCreateScaleComponentSet();
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
        figma.viewport.scrollAndZoomIntoView([inst]);
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
function onDocChange() {
    if (!autoMode)
        return;
    if (ticking)
        return;
    ticking = true;
    setTimeout(() => __awaiter(this, void 0, void 0, function* () {
        ticking = false;
        yield syncAll("selection"); // 変更頻度を考慮して選択範囲優先。必要なら "all" に変更
    }), 120);
}
function onSelChange() {
    if (!autoMode)
        return;
    syncAll("selection").catch(console.error);
}
// ---------- Commands ----------
figma.on("run", () => {
    // Always open UI when plugin is launched
    figma.showUI(__html__, { width: 260, height: 180 });
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
