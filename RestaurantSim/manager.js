// gui ids
var ID_JOB_LABEL = 10;
var ID_START_JOB_BUTTON = 11;
var ID_STOP_JOB_BUTTON = 12;
var ID_LABEL_SPAWN   = 20;
var ID_LABEL_COUNTER = 21;
var ID_FIELD_SPAWN   = 22;
var ID_FIELD_COUNTER = 23;
var ID_LABEL_CHAIRS  = 24; // new
var ID_FIELD_CHAIRS  = 25; // new

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

// configurable: how many ticks a chair stays taken after assignment (default 30 seconds = 600 ticks)
var CHAIR_FREE_TICKS = 2;

var managerJobActive = false;
var jobTicks = 0; // counts up while job active (in ticks)
var chairsList = []; // array of {x,y,z,taken:boolean,freeAtTick:number}

// interact
function interact(event) {
    var player = event.player;
    var api = event.API;
    lastNpc = event.npc;
    var held = player.getMainhandItem();
    if (held && !held.isEmpty() && held.getName() === "minecraft:bedrock") openAdminGui(player, api);
    else openPlayerGui(player, api);
}

// build slot positions (only once)
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

// load/save npc menu items (names used for GUI)
function loadNpcMenuItems(npc) {
    var data = npc.getStoreddata();
    return data.has("MenuItems") ? JSON.parse(data.get("MenuItems")) : [];
}

// chair list helpers
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
        out.push({ x: x, y: y, z: z, taken: false, freeAtTick: 0 });
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

// reset chairs runtime (mark all free)
function resetChairRuntime(npc) {
    for (var i = 0; i < chairsList.length; i++) {
        chairsList[i].taken = false;
        chairsList[i].freeAtTick = 0;
    }
    saveChairList(npc, chairsList);
}

// Find a free chair index in chairsList (returns index or -1)
function findFreeChairIndex() {
    for (var i = 0; i < chairsList.length; i++) {
        if (!chairsList[i].taken) return i;
    }
    return -1;
}

// Assign a chair to a given customer entity (customer must be an entity instance)
function assignChairToCustomer(npcManager, customer) {
    // ensure chairsList is populated
    if (!Array.isArray(chairsList) || chairsList.length === 0) return false;

    var pickIdx = -1;
    var freeIndices = [];
    for (var i = 0; i < chairsList.length; i++) {
        if (!chairsList[i].taken) freeIndices.push(i);
    }
    if (freeIndices.length === 0) return false;

    pickIdx = freeIndices[Math.floor(Math.random() * freeIndices.length)];
    chairsList[pickIdx].taken = true;
    chairsList[pickIdx].freeAtTick = jobTicks + CHAIR_FREE_TICKS;

    // persist
    saveChairList(npcManager, chairsList);

    // write the assigned chair to the customer's storeddata so customer can navigate to it
    var assigned = { x: chairsList[pickIdx].x, y: chairsList[pickIdx].y, z: chairsList[pickIdx].z };
    try {
        customer.getStoreddata().put("AssignedChair", JSON.stringify(assigned));
        // signal customer that assignment happened (customer script should react)
        customer.getStoreddata().put("AssignedByManager", "true");
    } catch (e) {}

    return true;
}

// updated save: keeps GUI-friendly names (MenuItems) and writes full-NBT list for highlighted slots (RestaurantMenu)
// npc: NPC to write to
// player: (optional) player who closed GUI - used to read that player's SelectedMenuSlots
function saveNpcMenuItems(npc, player) {
    // 1) Save GUI-friendly names (unchanged)
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

    // 2) Build highlighted full-NBT list from selected slots and save to RestaurantMenu
    var highlightedNbt = [];

    // determine which selection source to use:
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

    // collect full NBT from each selected index
    for (var i = 0; i < sel.length; i++) {
        var idx = sel[i];
        if (typeof idx !== "number") continue;
        if (idx < 0 || idx >= mySlots.length) continue;
        var s = mySlots[idx] && mySlots[idx].getStack ? mySlots[idx].getStack() : null;
        if (s && !s.isEmpty()) {
            try {
                var nbtObj = s.getItemNbt(); // IItemNbt
                highlightedNbt.push(nbtObj.toJsonString());
            } catch (e) {
                // skip if unable to serialize
            }
        }
    }

    // write full NBT list for customers
    npc.getStoreddata().put("RestaurantMenu", JSON.stringify(highlightedNbt));
}

// admin gui
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

    // chairs input
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

// helper to create dummy stack from item name
function stackFromName(name) {
    var parts = name.split(":");
    if (parts.length === 2) return parts[0] + ":" + parts[1];
    return "minecraft:stone";
}

// player gui
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

// slot click
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

// admin highlight
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

// player highlight
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

// parse coordinates string
function parseCoordsString(str) {
    if (!str) return null;
    var p = str.split(/[ ,]+/);
    if (p.length < 3) return null;
    var x = parseFloat(p[0]), y = parseFloat(p[1]), z = parseFloat(p[2]);
    if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
    return { x: x, y: y, z: z };
}

// spawn customer clone
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

    // prefer highlighted full-NBT list if present, else fallback to MenuItems names
    var menu = [];
    if (npcData.has("RestaurantMenu")) {
        try { menu = JSON.parse(npcData.get("RestaurantMenu")); } catch(e) { menu = []; }
    } else {
        menu = loadNpcMenuItems(lastNpc);
    }

    // load chairs runtime from npcData (but DO NOT auto-assign chairs here;
    // assignment will be done later when customer requests a chair)
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

            // DO NOT assign chair now; customers will request assignment after their GUI is closed.
            eData.put("RestaurantMenu", JSON.stringify(menu));  // customers read RestaurantMenu
            eData.put("CounterPos", counterJson);
            eData.put("InitializedByManager", "true");
            break;
        } catch(e) {}
    }
}

// buttons
function customGuiButton(event) {
    var player = event.player;
    if (event.buttonId === ID_START_JOB_BUTTON) {
        player.getStoreddata().put("RestaurantJobActive", "true");
        player.message("Job started");
        // ensure RestaurantMenu is up-to-date before spawning
        saveNpcMenuItems(lastNpc, player);

        // parse & save chairs text if present (admin may have edited)
        try {
            var gui = event.gui;
            if (gui) {
                var chairsField = gui.getComponent(ID_FIELD_CHAIRS);
                if (chairsField) {
                    var chairText = chairsField.getText();
                    lastNpc.getStoreddata().put("ChairListText", chairText);
                    var parsed = parseChairListString(chairText);
                    // reset taken/freeAt when starting job
                    for (var i = 0; i < parsed.length; i++) { parsed[i].taken = false; parsed[i].freeAtTick = 0; }
                    saveChairList(lastNpc, parsed);
                    chairsList = parsed;
                }
            }
        } catch (e) {}

        // start job clock: reset tick counter and mark job active
        managerJobActive = true;
        jobTicks = 0;
        lastNpc.getStoreddata().put("ManagerJobActive", "true");

        // ensure all chairs runtime reset
        resetChairRuntime(lastNpc);

        spawnCustomerCloneAtManager(player);
    }
    if (event.buttonId === ID_STOP_JOB_BUTTON) {
        player.getStoreddata().put("RestaurantJobActive", "false");
        player.message("Job stopped");
        managerJobActive = false;
        lastNpc.getStoreddata().put("ManagerJobActive", "false");

        // On stop, mark all chairs empty and reset timers
        chairsList = loadChairList(lastNpc);
        for (var i = 0; i < chairsList.length; i++) {
            chairsList[i].taken = false;
            chairsList[i].freeAtTick = 0;
        }
        saveChairList(lastNpc, chairsList);
        jobTicks = 0;
    }
}

// save admin data
function customGuiClosed(event) {
    if (!isAdminGui || !lastNpc) return;
    var gui = event.gui;
    var npcData = lastNpc.getStoreddata();

    // pass the player so saveNpcMenuItems can extract that player's SelectedMenuSlots
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
        // reset runtime markers
        for (var i = 0; i < parsed.length; i++) { parsed[i].taken = false; parsed[i].freeAtTick = 0; }
        saveChairList(lastNpc, parsed);
        chairsList = parsed;
    }
}

// tick handler: update job clock and free chairs when time reached
function tick(event) {
    // tick runs on the manager NPC
    var npc = event.npc;
    var world = npc.getWorld();

    // load chairs from storage if not present in runtime
    if ((!Array.isArray(chairsList) || chairsList.length === 0) && npc.getStoreddata().has("ChairList")) {
        try { chairsList = JSON.parse(npc.getStoreddata().get("ChairList")); } catch (e) { chairsList = []; }
    }

    // If job active, advance tick counter and free chairs whose freeAtTick <= jobTicks
    if (managerJobActive) {
        jobTicks = (typeof jobTicks === "number") ? jobTicks + 1 : 1;

        var changed = false;
        for (var i = 0; i < chairsList.length; i++) {
            var ch = chairsList[i];
            if (ch && ch.taken && typeof ch.freeAtTick === "number" && jobTicks >= ch.freeAtTick) {
                // free it
                ch.taken = false;
                ch.freeAtTick = 0;
                changed = true;

                // Notify nearby customers who had that chair assigned to leave.
                // We'll search for nearby NPC customers and check assigned chair
                try {
                    var nearbyEntities = world.getNearbyEntities(npc.getX(), npc.getY(), npc.getZ(), 50, 2); // 2 = NPCs
                    for (var ei = 0; ei < nearbyEntities.length; ei++) {
                        try {
                            var ent = nearbyEntities[ei];
                            if (!ent || !ent.getName) continue;
                            if (ent.getName() !== "customer") continue;
                            var ed = ent.getStoreddata();
                            if (ed.has("AssignedChair")) {
                                try {
                                    var ac = JSON.parse(ed.get("AssignedChair"));
                                    if (ac && ac.x === ch.x && ac.y === ch.y && ac.z === ch.z) {
                                        // tell the customer to leave/spawn (customer script should react to this flag)
                                        ed.put("Leave", "true");
                                        // also remove the assignment so they won't be reassigned
                                        ed.put("AssignedChair", "");
                                    }
                                } catch (e) {}
                            }
                        } catch (e) {}
                    }
                } catch (e) {}

                // notify nearby players (20-block radius) for UX
                try {
                    var playersNearby = world.getNearbyEntities(npc.getX(), npc.getY(), npc.getZ(), 20, 1); // 1 = players
                    for (var pi = 0; pi < playersNearby.length; pi++) {
                        try { playersNearby[pi].message("A chair is now free at: " + ch.x + " " + ch.y + " " + ch.z + "."); } catch (e) {}
                    }
                } catch (e) {}
            }
        }

        if (changed) {
            saveChairList(npc, chairsList);
        }

        // Also: process any customers that requested chairs (they set RequestChair="true" in their storeddata)
        try {
            // look for customers within some radius (50 blocks)
            var customersNearby = world.getNearbyEntities(npc.getX(), npc.getY(), npc.getZ(), 50, 2);
            for (var ci = 0; ci < customersNearby.length; ci++) {
                try {
                    var cust = customersNearby[ci];
                    if (!cust || !cust.getName) continue;
                    if (cust.getName() !== "customer") continue;
                    var cdata = cust.getStoreddata();
                    if (cdata.has("RequestChair") && cdata.get("RequestChair") === "true") {
                        // attempt to assign
                        var assigned = assignChairToCustomer(npc, cust);
                        // clear the RequestChair flag so we don't re-process; the customer can still have AssignedChair stored
                        try { cdata.put("RequestChair", "false"); } catch (e) {}
                        // we don't break — continue assigning other waiting customers
                    }
                } catch (e) {}
            }
        } catch (e) {}
    } else {
        // if managerJobActive false, try to read stored flag (in case of reload)
        try {
            var d = npc.getStoreddata();
            if (d.has("ManagerJobActive")) {
                managerJobActive = (d.get("ManagerJobActive") === "true");
                if (!managerJobActive) jobTicks = 0;
            }
        } catch (e) {}
    }
}
