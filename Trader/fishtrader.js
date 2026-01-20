// ========== FISH SELLING NPC SCRIPT ==========
// Player right-clicks NPC while holding a fish to sell it
// Payment based on: Fish type (value multiplier) + Fish size

// ========== PRICING CONFIGURATION ==========
var BASE_COIN_VALUE = 3;    // Base price for 1.5x multiplier fish at typical low size
var BASE_MULTIPLIER = 1.5;  // Base multiplier (Cave Crawler)
var CURRENCY_ITEM = "coins:stone_coin"; // Stone coin currency
var CURRENCY_FALLBACK = "minecraft:gold_nugget";    // Fallback if currency doesn't exist

// Fish data: [fishName, valueMultiplier, typicalLowCm, typicalHighCm, recordHighCm]
var FISH_DATABASE = {
    // Common tier
    "tide:cave_crawler": [1.5, 45, 60, 100, "Cave Crawler"],
    "tide:deep_grouper": [1.8, 55, 75, 115, "Deep Grouper"],
    "tide:shadow_snapper": [1.8, 35, 65, 120, "Shadow Snapper"],
    "tide:cave_eel": [2.0, 90, 115, 150, "Cave Eel"],
    
    // Uncommon tier
    "tide:iron_tetra": [2.5, 2.8, 4.5, 8, "Iron Tetra"],
    "tide:lapis_lanternfish": [2.5, 5, 15, 40, "Lapis Lanternfish"],
    "tide:glowfish": [2.5, 55, 75, 110, "Glowfish"],
    "tide:anglerfish": [3.0, 20, 35, 75, "Anglerfish"],
    "tide:crystal_shrimp": [3.0, 4, 8, 15, "Crystal Shrimp"],
    "tide:abyss_angler": [3.5, 20, 35, 75, "Abyss Angler"],
    "tide:dripstone_darter": [3.5, 35, 55, 95, "Dripstone Darter"],
    
    // Rare tier
    "tide:luminescent_jellyfish": [4.5, 40, 50, 80, "Luminescent Jellyfish"],
    "tide:gilded_minnow": [5.0, 8, 15, 28, "Gilded Minnow"],
    "tide:bedrock_tetra": [5.0, 2.8, 4.5, 8, "Bedrock Tetra"],
    "tide:crystalline_carp": [5.5, 40, 80, 120, "Crystalline Carp"],
    
    // Very Rare tier
    "tide:echo_snapper": [6.5, 65, 85, 140, "Echo Snapper"],
    "tide:chasm_eel": [7.5, 120, 180, 300, "Chasm Eel"],
    
    // Legendary tier
    "tide:midas_fish": [9.0, 50, 80, 130, "Midas Fish"],
    "tide:devils_hole_pupfish": [10.0, 1.4, 2.6, 4.3, "Devil's Hole Pupfish"]
};

// ========== HELPER FUNCTIONS ==========

// Get fish size from NBT - Parse the JSON string directly
function getFishSize(itemStack) {
    try {
        var nbt = itemStack.getItemNbt();
        var nbtString = nbt.toJsonString();
        
        // Parse the JSON string to extract FishLength
        // Look for "FishLength": followed by a number
        var fishLengthMatch = nbtString.match(/"FishLength":\s*([0-9.]+)d?/);
        
        if (fishLengthMatch && fishLengthMatch[1]) {
            var size = parseFloat(fishLengthMatch[1]);
            return size;
        }
        
        return null;
    } catch(e) {
        return null;
    }
}

// Calculate size multiplier based on where the fish size falls in its range
function getSizeMultiplier(fishSize, typicalLow, typicalHigh, recordHigh) {
    if (!fishSize) {
        return 1.0;
    }
    
    if (fishSize >= recordHigh) {
        return 2.5;
    } else if (fishSize >= typicalHigh) {
        var percent = (fishSize - typicalHigh) / (recordHigh - typicalHigh);
        return 1.3 + (percent * 0.7);
    } else if (fishSize >= typicalLow) {
        var percent = (fishSize - typicalLow) / (typicalHigh - typicalLow);
        return 1.0 + (percent * 0.3);
    } else {
        return 0.8;
    }
}

// Format size for display
function formatSize(size) {
    if (!size) return "unknown";
    if (size < 1) return (size * 10).toFixed(1) + "mm";
    return size.toFixed(1) + "cm";
}

// Calculate total price
function calculatePrice(fishData, fishSize) {
    var valueMultiplier = fishData[0];
    var typicalLow = fishData[1];
    var typicalHigh = fishData[2];
    var recordHigh = fishData[3];
    
    var basePrice = (valueMultiplier / BASE_MULTIPLIER) * BASE_COIN_VALUE;
    var sizeMultiplier = getSizeMultiplier(fishSize, typicalLow, typicalHigh, recordHigh);
    
    return Math.round(basePrice * sizeMultiplier);
}

// Get size category for message
function getSizeCategory(fishSize, typicalLow, typicalHigh, recordHigh) {
    if (!fishSize) return "";
    
    if (fishSize >= recordHigh) {
        return "§6§lRECORD SIZE ";
    } else if (fishSize >= typicalHigh) {
        return "§e§lLARGE ";
    } else if (fishSize >= typicalLow) {
        return "§a";
    } else {
        return "§7Small ";
    }
}

// ========== MAIN INTERACTION ==========
function interact(event) {
    var player = event.player;
    var npc = event.npc;
    var world = player.world;
    
    var heldItem = player.getMainhandItem();
    
    if (!heldItem || heldItem.isEmpty()) {
        npc.say("§eHold a fish in your hand to sell it to me!");
        return;
    }
    
    var itemId = heldItem.getName();
    
    if (!FISH_DATABASE[itemId]) {
        npc.say("§cI don't buy " + heldItem.getDisplayName() + "!");
        return;
    }
    
    var fishData = FISH_DATABASE[itemId];
    var fishName = fishData[4];
    
    // Get fish size
    var fishSize = getFishSize(heldItem);
    
    var price = calculatePrice(fishData, fishSize);
    var sizeCategory = getSizeCategory(fishSize, fishData[1], fishData[2], fishData[3]);
    var sizeText = formatSize(fishSize);
    
    var currency;
    try {
        currency = world.createItem(CURRENCY_ITEM, price);
    } catch(e) {
        currency = world.createItem(CURRENCY_FALLBACK, price);
    }
    
    heldItem.setStackSize(heldItem.getStackSize() - 1);
    player.giveItem(currency);
    
    // NPC message
    if (fishSize && fishSize >= fishData[3]) {
        npc.say("§6§l★ RECORD SIZE! ★");
        npc.say("§eSold " + fishName + " " + sizeCategory + sizeText + " for §6" + price + " coins§e!");
        player.message("§6§l★ You caught a RECORD SIZE fish! ★");
    } else if (fishSize && fishSize >= fishData[2]) {
        npc.say("§eSold " + fishName + " " + sizeCategory + sizeText + " for §6" + price + " coins§e!");
    } else if (!fishSize) {
        npc.say("§eSold " + fishName + " for §6" + price + " coins§e!");
    } else {
        npc.say("§eSold " + fishName + " " + sizeCategory + sizeText + " for §6" + price + " coins§e!");
    }
}

function role(event) {
    var npc = event.npc;
    npc.say("§eI buy all kinds of fish from the underground!");
    npc.say("§aHold a fish in your hand and right-click me to sell it.");
    npc.say("§7Larger fish are worth more coins!");
}
