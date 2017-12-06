'use strict';

import * as fse from "fs-extra";
// tslint:disable-next-line:no-require-imports
import opn = require("opn");
import * as path from "path";
import * as vscode from "vscode";
import { Utility } from "../Utility";
import { Tomcat } from "./Tomcat";
import { TomcatServer } from "./TomcatServer";

export class TomcatController {
    private _outputChannels: Map<string, vscode.OutputChannel>;
    private _onDidChangeTreeData: vscode.EventEmitter<TomcatServer>;
    private _tomcat: Tomcat;

    constructor(tomcat: Tomcat, onDidChangeTreeData: vscode.EventEmitter<TomcatServer>) {
      this._outputChannels = new Map<string, vscode.OutputChannel>();
      this._onDidChangeTreeData = onDidChangeTreeData;
      this._tomcat = tomcat;
    }

    public getTomcatServer(serverName: string): TomcatServer {
        return this._tomcat.getTomcatServer(serverName);
    }

    public getServerSet(): TomcatServer[] {
        return this._tomcat.getServerSet();
    }

    public deleteServer(tomcatServer: TomcatServer): void {
        if (!tomcatServer) {
            throw (new Error(Utility.localize('tomcatExt.noserver', 'Tomcat server is undefined')));
        }

        if (this._tomcat.deleteServer(tomcatServer)) {
            const output: vscode.OutputChannel = this.getOutput(tomcatServer);
            this._outputChannels.delete(this.getChannelName(tomcatServer));
            output.dispose();
        }
        this._onDidChangeTreeData.fire();
    }

    public async openConfig(tomcatServer: TomcatServer): Promise<void> {
        if (!tomcatServer) {
            throw (new Error(Utility.localize('tomcatExt.noserver', 'Tomcat server is undefined')));
        }

        const exist: boolean = await Utility.openFileIfExists(tomcatServer.getServerConfigPath());
        if (!exist) {
            throw (new Error(Utility.localize('tomcatExt.noconfig', 'The tomcat server is broken. It does not have server.xml')));
        }
    }

    public async createTomcatServer(serverName: string, tomcatInstallPath: string): Promise<void> {
        const catalinaBasePath: string = path.join(this._tomcat.getExtensionPath(), serverName);
        const confPath: string = path.join(catalinaBasePath, 'conf');
        const logPath: string = path.join(catalinaBasePath, 'logs');
        const tempPath: string = path.join(catalinaBasePath, 'temp');
        const webappsPath: string = path.join(catalinaBasePath, 'webapps');
        const workPath: string = path.join(catalinaBasePath, 'work');

        const serverConfigSrc: string = path.join(tomcatInstallPath, 'conf', 'server.xml');
        const webConfigSrc: string = path.join(tomcatInstallPath, 'conf', 'web.xml');
        const serverConfigTarget: string = path.join(catalinaBasePath, 'conf', 'server.xml');
        const webConfigTarget: string = path.join(catalinaBasePath, 'conf', 'web.xml');
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

            tomcatServer = new TomcatServer(serverName, tomcatInstallPath, this._tomcat.getExtensionPath());
            this._tomcat.addServer(tomcatServer);
            this._onDidChangeTreeData.fire();
        } catch (e) {
            console.error(e);
            Promise.reject(new Error(e.toString()));
        }
    }

    public async stopServer(serverInfo: TomcatServer): Promise<void> {
        if (!serverInfo) {
            return Promise.reject(new Error(Utility.localize('tomcatExt.noserver', 'Tomcat server is undefined')));
        }

        try {
            await Utility.executeCMD('java', this.getJavaArgs(serverInfo, false), {shell: true}, this.getOutput(serverInfo));
            return Promise.resolve();
        } catch (err) {
            return Promise.reject(new Error(err.toString()));
        }
    }

    public async runOnServer(serverInfo: TomcatServer, packagePath: string, debug: boolean = false): Promise<void> {
        if (!serverInfo) {
            return Promise.reject(new Error(Utility.localize('tomcatExt.noserver', 'Tomcat server is undefined')));
        }

        let appName: string = path.basename(packagePath);
        appName = appName.replace(/\.[^/.]+$/, '');
        const serverName: string = serverInfo.getName();
        const appPath: string = path.join(this._tomcat.getExtensionPath(), serverName, 'webapps', appName);
        if (serverInfo.isStarted()) {
            await this.stopServer(serverInfo);
        }

        try {
            const output: vscode.OutputChannel = this.getOutput(serverInfo);
            await Utility.cleanAndCreateFolder(appPath);
            await Utility.executeCMD('jar', ['xvf', `${packagePath}`], {cwd: appPath}, output);

            let port: number | undefined;
            let workspaceFolder: vscode.WorkspaceFolder | undefined;
            if (debug) {
                port = await Utility.getFreePort();
                workspaceFolder = Utility.getWorkspaceFolder(packagePath);
                if (!workspaceFolder) {
                    Promise.reject(new Error(
                        Utility.localize('tomcatExt.noworkspacefolder', 'The selected package is not under current workspace')));
                }
            }
            await this.startTomcat(serverInfo, appName, output, port, workspaceFolder);
            return Promise.resolve();
        } catch (err) {
            return Promise.reject(new Error(err.toString()));
        }
    }

    public dispose(): void {
        this._tomcat.saveServerListSync();
        this._outputChannels.forEach((value: vscode.OutputChannel, key: string) => value.dispose());
    }

    private setStarted(serverInfo: TomcatServer, started: boolean): void {
        serverInfo.setStarted(started);
        this._onDidChangeTreeData.fire();
    }

    private getJavaArgs(serverInfo: TomcatServer, start: boolean, port?: number): string[] {
        const serverName: string = serverInfo.getName();
        const catalinaBase: string = path.join(this._tomcat.getExtensionPath(), serverName);
        const bootStrap: string = path.join(serverInfo.getTomcatPath(), 'bin', 'bootstrap.jar');
        const tomcat: string = path.join(serverInfo.getTomcatPath(), 'bin', 'tomcat-juli.jar');
        const sep: string = path.delimiter;
        const classPath: string = `${bootStrap}${sep}${tomcat}`;
        const tmdir: string = path.join(catalinaBase, 'temp');
        let args: string[] = [`-classpath "${classPath}"`,
        `"-Dcatalina.base=${catalinaBase}"`,
        `"-Dcatalina.home=${serverInfo.getTomcatPath()}"`,
        `"-Djava.io.tmpdir=${tmdir}"`,
        '"-Dfile.encoding=UTF8"',
        'org.apache.catalina.startup.Bootstrap',
        '"$@"'];

        if (start) {
            if (port) {
                args = [`-agentlib:jdwp=transport=dt_socket,suspend=y,server=y,address=localhost:${port}`].concat(args);
            }
            args.push('start');
        } else {
            args.push('stop');
        }

        return args;
    }

    private startDebugSession(debugPort ?: number, workspaceFolder ?: vscode.WorkspaceFolder): void {
        if (debugPort && workspaceFolder) {
            const config: vscode.DebugConfiguration = {
                type: 'java',
                name: 'Tomcat Debug (Attach)',
                request: 'attach',
                hostName: 'localhost',
                port: debugPort
            };
            vscode.debug.startDebugging(workspaceFolder, config);
        }
    }

    private async startTomcat(serverInfo: TomcatServer, appName: string, output: vscode.OutputChannel,
                              debugPort ?: number, workspaceFolder?: vscode.WorkspaceFolder): Promise<void> {
        let statusBar: vscode.StatusBarItem;
        let statusBarCommand: vscode.Disposable;
        let serverPort: string;
        const args: string[] = this.getJavaArgs(serverInfo, true, debugPort);

        try {
            serverPort = await Utility.getServerPort(serverInfo.getServerConfigPath());
        } catch {
            console.error('Cannot parse port from server.xml');
        }

        try {
            if (serverPort) {
                statusBar = vscode.window.createStatusBarItem();
                statusBar.command = `open.${serverInfo.getName()}`;

                // tslint:disable-next-line:no-http-string
                const serviceuri: string = `http://localhost:${serverPort}/${appName}`;
                statusBar.text = `Open http://localhost:${serverPort}/${appName}`;
                statusBarCommand = vscode.commands.registerCommand(statusBar.command, async () => {
                    opn(serviceuri);
                });
                statusBar.show();
            }

            this.setStarted(serverInfo, true);
            const javaProcss: Promise<void> = Utility.executeCMD('java', args, { shell: true }, output);
            this.startDebugSession(debugPort, workspaceFolder);
            await javaProcss;
            this.setStarted(serverInfo, false);
            this.disposeResource(statusBarCommand);
            this.disposeResource(statusBar);
        } catch (err) {
            this.setStarted(serverInfo, false);
            this.disposeResource(statusBarCommand);
            this.disposeResource(statusBar);
            return Promise.reject(new Error(err.toString()));
        }
    }

    private disposeResource(resource: vscode.Disposable | undefined): void {
        if (resource) {
            resource.dispose();
        }
    }

    private getChannelName(serverInfo: TomcatServer): string {
        return `Tomcat_${serverInfo.getName()}`;
    }

    private getOutput(serverInfo: TomcatServer): vscode.OutputChannel {
        const channelName: string = this.getChannelName(serverInfo);
        let output: vscode.OutputChannel = this._outputChannels.get(channelName);
        if (!output) {
            output  = vscode.window.createOutputChannel(channelName);
            this._outputChannels.set(channelName, output);
        }
        return output;
    }
}
