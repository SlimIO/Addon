"use strict";

// Require Third-party Dependencies
const avaTest = require("ava");
const is = require("@slimio/is");

// Require Internal Depedencies
const Addon = require("../index");

avaTest("Addon constructor throw a typeError if name is not a string", (test) => {
    test.throws(() => {
        new Addon(void 0);
    }, { instanceOf: TypeError, message: "constructor name argument should be typeof string" });
});

avaTest("Addon constructor throw a typeError if version is not a string", (test) => {
    test.throws(() => {
        new Addon("cpu", { version: 10 });
    }, { instanceOf: TypeError, message: "version argument should be typeof string" });
});

avaTest("Addon constructor throw a typeError if verbose is not a boolean", (test) => {
    test.throws(() => {
        new Addon("cpu", { verbose: 10 });
    }, { instanceOf: TypeError, message: "verbose argument should be typeof boolean" });
});

avaTest("Addon constructor throw a typeError if verbose is not a boolean", (test) => {
    test.throws(() => {
        new Addon("cpu", { description: 10 });
    }, { instanceOf: TypeError, message: "description argument should be typeof string" });
});

avaTest("Addon constructor throw a typeError if options is not a plain Object", (test) => {
    test.throws(() => {
        new Addon("cpu", Symbol("hello"));
    }, { instanceOf: TypeError, message: "options should be a plainObject" });
});

avaTest("Addon constructor throw an Error if name length is less or equal 2", (test) => {
    test.throws(() => {
        new Addon("de");
    }, { instanceOf: Error, message: "constructor name argument length must be greater than 2" });
});

