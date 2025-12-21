function init(e) {
    var npc = e.npc;
    var display = npc.getDisplay();

    // --- Citizen faction ---
    npc.setFaction(15);

    // Male or female (50/50)
    var isMale = Math.random() < 0.5;

    if (isMale) {
        // Generate skins b01 → b34
        var maleSkins = [];
        for (var i = 1; i <= 34; i++) {
            var num = (i < 10 ? "0" + i : i); // b01, b02 ... b34
            maleSkins.push("cyberpunkskins:textures/b/b" + num + ".png");
        }

        var maleNames = [
            "John", "Michael", "David", "Chris", "Daniel", "Alex", "Robert", "James",
            "William", "Joseph", "Anthony", "Mark", "Matthew", "Andrew", "Joshua", "Brian",
            "Kevin", "Jason", "Justin", "Ryan", "Brandon", "Jacob", "Nicholas", "Eric",
            "Jonathan", "Stephen", "Larry", "Scott", "Frank", "Tyler", "Dennis", "Jerry",
            "Aaron", "Adam", "Patrick", "Sean", "Zachary", "Nathan", "Samuel", "Kyle",
            "Benjamin", "Paul", "Ethan", "Gregory", "Jordan", "Cameron", "Dylan", "Hunter",
            "Logan", "Adrian", "Connor", "Evan", "Tristan", "Austin", "Shawn", "Colton",
            "Owen", "Landon", "Chad", "Trevor", "Spencer", "Marcus", "Vincent", "Bradley",
            "Peter", "George", "Louis", "Arthur", "Maxwell", "Dean", "Curtis", "Phillip",
            "Craig", "Douglas", "Raymond", "Mitchell", "Derek", "Edwin", "Jonah", "Brady",
            "Cody", "Dustin", "Blake", "Wesley", "Henry", "Oscar", "Malcolm", "Clifford",
            "Harold", "Howard", "Bruce", "Victor", "Jeffrey", "Allen", "Caleb", "Gordon",
            "Neil", "Stuart", "Elliot", "Curt", "Terrence", "Leonard", "Louis", "Randall",
            "Edgar", "Marshall", "Frederick", "Phillip", "Stanley", "Norman", "Wayne", "Glen",
            "Elijah", "Hudson", "Bryce", "Troy", "Keith", "Melvin", "Ralph", "Jared",
            "Joey", "Dominic", "Marco", "Angelo", "Ricky", "Darren", "Clinton", "Damian",
            "Luther", "Francis", "Hugh", "Julian", "Quentin", "Theo", "Silas", "Earl",
            "Harvey", "Eugene", "Casey", "Shane", "Colby", "Grant", "Warren", "Russell",
            "Dwight", "Byron", "Gilbert", "Leon", "Maurice", "Ivan", "Felix", "Alfred"
        ];

        display.setSkinTexture(randomFrom(maleSkins));
        display.setName(randomFrom(maleNames));

    } else {
        // Generate skins g01 → g34
        var femaleSkins = [];
        for (var i = 1; i <= 34; i++) {
            var num = (i < 10 ? "0" + i : i); // g01, g02 ... g34
            femaleSkins.push("cyberpunkskins:textures/g/g" + num + ".png");
        }

        var femaleNames = [
            "Sarah", "Emily", "Anna", "Sophia", "Kate", "Maria", "Laura", "Emma",
            "Olivia", "Isabella", "Mia", "Amelia", "Charlotte", "Harper", "Evelyn", "Abigail",
            "Ella", "Grace", "Chloe", "Victoria", "Natalie", "Hannah", "Lily", "Zoe",
            "Samantha", "Leah", "Stella", "Claire", "Audrey", "Savannah", "Brooklyn", "Bella",
            "Lucy", "Avery", "Scarlett", "Aria", "Ellie", "Maya", "Sofia", "Layla",
            "Nora", "Riley", "Hazel", "Aurora", "Violet", "Penelope", "Lillian", "Naomi",
            "Allison", "Madison", "Eleanor", "Paisley", "Camila", "Genesis", "Peyton", "Hailey",
            "Mackenzie", "Skylar", "Kylie", "Alexis", "Autumn", "Eva", "Bailey", "Cora",
            "Jasmine", "Serenity", "Faith", "Trinity", "Makayla", "Gianna", "Sadie", "Alexa",
            "Katherine", "Piper", "Reagan", "Valeria", "Elena", "Clara", "Vivian", "Julia",
            "Lydia", "Isla", "Athena", "Aubrey", "Addison", "Camille", "Rose", "Margaret",
            "Adeline", "Alice", "Eliana", "Valentina", "Willow", "Paislee", "Rylee", "Juliana",
            "Mariah", "Adrianna", "Josephine", "Delilah", "Gabriella", "Emilia", "Daisy", "Arabella",
            "Melody", "Summer", "Dakota", "Harmony", "Kinsley", "Parker", "Tessa", "Freya",
            "Eden", "Hope", "Morgan", "Nicole", "Rebecca", "Rachel", "Vanessa", "Amber",
            "Bianca", "Chelsea", "Whitney", "Heidi", "Jade", "Ivy", "Phoebe", "Danielle",
            "Molly", "Amberly", "Kayla", "Gloria", "Lola", "Anastasia", "Esme", "Megan",
            "Crystal", "Fiona", "Joanna", "Sylvia", "Miriam", "Elise", "Lila", "Cecilia",
            "Miranda", "Noelle", "Priscilla", "Iris", "Angela", "Diana", "Paulina", "Renee"
        ];

        display.setModel("customnpcs:customnpcalex");
        display.setSkinTexture(randomFrom(femaleSkins));
        display.setName(randomFrom(femaleNames));
    }
}

// --- Helper: Pick random from array ---
function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
