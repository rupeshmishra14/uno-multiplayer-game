function isValidPlay(playedCard, topCard) {
  const [playedColor, playedValue] = playedCard.split('_');
  const [topColor, topValue] = topCard.split('_');

  return playedColor === topColor || playedValue === topValue || playedColor === 'wild';
}

function handleSpecialCard(game, card) {
  const [, value] = card.split('_');

  switch (value) {
    case 'reverse':
      game.direction *= -1;
      break;
    case 'skip':
      game.currentTurn = (game.currentTurn + game.direction + game.players.length) % game.players.length;
      break;
    case 'draw2':
      const nextPlayerIndex = (game.currentTurn + game.direction + game.players.length) % game.players.length;
      const nextPlayer = game.players[nextPlayerIndex];
      for (let i = 0; i < 2; i++) {
        if (game.deck.length === 0) {
          game.deck = game.discardPile.slice(0, -1).sort(() => Math.random() - 0.5);
          game.discardPile = [game.discardPile[game.discardPile.length - 1]];
        }
        nextPlayer.hand.push(game.deck.pop());
      }
      break;
    case 'wild_draw4':
      const wildDrawPlayerIndex = (game.currentTurn + game.direction + game.players.length) % game.players.length;
      const wildDrawPlayer = game.players[wildDrawPlayerIndex];
      for (let i = 0; i < 4; i++) {
        if (game.deck.length === 0) {
          game.deck = game.discardPile.slice(0, -1).sort(() => Math.random() - 0.5);
          game.discardPile = [game.discardPile[game.discardPile.length - 1]];
        }
        wildDrawPlayer.hand.push(game.deck.pop());
      }
      break;
  }
}

module.exports = {
  isValidPlay,
  handleSpecialCard
};
