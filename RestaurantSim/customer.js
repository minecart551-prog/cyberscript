var managerFound = false;
var menuItems = [];
var counterPos = null;
var navigationSpeed = 0.4;
var scanRadius = 16;
var orderPlaced = false; // track if the NPC has ordered

function parseCoords(str){
    if(!str) return null;
    var parts = str.split(/[ ,]+/);
    if(parts.length < 3) return null;
    var x = parseFloat(parts[0]);
    var y = parseFloat(parts[1]);
    var z = parseFloat(parts[2]);
    if(isNaN(x) || isNaN(y) || isNaN(z)) return null;
    return {x:x, y:y, z:z};
}

function tick(event){
    var npc = event.npc;
    var world = npc.getWorld();

    // find manager
    if(!managerFound){
        var nearby = world.getNearbyEntities(npc.getX(), npc.getY(), npc.getZ(), scanRadius, 2);
        for(var i=0;i<nearby.length;i++){
            var other = nearby[i];
            if(!other || !other.getName) continue;
            if(other.getName() === "Manager"){
                var data = other.getStoreddata();

                if(data.has("RestaurantMenu")){
                    try{ menuItems = JSON.parse(data.get("RestaurantMenu")); }catch(e){ menuItems = []; }
                }

                if(data.has("CounterPos")){
                    try{
                        counterPos = parseCoords(data.get("CounterPos"));
                    }catch(e){ counterPos = null; }
                }

                managerFound = true;
                break;
            }
        }
    }

    // navigate to counter and place order
    if(managerFound && counterPos){
        npc.navigateTo(counterPos.x, counterPos.y, counterPos.z, navigationSpeed);

        if(!orderPlaced){
            var dx = npc.getX() - counterPos.x;
            var dy = npc.getY() - counterPos.y;
            var dz = npc.getZ() - counterPos.z;
            var distSq = dx*dx + dy*dy + dz*dz;

            if(distSq < 2*2){ // within 2 blocks
                orderPlaced = true;
                if(menuItems.length > 0){
                    // pick random item name from menu
                    var idx = Math.floor(Math.random() * menuItems.length);
                    var itemName = menuItems[idx];
                    npc.say("I want " + itemName + "!");
                }else{
                    npc.say("I want something from the menu!");
                }
            }
        }
    }
}
