// Require NodeJS Dependencies
const { extname } = require("path");

// Require Third-party dependencies
const is = require("@slimio/is");
const SafeEmitter = require("@slimio/safe-emitter");
const CallbackScheduler = require("@slimio/scheduler");
const Observable = require("zen-observable");
const uuidv4 = require("uuid/v4");
const isSnakeCase = require("is-snake-case");
const timer = require("@slimio/timer");

// Require Internal dependencie(s)
const Stream = require("./stream.class");
const Callback = require("./callback.class");

// Interval Symbol
const SYM_INTERVAL = Symbol("interval");

/**
 * @callback Callback
 * @returns {Promise<any>}
 */

/**
 * @typedef {Object} CallbackHeader
 * @property {String} from The addon who made the request
 * @property {String} id Message ID
 */

/**
 * @class Addon
 * @classdesc Slim.IO Addon container
 * @extends Event
 *
 * @property {String} name Addon name
 * @property {String} uid Addon unique id
 * @property {Boolean} isStarted
 * @property {Boolean} isReady
 * @property {Set<String>} flags
 * @property {Map<String, AsyncFunction>} callbacks
 * @property {Map<String, CallbackScheduler>} schedules
 * @property {Map<String, ZenObservable.SubscriptionObserver<any>>} observers
 */
class Addon extends SafeEmitter {

    /**
     * @constructor
     * @param {!String} name addon name
     * @param {String=} [version=1.0.0] addon version
     *
     * @throws {TypeError}
     * @throws {Error}
     */
    constructor(name, version = "1.0.0") {
        super();
        if (typeof name !== "string") {
            throw new TypeError("constructor name argument should be typeof string");
        }
        if (typeof version !== "string") {
            throw new TypeError("version argument should be typeof string");
        }
        if (name.length <= 2) {
            throw new Error("constructor name argument length must be greater than 2");
        }

        this.name = name;
        this.version = version;
        this.uid = uuidv4();
        this.isReady = false;
        this.isStarted = false;
        this.flags = new Set();
        this.callbacksDescriptor = null;
        this.asserts = [];

        /** @type {Map<String, any[]>} */
        this.subscribers = new Map();

        /** @type {Map<String, Callback>} */
        this.callbacks = new Map();

        /** @type {Map<String, String>} */
        this.callbacksAlias = new Map();

        /** @type {Map<String, CallbackScheduler>} */
        this.schedules = new Map();

        /** @type {Map<String, ZenObservable.SubscriptionObserver<any>>} */
        this.observers = new Map();

        // The "start" callback is triggered to start the addon
        this.callbacks.set("start", Addon.start.bind(this));

        // The "stop" callback is triggered to stop the addon
        this.callbacks.set("stop", Addon.stop.bind(this));

        // The "event" callback is triggered by external addons
        // eslint-disable-next-line
        this.callbacks.set("event", async(header, name, data) => {
            if (!this.subscribers.has(name)) {
                return;
            }

            for (const observer of this.subscribers.get(name)) {
                observer.next(data);
            }
        });

        // The "get_info" callback is triggered to retrieve default information about the addon
        this.callbacks.set("get_info", Addon.getInfo.bind(this));

        // the "health_check" callback is triggered to verify the health of the addon!
        this.callbacks.set("health_check", async() => {
            // Detect if there is any custom assertion addon by the developer
            if (this.asserts.length > 0) {
                await Promise.all(this.asserts);
            }

            return true;
        });
    }

    /**
     * @private
     * @static
     * @method start
     * @desc Function used to start an addon
     * @returns {Promise<boolean>}
     *
     * @fires error
     * @fires start
     *
     * @version 0.1.0
     */
    static async start() {
        if (this.isStarted) {
            return false;
        }
        this.isStarted = true;

        // The interval is used to execute Scheduled callbacks
        // A Symbol primitive is used to make Interval private
        this[SYM_INTERVAL] = timer.setInterval(async() => {
            // Retrieve scheduled callback
            const toExecute = [...this.schedules.entries()]
                .filter(([, scheduler]) => scheduler.walk())
                .map(([name]) => this.callbacks.get(name)());

            // Execute all calbacks (Promise) in asynchrone
            try {
                await Promise.all(toExecute);
            }
            catch (error) {
                this.emit("error", error);
            }
        }, Addon.MAIN_INTERVAL_MS);

        /**
         * @event Addon#start
         * @type {void}
         */
        await this.emitAndWait("start");

        return true;
    }

    /**
     * @private
     * @static
     * @method stop
     * @desc Function used to stop an addon
     * @returns {Promise<boolean>}
     *
     * @fires stop
     *
     * @version 0.1.0
     */
    static async stop() {
        if (!this.isStarted) {
            return false;
        }
        this.isStarted = false;

        // Clear current addon interval
        timer.clearInterval(this[SYM_INTERVAL]);

        // Complete subscribers
        for (const [subject, observers] of this.subscribers.entries()) {
            for (const observer of observers) {
                observer.complete();
            }
            this.subscribers.delete(subject);
        }

        /**
         * @event Addon#stop
         * @type {void}
         */
        await this.emitAndWait("stop");

        return true;
    }

    /**
     * @private
     * @static
     * @method getInfo
     * @desc Function used to retrieve default options & properties of an addon
     * @returns {Addon.CallbackGetInfo}
     *
     * @version 0.1.0
     */
    static getInfo() {
        return {
            uid: this.uid,
            name: this.name,
            version: this.version,
            containerVersion: "0.12.0",
            started: this.isStarted,
            callbacksDescriptor: this.callbacksDescriptor,
            callbacks: [...this.callbacks.keys()],
            flags: [...this.flags]
        };
    }

    /**
     * @public
     * @method of
     * @desc Subscribe to an event
     * @param {!String} subject subject
     * @memberof Addon#
     * @returns {Boolean}
     *
     * @version 0.12.0
     */
    of(subject) {
        if (typeof subject !== "string") {
            throw new TypeError("subject should be typeof string");
        }
        if (!this.subscribers.has(subject)) {
            this.subscribers.set(subject, []);
        }
        this.sendMessage("events.subscribe", {
            args: [subject],
            noReturn: true
        });

        return new Observable((observer) => {
            const index = this.subscribers.get(subject).push(observer);

            return () => {
                this.subscribers.get(subject).splice(index, 1);
            };
        });
    }

    /**
     * @public
     * @method ready
     * @desc Set the addon ready for the core!
     * @memberof Addon#
     * @returns {Boolean}
     *
     * @version 0.5.0
     *
     * @throws {Error}
     */
    ready() {
        if (!this.isStarted) {
            throw new Error("Addon should be started before being ready!");
        }
        if (this.isReady) {
            return false;
        }
        this.isReady = true;
        this.once("stop").then(() => {
            this.isReady = false;
        }).catch(console.error);
        this.emit("ready");

        return true;
    }

    /**
     * @public
     * @method setCallbacksDescriptorFile
     * @desc Set a new callbacks descriptor file (.prototype)
     * @memberof Addon#
     * @param {!String} path Callback name
     * @returns {void}
     *
     * @throws {TypeError}
     * @throws {Error}
     *
     * @version 0.9.0
     */
    setCallbacksDescriptorFile(path) {
        if (typeof path !== "string") {
            throw new TypeError("path should be typeof string!");
        }
        if (extname(path) !== ".proto") {
            throw new Error("path should be a .prototype file");
        }

        this.callbacksDescriptor = path;
    }

    /**
     * @public
     * @chainable
     * @method registerCallback
     * @desc Register a new callback on the Addon. The callback name should be formatted in snake_case
     * @memberof Addon#
     * @param {!(String | Function)} name Callback name
     * @param {!Callback} callback Async Callback to execute when the callback is triggered by the core or the addon itself
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
        // If name is a function, replace name by the function.name
        if (is.func(name) && is.nullOrUndefined(callback)) {
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
        if (Addon.RESERVED_CALLBACKS_NAME.has(name)) {
            throw new Error(`Addon.registerCallback - Callback name '${name}' is a reserved callback name!`);
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
     * @method setDeprecatedAlias
     * @desc Register One or Many deprecated Alias for a given callback
     * @memberof Addon#
     * @param {!String} callbackName Callback name
     * @param {String[]} alias List of alias to set for the given callback name (they will throw deprecated warning)
     * @returns {void}
     *
     * @throws {TypeError}
     * @throws {Error}
     *
     * @version 0.7.0
     */
    setDeprecatedAlias(callbackName, alias) {
        if (!this.callbacks.has(callbackName)) {
            throw new Error(`Unknow callback with name ${callbackName}`);
        }
        if (!is.array(alias)) {
            throw new TypeError("alias argument should be instanceof Array");
        }

        for (const cbAlias of alias) {
            this.callbacksAlias.set(cbAlias, callbackName);
        }
    }

    /**
     * @public
     * @template T
     * @method executeCallback
     * @desc Execute a callback of the addon
     * @memberof Addon#
     * @param {!String} name Callback name
     * @param {CallbackHeader=} header callback header
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
    executeCallback(name, header = Addon.DEFAULT_HEADER, ...args) {
        if (!is.string(name)) {
            throw new TypeError("Addon.executeCallback->name should be typeof <string>");
        }
        let callbackName = name;
        foundCB: if (!this.callbacks.has(callbackName)) {
            if (!this.callbacksAlias.has(callbackName)) {
                callbackName = null;
                break foundCB;
            }
            callbackName = this.callbacksAlias.get(name);
            process.emitWarning(`Addon Callback Alias ${name} is deprecated. Please use ${callbackName}`);
        }

        if (callbackName === null) {
            throw new Error(`Addon.executeCallback - Unable to found callback with name ${name}`);
        }

        // Return callback execution!
        const handler = this.callbacks.get(callbackName);

        return (new Callback(`${this.name}-${callbackName}`, handler)).execute(header, args);
    }

    /**
     * @public
     * @chainable
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
        // If name is an instanceo of Scheduler, replace name by the latest callback registered!
        if (name instanceof CallbackScheduler) {
            if (this.callbacks.size <= Addon.RESERVED_CALLBACKS_NAME.size) {
                throw new Error("Addon.schedule - No custom callback has been registered yet!");
            }
            // eslint-disable-next-line
            scheduler = name;
            // eslint-disable-next-line
            name = [...this.callbacks.keys()].pop();
        }

        if (!is.string(name)) {
            throw new TypeError("Addon.schedule->name should be typeof <string>");
        }
        if (!this.callbacks.has(name)) {
            throw new Error(`Addon.schedule - Unable to found callback with name ${name}`);
        }
        if (!(scheduler instanceof CallbackScheduler)) {
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
     * @param {any[]} [options.args=[]] Callback arguments
     * @param {number} [options.timeout=5000] Custom timeout
     * @param {Boolean} [options.noReturn=false] Dont expect a response!
     * @returns {Observable<any>}
     *
     * @throws {TypeError}
     * @fires Addon#message
     *
     * @version 0.0.0
     *
     * @example
     * const myAddon = new Addon("myAddon");
     *
     * myAddon.on("start", function() {
     *     myAddon
     *         .sendMessage("cpu.get_info")
     *         .subscribe(console.log);
     *     myAddon.ready();
     * });
     */
    sendMessage(target, options = { noReturn: false }) {
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
        if (options.noReturn) {
            return null;
        }

        // Return an Observable that stream response
        return new Observable((observer) => {

            // Setup a timeOut for our message
            const timer = setTimeout(() => {
                this.observers.delete(messageId);
                observer.error(
                    `Failed to receive response for message id ${messageId} in a delay of ${Addon.MESSAGE_TIMEOUT_MS}ms`
                );
            }, is.number(options.timeout) ? options.timeout : Addon.MESSAGE_TIMEOUT_MS);

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

// Register Static (CONSTANTS) Addon variables...
Addon.RESERVED_CALLBACKS_NAME = new Set(["start", "stop", "event", "get_info", "health_check"]);
Addon.MESSAGE_TIMEOUT_MS = 5000;
Addon.MAIN_INTERVAL_MS = 500;
Addon.DEFAULT_HEADER = { from: "self" };

// Register Sub classes
Addon.Stream = Stream;
Addon.Callback = Callback;

// Export (default) Addon
module.exports = Addon;
