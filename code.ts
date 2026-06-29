// code.ts

function isText(n: SceneNode): n is TextNode { return n.type === "TEXT"; }

const SCALE_COMPONENT_ID_KEY = "scaleComponentId";
const VALUE_NODE_NAME = "value";
const SCALE_COMPONENT_NAME = "FrameHeight->TextSync";
const SELECTION_CHANGE_DEBOUNCE_MS = 150;
const SELECTED_INSTANCE_POLL_MS = 200;
const BATCH_SIZE = 50;
let fontLoadPromise: Promise<void> | null = null;

function waitForIdle(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

async function ensureFontLoaded(): Promise<void> {
    if (!fontLoadPromise) {
        fontLoadPromise = figma.loadFontAsync(CONSTANTS.FONT)
            .then(() => undefined)
            .catch(() => undefined);
    }
    await fontLoadPromise;
}

async function setText(text: TextNode, s: string) {
    await ensureFontLoaded();
    try {
        text.characters = s;
        // text.locked = true;
    } catch (e) { 
        console.warn('Text set failed:', e); 
    }
}

function px(n: number) { return `${Math.round(n)}px`; }

// Helper function to extract vertical and horizontal components from component set
function extractComponents(componentSet: ComponentSetNode): {vertical: ComponentNode, horizontal: ComponentNode} | null {
    const vertical = componentSet.children.find(c => c.type === "COMPONENT" && c.name.includes("Vertical")) as ComponentNode;
    const horizontal = componentSet.children.find(c => c.type === "COMPONENT" && c.name.includes("Horizontal")) as ComponentNode;
    return (vertical && horizontal) ? { vertical, horizontal } : null;
}

// Common constants
const CONSTANTS = {
    COLORS: {
        background: { r: 1, g: 0, b: 0.3 },
        foreground: { r: 0.85, g: 0, b: 0.3 }
    },
    FONT: { family: "Inter", style: "Regular" as const },
    COMPONENT_SIZE: { width: 64, height: 80 },
    LINE_SIZE: 80
};

// Helper function to create and setup text node
async function createTextNode(height: number, rotation: number = 0): Promise<TextNode> {
    const text = figma.createText();
    text.name = VALUE_NODE_NAME;
    await ensureFontLoaded();
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
}

// Helper function to create and setup line node
function createLineNode(): LineNode {
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
function setupLinePositioning(line: LineNode): void {
    line.layoutPositioning = "ABSOLUTE";
    line.constraints = { horizontal: "SCALE", vertical: "SCALE" };
    line.x = 0;
    line.y = 0;
}

// Helper function to setup component base properties
function setupComponentBase(component: ComponentNode, name: string, rotation: number = 0): void {
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
async function createScaleComponent(name: string, componentRotation: number, textRotation: number): Promise<ComponentNode> {
    const component = figma.createComponent();
    setupComponentBase(component, name, componentRotation);

    const text = await createTextNode(component.height, textRotation);
    const line = createLineNode();

    component.appendChild(text);
    component.appendChild(line);
    setupLinePositioning(line);

    return component;
}


// Get stored scale component ID or null
function getStoredScaleComponentId(): string | null {
    return figma.root.getPluginData(SCALE_COMPONENT_ID_KEY) || null;
}

// Store scale component ID
function storeScaleComponentId(componentId: string) {
    figma.root.setPluginData(SCALE_COMPONENT_ID_KEY, componentId);
}

// Create the Scale component set (if not exists), return the component set and its variants
async function getOrCreateScaleComponentSet(
    viewportCenter?: {x: number, y: number},
    searchAllPages: boolean = true,
    searchCurrentPage: boolean = true
): Promise<{componentSet: ComponentSetNode, vertical: ComponentNode, horizontal: ComponentNode}> {
    // Try stored Component ID first. This avoids loading and scanning every page
    // for the common case where the plugin already created the component set.
    const storedId = getStoredScaleComponentId();
    if (storedId) {
        try {
            const existing = await figma.getNodeByIdAsync(storedId);
            if (existing && existing.type === "COMPONENT_SET") {
                const componentSet = existing as ComponentSetNode;
                const components = extractComponents(componentSet);
                if (components) {
                    return { componentSet, ...components };
                }
            }
        } catch (e) {
            // Component was deleted, clear stored ID
            figma.root.setPluginData(SCALE_COMPONENT_ID_KEY, "");
        }
    }

    if (searchCurrentPage) {
        // Prefer the current page before escalating to all pages.
        const currentPageExisting = figma.currentPage.findOne(n => n.type === "COMPONENT_SET" && n.name === SCALE_COMPONENT_NAME) as ComponentSetNode | null;
        if (currentPageExisting) {
            storeScaleComponentId(currentPageExisting.id);
            const components = extractComponents(currentPageExisting);
            if (components) {
                return { componentSet: currentPageExisting, ...components };
            }
        }
    }

    if (searchAllPages) {
        // Fallback: load all pages only when callers explicitly allow it.
        await figma.loadAllPagesAsync();
        const existing = figma.root.findOne(n => n.type === "COMPONENT_SET" && n.name === SCALE_COMPONENT_NAME) as ComponentSetNode | null;
        if (existing) {
            storeScaleComponentId(existing.id);
            const components = extractComponents(existing);
            if (components) {
                return { componentSet: existing, ...components };
            }
        }
    }

    // Create vertical and horizontal components
    const vertical = await createScaleComponent("Orientation=Vertical", 0, 0);
    const horizontal = await createScaleComponent("Orientation=Horizontal", -90, 90);


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
    ]
    
    // Store the component set ID
    storeScaleComponentId(componentSet.id);

    return { componentSet, vertical, horizontal };
}

// Find the appropriate container for instance placement (group, frame, section, or page)
function findTargetContainer(): BaseNode & ChildrenMixin {
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
            return current as BaseNode & ChildrenMixin;
        }
        // If we reach the page, stop here
        if (current.type === "PAGE") {
            return current as BaseNode & ChildrenMixin;
        }
        current = current.parent;
    }
    
    // Fallback to current page
    return figma.currentPage;
}

// Insert one instance near selection center
async function insertScaleInstance() {
    // Get viewport center once for both component set and instance positioning
    const vp = figma.viewport.center;
    const { vertical } = await getOrCreateScaleComponentSet(vp, false, false);
    const inst = vertical.createInstance();
    inst.name = SCALE_COMPONENT_NAME;

    // Rename the text node in the instance to match VALUE_NODE_NAME
    const textNode = inst.findOne(n => isText(n)) as TextNode | null;
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
    await syncOne(inst);
}

// Find the "value" text inside an instance
function findValueText(inst: InstanceNode): TextNode | null {
    return inst.findOne(n => isText(n) && n.name === VALUE_NODE_NAME) as TextNode | null;
}

type ScaleInstanceInfo = {
    inst: InstanceNode;
    text: TextNode;
    line: LineNode | null;
};

// Check if instance is a scale instance (by component ID)
async function isScaleInstance(inst: InstanceNode): Promise<boolean> {
    const storedId = getStoredScaleComponentId();
    if (storedId) {
        try {
            const mainComp = await inst.getMainComponentAsync();
            if (mainComp) {
                // Check if main component belongs to our stored component set
                return mainComp.parent?.id === storedId;
            }
        } catch (e) {
            // Main component doesn't exist (deleted, or broken reference)
            console.warn('Main component not found for instance:', inst.id, e);
            return false;
        }
    }
    return false;
}

// Check if instance is an external scale instance (from another document)
async function isExternalScaleInstance(inst: InstanceNode): Promise<boolean> {
    try {
        const mainComp = await inst.getMainComponentAsync();
        if (mainComp) {
            // Check if it's a scale component by name but not from current document
            const componentSet = mainComp.parent;
            if (componentSet?.type === "COMPONENT_SET" && componentSet.name === SCALE_COMPONENT_NAME) {
                const storedId = getStoredScaleComponentId();
                // It's external if it doesn't match our stored component ID
                return componentSet.id !== storedId;
            }
        }
    } catch (e) {
        console.warn('Could not check external instance:', inst.id, e);
    }
    return false;
}

async function resolveScaleInstance(inst: InstanceNode): Promise<ScaleInstanceInfo | null> {
    if (!(await isScaleInstance(inst))) return null;

    const text = findValueText(inst);
    if (!text) return null;

    const line = inst.findOne(n => n.type === "LINE" && n.name === "Arrow") as LineNode | null;
    return { inst, text, line };
}

// Check if instance needs text/stroke update
function needsResolvedUpdate(info: ScaleInstanceInfo): boolean {
    const expectedText = px(info.inst.height);
    const expectedStroke = info.inst.height <= 10 ? 0.5 : 1;
    return info.text.characters !== expectedText || (info.line ? info.line.strokeWeight !== expectedStroke : false);
}

// Sync a single instance's text to its own height
async function syncResolved(info: ScaleInstanceInfo) {
    await setText(info.text, px(info.inst.height));

    // Update stroke weight based on height
    if (info.line) {
        info.line.strokeWeight = info.inst.height <= 10 ? 0.5 : 1;
    }
}

async function syncOne(inst: InstanceNode) {
    const info = await resolveScaleInstance(inst);
    if (!info) return;
    await syncResolved(info);
}

// Collect candidate instances in the document (optionally within selection)
async function getScaleInstances(scope: "all" | "selection" = "all"): Promise<InstanceNode[]> {
    if (scope === "all") {
        await figma.loadAllPagesAsync();
    }
    
    let roots: ReadonlyArray<BaseNode & ChildrenMixin>;
    
    if (scope === "selection" && figma.currentPage.selection.length) {
        // 選択されたオブジェクト内を検索（選択されたオブジェクト自体も含む）
        roots = figma.currentPage.selection as ReadonlyArray<BaseNode & ChildrenMixin>;
    } else if (scope === "all") {
        // 全ドキュメント検索
        roots = [figma.root as BaseNode & ChildrenMixin];
    } else {
        // In selection mode, an empty selection should stay cheap. The delayed
        // full sync covers document-wide updates after startup.
        roots = [];
    }

    const found: InstanceNode[] = [];
    for (const r of roots) {
        // 選択されたオブジェクト自体がインスタンスかチェック
        if (r.type === "INSTANCE") {
            found.push(r as InstanceNode);
        }
        
        // findAll を持つオブジェクトのみ子要素を検索
        if ("findAll" in r) {
            const instances = r.findAll(n => n.type === "INSTANCE") as InstanceNode[];
            found.push(...instances);
        }
    }
    
    // Remove duplicates (in case same instance is found multiple ways)
    const unique = Array.from(new Set(found));
    return unique;
}

async function syncAll(scope: "all" | "selection" = "all") {
    const list = await getScaleInstances(scope);
    
    // Early return if no instances found
    if (list.length === 0) {
        return;
    }
    
    let totalUpdated = 0;

    for (let i = 0; i < list.length; i += BATCH_SIZE) {
        const batch = list.slice(i, i + BATCH_SIZE);
        const instancesNeedingUpdate: ScaleInstanceInfo[] = [];
        
        // Filter batch to only instances that need updates
        for (const inst of batch) {
            const info = await resolveScaleInstance(inst);
            if (info && needsResolvedUpdate(info)) {
                instancesNeedingUpdate.push(info);
            }
        }
        
        // Sync instances in this batch
        for (const info of instancesNeedingUpdate) {
            await syncResolved(info);
        }
        
        totalUpdated += instancesNeedingUpdate.length;
        
        // Allow other operations between batches
        if (i + BATCH_SIZE < list.length) {
            await waitForIdle();
        }
    }
    
    // Only show notification during startup sync
    if (totalUpdated > 0 && isStartupSync) {
        figma.notify(`${totalUpdated}個のインスタンスを更新しました`);
    }
}

// ---------- Auto sync while UI is open ----------
let ticking = false;
let selectionDebounceTimer: number | null = null;
let selectedInstancePollTimer: number | null = null;
let selectionChangeHandler: (() => void) | null = null;
let isStartupSync = false;

async function runSync(scope: "all" | "selection", startupSync: boolean = false): Promise<boolean> {
    if (ticking) return false;

    ticking = true;
    const previousStartupSync = isStartupSync;
    if (startupSync) {
        isStartupSync = true;
    }

    try {
        await syncAll(scope);
        return true;
    } finally {
        isStartupSync = previousStartupSync;
        ticking = false;
    }
}

function onSelChange() {
    if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer);

    selectionDebounceTimer = setTimeout(async () => {
        selectionDebounceTimer = null;
        await runSync("selection");
    }, SELECTION_CHANGE_DEBOUNCE_MS);
}

async function syncDirectSelection() {
    const selectedInstances = figma.currentPage.selection.filter((node): node is InstanceNode => node.type === "INSTANCE");
    if (selectedInstances.length === 0 || ticking) return;

    ticking = true;
    try {
        for (const inst of selectedInstances) {
            const info = await resolveScaleInstance(inst);
            if (info && needsResolvedUpdate(info)) {
                await syncResolved(info);
            }
        }
    } finally {
        ticking = false;
    }
}

function startSelectedInstancePolling() {
    if (selectedInstancePollTimer) return;

    selectedInstancePollTimer = setInterval(() => {
        syncDirectSelection().catch(console.error);
    }, SELECTED_INSTANCE_POLL_MS);
}

// Convert external instance to current document's component (with pre-existing components)
async function convertInstanceWithComponents(
    inst: InstanceNode, 
    vertical: ComponentNode, 
    horizontal: ComponentNode
): Promise<InstanceNode | null> {
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
            } catch (e) {
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
        await syncOne(newInstance);
        
        return newInstance;
    } catch (e) {
        console.error('Failed to convert instance:', e);
        return null;
    }
}

// Convert external instance to current document's component (creates component set if needed)
async function convertInstance(inst: InstanceNode): Promise<InstanceNode | null> {
    try {
        // Get the current component set
        const { vertical, horizontal } = await getOrCreateScaleComponentSet();
        return await convertInstanceWithComponents(inst, vertical, horizontal);
    } catch (e) {
        console.error('Failed to convert instance:', e);
        return null;
    }
}

// Collect external instances from given nodes (including nested ones)
async function collectExternalInstances(nodes: readonly SceneNode[]): Promise<InstanceNode[]> {
    const allInstances: InstanceNode[] = [];
    
    // Collect all instances from selection and nested containers
    for (const node of nodes) {
        if (node.type === "INSTANCE") {
            allInstances.push(node as InstanceNode);
        }
        
        // Also check for instances within selected containers
        if ('findAll' in node) {
            const nestedInstances = node.findAll(n => n.type === "INSTANCE") as InstanceNode[];
            allInstances.push(...nestedInstances);
        }
    }
    
    const externalInstances: InstanceNode[] = [];
    for (let i = 0; i < allInstances.length; i += BATCH_SIZE) {
        const batch = allInstances.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(async inst => ({
            inst,
            isExternal: await isExternalScaleInstance(inst)
        })));

        externalInstances.push(...results.filter(result => result.isExternal).map(result => result.inst));

        if (i + BATCH_SIZE < allInstances.length) {
            await waitForIdle();
        }
    }

    return externalInstances;
}

// Convert selected external instances to current document
async function convertSelectedInstancesToCurrentDocument(): Promise<{converted: number, total: number}> {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        return { converted: 0, total: 0 };
    }
    
    const externalInstances = await collectExternalInstances(selection);
    
    if (externalInstances.length === 0) {
        return { converted: 0, total: 0 };
    }
    
    // Ensure component set exists once before parallel conversion
    const { vertical, horizontal } = await getOrCreateScaleComponentSet();
    
    // Convert instances in parallel with shared component set
    const conversionPromises = externalInstances.map(inst => 
        convertInstanceWithComponents(inst, vertical, horizontal)
    );
    const conversionResults = await Promise.all(conversionPromises);
    
    // Filter successful conversions
    const newSelection = conversionResults.filter((result): result is InstanceNode => result !== null);
    const converted = newSelection.length;
    
    // Update selection to include converted instances
    if (newSelection.length > 0) {
        figma.currentPage.selection = newSelection;
    }
    
    return { converted, total: externalInstances.length };
}

// Clean up function to remove event listeners and timers
function cleanup() {
    if (selectionDebounceTimer) {
        clearTimeout(selectionDebounceTimer);
        selectionDebounceTimer = null;
    }

    if (selectedInstancePollTimer) {
        clearInterval(selectedInstancePollTimer);
        selectedInstancePollTimer = null;
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

    // Store reference to handler for cleanup
    selectionChangeHandler = onSelChange;

    // Keep automatic work limited to the current selection. Full-page loading
    // is intentionally not scheduled automatically.
    figma.on("selectionchange", selectionChangeHandler);
    startSelectedInstancePolling();

    runSync("selection").catch(console.error);
});

// Clean up when plugin closes
figma.on("close", cleanup);

figma.ui.onmessage = async (msg) => {
    if (msg.type === "INSERT") {
        await insertScaleInstance();
        figma.notify("コンポーネントを作成しました！");
    } else if (msg.type === "CONVERT") {
        const result = await convertSelectedInstancesToCurrentDocument();
        if (result.total === 0) {
            figma.notify("選択範囲に変換対象のインスタンスが見つかりません");
        } else if (result.converted === 0) {
            figma.notify("インスタンスの変換に失敗しました");
        } else {
            figma.notify(`${result.converted}個のインスタンスを変換しました！`);
        }
    }
};
