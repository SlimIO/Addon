# Addon
![version](https://img.shields.io/badge/dynamic/json.svg?url=https://raw.githubusercontent.com/SlimIO/Addon/master/package.json?token=AOgWw3vrgQuu-U4fz1c7yYZyc7XJPNtrks5catjdwA%3D%3D&query=$.version&label=Version)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/SlimIO/Addon/commit-activity)
![MIT](https://img.shields.io/github/license/mashape/apistatus.svg)
![dep](https://img.shields.io/david/SlimIO/Addon)
![size](https://img.shields.io/github/languages/code-size/SlimIO/Addon)
[![Build Status](https://travis-ci.com/SlimIO/Addon.svg?branch=master)](https://travis-ci.com/SlimIO/Addon)

This package provide the foundation to build Addons that will rely and work with the Core. Addon is just a container that will help you as a developer.

<p align="center">
    <img src="https://i.imgur.com/SNAYd7Y.png" alt="slimio">
</p>

> Scheduler is a external SlimIO Package. If you want to know more about it, follow [this link](https://github.com/SlimIO/Scheduler).

## Requirements
- [Node.js](https://nodejs.org/en/) v10 or higher

## Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm](https://docs.npmjs.com/getting-started/what-is-npm) or [yarn](https://yarnpkg.com).

```bash
$ npm i @slimio/addon
# or
$ yarn add @slimio/addon
```

> 👀 For a guide on how create/setup a first addon, please [check available documentations in our Governance](https://github.com/SlimIO/Governance#documentation) repository.

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

You might find it useful to read the source codes of our other addons, let us give you some nice links:

| name (& link) | Kind | description |
| --- | --- | --- |
| [cpu-addon](https://github.com/SlimIO/cpu-addon) | Metrology | Retrieve CPU metrics (cool to understood how works Entities and Metrics cards) |
| [Prism](https://github.com/SlimIO/Prism) | Custom | Distribution Server (An addon that deal with Stream and very specific behaviors) |
| [Alerting](https://github.com/SlimIO/Alerting) | Built-in | Manage alerting of the product (Deal with events observables and alarms) |
| [Gate](https://github.com/SlimIO/Gate) | Built-in | The core extension (Nothing special, just simple callbacks here) |

## Available events
Addon is extended with a SlimIO Safe [EventEmitter](https://github.com/SlimIO/Safe-emitter). Six kinds of events can be triggered:

| event | description |
| --- | --- |
| start | When the core ask the addon to start |
| stop | When the core ask the addon to stop |
| awake | When the addon is ready to awake (all locks are ok) |
| sleep | When a linked locked addon has been detected as stopped by the core |
| ready | When the developer trigger ready() method to tell the Core that the addon is Ready for events |
| error | When a error occur in one of the EventEmitter listener |

An addon have different given state during his life (started, awaken and ready). An addon is started when the core has recognized its existence and that it has been loaded successfully. The state **ready** have to be triggered by the developer itself in the **start** or **awake** event depending the need.

An addon wake up when all its dependencies are ready. A dependency can be added with the **lockOn()** method.
```js
const myAddon("test").lockOn("events");

myAddon.on("awake", async() => {
    // Do something with events safely!
    const info = await myAddon.send("events.get_info");
});
```

## Interval & Scheduling

The Addon instanciate is own interval to execute Scheduled callbacks. The default interval time is setup at `500` milliseconds. To know how work the `walk()` method of Scheduler, please look at this [documentation](https://github.com/SlimIO/Scheduler).

<p align="center">
    <img src="https://i.imgur.com/iEeA0ql.png" alt="slimio">
</p>

You can configure the default interval by editing static Addon variables (**this is not recommanded**):
```js
Addon.MAIN_INTERVAL_MS = 100; // 100ms
```

A concrete production example is to schedule a callback every 24 hours that start at midnight (but this callback can still be triggered manually by calling the callback).

<details><summary>show example</summary>
<br />

```js
const myAddon = new Addon("myAddon");

let isCalled = false;

async function ourJob() {
    isCalled = true;
    try {
        await new Promise((resolve) => setTimeout(resolve, 10000));
    }
    finally {
        isCalled = false;
    }
}

async function scheduledCallback() {
    if (isCalled) {
        return { error: "Job already running!" }
    }

    ourJob().catch((err) => myAddon.logger.writeLine(err));
    return { error: null };
}

myAddon
    .registerCallback(scheduledCallback)
    .schedule(new Scheduler({ interval: 86400, startDate: new Date(new Date().setHours(24, 0, 0, 0)) }));
```

</details>

## API

<details><summary>constructor (name: string, options?: Object)</summary>
<br />

Create a new Addon with a given name ! The name length must be more than two characters long.
Available options are:

| name | defaultValue | description |
| --- | --- | --- |
| version | 1.0.0 | Addon version |
| verbose | false | Enable addon verbose mode |
| description | Empty string | Addon description |

```js
const myAddon = new Addon("myAddon", {
    version: "0.1.0",
    verbose: true,
    description: "My Custom Addon!"
});
```
</details>

<details><summary>ready(): Promise< boolean ></summary>
<br />

Flag the addon as ready for the core.

```js
const myAddon = new Addon("myAddon");

myAddon.on("start", () => {
    myAddon.ready();
})
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

<details><summary>registerInterval(callback: () => any | Promise< any >, ms?: number): string</summary>
<br />

Register a driftless timer interval that will be managed by the Addon itself. These intervals are only executed when the addon is **awake**. These functions (intervals) **are protected against UnhandledPromiseRejection** (so any errors will not lead the process to exit).

Intervals are erased when the `stop` event is triggered to avoid excessive use of memory (So think to register these intervals in the **start** event).

```js
const myAddon = new Addon("myAddon").lockOn("otherAddon");

async function myInterval() {
    console.log("Hey ! I'm awake and will be executed every 5 seconds");
}

myAddon.on("start", () => {
    myAddon.registerInterval(myInterval, 5000);
});
```

The method registerInterval return a unique id which can be used to retrieve the original Node.js timer etc...
```js
const uid = myAddon.registerInterval(myInterval, 5000);

const { ms, callback, nodeTimer } = myAddon.intervals.get(uid);
nodeTimer.unref()
```

</details>

## Static method

### isAddon(obj: any): boolean
Detect if **obj** is an Addon (use a Symbol under the hood).

```js
const myAddon = new Addon("myAddon");

console.log(Addon.isAddon(myAddon)); // true
```

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

## Dependencies

|Name|Refactoring|Security Risk|Usage|
|---|---|---|---|
|[@slimio/is](https://github.com/SlimIO/is#readme)|Minor|Low|Type checker|
|[@slimio/logger](https://github.com/SlimIO/logger)|Minor|Low|Sonic Logger with low overhead for SlimIO|
|[@slimio/safe-emitter](https://github.com/SlimIO/safeEmitter#readme)|⚠️Major|Medium|Safe emitter|
|[@slimio/scheduler](https://github.com/SlimIO/Scheduler#readme)|⚠️Major|Low|Addon Scheduler|
|[@slimio/timer](https://github.com/SlimIO/Timer#readme)|Minor|Low|Driftless Interval Timer|
|[is-snake-case](https://github.com/sunitJindal/is-snake-case#readme)|Minor|Low|Snake case checker|
|[uuid](https://github.com/kelektiv/node-uuid#readme)|Minor|Low|Simple, fast generation of RFC4122 UUIDS.|
|[zen-observable](https://github.com/zenparsing/zen-observable)|Minor|Low|Observable Implementation|

## License
MIT
