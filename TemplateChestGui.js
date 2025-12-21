//bug: when switching with another item in gui if theres the same item in storage then that item switched disappear
var guiRef;                 
var mySlots = [];           
var highlightLineIds = [];  
var rows = 3;
var cols = 9;
var slotSize = 18;          // standard slot size
var slotPadding = 0;        // remove extra space between slots
var offsetX = 0;           // horizontal shift of the chest
var offsetY = -40;          // vertical shift of the chest
var highlightedSlot = null; 
var lastNpc = null;         
var storedSlotItems = [];   

function interact(event) {
    var player = event.player;
    var api = event.API;

    lastNpc = event.npc; 
    var npcData = lastNpc.getStoreddata();

    if(npcData.has("SlotItems")) {
        storedSlotItems = JSON.parse(npcData.get("SlotItems"));
    } else {
        storedSlotItems = [];
        for(var i = 0; i < rows * cols; i++) storedSlotItems.push(null);
    }

    highlightedSlot = null;
    highlightLineIds = [];

    guiRef = api.createCustomGui(176, 166, 0, true, player);

    mySlots = [];
    for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
            var x = offsetX + c * (slotSize + slotPadding);
            var y = offsetY + r * (slotSize + slotPadding);
            var slot = guiRef.addItemSlot(x, y);
            var index = r * cols + c;

            if(storedSlotItems[index]) {
                try {
                    slot.setStack(player.world.createItemFromNbt(api.stringToNbt(storedSlotItems[index])));
                } catch(e) {}
            }

            mySlots.push(slot);
        }
    }

    guiRef.showPlayerInventory(offsetX, offsetY + rows * slotSize + 5, false); // inventory below the chest
    player.showCustomGui(guiRef);
}

function customGuiSlotClicked(event) {
    var clickedSlot = event.slot;
    var stack = event.stack;
    var player = event.player;

    var slotIndex = mySlots.indexOf(clickedSlot);
    if(slotIndex !== -1) {
        highlightedSlot = clickedSlot;
        for(var i=0;i<highlightLineIds.length;i++){
            try { guiRef.removeComponent(highlightLineIds[i]); } catch(e) {}
        }
        highlightLineIds = [];

        var row = Math.floor(slotIndex / cols);
        var col = slotIndex % cols;
        var x = offsetX + col * (slotSize + slotPadding);
        var y = offsetY + row * (slotSize + slotPadding);
        var w = slotSize, h = slotSize;
        highlightLineIds.push(guiRef.addColoredLine(1, x, y, x+w, y, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(2, x, y+h, x+w, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(3, x, y, x, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(4, x+w, y, x+w, y+h, 0xADD8E6, 2));
        guiRef.update();
        return;
    }

    if(!highlightedSlot) return;

    try {
        var slotStack = highlightedSlot.getStack();
        var maxStack = stack ? stack.getMaxStackSize() : 64;

        if(stack && !stack.isEmpty()) {
            if(slotStack && !slotStack.isEmpty() && slotStack.getDisplayName() === stack.getDisplayName()) {
                var total = slotStack.getStackSize() + stack.getStackSize();
                if(total <= maxStack) {
                    slotStack.setStackSize(total);
                    highlightedSlot.setStack(slotStack);
                    player.removeItem(stack, stack.getStackSize());
                } else {
                    var overflow = total - maxStack;
                    slotStack.setStackSize(maxStack);
                    highlightedSlot.setStack(slotStack);

                    var overflowCopy = player.world.createItemFromNbt(stack.getItemNbt());
                    overflowCopy.setStackSize(overflow);
                    player.removeItem(stack, stack.getStackSize());
                    player.giveItem(overflowCopy);
                }
            } else {
                var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
                if(slotStack && !slotStack.isEmpty()) player.giveItem(slotStack);
                highlightedSlot.setStack(itemCopy);
                player.removeItem(stack, stack.getStackSize());
            }
        } else if(slotStack && !slotStack.isEmpty()) {
            player.giveItem(slotStack);
            highlightedSlot.setStack(player.world.createItem("minecraft:air", 1));
            guiRef.update();
        }

        guiRef.update();
    } catch(e) {}
}

function customGuiClosed(event) {
    if(!lastNpc) return;

    var npcData = lastNpc.getStoreddata();
    storedSlotItems = [];
    for(var i=0; i<mySlots.length; i++){
        var stack = mySlots[i].getStack();
        storedSlotItems.push(stack && !stack.isEmpty() ? stack.getItemNbt().toJsonString() : null);
    }

    npcData.put("SlotItems", JSON.stringify(storedSlotItems));
}
