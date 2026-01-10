//DOOR SCRIPT - Works with lockandblock:key
// Uses coordinate-based pairing (no data stored on door)

var lockpick = "minecraft:stick";
var TimeOpen = 40; // ticks
var LockpickChance = 0.1;

function interact(t){
    t.setCanceled(true);
    
    if(t.block.getOpen()) return;
    
    var player = t.player;
    var item = player.getMainhandItem();
    var worldData = t.block.world.getStoreddata();
    var doorCoord = getDoorCoord(t.block.getPos());
    
    // Handle key interaction
    if(item && !item.isEmpty() && item.getName() == "lockandblock:key"){
        handleKeyInteraction(t, player, item, worldData, doorCoord);
        return;
    }
    
    // Handle lockpick
    if(item && !item.isEmpty() && item.getName() == lockpick && item.getDisplayName() == '"Lockpick"'){
        handleLockpick(t, item);
        return;
    }
    
    // Admin bedrock tool - show/reset pairing
    if(item && !item.isEmpty() && item.getName() == "minecraft:bedrock"){
        handleAdminTool(t, player, worldData, doorCoord);
    }
}

function handleKeyInteraction(t, player, item, worldData, doorCoord){
    var keyID = getKeyID(item.getItemNbt());
    
    // If key is not registered, register it now
    if(!keyID){
        keyID = registerNewKey(t, player, item, worldData);
        if(!keyID) return; // Registration failed
    }
    
    // Initialize door pairing if needed
    if(!worldData.has("doorPairingMap")){
        worldData.put("doorPairingMap", JSON.stringify({}));
    }
    
    var doorPairingMap = JSON.parse(worldData.get("doorPairingMap"));
    var pairedKeyID = findPairedKey(doorPairingMap, doorCoord);
    
    // If door not paired, pair it with this key
    if(!pairedKeyID){
        doorPairingMap[keyID] = doorCoord;
        worldData.put("doorPairingMap", JSON.stringify(doorPairingMap));
        updateKeyListDoorCoord(worldData, keyID, doorCoord);
        
        player.message("§aDoor paired with key: §f" + item.getDisplayName());
        player.message("§7Door Location: " + doorCoord);
        openDoor(t.block);
        return;
    }
    
    // Check if key matches
    if(pairedKeyID == keyID){
        openDoor(t.block);
        player.message("§aKey matches! Door opened.");
    } else {
        player.message("§cThis key doesn't match this door!");
        player.message("§7This door is paired with another key");
    }
}

function handleLockpick(t, item){
    if(Math.random() >= LockpickChance){
        item.setStackSize(item.getStackSize() - 1);
        t.block.world.playSoundAt(t.player.getPos(), "minecraft:entity.item.break", 1, 1);
        t.player.message("§cLockpick broke!");
        return;
    }
    
    t.block.setOpen(true);
    t.block.timers.forceStart(1, TimeOpen * 3, false);
    t.player.message("§aLockpicked successfully!");
}

function handleAdminTool(t, player, worldData, doorCoord){
    if(!worldData.has("doorPairingMap")){
        player.message("§7Door is not paired - Location: " + doorCoord);
        return;
    }
    
    var doorPairingMap = JSON.parse(worldData.get("doorPairingMap"));
    var pairedKey = findPairedKey(doorPairingMap, doorCoord);
    
    if(!pairedKey){
        player.message("§7Door is not paired - Location: " + doorCoord);
        return;
    }
    
    player.message("§e=== Door Info ===");
    player.message("§aLocation: §f" + doorCoord);
    player.message("§aPaired Key ID: §f" + pairedKey);
    player.message("§7Sneak + Right-click to unpair");
    
    if(player.isSneaking()){
        delete doorPairingMap[pairedKey];
        worldData.put("doorPairingMap", JSON.stringify(doorPairingMap));
        updateKeyListDoorCoord(worldData, pairedKey, null);
        player.message("§cDoor unpaired! Next key will pair with it.");
    }
}

function getKeyID(itemNbt){
    if(!itemNbt) return null;
    try {
        var nbtObj = JSON.parse(cleanNbtJson(itemNbt.toJsonString()));
        return nbtObj.tag && nbtObj.tag.RegisteredKeyID ? nbtObj.tag.RegisteredKeyID : null;
    } catch(e) {
        return null;
    }
}

function getDoorCoord(pos){
    return pos.getX() + "," + pos.getY() + "," + pos.getZ();
}

function findPairedKey(doorPairingMap, doorCoord){
    for(var keyID in doorPairingMap){
        if(doorPairingMap[keyID] == doorCoord){
            return keyID;
        }
    }
    return null;
}

function updateKeyListDoorCoord(worldData, keyID, doorCoord){
    if(!worldData.has("globalKeyList")) return;
    
    var keyList = JSON.parse(worldData.get("globalKeyList"));
    for(var i = 0; i < keyList.length; i++){
        if(keyList[i].id == keyID){
            keyList[i].doorCoord = doorCoord;
            worldData.put("globalKeyList", JSON.stringify(keyList));
            return;
        }
    }
}

function openDoor(block){
    block.setOpen(true);
    block.timers.forceStart(1, TimeOpen, false);
}

function cleanNbtJson(nbtString){
    if(!nbtString) return "{}";
    return nbtString.replace(/:\s*(-?\d+)[bBsSlLfFdD]/g, ": $1")
                    .replace(/:\s*(-?\d+\.\d+)[fFdD]/g, ": $1");
}

function registerNewKey(t, player, item, worldData){
    // Initialize counter if needed
    if(!worldData.has("keyCounter")){
        worldData.put("keyCounter", "0");
    }
    
    // Generate new sequential ID
    var keyCounter = parseInt(worldData.get("keyCounter"));
    keyCounter++;
    var keyID = keyCounter.toString();
    worldData.put("keyCounter", keyCounter.toString());
    
    // Create new key with ID in NBT
    var itemNbt = item.getItemNbt();
    var nbtObj = itemNbt ? JSON.parse(cleanNbtJson(itemNbt.toJsonString())) : {id:"lockandblock:key", Count:1};
    if(!nbtObj.tag) nbtObj.tag = {};
    nbtObj.tag.RegisteredKeyID = keyID;
    nbtObj.Count = 1;
    
    var newKey = player.world.createItemFromNbt(t.API.stringToNbt(JSON.stringify(nbtObj)));
    player.setMainhandItem(newKey);
    
    player.message("§aKey auto-registered! ID: §f" + keyID);
    
    // Add to global key list
    if(!worldData.has("globalKeyList")){
        worldData.put("globalKeyList", JSON.stringify([]));
    }
    
    var keyList = JSON.parse(worldData.get("globalKeyList"));
    keyList.push({name: item.getDisplayName(), id: keyID, doorCoord: null});
    worldData.put("globalKeyList", JSON.stringify(keyList));
    
    return keyID;
}

function timer(t){
    if(t.id == 1){
        t.block.setOpen(false);
    }
}
