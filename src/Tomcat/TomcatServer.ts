'use strict';

import * as path from "path";
import * as vscode from "vscode";
import { Utility } from "../Utility";

export class TomcatServer {
    public needRestart: boolean = false;
    private _name: string;
    private _tomcatPath: string;
    private _started: boolean;
    private _extensionPath: string;
    private _debugPort: number;
    private _debugWorkspace: vscode.WorkspaceFolder;
    private _isDebugging: boolean = false;

    constructor(name: string, tomcatPath: string, extensionPath: string) {
        this._name = name.trim();
        this._tomcatPath = tomcatPath.trim();
        this._started = false;
        this._extensionPath = extensionPath.trim();
    }

    public setDebugInfo(debugging: boolean, port: number, workspace: vscode.WorkspaceFolder): void {
        this._isDebugging = debugging;
        this._debugPort = port;
        this._debugWorkspace = workspace;
    }

    public getDebugPort(): number {
        return this._debugPort;
    }

    public getDebugWorkspace(): vscode.WorkspaceFolder {
        return this._debugWorkspace;
    }

    public isDebugging(): boolean {
        return this._isDebugging;
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
