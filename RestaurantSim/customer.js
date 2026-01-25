var managerFound = false;
var menuItems = [];
var counterPos = null;
var navigationSpeed = 0.4;
var scanRadius = 30;
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
            
            // Increment customer count when claiming chair
            var currentCount = 0;
            try {
                if(managerData.has("CurrentCustomerCount")){
                    currentCount = parseInt(managerData.get("CurrentCustomerCount"));
                }
            } catch(e) {}
            currentCount++;
            managerData.put("CurrentCustomerCount", currentCount.toString());
            
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
    var prices = [];
    
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
                    
                    // Compare by item name
                    if (pricingFoodName === foodName) {
                        if (price1) prices.push(price1);
                        if (price2) prices.push(price2);
                        return prices;
                    }
                } catch(e) {}
            }
        }
    }
    
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
                    pricingDataLoaded = true;
                }
            }catch(e){
                pricingData = {};
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
        // Reset animation when leaving
        npc.getAi().setAnimation(0); // NORMAL animation
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
        // Reset animation when leaving chair
        npc.getAi().setAnimation(0); // NORMAL animation
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
                
                // Reset animation and leave
                npc.getAi().setAnimation(0); // NORMAL animation
                returningToSpawn = true;
                npc.say("Thank you!");
            }
        }catch(e){}
        

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
            // Set sitting animation when reaching the chair
            npc.getAi().setAnimation(1); // SIT animation (value 3)
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
                    }catch(e){
                        pricingData = {};
                    }
                }
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
    
    // Check what player is holding
    var heldItem = player.getMainhandItem();
    
    if(!heldItem || heldItem.isEmpty()){
        // Build the order message with colored formatting
        var orderParts = [];
        for(var i=0; i<orderedItems.length; i++){
            if(orderedItems[i]){
                var itemName = orderedItems[i].getDisplayName();
                var itemCount = orderedItems[i].getStackSize();
                // §e = yellow for quantity, §a = green for item name
                orderParts.push("§ex" + itemCount + " §a" + itemName);
            }
        }
        
        if(orderParts.length > 0){
            var orderMessage = orderParts.join(" ");
            npc.say(orderMessage);
        }
        
        var gui = api.createCustomGui(102, 180, 0, true, player);
        var label = gui.addLabel(1, "Customer wants:", 46, -50, 150, 12);
        label.setColor(0xFFFFFF);

        var currentX = 52;
        var slotY = -23;
        
        for(var i=0; i<orderedItems.length && i<3; i++){
            var slot = gui.addItemSlot(currentX, slotY);
            if(orderedItems[i]){
                slot.setStack(orderedItems[i]);
            }
            currentX += 25;
        }

        player.showCustomGui(gui);
        return;
    }
    
    // Player is holding something - check if it's a needed food item
    var heldName = heldItem.getName();
    var matchedIndex = -1;
    
    for(var i=0; i<orderedItems.length; i++){
        if(orderedItems[i] && orderedItems[i].getName() === heldName){
            matchedIndex = i;
            break;
        }
    }
    
    if(matchedIndex === -1){
        player.message("§cThis customer didn't order that item!");
        return;
    }
    
    // Check if this item was already delivered
    if(!orderedItems[matchedIndex]){
        player.message("§cYou already gave this item!");
        return;
    }
    
    // Take the item from player
    var neededAmount = orderedItems[matchedIndex].getStackSize();
    var inv = player.getInventory().getItems();
    var removed = 0;
    
    for(var j=0; j<inv.length && removed < neededAmount; j++){
        var invItem = inv[j];
        if(invItem && invItem.getName() === heldName){
            var toRemove = Math.min(neededAmount - removed, invItem.getStackSize());
            invItem.setStackSize(invItem.getStackSize() - toRemove);
            removed += toRemove;
        }
    }
    
    if(removed < neededAmount){
        player.message("§cYou need " + neededAmount + " of this item!");
        return;
    }
    
    // Mark this item as delivered
    orderedItems[matchedIndex] = null;
    player.message("§aItem delivered!");
    
    // Check if ALL items are now delivered
    var allDelivered = true;
    for(var i=0; i<orderedItems.length; i++){
        if(orderedItems[i]){
            allDelivered = false;
            break;
        }
    }
    
    if(allDelivered){
        // All food delivered! Give payment
        for(var i=0; i<orderedPrices.length; i++){
            var priceArray = orderedPrices[i];
            for(var j=0; j<priceArray.length; j++){
                try {
                    var paymentItem = player.world.createItemFromNbt(api.stringToNbt(priceArray[j]));
                    player.giveItem(paymentItem);
                } catch(e) {}
            }
        }
        
        paymentReceived = true;
        npc.getStoreddata().put("PaymentReceived", "true");
        player.message("§aTransaction complete!");
        npc.say("Thank you!");
    }
}

function customGuiClosed(event){
    try{
        guiClosed = true;
        if(event.npc){
            event.npc.getStoreddata().put("GuiClosed", "true");
        }
    }catch(e){}
}
