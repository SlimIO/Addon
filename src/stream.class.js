/* eslint class-methods-use-this: 0 */

// Require Node.js Dependencies
const { Transform } = require("stream");

/**
 * @class Stream
 * @classdesc SlimIO Streaming class
 * @extends Transform
 */
class Stream extends Transform {
    /**
     * @method _read
     * @memberof Callback#
     * @returns {void}
     */
    _read() {
        // do nothing
    }

    /**
     * @method _write
     * @memberof Stream#
     * @param {!Buffer} chunk buffer chunk!
     * @param {*} enc encoding
     * @param {*} next next
     * @return {void}
     */
    _write(chunk, enc, next) {
        this.push(chunk);
        next();
    }
}

module.exports = Stream;
