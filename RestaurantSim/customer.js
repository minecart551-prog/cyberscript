var managerFound = false;
var menuItems = [];
var counterPos = null;
var navigationSpeed = 0.4;
var scanRadius = 16;
var orderPlaced = false;

var orderedItem = null; // IItemStack the customer chose

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

function tick(event){
    var npc = event.npc;
    var world = npc.getWorld();
    var api = event.API;

    // find manager once
    if(!managerFound){
        var nearby = world.getNearbyEntities(
            npc.getX(), npc.getY(), npc.getZ(),
            scanRadius, 2
        );

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

                managerFound = true;
                break;
            }
        }
    }

    // walk to counter and order
    if(managerFound && counterPos){
        npc.navigateTo(
            counterPos.x,
            counterPos.y,
            counterPos.z,
            navigationSpeed
        );

        if(!orderPlaced){
            var dx = npc.getX() - counterPos.x;
            var dy = npc.getY() - counterPos.y;
            var dz = npc.getZ() - counterPos.z;

            if(dx*dx + dy*dy + dz*dz < 4){
                orderPlaced = true;

                if(menuItems.length > 0){
                    var idx = Math.floor(Math.random() * menuItems.length);
                    var entry = menuItems[idx];

                    var nbt;
                    if(typeof entry === "string"){
                        nbt = api.stringToNbt(entry);
                    }else{
                        nbt = api.stringToNbt(JSON.stringify(entry));
                    }

                    orderedItem = world.createItemFromNbt(nbt);
                    npc.say("I've decided what to order.");
                }else{
                    npc.say("There's nothing on the menu!");
                }
            }
        }
    }
}

function interact(event){
    var player = event.player;
    var api = event.API;

    if(!orderedItem){
        player.message("This customer hasn't ordered yet.");
        return;
    }

    var gui = api.createCustomGui(101, 90, 0, true, player);
    gui.addLabel(1, "Customer wants:", 10, 10, 150, 12);

    var slot = gui.addItemSlot(35, 30);
    slot.setStack(orderedItem);

    player.showCustomGui(gui);
}
