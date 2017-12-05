"use strict";

import { Utility } from "../utility";
import * as path from "path";

export class TomcatServer {
    private _name: string;
    private _tomcatPath: string;
    private _started: boolean;
    private _extensionPath: string;

    constructor(name: string, tomcatPath: string, extensionPath) {
        this._name = name.trim();
        this._tomcatPath = tomcatPath.trim();
        this._started = false;
        this._extensionPath = extensionPath.trim();
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

    getServerConfigPath(): string {
        return path.join(this._extensionPath, this._name, "conf", "server.xml");
    }
}
