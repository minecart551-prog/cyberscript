function isItemNull(item) {
    return item == null || item.getName() == "minecraft:air";
}

function compareItem(a, b) {
    if (isItemNull(a)) return isItemNull(b);
    return a.compare(b, false);
}

function role(event) {

    var c1 = event.currency1;
    var c2 = event.currency2;
    var sold = event.sold;
    var player = event.player;
    var role = event.npc.getRole();


    if (!playerHasItems(player, c1) || !playerHasItems(player, c2)) {
        return; 
    }


    for (var i = 0; i < 18; i++) {
        if (
            compareItem(c1, role.getCurrency1(i)) &&
            compareItem(c2, role.getCurrency2(i)) &&
            compareItem(sold, role.getSold(i))
        ) {
            role.remove(i);
            break;
        }
    }
}


function playerHasItems(player, itemStack) {
    if (isItemNull(itemStack)) return true; 

    var neededCount = itemStack.getStackSize();
    var found = 0;

    var inventory = player.getInventory();
    for (var i = 0; i < inventory.getSize(); i++) {
        var slotItem = inventory.getSlot(i);
        if (!isItemNull(slotItem) && slotItem.getName() == itemStack.getName()) {
            found += slotItem.getStackSize();
            if (found >= neededCount) return true;
        }
    }

    return false; 
}