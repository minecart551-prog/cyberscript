// gui ids

var ID_LABEL_SPAWN = 1;
var ID_LABEL_COUNTER = 2;
var ID_FIELD_SPAWN = 3;
var ID_FIELD_COUNTER = 4;

var ID_JOB_LABEL = 10;
var ID_START_JOB_BUTTON = 11;
var ID_STOP_JOB_BUTTON = 12;

// menu slots

var slotPositions = [
    {x: 10, y: 20},
    {x: 40, y: 20},
    {x: 70, y: 20},
    {x: 100, y: 20},
    {x: 130, y: 20}
];

var mySlots = [];
var guiRef = null;
var lastNpc = null;
var storedSlotItems = [];

// interact

function interact(event) {
    var player = event.player;
    var api = event.API;
    lastNpc = event.npc;

    var held = player.getMainhandItem();

    if (held && !held.isEmpty() && held.getName() === "minecraft:bedrock") {
        openAdminGui(player, api);
    } else {
        openJobGui(player, api);
    }
}

// admin gui

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

// job gui

function openJobGui(player, api) {
    var npcData = lastNpc.getStoreddata();

    storedSlotItems = npcData.has("MenuItems")
        ? JSON.parse(npcData.get("MenuItems"))
        : [null, null, null, null, null];

    guiRef = api.createCustomGui(176, 166, 0, true, player);

    guiRef.addLabel(ID_JOB_LABEL, "Restaurant Menu", 10, 5, 156, 12);

    mySlots = [];

    for (var i = 0; i < slotPositions.length; i++) {
        var pos = slotPositions[i];
        var slot = guiRef.addItemSlot(pos.x, pos.y);

        if (storedSlotItems[i]) {
            try {
                slot.setStack(player.world.createItemFromNbt(
                    api.stringToNbt(storedSlotItems[i])
                ));
            } catch (e) {}
        }

        mySlots.push(slot);
    }

    guiRef.addButton(ID_START_JOB_BUTTON, "Start Job", 10, 50, 70, 20);
    guiRef.addButton(ID_STOP_JOB_BUTTON, "Stop Job", 90, 50, 70, 20);

    guiRef.showPlayerInventory(10, 80, false);
    player.showCustomGui(guiRef);
}

// slot click logic

function customGuiSlotClicked(event) {
    if (!mySlots || mySlots.length === 0) return;

    var clickedSlot = event.slot;
    var stack = event.stack;
    var player = event.player;

    var slotIndex = mySlots.indexOf(clickedSlot);

    // clicking a menu slot removes item
    if (slotIndex !== -1) {
        var slotStack = clickedSlot.getStack();
        if (slotStack && !slotStack.isEmpty()) {
            clickedSlot.setStack(player.world.createItem("minecraft:air", 1));
            guiRef.update();
        }
        return;
    }

    // clicking player inventory copies item
    if (!stack || stack.isEmpty()) return;

    for (var i = 0; i < mySlots.length; i++) {
        var slot = mySlots[i];
        var slotStack = slot.getStack();

        if (!slotStack || slotStack.isEmpty()) {
            var copy = player.world.createItemFromNbt(stack.getItemNbt());
            copy.setStackSize(1);
            slot.setStack(copy);
            guiRef.update();
            return;
        }
    }
}

// buttons

function customGuiButton(event) {
    var player = event.player;

    if (event.buttonId === ID_START_JOB_BUTTON) {
        player.getStoreddata().put("RestaurantJobActive", "true");
        player.message("Job started");
    }

    if (event.buttonId === ID_STOP_JOB_BUTTON) {
        player.getStoreddata().put("RestaurantJobActive", "false");
        player.message("Job stopped");
    }
}

// save data

function customGuiClosed(event) {
    if (!lastNpc) return;

    var npcData = lastNpc.getStoreddata();
    var gui = event.gui;

    var spawnField = gui.getComponent(ID_FIELD_SPAWN);
    var counterField = gui.getComponent(ID_FIELD_COUNTER);

    if (spawnField && counterField) {
        npcData.put("CustomerSpawn", spawnField.getText());
        npcData.put("CounterPos", counterField.getText());
        return;
    }

    if (mySlots && mySlots.length > 0) {
        storedSlotItems = mySlots.map(function(slot) {
            var stack = slot.getStack();
            return stack && !stack.isEmpty()
                ? stack.getItemNbt().toJsonString()
                : null;
        });

        npcData.put("MenuItems", JSON.stringify(storedSlotItems));
    }
}
