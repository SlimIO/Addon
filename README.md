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
Register a new Addon callback. The callback should be a Asynchronous Function (Synchronous function will be rejected with a TypeError).

There is two ways to register a callback:

```js
myAddon.registerCallback("callbackName", async function() {
    console.log("callbackName has been executed!");
});
```

Or by passing the callback to name (the function can't be anonymous).
```js
async function callbackName() {
    console.log("callbackName has been executed!");
}
myAddon.registerCallback(callbackName);
```

### executeCallback(name, args)
Execute a callback (Return a Promise).

```js
myAddon.executeCallback("callbackName");
```

### schedule(name, scheduler)
Schedule a callback execution interval.

### sendMessage(target, options)
Send a message to a given target (addon.callback).
