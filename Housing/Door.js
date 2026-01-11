//DOOR SCRIPT - Works with lockandblock:key
// Uses merged keyRegistry structure

function interact(t){
    t.setCanceled(true);
    
    var player = t.player;
    var item = player.getMainhandItem();
    var worldData = t.block.world.getStoreddata();
    var doorCoord = getDoorCoord(t.block.getPos());
    
    // Handle key interaction
    if(item && !item.isEmpty() && item.getName() == "lockandblock:key"){
        handleKeyInteraction(t, player, item, worldData, doorCoord);
        return;
    }
    
    // Admin bedrock tool - show/reset pairing
    if(item && !item.isEmpty() && item.getName() == "minecraft:bedrock"){
        handleAdminTool(t, player, worldData, doorCoord);
    }
}

function handleKeyInteraction(t, player, item, worldData, doorCoord){
    var keyID = getKeyID(item.getItemNbt());
    
    if(!keyID){
        keyID = registerNewKey(t, player, item, worldData);
        if(!keyID) return;
    }
    
    // Initialize registry if needed
    if(!worldData.has("keyRegistry")){
        worldData.put("keyRegistry", JSON.stringify({}));
    }
    
    var keyRegistry = JSON.parse(worldData.get("keyRegistry"));
    
    // Check if key exists in registry
    if(!keyRegistry[keyID]){
        player.message("§cThis key is not registered!");
        player.message("§7Please register it at a Key Registration Block first.");
        return;
    }
    
    // Find which key (if any) is paired with this door
    var pairedKeyID = findPairedKey(keyRegistry, doorCoord);
    
    // If door not paired, pair it with this key
    if(!pairedKeyID){
        keyRegistry[keyID].doorCoord = doorCoord;
        worldData.put("keyRegistry", JSON.stringify(keyRegistry));
        
        player.message("§aDoor paired with key: §f" + item.getDisplayName());
        player.message("§7Door Location: " + doorCoord);
        toggleDoor(t.block);
        return;
    }
    
    // Check if key matches
    if(pairedKeyID == keyID){
        toggleDoor(t.block);
        player.message("§aKey matches! Door toggled.");
    } else {
        player.message("§cThis key doesn't match this door!");
        player.message("§7This door is paired with Key ID: " + pairedKeyID);
    }
}

function handleAdminTool(t, player, worldData, doorCoord){
    if(!worldData.has("keyRegistry")){
        player.message("§7Door is not paired - Location: " + doorCoord);
        return;
    }
    
    var keyRegistry = JSON.parse(worldData.get("keyRegistry"));
    var pairedKey = findPairedKey(keyRegistry, doorCoord);
    
    if(!pairedKey){
        player.message("§7Door is not paired - Location: " + doorCoord);
        return;
    }
    
    player.message("§e=== Door Info ===");
    player.message("§aLocation: §f" + doorCoord);
    player.message("§aPaired Key ID: §f" + pairedKey);
    player.message("§aKey Name: §f" + keyRegistry[pairedKey].name);
    player.message("§7Sneak + Right-click to unpair");
    
    if(player.isSneaking()){
        keyRegistry[pairedKey].doorCoord = null;
        worldData.put("keyRegistry", JSON.stringify(keyRegistry));
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

function cleanNbtJson(nbtString){
    if(!nbtString) return "{}";
    return nbtString.replace(/:\s*(-?\d+)[bBsSlLfFdD]/g, ": $1")
                    .replace(/:\s*(-?\d+\.\d+)[fFdD]/g, ": $1");
}

function getDoorCoord(pos){
    return pos.getX() + "," + pos.getY() + "," + pos.getZ();
}

function findPairedKey(keyRegistry, doorCoord){
    for(var keyID in keyRegistry){
        if(keyRegistry[keyID].doorCoord == doorCoord){
            return keyID;
        }
    }
    return null;
}

function toggleDoor(block){
    block.setOpen(!block.getOpen());
}

function registerNewKey(t, player, item, worldData){
    // Initialize counter if needed
    if(!worldData.has("keyCounter")){
        worldData.put("keyCounter", "0");
    }
    
    // Generate new sequential ID
    var keyCounter = parseInt(worldData.get("keyCounter")) + 1;
    var keyID = keyCounter.toString();
    worldData.put("keyCounter", keyID);
    
    // Create new key with ID in NBT
    var itemNbt = item.getItemNbt();
    var nbtObj = itemNbt ? JSON.parse(cleanNbtJson(itemNbt.toJsonString())) : {id:"lockandblock:key", Count:1};
    if(!nbtObj.tag) nbtObj.tag = {};
    nbtObj.tag.RegisteredKeyID = keyID;
    nbtObj.Count = 1;
    
    var newKey = player.world.createItemFromNbt(t.API.stringToNbt(JSON.stringify(nbtObj)));
    player.setMainhandItem(newKey);
    
    player.message("§aKey auto-registered! ID: §f" + keyID);
    
    // Add to merged registry
    if(!worldData.has("keyRegistry")){
        worldData.put("keyRegistry", JSON.stringify({}));
    }
    
    var keyRegistry = JSON.parse(worldData.get("keyRegistry"));
    keyRegistry[keyID] = {
        name: item.getDisplayName(),
        id: keyID,
        doorCoord: null
    };
    worldData.put("keyRegistry", JSON.stringify(keyRegistry));
    
    return keyID;
}

function timer(t){
    if(t.id == 1){
        t.block.setOpen(false);
    }
}
