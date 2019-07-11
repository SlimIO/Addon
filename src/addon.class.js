"use strict";

// Require Node.js Dependencies
const { extname } = require("path");

// Require Third-party dependencies
const is = require("@slimio/is");
const SafeEmitter = require("@slimio/safe-emitter");
const Logger = require("@slimio/logger");
const CallbackScheduler = require("@slimio/scheduler");
const Observable = require("zen-observable");
const uuid = require("uuid/v4");
const isSnakeCase = require("is-snake-case");
const timer = require("@slimio/timer");

// Require Internal dependencie(s)
const Stream = require("./stream.class");
const Callback = require("./callback.class");
const decamelize = require("./decamelize");

// CONSTANTS
const SYM_INTERVAL = Symbol("interval");
const SLEEP_LOCK_MS = 25;

/**
 * @function sleep
 * @description Sleep async context for a given time in milliseconds
 * @param {!number} durationMs sleep duration in milliseconds
 * @returns {Promise<void>}
 */
function sleep(durationMs) {
    return new Promise((resolve) => setTimeout(resolve, durationMs));
}

/**
 * @callback Callback
 * @returns {Promise<any>}
 */

/**
 * @typedef {object} CallbackHeader
 * @property {string} from The addon who made the request
 * @property {string} id Message ID
 */

/**
 * @typedef {object} LockRule
 * @property {boolean} startAfter
 * @property {boolean} lockCallback
 */

/**
 * @typedef {object} MessageOptions
 * @property {any[]} args Callback arguments
 * @property {number} timeout Custom timeout
 * @property {boolean} noReturn Dont expect a response!
 */

/**
 * @class Addon
 * @classdesc Slim.IO Addon container
 * @augments Event
 *
 * @property {string} name Addon name
 * @property {string} version
 * @property {boolean} verbose
 * @property {string} description
 * @property {string} uid Addon unique id
 * @property {boolean} isStarted
 * @property {boolean} isAwake
 * @property {boolean} isReady
 * @property {number} lastStart
 * @property {number} lastStop
 * @property {Array} asserts
 * @property {Set<string>} flags
 * @property {Map<string, Callback>} callbacks
 * @property {Map<string, CallbackScheduler>} schedules
 * @property {Map<string, ZenObservable.SubscriptionObserver<any>>} observers
 * @property {Map<string, any[]>} subscribers
 * @property {Map<string, string>} callbacksAlias
 * @property {Map<string, LockRule>} locks
 */
class Addon extends SafeEmitter {
    /**
     * @class
     * @memberof Addon#
     * @param {!string} name addon name
     * @param {object} [options] options
     * @param {boolean} [options.verbose=false] Enable verbose mode
     * @param {string} [options.version=1.0.0] addon version
     * @param {string} [options.description] addon description
     *
     * @throws {TypeError}
     * @throws {Error}
     */
    constructor(name, options = Object.create(null)) {
        super();
        if (typeof name !== "string") {
            throw new TypeError("constructor name argument should be typeof string");
        }
        if (!is.plainObject(options)) {
            throw new TypeError("options should be a plainObject");
        }

        const { version = "1.0.0", verbose = false, description = "" } = options;
        if (typeof version !== "string") {
            throw new TypeError("version argument should be typeof string");
        }
        if (typeof verbose !== "boolean") {
            throw new TypeError("verbose argument should be typeof boolean");
        }
        if (typeof description !== "string") {
            throw new TypeError("description argument should be typeof string");
        }

        if (name.length <= 2) {
            throw new Error("constructor name argument length must be greater than 2");
        }

        this.name = name;
        this.version = version;
        this.verbose = verbose;
        this.logger = null;
        this.description = description;
        this.uid = uuid();
        this.isReady = false;
        this.isStarted = false;
        this.isAwake = false;
        this.lastStart = null;
        this.lastStop = null;
        this.callbacksDescriptor = null;
        this.asserts = [];

        /** @type {Map<string, any[]>} */
        this.subscribers = new Map();

        /** @type {Map<string, Callback>} */
        this.callbacks = new Map();

        /** @type {Map<string, string>} */
        this.callbacksAlias = new Map();

        /** @type {Map<string, CallbackScheduler>} */
        this.schedules = new Map();

        /** @type {Map<string, ZenObservable.SubscriptionObserver<any>>} */
        this.observers = new Map();

        /** @type {Map<string, LockRule>} */
        this.locks = new Map();

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
     * @function start
     * @memberof Addon#
     * @description Function used to start an addon
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
        this.lastStart = Date.now();
        this.logger = new Logger(void 0, { title: this.name });

        /**
         * @event Addon#start
         * @type {void}
         */
        await this.emitAndWait("start");
        if (this.verbose) {
            this.logger.writeLine("Start event triggered!");
        }

        // Check locks
        for (const [addonName, rules] of this.locks.entries()) {
            if (!rules.startAfter) {
                continue;
            }

            let res;
            do {
                res = await this.sendOne(`${addonName}.get_info`);
                await sleep(SLEEP_LOCK_MS);
            } while (typeof res === "undefined" || !res.ready);
            if (this.verbose) {
                this.logger.writeLine(`Unlocked addon '${addonName}'`);
            }
        }

        // Create Interval only is there is scheduled callbacks!
        if (this.schedules.size > 0) {
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
        }

        this.isAwake = true;
        /**
         * @event Addon#awake
         * @type {void}
         */
        await this.emitAndWait("awake");

        return true;
    }

    /**
     * @private
     * @static
     * @function stop
     * @memberof Addon#
     * @description Function used to stop an addon
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
        this.lastStop = Date.now();

        // Clear current addon interval
        if (typeof this[SYM_INTERVAL] === "number") {
            timer.clearInterval(this[SYM_INTERVAL]);
        }

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
     * @function getInfo
     * @memberof Addon#
     * @description Function used to retrieve default options & properties of an addon
     * @returns {Addon.CallbackGetInfo}
     *
     * @version 0.1.0
     */
    static getInfo() {
        const callbacksAlias = {};
        for (const [alias, callbackName] of this.callbacksAlias.entries()) {
            if (Reflect.has(callbacksAlias, callbackName)) {
                callbacksAlias[callbackName].push(alias);
            }
            else {
                callbacksAlias[callbackName] = [alias];
            }
        }

        return {
            uid: this.uid,
            name: this.name,
            version: this.version,
            description: this.description,
            containerVersion: Addon.VERSION,
            ready: this.isReady,
            started: this.isStarted,
            awake: this.isAwake,
            lastStart: this.lastStart,
            lastStop: this.lastStop,
            callbacksDescriptor: this.callbacksDescriptor,
            callbacks: [...this.callbacks.keys()],
            callbacksAlias
        };
    }

    /**
     * @public
     * @function lockOn
     * @memberof Addon#
     * @description Create a new lock rule (wait for a given addon to be started).
     * @param {!string} addonName addonName
     * @param {LockRule} [rules={}] lock rules
     * @returns {Addon}
     *
     * @throws {TypeError}
     *
     * @version 0.15.0
     */
    lockOn(addonName, rules = Object.create(null)) {
        if (typeof addonName !== "string") {
            throw new TypeError("addonName must be a string");
        }

        const { startAfter = true, lockCallback = false } = rules;
        if (typeof startAfter !== "boolean") {
            throw new TypeError("rules.startAfter must be a boolean");
        }
        if (typeof lockCallback !== "boolean") {
            throw new TypeError("rules.lockCallback must be a boolean");
        }

        this.locks.set(addonName, {
            startAfter, lockCallback
        });

        return this;
    }

    /**
     * @public
     * @function of
     * @memberof Addon#
     * @description Subscribe to a given SlimIO kind of events (these events are managed by the built-in addon "events")
     * @param {!string} subject subject
     * @returns {ZenObservable.ObservableLike<any>}
     *
     * @version 0.12.0
     *
     * @example
     * const myAddon = new Addon("myAddon");
     *
     * myAddon.of(Addon.Subjects.Addon.Ready).subscribe((addonName) => {
     *     console.log(`Addon with name ${addonName} is Ready !`);
     * });
     */
    of(subject) {
        if (typeof subject !== "string") {
            throw new TypeError("subject should be typeof string");
        }
        if (!this.subscribers.has(subject)) {
            this.subscribers.set(subject, []);
        }

        const publishMsg = (observer) => {
            this.sendMessage("events.subscribe", { args: [subject] }).subscribe({
                error: (err) => observer.error(err)
            });
        };

        return new Observable((observer) => {
            if (this.isStarted) {
                publishMsg(observer);
            }
            else {
                this.once("start", 5000).then(() => {
                    publishMsg(observer);
                }).catch(observer.error);
            }

            const index = this.subscribers.get(subject).push(observer);

            return () => {
                this.subscribers.get(subject).splice(index, 1);
            };
        });
    }

    /**
     * @async
     * @public
     * @function ready
     * @memberof Addon#
     * @description Set/flag the current addon as Ready (will trigger "unlock" for other addons).
     * @returns {Promise<boolean>}
     *
     * @version 0.5.0
     *
     * @throws {Error}
     *
     * @example
     * const test = new Addon("test");
     *
     * // can be triggered on "start" or "awake".
     * test.on("start", () => {
     *      test.ready();
     * });
     */
    async ready() {
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

        try {
            await this.sendOne("events.publish", [["Addon", "ready", this.name]]);
        }
        catch (err) {
            if (this.verbose) {
                this.logger.writeLine(`${err.name}: ${err.message}`);
            }
        }

        return true;
    }

    /**
     * @public
     * @function setCallbacksDescriptorFile
     * @memberof Addon#
     * @description Set a new callbacks descriptor file (.prototype)
     * @param {!string} path Callback name
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
     * @function registerCallback
     * @memberof Addon#
     * @description Register a new callback on the Addon. The callback name should be formatted in snake_case
     * @param {!(string|Function)} name Callback name
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
            // eslint-disable-next-line
            name = decamelize(name);
        }

        // Register callback on Addon
        this.callbacks.set(name, callback);

        return this;
    }

    /**
     * @public
     * @function setDeprecatedAlias
     * @memberof Addon#
     * @description Register One or Many deprecated Alias for a given callback
     * @param {!string} callbackName Callback name
     * @param {string[]} alias List of alias to set for the given callback name (they will throw deprecated warning)
     * @returns {void}
     *
     * @throws {TypeError}
     * @throws {Error}
     *
     * @version 0.7.0
     *
     * @example
     * const test = new Addon("test");
     *
     * test.registerCallback("say_hello", function (head) {
     *     console.log("hello world!");
     * });
     *
     * // A warning will be throw if "log_hello" is used!
     * test.setDeprecatedAlias("say_hello", ["log_hello"]);
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
     * @function executeCallback
     * @memberof Addon#
     * @description Execute a callback of the addon
     * @param {!string} name Callback name
     * @param {CallbackHeader} [header] callback header
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
        if (this.verbose) {
            this.logger.writeLine(`Executing callback ${callbackName}`);
        }

        return (new Callback(`${this.name}-${callbackName}`, handler)).execute(header, args);
    }

    /**
     * @public
     * @function schedule
     * @memberof Addon#
     * @description Schedule the execution of a given callback (not a precision scheduler).
     * @param {!string} name Callback name
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
     * @function sendMessage
     * @memberof Addon#
     * @description Send a message to the Core
     * @param {!string} target Target path to the callback
     * @param {MessageOptions} [options={}] Message options
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
        const messageId = uuid();

        // Send a message (on the next event loop iteration).
        setImmediate(() => {
            /**
             * @event Addon#message
             * @param {string} messageId
             * @param {string} target
             * @param {Array} args
             */
            this.emit("message", messageId, target, is.array(options.args) ? options.args : []);
            if (this.verbose) {
                this.logger.writeLine(`Sending message to ${target} with uuid: ${messageId}`);
            }
        });

        // Return void 0 if noReturn is true
        if (options.noReturn) {
            return null;
        }

        // Return an Observable that stream response
        return new Observable((observer) => {
            // Setup a timeOut for our message
            const timer = setTimeout(() => {
                if (observer.closed) {
                    return;
                }
                observer.error(
                    // eslint-disable-next-line
                    `Failed to receive response for message id ${messageId} (from: ${this.name}, to: ${target}) in a delay of ${Addon.MESSAGE_TIMEOUT_MS}ms`
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

    /**
     * @public
     * @function sendOne
     * @memberof Addon#
     * @description Send "one" message to the Core (Promise version of sendMessage)
     * @param {!string} target Target path to the callback
     * @param {MessageOptions|Array<any>} [options=[]] Message options a response!
     * @returns {Promise<any>}
     *
     * @version 0.17.0
     */
    sendOne(target, options = []) {
        return new Promise((resolve, reject) => {
            if (!is.string(target)) {
                throw new TypeError("Addon.sendOne->target must be typeof <string>");
            }

            const args = is.array(options) ? { args: options } : options;
            if (!is.nullOrUndefined(args) && !is.plainObject(args)) {
                throw new TypeError("Addon.sendOne->options must be a plain Object");
            }

            this.sendMessage(target, args).subscribe(resolve, reject);
        });
    }
}

// Register Static (CONSTANTS) Addon variables...
Addon.RESERVED_CALLBACKS_NAME = new Set(["start", "stop", "event", "get_info", "health_check"]);
Addon.MESSAGE_TIMEOUT_MS = 5000;
Addon.MAIN_INTERVAL_MS = 500;
Addon.DEFAULT_HEADER = { from: "self" };
Addon.VERSION = "0.18.0";

// Subjects
Addon.Subjects = {
    Addon: Object.freeze({
        Ready: "Addon.ready"
    }),
    Alarm: Object.freeze({
        Open: "Alarm.open",
        Update: "Alarm.update",
        Close: "Alarm.close"
    }),
    Metric: Object.freeze({
        Update: "Metric.update"
    })
};

// Register Sub classes
Addon.Stream = Stream;
Addon.Callback = Callback;

// Export (default) Addon
module.exports = Addon;
