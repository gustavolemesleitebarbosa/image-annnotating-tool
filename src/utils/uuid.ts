
import { uuid } from 'uuidv4';

// Helper function to generate a random numeric ID from part of a UUID

export function generateRandomId() {
  // Parse 8 hex characters from the start of the UUID for a 32-bit number
  return parseInt(uuid().slice(0, 8), 16);
}
