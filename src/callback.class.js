// Require NodeJS Dependencies
const { AsyncResource } = require("async_hooks");

/**
 * @class Callback
 * @extends AsyncResource
 *
 * @property {Function} callback
 */
class Callback extends AsyncResource {

    /**
     * @constructor
     * @param {!String} name callback name
     * @param {!Function} callback callbackHandler
     *
     * @throws {TypeError}
     */
    constructor(name, callback) {
        if (typeof name !== "string") {
            throw new TypeError("name should be typeof string!");
        }
        if (typeof callback !== "function") {
            throw new TypeError("callback should be typeof function!");
        }

        super(`Callback-${name}`);
        this.callback = callback;
    }

    /**
     * @method execute
     * @returns {Promise<any>}
     *
     * @throws {Error}
     */
    async execute() {
        const ret = await this.runInAsyncScope(this.callback, null);
        this.emitDestroy();

        return ret;
    }

}

module.exports = Callback;
