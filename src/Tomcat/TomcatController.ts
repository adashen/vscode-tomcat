'use strict';

import * as chokidar from "chokidar";
import * as fse from "fs-extra";
// tslint:disable-next-line:no-require-imports
import opn = require("opn");
import * as path from "path";
import * as portfinder from "portfinder";
import { URL } from "url";
import { MessageItem } from "vscode";
import * as vscode from "vscode";
import * as Constants from "../Constants";
import { DialogMessage } from '../DialogMessage';
import { Utility } from "../Utility";
import { TomcatModel } from "./TomcatModel";
import { TomcatServer } from "./TomcatServer";
import { WarPackage } from "./WarPackage";

export class TomcatController {
    constructor(private _tomcatModel: TomcatModel, private _extensionPath: string) {
    }

    public async deleteServer(tomcatServer: TomcatServer): Promise<void> {
        const server: TomcatServer = await this.precheck(tomcatServer);
        if (server) {
            if (server.isStarted()) {
                const confirmation: MessageItem = await vscode.window.showWarningMessage(DialogMessage.deleteConfirm, DialogMessage.yes, DialogMessage.cancel);
                if (confirmation !== DialogMessage.yes) {
                    return;
                }
                await this.stopOrRestartServer(server);
            }
            this._tomcatModel.deleteServer(server);
        }
    }

    public async openServerConfig(tomcatServer: TomcatServer): Promise<void> {
        if (tomcatServer) {
            Utility.openFile(tomcatServer.getServerConfigPath());
        }
    }

    public async browseWarPackage(warPackage: WarPackage): Promise<void> {
        if (warPackage) {
            const server: TomcatServer = this._tomcatModel.getTomcatServer(warPackage.serverName);
            const httpPort: string = await Utility.getPort(server.getServerConfigPath(), Constants.PortKind.Http);
            if (!server.isStarted()) {
                const result: MessageItem = await vscode.window.showInformationMessage(DialogMessage.startServer, DialogMessage.yes, DialogMessage.no);
                if (result === DialogMessage.yes) {
                    this.startServer(server);
                }
            }
            opn(new URL(warPackage.label, `${Constants.LOCALHOST}:${httpPort}`).toString());
        }
    }

    public async deleteWarPackage(warPackage: WarPackage): Promise<void> {
        if (warPackage) {
            await fse.remove(warPackage.storagePath);
            vscode.commands.executeCommand('tomcat.tree.refresh');
        }
    }

    public reveralWarPackage(warPackage: WarPackage): void {
        if (warPackage) {
            opn(warPackage.storagePath);
        }
    }

    public async createServer(): Promise<TomcatServer> {
        const pathPick: vscode.Uri[] = await vscode.window.showOpenDialog({
            defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: DialogMessage.selectDirectory
        });
        if (Utility.isEmpty(pathPick) || !pathPick[0].fsPath) {
            return;
        }
        const tomcatInstallPath: string = pathPick[0].fsPath;
        if (!await Utility.validateInstallPath(tomcatInstallPath)) {
            vscode.window.showErrorMessage(Constants.INVALID_SERVER_DIRECTORY);
            return;
        }
        const serverName: string = await Utility.getServerName(tomcatInstallPath, this._tomcatModel.defaultStoragePath);
        const catalinaBasePath: string = await Utility.getServerStoragePath(this._tomcatModel.defaultStoragePath, serverName);
        await fse.remove(catalinaBasePath);
        await Promise.all([
            Utility.copyServerConfig(path.join(tomcatInstallPath, 'conf', 'server.xml'),  path.join(catalinaBasePath, 'conf', 'server.xml')),
            fse.copy(path.join(tomcatInstallPath, 'conf', 'web.xml'), path.join(catalinaBasePath, 'conf', 'web.xml')),
            fse.copy(path.join(this._extensionPath, 'resources', 'jvm.options'), path.join(catalinaBasePath, 'jvm.options')),
            fse.copy(path.join(this._extensionPath, 'resources', 'index.jsp'), path.join(catalinaBasePath, 'webapps', 'ROOT', 'index.jsp')),
            fse.copy(path.join(this._extensionPath, 'resources', 'icon.png'), path.join(catalinaBasePath, 'webapps', 'ROOT', 'icon.png')),
            fse.mkdirs(path.join(catalinaBasePath, 'logs')),
            fse.mkdirs(path.join(catalinaBasePath, 'temp')),
            fse.mkdirs(path.join(catalinaBasePath, 'work'))
        ]);
        const tomcatServer: TomcatServer = new TomcatServer(serverName, tomcatInstallPath, catalinaBasePath);
        this._tomcatModel.addServer(tomcatServer);
        return tomcatServer;
    }

    public async customizeVMOptions(tomcatServer: TomcatServer): Promise<void> {
        if (!tomcatServer) {
            return;
        }
        if (!await fse.pathExists(tomcatServer.vmOptionFile)) {
            await fse.copy(path.join(this._extensionPath, 'resources', 'jvm.options'), path.join(tomcatServer.getStoragePath(), 'jvm.options'));
        }
        Utility.openFile(tomcatServer.vmOptionFile);
    }

    public async renameServer(tomcatServer: TomcatServer): Promise<void> {
        const server: TomcatServer = await this.precheck(tomcatServer);
        if (server) {
            const newName: string = await vscode.window.showInputBox({
                prompt: 'input a new server name',
                validateInput: (name: string): string => {
                    if (!name.match(/^[\w.-]+$/)) {
                        return 'please input a valid server name';
                    } else if (this._tomcatModel.getTomcatServer(name)) {
                        return 'the name was already taken, please re-input';
                    }
                    return null;
                }
            });
            if (newName) {
                server.rename(newName);
                await this._tomcatModel.saveServerList();
            }
        }
    }

    public async stopOrRestartServer(tomcatServer: TomcatServer, restart: boolean = false): Promise<void> {
        const server: TomcatServer = await this.precheck(tomcatServer);
        if (server) {
            if (!server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverStopped);
                return;
            }
            await Utility.executeCMD(server.outputChannel, 'java', { shell: true }, ...server.vmOptions.concat('stop'));
            server.needRestart = restart;
        }
    }

    public async startServer(tomcatServer: TomcatServer): Promise<void> {
        const server: TomcatServer = tomcatServer ? tomcatServer : await this.selectServer(true);
        if (server) {
            if (server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverRunning);
                return;
            }
            await this.startTomcat(server);
        }
    }

    public async runOrDebugOnServer(uri?: vscode.Uri, debug?: boolean): Promise<void> {
        if (!uri) {
            const dialog: vscode.Uri[] = await vscode.window.showOpenDialog({
                defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
                canSelectFiles: true,
                canSelectFolders: false,
                openLabel: DialogMessage.selectWarPackage
            });
            if (Utility.isEmpty(dialog) || !dialog[0].fsPath) {
                return;
            }
            uri = dialog[0];
        }

        const packagePath: string = uri.fsPath;
        const server: TomcatServer = await this.selectServer(true);
        if (!server) {
            return;
        }
        await this.deployPackage(server, packagePath);
        if (server.isStarted() && ((!server.isDebugging() && !debug) || server.isDebugging() === debug)) {
            return;
        }
        let port: number;
        let workspaceFolder: vscode.WorkspaceFolder;

        if (debug) {
            if (vscode.workspace.workspaceFolders) {
                workspaceFolder = vscode.workspace.workspaceFolders.find((f: vscode.WorkspaceFolder): boolean => {
                    const relativePath: string = path.relative(f.uri.fsPath, packagePath);
                    return relativePath === '' || (!relativePath.startsWith('..') && relativePath !== packagePath);
                });
            }
            if (!workspaceFolder) {
                vscode.window.showErrorMessage(DialogMessage.noPackage);
                return;
            }
            port = await portfinder.getPortPromise();
        }

        server.setDebugInfo(debug, port, workspaceFolder);
        if (server.isStarted()) {
            await this.stopOrRestartServer(server, true);
        } else {
            await this.startTomcat(server);
        }
    }

    public async browseServer(tomcatServer: TomcatServer): Promise<void> {
        if (tomcatServer) {
            const httpPort: string = await Utility.getPort(tomcatServer.getServerConfigPath(), Constants.PortKind.Http);
            opn(new URL(`${Constants.LOCALHOST}:${httpPort}`).toString());
        }
    }

    public dispose(): void {
        this.stopServers();
        this._tomcatModel.saveServerListSync();
        this._tomcatModel.getServerSet().forEach((element: TomcatServer) => {
            element.outputChannel.dispose();
        });
    }

    private async selectServer(createIfNoneServer: boolean = false): Promise<TomcatServer> {
        let items: vscode.QuickPickItem[] = this._tomcatModel.getServerSet();
        if (Utility.isEmpty(items) && !createIfNoneServer) {
            return;
        }
        items = createIfNoneServer ? items.concat({ label: `$(plus) ${DialogMessage.createServer}`, description: '' }) : items;
        const pick: vscode.QuickPickItem = await vscode.window.showQuickPick(
            items,
            { placeHolder: createIfNoneServer && items && items.length === 1 ? DialogMessage.createServer : DialogMessage.selectServer }
        );

        if (pick) {
            if (pick instanceof TomcatServer) {
                return pick;
            } else {
                return await this.createServer();
            }
        }
    }

    private stopServers(): void {
        const serverList: TomcatServer[] = this._tomcatModel.getServerSet();
        serverList.forEach((server: TomcatServer) => {
            if (server.isStarted()) {
                this.stopOrRestartServer(server);
            }
        });
    }

    private async deployPackage(serverInfo: TomcatServer, packagePath: string): Promise<string> {
        const appName: string =  path.basename(packagePath, path.extname(packagePath));
        const appPath: string = path.join(serverInfo.getStoragePath(), 'webapps', appName);

        await fse.remove(appPath);
        await fse.mkdirs(appPath);
        await Utility.executeCMD(serverInfo.outputChannel, 'jar', {cwd: appPath}, 'xvf', `${packagePath}`);
        vscode.commands.executeCommand('tomcat.tree.refresh');
        return appName;
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

    private async startTomcat(serverInfo: TomcatServer): Promise<void> {
        const serverName: string = serverInfo.getName();
        let watcher: chokidar.FSWatcher;
        const serverConfig: string = serverInfo.getServerConfigPath();
        const serverPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Server);
        const httpPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Http);
        const httpsPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Https);

        try {
            await this._tomcatModel.updateVMOptions(serverName);
            watcher = chokidar.watch(serverConfig);
            watcher.on('change', async () => {
                if (serverPort !== await Utility.getPort(serverConfig, Constants.PortKind.Server)) {
                    const result: MessageItem = await vscode.window.showErrorMessage(
                        DialogMessage.getServerPortChangeErrorMessage(serverName, serverPort), DialogMessage.yes, DialogMessage.no, DialogMessage.moreInfo
                    );

                    if (result === DialogMessage.yes) {
                        await Utility.setPort(serverConfig, Constants.PortKind.Server, serverPort);
                    } else if (result === DialogMessage.moreInfo) {
                        opn(Constants.UNABLE_SHUTDOWN_URL);
                    }
                } else if (await Utility.needRestart(httpPort, httpsPort, serverConfig)) {
                    const item: MessageItem = await vscode.window.showInformationMessage(
                        DialogMessage.getConfigChangedMessage(serverName), DialogMessage.yes, DialogMessage.no, DialogMessage.never
                    );

                    if (item === DialogMessage.yes) {
                        await this.stopOrRestartServer(serverInfo, true);
                    } else if (item === DialogMessage.never) {
                        Utility.disableAutoRestart();
                    }
                }
            });

            let startAgruments: string[] = serverInfo.vmOptions;
            if (serverInfo.getDebugPort()) {
                startAgruments = [`${Constants.DEBUG_ARGUMENT_KEY}:${serverInfo.getDebugPort()}`].concat(startAgruments);
            }
            startAgruments.push('start');
            const javaProcess: Promise<void> = Utility.executeCMD(serverInfo.outputChannel, 'java', { shell: true }, ...startAgruments);
            serverInfo.setStarted(true);
            this.startDebugSession(serverInfo);
            await javaProcess;
            serverInfo.setStarted(false);
            watcher.close();
            if (serverInfo.needRestart) {
                serverInfo.needRestart = false;
                await this.startTomcat(serverInfo);
            }
        } catch (err) {
            serverInfo.setStarted(false);
            if (watcher) { watcher.close(); }
            vscode.window.showErrorMessage(err.toString());
        }
    }
    private async precheck(tomcatServer: TomcatServer): Promise<TomcatServer> {
        if (Utility.isEmpty(this._tomcatModel.getServerSet())) {
            vscode.window.showInformationMessage(DialogMessage.noServer);
            return;
        }
        return tomcatServer ? tomcatServer : await this.selectServer();
    }
}
