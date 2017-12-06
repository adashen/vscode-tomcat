'use strict';

import * as path from "path";
import { Utility } from "../Utility";

export class TomcatServer {
    private _name: string;
    private _tomcatPath: string;
    private _started: boolean;
    private _extensionPath: string;

    constructor(name: string, tomcatPath: string, extensionPath: string) {
        this._name = name.trim();
        this._tomcatPath = tomcatPath.trim();
        this._started = false;
        this._extensionPath = extensionPath.trim();
    }

    public setStarted(started: boolean): void {
        this._started = started;
    }

    public isStarted(): boolean {
        return this._started;
    }

    public getName(): string {
        return this._name;
    }

    public getTomcatPath(): string {
        return this._tomcatPath;
    }

    public getServerConfigPath(): string {
        return path.join(this._extensionPath, this._name, 'conf', 'server.xml');
    }
}
