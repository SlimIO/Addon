# Addon
This package provide the foundation to build Addons that will rely and work with the Core. Addon is just a container that will help you as a developer.

<p align="center">
    <img src="https://i.imgur.com/chhYLun.png" alt="slimio">
</p>

> Scheduler is a external SlimIO Package. If you want to know more about it, follow [this link](https://github.com/SlimIO/Scheduler).

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
CPU.registerCallback(async function say_hello(name) {
    console.log(`hello ${name}`);
});

// Catch start event!
CPU.on("start", async() => {
    console.log("cpu addon started!");

    // Execute local callback
    await CPU.executeCallback("say_hello", "thomas"); // stdout "hello thomas";

    // Tell the core that your addon is ready!
    CPU.ready();
});

// Export addon for SlimIO Core.
module.exports = CPU;
```

## Events
Addon is extended with a SlimIO Safe EventEmitter. Four kinds of events can be triggered:

| event | description |
| --- | --- |
| start | When the core ask the addon to start |
| stop | When the core ask the addon to stop |
| ready | When the developer trigger ready() method to tell the Core that the addon is Ready for events |
| addonLoaded | When an external addon has been loaded, return the addon name as first argument! |

## Interval & Scheduling

The Addon instanciate is own interval to execute Scheduled callbacks. The default interval time is setup at `500` milliseconds. To know how work the `walk()` method of Scheduler, please look at this [documentation](https://github.com/SlimIO/Scheduler).

<p align="center">
    <img src="https://i.imgur.com/iEeA0ql.png" alt="slimio">
</p>

You can configure the default interval by editing static Addon variables (**this is not recommanded**):
```js
Addon.MAIN_INTERVAL_MS = 100; // 100ms
```

## API

### constructor(name: string)
Create a new Addon with a given name ! The name length must be more than two characters long.
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

Or by passing the callback reference as the name (The function can't be anonymous, else it will throw an Error).
```js
async function callback_name() {
    console.log("callbackName has been executed!");
}
myAddon.registerCallback(callback_name);
```

Callback name should be writted by following the snake_case convention [snake_case](https://fr.wikipedia.org/wiki/Snake_case) !

### executeCallback(name: string, ...args?: any[]): any
Execute a callback (It will return a Promise). The method can take infinity of arguments (they will be returned as normal arguments of the callback).

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
Setup a list of deprecated alias for a given callbackName. A NodeJS Warning will be throw if these alias are used (to warn developer/integrator to upgrade addon version).

```js
const myAddon = new Addon("myAddon");

myAddon.registerCallback(async function new_test() {
    console.log("hello world!");
});
myAddon.setDeprecatedAlias("new_test", ["old_test"]);
```

### sendMessage(target: string, options): Observable
Send a lazy message to a given target formatted as following: `addon.callback`. The returned value is an Observable (package **zen-observable**).

```js
const myAddon = new Addon("myAddon");

myAddon.on("start", function() {
    myAddon
        .sendMessage("cpu.get_info")
        .subscribe(console.log);
    myAddon.ready();
});
```

Available options are:

| name | default value | description |
| --- | --- | --- |
| args | Empty Array | Callback arguments |
| noReturn | false | If `true`, the method will return void 0 instead of a new Observable |
| timeout | 5000 | Timeout delay (before the hook expire) |

## Streaming Communication

SlimIO Callback support NodeJS Write Streams. Take the following example:

```js
const streamAddon = new Addon("streamAddon");

streamAddon.registerCallback(async function stream_com() {
    const WStream = new Addon.Stream();
    setTimeout(() => {
        WStream.write("msg1");
    }, 100);
    setTimeout(() => {
        WStream.write("msg2");
        WStream.end();
    }, 200);
    return WStream;
});

module.exports = streamAddon;
```

And now if we call this callback from an another Addon:

```js
const myAddon = new Addon("myAddon");

myAddon.on("start", () => {
    myAddon.ready();
});

myAddon.on("addonLoaded", (addonName) => {
    if (addonName === "streamAddon") {
        myAddon.sendMessage("streamAddon.stream_com").subscribe(
            (message) => console.log(message),
            () => console.log("Stream completed!")
        )
    }
});
```
