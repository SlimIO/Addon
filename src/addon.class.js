

// Require Node.JS dependencies
const Event = require("events");

// Require Third-party dependencies
const is = require("@sindresorhus/is");
const Observable = require("zen-observable");
const uuidv4 = require("uuid/v4");
const isSnakeCase = require("is-snake-case");

// Require Internal dependencie(s)
const { taggedString } = require("@slimio/utils");
const CallbackScheduler = require("@slimio/scheduler");

// Interval Symbol
const Interval = Symbol("interval");

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
    constructor(name, options = Object.create(null)) {
        super();
        this.on("error", console.error);
        this.name = name;
        this.uid = uuidv4();
        this.isStarted = false;
        this.isConnected = false;
        this.shadowRunAllowed = options.allowShadowRun || false;
        this.multipleRunAllowed = options.allowMultipleInstance || false;

        /** @type {Map<String, () => Promise<any>>} */
        this.callbacks = new Map();

        /** @type {Map<String, CallbackScheduler>} */
        this.schedules = new Map();

        /** @type {Map<String, ZenObservable.SubscriptionObserver<any>>} */
        this.observers = new Map();

        // Register Addon default callbacks!
        this.callbacks.set("start", Addon.start.bind(this));
        this.callbacks.set("stop", Addon.stop.bind(this));
        this.callbacks.set("get_info", Addon.getInfo.bind(this));
    }

    /**
     * @private
     * @static
     * @method start
     * @desc start callback
     * @returns {Promise<void>}
     *
     * @version 0.1.0
     */
    static start() {
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
        this[Interval] = setInterval(async() => {
            const toExecute = [...this.schedules.entries()]
                .filter(([, scheduler]) => scheduler.walk())
                .map(([name]) => this.callbacks.get(name)());

            // Execute all calbacks (Promise) together
            await Promise.all(toExecute);
        }, Addon.mainIntervalMs);
    }

    /**
     * @private
     * @static
     * @method stop
     * @desc start callback
     * @returns {Promise<void>}
     *
     * @version 0.1.0
     */
    static stop() {
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
    }

    /**
     * @private
     * @static
     * @method getInfo
     * @desc get_info callback
     * @returns {Object}
     *
     * @version 0.1.0
     */
    static getInfo() {
        return {
            uid: this.uid,
            name: this.name,
            started: this.isStarted,
            callbacks: this.callbacks.keys()
        };
    }

    /**
     * @public
     * @method registerCallback
     * @desc Register a new callback on the Addon
     * @memberof Addon#
     * @param {!String | Function} name Callback name
     * @param {!AsyncFunction} callback Asynchronous function to execute when required
     * @returns {this}
     *
     * @throws {TypeError}
     * @throws {Error}
     *
     * @version 0.0.0
     *
     * @example
     * const myAddon = new Addon("test");
     *
     * async function hello() {
     *     return "hello world";
     * }
     * myAddon.registerCallback(hello);
     * myAddon.executeCallback("hello").then((ret) => {
     *    assert.equal(ret, "hello world");
     * });
     */
    registerCallback(name, callback) {
        if (is.function(name) && is.nullOrUndefined(callback)) {
            // eslint-disable-next-line
            callback = name;
            // eslint-disable-next-line
            name = callback.name;
        }
        if (!is.string(name)) {
            throw new TypeError("Addon.registerCallback->name should be typeof <string>");
        }
        if (!is.asyncFunction(callback)) {
            throw new TypeError("Addon.registerCallback->callback should be an AsyncFunction");
        }
        if (Addon.ReservedCallbacksName.has(name)) {
            throw new Error(ERRORS.unallowedCallbackName(name));
        }
        if (!isSnakeCase(name)) {
            throw new Error("Addon.registerCallback->name typo should be formated in snake_case");
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
     *
     * @version 0.0.0
     *
     * @example
     * const myAddon = new Addon("test");
     *
     * async function hello() {
     *     return "hello world";
     * }
     * myAddon.registerCallback(hello);
     * myAddon.executeCallback("hello").then((ret) => {
     *    assert.equal(ret, "hello world");
     * });
     */
    executeCallback(name, ...args) {
        if (!is.string(name)) {
            throw new TypeError("Addon.executeCallback->name should be typeof <string>");
        }
        if (!this.callbacks.has(name)) {
            throw new Error(ERRORS.unableToFoundCallback(name));
        }

        // Return callback execution!
        return this.callbacks.get(name)(...args);
    }

    /**
     * @public
     * @method schedule
     * @desc Schedule the execution of a given callback (not a precision scheduler).
     * @memberof Addon#
     * @param {!String} name Callback name
     * @param {!CallbackScheduler} scheduler CallbackScheduler settings!
     * @returns {this}
     *
     * @throws {TypeError}
     * @throws {Error}
     *
     * @version 0.0.0
     *
     * @example
     * const Scheduler = require("@slimio/scheduler");
     * const myAddon = new Addon("test");
     *
     * // Schedule hello to be executed every second!
     * async function hello() {
     *     console.log("hello world!");
     * }
     * myAddon
     *     .registerCallback(hello)
     *     .schedule("hello", new Scheduler({
     *         interval: 1000,
     *         executeOnStart: true
     *     }));
     */
    schedule(name, scheduler) {
        if (!is.string(name)) {
            throw new TypeError("Addon.schedule->name should be typeof <string>");
        }
        if (!this.callbacks.has(name)) {
            throw new Error(ERRORS.unableToFoundCallback(name));
        }
        if (scheduler instanceof CallbackScheduler === false) {
            // eslint-disable-next-line
            throw new TypeError("Addon.schedule->scheduler should be an instance of CallbackScheduler");
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
     *
     * @version 0.0.0
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
            return null;
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
Addon.mainIntervalMs = 500;

// Export (default) Addon
module.exports = Addon;
