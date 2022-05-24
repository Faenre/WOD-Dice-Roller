const wod = require('./wod.js');

const args = {
  attribute: 1,
  skill: 1,
  modifier: 1,
  willpower: 1,
  hunger: 1,
};

test('calculateRunScript returns a WodRoll', () => {
  const keys = ['atr', 'frenzy', 'humanity', 'remorse', 'rouse', 'simple', 'skill', 'will'];
  let input = {modifier: 1};
  for (key of keys) {
    input.type = key;
    expect(wod.calculateRunScript(input).__proto__).toBe(wod.WodRoll.prototype);
  }
});

test('handleSkillRoll handles base case', () => {
  let pool = wod.rolls.handleSkillRoll(args);
  expect(pool.blackDice).toBe(3);
  expect(pool.redDice).toBe(1);
});

test('handleWillpowerRoll handles base case', () => {
  let pool = wod.rolls.handleWillpowerRoll(args);
  expect(pool.blackDice).toBe(3);
  expect(pool.redDice).toBe(1);
});

test('handleRouseRoll handles base case', () => {
  let pool = wod.rolls.handleRouseRoll({});

  expect(pool.blackDice).toBe(0);
  expect(pool.redDice).toBe(1);
  expect(pool.flags.rouse).toBe(true);
});
test('handleRouseRoll accepts modifier argument', () => {
  let args2 = Object.create(args);
  args2.modifier = 10;
  let pool = wod.rolls.handleRouseRoll(args2);

  expect(pool.blackDice).toBe(0);
  expect(pool.redDice).toBe(10);
  expect(pool.flags.rouse).toBe(true);
});

test('handleSimpleRoll doesnt subtract hunger from total', () => {
  let pool = wod.rolls.handleSimpleRoll(args);
  expect(pool.blackDice).toBe(4);
  expect(pool.redDice).toBe(1);
});

test('handleFrenzyRoll handles base case', () => {
  let pool = wod.rolls.handleFrenzyRoll(args);
  expect(pool.blackDice).toBe(3);
  expect(pool.redDice).toBe(1);
  expect(pool.flags.frenzy).toBe(true);
});

test('handleRemorseRoll handles base case', () => {
  let pool = wod.rolls.handleRemorseRoll(args);
  expect(pool.blackDice).toBe(3);
  expect(pool.redDice).toBe(1);
  expect(pool.flags.remorse).toBe(true);
});

test('handleHumanityRoll handles base case', () => {
  let pool = wod.rolls.handleHumanityRoll(args);
  expect(pool.blackDice).toBe(3);
  expect(pool.redDice).toBe(1);
});

test('createMessageBuilder generates valid template outputs', () => {
  let builder = wod.createMessageBuilder();
  function matchingBrackets(msg) {
    let counter = 0;
    for (let i=0; i < msg.length; i++) {
      if (msg[i] === '{') counter++;
      if (msg[i] === '}') counter--;
    }
    return counter === 0;
  }

  expect(builder.getMessage().startsWith('&{template:wod} ')).toBe(true);

  builder.addSection('Normal', "<img src=''>");
  builder.addSection('Hunger', "<img src=''>");
  builder.addBanner('MISS_FAIL');
  expect(builder.getMessage().endsWith(' ')).toBe(true);
  expect(matchingBrackets(builder.getMessage())).toBe(true);
});

test('setGraphics correctly toggles graphics', () => {
  const globals = wod.vtmGlobal;

  wod.setGraphics('on');
  expect(globals.diceGraphicsChat).toBe(true);
  wod.setGraphics('off');
  expect(globals.diceGraphicsChat).toBe(false);
});

test('setGraphics correctly sets graphic sizes', () => {
  const globals = wod.vtmGlobal;
  const constants = wod.vtmCONSTANTS;

  wod.setGraphics('s');
  expect(globals.diceGraphicsChatSize).toBe(constants.GRAPHICSIZE.SMALL);
  wod.setGraphics('x');
  expect(globals.diceGraphicsChatSize).toBe(constants.GRAPHICSIZE.XLARGE);
});

test('setLogging correctly toggles globals', () => {
  const globals = wod.vtmGlobal;

  wod.setLogging('on');
  expect(globals.diceLogChat).toBe(true);
  wod.setLogging('off');
  expect(globals.diceLogChat).toBe(false);

  wod.setLogging('single');
  expect(globals.diceLogRolledOnOneLine).toBe(true);
  wod.setLogging('multi');
  expect(globals.diceLogRolledOnOneLine).toBe(false);
});
