// Shop NPC Script with Tabs
// Place this in the NPC's Interact, customGuiButton, customGuiSlotClicked, and customGuiClosed events

var guiRef;                 
var mySlots = [];           
var highlightLineIds = [];  
var highlightedSlot = null; 
var lastNpc = null;         
var storedSlotItems = {};   // per-page storage
var currentPage = 0;        // track current page
var maxPages = 5;           // max pages (5 tabs)

// Currency conversion rates
var STONE_TO_COAL = 100;    // 100 stone coins = 1 coal coin
var COAL_TO_EMERALD = 100;  // 100 coal coins = 1 emerald coin

// Price field component IDs
var ID_PRICE_FIELD = 100;
var ID_SET_PRICE_BUTTON = 101;

// Tab button IDs (102-106 for 5 tabs)
var ID_TAB_BASE = 102;

// Helper: create an array of length n filled with null
function makeNullArray(n){
    var a = new Array(n);
    for (var i = 0; i < n; i++){ a[i] = null; }
    return a;
}

// ========== Layout ==========
var slotPositions = [];
var tabSlots = [];  // New: slots for tab items
var startX = 3;          
var startY = -50;
var rowSpacing = 18;      
var colSpacing = 18;        
var numRows = 5;
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
    
    // Load tab items
    var storedTabItems = npcData.has("TabItems")
        ? JSON.parse(npcData.get("TabItems"))
        : makeNullArray(maxPages);

    // Initialize current page if it doesn't exist
    if(!storedSlotItems[currentPage]){
        storedSlotItems[currentPage] = makeNullArray(slotPositions.length);
    }

    highlightedSlot = null;
    highlightLineIds = [];

    var adminMode = (player.getMainhandItem() && player.getMainhandItem().getName() === "minecraft:bedrock");

    // Only create GUI if it doesn't exist yet
    if(!guiRef){
        guiRef = api.createCustomGui(176, 166, 0, true, player);

        // Add tab item slots (admin can customize these)
        var tabWidth = 25;
        var tabHeight = 28;
        var tabSpacing = 2;
        var tabStartX = 0;
        var tabY = -80;
        
        tabSlots = [];
        for(var i = 0; i < maxPages; i++){
            var tabX = tabStartX + i * (tabWidth + tabSpacing);
            var tabSlot = guiRef.addItemSlot(tabX + 4, tabY + 5); // Center item in tab area
            tabSlots.push(tabSlot);
            
            // Add background button for each tab
            var buttonId = ID_TAB_BASE + i;
            guiRef.addButton(buttonId, "", tabX, tabY, tabWidth, tabHeight);
        }

        // Create item slots
        mySlots = slotPositions.map(function(pos) {
            return guiRef.addItemSlot(pos.x, pos.y);
        });

        if(adminMode){
            guiRef.addLabel(1, "§6Admin Shop Editor", 2, 45, 1.0, 1.0);
            guiRef.addLabel(3, "§7Price/Name:", 2, 64, 0.8, 0.8);
            guiRef.addTextField(ID_PRICE_FIELD, 50, 60, 60, 18).setText("");
            guiRef.addButton(ID_SET_PRICE_BUTTON, "Set Price", 115, 60, 50, 18);
            guiRef.showPlayerInventory(3, 91, false);
        }

        player.showCustomGui(guiRef);
    }
    
    // Load tab items into tab slots
    for(var i = 0; i < tabSlots.length; i++){
        if(storedTabItems[i]){
            try {
                var tabItem = player.world.createItemFromNbt(api.stringToNbt(storedTabItems[i]));
                tabSlots[i].setStack(tabItem);
            } catch(e) {}
        } else {
            // Default: show air for empty tabs
            tabSlots[i].setStack(null);
        }
    }

    // Load items into slots
    for(var i=0; i<mySlots.length; i++){
        mySlots[i].setStack(null);
        if(storedSlotItems[currentPage][i]) {
            try {
                var item = player.world.createItemFromNbt(api.stringToNbt(storedSlotItems[currentPage][i]));
                
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
                
                if(price !== null && price !== undefined){
                    var existingLore = item.getLore();
                    var loreArray = [];
                    
                    for(var j = 0; j < existingLore.length; j++){
                        var line = existingLore[j];
                        if(line.indexOf("Price:") === -1 && line.indexOf("Click to purchase") === -1){
                            loreArray.push(line);
                        }
                    }
                    
                    while(loreArray.length > 0 && loreArray[loreArray.length - 1] === ""){
                        loreArray.pop();
                    }
                    
                    loreArray.push("");
                    loreArray.push("§aPrice: §e" + price + "¢");
                    
                    if(!adminMode){
                        loreArray.push("§7Click to purchase");
                    }
                    
                    item.setLore(loreArray);
                }
                
                mySlots[i].setStack(item);
            } catch(e) {
                player.message("§cError loading item " + i + ": " + e);
            }
        }
    }
    
    guiRef.update();
}

// ========== Button Click ==========
function customGuiButton(event){
    var player = event.player;
    var api = event.API;
    var adminMode = (player.getMainhandItem() && player.getMainhandItem().getName() === "minecraft:bedrock");
    
    // Handle tab buttons - always switch tabs when button is clicked
    if(event.buttonId >= ID_TAB_BASE && event.buttonId < ID_TAB_BASE + maxPages){
        var tabIndex = event.buttonId - ID_TAB_BASE;
        
        // In admin mode, set the tab slot as highlighted (without visual highlight)
        if(adminMode){
            highlightedSlot = tabSlots[tabIndex];
        }
        
        // Switch tabs (for both admin and customer)
        if(tabIndex !== currentPage){
            savePageItems();
            currentPage = tabIndex;
            interact({player: player, API: api, npc: lastNpc});
        }
        return;
    }
    
    // Handle Set Price button
    if(event.buttonId !== ID_SET_PRICE_BUTTON) return;
    
    if(!adminMode) return;
    
    var priceField = event.gui.getComponent(ID_PRICE_FIELD);
    if(!priceField) return;
    
    var inputText = priceField.getText().trim();
    if(!inputText) {
        player.message("§cPlease enter a value!");
        return;
    }
    
    // Check if highlighting a tab slot (rename mode) or shop slot (price mode)
    var tabSlotIndex = tabSlots.indexOf(highlightedSlot);
    
    if(tabSlotIndex !== -1){
        // Renaming tab item
        var tabItem = highlightedSlot.getStack();
        if(!tabItem || tabItem.isEmpty()){
            player.message("§cNo item in selected tab slot!");
            return;
        }
        
        tabItem.setCustomName(inputText);
        highlightedSlot.setStack(tabItem);
        player.message("§aRenamed tab to: " + inputText);
        saveTabItems();
        return;
    }
    
    // Normal price setting for shop items
    if(!highlightedSlot) {
        player.message("§cPlease select a slot first!");
        return;
    }
    
    var price = parseFloat(inputText);
    if(isNaN(price) || price < 0) {
        player.message("§cInvalid price! Use a number.");
        return;
    }
    
    var item = highlightedSlot.getStack();
    if(!item || item.isEmpty()) {
        player.message("§cNo item in selected slot!");
        return;
    }
    
    var priceValue = Math.floor(price);
    
    var existingLore = item.getLore();
    var loreArray = [];
    
    for(var j = 0; j < existingLore.length; j++){
        var line = existingLore[j];
        if(line.indexOf("Price:") === -1 && line.indexOf("Click to purchase") === -1){
            loreArray.push(line);
        }
    }
    
    while(loreArray.length > 0 && loreArray[loreArray.length - 1] === ""){
        loreArray.pop();
    }
    
    loreArray.push("");
    loreArray.push("§aPrice: §e" + priceValue + "¢");
    
    item.setLore(loreArray);
    highlightedSlot.setStack(item);
    
    player.message("§aSet price §e" + priceValue + "¢ §afor item!");
    
    savePageItems();
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
        // Check if admin is trying to place item in highlighted tab slot
        var highlightedTabIndex = tabSlots.indexOf(highlightedSlot);
        if(highlightedTabIndex !== -1 && slotIndex === -1 && stack && !stack.isEmpty()){
            // Admin placing item from inventory into highlighted tab slot
            var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
            highlightedSlot.setStack(itemCopy);
            saveTabItems();
            guiRef.update();
            return;
        }
        
        if(slotIndex !== -1) {
            highlightedSlot = clickedSlot;
            
            for(var i=0; i<highlightLineIds.length; i++){
                try { guiRef.removeComponent(highlightLineIds[i]); } catch(e) {}
            }
            highlightLineIds = [];

            var pos = slotPositions[slotIndex];
            var x = pos.x, y = pos.y, w = 18, h = 18;
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
        // Customer mode
        if(slotIndex === -1) return;
        
        var item = mySlots[slotIndex].getStack();
        if(!item || item.isEmpty()) return;
        
        var price = null;
        var lore = item.getLore();
        for(var i = 0; i < lore.length; i++){
            var line = lore[i];
            if(line.indexOf("Price:") !== -1 && line.indexOf("¢") !== -1){
                var priceStr = line.replace(/§./g, "");
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
        
        var playerCoins = countPlayerCoins(player);
        
        if(playerCoins < price) {
            player.message("§cNot enough coins! Need: §e" + price + "¢ §c, Have: §e" + playerCoins + "¢");
            return;
        }
        
        removeCoins(player, price);
        
        try {
            if(storedSlotItems[currentPage][slotIndex]) {
                var purchaseItem = player.world.createItemFromNbt(api.stringToNbt(storedSlotItems[currentPage][slotIndex]));
                
                var purchaseLore = purchaseItem.getLore();
                var cleanLore = [];
                for(var i = 0; i < purchaseLore.length; i++){
                    var line = purchaseLore[i];
                    if(line.indexOf("Price:") === -1 && line.indexOf("Click to purchase") === -1){
                        cleanLore.push(line);
                    }
                }
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
    savePageItems();
    saveTabItems();
    guiRef = null;
}

function savePageItems(){
    if(!lastNpc) return;
    var npcData = lastNpc.getStoreddata();

    storedSlotItems[currentPage] = mySlots.map(function(slot) {
        var stack = slot.getStack();
        return stack && !stack.isEmpty() ? stack.getItemNbt().toJsonString() : null;
    });

    npcData.put("ShopItems", JSON.stringify(storedSlotItems));
}

function saveTabItems(){
    if(!lastNpc || !tabSlots || tabSlots.length === 0) return;
    var npcData = lastNpc.getStoreddata();
    
    var tabItems = tabSlots.map(function(slot){
        var stack = slot.getStack();
        if(stack && !stack.isEmpty()){
            return stack.getItemNbt().toJsonString();
        }
        return null;
    });
    
    npcData.put("TabItems", JSON.stringify(tabItems));
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
    
    return stoneTotal + (coalTotal * STONE_TO_COAL) + (emeraldTotal * STONE_TO_COAL * COAL_TO_EMERALD);
}

function removeCoins(player, amount) {
    var remaining = amount;
    var inv = player.getInventory();
    
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
                
                if(overpaid > 0){
                    var changeItem = player.world.createItem("coins:stone_coin", overpaid);
                    player.giveItem(changeItem);
                }
            }
        }
    }
    
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
                
                if(overpaid > 0){
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
