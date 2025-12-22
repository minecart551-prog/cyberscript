// gui ids
var ID_JOB_LABEL = 10;
var ID_START_JOB_BUTTON = 11;
var ID_STOP_JOB_BUTTON = 12;
var ID_LABEL_SPAWN   = 20;
var ID_LABEL_COUNTER = 21;
var ID_FIELD_SPAWN   = 22;
var ID_FIELD_COUNTER = 23;

// section config
var SECTIONS = [
    { name: "Drinks", startX: -150, startY: -60, rows: 6, columns: 4, slotSpacingX: 20, slotSpacingY: 20 },
    { name: "Food", startX: 200, startY: -60, rows: 6, columns: 4, slotSpacingX: 20, slotSpacingY: 20 }
];

// runtime
var mySlots = [];
var slotPositions = [];
var selectedSlots = [];
var slotHighlights = {};
var highlightedAdminSlot = null;
var adminHighlightLines = [];
var guiRef = null;
var lastNpc = null;
var storedSlotItems = [];
var isAdminGui = false;
var nextLineId = 1000;
var slotPositionsBuilt = false;

// interact
function interact(event) {
    var player = event.player;
    var api = event.API;
    lastNpc = event.npc;
    var held = player.getMainhandItem();
    if (held && !held.isEmpty() && held.getName() === "minecraft:bedrock") openAdminGui(player, api);
    else openPlayerGui(player, api);
}

// build slot positions (only once)
function buildSlotPositions() {
    if (slotPositionsBuilt) return;
    slotPositions = [];
    SECTIONS.forEach(function(section) {
        for (var r = 0; r < section.rows; r++)
            for (var c = 0; c < section.columns; c++)
                slotPositions.push({ x: section.startX + c * section.slotSpacingX, y: section.startY + r * section.slotSpacingY });
    });
    slotPositionsBuilt = true;
}

// load/save npc menu items
function loadNpcMenuItems(npc) {
    var data = npc.getStoreddata();
    return data.has("MenuItems") ? JSON.parse(data.get("MenuItems")) : [];
}

// simplified: store only item names instead of full NBT
function saveNpcMenuItems(npc) {
    var names = mySlots.map(function(slot){
        var stack = slot.getStack();
        if(stack && !stack.isEmpty()){
            var nbt = stack.getItemNbt();
            if(nbt && nbt.tag && nbt.tag.display && nbt.tag.display.Name){
                return nbt.tag.display.Name.replace(/["']/g,"");
            } else {
                return stack.getName(); // fallback to item ID
            }
        }
        return null;
    });
    npc.getStoreddata().put("MenuItems", JSON.stringify(names));
}

// admin gui
function openAdminGui(player, api) {
    isAdminGui = true;
    highlightedAdminSlot = null;
    adminHighlightLines = [];
    buildSlotPositions();
    storedSlotItems = loadNpcMenuItems(lastNpc);
    guiRef = api.createCustomGui(176, 166, 0, true, player);

    guiRef.addLabel(ID_JOB_LABEL, "Admin Menu Setup", 11, -110, 156, 12).setColor(0xFFFFFF);

    var npcData = lastNpc.getStoreddata();
    var spawnText = npcData.has("CustomerSpawn") ? npcData.get("CustomerSpawn") : "";
    var counterText = npcData.has("CounterPos") ? npcData.get("CounterPos") : "";

    guiRef.addLabel(ID_LABEL_SPAWN, "Customer Spawn (x y z)", 10, 10, 156, 12);
    guiRef.addTextField(ID_FIELD_SPAWN, 10, 25, 156, 18).setText(spawnText);
    guiRef.addLabel(ID_LABEL_COUNTER, "Counter Position (x y z)", 10, 50, 156, 12);
    guiRef.addTextField(ID_FIELD_COUNTER, 10, 65, 156, 18).setText(counterText);

    mySlots = [];
    for (var i = 0; i < slotPositions.length; i++) {
        var pos = slotPositions[i];
        var slot = guiRef.addItemSlot(pos.x, pos.y);
        // try to restore stack, we keep full stack for display in GUI
        if (storedSlotItems[i]) {
            try {
                var dummy = player.world.createItem(stackFromName(storedSlotItems[i]), 1);
                slot.setStack(dummy);
            } catch(e){}
        }
        mySlots.push(slot);
    }

    guiRef.showPlayerInventory(10, 90, false);
    player.showCustomGui(guiRef);
}

// helper to create dummy stack from item name
function stackFromName(name){
    var parts = name.split(":");
    if(parts.length === 2) return parts[0]+":"+parts[1];
    return "minecraft:stone"; // fallback
}

// player gui
function openPlayerGui(player, api) {
    isAdminGui = false;
    buildSlotPositions();
    storedSlotItems = loadNpcMenuItems(lastNpc);
    selectedSlots = player.getStoreddata().has("SelectedMenuSlots") ? JSON.parse(player.getStoreddata().get("SelectedMenuSlots")) : [];
    renderPlayerGui(player, api);
}

function renderPlayerGui(player, api) {
    guiRef = api.createCustomGui(176, 166, 0, true, player);
    guiRef.addLabel(ID_JOB_LABEL, "Restaurant Menu", 10, -110, 156, 12).setColor(0xFFFFFF);

    mySlots = [];
    slotHighlights = {};
    nextLineId = 1000;

    for (var i = 0; i < slotPositions.length; i++) {
        var pos = slotPositions[i];
        var slot = guiRef.addItemSlot(pos.x, pos.y);
        if (storedSlotItems[i]) {
            try {
                var dummy = player.world.createItem(stackFromName(storedSlotItems[i]), 1);
                slot.setStack(dummy);
            } catch(e){}
        }
        mySlots.push(slot);
    }

    selectedSlots.forEach(function(idx){ if(idx>=0 && idx<mySlots.length) drawHighlight(idx); });

    guiRef.addButton(ID_START_JOB_BUTTON, "Start Job", 10, 90, 70, 20);
    guiRef.addButton(ID_STOP_JOB_BUTTON, "Stop Job", 90, 90, 70, 20);

    player.showCustomGui(guiRef);
}

// slot click
function customGuiSlotClicked(event) {
    var clickedSlot = event.slot, stack = event.stack, player = event.player, index = mySlots.indexOf(clickedSlot);
    if (isAdminGui) {
        if (index!==-1) { highlightedAdminSlot=clickedSlot; clearAdminHighlight(); var pos=slotPositions[index]; drawAdminHighlight(pos.x,pos.y); guiRef.update(); return; }
        if(!highlightedAdminSlot) return;
        if(!stack || stack.isEmpty()) { highlightedAdminSlot.setStack(player.world.createItem("minecraft:air",1)); guiRef.update(); return; }
        var copy = player.world.createItemFromNbt(stack.getItemNbt()); copy.setStackSize(stack.getStackSize()); highlightedAdminSlot.setStack(copy); guiRef.update(); return;
    }
    if(index===-1) return; toggleHighlight(index,player,event.API);
}

// admin highlight
function drawAdminHighlight(x,y){ var w=18,h=18; adminHighlightLines=[ guiRef.addColoredLine(1,x,y,x+w,y,0xADD8E6,2), guiRef.addColoredLine(2,x,y+h,x+w,y+h,0xADD8E6,2), guiRef.addColoredLine(3,x,y,x,y+h,0xADD8E6,2), guiRef.addColoredLine(4,x+w,y,x+w,y+h,0xADD8E6,2) ]; }
function clearAdminHighlight(){ adminHighlightLines.forEach(function(id){ try{guiRef.removeComponent(id);}catch(e){} }); adminHighlightLines=[]; }

// player highlight
function toggleHighlight(index,player,api){ var pos=selectedSlots.indexOf(index); if(pos!==-1) selectedSlots.splice(pos,1); else selectedSlots.push(index); player.getStoreddata().put("SelectedMenuSlots",JSON.stringify(selectedSlots)); renderPlayerGui(player,api); }
function drawHighlight(index){ var pos=slotPositions[index],x=pos.x,y=pos.y,w=18,h=18; slotHighlights[index]=[ guiRef.addColoredLine(nextLineId++,x,y,x+w,y,0xADD8E6,2), guiRef.addColoredLine(nextLineId++,x,y+h,x+w,y+h,0xADD8E6,2), guiRef.addColoredLine(nextLineId++,x,y,x,y+h,0xADD8E6,2), guiRef.addColoredLine(nextLineId++,x+w,y,x+w,y+h,0xADD8E6,2) ]; }

// parse coordinates string
function parseCoordsString(str){ if(!str)return null; var p=str.split(/[ ,]+/); if(p.length<3)return null; var x=parseFloat(p[0]),y=parseFloat(p[1]),z=parseFloat(p[2]); if(isNaN(x)||isNaN(y)||isNaN(z))return null; return {x:x,y:y,z:z}; }

// spawn customer clone
function spawnCustomerCloneAtManager(player){
    if(!lastNpc) return;
    var npcData=lastNpc.getStoreddata();
    var spawnStr=npcData.has("CustomerSpawn")?npcData.get("CustomerSpawn"):null;
    var spawn=parseCoordsString(spawnStr);
    if(!spawn) spawn={x:lastNpc.getX?lastNpc.getX():0,y:lastNpc.getY?lastNpc.getY():0,z:lastNpc.getZ?lastNpc.getZ():0};

    var world=player.world;
    try{ world.spawnClone(Math.floor(spawn.x),Math.floor(spawn.y),Math.floor(spawn.z),3,"customer"); } catch(e){ try{ world.spawnClone(spawn.x,spawn.y,spawn.z,3,"customer"); }catch(e2){} }

    var nearby=[]; try{ nearby=world.getNearbyEntities(Math.floor(spawn.x),Math.floor(spawn.y),Math.floor(spawn.z),8,2); }catch(e){ try{nearby=world.getNearbyEntities(spawn.x,spawn.y,spawn.z,8,2);}catch(e2){nearby=[];} }

    var menu=loadNpcMenuItems(lastNpc);
    var counterStr=npcData.has("CounterPos")?npcData.get("CounterPos"):null;
    var counter=parseCoordsString(counterStr);
    if(!counter) counter={x:lastNpc.getX?lastNpc.getX():spawn.x,y:lastNpc.getY?lastNpc.getY():spawn.y,z:lastNpc.getZ?lastNpc.getZ():spawn.z};
    var counterJson=JSON.stringify(counter);

    for(var i=0;i<nearby.length;i++){
        var ent=nearby[i]; try{
            if(!ent||!ent.getName) continue;
            if(ent.getName()!="customer") continue;
            var eData=ent.getStoreddata();
            if(eData.has("InitializedByManager")) continue;
            eData.put("RestaurantMenu",JSON.stringify(menu)); // now stores only item names
            eData.put("CounterPos",counterJson);
            eData.put("InitializedByManager","true");
            break;
        }catch(e){}
    }
}

// buttons
function customGuiButton(event){
    var player=event.player;
    if(event.buttonId===ID_START_JOB_BUTTON){
        player.getStoreddata().put("RestaurantJobActive","true");
        player.message("Job started");
        spawnCustomerCloneAtManager(player);
    }
    if(event.buttonId===ID_STOP_JOB_BUTTON){
        player.getStoreddata().put("RestaurantJobActive","false");
        player.message("Job stopped");
    }
}

// save admin data
function customGuiClosed(event){
    if(!isAdminGui || !lastNpc) return;
    var gui=event.gui;
    var npcData=lastNpc.getStoreddata();
    saveNpcMenuItems(lastNpc);

    var spawnField=gui.getComponent(ID_FIELD_SPAWN);
    var counterField=gui.getComponent(ID_FIELD_COUNTER);
    if(spawnField && counterField){
        npcData.put("CustomerSpawn",spawnField.getText());
        npcData.put("CounterPos",counterField.getText());
    }
}
