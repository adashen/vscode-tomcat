'use strict';

import * as fse from "fs-extra";
import * as path from "path";
import { Utility } from "../Utility";
import { TomcatServer } from "./TomcatServer";

export class TomcatModel {
    private _serverList: TomcatServer[] = [];
    private _serversJsonFile: string;

    constructor(public defaultStoragePath: string) {
        this._serversJsonFile = path.join(defaultStoragePath, 'servers.json');
        this.initServerListSync();
    }

    public getTomcatServer(serverName: string): TomcatServer | undefined {
        return this._serverList.find((item: TomcatServer) => item.getName() === serverName);
    }

    public deleteServer(tomcatServer: TomcatServer): boolean {
        const index: number = this._serverList.findIndex((item: TomcatServer) => item.getName() === tomcatServer.getName());
        if (index > -1) {
            const oldServer: TomcatServer[] = this._serverList.splice(index, 1);
            if (oldServer.length > 0) {
                fse.remove(tomcatServer.getStoragePath());
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

    public async renameServer(tomcatServer: TomcatServer, newName: string): Promise<void> {
        tomcatServer.setName(newName);
        const oldStoragePath: string = tomcatServer.getStoragePath();
        // tslint:disable-next-line:no-unexternalized-strings
        const newStoragePath: string = path.join(oldStoragePath.substring(0, oldStoragePath.lastIndexOf("\\")), newName);
        tomcatServer.updateStoragePath(newStoragePath);
        await fse.rename(oldStoragePath, tomcatServer.getStoragePath());
        await this.saveServerList();
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
                if (objArray && objArray.length > 0) {
                    this._serverList = this._serverList.concat(objArray.map(
                        (obj: { _name: string, _installPath: string, _storagePath: string }) => {
                            console.error(obj);
                            return new TomcatServer(obj._name, obj._installPath, obj._storagePath);
                        }));
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    private async saveServerList(): Promise<void> {
        try {
            await fse.outputJson(this._serversJsonFile, this._serverList.map((s: TomcatServer) => {
                return { _name: s.getName(), _installPath: s.getInstallPath(), _storagePath: s.getStoragePath() };
            }));
        } catch (err) {
            console.error(err.toString());
        }
    }
}
