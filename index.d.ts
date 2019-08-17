/// <reference types="node" />
/// <reference types="@types/node" />
/// <reference types="@types/es6-shim" />
/// <reference types="@slimio/scheduler" />
/// <reference types="@slimio/safe-emitter" />
/// <reference types="@slimio/logger" />
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
    constructor(name: string, callback: Addon.Callback<any>);
    execute(args: any[]): Promise<any>;

    static createHook(): async_hooks.AsyncHook;
    static observePerformance(perfTrigger: (perfEntry: perf_hooks.PerformanceEntry) => void): perf_hooks.PerformanceObserver;
}

/**
 * Addon class definition
 */
declare class Addon<T extends { [key: string]: any } = Addon.NativeCallbacks> extends SafeEmitter<Addon.Events> {
    // Constructor
    constructor(name: string, options?: Addon.ConstructorOptions);

    // Properties
    public name: string;
    public uid: string;
    public version: string;
    public verbose: boolean;
    public isReady: boolean;
    public isStarted: boolean;
    public isAwake: boolean;
    public asserts: any[];
    public lastStart: number;
    public lastStop: number;
    public logger: Logger;
    public subscribers: Map<string, ZenObservable.Observer<any>[]>;
    public locks: Map<string, Addon.Rules>;
    public callbacksDescriptor: string;
    public callbacks: Map<string, Addon.Callback<any>>;
    public schedules: Map<string, CallbackScheduler>;
    public observers: Map<string, ZenObservable.SubscriptionObserver<any>>;

    // Static Properties
    static RESERVED_CALLBACK_NAME: Set<string>;
    static MESSAGE_TIMEOUT_MS: number;
    static MAIN_INTERVAL_MS: number;
    static VERSION: string;
    static Stream: typeof Stream;
    static Callback: typeof Callback;
    static Subjects: Addon.Subjects;

    // Methods
    registerCallback(name: string | Addon.Callback<any>, callback?: Addon.Callback<any>): this;
    schedule(name: string | CallbackScheduler, scheduler?: CallbackScheduler): this;
    executeCallback<K extends keyof T>(name: K, header?: Addon.CallbackHeader, ...args: any[]): Promise<T[K]>;
    setDeprecatedAlias(callbackName: string, alias: string[]): void;
    sendMessage(target: string, options?: Addon.MessageOptions): ZenObservable.ObservableLike<any>;
    sendOne(target: string, options?: Addon.MessageOptions | any[]): Promise<any>;
    setCallbacksDescriptorFile(path: string): void;
    of(subject: string): ZenObservable.ObservableLike<any>;
    ready(): Promise<boolean>;
    lockOn(addonName: string, rules?: Addon.Rules): this;
    waitForAllLocks(asStart?: boolean): Promise<boolean>;

    // Static Methods
    static start(): Promise<boolean>;
    static stop(): Promise<boolean>;
    static getInfo(): Addon.CallbackGetInfo;
    static sleep(): Promise<boolean>;
    static isAddon(obj: any): boolean;
}

/**
 * CallbackScheduler namespace
 */
declare namespace Addon {
    export interface NativeCallbacks {
        "get_info": CallbackGetInfo;
        "start": boolean;
        "stop": boolean;
        "sleep": boolean;
        "health_check": boolean;
        "event": void;
    }

    export interface Events {
        start: any;
        stop: any;
        error: any;
        message: [string, string];
    }

    export type Callback<T> = () => Promise<T>;

    export interface ConstructorOptions {
        version?: string;
        verbose?: boolean;
        description?: string;
    }

    export interface Rules {
        startAfter?: boolean;
        lockCallback?: boolean;
    }

    export interface MessageOptions {
        timeout?: number;
        args?: any[];
        noReturn?: boolean;
    }

    export interface Subjects {
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

    export interface CallbackHeader {
        id?: string;
        from: string;
    }

    export interface CallbackGetInfo {
        uid: string;
        name: string;
        version: string;
        description: string;
        containerVersion: string;
        started: boolean;
        ready: boolean;
        awake: boolean;
        callbacksDescriptor: string;
        callbacks: string[];
        callbacksAlias: {
            [callbackName: string]: string[];
        }
    }

}

export as namespace Addon;
export = Addon;
