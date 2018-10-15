// Require NodeJS Dependencies
const { AsyncResource } = require("async_hooks");

/**
 * @class Callback
 * @extends AsyncResource
 */
class Callback extends AsyncResource {

    /**
     * @constructor
     * @param {any} callback callbackHandler
     * @param {any} options Callback Options
     * @param {Number=} options.executionLimit Callback execution limit
     */
    constructor(callback, options = Object.create(null)) {
        super("Callback");

        this.callback = callback;
        this.executionLimit = options.executionLimit || Callback.DEFAULT_LIMIT;

        this.closed = false;
        this.currExecutedCount = 0;
    }

    /**
     * @method execute
     * @param {any[]} args callback arguments
     * @returns {Promise<any>}
     *
     * @throws {Error}
     */
    async execute(args = []) {
        if (this.closed) {
            throw new Error("Unable to execute closed Callback!");
        }
        if (this.currExecutedCount + 1 >= this.executionLimit) {
            throw new Error("Callback execution limit has been reach!");
        }

        this.currExecutedCount++;
        const ret = await this.runInAsyncScope(this.callback, null, ...args);
        this.currExecutedCount--;

        return ret;
    }

    /**
     * @method close
     * @returns {void}
     */
    close() {
        this.closed = true;
        this.emitDestroy();
    }

}

Callback.DEFAULT_LIMIT = 100;

module.exports = Callback;
