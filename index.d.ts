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
    public currentLockedAddon: null | string;
    public readonly lastRegisteredAddon: string;
    public logger: Logger;
    public subscribers: Map<string, ZenObservable.Observer<any>[]>;
    public locks: Map<string, Addon.Rules>;
    public callbacksDescriptor: string;
    public callbacks: Map<string, Addon.Callback<any>>;
    public schedules: Map<string, CallbackScheduler>;
    public observers: Map<string, ZenObservable.SubscriptionObserver<any>>;
    public intervals: Map<string, Addon.Interval>;

    // Static Properties
    static RESERVED_CALLBACK_NAME: Set<string>;
    static MESSAGE_TIMEOUT_MS: number;
    static MAIN_INTERVAL_MS: number;
    static MAX_SLEEP_TIME_MS: number;
    static VERSION: string;
    static Stream: typeof Stream;
    static Callback: typeof Callback;
    static Subjects: Addon.Subjects;
    static REQUIRED_CORE_VERSION: string;
    readonly static ACL: Addon.ACL;

    // Methods
    public registerCallback(name: string | Addon.Callback<any>, callback?: Addon.Callback<any>, ACL?: Addon.ACL): this;
    public registerInterval(callback: () => any | Promise<any>, ms?: number): string;
    public schedule(name: string | CallbackScheduler, scheduler?: CallbackScheduler): this;
    public executeCallback<K extends keyof T>(name: K, header?: Addon.CallbackHeader, ...args: any[]): Promise<T[K]>;
    public setDeprecatedAlias(callbackName: string, alias: Iterable<string>): void;
    public sendMessage(target: string, options?: Addon.MessageOptions): ZenObservable.ObservableLike<any>;
    public sendOne(target: string, options?: Addon.MessageOptions | any[]): Promise<any>;
    public setCallbacksDescriptorFile(path: string): void;
    public setACL(callbackName: string, ACL: keyof Addon.ACL): void;
    public of(subject: string): ZenObservable.ObservableLike<any>;
    public ready(): Promise<boolean>;
    public lockOn(addonName: string, rules?: Addon.Rules): this;
    public waitForAllLocks(asStart?: boolean): Promise<boolean>;
    private awake(): Promise<void>;

    // Static Methods
    private static start(): Promise<boolean>;
    private static stop(): Promise<boolean>;
    private static status(): Addon.Status;
    private static sleep(): Promise<boolean>;
    public static isAddon(obj: any): boolean;
}

/**
 * CallbackScheduler namespace
 */
declare namespace Addon {
    export interface Interval {
        callback: () => any | Promise<any>;
        ms: number;
        nodeTimer: NodeJS.Timer | null;
    }

    export interface NativeCallbacks {
        "status": Status;
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
        ready: string;
        alarmOpen: string;
        alarmUpdate: string;
        alarmClose: string;
        micCreate: string;
        micUpdate: string;
    }

    export interface ACL {
        read: 0;
        write: 1;
        admin: 2;
        super: 3;
    }

    export interface CallbackHeader {
        id?: string;
        from: string;
    }

    export interface Status {
        uid: string;
        name: string;
        version: string;
        description: string;
        containerVersion: string;
        started: boolean;
        ready: boolean;
        awake: boolean;
        lastStart: number;
        lastStop: number;
        currentLockedAddon: null | string;
        lockOn: string[];
        callbacksDescriptor: string;
        callbacks: {
            [callbackName: string]: {
                ACL: number;
                alias: string[];
            };
        }
    }

}

export as namespace Addon;
export = Addon;
