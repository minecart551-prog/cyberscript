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

// pick a free chair from manager-provided chairList (array of {x,y,z,...})
function pickChairFromList(npc, mgrChairArray){
    if(chairAssignedFromList) return null;
    if(!Array.isArray(mgrChairArray) || mgrChairArray.length === 0) return null;

    // build local list of coords
    chairList = [];
    for(var i=0;i<mgrChairArray.length;i++){
        var c = mgrChairArray[i];
        if(c && typeof c.x === "number" && typeof c.y === "number" && typeof c.z === "number"){
            chairList.push({x:c.x, y:c.y, z:c.z});
        }
    }
    if(chairList.length === 0) return null;

    // choose a random chair (no global locking here)
    var pick = chairList[Math.floor(Math.random()*chairList.length)];
    chairAssignedFromList = true;
    assignedChair = pick;

    // store AssignedChair on this NPC so manager/others can see it
    try{
        var selfData = npc.getStoreddata();
        selfData.put("AssignedChair", JSON.stringify(assignedChair));
    }catch(e){}

    // determine spawnPos
    try{
        var selfData2 = npc.getStoreddata();
        if(selfData2.has("CustomerSpawn")){
            spawnPos = parseCoords(selfData2.get("CustomerSpawn"));
        } else {
            spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
        }
    }catch(e){
        spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
    }

    npc.say("Assigned chair at: " + assignedChair.x + " " + assignedChair.y + " " + assignedChair.z);
    guiClosed = false; // consume the guiClosed event

    return assignedChair;
}

// tick
function tick(event){
    var npc = event.npc;
    var world = npc.getWorld();
    var api = event.API;

    // if manager previously assigned the chair into this NPC's own storeddata, pick it up
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

    // find manager each tick (also to pick up menu updates)
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

            // if manager has a persistent ChairList (JSON array), keep a local copy
            if(data.has("ChairList")){
                try{
                    var parsed = JSON.parse(data.get("ChairList"));
                    // ensure format is array of plain objects
                    if(Array.isArray(parsed)) chairList = parsed.slice();
                }catch(e){
                    chairList = [];
                }
            } else if(data.has("ChairListText")){
                // fallback: if manager kept raw text, parse it
                try{
                    var txt = data.get("ChairListText");
                    var parsedText = txt.split(",");
                    var tmp = [];
                    for(var j=0;j<parsedText.length;j++){
                        var c = parseCoords(parsedText[j].trim());
                        if(c) tmp.push(c);
                    }
                    if(tmp.length>0) chairList = tmp;
                }catch(e){ }
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

                // random count: 1–3
                var orderCount = 1 + Math.floor(Math.random() * 3);

                for(var k=0; k<orderCount; k++){
                    var idx = Math.floor(Math.random() * menuItems.length);
                    var entry = menuItems[idx];

                    var nbt;
                    if(typeof entry === "string"){
                        // entry is full-NBT JSON string
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
        // try to pick from manager's chairList (parsed earlier)
        if(Array.isArray(chairList) && chairList.length>0){
            // pick a free chair (no global lock; manager may also mark taken)
            var pick = chairList[Math.floor(Math.random()*chairList.length)];
            if(pick){
                assignedChair = {x:pick.x, y:pick.y, z:pick.z};
                chairAssignedFromList = true;
                // persist this assignment on the customer so manager / others can read it
                try{
                    npc.getStoreddata().put("AssignedChair", JSON.stringify(assignedChair));
                }catch(e){}
                // spawnPos: prefer manager's CustomerSpawn if present
                try{
                    if(managerData.has("CustomerSpawn")){
                        spawnPos = parseCoords(managerData.get("CustomerSpawn"));
                    } else {
                        spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
                    }
                }catch(e){
                    spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
                }

                npc.say("Assigned chair at: " + assignedChair.x + " " + assignedChair.y + " " + assignedChair.z);
            }
        } else {
            // fallback - if manager had ChairListText, pick from there
            try{
                if(managerData && managerData.has("ChairListText")){
                    var txt = managerData.get("ChairListText");
                    var parts = txt.split(",");
                    var tmp = [];
                    for(var j=0;j<parts.length;j++){
                        var c = parseCoords(parts[j].trim());
                        if(c) tmp.push(c);
                    }
                    if(tmp.length>0){
                        var pick2 = tmp[Math.floor(Math.random()*tmp.length)];
                        assignedChair = pick2;
                        chairAssignedFromList = true;
                        try{ npc.getStoreddata().put("AssignedChair", JSON.stringify(assignedChair)); }catch(e){}
                        if(managerData.has("CustomerSpawn")) spawnPos = parseCoords(managerData.get("CustomerSpawn"));
                        else spawnPos = {x: npc.getX(), y: npc.getY(), z: npc.getZ()};
                        npc.say("Assigned chair at: " + assignedChair.x + " " + assignedChair.y + " " + assignedChair.z);
                    }
                }
            }catch(e){}
        }
        guiClosed = false; // consume
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

    // wait 30 seconds then go to spawn and despawn
    if(chairReached){
        chairWaitTimer += 1/20;
        if(chairWaitTimer >= 30){
            if(spawnPos){
                npc.navigateTo(spawnPos.x, spawnPos.y, spawnPos.z, navigationSpeed);
                var dx2 = npc.getX() - spawnPos.x;
                var dy2 = npc.getY() - spawnPos.y;
                var dz2 = npc.getZ() - spawnPos.z;
                if(dx2*dx2 + dy2*dy2 + dz2*dz2 < 1){
                    npc.remove();
                }
            } else {
                npc.remove();
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

    // mark that the GUI is open for this customer (helps in edge cases)
    try{
        npc = event.npc;
        if(npc){
            npc.getStoreddata().put("GuiOpenedByPlayer", player.getName());
        }
    }catch(e){}

    player.showCustomGui(gui);
}

// customGuiClosed should be called when the player closes the GUI for this NPC.
// Set guiClosed so the tick() will proceed to assign a chair.
function customGuiClosed(event){
    // if engine supplies event.npc as the NPC owning the GUI, set guiClosed directly
    try{
        if(event.npc && event.npc.getName && event.npc.getName() === (event.npc.getName() || event.npc.getName())){
            guiClosed = true;
            // persist a small flag on the NPC too
            try{ event.npc.getStoreddata().put("GuiClosed", "true"); }catch(e){}
            return;
        }
    }catch(e){}

    // fallback: if event.player is provided, mark nearby customer (within 8 blocks) that match this script
    try{
        var player = event.player;
        if(player){
            var world = player.world;
            var near = world.getNearbyEntities(player.getX(), player.getY(), player.getZ(), 8, 2);
            for(var i=0;i<near.length;i++){
                var other = near[i];
                try{
                    if(!other || !other.getName) continue;
                    if(other.getName() === "customer"){
                        // set local flag on that NPC's storeddata; the customer's own tick will pick it up via guiClosed variable being global in its context
                        other.getStoreddata().put("GuiClosed", "true");
                    }
                }catch(e){}
            }
            // also set our local flag (best-effort)
            guiClosed = true;
        }
    }catch(e){}
}
