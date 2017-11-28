"use strict";

import { TomcatServer } from "./TomcatServer";
import * as path from "path";
import * as vscode from "vscode";
import { Utility } from "../utility";
import * as fse from "fs-extra";

export class Tomcat {
    private _status: vscode.StatusBarItem;
    private _extensionpath: string;
    private _serverList: TomcatServer[];

    constructor(storagePath: string) {
        this._status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this._extensionpath = path.join(storagePath, "/tomcat");
        this._serverList = [];
        this.initServerListSync();
    }


    getTomcatServer(serverName: string): TomcatServer | undefined {
        return this._serverList.find((item) => item.getName() === serverName);
    }

    deleteServer(tomcatServer: TomcatServer): void {
        const index: number = this._serverList.findIndex((item) => item.getName() === tomcatServer.getName());
        if (index > -1) {
            const oldServer: TomcatServer[] = this._serverList.splice(index, 1);
            if (oldServer.length > 0) {
                const catalinaBasePath: string = path.join(this._extensionpath, oldServer[0].getName());
                Utility.deleteFolderRecursive(catalinaBasePath);
                oldServer[0].dispose();
            }
        }
    }

    async createTomcatServer(serverName: string, tomcatInstallPath: string): Promise<void> {
        const catalinaBasePath: string = path.join(this._extensionpath, serverName);
        const confPath: string = path.join(catalinaBasePath, "conf");
        const logPath: string = path.join(catalinaBasePath, "logs");
        const tempPath: string = path.join(catalinaBasePath, "temp");
        const webappsPath: string = path.join(catalinaBasePath, "webapps");
        const workPath: string = path.join(catalinaBasePath, "work");

        const serverConfigSrc: string = path.join(tomcatInstallPath, "conf", "server.xml");
        const webConfigSrc: string = path.join(tomcatInstallPath, "conf", "web.xml");
        const serverConfigTarget: string = path.join(catalinaBasePath, "conf", "server.xml");
        const webConfigTarget: string = path.join(catalinaBasePath, "conf", "web.xml");
        let tomcatServer: TomcatServer;

        try {
            await Utility.cleanAndCreateFolder(catalinaBasePath);
            await Utility.cleanAndCreateFolder(confPath);
            await Utility.cleanAndCreateFolder(logPath);
            await Utility.cleanAndCreateFolder(tempPath);
            await Utility.cleanAndCreateFolder(webappsPath);
            await Utility.cleanAndCreateFolder(workPath);
            await fse.copy(serverConfigSrc, serverConfigTarget);
            await fse.copy(webConfigSrc, webConfigTarget);

            tomcatServer = new TomcatServer(serverName, tomcatInstallPath);
            this.addServer(tomcatServer);
        } catch(e) {
            console.log(e);
            Promise.reject(new Error(e.toString()));
        }
    }

    async stopServer(serverInfo: TomcatServer): Promise<void> {
        if (!serverInfo) {
            return Promise.reject(new Error(Utility.localize("tomcatExt.noserver", "Tomcat server is undefined")));
        }
        await serverInfo.stop(this._extensionpath);
    }

    async runOnServer(serverInfo: TomcatServer, packagePath: string, debug: boolean = false): Promise<void> {
        if (!serverInfo) {
            return Promise.reject(new Error(Utility.localize("tomcatExt.noserver", "Tomcat server is undefined")));
        }
        await serverInfo.run(this._extensionpath, packagePath, debug);
    }

    getServerSet(): TomcatServer[] {
        return this._serverList;
    }

    private addServer(tomcatServer: TomcatServer): void {
        const index: number = this._serverList.findIndex((item) => item.getName() === tomcatServer.getName());
        if (index > -1) {
            const oldServer: TomcatServer[] = this._serverList.splice(index, 1);
            if (oldServer.length > 0) {
                oldServer[0].dispose();
            }
        }
        this._serverList.push(tomcatServer);
    }

    private initServerListSync(): void {
        try {
            const exists: boolean = fse.existsSync(this._extensionpath);
            if (exists) {
                const serverFilePath: string = path.join(this._extensionpath, "servers.json");
                const existsFile: boolean = fse.existsSync(serverFilePath);
                if (existsFile) {
                    const objArray: Array<any> = fse.readJsonSync(serverFilePath);
                    if (objArray && objArray.length > 0) {
                        this._serverList = this._serverList.concat(objArray.map((obj: any) => {
                            console.log(obj);
                            return new TomcatServer(obj._name, obj._tomcatPath);
                        }));
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    private saveServerListSync(): void {
        try {
            const serverFilePath: string = path.join(this._extensionpath, "servers.json");
            fse.outputJsonSync(serverFilePath, this._serverList);
        } catch (err) {
            console.error(err.toString());
        }
    }

    dispose(): void {
        this.saveServerListSync();
        this._serverList.forEach((element) => element.dispose());
        this._status.dispose();
    }
}
