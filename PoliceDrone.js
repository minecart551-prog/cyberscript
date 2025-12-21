// ===============================
// Drone: Protect Follower Owner
// - Works when owner attacks first
// - Works when a mob/NPC targets owner first
// - Avoids calling missing methods on non-living entities
// ===============================

var RANGE = 100;          // how far around the OWNER to watch
var ATTACK_DURATION = 200; // ticks to stay engaged after last trigger

var lastOwnerAttackTime = 0; // tracks owner's last attack timestamp we have processed
var engageUntil = 0;         // world time until which we keep engaging
var currentTargetId = null;  // UUID of the target we set

// --- little helpers that won't crash on weird entities ---
function hasFunc(o, name){
    try { return o && typeof o[name] === "function"; } catch(e){ return false; }
}
function getUUIDSafe(e){
    try { return e ? e.getUUID() : null; } catch(e){ return null; }
}
function isAliveEntity(e){
    try { return e && hasFunc(e, "getHealth") && e.getHealth() > 0; } catch(e){ return false; }
}

function init(event){
    var npc = event.npc;
    if (npc.role == null){
        npc.say("This NPC isn't a follower. Set Role -> Follower to enable protection.");
        return;
    }
    // Initialize stored owner marker if not set
    if (npc.role.getFollowing() == null){
        npc.storeddata.put("OwnerName", 0);
        npc.storeddata.put("OwnerUUID", 0);
    }else{
        var owner = npc.role.getFollowing();
        npc.storeddata.put("OwnerName", owner.getName());
        npc.storeddata.put("OwnerUUID", owner.getUUID());
        npc.say("New Owner: " + owner.getName());
    }
}

function tick(event){
    var npc = event.npc;
    var world = npc.getWorld();
    var worldTime = world.getTime();

    // --- verify follower role & owner ---
    if (npc.role == null){
        return; // not a follower, nothing to do
    }
    var owner = npc.role.getFollowing();
    if (owner == null){
        // lost owner; clear state
        npc.storeddata.put("OwnerName", 0);
        npc.storeddata.put("OwnerUUID", 0);
        // drop target if any
        var cur = npc.getAttackTarget();
        if (cur) npc.setAttackTarget(null);
        currentTargetId = null;
        return;
    }

    // --- ensure stored owner is up-to-date ---
    if (npc.storeddata.get("OwnerUUID") !== owner.getUUID()){
        npc.storeddata.put("OwnerName", owner.getName());
        npc.storeddata.put("OwnerUUID", owner.getUUID());
        npc.say("New Owner: " + owner.getName());
    }

    // --- if our current target is dead, gone, or too old -> disengage ---
    var curTarget = npc.getAttackTarget();
    if (curTarget && !isAliveEntity(curTarget)){
        npc.setAttackTarget(null);
        currentTargetId = null;
    }
    if (engageUntil > 0 && worldTime > engageUntil){
        // timeout; only disengage if owner isn't clearly still in danger
        npc.setAttackTarget(null);
        currentTargetId = null;
        engageUntil = 0;
    }

    // ===========================================
    // 1) Owner attacked someone -> help the owner
    // ===========================================
    if (hasFunc(owner, "getLastAttackedTime") && hasFunc(owner, "getLastAttacked")){
        var oat = owner.getLastAttackedTime();
        if (oat > lastOwnerAttackTime){
            var tgt = owner.getLastAttacked();
            // Some entities may be null or non-living; guard it
            if (tgt && isAliveEntity(tgt)){
                // Engage this target
                npc.setAttackTarget(tgt);
                currentTargetId = getUUIDSafe(tgt);
                engageUntil = worldTime + ATTACK_DURATION;
                // Optional bark:
                // npc.say("Drone: Assisting owner vs " + tgt.getName() + ".");
            }
            lastOwnerAttackTime = oat;
        }
    }

    // =======================================================
    // 2) Something is targeting the owner -> defend the owner
    //    We look for living entities whose attack target is the owner.
    //    (This works for NPCs and most mobs; safe-guarded for others.)
    // =======================================================
    // Only scan when not already engaged or to possibly switch targets if a new attacker appears
    var needScan = (npc.getAttackTarget() == null) || (worldTime + 10 > engageUntil); // allow refresh near timeout
    if (needScan){
        // Scan around the OWNER (not the drone), so protection is centered on the player
        var nearby = world.getNearbyEntities(owner.getPos(), RANGE, -1); // -1 = all entities
        if (nearby && nearby.length){
            for (var i=0; i<nearby.length; i++){
                var e = nearby[i];
                if (!e) continue;

                // skip owner, skip the drone itself
                var eId = getUUIDSafe(e);
                if (eId == null) continue;
                if (eId === owner.getUUID()) continue;
                if (eId === npc.getUUID()) continue;

                // Only consider living entities (mobs/NPCs/players) to avoid items, projectiles, etc.
                if (!isAliveEntity(e)) continue;

                // If the entity can report an attack target, see if it's the owner
                if (hasFunc(e, "getAttackTarget")){
                    try{
                        var atkTgt = e.getAttackTarget();
                        if (atkTgt && getUUIDSafe(atkTgt) === owner.getUUID()){
                            // DEFEND THE OWNER
                            // If we already target this exact entity, just extend the timer; otherwise switch.
                            if (currentTargetId !== eId){
                                npc.setAttackTarget(e);
                                currentTargetId = eId;
                                // npc.say("Drone: Defending owner from " + e.getName() + ".");
                            }
                            engageUntil = worldTime + ATTACK_DURATION;
                            break; // good enough for this tick
                        }
                    }catch(ignored){}
                }
            }
        }
    }

    // --- Final housekeeping: if we have a target but it's outside protection range from owner, drop it ---
    var t = npc.getAttackTarget();
    if (t){
        // If target wandered far beyond owner area, stop
        // Use another scan to ensure we are still inside OWNER radius
        var stillNear = world.getNearbyEntities(owner.getPos(), RANGE, -1);
        var seen = false;
        if (stillNear && stillNear.length){
            for (var j=0;j<stillNear.length;j++){
                if (getUUIDSafe(stillNear[j]) === getUUIDSafe(t)){ seen = true; break; }
            }
        }
        if (!seen){
            npc.setAttackTarget(null);
            currentTargetId = null;
        }
    }
}
