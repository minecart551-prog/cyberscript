
// Chunk map variables
var guiRef;                 
var mySlots = [];           
var selectedSlots = [];      // Stores global chunk positions
var slotHighlights = {};
var viewportRows = 8;
var viewportCols = 18;
var mapRows = 100;
var mapCols = 100;
var slotSize = 18;
var slotPadding = 0;
var offsetX = -70;
var offsetY = 10;  // Moved up from 36
var storedSlotItems = [];
var lastBlock = null;
var nextLineId = 1000;

// Viewport position on the map
var viewportX = 0;  // Top-left X position on map
var viewportY = 0;  // Top-left Y position on map

var Grid_GUI = 100;
var ID_CLEAR_BUTTON = 50;
var ID_UP_BUTTON = 51;
var ID_DOWN_BUTTON = 52;
var ID_LEFT_BUTTON = 53;
var ID_RIGHT_BUTTON = 54;
var ID_CHUNK_INFO_LABEL = 55;
var ID_SEARCH_FIELD = 56;
var ID_SEARCH_BUTTON = 57;

var currentChunkInfo = "";  // Store current chunk info

// ===== Set block model (optional - customize as needed) =====
function init(e){
    // e.block.setModel("refurbished_furniture:computer");
}

// ===== Right-click entry point =====
function interact(e) {
    var api = e.API;
    var p   = e.player;
    
    lastBlock = e.block;
    openChunkMapGui(p, api);
}

// ===== Convert viewport slot index to global map position =====
function viewportToGlobal(slotIndex) {
    var localRow = Math.floor(slotIndex / viewportCols);
    var localCol = slotIndex % viewportCols;
    var globalRow = viewportY + localRow;
    var globalCol = viewportX + localCol;
    return globalRow * mapCols + globalCol;
}

// ===== Convert global map position to viewport slot index (or -1 if not visible) =====
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

    // Load stored items for entire 10x10 map
    storedSlotItems = [];
    for (var i = 0; i < mapRows * mapCols; i++){
        storedSlotItems.push(W.getStoreddata().has(keyPrefix + i) ? W.getStoreddata().get(keyPrefix + i) : null);
    }

    // Load selected slots (global positions)
    if(W.getStoreddata().has(keyPrefix + "selected")){
        try {
            selectedSlots = JSON.parse(W.getStoreddata().get(keyPrefix + "selected"));
        } catch(e) {
            selectedSlots = [];
        }
    } else {
        selectedSlots = [];
    }

    // Load viewport position
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

    // Create 5x5 viewport
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

    // Draw highlights for selected slots that are visible in viewport
    for(var i = 0; i < selectedSlots.length; i++){
        var viewportIndex = globalToViewport(selectedSlots[i]);
        if(viewportIndex !== -1){
            drawHighlight(viewportIndex);
        }
    }

    // Add navigation buttons - compass pattern with empty center
    var navY = 165;  // Lower position
    var navCenterX = 275;  // Center of screen
    var btnSize = 20;
    var btnGap = 19;  // Gap between buttons to leave center empty
    
    guiRef.addButton(ID_UP_BUTTON, "↑", navCenterX, navY - btnGap, btnSize, btnSize);        // North
    guiRef.addButton(ID_DOWN_BUTTON, "↓", navCenterX, navY + btnGap, btnSize, btnSize);      // South
    guiRef.addButton(ID_LEFT_BUTTON, "←", navCenterX - btnGap, navY, btnSize, btnSize);      // West
    guiRef.addButton(ID_RIGHT_BUTTON, "→", navCenterX + btnGap, navY, btnSize, btnSize);     // East
    
    guiRef.addButton(ID_CLEAR_BUTTON, "Clear", 200, -15, 40, 20);
    
    // Add search field and button
    guiRef.addLabel(2, "§7Jump to X,Z:", -70, -32, 1.0, 1.0);
    guiRef.addTextField(ID_SEARCH_FIELD, -70, -20, 80, 18).setText("");
    guiRef.addButton(ID_SEARCH_BUTTON, "Go", 13, -20, 30, 18);
    
    // Display viewport info
    var endX = viewportX + viewportCols - 1;
    var endY = viewportY + viewportRows - 1;
    guiRef.addLabel(1, "§7Viewport: [" + viewportX + "," + viewportY + "] to [" + endX + "," + endY + "]", 60, -15, 1.0, 1.0);
    
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
    
    // Calculate chunk coordinates
    var chunkRow = Math.floor(globalPos / mapCols);
    var chunkCol = globalPos % mapCols;
    
    // Calculate block coordinates (each chunk is 16x16 blocks)
    var minX = chunkCol * 16;
    var minZ = chunkRow * 16;
    var maxX = minX + 15;
    var maxZ = minZ + 15;
    
    // Update chunk info display
    currentChunkInfo = "§6Chunk [" + chunkCol + "," + chunkRow + "] §7→ Blocks: §f" + minX + "," + minZ + " §7to §f" + maxX + "," + maxZ;
    
    var pos = selectedSlots.indexOf(globalPos);
    if (pos !== -1) {
        // Remove from selectedSlots
        selectedSlots.splice(pos, 1);
        
        // Save updated selection
        if(lastBlock){
            var W = lastBlock.getWorld();
            var keyPrefix = "chunkmap_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
            W.getStoreddata().put(keyPrefix + "selected", JSON.stringify(selectedSlots));
        }
        
        // Recreate GUI to properly remove highlight and rebuild others (also updates chunk info)
        renderChunkMapGui(player, api);
    } else {
        // Add to selectedSlots and draw highlight
        selectedSlots.push(globalPos);
        drawHighlight(index);
        
        // Save selected slots
        if(lastBlock){
            var W = lastBlock.getWorld();
            var keyPrefix = "chunkmap_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
            W.getStoreddata().put(keyPrefix + "selected", JSON.stringify(selectedSlots));
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
        selectedSlots = [];
        
        // Save cleared selection
        if(lastBlock){
            var W = lastBlock.getWorld();
            var keyPrefix = "chunkmap_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
            W.getStoreddata().put(keyPrefix + "selected", JSON.stringify(selectedSlots));
        }
        
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
        var chunkCol = Math.floor(blockX / 16);
        var chunkRow = Math.floor(blockZ / 16);
        
        // Check if chunk is within map bounds
        if(chunkCol < 0 || chunkCol >= mapCols || chunkRow < 0 || chunkRow >= mapRows){
            player.message("§cChunk [" + chunkCol + "," + chunkRow + "] is outside map bounds (0-" + (mapCols-1) + ", 0-" + (mapRows-1) + ")");
            return;
        }
        
        // Calculate global position
        var globalPos = chunkRow * mapCols + chunkCol;
        
        // Center viewport on this chunk
        viewportX = Math.max(0, Math.min(chunkCol - Math.floor(viewportCols / 2), mapCols - viewportCols));
        viewportY = Math.max(0, Math.min(chunkRow - Math.floor(viewportRows / 2), mapRows - viewportRows));
        
        // Add to selected slots if not already selected
        if(selectedSlots.indexOf(globalPos) === -1){
            selectedSlots.push(globalPos);
            
            // Save selection
            if(lastBlock){
                var W = lastBlock.getWorld();
                var keyPrefix = "chunkmap_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
                W.getStoreddata().put(keyPrefix + "selected", JSON.stringify(selectedSlots));
            }
        }
        
        // Update chunk info
        var minX = chunkCol * 16;
        var minZ = chunkRow * 16;
        var maxX = minX + 15;
        var maxZ = minZ + 15;
        currentChunkInfo = "§6Chunk [" + chunkCol + "," + chunkRow + "] §7→ Blocks: §f" + minX + "," + minZ + " §7to §f" + maxX + "," + maxZ;
        
        // Save viewport position
        saveViewportPosition();
        
        // Recreate GUI to show new viewport and highlight
        renderChunkMapGui(player, api);
        
        player.message("§aJumped to chunk [" + chunkCol + "," + chunkRow + "]");
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
    
    // Don't clear guiRef when just recreating
}
