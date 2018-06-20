'use strict';

import * as path from "path";
import * as vscode from "vscode";
import * as Constants from "../Constants";
import { ServerState } from "../Constants";
import { Utility } from "../Utility";

export class TomcatServer extends vscode.TreeItem implements vscode.QuickPickItem {
    public needRestart: boolean = false;
    public label: string;
    public description: string;
    public jvmOptions: string[];
    public jvmOptionFile: string;
    public basePathName: string;
    private _state: ServerState = ServerState.IdleServer;
    private _isDebugging: boolean = false;
    private _debugPort: number;
    private _debugWorkspace: vscode.WorkspaceFolder;
    private _configurationPath: string;

    constructor(private _name: string, private _installPath: string, private _storagePath: string) {
        super(_name);
        this.label = _name;
        this.jvmOptionFile = path.join(_storagePath, Constants.JVM_OPTION_FILE);
        this._configurationPath = path.join(_storagePath, 'conf', 'server.xml');
        this.basePathName = path.basename(_storagePath);
    }

    public setDebugInfo(port: number, workspace: vscode.WorkspaceFolder): void {
        this._isDebugging = true;
        this._debugPort = port;
        this._debugWorkspace = workspace;
    }

    public clearDebugInfo(): void {
        this._isDebugging = false;
        this._debugPort = undefined;
        this._debugWorkspace = undefined;
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
        this._state = started ? ServerState.RunningServer : ServerState.IdleServer;
        vscode.commands.executeCommand('tomcat.tree.refresh');
    }

    public isStarted(): boolean {
        return this._state === ServerState.RunningServer;
    }

    public getState() : string {
        return this._state;
    }

    public getName(): string {
        return this._name;
    }

    public rename(newName: string): void {
        this._name = newName;
        this.label = newName;
    }

    public getInstallPath(): string {
        return this._installPath;
    }

    public getServerConfigPath(): string {
        return this._configurationPath;
    }

    public getStoragePath(): string {
        return this._storagePath;
    }
}
