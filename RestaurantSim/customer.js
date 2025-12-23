var managerFound = false;
var menuItems = [];
var counterPos = null;
var navigationSpeed = 0.4;
var scanRadius = 16;
var orderPlaced = false;

var orderedItems = []; // array of IItemStack (max 3)
var assignedChair = null;
var chairReached = false;
var spawnPos = null;
var chairRequested = false;
var guiClosed = false;
var initialized = false;

function parseCoords(str){
    if(!str) return null;
    
    // Try parsing as JSON first (manager sends JSON)
    try {
        var obj = JSON.parse(str);
        if(obj && typeof obj.x === "number" && typeof obj.y === "number" && typeof obj.z === "number"){
            return {x: obj.x, y: obj.y, z: obj.z};
        }
    } catch(e) {
        // Not JSON, try space-separated format
    }
    
    // Fallback: parse as space-separated numbers
    var p = str.split(/[ ,]+/);
    if(p.length < 3) return null;
    var x = parseFloat(p[0]);
    var y = parseFloat(p[1]);
    var z = parseFloat(p[2]);
    if(isNaN(x) || isNaN(y) || isNaN(z)) return null;
    return {x:x, y:y, z:z};
}

// Initialize customer - clear old session data and save spawn position
function init(event){
    var npc = event.npc;
    var selfData = npc.getStoreddata();
    
    // Clear any old chair assignments from previous sessions
    selfData.put("AssignedChair", "");
    selfData.put("RequestChair", "false");
    selfData.put("Leave", "false");
    selfData.put("GuiClosed", "false");
    selfData.put("AssignedByManager", "false");
    
    // Save the ACTUAL spawn position (where customer spawned)
    spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
    
    initialized = true;
}

// tick
function tick(event){
    var npc = event.npc;
    var world = npc.getWorld();
    var api = event.API;
    var selfData = npc.getStoreddata();

    // Initialize on first tick if not already done
    if(!initialized){
        // Clear old data
        selfData.put("AssignedChair", "");
        selfData.put("RequestChair", "false");
        selfData.put("Leave", "false");
        selfData.put("GuiClosed", "false");
        
        // Save ACTUAL spawn position
        spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
        
        initialized = true;
    }

    // Check if GUI was closed via storeddata
    if(orderPlaced && !guiClosed && !chairRequested){
        try{
            if(selfData.has("GuiClosed") && selfData.get("GuiClosed") === "true"){
                guiClosed = true;
            }
        }catch(e){}
    }

    // Check for Leave flag - return to spawn point
    try{
        if(selfData.has("Leave") && selfData.get("Leave") === "true"){
            npc.say("Time's up! Heading back to spawn...");
            selfData.put("Leave", "false");
            
            if(spawnPos){
                npc.navigateTo(spawnPos.x, spawnPos.y, spawnPos.z, navigationSpeed);
                var dx2 = npc.getX() - spawnPos.x;
                var dy2 = npc.getY() - spawnPos.y;
                var dz2 = npc.getZ() - spawnPos.z;
                var distSqToSpawn = dx2*dx2 + dy2*dy2 + dz2*dz2;
                var distToSpawn = Math.sqrt(distSqToSpawn);
                
                // Show distance to spawn every second
                if(world.getTotalTime() % 20 === 0){
                    npc.say("Returning to spawn, distance: " + distToSpawn.toFixed(1));
                }
                
                // More forgiving distance check (within 3 blocks)
                if(distSqToSpawn < 9){
                    npc.say("Reached spawn point, despawning now!");
                    npc.despawn();
                }
            } else {
                npc.say("No spawn point saved, despawning immediately.");
                npc.despawn();
            }
            return;
        }
    }catch(e){}

    // Check for chair assignment EVERY TICK (but only AFTER we've ordered and GUI closed)
    try{
        if(!assignedChair && chairRequested && selfData.has("AssignedChair") && selfData.get("AssignedChair") !== ""){
            var chairStr = selfData.get("AssignedChair");
            var ac = parseCoords(chairStr);
            if(ac){
                assignedChair = ac;
                npc.say("Got my chair assignment! Going to: " + assignedChair.x + " " + assignedChair.y + " " + assignedChair.z);
            }
        }
    }catch(e){}

    // If sitting at chair, just wait
    if(chairReached){
        return;
    }

    // If we have chair, navigate to it
    if(assignedChair){
        var ddx = npc.getX() - assignedChair.x;
        var ddy = npc.getY() - assignedChair.y;
        var ddz = npc.getZ() - assignedChair.z;
        var distSq = ddx*ddx + ddy*ddy + ddz*ddz;
        var dist = Math.sqrt(distSq);
        
        // Say distance every 20 ticks
        if(world.getTotalTime() % 20 === 0){
            npc.say("Walking to chair, distance: " + dist.toFixed(1));
        }

        npc.navigateTo(assignedChair.x, assignedChair.y, assignedChair.z, navigationSpeed);

        if(distSq < 2.0){
            chairReached = true;
            npc.say("Sitting at my chair now.");
        }
        return;
    }

    // Find manager
    var nearby = world.getNearbyEntities(npc.getX(), npc.getY(), npc.getZ(), scanRadius, 2);
    var foundManager = false;
    
    for(var i=0;i<nearby.length;i++){
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
                npc.say("I've decided what to order.");
            }else{
                npc.say("There's nothing on the menu!");
            }
        }
    }

    // Request chair after GUI closed
    if(orderPlaced && guiClosed && !chairRequested && !assignedChair){
        try{
            selfData.put("RequestChair", "true");
            chairRequested = true;
            guiClosed = false;
            
            npc.say("Requesting a chair from manager...");
        }catch(e){}
    }
}

// player interaction: show customer's order GUI
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

// customGuiClosed should be called when the player closes the GUI
function customGuiClosed(event){
    try{
        guiClosed = true;
        if(event.npc){
            event.npc.getStoreddata().put("GuiClosed", "true");
        }
    }catch(e){}
}
