function init(event) {
    var npc = event.npc;
    var world = npc.getWorld();
    var API = event.API;

    // Full police spinner model NBT as a single NBT string
    var nbtString = '{' +
    'id:"bbs:model",' +
    'Count:1b,' +
    'tag:{' +
    'display:{Lore:["\\"(+NBT)\\""]},' +
    'BlockEntityTag:{' +
    'id:"bbs:model_block_entity",' +
    'Properties:{' +
    'enabled:1b,' +
    'global:0b,' +
    'shadow:0b,' +
    'transform:{t:[0.0f,-0.812f,0.0f],r:[0.0f,0.0f,0.0f],r2:[0.0f,0.0f,0.0f],s:[23.25f,24.25f,25.25f]},' +
    'transformInventory:{t:[0.0f,0.0f,0.0f],r:[0.0f,0.0f,0.0f],r2:[0.0f,0.0f,0.0f],s:[1.0f,1.0f,1.0f]},' +
    'transformThirdPerson:{t:[0.0f,0.0f,0.0f],r:[0.0f,0.0f,0.0f],r2:[0.0f,0.0f,0.0f],s:[1.0f,1.0f,1.0f]},' +
    'transformFirstPerson:{t:[0.0f,0.0f,-0.25f],r:[0.0f,0.0f,0.0f],r2:[0.0f,0.0f,0.0f],s:[1.0f,1.0f,1.0f]},' +
    'form:{' +
    'hitboxWidth:0.5f,' +
    'hitboxSneakMultiplier:0.9f,' +
    'lighting:1.0f,' +
    'visible:1b,' +
    'color:-1,' +
    'model:"traffic/policespinner/",' +
    'hitboxHeight:1.8f,' +
    'step_height:0.5f,' +
    'uiScale:1.0f,' +
    'animatable:1b,' +
    'hp:20.0f,' +
    'shaderShadow:1b,' +
    'movement_speed:0.1f,' +
    'keybind:0,' +
    'hitboxEyeHeight:0.9f,' +
    'name:"",' +
    'id:"bbs:model",' +
    'lighting:1.0f,' +
    'transform_overlay:{t:[0.0f,0.0f,0.0f],r:[0.0f,0.0f,0.0f],r2:[0.0f,0.0f,0.0f],s:[1.0f,1.0f,1.0f]},' +
    'transform:{t:[0.0f,0.0f,0.0f],r:[0.0f,0.0f,0.0f],r2:[0.0f,0.0f,0.0f],s:[1.0f,1.0f,1.0f]},' +
    'pose:{pose:{' +
    'frontlight:{r2:[0.0f,0.0f,0.0f],fix:0.0f,lighting:1.0f,t:[0.0f,0.0f,0.0f],color:-1,r:[0.0f,0.0f,0.0f],s:[1.0f,1.0f,1.0f]},' +
    'redlight:{r2:[0.0f,0.0f,0.0f],fix:0.0f,lighting:1.0f,t:[0.0f,0.0f,0.0f],color:-1,r:[0.0f,0.0f,0.0f],s:[1.0f,1.0f,1.0f]}' +
    '},static:0b},' +
    'anchor:{actor:-1,attachment:"",translate:0b},' +
    'hitbox:0b,' +
    'stateTriggers:{list:[]},' +
    'shape_keys:{keys:{}},' +
    'pose_overlay:{static:0b},' +
    'bodyParts:{},' +
    'actions:{}' +
    '}' +
    '}' +
    '}' +
    '}' +
    '}';

    // Convert string to NBT and create an actual item
    var nbt = API.stringToNbt(nbtString);
    var item = world.createItemFromNbt(nbt);

    // Give to NPC
    npc.setMainhandItem(item);
}
