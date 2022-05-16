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
  diceTestEnabled: false,
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
  let dicePool = calculateRunScript(input)(input);
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
    skill:    handleSkillRoll,
    will:     handleWillpowerRoll,
    rouse:    handleRouseRoll,
    frenzy:   handleFrenzyRoll,
    humanity: handleHumanityRoll,
    simple:   handleSimpleRoll,
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

  if (vtmGlobal.diceTestEnabled === true) {
    sendChat("", "/desc " + user + ": v1 h1");
  }

  let endTemplateSection = "}} ";
  let outputMessage = "&{template:wod} {{name=" + user + endTemplateSection;

  if (dicePool.rollname) {
    outputMessage += "{{Rollname=" + dicePool.rollname + endTemplateSection;
  }

  if (vtmGlobal.diceLogChat === true) {
    if (vtmGlobal.diceLogRolledOnOneLine === true) {
      diceGraphicsRolled = diceTotals.diceGraphicsLog;
      diceTextRolled = diceTotals.diceTextLog;
      if (vtmGlobal.diceGraphicsChat === true) {
        outputMessage += "{{Roll=" + diceGraphicsRolled + endTemplateSection;
      } else {
        outputMessage += "{{Roll=" + diceTextRolled + endTemplateSection;
      }
    } else if (vtmGlobal.diceGraphicsChat === true) {
      outputMessage += "{{Normal=" + attackDiceResults.diceGraphicsLog + endTemplateSection;
      outputMessage += "{{Hunger=" + defendDiceResults.diceGraphicsLog + endTemplateSection;
    } else {
      outputMessage += "{{Normal=" + attackDiceResults.diceTextLog + endTemplateSection;
      outputMessage += "{{Hunger=" + defendDiceResults.diceTextLog + endTemplateSection;
    }
  }

  let thebeast = '<img src="https://i.imgur.com/6N0Ld40.png" title="The Beast" height="20" width="228"/>';

  if (dicePool.rouseStatRoll) {
    let critBonus = Math.floor((diceTotals.critScore + diceTotals.muddyCritScore) / 2.0) * 2.0;
    outputMessage += "{{Successes=" + (diceTotals.successScore + critBonus) + endTemplateSection;
    if (diceTotals.successScore > 0) {
      outputMessage += "{{Beast=" + '<img src="https://i.imgur.com/UV57YLP.png" title="Hunger Gain" height="20" width="228"/>' + endTemplateSection;
    } else {
      outputMessage += "{{Beast=" + '<img src="https://i.imgur.com/b3NHCNk.png" title="Rousing Success" height="20" width="228"/>' + endTemplateSection;

    }
  } else if (dicePool.frenzyRoll) {
    outputMessage += "{{Successes=" + diceTotals.successScore + endTemplateSection;
    if (diceTotals.successScore >= dicePool.difficulty) {
      outputMessage += "{{Beast=" + '<img src="https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/vampire-v5/Banners/FrenzyRestrained.png" title="Frenzy Restrained" height="20" width="228"/>' + endTemplateSection;
    } else {
      outputMessage += "{{Beast=" + '<img src="https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/vampire-v5/Banners/Frenzy.png" title="Frenzy" height="20" width="228"/>' + endTemplateSection;
    }
  } else if (dicePool.remorseRoll) {
    outputMessage += "{{Successes=" + diceTotals.successScore + endTemplateSection;
    if (diceTotals.successScore > 0) {
      outputMessage += "{{Beast=" + '<img src="https://i.imgur.com/zubTvLd.png" title="Guilty" height="20" width="228"/>' + endTemplateSection;
    } else {
      outputMessage += "{{Beast=" + '<img src="https://i.imgur.com/21qrGX5.png" title="Innocent" height="20" width="228"/>' + endTemplateSection;

    }

    if (vtmGlobal.luckydice) {
      let lastResort = '<img src="https://i.imgur.com/4XbkQua.png" title="Miss" height="20" width="228"/>';
      outputMessage += "{{Fate=" + lastResort + endTemplateSection;
    }
  } else {
    outputMessage = addRollDeclarations(diceTotals, outputMessage, endTemplateSection, thebeast);
  }

  vtmGlobal.luckydice = false;
  outputMessage += "{{Reroll=[Reroll](" + vtmGlobal.reroll + ")" + endTemplateSection;

  log("Output");
  log(outputMessage);
  if (!vtmGlobal.diceTestEnabled) {
    sendChat(user, outputMessage);
  }
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
    return `<img src="${image}" title="${roll}" height="${vtmGlobal.diceGraphicsChatSize}" width="${vtmGlobal.diceGraphicsChatSize}" />`;
  }

  if (vtmGlobal.diceTestEnabled === true) {
    diceQty = 10;
  }

  for (let i = 1; i <= diceQty; i++) {
    let  roll = Math.floor(Math.random() * 10) + 1;

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

function addRollDeclarations(diceTotals, outputMessage, endTemplateSection, thebeast) {
  // Crit bonus is + 2 successes for each PAIR of crits. Thus 2 crits is + 2 successs, 3 crits is + 2 successes.
  let critBonus = Math.floor((diceTotals.critScore + diceTotals.muddyCritScore) / 2.0) * 2.0;
  outputMessage += "{{Successes=" + (diceTotals.successScore + critBonus) + endTemplateSection;


  if (diceTotals.successScore === 0 && vtmGlobal.luckydice) {
    let lastResort = '<img src="https://i.imgur.com/4XbkQua.png" title="Miss" height="20" width="228"/>';
    outputMessage += "{{Fate=" + lastResort + endTemplateSection;
    let miss = '<img src="https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/vampire-v5/Banners/MissFail.png" title="Miss" height="20" width="228"/>';
    outputMessage += "{{Miss=" + miss + endTemplateSection;
  } else if (diceTotals.successScore === 0) {
    //outputMessage += "{{Fate=" + "Total failure" + endTemplateSection;
    let miss = '<img src="https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/vampire-v5/Banners/MissFail.png" title="Miss" height="20" width="228"/>';
    outputMessage += "{{Miss=" + miss + endTemplateSection;
  } else if (vtmGlobal.luckydice) {
    let lastResort = '<img src="https://i.imgur.com/4XbkQua.png" title="Miss" height="20" width="228"/>';
    outputMessage += "{{Fate=" + lastResort + endTemplateSection;
  }

  if ((diceTotals.muddyCritScore >= 2) || (diceTotals.muddyCritScore === 1 && (diceTotals.critScore >= 1))) {
    let messy = '<img src="https://i.imgur.com/KZTTwlE.png" title="Messy" height="20" width="228"/>';
    outputMessage += "{{Messy=" + messy + endTemplateSection;
  } else if (diceTotals.critScore >= 2) {
    let crit = '<img src="https://i.imgur.com/XNA64u9.png" title="Crit" height="20" width="228"/>';
    outputMessage += "{{Crit=" + crit + endTemplateSection;
  }

  if (diceTotals.failScore >= 5) {
    outputMessage += "{{Beast=" + thebeast + endTemplateSection;
    //  outputMessage += "{{BeastTaunt=" + "I do say dear boy, I may be a mite bit peckish." + endTemplateSection;
  } else if (diceTotals.failScore >= 3) {
    outputMessage += "{{Beast=" + thebeast + endTemplateSection;
    //  outputMessage += "{{BeastTaunt=" + "BLOOD BLOOD GIVE ME BLOOD!! I MUST FEED!" + endTemplateSection;
  } else if (diceTotals.failScore >= 2) {
    outputMessage += "{{Beast=" + thebeast + endTemplateSection;
    //  outputMessage += "{{BeastTaunt=" + "Let the vitae flow!" + endTemplateSection;
  } else if (diceTotals.failScore >= 1) {
    outputMessage += "{{Beast=" + thebeast + endTemplateSection;
    //  outputMessage += "{{BeastTaunt=" + "Feed Me! (Hunger causes you to be distracted)" + endTemplateSection;
  }

  return outputMessage;
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
