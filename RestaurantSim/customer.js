var managerFound = false;
var menuItems = [];
var counterPos = null;
var navigationSpeed = 0.4;
var scanRadius = 16;
var orderPlaced = false;

var orderedItems = []; // array of IItemStack (max 3)
var assignedChair = null;
var chairReached = false;
var chairWaitTimer = 0;
var spawnPos = null; // where customer returns after sitting
var chairAssignedFromList = false; // ensures we only pick chair after GUI
var chairList = []; // list of chairs coordinates from manager (objects {x,y,z})
var guiClosed = false; // tracks if GUI has been closed by the player

function parseCoords(str){
    if(!str) return null;
    var p = str.split(/[ ,]+/);
    if(p.length < 3) return null;
    var x = parseFloat(p[0]);
    var y = parseFloat(p[1]);
    var z = parseFloat(p[2]);
    if(isNaN(x) || isNaN(y) || isNaN(z)) return null;
    return {x:x, y:y, z:z};
}

// tick
function tick(event){
    var npc = event.npc;
    var world = npc.getWorld();
    var api = event.API;

    // pick up assigned chair from manager if available
    try{
        var selfData = npc.getStoreddata();
        if(!assignedChair && selfData.has("AssignedChair")){
            var ac = parseCoords(selfData.get("AssignedChair"));
            if(ac){
                assignedChair = ac;
                chairAssignedFromList = true;
                // spawnPos fallback
                if(selfData.has("CustomerSpawn")){
                    spawnPos = parseCoords(selfData.get("CustomerSpawn"));
                } else {
                    spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
                }
                npc.say("Assigned chair at: " + assignedChair.x + " " + assignedChair.y + " " + assignedChair.z);
            }
        }
    }catch(e){}

    // find manager each tick to get menu and chair updates
    var nearby = world.getNearbyEntities(
        npc.getX(), npc.getY(), npc.getZ(),
        scanRadius, 2
    );

    var foundManager = false;
    var managerData = null;
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

            if(data.has("ChairList")){
                try{
                    var parsed = JSON.parse(data.get("ChairList"));
                    if(Array.isArray(parsed)) chairList = parsed.slice();
                }catch(e){
                    chairList = [];
                }
            }

            foundManager = true;
            managerData = data;
            break;
        }
    }

    if(foundManager) managerFound = true;

    // walk to counter and order
    if(managerFound && counterPos && !orderPlaced){
        npc.navigateTo(
            counterPos.x,
            counterPos.y,
            counterPos.z,
            navigationSpeed
        );

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

    // assign chair after GUI closed and we don't already have one
    if(orderPlaced && guiClosed && !chairAssignedFromList && managerData){
        try{
            if(managerData.has("ChairList")){
                var mgrChairs = JSON.parse(managerData.get("ChairList"));
                for(var i=0;i<mgrChairs.length;i++){
                    var c = mgrChairs[i];
                    if(c && !c.taken){
                        assignedChair = {x:c.x, y:c.y, z:c.z};
                        chairAssignedFromList = true;
                        c.taken = true;
                        c.freeAt = (typeof managerData.get("ManagerJobClock") === "number" ? managerData.get("ManagerJobClock") : 0) + 30;
                        try{ managerData.put("ChairList", JSON.stringify(mgrChairs)); }catch(e){}
                        break;
                    }
                }
            }
        }catch(e){}

        // spawnPos
        try{
            if(managerData.has("CustomerSpawn")){
                spawnPos = parseCoords(managerData.get("CustomerSpawn"));
            } else {
                spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
            }
        }catch(e){
            spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
        }

        npc.say("Assigned chair at: " + (assignedChair ? assignedChair.x + " " + assignedChair.y + " " + assignedChair.z : "none"));
        guiClosed = false;
    }

    // move to chair if assigned
    if(orderPlaced && assignedChair && !chairReached){
        npc.navigateTo(assignedChair.x, assignedChair.y, assignedChair.z, navigationSpeed);
        var ddx = npc.getX() - assignedChair.x;
        var ddy = npc.getY() - assignedChair.y;
        var ddz = npc.getZ() - assignedChair.z;

        if(ddx*ddx + ddy*ddy + ddz*ddz < 1){
            chairReached = true;
            chairWaitTimer = 0;
            npc.say("Sitting at my chair now.");
        }
    }

    // wait until manager frees chair, then go to spawn and despawn
    if(chairReached){
        chairWaitTimer += 1/20; // local counter (optional)
        var freeTimeReached = false;

        try{
            if(managerData && managerData.has("ChairList")){
                var mgrChairs = JSON.parse(managerData.get("ChairList"));
                for(var i=0;i<mgrChairs.length;i++){
                    var c = mgrChairs[i];
                    if(c && assignedChair && c.x === assignedChair.x && c.y === assignedChair.y && c.z === assignedChair.z){
                        if(!c.taken){
                            freeTimeReached = true;
                            break;
                        }
                    }
                }
            }
        }catch(e){ freeTimeReached = true; }

        // fallback: also free after 30s locally
        if(freeTimeReached || chairWaitTimer >= 30){
            if(spawnPos){
                npc.navigateTo(spawnPos.x, spawnPos.y, spawnPos.z, navigationSpeed);
                var dx2 = npc.getX() - spawnPos.x;
                var dy2 = npc.getY() - spawnPos.y;
                var dz2 = npc.getZ() - spawnPos.z;
                if(dx2*dx2 + dy2*dy2 + dz2*dz2 < 1){
                    npc.remove();
                }
            } else {
                npc.despawn();
            }
        }
    }
}

// player interaction: show customer's order GUI
function interact(event){
    var player = event.player;
    var api = event.API;

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
        npc = event.npc;
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
