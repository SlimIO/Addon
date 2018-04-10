// Require third-party dependencies
const is = require("@sindresorhus/is");

/**
 * @function getDefaultDate
 * @desc Get default date
 * @returns {Date}
 */
function getDefaultDate() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    return date;
}

// Default options for CallbackScheduler constructor
const ISchedulerDefaultOptions = {
    interval: 36000,
    startDate: getDefaultDate(),
    executeOnStart: false
};

/**
 * @class CallbackScheduler
 * @classdesc Used to schedule callback(s) execution in Addon
 *
 * @property {Number} interval
 * @property {Boolean} started
 * @property {Boolean} initialized
 * @property {Boolean} executeOnStart
 * @property {Date} timer
 * @property {Date} startDate
 */
class CallbackScheduler {

    /**
     * @constructor
     * @param {Object} [options={}] Scheduler Options
     * @throws {TypeError}
     */
    constructor(options = ISchedulerDefaultOptions) {
        const args = Object.assign(options, ISchedulerDefaultOptions);
        if (!is.number(args.interval)) {
            throw new TypeError("CallbackScheduler.options.interval should be typeof <number>");
        }
        if (!is.date(args.startDate)) {
            throw new TypeError("CallbackScheduler.options.startDate should be a <Date> Object");
        }
        if (!is.boolean(args.executeOnStart)) {
            throw new TypeError("CallbackScheduler.options.executeOnStart should be a <boolean>");
        }

        this.interval = args.interval || 36000;
        this.startDate = args.startDate || getDefaultDate();
        this.executeOnStart = args.executeOnStart || false;
        this.started = false;
        this.initialized = false;
    }

    /**
     * @public
     * @method reset
     * @desc Reset scheduler to delta 0
     * @memberof CallbackScheduler#
     * @returns {void}
     */
    reset() {
        this.timer = new Date();
        this.timer.setSeconds(this.timer.getSeconds() + this.interval);
    }

    /**
     * @public
     * @method walk
     * @desc Increment the schedule (timer). It's what we call a 'walk'
     * @memberof CallbackScheduler#
     * @returns {Boolean}
     */
    walk() {
        if (this.started === false) {
            this.started = true;

            return this.executeOnStart;
        }
        if (Date.now() < this.startDate) {
            return false;
        }

        // Init timer!
        if (this.initialized === false) {
            this.reset();
            this.initialized = true;
        }

        if (this.timer > new Date()) {
            return false;
        }
        this.reset();

        return true;
    }

}

// Export class
module.exports = CallbackScheduler;
