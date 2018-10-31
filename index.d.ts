/// <reference types="node" />
/// <reference types="@types/node" />
/// <reference types="@types/es6-shim" />
/// <reference types="@slimio/scheduler" />
/// <reference types="@slimio/safe-emitter" />
/// <reference types="@types/zen-observable" />

import * as stream from "stream";
import * as async_hooks from "async_hooks";
import * as perf_hooks from "perf_hooks";
import * as SafeEmitter from "@slimio/safe-emitter";

/**
 * Addon Streaming Facility!
 */
declare class Stream extends stream.Transform {}

/**
 * Callback AsyncResource
 */
declare class Callback extends async_hooks.AsyncResource {
    constructor(name: string, callback: Addon.Callback);
    execute(args: any[]): Promise<any>;

    static createHook(): async_hooks.AsyncHook;
    static observePerformance(perfTrigger: (perfEntry: perf_hooks.PerformanceEntry) => void): perf_hooks.PerformanceObserver;
}

/**
 * Addon class definition
 */
declare class Addon extends SafeEmitter {
    // Constructor
    constructor(name: string, version?: string);

    // Properties
    public name: string;
    public uid: string;
    public version: string;
    public isReady: boolean;
    public isStarted: boolean;
    public asserts: any[];
    public flags: Set<string>;
    public callbacksDescriptor: string;
    public callbacks: Map<string, Addon.Callback>;
    public schedules: Map<string, CallbackScheduler>;
    public observers: Map<string, ZenObservable.ObservableLike<any>>;

    // Static Properties
    static RESERVED_CALLBACK_NAME: Set<string>;
    static MESSAGE_TIMEOUT_MS: number;
    static MAIN_INTERVAL_MS: number;
    static Stream: typeof Stream;
    static Callback: typeof Callback;

    // Methods
    registerCallback(name: string | Addon.Callback, callback?: Addon.Callback): this;
    schedule(name: string | CallbackScheduler, scheduler?: CallbackScheduler): this;
    executeCallback<T>(name: string, header?: Addon.CallbackHeader, ...args: any[]): Promise<T>;
    setDeprecatedAlias(callbackName: string, alias: string[]): void;
    sendMessage(target: string, options?: Addon.MessageOptions): ZenObservable.ObservableLike<any>;
    setCallbacksDescriptorFile(path: string): void;
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

    export interface CallbackHeader {
        id?: string;
        from: string;
    }

    // Addon default info
    export interface CallbackGetInfo {
        uid: string;
        name: string;
        version: string;
        containerVersion: string;
        started: boolean;
        callbacksDescriptor: string;
        callbacks: string[];
        flags: string[];
    }

}

export as namespace Addon;
export = Addon;
