/* eslint require-await: off */

// Require Node.JS dependencies
const Event = require("event");

// Require third-party dependencies
const is = require("@sindresorhus/is");
const Observable = require("zen-observable");
const uuidv4 = require("uuid/v4");

// Require internal dependencie(s)
const CallbackScheduler = require("./scheduler.class");

// Custom Variables
const Interval = Symbol();

/**
 * @class Addon
 * @classdesc Slim.IO Addon container
 * @extends Event
 *
 * @property {String} name Addon name
 * @property {String} uid Addon unique id
 * @property {Boolean} isStarted
 * @property {Boolean} isConnected
 * @property {Map<String, AsyncFunction>} callbacks
 * @property {Map<String, CallbackScheduler>} schedules
 * @property {Map<String, ZenObservable.SubscriptionObserver<any>>} observers
 */
class Addon extends Event {

    /**
     * @constructor
     * @param {!String} name addon name
     */
    constructor(name) {
        super();
        this.on("error", console.error);
        this.name = name;
        this.uid = uuidv4();
        this.isStarted = false;
        this.isConnected = false;
        this.callbacks = new Map();
        this.schedules = new Map();
        this.observers = new Map();

        // Register default callback "start"
        this.callbacks.set("start", async() => {
            if (this.isStarted) {
                return;
            }
            this.isStarted = true;
            this.emit("start");

            // Setup interval
            this[Interval] = setInterval(() => {
                const toExecute = [];
                for (const [name, scheduler] of this.schedules) {
                    if (!scheduler.walk()) {
                        continue;
                    }
                    toExecute.push(this.callbacks.get(name));
                }
                if (toExecute.length > 0) {
                    Promise.all(toExecute);
                }
            }, Addon.mainIntervalMs);
        });

        // Register default callback "stop"
        this.callbacks.set("stop", async() => {
            if (!this.isStarted) {
                return;
            }
            this.isStarted = false;
            this.emit("stop");

            // Clear interval
            clearInterval(this[Interval]);
        });

        // Register default callback "get_info"
        this.callbacks.set("get_info", () => {
            return {
                uid: this.uid,
                name: this.name,
                started: this.isStarted,
                callbacks: this.callbacks.keys()
            };
        });
    }

    /**
     * @public
     * @method registerCallback
     * @desc Register a new callback on the Addon
     * @memberof Addon#
     * @param {!String} name Callback name
     * @param {!AsyncFunction} callback Asynchronous function to execute when required
     * @returns {this}
     *
     * @throws {TypeError}
     */
    registerCallback(name, callback) {
        if (!is.string(name)) {
            throw new TypeError("Addon.registerCallback->name should be typeof <string>");
        }
        if (!is.asyncFunction(callback)) {
            throw new TypeError("Addon.registerCallback->callback should be an AsyncFunction");
        }
        if (Addon.ReservedCallbacksName.has(name)) {
            throw new Error(`Addon.registerCallback - Callback name ${name} is not allowed!`);
        }

        this.callbacks.set(name, callback);

        return this;
    }

    /**
     * @public
     * @template T
     * @method executeCallback
     * @desc Execute a callback of the addon
     * @memberof Addon#
     * @param {!String} name Callback name
     * @param {any[]} args Callback arguments
     * @returns {Promise<T>} Return the callback response (or void)
     *
     * @throws {TypeError}
     * @throws {Error}
     */
    executeCallback(name, ...args) {
        if (!is.string(name)) {
            throw new TypeError("Addon.executeCallback->name should be typeof <string>");
        }
        if (!this.callbacks.has(name)) {
            throw new Error(`Addon.executeCallback - Unable to found callback with name ${name}`);
        }

        return this.callbacks.get(name)(args);
    }

    /**
     * @public
     * @method schedule
     * @desc Schedule a callback execution!
     * @memberof Addon#
     * @param {!String} name Callback name
     * @param {!CallbackScheduler} scheduler CallbackScheduler settings!
     * @returns {this}
     *
     * @throws {TypeError}
     * @throws {Error}
     */
    schedule(name, scheduler) {
        if (!is.string(name)) {
            throw new TypeError("Addon.schedule->name should be typeof <string>");
        }
        if (!this.callbacks.has(name)) {
            throw new Error(`Addon.schedule - Unable to found callback with name ${name}`);
        }
        if (scheduler instanceof CallbackScheduler === false) {
            throw new TypeError(
                "Addon.schedule->scheduler should be an instance of CallbackScheduler"
            );
        }

        this.schedules.set(name, scheduler);

        return this;
    }

    /**
     * @public
     * @method sendMessage
     * @desc Send a message to the Core
     * @memberof Addon#
     * @param {!String} target Target path to the callback
     * @param {Object=} [options={}] Message options
     * @param {Array<any>=} [args=[]] Callback arguments
     * @param {number=} timeout Custom timeout
     * @returns {this}
     *
     * @throws {TypeError}
     */
    sendMessage(target, options = {}) {
        if (!is.string(target)) {
            throw new TypeError("Addon.sendMessage->target should be typeof <string>");
        }
        const messageId = uuidv4();
        setImmediate(() => {
            this.emit("message", messageId, target, is.array(options.args) ? options.args : []);
        });

        return new Observable((observer) => {
            const timer = setTimeout(() => {
                this.observers.delete(messageId);
                observer.error(
                    `Failed to receive response for message id ${messageId}
                    in a delay of ${Addon.messageTimeOutMs}ms`
                );
            }, is.number(options.timeout) ? options.timeout : Addon.messageTimeOutMs);
            this.observers.set(messageId, observer);

            return () => {
                clearTimeout(timer);
                this.observers.delete(messageId);
            };
        });
    }

}
Addon.ReservedCallbacksName = new Set(["start", "stop", "get_info"]);
Addon.messageTimeOutMs = 5000;
Addon.mainIntervalMs = 1000;

module.exports = Addon;
