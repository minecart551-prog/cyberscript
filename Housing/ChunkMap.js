var CHUNK_BUY_PRIM_PRICE = 1;
var CHUNK_BUY_SEC_PRICE = 50;
var CHUNK_SELL_PERCENTAGE = 1;

var CURRENCY_PRIMARY_ITEM = "coins:emerald_coin";
var CURRENCY_SECONDARY_ITEM = "coins:coal_coin";
var CURRENCY_CONVERSION_RATE = 100;

var PROTECTED_AREAS = [ 626 -8 2078
   {minX: 626, minZ: 93, maxX: 3187, maxZ: -1294, name: "Linefield City"},
   {minX: 1839, minZ: 93, maxX: 3187, maxZ: 2264, name: "Linefield City"}
];

var guiRef;
var mySlots = [];
var selectedChunks = [];
var slotHighlights = {};
var viewportRows = 8;
var viewportCols = 18;

var WORLD_MIN_X = 626;
var WORLD_MIN_Z = 93;
var WORLD_MAX_X = 1839;
var WORLD_MAX_Z = 2264;

var minChunkX = 0;
var minChunkZ = 0;
var mapCols = 0;
var mapRows = 0;

var slotSize = 18;
var slotPadding = 0;
var offsetX = -80;
var offsetY = 10;
var lastBlock = null;
var nextLineId = 1000;

var viewportX = 0;
var viewportY = 0;

var Grid_GUI = 100;
var ID_CLEAR_BUTTON = 50;
var ID_UP_BUTTON = 51;
var ID_DOWN_BUTTON = 52;
var ID_LEFT_BUTTON = 53;
var ID_RIGHT_BUTTON = 54;
var ID_CHUNK_INFO_LABEL = 55;
var ID_SEARCH_FIELD = 56;
var ID_SEARCH_BUTTON = 57;
var ID_CLAIM_BUTTON = 58;
var ID_SELL_BUTTON = 59;
var ID_PRICE_BUTTON = 60;
var ID_COAL_PRICE_SLOT = 61;
var ID_STONE_PRICE_SLOT = 62;
var ID_TOTAL_LABEL = 63;
var ID_APPEARANCE_FIELD = 64;
var ID_APPEARANCE_BUTTON = 65;

var currentChunkInfo = "";

var CHUNK_PRIM_PRICE = CHUNK_BUY_PRIM_PRICE;
var CHUNK_SEC_PRICE = CHUNK_BUY_SEC_PRICE;

var coalPriceSlot = null;
var stonePriceSlot = null;

var showTotalPrice = false;
var priceCalculatedForChunkCount = 0;

var ALLOWED_ITEMS = [
    "oak_log", "oak_wood", "stripped_oak_log", "stripped_oak_wood", "oak_planks", "oak_stairs", "oak_slab", "oak_fence", "oak_fence_gate", "oak_door", "oak_trapdoor", "oak_pressure_plate", "oak_button",
    "spruce_log", "spruce_wood", "stripped_spruce_log", "stripped_spruce_wood", "spruce_planks", "spruce_stairs", "spruce_slab", "spruce_fence", "spruce_fence_gate", "spruce_door", "spruce_trapdoor", "spruce_pressure_plate", "spruce_button",
    "birch_log", "birch_wood", "stripped_birch_log", "stripped_birch_wood", "birch_planks", "birch_stairs", "birch_slab", "birch_fence", "birch_fence_gate", "birch_door", "birch_trapdoor", "birch_pressure_plate", "birch_button",
    "jungle_log", "jungle_wood", "stripped_jungle_log", "stripped_jungle_wood", "jungle_planks", "jungle_stairs", "jungle_slab", "jungle_fence", "jungle_fence_gate", "jungle_door", "jungle_trapdoor", "jungle_pressure_plate", "jungle_button",
    "acacia_log", "acacia_wood", "stripped_acacia_log", "stripped_acacia_wood", "acacia_planks", "acacia_stairs", "acacia_slab", "acacia_fence", "acacia_fence_gate", "acacia_door", "acacia_trapdoor", "acacia_pressure_plate", "acacia_button",
    "dark_oak_log", "dark_oak_wood", "stripped_dark_oak_log", "stripped_dark_oak_wood", "dark_oak_planks", "dark_oak_stairs", "dark_oak_slab", "dark_oak_fence", "dark_oak_fence_gate", "dark_oak_door", "dark_oak_trapdoor", "dark_oak_pressure_plate", "dark_oak_button",
    "mangrove_log", "mangrove_wood", "stripped_mangrove_log", "stripped_mangrove_wood", "mangrove_planks", "mangrove_stairs", "mangrove_slab", "mangrove_fence", "mangrove_fence_gate", "mangrove_door", "mangrove_trapdoor", "mangrove_pressure_plate", "mangrove_button",
    "cherry_log", "cherry_wood", "stripped_cherry_log", "stripped_cherry_wood", "cherry_planks", "cherry_stairs", "cherry_slab", "cherry_fence", "cherry_fence_gate", "cherry_door", "cherry_trapdoor", "cherry_pressure_plate", "cherry_button",
    "bamboo_block", "stripped_bamboo_block", "bamboo_planks", "bamboo_mosaic", "bamboo_stairs", "bamboo_mosaic_stairs", "bamboo_slab", "bamboo_mosaic_slab", "bamboo_fence", "bamboo_fence_gate", "bamboo_door", "bamboo_trapdoor", "bamboo_pressure_plate", "bamboo_button",
    "crimson_stem", "crimson_hyphae", "stripped_crimson_stem", "stripped_crimson_hyphae", "crimson_planks", "crimson_stairs", "crimson_slab", "crimson_fence", "crimson_fence_gate", "crimson_door", "crimson_trapdoor", "crimson_pressure_plate", "crimson_button",
    "warped_stem", "warped_hyphae", "stripped_warped_stem", "stripped_warped_hyphae", "warped_planks", "warped_stairs", "warped_slab", "warped_fence", "warped_fence_gate", "warped_door", "warped_trapdoor", "warped_pressure_plate", "warped_button",
    "stone", "stone_stairs", "stone_slab", "stone_pressure_plate", "stone_button", "cobblestone", "cobblestone_stairs", "cobblestone_slab", "cobblestone_wall", "mossy_cobblestone", "mossy_cobblestone_stairs", "mossy_cobblestone_slab", "mossy_cobblestone_wall",
    "smooth_stone", "smooth_stone_slab", "stone_bricks", "cracked_stone_bricks", "stone_brick_stairs", "stone_brick_slab", "stone_brick_wall", "chiseled_stone_bricks", "mossy_stone_bricks", "mossy_stone_brick_stairs", "mossy_stone_brick_wall",
    "white_wool", "orange_wool", "magenta_wool", "light_blue_wool", "yellow_wool", "lime_wool", "pink_wool", "gray_wool", "light_gray_wool", "cyan_wool", "purple_wool", "blue_wool", "brown_wool", "green_wool", "red_wool", "black_wool"
];

var GLOBAL_SELECTION_KEY = "chunkmap_selected";
var GLOBAL_CLAIMS_KEY = "chunkmap_claims";
var VIEWPORT_KEY_PREFIX = "chunkmap_viewport_";

function calculateChunkBoundaries() {
    minChunkX = Math.floor(WORLD_MIN_X / 16);
    minChunkZ = Math.floor(WORLD_MIN_Z / 16);
    var maxChunkX = Math.floor(WORLD_MAX_X / 16);
    var maxChunkZ = Math.floor(WORLD_MAX_Z / 16);
    
    mapCols = maxChunkX - minChunkX + 1;
    mapRows = maxChunkZ - minChunkZ + 1;
}

function init(e){
    calculateChunkBoundaries();
}

function interact(e) {
    var api = e.API;
    var p = e.player;
    
    calculateChunkBoundaries();
    lastBlock = e.block;
    openChunkMapGui(p, api);
}

function viewportToGlobal(slotIndex) {
    var localRow = Math.floor(slotIndex / viewportCols);
    var localCol = slotIndex % viewportCols;
    var globalRow = viewportY + localRow;
    var globalCol = viewportX + localCol;
    return globalRow * mapCols + globalCol;
}

function globalPosToChunkCoords(globalPos) {
    var relativeRow = Math.floor(globalPos / mapCols);
    var relativeCol = globalPos % mapCols;
    return {
        chunkX: minChunkX + relativeCol,
        chunkZ: minChunkZ + relativeRow
    };
}

function chunkCoordsToGlobalPos(chunkX, chunkZ) {
    if(chunkX < minChunkX || chunkX > minChunkX + mapCols - 1 || 
       chunkZ < minChunkZ || chunkZ > minChunkZ + mapRows - 1){
        return -1;
    }
    var relativeCol = chunkX - minChunkX;
    var relativeRow = chunkZ - minChunkZ;
    return relativeRow * mapCols + relativeCol;
}

function globalToViewport(globalPos) {
    var globalRow = Math.floor(globalPos / mapCols);
    var globalCol = globalPos % mapCols;
    
    if (globalRow >= viewportY && globalRow < viewportY + viewportRows &&
        globalCol >= viewportX && globalCol < viewportX + viewportCols) {
        var localRow = globalRow - viewportY;
        var localCol = globalCol - viewportX;
        return localRow * viewportCols + localCol;
    }
    return -1;
}

function getChunkItem(globalPos, W, claimedChunks) {
    var chunkCoords = globalPosToChunkCoords(globalPos);
    var protectedArea = isChunkProtected(chunkCoords.chunkX, chunkCoords.chunkZ);
    
    if(protectedArea){
        var barrierItem = W.createItem("minecraft:barrier", 1);
        barrierItem.setCustomName("§c" + protectedArea.name);
        return barrierItem.getItemNbt().toJsonString();
    } else {
        var key = "chunk_" + globalPos;
        return claimedChunks[key] || null;
    }
}

function openChunkMapGui(player, api){
    if(!lastBlock) return;
    var W = lastBlock.getWorld();
    var blockId = lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ();

    if(W.getStoreddata().has(GLOBAL_SELECTION_KEY)){
        try {
            var storedData = JSON.parse(W.getStoreddata().get(GLOBAL_SELECTION_KEY));
            selectedChunks = storedData;
        } catch(e) {
            selectedChunks = [];
        }
    } else {
        selectedChunks = [];
    }

    var viewportKey = VIEWPORT_KEY_PREFIX + blockId;
    if(W.getStoreddata().has(viewportKey)){
        try {
            var viewportData = JSON.parse(W.getStoreddata().get(viewportKey));
            viewportX = viewportData.x || 0;
            viewportY = viewportData.y || 0;
        } catch(e) {
            viewportX = 0;
            viewportY = 0;
        }
    } else {
        viewportX = 0;
        viewportY = 0;
    }

    renderChunkMapGui(player, api);
}

function renderChunkMapGui(player, api){
    if(!lastBlock) return;
    var W = lastBlock.getWorld();
    
    slotHighlights = {};
    nextLineId = 1000;
    
    guiRef = api.createCustomGui(Grid_GUI, 176, 166, false, player);
    mySlots = [];

    var claimedChunks = {};
    if(W.getStoreddata().has(GLOBAL_CLAIMS_KEY)){
        try {
            claimedChunks = JSON.parse(W.getStoreddata().get(GLOBAL_CLAIMS_KEY));
        } catch(e) {
            claimedChunks = {};
        }
    }

    for(var r=0; r<viewportRows; r++){
        for(var c=0; c<viewportCols; c++){
            var x = offsetX + c*(slotSize+slotPadding);
            var y = offsetY + r*(slotSize+slotPadding);
            var slot = guiRef.addItemSlot(x, y);
            
            var globalPos = (viewportY + r) * mapCols + (viewportX + c);
            var itemNbt = getChunkItem(globalPos, W, claimedChunks);
            
            if(itemNbt){
                try { 
                    slot.setStack(player.world.createItemFromNbt(api.stringToNbt(itemNbt))); 
                } catch(e){}
            }

            mySlots.push(slot);
        }
    }

    for(var i = 0; i < selectedChunks.length; i++){
        var chunk = selectedChunks[i];
        var globalPos = chunkCoordsToGlobalPos(chunk.chunkX, chunk.chunkZ);
        if(globalPos !== -1){
            var viewportIndex = globalToViewport(globalPos);
            if(viewportIndex !== -1){
                drawHighlight(viewportIndex);
            }
        }
    }

    var navY = 165;
    var navCenterX = 275;
    var btnSize = 20;
    var btnGap = 19;
    
    guiRef.addButton(ID_UP_BUTTON, "↑", navCenterX, navY - btnGap, btnSize, btnSize);
    guiRef.addButton(ID_DOWN_BUTTON, "↓", navCenterX, navY + btnGap, btnSize, btnSize);
    guiRef.addButton(ID_LEFT_BUTTON, "←", navCenterX - btnGap, navY, btnSize, btnSize);
    guiRef.addButton(ID_RIGHT_BUTTON, "→", navCenterX + btnGap, navY, btnSize, btnSize);
    
    guiRef.addButton(ID_CLEAR_BUTTON, "Clear", 158, -15, 40, 20);
    guiRef.addButton(ID_SELL_BUTTON, "Sell", 203, -15, 40, 20);
    guiRef.addButton(ID_PRICE_BUTTON, "Price", 248, -15, 40, 20);
    
    var priceX = 250;
    var priceY = 10;
    
    coalPriceSlot = guiRef.addItemSlot(priceX, priceY);
    stonePriceSlot = guiRef.addItemSlot(priceX, priceY + 20);
    
    if(showTotalPrice && selectedChunks.length > 0) {
        var totalChunks = selectedChunks.length;
        var totalPrim = CHUNK_PRIM_PRICE * totalChunks;
        var totalSec = CHUNK_SEC_PRICE * totalChunks;
        var totalInSec = (totalPrim * CURRENCY_CONVERSION_RATE) + totalSec;
        var finalPrim = Math.floor(totalInSec / CURRENCY_CONVERSION_RATE);
        var finalSec = totalInSec % CURRENCY_CONVERSION_RATE;
        
        if(finalPrim > 0) {
            var primCoin = player.world.createItem(CURRENCY_PRIMARY_ITEM, Math.min(finalPrim, 64));
            coalPriceSlot.setStack(primCoin);
        }
        
        if(finalSec > 0) {
            var secCoin = player.world.createItem(CURRENCY_SECONDARY_ITEM, Math.min(finalSec, 64));
            stonePriceSlot.setStack(secCoin);
        }
    }
    
    if(showTotalPrice && priceCalculatedForChunkCount === selectedChunks.length) {
        guiRef.addButton(ID_CLAIM_BUTTON, "Claim", priceX - 2, priceY + 42, 40, 20);
    }
    
    guiRef.addLabel(2, "§7Jump to X,Z:", -80, -32, 1.0, 1.0);
    guiRef.addTextField(ID_SEARCH_FIELD, -80, -20, 80, 18).setText("");
    guiRef.addButton(ID_SEARCH_BUTTON, "Go", 3, -20, 30, 18);
    
    var totalChunks = selectedChunks.length;
    guiRef.addLabel(ID_TOTAL_LABEL, "§7Selected: §6" + totalChunks + " §7chunks", 40, 160, 0.8, 0.8);
    
    if(currentChunkInfo){
        guiRef.addLabel(ID_CHUNK_INFO_LABEL, currentChunkInfo, -25, 195, 1.0, 1.0);
    } else {
        guiRef.addLabel(ID_CHUNK_INFO_LABEL, "§7Click a chunk to view coordinates", -25, 195, 1.0, 1.0);
    }
    
    guiRef.addLabel(3, "§7eg:melon", -150, 178, 0.8, 0.8);
    guiRef.addTextField(ID_APPEARANCE_FIELD, -150, 188, 80, 18).setText("");
    guiRef.addButton(ID_APPEARANCE_BUTTON, "→", -67, 188, 20, 18);

    player.showCustomGui(guiRef);
}

function drawHighlight(index) {
    if (!guiRef || slotHighlights[index]) return;
    
    var row = Math.floor(index / viewportCols);
    var col = index % viewportCols;
    var x = offsetX + col * (slotSize + slotPadding) - 1;
    var y = offsetY + row * (slotSize + slotPadding) - 1;
    var w = slotSize, h = slotSize;
    
    var inset = 2;
    slotHighlights[index] = [
        guiRef.addColoredLine(nextLineId++, x + inset, y + inset, x + w - inset, y + inset, 0xADD8E6, 2),
        guiRef.addColoredLine(nextLineId++, x + inset, y + h - inset, x + w - inset, y + h - inset, 0xADD8E6, 2),
        guiRef.addColoredLine(nextLineId++, x + inset, y + inset, x + inset, y + h - inset, 0xADD8E6, 2),
        guiRef.addColoredLine(nextLineId++, x + w - inset, y + inset, x + w - inset, y + h - inset, 0xADD8E6, 2)
    ];
}

function removeHighlight(index) {
    if (slotHighlights[index]) {
        for (var i = 0; i < slotHighlights[index].length; i++) {
            try {
                guiRef.removeComponent(slotHighlights[index][i]);
            } catch(e) {}
        }
        delete slotHighlights[index];
    }
}

function toggleHighlight(index, player, api) {
    if (!guiRef) return;
    
    var globalPos = viewportToGlobal(index);
    var chunk = globalPosToChunkCoords(globalPos);
    var chunkX = chunk.chunkX;
    var chunkZ = chunk.chunkZ;
    
    var protectedArea = isChunkProtected(chunkX, chunkZ);
    if(protectedArea){
        player.message("§cCannot select chunks in " + protectedArea.name + "!");
        return;
    }
    
    var minX = chunkX * 16;
    var minZ = chunkZ * 16;
    var maxX = minX + 15;
    var maxZ = minZ + 15;
    
    currentChunkInfo = "§6Chunk [" + chunkX + "," + chunkZ + "] §7→ Blocks: §f" + minX + "," + minZ + " §7to §f" + maxX + "," + maxZ;
    
    var existingIndex = -1;
    for(var i = 0; i < selectedChunks.length; i++){
        if(selectedChunks[i].chunkX === chunkX && selectedChunks[i].chunkZ === chunkZ){
            existingIndex = i;
            break;
        }
    }
    
    if (existingIndex !== -1) {
        selectedChunks.splice(existingIndex, 1);
        
        if(lastBlock){
            var W = lastBlock.getWorld();
            W.getStoreddata().put(GLOBAL_SELECTION_KEY, JSON.stringify(selectedChunks));
        }
        
        showTotalPrice = false;
        priceCalculatedForChunkCount = 0;
        
        renderChunkMapGui(player, api);
    } else {
        selectedChunks.push({chunkX: chunkX, chunkZ: chunkZ});
        
        if(lastBlock){
            var W = lastBlock.getWorld();
            W.getStoreddata().put(GLOBAL_SELECTION_KEY, JSON.stringify(selectedChunks));
        }
        
        var needsRecreate = showTotalPrice;
        
        showTotalPrice = false;
        priceCalculatedForChunkCount = 0;
        
        if(needsRecreate) {
            renderChunkMapGui(player, api);
        } else {
            drawHighlight(index);
            
            try {
                var label = guiRef.getComponent(ID_CHUNK_INFO_LABEL);
                if(label) label.setText(currentChunkInfo);
                
                var totalLabel = guiRef.getComponent(ID_TOTAL_LABEL);
                if(totalLabel) totalLabel.setText("§7Selected: §6" + selectedChunks.length + " §7chunks");
            } catch(e) {}
            
            if (guiRef) guiRef.update();
        }
    }
}

function saveViewportPosition(){
    if(!lastBlock) return;
    var W = lastBlock.getWorld();
    var blockId = lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ();
    var viewportKey = VIEWPORT_KEY_PREFIX + blockId;
    W.getStoreddata().put(viewportKey, JSON.stringify({x: viewportX, y: viewportY}));
}

function isChunkProtected(chunkX, chunkZ) {
    for(var i = 0; i < PROTECTED_AREAS.length; i++){
        var area = PROTECTED_AREAS[i];
        var minChunkX = Math.floor(area.minX / 16);
        var minChunkZ = Math.floor(area.minZ / 16);
        var maxChunkX = Math.floor(area.maxX / 16);
        var maxChunkZ = Math.floor(area.maxZ / 16);
        
        if(chunkX >= minChunkX && chunkX <= maxChunkX &&
           chunkZ >= minChunkZ && chunkZ <= maxChunkZ){
            return area;
        }
    }
    return null;
}

function hasClaimedChunksInSelection() {
    if(!lastBlock) return false;
    var W = lastBlock.getWorld();
    
    var claimedChunks = {};
    if(W.getStoreddata().has(GLOBAL_CLAIMS_KEY)){
        try {
            claimedChunks = JSON.parse(W.getStoreddata().get(GLOBAL_CLAIMS_KEY));
        } catch(e) {
            return false;
        }
    }
    
    for(var i = 0; i < selectedChunks.length; i++){
        var chunk = selectedChunks[i];
        var globalPos = chunkCoordsToGlobalPos(chunk.chunkX, chunk.chunkZ);
        
        if(globalPos !== -1){
            var key = "chunk_" + globalPos;
            if(claimedChunks[key]) {
                return true;
            }
        }
    }
    return false;
}

function hasEnoughCurrency(player, coalNeeded, stoneNeeded) {
    var coalCount = 0;
    var stoneCount = 0;
    
    var inv = player.getInventory();
    for(var i = 0; i < inv.getSize(); i++){
        var stack = inv.getSlot(i);
        if(stack){
            var itemName = stack.getName();
            
            if(itemName === CURRENCY_PRIMARY_ITEM){
                coalCount += stack.getStackSize();
            }
            if(itemName === CURRENCY_SECONDARY_ITEM){
                stoneCount += stack.getStackSize();
            }
        }
    }
    
    var totalStonePlayer = (coalCount * CURRENCY_CONVERSION_RATE) + stoneCount;
    var totalStoneNeeded = (coalNeeded * CURRENCY_CONVERSION_RATE) + stoneNeeded;
    
    return totalStonePlayer >= totalStoneNeeded;
}

function removeCurrency(player, coalNeeded, stoneNeeded) {
    var totalStoneNeeded = (coalNeeded * CURRENCY_CONVERSION_RATE) + stoneNeeded;
    var inv = player.getInventory();
    
    for(var i = 0; i < inv.getSize() && totalStoneNeeded > 0; i++){
        var stack = inv.getSlot(i);
        if(stack && stack.getName() === CURRENCY_SECONDARY_ITEM){
            var amount = stack.getStackSize();
            if(amount <= totalStoneNeeded){
                inv.setSlot(i, null);
                totalStoneNeeded -= amount;
            } else {
                stack.setStackSize(amount - totalStoneNeeded);
                totalStoneNeeded = 0;
            }
        }
    }
    
    for(var i = 0; i < inv.getSize() && totalStoneNeeded > 0; i++){
        var stack = inv.getSlot(i);
        if(stack && stack.getName() === CURRENCY_PRIMARY_ITEM){
            var amount = stack.getStackSize();
            var stoneValue = amount * CURRENCY_CONVERSION_RATE;
            
            if(stoneValue <= totalStoneNeeded){
                inv.setSlot(i, null);
                totalStoneNeeded -= stoneValue;
            } else {
                var coalsToRemove = Math.ceil(totalStoneNeeded / CURRENCY_CONVERSION_RATE);
                stack.setStackSize(amount - coalsToRemove);
                var overpaid = (coalsToRemove * CURRENCY_CONVERSION_RATE) - totalStoneNeeded;
                totalStoneNeeded = 0;
                
                if(overpaid > 0){
                    var changeItem = player.world.createItem(CURRENCY_SECONDARY_ITEM, overpaid);
                    player.giveItem(changeItem);
                }
            }
        }
    }
}

function claimSelectedChunks(player, api) {
    if(selectedChunks.length === 0) {
        player.message("§cNo chunks selected to claim!");
        return;
    }
    
    if(!lastBlock) return;
    var W = lastBlock.getWorld();
    
    var claimedChunks = {};
    if(W.getStoreddata().has(GLOBAL_CLAIMS_KEY)){
        try {
            claimedChunks = JSON.parse(W.getStoreddata().get(GLOBAL_CLAIMS_KEY));
        } catch(e) {
            claimedChunks = {};
        }
    }
    
    var defaultItem = W.createItem("minecraft:lime_wool", 1);
    defaultItem.setCustomName("§6" + player.getName());
    var defaultNbt = defaultItem.getItemNbt().toJsonString();
    
    var claimedCount = 0;
    var playerName = player.getName();
    
    api.executeCommand(W, "protect add " + playerName);
    api.executeCommand(W, "protect inclusion add " + playerName + " player " + playerName);
    
    for(var i = 0; i < selectedChunks.length; i++){
        var chunk = selectedChunks[i];
        var globalPos = chunkCoordsToGlobalPos(chunk.chunkX, chunk.chunkZ);
        
        if(globalPos !== -1){
            var key = "chunk_" + globalPos;
            claimedChunks[key] = defaultNbt;
            claimedCount++;
            
            var minX = chunk.chunkX * 16;
            var minZ = chunk.chunkZ * 16;
            var maxX = minX + 15;
            var maxZ = minZ + 15;
            
            var regionName = "chunk_" + chunk.chunkX + "_" + chunk.chunkZ;
            
            api.executeCommand(W, "protect shape start");
            api.executeCommand(W, "protect shape add " + minX + " -63 " + minZ + " " + maxX + " 139 " + maxZ);
            api.executeCommand(W, "protect shape finish " + regionName + " to " + playerName);
        }
    }
    
    W.getStoreddata().put(GLOBAL_CLAIMS_KEY, JSON.stringify(claimedChunks));
    
    player.message("§aClaimed " + claimedCount + " chunk(s)!");
    
    selectedChunks = [];
    W.getStoreddata().put(GLOBAL_SELECTION_KEY, JSON.stringify(selectedChunks));
    
    renderChunkMapGui(player, api);
}

function customGuiSlotClicked(e){
    var clickedSlot = e.slot;
    var player = e.player;
    var api = e.API;

    var slotIndex = mySlots.indexOf(clickedSlot);
    
    if(slotIndex === -1) return;
    
    toggleHighlight(slotIndex, player, api);
}

function customGuiButton(e){
    var player = e.player;
    var api = e.API;
    
    if(e.buttonId === ID_CLEAR_BUTTON){
        selectedChunks = [];
        
        if(lastBlock){
            var W = lastBlock.getWorld();
            W.getStoreddata().put(GLOBAL_SELECTION_KEY, JSON.stringify(selectedChunks));
        }
        
        showTotalPrice = false;
        priceCalculatedForChunkCount = 0;
        
        renderChunkMapGui(player, api);
    }
    
    if(e.buttonId === ID_CLAIM_BUTTON){
        if(hasClaimedChunksInSelection()) {
            player.message("§cChunk already claimed!");
            return;
        }
        
        for(var i = 0; i < selectedChunks.length; i++){
            var chunk = selectedChunks[i];
            var protectedArea = isChunkProtected(chunk.chunkX, chunk.chunkZ);
            if(protectedArea){
                player.message("§cCannot claim chunks in " + protectedArea.name + "!");
                return;
            }
        }
        
        var totalChunks = selectedChunks.length;
        var totalCoal = CHUNK_PRIM_PRICE * totalChunks;
        var totalStone = CHUNK_SEC_PRICE * totalChunks;
        
        var totalInStone = (totalCoal * CURRENCY_CONVERSION_RATE) + totalStone;
        var finalCoal = Math.floor(totalInStone / CURRENCY_CONVERSION_RATE);
        var finalStone = totalInStone % CURRENCY_CONVERSION_RATE;
        
        if(!hasEnoughCurrency(player, finalCoal, finalStone)){
            player.message("§cNot enough currency!");
            return;
        }
        
        removeCurrency(player, finalCoal, finalStone);
        claimSelectedChunks(player, api);
        
        showTotalPrice = false;
        priceCalculatedForChunkCount = 0;
    }
    
    if(e.buttonId === ID_SELL_BUTTON){
        if(selectedChunks.length === 0){
            player.message("§cNo chunks selected to sell!");
            return;
        }
        
        if(!lastBlock) return;
        var W = lastBlock.getWorld();
        
        var claimedChunks = {};
        if(W.getStoreddata().has(GLOBAL_CLAIMS_KEY)){
            try {
                claimedChunks = JSON.parse(W.getStoreddata().get(GLOBAL_CLAIMS_KEY));
            } catch(e) {
                claimedChunks = {};
            }
        }
        
        var soldCount = 0;
        var totalCoalReturn = 0;
        var totalStoneReturn = 0;
        
        for(var i = 0; i < selectedChunks.length; i++){
            var chunk = selectedChunks[i];
            var globalPos = chunkCoordsToGlobalPos(chunk.chunkX, chunk.chunkZ);
            
            if(globalPos !== -1){
                var key = "chunk_" + globalPos;
                if(claimedChunks[key]){
                    try {
                        var item = player.world.createItemFromNbt(api.stringToNbt(claimedChunks[key]));
                        var itemName = item.getDisplayName();
                        
                        if(itemName === "§6" + player.getName()){
                            delete claimedChunks[key];
                            
                            var regionName = "chunk_" + chunk.chunkX + "_" + chunk.chunkZ;
                            api.executeCommand(W, "protect shape remove " + regionName + " from " + player.getName());
                            
                            totalCoalReturn += CHUNK_PRIM_PRICE * CHUNK_SELL_PERCENTAGE;
                            totalStoneReturn += CHUNK_SEC_PRICE * CHUNK_SELL_PERCENTAGE;
                            soldCount++;
                        }
                    } catch(e){}
                }
            }
        }
        
        if(soldCount === 0){
            player.message("§cYou don't own any of the selected chunks!");
            return;
        }
        
        W.getStoreddata().put(GLOBAL_CLAIMS_KEY, JSON.stringify(claimedChunks));
        
        var totalInStone = (totalCoalReturn * CURRENCY_CONVERSION_RATE) + totalStoneReturn;
        var finalCoal = Math.floor(totalInStone / CURRENCY_CONVERSION_RATE);
        var finalStone = Math.floor(totalInStone % CURRENCY_CONVERSION_RATE);
        
        if(finalCoal > 0){
            var coalItem = player.world.createItem(CURRENCY_PRIMARY_ITEM, finalCoal);
            player.giveItem(coalItem);
        }
        
        if(finalStone > 0){
            var stoneItem = player.world.createItem(CURRENCY_SECONDARY_ITEM, finalStone);
            player.giveItem(stoneItem);
        }
        
        player.message("§aSold " + soldCount + " chunk(s) for " + finalCoal + " coal and " + finalStone + " stone!");
        
        showTotalPrice = false;
        priceCalculatedForChunkCount = 0;
        
        renderChunkMapGui(player, api);
    }
    
    if(e.buttonId === ID_PRICE_BUTTON){
        showTotalPrice = true;
        priceCalculatedForChunkCount = selectedChunks.length;
        renderChunkMapGui(player, api);
    }
    
    if(e.buttonId === ID_APPEARANCE_BUTTON){
        var gui = e.gui;
        var appearanceField = gui.getComponent(ID_APPEARANCE_FIELD);
        if(!appearanceField) return;
        
        var itemInput = appearanceField.getText().trim().toLowerCase();
        if(!itemInput) {
            player.message("§cPlease enter an item name (e.g., oak_log)");
            return;
        }
        
        if(selectedChunks.length === 0){
            player.message("§cNo chunks selected! Select chunks first.");
            return;
        }
        
        var isAllowed = false;
        for(var i = 0; i < ALLOWED_ITEMS.length; i++){
            if(ALLOWED_ITEMS[i] === itemInput){
                isAllowed = true;
                break;
            }
        }
        
        if(!isAllowed){
            player.message("§cItem '" + itemInput + "' is not allowed! Use items like: oak_log, stone, etc.");
            return;
        }
        
        var itemName = "minecraft:" + itemInput;
        
        if(!lastBlock) return;
        var W = lastBlock.getWorld();
        
        var claimedChunks = {};
        if(W.getStoreddata().has(GLOBAL_CLAIMS_KEY)){
            try {
                claimedChunks = JSON.parse(W.getStoreddata().get(GLOBAL_CLAIMS_KEY));
            } catch(e) {
                claimedChunks = {};
            }
        }
        
        var updatedCount = 0;
        for(var i = 0; i < selectedChunks.length; i++){
            var chunk = selectedChunks[i];
            var globalPos = chunkCoordsToGlobalPos(chunk.chunkX, chunk.chunkZ);
            
            if(globalPos !== -1){
                var key = "chunk_" + globalPos;
                if(claimedChunks[key]){
                    try {
                        var item = player.world.createItemFromNbt(api.stringToNbt(claimedChunks[key]));
                        var ownerName = item.getDisplayName();
                        
                        if(ownerName === "§6" + player.getName()) {
                            var newItem = W.createItem(itemName, 1);
                            newItem.setCustomName("§6" + player.getName());
                            claimedChunks[key] = newItem.getItemNbt().toJsonString();
                            updatedCount++;
                        }
                    } catch(e) {}
                }
            }
        }
        
        if(updatedCount === 0) {
            player.message("§cYou don't own any of the selected chunks!");
            return;
        }
        
        W.getStoreddata().put(GLOBAL_CLAIMS_KEY, JSON.stringify(claimedChunks));
        
        player.message("§aUpdated appearance for " + updatedCount + " selected chunk(s) to " + itemInput + "!");
        
        selectedChunks = [];
        W.getStoreddata().put(GLOBAL_SELECTION_KEY, JSON.stringify(selectedChunks));
        
        renderChunkMapGui(player, api);
    }
    
    if(e.buttonId === ID_SEARCH_BUTTON){
        var gui = e.gui;
        var searchField = gui.getComponent(ID_SEARCH_FIELD);
        if(!searchField) return;
        
        var input = searchField.getText().trim();
        if(!input) {
            player.message("§cPlease enter coordinates (e.g., 100,200)");
            return;
        }
        
        var parts = input.split(/[,\s]+/);
        if(parts.length < 2){
            player.message("§cInvalid format. Use: X,Z (e.g., 100,200)");
            return;
        }
        
        var blockX = parseInt(parts[0]);
        var blockZ = parseInt(parts[1]);
        
        if(isNaN(blockX) || isNaN(blockZ)){
            player.message("§cInvalid coordinates. Use numbers only.");
            return;
        }
        
        var chunkX = Math.floor(blockX / 16);
        var chunkZ = Math.floor(blockZ / 16);
        
        if(chunkX < minChunkX || chunkX > minChunkX + mapCols - 1 || 
           chunkZ < minChunkZ || chunkZ > minChunkZ + mapRows - 1){
            player.message("§cChunk [" + chunkX + "," + chunkZ + "] is outside map bounds ([" + 
                         minChunkX + "," + minChunkZ + "] to [" + (minChunkX + mapCols - 1) + "," + 
                         (minChunkZ + mapRows - 1) + "])");
            return;
        }
        
        var globalPos = chunkCoordsToGlobalPos(chunkX, chunkZ);
        var relativeCol = chunkX - minChunkX;
        var relativeRow = chunkZ - minChunkZ;
        
        viewportX = Math.max(0, Math.min(relativeCol - Math.floor(viewportCols / 2), mapCols - viewportCols));
        viewportY = Math.max(0, Math.min(relativeRow - Math.floor(viewportRows / 2), mapRows - viewportRows));
        
        var alreadySelected = false;
        for(var i = 0; i < selectedChunks.length; i++){
            if(selectedChunks[i].chunkX === chunkX && selectedChunks[i].chunkZ === chunkZ){
                alreadySelected = true;
                break;
            }
        }
        
        if(!alreadySelected){
            selectedChunks.push({chunkX: chunkX, chunkZ: chunkZ});
            
            if(lastBlock){
                var W = lastBlock.getWorld();
                W.getStoreddata().put(GLOBAL_SELECTION_KEY, JSON.stringify(selectedChunks));
            }
        }
        
        var minX = chunkX * 16;
        var minZ = chunkZ * 16;
        var maxX = minX + 15;
        var maxZ = minZ + 15;
        currentChunkInfo = "§6Chunk [" + chunkX + "," + chunkZ + "] §7→ Blocks: §f" + minX + "," + minZ + " §7to §f" + maxX + "," + maxZ;
        
        saveViewportPosition();
        renderChunkMapGui(player, api);
        
        player.message("§aJumped to chunk [" + chunkX + "," + chunkZ + "]");
    }
    
    if(e.buttonId === ID_UP_BUTTON){
        if(viewportY > 0){
            viewportY--;
            saveViewportPosition();
            renderChunkMapGui(player, api);
        }
    }
    
    if(e.buttonId === ID_DOWN_BUTTON){
        if(viewportY < mapRows - viewportRows){
            viewportY++;
            saveViewportPosition();
            renderChunkMapGui(player, api);
        }
    }
    
    if(e.buttonId === ID_LEFT_BUTTON){
        if(viewportX > 0){
            viewportX--;
            saveViewportPosition();
            renderChunkMapGui(player, api);
        }
    }
    
    if(e.buttonId === ID_RIGHT_BUTTON){
        if(viewportX < mapCols - viewportCols){
            viewportX++;
            saveViewportPosition();
            renderChunkMapGui(player, api);
        }
    }
}

function customGuiClosed(e){
    if(e.gui.getID() !== Grid_GUI) return;
    var player = e.player;
    var gui = e.gui;
    var W = player.getWorld();
    if(!lastBlock) return;

    var claimedChunks = {};
    if(W.getStoreddata().has(GLOBAL_CLAIMS_KEY)){
        try {
            claimedChunks = JSON.parse(W.getStoreddata().get(GLOBAL_CLAIMS_KEY));
        } catch(e) {
            claimedChunks = {};
        }
    }
    
    for(var i = 0; i < mySlots.length; i++){
        var globalPos = viewportToGlobal(i);
        var st = mySlots[i].getStack();
        var key = "chunk_" + globalPos;
        
        var chunkCoords = globalPosToChunkCoords(globalPos);
        var protectedArea = isChunkProtected(chunkCoords.chunkX, chunkCoords.chunkZ);
        
        if(protectedArea) {
            continue;
        }
        
        if(!st || st.getName() === "minecraft:air"){
            delete claimedChunks[key];
        } else {
            claimedChunks[key] = st.getItemNbt().toJsonString();
        }
    }
    
    W.getStoreddata().put(GLOBAL_CLAIMS_KEY, JSON.stringify(claimedChunks));
}
