"use strict";

import * as vscode from "vscode";
import { Utility } from "../utility";

export class TomcatServer {
    private _name: string;
    private _tomcatPath: string;
    private _started: boolean;
    private _output: vscode.OutputChannel;

    constructor(name: string, tomcatPath: string) {
        this._name = name.trim();
        this._tomcatPath = tomcatPath.trim();
        this._started = false;
        this._output = vscode.window.createOutputChannel(`Tomcat_${this._name}`);
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

    getOutput(): vscode.OutputChannel {
        return this._output;
    }

    dispose():void {
        this._output.dispose();
    }
}
