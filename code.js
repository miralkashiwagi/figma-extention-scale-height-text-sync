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
function setText(text, s) {
    return __awaiter(this, void 0, void 0, function* () {
        yield figma.loadFontAsync(CONSTANTS.FONT).catch(() => { });
        try {
            text.characters = s;
            // text.locked = true;
        }
        catch (e) {
            console.warn('Text set failed:', e);
        }
    });
}
function px(n) { return `${Math.round(n)}px`; }
// Helper function to extract vertical and horizontal components from component set
function extractComponents(componentSet) {
    const vertical = componentSet.children.find(c => c.type === "COMPONENT" && c.name.includes("Vertical"));
    const horizontal = componentSet.children.find(c => c.type === "COMPONENT" && c.name.includes("Horizontal"));
    return (vertical && horizontal) ? { vertical, horizontal } : null;
}
// Common constants
const CONSTANTS = {
    COLORS: {
        background: { r: 1, g: 0, b: 0.3 },
        foreground: { r: 0.85, g: 0, b: 0.3 }
    },
    FONT: { family: "Inter", style: "Regular" },
    COMPONENT_SIZE: { width: 64, height: 80 },
    LINE_SIZE: 80
};
// Helper function to create and setup text node
function createTextNode(height_1) {
    return __awaiter(this, arguments, void 0, function* (height, rotation = 0) {
        const text = figma.createText();
        text.name = VALUE_NODE_NAME;
        yield figma.loadFontAsync(CONSTANTS.FONT).catch(() => { });
        text.fontName = CONSTANTS.FONT;
        text.lineHeight = { value: 100, unit: "PERCENT" };
        text.fontSize = 14;
        text.characters = px(height);
        // text.locked = true;
        text.rotation = rotation;
        text.fills = [{
                type: "SOLID",
                color: CONSTANTS.COLORS.foreground
            }];
        return text;
    });
}
// Helper function to create and setup line node
function createLineNode() {
    const line = figma.createLine();
    line.name = "Arrow";
    line.resize(CONSTANTS.LINE_SIZE, 0);
    line.rotation = -90;
    line.strokes = [{
            type: "SOLID",
            color: CONSTANTS.COLORS.foreground
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
    component.resizeWithoutConstraints(CONSTANTS.COMPONENT_SIZE.width, CONSTANTS.COMPONENT_SIZE.height);
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
            color: CONSTANTS.COLORS.background
        }];
    component.strokes = [];
    component.rotation = rotation;
}
// Helper function to create a complete component (text + line)
function createScaleComponent(name, componentRotation, textRotation) {
    return __awaiter(this, void 0, void 0, function* () {
        const component = figma.createComponent();
        setupComponentBase(component, name, componentRotation);
        const text = yield createTextNode(component.height, textRotation);
        const line = createLineNode();
        component.appendChild(text);
        component.appendChild(line);
        setupLinePositioning(line);
        return component;
    });
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
function getOrCreateScaleComponentSet(viewportCenter) {
    return __awaiter(this, void 0, void 0, function* () {
        // Load all pages first for dynamic-page access
        yield figma.loadAllPagesAsync();
        // Check if any instances or the main component exist in document
        const allInstances = figma.root.findAll(n => n.type === "INSTANCE");
        const hasInstancesInDocument = yield Promise.all(allInstances.map(inst => isScaleInstance(inst))).then(results => results.some(result => result));
        const allComponents = figma.root.findAll(n => n.type === "COMPONENT_SET" && n.name === SCALE_COMPONENT_NAME);
        const hasMainComponentInDocument = allComponents.length > 0;
        // If no instances or main components exist in document, force regeneration
        if (!hasInstancesInDocument && !hasMainComponentInDocument) {
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
                        const components = extractComponents(componentSet);
                        if (components) {
                            return Object.assign({ componentSet }, components);
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
                const components = extractComponents(existing);
                if (components) {
                    return Object.assign({ componentSet: existing }, components);
                }
            }
        }
        // Create vertical and horizontal components
        const vertical = yield createScaleComponent("Orientation=Vertical", 0, 0);
        const horizontal = yield createScaleComponent("Orientation=Horizontal", -90, 90);
        // Create component set from the two components - ensure it's placed at page level
        const componentSet = figma.combineAsVariants([vertical, horizontal], figma.currentPage);
        componentSet.name = SCALE_COMPONENT_NAME;
        componentSet.layoutMode = "HORIZONTAL";
        componentSet.primaryAxisSizingMode = "AUTO";
        componentSet.counterAxisSizingMode = "AUTO";
        componentSet.counterAxisAlignItems = "CENTER";
        componentSet.primaryAxisAlignItems = "MIN";
        componentSet.itemSpacing = 10;
        componentSet.paddingLeft = componentSet.paddingRight = componentSet.paddingTop = componentSet.paddingBottom = 30;
        // Ensure component set is placed directly under the page (not in any container)
        figma.currentPage.appendChild(componentSet);
        // Position component set near viewport center if provided
        if (viewportCenter) {
            componentSet.x = viewportCenter.x - componentSet.width * 2;
            componentSet.y = viewportCenter.y - componentSet.height * 2;
        }
        componentSet.strokes = [
            {
                type: "SOLID",
                color: CONSTANTS.COLORS.background
            }
        ];
        // Store the component set ID
        storeScaleComponentId(componentSet.id);
        return { componentSet, vertical, horizontal };
    });
}
// Find the appropriate container for instance placement (group, frame, section, or page)
function findTargetContainer() {
    if (figma.currentPage.selection.length === 0) {
        return figma.currentPage;
    }
    // Get the first selected element
    const selected = figma.currentPage.selection[0];
    // Traverse up the parent hierarchy to find a suitable container
    let current = selected.parent;
    while (current) {
        // Check if current parent is a group, frame, or section
        if (current.type === "GROUP" || current.type === "FRAME" || current.type === "SECTION") {
            return current;
        }
        // If we reach the page, stop here
        if (current.type === "PAGE") {
            return current;
        }
        current = current.parent;
    }
    // Fallback to current page
    return figma.currentPage;
}
// Insert one instance near selection center
function insertScaleInstance() {
    return __awaiter(this, void 0, void 0, function* () {
        // Get viewport center once for both component set and instance positioning
        const vp = figma.viewport.center;
        const { vertical } = yield getOrCreateScaleComponentSet(vp);
        const inst = vertical.createInstance();
        inst.name = SCALE_COMPONENT_NAME;
        // Rename the text node in the instance to match VALUE_NODE_NAME
        const textNode = inst.findOne(n => isText(n));
        if (textNode) {
            textNode.name = VALUE_NODE_NAME;
        }
        // Find appropriate container and place instance there
        const targetContainer = findTargetContainer();
        // Position instance near viewport center or selected element
        let targetX = vp.x;
        let targetY = vp.y;
        // If there's a selection, position relative to it
        if (figma.currentPage.selection.length > 0) {
            const selected = figma.currentPage.selection[0];
            targetX = selected.x + 20; // Place to the right of selected element
            targetY = selected.y;
        }
        inst.x = targetX;
        inst.y = targetY;
        // Append to target container instead of page
        targetContainer.appendChild(inst);
        figma.currentPage.selection = [inst];
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
            try {
                const mainComp = yield inst.getMainComponentAsync();
                if (mainComp) {
                    // Check if main component belongs to our stored component set
                    return ((_a = mainComp.parent) === null || _a === void 0 ? void 0 : _a.id) === storedId;
                }
            }
            catch (e) {
                // Main component doesn't exist (deleted, or broken reference)
                console.warn('Main component not found for instance:', inst.id, e);
                return false;
            }
        }
        return false;
    });
}
// Check if instance is an external scale instance (from another document)
function isExternalScaleInstance(inst) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const mainComp = yield inst.getMainComponentAsync();
            if (mainComp) {
                // Check if it's a scale component by name but not from current document
                const componentSet = mainComp.parent;
                if ((componentSet === null || componentSet === void 0 ? void 0 : componentSet.type) === "COMPONENT_SET" && componentSet.name === SCALE_COMPONENT_NAME) {
                    const storedId = getStoredScaleComponentId();
                    // It's external if it doesn't match our stored component ID
                    return componentSet.id !== storedId;
                }
            }
        }
        catch (e) {
            console.warn('Could not check external instance:', inst.id, e);
        }
        return false;
    });
}
// Check if instance needs text/stroke update
function needsUpdate(inst) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield isScaleInstance(inst)))
            return false;
        const t = findValueText(inst);
        if (!t)
            return false;
        const expectedText = px(inst.height);
        const expectedStroke = inst.height <= 10 ? 0.5 : 1;
        const line = inst.findOne(n => n.type === "LINE" && n.name === "Arrow");
        return t.characters !== expectedText || (line ? line.strokeWeight !== expectedStroke : false);
    });
}
// Sync a single instance's text to its own height
function syncOne(inst) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield isScaleInstance(inst)))
            return;
        const t = findValueText(inst);
        if (!t)
            return;
        yield setText(t, px(inst.height));
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
        // Early return if no instances found
        if (list.length === 0) {
            return;
        }
        // Process in batches to avoid memory spikes with large numbers of instances
        const BATCH_SIZE = 50;
        let totalUpdated = 0;
        for (let i = 0; i < list.length; i += BATCH_SIZE) {
            const batch = list.slice(i, i + BATCH_SIZE);
            const instancesNeedingUpdate = [];
            // Filter batch to only instances that need updates
            for (const inst of batch) {
                if (yield needsUpdate(inst)) {
                    instancesNeedingUpdate.push(inst);
                }
            }
            // Sync instances in this batch
            for (const inst of instancesNeedingUpdate) {
                yield syncOne(inst);
            }
            totalUpdated += instancesNeedingUpdate.length;
            // Allow other operations between batches
            if (i + BATCH_SIZE < list.length) {
                yield new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        // Only show notification during startup sync
        if (totalUpdated > 0 && isStartupSync) {
            figma.notify(`${totalUpdated}個のインスタンスを更新しました`);
        }
    });
}
// ---------- Auto sync while UI is open ----------
let ticking = false;
let debounceTimer = null;
let documentChangeHandler = null;
let selectionChangeHandler = null;
let isStartupSync = false;
function onDocChange() {
    if (debounceTimer)
        clearTimeout(debounceTimer);
    if (ticking)
        return;
    debounceTimer = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
        if (ticking)
            return;
        ticking = true;
        debounceTimer = null;
        try {
            yield syncAll("selection");
        }
        finally {
            ticking = false;
        }
    }), 250);
}
function onSelChange() {
    syncAll("selection").catch(console.error);
}
// Convert external instance to current document's component (with pre-existing components)
function convertInstanceWithComponents(inst, vertical, horizontal) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Determine which variant to use based on the instance's rotation
            const isHorizontal = Math.abs(inst.rotation) > 45;
            const targetComponent = isHorizontal ? horizontal : vertical;
            // Store instance properties including layer order
            const props = {
                x: inst.x,
                y: inst.y,
                width: inst.width,
                height: inst.height,
                rotation: inst.rotation,
                name: inst.name,
                parent: inst.parent,
                variantProperties: inst.variantProperties
            };
            // Find the index of the current instance in its parent's children
            let insertIndex = -1;
            if (props.parent && 'children' in props.parent) {
                insertIndex = props.parent.children.indexOf(inst);
            }
            // Create new instance from current document's component
            const newInstance = targetComponent.createInstance();
            // Apply stored properties
            newInstance.x = props.x;
            newInstance.y = props.y;
            newInstance.resizeWithoutConstraints(props.width, props.height);
            newInstance.rotation = props.rotation;
            newInstance.name = props.name;
            // Set variant properties if they exist
            if (props.variantProperties) {
                try {
                    newInstance.setProperties(props.variantProperties);
                }
                catch (e) {
                    console.warn('Could not set variant properties:', e);
                }
            }
            // Insert new instance at the same position in hierarchy and layer order
            const parent = props.parent;
            if (!parent || !('appendChild' in parent)) {
                return null; // Cannot place instance without valid parent
            }
            parent.appendChild(newInstance);
            // Move to the correct position in layer order if we found the index
            if (insertIndex >= 0 && 'insertChild' in parent) {
                parent.insertChild(insertIndex, newInstance);
            }
            // Remove the old instance
            inst.remove();
            // Sync the new instance
            yield syncOne(newInstance);
            return newInstance;
        }
        catch (e) {
            console.error('Failed to convert instance:', e);
            return null;
        }
    });
}
// Convert external instance to current document's component (creates component set if needed)
function convertInstance(inst) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get the current component set
            const { vertical, horizontal } = yield getOrCreateScaleComponentSet();
            return yield convertInstanceWithComponents(inst, vertical, horizontal);
        }
        catch (e) {
            console.error('Failed to convert instance:', e);
            return null;
        }
    });
}
// Collect external instances from given nodes (including nested ones)
function collectExternalInstances(nodes) {
    return __awaiter(this, void 0, void 0, function* () {
        const allInstances = [];
        // Collect all instances from selection and nested containers
        for (const node of nodes) {
            if (node.type === "INSTANCE") {
                allInstances.push(node);
            }
            // Also check for instances within selected containers
            if ('findAll' in node) {
                const nestedInstances = node.findAll(n => n.type === "INSTANCE");
                allInstances.push(...nestedInstances);
            }
        }
        // Check which instances are external in parallel
        const checkPromises = allInstances.map((inst) => __awaiter(this, void 0, void 0, function* () {
            return ({
                inst,
                isExternal: yield isExternalScaleInstance(inst)
            });
        }));
        const results = yield Promise.all(checkPromises);
        return results.filter(result => result.isExternal).map(result => result.inst);
    });
}
// Convert selected external instances to current document
function convertSelectedInstancesToCurrentDocument() {
    return __awaiter(this, void 0, void 0, function* () {
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
            return { converted: 0, total: 0 };
        }
        const externalInstances = yield collectExternalInstances(selection);
        if (externalInstances.length === 0) {
            return { converted: 0, total: 0 };
        }
        // Ensure component set exists once before parallel conversion
        const { vertical, horizontal } = yield getOrCreateScaleComponentSet();
        // Convert instances in parallel with shared component set
        const conversionPromises = externalInstances.map(inst => convertInstanceWithComponents(inst, vertical, horizontal));
        const conversionResults = yield Promise.all(conversionPromises);
        // Filter successful conversions
        const newSelection = conversionResults.filter((result) => result !== null);
        const converted = newSelection.length;
        // Update selection to include converted instances
        if (newSelection.length > 0) {
            figma.currentPage.selection = newSelection;
        }
        return { converted, total: externalInstances.length };
    });
}
// Clean up function to remove event listeners and timers
function cleanup() {
    // Clear any pending timer
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    // Remove event listeners if they exist
    if (documentChangeHandler) {
        figma.off("documentchange", documentChangeHandler);
        documentChangeHandler = null;
    }
    if (selectionChangeHandler) {
        figma.off("selectionchange", selectionChangeHandler);
        selectionChangeHandler = null;
    }
    // Reset startup flag
    isStartupSync = false;
}
// ---------- Commands ----------
figma.on("run", () => {
    // Clean up any existing listeners first
    cleanup();
    // Always open UI when plugin is launched
    figma.showUI(__html__, { width: 240, height: 240 });
    figma.loadAllPagesAsync().then(() => __awaiter(void 0, void 0, void 0, function* () {
        // Set startup flag and sync all instances on startup
        isStartupSync = true;
        yield syncAll("all");
        isStartupSync = false;
        // Store references to handlers for cleanup
        documentChangeHandler = onDocChange;
        selectionChangeHandler = onSelChange;
        // Add event listeners
        figma.on("documentchange", documentChangeHandler);
        figma.on("selectionchange", selectionChangeHandler);
    }));
});
// Clean up when plugin closes
figma.on("close", cleanup);
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === "INSERT") {
        yield insertScaleInstance();
        figma.notify("コンポーネントを作成しました！");
    }
    else if (msg.type === "CONVERT") {
        const result = yield convertSelectedInstancesToCurrentDocument();
        if (result.total === 0) {
            figma.notify("選択範囲に変換対象のインスタンスが見つかりません");
        }
        else if (result.converted === 0) {
            figma.notify("インスタンスの変換に失敗しました");
        }
        else {
            figma.notify(`${result.converted}個のインスタンスを変換しました！`);
        }
    }
});
