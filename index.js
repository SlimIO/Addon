"use strict";

// Require Internal dependencie(s)
const Addon = require("./src/addon.class");
const Stream = require("./stream.class");
const Callback = require("./callback.class");

Addon.Stream = Stream;
Addon.Callback = Callback;

module.exports = Addon;
