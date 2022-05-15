const wod = require('./wod.js');

const args = {
  attribute: 1,
  skill: 1,
  modifier: 1,
  willpower: 1,
  hunger: 1,
};

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
  expect(pool.rouseStatRoll).toBe(true);
});
test('handleRouseRoll accepts modifier argument', () => {
  let args2 = Object.create(args);
  args2.modifier = 10;
  let pool = wod.rolls.handleRouseRoll(args2);

  expect(pool.blackDice).toBe(0);
  expect(pool.redDice).toBe(10);
  expect(pool.rouseStatRoll).toBe(true);
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
  expect(pool.frenzyRoll).toBe(true);
});

test('handleRemorseRoll handles base case', () => {
  let pool = wod.rolls.handleRemorseRoll(args);
  expect(pool.blackDice).toBe(3);
  expect(pool.redDice).toBe(1);
  expect(pool.remorseRoll).toBe(true);
});

test('handleHumanityRoll handles base case', () => {
  let pool = wod.rolls.handleHumanityRoll(args);
  expect(pool.blackDice).toBe(3);
  expect(pool.redDice).toBe(1);
});
