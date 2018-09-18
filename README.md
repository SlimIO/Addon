# Addon
Slim.IO Addon

## Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm](https://docs.npmjs.com/getting-started/what-is-npm).

```bash
$ npm install @slimio/addon
```

Usage example:

```js
const Addon = require("@slimio/addon");

// Create addon
const myAddon = new Addon("myAddon");

// Register a callback
async function sayHello(name) {
    console.log(`hello ${name}`);
}
myAddon.registerCallback(sayHello);

// Catch start event!
myAddon.on("start", () => {
    console.log("myAddon started!");
});

// Export addon for SlimIO Agent
module.exports = myAddon;
```

## API

### constructor(name)
Create a new Addon with a given name !
```js
const myAddon = new Addon("myAddon");
```

### registerCallback(name, callback)
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

### executeCallback(name, ...args)
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

### schedule(name, scheduler)
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

### sendMessage(target, options)
Send a message to a given target (addon.callback).
