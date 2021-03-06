"use strict";

// Require Node.js Dependencies
const asyncHooks = require("async_hooks");
const { performance, PerformanceObserver } = require("perf_hooks");

// Require Third-party Dependencies
const oop = require("@slimio/oop");

class Callback extends asyncHooks.AsyncResource {
    /**
     * @class Callback
     * @classdesc Node.js dedicated Async Resource that will allow to monitore callback execution time and count.
     * @memberof Callback#
     * @param {!string} name callback name
     * @param {!Function} callback callbackHandler
     */
    constructor(name, callback) {
        super(`Callback-${oop.toString(name)}`);
        this.callback = callback;
    }

    /**
     * @function execute
     * @memberof Callback#
     * @param {any[]} args handler arguments
     * @returns {Promise<any>}
     *
     * @throws {Error}
     */
    async execute(args = []) {
        try {
            const ret = await this.runInAsyncScope(this.callback, null, ...args);

            return ret;
        }
        finally {
            this.emitDestroy();
        }
    }
}

/**
 * @static
 * @constant ActiveCallback
 * @type {Map<number, string>}
 */
Callback.ActiveCallback = new Map();

/**
 * @static
 * @function createHook
 * @returns {AsyncHook}
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
 * @function observePerformance
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
