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
        BOTCH: "https://i.imgur.com/BhwBgoy.png",
        MISS: "https://i.imgur.com/jz6fhT2.png",
        PASS: "https://i.imgur.com/zjhWSpA.png",
        CRIT: "https://i.imgur.com/JuE1DTR.png"
      },
      MESSY: {
        BOTCH: "https://i.imgur.com/41ZXRdA.png",
        MISS: "https://i.imgur.com/ipwOggU.png",
        PASS: "https://i.imgur.com/9FzRKxA.png",
        CRIT: "https://i.imgur.com/xUhtSHU.png"
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
    .reduce(function (m, v, k) {
      m['$[[' + k + ']]'] = v.results.total || 0;
      return m;
    }, {})
    .reduce(function (m, v, k) {
      return m.replace(k, v);
    }, msg.content)
    .value();

  return msg;
}

function formatCommandLineArguments(chatCommand) {
  vtmGlobal.reroll = chatCommand.replace(/"/g, '&quot;').replace(/~/g, '&#126;');

  let argv = [].concat.apply([], chatCommand.split('~').map(function (v, i) {
    return i % 2 ? v : v.split(' ');
  })).filter(Boolean);

  return argv;
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
  switch (input.type) {
    case 'atr':
    case 'skill':     return handleSkillRoll(input);
    case 'will':      return handleWillpowerRoll(input);
    case 'rouse':     return handleRouseRoll(input);
    case 'frenzy':    return handleFrenzyRoll(input);
    case 'remorse':   return handleRemorseRoll(input);
    case 'humanity':  return handleHumanityRoll(input);
    default:          return handleSimpleRoll(input);
  }
}

function processDebugScript(argv) {
  // this will run the various other scripts depending upon the chat
  // window command.  Just add another Case statement to add a new command.
  switch (argv[1]) {
    case "log":
      setLogging(argv[1]);
      break;
    case "graphics":
      setGraphics(argv[1]);
      break;
    case "test":
      runTestSuite();
      break;
  }
}

function processVampireDiceScript(argv, who) {
  let input = parseCommandLineVariables(argv, who);
  let dicePool = calculateRunScript(input);

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
  switch (roll) {
    case 1:   return imgPool.BOTCH;
    case 2:
    case 3:
    case 4:
    case 5:   return imgPool.MISS;
    case 6:
    case 7:
    case 8:
    case 9:   return imgPool.PASS;
    case 10:  return imgPool.CRIT;
    default:  return null;
  }
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
  log("Atr/Skill Roll");
  log(input);
  let hunger = input.hunger;
  let dice = input.attribute + input.modifier;
  if (input.type === "skill") dice += input.skill;

  let dicePool = new DicePool(0, 0, input.user, input.rollname);

  if (dice <= 0) {
    vtmGlobal.luckydice = true;
    if (hunger > 0) {
      dicePool.redDice = 1;
    } else {
      dicePool.blackDice = 1;
    }
    return dicePool;
  }

  dicePool.blackDice = dice - hunger;
  dicePool.redDice = ((dice + hunger) - Math.abs(dice - hunger)) / 2;

  return dicePool;
}

function handleWillpowerRoll(input) {
  let dice = input.willpower + input.attribute + input.modifier;

  if (dice <= 0) {
    vtmGlobal.luckydice = true;
    dice = 1;
  }

  let dicePool = new DicePool(dice, 0, input.user, input.rollname);

  return dicePool;
}

function handleRouseRoll(input) {
  log("Rouse Roll");
  log(input);

  let dicePool = new DicePool(0, input.modifier, input.user, input.rollname);
  dicePool.rouseStatRoll = true;

  return dicePool;
}

function handleFrenzyRoll(input) {
  log("Frenzy Roll");
  log(input);
  let dice = input.willpower + input.modifier + Math.floor(input.skill / 3.0);

  let dicePool = new DicePool(dice, 0, input.user, input.rollname);
  dicePool.frenzyRoll = true;
  dicePool.difficulty = input.difficulty;

  if (dice <= 0) {
    vtmGlobal.luckydice = true;
    dicePool.redDice = 1;
    return dicePool;
  }

  dicePool.blackDice = 0;
  dicePool.redDice = dice;

  return dicePool;
}

function handleSimpleRoll(input) {
  log("Simple Roll");
  log(input);

  let dicePool = new DicePool(input.willpower, input.hunger,
    input.user, input.rollname);

  return dicePool;
}

function handleRemorseRoll(input) {
  log("Remorse Roll");
  log(input);
  let dice = input.willpower + input.modifier;
  if (dice <= 0) {
    vtmGlobal.luckydice = true;
    dice = 1;
  }

  let dicePool = new DicePool(dice, 0, input.user, input.rollname);
  dicePool.remorseRoll = true;

  return dicePool;
}

function handleHumanityRoll(input) {
  log("Humanity Roll");
  log(input);
  let dice = input.skill + input.modifier;
  if (dice <= 0) {
    vtmGlobal.luckydice = true;
    dice = 1;
  }

  let dicePool = new DicePool(dice, 0, input.user, input.rollname);

  return dicePool;
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

// Sets the logging status
function setLogging(value) {
  switch (value) {
    case "on":
      vtmGlobal.diceLogChat = true;
      break;
    case "off":
      vtmGlobal.diceLogChat = false;
      break;
    case "multi":
      vtmGlobal.diceLogRolledOnOneLine = false;
      break;
    case "single":
      vtmGlobal.diceLogRolledOnOneLine = true;
      break;
  }
}

// Configures the graphics options (text vs image, and image sizes)
function setGraphics(value) {
  if (value === 'on') {
    vtmGlobal.diceGraphicsChat = true;
  } else if (value === 'off') {
    vtmGlobal.diceGraphicsChat = false;
  } else {
    vtmGlobal.diceGraphicsChatSize = vtmCONSTANTS.GRAPHICSIZE[{
      s:  'SMALL',
      m:  'MEDIUM',
      l:  'LARGE',
      x:  'XLARGE',
      xx: 'XXLARGE'
    }[value]];
  }
}

// Performs basic happy-path testing.
// Test cases are non-exhaustive as of current.
function runTestSuite() {
  log('Running tests...');
  const prepVars = (msg) => {
    return parseCommandLineVariables(msg.split(' '), 'Sample User');
  };
  const compare = (given, expected) => {
    for (const [key, expectation] of Object.entries(expected)) {
      if (given[key] !== expectation) return false;
    }
    return true;
  };

  const testResults = {};

  let simpleVars = prepVars('!vtm roll w2 r2');
  let simpleDicePool = handleSimpleRoll(simpleVars);
  let simpleExpected = { blackDice: 2, redDice: 2 };
  testResults['Simple'] = compare(simpleDicePool, simpleExpected);

  let atrVars = prepVars('!vtm atr a3 r2 m2');
  let atrDicePool = handleSkillRoll(atrVars);
  let atrExpected = { blackDice: 3, redDice: 2 };
  testResults['Attribute'] = compare(atrDicePool, atrExpected);

  let skillVars = prepVars('!vtm skill a3 r2 m2');
  let skillDicePool = handleSkillRoll(skillVars);
  let skillExpected = { blackDice: 3, redDice: 2 };
  testResults['Skill'] = compare(skillDicePool, skillExpected);

  let willpowerVars = prepVars('!vtm will w3 a2 m1');
  let willpowerDicePool = handleWillpowerRoll(willpowerVars);
  let willpowerExpected = { blackDice: 6, redDice: 0 };
  testResults['Willpower'] = compare(willpowerDicePool, willpowerExpected);

  let rouseVars = prepVars('!vtm rouse');
  let rouseDicePool = handleRouseRoll(rouseVars);
  let rouseExpected = { blackDice: 0, redDice: 0, rouseStatRoll: true };
  testResults['Rouse'] = compare(rouseDicePool, rouseExpected);

  let rerollVars = prepVars('!vtm reroll w3');
  let rerollDicePool = handleSimpleRoll(rerollVars);
  let rerollExpected = { blackDice: 3, redDice: 0 };
  testResults['Reroll'] = compare(rerollDicePool, rerollExpected);

  // TODO: either add tests for the following, or remove their implementation:
  // * willpower (2nd version)
  // * frenzy
  // * remorse
  // * humanity

  Object.entries(testResults).forEach(([test, result]) => {
    log(`${result ? 'Pass' : 'Fail'} for test '${test}'`);
  });
}

function DicePool (black, red, user, rollname) {
  this.blackDice = black;
  this.redDice = red;
  this.user = user;
  this.rollname = rollname;
}

// Allows this script to run in local node instances
if (typeof on !== 'undefined') {
  on("chat:message", roll20ApiHandler);
} else {
  runTestSuite();
}
