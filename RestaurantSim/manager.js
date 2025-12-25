var managerFound = false;
var menuItems = [];
var counterPos = null;
var navigationSpeed = 0.4;
var scanRadius = 16;
var orderPlaced = false;

var orderedItems = [];
var orderedPrices = []; // Store prices for ordered items
var assignedChair = null;
var chairReached = false;
var spawnPos = null;
var guiClosed = false;
var initialized = false;
var returningToSpawn = false;
var myChairIndex = -1;
var pricingData = {};
var paymentReceived = false;
var paymentCheckTicks = 0;
var hasSaidPrice = false; // Track if customer already said their price
var pricingDataLoaded = false; // Track if we've loaded pricing data

function parseCoords(str){
    if(!str) return null;
    
    try {
        var obj = JSON.parse(str);
        if(obj && typeof obj.x === "number" && typeof obj.y === "number" && typeof obj.z === "number"){
            return {x: obj.x, y: obj.y, z: obj.z};
        }
    } catch(e) {}
    
    var p = str.split(/[ ,]+/);
    if(p.length < 3) return null;
    var x = parseFloat(p[0]), y = parseFloat(p[1]), z = parseFloat(p[2]);
    if(isNaN(x) || isNaN(y) || isNaN(z)) return null;
    return {x:x, y:y, z:z};
}

function init(event){
    var npc = event.npc;
    var selfData = npc.getStoreddata();
    
    selfData.put("Leave", "false");
    selfData.put("GuiClosed", "false");
    selfData.put("PaymentReceived", "false");
    
    spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
    initialized = true;
}

function getMyId(npc){
    try {
        return npc.getEntityId ? npc.getEntityId().toString() : npc.getName();
    } catch(e) {
        return "customer_" + Math.random();
    }
}

function tryClaimChair(npc, managerNpc){
    if(!managerNpc) return false;
    
    var managerData = managerNpc.getStoreddata();
    if(!managerData.has("ChairList")) return false;
    
    var chairsList;
    try {
        chairsList = JSON.parse(managerData.get("ChairList"));
    } catch(e) {
        return false;
    }
    
    if(!Array.isArray(chairsList) || chairsList.length === 0) return false;
    
    var myId = getMyId(npc);
    
    var managerJobTicks = 0;
    var chairFreeTicks = 600;
    try {
        if(managerData.has("JobTicks")){
            managerJobTicks = parseInt(managerData.get("JobTicks"));
        }
        
        if(managerData.has("ChairFreeTicks")){
            chairFreeTicks = parseInt(managerData.get("ChairFreeTicks"));
        }
    } catch(e) {}
    
    for(var i = 0; i < chairsList.length; i++){
        if(!chairsList[i].taken){
            var freeAt = managerJobTicks + chairFreeTicks;
            chairsList[i].taken = true;
            chairsList[i].freeAtTick = freeAt;
            chairsList[i].occupiedBy = myId;
            
            managerData.put("ChairList", JSON.stringify(chairsList));
            
            myChairIndex = i;
            assignedChair = {x: chairsList[i].x, y: chairsList[i].y, z: chairsList[i].z};
            
            return true;
        }
    }
    
    return false;
}

function isMyChairExpired(npc, managerNpc){
    if(myChairIndex === -1) return false;
    if(!managerNpc) return false;
    
    var managerData = managerNpc.getStoreddata();
    if(!managerData.has("ChairList")) return false;
    
    var chairsList;
    try {
        chairsList = JSON.parse(managerData.get("ChairList"));
    } catch(e) {
        return false;
    }
    
    if(!Array.isArray(chairsList) || chairsList.length === 0) return false;
    if(myChairIndex < 0 || myChairIndex >= chairsList.length) return false;
    
    var myChair = chairsList[myChairIndex];
    
    var myId = getMyId(npc);
    if(!myChair.taken){
        return true;
    }
    if(myChair.occupiedBy && myChair.occupiedBy !== myId){
        return true;
    }
    
    return false;
}

function isJobStopped(managerNpc){
    if(!managerNpc) return false;
    
    var managerData = managerNpc.getStoreddata();
    if(managerData.has("JobStopped")){
        return managerData.get("JobStopped") === "true";
    }
    return false;
}

// Find price for a given food item
function findPriceForItem(itemNbtString, api, world, npc) {
    if (!pricingData || Object.keys(pricingData).length === 0) {
        return [];
    }
    
    // Get the food item to compare
    var foodToMatch;
    try {
        foodToMatch = world.createItemFromNbt(api.stringToNbt(itemNbtString));
    } catch(e) {
        return [];
    }
    
    var foodName = foodToMatch.getName();
    npc.say("Looking for: " + foodName);
    
    var prices = [];
    var checkedCount = 0;
    
    for (var pageKey in pricingData) {
        var pageData = pricingData[pageKey];
        if (!Array.isArray(pageData)) continue;
        
        // Loop through every 3 slots (food, price1, price2)
        for (var i = 0; i < pageData.length; i += 3) {
            var foodItem = pageData[i];
            var price1 = pageData[i + 1];
            var price2 = pageData[i + 2];
            
            if (foodItem) {
                try {
                    var pricingFoodItem = world.createItemFromNbt(api.stringToNbt(foodItem));
                    var pricingFoodName = pricingFoodItem.getName();
                    
                    checkedCount++;
                    if(checkedCount <= 5) { // Show first 5
                        npc.say("Slot " + i + ": " + pricingFoodName);
                    }
                    
                    // Compare by item name
                    if (pricingFoodName === foodName) {
                        npc.say("MATCH at slot " + i + "!");
                        if (price1) prices.push(price1);
                        if (price2) prices.push(price2);
                        return prices;
                    }
                } catch(e) {}
            }
        }
    }
    
    npc.say("No match. Checked " + checkedCount + " food items");
    return prices;
}

// Build a nice price string from payment items
function buildPriceString(api, world) {
    var priceMap = {}; // Map item names to total quantities
    
    for(var i = 0; i < orderedPrices.length; i++){
        var priceArray = orderedPrices[i];
        for(var j = 0; j < priceArray.length; j++){
            try {
                var priceItem = world.createItemFromNbt(api.stringToNbt(priceArray[j]));
                var itemName = priceItem.getDisplayName();
                var itemCount = priceItem.getStackSize();
                
                if(!priceMap[itemName]){
                    priceMap[itemName] = 0;
                }
                priceMap[itemName] += itemCount;
            } catch(e) {}
        }
    }
    
    var priceStrings = [];
    for(var itemName in priceMap){
        priceStrings.push(priceMap[itemName] + " " + itemName);
    }
    
    if(priceStrings.length === 0) return "free";
    if(priceStrings.length === 1) return priceStrings[0];
    
    // Join with "and" for the last item
    var lastItem = priceStrings.pop();
    return priceStrings.join(", ") + " and " + lastItem;
}

function tick(event){
    var npc = event.npc;
    var world = npc.getWorld();
    var api = event.API;

    if(!initialized){
        spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
        initialized = true;
    }
    
    // Load pricing data from own stored data (set by manager during spawn)
    // Keep checking until we have it
    var hasPricingData = pricingData && Object.keys(pricingData).length > 0;
    
    if(!pricingDataLoaded && !hasPricingData){
        var selfData = npc.getStoreddata();
        if(selfData.has("PricingData")){
            try{
                var rawData = selfData.get("PricingData");
                pricingData = JSON.parse(rawData);
                var pageCount = Object.keys(pricingData).length;
                if(pageCount > 0){
                    npc.say("Successfully loaded " + pageCount + " pricing pages!");
                    
                    // Debug: show what's in page 0
                    if(pricingData["0"] && Array.isArray(pricingData["0"])){
                        var itemCount = 0;
                        var firstFoodSlot = -1;
                        for(var i = 0; i < pricingData["0"].length; i += 3){
                            if(pricingData["0"][i]){
                                itemCount++;
                                if(firstFoodSlot === -1){
                                    firstFoodSlot = i;
                                    try {
                                        var testItem = world.createItemFromNbt(api.stringToNbt(pricingData["0"][i]));
                                        npc.say("First food in MY data: slot " + i + " = " + testItem.getName());
                                    } catch(e) {}
                                }
                            }
                        }
                        npc.say("Found " + itemCount + " food items in page 0");
                    }
                    
                    pricingDataLoaded = true;
                }
            }catch(e){
                pricingData = {};
                npc.say("Parse error: " + e);
            }
        }
    }

    var nearby = world.getNearbyEntities(npc.getX(), npc.getY(), npc.getZ(), scanRadius, 2);
    var managerNpc = null;
    
    for(var i=0; i<nearby.length; i++){
        var other = nearby[i];
        if(!other || !other.getName) continue;
        if(other.getName() === "Manager"){
            var data = other.getStoreddata();

            if(data.has("RestaurantMenu")){
                try{
                    menuItems = JSON.parse(data.get("RestaurantMenu"));
                }catch(e){
                    menuItems = [];
                }
            }

            if(data.has("CounterPos")){
                counterPos = parseCoords(data.get("CounterPos"));
            }

            managerNpc = other;
            managerFound = true;
            break;
        }
    }

    if(managerNpc && isJobStopped(managerNpc)){
        returningToSpawn = true;
        assignedChair = null;
        chairReached = false;
    }

    if(orderPlaced && !guiClosed && !assignedChair){
        try{
            var selfData = npc.getStoreddata();
            if(selfData.has("GuiClosed") && selfData.get("GuiClosed") === "true"){
                guiClosed = true;
                selfData.put("GuiClosed", "false");
            }
        }catch(e){}
    }

    if(assignedChair && chairReached && isMyChairExpired(npc, managerNpc)){
        returningToSpawn = true;
        assignedChair = null;
        chairReached = false;
        myChairIndex = -1;
    }

    // Check if payment was received
    if(assignedChair && chairReached && !paymentReceived){
        paymentCheckTicks++;
        try{
            var selfData = npc.getStoreddata();
            if(selfData.has("PaymentReceived") && selfData.get("PaymentReceived") === "true"){
                paymentReceived = true;
                selfData.put("PaymentReceived", "false");
                
                // Wait a bit then leave
                returningToSpawn = true;
                npc.say("Thank you!");
            }
        }catch(e){}
        
        // Say the total price when seated
        if(!hasSaidPrice && orderedPrices.length > 0){
            var priceString = buildPriceString(api, world);
            npc.say("Total price is " + priceString);
            hasSaidPrice = true;
        }
    }

    if(returningToSpawn){
        if(spawnPos){
            var dx = npc.getX() - spawnPos.x;
            var dy = npc.getY() - spawnPos.y;
            var dz = npc.getZ() - spawnPos.z;
            var distSq = dx*dx + dy*dy + dz*dz;
            
            npc.navigateTo(spawnPos.x, spawnPos.y, spawnPos.z, navigationSpeed);
            
            if(distSq < 4.0){
                npc.despawn();
            }
        } else {
            npc.despawn();
        }
        return;
    }

    if(chairReached){
        return;
    }

    if(assignedChair){
        var ddx = npc.getX() - assignedChair.x;
        var ddy = npc.getY() - assignedChair.y;
        var ddz = npc.getZ() - assignedChair.z;
        var distSq = ddx*ddx + ddy*ddy + ddz*ddz;

        npc.navigateTo(assignedChair.x, assignedChair.y, assignedChair.z, navigationSpeed);

        if(distSq < 1.0){
            chairReached = true;
        }
        return;
    }

    if(orderPlaced && guiClosed && !assignedChair && managerNpc){
        var claimed = tryClaimChair(npc, managerNpc);
        if(claimed){
            guiClosed = false;
        } else {
            npc.say("No chairs available, waiting at counter.");
            guiClosed = false;
        }
    }

    if(managerFound && counterPos && !orderPlaced){
        npc.navigateTo(counterPos.x, counterPos.y, counterPos.z, navigationSpeed);

        var dx = npc.getX() - counterPos.x;
        var dy = npc.getY() - counterPos.y;
        var dz = npc.getZ() - counterPos.z;

        if(dx*dx + dy*dy + dz*dz < 4){
            orderPlaced = true;
            
            // Load pricing data from MANAGER at counter
            if(managerNpc){
                var managerData = managerNpc.getStoreddata();
                if(managerData.has("PricingItems")){
                    try{
                        pricingData = JSON.parse(managerData.get("PricingItems"));
                        var pageCount = Object.keys(pricingData).length;
                        npc.say("Loaded " + pageCount + " pricing pages from manager");
                    }catch(e){
                        pricingData = {};
                        npc.say("Parse error: " + e);
                    }
                } else {
                    npc.say("Manager has no pricing data!");
                }
            } else {
                npc.say("No manager found!");
            }

            if(menuItems.length > 0){
                orderedItems = [];
                orderedPrices = [];
                
                var hasPricing = pricingData && Object.keys(pricingData).length > 0;
                if(!hasPricing){
                    npc.say("Warning: No pricing data loaded yet!");
                }
                
                var orderCount = 1 + Math.floor(Math.random() * 3);
                for(var k=0; k<orderCount; k++){
                    var idx = Math.floor(Math.random() * menuItems.length);
                    var entry = menuItems[idx];
                    var nbt;
                    if(typeof entry === "string"){
                        nbt = api.stringToNbt(entry);
                    }else{
                        nbt = api.stringToNbt(JSON.stringify(entry));
                    }
                    var item = world.createItemFromNbt(nbt);
                    orderedItems.push(item);
                    
                    // Find prices for this item
                    var itemPrices = findPriceForItem(entry, api, world, npc);
                    orderedPrices.push(itemPrices);
                }
            }
        }
    }
}

function interact(event){
    var player = event.player;
    var api = event.API;
    var npc = event.npc;

    if(orderedItems.length === 0){
        player.message("This customer hasn't ordered yet.");
        return;
    }
    
    // Check if payment already received
    if(paymentReceived){
        player.message("This customer has already paid.");
        return;
    }

    var gui = api.createCustomGui(102, 180, 0, true, player);
    gui.addLabel(1, "Customer wants:", 10, 10, 150, 12);

    var slotX = 10;
    var currentY = 35;
    
    for(var i=0; i<orderedItems.length && i<3; i++){
        var slot = gui.addItemSlot(slotX, currentY);
        if(orderedItems[i]){
            slot.setStack(orderedItems[i]);
        }
        currentY += 25;
    }

    player.showCustomGui(gui);
}

function customGuiClosed(event){
    try{
        guiClosed = true;
        if(event.npc){
            event.npc.getStoreddata().put("GuiClosed", "true");
        }
        
        // Check if player provided all ordered items and payment
        var player = event.player;
        var npc = event.npc;
        if(!player || !npc || orderedItems.length === 0) return;
        
        var inv = player.getInventory().getItems();
        
        // Check if player has all ordered food items
        var hasAllFood = true;
        for(var i=0; i<orderedItems.length; i++){
            var needed = orderedItems[i];
            if(!needed || needed.isEmpty()) continue;
            
            var foundCount = 0;
            for(var j=0; j<inv.length; j++){
                var invItem = inv[j];
                if(invItem && invItem.getName() === needed.getName()){
                    foundCount += invItem.getStackSize();
                }
            }
            
            if(foundCount < needed.getStackSize()){
                hasAllFood = false;
                break;
            }
        }
        
        if(!hasAllFood){
            return; // Don't process payment if food not delivered
        }
        
        // Check if player has all payment items
        var hasAllPayment = true;
        var paymentNeeded = {};
        
        for(var i=0; i<orderedPrices.length; i++){
            var priceArray = orderedPrices[i];
            for(var j=0; j<priceArray.length; j++){
                try {
                    var priceItem = player.world.createItemFromNbt(event.API.stringToNbt(priceArray[j]));
                    var itemName = priceItem.getName();
                    var itemCount = priceItem.getStackSize();
                    
                    if(!paymentNeeded[itemName]){
                        paymentNeeded[itemName] = 0;
                    }
                    paymentNeeded[itemName] += itemCount;
                } catch(e) {}
            }
        }
        
        for(var itemName in paymentNeeded){
            var needed = paymentNeeded[itemName];
            var foundCount = 0;
            
            for(var j=0; j<inv.length; j++){
                var invItem = inv[j];
                if(invItem && invItem.getName() === itemName){
                    foundCount += invItem.getStackSize();
                }
            }
            
            if(foundCount < needed){
                hasAllPayment = false;
                break;
            }
        }
        
        if(!hasAllFood || !hasAllPayment){
            return;
        }
        
        // Remove food items from player
        for(var i=0; i<orderedItems.length; i++){
            var needed = orderedItems[i];
            if(!needed || needed.isEmpty()) continue;
            
            var toRemove = needed.getStackSize();
            for(var j=0; j<inv.length && toRemove > 0; j++){
                var invItem = inv[j];
                if(invItem && invItem.getName() === needed.getName()){
                    var removeAmt = Math.min(toRemove, invItem.getStackSize());
                    invItem.setStackSize(invItem.getStackSize() - removeAmt);
                    toRemove -= removeAmt;
                }
            }
        }
        
        // Give payment to player
        for(var i=0; i<orderedPrices.length; i++){
            var priceArray = orderedPrices[i];
            for(var j=0; j<priceArray.length; j++){
                try {
                    var paymentItem = player.world.createItemFromNbt(event.API.stringToNbt(priceArray[j]));
                    player.giveItem(paymentItem);
                } catch(e) {}
            }
        }
        
        npc.getStoreddata().put("PaymentReceived", "true");
        player.message("§aTransaction complete!");
        
    }catch(e){}
}
