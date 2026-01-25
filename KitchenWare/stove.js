// Grill Scripted Block
// Events: init, interact, timer, customGuiSlotClicked, customGuiClosed

var guiRef;
var cookingSlots = [];
var coalSlot = null;
var lastBlock = null;
var highlightedSlot = null;
var highlightLineIds = [];

var COOK_TIME = 30; // 30 seconds
var GRID_SIZE = 9; // 3x3 grid

var cookingProgress = {};
var timerRunning = false;

function init(event) {
    event.block.setModel("farmersdelight:stove");
}

function interact(event) {
    var player = event.player;
    var api = event.API;
    lastBlock = event.block;
    
    // Start cooking timer once
    if(!timerRunning){
        event.block.timers.forceStart(1, 20, true); // Every 1 second, repeating
        timerRunning = true;
    }
    
    openGrillGui(player, api);
}

function reloadGrillItemsInGui(block, api) {
    // This function reloads items from storage into the GUI
    // Called by timer to show cooking progress
    if(!guiRef || !cookingSlots || cookingSlots.length === 0) return;
    if(!block) return;
    
    var blockData = block.getTempdata();
    var world = block.getWorld();
    
    // Reload cooking slots
    for(var i = 0; i < GRID_SIZE; i++){
        var key = "slot_" + i;
        if(blockData.has(key)){
            try {
                var itemNbt = blockData.get(key);
                var item = world.createItemFromNbt(api.stringToNbt(itemNbt));
                if(cookingSlots[i]) cookingSlots[i].setStack(item);
            } catch(e) {}
        } else {
            if(cookingSlots[i]) cookingSlots[i].setStack(null);
        }
    }
    
    // Reload coal slot
    if(blockData.has("coal_slot")){
        try {
            var coalNbt = blockData.get("coal_slot");
            var coalItem = world.createItemFromNbt(api.stringToNbt(coalNbt));
            if(coalSlot) coalSlot.setStack(coalItem);
        } catch(e) {}
    } else {
        if(coalSlot) coalSlot.setStack(null);
    }
}

function openGrillGui(player, api) {
    if(!lastBlock) return;
    var blockData = lastBlock.getTempdata();
    
    // Load cooking progress
    if(blockData.has("cookingProgress")){
        try {
            cookingProgress = JSON.parse(blockData.get("cookingProgress"));
        } catch(e) {
            cookingProgress = {};
        }
    } else {
        cookingProgress = {};
    }
    
    guiRef = api.createCustomGui(176, 166, 0, true, player);
    cookingSlots = [];
    highlightedSlot = null;
    highlightLineIds = [];
    
    // Create 3x3 grid of cooking slots (moved up 50 pixels)
    var startX = 44;
    var startY = -30; // Was 20, now -30 (moved up 50)
    var slotSpacing = 18;
    
    for(var row = 0; row < 3; row++){
        for(var col = 0; col < 3; col++){
            var x = startX + col * slotSpacing;
            var y = startY + row * slotSpacing;
            var slot = guiRef.addItemSlot(x, y);
            cookingSlots.push(slot);
        }
    }
    
    // Create coal slot below (moved up 50 pixels)
    coalSlot = guiRef.addItemSlot(62, 40); // Was 90, now 40
    
    // Labels (moved up 50 pixels)
    guiRef.addLabel(1, "§6Grill", 70, -45, 1.2, 1.2); // Was 5, now -45
    guiRef.addLabel(2, "§7Coal", 48, 43, 0.8, 0.8); // Was 93, now 43
    
    // Show player inventory (back to original position)
    guiRef.showPlayerInventory(8, 84, false);
    
    // Load items from storage
    loadGrillItems(player, api);
    
    player.showCustomGui(guiRef);
}

function loadGrillItems(player, api) {
    if(!lastBlock) return;
    var blockData = lastBlock.getTempdata();
    
    // Load cooking slots
    for(var i = 0; i < GRID_SIZE; i++){
        var key = "slot_" + i;
        if(blockData.has(key)){
            try {
                var itemNbt = blockData.get(key);
                var item = player.world.createItemFromNbt(api.stringToNbt(itemNbt));
                cookingSlots[i].setStack(item);
            } catch(e) {}
        }
    }
    
    // Load coal slot
    if(blockData.has("coal_slot")){
        try {
            var coalNbt = blockData.get("coal_slot");
            var coalItem = player.world.createItemFromNbt(api.stringToNbt(coalNbt));
            coalSlot.setStack(coalItem);
        } catch(e) {}
    }
}

function customGuiClosed(event) {
    if(!lastBlock) return;
    saveGrillItems();
    guiRef = null;
}

function customGuiSlotClicked(event) {
    var clickedSlot = event.slot;
    var stack = event.stack;
    var player = event.player;
    var api = event.API;
    
    // Check if clicked slot is a cooking slot
    var slotIndex = cookingSlots.indexOf(clickedSlot);
    var isCoalSlot = (clickedSlot === coalSlot);
    
    if(slotIndex !== -1) {
        // Clicked a cooking slot
        highlightedSlot = clickedSlot;
        
        // Clear old highlights
        for(var i = 0; i < highlightLineIds.length; i++){
            try { guiRef.removeComponent(highlightLineIds[i]); } catch(e) {}
        }
        highlightLineIds = [];
        
        // Draw highlight
        var row = Math.floor(slotIndex / 3);
        var col = slotIndex % 3;
        var startX = 44;
        var startY = -30;
        var slotSpacing = 18;
        var x = startX + col * slotSpacing;
        var y = startY + row * slotSpacing;
        var w = 18, h = 18;
        
        highlightLineIds.push(guiRef.addColoredLine(1, x, y, x+w, y, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(2, x, y+h, x+w, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(3, x, y, x, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(4, x+w, y, x+w, y+h, 0xADD8E6, 2));
        guiRef.update();
        return;
    }
    
    if(isCoalSlot) {
        // Clicked coal slot
        highlightedSlot = clickedSlot;
        
        // Clear old highlights
        for(var i = 0; i < highlightLineIds.length; i++){
            try { guiRef.removeComponent(highlightLineIds[i]); } catch(e) {}
        }
        highlightLineIds = [];
        
        // Draw highlight
        var x = 62, y = 40;
        var w = 18, h = 18;
        
        highlightLineIds.push(guiRef.addColoredLine(1, x, y, x+w, y, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(2, x, y+h, x+w, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(3, x, y, x, y+h, 0xADD8E6, 2));
        highlightLineIds.push(guiRef.addColoredLine(4, x+w, y, x+w, y+h, 0xADD8E6, 2));
        guiRef.update();
        return;
    }
    
    // If no slot is highlighted, return
    if(!highlightedSlot) return;
    
    var slotStack = highlightedSlot.getStack();
    var maxStack = stack ? stack.getMaxStackSize() : 64;
    
    if(stack && !stack.isEmpty()) {
        // Player clicked with item in hand
        if(slotStack && !slotStack.isEmpty() && slotStack.getDisplayName() === stack.getDisplayName()) {
            // Same item, stack
            var total = slotStack.getStackSize() + stack.getStackSize();
            if(total <= maxStack) {
                slotStack.setStackSize(total);
                highlightedSlot.setStack(slotStack);
                player.removeItem(stack, stack.getStackSize());
            } else {
                var overflow = total - maxStack;
                slotStack.setStackSize(maxStack);
                highlightedSlot.setStack(slotStack);
                if(overflow > 0){
                    var overflowItem = player.world.createItemFromNbt(stack.getItemNbt());
                    overflowItem.setStackSize(overflow);
                    player.removeItem(stack, stack.getStackSize());
                    player.giveItem(overflowItem);
                }
            }
        } else {
            // Different item, swap
            var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
            itemCopy.setStackSize(stack.getStackSize());
            if(slotStack && !slotStack.isEmpty()) player.giveItem(slotStack);
            highlightedSlot.setStack(itemCopy);
            player.removeItem(stack, stack.getStackSize());
        }
    } else if(slotStack && !slotStack.isEmpty()) {
        // Empty hand, take item
        player.giveItem(slotStack);
        highlightedSlot.setStack(player.world.createItem("minecraft:air", 1));
    }
    
    guiRef.update();
    saveGrillItems();
}

function saveGrillItems() {
    if(!lastBlock) return;
    var blockData = lastBlock.getTempdata();
    
    // Save cooking slots
    for(var i = 0; i < cookingSlots.length; i++){
        var stack = cookingSlots[i].getStack();
        var key = "slot_" + i;
        
        if(stack && !stack.isEmpty()){
            blockData.put(key, stack.getItemNbt().toJsonString());
        } else {
            blockData.remove(key);
        }
    }
    
    // Save coal slot
    var coalStack = coalSlot.getStack();
    if(coalStack && !coalStack.isEmpty()){
        blockData.put("coal_slot", coalStack.getItemNbt().toJsonString());
    } else {
        blockData.remove("coal_slot");
    }
    
    // Save cooking progress
    blockData.put("cookingProgress", JSON.stringify(cookingProgress));
}

function timer(event) {
    // Only process timer ID 1 (our cooking timer)
    if(event.id !== 1) return;
    
    var block = event.block;
    var api = event.API;
    var world = block.getWorld();
    var blockData = block.getTempdata();
    
    // Load cooking progress
    if(blockData.has("cookingProgress")){
        try {
            cookingProgress = JSON.parse(blockData.get("cookingProgress"));
        } catch(e) {
            cookingProgress = {};
        }
    } else {
        cookingProgress = {};
    }
    
    // Check if there's coal
    var hasCoal = false;
    if(blockData.has("coal_slot")){
        try {
            var coalNbt = blockData.get("coal_slot");
            var coalItem = world.createItemFromNbt(api.stringToNbt(coalNbt));
            if(coalItem && !coalItem.isEmpty() && coalItem.getName() === "minecraft:coal"){
                hasCoal = true;
            }
        } catch(e) {}
    }
    
    if(!hasCoal){
        return; // No coal, pause cooking
    }
    
    var itemsCooked = false;
    var shouldUpdate = false;
    
    // Check each slot
    for(var i = 0; i < GRID_SIZE; i++){
        var key = "slot_" + i;
        
        if(blockData.has(key)){
            try {
                var itemNbt = blockData.get(key);
                var item = world.createItemFromNbt(api.stringToNbt(itemNbt));
                
                if(item && !item.isEmpty()){
                    // Cook any item that's not already cooked
                    if(!isCooked(item)){
                        // Start cooking if not already started
                        if(!cookingProgress[i]){
                            cookingProgress[i] = {
                                secondsElapsed: 0,
                                itemNbt: itemNbt
                            };
                        }
                        
                        // Increment seconds
                        cookingProgress[i].secondsElapsed++;
                        var secondsRemaining = COOK_TIME - cookingProgress[i].secondsElapsed;
                        
                        if(cookingProgress[i].secondsElapsed >= COOK_TIME){
                            // Item is cooked!
                            var cookedItem = world.createItemFromNbt(api.stringToNbt(itemNbt));
                            var existingLore = cookedItem.getLore();
                            var loreArray = [];
                            
                            // Remove cooking timer lines and trailing empty lines
                            for(var j = 0; j < existingLore.length; j++){
                                if(existingLore[j].indexOf("Cooking:") === -1){
                                    loreArray.push(existingLore[j]);
                                }
                            }
                            while(loreArray.length > 0 && loreArray[loreArray.length - 1] === ""){
                                loreArray.pop();
                            }
                            
                            loreArray.push("");
                            loreArray.push("§eCooked");
                            cookedItem.setLore(loreArray);
                            
                            blockData.put(key, cookedItem.getItemNbt().toJsonString());
                            delete cookingProgress[i];
                            itemsCooked = true;
                            shouldUpdate = true;
                        } else {
                            // Update timer
                            var cookingItem = world.createItemFromNbt(api.stringToNbt(itemNbt));
                            var existingLore = cookingItem.getLore();
                            var loreArray = [];
                            
                            // Remove cooking timer lines and trailing empty lines
                            for(var j = 0; j < existingLore.length; j++){
                                if(existingLore[j].indexOf("Cooking:") === -1){
                                    loreArray.push(existingLore[j]);
                                }
                            }
                            while(loreArray.length > 0 && loreArray[loreArray.length - 1] === ""){
                                loreArray.pop();
                            }
                            
                            loreArray.push("");
                            loreArray.push("§7Cooking: §e" + secondsRemaining + "s");
                            cookingItem.setLore(loreArray);
                            
                            blockData.put(key, cookingItem.getItemNbt().toJsonString());
                            shouldUpdate = true;
                        }
                    } else {
                        // Already cooked, remove from progress
                        if(cookingProgress[i]){
                            delete cookingProgress[i];
                        }
                    }
                }
            } catch(e) {}
        } else {
            // Slot is empty, remove from progress
            if(cookingProgress[i]){
                delete cookingProgress[i];
            }
        }
    }
    
    // Consume coal if items were cooked
    if(itemsCooked && blockData.has("coal_slot")){
        try {
            var coalNbt = blockData.get("coal_slot");
            var coalItem = world.createItemFromNbt(api.stringToNbt(coalNbt));
            
            if(coalItem && !coalItem.isEmpty()){
                var coalCount = coalItem.getStackSize();
                if(coalCount > 1){
                    coalItem.setStackSize(coalCount - 1);
                    blockData.put("coal_slot", coalItem.getItemNbt().toJsonString());
                } else {
                    blockData.remove("coal_slot");
                }
            }
        } catch(e) {}
    }
    
    // Save cooking progress
    blockData.put("cookingProgress", JSON.stringify(cookingProgress));
    
    // Reload GUI slots if there were updates
    if(shouldUpdate){
        reloadGrillItemsInGui(block, api);
    }
}

function isCooked(item) {
    var lore = item.getLore();
    for(var i = 0; i < lore.length; i++){
        if(lore[i].indexOf("Cooked") !== -1){
            return true;
        }
    }
    return false;
}
