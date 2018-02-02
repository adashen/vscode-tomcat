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

    public async startServer(tomcatServer?: TomcatServer): Promise<void> {
        const server: TomcatServer = await this.selectServer(tomcatServer, true);
        if (server) {
            if (server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverRunning);
                return;
            }
            await this.run(server);
        }
    }
    public async deleteServer(tomcatServer: TomcatServer): Promise<void> {
        if (this._tomcatModel.getServerSet() && this._tomcatModel.getServerSet().length <= 0) {
            vscode.window.showInformationMessage(DialogMessage.noServer);
            return;
        }
        const server: TomcatServer = await this.selectServer(tomcatServer);
        if (!server) {
            return;
        }
        if (server.isStarted()) {
            const confirmation: MessageItem | undefined = await vscode.window.showWarningMessage(DialogMessage.deleteConfirm, DialogMessage.yes, DialogMessage.cancel);
            if (confirmation !== DialogMessage.yes) {
                return;
            }
            await this.stopOrRestartServer(server);
        }

        if (this._tomcatModel.deleteServer(server)) {
            server.outputChannel.dispose();
        }
        vscode.commands.executeCommand('tomcat.tree.refresh');
    }

    public async openServerConfig(tomcatServer: TomcatServer): Promise<void> {
        if (tomcatServer) {
            const configFile: string = tomcatServer.getServerConfigPath();
            if (!await fse.pathExists(configFile)) {
                throw new Error(DialogMessage.noServerConfig);
            }
            vscode.window.showTextDocument(vscode.Uri.file(configFile), { preview: false });
        } else {
            vscode.window.showInformationMessage(DialogMessage.noServer);
        }
    }

    public async createServer(): Promise<string> {
        const pathPick: vscode.Uri[] = await vscode.window.showOpenDialog({
            defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: DialogMessage.selectDirectory
        });
        if (!pathPick && pathPick.length <= 0 || !pathPick[0].fsPath) {
            return;
        }
        const tomcatInstallPath: string = pathPick[0].fsPath;
        const serverName: string = path.basename(tomcatInstallPath);
        if (this._tomcatModel.getTomcatServer(serverName)) {
            vscode.window.showInformationMessage(DialogMessage.serverExist);
            return serverName;
        }

        const serverConfigFile: string = path.join(tomcatInstallPath, 'conf', 'server.xml');
        const serverWebFile: string = path.join(tomcatInstallPath, 'conf', 'web.xml');
        const serverBootstrapJarFile: string = path.join(tomcatInstallPath, 'bin', 'bootstrap.jar');
        const serverJuliJarFile: string = path.join(tomcatInstallPath, 'bin', 'tomcat-juli.jar');

        if (!await fse.pathExists(serverConfigFile) || !await fse.pathExists(serverWebFile) ||
            !await fse.pathExists(serverBootstrapJarFile) || !await fse.pathExists(serverJuliJarFile)) {
            throw new Error(Constants.INVALID_SERVER_DIRECTORY);
        }

        let storagePath: string = Utility.getWorkspace();
        if (!storagePath) {
            storagePath = path.join(this._tomcatModel.defaultStoragePath, '/tomcat');
        }

        const catalinaBasePath: string = path.join(storagePath, serverName);
        await fse.remove(catalinaBasePath);
        await Promise.all([
            fse.copy(serverConfigFile, path.join(catalinaBasePath, 'conf', 'server.xml')),
            fse.copy(serverWebFile, path.join(catalinaBasePath, 'conf', 'web.xml')),
            fse.copy(path.join(this._extensionPath, 'resources', 'index.jsp'), path.join(catalinaBasePath, 'webapps', 'ROOT', 'index.jsp')),
            fse.copy(path.join(this._extensionPath, 'resources', 'icon.png'), path.join(catalinaBasePath, 'webapps', 'ROOT', 'icon.png')),
            fse.mkdirs(path.join(catalinaBasePath, 'logs')),
            fse.mkdirs(path.join(catalinaBasePath, 'temp')),
            fse.mkdirs(path.join(catalinaBasePath, 'work'))
        ]);

        const tomcatServer: TomcatServer = new TomcatServer(serverName, tomcatInstallPath, storagePath);
        this._tomcatModel.addServer(tomcatServer);
        vscode.commands.executeCommand('tomcat.tree.refresh');
        return serverName;
    }

    public async runOnTomcat(debug: boolean, uri?: vscode.Uri): Promise<void> {
        if (!uri) {
            const dialog: vscode.Uri[] = await vscode.window.showOpenDialog({
                defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
                canSelectFiles: true,
                canSelectFolders: false,
                openLabel: DialogMessage.selectWarPackage
            });
            if (!dialog || dialog.length <= 0 || !dialog[0].fsPath) {
                return;
            }
            uri = dialog[0];
        }
        const packagePath: string = uri.fsPath;
        const originalServerSet: string[] = this._tomcatModel.getServerSet().map((s: TomcatServer) => s.getName());
        const server: TomcatServer = await this.selectServer(undefined, true);
        if (!server) {
            return;
        }
        if (server && server.newCreated && originalServerSet.indexOf(server.getName()) >= 0) {
            server.newCreated = false;
            const result: MessageItem | undefined = await vscode.window.showWarningMessage(DialogMessage.continueOnExistingServer, DialogMessage.yes, DialogMessage.no);
            if (result !== DialogMessage.yes) {
                return;
            }
        }
        await this.run(server, packagePath, debug);
    }

    public async stopOrRestartServer(tomcatServer: TomcatServer, restart: boolean = false): Promise<void> {
        if (this._tomcatModel.getServerSet() && this._tomcatModel.getServerSet().length <= 0) {
            vscode.window.showInformationMessage(DialogMessage.noServer);
            return;
        }
        const server: TomcatServer = await this.selectServer(tomcatServer);
        if (!server) {
            return;
        }
        if (!server.isStarted()) {
            vscode.window.showInformationMessage(DialogMessage.serverStopped);
            return;
        }

        await Utility.executeCMD(server.outputChannel, 'java', { shell: true }, ...this.getJavaArgs(server, false));
        server.needRestart = restart;
    }

    public async browseServer(tomcatServer: TomcatServer): Promise<void> {
        if (tomcatServer) {
            await opn(await this.getServerUri(tomcatServer));
        } else {
            vscode.window.showInformationMessage(DialogMessage.noServer);
        }
    }

    public dispose(): void {
        this.stopServers();
        this._tomcatModel.saveServerListSync();
        this._tomcatModel.getServerSet().forEach((element: TomcatServer) => {
           element.outputChannel.dispose();
        });
    }

    public async run(serverInfo: TomcatServer, packagePath ?: string, debug ?: boolean): Promise<void> {
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
                this.stopOrRestartServer(value);
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

    private async selectServer(tomcatServer?: TomcatServer, createIfNoneServer: boolean = false): Promise<TomcatServer> {
        if (tomcatServer) {
            return tomcatServer;
        }
        const serverSet: TomcatServer[] = this._tomcatModel.getServerSet();
        if ((!serverSet || serverSet.length <= 0) && !createIfNoneServer) {
            return;
        }
        const pick: vscode.QuickPickItem = await vscode.window.showQuickPick(
            [...serverSet, { label: `$(plus) ${DialogMessage.createServer}`, description: '' }],
            { placeHolder: serverSet && serverSet.length > 0 ? DialogMessage.selectServer : DialogMessage.createServer });
        if (pick) {
            if (pick instanceof TomcatServer) {
                return pick;
            } else {
                const newServerName: string = await this.createServer();
                const newServer: TomcatServer = this._tomcatModel.getTomcatServer(newServerName);
                newServer.newCreated = true;
                return newServer;
            }
        }
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
                    vscode.window.showErrorMessage(DialogMessage.getServerPortChangeErrorMessage(serverName, serverPort));
                } else if (httpPort !== await Utility.getPort(serverConfig, Constants.PortKind.Http) ||
                           httpsPort !== await Utility.getPort(serverConfig, Constants.PortKind.Https)) {
                    const item: vscode.MessageItem = await vscode.window.showInformationMessage(DialogMessage.getConfigChangedMessage(serverName), DialogMessage.yes, DialogMessage.no);
                    if (item === DialogMessage.yes) {
                        try {
                            await this.stopOrRestartServer(serverInfo, true);
                        } catch (err) {
                            console.error(err.toString());
                            vscode.window.showErrorMessage(DialogMessage.getStopFailureMessage(serverName));
                        }
                    }
                }
            });

            const javaProcess: Promise<void> = Utility.executeCMD(serverInfo.outputChannel, 'java', { shell: true }, ...this.getJavaArgs(serverInfo, true));
            serverInfo.setStarted(true);
            this.startDebugSession(serverInfo);
            await javaProcess;
            serverInfo.setStarted(false);
            Utility.disposeResources(statusBarCommand, statusBar);
            watcher.close();
            if (serverInfo.needRestart) {
                serverInfo.needRestart = false;
                await this.startTomcat(serverInfo, appName);
            }
        } catch (err) {
            serverInfo.setStarted(false);
            Utility.disposeResources(statusBarCommand, statusBar);
            if (watcher) { watcher.close(); }
            throw new Error(err.toString());
        }
    }
}
