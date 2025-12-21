
var skinAvail = 34;
var rewardItem = "minecraft:echo_shard";  
var rewardCount = 10;                 

function init(e){
    var npc = e.npc;
    var item = npc.world.createItem(rewardItem, rewardCount);
    var display = npc.getDisplay();
    
    npc.getStats().setMaxHealth(400);
    npc.getStats().getRanged().setStrength(25);
    npc.getStats().getRanged().setAccuracy(70);
    npc.getInventory().setDropItem(1, item, 100);

    var isMale = Math.random() < 0.5;

    if (isMale) {
        var maleSkins = [];
        for (var i = 1; i <= skinAvail; i++) {
            var num = (i < 10 ? "0" + i : i);
            maleSkins.push("cyberpunkskins:textures/b/b" + num + ".png");
        } 
         display.setSkinTexture(randomFrom(maleSkins));    
    } else {
        var femaleSkins = [];
        for (var i = 1; i <= skinAvail; i++) {
            var num = (i < 10 ? "0" + i : i);
            femaleSkins.push("cyberpunkskins:textures/g/g" + num + ".png");   
        } 
       display.setSkinTexture(randomFrom(femaleSkins));  
    }
}


function died(event) {
    var killer = event.source; 
    if (killer && killer.getStoreddata) {
        var pdata = killer.getStoreddata();
        var left = pdata.get("contractKillsLeft");



        if (left != null && left > 0) {
            left = left - 1;
            pdata.put("contractKillsLeft", left);

            killer.message( left + " targets remaining.");

            if (left <= 0) {
                pdata.put("canDoContract", 1);
                killer.message("§aContract complete! Return for a new one.");

            }
        }
    }
}

function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
