/* eslint require-await: off */
/* eslint no-empty-function: off */

// Require Third-party Dependencies
const avaTest = require("ava");
const is = require("@slimio/is");

// Require Internal Depedencies
const Addon = require("../index");
const CallbackScheduler = require("@slimio/scheduler");

/**
 * @function sleep
 * @param {!Number} [ms=0] millisecond to sleep
 * @returns {Promise<void>}
 */
function sleep(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// CONSTANTS
const DEFAULT_CALLBACKS = ["start", "stop", "get_info", "health_check"];

avaTest("Check Addon static CONSTANTS (type and values)", (test) => {
    test.true(is.number(Addon.MAIN_INTERVAL_MS));
    test.true(is.number(Addon.MESSAGE_TIMEOUT_MS));
    test.true(is.set(Addon.RESERVED_CALLBACKS_NAME));
    test.is(Addon.MAIN_INTERVAL_MS, 500);
    test.is(Addon.MESSAGE_TIMEOUT_MS, 5000);
    test.deepEqual([...Addon.RESERVED_CALLBACKS_NAME], DEFAULT_CALLBACKS);
});

avaTest("Addon constructor throw a typeError if name is not a string", (test) => {
    const error = test.throws(() => {
        new Addon(void 0);
    }, TypeError);
    test.is(error.message, "constructor name argument should be typeof string");
});

avaTest("Addon constructor throw an Error if name length is less or equal 2", (test) => {
    const error = test.throws(() => {
        new Addon("de");
    }, Error);
    test.is(error.message, "constructor name argument length must be greater than 2");
});

avaTest("Verify addon initial properties types and values", (test) => {
    const myAddon = new Addon("myAddon");

    test.true(is.string(myAddon.uid));
    test.is(myAddon.name, "myAddon");
    test.false(myAddon.isStarted);
    test.true(is.set(myAddon.flags));
    test.true(myAddon.flags.size === 0);
    test.true(is.array(myAddon.asserts));
    test.deepEqual(myAddon.asserts, []);
    test.true(is.map(myAddon.callbacks));
    test.is(myAddon.callbacks.size, DEFAULT_CALLBACKS.length);
    test.true(is.map(myAddon.schedules));
    test.true(myAddon.schedules.size === 0);
    test.true(is.map(myAddon.observers));
    test.true(myAddon.observers.size === 0);
});

avaTest("Verify addon initial native callbacks", (test) => {
    const myAddon = new Addon("myAddon");
    for (const callbackName of DEFAULT_CALLBACKS) {
        test.true(myAddon.callbacks.has(callbackName));
    }
});

avaTest("Addon.registerCallback->name should be typeof <string>", (test) => {
    const myAddon = new Addon("myAddon");

    const error = test.throws(() => {
        myAddon.registerCallback(5);
    }, TypeError);
    test.is(error.message, "Addon.registerCallback->name should be typeof <string>");
});

avaTest("Addon.registerCallback->callback should be an AsyncFunction", (test) => {
    const myAddon = new Addon("myAddon");

    const error = test.throws(() => {
        myAddon.registerCallback("test", () => {});
    }, TypeError);
    test.is(error.message, "Addon.registerCallback->callback should be an AsyncFunction");
});

avaTest("Addon.registerCallback - Callback name 'start' is a reserved callback name!", (test) => {
    const myAddon = new Addon("myAddon");

    const error = test.throws(() => {
        myAddon.registerCallback("start", async() => {});
    }, Error);
    test.is(error.message, "Addon.registerCallback - Callback name 'start' is a reserved callback name!");
});

avaTest("Addon.registerCallback->name typo should be formated in snake_case", (test) => {
    const myAddon = new Addon("myAddon");

    const error = test.throws(() => {
        myAddon.registerCallback("snakeCase", async() => {});
    }, Error);
    test.is(error.message, "Addon.registerCallback->name typo should be formated in snake_case");
});

avaTest("Addon executeCallback (throw errors)", (test) => {
    const myAddon = new Addon("myAddon");

    // Invalid callback name type
    const invalidCallbackName = test.throws(() => {
        myAddon.executeCallback(5);
    }, TypeError);
    test.is(invalidCallbackName.message, "Addon.executeCallback->name should be typeof <string>");

    // Invalid callback name type
    const unknowCallback = test.throws(() => {
        myAddon.executeCallback("unknow");
    }, Error);
    test.is(unknowCallback.message, "Addon.executeCallback - Unable to found callback with name unknow");
});

avaTest("Addon schedule (throw errors)", (test) => {
    const myAddon = new Addon("myAddon");

    // Invalid callback name type
    const invalidCallbackName = test.throws(() => {
        myAddon.schedule(5);
    }, TypeError);
    test.is(invalidCallbackName.message, "Addon.schedule->name should be typeof <string>");

    // Invalid callback name type
    const unknowCallback = test.throws(() => {
        myAddon.schedule("unknow");
    }, Error);
    test.is(unknowCallback.message, "Addon.schedule - Unable to found callback with name unknow");

    myAddon.registerCallback("test", async() => {
        return { ok: 1 };
    });
    const invalidScheduler = test.throws(() => {
        myAddon.schedule("test", new String());
    }, TypeError);
    test.is(
        invalidScheduler.message,
        "Addon.schedule->scheduler should be an instance of CallbackScheduler"
    );
});

avaTest("Addon schedule on latest callback registered (Throw error)", async(test) => {
    const myAddon = new Addon("myAddon");

    // Invalid callback name type
    const noCallback = test.throws(() => {
        myAddon.schedule(new CallbackScheduler());
    }, Error);
    test.is(noCallback.message, "Addon.schedule - No custom callback has been registered yet!");
});

avaTest("Addon schedule on latest callback registered", async(test) => {
    const myAddon = new Addon("myAddon");
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

    myAddon.executeCallback("start");
    await sleep(2100);
    test.is(executionTime, 2);
    await myAddon.executeCallback("stop");
});

avaTest("Addon execute native get_info callback", async(test) => {
    const myAddon = new Addon("myAddon");

    const info = await myAddon.executeCallback("get_info");
    test.is(info.uid, myAddon.uid);
    test.is(info.name, myAddon.name);
    test.false(info.started);
    test.deepEqual(info.callbacks, DEFAULT_CALLBACKS);
    test.deepEqual(info.flags, []);
});

avaTest("Addon register & execute a custom callback", async(test) => {
    const myAddon = new Addon("myAddon");

    // Register callback
    myAddon.registerCallback("test", async(arg1) => {
        return { ok: 1, arg: arg1 };
    });
    test.true(myAddon.callbacks.has("test"));

    // Execute callback
    const payload = [1, 2, 3];
    const { ok, arg } = await myAddon.executeCallback("test", payload);
    test.is(ok, 1);
    test.deepEqual(arg, payload);
});

avaTest("Addon register & execute a custom callback (registered without direct name)", async(test) => {
    const myAddon = new Addon("myAddon");

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
    const myAddon = new Addon("myAddon");

    const invalidTargetName = test.throws(() => {
        myAddon.sendMessage(5);
    }, TypeError);
    test.is(invalidTargetName.message, "Addon.sendMessage->target should be typeof <string>");
});

avaTest("Addon send a message (Expect no return value)", async(test) => {
    test.plan(3);
    const myAddon = new Addon("myAddon");

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
    const myAddon = new Addon("myAddon");

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
    const myAddon = new Addon("myAddon");
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
    const myAddon = new Addon("myAddon");
    let executionTime = 0;

    // Register "test" callback
    myAddon.registerCallback("test", async() => {
        executionTime++;
    });

    // Schedule "test" callback
    myAddon.schedule("test", new CallbackScheduler({
        interval: 500,
        executeOnStart: true,
        intervalUnitType: CallbackScheduler.Types.Milliseconds
    }));

    // Start / test and stop addon
    await myAddon.executeCallback("start");
    await sleep(2100);
    test.true(executionTime >= 3);
    await myAddon.executeCallback("stop");
});

avaTest("Addon health_check assert (throw)", async(test) => {
    const myAddon = new Addon("myAddon");

    myAddon.asserts.push(new Promise((resolve, reject) => {
        reject(new Error("oopps!"));
    }));

    const error = await test.throws(myAddon.executeCallback("health_check"), Error);
    test.is(error.message, "oopps!");
});

avaTest("Addon health_check assert (ok)", async(test) => {
    const myAddon = new Addon("myAddon");

    const ret = await myAddon.executeCallback("health_check");
    test.is(ret, true);
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
