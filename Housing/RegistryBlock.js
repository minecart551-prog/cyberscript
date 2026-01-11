//KEY REGISTRATION BLOCK SCRIPT
// Works with regular item: lockandblock:key

var guiRef = null;
var lastBlock = null;
var lastAPI = null;
var searchQuery = "";

function interact(t){
    var player = t.player;
    var handItem = player.getMainhandItem();
    var worldData = t.block.world.getStoreddata();
    
    lastBlock = t.block;
    lastAPI = t.API;
    
    // Initialize world data
    if(!worldData.has("globalKeyList")) worldData.put("globalKeyList", JSON.stringify([]));
    if(!worldData.has("doorPairingMap")) worldData.put("doorPairingMap", JSON.stringify({}));
    if(!worldData.has("keyCounter")) worldData.put("keyCounter", "0");
    
    var keyList = JSON.parse(worldData.get("globalKeyList"));
    var doorPairingMap = JSON.parse(worldData.get("doorPairingMap"));
    
    // Register key if holding one
    if(handItem && !handItem.isEmpty() && handItem.getName() == "lockandblock:key"){
        var keyName = handItem.getDisplayName();
        var existingKeyID = getKeyID(handItem.getItemNbt());
        
        if(existingKeyID){
            player.message("§cThis key is already registered!");
            player.message("§eKey ID: §f" + existingKeyID);
            // Don't open GUI, just reject
            return;
        }
        
        // Generate new sequential ID and create key
        var keyCounter = parseInt(worldData.get("keyCounter")) + 1;
        var keyID = keyCounter.toString();
        worldData.put("keyCounter", keyID);
        
        var itemNbt = handItem.getItemNbt();
        var nbtObj = itemNbt ? JSON.parse(cleanNbtJson(itemNbt.toJsonString())) : {id:"lockandblock:key", Count:1};
        if(!nbtObj.tag) nbtObj.tag = {};
        nbtObj.tag.RegisteredKeyID = keyID;
        nbtObj.Count = 1;
        
        player.setMainhandItem(player.world.createItemFromNbt(t.API.stringToNbt(JSON.stringify(nbtObj))));
        
        player.message("§aAssigned Key ID: §f" + keyID);
        player.message("§aKey registered: §f" + keyName);
        
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
    
    // Filter keys based on search query
    var filteredKeys = keyList;
    if(searchQuery && searchQuery.length > 0){
        var lowerQuery = searchQuery.toLowerCase();
        filteredKeys = [];
        for(var i = 0; i < keyList.length; i++){
            if(keyList[i].name.toLowerCase().indexOf(lowerQuery) !== -1){
                filteredKeys.push(keyList[i]);
            }
        }
    }
    
    guiRef = api.createCustomGui(300, 220, 0, false, player);
    
    guiRef.addLabel(0, "§l§nRegistered Keys", 10, -115, 1.0, 1.0);
    guiRef.addLabel(4, "Search:", 10, -100, 1.0, 1.0);
    guiRef.addTextField(5, 50, -100, 100, 18).setText(searchQuery);
    guiRef.addButton(6, "Go", 155, -100, 30, 18);
    
    if(filteredKeys.length == 0){
        var message = searchQuery ? "§7No keys found matching '" + searchQuery + "'" : "§7No keys registered yet";
        guiRef.addLabel(3, message, 10, -75, 1.0, 1.0);
    } else {
        var yPos = -75;
        var displayLimit = Math.min(filteredKeys.length, 8);
        
        for(var i = 0; i < displayLimit; i++){
            var key = filteredKeys[i];
            var doorText = key.doorCoord ? "§7Door: §f" + key.doorCoord : "§7Door: §cNot paired";
            
            // Find original index in full keyList for deletion
            var originalIndex = -1;
            for(var j = 0; j < keyList.length; j++){
                if(keyList[j].id == key.id){
                    originalIndex = j;
                    break;
                }
            }
            
            guiRef.addButton(100 + originalIndex, "§cX", 10, yPos, 15, 15);
            guiRef.addLabel(10 + i, "§e" + key.name + " §7(ID: " + key.id + ")", 30, yPos, 0.7, 0.7);
            guiRef.addLabel(30 + i, doorText, 30, yPos + 8, 0.6, 0.6);
            yPos += 20;
        }
        
        if(filteredKeys.length > 8){
            guiRef.addLabel(100, "§7... and " + (filteredKeys.length - 8) + " more", 30, yPos, 0.7, 0.7);
        }
    }
    
    guiRef.addButton(1, "Close", 235, 75, 50, 20);
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
        
        // Re-render GUI with updated list (keep search query)
        renderKeyListGUI(player, api);
    }
}

function customGuiButton(t){
    var player = t.player;
    
    if(t.buttonId == 1){
        player.closeGui();
        guiRef = null;
        searchQuery = "";
        return;
    }
    
    if(t.buttonId == 6){
        // Search button
        var gui = t.gui;
        if(gui){
            var searchField = gui.getComponent(5);
            if(searchField){
                searchQuery = searchField.getText();
                renderKeyListGUI(player, lastAPI);
            }
        }
        return;
    }
    
    if(t.buttonId >= 100 && t.buttonId < 200){
        // Before deleting, preserve the current search query from the text field
        var gui = t.gui;
        if(gui){
            var searchField = gui.getComponent(5);
            if(searchField){
                searchQuery = searchField.getText();
            }
        }
        
        var keyIndex = t.buttonId - 100;
        deleteKey(keyIndex, player, lastAPI);
    }
}

function customGuiClosed(t){
    guiRef = null;
    searchQuery = "";
}
