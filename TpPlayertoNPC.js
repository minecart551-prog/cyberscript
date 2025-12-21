var TP_DISTANCE = 5; // distance threshold

function tick(event){
    var npc = event.npc;
    var world = npc.getWorld();
    var npcPos = npc.getPos();

    // Get all players in the world
    var players = world.getNearbyEntities(npcPos, 50, 1); // 1 = players only, 50 = max scan range
    if(!players) return;

    for(var i = 0; i < players.length; i++){
        var p = players[i];
        var px = p.getX();
        var py = p.getY();
        var pz = p.getZ();

        var dx = npc.getX() - px;
        var dy = npc.getY() - py;
        var dz = npc.getZ() - pz;

        var distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

        if(distance > TP_DISTANCE){
            // teleport player to NPC's position
            p.setPos(npc.getPos());
            world.broadcast("Teleported " + p.getName() + " to NPC!");
        }
    }
}
