// Shop NPC Script - Based on Trader Template
// Place this in the NPC's Interact, customGuiButton, customGuiSlotClicked, and customGuiClosed events

var guiRef;                 
var mySlots = [];           
var highlightLineIds = [];  
var highlightedSlot = null; 
var lastNpc = null;         
var storedSlotItems = {};   
var wasAdminMode = false;   // Track if GUI was opened in admin mode

// Currency conversion rates
var STONE_TO_COAL = 100;    // 100 stone coins = 1 coal coin
var COAL_TO_EMERALD = 100;  // 100 coal coins = 1 emerald coin

// Price field component IDs
var ID_PRICE_FIELD = 100;
var ID_SET_PRICE_BUTTON = 101;

// Helper: create an array of length n filled with null
function makeNullArray(n){
    var a = new Array(n);
    for (var i = 0; i < n; i++){ a[i] = null; }
    return a;
}

// ========== Layout ==========
var slotPositions = [];
var startX = 8;          
var startY = 18;          
var rowSpacing = 18;      
var colSpacing = 18;        
var numRows = 3;           
var numCols = 9;            

for (var row = 0; row < numRows; row++) {
    var y = startY + row * rowSpacing;
    for (var col = 0; col < numCols; col++) {
        var x = startX + col * colSpacing;
        slotPositions.push({x: x, y: y});
    }
}

// ========== Open GUI ==========
function interact(event) {
    var player = event.player;
    var api = event.API;

    lastNpc = event.npc; 
    var npcData = lastNpc.getStoreddata();

    // Load shop items
    storedSlotItems = npcData.has("ShopItems") 
        ? JSON.parse(npcData.get("ShopItems")) 
        : {};

    if(!storedSlotItems.items){
        storedSlotItems.items = makeNullArray(slotPositions.length);
    }

    highlightedSlot = null;
    highlightLineIds = [];

    var adminMode = (player.getMainhandItem() && player.getMainhandItem().getName() === "minecraft:bedrock");
    wasAdminMode = adminMode; // Track for saving later

    // Always create fresh GUI
    guiRef = api.createCustomGui(176, 166, 0, true, player);

    // Create item slots
    mySlots = slotPositions.map(function(pos) {
        return guiRef.addItemSlot(pos.x, pos.y);
    });

    if(adminMode){
        // Admin mode - show price setting UI
        guiRef.addLabel(1, "§6Admin Shop Editor", 8, 75, 1.0, 1.0);
        guiRef.addLabel(2, "§7Click slot, set price:", 8, 88, 0.8, 0.8);
        guiRef.addLabel(3, "§7Price:", 8, 102, 0.8, 0.8);
        guiRef.addTextField(ID_PRICE_FIELD, 35, 100, 60, 18).setText("");
        guiRef.addButton(ID_SET_PRICE_BUTTON, "Set Price", 100, 100, 60, 18);
        
        // Show player inventory for admin
        guiRef.showPlayerInventory(0, 131, false);
    } else {
        // Customer mode - show shop title
        guiRef.addLabel(1, "§6Shop", 70, 75, 1.2, 1.2);
        guiRef.addLabel(2, "§7Click items to purchase", 45, 88, 0.8, 0.8);
    }

    // Load items into slots
    for(var i=0; i<mySlots.length; i++){
        mySlots[i].setStack(null);
        if(storedSlotItems.items[i]) {
            try {
                var item = player.world.createItemFromNbt(api.stringToNbt(storedSlotItems.items[i]));
                
                // Get price from lore if it exists
                var price = null;
                var lore = item.getLore();
                for(var j = 0; j < lore.length; j++){
                    var line = lore[j];
                    if(line.indexOf("Price:") !== -1 && line.indexOf("¢") !== -1){
                        var priceStr = line.replace(/§./g, "");
                        var match = priceStr.match(/Price:\s*(\d+)¢/);
                        if(match && match[1]){
                            price = parseInt(match[1]);
                            break;
                        }
                    }
                }
                
                // Add price to lore display (for both admin and customer)
                if(price !== null && price !== undefined){
                    // Get existing lore and convert to JS array
                    var existingLore = item.getLore();
                    var loreArray = [];
                    
                    // Copy existing lore but skip any existing price lines
                    for(var j = 0; j < existingLore.length; j++){
                        var line = existingLore[j];
                        // Skip if it's a price line or purchase instruction
                        if(line.indexOf("Price:") === -1 && line.indexOf("Click to purchase") === -1){
                            loreArray.push(line);
                        }
                    }
                    
                    // Remove trailing empty lines
                    while(loreArray.length > 0 && loreArray[loreArray.length - 1] === ""){
                        loreArray.pop();
                    }
                    
                    // Add price info
                    loreArray.push("");
                    loreArray.push("§aPrice: §e" + price + "¢");
                    
                    // Add additional info for customer mode
                    if(!adminMode){
                        loreArray.push("§7Click to purchase");
                    }
                    
                    // Set the lore back
                    item.setLore(loreArray);
                }
                
                mySlots[i].setStack(item);
            } catch(e) {
                player.message("§cError loading item " + i + ": " + e);
            }
        }
    }
    
    player.showCustomGui(guiRef);
}

// ========== Button Click ==========
function customGuiButton(event){
    if(event.buttonId !== ID_SET_PRICE_BUTTON) return;
    
    var player = event.player;
    var api = event.API;
    var adminMode = (player.getMainhandItem() && player.getMainhandItem().getName() === "minecraft:bedrock");
    
    if(!adminMode) return;
    if(!highlightedSlot) {
        player.message("§cPlease select a slot first!");
        return;
    }
    
    var priceField = event.gui.getComponent(ID_PRICE_FIELD);
    if(!priceField) return;
    
    var priceText = priceField.getText().trim();
    if(!priceText) {
        player.message("§cPlease enter a price!");
        return;
    }
    
    var price = parseFloat(priceText);
    if(isNaN(price) || price < 0) {
        player.message("§cInvalid price! Use a number.");
        return;
    }
    
    // Get the item from highlighted slot
    var item = highlightedSlot.getStack();
    if(!item || item.isEmpty()) {
        player.message("§cNo item in selected slot!");
        return;
    }
    
    var priceValue = Math.floor(price);
    
    // Get existing lore and convert to JS array
    var existingLore = item.getLore();
    var loreArray = [];
    
    // Copy existing lore but skip any existing price lines
    for(var j = 0; j < existingLore.length; j++){
        var line = existingLore[j];
        if(line.indexOf("Price:") === -1 && line.indexOf("Click to purchase") === -1){
            loreArray.push(line);
        }
    }
    
    // Remove trailing empty lines
    while(loreArray.length > 0 && loreArray[loreArray.length - 1] === ""){
        loreArray.pop();
    }
    
    // Add price info
    loreArray.push("");
    loreArray.push("§aPrice: §e" + priceValue + "¢");
    
    item.setLore(loreArray);
    highlightedSlot.setStack(item);
    
    player.message("§aSet price §e" + priceValue + "¢ §afor item!");
    
    // Save to storage
    var slotIndex = mySlots.indexOf(highlightedSlot);
    if(slotIndex !== -1) {
        storedSlotItems.items[slotIndex] = item.getItemNbt().toJsonString();
    }
    saveShopItems();
}

// ========== Slot Click ==========
function customGuiSlotClicked(event) {
    var clickedSlot = event.slot;
    var stack = event.stack;
    var player = event.player;
    var api = event.API;
    var adminMode = (player.getMainhandItem() && player.getMainhandItem().getName() === "minecraft:bedrock");

    var slotIndex = mySlots.indexOf(clickedSlot);

    if(adminMode) {
        if(slotIndex !== -1) {
            // Clicking a shop slot - highlight it
            highlightedSlot = clickedSlot;
            
            // Remove old highlights
            for(var i=0; i<highlightLineIds.length; i++){
                try { guiRef.removeComponent(highlightLineIds[i]); } catch(e) {}
            }
            highlightLineIds = [];

            // Draw new highlight
            var pos = slotPositions[slotIndex];
            var x = pos.x, y = pos.y, w = 18, h = 18;
            highlightLineIds.push(guiRef.addColoredLine(1, x, y, x+w, y, 0xADD8E6, 2));
            highlightLineIds.push(guiRef.addColoredLine(2, x, y+h, x+w, y+h, 0xADD8E6, 2));
            highlightLineIds.push(guiRef.addColoredLine(3, x, y, x, y+h, 0xADD8E6, 2));
            highlightLineIds.push(guiRef.addColoredLine(4, x+w, y, x+w, y+h, 0xADD8E6, 2));
            guiRef.update();
            return;
        }

        // Clicking inventory slot - transfer item to highlighted shop slot
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
                    } else {
                        var overflow = total - maxStack;
                        slotStack.setStackSize(maxStack);
                        highlightedSlot.setStack(slotStack);
                    }
                } else {
                    var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
                    if(slotStack && !slotStack.isEmpty()) player.giveItem(slotStack);
                    highlightedSlot.setStack(itemCopy);
                }
            } else if(slotStack && !slotStack.isEmpty()) {
                player.giveItem(slotStack);
                highlightedSlot.setStack(player.world.createItem("minecraft:air", 1));
                guiRef.update();
            }

            guiRef.update();
        } catch(e) {}
        
    } else {
        // Customer mode - purchase item
        if(slotIndex === -1) return;
        
        var item = mySlots[slotIndex].getStack();
        if(!item || item.isEmpty()) return;
        
        // Get price from lore display
        var price = null;
        var lore = item.getLore();
        for(var i = 0; i < lore.length; i++){
            var line = lore[i];
            // Look for "Price: X¢" pattern
            if(line.indexOf("Price:") !== -1 && line.indexOf("¢") !== -1){
                // Extract number between "Price: " and "¢"
                var priceStr = line.replace(/§./g, ""); // Remove color codes
                var match = priceStr.match(/Price:\s*(\d+)¢/);
                if(match && match[1]){
                    price = parseInt(match[1]);
                    break;
                }
            }
        }
        
        if(price === null || price === undefined) {
            player.message("§cThis item has no price set!");
            return;
        }
        
        // Count player's coins
        var playerCoins = countPlayerCoins(player);
        
        if(playerCoins < price) {
            player.message("§cNot enough coins! Need: §e" + price + "¢ §c, Have: §e" + playerCoins + "¢");
            return;
        }
        
        // Remove coins from player
        removeCoins(player, price);
        
        // Give item to player (create fresh copy from stored NBT without price lore)
        try {
            if(storedSlotItems.items[slotIndex]) {
                var purchaseItem = player.world.createItemFromNbt(api.stringToNbt(storedSlotItems.items[slotIndex]));
                
                // Remove price lore from the item
                var purchaseLore = purchaseItem.getLore();
                var cleanLore = [];
                for(var i = 0; i < purchaseLore.length; i++){
                    var line = purchaseLore[i];
                    if(line.indexOf("Price:") === -1 && line.indexOf("Click to purchase") === -1){
                        cleanLore.push(line);
                    }
                }
                // Remove trailing empty lines
                while(cleanLore.length > 0 && cleanLore[cleanLore.length - 1] === ""){
                    cleanLore.pop();
                }
                purchaseItem.setLore(cleanLore);
                
                player.giveItem(purchaseItem);
                player.message("§aPurchased item for §e" + price + "¢!");
            }
        } catch(e) {
            player.message("§cError purchasing item: " + e);
        }
    }
}

// ========== Save GUI ==========
function customGuiClosed(event) {
    if(!lastNpc || !guiRef) return;
    var npcData = lastNpc.getStoreddata();

    // Only save items from slots if we were in admin mode
    if(wasAdminMode) {
        storedSlotItems.items = mySlots.map(function(slot) {
            var stack = slot.getStack();
            return stack && !stack.isEmpty() ? stack.getItemNbt().toJsonString() : null;
        });
    }

    // Save to NPC storage
    npcData.put("ShopItems", JSON.stringify(storedSlotItems));
    
    guiRef = null;
}

function saveShopItems(){
    if(!lastNpc) return;
    var npcData = lastNpc.getStoreddata();

    // Also update items array from current slots
    storedSlotItems.items = mySlots.map(function(slot) {
        var stack = slot.getStack();
        return stack && !stack.isEmpty() ? stack.getItemNbt().toJsonString() : null;
    });

    // Save to NPC storage
    npcData.put("ShopItems", JSON.stringify(storedSlotItems));
}

// ========== Helper Functions ==========
function countPlayerCoins(player) {
    var stoneTotal = 0;
    var coalTotal = 0;
    var emeraldTotal = 0;
    var inv = player.getInventory();
    
    for(var i = 0; i < inv.getSize(); i++) {
        var stack = inv.getSlot(i);
        if(stack && !stack.isEmpty()) {
            var name = stack.getName();
            if(name === "coins:stone_coin") {
                stoneTotal += stack.getStackSize();
            } else if(name === "coins:coal_coin") {
                coalTotal += stack.getStackSize();
            } else if(name === "coins:emerald_coin") {
                emeraldTotal += stack.getStackSize();
            }
        }
    }
    
    // Convert everything to stone coins for comparison
    return stoneTotal + (coalTotal * STONE_TO_COAL) + (emeraldTotal * STONE_TO_COAL * COAL_TO_EMERALD);
}

function removeCoins(player, amount) {
    var remaining = amount;
    var inv = player.getInventory();
    
    // First remove stone coins
    for(var i = 0; i < inv.getSize() && remaining > 0; i++) {
        var stack = inv.getSlot(i);
        if(stack && !stack.isEmpty() && stack.getName() === "coins:stone_coin") {
            var stackAmount = stack.getStackSize();
            if(stackAmount <= remaining) {
                inv.setSlot(i, null);
                remaining -= stackAmount;
            } else {
                stack.setStackSize(stackAmount - remaining);
                remaining = 0;
            }
        }
    }
    
    // Then remove coal coins (convert to stone value)
    for(var i = 0; i < inv.getSize() && remaining > 0; i++) {
        var stack = inv.getSlot(i);
        if(stack && !stack.isEmpty() && stack.getName() === "coins:coal_coin") {
            var stackAmount = stack.getStackSize();
            var stoneValue = stackAmount * STONE_TO_COAL;
            
            if(stoneValue <= remaining) {
                inv.setSlot(i, null);
                remaining -= stoneValue;
            } else {
                var coalsNeeded = Math.ceil(remaining / STONE_TO_COAL);
                stack.setStackSize(stackAmount - coalsNeeded);
                var overpaid = (coalsNeeded * STONE_TO_COAL) - remaining;
                remaining = 0;
                
                // Give change back if overpaid
                if(overpaid > 0){
                    var changeItem = player.world.createItem("coins:stone_coin", overpaid);
                    player.giveItem(changeItem);
                }
            }
        }
    }
    
    // Finally remove emerald coins (convert to stone value)
    for(var i = 0; i < inv.getSize() && remaining > 0; i++) {
        var stack = inv.getSlot(i);
        if(stack && !stack.isEmpty() && stack.getName() === "coins:emerald_coin") {
            var stackAmount = stack.getStackSize();
            var stoneValue = stackAmount * STONE_TO_COAL * COAL_TO_EMERALD;
            
            if(stoneValue <= remaining) {
                inv.setSlot(i, null);
                remaining -= stoneValue;
            } else {
                var emeraldsNeeded = Math.ceil(remaining / (STONE_TO_COAL * COAL_TO_EMERALD));
                stack.setStackSize(stackAmount - emeraldsNeeded);
                var overpaid = (emeraldsNeeded * STONE_TO_COAL * COAL_TO_EMERALD) - remaining;
                remaining = 0;
                
                // Give change back if overpaid
                if(overpaid > 0){
                    // Convert overpaid stone back to coins
                    var changeCoal = Math.floor(overpaid / STONE_TO_COAL);
                    var changeStone = overpaid % STONE_TO_COAL;
                    
                    if(changeCoal > 0){
                        var coalItem = player.world.createItem("coins:coal_coin", changeCoal);
                        player.giveItem(coalItem);
                    }
                    if(changeStone > 0){
                        var stoneItem = player.world.createItem("coins:stone_coin", changeStone);
                        player.giveItem(stoneItem);
                    }
                }
            }
        }
    }
}
