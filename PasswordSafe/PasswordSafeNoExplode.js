// ===============================
// Safe / PIN Lockable Storage (customizable PIN length + working chest GUI)
// ===============================

// Configuration
var PinLength = 5;                  // Example: 5-digit PIN
var PassWord = [1,2,3,4,5];         // Must match PinLength
var Damage   = 4;
var Dspeed   = [0.8, 1.8];
var Dheight  = [0.8, 1.5];

var Pw_GUI   = 150;
var Grid_GUI = 100;

// Chest GUI template variables
var guiRef;                 
var mySlots = [];           
var highlightLineIds = [];  
var rows = 3;
var cols = 9;
var slotSize = 18;
var slotPadding = 0;
var offsetX = 0;
var offsetY = 36;   // chest GUI offset on screen
var highlightedSlot = null;
var storedSlotItems = [];
var lastBlock = null;  // block reference for storage

// ===== Set block model =====
function init(e){
    e.block.setModel("refurbished_furniture:computer");
}

// ===== Right-click entry point =====
function interact(e) {
    var api = e.API;
    var b   = e.block;
    var p   = e.player;

    // Show password GUI
    var passwordGui = PasswordGui(p, api, PinLength, Pw_GUI, b);
    p.showCustomGui(passwordGui);
}

// ===== Password GUI builder =====
function PasswordGui(p, api, length, guiId, b) {
    var width  = length * 30 + 20;
    var height = 140;
    var xStart = 10, yStart = 10;
    var xStep  = 24, yStep = 22;
    var size   = 22;
    var labelY = yStart;
    var keypadY = yStart + size + 10;

    var gui = api.createCustomGui(guiId, width, height, false, p);

    // Hidden label to carry block coords
    gui.addLabel(999, b.getX() + "," + b.getY() + "," + b.getZ(), 0, height-10, 1, 1);

    // PIN placeholders
    for (var i = 0; i < length; i++) {
        gui.addLabel(1 + i, "§5§l-", xStart + 5 + i * xStep, labelY + 5, size, size);
    }

    // Keypad 1-9
    for (var i = 0; i < 9; i++) {
        var col = i % 3, row = Math.floor(i / 3);
        gui.addButton(200 + i, "" + (i+1), xStart + col * xStep, keypadY + row * yStep, size, size);
    }

    // Extra keys: 0, Delete, Enter
    gui.addButton(209,"0",   xStart + 3 * xStep, keypadY + 2 * yStep, size, size);
    gui.addButton(210,"Del", xStart + 3 * xStep, keypadY + 0 * yStep, size, size);
    gui.addButton(211,"Ent", xStart + 3 * xStep, keypadY + 1 * yStep, size, size);

    return gui;
}

// ===== Keypad button handling =====
function customGuiButton(e) {
    var id  = e.buttonId;
    var gui = e.gui;
    var p   = e.player;
    var api = e.API;
    var w   = p.getWorld();

    var hidden = gui.getComponent(999);
    if (!hidden) return;
    var coords = hidden.getText().split(",");
    if (coords.length < 3) return;
    var bx = parseInt(coords[0]), by = parseInt(coords[1]), bz = parseInt(coords[2]);
    var b = w.getBlock(bx, by, bz);

    if (id >= 200 && id <= 209) {
        var digit = gui.getComponent(id).getLabel();
        for (var i = 1; i <= PinLength; i++) {
            var lbl = gui.getComponent(i);
            if (lbl.getText() === "§5§l-") {
                lbl.setText("§5§l" + digit);
                break;
            }
        }
        gui.update();
        return;
    }

    if (id === 210) {
        for (var i = PinLength; i >= 1; i--) {
            var lbl = gui.getComponent(i);
            if (lbl.getText() !== "§5§l-") {
                lbl.setText("§5§l-");
                break;
            }
        }
        gui.update();
        return;
    }

    if (id === 211) {
        var entered = [];
        for (var i = 1; i <= PinLength; i++) {
            var number = gui.getComponent(i).getText().replace(/§.|[^0-9]/g, "");
            entered.push(parseInt(number) || "-");
        }

        var correct = true;
        for (var j = 0; j < PassWord.length; j++) {
            if (entered[j] !== PassWord[j]) { correct = false; break; }
        }

        if (!correct) {
            b.timers.forceStart(1,1,false);
            p.closeGui();
            p.message("§cAccess Denied!");
            w.playSoundAt(p.getPos(), "minecraft:block.anvil.land", 0.8, 0.9);
            w.playSoundAt(p.getPos(), "minecraft:entity.villager.no", 1.0, 1.0);
        } else {
            lastBlock = b;
            openChestGui(p, api);  // Open working chest GUI
            w.playSoundAt(p.getPos(), "minecraft:entity.experience_orb.pickup", 1.0, 1.2);
            w.playSoundAt(p.getPos(), "minecraft:block.note_block.pling", 0.6, 1.6);
            p.message("§aAccess Granted!");
        }
    }
}

// ===== Working chest GUI =====
function openChestGui(player, api){
    if(!lastBlock) return;
    var W = lastBlock.getWorld();
    var keyPrefix = "safe_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";

    // Load stored items
    storedSlotItems = [];
    for (var i = 0; i < rows*cols; i++){
        storedSlotItems.push(W.getStoreddata().has(keyPrefix + i) ? W.getStoreddata().get(keyPrefix + i) : null);
    }

    highlightedSlot = null;
    highlightLineIds = [];
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

    guiRef.showPlayerInventory(offsetX, offsetY + rows*slotSize + 5, false);
    player.showCustomGui(guiRef);
}

// ===== Handle slot clicks =====
function customGuiSlotClicked(e){
    var clickedSlot = e.slot;
    var stack = e.stack;
    var player = e.player;

    var slotIndex = mySlots.indexOf(clickedSlot);
    if(slotIndex !== -1){
        highlightedSlot = clickedSlot;
        highlightLineIds.forEach(function(id){ try{ guiRef.removeComponent(id); }catch(e){} });
        highlightLineIds = [];

        var row = Math.floor(slotIndex / cols);
        var col = slotIndex % cols;
        var x = offsetX + col*(slotSize+slotPadding);
        var y = offsetY + row*(slotSize+slotPadding);
        var w = slotSize, h = slotSize;
        highlightLineIds.push(guiRef.addColoredLine(1,x,y,x+w,y,0xADD8E6,2));
        highlightLineIds.push(guiRef.addColoredLine(2,x,y+h,x+w,y+h,0xADD8E6,2));
        highlightLineIds.push(guiRef.addColoredLine(3,x,y,x,y+h,0xADD8E6,2));
        highlightLineIds.push(guiRef.addColoredLine(4,x+w,y,x+w,y+h,0xADD8E6,2));
        guiRef.update();
        return;
    }

    if(!highlightedSlot) return;

    try{
        var slotStack = highlightedSlot.getStack();
        var maxStack = stack ? stack.getMaxStackSize() : 64;

        if(stack && !stack.isEmpty()){
            if(slotStack && !slotStack.isEmpty() && slotStack.getDisplayName() === stack.getDisplayName()){
                var total = slotStack.getStackSize() + stack.getStackSize();
                if(total <= maxStack){
                    slotStack.setStackSize(total);
                    highlightedSlot.setStack(slotStack);
                    player.removeItem(stack, stack.getStackSize());
                } else {
                    var overflow = total - maxStack;
                    slotStack.setStackSize(maxStack);
                    highlightedSlot.setStack(slotStack);

                    var overflowCopy = player.world.createItemFromNbt(stack.getItemNbt());
                    overflowCopy.setStackSize(overflow);
                    player.removeItem(stack, stack.getStackSize());
                    player.giveItem(overflowCopy);
                }
            } else {
                var itemCopy = player.world.createItemFromNbt(stack.getItemNbt());
                if(slotStack && !slotStack.isEmpty()) player.giveItem(slotStack);
                highlightedSlot.setStack(itemCopy);
                player.removeItem(stack, stack.getStackSize());
            }
        } else if(slotStack && !slotStack.isEmpty()){
            player.giveItem(slotStack);
            highlightedSlot.setStack(player.world.createItem("minecraft:air", 1));
        }

        guiRef.update();
    } catch(e){}
}

// ===== Persist chest contents =====
function customGuiClosed(e){
    if(e.gui.getID() !== Grid_GUI) return;
    var player = e.player;
    var gui = e.gui;
    var W = player.getWorld();
    if(!lastBlock) return;

    var keyPrefix = "safe_" + lastBlock.getX() + "_" + lastBlock.getY() + "_" + lastBlock.getZ() + "_";
    mySlots.forEach(function(slot, i){
        var st = slot.getStack();
        if(!st || st.getName() === "minecraft:air"){
            W.getStoreddata().remove(keyPrefix + i);
        } else {
            W.getStoreddata().put(keyPrefix + i, st.getItemNbt().toJsonString());
        }
    });
}
