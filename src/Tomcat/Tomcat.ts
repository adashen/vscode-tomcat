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
            await this.cleanAndCreateFolder(catalinaBasePath);
            await this.cleanAndCreateFolder(confPath);
            await this.cleanAndCreateFolder(logPath);
            await this.cleanAndCreateFolder(tempPath);
            await this.cleanAndCreateFolder(webappsPath);
            await this.cleanAndCreateFolder(workPath);
            await fse.copy(serverConfigSrc, serverConfigTarget);
            await fse.copy(webConfigSrc, webConfigTarget);

            tomcatServer = new TomcatServer(serverName, tomcatInstallPath);
            this._serverList.push(tomcatServer);
        } catch(e) {
            console.log(e);
            Promise.reject(new Error(e.toString()));
        }
    }

    async stopServer(serverInfo: TomcatServer): Promise<void> {
        if (!serverInfo) {
            return Promise.reject(new Error(Utility.localize("tomcatExt.noserver", "Tomcat server is undefined")));
        }
        try {
            await Utility.executeCMD("java", this.getJavaArgs(serverInfo, false, false), {shell: true}, serverInfo.getOutput());
            serverInfo.setStarted(false);
            return Promise.resolve();
        } catch(err) {
            serverInfo.setStarted(false);
            return Promise.reject(new Error(err.toString()));
        }
    }

    async runOnServer(serverInfo: TomcatServer, packagePath: string, debug: boolean = false): Promise<void> {
        if (!serverInfo) {
            return Promise.reject(new Error(Utility.localize("tomcatExt.noserver", "Tomcat server is undefined")));
        }

        try {
            let appName: string = path.basename(packagePath);
            appName = appName.replace(/\.[^/.]+$/, "");
            const serverName: string = serverInfo.getName();
            const appPath: string = path.join(this._extensionpath, serverName, "webapps", appName);
            serverInfo.setStarted(true);

            await this.cleanAndCreateFolder(appPath);
            await Utility.executeCMD("jar", ["xvf", `${packagePath}`], {cwd: appPath}, serverInfo.getOutput());
            await Utility.executeCMD("java",
                this.getJavaArgs(serverInfo, true, debug), {
                    shell: true
                }, serverInfo.getOutput());

            serverInfo.setStarted(false);
            return Promise.resolve();
        } catch(err) {
            serverInfo.setStarted(false);
            return Promise.reject(new Error(err.toString()));
        }
    }

    getServerSet(): TomcatServer[] {
        return this._serverList;
    }

    private getJavaArgs(serverInfo: TomcatServer, start: boolean, debug: boolean): string[] {
        const serverName: string = serverInfo.getName();
        const catalinaBase: string = path.join(this._extensionpath, serverName);
        const bootStrap: string = path.join(serverInfo.getTomcatPath(), "bin", "bootstrap.jar");
        const tomcat: string = path.join(serverInfo.getTomcatPath(), "bin", "tomcat-juli.jar");
        const classPath: string = `${bootStrap};${tomcat}`;
        const tmdir: string = path.join(catalinaBase, "temp");
        let args: string[] = [`-classpath "${classPath}"`,
        `"-Dcatalina.base=${catalinaBase}"`,
        `"-Dcatalina.home=${serverInfo.getTomcatPath()}"`,
        `"-Djava.io.tmpdir=${tmdir}"`,
        "org.apache.catalina.startup.Bootstrap",
        // tslint:disable-next-line:quotemark
        '"$@"'];

        if (start) {
            args.push("start");
        } else {
            args.push("stop");
        }

        // todo: debug
        return args;
    }

    private addServer(tomcatServer: TomcatServer): void {
        this.deleteServer(tomcatServer);
        this._serverList.push(tomcatServer);
    }

    private deleteServer(tomcatServer: TomcatServer): void {
        const index: number = this._serverList.findIndex((item) => item.getName() === tomcatServer.getName());
        if (index > -1) {
            const oldServer: TomcatServer[] = this._serverList.splice(index, 1);
            if (oldServer.length > 0) {
                oldServer[0].dispose();
            }
        }
    }

    private async deleteFolderRecursive(dir: string): Promise<void> {
        const exists: boolean = await fse.pathExists(dir);
        if (exists) {
            await fse.remove(dir);
        }
        return Promise.resolve();
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

    private async cleanAndCreateFolder(dir: string): Promise<void> {
        await this.deleteFolderRecursive(dir);
        await fse.mkdirs(dir);
        return Promise.resolve();
    }

    dispose(): void {
        this.saveServerListSync();
        this._serverList.forEach((element) => element.dispose());
        this._status.dispose();
    }
}
