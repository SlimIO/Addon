/// <reference types="node" />
/// <reference types="@types/node" />
/// <reference types="@types/es6-shim" />
/// <reference types="@slimio/scheduler" />
/// <reference types="zen-observable" />
import * as events from "events";

/**
 * Addon class definition
 */
declare class Addon extends events {
    // Constructor
    constructor(name: string);

    // Properties
    public name: string;
    public uid: string;
    public isStarted: boolean;
    public isConnected: boolean;
    public shadowRunAllowed: boolean;
    public multipleRunAllowed: boolean;
    public callbacks: Map<string, () => Promise<any>>;
    public schedules: Map<string, CallbackScheduler>;
    public observers: Map<string, ZenObservable.ObservableLike>;

    // Static Properties
    static ReservedCallbacksName: Set<string>;
    static messageTimeOutMs: number;
    static mainIntervalMs: number;

    // Methods
    registerCallback(name: string | Addon.AsyncHandler, callback?: Addon.AsyncHandler): this;
    schedule(name: string | CallbackScheduler, scheduler?: CallbackScheduler): this;
    executeCallback<T>(name: string, ...args): Promise<T>;
    sendMessage(target: string, options?: Addon.MessageOptions): ZenObservable.ObservableLike;

    // Static Methods
    static start(): Promise<void>;
    static stop(): Promise<void>;
    static getInfo(): Addon.CallbackGetInfo;
}

/**
 * CallbackScheduler namespace
 */
declare namespace Addon {

    export type AsyncHandler = () => Promise<void>;

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
