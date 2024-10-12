const COLORS = ['red', 'blue', 'green', 'yellow'];
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const SPECIAL_CARDS = ['skip', 'reverse', 'draw2'];

const generateDeck = () => {
  let deck = [];

  // Add number cards
  COLORS.forEach(color => {
    NUMBERS.forEach(number => {
      deck.push(`${color}_${number}`);
      if (number !== '0') {
        deck.push(`${color}_${number}`);
      }
    });
  });

  // Add special cards
  COLORS.forEach(color => {
    SPECIAL_CARDS.forEach(special => {
      deck.push(`${color}_${special}`);
      deck.push(`${color}_${special}`);
    });
  });

  return deck;
};

const shuffleDeck = (deck) => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const dealCards = (deck, numPlayers) => {
  const hands = Array(numPlayers).fill().map(() => []);
  const remainingDeck = [...deck];

  // Deal 7 cards to each player
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < numPlayers; j++) {
      if (remainingDeck.length > 0) {
        hands[j].push(remainingDeck.pop());
      }
    }
  }

  // Get the first card for the discard pile
  const firstCard = remainingDeck.pop();

  return { hands, remainingDeck, firstCard };
};

module.exports = {
  generateDeck,
  shuffleDeck,
  dealCards
};
