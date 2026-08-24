import { validate, parse as parseValue } from "./source.js";

export function run() {
    return validate() + parseValue();
}
