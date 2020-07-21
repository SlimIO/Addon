/* eslint-disable no-param-reassign */
"use strict";

// Require Node.js Dependencies
const { promisify } = require("util");
const { AsyncLocalStorage } = require("async_hooks");
const { EventEmitter, on } = require("events");
const assert = require("assert").strict;

// Require Third-party dependencies
const is = require("@slimio/is");
const SafeEmitter = require("@slimio/safe-emitter");
const Logger = require("@slimio/logger");
const CallbackScheduler = require("@slimio/scheduler");
const { CallbackNotFound, SlimIOError } = require("@slimio/error");
const Observable = require("zen-observable");
const uuid = require("@lukeed/uuid");
const timer = require("@slimio/timer");
const oop = require("@slimio/oop");

// Require Internal dependencie(s)
const Callback = require("./callback.class");
const Utils = require("./utils");

// CONSTANTS
const SYM_ADDON = Symbol.for("Addon");
const SYM_INTERVAL = Symbol("interval");
const SLEEP_LOCK_MS = 25;
const SYM_ADDON_MESSAGE = Symbol.for("addon.message");

const kCommunicationSymbols = Object.freeze({
    next: Symbol("next"),
    completed: Symbol("completed"),
    timeout: Symbol("timeout"),
    roundtrip: Symbol("roundtrip")
});

class Addon extends SafeEmitter {
    #storage = new AsyncLocalStorage();

    constructor(name, options = Object.create(null)) {
        super();
        const addonName = oop.toString(name);
        assert.equal(addonName.length <= 2, false, "addon name length must be greater than 2 characters!");
        const { version = "1.0.0", verbose = false, description = "" } = oop.toPlainObject(options, true);

        this.uid = uuid();
        this.name = addonName;
        this.version = oop.toString(version);
        this.verbose = Boolean(verbose);
        this.description = oop.toNullableString(description) || "";
        this.logger = null;
        this.isReady = false;
        this.isStarted = false;
        this.isAwake = false;
        this.lastStart = null;
        this.lastStop = null;
        this.currentLockedAddon = null;
        this.callbacksDescriptor = null;
        this.asserts = [];
        this.messages = new EventEmitter();
        this.messages.setMaxListeners(300);
        this[SYM_ADDON] = true;
        this.intervals = new Map();
        this.subscribers = new Map();
        this.callbacks = new Map();
        this.callbacksAlias = new Map();
        this.schedules = new Map();
        this.locks = new Map();

        this.callbacks.set("start", {
            ACL: 2, callback: Addon.start.bind(this)
        });
        this.callbacks.set("stop", {
            ACL: 2, callback: Addon.stop.bind(this)
        });
        this.callbacks.set("sleep", {
            ACL: 2, callback: Addon.sleep.bind(this)
        });
        this.callbacks.set("status", {
            ACL: 0, callback: Addon.status.bind(this)
        });
        this.callbacks.set("event", {
            ACL: 0,
            callback: async(name, data) => {
                if (this.subscribers.has(name)) {
                    for (const observer of this.subscribers.get(name)) {
                        observer.next(data);
                    }
                }
            }
        });

        this.callbacks.set("health_check", {
            ACL: 1,
            callback: async() => {
                await Promise.all(this.asserts);

                return true;
            }
        });
    }

    static isAddon(obj) {
        return obj && Boolean(obj[SYM_ADDON]);
    }

    get lastRegisteredAddon() {
        return [...this.callbacks.keys()].pop();
    }

    get callbackMetaData() {
        return this.#storage.getStore();
    }

    async awake() {
        for (const interval of this.intervals.values()) {
            if (interval.nodeTimer !== null) {
                timer.clearInterval(interval.nodeTimer);
            }

            const handler = is.asyncFunction(interval.callback) ? interval.callback : promisify(interval.callback);
            // eslint-disable-next-line
            interval.nodeTimer = timer.setInterval(() => {
                handler().catch((err) => {
                    const slimError = new SlimIOError(err.message);
                    slimError.stack = err.stack;
                    this.emit("error", slimError);
                });
            }, interval.ms);
        }

        this.isAwake = true;
        await this.emitAndWait("awake");
    }

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
        await this.waitForAllLocks(true);
        this.currentLockedAddon = null;

        // The interval is used to execute Scheduled callbacks
        // A Symbol primitive is used to make Interval private
        this[SYM_INTERVAL] = timer.setInterval(async() => {
            if (!this.isAwake) {
                return;
            }

            // Retrieve scheduled callback
            const toExecute = [...this.schedules.entries()]
                .filter(([, scheduler]) => scheduler.walk())
                .map(([name]) => this.callbacks.get(name).callback());

            // Execute all calbacks (Promise) in asynchrone
            try {
                await Promise.all(toExecute);
            }
            catch (error) {
                this.emit("error", error);
            }
        }, Addon.MAIN_INTERVAL_MS);

        this.awake();

        return true;
    }

    static async stop() {
        if (!this.isStarted) {
            return false;
        }

        if (this.isAwake) {
            this.isAwake = false;
            await this.emitAndWait("sleep");
        }

        this.isStarted = false;
        this.lastStop = Date.now();

        // Clear current addon interval
        if (typeof this[SYM_INTERVAL] === "number") {
            timer.clearInterval(this[SYM_INTERVAL]);
        }
        this.intervals.clear();

        // Complete subscribers
        for (const [subject, observers] of this.subscribers.entries()) {
            for (const observer of observers) {
                observer.complete();
            }
            this.subscribers.delete(subject);
        }

        await this.emitAndWait("stop");
        if (this.verbose) {
            this.logger.writeLine("Stop event triggered!");
        }

        return true;
    }

    async waitForAllLocks(asStart = false) {
        if (this.locks.size === 0) {
            return true;
        }

        let initialLockMs = SLEEP_LOCK_MS;
        while (1) {
            if (!this.isStarted) {
                return false;
            }

            let allReady = true;
            for (const [addonName, rules] of this.locks.entries()) {
                if (asStart && !rules.startAfter) {
                    continue;
                }

                try {
                    const res = await this.sendOne(`${addonName}.status`);

                    if (typeof res === "undefined" || Boolean(res.ready) === false) {
                        allReady = false;
                        break;
                    }
                }
                catch (err) {
                    if (this.verbose) {
                        this.logger.writeLine(`Unlock failed on addon '${addonName}', breaking for ${initialLockMs}ms`);
                    }
                    allReady = false;
                    break;
                }
                finally {
                    this.currentLockedAddon = addonName;
                }
            }

            if (allReady) {
                break;
            }

            await Utils.sleep(initialLockMs);
            if (initialLockMs < Addon.MAX_SLEEP_TIME_MS) {
                initialLockMs = Math.floor(initialLockMs * 1.5);
            }
        }

        return true;
    }

    static async sleep() {
        if (!this.isAwake) {
            return false;
        }

        // Cleanup intervals
        for (const interval of this.intervals.values()) {
            if (interval.nodeTimer !== null) {
                timer.clearInterval(interval.nodeTimer);
                interval.nodeTimer = null;
            }
        }

        this.isAwake = false;
        await this.emitAndWait("sleep");

        // Ensure every locks are okay
        const awakeAddon = await this.waitForAllLocks();
        this.currentLockedAddon = null;
        if (awakeAddon) {
            this.awake();
        }

        return true;
    }

    static status() {
        const callbacksAlias = new Map();
        for (const [alias, callbackName] of this.callbacksAlias.entries()) {
            if (callbacksAlias.has(callbackName)) {
                callbacksAlias.get(callbackName).push(alias);
            }
            else {
                callbacksAlias.set(callbackName, [alias]);
            }
        }

        const callbacks = {};
        for (const [name, { ACL }] of this.callbacks.entries()) {
            const alias = callbacksAlias.has(name) ? callbacksAlias.get(name) : [];
            callbacks[name] = { ACL, alias };
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
            currentLockedAddon: this.currentLockedAddon,
            lockOn: [...this.locks.keys()],
            callbacksDescriptor: this.callbacksDescriptor,
            callbacks
        };
    }

    lockOn(addonName, rules = Object.create(null)) {
        const { startAfter = true, lockCallback = false } = oop.toPlainObject(rules, true);

        this.locks.set(oop.toString(addonName), {
            startAfter: Boolean(startAfter),
            lockCallback: Boolean(lockCallback)
        });

        return this;
    }

    of(subjectName) {
        const subject = oop.toString(subjectName);
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
                this.once("start", 5000).then(() => publishMsg(observer)).catch(observer.error);
            }

            const index = this.subscribers.get(subject).push(observer);

            return () => {
                this.subscribers.get(subject).splice(index, 1);
            };
        });
    }

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

    setCallbacksDescriptorFile(path) {
        this.callbacksDescriptor = oop.toString(path);
    }

    setACL(callbackName, ACL = Addon.DEFAULT_ACL) {
        if (is.nullOrUndefined(callbackName)) {
            callbackName = this.lastRegisteredAddon;
        }
        callbackName = Utils.assertCallbackName(callbackName);
        if (!this.callbacks.has(callbackName)) {
            throw new Error(`Unable to found callback with name ${callbackName}`);
        }
        this.callbacks.get(callbackName).ACL = ACL;

        return this;
    }

    registerCallback(name, callback, ACL = 0) {
        if (is.func(name) && is.nullOrUndefined(callback)) {
            callback = name;
            name = callback.name;
        }

        name = Utils.assertCallbackName(name);
        if (!is.asyncFunction(callback)) {
            throw new TypeError("Addon.registerCallback->callback should be an AsyncFunction");
        }
        this.callbacks.set(name, { callback, ACL });

        return this;
    }

    setDeprecatedAlias(callbackName, alias) {
        if (!this.callbacks.has(callbackName)) {
            throw new Error(`Unknow callback with name ${callbackName}`);
        }

        for (const cbAlias of oop.toIterable(alias)) {
            this.callbacksAlias.set(cbAlias, callbackName);
        }
    }

    executeCallback(name, header = Addon.DEFAULT_HEADER, ...args) {
        let callbackName = oop.toString(name);
        foundCB: if (!this.callbacks.has(callbackName)) {
            if (!this.callbacksAlias.has(callbackName)) {
                callbackName = null;
                break foundCB;
            }
            callbackName = this.callbacksAlias.get(name);
            process.emitWarning(`Addon Callback Alias ${name} is deprecated. Please use ${callbackName}`);
        }

        if (callbackName === null) {
            throw new CallbackNotFound(name);
        }

        // Return callback execution!
        const handler = this.callbacks.get(callbackName).callback;
        if (this.verbose && this.isStarted) {
            this.logger.writeLine(`Executing callback ${callbackName}`);
        }

        return new Promise((resolve, reject) => {
            this.#storage.run(header, () => {
                // TODO: add caching of the Callback Async Rec
                (new Callback(`${this.name}-${callbackName}`, handler)).execute(args).then(resolve).catch(reject);
            });
        });
    }

    schedule(name, scheduler) {
        if (CallbackScheduler.isScheduler(name)) {
            if (this.callbacks.size <= Addon.RESERVED_CALLBACKS_NAME.size) {
                throw new Error("Addon.schedule - No custom callback has been registered yet!");
            }
            scheduler = name;
            name = this.lastRegisteredAddon;
        }

        const callbackName = oop.toString(name);
        if (!this.callbacks.has(callbackName)) {
            throw new Error(`Addon.schedule - Unable to found callback with name ${callbackName}`);
        }
        if (!CallbackScheduler.isScheduler(scheduler)) {
            throw new TypeError("Addon.schedule->scheduler should be an instance of CallbackScheduler");
        }

        this.schedules.set(name, scheduler);

        return this;
    }

    send(targetExpr) {
        const target = oop.toString(targetExpr);
        const messageId = uuid();

        // Send a message (on the next event loop iteration).
        setImmediate(() => {
            this.emit(SYM_ADDON_MESSAGE, messageId, target, is.array(options.args) ? options.args : []);
            if (this.verbose) {
                this.logger.writeLine(`Sending message to ${target} with uuid: ${messageId}`);
            }
        });
        const messages = this.messages;
        const name = this.name;

        return {
            async* toAsyncIter(options) {
                const timeout = is.number(options.timeout) ? options.timeout : Addon.MESSAGE_TIMEOUT_MS;
                const breakSymbol = kCommunicationSymbols[is.bool(options.roundtrip) ? "roundtrip" : "completed"];

                const timer = setTimeout(() => messages.emit(messageId, { kind: "timeout" }), timeout);

                for await (const { kind = kCommunicationSymbols.completed, body } of on(message, messageId)) {
                    if (kind === breakSymbol) {
                        break;
                    }

                    if (kind === kCommunicationSymbols.next) {
                        yield body;
                    }
                    else if (kind === kCommunicationSymbols.timeout) {
                        // eslint-disable-next-line
                        throw new Error(`Failed to receive response for message id ${messageId} (from: ${name}, to: ${target}) in a delay of ${timeout}ms`);
                    }
                }

                clearTimeout(timer);
            },
            async roundtrip() {
                // do nothing
            },
            async toPromise(options) {
                const response = [];

                for await (const data of this.toIter(options)) {
                    response.push(data);
                }

                return response.length === 1 ? response[0] : response;
            },
            id: () => messageId
        };
    }

    registerInterval(callback, milliseconds = 1000) {
        if (!is.func(callback)) {
            throw new TypeError("callback must be a function");
        }
        const ms = oop.toNullableNumber(milliseconds) || 1000;
        const intervalId = uuid();

        this.intervals.set(intervalId, { callback, ms, nodeTimer: null });

        return intervalId;
    }
}

// Register Static (CONSTANTS) Addon variables...
Addon.RESERVED_CALLBACKS_NAME = Utils.CONSTANTS.RESERVED_CALLBACK;
Addon.MESSAGE_TIMEOUT_MS = 5000;
Addon.MAIN_INTERVAL_MS = 500;
Addon.MAX_SLEEP_TIME_MS = 250;
Addon.DEFAULT_HEADER = { from: "self" };
Addon.ACL = Object.freeze({ read: 0, write: 1, admin: 2, super: 3 });
Addon.DEFAULT_ACL = Addon.ACL.write;
Addon.VERSION = "0.22.1";
Addon.REQUIRED_CORE_VERSION = ">=0.9";

// Subjects
Addon.Subjects = {
    ready: "Addon.ready",
    alarmOpen: "Alarm.open",
    alarmUpdate: "Alarm.update",
    alarmClose: "Alarm.close",
    micCreate: "Metric.create",
    micUpdate: "Metric.update"
};

// Export (default) Addon
module.exports = Addon;
