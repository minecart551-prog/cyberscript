// gui ids

var ID_JOB_LABEL = 10;
var ID_START_JOB_BUTTON = 11;
var ID_STOP_JOB_BUTTON = 12;

// section config

var SECTIONS = [
    {
        name: "Drinks",
        startX: -20,
        startY: -60,
        rows: 6,
        columns: 4,
        slotSpacingX: 20,
        slotSpacingY: 20
    },
    {
        name: "Food",
        startX: 100,
        startY: -60,
        rows: 6,
        columns: 4,
        slotSpacingX: 20,
        slotSpacingY: 20
    }
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

// interact

function interact(event) {
    var player = event.player;
    var api = event.API;
    lastNpc = event.npc;

    var held = player.getMainhandItem();
    if (held && !held.isEmpty() && held.getName() === "minecraft:bedrock") {
        openAdminGui(player, api);
    } else {
        openPlayerGui(player, api);
    }
}

// build slot positions

function buildSlotPositions() {
    slotPositions = [];
    SECTIONS.forEach(function(section) {
        for (var r = 0; r < section.rows; r++) {
            for (var c = 0; c < section.columns; c++) {
                slotPositions.push({
                    x: section.startX + c * section.slotSpacingX,
                    y: section.startY + r * section.slotSpacingY
                });
            }
        }
    });
}

// admin gui

function openAdminGui(player, api) {
    isAdminGui = true;
    highlightedAdminSlot = null;
    adminHighlightLines = [];
    buildSlotPositions();

    var npcData = lastNpc.getStoreddata();
    storedSlotItems = npcData.has("MenuItems")
        ? JSON.parse(npcData.get("MenuItems"))
        : [];

    guiRef = api.createCustomGui(176, 166, 0, true, player);

    var label = guiRef.addLabel(ID_JOB_LABEL, "Admin Menu Setup", 11, -110, 156, 12);
    label.setColor(0xFFFFFF);

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

    guiRef.showPlayerInventory(10, 90, false);
    player.showCustomGui(guiRef);
}

// player gui

function openPlayerGui(player, api) {
    isAdminGui = false;
    buildSlotPositions();

    var npcData = lastNpc.getStoreddata();
    storedSlotItems = npcData.has("MenuItems")
        ? JSON.parse(npcData.get("MenuItems"))
        : [];

    selectedSlots = player.getStoreddata().has("SelectedMenuSlots")
        ? JSON.parse(player.getStoreddata().get("SelectedMenuSlots"))
        : [];

    renderPlayerGui(player, api);
}

function renderPlayerGui(player, api) {
    guiRef = api.createCustomGui(176, 166, 0, true, player);

    var label = guiRef.addLabel(ID_JOB_LABEL, "Restaurant Menu", 10, -110, 156, 12);
    label.setColor(0xFFFFFF);

    mySlots = [];
    slotHighlights = {};
    nextLineId = 1000;

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

    selectedSlots.forEach(function(idx) {
        if (idx >= 0 && idx < mySlots.length) {
            drawHighlight(idx);
        }
    });

    guiRef.addButton(ID_START_JOB_BUTTON, "Start Job", 10, 90, 70, 20);
    guiRef.addButton(ID_STOP_JOB_BUTTON, "Stop Job", 90, 90, 70, 20);

    player.showCustomGui(guiRef);
}

// slot click

function customGuiSlotClicked(event) {
    var clickedSlot = event.slot;
    var stack = event.stack;
    var player = event.player;
    var index = mySlots.indexOf(clickedSlot);

    if (isAdminGui) {

        // selecting admin slot
        if (index !== -1) {
            highlightedAdminSlot = clickedSlot;
            clearAdminHighlight();

            var pos = slotPositions[index];
            drawAdminHighlight(pos.x, pos.y);
            guiRef.update();
            return;
        }

        if (!highlightedAdminSlot) return;

        // empty cursor clears slot
        if (!stack || stack.isEmpty()) {
            highlightedAdminSlot.setStack(
                player.world.createItem("minecraft:air", 1)
            );
            guiRef.update();
            return;
        }

        // item on cursor copies into slot
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
        try { guiRef.removeComponent(id); } catch (e) {}
    });
    adminHighlightLines = [];
}

// player highlight

function toggleHighlight(index, player, api) {
    var pos = selectedSlots.indexOf(index);
    if (pos !== -1) selectedSlots.splice(pos, 1);
    else selectedSlots.push(index);

    player.getStoreddata().put(
        "SelectedMenuSlots",
        JSON.stringify(selectedSlots)
    );

    renderPlayerGui(player, api);
}

function drawHighlight(index) {
    var pos = slotPositions[index];
    var x = pos.x, y = pos.y, w = 18, h = 18;

    slotHighlights[index] = [
        guiRef.addColoredLine(nextLineId++, x, y, x + w, y, 0xADD8E6, 2),
        guiRef.addColoredLine(nextLineId++, x, y + h, x + w, y + h, 0xADD8E6, 2),
        guiRef.addColoredLine(nextLineId++, x, y, x, y + h, 0xADD8E6, 2),
        guiRef.addColoredLine(nextLineId++, x + w, y, x + w, y + h, 0xADD8E6, 2)
    ];
}

// save admin data

function customGuiClosed(event) {
    if (!isAdminGui || !lastNpc) return;

    var npcData = lastNpc.getStoreddata();
    storedSlotItems = mySlots.map(function(slot) {
        var stack = slot.getStack();
        return stack && !stack.isEmpty()
            ? stack.getItemNbt().toJsonString()
            : null;
    });

    npcData.put("MenuItems", JSON.stringify(storedSlotItems));
}
