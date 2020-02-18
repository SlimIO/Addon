"use strict";

/**
 * @namespace Utils
 */

// Require Third-party Dependencies
const isSnakeCase = require("is-snake-case");
const oop = require("@slimio/oop");

// CONSTANTS
const RESERVED_CALLBACK = new Set(["start", "stop", "sleep", "event", "status", "health_check"]);

/**
 * @function decamelize
 * @memberof Utils#
 * @description decamelize a given string
 * @param {!string} text
 * @returns {string}
 */
function decamelize(text) {
    return oop.toString(text)
        .replace(/([\p{Ll}\d])(\p{Lu})/gu, "$1_$2")
        .replace(/(\p{Lu}+)(\p{Lu}[\p{Ll}\d]+)/gu, "$1_$2")
        .toLowerCase();
}

/**
 * @function assertCallbackName
 * @description assert (verify) the validity of a given callback name
 * @param {!string} name callback name
 * @returns {void}
 *
 * @throws {Error}
 */
function assertCallbackName(name) {
    const originalName = oop.toString(name);
    const localName = isSnakeCase(originalName) ? originalName : decamelize(originalName);

    if (RESERVED_CALLBACK.has(localName)) {
        throw new Error(`Callback name '${localName}' is a reserved callback name!`);
    }

    return localName;
}

module.exports = {
    decamelize,
    assertCallbackName,
    CONSTANTS: Object.freeze({ RESERVED_CALLBACK })
};
