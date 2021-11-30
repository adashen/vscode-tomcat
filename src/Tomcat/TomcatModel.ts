'use strict';

import * as fse from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import * as vscode from "vscode";
import * as Constants from "../Constants";
import { Utility } from "../Utility";
import { TomcatServer } from "./TomcatServer";

export class TomcatModel {
    private _serverList: TomcatServer[] = [];
    private _serversJsonFile: string;

    constructor(public defaultStoragePath: string) {
        this._serversJsonFile = path.join(defaultStoragePath, 'servers.json');
        this.initServerListSync();
        vscode.debug.onDidTerminateDebugSession((session: vscode.DebugSession) => {
            if (session && session.name && session.name.startsWith(Constants.DEBUG_SESSION_NAME)) {
                this.clearServerDebugInfo(session.name.split('_').pop());
            }
        });
    }

    public getServerSet(): TomcatServer[] {
        return this._serverList;
    }

    public getTomcatServer(serverName: string): TomcatServer | undefined {
        return this._serverList.find((item: TomcatServer) => item.getName() === serverName);
    }

    public async saveServerList(): Promise<void> {
        try {
            await fse.outputJson(this._serversJsonFile, this._serverList.map((s: TomcatServer) => {
                return { _name: s.getName(), _installPath: s.getInstallPath(), _storagePath: s.getStoragePath(), _runInPlace: s.isRunInPlace() };
            }));
            vscode.commands.executeCommand('tomcat.tree.refresh');
        } catch (err) {
            console.error(err.toString());
        }
    }

    public async updateJVMOptions(server: TomcatServer) : Promise<void> {
        const useStartupScripts: boolean = await Utility.getVSCodeConfigBoolean(Constants.CONF_USE_STARTUP_SCRIPTS);
        let result: string[] = [];
        if (useStartupScripts) {
            // result = await this.createBaseJVMOpts(server);
        }
        else {
            result = await this.createJVMClasspathOption(server);
        }
        if (server.getDebugPort()) {
            result.push(`${Constants.DEBUG_ARGUMENT_KEY}${server.getDebugPort()}`);
        }
        if (await fse.pathExists(server.jvmOptionFile)) {
            result = result.concat(await this.loadJVMOptionsFileArgs(server));
        }
        if (!useStartupScripts) {
            result = await this.concatBootstrapFileJVMOpt(result);
        }
        server.jvmOptions = result;
    }

    private async createBaseJVMOpts(server: TomcatServer): Promise<string[]> {
        const installPath: string = server.getInstallPath();
        const catalinaBase: string = server.getStoragePath();
        return [
            `${Constants.CATALINA_BASE_KEY}="${catalinaBase}"`,
            `${Constants.CATALINA_HOME_KEY}="${installPath}"`,
            `${Constants.ENCODING}`
        ];
    }

    private async createJVMClasspathOption(server: TomcatServer): Promise<string[]> {
        const installPath: string = server.getInstallPath();
        const catalinaBase: string = server.getStoragePath();
        const bootStrap: string = path.join(installPath, 'bin', 'bootstrap.jar');
        const tomcat: string = path.join(installPath, 'bin', 'tomcat-juli.jar');
        return [
            `${Constants.CLASS_PATH_KEY} "${[bootStrap, tomcat].join(path.delimiter)}"`,
            `${Constants.CATALINA_BASE_KEY}="${catalinaBase}"`,
            `${Constants.CATALINA_HOME_KEY}="${installPath}"`,
            `${Constants.ENCODING}`
        ];
    }

    private async loadJVMOptionsFileArgs(server: TomcatServer): Promise<string[]> {
        const filterFunction: (para: string) => boolean = (para: string): boolean => {
            if (!para.startsWith('-')) {
                return false;
            }
            let valid: boolean = true;
            Constants.JVM_DEFAULT_OPTIONS_KEYS.forEach((key: string) => {
                if (para.startsWith(key)) {
                    valid = false;
                    return;
                }
            });
            return valid;
        };
        let result = await Utility.readFileLineByLine(server.jvmOptionFile, filterFunction);
        const tmpDirConfiguration: string = result.find((element: string) => {
            return element.indexOf(Constants.JAVA_IO_TEMP_DIR_KEY) >= 0;
        });
        if (!tmpDirConfiguration) {
            result = result.concat(`${Constants.JAVA_IO_TEMP_DIR_KEY}="${path.join(server.getStoragePath(), 'temp')}"`);
        }
        return result;
    }

    private async concatBootstrapFileJVMOpt(jvmOptions: string[]) : Promise<string[]> {
        return jvmOptions.concat([Constants.BOOTSTRAP_FILE, '"$@"']);
    }

    public deleteServer(tomcatServer: TomcatServer): boolean {
        const index: number = this._serverList.findIndex((item: TomcatServer) => item.getName() === tomcatServer.getName());
        if (index > -1) {
            const oldServer: TomcatServer[] = this._serverList.splice(index, 1);
            if (!_.isEmpty(oldServer)) {
                if (!tomcatServer.isRunInPlace()) {
                    fse.remove(tomcatServer.getStoragePath());
                }
                this.saveServerList();
                return true;
            }
        }

        return false;
    }

    public addServer(tomcatServer: TomcatServer): void {
        const index: number = this._serverList.findIndex((item: TomcatServer) => item.getName() === tomcatServer.getName());
        if (index > -1) {
            this._serverList.splice(index, 1);
        }
        this._serverList.push(tomcatServer);
        this.saveServerList();
    }

    public saveServerListSync(): void {
        try {
            fse.outputJsonSync(this._serversJsonFile, this._serverList.map((s: TomcatServer) => {
                return { _name: s.getName(), _installPath: s.getInstallPath(), _storagePath: s.getStoragePath(), _runInPlace: s.isRunInPlace() };
            }));
        } catch (err) {
            console.error(err.toString());
        }
    }

    private initServerListSync(): void {
        try {
            if (fse.existsSync(this._serversJsonFile)) {
                const objArray: {}[] = fse.readJsonSync(this._serversJsonFile);
                if (!_.isEmpty(objArray)) {
                    this._serverList = this._serverList.concat(objArray.map(
                        (obj: { _name: string, _installPath: string, _storagePath: string, _runInPlace: boolean }) => {
                            return new TomcatServer(obj._name, obj._installPath, obj._storagePath, obj._runInPlace || false);
                        }));
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    private clearServerDebugInfo(basePathName: string): void {
        const server: TomcatServer = this._serverList.find((s: TomcatServer) => { return s.basePathName === basePathName; });
        if (server) {
            server.clearDebugInfo();
        }
    }
}
