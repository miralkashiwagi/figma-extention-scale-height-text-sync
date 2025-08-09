// code.ts

function isText(n: SceneNode): n is TextNode { return n.type === "TEXT"; }

const SCALE_COMPONENT_ID_KEY = "scaleComponentId";
const VALUE_NODE_NAME = "value";
const SCALE_COMPONENT_NAME = "FrameHeight->TextSync";

async function setText(text: TextNode, s: string) {
    // Load Inter font (our standard font for this plugin)
    await figma.loadFontAsync(CONSTANTS.FONT).catch(()=>{});
    try { 
        text.characters = s;
        text.locked = true;
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
    await figma.loadFontAsync(CONSTANTS.FONT).catch(()=>{});
    text.fontName = CONSTANTS.FONT;
    text.lineHeight = { value: 100, unit: "PERCENT" };
    text.fontSize = 14;
    text.characters = px(height);
    text.locked = true;
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
async function getOrCreateScaleComponentSet(viewportCenter?: {x: number, y: number}): Promise<{componentSet: ComponentSetNode, vertical: ComponentNode, horizontal: ComponentNode}> {
    // Load all pages first for dynamic-page access
    await figma.loadAllPagesAsync();
    
    // Check if any instances or the main component exist in current page
    const currentPageInstances = figma.currentPage.findAll(n => n.type === "INSTANCE") as InstanceNode[];
    const hasInstancesInCurrentPage = await Promise.all(
        currentPageInstances.map(inst => isScaleInstance(inst))
    ).then(results => results.some(result => result));
    
    const currentPageComponents = figma.currentPage.findAll(n => n.type === "COMPONENT_SET" && n.name === SCALE_COMPONENT_NAME);
    const hasMainComponentInCurrentPage = currentPageComponents.length > 0;
    
    // If no instances or main components exist in current page, force regeneration
    if (!hasInstancesInCurrentPage && !hasMainComponentInCurrentPage) {
        // Clear stored ID to force regeneration
        figma.root.setPluginData(SCALE_COMPONENT_ID_KEY, "");
    } else {
        // Try find by stored Component ID first
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
        
        // Fallback: Try find by name in document
        const existing = figma.root.findOne(n => n.type === "COMPONENT_SET" && n.name === SCALE_COMPONENT_NAME) as ComponentSetNode | null;
        if (existing) {
            // Store the ID for future reference
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


    // Create component set from the two components
    const componentSet = figma.combineAsVariants([vertical, horizontal], figma.currentPage);
    componentSet.name = SCALE_COMPONENT_NAME;
    componentSet.layoutMode = "HORIZONTAL";
    componentSet.primaryAxisSizingMode = "AUTO";
    componentSet.counterAxisSizingMode = "AUTO";
    componentSet.counterAxisAlignItems = "CENTER";
    componentSet.primaryAxisAlignItems = "MIN";
    componentSet.itemSpacing = 10;
    componentSet.paddingLeft = componentSet.paddingRight = componentSet.paddingTop = componentSet.paddingBottom = 30;
    
    // Position component set near viewport center if provided
    if (viewportCenter) {
        componentSet.x = viewportCenter.x - componentSet.width;
        componentSet.y = viewportCenter.y - componentSet.height;
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

// Insert one instance near selection center
async function insertScaleInstance() {
    // Get viewport center once for both component set and instance positioning
    const vp = figma.viewport.center;
    const { vertical } = await getOrCreateScaleComponentSet(vp);
    const inst = vertical.createInstance();
    inst.name = SCALE_COMPONENT_NAME;

    // Rename the text node in the instance to match VALUE_NODE_NAME
    const textNode = inst.findOne(n => isText(n)) as TextNode | null;
    if (textNode) {
        textNode.name = VALUE_NODE_NAME;
    }

    inst.x = vp.x;
    inst.y = vp.y;

    figma.currentPage.appendChild(inst);
    figma.currentPage.selection = [inst];

    // Initial sync
    await syncOne(inst);
}

// Find the "value" text inside an instance
function findValueText(inst: InstanceNode): TextNode | null {
    return inst.findOne(n => isText(n) && n.name === VALUE_NODE_NAME) as TextNode | null;
}

// Check if instance is a scale instance (by component ID)
async function isScaleInstance(inst: InstanceNode): Promise<boolean> {
    const storedId = getStoredScaleComponentId();
    if (storedId) {
        const mainComp = await inst.getMainComponentAsync();
        if (mainComp) {
            // Check if main component belongs to our stored component set
            return mainComp.parent?.id === storedId;
        }
    }
    return false;
}

// Sync a single instance's text to its own height
async function syncOne(inst: InstanceNode) {
    if (!(await isScaleInstance(inst))) {
        return;
    }
    
    const t = findValueText(inst);
    if (!t) {
        return;
    }
    const newText = px(inst.height);
    await setText(t, newText);
    
    // Update stroke weight based on height
    const line = inst.findOne(n => n.type === "LINE" && n.name === "Arrow") as LineNode | null;
    if (line) {
        line.strokeWeight = inst.height <= 10 ? 0.5 : 1;
    }
}

// Collect all scale instances in the document (optionally within selection)
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
        // 現在のページ検索（selection modeで選択が空の場合）
        roots = [figma.currentPage as BaseNode & ChildrenMixin];
    }

    const found: InstanceNode[] = [];
    for (const r of roots) {
        // 選択されたオブジェクト自体がインスタンスかチェック
        if (r.type === "INSTANCE") {
            const inst = r as InstanceNode;
            if (await isScaleInstance(inst)) {
                found.push(inst);
            }
        }
        
        // findAll を持つオブジェクトのみ子要素を検索
        if ("findAll" in r) {
            const instances = r.findAll(n => n.type === "INSTANCE") as InstanceNode[];
            
            for (const inst of instances) {
                if (await isScaleInstance(inst)) {
                    found.push(inst);
                }
            }
        }
    }
    
    // Remove duplicates (in case same instance is found multiple ways)
    const unique = Array.from(new Set(found));
    return unique;
}

async function syncAll(scope: "all" | "selection" = "all") {
    const list = await getScaleInstances(scope);
    for (const inst of list) await syncOne(inst);
    figma.notify(`Synced ${list.length} scale instance(s).`);
}

// ---------- Auto mode while UI is open ----------
let autoMode = true;
let ticking = false;
let debounceTimer: number | null = null;

function onDocChange() {
    if (!autoMode) return;
    
    // Clear existing debounce timer
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    
    // Don't start new timer if already processing
    if (ticking) return;
    
    // Set debounce timer - longer delay to reduce updates during continuous resizing
    debounceTimer = setTimeout(async () => {
        if (ticking) return;
        ticking = true;
        debounceTimer = null;
        
        try {
            await syncAll("selection"); // 変更頻度を考慮して選択範囲優先。必要なら "all" に変更
        } finally {
            ticking = false;
        }
    }, 250); // Increased from 120ms to 250ms for better performance during resizing
}

function onSelChange() {
    if (!autoMode) return;
    syncAll("selection").catch(console.error);
}

// ---------- Commands ----------
figma.on("run", () => {
    // Always open UI when plugin is launched
    figma.showUI(__html__, { width: 240, height: 240 });
    figma.loadAllPagesAsync().then(async () => {
        // Sync all instances on startup (per new specification)
        await syncAll("all");
        
        figma.on("documentchange", onDocChange);
        figma.on("selectionchange", onSelChange);
    });
});

figma.ui.onmessage = async (msg) => {
    if (msg.type === "INSERT") {
        await insertScaleInstance();
        figma.notify("コンポーネントを作成しました！");
    }
    if (msg.type === "AUTO_SET") {
        autoMode = !!msg.value;
        figma.notify(`Auto Update: ${autoMode ? "ON" : "OFF"}`);
    }
};
