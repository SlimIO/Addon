"use strict";

// Require NodeJS Dependencies
const { join } = require("path");
const { readFile } = require("fs").promises;
const { promisify } = require("util");

// Require Third-party Dependencies
const avaTest = require("ava");
const is = require("@slimio/is");
const CallbackScheduler = require("@slimio/scheduler");

// Require Internal Dependencies
const Addon = require("../index");

// CONSTANTS
const DEFAULT_CALLBACKS = [...Addon.RESERVED_CALLBACKS_NAME];
const sleep = promisify(setTimeout);
const nextTick = promisify(setImmediate);

avaTest("Addon.isAddon must return true when the global Symbol is ok!", (test) => {
    const exA = new Addon("exA");
    const exB = {
        [Symbol.for("Addon")]: true
    };
    const exC = Object.create(null);

    test.true(Addon.isAddon(exA));
    test.true(Addon.isAddon(exB));
    test.false(Addon.isAddon(exC));
})

avaTest("Check Addon static CONSTANTS (type and values)", (test) => {
    test.true(is.string(Addon.REQUIRED_CORE_VERSION));
    test.true(is.number(Addon.MAIN_INTERVAL_MS));
    test.true(is.number(Addon.MESSAGE_TIMEOUT_MS));
    test.true(is.set(Addon.RESERVED_CALLBACKS_NAME));
    test.is(Addon.MAIN_INTERVAL_MS, 500);
    test.is(Addon.MESSAGE_TIMEOUT_MS, 5000);
    test.deepEqual([...Addon.RESERVED_CALLBACKS_NAME], DEFAULT_CALLBACKS);

    test.true(is.plainObject(Addon.Subjects));
    test.deepEqual(
        Object.keys(Addon.Subjects),
        ["ready", "alarmOpen", "alarmUpdate", "alarmClose", "micCreate", "micUpdate"]
    );
});

avaTest("Verify addonContainer version", async(test) => {
    const myAddon = new Addon("test01");

    const buf = await readFile(join(__dirname, "..", "package.json"));
    const { version } = JSON.parse(buf.toString());

    const info = await myAddon.executeCallback("get_info");
    test.is(version, info.containerVersion);
    test.is(version, Addon.VERSION);
});

avaTest("Verify addon initial properties types and values", async(test) => {
    const myAddon = new Addon("test02");

    test.true(is.string(myAddon.uid));
    test.is(myAddon.name, "test02");
    test.is(myAddon.lastStart, null);
    test.is(myAddon.lastStop, null);
    test.false(myAddon.verbose);
    test.is(myAddon.version, "1.0.0");
    test.false(myAddon.isAwake);
    test.false(myAddon.isStarted);
    test.true(is.array(myAddon.asserts));
    test.deepEqual(myAddon.asserts, []);
    test.true(is.map(myAddon.callbacks));
    test.is(myAddon.callbacks.size, DEFAULT_CALLBACKS.length);
    test.true(is.map(myAddon.schedules));
    test.true(myAddon.schedules.size === 0);
    test.true(is.map(myAddon.observers));
    test.true(myAddon.observers.size === 0);

    await myAddon.executeCallback("start");
    test.true(is.number(myAddon.lastStart));
    test.is(myAddon.lastStop, null);
    await myAddon.executeCallback("stop");
    test.true(is.number(myAddon.lastStop));
});

avaTest("Verify addon initial native callbacks", (test) => {
    const myAddon = new Addon("test03");
    for (const callbackName of DEFAULT_CALLBACKS) {
        test.true(myAddon.callbacks.has(callbackName));
    }
});

avaTest("Addon.registerCallback->name should be typeof <string>", (test) => {
    const myAddon = new Addon("test04");

    test.throws(() => {
        myAddon.registerCallback(5);
    }, { instanceOf: TypeError, message: "Addon.registerCallback->name should be typeof <string>" });
});

avaTest("Addon.registerCallback->callback should be an AsyncFunction", (test) => {
    const myAddon = new Addon("test05");

    test.throws(() => {
        myAddon.registerCallback("test", () => {});
    }, { instanceOf: TypeError, message: "Addon.registerCallback->callback should be an AsyncFunction" });
});

avaTest("Addon.registerCallback - Callback name 'start' is a reserved callback name!", (test) => {
    const myAddon = new Addon("test06");

    test.throws(() => {
        myAddon.registerCallback("start", async() => {});
    }, { instanceOf: Error, message: "Addon.registerCallback - Callback name 'start' is a reserved callback name!" });
});

avaTest("Addon register camelcase callback", (test) => {
    const myAddon = new Addon("test07");

    myAddon.registerCallback(async function getWorld() {
        return 10;
    });
    test.is(myAddon.callbacks.has("get_world"), true);
});

avaTest("Addon executeCallback (throw errors)", (test) => {
    const myAddon = new Addon("test08");

    // Invalid callback name type
    test.throws(() => {
        myAddon.executeCallback(5);
    }, { instanceOf: TypeError, message: "Addon.executeCallback->name should be typeof <string>" });

    // Invalid callback name type
    test.throws(() => {
        myAddon.executeCallback("unknow");
    }, { instanceOf: Error, message: "Addon.executeCallback - Unable to found callback with name unknow" });
});

avaTest("Addon schedule (throw errors)", (test) => {
    const myAddon = new Addon("test09");

    // Invalid callback name type
    test.throws(() => {
        myAddon.schedule(5);
    }, { instanceOf: TypeError, message: "Addon.schedule->name should be typeof <string>" });

    // Invalid callback name type
    test.throws(() => {
        myAddon.schedule("unknow");
    }, { instanceOf: Error, message: "Addon.schedule - Unable to found callback with name unknow" });

    myAddon.registerCallback("test", async() => {
        return { ok: 1 };
    });
    test.throws(() => {
        myAddon.schedule("test", "");
    }, { instanceOf: TypeError, message: "Addon.schedule->scheduler should be an instance of CallbackScheduler" });
});

avaTest("Addon schedule on latest callback registered (Throw error)", async(test) => {
    const myAddon = new Addon("test10");

    // Invalid callback name type
    test.throws(() => {
        myAddon.schedule(new CallbackScheduler());
    }, { instanceOf: Error, message: "Addon.schedule - No custom callback has been registered yet!" });
});

avaTest("Addon schedule on latest callback registered", async(test) => {
    const myAddon = new Addon("test11");
    const scheduler = new CallbackScheduler({
        interval: 1,
        executeOnStart: true
    });

    // Register and Schedule callback
    let executionTime = 0;
    myAddon.registerCallback(async function test() {
        // Increment 1 at each execution!
        executionTime++;
    }).schedule(scheduler);

    await myAddon.executeCallback("start");
    await sleep(2100);
    test.is(executionTime, 2);
    await myAddon.executeCallback("stop");
});

avaTest("Create Addon with given version", async(test) => {
    const myAddon = new Addon("test12", {
        version: "2.0.0"
    });

    const info = await myAddon.executeCallback("get_info");
    test.is(info.version, "2.0.0");
});

avaTest("Addon execute native get_info callback", async(test) => {
    const myAddon = new Addon("test13");

    const info = await myAddon.executeCallback("get_info");
    test.deepEqual(Object.keys(info), [
        "uid", "name", "version", "description", "containerVersion",
        "ready", "started", "awake", "lastStart", "lastStop", "currentLockedAddon",
        "lockOn", "callbacksDescriptor", "callbacks", "callbacksAlias"
    ]);
    test.is(info.uid, myAddon.uid);
    test.is(info.name, myAddon.name);
    test.is(info.description, "");
    test.true(is.string(info.version));
    test.is(info.version, "1.0.0");
    test.is(info.version, myAddon.version);
    test.is(info.containerVersion, Addon.VERSION);
    test.false(info.started);
    test.deepEqual(info.callbacks.sort(), DEFAULT_CALLBACKS.slice(0).sort());
    test.is(info.lastStart, null);
    test.is(info.lastStop, null);
    test.true(is.plainObject(info.callbacksAlias));
});

avaTest("Addon register & execute a custom callback", async(test) => {
    const myAddon = new Addon("test14");

    // Register callback
    myAddon.registerCallback("test", async(header, arg1) => {
        return { ok: 1, arg: arg1 };
    });
    test.true(myAddon.callbacks.has("test"));

    // Execute callback
    const payload = [1, 2, 3];
    const { ok, arg } = await myAddon.executeCallback("test", void 0, payload);
    test.is(ok, 1);
    test.deepEqual(arg, payload);
});

avaTest("Addon register & execute a custom callback (registered without direct name)", async(test) => {
    const myAddon = new Addon("test15");

    // Register callback
    myAddon.registerCallback(async function hello() {
        return "hello world!";
    });
    test.true(myAddon.callbacks.has("hello"));

    // Execute callback
    const ret = await myAddon.executeCallback("hello");
    test.is(ret, "hello world!");
});

avaTest("Addon send a message with an invalid target name", async(test) => {
    const myAddon = new Addon("test16");

    test.throws(() => {
        myAddon.sendMessage(5);
    }, { instanceOf: TypeError, message: "Addon.sendMessage->target should be typeof <string>" });
});

avaTest("Addon send a message (Expect no return value)", async(test) => {
    test.plan(3);
    const myAddon = new Addon("test17");

    // Mock a listener
    myAddon.on("message", (messageId) => {
        if (!myAddon.observers.has(messageId)) {
            return;
        }
        setImmediate(() => {
            test.pass();
            myAddon.observers.get(messageId).next();
        });
    });

    await new Promise((resolve, reject) => {
        myAddon.sendMessage("any").subscribe(() => {
            test.pass();
            resolve();
        }, reject);
    });

    // Dont expect to get a value!
    const ret = myAddon.sendMessage("any", { noReturn: true });
    test.true(is.nullOrUndefined(ret));
});

avaTest("Addon send a message and timeout", async(test) => {
    test.plan(2);
    const myAddon = new Addon("test18");

    await new Promise((resolve) => {
        myAddon.sendMessage("any", { timeout: 500, args: [] }).subscribe(
            () => {},
            (error) => {
                test.is(is.string(error), true);
                resolve();
            }
        );
    });
    test.true(myAddon.observers.size === 0);
});

avaTest("Trigger 'start' and 'stop' callbacks", async(test) => {
    const myAddon = new Addon("test19");
    test.false(myAddon.isStarted);
    let success;

    // Start addon
    success = await myAddon.executeCallback("start");
    test.true(myAddon.isStarted);
    test.true(success);
    success = await myAddon.executeCallback("start");
    test.false(success);

    // Sleep for 100ms
    await sleep(100);

    // Stop addon
    success = await myAddon.executeCallback("stop");
    test.true(success);
    test.false(myAddon.isStarted);
    success = await myAddon.executeCallback("stop");
    test.false(success);
});

avaTest("Addon schedule a custom callback by his name", async(test) => {
    const myAddon = new Addon("test20");
    let count = 0;

    // Register "test" callback
    myAddon.registerCallback("test", async() => {
        count++;
    });

    // Schedule "test" callback
    myAddon.schedule("test", new CallbackScheduler({
        interval: 500,
        executeOnStart: true,
        intervalUnitType: CallbackScheduler.Types.Milliseconds
    }));

    // Start / test and stop addon
    await myAddon.executeCallback("start");
    await sleep(2050);
    await myAddon.executeCallback("stop");

    test.true(count >= 2);
});

avaTest("Addon health_check assert (throw)", async(test) => {
    const myAddon = new Addon("test21");

    myAddon.asserts.push(new Promise((resolve, reject) => {
        reject(new Error("oopps!"));
    }));

    await test.throwsAsync(myAddon.executeCallback("health_check"), { instanceOf: Error, message: "oopps!" });
});

avaTest("Addon health_check assert (ok)", async(test) => {
    const myAddon = new Addon("test22");

    const ret = await myAddon.executeCallback("health_check");
    test.is(ret, true);
});

avaTest("Set Addon ready", async(test) => {
    test.plan(4);
    const myAddon = new Addon("test23");

    myAddon.on("message", (msgId) => {
        const obs = myAddon.observers.get(msgId);

        obs.next();
        obs.complete();
    });

    myAddon.once("ready", 500).then(() => {
        test.pass();
    });

    myAddon.once("start", 500).then(async() => {
        const ret = await myAddon.ready();
        test.true(ret);
        const ret2 = await myAddon.ready();
        test.false(ret2);
    });

    await myAddon.executeCallback("start");
    await sleep(50);
    await myAddon.executeCallback("stop");
    await sleep(500);
    test.false(myAddon.isReady);
});

avaTest("Set Addon ready before Addon was started (should throw an Error)", async(test) => {
    const myAddon = new Addon("test24");

    await test.throwsAsync(async() => {
        await myAddon.ready();
    }, { instanceOf: Error, message: "Addon should be started before being ready!" });
});

avaTest("setDeprecatedAlias (no callback registered with the name)", (test) => {
    const myAddon = new Addon("test25");

    test.throws(() => {
        myAddon.setDeprecatedAlias("foo");
    }, { instanceOf: Error, message: "Unknow callback with name foo" });
});

avaTest("setDeprecatedAlias (alias should be instanceof Array)", (test) => {
    const myAddon = new Addon("test26");
    myAddon.registerCallback("foo", async function foo() {
        console.log("foo!");
    });

    test.throws(() => {
        myAddon.setDeprecatedAlias("foo", 5);
    }, { instanceOf: TypeError, message: "alias argument should be instanceof Array" });
});

avaTest("setDeprecatedAlias (Trigger callback with an alias!)", async(test) => {
    test.plan(4);
    const myAddon = new Addon("test27");
    myAddon.registerCallback("foo", async function foo() {
        return 10;
    });
    process.on("warning", (warn) => {
        if (warn.message === "Addon Callback Alias foo_old is deprecated. Please use foo") {
            test.pass();
        }
    });

    myAddon.setDeprecatedAlias("foo", ["foo_old"]);
    const ret = await myAddon.executeCallback("foo_old");
    test.is(ret, 10);
    await new Promise((resolve) => setImmediate(resolve));

    const info = await myAddon.executeCallback("get_info");
    test.true(Reflect.has(info.callbacksAlias, "foo"));
    test.deepEqual(info.callbacksAlias.foo, ["foo_old"]);
});

avaTest("setCallbacksDescriptor (path should be typeof string)", async(test) => {
    const myAddon = new Addon("test28");
    test.throws(() => {
        myAddon.setCallbacksDescriptorFile(null);
    }, { instanceOf: TypeError, message: "path should be typeof string!" });
});

avaTest("setCallbacksDescriptor (path should be a .prototype file)", async(test) => {
    const myAddon = new Addon("test29");
    test.throws(() => {
        myAddon.setCallbacksDescriptorFile(join(__dirname, "yo"));
    }, { instanceOf: Error, message: "path should be a .prototype file" });
});

avaTest("setCallbacksDescriptor", async(test) => {
    const myAddon = new Addon("test30");
    {
        const { callbacksDescriptor } = await myAddon.executeCallback("get_info");
        test.is(callbacksDescriptor, null);
    }
    const path = join(__dirname, "callbacks.proto");
    myAddon.setCallbacksDescriptorFile(path);
    const { callbacksDescriptor } = await myAddon.executeCallback("get_info");
    test.is(callbacksDescriptor, path);
});

avaTest("Addon of(subject) should be a string", async(test) => {
    const myAddon = new Addon("test31");

    test.throws(() => {
        myAddon.of(10);
    }, { instanceOf: TypeError, message: "subject should be typeof string" });
});

avaTest("Scheduled callback to throw Error!", async(test) => {
    test.plan(1);
    const myAddon = new Addon("test32");
    myAddon.on("error", (error) => {
        test.is(error.message, "oops!");
    });

    myAddon.registerCallback("test", async() => {
        throw new Error("oops!");
    });

    // Schedule "test" callback
    myAddon.schedule("test", new CallbackScheduler({
        interval: 1000,
        executeOnStart: true,
        intervalUnitType: CallbackScheduler.Types.Milliseconds
    }));

    await myAddon.executeCallback("start");
    await sleep(1100);
    await myAddon.executeCallback("stop");
});

avaTest("Addon Native Event", async(test) => {
    test.plan(2);
    const myAddon = new Addon("test33");
    myAddon.on("message", (msgId) => {
        const obs = myAddon.observers.get(msgId);
        obs.next(undefined);
        obs.complete();
    });

    // Subscribe before start
    myAddon.of("any").subscribe(() => {
        test.pass();
    });

    await myAddon.executeCallback("start");

    // Subscribe after start
    myAddon.of("any").subscribe(() => {
        test.pass();
    });

    await myAddon.executeCallback("event", void 0, "any");
    await myAddon.executeCallback("event", void 0, "unknown");

    await new Promise((resolve) => setTimeout(resolve, 10));
    await myAddon.executeCallback("stop");
});

avaTest("Addon Callback Header", async(test) => {
    test.plan(2);
    const myAddon = new Addon("test34");

    // eslint-disable-next-line
    myAddon.registerCallback(async function cb_test(header) {
        test.is(header.from, "self");
    });

    // eslint-disable-next-line
    myAddon.registerCallback(async function cb_custom(header) {
        test.is(header.from, "custom");
    });

    await Promise.all([
        myAddon.executeCallback("cb_test", void 0),
        myAddon.executeCallback("cb_custom", { from: "custom" })
    ]);
});

avaTest("Test Addon Streaming Class", async(test) => {
    test.plan(2);
    const wS = new Addon.Stream();
    setTimeout(() => {
        wS.write("hello");
    }, 100);
    setTimeout(() => {
        wS.write("world!");
        wS.end();
    }, 200);

    wS.on("data", () => {
        test.pass();
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
});

avaTest("Run a verbose test", async(test) => {
    test.plan(1);
    const myAddon = new Addon("test35", {
        verbose: true
    });

    // eslint-disable-next-line
    myAddon.registerCallback(async function cb_test(header) {
        test.pass();
    });

    await myAddon.executeCallback("start");
    await myAddon.executeCallback("cb_test", void 0);
    await myAddon.executeCallback("stop");
});

avaTest("lockOn: addonName must be typeof String", async(test) => {
    const myAddon = new Addon("test36");

    test.throws(() => {
        myAddon.lockOn(10);
    }, { instanceOf: TypeError, message: "addonName must be a string" });
});

avaTest("lockOn: rules.startAfter must be a boolean", async(test) => {
    const myAddon = new Addon("test37");

    test.throws(() => {
        myAddon.lockOn("zbla", { startAfter: 10 });
    }, { instanceOf: TypeError, message: "rules.startAfter must be a boolean" });
});

avaTest("lockOn: rules.lockCallback must be a boolean", async(test) => {
    const myAddon = new Addon("test38");

    test.throws(() => {
        myAddon.lockOn("zbla", { lockCallback: 10 });
    }, { instanceOf: TypeError, message: "rules.lockCallback must be a boolean" });
});

avaTest("lockOn: emulate fake lock", async(test) => {
    let tick = 0;
    test.plan(2);
    const emulateLock = new Addon("emulateLock");
    emulateLock.on("message", (id, target) => {
        // console.log(`id: ${id}, target: ${target}`);
        if (target === "test.get_info") {
            test.pass();
            const observer = emulateLock.observers.get(id);
            if (tick === 0) {
                observer.next(undefined);
                observer.complete();
                tick++;
            }
            else {
                observer.next({ ready: true });
                observer.complete();
            }
        }
    });
    emulateLock.lockOn("zblouh", { startAfter: false });
    emulateLock.lockOn("test");

    await emulateLock.executeCallback("start");
    await emulateLock.executeCallback("stop");
});

avaTest("sendOne (target must be a string)", async(test) => {
    const myAddon = new Addon("test39");

    await test.throwsAsync(myAddon.sendOne(10), {
        message: "Addon.sendOne->target must be typeof <string>",
        instanceOf: TypeError
    });
});

avaTest("sendOne (options must be a plain Object)", async(test) => {
    const myAddon = new Addon("test40");

    await test.throwsAsync(myAddon.sendOne("any", 10), {
        message: "Addon.sendOne->options must be a plain Object",
        instanceOf: TypeError
    });
});

avaTest("sendOne (catch message)", async(test) => {
    test.plan(2);
    const myAddon = new Addon("test41");

    myAddon.on("message", (messageId) => {
        if (!myAddon.observers.has(messageId)) {
            return;
        }
        setImmediate(() => {
            test.pass();
            myAddon.observers.get(messageId).next("hello");
        });
    });

    const result = await myAddon.sendOne("any");
    test.is(result, "hello");
});

avaTest("sendOne (catch error)", async(test) => {
    test.plan(2);
    const myAddon = new Addon("test42");

    myAddon.on("message", (messageId) => {
        if (!myAddon.observers.has(messageId)) {
            return;
        }
        setImmediate(() => {
            test.pass();
            myAddon.observers.get(messageId).error(new Error("oh no!"));
        });
    });

    await test.throwsAsync(myAddon.sendOne("any"), {
        message: "oh no!",
        instanceOf: Error
    });
});

avaTest("trigger native sleep callback", async(test) => {
    test.plan(10);
    const myAddon = new Addon("test43").lockOn("events");
    let count = 0;
    myAddon.on("start", () => {
        myAddon.registerInterval(() => (count++), 50);
    });

    myAddon.on("awake", () => test.pass()); // triggered 2 times
    myAddon.on("sleep", () => test.pass()); // triggered 2 times
    myAddon.on("message", async(id, target) => { // triggered 2 times
        test.pass();

        await sleep(50);
        const observer = myAddon.observers.get(id);
        observer.next({ ready: true });
        observer.complete();
    });

    const isAwake = await myAddon.executeCallback("sleep");
    test.false(isAwake);
    await myAddon.executeCallback("start");

    await sleep(200);
    const isResumed = await myAddon.executeCallback("sleep");
    test.true(isResumed);
    test.true(myAddon.isAwake);
    test.true(count > 0);

    await myAddon.executeCallback("stop");
});
