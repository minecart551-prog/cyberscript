// Range check radius
var RANGE = 8;

// Storage key so each player only triggers once
var TOURTAG = "tourGuideTriggered";

// Coordinates + tab + clone name for spawnClone
var CLONE_X = 2325;
var CLONE_Y = -48;
var CLONE_Z = 855;
var CLONE_TAB = 3;
var CLONE_NAME = "Tour Guide";

function tick(event) {
    var block = event.block;
    var world = block.getWorld();

    // Get all players near the block
    var players = world.getNearbyEntities(block.getPos(), RANGE, 1); // 1 = players
    for (var i = 0; i < players.length; i++) {
        var player = players[i];

        // Check if this player already triggered
        if (player.storeddata.get(TOURTAG) == 1) {
            continue;
        }

        // Check if "Tour Guide" NPC already exists in range
        var npcs = world.getNearbyEntities(block.getPos(), RANGE, 2); // 2 = NPCs
        var found = false;
        for (var j = 0; j < npcs.length; j++) {
            if (npcs[j].getName() == CLONE_NAME) {
                found = true;
                break;
            }
        }

        // If not found, spawn the clone
        if (!found) {
            world.spawnClone(CLONE_X, CLONE_Y, CLONE_Z, CLONE_TAB, CLONE_NAME);
        }

        // Mark player as triggered so it won’t repeat
        player.storeddata.put(TOURTAG, 1);
    }
}
