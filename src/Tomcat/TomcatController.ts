'use strict';

import * as chokidar from "chokidar";
import * as fse from "fs-extra";
// tslint:disable-next-line:no-require-imports
import opn = require("opn");
import * as path from "path";
import * as vscode from "vscode";
import { MessageItem } from "vscode";
import * as Constants from "../Constants";
import { DialogMessage } from '../DialogMessage';
import { localize } from '../localize';
import { Utility } from "../Utility";
import { TomcatModel } from "./TomcatModel";
import { TomcatServer } from "./TomcatServer";

export class TomcatController {
    constructor(private _tomcatModel: TomcatModel, private _extensionPath: string) {
    }

    public getTomcatServer(serverName: string): TomcatServer {
        return this._tomcatModel.getTomcatServer(serverName);
    }

    public getServerSet(): TomcatServer[] {
        return this._tomcatModel.getServerSet();
    }

    public async deleteServer(tomcatServer: TomcatServer): Promise<void> {
        if (!tomcatServer) {
            throw (new Error(DialogMessage.noServer));
        }

        if (tomcatServer.isStarted()) {
            const confirmation: MessageItem | undefined = await vscode.window.showWarningMessage(DialogMessage.deleteConfirm, DialogMessage.yes, DialogMessage.cancel);
            if (confirmation !== DialogMessage.yes) {
                return;
            }
            await this.stopServer(tomcatServer);
        }

        if (this._tomcatModel.deleteServer(tomcatServer)) {
            tomcatServer.outputChannel.dispose();
        }
        vscode.commands.executeCommand('tomcat.tree.refresh');
    }

    public async openConfig(tomcatServer: TomcatServer): Promise<void> {
        if (!tomcatServer) {
            throw (new Error(DialogMessage.noServer));
        }

        const configFile: string = tomcatServer.getServerConfigPath();
        if (!await fse.pathExists(configFile)) {
            throw new Error(DialogMessage.noServerConfig);
        }
        vscode.window.showTextDocument(vscode.Uri.file(configFile), { preview: false });
    }

    public async createServer(): Promise<TomcatServer> {
        const pathPick: vscode.Uri[] = await vscode.window.showOpenDialog({
            defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: DialogMessage.selectDirectory
        });
        if (!pathPick || pathPick.length <= 0 || !pathPick[0].fsPath) {
            return;
        }
        const tomcatInstallPath: string = pathPick[0].fsPath;
        let serverName: string = await Utility.promptServerName(path.basename(tomcatInstallPath));
        if (serverName === undefined) {
            return;
        }
        serverName = serverName === '' ? path.basename(tomcatInstallPath) : serverName;
        let tomcatServer: TomcatServer = this._tomcatModel.getTomcatServer(serverName);
        if (tomcatServer) {
            vscode.window.showInformationMessage(DialogMessage.serverExist);
            tomcatServer.createMark = true;
            return tomcatServer;
        }
        const storagePath: string = Utility.getWorkspace(this._tomcatModel.defaultStoragePath);
        await Utility.copyServerFiles(serverName, tomcatInstallPath, storagePath, this._extensionPath);
        tomcatServer = new TomcatServer(serverName, tomcatInstallPath, storagePath);
        this._tomcatModel.addServer(tomcatServer);
        vscode.commands.executeCommand('tomcat.tree.refresh');
        return tomcatServer;
    }

    public async stopServer(serverInfo: TomcatServer): Promise<void> {
        if (!serverInfo) {
            throw new Error(DialogMessage.noServer);
        }

        await Utility.executeCMD(serverInfo.outputChannel, 'java', { shell: true }, ...this.getJavaArgs(serverInfo, false));
    }

    public async restartServer(serverInfo: TomcatServer): Promise<void> {
        if (!serverInfo) {
            throw new Error(DialogMessage.noServer);
        }
        if (serverInfo.isStarted()) {
            serverInfo.needRestart = true;
            await Utility.executeCMD(serverInfo.outputChannel, 'java', { shell: true }, ...this.getJavaArgs(serverInfo, false));
        }
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

    public async selectServer(tomcatServer?: TomcatServer, createIfNoneServer: boolean = false): Promise<TomcatServer> {
        if (tomcatServer) {
            return tomcatServer;
        }
        const serverSet: TomcatServer[] = this._tomcatModel.getServerSet();
        if ((!serverSet || serverSet.length <= 0 ) && !createIfNoneServer) {
            return;
        }
        const pick: vscode.QuickPickItem = await vscode.window.showQuickPick(
            [...serverSet, { label: `$(plus) ${DialogMessage.createServer}`, description: '' }],
            { placeHolder: serverSet && serverSet.length > 0 ? DialogMessage.selectServer : DialogMessage.createServer });
        if (pick) {
            if (pick instanceof TomcatServer) {
                return pick;
            } else {
                return await this.createServer();
            }
        }
    }

    public dispose(): void {
        this.stopServers();
        this._tomcatModel.saveServerListSync();
        this._tomcatModel.getServerSet().forEach((element: TomcatServer) => {
           element.outputChannel.dispose();
        });
    }

    private async run(serverInfo: TomcatServer, packagePath ?: string, debug ?: boolean): Promise<void> {
        if (!serverInfo) {
            throw new Error(DialogMessage.noServer);
        }

        const appName: string = packagePath ? await this.deployPackage(serverInfo, packagePath) : '';
        if (serverInfo.isStarted() && ((!serverInfo.isDebugging() && !debug) ||  serverInfo.isDebugging() === debug)) {
            return;
        }
        let port: number | undefined;
        let workspaceFolder: vscode.WorkspaceFolder | undefined;

        if (debug) {
            port = await Utility.getFreePort();
            if (vscode.workspace.workspaceFolders) {
                workspaceFolder = vscode.workspace.workspaceFolders.find((f: vscode.WorkspaceFolder): boolean => {
                    const relativePath: string = path.relative(f.uri.fsPath, packagePath);
                    return relativePath === '' || (!relativePath.startsWith('..') && relativePath !== packagePath);
                });
            }
            if (!workspaceFolder) {
                throw new Error(DialogMessage.noPackage);
            }
        }

        serverInfo.setDebugInfo(debug, port, workspaceFolder);
        if (serverInfo.isStarted()) {
            serverInfo.needRestart = true;
            await Utility.executeCMD(serverInfo.outputChannel, 'java', { shell: true }, ...this.getJavaArgs(serverInfo, false));
        } else {
            await this.startTomcat(serverInfo, appName);
        }
    }

    private stopServers(): void {
        const serverList: TomcatServer[] = this._tomcatModel.getServerSet();
        serverList.forEach((value: TomcatServer) => {
            if (value.isStarted()) {
                this.stopServer(value);
            }
        });
    }

    private async deployPackage(serverInfo: TomcatServer, packagePath: string): Promise<string> {
        const appName: string =  path.basename(packagePath, path.extname(packagePath));
        const serverName: string = serverInfo.getName();
        const appPath: string = path.join(serverInfo.getStoragePath(), serverName, 'webapps', appName);

        await fse.remove(appPath);
        await fse.mkdirs(appPath);
        await Utility.executeCMD(serverInfo.outputChannel, 'jar', {cwd: appPath}, 'xvf', `${packagePath}`);
        return appName;
    }

    private setStarted(serverInfo: TomcatServer, started: boolean): void {
        serverInfo.setStarted(started);
        vscode.commands.executeCommand('tomcat.tree.refresh');
    }

    private getJavaArgs(serverInfo: TomcatServer, start: boolean): string[] {
        const serverName: string = serverInfo.getName();
        const catalinaBase: string = path.join(serverInfo.getStoragePath(), serverName);
        const bootStrap: string = path.join(serverInfo.getInstallPath(), 'bin', 'bootstrap.jar');
        const tomcat: string = path.join(serverInfo.getInstallPath(), 'bin', 'tomcat-juli.jar');
        const sep: string = path.delimiter;
        const classPath: string = `${bootStrap}${sep}${tomcat}`;
        const tmdir: string = path.join(catalinaBase, 'temp');
        let args: string[] = [`-classpath "${classPath}"`,
        `"-Dcatalina.base=${catalinaBase}"`,
        `"-Dcatalina.home=${serverInfo.getInstallPath()}"`,
        `"-Djava.io.tmpdir=${tmdir}"`,
        '"-Dfile.encoding=UTF8"',
        'org.apache.catalina.startup.Bootstrap',
        '"$@"'];

        if (start) {
            if (serverInfo.getDebugPort()) {
                args = [`-agentlib:jdwp=transport=dt_socket,suspend=n,server=y,address=localhost:${serverInfo.getDebugPort()}`].concat(args);
            }
            args.push('start');
        } else {
            args.push('stop');
        }

        return args;
    }

    private startDebugSession(server: TomcatServer): void {
        if (!server || !server.getDebugPort() || !server.getDebugWorkspace()) {
            return;
        }
        const config: vscode.DebugConfiguration = {
            type: 'java',
            name: 'Tomcat Debug (Attach)',
            request: 'attach',
            hostName: 'localhost',
            port: server.getDebugPort()
        };
        setTimeout(() => vscode.debug.startDebugging(server.getDebugWorkspace(), config), 500);
    }

    private async getServerUri(serverInfo: TomcatServer, appName?: string): Promise<string> {
        const serverPort: string = await Utility.getPort(serverInfo.getServerConfigPath(), Constants.PortKind.Http);
        if (!serverPort) {
            throw new Error('No http port found in server.xml');
        }
        // tslint:disable-next-line:no-http-string
        return `http://localhost:${serverPort}/${appName ? appName : ''}`;
    }

    private async startTomcat(serverInfo: TomcatServer, appName: string): Promise<void> {
        let statusBar: vscode.StatusBarItem;
        let statusBarCommand: vscode.Disposable;
        const serverName: string = serverInfo.getName();
        let watcher: chokidar.FSWatcher;
        const serverUri: string = await this.getServerUri(serverInfo, appName);
        const serverConfig: string = serverInfo.getServerConfigPath();
        const serverPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Server);
        const httpPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Http);
        const httpsPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Https);

        try {
            if (serverUri) {
                statusBar = vscode.window.createStatusBarItem();
                statusBar.command = `open.${serverName}`;
                statusBar.text = `$(browser) Open ${appName}`;
                statusBar.tooltip = localize('tomcatExt.open', 'Open: {0}', serverUri);
                statusBarCommand = vscode.commands.registerCommand(statusBar.command, async () => {
                    opn(serverUri);
                });
                statusBar.show();
            }

            watcher = chokidar.watch(serverConfig);
            watcher.on('change', async () => {
                if (serverPort !== await Utility.getPort(serverConfig, Constants.PortKind.Server)) {
                    const result: MessageItem = await vscode.window.showErrorMessage(DialogMessage.getServerPortChangeErrorMessage(serverName, serverPort), DialogMessage.revert);
                    if (result === DialogMessage.revert) {
                        await Utility.setPort(serverConfig, Constants.PortKind.Server, serverPort);
                    }
                } else if (httpPort !== await Utility.getPort(serverConfig, Constants.PortKind.Http) ||
                           httpsPort !== await Utility.getPort(serverConfig, Constants.PortKind.Https)) {
                    const item: MessageItem = await vscode.window.showInformationMessage(DialogMessage.getConfigChangedMessage(serverName), DialogMessage.yes, DialogMessage.no);
                    if (item === DialogMessage.yes) {
                        try {
                            // Need restart tomcat
                            await this.stopServer(serverInfo);
                            serverInfo.needRestart = true;
                        } catch (err) {
                            console.error(err.toString());
                            vscode.window.showErrorMessage(DialogMessage.getStopFailureMessage(serverName));
                        }
                    }
                }
            });

            const javaProcess: Promise<void> = Utility.executeCMD(serverInfo.outputChannel, 'java', { shell: true }, ...this.getJavaArgs(serverInfo, true));
            this.setStarted(serverInfo, true);
            this.startDebugSession(serverInfo);
            await javaProcess;
            this.setStarted(serverInfo, false);
            Utility.disposeResources(statusBarCommand, statusBar);
            watcher.close();
            if (serverInfo.needRestart) {
                serverInfo.needRestart = false;
                await this.startTomcat(serverInfo, appName);
            }
        } catch (err) {
            this.setStarted(serverInfo, false);
            Utility.disposeResources(statusBarCommand, statusBar);
            if (watcher) { watcher.close(); }
            throw new Error(err.toString());
        }
    }
}
