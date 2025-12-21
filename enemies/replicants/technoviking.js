function init(event){
    var npc = event.npc;

     npc.getStats().setMaxHealth(55);
     npc.getStats().getRanged().setStrength(8);
 
}
