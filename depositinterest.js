var deposits = {};

function interact(event) {
    var player = event.player;

    var gui = event.API.createCustomGui(1, 176, 166, true, player);
    gui.addItemSlot(50, 40);  // slot 0 deposit
    gui.addItemSlot(100, 40); // slot 1 withdraw
    gui.addLabel(2, "Deposit diamonds in slot", 10, 10, 120, 20);

    player.showCustomGui(gui);
}

function customGuiSlotClicked(event) {
    var player = event.player;
    var slot = event.slot;

    if (slot == 0) {
        // Player clicked deposit slot
        var cursor = player.getMainhandItem();
        if (cursor != null && cursor.getName() == "minecraft:diamond") {
            var count = cursor.getStackSize();

            // take diamonds from hand
            player.setMainhandItem(null);

            // record deposit
            deposits[player.getName()] = {count: count, time: player.world.getTime()};

            // display them in deposit slot
            event.gui.setSlot(0, event.API.createItem("minecraft:diamond", count));
            player.message("Deposited " + count + " diamonds!");
        } else {
            player.message("Hold diamonds in your hand and click deposit slot.");
        }
    }

    if (slot == 1) {
        var data = deposits[player.getName()];
        if (data) {
            var elapsed = player.world.getTime() - data.time;
            if (elapsed >= 20 * 60) {
                var emeralds = data.count;
                player.giveItem(event.API.createItem("minecraft:emerald", emeralds));
                player.message("Withdrew " + emeralds + " emerald(s)!");
                delete deposits[player.getName()];
                event.gui.setSlot(0, null);
                event.gui.setSlot(1, null);
            } else {
                player.message("Deposit not ready yet!");
            }
        }
    }
}
