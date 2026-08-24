import { loadSession } from "./auth.js";

export function createOrder() {
    return loadSession();
}

export function handleOrder() {
    return createOrder();
}
