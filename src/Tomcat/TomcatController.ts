'use strict';

import * as chokidar from "chokidar";
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
    private _contextExtensionPath: string;

    constructor(tomcat: Tomcat, extensionPath: string, onDidChangeTreeData: vscode.EventEmitter<TomcatServer>) {
      this._outputChannels = new Map<string, vscode.OutputChannel>();
      this._onDidChangeTreeData = onDidChangeTreeData;
      this._contextExtensionPath = extensionPath;
      this._tomcat = tomcat;
    }

    public getTomcatServer(serverName: string): TomcatServer {
        return this._tomcat.getTomcatServer(serverName);
    }

    public getServerSet(): TomcatServer[] {
        return this._tomcat.getServerSet();
    }

    public async deleteServer(tomcatServer: TomcatServer): Promise<void> {
        if (!tomcatServer) {
            throw (new Error(Utility.localize('tomcatExt.noserver', 'No tomcat server.')));
        }

        if (tomcatServer.isStarted()) {
            const confirmation: string = await vscode.window.showWarningMessage('This Tomcat Server is running, are you sure you want to delete it?', 'Yes', 'Cancel');
            if (confirmation !== 'Yes') {
                return;
            }
            await this.stopServer(tomcatServer);
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
            throw (new Error(Utility.localize('tomcatExt.noserver', 'No tomcat server.')));
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
        const rootAppPath: string = path.join(webappsPath, 'ROOT');
        const workPath: string = path.join(catalinaBasePath, 'work');

        const serverConfigSrc: string = path.join(tomcatInstallPath, 'conf', 'server.xml');
        const webConfigSrc: string = path.join(tomcatInstallPath, 'conf', 'web.xml');
        const serverConfigTarget: string = path.join(catalinaBasePath, 'conf', 'server.xml');
        const webConfigTarget: string = path.join(catalinaBasePath, 'conf', 'web.xml');
        const rootPageTarget: string = path.join(rootAppPath, 'index.jsp');
        let tomcatServer: TomcatServer;

        await Utility.cleanAndCreateFolder(catalinaBasePath);
        await Utility.cleanAndCreateFolder(confPath);
        await Utility.cleanAndCreateFolder(logPath);
        await Utility.cleanAndCreateFolder(tempPath);
        await Utility.cleanAndCreateFolder(webappsPath);
        await Utility.cleanAndCreateFolder(workPath);
        await Utility.cleanAndCreateFolder(rootAppPath);
        await fse.copy(serverConfigSrc, serverConfigTarget);
        await fse.copy(webConfigSrc, webConfigTarget);

        tomcatServer = new TomcatServer(serverName, tomcatInstallPath, this._tomcat.getExtensionPath());
        this._tomcat.addServer(tomcatServer);
        this._onDidChangeTreeData.fire();
        const indexJSPSrc: string = path.join(this._contextExtensionPath, 'resources', 'index.jsp');
        fse.copy(indexJSPSrc, rootPageTarget);
    }

    public async stopServer(serverInfo: TomcatServer): Promise<void> {
        if (!serverInfo) {
            throw new Error(Utility.localize('tomcatExt.noserver', 'No tomcat server.'));
        }

        await Utility.executeCMD(this.getOutput(serverInfo), 'java', { shell: true }, ...this.getJavaArgs(serverInfo, false));
    }

    public async startServer(serverInfo: TomcatServer): Promise<void> {
        await this.run(serverInfo);
    }

    public async runOnServer(serverInfo: TomcatServer, packagePath: string, debug: boolean = false): Promise<void> {
        await this.run(serverInfo, packagePath, debug);
    }

    public async openServer(serverInfo: TomcatServer): Promise<void> {
        const serverUri: string = await this.getServerUri(serverInfo);
        await opn(serverUri);
    }

    public dispose(): void {
        this.stopServers();
        this._tomcat.saveServerListSync();
        this._outputChannels.forEach((value: vscode.OutputChannel, key: string) => value.dispose());
    }

    private async run(serverInfo: TomcatServer, packagePath ?: string, debug ?: boolean): Promise<void> {
        if (!serverInfo) {
            throw new Error(Utility.localize('tomcatExt.noserver', 'No tomcat server.'));
        }

        if (serverInfo.isStarted()) {
            await this.stopServer(serverInfo);
        }

        const output: vscode.OutputChannel = this.getOutput(serverInfo);
        const appName: string = packagePath ? await this.deployPackage(serverInfo, packagePath, output) : '';
        let port: number | undefined;
        let workspaceFolder: vscode.WorkspaceFolder | undefined;

        if (debug) {
            port = await Utility.getFreePort();
            workspaceFolder = Utility.getWorkspaceFolder(packagePath);
            if (!workspaceFolder) {
                throw new Error(Utility.localize('tomcatExt.noworkspacefolder', 'The selected package is not under current workspace'));
            }
        }
        await this.startTomcat(serverInfo, appName, output, port, workspaceFolder);
    }

    private stopServers(): void {
        const serverList: TomcatServer[] = this._tomcat.getServerSet();
        serverList.forEach((value: TomcatServer) => {
            if (value.isStarted()) {
                this.stopServer(value);
            }
        });
    }

    private async deployPackage(serverInfo: TomcatServer, packagePath: string, output: vscode.OutputChannel): Promise<string> {
        let appName: string = path.basename(packagePath);
        appName = appName.replace(/\.[^/.]+$/, '');
        const serverName: string = serverInfo.getName();
        const appPath: string = path.join(this._tomcat.getExtensionPath(), serverName, 'webapps', appName);
        await Utility.cleanAndCreateFolder(appPath);
        await Utility.executeCMD(output, 'jar', {cwd: appPath}, 'xvf', `${packagePath}`);
        return appName;
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
                args = [`-agentlib:jdwp=transport=dt_socket,suspend=n,server=y,address=localhost:${port}`].concat(args);
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
            setTimeout(() => vscode.debug.startDebugging(workspaceFolder, config), 500);
        }
    }

    private async getServerUri(serverInfo: TomcatServer, appName?: string): Promise<string> {
        const serverPort: string = await Utility.getServerPort(serverInfo.getServerConfigPath());
        if (!serverPort) {
            throw new Error('No http port found in server.xml');
        }
        // tslint:disable-next-line:no-http-string
        return `http://localhost:${serverPort}/${appName ? appName : ''}`;
    }

    private async startTomcat(serverInfo: TomcatServer, appName: string, output: vscode.OutputChannel,
                              debugPort ?: number, workspaceFolder?: vscode.WorkspaceFolder): Promise<void> {
        let statusBar: vscode.StatusBarItem;
        let statusBarCommand: vscode.Disposable;
        const args: string[] = this.getJavaArgs(serverInfo, true, debugPort);
        let watcher: chokidar.FSWatcher;
        let needRestart: boolean = false;
        const serverUri: string = await this.getServerUri(serverInfo, appName);

        try {
            if (serverUri) {
                statusBar = vscode.window.createStatusBarItem();
                statusBar.command = `open.${serverInfo.getName()}`;
                statusBar.text = `$(browser) Open ${appName}`;
                statusBar.tooltip = Utility.localize('tomcatExt.openapp', 'Open: "{0}"', serverUri);
                statusBarCommand = vscode.commands.registerCommand(statusBar.command, async () => {
                    opn(serverUri);
                });
                statusBar.show();
            }

            this.setStarted(serverInfo, true);
            watcher = chokidar.watch(serverInfo.getServerConfigPath());
            const YES_OR_NO_PROMPT: vscode.MessageItem[] = [
                {
                    title: 'Yes',
                    isCloseAffordance: false
                },
                {
                    title: 'No',
                    isCloseAffordance: true
                }
            ];

            watcher.on('change', async () => {
                const item: vscode.MessageItem = await vscode.window.showInformationMessage(
                    Utility.localize('tomcatExt.confchanged',
                                     'server.xml of running {0} has been changed. Would you like to restart it',
                                     serverInfo.getName()),
                    ...YES_OR_NO_PROMPT);
                if (item.title.toLowerCase() === 'yes') {
                    try {
                        // Need restart tomcat
                        await this.stopServer(serverInfo);
                        needRestart = true;
                    } catch (err) {
                        console.error(err.toString());
                        vscode.window.showErrorMessage(Utility.localize('tomcatExt.failstop', 'Failed to stop {0}', serverInfo.getName()));
                    }
                }
            });

            const javaProcss: Promise<void> = Utility.executeCMD(output, 'java', { shell: true }, ...args);
            this.startDebugSession(debugPort, workspaceFolder);
            await javaProcss;
            this.setStarted(serverInfo, false);
            this.disposeResource(statusBarCommand);
            this.disposeResource(statusBar);
            watcher.close();
            if (needRestart) {
                needRestart = false;
                await this.startTomcat(serverInfo, appName, output, debugPort, workspaceFolder);
            }
        } catch (err) {
            this.setStarted(serverInfo, false);
            this.disposeResource(statusBarCommand);
            this.disposeResource(statusBar);
            if (watcher) { watcher.close(); }
            throw new Error(err.toString());
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
