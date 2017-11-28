"use strict";

import * as vscode from "vscode";
import { Utility } from "../utility";
import * as path from "path";

export class TomcatServer {
    private _name: string;
    private _tomcatPath: string;
    private _started: boolean;
    private _output: vscode.OutputChannel;

    constructor(name: string, tomcatPath: string) {
        this._name = name.trim();
        this._tomcatPath = tomcatPath.trim();
        this._started = false;
        this._output = vscode.window.createOutputChannel(`Tomcat_${this._name}`);
    }

    setStarted(started: boolean): void {
        this._started = started;
    }

    isStarted(): boolean {
        return this._started;
    }

    getName(): string {
        return this._name;
    }

    getTomcatPath(): string {
        return this._tomcatPath;
    }

    dispose():void {
        this._output.dispose();
    }

    private getJavaArgs(extensionpath: string, start: boolean, port: number | undefined = undefined): string[] {
        const serverName: string = this.getName();
        const catalinaBase: string = path.join(extensionpath, serverName);
        const bootStrap: string = path.join(this.getTomcatPath(), "bin", "bootstrap.jar");
        const tomcat: string = path.join(this.getTomcatPath(), "bin", "tomcat-juli.jar");
        const classPath: string = `${bootStrap};${tomcat}`;
        const tmdir: string = path.join(catalinaBase, "temp");
        let args: string[] = [`-classpath "${classPath}"`,
        `"-Dcatalina.base=${catalinaBase}"`,
        `"-Dcatalina.home=${this.getTomcatPath()}"`,
        `"-Djava.io.tmpdir=${tmdir}"`,
        `"-Dfile.encoding=UTF8"`,
        "org.apache.catalina.startup.Bootstrap",
        // tslint:disable-next-line:quotemark
        '"$@"'];

        if (start) {
            if (port) {
             //   args.push(`-agentlib:jdwp=transport=dt_socket,suspend=y,server=y,address=localhost:${port}`);
                // const config: vscode.DebugConfiguration = {
                //     "type": "java",
                //     "name": "Debug (Attach)",
                //     "request": "attach",
                //     "hostName": "localhost",
                //     "port": port
                // };
                args = [`-agentlib:jdwp=transport=dt_socket,suspend=y,server=y,address=localhost:${port}`].concat(args);
            }
            args.push("start");
        } else {
            args.push("stop");
        }

        return args;
    }

    async stop(extensionpath: string): Promise<void> {
        try {
            await Utility.executeCMD("java", this.getJavaArgs(extensionpath, false), {shell: true}, this._output);
            this.setStarted(false);
            return Promise.resolve();
        } catch(err) {
            this.setStarted(false);
            return Promise.reject(new Error(err.toString()));
        }
    }

    async run(extensionpath: string, packagePath: string, debug: boolean = false): Promise<void> {
        try {
            let appName: string = path.basename(packagePath);
            appName = appName.replace(/\.[^/.]+$/, "");
            const serverName: string = this.getName();
            const appPath: string = path.join(extensionpath, serverName, "webapps", appName);
            this.setStarted(true);

            await Utility.cleanAndCreateFolder(appPath);
            await Utility.executeCMD("jar", ["xvf", `${packagePath}`], {cwd: appPath}, this._output);

            let port: number | undefined = undefined;
            if (debug) {
                port= await Utility.getFreePort();
          //      args.push(`-agentlib:jdwp=transport=dt_socket,suspend=y,server=y,address=localhost:${port}`);
                const config: vscode.DebugConfiguration = {
                    "type": "java",
                    "name": "Debug (Attach)",
                    "request": "attach",
                    "hostName": "localhost",
                    "port": port
                };
                const workspaceFolder: vscode.WorkspaceFolder = Utility.getWorkspaceFolder(packagePath);
                if (!workspaceFolder) {
                    Promise.reject(new Error(
                        Utility.localize("tomcatExt.noworkspacefolder", "The selected package is not under current workspace")));
                }
                vscode.debug.startDebugging(workspaceFolder, config);
            }

            const args :string[] = this.getJavaArgs(extensionpath, true, port);
            await Utility.executeCMD("java", args, {
                shell: true
            }, this._output);

            this.setStarted(false);
            return Promise.resolve();
        } catch(err) {
            this.setStarted(false);
            return Promise.reject(new Error(err.toString()));
        }
    }
}
