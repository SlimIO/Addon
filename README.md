# Addon
SlimIO Core Addon container. This module/package provide the foundation to build valid SlimIO Addon that will rely and work with the Core.

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

## API

### constructor(name: string)
Create a new Addon with a given name !
```js
const myAddon = new Addon("myAddon");
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

Or by passing the callback to name (the function can't be anonymous).
```js
async function callback_name() {
    console.log("callbackName has been executed!");
}
myAddon.registerCallback(callback_name);
```

Callback name should be writted by following the snake_case convention [snake_case](https://fr.wikipedia.org/wiki/Snake_case) !

### executeCallback(name: string, ...args?: any[]): any
Execute a callback (Return a Promise). The method can take many arguments (with be returned as normal arguments of the callback).

```js
const myAddon = new Addon("myAddon");

myAddon.registerCallback(async function cb_test() {
    return "hello world!";
});

myAddon.on("start", async function() {
    const ret = await myAddon.executeCallback("callbackName");
    console.log(ret); // stdout "hello world!"
});
```

### schedule(name: string | Scheduler, scheduler?: Scheduler)
Schedule a callback execution interval. The package `@slimio/scheduler` to achieve a scheduler !

```js
const Scheduler = require("@slimio/scheduler");
const Addon = require("@slimio/addon");

const myAddon = new Addon("myAddon");

myAddon.registerCallback(async function sayHelloEveryOneSecond() {
    console.log("hello world");
});
myAddon.schedule("sayHelloEveryOneSecond", new Scheduler({ interval: 1 }));
```

### sendMessage(target: string, options): Observable
Send a lazy message to a given target `addon.callback`. The returned value is an Observable.

```js
const myAddon = new Addon("myAddon");

myAddon.on("start", function() {
    myAddon.sendMessage("cpu.get_info").subscribe(console.log);
});
```
