function interact(event) {
    var npc = event.npc;
    var item = npc.getMainhandItem();
    
    if (!item || item.isEmpty()) {
        npc.say("No item in main hand.");
        return;
    }
    
    var nbt = item.getItemNbt();
    npc.say("NBT: " + nbt.toJsonString());
}
