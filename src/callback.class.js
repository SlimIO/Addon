// Require Node.js Dependencies
const asyncHooks = require("async_hooks");
const { performance, PerformanceObserver } = require("perf_hooks");

/**
 * @class Callback
 * @extends AsyncResource
 *
 * @property {Function} callback
 */
class Callback extends asyncHooks.AsyncResource {
    /**
     * @constructor
     * @memberof Callback#
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
     * @memberof Callback#
     * @param {Object} header callback header
     * @param {any[]} args handler arguments
     * @returns {Promise<any>}
     *
     * @throws {Error}
     */
    async execute(header, args = []) {
        const ret = await this.runInAsyncScope(this.callback, null, header, ...args);
        this.emitDestroy();

        return ret;
    }
}

/**
 * @static
 * @const ActiveCallback
 * @type {Map<Number, String>}
 */
Callback.ActiveCallback = new Map();

/**
 * @static
 * @method createHook
 * @return {AsyncHook}
 */
Callback.createHook = function createHook() {
    return asyncHooks.createHook({
        init(id, type) {
            if (type.startsWith("Callback-")) {
                performance.mark(`${type}-${id}-Init`);
                Callback.ActiveCallback.set(id, type);
            }
        },
        destroy(id) {
            if (Callback.ActiveCallback.has(id)) {
                const type = Callback.ActiveCallback.get(id);
                Callback.ActiveCallback.delete(id);
                performance.mark(`${type}-${id}-Destroy`);
                performance.measure(`${type}-${id}`, `${type}-${id}-Init`, `${type}-${id}-Destroy`);
            }
        }
    });
};

/**
 * @callback perfTrigger
 * @param {PerformanceEntry} perfEntry
 */

/**
 * @static
 * @method observePerformance
 * @param {perfTrigger} perfTrigger perfTrigger
 * @returns {PerformanceObserver}
 */
Callback.observePerformance = function observe(perfTrigger) {
    if (typeof perfTrigger !== "function") {
        throw new TypeError("perfTrigger should be typeof function!");
    }
    const obs = new PerformanceObserver((list) => {
        for (const perfEntry of list.getEntries()) {
            /* istanbul ignore next */
            if (!/^Callback/.test(perfEntry.name)) {
                continue;
            }
            perfTrigger(perfEntry);
            // console.log(`${perfEntry.name} has been executed in ${perfEntry.duration}ms`);
            performance.clearMarks(perfEntry.name);
        }
    });
    obs.observe({ entryTypes: ["measure"], buffered: true });

    return obs;
};

module.exports = Callback;
