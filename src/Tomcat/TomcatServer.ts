"use strict";

import { Utility } from "../utility";

export class TomcatServer {
    private _name: string;
    private _tomcatPath: string;
    private _started: boolean;

    constructor(name: string, tomcatPath: string) {
        this._name = name.trim();
        this._tomcatPath = tomcatPath.trim();
        this._started = false;
    }

    setStarted(started: boolean): void {
        this._started = started;
    }

    isStarted(): boolean {
        return this._started;
    }

    getName(): string {
        return this._name;
    }

    getTomcatPath(): string {
        return this._tomcatPath;
    }
}
