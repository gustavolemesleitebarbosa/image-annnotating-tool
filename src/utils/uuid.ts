
import { v4 as uuid } from 'uuid';

// Helper function to generate a random numeric ID from part of a UUID

export function generateRandomId() {
  // Parse 8 hex characters from the start of the UUID for a 32-bit number
  return parseInt((uuid() as string).slice(0, 8), 16);
}
