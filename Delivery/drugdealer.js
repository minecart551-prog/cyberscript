// === NPC Trader GUI (hardened, per-player GUI state, safe removal) ===

var guiStates = {}; // per-player GUI state: { guiRef, mySlots, highlightLineIds, highlightedSlot, lastNpc }

// === CONFIG ===
var GRID_ROWS = 5;
var GRID_COLS = 5;
var START_X = 60;
var START_Y = -100; // top grid Y offset
var COL_SPACING = 20;
var ROW_SPACING = 20;

// Key slot on the left
var extraSlotPosition = {x: 10, y: -80};

// --- Build slot positions ---
function buildSlotPositions(offsetY){
    var arr = [];
    for (var row = 0; row < GRID_ROWS; row++) {
        for (var col = 0; col < GRID_COLS; col++) {
            arr.push({x: START_X + col * COL_SPACING, y: offsetY + row * ROW_SPACING});
        }
    }
    return arr;
}
var slotPositions = buildSlotPositions(START_Y); // reward grid

var GRID_SIZE = slotPositions.length;
var STORAGE_SIZE = GRID_SIZE + 1; // grid + key slot

// storage (persisted on npc storeddata "SlotItems")
function makeNullArray(n){
    var a = new Array(n);
    for (var i=0;i<n;i++) a[i] = null;
    return a;
}

function init(e) {
    e.npc.setFaction(4);
    e.npc.getAi().setStandingType(2);
}

// --- Helpers ---
// Normalize NBT JSON by removing Count fields and whitespace to compare semantics ignoring stack size.
function normalizeNbtJson(str){
    if(!str) return "";
    try {
        return str.replace(/"Count"\s*:\s*[\d]+[bB]?/g, "").replace(/\s+/g, "");
    } catch(e){
        return str + "";
    }
}

// Compare items by id, damage and normalized NBT (ignoring Count)
function itemsEqualStrict(api, hand, required) {
    if (!hand || !required) return false;
    if (hand.getName() !== required.getName()) return false;
    if (hand.getItemDamage() !== required.getItemDamage()) return false;
    try {
        var hNbt = hand.getItemNbt() ? hand.getItemNbt().toJsonString() : "";
        var rNbt = required.getItemNbt() ? required.getItemNbt().toJsonString() : "";
        return normalizeNbtJson(hNbt) === normalizeNbtJson(rNbt);
    } catch(e) { return false; }
}

// Remove exactly `amount` items matching `required` (id, damage, nbt ignoring Count)
// Returns number actually removed (0..amount)
function removeAmountFromInventory(player, required, amount) {
    if (!required || amount <= 0) return 0;
    try {
        var inv = player.getInventory();
        var items = inv.getItems(); // array of IItemStack wrappers
        var toRemove = amount;
        for (var i=0;i<items.length && toRemove>0;i++){
            var s = items[i];
            if (!s || s.isEmpty()) continue;
            // match id & damage & normalized NBT
            if (s.getName() !== required.getName()) continue;
            if (s.getItemDamage() !== required.getItemDamage()) continue;
            try {
                var sNbt = s.getItemNbt() ? s.getItemNbt().toJsonString() : "";
                var rNbt = required.getItemNbt() ? required.getItemNbt().toJsonString() : "";
                if (normalizeNbtJson(sNbt) !== normalizeNbtJson(rNbt)) continue;
            } catch(ignore) { continue; }

            var avail = s.getStackSize();
            if (avail <= toRemove) {
                // remove whole stack
                inv.setSlot(i, null);
                toRemove -= avail;
            } else {
                // reduce stack
                s.setStackSize(avail - toRemove);
                inv.setSlot(i, s);
                toRemove = 0;
            }
        }
        return amount - toRemove;
    } catch(e) {
        return 0;
    }
}

// ---------- INTERACT ----------
function interact(event) {
    var player = event.player;
    var api = event.API;
    var playerId = player.getUUID();
    var npc = event.npc;
    var npcData = npc.getStoreddata();

    // Load stored items from NPC (SlotItems)
    var storedSlotItems = makeNullArray(STORAGE_SIZE);
    if (npcData.has("SlotItems")) {
        try {
            var parsed = JSON.parse(npcData.get("SlotItems"));
            if (parsed && parsed.length >= STORAGE_SIZE) {
                for (var k=0;k<STORAGE_SIZE;k++){
                    storedSlotItems[k] = parsed[k];
                }
            } else if (parsed && parsed.length > 0) {
                // copy available then pad
                for (var k2=0;k2<parsed.length && k2<STORAGE_SIZE;k2++){
                    storedSlotItems[k2] = parsed[k2];
                }
            }
        } catch(e){
            storedSlotItems = makeNullArray(STORAGE_SIZE);
        }
    }

    // Ensure per-player GUI state exists
    if (!guiStates[playerId]) {
        guiStates[playerId] = {
            guiRef: null,
            mySlots: null,
            highlightLineIds: [],
            highlightedSlot: null,
            lastNpc: null,
            storedSlotItems: storedSlotItems // cached for this interaction
        };
    } else {
        // update cached storedSlotItems each interact to reflect npc changes
        guiStates[playerId].storedSlotItems = storedSlotItems;
    }

    // Quick access
    var state = guiStates[playerId];
    var handItem = player.getMainhandItem();

    // If player is holding the required key in any stack size, accept and give rewards:
    if (handItem && !handItem.isEmpty() && state.storedSlotItems[GRID_SIZE]) {
        try {
            var required = player.world.createItemFromNbt(api.stringToNbt(state.storedSlotItems[GRID_SIZE]));
            // match the item in hand to required ignoring Count
            if (itemsEqualStrict(api, handItem, required)) {
                var amountToTake = handItem.getStackSize(); // take the whole hand stack as requested

                // Attempt to remove that many matching items from inventory (safe)
                var removed = removeAmountFromInventory(player, required, amountToTake);
                if (removed <= 0) {
                    player.message("§cFailed to remove the required item(s).");
                    return;
                }

                // Choose random reward slot among set slots
                var choices = [];
                for (var i = 0; i < GRID_SIZE; i++) {
                    if (state.storedSlotItems[i]) choices.push(i);
                }

                if (choices.length > 0) {
                    var randIndex = choices[Math.floor(Math.random() * choices.length)];
                    var reward = player.world.createItemFromNbt(api.stringToNbt(state.storedSlotItems[randIndex]));
                    // set same stack size as removed
                    try { reward.setStackSize(removed); } catch(_) {}
                    player.giveItem(reward);
                    player.message("§aYou received " + removed + "x " + reward.getDisplayName() + "!");
                } else {
                    player.message("§cNo rewards are set in the slots!");
                }

                // Update cached and persistent storage (no changes to storedSlotItems themselves here)
                state.storedSlotItems = state.storedSlotItems; // no-op but keeps pattern
                return;
            }
        } catch(e){
            // ignore; fall through to bedrock editor check
        }
    }

    // Open GUI editor if holding bedrock
    if (handItem && !handItem.isEmpty() && handItem.getName() === "minecraft:bedrock") {
        // Reset previous highlights for this player
        if (state.highlightLineIds && state.guiRef) {
            for (var hh=0; hh<state.highlightLineIds.length; hh++){
                try { state.guiRef.removeComponent(state.highlightLineIds[hh]); } catch(_) {}
            }
        }

        state.guiRef = api.createCustomGui(176, 166, 0, true, player);
        state.mySlots = [];
        state.highlightLineIds = [];
        state.highlightedSlot = null;
        state.lastNpc = npc;

        // Load current storedSlotItems to ensure up-to-date
        var slotsToShow = state.storedSlotItems;

        // Reward grid
        for (var i = 0; i < slotPositions.length; i++) {
            var slot = state.guiRef.addItemSlot(slotPositions[i].x, slotPositions[i].y);
            try {
                var s = slotsToShow[i];
                if (s) {
                    var set = player.world.createItemFromNbt(api.stringToNbt(s));
                    slot.setStack(set);
                } else {
                    slot.setStack(player.world.createItem("minecraft:air", 1));
                }
            } catch(e){
                try { slot.setStack(player.world.createItem("minecraft:air", 1)); } catch(_) {}
            }
            state.mySlots.push(slot);
        }

        // Key slot
        var extra = state.guiRef.addItemSlot(extraSlotPosition.x, extraSlotPosition.y);
        try {
            var keyStr = slotsToShow[GRID_SIZE];
            if (keyStr) {
                extra.setStack(player.world.createItemFromNbt(api.stringToNbt(keyStr)));
            } else {
                extra.setStack(player.world.createItem("minecraft:air", 1));
            }
        } catch(e){
            try { extra.setStack(player.world.createItem("minecraft:air", 1)); } catch(_) {}
        }
        state.mySlots.push(extra);

        // Show player's inventory & GUI
        state.guiRef.showPlayerInventory(10, 110, false);
        player.showCustomGui(state.guiRef);

        return;
    }
}

// ---------- SLOT CLICK ----------
function customGuiSlotClicked(event) {
    var player = event.player;
    var playerId = player.getUUID();
    var api = event.API;
    var stack = event.stack;
    var clickedSlot = event.slot;

    var state = guiStates[playerId];
    if (!state || !state.mySlots) return;

    var slotIndex = state.mySlots.indexOf(clickedSlot);
    if (slotIndex !== -1) {
        // Select/highlight this slot
        state.highlightedSlot = clickedSlot;
        // remove old lines
        for (var h=0; h<state.highlightLineIds.length; h++){
            try { state.guiRef.removeComponent(state.highlightLineIds[h]); } catch(_) {}
        }
        state.highlightLineIds = [];

        // compute pos
        var pos = (slotIndex < GRID_SIZE) ? slotPositions[slotIndex] : extraSlotPosition;
        var x = pos.x, y = pos.y, w = 18, h = 18;
        // use unique IDs to reduce collision risk: base on slotIndex * 10 + local id
        state.highlightLineIds.push(state.guiRef.addColoredLine(1000 + slotIndex*10 + 1, x, y, x+w, y, 0xADD8E6, 2));
        state.highlightLineIds.push(state.guiRef.addColoredLine(1000 + slotIndex*10 + 2, x, y+h, x+w, y+h, 0xADD8E6, 2));
        state.highlightLineIds.push(state.guiRef.addColoredLine(1000 + slotIndex*10 + 3, x, y, x, y+h, 0xADD8E6, 2));
        state.highlightLineIds.push(state.guiRef.addColoredLine(1000 + slotIndex*10 + 4, x+w, y, x+w, y+h, 0xADD8E6, 2));
        try { state.guiRef.update(); } catch(_) {}
        return;
    }

    // If not clicking a GUI slot, but we have a highlighted slot selected, perform editor behaviour
    if (!state.highlightedSlot) return;

    try {
        var slotStack = state.highlightedSlot.getStack();
        var maxStack = stack ? stack.getMaxStackSize() : 64;

        if (stack && !stack.isEmpty()) {
            // placing stack into highlighted slot (admin behaviour)
            if (slotStack && !slotStack.isEmpty() && slotStack.getDisplayName() === stack.getDisplayName()) {
                var total = slotStack.getStackSize() + stack.getStackSize();
                if (total <= maxStack) {
                    slotStack.setStackSize(total);
                    state.highlightedSlot.setStack(slotStack);
                    player.removeItem(stack, stack.getStackSize());
                } else {
                    var overflow = total - maxStack;
                    slotStack.setStackSize(maxStack);
                    state.highlightedSlot.setStack(slotStack);
                    var overflowCopy = player.world.createItemFromNbt(stack.getItemNbt());
                    overflowCopy.setStackSize(overflow);
                    player.removeItem(stack, stack.getStackSize());
                    player.giveItem(overflowCopy);
                }
            } else {
                var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
                if (slotStack && !slotStack.isEmpty()) player.giveItem(slotStack);
                state.highlightedSlot.setStack(itemCopy);
                player.removeItem(stack, stack.getStackSize());
            }
        } else if (slotStack && !slotStack.isEmpty()) {
            // pick up from GUI slot
            player.giveItem(slotStack);
            state.highlightedSlot.setStack(player.world.createItem("minecraft:air", 1));
            try { state.guiRef.update(); } catch(_) {}
        }
        try { state.guiRef.update(); } catch(_) {}
    } catch(e) {}
}

// ---------- GUI CLOSED ----------
function customGuiClosed(event) {
    var player = event.player;
    var playerId = player.getUUID();
    var api = event.API;

    var state = guiStates[playerId];
    if (!state || !state.mySlots) {
        // nothing to save
        return;
    }

    try {
        var npc = state.lastNpc;
        if (!npc) return;
        var npcData = npc.getStoreddata();

        var toSave = makeNullArray(STORAGE_SIZE);
        for (var i=0;i<STORAGE_SIZE;i++){
            try {
                var slot = state.mySlots[i];
                if (!slot) { toSave[i] = null; continue; }
                var st = slot.getStack();
                toSave[i] = (st && !st.isEmpty()) ? st.getItemNbt().toJsonString() : null;
            } catch(e) {
                toSave[i] = null;
            }
        }

        // persist
        npcData.put("SlotItems", JSON.stringify(toSave));
    } catch(e){
        // swallow errors to avoid wiping data
    } finally {
        // cleanup player's gui state so multiple opens will be fresh
        try {
            if (state.guiRef) {
                // remove highlight components if any
                for (var hh=0; hh<state.highlightLineIds.length; hh++){
                    try { state.guiRef.removeComponent(state.highlightLineIds[hh]); } catch(_) {}
                }
            }
        } catch(_) {}
        guiStates[playerId] = null;
        delete guiStates[playerId];
    }
}
