import * as api from "./source.js";

export function run() {
    return api.validate() + api.parse();
}
