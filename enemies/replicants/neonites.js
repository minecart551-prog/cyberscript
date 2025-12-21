function init(event){
    var npc = event.npc;

     npc.getStats().setMaxHealth(20);
     npc.getStats().getRanged().setStrength(4);
     npc.getStats().getRanged().setDelay(17, 17);
     npc.getStats().getRanged().setBurstDelay(1);
 
}
