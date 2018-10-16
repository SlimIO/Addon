/// <reference types="node" />
/// <reference types="@types/node" />
/// <reference types="@types/es6-shim" />
/// <reference types="@slimio/scheduler" />
/// <reference types="@slimio/safe-emitter" />
/// <reference types="@types/zen-observable" />

import * as stream from "stream";
import * as SafeEmitter from "@slimio/safe-emitter";

/**
 * Addon Streaming Facility!
 */
declare class Stream extends stream.Transform {}

/**
 * Addon class definition
 */
declare class Addon extends SafeEmitter {
    // Constructor
    constructor(name: string);

    // Properties
    public name: string;
    public uid: string;
    public isReady: boolean;
    public isStarted: boolean;
    public asserts: any[];
    public flags: Set<string>;
    public callbacks: Map<string, Addon.Callback>;
    public schedules: Map<string, CallbackScheduler>;
    public observers: Map<string, ZenObservable.ObservableLike<any>>;

    // Static Properties
    static RESERVED_CALLBACK_NAME: Set<string>;
    static MESSAGE_TIMEOUT_MS: number;
    static MAIN_INTERVAL_MS: number;
    static Stream: typeof Stream;

    // Methods
    registerCallback(name: string | Addon.Callback, callback?: Addon.Callback): this;
    schedule(name: string | CallbackScheduler, scheduler?: CallbackScheduler): this;
    executeCallback<T>(name: string, ...args: any[]): Promise<T>;
    setDeprecatedAlias(callbackName: string, alias: string[]): void;
    sendMessage(target: string, options?: Addon.MessageOptions): ZenObservable.ObservableLike<any>;
    ready(): boolean;

    // Static Methods
    static start(): Promise<void>;
    static stop(): Promise<void>;
    static getInfo(): Addon.CallbackGetInfo;
}

/**
 * CallbackScheduler namespace
 */
declare namespace Addon {

    export type Callback = () => Promise<any>;

    // Message Options
    export interface MessageOptions {
        timeout?: number;
        args?: any[];
    }

    // Addon default info
    export interface CallbackGetInfo {
        uid: string;
        name: string;
        started: boolean;
        callbacks: string[];
        flags: string[];
    }

}

export as namespace Addon;
export = Addon;
