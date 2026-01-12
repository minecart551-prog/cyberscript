// ===============================
// Simple Chest GUI Storage
// ===============================

// Chest GUI template variables
var guiRef;                 
var mySlots = [];           
var selectedSlots = [];
var slotHighlights = {};
var rows = 3;
var cols = 9;
var slotSize = 18;
var slotPadding = 0;
var offsetX = 0;
var offsetY = 36;   // chest GUI offset on screen
var storedSlotItems = [];
var lastBlock = null;  // block reference for storage
var nextLineId = 1000;

var Grid_GUI = 100;
var ID_CLEAR_BUTTON = 50;

// ===== Set block model (optional - customize as needed) =====
function init(e){
    // e.block.setModel("refurbished_furniture:computer");
}

// ===== Right-click entry point =====
function interact(e) {
    var api = e.API;
    var p   = e.player;
    
    lastBlock = e.block;
    openChestGui(p, api);
}

// ===== Working chest GUI =====
function openChestGui(player, api){
    if(!lastBlock) return;
    var W = lastBlock.getWorld();
    var keyPrefix = "chest_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";

    // Load stored items
    storedSlotItems = [];
    for (var i = 0; i < rows*cols; i++){
        storedSlotItems.push(W.getStoreddata().has(keyPrefix + i) ? W.getStoreddata().get(keyPrefix + i) : null);
    }

    // Load selected slots
    if(W.getStoreddata().has(keyPrefix + "selected")){
        try {
            selectedSlots = JSON.parse(W.getStoreddata().get(keyPrefix + "selected"));
        } catch(e) {
            selectedSlots = [];
        }
    } else {
        selectedSlots = [];
    }

    renderChestGui(player, api);
}

function renderChestGui(player, api){
    slotHighlights = {};
    nextLineId = 1000;
    
    guiRef = api.createCustomGui(Grid_GUI, 176, 166, false, player);
    mySlots = [];

    for(var r=0; r<rows; r++){
        for(var c=0; c<cols; c++){
            var x = offsetX + c*(slotSize+slotPadding);
            var y = offsetY + r*(slotSize+slotPadding);
            var slot = guiRef.addItemSlot(x, y);
            var index = r*cols + c;

            if(storedSlotItems[index]){
                try { slot.setStack(player.world.createItemFromNbt(api.stringToNbt(storedSlotItems[index]))); } catch(e){}
            }

            mySlots.push(slot);
        }
    }

    // Draw highlights for selected slots
    for(var i = 0; i < selectedSlots.length; i++){
        if(selectedSlots[i] >= 0 && selectedSlots[i] < mySlots.length){
            drawHighlight(selectedSlots[i]);
        }
    }

    // Add Clear button
    guiRef.addButton(ID_CLEAR_BUTTON, "Clear", 150, 10, 40, 20);

    player.showCustomGui(guiRef);
}

function drawHighlight(index) {
    if (!guiRef || slotHighlights[index]) return;
    
    var row = Math.floor(index / cols);
    var col = index % cols;
    var x = offsetX + col * (slotSize + slotPadding);
    var y = offsetY + row * (slotSize + slotPadding);
    var w = slotSize, h = slotSize;
    
    slotHighlights[index] = [
        guiRef.addColoredLine(nextLineId++, x, y, x + w, y, 0xADD8E6, 1),
        guiRef.addColoredLine(nextLineId++, x, y + h, x + w, y + h, 0xADD8E6, 1),
        guiRef.addColoredLine(nextLineId++, x, y, x, y + h, 0xADD8E6, 1),
        guiRef.addColoredLine(nextLineId++, x + w, y, x + w, y + h, 0xADD8E6, 1)
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
    
    var pos = selectedSlots.indexOf(index);
    if (pos !== -1) {
        // Remove from selectedSlots
        selectedSlots.splice(pos, 1);
        
        // Save updated selection
        if(lastBlock){
            var W = lastBlock.getWorld();
            var keyPrefix = "chest_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
            W.getStoreddata().put(keyPrefix + "selected", JSON.stringify(selectedSlots));
        }
        
        // Recreate GUI to properly remove highlight and rebuild others
        renderChestGui(player, api);
    } else {
        // Add to selectedSlots and draw highlight
        selectedSlots.push(index);
        drawHighlight(index);
        
        // Save selected slots
        if(lastBlock){
            var W = lastBlock.getWorld();
            var keyPrefix = "chest_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
            W.getStoreddata().put(keyPrefix + "selected", JSON.stringify(selectedSlots));
        }
        
        if (guiRef) guiRef.update();
    }
}

// ===== Handle slot clicks =====
function customGuiSlotClicked(e){
    var clickedSlot = e.slot;
    var player = e.player;
    var api = e.API;

    var slotIndex = mySlots.indexOf(clickedSlot);
    
    // Only process if it's one of our chest slots
    if(slotIndex === -1) return;
    
    // Toggle highlight on this slot
    toggleHighlight(slotIndex, player, api);
}

// ===== Handle button clicks =====
function customGuiButton(e){
    var player = e.player;
    var api = e.API;
    
    if(e.buttonId === ID_CLEAR_BUTTON){
        // Clear all selections and recreate GUI (like manager script)
        selectedSlots = [];
        
        // Save cleared selection
        if(lastBlock){
            var W = lastBlock.getWorld();
            var keyPrefix = "chest_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
            W.getStoreddata().put(keyPrefix + "selected", JSON.stringify(selectedSlots));
        }
        
        renderChestGui(player, api);
    }
}

// ===== Persist chest contents =====
function customGuiClosed(e){
    if(e.gui.getID() !== Grid_GUI) return;
    var player = e.player;
    var gui = e.gui;
    var W = player.getWorld();
    if(!lastBlock) return;

    var keyPrefix = "chest_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
    mySlots.forEach(function(slot, i){
        var st = slot.getStack();
        if(!st || st.getName() === "minecraft:air"){
            W.getStoreddata().remove(keyPrefix + i);
        } else {
            W.getStoreddata().put(keyPrefix + i, st.getItemNbt().toJsonString());
        }
    });
    
    // Don't clear guiRef when just recreating
}
