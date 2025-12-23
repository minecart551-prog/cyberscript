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
var chairRequested = false;
var guiClosed = false;
var initialized = false;
var returningToSpawn = false;

function parseCoords(str){
    if(!str) return null;
    
    // Try parsing as JSON first (manager sends JSON)
    try {
        var obj = JSON.parse(str);
        if(obj && typeof obj.x === "number" && typeof obj.y === "number" && typeof obj.z === "number"){
            return {x: obj.x, y: obj.y, z: obj.z};
        }
    } catch(e) {}
    
    // Fallback: parse as space-separated numbers
    var p = str.split(/[ ,]+/);
    if(p.length < 3) return null;
    var x = parseFloat(p[0]), y = parseFloat(p[1]), z = parseFloat(p[2]);
    if(isNaN(x) || isNaN(y) || isNaN(z)) return null;
    return {x:x, y:y, z:z};
}

function init(event){
    var npc = event.npc;
    var selfData = npc.getStoreddata();
    
    // Clear old session data
    selfData.put("AssignedChair", "");
    selfData.put("RequestChair", "false");
    selfData.put("Leave", "false");
    selfData.put("GuiClosed", "false");
    selfData.put("AssignedByManager", "false");
    
    // Save spawn position
    spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
    initialized = true;
}

function tick(event){
    var npc = event.npc;
    var world = npc.getWorld();
    var api = event.API;
    var selfData = npc.getStoreddata();

    // Initialize on first tick
    if(!initialized){
        selfData.put("AssignedChair", "");
        selfData.put("RequestChair", "false");
        selfData.put("Leave", "false");
        selfData.put("GuiClosed", "false");
        spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
        initialized = true;
    }

    // Check GUI closed via storeddata
    if(orderPlaced && !guiClosed && !chairRequested){
        try{
            if(selfData.has("GuiClosed") && selfData.get("GuiClosed") === "true"){
                guiClosed = true;
            }
        }catch(e){}
    }

    // Check for Leave flag
    try{
        if(selfData.has("Leave") && selfData.get("Leave") === "true"){
            if(!returningToSpawn){
                returningToSpawn = true;
                selfData.put("Leave", "false");
            }
        }
    }catch(e){}

    // Return to spawn
    if(returningToSpawn){
        if(spawnPos){
            var dx = npc.getX() - spawnPos.x;
            var dy = npc.getY() - spawnPos.y;
            var dz = npc.getZ() - spawnPos.z;
            var distSq = dx*dx + dy*dy + dz*dz;
            
            npc.navigateTo(spawnPos.x, spawnPos.y, spawnPos.z, navigationSpeed);
            
            if(distSq < 1.0){
                npc.despawn();
            }
        } else {
            npc.despawn();
        }
        return;
    }

    // Check for chair assignment
    try{
        if(!assignedChair && chairRequested && selfData.has("AssignedChair") && selfData.get("AssignedChair") !== ""){
            var chairStr = selfData.get("AssignedChair");
            var ac = parseCoords(chairStr);
            if(ac){
                assignedChair = ac;
            }
        }
    }catch(e){}

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

    // Find manager
    var nearby = world.getNearbyEntities(npc.getX(), npc.getY(), npc.getZ(), scanRadius, 2);
    var foundManager = false;
    
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

            foundManager = true;
            break;
        }
    }

    if(foundManager) managerFound = true;

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

    // Request chair after GUI closed
    if(orderPlaced && guiClosed && !chairRequested && !assignedChair){
        try{
            selfData.put("RequestChair", "true");
            chairRequested = true;
            guiClosed = false;
        }catch(e){}
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

    try{
        if(npc){
            npc.getStoreddata().put("GuiOpenedByPlayer", player.getName());
        }
    }catch(e){}

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
