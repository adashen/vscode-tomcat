'use strict';

import * as fse from "fs-extra";
import * as path from "path";
import * as readline from "readline";
import * as vscode from "vscode";
import * as Constants from "../Constants";
import { ServerState } from "../Constants";
import { Utility } from "../Utility";

export class TomcatServer implements vscode.QuickPickItem {
    public needRestart: boolean = false;
    public newCreated: boolean = false;
    public label: string;
    public description: string;
    public outputChannel: vscode.OutputChannel;
    public vmOptions: string[];
    private _state: ServerState = ServerState.IdleServer;
    private _isDebugging: boolean = false;
    private _debugPort: number;
    private _debugWorkspace: vscode.WorkspaceFolder;
    private readonly _serverConfigFile: string;
    private readonly _vmOptionFile: string;

    constructor(private _name: string, private _installPath: string, private _storagePath: string) {
        this.label = _name;
        this.outputChannel = vscode.window.createOutputChannel(`tomcat_${this._name}`);
        this._serverConfigFile = path.join(this._storagePath, this._name, 'conf', 'server.xml');
        this. _vmOptionFile = path.join(this._storagePath, this._name, 'vm.properties');
    }

    public getVMOptionFile(): string {
        return this._vmOptionFile;
    }

    public async updateVMOptions(): Promise<void> {
        const catalinaBase: string = path.join(this._storagePath, this._name);
        const bootStrap: string = path.join(this._installPath, 'bin', 'bootstrap.jar');
        const tomcat: string = path.join(this._installPath, 'bin', 'tomcat-juli.jar');
        let result: string[] = [
            `${Constants.CLASS_PATH_KEY} "${bootStrap}${path.delimiter}${tomcat}"`,
            `"${Constants.CATALINA_BASE_KEY}=${catalinaBase}"`,
            `"${Constants.CATALINA_HOME_KEY}=${this._installPath}"`,
            `"${Constants.JAVA_IO_TEMP_DIR_KEY}=${path.join(catalinaBase, 'temp')}"`,
            `"${Constants.FILE_ENCODING_KEY}=UTF8"`
        ];

        if (!await fse.pathExists(this._vmOptionFile)) {
            this.vmOptions = result.concat([Constants.BOOTSTRAP_FILE, '"$@"']);
            return;
        }
        await new Promise((resolve: () => void): void => {
            const lineReader: readline.ReadLine = readline.createInterface({
                input: fse.createReadStream(this._vmOptionFile),
                crlfDelay: Infinity
            });
            lineReader.on('line', (line: string) => {
                if (line.startsWith('-')) {
                    Constants.JVM_DEFAULT_OPTIONS_KEYS.forEach((key: string) => {
                        if (line.startsWith(key)) {
                            return;
                        }
                    });
                    result = result.concat(line);
                }
            });
            lineReader.on('close', () => {
                this.vmOptions = result.concat([Constants.BOOTSTRAP_FILE, '"$@"']);
                resolve();
            });
        });
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

    public getInstallPath(): string {
        return this._installPath;
    }

    public getServerConfigPath(): string {
        return this._serverConfigFile;
    }

    public getStoragePath(): string {
        return this._storagePath;
    }
}
