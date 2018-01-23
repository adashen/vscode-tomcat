'use strict';

import * as fse from "fs-extra";
import * as path from "path";
import { Utility } from "../Utility";
import { TomcatServer } from "./TomcatServer";

export class TomcatModel {
    private _storagePath: string;
    private _serverList: TomcatServer[] = [];
    private _serversJsonFile: string;

    constructor(storagePath: string) {
        this._storagePath = Utility.getWorkspace();
        if (!this._storagePath) {
            this._storagePath = path.join(storagePath, '/tomcat');
        }
        this._serversJsonFile = path.join(storagePath, 'servers.json');
        this.initServerListSync();
    }

    public getStoragePath(): string {
        return this._storagePath;
    }

    public getTomcatServer(serverName: string): TomcatServer | undefined {
        return this._serverList.find((item: TomcatServer) => item.getName() === serverName);
    }

    public deleteServer(tomcatServer: TomcatServer): boolean {
        const index: number = this._serverList.findIndex((item: TomcatServer) => item.getName() === tomcatServer.getName());
        if (index > -1) {
            const oldServer: TomcatServer[] = this._serverList.splice(index, 1);
            if (oldServer.length > 0) {
                const catalinaBasePath: string = path.join(this._storagePath, oldServer[0].getName());
                fse.remove(catalinaBasePath);
                this.saveServerList();
                return true;
            }
        }

        return false;
    }

    public getServerSet(): TomcatServer[] {
        return this._serverList;
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
            fse.outputJsonSync(this._serversJsonFile, this._serverList);
        } catch (err) {
            console.error(err.toString());
        }
    }

    private initServerListSync(): void {
        try {
            if (fse.existsSync(this._serversJsonFile)) {
                const objArray: {}[] = fse.readJsonSync(this._serversJsonFile);
                if (objArray && objArray.length > 0) {
                    this._serverList = this._serverList.concat(objArray.map(
                        (obj: { _name: string, _tomcatPath: string, _storagePath: string }) => {
                            console.error(obj);
                            return new TomcatServer(obj._name, obj._tomcatPath, this._storagePath);
                        }));
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    private async saveServerList(): Promise<void> {
        try {
            await fse.outputJson(this._serversJsonFile, this._serverList);
        } catch (err) {
            console.error(err.toString());
        }
    }
}
