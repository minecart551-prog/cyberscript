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
function findPriceForItem(itemNbtString) {
    if (!pricingData || Object.keys(pricingData).length === 0) return [];
    
    var prices = [];
    
    for (var pageKey in pricingData) {
        var pageData = pricingData[pageKey];
        if (!Array.isArray(pageData)) continue;
        
        for (var i = 0; i < pageData.length; i += 3) {
            var foodItem = pageData[i];
            var price1 = pageData[i + 1];
            var price2 = pageData[i + 2];
            
            if (foodItem && foodItem === itemNbtString) {
                if (price1) prices.push(price1);
                if (price2) prices.push(price2);
                return prices;
            }
        }
    }
    
    return prices;
}

function tick(event){
    var npc = event.npc;
    var world = npc.getWorld();
    var api = event.API;

    if(!initialized){
        spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
        initialized = true;
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
            
            if(data.has("PricingData")){
                try{
                    pricingData = JSON.parse(data.get("PricingData"));
                }catch(e){
                    pricingData = {};
                }
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

            if(menuItems.length > 0){
                orderedItems = [];
                orderedPrices = [];
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
                    var itemPrices = findPriceForItem(entry);
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
    
    // Add payment section
    gui.addLabel(2, "Total Payment:", 10, currentY + 10, 150, 12);
    currentY += 30;
    
    var paymentSlotX = 10;
    var paymentSlotCount = 0;
    
    for(var i=0; i<orderedPrices.length; i++){
        var priceArray = orderedPrices[i];
        for(var j=0; j<priceArray.length && paymentSlotCount < 6; j++){
            try {
                var priceItem = player.world.createItemFromNbt(api.stringToNbt(priceArray[j]));
                var pSlot = gui.addItemSlot(paymentSlotX + (paymentSlotCount % 3) * 25, currentY + Math.floor(paymentSlotCount / 3) * 25);
                pSlot.setStack(priceItem);
                paymentSlotCount++;
            } catch(e) {}
        }
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
