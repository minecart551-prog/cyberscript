// ===== GUI COMPONENT IDS =====
var ID_LABEL_SPAWN   = 1;
var ID_LABEL_COUNTER = 2;
var ID_FIELD_SPAWN   = 3;
var ID_FIELD_COUNTER = 4;

var lastNpc = null;
var guiRef = null;

// ===== OPEN GUI =====
function interact(event) {
    var player = event.player;
    var api = event.API;

    lastNpc = event.npc;
    var npcData = lastNpc.getStoreddata();

    var spawnText = npcData.has("CustomerSpawn") ? npcData.get("CustomerSpawn") : "";
    var counterText = npcData.has("CounterPos") ? npcData.get("CounterPos") : "";

    guiRef = api.createCustomGui(176, 166, 0, true, player);

    // Labels (ID, text, x, y, width, height)
    guiRef.addLabel(ID_LABEL_SPAWN, "Customer Spawn (x y z)", 10, 10, 156, 12);
    guiRef.addLabel(ID_LABEL_COUNTER, "Counter Position (x y z)", 10, 50, 156, 12);

    // Text fields
    guiRef.addTextField(ID_FIELD_SPAWN, 10, 25, 156, 18).setText(spawnText);
    guiRef.addTextField(ID_FIELD_COUNTER, 10, 65, 156, 18).setText(counterText);

    player.showCustomGui(guiRef);
}

// ===== SAVE DATA =====
function customGuiClosed(event) {
    if (!lastNpc) return;

    var gui = event.gui;
    var npcData = lastNpc.getStoreddata();

    // ✅ Correct way to access text fields
    var spawnField = gui.getComponent(ID_FIELD_SPAWN);
    var counterField = gui.getComponent(ID_FIELD_COUNTER);

    if (spawnField) {
        npcData.put("CustomerSpawn", spawnField.getText());
    }

    if (counterField) {
        npcData.put("CounterPos", counterField.getText());
    }
}
