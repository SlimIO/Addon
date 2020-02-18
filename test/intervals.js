"use strict";

// Require Node.js Dependencies
const { promisify } = require("util");

// Require Third-party Dependencies
const avaTest = require("ava");

// Require Internal Dependencies
const Addon = require("../index");

// Vars
const sleep = promisify(setTimeout);

avaTest("Addon.registerInterval errors (callback must be a function)", (test) => {
    const addonEx = new Addon("intA");

    test.throws(() => {
        addonEx.registerInterval(10);
    }, { instanceOf: TypeError, message: "callback must be a function" });
});

avaTest("Register a new interval", async(test) => {
    const addonEx = new Addon("intB");
    test.true(addonEx.intervals.size === 0);

    let count = 0;
    const myCallback = () => {
        count++;
    }
    const uid = addonEx.registerInterval(myCallback);
    test.true(typeof uid === "string");
    test.true(addonEx.intervals.size === 1);
    test.true(addonEx.intervals.has(uid));

    const interval = addonEx.intervals.get(uid);
    test.is(interval.ms, 1000);
    test.is(interval.nodeTimer, null);
    test.true(interval.callback === myCallback);

    await addonEx.executeCallback("start");
    await sleep(2000);
    await addonEx.executeCallback("stop");
    test.true(addonEx.intervals.size === 0);
    test.true(count > 0);
});
