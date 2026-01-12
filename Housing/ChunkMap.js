// Chunk map variables
var guiRef;                 
var mySlots = [];           
var selectedChunks = [];     // Stores absolute chunk coordinates {chunkX, chunkZ}
var slotHighlights = {};
var viewportRows = 8;
var viewportCols = 18;

// Define your world boundaries (block coordinates)
var WORLD_MIN_X = 0;      // Minimum X block coordinate
var WORLD_MIN_Z = 0;      // Minimum Z block coordinate
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
var ID_TIME_DAY_BUTTON = 58;

var currentChunkInfo = "";

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
    
    guiRef.addButton(ID_CLEAR_BUTTON, "Clear", 200, -15, 40, 20);
    
    // Add time set day button
    guiRef.addButton(ID_TIME_DAY_BUTTON, "Day", 245, -15, 30, 20);
    
    // Add search field and button
    guiRef.addLabel(2, "§7Jump to X,Z:", -70, -32, 1.0, 1.0);
    guiRef.addTextField(ID_SEARCH_FIELD, -70, -20, 80, 18).setText("");
    guiRef.addButton(ID_SEARCH_BUTTON, "Go", 13, -20, 30, 18);
    
    // Display viewport info with absolute chunk coordinates
    var startChunk = globalPosToChunkCoords(viewportY * mapCols + viewportX);
    var endChunk = globalPosToChunkCoords((viewportY + viewportRows - 1) * mapCols + (viewportX + viewportCols - 1));
    guiRef.addLabel(1, "§7Viewport: [" + startChunk.chunkX + "," + startChunk.chunkZ + "] to [" + endChunk.chunkX + "," + endChunk.chunkZ + "]", 60, -15, 1.0, 1.0);
    
    // Display chunk info
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
    
    // Draw one thick horizontal line to fill the entire slot
    slotHighlights[index] = [
        guiRef.addColoredLine(nextLineId++, x, y + h/2, x + w, y + h/2, 0xADD8E6, h)
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
        
        // Recreate GUI to properly remove highlight and rebuild others
        renderChunkMapGui(player, api);
    } else {
        // Add to selectedChunks and draw highlight
        selectedChunks.push({chunkX: chunkX, chunkZ: chunkZ});
        drawHighlight(index);
        
        // Save selected chunks to GLOBAL storage
        if(lastBlock){
            var W = lastBlock.getWorld();
            W.getStoreddata().put(GLOBAL_SELECTION_KEY, JSON.stringify(selectedChunks));
        }
        
        // Update the chunk info label without recreating GUI
        try {
            var label = guiRef.getComponent(ID_CHUNK_INFO_LABEL);
            if(label) label.setText(currentChunkInfo);
        } catch(e) {}
        
        if (guiRef) guiRef.update();
    }
}

function saveViewportPosition(){
    if(!lastBlock) return;
    var W = lastBlock.getWorld();
    var keyPrefix = "chunkmap_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
    W.getStoreddata().put(keyPrefix + "viewportX", viewportX.toString());
    W.getStoreddata().put(keyPrefix + "viewportY", viewportY.toString());
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
        
        renderChunkMapGui(player, api);
    }
    
    if(e.buttonId === ID_TIME_DAY_BUTTON){
        // Execute time set day command
        api.executeCommand(player.getWorld(), "time set day");
        player.message("§aTime set to day");
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
