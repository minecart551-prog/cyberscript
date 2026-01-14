// --- Contract giver NPC ---
var contractCoords = [
    { x: 2330, y: -52, z: 1058 },
    { x: 2056, y: -52, z: 868 },
    { x: 2207, y: -52, z: 1653 },
    { x: 2215, y: -52, z: 1772 },
    { x: 2192, y: -52, z: 1857 },
    { x: 2397, y: -41, z: 2152 },
    { x: 2186, y: -52, z: 463 },
    { x: 2574, y: -52, z: 246 },
    { x: 2182, y: -52, z: 98 },
    { x: 2476, y: -52, z: -92 },
    { x: 2323, y: -51, z: -305 },
    { x: 2063, y: -52, z: -301 },
    { x: 1954, y: -47, z: -281 },
    { x: 1885, y: -52, z: -176 },
    { x: 1774, y: -52, z: -169 },
    { x: 1516, y: -47, z: -333 },
    { x: 1398, y: -42, z: -327 },
    { x: 1142, y: -42, z: -317 },
    { x: 1103, y: -26, z: -259 },
    { x: 1085, y: -26, z: -221 },
    { x: 1062, y: -31, z: -180 },
    { x: 1096, y: -26, z: -231 },
    { x: 1813, y: -42, z: -1100 },
    { x: 2540, y: -52, z: -647 }
];

var enemyTypes = [
    { tab: 1, name: "B1" }
];

function interact(event) {
    var player = event.player;
    var pdata = player.getStoreddata();

    // --- First-time initialization ---
    if (!pdata.has("canDoContract")) {
        pdata.put("canDoContract", 1);
        pdata.put("contractKillsLeft", 0);
        player.message("§aYou are now eligible for contracts.");
        return;
    }

    var canDo = parseInt(pdata.get("canDoContract"));

    // --- Give new contract ---
    if (canDo === 1) {
        var idx = Math.floor(Math.random() * contractCoords.length);
        var coord = contractCoords[idx];

        var numTargets = 1;

        for (var i = 0; i < numTargets; i++) {
            var type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            event.npc.getWorld().spawnClone(coord.x, coord.y, coord.z, type.tab, type.name);
        }

        // Save contract info
        pdata.put("contractKillsLeft", numTargets);
        pdata.put("contractX", coord.x);
        pdata.put("contractY", coord.y);
        pdata.put("contractZ", coord.z);
        pdata.put("canDoContract", 0);

        event.npc.say(
            "§aContract assigned. Target location: §e(" +
            coord.x + ", " + coord.y + ", " + coord.z + ")§r"
        );

    // --- Reminder if contract is active ---
    } else {
        var left = parseInt(pdata.get("contractKillsLeft"));

        if (left > 0) {
            var x = pdata.get("contractX");
            var y = pdata.get("contractY");
            var z = pdata.get("contractZ");

            player.message(
                "§eActive contract location: §6(" +
                x + ", " + y + ", " + z + ")§r"
            );
            player.message("§cTargets remaining: §e" + left);
        }
    }
}
