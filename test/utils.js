"use strict";

// Require Third-party Dependencies
const avaTest = require("ava");
const is = require("@slimio/is");

// Require Internal Dependencies
const utils = require("../src/utils");

avaTest("src/utils.js must export a plainObject with the right methods", (test) => {
    test.is(is.plainObject(utils), true);
    test.deepEqual(Object.keys(utils), ["decamelize", "assertCallbackName", "CONSTANTS"]);
    test.true(Object.isFrozen(utils.CONSTANTS));
});

avaTest("decamelize('sayHello') should return 'say_hello'", (test) => {
    const ret = utils.decamelize("sayHello");
    test.is(ret, "say_hello");
});
