"use strict";

/**
 * @namespace Utils
 */

/**
 * @function decamelize
 * @memberof Utils#
 * @description decamelize a given string
 * @param {!string} text
 * @returns {string}
 */
function decamelize(text) {
    if (typeof text !== "string") {
        throw new TypeError("Expected a string");
    }

    return text
        .replace(/([\p{Ll}\d])(\p{Lu})/gu, "$1_$2")
        .replace(/(\p{Lu}+)(\p{Lu}[\p{Ll}\d]+)/gu, "$1_$2")
        .toLowerCase();
}

module.exports = { decamelize };
