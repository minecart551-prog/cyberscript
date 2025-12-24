var managerFound = false;
var menuItems = [];
var counterPos = null;
var navigationSpeed = 0.4;
var scanRadius = 16;
var orderPlaced = false;

var orderedItems = [];
var assignedChair = null;
var chairReached = false;
var spawnPos = null;
var guiClosed = false;
var initialized = false;
var returningToSpawn = false;
var myChairIndex = -1; // Which chair index we claimed

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
    
    spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
    initialized = true;
}

// Get a unique ID for this customer
function getMyId(npc){
    try {
        return npc.getEntityId ? npc.getEntityId().toString() : npc.getName();
    } catch(e) {
        return "customer_" + Math.random();
    }
}

// Try to claim a free chair from manager
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
    
    // Get current job ticks and chair duration from manager
    var managerJobTicks = 0;
    var chairFreeTicks = 600; // default fallback
    try {
        if(managerData.has("JobTicks")){
            managerJobTicks = parseInt(managerData.get("JobTicks"));
            npc.say("Current JobTicks: " + managerJobTicks);
        } else {
            npc.say("ERROR: No JobTicks in manager!");
        }
        
        if(managerData.has("ChairFreeTicks")){
            chairFreeTicks = parseInt(managerData.get("ChairFreeTicks"));
            npc.say("Chair duration: " + chairFreeTicks + " ticks");
        }
    } catch(e) {}
    
    // Find first free chair
    for(var i = 0; i < chairsList.length; i++){
        if(!chairsList[i].taken){
            // Claim it!
            var freeAt = managerJobTicks + chairFreeTicks;
            chairsList[i].taken = true;
            chairsList[i].freeAtTick = freeAt;
            chairsList[i].occupiedBy = myId;
            
            npc.say("Claimed chair " + i + ", will free at tick " + freeAt);
            
            // Save back to manager
            managerData.put("ChairList", JSON.stringify(chairsList));
            
            // Remember which chair we took
            myChairIndex = i;
            assignedChair = {x: chairsList[i].x, y: chairsList[i].y, z: chairsList[i].z};
            
            return true;
        }
    }
    
    return false; // No free chairs
}

// Check if our chair time is up
function isMyChairExpired(npc, managerNpc){
    if(myChairIndex === -1) return false;
    if(!managerNpc) return false;
    
    var managerData = managerNpc.getStoreddata();
    if(!managerData.has("ChairList")) return false;
    
    // ALWAYS reload fresh from manager to see current status
    var chairsList;
    try {
        chairsList = JSON.parse(managerData.get("ChairList"));
    } catch(e) {
        return false;
    }
    
    if(!Array.isArray(chairsList) || chairsList.length === 0) return false;
    if(myChairIndex < 0 || myChairIndex >= chairsList.length) return false;
    
    var myChair = chairsList[myChairIndex];
    
    // Check if:
    // 1. Chair is no longer taken (freed by manager), OR
    // 2. Chair is taken but by someone else (shouldn't happen but just in case)
    var myId = getMyId(npc);
    if(!myChair.taken){
        return true; // Chair was freed
    }
    if(myChair.occupiedBy && myChair.occupiedBy !== myId){
        return true; // Someone else took it (shouldn't happen)
    }
    
    return false;
}

// Check if manager signaled job stop
function isJobStopped(managerNpc){
    if(!managerNpc) return false;
    
    var managerData = managerNpc.getStoreddata();
    if(managerData.has("JobStopped")){
        return managerData.get("JobStopped") === "true";
    }
    return false;
}

function tick(event){
    var npc = event.npc;
    var world = npc.getWorld();
    var api = event.API;

    if(!initialized){
        spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
        initialized = true;
    }

    // Find manager
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

    // Check if job was stopped by manager
    if(managerNpc && isJobStopped(managerNpc)){
        returningToSpawn = true;
        assignedChair = null;
        chairReached = false;
    }

    // Check GUI closed
    if(orderPlaced && !guiClosed && !assignedChair){
        try{
            var selfData = npc.getStoreddata();
            if(selfData.has("GuiClosed") && selfData.get("GuiClosed") === "true"){
                guiClosed = true;
                selfData.put("GuiClosed", "false"); // Clear it
            }
        }catch(e){}
    }

    // Check if our chair time expired
    if(assignedChair && chairReached && isMyChairExpired(npc, managerNpc)){
        returningToSpawn = true;
        assignedChair = null;
        chairReached = false;
        myChairIndex = -1;
    }

    // Return to spawn
    if(returningToSpawn){
        if(spawnPos){
            var dx = npc.getX() - spawnPos.x;
            var dy = npc.getY() - spawnPos.y;
            var dz = npc.getZ() - spawnPos.z;
            var distSq = dx*dx + dy*dy + dz*dz;
            
            npc.navigateTo(spawnPos.x, spawnPos.y, spawnPos.z, navigationSpeed);
            
            if(distSq < 2.0){
                npc.despawn();
            }
        } else {
            npc.despawn();
        }
        return;
    }

    // Wait at chair
    if(chairReached){
        return;
    }

    // Navigate to chair
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

    // Try to claim chair after GUI closed
    if(orderPlaced && guiClosed && !assignedChair && managerNpc){
        var claimed = tryClaimChair(npc, managerNpc);
        if(claimed){
            guiClosed = false; // Don't try again
        } else {
            // No chairs available
            npc.say("No chairs available, waiting at counter.");
            guiClosed = false; // Reset so player can try again by clicking
        }
    }

    // Walk to counter and order
    if(managerFound && counterPos && !orderPlaced){
        npc.navigateTo(counterPos.x, counterPos.y, counterPos.z, navigationSpeed);

        var dx = npc.getX() - counterPos.x;
        var dy = npc.getY() - counterPos.y;
        var dz = npc.getZ() - counterPos.z;

        if(dx*dx + dy*dy + dz*dz < 4){
            orderPlaced = true;

            if(menuItems.length > 0){
                orderedItems = [];
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

    var gui = api.createCustomGui(102, 120, 0, true, player);
    gui.addLabel(1, "Customer wants:", 10, 10, 150, 12);

    var slotX = 30;
    for(var i=0; i<3; i++){
        var slot = gui.addItemSlot(slotX + i*22, 35);
        if(orderedItems[i]){
            slot.setStack(orderedItems[i]);
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
    }catch(e){}
}
