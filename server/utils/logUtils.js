async function addGameLog(game, action, player, details) {
  game.logs.push({ action, player, details });
  await game.save();
}

module.exports = { addGameLog };