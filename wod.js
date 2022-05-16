if (typeof log === 'undefined') var log = (...args) => console.log(...args);
if (typeof sendChat === 'undefined') var sendChat = log;

const vtmCONSTANTS = {
  VTMCOMMAND: "!vtm",
  ROLLS: new Set([
    'skill', 'atr', 'will', 'roll', 'rouse', 'reroll',
    'frenzy', 'remorse', 'humanity'
  ]),
  DEBUG: new Set(['log', 'graphics', 'test']),
  GRAPHICSIZE: {
    SMALL: 20,
    MEDIUM: 30,
    LARGE: 40,
    XLARGE: 50,
    XXLARGE: 60
  },
  IMG: {
    DICE: {
      NORMAL: {
        // botch:
        1:  "https://i.imgur.com/BhwBgoy.png",
        // miss:
        2:  "https://i.imgur.com/jz6fhT2.png",
        3:  "https://i.imgur.com/jz6fhT2.png",
        4:  "https://i.imgur.com/jz6fhT2.png",
        5:  "https://i.imgur.com/jz6fhT2.png",
        // success:
        6:  "https://i.imgur.com/zjhWSpA.png",
        7:  "https://i.imgur.com/zjhWSpA.png",
        8:  "https://i.imgur.com/zjhWSpA.png",
        9:  "https://i.imgur.com/zjhWSpA.png",
        // crit:
        10: "https://i.imgur.com/JuE1DTR.png"
      },
      MESSY: {
        // botch:
        1:  "https://i.imgur.com/41ZXRdA.png",
        // miss:
        2:  "https://i.imgur.com/ipwOggU.png",
        3:  "https://i.imgur.com/ipwOggU.png",
        4:  "https://i.imgur.com/ipwOggU.png",
        5:  "https://i.imgur.com/ipwOggU.png",
        // success:
        6:  "https://i.imgur.com/9FzRKxA.png",
        7:  "https://i.imgur.com/9FzRKxA.png",
        8:  "https://i.imgur.com/9FzRKxA.png",
        9:  "https://i.imgur.com/9FzRKxA.png",
        // crit:
        10: "https://i.imgur.com/xUhtSHU.png"
      }
    },
    BANNERS: {
      BEAST: {
        URL: 'https://i.imgur.com/6N0Ld40.png',
        TITLE: 'The Beast',
      },
      HUNGER_GAIN: {
        URL: 'https://i.imgur.com/UV57YLP.png',
        TITLE: 'Hunger Gain',
      },
      HUNGER_NO_GAIN: {
        URL: 'https://i.imgur.com/b3NHCNk.png',
        TITLE: 'Rousing Success',
      },
      FRENZY_RESIST: {
        URL: 'https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/vampire-v5/Banners/FrenzyRestrained.png',
        TITLE: 'Frenzy Restrained',
      },
      FRENZY: {
        URL: 'https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/vampire-v5/Banners/Frenzy.png',
        TITLE: 'Frenzy',
      },
      REMORSE_PASS: {
        URL: 'https://i.imgur.com/zubTvLd.png',
        TITLE: 'Guilty',
      },
      REMORSE_FAIL: {
        URL: 'https://i.imgur.com/21qrGX5.png',
        TITLE: 'Innocent',
      },
      LAST_RESORT: {
        URL: 'https://i.imgur.com/4XbkQua.png',
        TITLE: 'Last Resort',
      },
      MISS_FAIL: {
        URL: 'https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/vampire-v5/Banners/MissFail.png',
        TITLE: 'Miss',
      },
      MESSY: {
        URL: 'https://i.imgur.com/KZTTwlE.png',
        TITLE: 'Messy',
      },
      CRIT: {
        URL: 'https://i.imgur.com/XNA64u9.png',
        TITLE: 'Crit',
      }
    }
  },
  BASEDC:{
    // These DCs are set to be equal to or greater than their listed value
    critFail: 1,
    nil: 2,
    success: 6,
    critSuccess: 10
  }
};

const vtmGlobal = {
  diceLogChat: true,
  diceGraphicsChat: true,
  diceGraphicsChatSize: vtmCONSTANTS.GRAPHICSIZE.XLARGE,
  diceTextResult: "",
  diceTextResultLog: "",
  diceGraphicResult: "",
  diceGraphicResultLog: "",
  diceLogRolledOnOneLine: false,
  luckydice: false,
  reroll: ""
};

// roll20 api handler
function roll20ApiHandler(msg) {
  // returns the chat window command entered, all in lowercase.
  if (msg.type !== 'api') return;

  log("New roll:", msg);

  if (_.has(msg, 'inlinerolls')) msg = performInlineRolls(msg);

  let argv = formatCommandLineArguments(msg.content);
  log(argv);

  try {
    if (vtmCONSTANTS.ROLLS.has(argv[1])) {
      processVampireDiceScript(argv, msg.who);
    } else if (vtmCONSTANTS.DEBUG.has(argv[1])) {
      processDebugScript(argv);
    }
  } catch (err) {
    sendChat("Error", "Invalid input " + err);
  }
}

function performInlineRolls(msg) {
  log("Inline Roll");
  msg.content = _.chain(msg.inlinerolls)
    .reduce(function (accumulator, currentValue, index) {
      accumulator['$[[' + index + ']]'] = currentValue.results.total || 0;
      return accumulator;
    }, {})
    .reduce(function (accumulator, currentValue, index) {
      return accumulator.replace(currentValue, index);
    }, msg.content)
    .value();

  return msg;
}

function formatCommandLineArguments(chatCommand) {
  vtmGlobal.reroll = chatCommand
    .replace(/"/g, '&quot;')
    .replace(/~/g, '&#126;');

  let argv = []
    .concat
    .apply([], chatCommand.split('~').map(function (value, index) {
      return index % 2 ? value : value.split(' ');
    })).filter(Boolean);

  return argv;
}

function processDebugScript(argv) {
  // this will run the various other scripts depending upon the chat
  // window command.  Just add another Case statement to add a new command.
  return {
    log: setLogging,
    graphics: setGraphics,
  }(argv[1]);
}

function processVampireDiceScript(argv, who) {
  let input = parseCommandLineVariables(argv, who);
  let dicePool = calculateRunScript(input);
  dicePool.user = input.user;
  dicePool.rollname = input.rollname;

  return vtmRollDiceSuperFunc(dicePool);
}

function parseCommandLineVariables(argv, who) {
  let args = {
    type: argv[1],
    attribute: 0,
    skill: 0,
    hunger: 0,
    modifier: 0,
    willpower: 0,
    user: who,
    rollname: null,
    successDc: 6,
    difficulty: 1
  };

  for (let i = 2; i < argv.length; i++) {
    let entry = argv[i];
    let identifier = entry.substring(0, 1);

    if (identifier === "a") {
      // Assign an int directly to an attribute
      let value = parseInt(entry.substring(1), 10);
      args.attribute = value;
    } else if (identifier === "s") {
      // Assign an int directly to a skill
      let value = parseInt(entry.substring(1), 10);
      args.skill = value;
    } else if (identifier === "o") {
      // Used to assign a trait much like "p", this is used in Willpower rolls to assign humanity
      let value = parseInt(entry.substring(1), 10);
      value = updateMultiboxValue(value);
      args.skill = value;
    } else if (identifier === "r") {
      // Red die. Used for assigning a value directly to hunger die.
      let value = parseInt(entry.substring(1), 10);
      args.hunger = value;
    } else if (identifier === "m") {
      // Adds a modifier value straight
      let value = parseInt(entry.substring(1), 10);
      args.modifier += value;
    } else if (identifier === "b") {
      // Adds half of value to modifier. Example Discipline
      let value = parseInt(entry.substring(1), 10);
      value = Math.floor(value / 2.0);
      args.modifier += value;
    } else if (identifier === "w") {
      // Used for willpower if you want to give it a value directly
      let value = parseInt(entry.substring(1), 10);
      args.willpower = value;
    } else if (identifier === "p") {
      // Used for traits which have 4 states such willpower and health
      let value = parseInt(entry.substring(1), 10);
      value = updateMultiboxValue(value);
      args.willpower = value;
    } else if (identifier === "d") {
      // Used for varying a difficulty
      let value = parseInt(entry.substring(1), 10);
      if (value < 1) {
        value = 1;
      } else if (value > 10) {
        value = 10;
      }
      args.successDc = value;
    } else if (identifier === "c") {
      // Used for assigning a character name
      i++;
      let value = argv[i];
      if (value && value.trim().length) {
        args.user = value.trim();
      }
    } else if (identifier === "t") {
      // Used for assigning a rollname
      i++;
      let value = argv[i];
      if (value && value.trim().length) {
        args.rollname = value.trim();
      }
    } else if (identifier === "q") {
      // The number of successes required (used for only certain rolls)
      let value = parseInt(entry.substring(1), 10);
      args.difficulty = value;
    } else if (args.type === "remorse") {
      // Used for remorse rolls
      let totalValue = parseInt(entry.substring(1), 10);
      let totalRemorse = updateMultiboxValue(totalValue);
      let missingRemorse = totalValue - totalRemorse;
      missingRemorse = updateMultiboxValue1(missingRemorse);
      args.willpower = missingRemorse / 16.0;
    }
  }

  return args;
}

// Decides how to distribute dice based on the type of roll
function calculateRunScript(input) {
  return {
    atr:      handleSkillRoll,
    frenzy:   handleFrenzyRoll,
    humanity: handleHumanityRoll,
    remorse:  handleRemorseRoll,
    rouse:    handleRouseRoll,
    simple:   handleSimpleRoll,
    skill:    handleSkillRoll,
    will:     handleWillpowerRoll,
  }[input.type](input);
}

function vtmRollDiceSuperFunc(dicePool) {
  var attackDiceResults = {
    nilScore: 0,
    successScore: 0,
    critScore: 0,
    muddyCritScore: 0,
    failScore: 0,
    diceGraphicsLog: "",
    diceTextLog: ""
  };
  var defendDiceResults = {
    nilScore: 0,
    successScore: 0,
    critScore: 0,
    muddyCritScore: 0,
    failScore: 0,
    diceGraphicsLog: "",
    diceTextLog: "",
    hungerSustained: true
  };

  var diceTextRolled = "";
  var diceGraphicsRolled = "";

  log("Roll Variables");
  log(dicePool);
  let user = dicePool.user;

  attackDiceResults = rollVTMDice(dicePool.blackDice, "v");
  defendDiceResults = rollVTMDice(dicePool.redDice, "h");

  log(attackDiceResults);
  log(defendDiceResults);

  let diceTotals = {
    nilScore: attackDiceResults.nilScore + defendDiceResults.nilScore,
    successScore: attackDiceResults.successScore + defendDiceResults.successScore,
    critScore: attackDiceResults.critScore + defendDiceResults.critScore,
    muddyCritScore: attackDiceResults.muddyCritScore + defendDiceResults.muddyCritScore,
    failScore: attackDiceResults.failScore + defendDiceResults.failScore,
    diceGraphicsLog: attackDiceResults.diceGraphicsLog + defendDiceResults.diceGraphicsLog,
    diceTextLog: "Normal" + attackDiceResults.diceTextLog + "Hunger" + defendDiceResults.diceTextLog
  };

  let messageBuilder = createMessageBuilder();
  messageBuilder.addSection(`name=${user}`);

  if (dicePool.rollname) messageBuilder.addSection(`Rollname=${dicePool.rollname}`);

  if (vtmGlobal.diceLogChat === true) {
    if (vtmGlobal.diceLogRolledOnOneLine === true) {
      diceGraphicsRolled = diceTotals.diceGraphicsLog;
      diceTextRolled = diceTotals.diceTextLog;
      if (vtmGlobal.diceGraphicsChat === true) {
        messageBuilder.addSection(`Roll=${diceGraphicsRolled}`);
      } else {
        messageBuilder.addSection(`Roll=${diceTextRolled}`);
      }
    } else if (vtmGlobal.diceGraphicsChat === true) {
      messageBuilder.addSection(`Normal=${attackDiceResults.diceGraphicsLog}`);
      messageBuilder.addSection(`Hunger=${defendDiceResults.diceGraphicsLog}`);
    } else {
      messageBuilder.addSection(`Normal=${attackDiceResults.diceTextLog}`);
      messageBuilder.addSection(`Hunger=${defendDiceResults.diceTextLog}`);
    }
  }

  if (dicePool.rouseStatRoll) {
    let critScore = diceTotals.critScore + diceTotals.muddyCritScore;
    let critBonus = Math.floor(critScore / 2) * 2;
    let score = diceTotals.successScore + critBonus;

    messageBuilder.addSection(`Successes=${score}`);
    if (diceTotals.successScore > 0) {
      messageBuilder.addBanner('Beast', 'HUNGER_GAIN');
    } else {
      messageBuilder.addBanner('Beast', 'HUNGER_NO_GAIN');
    }
  } else if (dicePool.frenzyRoll) {
    messageBuilder.addSection(`Successes=${diceTotals.successScore}`);
    if (diceTotals.successScore >= dicePool.difficulty) {
      messageBuilder.addBanner('Beast', 'FRENZY_RESIST');
    } else {
      messageBuilder.addBanner('Beast', 'FRENZY');
    }
  } else if (dicePool.remorseRoll) {
    messageBuilder.addSection(`Successes=${diceTotals.successScore}`);
    if (diceTotals.successScore > 0) {
      messageBuilder.addBanner('Beast', 'REMORSE_PASS');
    } else {
      messageBuilder.addBanner('Beast', 'REMORSE_FAIL');
    }

    if (vtmGlobal.luckydice) {
      messageBuilder.addBanner('Fate', 'LAST_RESORT');
    }
  } else {
    addRollDeclarations(diceTotals, messageBuilder);
  }

  vtmGlobal.luckydice = false;
  messageBuilder.addSection(`Reroll=[Reroll](${vtmGlobal.reroll})`);

  log("Output");
  log(messageBuilder.getMessage());

  sendChat(user, messageBuilder.getMessage());
}

function rollVTMDice(diceQty, type) {
  const dc = vtmCONSTANTS.BASEDC;
  const diceResult = {
    nilScore: 0,
    successScore: 0,
    critScore: 0,
    muddyCritScore: 0,
    failScore: 0,
    diceGraphicsLog: "",
    diceTextLog: ""
  };

  // Used to build images
  function imgUrlBuilder(image, roll) {
    return `<img \
    src="${image}" \
    title="${roll}" \
    height="${vtmGlobal.diceGraphicsChatSize}" \
    width="${vtmGlobal.diceGraphicsChatSize}" \
    />`;
  }

  for (let i = 1; i <= diceQty; i++) {
    let roll = Math.floor(Math.random() * 10) + 1;

    let image = getDiceImage(type, roll);
    diceResult.diceTextLog += `(${roll})`;
    diceResult.diceGraphicsLog += imgUrlBuilder(image, roll);

    // TODO: break this away from nested IFs
    if (type === "v") {
      if (roll >= dc.critSuccess) {
        diceResult.successScore += 1;
        diceResult.critScore += 1;
      } else if (roll >= dc.success) {
        diceResult.successScore += 1;
      } else if (roll >= dc.nil) {
        diceResult.nilScore += 1;
      } else if (roll >= dc.critFail) {
        diceResult.nilScore += 1;
      }
    } else if (type === "h") {
      if (roll >= dc.critSuccess) {
        diceResult.successScore += 1;
        diceResult.muddyCritScore += 1;
      } else if (roll >= dc.success) {
        diceResult.successScore += 1;
      } else if (roll >= dc.nil) {
        diceResult.nilScore += 1;
      } else if (roll >= dc.critFail) {
        diceResult.failScore += 1;
      }
    }
  }

  return diceResult;
}

/**
 * Get the image associated with the roll.
 * @param {*} type The type (V) Vampire or (H) Hunger.
 * @param {*} roll The roll value. Returns null if not 1 - 10
 */
function getDiceImage(type, roll) {
  let imgPool = vtmCONSTANTS.IMG.DICE[(type === 'v') ? 'NORMAL' : 'MESSY'];
  return imgPool[roll];
}

function addRollDeclarations(diceTotals, messageBuilder) {
  // Crit bonus is + 2 successes for each PAIR of crits.
  // Thus 2 crits is + 2 successs, 3 crits is + 2 successes.
  let critScore = diceTotals.critScore + diceTotals.muddyCritScore;
  let critBonus = Math.floor(critScore / 2) * 2;
  let score = diceTotals.successScore + critBonus;
  messageBuilder.addSection(`Successes=${score}`);

  if (vtmGlobal.luckydice) messageBuilder.addBanner('Fate', 'LAST_RESORT');
  if (!diceTotals.successScore) messageBuilder.addBanner('Fate', 'MISS_FAIL');

  let isMuddy = diceTotals.muddyCritScore === 1 && (diceTotals.critScore >= 1);
  isMuddy = isMuddy || diceTotals.muddyCritScore >= 2;
  if (isMuddy) {
    messageBuilder.addBanner('Messy', 'MESSY');
  } else if (diceTotals.critScore >= 2) {
    messageBuilder.addBanner('Crit', 'CRIT');
  }

  if (diceTotals.failScore >= 1) messageBuilder.addBanner('Beast', 'BEAST');
}

function createMessageBuilder() {
  let message = "&{template:wod} ";

  function getMessage() {
    return message;
  }
  function addSection(content) {
    message += `{{${content}}} `;
  }
  function addBanner(name, key) {
    let banner = bannerImage(key);
    addSection(`${name}=${banner}`);
  }

  return {
    getMessage,
    addSection,
    addBanner,
  };
}

function bannerImage(banner) {
  let image = vtmCONSTANTS.IMG.BANNERS[banner];
  let src = image.URL;
  let title = image.TITLE;
  return `<img src="${src}" title="${title}" height="20" width="228"/>`;
}

function handleSkillRoll(input) {
  return new DicePool(input, true);
}

function handleWillpowerRoll(input) {
  return new DicePool(input, true);
}

function handleRouseRoll(input) {
  let args = {hunger: Math.max(1, input.modifier || 0)};
  let dicePool = new DicePool(args);
  dicePool.rouseStatRoll = true;

  return dicePool;
}

function handleFrenzyRoll(input) {
  let dicePool = new DicePool(input, true);
  dicePool.frenzyRoll = true;
  dicePool.difficulty = input.difficulty;

  return dicePool;
}

function handleSimpleRoll(input) {
  let args = Object.create(input);
  args.modifier = (args.modifier || 0) + (args.hunger || 0);

  return new DicePool(args, false);
}

function handleRemorseRoll(input) {
  let dicePool = new DicePool(input, true);
  dicePool.remorseRoll = true;

  return dicePool;
}

function handleHumanityRoll(input) {
  return new DicePool(input, true);
}

// Used for multistate checkboxes
function updateMultiboxValue(value) {
  value = scaleMultiboxValue(value, 3616);
  value = scaleMultiboxValue(value, 241);
  value = scaleMultiboxValue(value, 16);
  return value;
}

// Used for multistate checkboxes
function updateMultiboxValue1(value) {
  value = scaleMultiboxValue(value, 3616);
  value = scaleMultiboxValue(value, 241);
  return value;
}

function scaleMultiboxValue(value, scaleNumber) {
  while (value > scaleNumber) value -= scaleNumber;

  return value;
}

/**
 * Adjusts the output logging.
 *
 * @todo Either deprecate this, or provide examples
 *
 * @param {string} value A key as to whether to enable or disable chat logging,
 * or to enable dice logging on one line or multiple.
 */
function setLogging(value) {
  return {
    on: toggleChatLogging,
    off: toggleChatLogging,
    single: toggleSingleLineRoll,
    multi: toggleSingleLineRoll,
  }[value]();
}
function toggleChatLogging(key) {
  vtmGlobal.diceLogChat = {
    on: true,
    off: false
  }[key];
}
function toggleSingleLineRoll(key) {
  vtmGlobal.diceLogRolledOnOneLine = {
    single: true,
    multi: false
  }[key];
}

/**
 * Affects the image size configuration in the global environment.
 *
 * @param {string} value A string from below options:
 * - on, off
 * - s, m, l, x, xx
 */
function setGraphics(value) {
  return {
    on:   toggleGraphics,
    off:  toggleGraphics,
    s:    setGraphicSize,
    m:    setGraphicSize,
    l:    setGraphicSize,
    x:    setGraphicSize,
    xx:   setGraphicSize
  }[value]();
}
function toggleGraphics(key) {
  vtmGlobal.diceGraphicsChat = {
    on: true,
    off: false
  }[key];
}
function setGraphicSize(key) {
  vtmGlobal.diceGraphicsChatSize = vtmCONSTANTS.GRAPHICSIZE[{
    s:  'SMALL',
    m:  'MEDIUM',
    l:  'LARGE',
    x:  'XLARGE',
    xx: 'XXLARGE'
  }[key]];
}

/**
 * Represents a total pool of dice.
 * Given a list of numbers which go into the dice pool, the current
 * implementation separates them into black and red dice amounts.
 *
 * @todo Refactor this so that 'black dice' and 'red dice' are separate pools.
 * @todo Create a 'flags' object instead of taking random flags from anywhere.
 *
 * @param {object} args An object that contains various numbers supplied by the
 * command call, e.g. attribute, skill etc.
 * These keys should all relate to integers.
 * @param {boolean} allowLucky A "last resort" flag to indicate whether the roll
 * should be given at least 1 die, no matter the modifiers.
 *
 * @returns {object} A collection of black and red dice values.
 */
function DicePool (args, allowLucky = false) {
  const allowableArgs = [
    'attribute',
    'skill',
    'modifier',
    'willpower',
  ];
  const sumDice = (dice, attr) => dice + args[attr];

  let total = allowableArgs.reduce(sumDice, 0) || 0;
  let redDice = args.hunger || 0;

  if (total <= 0 && allowLucky) {
    this.lucky = true;
    total = 1;
  }

  this.blackDice = Math.max(0, total - redDice);
  this.redDice = redDice;
}

/**
 * Represents a single die roll.
 *
 * @param {string} type The type, 'n' for normal, 'h' for hunger
 * @returns {object} with value and image attributes
 */
function Die (type) {
  const imgSet = {
    n: vtmCONSTANTS.IMG.DICE.NORMAL,
    h: vtmCONSTANTS.IMG.DICE.MESSY,
  }[type];

  this.value = Math.floor(Math.random() * 10) + 1;
  this.image = imgSet[this.value];
}

// Allows this script to run in local node instances
if (typeof on !== 'undefined') {
  on("chat:message", roll20ApiHandler);
} else {
  module.exports = {
    vtmCONSTANTS,
    vtmGlobal,
    rolls: {
      handleSkillRoll,
      handleWillpowerRoll,
      handleRouseRoll,
      handleFrenzyRoll,
      handleSimpleRoll,
      handleRemorseRoll,
      handleHumanityRoll,
    },
    formatCommandLineArguments,
    processDebugScript,
    processVampireDiceScript,
    parseCommandLineVariables,
    calculateRunScript,
    vtmRollDiceSuperFunc,
    rollVTMDice,
    getDiceImage,
    addRollDeclarations,
  };
}
