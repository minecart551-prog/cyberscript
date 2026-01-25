var ID_JOB_LABEL = 10;
var ID_START_JOB_BUTTON = 11;
var ID_STOP_JOB_BUTTON = 12;
var ID_CLEAR_MENU_BUTTON = 13;
var ID_LABEL_SPAWN = 20;
var ID_LABEL_COUNTER = 21;
var ID_FIELD_SPAWN = 22;
var ID_FIELD_COUNTER = 23;
var ID_LABEL_CHAIRS = 24;
var ID_FIELD_CHAIRS = 25;
var ID_NEXT_PAGE_BUTTON = 30;
var ID_PREV_PAGE_BUTTON = 31;
var ID_CREATE_PAGE_BUTTON = 32;
var ID_MENU_SETUP_BUTTON = 33;
var ID_PRICING_SETUP_BUTTON = 34;

var SECTIONS = [
    { name: "Drinks", startX: -120, startY: -60, rows: 6, columns: 4, slotSpacingX: 20, slotSpacingY: 20 },
    { name: "Food", startX: 205, startY: -60, rows: 6, columns: 4, slotSpacingX: 20, slotSpacingY: 20 }
];

var scanRange = 30;
var pricingSlotPositions = [];
var pricingStartX = -105;
var pricingStartY = -116;
var pricingRowSpacing = 20.5;
var pricingColSpacing = 79;
var pricingNumRows = 10;
var pricingNumCols = 5;
var foodItemOffsetX = 0;
var price1OffsetX = 24;
var price2OffsetX = 42;

for (var col = 0; col < pricingNumCols; col++) {
    var colOffsetX = pricingStartX + col * pricingColSpacing;
    for (var row = 0; row < pricingNumRows; row++) {
        var y = pricingStartY + row * pricingRowSpacing;
        pricingSlotPositions.push({x: colOffsetX + foodItemOffsetX, y: y});
        pricingSlotPositions.push({x: colOffsetX + price1OffsetX, y: y});
        pricingSlotPositions.push({x: colOffsetX + price2OffsetX, y: y});
    }
}

var mySlots = [];
var slotPositions = [];
var selectedSlots = [];
var slotHighlights = {};
var highlightedAdminSlot = null;
var adminHighlightLines = [];
var guiRef = null;
var lastNpc = null;
var storedSlotItems = [];
var isAdminGui = false;
var nextLineId = 1000;
var slotPositionsBuilt = false;

var currentPricingPage = 0;
var maxPricingPages = 6;
var storedPricingItems = {};
var pricingSlots = [];
var pricingHighlightedSlot = null;
var pricingHighlightLines = [];

var viewMode = "menu";

var CHAIR_FREE_TICKS = 200;
var managerJobActive = false;
var jobTicks = 0;
var chairsList = [];

var MIN_CUSTOMERS = 1;
var MAX_CUSTOMERS = 6;
var MIN_SPAWN_INTERVAL = 80;
var MAX_SPAWN_INTERVAL = 81;
var currentCustomerCount = 0;
var nextSpawnTick = 0;

function makeNullArray(n) {
    var a = new Array(n);
    for (var i = 0; i < n; i++) { a[i] = null; }
    return a;
}

function buildSlotPositions() {
    if (slotPositionsBuilt) return;
    slotPositions = [];
    SECTIONS.forEach(function(section) {
        for (var r = 0; r < section.rows; r++)
            for (var c = 0; c < section.columns; c++)
                slotPositions.push({ x: section.startX + c * section.slotSpacingX, y: section.startY + r * section.slotSpacingY });
    });
    slotPositionsBuilt = true;
}

function loadNpcMenuItems(npc) {
    var data = npc.getStoreddata();
    return data.has("MenuItems") ? JSON.parse(data.get("MenuItems")) : [];
}

function parseChairListString(str) {
    if (!str) return [];
    var parts = str.split(",");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i].trim();
        if (!p) continue;
        var nums = p.split(/[ ,]+/);
        if (nums.length < 3) continue;
        var x = parseFloat(nums[0]), y = parseFloat(nums[1]), z = parseFloat(nums[2]);
        if (isNaN(x) || isNaN(y) || isNaN(z)) continue;
        out.push({ x: x, y: y, z: z, taken: false, freeAtTick: 0, occupiedBy: "" });
    }
    return out;
}

function loadChairList(npc) {
    var d = npc.getStoreddata();
    if (!d.has("ChairList")) return [];
    try { return JSON.parse(d.get("ChairList")); } catch (e) { return []; }
}

function saveChairList(npc, list) {
    npc.getStoreddata().put("ChairList", JSON.stringify(list));
}

function resetChairRuntime(npc) {
    for (var i = 0; i < chairsList.length; i++) {
        chairsList[i].taken = false;
        chairsList[i].freeAtTick = 0;
        chairsList[i].occupiedBy = "";
    }
    saveChairList(npc, chairsList);
}

function stackFromName(name) {
    var parts = name.split(":");
    if (parts.length === 2) return parts[0] + ":" + parts[1];
    return "minecraft:stone";
}

function parseCoordsString(str) {
    if (!str) return null;
    var p = str.split(/[ ,]+/);
    if (p.length < 3) return null;
    var x = parseFloat(p[0]), y = parseFloat(p[1]), z = parseFloat(p[2]);
    if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
    return { x: x, y: y, z: z };
}

function getRandomSpawnInterval() {
    return MIN_SPAWN_INTERVAL + Math.floor(Math.random() * (MAX_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL + 1));
}

function saveNpcMenuItems(npc, player) {
    var names = mySlots.map(function(slot) {
        var stack = slot.getStack();
        if (stack && !stack.isEmpty()) {
            var nbt = stack.getItemNbt();
            if (nbt && nbt.tag && nbt.tag.display && nbt.tag.display.Name) {
                return nbt.tag.display.Name.replace(/["']/g, "");
            } else {
                return stack.getName();
            }
        }
        return null;
    });
    npc.getStoreddata().put("MenuItems", JSON.stringify(names));

    var highlightedNbt = [];
    var sel = null;
    try {
        if (player && player.getStoreddata && player.getStoreddata().has("SelectedMenuSlots")) {
            sel = JSON.parse(player.getStoreddata().get("SelectedMenuSlots"));
        } else {
            var data = npc.getStoreddata();
            if (data.has("SelectedMenuSlots")) {
                try { sel = JSON.parse(data.get("SelectedMenuSlots")); } catch (e) { sel = null; }
            }
        }
    } catch (e) {
        sel = null;
    }
    if (!Array.isArray(sel)) sel = Array.isArray(selectedSlots) ? selectedSlots : [];

    for (var i = 0; i < sel.length; i++) {
        var idx = sel[i];
        if (typeof idx !== "number") continue;
        if (idx < 0 || idx >= mySlots.length) continue;
        var s = mySlots[idx] && mySlots[idx].getStack ? mySlots[idx].getStack() : null;
        if (s && !s.isEmpty()) {
            try {
                var nbtObj = s.getItemNbt();
                highlightedNbt.push(nbtObj.toJsonString());
            } catch (e) {}
        }
    }

    npc.getStoreddata().put("RestaurantMenu", JSON.stringify(highlightedNbt));
}

function openAdminMenuGui(player, api) {
    viewMode = "menu";
    isAdminGui = true;
    highlightedAdminSlot = null;
    adminHighlightLines = [];
    buildSlotPositions();
    storedSlotItems = loadNpcMenuItems(lastNpc);
    
    guiRef = api.createCustomGui(176, 166, 0, true, player);

    guiRef.addLabel(ID_JOB_LABEL, "Admin Menu Setup", 35, -110, 156, 12).setColor(0xFFFFFF);

    var npcData = lastNpc.getStoreddata();
    var spawnText = npcData.has("CustomerSpawn") ? npcData.get("CustomerSpawn") : "";
    var counterText = npcData.has("CounterPos") ? npcData.get("CounterPos") : "";
    var chairsText = npcData.has("ChairListText") ? npcData.get("ChairListText") : "";

    guiRef.addLabel(ID_LABEL_SPAWN, "Customer Spawn (x y z)", 5, -62, 156, 16).setColor(0xFFFFFF);
    guiRef.addTextField(ID_FIELD_SPAWN, 5, -49, 156, 18).setText(spawnText);
    guiRef.addLabel(ID_LABEL_COUNTER, "Counter Position (x y z)", 5, -22, 156, 16).setColor(0xFFFFFF);
    guiRef.addTextField(ID_FIELD_COUNTER, 5, -9, 156, 18).setText(counterText);
    guiRef.addLabel(ID_LABEL_CHAIRS, "Chairs (x y z, x y z, ...)", 5, 18, 156, 16).setColor(0xFFFFFF);
    guiRef.addTextField(ID_FIELD_CHAIRS, 5, 33, 156, 18).setText(chairsText).setColor(0xFFFFFF);

    guiRef.addButton(ID_PRICING_SETUP_BUTTON, "Pricing Setup", 202, 70, 80, 20);

    mySlots = [];
    for (var i = 0; i < slotPositions.length; i++) {
        var pos = slotPositions[i];
        var slot = guiRef.addItemSlot(pos.x, pos.y);
        if (storedSlotItems[i]) {
            try {
                var dummy = player.world.createItem(stackFromName(storedSlotItems[i]), 1);
                slot.setStack(dummy);
            } catch(e) {}
        }
        mySlots.push(slot);
    }

    guiRef.showPlayerInventory(3, 80, false);
    player.showCustomGui(guiRef);
}

function openPlayerGui(player, api) {
    viewMode = "menu";
    isAdminGui = false;
    buildSlotPositions();
    storedSlotItems = loadNpcMenuItems(lastNpc);
    selectedSlots = player.getStoreddata().has("SelectedMenuSlots") ? JSON.parse(player.getStoreddata().get("SelectedMenuSlots")) : [];
    renderPlayerGui(player, api);
}

function renderPlayerGui(player, api) {
    guiRef = api.createCustomGui(176, 166, 0, true, player);
    guiRef.addLabel(ID_JOB_LABEL, "Restaurant Menu", 40, -110, 156, 12).setColor(0xFFFFFF);

    mySlots = [];
    slotHighlights = {}; // Reset highlights for new GUI
    nextLineId = 1000; // Reset line ID counter

    for (var i = 0; i < slotPositions.length; i++) {
        var pos = slotPositions[i];
        var slot = guiRef.addItemSlot(pos.x, pos.y);
        if (storedSlotItems[i]) {
            try {
                var dummy = player.world.createItem(stackFromName(storedSlotItems[i]), 1);
                slot.setStack(dummy);
            } catch(e) {}
        }
        mySlots.push(slot);
    }

    // Draw highlights for selected slots
    selectedSlots.forEach(function(idx) {
        if (idx >= 0 && idx < mySlots.length) drawHighlight(idx);
    });

    guiRef.addButton(ID_START_JOB_BUTTON, "Start Job", 10, 80, 70, 20);
    guiRef.addButton(ID_STOP_JOB_BUTTON, "Stop Job", 90, 80, 70, 20);
    guiRef.addButton(ID_CLEAR_MENU_BUTTON, "Clear Menu", 45, 40, 80, 20);

    player.showCustomGui(guiRef);
}

function drawHighlight(index) {
    // Don't draw if GUI not available
    if (!guiRef) return;
    
    // Check if already highlighted in the current slotHighlights object
    if (slotHighlights[index]) return;
    
    var pos = slotPositions[index];
    if (!pos) return; // Safety check
    
    var x = pos.x, y = pos.y, w = 18, h = 18;
    slotHighlights[index] = [
        guiRef.addColoredLine(nextLineId++, x, y, x + w, y, 0xADD8E6, 2),
        guiRef.addColoredLine(nextLineId++, x, y + h, x + w, y + h, 0xADD8E6, 2),
        guiRef.addColoredLine(nextLineId++, x, y, x, y + h, 0xADD8E6, 2),
        guiRef.addColoredLine(nextLineId++, x + w, y, x + w, y + h, 0xADD8E6, 2)
    ];
}

function toggleHighlight(index, player) {
    if (!guiRef) return;
    
    var pos = selectedSlots.indexOf(index);
    if (pos !== -1) {
        // Slot already selected - do nothing (don't remove)
        return;
    }
    
    // Add to selectedSlots and draw highlight
    selectedSlots.push(index);
    player.getStoreddata().put("SelectedMenuSlots", JSON.stringify(selectedSlots));
    drawHighlight(index);
    if (guiRef) guiRef.update();
}

function openPricingGui(player, api) {
    viewMode = "pricing";
    isAdminGui = true;
    
    var npcData = lastNpc.getStoreddata();
    storedPricingItems = npcData.has("PricingItems") ? JSON.parse(npcData.get("PricingItems")) : {};
    
    if (!storedPricingItems[currentPricingPage]) {
        storedPricingItems[currentPricingPage] = makeNullArray(pricingSlotPositions.length);
    }
    
    pricingHighlightedSlot = null;
    pricingHighlightLines = [];
    
    guiRef = api.createCustomGui(176, 166, 0, true, player);
    
    guiRef.addLabel(ID_JOB_LABEL, "Menu Pricing Setup - Page " + (currentPricingPage + 1), 11, -129, 200, 12).setColor(0xFFFFFF);
    
    guiRef.addButton(ID_NEXT_PAGE_BUTTON, "Next", 284, -30, 35, 19);
    guiRef.addButton(ID_PREV_PAGE_BUTTON, "Back", -153, -30, 35, 19);
    guiRef.addButton(ID_CREATE_PAGE_BUTTON, "Create", 284, -60, 35, 19);
    guiRef.addButton(ID_MENU_SETUP_BUTTON, "<< Menu Setup", 190, 90, 80, 20);
    
    pricingSlots = pricingSlotPositions.map(function(pos) {
        return guiRef.addItemSlot(pos.x, pos.y);
    });
    
    for (var i = 0; i < pricingSlots.length; i++) {
        pricingSlots[i].setStack(null);
        if (storedPricingItems[currentPricingPage][i]) {
            try {
                var item = player.world.createItemFromNbt(api.stringToNbt(storedPricingItems[currentPricingPage][i]));
                pricingSlots[i].setStack(item);
            } catch(e) {}
        }
    }
    
    guiRef.showPlayerInventory(0, 93, false);
    player.showCustomGui(guiRef);
}

function savePricingPageItems() {
    if (!lastNpc) return;
    var npcData = lastNpc.getStoreddata();
    
    storedPricingItems[currentPricingPage] = pricingSlots.map(function(slot) {
        var stack = slot.getStack();
        return stack && !stack.isEmpty() ? stack.getItemNbt().toJsonString() : null;
    });
    
    npcData.put("PricingItems", JSON.stringify(storedPricingItems));
}

function drawPricingHighlight(gui, x, y) {
    if (!gui) return;
    
    var w = 18, h = 18;
    gui.addColoredLine(5001, x, y, x + w, y, 0xADD8E6, 2);
    gui.addColoredLine(5002, x, y + h, x + w, y + h, 0xADD8E6, 2);
    gui.addColoredLine(5003, x, y, x, y + h, 0xADD8E6, 2);
    gui.addColoredLine(5004, x + w, y, x + w, y + h, 0xADD8E6, 2);
    pricingHighlightLines = [5001, 5002, 5003, 5004];
}

function clearPricingHighlight(gui) {
    if (!gui) return;
    pricingHighlightLines.forEach(function(id) {
        try { gui.removeComponent(id); } catch(e) {}
    });
    pricingHighlightLines = [];
}

function drawAdminHighlight(gui, x, y) {
    if (!gui) return;
    
    var w = 18, h = 18;
    gui.addColoredLine(1, x, y, x + w, y, 0xADD8E6, 2);
    gui.addColoredLine(2, x, y + h, x + w, y + h, 0xADD8E6, 2);
    gui.addColoredLine(3, x, y, x, y + h, 0xADD8E6, 2);
    gui.addColoredLine(4, x + w, y, x + w, y + h, 0xADD8E6, 2);
    adminHighlightLines = [1, 2, 3, 4];
}

function clearAdminHighlight(gui) {
    if (!gui) return;
    adminHighlightLines.forEach(function(id) {
        try { gui.removeComponent(id); } catch(e) {}
    });
    adminHighlightLines = [];
}

function spawnCustomerCloneAtManager(npc, api) {
    if (!npc) return;
    
    var npcData = npc.getStoreddata();
    var spawnStr = npcData.has("CustomerSpawn") ? npcData.get("CustomerSpawn") : null;
    var spawn = parseCoordsString(spawnStr);
    if (!spawn) spawn = { x: npc.getX ? npc.getX() : 0, y: npc.getY ? npc.getY() : 0, z: npc.getZ ? npc.getZ() : 0 };

    var world = npc.getWorld();
    try { 
        world.spawnClone(Math.floor(spawn.x), Math.floor(spawn.y), Math.floor(spawn.z), 3, "customer"); 
    } catch(e) { 
        try { 
            world.spawnClone(spawn.x, spawn.y, spawn.z, 3, "customer"); 
        } catch(e2) {} 
    }

    var nearby = []; 
    try { 
        nearby = world.getNearbyEntities(Math.floor(spawn.x), Math.floor(spawn.y), Math.floor(spawn.z), scanRange, 2); 
    } catch(e) { 
        try { nearby = world.getNearbyEntities(spawn.x, spawn.y, spawn.z, scanRange, 2); } 
        catch(e2) { nearby = []; } 
    }

    var menu = [];
    if (npcData.has("RestaurantMenu")) {
        try { menu = JSON.parse(npcData.get("RestaurantMenu")); } catch(e) { menu = []; }
    } else {
        menu = loadNpcMenuItems(npc);
    }

    var chairs = loadChairList(npc);
    chairsList = (Array.isArray(chairs) && chairs.length > 0) ? chairs : chairsList;

    var counterStr = npcData.has("CounterPos") ? npcData.get("CounterPos") : null;
    var counter = parseCoordsString(counterStr);
    if (!counter) counter = { x: npc.getX ? npc.getX() : spawn.x, y: npc.getY ? npc.getY() : spawn.y, z: npc.getZ ? npc.getZ() : spawn.z };
    var counterJson = JSON.stringify(counter);

    var pricingData = npcData.has("PricingItems") ? npcData.get("PricingItems") : "{}";

    for (var i = 0; i < nearby.length; i++) {
        var ent = nearby[i]; 
        try {
            if (!ent || !ent.getName) continue;
            if (ent.getName() != "customer") continue;
            var eData = ent.getStoreddata();
            
            var isAlreadyInitialized = eData.has("InitializedByManager");
            
            if (!isAlreadyInitialized) {
                eData.put("RestaurantMenu", JSON.stringify(menu));
                eData.put("CounterPos", counterJson);
                eData.put("PricingData", pricingData);
                eData.put("InitializedByManager", "true");
                break;
            } else {
                eData.put("PricingData", pricingData);
            }
            
        } catch(e) {
        }
    }
}

function signalAllCustomersToLeave(npc) {
    npc.getStoreddata().put("JobStopped", "true");
}

function interact(event) {
    var player = event.player;
    var api = event.API;
    lastNpc = event.npc;
    var held = player.getMainhandItem();
    if (held && !held.isEmpty() && held.getName() === "minecraft:bedrock") openAdminMenuGui(player, api);
    else openPlayerGui(player, api);
}

function customGuiSlotClicked(event) {
    var clickedSlot = event.slot;
    var stack = event.stack;
    var player = event.player;
    var gui = event.gui;
    
    if (viewMode === "pricing") {
        var slotIndex = pricingSlots.indexOf(clickedSlot);
        
        if (slotIndex !== -1) {
            clearPricingHighlight(gui);
            pricingHighlightedSlot = clickedSlot;
            var pos = pricingSlotPositions[slotIndex];
            drawPricingHighlight(gui, pos.x, pos.y);
            if (gui) gui.update();
            return;
        }
        
        if (!pricingHighlightedSlot) return;
        
        if (!stack || stack.isEmpty()) {
            var currentStack = pricingHighlightedSlot.getStack();
            if (currentStack && !currentStack.isEmpty()) {
                pricingHighlightedSlot.setStack(player.world.createItem("minecraft:air", 1));
                if (gui) gui.update();
            }
            return;
        }
        
        try {
            var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
            itemCopy.setStackSize(stack.getStackSize());
            pricingHighlightedSlot.setStack(itemCopy);
            if (gui) gui.update();
        } catch(e) {}
        return;
        
    } else if (viewMode === "menu") {
        var index = mySlots.indexOf(clickedSlot);
        
        if (isAdminGui) {
            if (index !== -1) {
                clearAdminHighlight(gui);
                highlightedAdminSlot = clickedSlot;
                var pos = slotPositions[index];
                drawAdminHighlight(gui, pos.x, pos.y);
                if (gui) gui.update();
                return;
            }
            
            if (!highlightedAdminSlot) return;
            
            if (!stack || stack.isEmpty()) {
                var currentStack = highlightedAdminSlot.getStack();
                if (currentStack && !currentStack.isEmpty()) {
                    highlightedAdminSlot.setStack(player.world.createItem("minecraft:air", 1));
                    if (gui) gui.update();
                }
                return;
            }
            
            try {
                var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
                itemCopy.setStackSize(stack.getStackSize());
                highlightedAdminSlot.setStack(itemCopy);
                if (gui) gui.update();
            } catch(e) {}
            return;
        }
        
        if (index === -1) return;
        toggleHighlight(index, player);
    }
}

function customGuiButton(event) {
    var player = event.player;
    var api = event.API;
    
    if (event.buttonId === ID_PRICING_SETUP_BUTTON) {
        if (viewMode === "menu" && isAdminGui) {
            saveNpcMenuItems(lastNpc, player);
            var gui = event.gui;
            if (gui) {
                var chairsField = gui.getComponent(ID_FIELD_CHAIRS);
                if (chairsField) {
                    var chairText = chairsField.getText();
                    lastNpc.getStoreddata().put("ChairListText", chairText);
                }
            }
            openPricingGui(player, api);
        }
        return;
    }
    
    if (event.buttonId === ID_MENU_SETUP_BUTTON) {
        if (viewMode === "pricing") {
            savePricingPageItems();
            openAdminMenuGui(player, api);
        }
        return;
    }
    
    if (event.buttonId === ID_NEXT_PAGE_BUTTON) {
        if (viewMode === "pricing") {
            savePricingPageItems();
            var totalPages = Object.keys(storedPricingItems).length;
            if (currentPricingPage + 1 < totalPages) {
                currentPricingPage++;
                openPricingGui(player, api);
            }
        }
        return;
    }
    
    if (event.buttonId === ID_PREV_PAGE_BUTTON) {
        if (viewMode === "pricing") {
            if (currentPricingPage > 0) {
                savePricingPageItems();
                currentPricingPage--;
                openPricingGui(player, api);
            }
        }
        return;
    }
    
    if (event.buttonId === ID_CREATE_PAGE_BUTTON) {
        if (viewMode === "pricing") {
            var totalPages = Object.keys(storedPricingItems).length;
            if (totalPages < maxPricingPages) {
                savePricingPageItems();
                var newPage = totalPages;
                storedPricingItems[newPage] = makeNullArray(pricingSlotPositions.length);
                currentPricingPage = newPage;
                openPricingGui(player, api);
            }
        }
        return;
    }
    
    if (event.buttonId === ID_CLEAR_MENU_BUTTON) {
        if (viewMode === "menu" && !isAdminGui) {
            // Clear all selections and recreate GUI
            selectedSlots = [];
            player.getStoreddata().put("SelectedMenuSlots", JSON.stringify(selectedSlots));
            renderPlayerGui(player, api);
        }
        return;
    }
    
    if (event.buttonId === ID_START_JOB_BUTTON) {
        if (managerJobActive) {
            player.message("A job is currently running, stop it first.");
            return;
        }
        
        var storedActive = lastNpc.getStoreddata().has("ManagerJobActive") && 
                          lastNpc.getStoreddata().get("ManagerJobActive") === "true";
        if (storedActive) {
            player.message("A job is currently running, stop it first.");
            managerJobActive = true;
            return;
        }
        
        player.getStoreddata().put("RestaurantJobActive", "true");
        player.message("Job started");
        saveNpcMenuItems(lastNpc, player);

        try {
            var gui = event.gui;
            if (gui) {
                var chairsField = gui.getComponent(ID_FIELD_CHAIRS);
                if (chairsField) {
                    var chairText = chairsField.getText();
                    lastNpc.getStoreddata().put("ChairListText", chairText);
                    var parsed = parseChairListString(chairText);
                    for (var i = 0; i < parsed.length; i++) { 
                        parsed[i].taken = false; 
                        parsed[i].freeAtTick = 0;
                        parsed[i].occupiedBy = "";
                    }
                    saveChairList(lastNpc, parsed);
                    chairsList = parsed;
                }
            }
        } catch (e) {}

        managerJobActive = true;
        jobTicks = 0;
        currentCustomerCount = 0;
        nextSpawnTick = jobTicks + getRandomSpawnInterval();
        
        lastNpc.getStoreddata().put("ManagerJobActive", "true");
        lastNpc.getStoreddata().put("JobStopped", "false");
        lastNpc.getStoreddata().put("CurrentCustomerCount", "0");
        
        var npcData = lastNpc.getStoreddata();
        if(npcData.has("PricingItems")){
            storedPricingItems = {};
            
            try {
                var pricingJson = npcData.get("PricingItems");
                storedPricingItems = JSON.parse(pricingJson);
                var pageCount = Object.keys(storedPricingItems).length;
                
                npcData.put("PricingItems", pricingJson);
                
                var world = lastNpc.getWorld();
                var allNearby = world.getNearbyEntities(lastNpc.getX(), lastNpc.getY(), lastNpc.getZ(), scanRange, 2);
                for(var i = 0; i < allNearby.length; i++){
                    var ent = allNearby[i];
                    try {
                        if(ent && ent.getName && ent.getName() === "customer"){
                            var custData = ent.getStoreddata();
                            custData.put("PricingData", pricingJson);
                        }
                    } catch(e) {}
                }
            } catch(e) {}
        }

        resetChairRuntime(lastNpc);
        spawnCustomerCloneAtManager(lastNpc, api);
    }
    
    if (event.buttonId === ID_STOP_JOB_BUTTON) {
        player.getStoreddata().put("RestaurantJobActive", "false");
        player.message("Job stopped");
        managerJobActive = false;
        lastNpc.getStoreddata().put("ManagerJobActive", "false");

        signalAllCustomersToLeave(lastNpc);

        chairsList = loadChairList(lastNpc);
        for (var i = 0; i < chairsList.length; i++) {
            chairsList[i].taken = false;
            chairsList[i].freeAtTick = 0;
            chairsList[i].occupiedBy = "";
        }
        saveChairList(lastNpc, chairsList);
        jobTicks = 0;
        currentCustomerCount = 0;
        nextSpawnTick = 0;
        lastNpc.getStoreddata().put("CurrentCustomerCount", "0");
    }
}

function customGuiClosed(event) {
    if (viewMode === "pricing") {
        savePricingPageItems();
        guiRef = null;
    } else if (viewMode === "menu" && isAdminGui) {
        var gui = event.gui;
        var npcData = lastNpc.getStoreddata();

        saveNpcMenuItems(lastNpc, event.player);

        var spawnField = gui.getComponent(ID_FIELD_SPAWN);
        var counterField = gui.getComponent(ID_FIELD_COUNTER);
        var chairsField = gui.getComponent(ID_FIELD_CHAIRS);
        if (spawnField && counterField) {
            npcData.put("CustomerSpawn", spawnField.getText());
            npcData.put("CounterPos", counterField.getText());
        }
        if (chairsField) {
            var chairText = chairsField.getText();
            npcData.put("ChairListText", chairText);
            var parsed = parseChairListString(chairText);
            for (var i = 0; i < parsed.length; i++) { 
                parsed[i].taken = false; 
                parsed[i].freeAtTick = 0;
                parsed[i].occupiedBy = "";
            }
            saveChairList(lastNpc, parsed);
            chairsList = parsed;
        }
        guiRef = null;
    } else if (viewMode === "menu" && !isAdminGui) {
        // Player menu - don't clear guiRef as it might be recreating
        // Only clear if we're truly closing (not recreating)
        // guiRef will be overwritten when new GUI is created
    }
}

function tick(event) {
    var npc = event.npc;
    var api = event.API;

    if (npc.getStoreddata().has("ChairList")) {
        try { 
            chairsList = JSON.parse(npc.getStoreddata().get("ChairList")); 
        } catch (e) { 
            chairsList = []; 
        }
    }

    if (!managerJobActive) {
        try {
            var d = npc.getStoreddata();
            if (d.has("ManagerJobActive")) {
                managerJobActive = (d.get("ManagerJobActive") === "true");
                if (!managerJobActive) {
                    jobTicks = 0;
                    currentCustomerCount = 0;
                    nextSpawnTick = 0;
                }
            }
        } catch (e) {}
        return;
    }

    jobTicks = (typeof jobTicks === "number") ? jobTicks + 1 : 1;
    
    npc.getStoreddata().put("JobTicks", jobTicks.toString());
    npc.getStoreddata().put("ChairFreeTicks", CHAIR_FREE_TICKS.toString());

    try {
        if (npc.getStoreddata().has("CurrentCustomerCount")) {
            currentCustomerCount = parseInt(npc.getStoreddata().get("CurrentCustomerCount"));
        }
    } catch (e) {}

    var changed = false;
    for (var i = 0; i < chairsList.length; i++) {
        var ch = chairsList[i];
        if (ch && ch.taken && typeof ch.freeAtTick === "number" && jobTicks >= ch.freeAtTick) {
            ch.taken = false;
            ch.freeAtTick = 0;
            ch.occupiedBy = "";
            changed = true;
            
            if (currentCustomerCount > 0) {
                currentCustomerCount--;
                npc.getStoreddata().put("CurrentCustomerCount", currentCustomerCount.toString());
            }
        }
    }

    if (changed) {
        saveChairList(npc, chairsList);
    }

    if (jobTicks >= nextSpawnTick) {
        if (currentCustomerCount < MIN_CUSTOMERS) {
            currentCustomerCount++;
            npc.getStoreddata().put("CurrentCustomerCount", currentCustomerCount.toString());
            spawnCustomerCloneAtManager(npc, api);
            nextSpawnTick = jobTicks + getRandomSpawnInterval();
        } else if (currentCustomerCount < MAX_CUSTOMERS) {
            currentCustomerCount++;
            npc.getStoreddata().put("CurrentCustomerCount", currentCustomerCount.toString());
            spawnCustomerCloneAtManager(npc, api);
            nextSpawnTick = jobTicks + getRandomSpawnInterval();
        } else {
            nextSpawnTick = jobTicks + getRandomSpawnInterval();
        }
    }
}
