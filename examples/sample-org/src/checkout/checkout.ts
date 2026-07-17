import { verifyToken } from '../auth/jwt';
import { addItem } from '../cart/cart';

export function checkout(token: string, cart: string[]): boolean {
  if (!verifyToken(token)) return false;
  addItem(cart, 'receipt');
  return true;
}
