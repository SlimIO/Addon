# Addon
This package provide the foundation to build Addons that will rely and work with the Core. Addon is just a container that will help you as a developer.

<p align="center">
    <img src="https://i.imgur.com/chhYLun.png" alt="slimio">
</p>

> Scheduler is a external SlimIO Package. If you want to know more about it, follow [this link](https://github.com/SlimIO/Scheduler).

## Requirements
- Node.js v10 or higher

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
    await CPU.executeCallback("say_hello", void 0, "thomas"); // stdout "hello thomas";

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
| awake | When the addon is ready to awake (all locks are ok) |
| ready | When the developer trigger ready() method to tell the Core that the addon is Ready for events |

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

<details><summary>constructor (name: string, options?: Object)</summary>
<br />

Create a new Addon with a given name ! The name length must be more than two characters long.
Available options are:

| name | defaultValue | description |
| --- | --- | --- |
| version | 1.0.0 | Addon version |
| verbose | false | Enable addon verbose mode |

```js
const myAddon = new Addon("myAddon", {
    version: "0.1.0",
    verbose: true
});
```
</details>

<details><summary>registerCallback (name: string | AsyncFunction, callback?: AsyncFunction): this</summary>
<br />

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
</details>

<details><summary>executeCallback (name: string, ...args?: any[]): any</summary>
<br />

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
</details>

<details><summary>schedule (name: string | Scheduler, scheduler?: Scheduler): this</summary>
<br />

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
</details>

<details><summary>setDeprecatedAlias(callbackName: string, alias: string[]): void</summary>
<br />

Setup a list of deprecated alias for a given callbackName. A NodeJS Warning will be throw if these alias are used (to warn developer/integrator to upgrade addon version).

```js
const myAddon = new Addon("myAddon");

myAddon.registerCallback(async function new_test() {
    console.log("hello world!");
});
myAddon.setDeprecatedAlias("new_test", ["old_test"]);
```
</details>

<details><summary>lockOn(addonName: string, rules?: Addon.Rules): this</summary>
<br />

Wait for an addon to be declared "ready" to awake local Addon. Rules argument is an Object described as follow:
```ts
export interface Rules {
    startAfter?: boolean;
    lockCallback?: boolean;
}
```

The default rule values are defined as: `{ startAfter = true, lockCallback = false }`
- startAfter: Ask our local addon to start after the given addonName.
- lockCallback: Lock callback execution when our local addon is not awake.

```js
const myAddon = new Addon("myAddon").lockOn("events");

myAddon.on("awake", () => {
    console.log("events is ready!");
    myAddon.ready();
});
```
</details>

<details><summary>of< T >(subject: string): ZenObservable.ObservableLike< T ></summary>
<br />

Subscribe to a given subject. Available "core" Subjects are:
```ts
interface Subjects {
    Addon: {
        readonly Ready: string;
    };
    Alarm: {
        readonly Open: string;
        readonly Update: string;
        readonly Close: string;
    };
    Metrics: {
        readonly Update: string;
    }
}
```
<br />

```js
const myAddon = new Addon("myAddon");

myAddon.of(Addon.Subjects.Addon.Ready).subscribe((addonName) => {
    console.log(`Addon with name ${addonName} is Ready !`);
});
```
</details>

<details><summary>sendMessage< T >(target: string, options?: MessageOptions): ZenObservable.ObservableLike< T ></summary>
<br />

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

</details>

<details><summary>sendOne< T >(target: string, options?: MessageOptions | any[]): Promise< T ></summary>
<br />

Send **one** lazy message to a given target formatted as following: `addon.callback`. The returned value is a Promise (Use sendMessage under the hood).
```js
const myAddon = new Addon("myAddon");

myAddon.on("start", async function() {
    const addons = await myAddon.sendOne("gate.list_addons");
    console.log(addons);

    myAddon.ready();
});
```

Available options are the same as **sendMessage()**. If options is an Array, the message options will be constructed as follow
```
{ args: [] }
```

</details>

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

## License
MIT
