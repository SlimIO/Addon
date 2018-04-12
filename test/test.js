/* eslint no-new: off */
/* eslint require-await: off */
/* eslint no-empty-function: off */

// Require dependencies
const avaTest = require("ava");
const is = require("@sindresorhus/is");
const Addon = require("../index");
const { taggedString } = require("@slimio/utils");
const CallbackScheduler = require("@slimio/scheduler");

// Require Errors
const ERRORS = require("../src/errors.json");
for (const [key, value] of Object.entries(ERRORS)) {
    Reflect.set(ERRORS, key, taggedString`${value}`);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms) );
}

/**
 * Addon default static variables types
 */
avaTest("Addon default static variables types", (test) => {
    test.is(is.number(Addon.mainIntervalMs), true);
    test.is(is.number(Addon.messageTimeOutMs), true);
    test.is(is.set(Addon.ReservedCallbacksName), true);
});

/**
 * Addon default variables values
 */
avaTest("Addon default variables values", (test) => {
    const myAddon = new Addon("myAddon");

    test.is(is.string(myAddon.uid), true);
    test.is(myAddon.name, "myAddon");
    test.is(myAddon.multipleRunAllowed, false);
    test.is(myAddon.shadowRunAllowed, false);
    test.is(myAddon.isStarted, false);
    test.is(myAddon.isConnected, false);
    test.is(is.map(myAddon.callbacks), true);
    test.is(is.map(myAddon.schedules), true);
    test.is(is.map(myAddon.observers), true);

    // Verify native callbacks
    test.is(myAddon.callbacks.has("start"), true);
    test.is(myAddon.callbacks.has("stop"), true);
    test.is(myAddon.callbacks.has("get_info"), true);
});

/**
 * Addon registerCallback (throw)
 */
avaTest("Addon registerCallback (throw)", (test) => {
    const myAddon = new Addon("myAddon");

    // Invalid callback name type
    const invalidCallbackName = test.throws(() => {
        myAddon.registerCallback(5);
    }, TypeError);
    test.is(invalidCallbackName.message, "Addon.registerCallback->name should be typeof <string>");

    // Invalid callback handle type
    const invalidCallbackType = test.throws(() => {
        myAddon.registerCallback("test", () => {});
    }, TypeError);
    test.is(
        invalidCallbackType.message,
        "Addon.registerCallback->callback should be an AsyncFunction"
    );

    // Unallowed (reserved) callback name!
    const unallowedCallbackName = test.throws(() => {
        myAddon.registerCallback("start", async() => {});
    }, Error);
    test.is(unallowedCallbackName.message, ERRORS.unallowedCallbackName("start"));

    // Unallowed (reserved) callback name!
    const snakeCase = test.throws(() => {
        myAddon.registerCallback("snakeCase", async() => {});
    }, Error);
    test.is(
        snakeCase.message,
        "Addon.registerCallback->name typo should be formated in snake_case"
    );
});

/**
 * Addon executeCallback (throw)
 */
avaTest("Addon executeCallback (throw)", (test) => {
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
    test.is(unknowCallback.message, ERRORS.unableToFoundCallback("unknow"));
});

/**
 * Addon schedule (throw)
 */
avaTest("Addon schedule (throw)", (test) => {
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
    test.is(unknowCallback.message, ERRORS.unableToFoundCallback("unknow"));

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

/**
 * Addon register & execute a callback
 */
avaTest("Addon register & execute a callback", async(test) => {
    const myAddon = new Addon("myAddon");

    // Register callback
    myAddon.registerCallback("test", async(arg1) => {
        return { ok: 1, arg: arg1 };
    });
    test.is(myAddon.callbacks.has("test"), true);

    // Execute callback
    const payload = [1, 2, 3];
    const { ok, arg } = await myAddon.executeCallback("test", payload);
    test.is(ok, 1);
    test.deepEqual(arg, payload);

    // Execute get_info callback
    const info = await myAddon.executeCallback("get_info");
    test.is(info.uid, myAddon.uid);
    test.is(info.name, myAddon.name);
    test.is(info.started, false);
    test.deepEqual(info.callbacks, myAddon.callbacks.keys());
});

/**
 * Addon send a message
 */
avaTest("Addon send a message", async(test) => {
    const myAddon = new Addon("myAddon");

    // Invalid callback name type
    const invalidTargetName = test.throws(() => {
        myAddon.sendMessage(5);
    }, TypeError);
    test.is(invalidTargetName.message, "Addon.sendMessage->target should be typeof <string>");

    // Bind a "fake" message receiver that re-send hello world as response!
    myAddon.on("message", (messageId) => {
        if (!myAddon.observers.has(messageId)) {
            return;
        }
        setImmediate(() => {
            myAddon.observers.get(messageId).next("hello world!");
        });
    });

    await new Promise((resolve) => {
        myAddon.sendMessage("any", void 0, false).subscribe((res) => {
            test.is(res, "hello world!");
            resolve();
        });

        // Dont expect return value!
        const ret = myAddon.sendMessage("any", void 0, true);
        test.is(is.nullOrUndefined(ret), true);
    });
});

/**
 * Addon send a message and timeout
 */
avaTest("Addon send a message and timeout", async(test) => {
    const myAddon = new Addon("myAddon");
    myAddon.on("message", () => {});

    await new Promise((resolve) => {
        myAddon.sendMessage("any", { timeout: 500, args: [] }, false).subscribe(
            () => {},
            (error) => {
                test.is(is.string(error), true);
                resolve();
            }
        );
    });
    test.is(myAddon.observers.size, 0);
});

/**
 * Addon start and stop addon
 * TODO: Complete tests
 */
avaTest("Addon start and stop addon", async(test) => {
    const myAddon = new Addon("myAddon");
    test.is(myAddon.isStarted, false);

    await myAddon.executeCallback("start");
    test.is(myAddon.isStarted, true);
    await myAddon.executeCallback("start");
    await sleep(2000);
    await myAddon.executeCallback("stop");
    test.is(myAddon.isStarted, false);
    await myAddon.executeCallback("stop");
});

/**
 * Addon start and schedule callback
 */
avaTest("Addon start and schedule callback", async(test) => {
    const myAddon = new Addon("myAddon");
    test.is(myAddon.isStarted, false);

    // Register and schedule callback
    let executionTime = 0;
    myAddon.registerCallback("test", async() => {
        executionTime++;
    }).schedule("test", new CallbackScheduler({ interval: 2 }));

    // Start / test and stop addon
    await myAddon.executeCallback("start");
    await sleep(4000);
    test.is(executionTime, 1);
    await myAddon.executeCallback("stop");
    test.pass();
});
