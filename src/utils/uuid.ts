
import { v4 as uuid } from 'uuid';

// Helper function to generate a random numeric ID from part of a UUID

export function generateRandomId() {
  return parseInt((uuid()).slice(0, 8), 16);
}
