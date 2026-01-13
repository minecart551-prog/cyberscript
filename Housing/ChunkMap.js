// Chunk map variables
var guiRef;                 
var mySlots = [];           
var selectedChunks = [];     // Stores absolute chunk coordinates {chunkX, chunkZ}
var slotHighlights = {};
var viewportRows = 8;
var viewportCols = 18;

// Define your world boundaries (block coordinates)
var WORLD_MIN_X = -500;      // Minimum X block coordinate
var WORLD_MIN_Z = -500;      // Minimum Z block coordinate
var WORLD_MAX_X = 1599;   // Maximum X block coordinate
var WORLD_MAX_Z = 1599;   // Maximum Z block coordinate

// Calculated chunk boundaries (do not modify these directly)
var minChunkX = 0;
var minChunkZ = 0;
var mapCols = 0;  // Total columns (X direction)
var mapRows = 0;  // Total rows (Z direction)

var slotSize = 18;
var slotPadding = 0;
var offsetX = -80;
var offsetY = 10;
var storedSlotItems = [];
var lastBlock = null;
var nextLineId = 1000;

// Viewport position on the map (in chunk coordinates relative to minChunk)
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
var ID_UNCLAIM_BUTTON = 59;
var ID_PRICE_BUTTON = 60;
var ID_COAL_PRICE_SLOT = 61;
var ID_STONE_PRICE_SLOT = 62;
var ID_TOTAL_LABEL = 63;

var currentChunkInfo = "";

// Default chunk prices (per chunk)
var CHUNK_COAL_PRICE = 1;
var CHUNK_STONE_PRICE = 50;

// Store references to price slots
var coalPriceSlot = null;
var stonePriceSlot = null;

// Track if price button was pressed
var showTotalPrice = false;
var priceCalculatedForChunkCount = 0; // Track how many chunks price was calculated for

// Global key for shared selection data (stores absolute chunk coordinates)
var GLOBAL_SELECTION_KEY = "chunkmap_selected";

// ===== Initialize chunk boundaries =====
function calculateChunkBoundaries() {
    // Round down to chunk boundaries (each chunk is 16 blocks)
    minChunkX = Math.floor(WORLD_MIN_X / 16);
    minChunkZ = Math.floor(WORLD_MIN_Z / 16);
    var maxChunkX = Math.floor(WORLD_MAX_X / 16);
    var maxChunkZ = Math.floor(WORLD_MAX_Z / 16);
    
    // Calculate map dimensions in chunks
    mapCols = maxChunkX - minChunkX + 1;  // +1 because inclusive
    mapRows = maxChunkZ - minChunkZ + 1;
}

// ===== Set block model (optional - customize as needed) =====
function init(e){
    // e.block.setModel("refurbished_furniture:computer");
    calculateChunkBoundaries();
}

// ===== Right-click entry point =====
function interact(e) {
    var api = e.API;
    var p   = e.player;
    
    calculateChunkBoundaries();
    lastBlock = e.block;
    openChunkMapGui(p, api);
}

// ===== Convert viewport slot index to global chunk position =====
function viewportToGlobal(slotIndex) {
    var localRow = Math.floor(slotIndex / viewportCols);
    var localCol = slotIndex % viewportCols;
    var globalRow = viewportY + localRow;
    var globalCol = viewportX + localCol;
    return globalRow * mapCols + globalCol;
}

// ===== Convert global position to absolute chunk coordinates =====
function globalPosToChunkCoords(globalPos) {
    var relativeRow = Math.floor(globalPos / mapCols);
    var relativeCol = globalPos % mapCols;
    return {
        chunkX: minChunkX + relativeCol,
        chunkZ: minChunkZ + relativeRow
    };
}

// ===== Convert absolute chunk coordinates to global position (or -1 if outside bounds) =====
function chunkCoordsToGlobalPos(chunkX, chunkZ) {
    // Check if chunk is within current bounds
    if(chunkX < minChunkX || chunkX > minChunkX + mapCols - 1 || 
       chunkZ < minChunkZ || chunkZ > minChunkZ + mapRows - 1){
        return -1;  // Outside current map bounds
    }
    var relativeCol = chunkX - minChunkX;
    var relativeRow = chunkZ - minChunkZ;
    return relativeRow * mapCols + relativeCol;
}

// ===== Convert global position to viewport slot index (or -1 if not visible) =====
function globalToViewport(globalPos) {
    var globalRow = Math.floor(globalPos / mapCols);
    var globalCol = globalPos % mapCols;
    
    // Check if this position is within current viewport
    if (globalRow >= viewportY && globalRow < viewportY + viewportRows &&
        globalCol >= viewportX && globalCol < viewportX + viewportCols) {
        var localRow = globalRow - viewportY;
        var localCol = globalCol - viewportX;
        return localRow * viewportCols + localCol;
    }
    return -1;  // Not in viewport
}

// ===== Open chunk map GUI =====
function openChunkMapGui(player, api){
    if(!lastBlock) return;
    var W = lastBlock.getWorld();
    var keyPrefix = "chunkmap_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";

    // Load stored items for entire map
    storedSlotItems = [];
    for (var i = 0; i < mapRows * mapCols; i++){
        storedSlotItems.push(W.getStoreddata().has(keyPrefix + i) ? W.getStoreddata().get(keyPrefix + i) : null);
    }

    // Load selected chunks from GLOBAL storage (stores absolute chunk coordinates)
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

    // Load viewport position (per-block storage)
    if(W.getStoreddata().has(keyPrefix + "viewportX")){
        viewportX = parseInt(W.getStoreddata().get(keyPrefix + "viewportX"));
        viewportY = parseInt(W.getStoreddata().get(keyPrefix + "viewportY"));
    } else {
        viewportX = 0;
        viewportY = 0;
    }

    renderChunkMapGui(player, api);
}

function renderChunkMapGui(player, api){
    slotHighlights = {};
    nextLineId = 1000;
    
    guiRef = api.createCustomGui(Grid_GUI, 176, 166, false, player);
    mySlots = [];

    // Create viewport
    for(var r=0; r<viewportRows; r++){
        for(var c=0; c<viewportCols; c++){
            var x = offsetX + c*(slotSize+slotPadding);
            var y = offsetY + r*(slotSize+slotPadding);
            var slot = guiRef.addItemSlot(x, y);
            
            // Get global position for this viewport slot
            var globalPos = (viewportY + r) * mapCols + (viewportX + c);
            
            if(storedSlotItems[globalPos]){
                try { 
                    slot.setStack(player.world.createItemFromNbt(api.stringToNbt(storedSlotItems[globalPos]))); 
                } catch(e){}
            }

            mySlots.push(slot);
        }
    }

    // Draw highlights for selected chunks that are visible in viewport
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

    // Add navigation buttons - compass pattern with empty center
    var navY = 165;
    var navCenterX = 275;
    var btnSize = 20;
    var btnGap = 19;
    
    guiRef.addButton(ID_UP_BUTTON, "↑", navCenterX, navY - btnGap, btnSize, btnSize);
    guiRef.addButton(ID_DOWN_BUTTON, "↓", navCenterX, navY + btnGap, btnSize, btnSize);
    guiRef.addButton(ID_LEFT_BUTTON, "←", navCenterX - btnGap, navY, btnSize, btnSize);
    guiRef.addButton(ID_RIGHT_BUTTON, "→", navCenterX + btnGap, navY, btnSize, btnSize);
    
    guiRef.addButton(ID_UNCLAIM_BUTTON, "Unclaim", 153, -15, 45, 20);
    
    guiRef.addButton(ID_CLEAR_BUTTON, "Clear", 203, -15, 40, 20);
    
    // Add Price button
    guiRef.addButton(ID_PRICE_BUTTON, "Price", 248, -15, 35, 20);
    
    // Display price slots below Price button (vertically stacked)
    // Position them to the right of the chunk grid
    var priceX = 250;
    var priceY = 10;
    
    // Coal coin slot
    coalPriceSlot = guiRef.addItemSlot(priceX, priceY);
    
    // Stone coin slot (below coal slot)
    stonePriceSlot = guiRef.addItemSlot(priceX, priceY + 20);
    
    // Only show calculated prices if Price button was pressed
    if(showTotalPrice) {
        var totalChunks = selectedChunks.length;
        
        if(totalChunks > 0) {
            // Calculate raw totals
            var totalCoal = CHUNK_COAL_PRICE * totalChunks;
            var totalStone = CHUNK_STONE_PRICE * totalChunks;
            
            // Convert all to stone first (1 coal = 100 stone)
            var totalInStone = (totalCoal * 100) + totalStone;
            
            // Now convert back to coal and stone
            var finalCoal = Math.floor(totalInStone / 100);
            var finalStone = totalInStone % 100;
            
            if(finalCoal > 0) {
                var coalCoin = player.world.createItem("coins:coal_coin", Math.min(finalCoal, 64));
                coalPriceSlot.setStack(coalCoin);
            }
            
            if(finalStone > 0) {
                var stoneCoin = player.world.createItem("coins:stone_coin", Math.min(finalStone, 64));
                stonePriceSlot.setStack(stoneCoin);
            }
        }
        // If no chunks selected, slots remain empty (air)
    }
    
    // Add Claim button below price slots (only if price was calculated)
    if(showTotalPrice && priceCalculatedForChunkCount === selectedChunks.length) {
        guiRef.addButton(ID_CLAIM_BUTTON, "Claim", priceX - 2, priceY + 42, 40, 20);
    }
    
    // Add search field and button - moved 10px to the left
    guiRef.addLabel(2, "§7Jump to X,Z:", -80, -32, 1.0, 1.0);
    guiRef.addTextField(ID_SEARCH_FIELD, -80, -20, 80, 18).setText("");
    guiRef.addButton(ID_SEARCH_BUTTON, "Go", 3, -20, 30, 18);
    
    // Show selected chunks count - moved 20px more to the right (20 + 20 = 40) and 8px higher (168 - 8 = 160)
    var totalChunks = selectedChunks.length;
    guiRef.addLabel(ID_TOTAL_LABEL, "§7Selected: §6" + totalChunks + " §7chunks", 40, 160, 0.8, 0.8);
    
    // Display chunk info at bottom
    if(currentChunkInfo){
        guiRef.addLabel(ID_CHUNK_INFO_LABEL, currentChunkInfo, 5, 195, 1.0, 1.0);
    } else {
        guiRef.addLabel(ID_CHUNK_INFO_LABEL, "§7Click a chunk to view coordinates", 5, 195, 1.0, 1.0);
    }

    player.showCustomGui(guiRef);
}

function drawHighlight(index) {
    if (!guiRef || slotHighlights[index]) return;
    
    var row = Math.floor(index / viewportCols);
    var col = index % viewportCols;
    var x = offsetX + col * (slotSize + slotPadding) - 1;
    var y = offsetY + row * (slotSize + slotPadding) - 1;
    var w = slotSize, h = slotSize;
    
    // Draw 4 lines to outline the slot (2 pixels thick, 2 pixels closer to center)
    var inset = 2;
    slotHighlights[index] = [
        guiRef.addColoredLine(nextLineId++, x + inset, y + inset, x + w - inset, y + inset, 0xADD8E6, 2),           // Top
        guiRef.addColoredLine(nextLineId++, x + inset, y + h - inset, x + w - inset, y + h - inset, 0xADD8E6, 2),   // Bottom
        guiRef.addColoredLine(nextLineId++, x + inset, y + inset, x + inset, y + h - inset, 0xADD8E6, 2),           // Left
        guiRef.addColoredLine(nextLineId++, x + w - inset, y + inset, x + w - inset, y + h - inset, 0xADD8E6, 2)    // Right
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
    
    // Convert viewport index to global position
    var globalPos = viewportToGlobal(index);
    
    // Get absolute chunk coordinates
    var chunk = globalPosToChunkCoords(globalPos);
    var chunkX = chunk.chunkX;
    var chunkZ = chunk.chunkZ;
    
    // Calculate block coordinates (each chunk is 16x16 blocks)
    var minX = chunkX * 16;
    var minZ = chunkZ * 16;
    var maxX = minX + 15;
    var maxZ = minZ + 15;
    
    // Update chunk info display
    currentChunkInfo = "§6Chunk [" + chunkX + "," + chunkZ + "] §7→ Blocks: §f" + minX + "," + minZ + " §7to §f" + maxX + "," + maxZ;
    
    // Check if this chunk is already selected
    var existingIndex = -1;
    for(var i = 0; i < selectedChunks.length; i++){
        if(selectedChunks[i].chunkX === chunkX && selectedChunks[i].chunkZ === chunkZ){
            existingIndex = i;
            break;
        }
    }
    
    if (existingIndex !== -1) {
        // Remove from selectedChunks
        selectedChunks.splice(existingIndex, 1);
        
        // Save updated selection to GLOBAL storage
        if(lastBlock){
            var W = lastBlock.getWorld();
            W.getStoreddata().put(GLOBAL_SELECTION_KEY, JSON.stringify(selectedChunks));
        }
        
        // Reset price display flag when deselecting (chunk count changed)
        showTotalPrice = false;
        priceCalculatedForChunkCount = 0;
        
        // Recreate GUI to properly remove highlight and rebuild others
        renderChunkMapGui(player, api);
    } else {
        // Add to selectedChunks and draw highlight
        selectedChunks.push({chunkX: chunkX, chunkZ: chunkZ});
        
        // Save selected chunks to GLOBAL storage
        if(lastBlock){
            var W = lastBlock.getWorld();
            W.getStoreddata().put(GLOBAL_SELECTION_KEY, JSON.stringify(selectedChunks));
        }
        
        // Check if we need to recreate GUI (if price was calculated, we need to hide Claim button)
        var needsRecreate = showTotalPrice;
        
        // Reset price display flag when selecting (chunk count changed)
        showTotalPrice = false;
        priceCalculatedForChunkCount = 0;
        
        if(needsRecreate) {
            // Recreate GUI to hide Claim button and clear price slots
            renderChunkMapGui(player, api);
        } else {
            // Just draw highlight and update labels
            drawHighlight(index);
            
            // Update the chunk info label and selected count without recreating GUI
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
    var keyPrefix = "chunkmap_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
    W.getStoreddata().put(keyPrefix + "viewportX", viewportX.toString());
    W.getStoreddata().put(keyPrefix + "viewportY", viewportY.toString());
}

// ===== Check if any selected chunks are already claimed =====
function hasClaimedChunksInSelection() {
    if(!lastBlock) return false;
    var W = lastBlock.getWorld();
    var keyPrefix = "chunkmap_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
    
    for(var i = 0; i < selectedChunks.length; i++){
        var chunk = selectedChunks[i];
        var globalPos = chunkCoordsToGlobalPos(chunk.chunkX, chunk.chunkZ);
        
        if(globalPos !== -1){
            // Check if this chunk has an item (is claimed)
            if(W.getStoreddata().has(keyPrefix + globalPos)) {
                return true;
            }
        }
    }
    return false;
}

// ===== Claim selected chunks =====
function claimSelectedChunks(player, api) {
    if(selectedChunks.length === 0) {
        player.message("§cNo chunks selected to claim!");
        return;
    }
    
    if(!lastBlock) return;
    var W = lastBlock.getWorld();
    var keyPrefix = "chunkmap_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
    
    // Create dirt item NBT with player's name
    var dirtItem = W.createItem("minecraft:dirt", 1);
    dirtItem.setCustomName("§6" + player.getName());
    var dirtNbt = dirtItem.getItemNbt().toJsonString();
    
    var claimedCount = 0;
    
    // Fill all selected chunks with dirt
    for(var i = 0; i < selectedChunks.length; i++){
        var chunk = selectedChunks[i];
        var globalPos = chunkCoordsToGlobalPos(chunk.chunkX, chunk.chunkZ);
        
        if(globalPos !== -1){
            // Store dirt in this chunk's slot
            W.getStoreddata().put(keyPrefix + globalPos, dirtNbt);
            storedSlotItems[globalPos] = dirtNbt;
            claimedCount++;
        }
    }
    
    player.message("§aClaimed " + claimedCount + " chunk(s)!");
    
    // Clear all selections after claiming
    selectedChunks = [];
    W.getStoreddata().put(GLOBAL_SELECTION_KEY, JSON.stringify(selectedChunks));
    
    // Recreate GUI to show the dirt blocks without highlights
    renderChunkMapGui(player, api);
}


// ===== Unclaim selected chunks =====
function unclaimSelectedChunks(player, api) {
    if(selectedChunks.length === 0) {
        player.message("§cNo chunks selected to unclaim!");
        return;
    }
    
    if(!lastBlock) return;
    var W = lastBlock.getWorld();
    var keyPrefix = "chunkmap_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
    
    var unclaimedCount = 0;
    
    // Remove items from all selected chunks
    for(var i = 0; i < selectedChunks.length; i++){
        var chunk = selectedChunks[i];
        var globalPos = chunkCoordsToGlobalPos(chunk.chunkX, chunk.chunkZ);
        
        if(globalPos !== -1){
            // Remove item from storage
            W.getStoreddata().remove(keyPrefix + globalPos);
            storedSlotItems[globalPos] = null;
            unclaimedCount++;
        }
    }
    
    player.message("§aUnclaimed " + unclaimedCount + " chunk(s)!");
    
    // Clear all selections after unclaiming
    selectedChunks = [];
    W.getStoreddata().put(GLOBAL_SELECTION_KEY, JSON.stringify(selectedChunks));
    
    // Recreate GUI to remove the items without highlights
    renderChunkMapGui(player, api);
}

// ===== Handle slot clicks =====
function customGuiSlotClicked(e){
    var clickedSlot = e.slot;
    var player = e.player;
    var api = e.API;

    var slotIndex = mySlots.indexOf(clickedSlot);
    
    // Only process if it's one of our viewport slots
    if(slotIndex === -1) return;
    
    // Toggle highlight on this slot
    toggleHighlight(slotIndex, player, api);
}

// ===== Handle button clicks =====
function customGuiButton(e){
    var player = e.player;
    var api = e.API;
    
    if(e.buttonId === ID_CLEAR_BUTTON){
        // Clear all selections and recreate GUI
        selectedChunks = [];
        
        // Save cleared selection to GLOBAL storage
        if(lastBlock){
            var W = lastBlock.getWorld();
            W.getStoreddata().put(GLOBAL_SELECTION_KEY, JSON.stringify(selectedChunks));
        }
        
        // Reset price display flag
        showTotalPrice = false;
        priceCalculatedForChunkCount = 0;
        
        renderChunkMapGui(player, api);
    }
    
    if(e.buttonId === ID_CLAIM_BUTTON){
        // Check if any selected chunks are already claimed
        if(hasClaimedChunksInSelection()) {
            player.message("§cChunk already claimed!");
            return;
        }
        
        claimSelectedChunks(player, api);
        // Reset price display flag after claiming
        showTotalPrice = false;
        priceCalculatedForChunkCount = 0;
    }
    
    if(e.buttonId === ID_UNCLAIM_BUTTON){
        unclaimSelectedChunks(player, api);
        // Reset price display flag after unclaiming
        showTotalPrice = false;
        priceCalculatedForChunkCount = 0;
    }
    
    if(e.buttonId === ID_PRICE_BUTTON){
        // Calculate and show total price based on current selections
        showTotalPrice = true;
        priceCalculatedForChunkCount = selectedChunks.length;
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
        
        // Parse input "x,z"
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
        
        // Convert block coordinates to chunk coordinates
        var chunkX = Math.floor(blockX / 16);
        var chunkZ = Math.floor(blockZ / 16);
        
        // Check if chunk is within map bounds
        if(chunkX < minChunkX || chunkX > minChunkX + mapCols - 1 || 
           chunkZ < minChunkZ || chunkZ > minChunkZ + mapRows - 1){
            player.message("§cChunk [" + chunkX + "," + chunkZ + "] is outside map bounds ([" + 
                         minChunkX + "," + minChunkZ + "] to [" + (minChunkX + mapCols - 1) + "," + 
                         (minChunkZ + mapRows - 1) + "])");
            return;
        }
        
        // Calculate global position
        var globalPos = chunkCoordsToGlobalPos(chunkX, chunkZ);
        
        // Calculate relative position for viewport
        var relativeCol = chunkX - minChunkX;
        var relativeRow = chunkZ - minChunkZ;
        
        // Center viewport on this chunk
        viewportX = Math.max(0, Math.min(relativeCol - Math.floor(viewportCols / 2), mapCols - viewportCols));
        viewportY = Math.max(0, Math.min(relativeRow - Math.floor(viewportRows / 2), mapRows - viewportRows));
        
        // Add to selected chunks if not already selected
        var alreadySelected = false;
        for(var i = 0; i < selectedChunks.length; i++){
            if(selectedChunks[i].chunkX === chunkX && selectedChunks[i].chunkZ === chunkZ){
                alreadySelected = true;
                break;
            }
        }
        
        if(!alreadySelected){
            selectedChunks.push({chunkX: chunkX, chunkZ: chunkZ});
            
            // Save selection to GLOBAL storage
            if(lastBlock){
                var W = lastBlock.getWorld();
                W.getStoreddata().put(GLOBAL_SELECTION_KEY, JSON.stringify(selectedChunks));
            }
        }
        
        // Update chunk info
        var minX = chunkX * 16;
        var minZ = chunkZ * 16;
        var maxX = minX + 15;
        var maxZ = minZ + 15;
        currentChunkInfo = "§6Chunk [" + chunkX + "," + chunkZ + "] §7→ Blocks: §f" + minX + "," + minZ + " §7to §f" + maxX + "," + maxZ;
        
        // Save viewport position
        saveViewportPosition();
        
        // Recreate GUI to show new viewport and highlight
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

// ===== Persist chunk map contents =====
function customGuiClosed(e){
    if(e.gui.getID() !== Grid_GUI) return;
    var player = e.player;
    var gui = e.gui;
    var W = player.getWorld();
    if(!lastBlock) return;

    var keyPrefix = "chunkmap_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
    
    // Save items for visible viewport slots
    for(var i = 0; i < mySlots.length; i++){
        var globalPos = viewportToGlobal(i);
        var st = mySlots[i].getStack();
        if(!st || st.getName() === "minecraft:air"){
            W.getStoreddata().remove(keyPrefix + globalPos);
        } else {
            W.getStoreddata().put(keyPrefix + globalPos, st.getItemNbt().toJsonString());
        }
    }
}
