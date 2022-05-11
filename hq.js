
var vtmCONSTANTS = {
  VTMCOMMAND: "!vtm",
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
  }
};

var vtmGlobal = {
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

function rollVTMDice(diceQty, type, dc) {
  var roll = 0;
  var diceResult = {
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
    return `<img src="${image}" title="${roll}" height="${vtmGlobal.diceGraphicsChatSize}" width="${vtmGlobal.diceGraphicsChatSize}" />`
  }

  if (vtmGlobal.diceTestEnabled === true) {
    diceQty = 10;
  }

  for (var i = 1; i <= diceQty; i++) {

    if (vtmGlobal.diceTestEnabled === true) {
      roll = roll + 1;
    } else {
      roll = randomInteger(10);
    }

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
  if (roll < 1 || roll > 10) { return null; }

  imgPool = vtmCONSTANTS.IMG.DICE[(type === 'v') ? 'NORMAL' : 'MESSY']
  switch(roll) {
    case 1:
      return imgPool.BOTCH;
    case 2:
    case 3:
    case 4:
    case 5:
      return imgPool.MISS;
    case 6:
    case 7:
    case 8:
    case 9:
      return imgPool.PASS;
    case 10:
      return imgPool.BOTCH;
  }
}

function processVampireDiceScript(run, dc) {
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
  log(run);
  let user = run.user;

  attackDiceResults = rollVTMDice(run.blackDice, "v", dc);
  defendDiceResults = rollVTMDice(run.redDice, "h", dc);

  log(attackDiceResults);
  log(defendDiceResults);

  var diceTotals = {
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

  if (run.rollname) {
    outputMessage += "{{Rollname=" + run.rollname + endTemplateSection;
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
    } else {
      if (vtmGlobal.diceGraphicsChat === true) {
        outputMessage += "{{Normal=" + attackDiceResults.diceGraphicsLog + endTemplateSection;
        outputMessage += "{{Hunger=" + defendDiceResults.diceGraphicsLog + endTemplateSection;
      } else {
        outputMessage += "{{Normal=" + attackDiceResults.diceTextLog + endTemplateSection;
        outputMessage += "{{Hunger=" + defendDiceResults.diceTextLog + endTemplateSection;
      }
    }
  }

  let thebeast = '<img src="https://i.imgur.com/6N0Ld40.png" title="The Beast" height="20" width="228"/>';

  if (run.rouseStatRoll) {
      let critBonus = Math.floor((diceTotals.critScore + diceTotals.muddyCritScore) / 2.0) * 2.0;
      outputMessage += "{{Successes=" + (diceTotals.successScore + critBonus) + endTemplateSection;
    if (diceTotals.successScore > 0) {
      outputMessage += "{{Beast=" + '<img src="https://i.imgur.com/UV57YLP.png" title="Hunger Gain" height="20" width="228"/>' + endTemplateSection;
    } else {
      outputMessage += "{{Beast=" + '<img src="https://i.imgur.com/b3NHCNk.png" title="Rousing Success" height="20" width="228"/>' + endTemplateSection;

    }
  } else if (run.frenzyRoll) {
    outputMessage += "{{Successes=" + diceTotals.successScore + endTemplateSection;
    if (diceTotals.successScore >= run.difficulty) {
      outputMessage += "{{Beast=" + '<img src="https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/vampire-v5/Banners/FrenzyRestrained.png" title="Frenzy Restrained" height="20" width="228"/>' + endTemplateSection;
    } else {
      outputMessage += "{{Beast=" + '<img src="https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/vampire-v5/Banners/Frenzy.png" title="Frenzy" height="20" width="228"/>' + endTemplateSection;
    }
  } else if (run.remorseRoll) {
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
  if (vtmGlobal.diceTestEnabled != true) {
    sendChat(user, outputMessage);
  }
}

function addRollDeclarations(diceTotals, outputMessage, endTemplateSection, thebeast) {
  // Crit bonus is + 2 successes for each PAIR of crits. Thus 2 crits is + 2 successs, 3 crits is + 2 successes.
  let critBonus = Math.floor((diceTotals.critScore + diceTotals.muddyCritScore) / 2.0) * 2.0;
  outputMessage += "{{Successes=" + (diceTotals.successScore + critBonus) + endTemplateSection;


  if (diceTotals.successScore == 0 && vtmGlobal.luckydice) {
    let lastResort = '<img src="https://i.imgur.com/4XbkQua.png" title="Miss" height="20" width="228"/>';
    outputMessage += "{{Fate=" + lastResort + endTemplateSection;
    let miss = '<img src="https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/vampire-v5/Banners/MissFail.png" title="Miss" height="20" width="228"/>';
    outputMessage += "{{Miss=" + miss + endTemplateSection;
  } else if (diceTotals.successScore == 0) {
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

var processScriptTabs = function (argv, who, dc) {
  // this will run the various other scripts depending upon the chat
  // window command.  Just add another Case statement to add a new command.
  var tmpLogChat = false;
  var tmpGraphicsChat = false;
  var script = argv.shift();
  switch (script) {
    case vtmCONSTANTS.VTMCOMMAND:
      switch (argv[0]) {
        case "log":
          switch (argv[1]) {
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
          break;
        case "graphics":
          switch (argv[1]) {
            case "on":
              vtmGlobal.diceGraphicsChat = true;
              break;
            case "off":
              vtmGlobal.diceGraphicsChat = false;
              break;
            case "s":
              vtmGlobal.diceGraphicsChatSize = vtmCONSTANTS.GRAPHICSIZE.SMALL;
              break;
            case "m":
              vtmGlobal.diceGraphicsChatSize = vtmCONSTANTS.GRAPHICSIZE.MEDIUM;
              break;
            case "l":
              vtmGlobal.diceGraphicsChatSize = vtmCONSTANTS.GRAPHICSIZE.LARGE;
              break;
            case "x":
              vtmGlobal.diceGraphicsChatSize = vtmCONSTANTS.GRAPHICSIZE.XLARGE;
              break;
            case "xx":
              vtmGlobal.diceGraphicsChatSize = vtmCONSTANTS.GRAPHICSIZE.XXLARGE;
              break;
          }
          break;
        case "test":
          vtmGlobal.diceTestEnabled = true;
          tmpLogChat = vtmGlobal.diceLogChat;
          tmpGraphicsChat = vtmGlobal.diceGraphicsChat;
          vtmGlobal.diceLogChat = true;
          vtmGlobal.diceGraphicsChat = true;
          var run = {
            blackDice: 1,
            redDice: 1,
            user: who,
            roll: null
          };
          processVampireDiceScript(run, dc);
          vtmGlobal.diceTestEnabled = false;
          vtmGlobal.diceLogChat = tmpLogChat;
          vtmGlobal.diceGraphicsChat = tmpGraphicsChat;
          break;
        default:
          processVampireDiceScript(argv[0], dc);
      }
      break;
  }
};

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
};

function handleSkillRoll(input) {
  log("Atr/Skill Roll");
  log(input);
  let hunger = input.hunger;
  let dicepool = input.attribute + input.modifier;
  if (input.type === "skill") {
    dicepool += input.skill;
  }

  var run = {
    blackDice: 0,
    redDice: 0,
    user: input.user,
    rollname: input.rollname
  };

  if (dicepool <= 0) {
    vtmGlobal.luckydice = true;
    if (hunger > 0) {
      run.redDice = 1;
      return ["!vtm", run];
    } else {
      run.blackDice = 1;
      return ["!vtm", run];
    }
  }

  run.blackDice = dicepool - hunger;
  run.redDice = ((dicepool + hunger) - Math.abs(dicepool - hunger)) / 2;

  return ["!vtm", run];
}

function handleWillpowerRoll(input) {
  let dicepool = input.willpower + input.attribute + input.modifier;

  var run = {
    blackDice: 0,
    redDice: 0,
    user: input.user,
    rollname: input.rollname
  };

  if (dicepool <= 0) {
    vtmGlobal.luckydice = true;
    dicepool = 1;
  }

  run.blackDice = dicepool;

  return ["!vtm", run];
}

function handleRouseRoll(input) {
  var run = {
    blackDice: 0,
    redDice: input.modifier,
    user: input.user,
    rollname: input.rollname,
    rouseStatRoll: true
  };

  return ["!vtm", run];
}

function handleFrenzyRoll(input) {
  let dicepool = input.willpower + input.modifier + Math.floor(input.skill / 3.0);

  var run = {
    blackDice: 0,
    redDice: 0,
    user: input.user,
    rollname: input.rollname,
    frenzyRoll: true,
    difficulty: input.difficulty
  };

  if (dicepool <= 0) {
    vtmGlobal.luckydice = true;
    run.redDice = 1;
    return ["!vtm", run];
  }

  run.blackDice = 0;
  run.redDice = dicepool;

  return ["!vtm", run];
}

function handleSimpleRoll(input) {
  log("Simple Roll");
  log(input);
  var run = {
    blackDice: input.willpower,
    redDice: input.hunger,
    user: input.user,
    rollname: input.rollname
  };

  return ["!vtm", run];
}

function handleRemorseRoll(input) {
  log("Remorse Roll");
  log(input);
  let dice = input.willpower + input.modifier;
  if (dice <= 0) {
    vtmGlobal.luckydice = true;
    dice = 1;
  }

  var run = {
    blackDice: dice,
    redDice: 0,
    user: input.user,
    rollname: input.rollname,
    remorseRoll: true
  };

  return ["!vtm", run];
}

function handleHumanityRoll(input) {
  log("Humanity Roll")
  log(run);
  let dice = input.skill + input.modifier;
  if (dice <= 0) {
    vtmGlobal.luckydice = true;
    dice = 1;
  }

  var run = {
    blackDice: dice,
    redDice: 0,
    user: input.user,
    rollname: input.rollname
  };

  return ["!vtm", run];
}

function calculateVariables(argv, who) {
  let input = {
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

  for (i = 2; i < argv.length; i++) {
    let entry = argv[i];

    // TODO: refactor this?
    if (input.type === 'remorse') {
      log("remorse variable")
      // Used for remorse rolls
      let totalValue = parseInt(entry.substring(1), 10);
      let totalRemorse = updateMultiboxValue(totalValue);
      let missingRemorse = totalValue - totalRemorse;
      missingRemorse = updateMultiboxValue1(missingRemorse);
      input.willpower = missingRemorse / 16.0;
      continue
    }
    let identifier = entry.substring(0, 1);

    if (identifier === 'c' || identifier === 't') {
      let value = argv[i];
    } else {
      let value = parseInt(entry.substring(1), 10);
    }

    switch (identifier) {
      case 'a' : // Assign an int directly to an attribute
        input.attribute = value;
        break;
      case 's' : // Assign an int directly to a skill
        input.skill = value;
        break;
      case 'o' : // Used to assign a trait much like "p", this is used in Willpower rolls to assign humanity
        input.skill = updateMultiboxValue(value);
        break;
      case 'r' : // Red die. Used for assigning a value directly to hunger die.
        input.hunger = value;
        break;
      case 'm' : // Adds a modifier value straight
        input.modifier += value;
        break;
      case 'b' : // Adds half of value to modifier. Example Discipline
        input.modifier += Math.floor(value / 2.0);
        break;
      case 'w' : // Used for willpower if you want to give it a value directly
        input.willpower = value;
        break;
      case 'p' : // Used for traits which have 4 states such willpower and health
        input.willpower = updateMultiboxValue(value);
        break;
      case 'd' : // Used for varying a difficulty
        input.successDc = min(10, max(1, value));
        break;
      case 'c' : // Used for assigning a character name
        i++;
        if (value != undefined && value.trim().length != 0) {
          input.user = value.trim();
        }
        break;
      case 't' : // Used for assigning a rollname
        i++;
        if (value != undefined && value.trim().length != 0) {
          input.rollname = value.trim();
        }
        break;
      case 'q' : // The number of successes required (used for only certain rolls)
        input.difficulty = value;
        break;
      }
  }

  return input;
}

// Used for multistate checkboxes
function updateMultiboxValue(totalValue) {
  let value = totalValue;
  value = scaleMultiboxValue(value, 3616);
  value = scaleMultiboxValue(value, 241);
  value = scaleMultiboxValue(value, 16);
  return value;
}

// Used for multistate checkboxes
function updateMultiboxValue1(totalValue) {
  let value = totalValue;
  value = scaleMultiboxValue(value, 3616);
  value = scaleMultiboxValue(value, 241);
  return value;
}

function scaleMultiboxValue(value, scaleNumber) {
  while (value > 0) {
    value -= scaleNumber;
  }

  if (value < 0) {
    value += scaleNumber
  }

  return value;
}

// Decides how to distribute dice based on the type of roll
function calculateRunScript(input) {
  if (input.type === "atr" || input.type === "skill") {
    return handleSkillRoll(input);
  } else if (input.type === "will") {
    return handleWillpowerRoll(input);
  } else if (input.type === "rouse") {
    return handleRouseRoll(input);
  } else if (input.type === "frenzy") {
    return handleFrenzyRoll(input);
  } else if (input.type === "remorse") {
    return handleRemorseRoll(input);
  } else if (input.type === "humanity") {
    return handleHumanityRoll(input);
  } else {
    return handleSimpleRoll(input);
  }
}

// Get the standard DC
function baseDc() {
  var dc = {
    // These DCs are set to be equal to or greater than their listed value
    critFail: 1,
    nil: 2,
    success: 6,
    critSuccess: 10
  }
  return dc;
}

// Calculates DC
function calculateDc(run) {
  let dc;
  if (run[1].rouseStatRoll === true) {
    dc = {
      // These DCs are set to be equal to or greater than their listed value
      critFail: 1,
      nil: 2,
      success: 6,
      // All DCs must be set, setting to a number >10 will mean it is effectively ignored
      critSuccess: 10
    }
  } else {
    dc = baseDc();
  }
  return dc;
}

// roll20 api handler
function roll20ApiHandler(msg) {
  // returns the chat window command entered, all in lowercase.
  if (msg.type != 'api') {
    return;
  }

  log("New roll");
  log(msg);

  if (_.has(msg, 'inlinerolls')) {
    msg = performInlineRolls(msg);
  }

  log(msg);

  var chatCommand = msg.content;
  vtmGlobal.reroll = chatCommand.replace(/\"/g, '&quot;').replace(/\~/g, '&#126;');

  var argv = [].concat.apply([], chatCommand.split('~').map(function (v, i) {
    return i % 2 ? v : v.split(' ')
  })).filter(Boolean);
  log("Post Splitting");
  log(argv);

  try {
    if (argv[1] === "skill" || argv[1] === "atr" || argv[1] === "will" || argv[1] === "roll" || argv[1] === "rouse" || argv[1] === "frenzy" || argv[1] === "reroll" || argv[1] === "remorse" || argv[1] === "humanity") {
      let input = calculateVariables(argv, msg.who);
      let run = calculateRunScript(input);
      let dc = calculateDc(run);
      return processScriptTabs(run, msg.who, dc);
    } else if (argv[1] === "log" || argv[1] === "graphics" || argv[1] === "test" || argv[1] === "hero" || argv[1] === "lupine") {
      return processScriptTabs(argv, msg.who, baseDc());
    }
  } catch (err) {
    sendChat("Error", "Invalid input" + err);
    return;
  }
}

// Allows this script to run in local node instances
if (typeof(on) !== 'undefined') {
  on("chat:message", roll20ApiHandler);
} else {
  console.log('execution successful');
}
