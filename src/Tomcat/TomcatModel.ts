'use strict';

import * as fse from "fs-extra";
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
                return { _name: s.getName(), _installPath: s.getInstallPath(), _storagePath: s.getStoragePath() };
            }));
            vscode.commands.executeCommand('tomcat.tree.refresh');
        } catch (err) {
            console.error(err.toString());
        }
    }

    public async updateJVMOptions(serverName: string) : Promise<void> {
        const server: TomcatServer = this.getTomcatServer(serverName);
        const installPath: string = server.getInstallPath();
        const catalinaBase: string = server.getStoragePath();
        const bootStrap: string = path.join(installPath, 'bin', 'bootstrap.jar');
        const tomcat: string = path.join(installPath, 'bin', 'tomcat-juli.jar');
        let result: string[] = [
            `${Constants.CLASS_PATH_KEY} "${[bootStrap, tomcat].join(path.delimiter)}"`,
            `${Constants.CATALINA_BASE_KEY}="${catalinaBase}"`,
            `${Constants.CATALINA_HOME_KEY}="${installPath}"`,
            `${Constants.ENCODING}`
        ];

        if (!await fse.pathExists(server.jvmOptionFile)) {
            server.jvmOptions = result.concat([Constants.BOOTSTRAP_FILE, '"$@"']);
            return;
        }
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
        result = result.concat(await Utility.readFileLineByLine(server.jvmOptionFile, filterFunction));
        const tmpDirConfiguration: string = result.find((element: string) => {
            return element.indexOf(Constants.JAVA_IO_TEMP_DIR_KEY) >= 0;
        });
        if (!tmpDirConfiguration) {
            result = result.concat(`${Constants.JAVA_IO_TEMP_DIR_KEY}="${path.join(catalinaBase, 'temp')}"`);
        }
        server.jvmOptions = result.concat([Constants.BOOTSTRAP_FILE, '"$@"']);
    }

    public deleteServer(tomcatServer: TomcatServer): boolean {
        const index: number = this._serverList.findIndex((item: TomcatServer) => item.getName() === tomcatServer.getName());
        if (index > -1) {
            const oldServer: TomcatServer[] = this._serverList.splice(index, 1);
            if (!Utility.isEmpty(oldServer)) {
                fse.remove(tomcatServer.getStoragePath());
                this.saveServerList();
                tomcatServer.outputChannel.dispose();
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
                return { _name: s.getName(), _installPath: s.getInstallPath(), _storagePath: s.getStoragePath() };
            }));
        } catch (err) {
            console.error(err.toString());
        }
    }

    private initServerListSync(): void {
        try {
            if (fse.existsSync(this._serversJsonFile)) {
                const objArray: {}[] = fse.readJsonSync(this._serversJsonFile);
                if (!Utility.isEmpty(objArray)) {
                    this._serverList = this._serverList.concat(objArray.map(
                        (obj: { _name: string, _installPath: string, _storagePath: string }) => {
                            return new TomcatServer(obj._name, obj._installPath, obj._storagePath);
                        }));
                }
            }
        } catch (err) {
            console.error(err);
        }
    }
}
