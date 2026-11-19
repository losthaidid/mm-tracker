/**
 * Character-inspired cosplay for Momo's existing companion rig.
 * Alternate looks are original costume designs, not a catalog of screen outfits.
 * Each series has five characters; each character has three distinct looks.
 */
(function (root) {
  'use strict';

  const GARMENTS = Object.freeze([
    'vest',
    'robe',
    'suit',
    'chef',
    'jacket',
    'tunic',
    'uniform',
    'gi',
    'dress',
    'hoodie',
    'armor',
    'overalls',
    'parka',
    'sailor',
    'apron',
    'shorts',
    'cape',
    'jersey',
    'gown',
    'bodysuit',
    'coat',
    'poncho',
  ]);
  const ACCESSORIES = Object.freeze([
    'straw-hat',
    'triple-swords',
    'chef-hat',
    'goggles',
    'slingshot',
    'antlers',
    'backpack',
    'ninja-band',
    'kunai',
    'fox-ears',
    'cat-ears',
    'bunny-ears',
    'bear-ears',
    'mouse-ears',
    'wizard-hat',
    'beanie',
    'crown',
    'tiara',
    'bow',
    'flower',
    'horns',
    'gourd',
    'saiyan-hair',
    'golden-hair',
    'blue-hair',
    'white-hair',
    'green-hair',
    'red-hair',
    'pink-hair',
    'orange-hair',
    'braid',
    'long-hair',
    'hood',
    'helmet',
    'space-helmet',
    'cap',
    'deer-hat',
    'sailor-hat',
    'feather-hat',
    'top-hat',
    'pilot-goggles',
    'glasses',
    'sunglasses',
    'eye-mask',
    'blindfold',
    'earrings',
    'necklace',
    'scarf',
    'tie',
    'bow-tie',
    'badge',
    'star',
    'leaf-symbol',
    'lightning',
    'moon',
    'pocket-watch',
    'rose',
    'sword',
    'katana',
    'staff',
    'wand',
    'hammer',
    'book',
    'scroll',
    'camera',
    'microphone',
    'cooking-pan',
    'flask',
    'volleyball',
    'basketball',
    'capture-ball',
    'bell',
    'candy',
    'honey-pot',
    'umbrella',
    'paintbrush',
    'quiver',
    'cape',
    'wings',
    'tail',
    'jetpack',
    'shell',
    'sash',
    'sandals',
    'boots',
    'sneakers',
    'dress-shoes',
    'mittens',
    'gauntlets',
    'armband',
    'bracelet',
    'watch',
    'claws',
  ]);
  const MOVES = Object.freeze([
    'stretch',
    'gear2',
    'gear4',
    'gear5',
    'super-saiyan',
    'saiyan-blue',
    'ultra-instinct',
    'sword-flurry',
    'three-sword',
    'kick',
    'flame-kick',
    'ninja',
    'spell',
    'elemental',
    'lightning',
    'wave',
    'dance',
    'flight',
    'detective',
    'cook',
    'science',
    'sport',
    'speed',
    'mischief',
    'music',
    'gentle',
    'hero',
    'alchemy',
    'robot',
    'elastic',
    'portal',
  ]);

  // Named swatches keep the handwritten configurations easy to audit.
  // Only resolved six-digit hex values are exported.
  const C = Object.freeze({
    black: '#20252F',
    charcoal: '#39424E',
    white: '#F4F3ED',
    cream: '#FFF0C9',
    tan: '#D6B487',
    brown: '#8B603E',
    darkbrown: '#5B3829',
    red: '#DC4444',
    crimson: '#A72F4A',
    orange: '#F28C35',
    amber: '#DCA531',
    gold: '#E5C351',
    yellow: '#F6D84C',
    green: '#4E9A68',
    forest: '#2F6B50',
    lime: '#9EBB4D',
    mint: '#9AD6B5',
    teal: '#2C9C9C',
    cyan: '#74D2DE',
    sky: '#8FBDE5',
    blue: '#3972BD',
    navy: '#253D72',
    indigo: '#5B59A8',
    purple: '#8859AF',
    lavender: '#B6A2DE',
    pink: '#E98DAF',
    coral: '#EC8F7F',
    silver: '#C3CAD4',
    gray: '#858E99',
    olive: '#72804B',
  });
  const SERIES = [];
  const CHARACTERS = [];
  const slug = value =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const words = value => value.split(' ');
  const L = (label, garment, palette, accessories) => {
    const [color, trim, pants] = palette.split('/').map(key => C[key]);
    return Object.freeze({
      id: slug(label),
      label,
      garment,
      color,
      trim,
      pants,
      accessories: Object.freeze(words(accessories)),
    });
  };
  const add = (id, group, name, rows) => {
    SERIES.push(Object.freeze({ id, group, name }));
    rows.forEach(([characterName, moves, ...outfits]) => {
      CHARACTERS.push(
        Object.freeze({
          id: `${id}-${slug(characterName)}`,
          seriesId: id,
          name: characterName,
          moves: Object.freeze(words(moves)),
          outfits: Object.freeze(outfits),
        })
      );
    });
  };

  add('naruto', 'anime', 'Naruto', [
    [
      'Naruto Uzumaki',
      'ninja elemental speed',
      L(
        'Leaf village ninja',
        'jacket',
        'orange/black/orange',
        'ninja-band kunai leaf-symbol sandals'
      ),
      L('Sage road cloak', 'cape', 'red/black/charcoal', 'scroll hood gourd ninja-band'),
      L(
        'Ramen festival chef',
        'chef',
        'cream/orange/navy',
        'chef-hat cooking-pan leaf-symbol sandals'
      ),
    ],
    [
      'Sasuke Uchiha',
      'ninja lightning sword-flurry',
      L('Rival shinobi', 'tunic', 'navy/white/cream', 'ninja-band katana armband sandals'),
      L('Wandering swordsman', 'robe', 'gray/purple/black', 'katana sash hood boots'),
      L('Moonlit formal', 'suit', 'black/silver/navy', 'moon necklace dress-shoes'),
    ],
    [
      'Sakura Haruno',
      'ninja hero gentle',
      L(
        'Cherry blossom medic',
        'dress',
        'crimson/white/black',
        'pink-hair gauntlets ninja-band boots'
      ),
      L('Field medicine coat', 'coat', 'white/pink/green', 'flask backpack gauntlets'),
      L('Blossom festival', 'robe', 'pink/red/cream', 'flower umbrella sandals'),
    ],
    [
      'Kakashi Hatake',
      'ninja lightning detective',
      L('Copy ninja captain', 'vest', 'olive/navy/black', 'white-hair ninja-band eye-mask book'),
      L('Quiet reading day', 'hoodie', 'charcoal/silver/navy', 'book glasses scarf'),
      L('Village ceremony', 'robe', 'white/red/black', 'scroll leaf-symbol sandals'),
    ],
    [
      'Hinata Hyuga',
      'ninja gentle hero',
      L('Gentle fist scout', 'jacket', 'lavender/cream/navy', 'ninja-band long-hair sandals'),
      L('Winter village walk', 'parka', 'cream/lavender/charcoal', 'scarf mittens boots'),
      L('Moon flower evening', 'gown', 'navy/lavender/white', 'flower moon bracelet'),
    ],
  ]);

  add('one-piece', 'anime', 'One Piece', [
    [
      'Monkey D. Luffy',
      'stretch gear2 gear4 gear5',
      L('Straw Hat captain', 'vest', 'red/gold/blue', 'straw-hat sash sandals'),
      L('Wano festival captain', 'robe', 'red/cream/purple', 'straw-hat katana sash sandals'),
      L('Cloudbeat captain', 'jacket', 'white/gold/white', 'white-hair sash sandals lightning'),
    ],
    [
      'Roronoa Zoro',
      'sword-flurry three-sword',
      L(
        'Three sword swordsman',
        'robe',
        'forest/black/black',
        'green-hair triple-swords sash earrings'
      ),
      L('Dojo training day', 'gi', 'cream/forest/charcoal', 'triple-swords armband sandals'),
      L('Midnight duelist', 'suit', 'black/gold/forest', 'green-hair katana earrings dress-shoes'),
    ],
    [
      'Sanji',
      'kick flame-kick cook',
      L('Black Leg cook', 'suit', 'black/gold/black', 'golden-hair tie dress-shoes'),
      L('Galley service', 'chef', 'white/navy/black', 'chef-hat cooking-pan golden-hair'),
      L('Island holiday', 'shorts', 'sky/cream/tan', 'sunglasses scarf sandals'),
    ],
    [
      'Usopp',
      'mischief hero detective',
      L('Brave sea sniper', 'overalls', 'brown/tan/cream', 'goggles slingshot armband'),
      L('Sniper island hero', 'cape', 'red/gold/black', 'eye-mask slingshot boots'),
      L('Sunny deck mechanic', 'apron', 'olive/cream/blue', 'goggles hammer backpack'),
    ],
    [
      'Tony Tony Chopper',
      'gentle science hero',
      L('Reindeer ship doctor', 'shorts', 'coral/white/brown', 'deer-hat antlers backpack'),
      L('Clinic coat', 'coat', 'white/pink/blue', 'antlers glasses flask badge'),
      L('Snow island explorer', 'parka', 'sky/cream/navy', 'deer-hat antlers mittens boots'),
    ],
  ]);

  add('dragon-ball', 'anime', 'Dragon Ball', [
    [
      'Goku',
      'super-saiyan saiyan-blue ultra-instinct',
      L('Turtle school fighter', 'gi', 'orange/blue/blue', 'saiyan-hair armband boots'),
      L('Capsule road trip', 'jacket', 'orange/cream/navy', 'saiyan-hair backpack sneakers'),
      L('Celestial training', 'bodysuit', 'navy/silver/black', 'white-hair gauntlets boots'),
    ],
    [
      'Vegeta',
      'super-saiyan saiyan-blue hero',
      L('Saiyan prince armor', 'armor', 'white/gold/blue', 'saiyan-hair gauntlets boots'),
      L('Gravity chamber training', 'bodysuit', 'navy/white/navy', 'golden-hair armband sneakers'),
      L('Royal banquet', 'suit', 'purple/gold/black', 'crown blue-hair dress-shoes'),
    ],
    [
      'Gohan',
      'super-saiyan hero flight',
      L('Scholar warrior', 'gi', 'purple/blue/purple', 'saiyan-hair sash boots'),
      L('Great city hero', 'armor', 'green/black/black', 'helmet cape gauntlets'),
      L('Campus study day', 'vest', 'cream/navy/brown', 'glasses book tie'),
    ],
    [
      'Piccolo',
      'elemental flight gentle',
      L('Namek guardian', 'gi', 'purple/blue/purple', 'white-hair cape sash boots'),
      L('Desert meditation', 'robe', 'cream/purple/tan', 'hood staff sandals'),
      L('Earth driving lesson', 'jacket', 'yellow/white/blue', 'cap glasses sneakers'),
    ],
    [
      'Trunks',
      'super-saiyan sword-flurry speed',
      L('Future swordsman', 'jacket', 'lavender/black/charcoal', 'sword boots scarf'),
      L('Time patrol uniform', 'uniform', 'navy/silver/black', 'sword badge watch'),
      L('Capsule workshop', 'overalls', 'blue/cream/gray', 'goggles hammer gauntlets'),
    ],
  ]);

  add('demon-slayer', 'anime', 'Demon Slayer', [
    [
      'Tanjiro Kamado',
      'sword-flurry elemental gentle',
      L('Mountain demon slayer', 'jacket', 'forest/black/black', 'katana earrings sandals'),
      L('Water form practice', 'gi', 'sky/white/navy', 'katana sash armband'),
      L('Charcoal seller trail', 'poncho', 'brown/green/charcoal', 'backpack scarf boots'),
    ],
    [
      'Nezuko Kamado',
      'kick gentle hero',
      L('Bamboo moon guardian', 'robe', 'pink/crimson/black', 'bow long-hair sandals'),
      L('Night blossom festival', 'dress', 'crimson/pink/cream', 'flower umbrella bracelet'),
      L('Mountain winter', 'parka', 'cream/pink/brown', 'hood scarf mittens'),
    ],
    [
      'Zenitsu Agatsuma',
      'lightning speed sword-flurry',
      L('Thunderbolt slayer', 'jacket', 'yellow/white/black', 'golden-hair katana lightning'),
      L('Thunder dojo', 'gi', 'cream/amber/navy', 'katana armband sash'),
      L('Lantern evening', 'robe', 'amber/navy/cream', 'umbrella sandals bell'),
    ],
    [
      'Inosuke Hashibira',
      'sword-flurry sport mischief',
      L('Mountain boar fighter', 'vest', 'brown/cream/navy', 'helmet triple-swords boots'),
      L('Forest sparring', 'gi', 'olive/tan/charcoal', 'katana armband sandals'),
      L('Unlikely feast guest', 'suit', 'navy/cream/brown', 'bow-tie claws dress-shoes'),
    ],
    [
      'Kyojuro Rengoku',
      'sword-flurry flame-kick hero',
      L('Flame guardian', 'uniform', 'black/gold/black', 'red-hair cape katana'),
      L('Flame dojo mentor', 'gi', 'cream/red/brown', 'katana sash armband'),
      L('Festival of embers', 'robe', 'red/gold/orange', 'flower bell sandals'),
    ],
  ]);

  add('sailor-moon', 'anime', 'Sailor Moon', [
    [
      'Usagi Tsukino',
      'spell elemental dance',
      L('Moon guardian', 'sailor', 'white/blue/red', 'golden-hair tiara moon bow'),
      L('Moon palace ball', 'gown', 'white/gold/cream', 'crown necklace wand'),
      L('School day dreamer', 'uniform', 'navy/white/blue', 'bow backpack book'),
    ],
    [
      'Ami Mizuno',
      'spell science elemental',
      L('Mercury guardian', 'sailor', 'white/blue/sky', 'blue-hair tiara bow'),
      L('Library afternoon', 'vest', 'sky/white/navy', 'glasses book backpack'),
      L('Winter planetarium', 'coat', 'navy/silver/blue', 'scarf star boots'),
    ],
    [
      'Rei Hino',
      'spell elemental hero',
      L('Mars guardian', 'sailor', 'white/red/purple', 'long-hair tiara bow'),
      L('Shrine festival', 'robe', 'white/red/crimson', 'scroll bell sandals'),
      L('Evening fire star', 'gown', 'crimson/gold/black', 'rose necklace earrings'),
    ],
    [
      'Makoto Kino',
      'lightning cook hero',
      L('Jupiter guardian', 'sailor', 'white/forest/pink', 'braid tiara lightning'),
      L('Garden kitchen', 'apron', 'green/cream/brown', 'flower cooking-pan chef-hat'),
      L('Thunder training', 'jersey', 'forest/white/black', 'sneakers armband lightning'),
    ],
    [
      'Minako Aino',
      'spell dance music',
      L('Venus guardian', 'sailor', 'white/orange/navy', 'golden-hair bow tiara'),
      L('Pop star stage', 'dress', 'orange/gold/white', 'microphone star boots'),
      L('City heroine', 'bodysuit', 'red/white/navy', 'eye-mask bow sneakers'),
    ],
  ]);

  add('pokemon', 'anime', 'Pokémon', [
    [
      'Ash Ketchum',
      'hero sport gentle',
      L('Pokémon trainer', 'jacket', 'blue/white/blue', 'cap capture-ball backpack sneakers'),
      L('League training', 'jersey', 'navy/red/charcoal', 'cap capture-ball armband'),
      L('Snow route explorer', 'parka', 'blue/yellow/navy', 'beanie mittens backpack'),
    ],
    [
      'Pikachu',
      'lightning speed gentle',
      L('Thunder mouse mascot', 'bodysuit', 'yellow/brown/yellow', 'mouse-ears lightning tail'),
      L('Detective thunder mouse', 'coat', 'tan/brown/cream', 'cap glasses lightning'),
      L('Berry picnic helper', 'apron', 'cream/yellow/brown', 'mouse-ears backpack cooking-pan'),
    ],
    [
      'Misty',
      'elemental sport gentle',
      L('Cerulean adventurer', 'shorts', 'yellow/red/blue', 'orange-hair capture-ball sneakers'),
      L('Water gym captain', 'jersey', 'sky/navy/white', 'capture-ball armband badge'),
      L('Seaside festival', 'dress', 'coral/white/sky', 'flower shell sandals'),
    ],
    [
      'Brock',
      'cook gentle science',
      L('Pewter trail guide', 'vest', 'olive/orange/brown', 'backpack capture-ball boots'),
      L('Campfire chef', 'chef', 'white/green/tan', 'chef-hat cooking-pan scarf'),
      L('Pokémon clinic shift', 'coat', 'white/teal/charcoal', 'flask badge book'),
    ],
    [
      'Jessie',
      'mischief dance hero',
      L('Rocket spotlight', 'uniform', 'white/red/black', 'red-hair boots gauntlets'),
      L('Disguise gala', 'gown', 'purple/gold/black', 'long-hair rose necklace'),
      L('Contest stage star', 'suit', 'crimson/white/black', 'microphone top-hat star'),
    ],
  ]);

  add('doraemon', 'anime', 'Doraemon', [
    [
      'Doraemon',
      'robot portal gentle',
      L('Pocket robot cat', 'bodysuit', 'blue/white/blue', 'cat-ears bell pocket-watch'),
      L('Future gadget pilot', 'uniform', 'sky/silver/navy', 'pilot-goggles jetpack bell'),
      L('Dorayaki kitchen', 'apron', 'cream/red/blue', 'chef-hat cooking-pan bell'),
    ],
    [
      'Nobita Nobi',
      'mischief gentle hero',
      L('After school dreamer', 'shorts', 'yellow/white/navy', 'glasses backpack sneakers'),
      L('Space adventure cadet', 'bodysuit', 'white/blue/gray', 'space-helmet jetpack glasses'),
      L('Storybook prince', 'cape', 'navy/gold/cream', 'crown sword glasses'),
    ],
    [
      'Shizuka Minamoto',
      'music gentle dance',
      L('Kind school friend', 'dress', 'pink/white/pink', 'bow book dress-shoes'),
      L('Recital evening', 'gown', 'lavender/silver/white', 'flower necklace microphone'),
      L('Garden outing', 'overalls', 'sky/pink/cream', 'straw-hat backpack sandals'),
    ],
    [
      'Takeshi Goda',
      'music sport hero',
      L(
        'Gian neighborhood singer',
        'jersey',
        'orange/yellow/charcoal',
        'microphone sneakers armband'
      ),
      L('Neighborhood baseball', 'uniform', 'white/orange/navy', 'cap badge sneakers'),
      L('Big stage encore', 'suit', 'purple/gold/black', 'microphone sunglasses dress-shoes'),
    ],
    [
      'Suneo Honekawa',
      'mischief detective science',
      L('Neighborhood showoff', 'shorts', 'mint/white/brown', 'camera watch sneakers'),
      L('Luxury toy pilot', 'jacket', 'navy/gold/cream', 'pilot-goggles scarf boots'),
      L('Museum opening', 'suit', 'teal/silver/black', 'bow-tie pocket-watch dress-shoes'),
    ],
  ]);

  add('my-neighbor-totoro', 'anime', 'My Neighbor Totoro', [
    [
      'Totoro',
      'gentle elemental flight',
      L('Forest spirit', 'poncho', 'gray/cream/gray', 'bear-ears leaf-symbol umbrella'),
      L('Rainy bus stop', 'coat', 'olive/cream/brown', 'umbrella bear-ears boots'),
      L('Moonlight garden keeper', 'overalls', 'forest/tan/gray', 'leaf-symbol staff bear-ears'),
    ],
    [
      'Mei Kusakabe',
      'mischief gentle speed',
      L('Little forest explorer', 'dress', 'coral/white/pink', 'straw-hat backpack sandals'),
      L('Acorn garden helper', 'apron', 'yellow/coral/brown', 'flower cooking-pan boots'),
      L('Rain puddle adventure', 'parka', 'pink/cream/blue', 'hood umbrella mittens'),
    ],
    [
      'Satsuki Kusakabe',
      'hero gentle speed',
      L('Country school walk', 'uniform', 'yellow/white/orange', 'backpack straw-hat sandals'),
      L('Summer kitchen helper', 'apron', 'cream/yellow/forest', 'cooking-pan scarf flower'),
      L('Forest messenger', 'jacket', 'sky/tan/navy', 'backpack leaf-symbol boots'),
    ],
    [
      'Catbus',
      'speed portal gentle',
      L('Forest night bus', 'bodysuit', 'amber/brown/cream', 'cat-ears tail badge'),
      L('Rain route conductor', 'coat', 'brown/gold/charcoal', 'cap pocket-watch cat-ears'),
      L('Moon route pilot', 'uniform', 'navy/gold/tan', 'pilot-goggles star tail'),
    ],
    [
      'Tatsuo Kusakabe',
      'science gentle detective',
      L('Countryside professor', 'vest', 'tan/cream/brown', 'glasses book tie'),
      L('Field research day', 'jacket', 'olive/tan/navy', 'straw-hat camera backpack'),
      L('Family cooking day', 'apron', 'cream/forest/brown', 'glasses cooking-pan scarf'),
    ],
  ]);

  add('spirited-away', 'anime', 'Spirited Away', [
    [
      'Chihiro Ogino',
      'hero gentle speed',
      L('Bathhouse helper', 'tunic', 'coral/white/coral', 'sash sandals bow'),
      L('Spirit railway traveler', 'jacket', 'mint/white/red', 'backpack flower sneakers'),
      L('River lantern guest', 'robe', 'pink/gold/cream', 'bow umbrella sandals'),
    ],
    [
      'Haku',
      'spell flight elemental',
      L('River spirit apprentice', 'tunic', 'white/teal/purple', 'sash sandals long-hair'),
      L('Dragon river guardian', 'cape', 'mint/silver/white', 'horns tail moon'),
      L('Moonlit tea scholar', 'robe', 'navy/sky/white', 'scroll staff sandals'),
    ],
    [
      'No-Face',
      'mischief gentle spell',
      L('Quiet bathhouse visitor', 'robe', 'black/white/black', 'eye-mask hood'),
      L('Knitting cottage guest', 'poncho', 'charcoal/lavender/cream', 'eye-mask scarf book'),
      L('Lantern festival traveler', 'cape', 'navy/gold/black', 'eye-mask umbrella bell'),
    ],
    [
      'Yubaba',
      'spell flight mischief',
      L('Bathhouse mistress', 'gown', 'navy/red/black', 'white-hair earrings necklace'),
      L('Office spellkeeper', 'robe', 'purple/gold/charcoal', 'glasses book wand'),
      L('Spirit market outing', 'coat', 'crimson/silver/navy', 'feather-hat bracelet umbrella'),
    ],
    [
      'Lin',
      'hero gentle cook',
      L('Bathhouse work shift', 'tunic', 'coral/cream/brown', 'sash sandals long-hair'),
      L('Kitchen break baker', 'apron', 'cream/teal/charcoal', 'cooking-pan scarf boots'),
      L('Riverbank evening', 'robe', 'teal/gold/navy', 'flower necklace umbrella'),
    ],
  ]);

  add('howls-moving-castle', 'anime', "Howl's Moving Castle", [
    [
      'Howl',
      'spell flight portal',
      L('Moving castle wizard', 'jacket', 'pink/sky/black', 'golden-hair earrings necklace'),
      L('Birdflight sorcerer', 'cape', 'black/blue/charcoal', 'wings long-hair claws'),
      L('Royal academy visit', 'robe', 'white/gold/navy', 'wizard-hat wand book'),
    ],
    [
      'Sophie Hatter',
      'gentle hero cook',
      L('Castle housekeeper', 'dress', 'sky/white/navy', 'braid straw-hat boots'),
      L('Hatter shop workday', 'apron', 'cream/blue/brown', 'flower feather-hat bow'),
      L('Starlight garden ball', 'gown', 'mint/silver/white', 'white-hair necklace star'),
    ],
    [
      'Calcifer',
      'elemental cook mischief',
      L('Hearth fire spirit', 'poncho', 'orange/yellow/red', 'horns cooking-pan lightning'),
      L('Kitchen flame chef', 'chef', 'cream/orange/brown', 'chef-hat cooking-pan star'),
      L('Falling star traveler', 'cape', 'navy/gold/orange', 'star wand boots'),
    ],
    [
      'Markl',
      'spell mischief gentle',
      L('Wizard apprentice', 'robe', 'forest/cream/brown', 'hood book boots'),
      L('Market errand boy', 'jacket', 'orange/tan/olive', 'backpack cap scarf'),
      L('Young spell scholar', 'uniform', 'navy/gold/cream', 'wizard-hat wand scroll'),
    ],
    [
      'Turnip-Head',
      'gentle dance hero',
      L('Polite scarecrow', 'suit', 'black/white/black', 'top-hat bow-tie staff'),
      L('Garden watchman', 'overalls', 'brown/cream/olive', 'straw-hat flower scarf'),
      L('Restored prince gala', 'cape', 'white/gold/navy', 'crown rose dress-shoes'),
    ],
  ]);

  add('jujutsu-kaisen', 'anime', 'Jujutsu Kaisen', [
    [
      'Yuji Itadori',
      'hero kick speed',
      L('Jujutsu first year', 'uniform', 'navy/red/navy', 'pink-hair hood sneakers'),
      L('Track field workout', 'jersey', 'red/black/charcoal', 'armband sneakers watch'),
      L('Shrine festival guest', 'robe', 'crimson/gold/cream', 'pink-hair sash sandals'),
    ],
    [
      'Megumi Fushiguro',
      'spell ninja hero',
      L('Ten shadows student', 'uniform', 'navy/black/navy', 'saiyan-hair boots armband'),
      L('Shadow practice', 'gi', 'charcoal/white/black', 'scroll sash sandals'),
      L('Quiet city evening', 'coat', 'forest/cream/charcoal', 'scarf book boots'),
    ],
    [
      'Nobara Kugisaki',
      'hero spell mischief',
      L('Straw doll sorcerer', 'uniform', 'navy/gold/black', 'orange-hair hammer boots'),
      L('Tokyo shopping day', 'dress', 'crimson/cream/black', 'sunglasses necklace dress-shoes'),
      L('Rural festival crafter', 'apron', 'tan/red/navy', 'hammer flower scarf'),
    ],
    [
      'Satoru Gojo',
      'spell portal speed',
      L('Limitless teacher', 'uniform', 'black/navy/black', 'white-hair blindfold boots'),
      L('Beachside lesson', 'shorts', 'sky/white/navy', 'sunglasses white-hair sandals'),
      L('Sorcerer gala', 'suit', 'white/silver/black', 'white-hair glasses bow-tie'),
    ],
    [
      'Maki Zenin',
      'sword-flurry hero sport',
      L('Cursed tool specialist', 'uniform', 'navy/white/navy', 'glasses green-hair staff'),
      L('Weapons dojo', 'gi', 'cream/forest/black', 'katana armband sash'),
      L('Urban training run', 'jacket', 'olive/black/charcoal', 'glasses backpack sneakers'),
    ],
  ]);

  add('attack-on-titan', 'anime', 'Attack on Titan', [
    [
      'Eren Yeager',
      'hero speed elemental',
      L('Scout recruit', 'jacket', 'brown/cream/white', 'sword badge boots'),
      L('Cadet sparring', 'gi', 'cream/olive/charcoal', 'armband sash sneakers'),
      L('Coastal traveler', 'coat', 'black/gray/brown', 'long-hair scarf backpack'),
    ],
    [
      'Mikasa Ackerman',
      'sword-flurry speed hero',
      L('Scarfed scout', 'jacket', 'brown/cream/white', 'scarf sword boots'),
      L('Forest patrol', 'cape', 'forest/silver/charcoal', 'sword badge scarf'),
      L('Winter city leave', 'parka', 'cream/red/navy', 'scarf mittens boots'),
    ],
    [
      'Armin Arlert',
      'detective hero gentle',
      L('Scout strategist', 'jacket', 'brown/cream/white', 'golden-hair book badge'),
      L('Map room scholar', 'vest', 'tan/white/navy', 'glasses scroll pocket-watch'),
      L('Ocean expedition', 'sailor', 'white/blue/navy', 'sailor-hat backpack boots'),
    ],
    [
      'Levi Ackerman',
      'sword-flurry speed hero',
      L('Scout captain', 'jacket', 'brown/white/white', 'sword scarf boots'),
      L('Headquarters cleaning', 'apron', 'cream/gray/charcoal', 'scarf gauntlets boots'),
      L('Command ceremony', 'suit', 'navy/silver/black', 'badge tie dress-shoes'),
    ],
    [
      'Hange Zoe',
      'science detective hero',
      L('Scout researcher', 'jacket', 'brown/cream/white', 'goggles book badge'),
      L('Field experiment', 'coat', 'white/olive/charcoal', 'glasses flask gauntlets'),
      L('Expedition leader', 'cape', 'forest/gold/brown', 'scroll backpack boots'),
    ],
  ]);

  add('bleach', 'anime', 'Bleach', [
    [
      'Ichigo Kurosaki',
      'sword-flurry hero speed',
      L('Substitute soul reaper', 'robe', 'black/white/black', 'orange-hair sword sash'),
      L('Karakura school day', 'uniform', 'gray/white/black', 'orange-hair backpack sneakers'),
      L('Soul society commander', 'coat', 'white/black/black', 'sword armband boots'),
    ],
    [
      'Rukia Kuchiki',
      'sword-flurry elemental gentle',
      L('Snow soul reaper', 'robe', 'black/white/black', 'katana sash sandals'),
      L('Winter moon captain', 'cape', 'white/silver/sky', 'katana moon long-hair'),
      L('Karakura sketchbook', 'uniform', 'gray/red/navy', 'book paintbrush backpack'),
    ],
    [
      'Renji Abarai',
      'sword-flurry hero sport',
      L('Soul reaper lieutenant', 'robe', 'black/white/black', 'red-hair sword ninja-band'),
      L('Sword dojo practice', 'gi', 'cream/crimson/charcoal', 'katana armband sash'),
      L('Streetwear day off', 'jacket', 'red/black/blue', 'red-hair sunglasses boots'),
    ],
    [
      'Orihime Inoue',
      'spell gentle hero',
      L('Karakura school friend', 'uniform', 'gray/red/navy', 'orange-hair flower backpack'),
      L('Healing star guardian', 'gown', 'white/gold/cream', 'star bracelet long-hair'),
      L('Bakery afternoon', 'apron', 'pink/cream/brown', 'chef-hat cooking-pan flower'),
    ],
    [
      'Uryu Ishida',
      'hero science speed',
      L('Quincy archer', 'uniform', 'white/blue/white', 'glasses quiver boots'),
      L('School council day', 'vest', 'navy/white/gray', 'glasses book tie'),
      L('Night patrol', 'coat', 'navy/silver/black', 'quiver scarf gauntlets'),
    ],
  ]);

  add('one-punch-man', 'anime', 'One-Punch Man', [
    [
      'Saitama',
      'hero speed sport',
      L('Caped hero', 'bodysuit', 'yellow/red/yellow', 'cape gauntlets boots'),
      L('Bargain market trip', 'hoodie', 'cream/black/charcoal', 'backpack sneakers watch'),
      L('Hero association dinner', 'suit', 'navy/white/black', 'tie badge dress-shoes'),
    ],
    [
      'Genos',
      'robot hero elemental',
      L('Cyborg disciple', 'armor', 'silver/black/black', 'golden-hair gauntlets boots'),
      L('Maintenance workshop', 'overalls', 'charcoal/gold/gray', 'goggles hammer flask'),
      L('City defense patrol', 'coat', 'cream/black/charcoal', 'gauntlets badge boots'),
    ],
    [
      'Tatsumaki',
      'spell flight hero',
      L('Tornado esper', 'dress', 'black/forest/black', 'green-hair boots bracelet'),
      L('Cloud patrol', 'cape', 'forest/silver/charcoal', 'green-hair star gauntlets'),
      L('Hero gala guest', 'gown', 'teal/gold/black', 'earrings necklace dress-shoes'),
    ],
    [
      'Fubuki',
      'spell elemental hero',
      L('Blizzard leader', 'dress', 'forest/white/black', 'necklace green-hair boots'),
      L('Winter syndicate', 'coat', 'white/forest/navy', 'scarf glasses gauntlets'),
      L('Association boardroom', 'suit', 'teal/gold/black', 'tie badge dress-shoes'),
    ],
    [
      'Mumen Rider',
      'hero sport gentle',
      L('Courageous cyclist', 'armor', 'olive/brown/black', 'helmet goggles gauntlets'),
      L('Neighborhood training', 'jersey', 'green/white/charcoal', 'helmet sneakers armband'),
      L('Rain rescue shift', 'parka', 'yellow/olive/navy', 'helmet backpack boots'),
    ],
  ]);

  add('spy-family', 'anime', 'Spy × Family', [
    [
      'Anya Forger',
      'mischief detective gentle',
      L('Eden school uniform', 'uniform', 'black/gold/black', 'pink-hair horns backpack'),
      L('Bondman junior agent', 'cape', 'navy/red/black', 'eye-mask pink-hair sneakers'),
      L('Peanut picnic day', 'dress', 'coral/cream/pink', 'straw-hat candy bow'),
    ],
    [
      'Loid Forger',
      'detective hero speed',
      L('Twilight family gentleman', 'suit', 'forest/white/forest', 'golden-hair tie dress-shoes'),
      L('Berlint hospital shift', 'coat', 'white/teal/charcoal', 'glasses flask badge'),
      L('Alpine spy holiday', 'parka', 'navy/cream/black', 'goggles scarf boots'),
    ],
    [
      'Yor Forger',
      'hero speed kick',
      L('Thorn Princess evening', 'dress', 'black/gold/crimson', 'rose earrings long-hair'),
      L('City hall workday', 'uniform', 'navy/white/black', 'badge necklace dress-shoes'),
      L('Family dinner lesson', 'apron', 'red/cream/brown', 'cooking-pan flower scarf'),
    ],
    [
      'Bond Forger',
      'gentle hero detective',
      L('Gentle family guardian', 'bodysuit', 'white/cream/white', 'bear-ears bow-tie tail'),
      L('Rescue dog trainee', 'vest', 'orange/black/cream', 'badge backpack bear-ears'),
      L('Winter park companion', 'parka', 'sky/white/navy', 'scarf mittens tail'),
    ],
    [
      'Damian Desmond',
      'mischief sport gentle',
      L('Eden honor student', 'uniform', 'black/gold/black', 'badge book dress-shoes'),
      L('School field day', 'jersey', 'green/white/navy', 'sneakers armband star'),
      L('Imperial family reception', 'suit', 'navy/gold/black', 'bow-tie pocket-watch rose'),
    ],
  ]);

  add('haikyu', 'anime', 'Haikyu!!', [
    [
      'Shoyo Hinata',
      'sport speed hero',
      L(
        'Karasuno quick attacker',
        'jersey',
        'orange/black/black',
        'orange-hair volleyball sneakers'
      ),
      L('Away match journey', 'jacket', 'black/orange/navy', 'backpack volleyball cap'),
      L('Beach jump practice', 'shorts', 'sky/white/tan', 'sunglasses volleyball armband'),
    ],
    [
      'Tobio Kageyama',
      'sport speed hero',
      L('Karasuno precision setter', 'jersey', 'black/orange/black', 'volleyball sneakers armband'),
      L('Training camp arrival', 'hoodie', 'navy/white/charcoal', 'backpack cap sneakers'),
      L('Awards evening', 'suit', 'navy/silver/black', 'tie badge dress-shoes'),
    ],
    [
      'Daichi Sawamura',
      'sport hero gentle',
      L('Karasuno captain', 'jersey', 'black/white/black', 'volleyball armband sneakers'),
      L('Early morning run', 'jacket', 'forest/white/navy', 'watch sneakers backpack'),
      L('Team banquet host', 'vest', 'charcoal/orange/black', 'tie badge dress-shoes'),
    ],
    [
      'Koshi Sugawara',
      'sport gentle detective',
      L('Karasuno steady setter', 'jersey', 'black/orange/black', 'white-hair volleyball sneakers'),
      L('Camp kitchen helper', 'apron', 'cream/sky/charcoal', 'cooking-pan scarf white-hair'),
      L('School study afternoon', 'uniform', 'navy/white/gray', 'book backpack glasses'),
    ],
    [
      'Kei Tsukishima',
      'sport detective science',
      L(
        'Karasuno middle blocker',
        'jersey',
        'black/orange/black',
        'glasses golden-hair volleyball'
      ),
      L('Museum weekend', 'coat', 'tan/cream/navy', 'glasses book scarf'),
      L('Late court practice', 'hoodie', 'navy/yellow/charcoal', 'volleyball sneakers watch'),
    ],
  ]);

  add('my-hero-academia', 'anime', 'My Hero Academia', [
    [
      'Izuku Midoriya',
      'hero speed lightning',
      L('Deku rescue hero', 'bodysuit', 'green/black/black', 'green-hair gauntlets boots'),
      L('UA school day', 'uniform', 'gray/forest/navy', 'tie backpack sneakers'),
      L('Mountain rescue trainee', 'parka', 'orange/green/charcoal', 'helmet backpack boots'),
    ],
    [
      'Katsuki Bakugo',
      'hero elemental speed',
      L('Explosion hero', 'armor', 'black/orange/olive', 'golden-hair gauntlets eye-mask'),
      L('UA field training', 'jersey', 'navy/white/navy', 'armband sneakers watch'),
      L('Winter city patrol', 'jacket', 'charcoal/orange/black', 'goggles scarf boots'),
    ],
    [
      'Ochaco Uraraka',
      'hero flight gentle',
      L('Zero gravity hero', 'bodysuit', 'black/pink/black', 'helmet gauntlets boots'),
      L('UA classroom', 'uniform', 'gray/forest/navy', 'tie book backpack'),
      L('Star festival float', 'dress', 'pink/silver/white', 'star bracelet bow'),
    ],
    [
      'Shoto Todoroki',
      'hero elemental wave',
      L('Fire and ice hero', 'uniform', 'navy/silver/navy', 'white-hair red-hair boots'),
      L('Dual element dojo', 'gi', 'cream/red/blue', 'sash armband sandals'),
      L('Snow rescue cadet', 'parka', 'sky/white/navy', 'goggles mittens backpack'),
    ],
    [
      'All Might',
      'hero speed sport',
      L('Symbol of peace', 'bodysuit', 'blue/red/blue', 'golden-hair gauntlets cape'),
      L('UA mentor lesson', 'suit', 'tan/cream/brown', 'golden-hair tie book'),
      L('Charity sports captain', 'jersey', 'red/white/navy', 'star sneakers armband'),
    ],
  ]);

  add('fullmetal-alchemist', 'anime', 'Fullmetal Alchemist', [
    [
      'Edward Elric',
      'alchemy hero speed',
      L('Fullmetal alchemist', 'coat', 'red/black/black', 'braid gauntlets pocket-watch'),
      L('Alchemy library study', 'vest', 'black/white/brown', 'golden-hair book glasses'),
      L('Desert rail traveler', 'poncho', 'tan/red/charcoal', 'goggles backpack boots'),
    ],
    [
      'Alphonse Elric',
      'alchemy gentle hero',
      L('Armored little brother', 'armor', 'silver/charcoal/gray', 'helmet gauntlets boots'),
      L('Workshop apron armor', 'apron', 'brown/cream/silver', 'helmet hammer flask'),
      L('Kindhearted traveler', 'cape', 'navy/gold/gray', 'helmet backpack cat-ears'),
    ],
    [
      'Winry Rockbell',
      'science gentle hero',
      L('Automail engineer', 'overalls', 'blue/white/blue', 'golden-hair goggles hammer'),
      L('Workshop master', 'apron', 'tan/black/charcoal', 'gauntlets hammer scarf'),
      L('Railway homecoming', 'dress', 'sky/cream/navy', 'straw-hat backpack boots'),
    ],
    [
      'Roy Mustang',
      'alchemy elemental hero',
      L('Flame state alchemist', 'uniform', 'blue/gold/navy', 'gauntlets badge boots'),
      L('Central command gala', 'suit', 'black/white/black', 'tie pocket-watch rose'),
      L('Field campaign coat', 'coat', 'navy/silver/charcoal', 'gauntlets scarf book'),
    ],
    [
      'Riza Hawkeye',
      'hero detective speed',
      L('Steady military officer', 'uniform', 'blue/gold/navy', 'golden-hair badge boots'),
      L('Desert field observer', 'jacket', 'tan/olive/brown', 'goggles backpack scarf'),
      L('Quiet library leave', 'vest', 'cream/navy/charcoal', 'glasses book pocket-watch'),
    ],
  ]);

  add('neon-genesis-evangelion', 'anime', 'Neon Genesis Evangelion', [
    [
      'Shinji Ikari',
      'robot hero music',
      L('Unit 01 pilot', 'bodysuit', 'white/navy/black', 'helmet badge gauntlets'),
      L('Tokyo school morning', 'uniform', 'white/navy/black', 'backpack book sneakers'),
      L('Quiet music evening', 'hoodie', 'navy/sky/charcoal', 'microphone scarf sneakers'),
    ],
    [
      'Rei Ayanami',
      'robot gentle hero',
      L('Unit 00 pilot', 'bodysuit', 'white/black/white', 'blue-hair helmet gauntlets'),
      L('Tokyo school day', 'uniform', 'sky/white/navy', 'blue-hair book backpack'),
      L('Starlit observation deck', 'coat', 'cream/sky/gray', 'moon scarf boots'),
    ],
    [
      'Asuka Langley Soryu',
      'robot hero sport',
      L('Unit 02 pilot', 'bodysuit', 'red/black/red', 'orange-hair helmet gauntlets'),
      L('Sunny city outing', 'dress', 'yellow/white/cream', 'bow sunglasses sandals'),
      L('Pilot training camp', 'jersey', 'red/white/navy', 'sneakers armband backpack'),
    ],
    [
      'Kaworu Nagisa',
      'music gentle spell',
      L('Quiet fifth pilot', 'bodysuit', 'navy/silver/black', 'white-hair helmet gauntlets'),
      L('Music room visitor', 'uniform', 'white/navy/black', 'white-hair book sneakers'),
      L('Moonlight recital', 'suit', 'black/white/black', 'bow-tie star microphone'),
    ],
    [
      'Misato Katsuragi',
      'hero detective speed',
      L('NERV operations captain', 'jacket', 'red/black/black', 'long-hair badge boots'),
      L('Command center shift', 'uniform', 'navy/silver/charcoal', 'glasses book armband'),
      L('Seaside weekend', 'shorts', 'coral/white/blue', 'sunglasses scarf sandals'),
    ],
  ]);

  add('cardcaptor-sakura', 'anime', 'Cardcaptor Sakura', [
    [
      'Sakura Kinomoto',
      'spell flight gentle',
      L('Cardcaptor star dress', 'dress', 'pink/white/red', 'wand wings bow'),
      L('Tomoeda school day', 'sailor', 'white/navy/black', 'cap backpack sneakers'),
      L('Dream guardian ball', 'gown', 'white/gold/pink', 'crown star staff'),
    ],
    [
      'Tomoyo Daidouji',
      'music gentle science',
      L('Costume camera director', 'dress', 'lavender/white/navy', 'long-hair camera bow'),
      L('Tomoeda choir day', 'sailor', 'white/navy/black', 'microphone book cap'),
      L('Costume atelier', 'apron', 'cream/lavender/brown', 'paintbrush glasses scarf'),
    ],
    [
      'Syaoran Li',
      'spell sword-flurry hero',
      L('Clow card swordsman', 'robe', 'forest/gold/green', 'sword cap sash'),
      L('Tomoeda school uniform', 'uniform', 'black/white/black', 'backpack book sneakers'),
      L('Moon festival guardian', 'armor', 'teal/gold/navy', 'sword moon gauntlets'),
    ],
    [
      'Kero',
      'spell flight mischief',
      L('Little sun guardian', 'bodysuit', 'yellow/cream/yellow', 'bear-ears wings tail'),
      L('Dessert kitchen helper', 'chef', 'white/pink/brown', 'chef-hat candy wings'),
      L('Cerberus royal guard', 'armor', 'gold/white/amber', 'wings crown gauntlets'),
    ],
    [
      'Yukito Tsukishiro',
      'gentle spell flight',
      L('Gentle school friend', 'uniform', 'navy/white/black', 'glasses white-hair book'),
      L('Moon guardian Yue', 'robe', 'white/silver/lavender', 'wings long-hair moon'),
      L('Snow cafe visit', 'coat', 'tan/cream/navy', 'glasses scarf mittens'),
    ],
  ]);

  add('spongebob-squarepants', 'cartoon', 'SpongeBob SquarePants', [
    [
      'SpongeBob SquarePants',
      'cook dance mischief',
      L('Krusty Krab fry cook', 'uniform', 'white/red/brown', 'tie badge dress-shoes'),
      L('Jellyfish field day', 'shorts', 'yellow/white/tan', 'glasses backpack sneakers'),
      L('Bubble ballroom star', 'suit', 'navy/gold/black', 'top-hat bow-tie star'),
    ],
    [
      'Patrick Star',
      'gentle mischief dance',
      L('Rock house best friend', 'shorts', 'pink/lavender/lime', 'star sandals candy'),
      L('Ice cream boardwalk', 'sailor', 'white/blue/navy', 'sailor-hat scarf sandals'),
      L('Royal starfish guest', 'cape', 'purple/gold/pink', 'crown star dress-shoes'),
    ],
    [
      'Squidward Tentacles',
      'music dance gentle',
      L('Bikini Bottom cashier', 'tunic', 'brown/tan/teal', 'badge book sandals'),
      L('Clarinet recital host', 'suit', 'black/white/black', 'bow-tie microphone dress-shoes'),
      L('Seaside painter', 'apron', 'cream/teal/brown', 'paintbrush cap scarf'),
    ],
    [
      'Sandy Cheeks',
      'science hero sport',
      L('Undersea scientist', 'bodysuit', 'white/silver/gray', 'space-helmet flower boots'),
      L('Karate at the treedome', 'gi', 'white/red/black', 'sash gauntlets sneakers'),
      L('Texas field explorer', 'overalls', 'blue/tan/brown', 'straw-hat goggles backpack'),
    ],
    [
      'Mr. Krabs',
      'cook mischief dance',
      L('Krusty Krab owner', 'jacket', 'sky/white/navy', 'claws tie badge'),
      L('Treasure captain', 'coat', 'navy/gold/black', 'feather-hat pocket-watch claws'),
      L('Gala restaurateur', 'suit', 'crimson/cream/black', 'bow-tie dress-shoes claws'),
    ],
  ]);

  add('adventure-time', 'cartoon', 'Adventure Time', [
    [
      'Finn the Human',
      'hero sword-flurry gentle',
      L('Ooo adventurer', 'tunic', 'sky/white/blue', 'bear-ears backpack sword'),
      L('Dungeon frost quest', 'parka', 'cream/sky/navy', 'hood sword boots'),
      L('Candy kingdom knight', 'armor', 'silver/blue/charcoal', 'helmet sword cape'),
    ],
    [
      'Jake the Dog',
      'elastic stretch mischief',
      L('Stretchy best friend', 'bodysuit', 'amber/yellow/amber', 'bear-ears tail sandals'),
      L('Bacon pancake morning', 'chef', 'white/amber/brown', 'chef-hat cooking-pan candy'),
      L('Dungeon detective', 'coat', 'tan/brown/charcoal', 'cap glasses pocket-watch'),
    ],
    [
      'Princess Bubblegum',
      'science gentle spell',
      L('Candy kingdom ruler', 'dress', 'pink/gold/pink', 'crown long-hair necklace'),
      L('Candy laboratory', 'coat', 'white/pink/navy', 'goggles flask gauntlets'),
      L('Royal peppermint ball', 'gown', 'crimson/white/cream', 'tiara wand candy'),
    ],
    [
      'Marceline',
      'music flight mischief',
      L('Vampire rock queen', 'vest', 'charcoal/red/blue', 'long-hair boots microphone'),
      L('Night tour headliner', 'jacket', 'red/black/black', 'sunglasses microphone star'),
      L('Moonlit formal', 'gown', 'black/crimson/charcoal', 'rose necklace moon'),
    ],
    [
      'Ice King',
      'spell flight elemental',
      L('Ice kingdom wizard', 'robe', 'blue/white/navy', 'crown white-hair wand'),
      L('Snow wizard expedition', 'parka', 'sky/silver/navy', 'crown scarf mittens'),
      L('Royal talent evening', 'suit', 'white/blue/black', 'microphone bow-tie crown'),
    ],
  ]);

  add('the-simpsons', 'cartoon', 'The Simpsons', [
    [
      'Homer Simpson',
      'mischief cook gentle',
      L('Springfield dad', 'tunic', 'white/cream/blue', 'watch dress-shoes candy'),
      L('Nuclear plant shift', 'bodysuit', 'white/green/gray', 'helmet goggles badge'),
      L('Bowling team captain', 'jersey', 'pink/navy/charcoal', 'sneakers armband star'),
    ],
    [
      'Marge Simpson',
      'gentle cook hero',
      L('Evergreen Terrace mom', 'dress', 'lime/white/green', 'blue-hair necklace dress-shoes'),
      L('Family kitchen day', 'apron', 'cream/green/brown', 'blue-hair cooking-pan scarf'),
      L('Springfield gala', 'gown', 'forest/gold/navy', 'blue-hair earrings bracelet'),
    ],
    [
      'Bart Simpson',
      'mischief speed sport',
      L('Springfield prankster', 'shorts', 'red/yellow/blue', 'saiyan-hair slingshot sneakers'),
      L('Junior daredevil', 'jacket', 'navy/orange/black', 'helmet goggles sneakers'),
      L('School play pirate', 'coat', 'red/gold/charcoal', 'feather-hat sword boots'),
    ],
    [
      'Lisa Simpson',
      'music science gentle',
      L('Springfield musician', 'dress', 'red/white/red', 'star necklace dress-shoes'),
      L('Young science fair', 'coat', 'white/sky/navy', 'glasses flask book'),
      L('Jazz recital star', 'suit', 'black/gold/black', 'microphone bow-tie star'),
    ],
    [
      'Maggie Simpson',
      'gentle mischief hero',
      L('Little blue dreamer', 'bodysuit', 'sky/white/sky', 'bow star mittens'),
      L('Garden toddler', 'overalls', 'pink/cream/blue', 'straw-hat flower sneakers'),
      L('Storybook fairy', 'dress', 'lavender/gold/white', 'wings wand bow'),
    ],
  ]);

  add('the-powerpuff-girls', 'cartoon', 'The Powerpuff Girls', [
    [
      'Blossom',
      'hero flight elemental',
      L('Townsville team leader', 'dress', 'pink/black/white', 'red-hair bow dress-shoes'),
      L('Power training captain', 'jersey', 'pink/white/black', 'armband sneakers lightning'),
      L('Townsville awards night', 'cape', 'crimson/gold/pink', 'tiara star boots'),
    ],
    [
      'Bubbles',
      'hero flight gentle',
      L('Townsville joyful hero', 'dress', 'sky/black/white', 'golden-hair bow dress-shoes'),
      L('Animal rescue helper', 'overalls', 'blue/cream/sky', 'backpack flower sneakers'),
      L('Bubble fairy festival', 'gown', 'sky/silver/white', 'wings wand star'),
    ],
    [
      'Buttercup',
      'hero flight kick',
      L('Townsville tough hero', 'dress', 'green/black/white', 'eye-mask armband dress-shoes'),
      L('After school dojo', 'gi', 'black/green/charcoal', 'sash gauntlets sneakers'),
      L('Nightwatch patrol', 'jacket', 'forest/silver/black', 'goggles boots lightning'),
    ],
    [
      'Professor Utonium',
      'science gentle hero',
      L('Chemical X scientist', 'coat', 'white/black/charcoal', 'tie flask book'),
      L('Family pancake morning', 'apron', 'cream/blue/brown', 'chef-hat cooking-pan scarf'),
      L('Science awards dinner', 'suit', 'navy/white/black', 'bow-tie glasses badge'),
    ],
    [
      'Mojo Jojo',
      'science mischief robot',
      L('Townsville mastermind', 'cape', 'purple/white/navy', 'helmet gauntlets boots'),
      L('Volcano laboratory', 'coat', 'white/purple/black', 'goggles flask helmet'),
      L('Dramatic villain gala', 'suit', 'black/green/purple', 'top-hat staff bow-tie'),
    ],
  ]);

  add('avatar-the-last-airbender', 'cartoon', 'Avatar: The Last Airbender', [
    [
      'Aang',
      'elemental flight gentle',
      L('Air Nomad traveler', 'tunic', 'orange/yellow/brown', 'staff sash sandals'),
      L('Air temple monk', 'robe', 'cream/orange/amber', 'staff necklace sandals'),
      L('Snow kingdom visitor', 'parka', 'sky/cream/navy', 'hood mittens boots'),
    ],
    [
      'Katara',
      'elemental wave hero',
      L('Southern waterbender', 'tunic', 'blue/white/navy', 'braid necklace boots'),
      L('Northern water ceremony', 'robe', 'navy/silver/sky', 'necklace moon sash'),
      L('Desert caravan journey', 'poncho', 'tan/sky/brown', 'gourd hood sandals'),
    ],
    [
      'Sokka',
      'hero detective mischief',
      L('Water Tribe strategist', 'tunic', 'blue/white/navy', 'sword necklace boots'),
      L('Kyoshi training warrior', 'armor', 'green/gold/black', 'helmet sword eye-mask'),
      L('Desert mapmaker', 'vest', 'tan/blue/brown', 'scroll backpack goggles'),
    ],
    [
      'Toph Beifong',
      'elemental hero sport',
      L('Earthbending prodigy', 'tunic', 'cream/forest/green', 'ninja-band armband sash'),
      L('Earth ring champion', 'gi', 'forest/gold/black', 'gauntlets crown armband'),
      L('Beifong banquet', 'gown', 'mint/gold/cream', 'flower necklace bracelet'),
    ],
    [
      'Zuko',
      'elemental sword-flurry hero',
      L('Fire Nation prince', 'robe', 'crimson/gold/black', 'sword sash boots'),
      L('Blue Spirit traveler', 'cape', 'navy/black/charcoal', 'eye-mask triple-swords hood'),
      L('Jasmine tea apprentice', 'apron', 'cream/olive/brown', 'cooking-pan scarf sandals'),
    ],
  ]);

  add('steven-universe', 'cartoon', 'Steven Universe', [
    [
      'Steven Universe',
      'gentle hero music',
      L('Beach City gem hero', 'tunic', 'coral/yellow/blue', 'star sandals bracelet'),
      L('Future road traveler', 'jacket', 'pink/white/blue', 'backpack sneakers camera'),
      L('Crystal stage singer', 'suit', 'white/gold/black', 'microphone bow-tie star'),
    ],
    [
      'Garnet',
      'hero dance gentle',
      L('Crystal Gem powerhouse', 'bodysuit', 'crimson/pink/navy', 'sunglasses gauntlets boots'),
      L('Fusion dance night', 'suit', 'purple/gold/black', 'sunglasses bow-tie microphone'),
      L('Beach City patrol', 'jacket', 'navy/crimson/black', 'gauntlets star boots'),
    ],
    [
      'Amethyst',
      'elastic mischief hero',
      L('Crystal Gem shapeshifter', 'vest', 'purple/black/charcoal', 'white-hair star boots'),
      L('Little homeworld artist', 'overalls', 'lavender/white/blue', 'paintbrush cap sneakers'),
      L('Purple comet performer', 'cape', 'purple/silver/black', 'microphone sunglasses star'),
    ],
    [
      'Pearl',
      'sword-flurry dance gentle',
      L('Crystal Gem precision', 'tunic', 'mint/yellow/sky', 'staff star dress-shoes'),
      L('Sword lesson mentor', 'gi', 'cream/teal/navy', 'sword sash armband'),
      L('Space ballet evening', 'gown', 'white/silver/lavender', 'tiara star wand'),
    ],
    [
      'Connie Maheswaran',
      'sword-flurry hero gentle',
      L('Beach City sword student', 'dress', 'mint/white/sky', 'glasses sword sneakers'),
      L('Study hall explorer', 'vest', 'navy/cream/brown', 'book backpack glasses'),
      L('Crystal rescue trainee', 'jacket', 'coral/teal/charcoal', 'sword gauntlets boots'),
    ],
  ]);

  add('gravity-falls', 'cartoon', 'Gravity Falls', [
    [
      'Dipper Pines',
      'detective hero gentle',
      L('Mystery Shack explorer', 'vest', 'navy/red/charcoal', 'cap book sneakers'),
      L('Forest anomaly watch', 'parka', 'olive/cream/brown', 'camera backpack boots'),
      L('Junior cryptid scholar', 'coat', 'tan/navy/gray', 'glasses scroll pocket-watch'),
    ],
    [
      'Mabel Pines',
      'mischief gentle dance',
      L('Shooting star sweater', 'hoodie', 'pink/yellow/purple', 'star bow sneakers'),
      L('Craft fair champion', 'apron', 'lavender/cream/blue', 'paintbrush flower glasses'),
      L('Mystery party queen', 'gown', 'purple/gold/pink', 'crown microphone star'),
    ],
    [
      'Stan Pines',
      'mischief detective hero',
      L('Mystery Shack proprietor', 'suit', 'black/white/black', 'cap glasses bow-tie'),
      L('Tourist trap handyman', 'overalls', 'blue/cream/brown', 'hammer cap gauntlets'),
      L('Grunkle sea captain', 'coat', 'navy/gold/charcoal', 'sailor-hat pocket-watch scarf'),
    ],
    [
      'Soos Ramirez',
      'gentle science hero',
      L('Mystery Shack handyman', 'tunic', 'mint/green/tan', 'cap hammer sneakers'),
      L('Workshop repair day', 'overalls', 'blue/cream/gray', 'goggles gauntlets hammer'),
      L('Game night wizard', 'robe', 'purple/gold/navy', 'wizard-hat wand book'),
    ],
    [
      'Wendy Corduroy',
      'hero gentle sport',
      L('Lumberyard cool kid', 'jacket', 'forest/black/blue', 'deer-hat red-hair boots'),
      L('Forest rescue scout', 'vest', 'tan/green/charcoal', 'backpack camera boots'),
      L('Summer concert night', 'jersey', 'black/coral/navy', 'microphone cap sneakers'),
    ],
  ]);

  add('rick-and-morty', 'cartoon', 'Rick and Morty', [
    [
      'Rick Sanchez',
      'science portal mischief',
      L('Portal scientist', 'coat', 'white/sky/brown', 'blue-hair flask goggles'),
      L(
        'Dimension field research',
        'bodysuit',
        'silver/green/charcoal',
        'space-helmet jetpack boots'
      ),
      L('Galactic council gala', 'suit', 'navy/green/black', 'blue-hair tie pocket-watch'),
    ],
    [
      'Morty Smith',
      'hero portal gentle',
      L('Unlikely space adventurer', 'tunic', 'yellow/cream/blue', 'backpack sneakers watch'),
      L('Interstellar safety suit', 'bodysuit', 'orange/white/gray', 'space-helmet jetpack boots'),
      L('School dance nerves', 'suit', 'navy/white/black', 'bow-tie flower dress-shoes'),
    ],
    [
      'Summer Smith',
      'hero sport mischief',
      L('Dimension hopping teen', 'tunic', 'coral/white/cream', 'orange-hair sneakers watch'),
      L('Space ranger Summer', 'armor', 'silver/pink/black', 'helmet gauntlets boots'),
      L('Beach planet holiday', 'dress', 'pink/gold/sky', 'sunglasses shell sandals'),
    ],
    [
      'Beth Smith',
      'science hero gentle',
      L('Horse surgeon shift', 'coat', 'white/red/navy', 'golden-hair flask badge'),
      L('Space Beth patrol', 'jacket', 'black/silver/charcoal', 'jetpack goggles boots'),
      L('Family celebration', 'gown', 'crimson/gold/black', 'necklace earrings dress-shoes'),
    ],
    [
      'Jerry Smith',
      'gentle mischief sport',
      L('Suburban family dad', 'tunic', 'forest/brown/blue', 'watch sneakers glasses'),
      L('Camping confidence', 'vest', 'tan/orange/olive', 'backpack cap boots'),
      L('Office interview day', 'suit', 'gray/white/navy', 'tie pocket-watch dress-shoes'),
    ],
  ]);

  add('tom-and-jerry', 'cartoon', 'Tom and Jerry', [
    [
      'Tom Cat',
      'mischief speed music',
      L('Housecat chase', 'bodysuit', 'gray/white/gray', 'cat-ears tail bow-tie'),
      L('Concert pianist', 'suit', 'black/white/black', 'cat-ears bow-tie microphone'),
      L('Kitchen rivalry', 'chef', 'white/red/gray', 'chef-hat cooking-pan tail'),
    ],
    [
      'Jerry Mouse',
      'mischief speed gentle',
      L('Clever little mouse', 'bodysuit', 'brown/tan/brown', 'mouse-ears tail candy'),
      L('Tiny musketeer', 'cape', 'blue/gold/cream', 'feather-hat sword boots'),
      L('Pantry pastry chef', 'apron', 'cream/coral/brown', 'chef-hat cooking-pan mouse-ears'),
    ],
    [
      'Spike Bulldog',
      'hero gentle sport',
      L('Backyard guardian', 'vest', 'gray/red/brown', 'bear-ears necklace boots'),
      L('Barbecue pitmaster', 'apron', 'white/red/charcoal', 'chef-hat cooking-pan scarf'),
      L('Neighborhood coach', 'jersey', 'navy/white/blue', 'cap armband sneakers'),
    ],
    [
      'Tyke Bulldog',
      'gentle mischief sport',
      L('Little backyard pal', 'shorts', 'tan/red/cream', 'bear-ears bow sneakers'),
      L('Puppy rain day', 'parka', 'yellow/white/blue', 'hood boots umbrella'),
      L('Puppy hero playtime', 'cape', 'red/gold/navy', 'eye-mask star boots'),
    ],
    [
      'Tuffy Mouse',
      'mischief gentle hero',
      L('Tiny pantry visitor', 'shorts', 'white/sky/cream', 'mouse-ears tail candy'),
      L('Junior musketeer', 'tunic', 'blue/white/black', 'feather-hat sword boots'),
      L('Midnight cookie baker', 'chef', 'cream/blue/brown', 'chef-hat cooking-pan mouse-ears'),
    ],
  ]);

  add('looney-tunes', 'cartoon', 'Looney Tunes', [
    [
      'Bugs Bunny',
      'mischief speed dance',
      L('Wisecracking rabbit', 'bodysuit', 'gray/white/gray', 'bunny-ears tail gauntlets'),
      L('Rabbit season detective', 'coat', 'tan/brown/charcoal', 'bunny-ears cap glasses'),
      L('Broadway carrot star', 'suit', 'black/white/black', 'top-hat bow-tie microphone'),
    ],
    [
      'Daffy Duck',
      'mischief dance hero',
      L('Spotlight hungry duck', 'bodysuit', 'black/white/orange', 'bow-tie tail star'),
      L('Duck Dodgers cadet', 'uniform', 'green/gold/black', 'space-helmet jetpack boots'),
      L('Daffy stage magician', 'cape', 'purple/gold/black', 'top-hat wand gauntlets'),
    ],
    [
      'Tweety',
      'gentle flight mischief',
      L('Little yellow songbird', 'bodysuit', 'yellow/orange/yellow', 'wings tail bow'),
      L('Canary sailor day', 'sailor', 'white/blue/navy', 'sailor-hat wings scarf'),
      L('Tiny garden explorer', 'overalls', 'sky/cream/blue', 'straw-hat flower backpack'),
    ],
    [
      'Sylvester',
      'mischief speed gentle',
      L('Tuxedo cat chase', 'bodysuit', 'black/white/black', 'cat-ears tail bow-tie'),
      L('Canary club waiter', 'vest', 'crimson/white/black', 'cat-ears tie dress-shoes'),
      L('Rooftop rainy night', 'coat', 'navy/gray/black', 'hood umbrella tail'),
    ],
    [
      'Porky Pig',
      'gentle dance hero',
      L('Blue jacket host', 'jacket', 'blue/white/charcoal', 'bow-tie cap dress-shoes'),
      L('Farmyard helper', 'overalls', 'blue/tan/brown', 'straw-hat backpack boots'),
      L('Cartoon curtain call', 'suit', 'black/gold/black', 'top-hat microphone bow-tie'),
    ],
  ]);

  add('scooby-doo', 'cartoon', 'Scooby-Doo', [
    [
      'Scooby-Doo',
      'detective gentle mischief',
      L(
        'Mystery solving Great Dane',
        'bodysuit',
        'brown/black/brown',
        'bear-ears necklace badge tail'
      ),
      L('Haunted mansion detective', 'coat', 'tan/teal/charcoal', 'cap glasses badge'),
      L('Scooby snack chef', 'chef', 'white/blue/brown', 'chef-hat cooking-pan candy'),
    ],
    [
      'Shaggy Rogers',
      'mischief speed gentle',
      L('Mystery Machine best friend', 'tunic', 'lime/green/brown', 'sneakers necklace backpack'),
      L('Monster chase camper', 'parka', 'olive/cream/navy', 'hood backpack boots'),
      L('Midnight sandwich maker', 'apron', 'cream/green/brown', 'chef-hat cooking-pan scarf'),
    ],
    [
      'Fred Jones',
      'detective hero gentle',
      L('Mystery Inc leader', 'tunic', 'white/blue/blue', 'scarf sneakers watch'),
      L('Trap builder workshop', 'overalls', 'blue/cream/gray', 'hammer goggles gauntlets'),
      L('Detective awards night', 'suit', 'navy/white/black', 'tie badge dress-shoes'),
    ],
    [
      'Daphne Blake',
      'detective hero dance',
      L('Mystery Inc style sleuth', 'dress', 'purple/lavender/pink', 'red-hair scarf boots'),
      L('Haunted trail explorer', 'jacket', 'lavender/green/navy', 'backpack camera boots'),
      L('Masquerade mystery', 'gown', 'purple/gold/black', 'eye-mask earrings necklace'),
    ],
    [
      'Velma Dinkley',
      'detective science hero',
      L('Mystery Inc clue finder', 'tunic', 'orange/red/crimson', 'glasses book dress-shoes'),
      L('Forensic laboratory', 'coat', 'white/orange/charcoal', 'glasses flask badge'),
      L('Autumn library day', 'vest', 'amber/cream/brown', 'glasses scarf backpack'),
    ],
  ]);

  add('teen-titans', 'cartoon', 'Teen Titans', [
    [
      'Robin',
      'hero detective ninja',
      L('Titans team leader', 'bodysuit', 'red/green/black', 'eye-mask cape gauntlets'),
      L('Tower training dojo', 'gi', 'white/black/charcoal', 'staff armband sash'),
      L('Undercover city patrol', 'jacket', 'navy/red/black', 'sunglasses backpack boots'),
    ],
    [
      'Starfire',
      'hero flight elemental',
      L('Tamaran star princess', 'bodysuit', 'purple/silver/purple', 'red-hair gauntlets boots'),
      L('Earth festival guest', 'dress', 'coral/gold/cream', 'flower necklace sandals'),
      L('Royal star court', 'cape', 'purple/gold/navy', 'tiara star bracelet'),
    ],
    [
      'Raven',
      'spell flight portal',
      L('Azarath mystic', 'cape', 'navy/black/black', 'hood necklace boots'),
      L('Tower library evening', 'robe', 'purple/silver/charcoal', 'book wand moon'),
      L('Quiet city disguise', 'hoodie', 'charcoal/lavender/black', 'scarf glasses sneakers'),
    ],
    [
      'Beast Boy',
      'elastic mischief gentle',
      L('Green shapeshifter', 'bodysuit', 'black/purple/black', 'green-hair gauntlets boots'),
      L('Tower game night', 'hoodie', 'purple/green/charcoal', 'cap sneakers candy'),
      L('Wildlife rescue ranger', 'vest', 'olive/tan/brown', 'backpack camera bear-ears'),
    ],
    [
      'Cyborg',
      'robot science hero',
      L('Titans tech powerhouse', 'armor', 'silver/sky/charcoal', 'gauntlets helmet boots'),
      L('Tower garage engineer', 'overalls', 'navy/silver/gray', 'goggles hammer flask'),
      L('Game day captain', 'jersey', 'blue/white/charcoal', 'basketball sneakers armband'),
    ],
  ]);

  add('ben-10', 'cartoon', 'Ben 10', [
    [
      'Ben Tennyson',
      'hero elastic science',
      L('Omnitrix hero', 'tunic', 'white/black/olive', 'watch sneakers backpack'),
      L('Alien Force road trip', 'jacket', 'green/black/blue', 'watch badge boots'),
      L('Galactic hero cadet', 'bodysuit', 'black/lime/charcoal', 'space-helmet jetpack watch'),
    ],
    [
      'Gwen Tennyson',
      'spell hero science',
      L('Summer road trip scholar', 'tunic', 'sky/white/gray', 'red-hair book sneakers'),
      L('Lucky Girl guardian', 'cape', 'purple/gold/black', 'eye-mask wand necklace'),
      L('Bellwood school morning', 'uniform', 'navy/white/black', 'backpack glasses bow'),
    ],
    [
      'Max Tennyson',
      'hero detective gentle',
      L('Rust Bucket grandpa', 'jacket', 'red/cream/tan', 'white-hair backpack boots'),
      L('Plumber field captain', 'armor', 'navy/silver/charcoal', 'helmet badge gauntlets'),
      L('Campground cookout', 'apron', 'cream/orange/brown', 'chef-hat cooking-pan scarf'),
    ],
    [
      'Kevin Levin',
      'hero elemental mischief',
      L('Bellwood garage regular', 'vest', 'black/gray/blue', 'long-hair necklace boots'),
      L('Garage repair expert', 'overalls', 'charcoal/green/gray', 'goggles hammer gauntlets'),
      L('Alien alloy protector', 'armor', 'silver/black/charcoal', 'gauntlets helmet boots'),
    ],
    [
      'Vilgax',
      'hero elemental science',
      L('Galactic conqueror', 'armor', 'teal/black/charcoal', 'helmet gauntlets boots'),
      L('Warlord ceremonial robe', 'robe', 'purple/gold/black', 'crown staff cape'),
      L('Deep space campaign', 'bodysuit', 'navy/silver/black', 'space-helmet jetpack gauntlets'),
    ],
  ]);

  add('dexters-laboratory', 'cartoon', 'Dexter’s Laboratory', [
    [
      'Dexter',
      'science robot hero',
      L('Boy genius at work', 'coat', 'white/black/charcoal', 'orange-hair glasses gauntlets'),
      L('Lab mech pilot', 'armor', 'blue/silver/navy', 'helmet goggles jetpack'),
      L('Science fair champion', 'suit', 'navy/gold/black', 'glasses bow-tie flask'),
    ],
    [
      'Dee Dee',
      'dance mischief gentle',
      L('Laboratory ballerina', 'dress', 'pink/white/pink', 'golden-hair bow dress-shoes'),
      L('Button pushing explorer', 'overalls', 'lavender/yellow/blue', 'goggles sneakers backpack'),
      L('Sugar plum recital', 'gown', 'lavender/silver/white', 'tiara wand wings'),
    ],
    [
      'Mandark',
      'science mischief robot',
      L('Rival laboratory genius', 'coat', 'white/black/charcoal', 'glasses book flask'),
      L('Evil mech commander', 'armor', 'black/purple/charcoal', 'helmet gauntlets jetpack'),
      L('Rival genius gala', 'suit', 'purple/gold/black', 'glasses bow-tie pocket-watch'),
    ],
    [
      "Dexter's Mom",
      'cook gentle hero',
      L('Family kitchen captain', 'apron', 'yellow/green/brown', 'gauntlets cooking-pan scarf'),
      L('Suburban shopping day', 'dress', 'green/cream/teal', 'necklace sunglasses dress-shoes'),
      L(
        'Secret cleaning operative',
        'bodysuit',
        'black/yellow/charcoal',
        'goggles gauntlets boots'
      ),
    ],
    [
      "Dexter's Dad",
      'gentle cook mischief',
      L('Cheerful suburban dad', 'tunic', 'white/blue/navy', 'tie watch dress-shoes'),
      L('Weekend barbecue master', 'apron', 'orange/cream/brown', 'chef-hat cooking-pan cap'),
      L('Office promotion dinner', 'suit', 'navy/white/black', 'bow-tie pocket-watch rose'),
    ],
  ]);

  add('courage-the-cowardly-dog', 'cartoon', 'Courage the Cowardly Dog', [
    [
      'Courage',
      'hero gentle speed',
      L('Nowhere farmhouse guardian', 'bodysuit', 'pink/black/pink', 'bear-ears tail necklace'),
      L('Paranormal rescue detective', 'coat', 'tan/pink/charcoal', 'cap glasses camera'),
      L('Farmhouse kitchen helper', 'apron', 'cream/coral/brown', 'chef-hat cooking-pan scarf'),
    ],
    [
      'Muriel Bagge',
      'gentle cook music',
      L(
        'Kind farmhouse caretaker',
        'dress',
        'yellow/cream/amber',
        'glasses white-hair dress-shoes'
      ),
      L('Nowhere pie kitchen', 'apron', 'cream/yellow/brown', 'glasses cooking-pan scarf'),
      L('Country music evening', 'gown', 'lavender/gold/cream', 'necklace flower microphone'),
    ],
    [
      'Eustace Bagge',
      'mischief gentle dance',
      L('Nowhere farmer', 'overalls', 'teal/tan/brown', 'cap glasses boots'),
      L('Scare mask prankster', 'cape', 'olive/black/charcoal', 'eye-mask cap gauntlets'),
      L('Farm auction Sunday', 'suit', 'brown/cream/black', 'tie glasses pocket-watch'),
    ],
    [
      'Katz',
      'mischief detective speed',
      L('Sinister hotel host', 'vest', 'crimson/purple/black', 'cat-ears bow-tie tail'),
      L('Cruise ship proprietor', 'sailor', 'white/navy/black', 'sailor-hat cat-ears sunglasses'),
      L('Mysterious masquerade', 'cape', 'black/gold/crimson', 'eye-mask rose dress-shoes'),
    ],
    [
      'Dr. Le Quack',
      'mischief science detective',
      L('Suspicious traveling doctor', 'suit', 'purple/white/black', 'top-hat glasses bow-tie'),
      L('False clinic consultant', 'coat', 'white/teal/charcoal', 'flask badge glasses'),
      L('Master chef disguise', 'chef', 'white/red/black', 'chef-hat cooking-pan scarf'),
    ],
  ]);

  add('the-flintstones', 'cartoon', 'The Flintstones', [
    [
      'Fred Flintstone',
      'mischief sport gentle',
      L('Bedrock quarry worker', 'tunic', 'orange/black/amber', 'tie sandals badge'),
      L('Loyal lodge gathering', 'robe', 'brown/gold/black', 'horns sash necklace'),
      L('Bedrock bowling captain', 'jersey', 'sky/white/navy', 'armband sneakers star'),
    ],
    [
      'Wilma Flintstone',
      'gentle hero cook',
      L('Bedrock family elegance', 'dress', 'white/cream/white', 'red-hair necklace sandals'),
      L('Stone age kitchen', 'apron', 'cream/red/brown', 'cooking-pan scarf flower'),
      L('Rock opera premiere', 'gown', 'coral/gold/cream', 'earrings necklace bracelet'),
    ],
    [
      'Barney Rubble',
      'gentle sport mischief',
      L('Bedrock best neighbor', 'tunic', 'brown/tan/brown', 'golden-hair sandals necklace'),
      L('Quarry safety shift', 'overalls', 'tan/orange/charcoal', 'helmet hammer boots'),
      L('Bowling league night', 'jersey', 'green/white/navy', 'armband sneakers star'),
    ],
    [
      'Betty Rubble',
      'gentle cook dance',
      L('Bedrock blue bow', 'dress', 'sky/white/blue', 'bow necklace sandals'),
      L('Neighborhood bake sale', 'apron', 'cream/sky/brown', 'chef-hat cooking-pan flower'),
      L('Moonstone gala', 'gown', 'navy/silver/sky', 'tiara earrings moon'),
    ],
    [
      'Pebbles Flintstone',
      'gentle mischief speed',
      L('Little Bedrock explorer', 'shorts', 'lime/black/black', 'red-hair bow sandals'),
      L('Prehistoric garden helper', 'overalls', 'coral/cream/brown', 'straw-hat flower backpack'),
      L('Tiny cave princess', 'dress', 'pink/gold/cream', 'crown star necklace'),
    ],
  ]);

  add('the-jetsons', 'cartoon', 'The Jetsons', [
    [
      'George Jetson',
      'robot gentle mischief',
      L('Orbit City commuter', 'tunic', 'white/sky/teal', 'watch sneakers badge'),
      L('Spacely office shift', 'suit', 'navy/white/black', 'tie pocket-watch glasses'),
      L('Zero gravity weekend', 'bodysuit', 'silver/blue/navy', 'space-helmet jetpack boots'),
    ],
    [
      'Jane Jetson',
      'gentle dance hero',
      L(
        'Orbit City purple style',
        'dress',
        'purple/white/lavender',
        'orange-hair earrings dress-shoes'
      ),
      L('Space mall outing', 'coat', 'lavender/silver/navy', 'sunglasses necklace boots'),
      L('Starlight ballroom', 'gown', 'pink/gold/white', 'tiara bracelet star'),
    ],
    [
      'Judy Jetson',
      'music dance mischief',
      L('Orbit High trendsetter', 'dress', 'pink/white/crimson', 'white-hair bow dress-shoes'),
      L('Future pop concert', 'jacket', 'crimson/silver/black', 'microphone sunglasses star'),
      L('Space academy cadet', 'uniform', 'white/pink/navy', 'space-helmet badge boots'),
    ],
    [
      'Elroy Jetson',
      'science robot gentle',
      L('Little space scholar', 'overalls', 'green/white/teal', 'cap book sneakers'),
      L('Junior space ranger', 'bodysuit', 'sky/silver/navy', 'space-helmet jetpack boots'),
      L('Future laboratory day', 'coat', 'white/green/charcoal', 'goggles flask gauntlets'),
    ],
    [
      'Rosie',
      'robot cook gentle',
      L('Jetson robot housekeeper', 'apron', 'white/black/sky', 'bow badge gauntlets'),
      L('Future kitchen expert', 'chef', 'white/blue/charcoal', 'chef-hat cooking-pan flask'),
      L('Orbit City dance night', 'gown', 'navy/silver/sky', 'tiara earrings microphone'),
    ],
  ]);

  add('ducktales', 'cartoon', 'DuckTales', [
    [
      'Scrooge McDuck',
      'hero detective mischief',
      L('Duckburg treasure tycoon', 'coat', 'red/black/black', 'top-hat glasses staff'),
      L('Adventure fortune hunter', 'vest', 'tan/red/brown', 'straw-hat backpack boots'),
      L('Money bin board meeting', 'suit', 'navy/gold/black', 'glasses pocket-watch bow-tie'),
    ],
    [
      'Huey Duck',
      'science detective hero',
      L('Red Junior Woodchuck', 'tunic', 'red/white/charcoal', 'cap book sneakers'),
      L('Woodchuck trail captain', 'vest', 'tan/red/olive', 'backpack badge boots'),
      L('Science fair explorer', 'coat', 'white/red/navy', 'goggles flask book'),
    ],
    [
      'Dewey Duck',
      'hero dance mischief',
      L('Blue adventure seeker', 'tunic', 'blue/white/charcoal', 'cap sneakers watch'),
      L('Sky pirate apprentice', 'jacket', 'navy/gold/black', 'pilot-goggles scarf boots'),
      L('Duckburg talent star', 'suit', 'blue/silver/black', 'microphone bow-tie star'),
    ],
    [
      'Louie Duck',
      'mischief detective gentle',
      L('Green easygoing schemer', 'hoodie', 'green/white/charcoal', 'cap sneakers candy'),
      L('Junior business tycoon', 'suit', 'forest/gold/black', 'tie pocket-watch sunglasses'),
      L('Reluctant jungle explorer', 'vest', 'tan/green/brown', 'backpack cap boots'),
    ],
    [
      'Webby Vanderquack',
      'hero detective sport',
      L('Duckburg adventure scholar', 'dress', 'pink/purple/white', 'bow book sneakers'),
      L('Secret agent training', 'bodysuit', 'black/pink/charcoal', 'goggles gauntlets boots'),
      L('Lost city expedition', 'jacket', 'tan/pink/brown', 'backpack camera scarf'),
    ],
  ]);

  add('winnie-the-pooh', 'cartoon', 'Winnie the Pooh', [
    [
      'Winnie the Pooh',
      'gentle cook mischief',
      L('Hundred Acre Wood friend', 'tunic', 'red/yellow/amber', 'bear-ears honey-pot'),
      L('Honey picnic helper', 'apron', 'cream/red/brown', 'straw-hat honey-pot cooking-pan'),
      L('Rainy thinking walk', 'parka', 'yellow/cream/amber', 'hood umbrella boots'),
    ],
    [
      'Tigger',
      'speed dance mischief',
      L('Bouncy forest tiger', 'bodysuit', 'orange/black/amber', 'cat-ears tail sneakers'),
      L('Bounce team captain', 'jersey', 'orange/white/black', 'armband star sneakers'),
      L('Treetop rain explorer', 'poncho', 'forest/cream/brown', 'hood backpack boots'),
    ],
    [
      'Piglet',
      'gentle hero mischief',
      L('Brave little friend', 'vest', 'pink/crimson/pink', 'bear-ears scarf sandals'),
      L('Garden seed helper', 'overalls', 'sky/cream/brown', 'straw-hat flower boots'),
      L('Cozy blustery day', 'parka', 'cream/pink/navy', 'beanie mittens scarf'),
    ],
    [
      'Eeyore',
      'gentle dance hero',
      L('Thoughtful meadow friend', 'bodysuit', 'gray/lavender/gray', 'bear-ears tail bow'),
      L('Rain shelter wanderer', 'poncho', 'sky/cream/charcoal', 'hood umbrella boots'),
      L('Meadow birthday guest', 'vest', 'lavender/white/navy', 'flower bow-tie tail'),
    ],
    [
      'Rabbit',
      'gentle cook detective',
      L('Careful garden planner', 'vest', 'yellow/cream/brown', 'bunny-ears glasses book'),
      L('Vegetable patch keeper', 'overalls', 'forest/tan/brown', 'straw-hat flower boots'),
      L('Harvest feast host', 'chef', 'white/green/tan', 'chef-hat cooking-pan scarf'),
    ],
  ]);

  add('mickey-and-friends', 'cartoon', 'Mickey & Friends', [
    [
      'Mickey Mouse',
      'mischief dance hero',
      L('Classic red shorts', 'shorts', 'black/white/red', 'mouse-ears gauntlets dress-shoes'),
      L('Sorcerer apprentice', 'robe', 'red/gold/black', 'wizard-hat wand mouse-ears'),
      L('Showtime master of ceremonies', 'suit', 'black/white/red', 'top-hat bow-tie microphone'),
    ],
    [
      'Minnie Mouse',
      'dance gentle music',
      L('Polka bow sweetheart', 'dress', 'red/white/red', 'mouse-ears bow dress-shoes'),
      L('Garden party hostess', 'apron', 'pink/cream/brown', 'straw-hat flower cooking-pan'),
      L('Starlight musical gala', 'gown', 'pink/gold/white', 'tiara necklace microphone'),
    ],
    [
      'Donald Duck',
      'mischief hero dance',
      L('Classic sailor duck', 'sailor', 'blue/white/navy', 'sailor-hat bow-tie sandals'),
      L('Seaside captain', 'coat', 'navy/gold/black', 'sailor-hat pocket-watch boots'),
      L('Duck kitchen disaster', 'chef', 'white/red/black', 'chef-hat cooking-pan scarf'),
    ],
    [
      'Daisy Duck',
      'dance gentle music',
      L('Lavender bow style', 'dress', 'lavender/white/purple', 'bow bracelet dress-shoes'),
      L('Fashion atelier afternoon', 'apron', 'pink/cream/navy', 'glasses paintbrush scarf'),
      L('Silver screen premiere', 'gown', 'purple/gold/black', 'earrings necklace star'),
    ],
    [
      'Goofy',
      'mischief sport gentle',
      L('Lovable tall pal', 'vest', 'orange/black/blue', 'cap boots gauntlets'),
      L('Weekend camping guide', 'overalls', 'olive/tan/brown', 'straw-hat backpack boots'),
      L('Goofy sports champion', 'jersey', 'green/white/navy', 'basketball sneakers armband'),
    ],
  ]);

  root.WorkHubMomoCosplayData = Object.freeze({
    SERIES: Object.freeze(SERIES),
    CHARACTERS: Object.freeze(CHARACTERS),
    GARMENTS,
    ACCESSORIES,
    MOVES,
  });
})(typeof window === 'undefined' ? globalThis : window);
