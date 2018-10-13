# Addon
This package provide the foundation to build Addon container that will rely and work with the Core.

## Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm](https://docs.npmjs.com/getting-started/what-is-npm) or [yarn](https://yarnpkg.com).

```bash
$ npm i @slimio/addon
# or
$ yarn add @slimio/addon
```

## Usage example

A sample cpu addon.

```js
const Addon = require("@slimio/addon");

// Create addon
const CPU = new Addon("cpu");

// Register a callback
CPU.registerCallback(async function sayHello(name) {
    console.log(`hello ${name}`);
});

// Catch start event!
CPU.on("start", () => {
    console.log("cpu addon started!");
    CPU.executeCallback("sayHello", "thomas"); // stdout "hello thomas";
});

// Export addon for SlimIO Core.
module.exports = CPU;
```

## Events
The Addon package is extended with a NodeJS EventEmitter. Two kinds of events can be triggered on Addon by the Core:
- start (When the Addon is asked to start)
- stop (When the addon is asked to stop)
- ready (When the addon is declared ready by the developer itself).
- addonLoaded (When an external addon has been loaded, useful to know when you can send your messages).

> **Note** Events are not awaited. For example, this is not recommanded to use "close" to free handle/resource before a SIGINT event.

## Interval & Scheduling

The Addon instanciate is own interval to execute Scheduled callbacks. The default interval is `500` milliseconds.

You can configure the default interval by editing static Addon variables:
```js
Addon.MAIN_INTERVAL_MS = 100; // 100ms
```

## API

### constructor(name: string)
Create a new Addon with a given name ! The name length of the addon must be more than two characters long.
```js
// VALID
const myAddon = new Addon("myAddon");

// INVALID
const de = new Addon("de");
```

### registerCallback(name: string | AsyncFunction, callback?: AsyncFunction): this
Register a new Addon callback. The callback should be an Asynchronous Function (Synchronous function will be rejected with a TypeError).

There is two ways to register a callback:

```js
myAddon.registerCallback("callback_name", async function() {
    console.log("callbackName has been executed!");
});
```

> Please, be sure to avoid Anonymous function as much possible!

Or by passing the callback reference to the name (The function can't be anonymous, else it will throw an Error).
```js
async function callback_name() {
    console.log("callbackName has been executed!");
}
myAddon.registerCallback(callback_name);
```

Callback name should be writted by following the snake_case convention [snake_case](https://fr.wikipedia.org/wiki/Snake_case) !

### executeCallback(name: string, ...args?: any[]): any
Execute a callback (It will return a Promise). The method can take infinity of arguments (with be returned as normal arguments of the callback).

```js
const myAddon = new Addon("myAddon");

myAddon.registerCallback(async function cb_test() {
    return "hello world!";
});

myAddon.on("start", async function() {
    const ret = await myAddon.executeCallback("cb_test");
    console.log(ret); // stdout "hello world!"
});
```

### schedule(name: string | Scheduler, scheduler?: Scheduler)
Schedule a callback execution interval. Use the package `@slimio/scheduler` to achieve a scheduler !

```js
const Scheduler = require("@slimio/scheduler");
const Addon = require("@slimio/addon");

const myAddon = new Addon("myAddon");

myAddon.registerCallback(async function sayHelloEveryOneSecond() {
    console.log("hello world");
});
myAddon.schedule("sayHelloEveryOneSecond", new Scheduler({ interval: 1 }));
```

### setDeprecatedAlias(callbackName: string, alias: string[]): void
Setup a list of deprecated alias for a given callbackName.

### sendMessage(target: string, options): Observable
Send a lazy message to a given target `addon.callback`. The returned value is an Observable.

```js
const myAddon = new Addon("myAddon");

myAddon.on("start", function() {
    myAddon.sendMessage("cpu.get_info").subscribe(console.log);
});
```
