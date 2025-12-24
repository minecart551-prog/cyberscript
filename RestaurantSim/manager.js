// gui ids
var ID_JOB_LABEL = 10;
var ID_START_JOB_BUTTON = 11;
var ID_STOP_JOB_BUTTON = 12;
var ID_LABEL_SPAWN   = 20;
var ID_LABEL_COUNTER = 21;
var ID_FIELD_SPAWN   = 22;
var ID_FIELD_COUNTER = 23;
var ID_LABEL_CHAIRS  = 24;
var ID_FIELD_CHAIRS  = 25;

// section config
var SECTIONS = [
    { name: "Drinks", startX: -150, startY: -60, rows: 6, columns: 4, slotSpacingX: 20, slotSpacingY: 20 },
    { name: "Food", startX: 200, startY: -60, rows: 6, columns: 4, slotSpacingX: 20, slotSpacingY: 20 }
];

// runtime
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

// job / chairs runtime
var CHAIR_FREE_TICKS = 20; // 5 seconds for testing
var managerJobActive = false;
var jobTicks = 0;
var chairsList = []; // array of {x,y,z,taken:boolean,freeAtTick:number,occupiedBy:string}

function interact(event) {
    var player = event.player;
    var api = event.API;
    lastNpc = event.npc;
    var held = player.getMainhandItem();
    if (held && !held.isEmpty() && held.getName() === "minecraft:bedrock") openAdminGui(player, api);
    else openPlayerGui(player, api);
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

function openAdminGui(player, api) {
    isAdminGui = true;
    highlightedAdminSlot = null;
    adminHighlightLines = [];
    buildSlotPositions();
    storedSlotItems = loadNpcMenuItems(lastNpc);
    guiRef = api.createCustomGui(176, 166, 0, true, player);

    guiRef.addLabel(ID_JOB_LABEL, "Admin Menu Setup", 11, -110, 156, 12).setColor(0xFFFFFF);

    var npcData = lastNpc.getStoreddata();
    var spawnText = npcData.has("CustomerSpawn") ? npcData.get("CustomerSpawn") : "";
    var counterText = npcData.has("CounterPos") ? npcData.get("CounterPos") : "";
    var chairsText = npcData.has("ChairListText") ? npcData.get("ChairListText") : "";

    guiRef.addLabel(ID_LABEL_SPAWN, "Customer Spawn (x y z)", 10, 10, 156, 12);
    guiRef.addTextField(ID_FIELD_SPAWN, 10, 25, 156, 18).setText(spawnText);
    guiRef.addLabel(ID_LABEL_COUNTER, "Counter Position (x y z)", 10, 50, 156, 12);
    guiRef.addTextField(ID_FIELD_COUNTER, 10, 65, 156, 18).setText(counterText);
    guiRef.addLabel(ID_LABEL_CHAIRS, "Chairs (x y z, x y z, ...)", 10, 90, 156, 12);
    guiRef.addTextField(ID_FIELD_CHAIRS, 10, 105, 156, 18).setText(chairsText);

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

    guiRef.showPlayerInventory(10, 130, false);
    player.showCustomGui(guiRef);
}

function stackFromName(name) {
    var parts = name.split(":");
    if (parts.length === 2) return parts[0] + ":" + parts[1];
    return "minecraft:stone";
}

function openPlayerGui(player, api) {
    isAdminGui = false;
    buildSlotPositions();
    storedSlotItems = loadNpcMenuItems(lastNpc);
    selectedSlots = player.getStoreddata().has("SelectedMenuSlots") ? JSON.parse(player.getStoreddata().get("SelectedMenuSlots")) : [];
    renderPlayerGui(player, api);
}

function renderPlayerGui(player, api) {
    guiRef = api.createCustomGui(176, 166, 0, true, player);
    guiRef.addLabel(ID_JOB_LABEL, "Restaurant Menu", 10, -110, 156, 12).setColor(0xFFFFFF);

    mySlots = [];
    slotHighlights = {};
    nextLineId = 1000;

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

    selectedSlots.forEach(function(idx) {
        if (idx >= 0 && idx < mySlots.length) drawHighlight(idx);
    });

    guiRef.addButton(ID_START_JOB_BUTTON, "Start Job", 10, 90, 70, 20);
    guiRef.addButton(ID_STOP_JOB_BUTTON, "Stop Job", 90, 90, 70, 20);

    player.showCustomGui(guiRef);
}

function customGuiSlotClicked(event) {
    var clickedSlot = event.slot,
        stack = event.stack,
        player = event.player,
        index = mySlots.indexOf(clickedSlot);
    if (isAdminGui) {
        if (index !== -1) {
            highlightedAdminSlot = clickedSlot;
            clearAdminHighlight();
            var pos = slotPositions[index];
            drawAdminHighlight(pos.x, pos.y);
            guiRef.update();
            return;
        }
        if (!highlightedAdminSlot) return;
        if (!stack || stack.isEmpty()) {
            highlightedAdminSlot.setStack(player.world.createItem("minecraft:air", 1));
            guiRef.update();
            return;
        }
        var copy = player.world.createItemFromNbt(stack.getItemNbt());
        copy.setStackSize(stack.getStackSize());
        highlightedAdminSlot.setStack(copy);
        guiRef.update();
        return;
    }
    if (index === -1) return;
    toggleHighlight(index, player, event.API);
}

function drawAdminHighlight(x, y) {
    var w = 18, h = 18;
    adminHighlightLines = [
        guiRef.addColoredLine(1, x, y, x + w, y, 0xADD8E6, 2),
        guiRef.addColoredLine(2, x, y + h, x + w, y + h, 0xADD8E6, 2),
        guiRef.addColoredLine(3, x, y, x, y + h, 0xADD8E6, 2),
        guiRef.addColoredLine(4, x + w, y, x + w, y + h, 0xADD8E6, 2)
    ];
}

function clearAdminHighlight() {
    adminHighlightLines.forEach(function(id) {
        try { guiRef.removeComponent(id); } catch(e) {}
    });
    adminHighlightLines = [];
}

function toggleHighlight(index, player, api) {
    var pos = selectedSlots.indexOf(index);
    if (pos !== -1) selectedSlots.splice(pos, 1);
    else selectedSlots.push(index);
    player.getStoreddata().put("SelectedMenuSlots", JSON.stringify(selectedSlots));
    renderPlayerGui(player, api);
}

function drawHighlight(index) {
    var pos = slotPositions[index],
        x = pos.x, y = pos.y, w = 18, h = 18;
    slotHighlights[index] = [
        guiRef.addColoredLine(nextLineId++, x, y, x + w, y, 0xADD8E6, 2),
        guiRef.addColoredLine(nextLineId++, x, y + h, x + w, y + h, 0xADD8E6, 2),
        guiRef.addColoredLine(nextLineId++, x, y, x, y + h, 0xADD8E6, 2),
        guiRef.addColoredLine(nextLineId++, x + w, y, x + w, y + h, 0xADD8E6, 2)
    ];
}

function parseCoordsString(str) {
    if (!str) return null;
    var p = str.split(/[ ,]+/);
    if (p.length < 3) return null;
    var x = parseFloat(p[0]), y = parseFloat(p[1]), z = parseFloat(p[2]);
    if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
    return { x: x, y: y, z: z };
}

function spawnCustomerCloneAtManager(player) {
    if (!lastNpc) return;
    var npcData = lastNpc.getStoreddata();
    var spawnStr = npcData.has("CustomerSpawn") ? npcData.get("CustomerSpawn") : null;
    var spawn = parseCoordsString(spawnStr);
    if (!spawn) spawn = { x: lastNpc.getX ? lastNpc.getX() : 0, y: lastNpc.getY ? lastNpc.getY() : 0, z: lastNpc.getZ ? lastNpc.getZ() : 0 };

    var world = player.world;
    try { 
        world.spawnClone(Math.floor(spawn.x), Math.floor(spawn.y), Math.floor(spawn.z), 3, "customer"); 
    } catch(e) { 
        try { 
            world.spawnClone(spawn.x, spawn.y, spawn.z, 3, "customer"); 
        } catch(e2) {} 
    }

    var nearby = []; 
    try { 
        nearby = world.getNearbyEntities(Math.floor(spawn.x), Math.floor(spawn.y), Math.floor(spawn.z), 8, 2); 
    } catch(e) { 
        try { nearby = world.getNearbyEntities(spawn.x, spawn.y, spawn.z, 8, 2); } 
        catch(e2) { nearby = []; } 
    }

    var menu = [];
    if (npcData.has("RestaurantMenu")) {
        try { menu = JSON.parse(npcData.get("RestaurantMenu")); } catch(e) { menu = []; }
    } else {
        menu = loadNpcMenuItems(lastNpc);
    }

    var chairs = loadChairList(lastNpc);
    chairsList = (Array.isArray(chairs) && chairs.length > 0) ? chairs : chairsList;

    var counterStr = npcData.has("CounterPos") ? npcData.get("CounterPos") : null;
    var counter = parseCoordsString(counterStr);
    if (!counter) counter = { x: lastNpc.getX ? lastNpc.getX() : spawn.x, y: lastNpc.getY ? lastNpc.getY() : spawn.y, z: lastNpc.getZ ? lastNpc.getZ() : spawn.z };
    var counterJson = JSON.stringify(counter);

    for (var i = 0; i < nearby.length; i++) {
        var ent = nearby[i]; 
        try {
            if (!ent || !ent.getName) continue;
            if (ent.getName() != "customer") continue;
            var eData = ent.getStoreddata();
            if (eData.has("InitializedByManager")) continue;

            eData.put("RestaurantMenu", JSON.stringify(menu));
            eData.put("CounterPos", counterJson);
            eData.put("InitializedByManager", "true");
            break;
        } catch(e) {}
    }
}

function customGuiButton(event) {
    var player = event.player;
    if (event.buttonId === ID_START_JOB_BUTTON) {
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
        lastNpc.getStoreddata().put("ManagerJobActive", "true");

        resetChairRuntime(lastNpc);
        spawnCustomerCloneAtManager(player);
    }
    if (event.buttonId === ID_STOP_JOB_BUTTON) {
        player.getStoreddata().put("RestaurantJobActive", "false");
        player.message("Job stopped");
        managerJobActive = false;
        lastNpc.getStoreddata().put("ManagerJobActive", "false");

        chairsList = loadChairList(lastNpc);
        for (var i = 0; i < chairsList.length; i++) {
            chairsList[i].taken = false;
            chairsList[i].freeAtTick = 0;
            chairsList[i].occupiedBy = "";
        }
        saveChairList(lastNpc, chairsList);
        jobTicks = 0;
    }
}

function customGuiClosed(event) {
    if (!isAdminGui || !lastNpc) return;
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
}

// Manager just manages chair availability - customers pull from it
function tick(event) {
    var npc = event.npc;

    // ALWAYS reload chairsList from storage to see customer updates
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
                if (!managerJobActive) jobTicks = 0;
            }
        } catch (e) {}
        return;
    }

    jobTicks = (typeof jobTicks === "number") ? jobTicks + 1 : 1;
    
    // Store jobTicks AND CHAIR_FREE_TICKS so customers can read them
    npc.getStoreddata().put("JobTicks", jobTicks.toString());
    npc.getStoreddata().put("ChairFreeTicks", CHAIR_FREE_TICKS.toString());

    // DEBUG: Every second, show occupied chairs
    if(jobTicks % 20 === 0){
        for(var i = 0; i < chairsList.length; i++){
            if(chairsList[i].taken){
                npc.say("Chair " + i + ": freeAt=" + chairsList[i].freeAtTick + ", now=" + jobTicks);
            }
        }
    }

    // Just free expired chairs - that's it!
    var changed = false;
    for (var i = 0; i < chairsList.length; i++) {
        var ch = chairsList[i];
        if (ch && ch.taken && typeof ch.freeAtTick === "number" && jobTicks >= ch.freeAtTick) {
            npc.say("FREEING chair " + i);
            ch.taken = false;
            ch.freeAtTick = 0;
            ch.occupiedBy = "";
            changed = true;
        }
    }

    if (changed) {
        saveChairList(npc, chairsList);
    }
}
