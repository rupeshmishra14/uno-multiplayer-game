import axios from 'axios';

export async function getGameState(gameId) {
  try {
    const response = await axios.get(`${process.env.SERVER_URL}/api/games/${gameId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching game state from server for gameId ${gameId}:`, error);
    throw error;
  }
}
