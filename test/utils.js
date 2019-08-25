"use strict";

// Require Third-party Dependencies
const avaTest = require("ava");
const is = require("@slimio/is");

// Require Internal Dependencies
const utils = require("../src/utils");

avaTest("src/utils.js must export a plainObject with the right methods", (test) => {
    test.is(is.plainObject(utils), true);
    test.deepEqual(Object.keys(utils), ["decamelize"]);
});

avaTest("decamelize should throw a TypeError if text arg is not a string primitive", (test) => {
    test.throws(() => {
        utils.decamelize(10);
    }, { instanceOf: TypeError, message: "text must be a string" });
});

avaTest("decamelize('sayHello') should return 'say_hello'", (test) => {
    const ret = utils.decamelize("sayHello");
    test.is(ret, "say_hello");
});
