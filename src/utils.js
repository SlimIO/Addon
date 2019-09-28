"use strict";

/**
 * @namespace Utils
 */

// Require Third-party Dependencies
const isSnakeCase = require("is-snake-case");

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
    if (typeof text !== "string") {
        throw new TypeError("text must be a string");
    }

    return text
        .replace(/([\p{Ll}\d])(\p{Lu})/gu, "$1_$2")
        .replace(/(\p{Lu}+)(\p{Lu}[\p{Ll}\d]+)/gu, "$1_$2")
        .toLowerCase();
}

/**
 * @function assertCallbackName
 * @param {!string} name callback name
 * @returns {void}
 *
 * @throws {TypeError}
 * @throws {Error}
 */
function assertCallbackName(name) {
    if (typeof name !== "string") {
        throw new TypeError("name must be a string");
    }

    const localName = isSnakeCase(name) ? name : decamelize(name);
    if (RESERVED_CALLBACK.has(localName)) {
        throw new Error(`Callback name '${name}' is a reserved callback name!`);
    }

    return localName;
}

module.exports = {
    decamelize,
    assertCallbackName,
    CONSTANTS: Object.freeze({ RESERVED_CALLBACK })
};
