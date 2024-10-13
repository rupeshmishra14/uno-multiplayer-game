const initialState = {
  drawnCardOption: null,
  // ... (other game state properties)
};

const gameReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'SHOW_DRAWN_CARD_OPTION':
      return {
        ...state,
        drawnCardOption: action.payload
      };

    case 'CLEAR_DRAWN_CARD_OPTION':
      return {
        ...state,
        drawnCardOption: null
      };

    // ... (other cases)

    default:
      return state;
  }
};

export default gameReducer;
