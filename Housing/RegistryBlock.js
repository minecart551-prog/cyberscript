//KEY REGISTRATION BLOCK SCRIPT
// Works with regular item: lockandblock:key

var guiRef = null;
var lastBlock = null;
var lastAPI = null;

function interact(t){
    var player = t.player;
    var handItem = player.getMainhandItem();
    var worldData = t.block.world.getStoreddata();
    
    lastBlock = t.block;
    lastAPI = t.API;
    
    // Initialize world data
    if(!worldData.has("globalKeyList")){
        worldData.put("globalKeyList", JSON.stringify([]));
    }
    if(!worldData.has("doorPairingMap")){
        worldData.put("doorPairingMap", JSON.stringify({}));
    }
    if(!worldData.has("keyCounter")){
        worldData.put("keyCounter", "0");
    }
    
    var keyList = JSON.parse(worldData.get("globalKeyList"));
    var doorPairingMap = JSON.parse(worldData.get("doorPairingMap"));
    
    // Register key if holding one
    if(handItem && !handItem.isEmpty() && handItem.getName() == "lockandblock:key"){
        var keyName = handItem.getDisplayName();
        var itemNbt = handItem.getItemNbt();
        var existingKeyID = getKeyID(itemNbt);
        
        if(existingKeyID){
            // Key already registered
            player.message("§eThis key is already registered!");
            player.message("§eKey ID: §f" + existingKeyID);
            
            // Update name in list if changed
            updateKeyInList(keyList, existingKeyID, keyName, doorPairingMap);
            worldData.put("globalKeyList", JSON.stringify(keyList));
            
            renderKeyListGUI(player, lastAPI);
            return;
        }
        
        // Generate new sequential ID
        var keyCounter = parseInt(worldData.get("keyCounter"));
        keyCounter++;
        var keyID = keyCounter.toString();
        worldData.put("keyCounter", keyCounter.toString());
        
        // Create new key with ID in NBT
        var nbtObj = itemNbt ? JSON.parse(cleanNbtJson(itemNbt.toJsonString())) : {id:"lockandblock:key", Count:1};
        if(!nbtObj.tag) nbtObj.tag = {};
        nbtObj.tag.RegisteredKeyID = keyID;
        nbtObj.Count = 1;
        
        var newKey = player.world.createItemFromNbt(t.API.stringToNbt(JSON.stringify(nbtObj)));
        player.setMainhandItem(newKey);
        
        player.message("§aAssigned Key ID: §f" + keyID);
        player.message("§aKey registered: §f" + keyName);
        
        // Add to key list
        keyList.push({name: keyName, id: keyID, doorCoord: doorPairingMap[keyID] || null});
        worldData.put("globalKeyList", JSON.stringify(keyList));
    }
    
    renderKeyListGUI(player, lastAPI);
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

function updateKeyInList(keyList, keyID, keyName, doorPairingMap){
    for(var i = 0; i < keyList.length; i++){
        if(keyList[i].id == keyID){
            keyList[i].name = keyName;
            keyList[i].doorCoord = doorPairingMap[keyID] || null;
            return;
        }
    }
    // If not found, add it
    keyList.push({name: keyName, id: keyID, doorCoord: doorPairingMap[keyID] || null});
}

function cleanNbtJson(nbtString){
    if(!nbtString) return "{}";
    return nbtString.replace(/:\s*(-?\d+)[bBsSlLfFdD]/g, ": $1")
                    .replace(/:\s*(-?\d+\.\d+)[fFdD]/g, ": $1");
}

function renderKeyListGUI(player, api){
    var worldData = player.world.getStoreddata();
    var keyList = JSON.parse(worldData.get("globalKeyList"));
    
    guiRef = api.createCustomGui(300, 220, 0, false, player);
    
    guiRef.addLabel(0, "§l§nRegistered Keys", 10, 5, 1.0, 1.0);
    
    if(keyList.length == 0){
        guiRef.addLabel(3, "§7No keys registered yet", 10, 25, 1.0, 1.0);
    } else {
        var yPos = 25;
        var displayLimit = Math.min(keyList.length, 9);
        
        for(var i = 0; i < displayLimit; i++){
            var key = keyList[i];
            var doorText = key.doorCoord ? "§7Door: §f" + key.doorCoord : "§7Door: §cNot paired";
            
            guiRef.addButton(100 + i, "§cX", 10, yPos, 15, 15);
            guiRef.addLabel(10 + i, "§e" + key.name + " §7(ID: " + key.id + ")", 30, yPos, 0.7, 0.7);
            guiRef.addLabel(30 + i, doorText, 30, yPos + 8, 0.6, 0.6);
            yPos += 20;
        }
        
        if(keyList.length > 9){
            guiRef.addLabel(100, "§7... and " + (keyList.length - 9) + " more", 30, yPos, 0.7, 0.7);
        }
    }
    
    guiRef.addButton(1, "Close", 235, 195, 50, 20);
    guiRef.addButton(2, "§cDelete All", 10, 195, 70, 20);
    
    player.showCustomGui(guiRef);
}

function deleteKey(keyIndex, player, api){
    var worldData = player.world.getStoreddata();
    var keyList = JSON.parse(worldData.get("globalKeyList"));
    
    if(keyIndex < keyList.length){
        var deletedKey = keyList[keyIndex];
        var keyID = deletedKey.id;
        
        // Remove key from list
        keyList.splice(keyIndex, 1);
        worldData.put("globalKeyList", JSON.stringify(keyList));
        
        // Remove door pairing for this key
        var doorPairingMap = JSON.parse(worldData.get("doorPairingMap"));
        delete doorPairingMap[keyID];
        worldData.put("doorPairingMap", JSON.stringify(doorPairingMap));
        
        player.message("§cDeleted key: §f" + deletedKey.name + " §7(ID: " + keyID + ")");
        
        // Re-render GUI with updated list
        renderKeyListGUI(player, api);
    }
}

function customGuiButton(t){
    var player = t.player;
    
    if(t.buttonId == 1){
        player.closeGui();
        guiRef = null;
        return;
    }
    
    if(t.buttonId == 2){
        // Delete all data button
        var worldData = player.world.getStoreddata();
        worldData.put("globalKeyList", JSON.stringify([]));
        worldData.put("doorPairingMap", JSON.stringify({}));
        worldData.put("keyCounter", "0");
        
        player.message("§c§lAll key and door data has been deleted!");
        
        renderKeyListGUI(player, lastAPI);
        return;
    }
    
    if(t.buttonId >= 100 && t.buttonId < 200){
        var keyIndex = t.buttonId - 100;
        deleteKey(keyIndex, player, lastAPI);
    }
}

function customGuiClosed(t){
    guiRef = null;
}
