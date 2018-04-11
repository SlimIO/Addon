/* eslint require-await: off */

// Require Node.JS dependencies
const Event = require("event");

// Require third-party dependencies
const is = require("@sindresorhus/is");
const Observable = require("zen-observable");
const uuidv4 = require("uuid/v4");
const { taggedString } = require("@slimio/utils");

// Require internal dependencie(s)
const CallbackScheduler = require("./scheduler.class");

// Interval Symbol
const Interval = Symbol();

/**
 * @private
 * @const ERRORS
 */
const ERRORS = require("./errors.json");
for (const [key, value] of Object.entries(ERRORS)) {
    Reflect.set(ERRORS, key, taggedString`${value}`);
}

/**
 * @class Addon
 * @classdesc Slim.IO Addon container
 * @extends Event
 *
 * @property {String} name Addon name
 * @property {String} uid Addon unique id
 * @property {Boolean} isStarted
 * @property {Boolean} isConnected
 * @property {Boolean} shadowRunAllowed
 * @property {Boolean} multipleRunAllowed
 * @property {Map<String, AsyncFunction>} callbacks
 * @property {Map<String, CallbackScheduler>} schedules
 * @property {Map<String, ZenObservable.SubscriptionObserver<any>>} observers
 */
class Addon extends Event {

    /**
     * @constructor
     * @param {!String} name addon name
     * @param {Object} [options=[]] Addon options
     * @param {Boolean=} [options.allowMultipleInstance=false] Enable/Disable multiple addon instance(s)
     * @param {Boolean=} [options.allowShadowRun=false] Enable/Disable shadow running
     */
    constructor(name, options = {}) {
        super();
        this.on("error", console.error);
        this.name = name;
        this.uid = uuidv4();
        this.isStarted = false;
        this.isConnected = false;
        this.callbacks = new Map();
        this.schedules = new Map();
        this.observers = new Map();
        this.shadowRunAllowed = options.allowShadowRun || false;
        this.multipleRunAllowed = options.allowMultipleInstance || false;

        // Register default callback "start"
        this.callbacks.set("start", async() => {
            if (this.isStarted) {
                return;
            }
            this.isStarted = true;

            /**
             * @event Addon#start
             * @type {void}
             */
            this.emit("start");

            // Setup interval
            this[Interval] = setInterval(() => {
                const toExecute = [];

                // Pull callback(s) to execute
                for (const [name, scheduler] of this.schedules) {
                    if (!scheduler.walk()) {
                        continue;
                    }
                    toExecute.push(this.callbacks.get(name));
                }

                // Execute all calbacks (Promise) together (if there has)
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

            /**
             * @event Addon#stop
             * @type {void}
             */
            this.emit("stop");

            // Clear interval
            clearInterval(this[Interval]);
        });

        // Register default callback "get_info"
        this.callbacks.set("get_info", async() => {
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
            throw new Error(ERRORS.unallowedCallbackName(name));
        }

        // Register callback on Addon
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
            throw new Error(ERRORS.unableToFoundCallback(name));
        }

        // Return callback execution!
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
            throw new Error(ERRORS.unableToFoundCallback(name));
        }
        if (scheduler instanceof CallbackScheduler === false) {
            throw new TypeError(
                "Addon.schedule->scheduler should be an instance of CallbackScheduler"
            );
        }

        // Register scheduler on Addon
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
     * @param {Array<any>=} [options.args=[]] Callback arguments
     * @param {number=} options.timeout Custom timeout
     * @param {Boolean=} noReturn Dont expect a response!
     * @returns {Observable<any>}
     *
     * @throws {TypeError}
     * @fires Addon#message
     */
    sendMessage(target, options = {}, noReturn = false) {
        if (!is.string(target)) {
            throw new TypeError("Addon.sendMessage->target should be typeof <string>");
        }
        // Generate unique id for our message!
        const messageId = uuidv4();

        // Send a message (on the next event loop iteration).
        setImmediate(() => {

            /**
             * @event Addon#message
             * @param {String} messageId
             * @param {String} target
             * @param {Array} args
             */
            this.emit("message", messageId, target, is.array(options.args) ? options.args : []);
        });

        // Return void 0 if noReturn is true
        if (noReturn) {
            return void 0;
        }

        // Return an Observable that stream response
        return new Observable((observer) => {

            // Setup a timeOut for our message
            const timer = setTimeout(() => {
                this.observers.delete(messageId);
                observer.error(
                    ERRORS.messageTimeOut(messageId, Addon.messageTimeOutMs)
                );
            }, is.number(options.timeout) ? options.timeout : Addon.messageTimeOutMs);

            // Setup the observer on the Addon.
            this.observers.set(messageId, observer);

            // On unsubcription clear the timeOut timer and the registered observer
            return () => {
                clearTimeout(timer);
                this.observers.delete(messageId);
            };
        });
    }

}

// Register Static Addon variables...
Addon.ReservedCallbacksName = new Set(["start", "stop", "get_info"]);
Addon.messageTimeOutMs = 5000;
Addon.mainIntervalMs = 1000;

// Export (default) Addon
module.exports = Addon;
