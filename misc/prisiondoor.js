var lockedModel = "minecraft:iron_door";
var unlockedModel = "minecraft:iron_door";

// Track state
var running = false;
var startTick = 0;
var duration = 1200; // 1 min in ticks

// --- Player interact ---
function interact(t) {
    t.setCanceled(true); // cancel vanilla toggle

    if (running) {
        var now = t.block.world.getTime();
        var elapsed = now - startTick;
        var remaining = duration - elapsed;

        if (remaining > 0) {
            var secondsLeft = Math.ceil(remaining / 20);
            t.player.message("§eTimer is running. " + secondsLeft + "s remaining.");
        } else {
            t.player.message("§eTimer is finishing soon...");
        }
        return;
    }

    // Ensure it starts closed + locked look
    t.block.setOpen(false);
    t.block.setBlockModel(lockedModel);

    // Start 1 minute countdown
    t.block.timers.forceStart(1, duration, false);
    running = true;
    startTick = t.block.world.getTime();

    t.player.message("Timer started... door will open in 1 minute.");
}

// --- Timer handler ---
function timer(t) {
    if (t.id == 1) {
        // After 1 minute → open for 10s
        t.block.setOpen(true);
        t.block.setBlockModel(unlockedModel);
        t.block.world.broadcast("You are free!");

        // 10s open
        t.block.timers.forceStart(2, 200, false);
    }
    else if (t.id == 2) {
        // Close after 10s
        t.block.setOpen(false);
        t.block.setBlockModel(lockedModel);
    

        running = false;
        startTick = 0;
    }
}
