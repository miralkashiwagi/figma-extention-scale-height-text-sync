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
const VALUE_NODE_NAME = "value - please detach if you want to edit";
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
// Create the Scale component (if not exists), return main component
function getOrCreateScaleComponent() {
    return __awaiter(this, void 0, void 0, function* () {
        // Load all pages first for dynamic-page access
        yield figma.loadAllPagesAsync();
        // Try find by stored Component ID first
        const storedId = getStoredScaleComponentId();
        if (storedId) {
            const existing = yield figma.getNodeByIdAsync(storedId);
            if (existing && existing.type === "COMPONENT") {
                return existing;
            }
        }
        // Fallback: Try find by name in document
        const existing = figma.root.findOne(n => n.type === "COMPONENT" && n.name === "scale-ruler/height-sync");
        if (existing) {
            // Store the ID for future reference
            storeScaleComponentId(existing.id);
            return existing;
        }
        // Create component
        const comp = figma.createComponent();
        comp.name = "scale-ruler/height-sync";
        // Store the component ID
        storeScaleComponentId(comp.id);
        comp.resizeWithoutConstraints(49, 96);
        comp.layoutMode = "HORIZONTAL";
        comp.primaryAxisSizingMode = "AUTO";
        comp.counterAxisSizingMode = "FIXED";
        comp.counterAxisAlignItems = "CENTER";
        comp.primaryAxisAlignItems = "CENTER";
        comp.itemSpacing = 10;
        comp.paddingLeft = comp.paddingRight = comp.paddingTop = comp.paddingBottom = 10;
        // Background fill: semi-transparent red
        comp.fills = [{
                type: "SOLID",
                opacity: 0.2,
                color: { r: 1, g: 0, b: 0.3486238718032837 }
            }];
        // Remove stroke
        comp.strokes = [];
        const text = figma.createText();
        text.name = VALUE_NODE_NAME;
        yield figma.loadFontAsync({ family: "Inter", style: "Regular" }).catch(() => { });
        text.fontName = { family: "Inter", style: "Regular" };
        text.lineHeight = { value: 100, unit: "PERCENT" };
        text.fontSize = 12;
        text.characters = px(comp.height);
        text.locked = true;
        // Text color: dark pink
        text.fills = [{
                type: "SOLID",
                color: { r: 0.8548077940940857, g: 0, b: 0.2991827130317688 }
            }];
        comp.appendChild(text);
        // Place in a "Components" page if available, else keep in current
        let targetPage = figma.root.children.find(p => p.type === "PAGE" && p.name.toLowerCase().includes("components"));
        if (!targetPage)
            targetPage = figma.currentPage;
        const prev = figma.currentPage;
        if (targetPage !== figma.currentPage) {
            yield figma.setCurrentPageAsync(targetPage);
        }
        targetPage.appendChild(comp);
        if (targetPage !== prev) {
            yield figma.setCurrentPageAsync(prev);
        }
        return comp;
    });
}
// Insert one instance near selection center
function insertScaleInstance() {
    return __awaiter(this, void 0, void 0, function* () {
        const comp = yield getOrCreateScaleComponent();
        const inst = comp.createInstance();
        inst.name = "scale-ruler/height-sync";
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
        const storedId = getStoredScaleComponentId();
        if (storedId) {
            const mainComp = yield inst.getMainComponentAsync();
            return (mainComp === null || mainComp === void 0 ? void 0 : mainComp.id) === storedId;
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
                const allNodes = r.findAll(() => true);
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
    figma.showUI(__html__, { width: 260, height: 200 });
    figma.loadAllPagesAsync().then(() => {
        figma.on("documentchange", onDocChange);
        figma.on("selectionchange", onSelChange);
    });
});
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === "INSERT") {
        yield insertScaleInstance();
        figma.notify("Scale component inserted!");
    }
    if (msg.type === "RUN_ONCE")
        yield syncAll("selection");
    if (msg.type === "RUN_ALL")
        yield syncAll("all");
    if (msg.type === "AUTO_SET") {
        autoMode = !!msg.value;
        figma.notify(`Auto Update: ${autoMode ? "ON" : "OFF"}`);
    }
});
