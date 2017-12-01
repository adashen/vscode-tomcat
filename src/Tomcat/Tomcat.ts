"use strict";

import { TomcatServer } from "./TomcatServer";
import * as path from "path";
import { Utility } from "../utility";
import * as fse from "fs-extra";

export class Tomcat {
    private _extensionpath: string;
    private _serverList: TomcatServer[];

    constructor(storagePath: string) {
        this._extensionpath = path.join(storagePath, "/tomcat");
        this._serverList = [];
        this.initServerListSync();
    }

    getExtensionPath(): string {
        return this._extensionpath;
    }

    getTomcatServer(serverName: string): TomcatServer | undefined {
        return this._serverList.find((item) => item.getName() === serverName);
    }

    deleteServer(tomcatServer: TomcatServer): boolean {
        const index: number = this._serverList.findIndex((item) => item.getName() === tomcatServer.getName());
        if (index > -1) {
            const oldServer: TomcatServer[] = this._serverList.splice(index, 1);
            if (oldServer.length > 0) {
                const catalinaBasePath: string = path.join(this._extensionpath, oldServer[0].getName());
                Utility.deleteFolderRecursive(catalinaBasePath);
                this.saveServerList();
                return true;
            }
        }

        return false;
    }


    getServerSet(): TomcatServer[] {
        return this._serverList;
    }

    addServer(tomcatServer: TomcatServer): void {
        const index: number = this._serverList.findIndex((item) => item.getName() === tomcatServer.getName());
        if (index > -1) {
            this._serverList.splice(index, 1);
        }
        this._serverList.push(tomcatServer);
        this.saveServerList();
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

    saveServerListSync(): void {
        try {
            const serverFilePath: string = path.join(this._extensionpath, "servers.json");
            fse.outputJsonSync(serverFilePath, this._serverList);
        } catch (err) {
            console.error(err.toString());
        }
    }

    private async saveServerList(): Promise<void> {
        try {
            const serverFilePath: string = path.join(this._extensionpath, "servers.json");
            await fse.outputJson(serverFilePath, this._serverList);
        } catch(err) {
            console.error(err.toString());
        }
    }
}
