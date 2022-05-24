var log = log || ((...args) => console.log(...args));
var sendChat = sendChat || log;
var on = on || false;

const wodCONSTANTS = {
  VTMCOMMAND: "!vtm",
  ROLLS: new Set([
    'skill', 'atr', 'will', 'roll', 'rouse', 'reroll',
    'frenzy', 'remorse', 'humanity'
  ]),
  CONFIG: new Set(['log', 'graphics']),
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
        SECTION: 'Beast',
      },
      HUNGER_GAIN: {
        URL: 'https://i.imgur.com/UV57YLP.png',
        TITLE: 'Hunger Gain',
        SECTION: 'Beast',
      },
      HUNGER_NO_GAIN: {
        URL: 'https://i.imgur.com/b3NHCNk.png',
        TITLE: 'Rousing Success',
        SECTION: 'Beast',
      },
      FRENZY_RESIST: {
        URL: 'https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/vampire-v5/Banners/FrenzyRestrained.png',
        TITLE: 'Frenzy Restrained',
        SECTION: 'Beast',
      },
      FRENZY: {
        URL: 'https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/vampire-v5/Banners/Frenzy.png',
        TITLE: 'Frenzy',
        SECTION: 'Beast',
      },
      REMORSE_PASS: {
        URL: 'https://i.imgur.com/zubTvLd.png',
        TITLE: 'Guilty',
        SECTION: 'Beast',
      },
      REMORSE_FAIL: {
        URL: 'https://i.imgur.com/21qrGX5.png',
        TITLE: 'Innocent',
        SECTION: 'Beast',
      },
      LAST_RESORT: {
        URL: 'https://i.imgur.com/4XbkQua.png',
        TITLE: 'Last Resort',
        SECTION: 'Fate',
      },
      MISS_FAIL: {
        URL: 'https://raw.githubusercontent.com/Roll20/roll20-character-sheets/master/vampire-v5/Banners/MissFail.png',
        TITLE: 'Miss',
        SECTION: 'Fate',
      },
      MESSY: {
        URL: 'https://i.imgur.com/KZTTwlE.png',
        TITLE: 'Messy',
        SECTION: 'Messy',
      },
      CRIT: {
        URL: 'https://i.imgur.com/XNA64u9.png',
        TITLE: 'Crit',
        SECTION: 'Crit',
      }
    }
  },
};

const wodGlobal = {
  diceLogChat: true,
  diceGraphicsChat: true,
  diceGraphicsChatSize: wodCONSTANTS.GRAPHICSIZE.XLARGE,
  diceTextResult: "",
  diceTextResultLog: "",
  diceGraphicResult: "",
  diceGraphicResultLog: "",
  diceLogRolledOnOneLine: false,
  reroll: ""
};

const ROLLTYPES = {
  atr:      handleSkillRoll,
  frenzy:   handleFrenzyRoll,
  humanity: handleHumanityRoll,
  remorse:  handleRemorseRoll,
  rouse:    handleRouseRoll,
  simple:   handleSimpleRoll,
  skill:    handleSkillRoll,
  will:     handleWillpowerRoll,
  reroll:   handleWillpowerRoll,
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
    if (wodCONSTANTS.ROLLS.has(argv[1])) {
      processVampireDiceScript(argv, msg.who);
    } else if (wodCONSTANTS.CONFIG.has(argv[1])) {
      processConfigScript(argv);
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
  wodGlobal.reroll = chatCommand
    .replace(/"/g, '&quot;')
    .replace(/~/g, '&#126;');

  let argv = []
    .concat
    .apply([], chatCommand.split('~').map(function (value, index) {
      return index % 2 ? value : value.split(' ');
    })).filter(Boolean);

  return argv;
}

function processConfigScript(argv) {
  return {
    log: setLogging,
    graphics: setGraphics,
  }(argv[1]);
}

function processVampireDiceScript(argv, who) {
  let input = parseCommandLineVariables(argv, who);

  let wodRoll = calculateRunScript(input);
  wodRoll.user = input.user;
  wodRoll.rollname = input.rollname;
  log(wodRoll);

  let message = vtmRollDiceSuperFunc(wodRoll);
  sendChat(input.user, message);
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

/**
 * @TODO: Replace this with a simple lookup
 */
function calculateRunScript(input) {
  return ROLLTYPES[input.type](input);
}

function vtmRollDiceSuperFunc(wodRoll) {
  let messageBuilder = createMessageBuilder();
  messageBuilder.addSection(`name=${wodRoll.user}`);

  if (wodRoll.rollname) messageBuilder.addSection(`Rollname=${wodRoll.rollname}`);

  if (wodGlobal.diceLogChat === true) {
    if (wodGlobal.diceLogRolledOnOneLine === true) {
      if (wodGlobal.diceGraphicsChat === true) {
        messageBuilder.addSection(`Roll=${wodRoll.totals.graphics}`);
      } else {
        messageBuilder.addSection(`Roll=${wodRoll.totals.text}`);
      }
    } else if (wodGlobal.diceGraphicsChat === true) {
      messageBuilder.addSection(`Normal=${wodRoll.black.graphics}`);
      messageBuilder.addSection(`Hunger=${wodRoll.red.graphics}`);
    } else {
      messageBuilder.addSection(`Normal=${wodRoll.black.text}`);
      messageBuilder.addSection(`Hunger=${wodRoll.red.text}`);
    }
  }

  messageBuilder.addSection(`Successes=${wodRoll.score}`);

  if (wodRoll.flags.rouse) {
    if (wodRoll.score) {
      messageBuilder.addBanner('HUNGER_GAIN');
    } else {
      messageBuilder.addBanner('HUNGER_NO_GAIN');
    }
  } else if (wodRoll.flags.frenzy) {
    if (wodRoll.score > wodRoll.difficulty) {
      messageBuilder.addBanner('FRENZY_RESIST');
    } else {
      messageBuilder.addBanner('FRENZY');
    }
  } else if (wodRoll.flags.remorse) {
    if (wodRoll.score) {
      messageBuilder.addBanner('REMORSE_PASS');
    } else {
      messageBuilder.addBanner('REMORSE_FAIL');
    }
  }

  if (wodRoll.flags.lucky) {
    messageBuilder.addBanner('LAST_RESORT');
  }

  if (!wodRoll.totals.successes) {
    messageBuilder.addBanner('MISS_FAIL');
  }

  if (wodRoll.flags.messy) {
    messageBuilder.addBanner('MESSY');
  } else if (wodRoll.flags.crit) {
    messageBuilder.addBanner('CRIT');
  }

  if (wodRoll.red.botches) {
    messageBuilder.addBanner('BEAST');
  }

  log("Output");
  log(messageBuilder.getMessage());

  return messageBuilder.getMessage();
}
function createMessageBuilder() {
  let message = "&{template:wod} ";

  function addSection(content) {
    message += `{{${content}}} `;
  }
  function addBanner(key) {
    if (!key) return;

    let banner = wodCONSTANTS.IMG.BANNERS[key];
    let img = `<img height="20" width="228" \
    src="${banner.URL}" title="${banner.TITLE}" />`;

    addSection(`${banner.SECTION}=${img}`);
  }

  return {
    getMessage: () => message,
    addSection,
    addBanner,
  };
}


function handleSkillRoll(input) {
  return new WodRoll(input, true);
}
function handleWillpowerRoll(input) {
  return new WodRoll(input, true);
}
function handleRouseRoll(input) {
  let args = {hunger: Math.max(1, input.modifier || 0)};
  let pool = new WodRoll(args);
  pool.flags.rouse = true;

  return pool;
}
function handleFrenzyRoll(input) {
  let pool = new WodRoll(input, true);
  pool.flags.frenzy = true;
  pool.difficulty = input.difficulty || 2;

  return pool;
}
function handleSimpleRoll(input) {
  let args = Object.create(input);
  args.modifier = (args.modifier || 0) + (args.hunger || 0);

  return new WodRoll(args, false);
}
function handleRemorseRoll(input) {
  let pool = new WodRoll(input, true);
  pool.flags.remorse = true;

  return pool;
}
function handleHumanityRoll(input) {
  return new WodRoll(input, true);
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
  const setChatLogging = (key) => {
    wodGlobal.diceLogChat = {
      on: true,
      off: false
    }[key];
  };
  const setSingleLineRollLogging = (key) => {
    wodGlobal.diceLogRolledOnOneLine = {
      single: true,
      multi: false
    }[key];
  };

  return {
    on: setChatLogging,
    off: setChatLogging,
    single: setSingleLineRollLogging,
    multi: setSingleLineRollLogging,
  }[value](value);
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
    on:   setGraphicsEnabled,
    off:  setGraphicsEnabled,
    s:    setGraphicSize,
    m:    setGraphicSize,
    l:    setGraphicSize,
    x:    setGraphicSize,
    xx:   setGraphicSize,
  }[value](value);
}
function setGraphicsEnabled(key) {
  wodGlobal.diceGraphicsChat = (key === 'on');
}
function setGraphicSize(key) {
  wodGlobal.diceGraphicsChatSize = wodCONSTANTS.GRAPHICSIZE[{
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
 * @param {object} args An object that contains various numbers supplied
 * by the command call, e.g. attribute, skill etc.
 * These keys should all relate to integers.
 * @param {boolean} allowLucky A "last resort" flag to indicate whether
 * the roll should be given at least 1 die, no matter the modifiers.
 *
 * @returns {object} A collection of black and red dice values.
 */
function WodRoll (args, allowLucky = false) {
  this.flags = {};

  let total = sumTotal(this, args, allowLucky);

  let redCount = args.hunger || 0;

  this.black = new DicePool('NORMAL', Math.max(0, total - redCount));
  this.red = new DicePool('MESSY', redCount);

  let pools = [this.black, this.red];
  this.totals = summarizeDice(this, pools);

  this.score = this.totals.successes + Math.floor(this.totals.crits / 2) * 2;
  this.flags.crit = (this.totals.crits >= 2);
  this.flags.messy = this.flags.crit && (this.totals.crits > pools[0].crits);
}
function sumTotal(wr, args, allowLucky) {
  let total  = 0;

  for (let key of ['attribute', 'skill', 'modifier', 'willpower']) {
    total += args[key] || 0;
  }

  if (allowLucky && total <= 0) {
    wr.flags.lucky = true;
    total = 1;
  }

  return total;
}
function summarizeDice(wr, pools) {
  let diceTotals = {};

  for (let pool of pools) {
    for (let key of ['count', 'crits', 'successes', 'nils', 'botches']) {
      diceTotals[key] = (diceTotals[key] || 0) + pool[key];
    }
  }
  return diceTotals;
}

/**
 * Represents a single dice pool (black, red, purple, ...)
 *
 * @param {string} type The type, 'n' for normal, 'h' for hunger
 * @param {int} count The number of dice to roll
 */
function DicePool (type, count) {
  let dice = Array(count)
    .fill()
    .map(() => new Die(type));

  this.count = count;
  this.crits = dice.filter((die) => die.value === 10).length;
  this.successes = dice.filter((die) => die.value >= 6).length;
  this.nils = dice.filter((die) => die.value > 1 && die.value <= 5).length;
  this.botches = dice.filter((die) => die.value === 1).length;
  this.text = dice.map((die) => `(${die.value})`).join('');
  this.graphics = dice.map((die) => die.image).join('');
}

/**
 * Represents a single die roll.
 *
 * @param {string} type The type, 'NORMAL' or 'HUNGER'
 * @returns {object} with value and image attributes
 */
function Die (type) {
  function getImage(v) {
    return `<img \
    src="${wodCONSTANTS.IMG.DICE[type][value]}" \
    title="${value}" \
    height="${wodGlobal.diceGraphicsChatSize}" \
    width="${wodGlobal.diceGraphicsChatSize}" \
    />`;
  }

  let value = Math.floor(Math.random() * 10) + 1;
  this.value = value;
  this.image = getImage(value);
}

// Allows this script to run in local node instances
if (typeof on === 'function') {
  on("chat:message", roll20ApiHandler);
} else {
  module.exports = {
    wodCONSTANTS,
    wodGlobal,
    rolls: {
      handleSkillRoll,
      handleWillpowerRoll,
      handleRouseRoll,
      handleFrenzyRoll,
      handleSimpleRoll,
      handleRemorseRoll,
      handleHumanityRoll,
    },
    calculateRunScript,
    createMessageBuilder,
    setGraphics,
    setLogging,
    WodRoll,
    DicePool,
    Die,
  };
}
