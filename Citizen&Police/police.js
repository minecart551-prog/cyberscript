var NpcFOV = 100;
var TeleportDestination = [-200, -60, 114];

// Track which player is being chased
var chasingTarget = null;

// Keep track so we don't scan a player more than once per detection
var scannedPlayers = {};

function init(e) {
    // Default melee range
    e.npc.getStats().getRanged().setMeleeRange(4);
}

function tick(e) {
    var npc = e.npc;

    // If not chasing, scan for new players
    if (chasingTarget == null) {
        var ents = npc.world.getNearbyEntities(npc.getPos(), npc.stats.getAggroRange(), 1); // 1 = players
        for (var i = 0; i < ents.length; i++) {
            var player = ents[i];

            if (CheckFOV(npc, player, NpcFOV) && npc.canSeeEntity(player)) {
                if (!scannedPlayers[player.getUUID()]) {
                    scannedPlayers[player.getUUID()] = true;

                    // Check if player has sugar
                    var sugarItem = npc.world.createItem("minecraft:sugar", 1);
                    var sugarCount = player.getInventory().count(sugarItem, true, true);

                    if (sugarCount > 0) {
                        player.message("§e[Scanner] NPC detected sugar in your inventory!");
                        npc.say("I see sugar...");
                        chasingTarget = player;

                        // Start chase (non-aggressive at first)
                        npc.getAi().setWalkingSpeed(5);
                    }
                }
            }
        }
    } else {
        // Already chasing a target
        if (!chasingTarget.isAlive()) {
            resetChase(npc, chasingTarget);
            return;
        }

        var pos = chasingTarget.getPos();
        npc.navigateTo(pos.getX(), pos.getY(), pos.getZ(), 10);

        var dist = npc.getPos().distanceTo(pos);

        // Condition 1: too far away (stop chasing)
        if (dist > 30) {
            npc.say("Lost sight of " + chasingTarget.getName() + "...");
            resetChase(npc, chasingTarget);
            return;
        }

        // Condition 2: close enough → turn aggressive
        if (dist < 4) {
  
            npc.setAttackTarget(chasingTarget); // turn aggressive now
        }
    }
}

// On melee attack, teleport the player + remove sugar
function meleeAttack(e) {
    var player = e.target;
    var npc = e.npc;

    player.setPosition(TeleportDestination[0], TeleportDestination[1], TeleportDestination[2]);
    npc.say("Teleporting " + player.getName() + "!");

    // Remove all sugar from player
    var inv = player.getInventory();
    var size = inv.getSize();
    for (var slot = 0; slot < size; slot++) {
        var item = inv.getSlot(slot);
        if (item != null && item.getName() == "minecraft:sugar") {
            inv.setSlot(slot, null); // clear sugar slot
        }
    }
    player.message("§c[Scanner] All your sugar has been confiscated!");

    resetChase(npc, player);
}

// Reset chase state
function resetChase(npc, player) {
    npc.getAi().setWalkingSpeed(5);
    if (player) {
        scannedPlayers[player.getUUID()] = false; // allow re-scan later
    }
    chasingTarget = null;
}

// --- Helper: Check FOV ---
function CheckFOV(seer, seen, FOV) {
    var P = seer.getRotation();
    if (P < 0) P = P + 360;
    var rot = Math.abs(GetPlayerRotation(seer, seen) - P);
    if (rot > 180) rot = Math.abs(rot - 360);
    return (rot < FOV / 2);
}

function GetPlayerRotation(npc, player) {
    var dx = npc.getX() - player.getX();
    var dz = player.getZ() - npc.getZ();
    var angle;
    if (dz >= 0) {
        angle = (Math.atan(dx / dz) * 180 / Math.PI);
        if (angle < 0) angle = 360 + angle;
    } else {
        dz = -dz;
        angle = 180 - (Math.atan(dx / dz) * 180 / Math.PI);
    }
    return angle;
}
