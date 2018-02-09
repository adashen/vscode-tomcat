'use strict';

import * as path from "path";
import * as vscode from "vscode";
import { ServerState } from "../Constants";
import { Utility } from "../Utility";

export class TomcatServer extends vscode.TreeItem implements vscode.QuickPickItem {
    public needRestart: boolean = false;
    public label: string;
    public description: string;
    public outputChannel: vscode.OutputChannel;
    private _state: ServerState = ServerState.IdleServer;
    private _isDebugging: boolean = false;
    private _debugPort: number;
    private _debugWorkspace: vscode.WorkspaceFolder;

    constructor(private _name: string, private _installPath: string, private _storagePath: string) {
        super(_name);
        this.label = _name;
        this.outputChannel = vscode.window.createOutputChannel(`tomcat_${this._name}`);
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
        return path.join(this._storagePath, 'conf', 'server.xml');
    }

    public getStoragePath(): string {
        return this._storagePath;
    }
}
