// ── GUI window size ──────────────────────────────────────────
var GUI_WIDTH  = 176;   // total width  of the GUI window
var GUI_HEIGHT = 166;   // total height of the GUI window

// ── Reel (item slot) settings ────────────────────────────────
var REEL_CENTER_X  = 87;    // X centre of the 3 reels together (0 = GUI centre)
var REEL_Y         = -35;   // Y position of the reel row (negative = higher)
var REEL_SLOT_SIZE = 18;    // visual size of each reel slot (used for frame calc)
var REEL_GAP       = 10;    // gap between adjacent reel slots

// ── Gold frame around the reels ──────────────────────────────
var FRAME_PADDING   = 5;        // extra space between slot edge and frame line
var FRAME_COLOR     = 0xFFD700; // colour of the frame (hex)
var FRAME_THICKNESS = 2;        // line thickness in pixels

// ── Title label ──────────────────────────────────────────────
var TITLE_X     = 24;    // X position
var TITLE_Y     = -75;   // Y position  (negative = higher up)
var TITLE_SCALE = 1.0;   // font scale  (1.0 = normal)

// ── Coin counter label ───────────────────────────────────────
var COINS_X     = -40;   // X position
var COINS_Y     = -90;   // Y position
var COINS_SCALE = 0.8;   // font scale

// ── Status / result message label ───────────────────────────
var MSG_X     = 33;    // X position
var MSG_Y     = -10;   // Y position
var MSG_SCALE = 0.85;  // font scale

// ── Payout hint label (bottom of GUI) ───────────────────────
var HINT_X     = -45;  // X position
var HINT_Y     = 80;   // Y position
var HINT_SCALE = 0.65; // font scale

// ── Bet buttons ──────────────────────────────────────────────
var BTN_CENTER_X = 85;   // X centre of the 3 buttons together (0 = GUI centre)
var BTN_Y        = 18;   // Y position of the button row
var BTN_WIDTH    = 48;   // width  of each bet button
var BTN_HEIGHT   = 20;   // height of each bet button
var BTN_GAP      = 8;    // gap between buttons

// ╔══════════════════════════════════════════════════════════╗
// ║                  ★  GAME CONFIG  ★                      ║
// ╚══════════════════════════════════════════════════════════╝

// ── Slot display items (item IDs shown in the reels) ────────
var SYMBOLS = [
    "minecraft:diamond",        // 0  Diamond   (very rare)
    "minecraft:gold_ingot",     // 1  Gold       (rare)
    "minecraft:emerald",        // 2  Emerald    (rare)
    "minecraft:iron_ingot",     // 3  Iron       (uncommon)
    "minecraft:redstone",       // 4  Redstone   (uncommon)
    "minecraft:coal",           // 5  Coal       (common)
    "minecraft:bone",           // 6  Bone       (common)
];

// Symbol weights — higher number = appears more often
// Must have one entry per SYMBOLS entry
var SYMBOL_WEIGHTS = [1, 3, 4, 6, 7, 9, 10];

// ── Payout table (multiplier x bet) ─────────────────────────
//   Keys are sorted symbol indices joined by commas.
//   Any two-of-a-kind not listed below -> 1.5x (handled in code).
var PAYOUTS = {
    "0,0,0": 75,   // 3x Diamond (still rare, still hype)
    "1,1,1": 30,   // 3x Gold
    "2,2,2": 22,   // 3x Emerald
    "3,3,3": 14,   // 3x Iron
    "4,4,4": 11,   // 3x Redstone
    "5,5,5": 7,    // 3x Coal (buffed)
    "6,6,6": 5,    // 3x Bone (buffed)
    "0,1,2": 18,
    "1,2,3": 8
};

// ── Bet options in stone coins (cents) ───────────────────────
var BET_OPTIONS = [10, 50, 200];

// ── Spin phases (per reel): FAST → MEDIUM → SLOW → lock ─────
//
//   *_INTERVAL : ticks between symbol flips (1 = fastest possible)
//   *_DURATION : how many ticks the reel spends in that phase
//
//   All three reels share the same phase durations but are offset
//   by SPIN_STAGGER ticks so they lock one after another.
//
//   Total spin time per reel ≈ FAST_DURATION + MEDIUM_DURATION + SLOW_DURATION
//   Reel 0 locks first, reel 1 after +STAGGER, reel 2 after +2×STAGGER.

var PHASE_FAST_INTERVAL   = 1;   // flip every tick  (blazing)
var PHASE_FAST_DURATION   = 4;     // ticks in fast phase

var PHASE_MEDIUM_INTERVAL = 3;   // flip every 3 ticks
var PHASE_MEDIUM_DURATION = 4;   // ticks in medium phase

var PHASE_SLOW_INTERVAL   = 7;   // flip every 7 ticks
var PHASE_SLOW_DURATION   = 3;   // ticks in slow phase before locking

var SPIN_STAGGER          = 23;  // extra ticks between each reel locking

// ── Currency conversion rates ────────────────────────────────
var STONE_TO_COAL   = 100;
var COAL_TO_EMERALD = 100;

// ╔══════════════════════════════════════════════════════════╗
// ║              INTERNAL — do not edit below               ║
// ╚══════════════════════════════════════════════════════════╝

var ID_BET_0    = 10;
var ID_BET_1    = 11;
var ID_BET_2    = 12;
var ID_TITLE    = 20;
var ID_MSG      = 21;
var ID_COINS    = 22;
var ID_SPIN_LBL = 23;

var guiRef     = null;
var lastBlock  = null;
var lastPlayer = null;
var lastApi    = null;
var reelSlots  = [];

var spinning       = false;
var spinTick       = 0;
var currentBet     = 0;
var finalSymbols   = [-1, -1, -1];
var displaySymbols = [0, 0, 0];

// Per-reel animation state
var reelLocked     = [false, false, false];
var reelPhase      = [0, 0, 0];      // 0=FAST, 1=MEDIUM, 2=SLOW
var reelPhaseStart = [0, 0, 0];      // spinTick when current phase began
var reelNextFlip   = [0, 0, 0];      // spinTick when this reel next flips
var reelStart      = [0, 0, 0];      // spinTick when this reel begins spinning

// ── Derived layout helpers ───────────────────────────────────
function getReelBaseX() {
    return REEL_CENTER_X - (3 * REEL_SLOT_SIZE + 2 * REEL_GAP) / 2;
}

function getBtnStartX() {
    return BTN_CENTER_X - (3 * BTN_WIDTH + 2 * BTN_GAP) / 2;
}

function intervalForPhase(phase) {
    if (phase === 0) return PHASE_FAST_INTERVAL;
    if (phase === 1) return PHASE_MEDIUM_INTERVAL;
    return PHASE_SLOW_INTERVAL;
}

function durationForPhase(phase, reel) {
    if (phase === 0) return PHASE_FAST_DURATION;
    if (phase === 1) return PHASE_MEDIUM_DURATION + reel * SPIN_STAGGER;
    return PHASE_SLOW_DURATION;
}

// ── Block init ───────────────────────────────────────────────
function init(event) {
    event.block.setModel("minecraft:jukebox");
    event.block.setRotation(0, 0, 0);
}

// ── Open GUI ─────────────────────────────────────────────────
function interact(event) {
    var player = event.player;
    var api    = event.API;
    lastBlock  = event.block;
    lastPlayer = player;
    lastApi    = api;

    if (spinning) {
        player.message("§cThe machine is currently spinning!");
        return;
    }

    spinTick       = 0;
    displaySymbols = [0, 0, 0];
    finalSymbols   = [-1, -1, -1];
    currentBet     = 0;

    guiRef = api.createCustomGui(GUI_WIDTH, GUI_HEIGHT, 0, true, player);

    guiRef.addLabel(ID_TITLE, "§6§lCASINO SLOT MACHINE", TITLE_X, TITLE_Y, TITLE_SCALE, TITLE_SCALE);

    reelSlots = [];
    var reelBaseX = getReelBaseX();
    for (var r = 0; r < 3; r++) {
        var rx   = reelBaseX + r * (REEL_SLOT_SIZE + REEL_GAP);
        var slot = guiRef.addItemSlot(rx, REEL_Y);
        reelSlots.push(slot);
        try {
            var initItem = player.world.createItem(SYMBOLS[displaySymbols[r]], 1);
            slot.setStack(initItem);
        } catch(e) {}
    }

    var frameLeft   = reelBaseX - FRAME_PADDING;
    var frameRight  = reelBaseX + 3 * (REEL_SLOT_SIZE + REEL_GAP) - REEL_GAP + FRAME_PADDING;
    var frameTop    = REEL_Y    - FRAME_PADDING;
    var frameBottom = REEL_Y    + REEL_SLOT_SIZE + FRAME_PADDING;
    guiRef.addColoredLine(30, frameLeft,  frameTop,    frameRight, frameTop,    FRAME_COLOR, FRAME_THICKNESS);
    guiRef.addColoredLine(31, frameLeft,  frameBottom, frameRight, frameBottom, FRAME_COLOR, FRAME_THICKNESS);
    guiRef.addColoredLine(32, frameLeft,  frameTop,    frameLeft,  frameBottom, FRAME_COLOR, FRAME_THICKNESS);
    guiRef.addColoredLine(33, frameRight, frameTop,    frameRight, frameBottom, FRAME_COLOR, FRAME_THICKNESS);

    var btnLabels = [
        "BET §a" + BET_OPTIONS[0] + "¢",
        "BET §e" + BET_OPTIONS[1] + "¢",
        "BET §c" + BET_OPTIONS[2] + "¢"
    ];
    var btnIds    = [ID_BET_0, ID_BET_1, ID_BET_2];
    var btnStartX = getBtnStartX();
    for (var b = 0; b < 3; b++) {
        guiRef.addButton(btnIds[b], btnLabels[b], btnStartX + b * (BTN_WIDTH + BTN_GAP), BTN_Y, BTN_WIDTH, BTN_HEIGHT);
    }

    guiRef.addLabel(ID_MSG,      "§7Place your bet to spin!", MSG_X,   MSG_Y,   MSG_SCALE,   MSG_SCALE);
    guiRef.addLabel(ID_COINS,    "§7Coins: §f" + countPlayerCoins(player) + "¢", COINS_X, COINS_Y, COINS_SCALE, COINS_SCALE);
    guiRef.addLabel(ID_SPIN_LBL, "§7" + getPayoutHint(), HINT_X, HINT_Y, HINT_SCALE, HINT_SCALE);

    player.showCustomGui(guiRef);
    guiRef.update();
}

function getPayoutHint() {
    return "3xDiamond=75x  3xGold=30x  3xEmerald=22x  Pair=2x";
}

// ── Button clicked ───────────────────────────────────────────
function customGuiButton(event) {
    var player = event.player;
    var api    = event.API;
    var btnId  = event.buttonId;

    if (spinning) {
        player.message("§cAlready spinning!");
        return;
    }

    var betIndex = -1;
    if      (btnId === ID_BET_0) betIndex = 0;
    else if (btnId === ID_BET_1) betIndex = 1;
    else if (btnId === ID_BET_2) betIndex = 2;
    if (betIndex === -1) return;

    var betAmount   = BET_OPTIONS[betIndex];
    var playerCoins = countPlayerCoins(player);
    if (playerCoins < betAmount) {
        player.message("§cNot enough coins! Need §e" + betAmount + "¢§c, have §e" + playerCoins + "¢");
        updateMessage("§cNot enough coins!");
        if (guiRef) guiRef.update();
        return;
    }

    removeCoins(player, betAmount);
    currentBet   = betAmount;
    finalSymbols = [weightedRandom(), weightedRandom(), weightedRandom()];

    spinning       = true;
    spinTick       = 0;
    displaySymbols = [
        Math.floor(Math.random() * SYMBOLS.length),
        Math.floor(Math.random() * SYMBOLS.length),
        Math.floor(Math.random() * SYMBOLS.length)
    ];

    // All reels start and spin fast together.
    // Stagger extends how long each reel stays in the fast phase,
    // so reel 0 slows down and locks first, reel 2 locks last.
    for (var r = 0; r < 3; r++) {
        reelLocked[r]     = false;
        reelPhase[r]      = 0;
        reelPhaseStart[r] = 0;
        reelNextFlip[r]   = 0;
    }

    updateMessage("§e§lSPINNING...");
    updateCoinsLabel(player);
    if (guiRef) guiRef.update();

    lastBlock  = lastBlock || event.block;
    lastPlayer = player;
    lastApi    = api;
    lastBlock.timers.forceStart(1, 1, true);
}

// ── Timer tick (fires every 1 game-tick) ─────────────────────
function timer(event) {
    if (event.id !== 1) return;

    var block = event.block;
    if (!spinning) { block.timers.stop(1); return; }

    spinTick++;

    var anyFlip = false;

    for (var r = 0; r < 3; r++) {
        if (reelLocked[r]) continue;

        var phase    = reelPhase[r];
        var phaseAge = spinTick - reelPhaseStart[r];

        // Check if this phase has run its full duration
        if (phaseAge >= durationForPhase(phase, r)) {
            if (phase < 2) {
                // Advance to next phase
                reelPhase[r]      = phase + 1;
                reelPhaseStart[r] = spinTick;
                reelNextFlip[r]   = spinTick; // flip immediately on phase transition
            } else {
                // Slow phase done — snap to final symbol and lock
                displaySymbols[r] = finalSymbols[r];
                reelLocked[r]     = true;
                anyFlip           = true;
                continue;
            }
        }

        // Flip the symbol if scheduled
        if (spinTick >= reelNextFlip[r]) {
            displaySymbols[r] = Math.floor(Math.random() * SYMBOLS.length);
            anyFlip           = true;
            reelNextFlip[r]   = spinTick + intervalForPhase(reelPhase[r]);
        }
    }

    if (anyFlip) {
        updateReelDisplay(lastApi);
    }

    if (reelLocked[0] && reelLocked[1] && reelLocked[2]) {
        block.timers.stop(1);
        spinning = false;
        spinTick = 0;
        resolveResult();
    }
}

// ── Refresh reel item stacks ──────────────────────────────────
function updateReelDisplay(api) {
    if (!guiRef || !lastPlayer) return;
    for (var r = 0; r < 3; r++) {
        try {
            var item = lastPlayer.world.createItem(SYMBOLS[displaySymbols[r]], 1);
            reelSlots[r].setStack(item);
        } catch(e) {}
    }
    guiRef.update();
}

// ── Resolve win / loss ───────────────────────────────────────
function resolveResult() {
    if (!lastPlayer) return;

    var s         = finalSymbols;
    var sortedKey = s.slice().sort(function(a, b) { return a - b; }).join(",");
    var multiplier = 0;
    var resultMsg  = "";

    if (PAYOUTS[sortedKey] !== undefined) {
        multiplier = PAYOUTS[sortedKey];
        resultMsg  = (s[0] === s[1] && s[1] === s[2])
                   ? "§6§l★ " + multiplier + "× WIN! ★"
                   : "§b§lCOMBO WIN! §e" + multiplier + "×";
    } else if (s[0] === s[1] || s[1] === s[2] || s[0] === s[2]) {
        multiplier = 2;
        resultMsg  = "§a§lPAIR! §e2 × win";
    } else {
        resultMsg  = "§c§lNo match. Better luck!";
    }

    if (multiplier > 0) {
        var payout = Math.floor(currentBet * multiplier);
        giveCoins(lastPlayer, payout);
        lastPlayer.message("§aYou won §e" + payout + "¢§a! (" + multiplier + "× your §e" + currentBet + "¢§a bet)");
        updateMessage(resultMsg + " §e+" + payout + "¢");
    } else {
        lastPlayer.message("§cYou lost §e" + currentBet + "¢§c. Spin again!");
        updateMessage(resultMsg);
    }

    updateCoinsLabel(lastPlayer);
    if (guiRef) guiRef.update();
}

// ── Label update helpers ─────────────────────────────────────
function updateMessage(text) {
    if (!guiRef) return;
    try { guiRef.removeComponent(ID_MSG); } catch(e) {}
    guiRef.addLabel(ID_MSG, text, MSG_X, MSG_Y, MSG_SCALE, MSG_SCALE);
}

function updateCoinsLabel(player) {
    if (!guiRef) return;
    try { guiRef.removeComponent(ID_COINS); } catch(e) {}
    guiRef.addLabel(ID_COINS, "§7Coins: §f" + countPlayerCoins(player) + "¢", COINS_X, COINS_Y, COINS_SCALE, COINS_SCALE);
}

// ── Slot clicked (reels are display-only) ────────────────────
function customGuiSlotClicked(event) {
    if (guiRef) guiRef.update();
}

// ── GUI closed ────────────────────────────────────────────────
function customGuiClosed(event) {
    guiRef = null;
}

// ── Weighted random symbol ────────────────────────────────────
function weightedRandom() {
    var total = 0;
    for (var i = 0; i < SYMBOL_WEIGHTS.length; i++) total += SYMBOL_WEIGHTS[i];
    var roll       = Math.floor(Math.random() * total);
    var cumulative = 0;
    for (var i = 0; i < SYMBOL_WEIGHTS.length; i++) {
        cumulative += SYMBOL_WEIGHTS[i];
        if (roll < cumulative) return i;
    }
    return SYMBOL_WEIGHTS.length - 1;
}

// ── Currency helpers ─────────────────────────────────────────
function countPlayerCoins(player) {
    var stone = 0, coal = 0, emerald = 0;
    var inv   = player.getInventory();
    for (var i = 0; i < inv.getSize(); i++) {
        var s = inv.getSlot(i);
        if (s && !s.isEmpty()) {
            var n = s.getName();
            if      (n === "coins:stone_coin")   stone   += s.getStackSize();
            else if (n === "coins:coal_coin")    coal    += s.getStackSize();
            else if (n === "coins:emerald_coin") emerald += s.getStackSize();
        }
    }
    return stone + coal * STONE_TO_COAL + emerald * STONE_TO_COAL * COAL_TO_EMERALD;
}

function removeCoins(player, amount) {
    var remaining = amount;
    var inv = player.getInventory();
    for (var i = 0; i < inv.getSize() && remaining > 0; i++) {
        var s = inv.getSlot(i);
        if (s && !s.isEmpty() && s.getName() === "coins:stone_coin") {
            var qty = s.getStackSize();
            if (qty <= remaining) { inv.setSlot(i, null); remaining -= qty; }
            else { s.setStackSize(qty - remaining); remaining = 0; }
        }
    }
    for (var i = 0; i < inv.getSize() && remaining > 0; i++) {
        var s = inv.getSlot(i);
        if (s && !s.isEmpty() && s.getName() === "coins:coal_coin") {
            var qty = s.getStackSize();
            var val = qty * STONE_TO_COAL;
            if (val <= remaining) { inv.setSlot(i, null); remaining -= val; }
            else {
                var needed   = Math.ceil(remaining / STONE_TO_COAL);
                var overpaid = needed * STONE_TO_COAL - remaining;
                s.setStackSize(qty - needed);
                remaining = 0;
                if (overpaid > 0) player.giveItem(player.world.createItem("coins:stone_coin", overpaid));
            }
        }
    }
    for (var i = 0; i < inv.getSize() && remaining > 0; i++) {
        var s = inv.getSlot(i);
        if (s && !s.isEmpty() && s.getName() === "coins:emerald_coin") {
            var qty  = s.getStackSize();
            var unit = STONE_TO_COAL * COAL_TO_EMERALD;
            var val  = qty * unit;
            if (val <= remaining) { inv.setSlot(i, null); remaining -= val; }
            else {
                var needed   = Math.ceil(remaining / unit);
                var overpaid = needed * unit - remaining;
                s.setStackSize(qty - needed);
                remaining = 0;
                var changeCoal  = Math.floor(overpaid / STONE_TO_COAL);
                var changeStone = overpaid % STONE_TO_COAL;
                if (changeCoal  > 0) player.giveItem(player.world.createItem("coins:coal_coin",  changeCoal));
                if (changeStone > 0) player.giveItem(player.world.createItem("coins:stone_coin", changeStone));
            }
        }
    }
}

function giveCoins(player, amount) {
    var unit     = STONE_TO_COAL * COAL_TO_EMERALD;
    var emeralds = Math.floor(amount / unit);          amount -= emeralds * unit;
    var coals    = Math.floor(amount / STONE_TO_COAL); amount -= coals * STONE_TO_COAL;
    var stones   = amount;
    if (emeralds > 0) player.giveItem(player.world.createItem("coins:emerald_coin", emeralds));
    if (coals    > 0) player.giveItem(player.world.createItem("coins:coal_coin",    coals));
    if (stones   > 0) player.giveItem(player.world.createItem("coins:stone_coin",   stones));
}
