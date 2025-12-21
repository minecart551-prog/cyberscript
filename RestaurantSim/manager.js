// ===== GUI IDS =====

// Admin GUI
var ID_LABEL_SPAWN   = 1;
var ID_LABEL_COUNTER = 2;
var ID_FIELD_SPAWN   = 3;
var ID_FIELD_COUNTER = 4;

// Job GUI
var ID_JOB_LABEL = 10;
var ID_START_JOB_BUTTON = 11;

var lastNpc = null;

// ===== INTERACT =====
function interact(event) {
    var player = event.player;
    var api = event.API;

    lastNpc = event.npc;

    // Check held item
    var held = player.getMainhandItem();

    if (held && !held.isEmpty() && held.getName() === "minecraft:bedrock") {
        openAdminGui(player, api);
    } else {
        openJobGui(player, api);
    }
}

// ===== ADMIN GUI (COORDINATES) =====
function openAdminGui(player, api) {
    var npcData = lastNpc.getStoreddata();

    var spawnText = npcData.has("CustomerSpawn") ? npcData.get("CustomerSpawn") : "";
    var counterText = npcData.has("CounterPos") ? npcData.get("CounterPos") : "";

    var gui = api.createCustomGui(176, 166, 0, true, player);

    gui.addLabel(ID_LABEL_SPAWN, "Customer Spawn (x y z)", 10, 10, 156, 12);
    gui.addLabel(ID_LABEL_COUNTER, "Counter Position (x y z)", 10, 50, 156, 12);

    gui.addTextField(ID_FIELD_SPAWN, 10, 25, 156, 18).setText(spawnText);
    gui.addTextField(ID_FIELD_COUNTER, 10, 65, 156, 18).setText(counterText);

    player.showCustomGui(gui);
}

// ===== JOB GUI =====
function openJobGui(player, api) {
    var gui = api.createCustomGui(176, 166, 0, true, player);

    gui.addLabel(ID_JOB_LABEL, "Restaurant Job", 10, 20, 156, 20);
    gui.addButton(ID_START_JOB_BUTTON, "Start Job", 50, 60, 76, 20);

    player.showCustomGui(gui);
}

// ===== BUTTON HANDLER =====
function customGuiButton(event) {
    var player = event.player;

    if (event.buttonId === ID_START_JOB_BUTTON) {
        player.message("§aYou have started your restaurant job!");
        
        // Example job flag
        player.getStoreddata().put("RestaurantJobActive", "true");
    }
}

// ===== SAVE ADMIN DATA =====
function customGuiClosed(event) {
    if (!lastNpc) return;

    var gui = event.gui;
    var npcData = lastNpc.getStoreddata();

    var spawnField = gui.getComponent(ID_FIELD_SPAWN);
    var counterField = gui.getComponent(ID_FIELD_COUNTER);

    // Only save if admin GUI was open
    if (spawnField && counterField) {
        npcData.put("CustomerSpawn", spawnField.getText());
        npcData.put("CounterPos", counterField.getText());
    }
}
