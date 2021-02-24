'use strict';

import * as chokidar from "chokidar";
import * as fs from "fs";
import * as fse from "fs-extra";
import * as _ from "lodash";
// tslint:disable-next-line:no-require-imports
import opn = require("opn");
import * as path from "path";
import * as portfinder from "portfinder";
import { URL } from "url";
import { MessageItem } from "vscode";
import * as vscode from "vscode";
import { createUuid, sendOperationError } from "vscode-extension-telemetry-wrapper";
import * as Constants from "../Constants";
import { DialogMessage } from '../DialogMessage';
import { Utility } from "../Utility";
import { TomcatModel } from "./TomcatModel";
import { TomcatServer } from "./TomcatServer";
import { WarPackage } from "./WarPackage";

export class TomcatController {
    private _outputChannel: vscode.OutputChannel;
    constructor(private _tomcatModel: TomcatModel, private _extensionPath: string) {
        this._outputChannel = vscode.window.createOutputChannel('vscode-tomcat');
    }

    public async deleteServer(operationId: string, tomcatServer: TomcatServer): Promise<void> {
        const server: TomcatServer = await this.precheck(operationId, tomcatServer);
        if (server) {
            if (server.isStarted()) {
                const confirmation: MessageItem = await vscode.window.showWarningMessage(DialogMessage.deleteConfirm, DialogMessage.yes, DialogMessage.cancel);
                if (confirmation !== DialogMessage.yes) {
                    Utility.infoTelemetryStep(operationId, 'cancel');
                    return;
                }
                await this.stopOrRestartServer(operationId, server);
            }
            this._tomcatModel.deleteServer(server);
        }
    }

    public async openServerConfig(operationId: string, tomcatServer: TomcatServer): Promise<void> {
        if (tomcatServer) {
            const configFile: string = tomcatServer.getServerConfigPath();
            if (!await fse.pathExists(configFile)) {
                Utility.infoTelemetryStep(operationId, 'no configuration');
                throw new Error(DialogMessage.noServerConfig);
            }
            await Utility.trackTelemetryStep(operationId, 'open configuration', () => Utility.openFile(configFile));
        }
    }

    public async browseWarPackage(operationId: string, warPackage: WarPackage): Promise<void> {
        if (warPackage) {
            const server: TomcatServer = this._tomcatModel.getTomcatServer(warPackage.serverName);
            const httpPort: string = await Utility.getPort(server.getServerConfigPath(), Constants.PortKind.Http);
            if (!server.isStarted()) {
                const result: MessageItem = await vscode.window.showInformationMessage(DialogMessage.startServer, DialogMessage.yes, DialogMessage.no);
                if (result === DialogMessage.yes) {
                    Utility.trackTelemetryStep(operationId, 'start server', () => this.startServer(operationId, server));
                }
            }
            Utility.trackTelemetryStep(operationId, 'browse war', () => opn(new URL(warPackage.label, `${Constants.LOCALHOST}:${httpPort}`).toString()))();
        }
    }

    public async deleteWarPackage(_operationId: string, warPackage: WarPackage): Promise<void> {
        if (warPackage) {
            await fse.remove(warPackage.storagePath);
            vscode.commands.executeCommand('tomcat.tree.refresh');
        }
    }

    public revealWarPackage(warPackage: WarPackage): void {
        if (warPackage) {
            opn(warPackage.storagePath);
        }
    }

    public async addServer(operationId: string): Promise<TomcatServer> {
        const pathPick: vscode.Uri[] = await Utility.trackTelemetryStep(operationId, 'select install path', () => vscode.window.showOpenDialog({
            defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: DialogMessage.selectDirectory
        }));
        if (_.isEmpty(pathPick) || !pathPick[0].fsPath) {
            return;
        }
        const tomcatInstallPath: string = pathPick[0].fsPath;
        if (!await Utility.validateInstallPath(tomcatInstallPath)) {
            vscode.window.showErrorMessage(Constants.INVALID_SERVER_DIRECTORY);
            Utility.infoTelemetryStep(operationId, 'install path invalid');
            return;
        }
        Utility.infoTelemetryStep(operationId, 'construct server name');
        const existingServerNames: string[] = this._tomcatModel.getServerSet().map((item: TomcatServer) => { return item.getName(); });
        const serverName: string = await Utility.getServerName(tomcatInstallPath, this._tomcatModel.defaultStoragePath, existingServerNames);
        const catalinaBasePath: string = await Utility.getServerStoragePath(this._tomcatModel.defaultStoragePath, serverName);
        await fse.remove(catalinaBasePath);
        await Utility.trackTelemetryStep(operationId, 'copy files', () => Promise.all([
            fse.copy(path.join(tomcatInstallPath, 'conf'), path.join(catalinaBasePath, 'conf'), {dereference: true}),
            fse.copy(path.join(this._extensionPath, 'resources', 'jvm.options'), path.join(catalinaBasePath, 'jvm.options')),
            fse.copy(path.join(this._extensionPath, 'resources', 'index.jsp'), path.join(catalinaBasePath, 'webapps', 'ROOT', 'index.jsp')),
            fse.copy(path.join(this._extensionPath, 'resources', 'icon.png'), path.join(catalinaBasePath, 'webapps', 'ROOT', 'icon.png')),
            fse.mkdirs(path.join(catalinaBasePath, 'logs')),
            fse.mkdirs(path.join(catalinaBasePath, 'temp')),
            fse.mkdirs(path.join(catalinaBasePath, 'work'))
        ]));

        await Utility.copyServerConfig(path.join(tomcatInstallPath, 'conf', 'server.xml'), path.join(catalinaBasePath, 'conf', 'server.xml'));
        const tomcatServer: TomcatServer = new TomcatServer(serverName, tomcatInstallPath, catalinaBasePath);
        Utility.trackTelemetryStep(operationId, 'add server', () => this._tomcatModel.addServer(tomcatServer));
        return tomcatServer;
    }

    public async customizeJVMOptions(tomcatServer: TomcatServer): Promise<void> {
        if (tomcatServer) {
            if (!await fse.pathExists(tomcatServer.jvmOptionFile)) {
                await fse.copy(path.join(this._extensionPath, 'resources', 'jvm.options'), path.join(tomcatServer.getStoragePath(), 'jvm.options'));
            }
            Utility.openFile(tomcatServer.jvmOptionFile);
        }
    }

    public async renameServer(operationId: string, tomcatServer: TomcatServer): Promise<void> {
        const server: TomcatServer = await this.precheck(operationId, tomcatServer);
        if (server) {
            const newName: string = await vscode.window.showInputBox({
                prompt: 'input a new server name',
                validateInput: (name: string): string => {
                    if (name && !name.match(/^[\w.-]+$/)) {
                        return 'please input a valid server name';
                    } else if (this._tomcatModel.getTomcatServer(name)) {
                        return 'the name was already taken, please re-input';
                    }
                    return null;
                }
            });
            if (newName) {
                Utility.trackTelemetryStep(operationId, 'rename', () => server.rename(newName));
                await this._tomcatModel.saveServerList();
            }
        }
    }

    public async stopOrRestartServer(operationId: string, tomcatServer: TomcatServer, restart: boolean = false): Promise<void> {
        const server: TomcatServer = await this.precheck(operationId, tomcatServer);
        if (server) {
            if (!server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverStopped);
                return;
            }
            if (!restart) {
                server.clearDebugInfo();
            }
            server.needRestart = restart;
            await Utility.trackTelemetryStep(operationId, restart ? 'restart' : 'stop', () =>
                Utility.executeCMD(this._outputChannel, server.getName(), Utility.getJavaExecutable(), { shell: true }, ...server.jvmOptions.concat('stop')));
        }
    }

    public async startServer(operationId: string, tomcatServer: TomcatServer): Promise<void> {
        const server: TomcatServer = tomcatServer ? tomcatServer : await this.selectServer(operationId, true);
        if (server) {
            if (server.isStarted()) {
                vscode.window.showInformationMessage(DialogMessage.serverRunning);
                return;
            }
            await this.startTomcat(operationId, server);
        }
    }

    public async runOrDebugOnServer(operationId: string, uri: vscode.Uri, debug?: boolean, server?: TomcatServer): Promise<void> {
        if (!uri) {
            const dialog: vscode.Uri[] = await Utility.trackTelemetryStep(operationId, 'select war', () => vscode.window.showOpenDialog({
                defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
                canSelectFiles: true,
                canSelectFolders: false,
                openLabel: DialogMessage.selectWarPackage
            }));
            if (_.isEmpty(dialog) || !dialog[0].fsPath) {
                return;
            }
            uri = dialog[0];
        }

        if (!await this.isWebappPathValid(uri.fsPath)) {
            return;
        }
        server = !server ? await this.selectServer(operationId, true) : server;
        if (!server) {
            return;
        }
        await this.deployWebapp(operationId, server, uri.fsPath);
        if (server.isStarted() && ((!server.isDebugging() && !debug) || server.isDebugging() === debug)) {
            return;
        }
        if (debug) {
            await this.prepareDebugInfo(operationId, server, uri);
        } else {
            server.clearDebugInfo();
        }
        if (server.isStarted()) {
            Utility.infoTelemetryStep(operationId, 'restart');
            await this.stopOrRestartServer(operationId, server, true);
        } else {
            Utility.infoTelemetryStep(operationId, 'start');
            await this.startTomcat(operationId, server);
        }
    }

    public async browseServer(operationId: string, tomcatServer: TomcatServer): Promise<void> {
        if (tomcatServer) {
            if (!tomcatServer.isStarted()) {
                const result: MessageItem = await vscode.window.showInformationMessage(DialogMessage.startServer, DialogMessage.yes, DialogMessage.cancel);
                if (result !== DialogMessage.yes) {
                    return;
                }
                this.startServer(operationId, tomcatServer);
            }
            const httpPort: string = await Utility.trackTelemetryStep(operationId, 'get http port', () =>
                Utility.getPort(tomcatServer.getServerConfigPath(), Constants.PortKind.Http));
            Utility.infoTelemetryStep(operationId, 'browse server');
            opn(new URL(`${Constants.LOCALHOST}:${httpPort}`).toString());
        }
    }

    public async generateWarPackage(): Promise<void> {
        const folders: vscode.WorkspaceFolder[] = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            let items: vscode.QuickPickItem[] = [];
            if (folders.length > 1) {
                items = await vscode.window.showQuickPick(
                    folders.map((w: vscode.WorkspaceFolder) => {
                        return { label: w.name, description: w.uri.fsPath };
                    }),
                    { placeHolder: DialogMessage.pickFolderToGenerateWar, canPickMany: true }
                );
            } else {
                items.push({
                    label: folders[0].name,
                    description: folders[0].uri.fsPath
                });
            }
            await Promise.all(items.map((i: vscode.QuickPickItem) => {
                return Utility.executeCMD(this._outputChannel, undefined, 'jar', { cwd: i.description, shell: true }, 'cvf', ...[`"${i.label}.war"`, '*']);
            }));
            vscode.window.showInformationMessage(DialogMessage.getWarGeneratedInfo(items.length));
        }
    }

    public dispose(): void {
        this._tomcatModel.getServerSet().forEach((element: TomcatServer) => {
            if (element.isStarted()) {
                this.stopOrRestartServer(createUuid(), element);
            }
            this._outputChannel.dispose();
        });
        this._tomcatModel.saveServerListSync();
    }

    private async isWebappPathValid(webappPath: string): Promise<boolean> {
        if (!await fse.pathExists(webappPath)) {
            return false;
        }
        const stat: fs.Stats = await new Promise((resolve: (r: fs.Stats) => void, reject: (E: Error) => void): void => {
            fs.lstat(webappPath, (err: Error, res: fs.Stats) => {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        });
        if (stat.isFile() && !this.isWarFile(webappPath)) {
            vscode.window.showErrorMessage(DialogMessage.invalidWarFile);
            return false;
        }
        if (stat.isDirectory() && !await fse.pathExists(path.join(webappPath, 'WEB-INF'))) {
            vscode.window.showErrorMessage(DialogMessage.invalidWebappFolder);
            return false;
        }
        return true;
    }

    private async prepareDebugInfo(operationId: string, server: TomcatServer, uri: vscode.Uri): Promise<void> {
        if (!server || !uri) {
            return;
        }
        let workspaceFolder: vscode.WorkspaceFolder;
        if (vscode.workspace.workspaceFolders) {
            workspaceFolder = vscode.workspace.workspaceFolders.find((f: vscode.WorkspaceFolder): boolean => {
                const relativePath: string = path.relative(f.uri.fsPath, uri.fsPath);
                return relativePath === '' || (!relativePath.startsWith('..') && relativePath !== uri.fsPath);
            });
        }
        if (!workspaceFolder) {
            Utility.infoTelemetryStep(operationId, 'no proper workspace folder');
            vscode.window.showErrorMessage(DialogMessage.noPackage);
            return;
        }
        Utility.infoTelemetryStep(operationId, 'get debug port');
        const port: number = await portfinder.getPortPromise();
        server.setDebugInfo(port, workspaceFolder);
    }

    private async selectServer(operationId: string, createIfNoneServer: boolean = false): Promise<TomcatServer> {
        let items: vscode.QuickPickItem[] = this._tomcatModel.getServerSet();
        if (_.isEmpty(items) && !createIfNoneServer) {
            return;
        }
        if (items.length === 1) {
            Utility.infoTelemetryStep(operationId, 'auto select the only server');
            return <TomcatServer>items[0];
        }
        items = createIfNoneServer ? items.concat({ label: `$(plus) ${DialogMessage.addServer}`, description: '' }) : items;
        const pick: vscode.QuickPickItem = await vscode.window.showQuickPick(
            items,
            { placeHolder: createIfNoneServer && items.length === 1 ? DialogMessage.addServer : DialogMessage.selectServer }
        );

        if (pick) {
            if (pick instanceof TomcatServer) {
                Utility.infoTelemetryStep(operationId, 'select server');
                return pick;
            } else {
                Utility.infoTelemetryStep(operationId, 'add server');
                return await this.addServer(operationId);
            }
        }
    }

    private async deployWebapp(operationId: string, server: TomcatServer, webappPath: string): Promise<void> {
        if (!server || !await fse.pathExists(webappPath)) {
            return;
        }
        const appName: string = await this.determineAppName(webappPath, server);
        const appPath: string = path.join(server.getStoragePath(), 'webapps', appName);

        await fse.remove(appPath);
        await fse.mkdirs(appPath);
        if (this.isWarFile(webappPath)) {
            Utility.infoTelemetryStep(operationId, 'deploy war');
            await Utility.executeCMD(this._outputChannel, server.getName(), 'jar', { cwd: appPath }, 'xvf', `${webappPath}`);
        } else {
            Utility.infoTelemetryStep(operationId, 'deploy web app folder');
            await fse.copy(webappPath, appPath);
        }
        vscode.commands.executeCommand('tomcat.tree.refresh');
    }

    private isWarFile(filePath: string): boolean {
        return path.extname(filePath).toLocaleLowerCase() === '.war';
    }

    /* tslint:disable:no-any */
    private async determineAppName(webappPath: string, server: TomcatServer): Promise<string> {
        const defaultName: string = path.basename(webappPath, path.extname(webappPath));
        let appName: string = defaultName;
        let folderLocation: string;
        if (this.isWarFile(webappPath)) {
            folderLocation = path.join(this._tomcatModel.defaultStoragePath, defaultName);
            await fse.remove(folderLocation);
            await fse.mkdir(folderLocation);
            await Utility.executeCMD(this._outputChannel, server.getName(), 'jar', { cwd: folderLocation }, 'xvf', `${webappPath}`);
        } else {
            folderLocation = webappPath;
        }
        if (await fse.pathExists(path.join(folderLocation, 'META-INF', 'context.xml'))) {
            const xml: string = fs.readFileSync(path.join(folderLocation, 'META-INF', 'context.xml'), 'utf8');
            const jsonFromXml: any = await Utility.parseXml(xml);
            if (jsonFromXml) {
                if (jsonFromXml.Context && jsonFromXml.Context.$ && jsonFromXml.Context.$.path) {
                    appName = this.parseContextPathToFolderName(jsonFromXml.Context.$.path);
                } else if (jsonFromXml.context && jsonFromXml.context.$ && jsonFromXml.context.$.path) {
                    appName = this.parseContextPathToFolderName(jsonFromXml.context.$.path);
                }
            }
        }
        return appName;
    }
    /* tsline:enable:no-any */

    private parseContextPathToFolderName(context: string): string {
        if (context === '/' || context === '') {
            return 'ROOT';
        }
        const replacedSlashes: string = context.replace('/', '#');
        return replacedSlashes.startsWith('#') ? replacedSlashes.substring(1) : replacedSlashes;
    }

    private startDebugSession(operationId: string, server: TomcatServer): void {
        if (!server || !server.getDebugPort() || !server.getDebugWorkspace()) {
            return;
        }
        const config: vscode.DebugConfiguration = {
            type: 'java',
            name: `${Constants.DEBUG_SESSION_NAME}_${server.basePathName}`,
            request: 'attach',
            hostName: 'localhost',
            port: server.getDebugPort()
        };
        Utility.infoTelemetryStep(operationId, 'start debug');
        setTimeout(() => vscode.debug.startDebugging(server.getDebugWorkspace(), config), 500);
    }

    private async startTomcat(operationId: string, serverInfo: TomcatServer): Promise<void> {
        const serverName: string = serverInfo.getName();
        let watcher: chokidar.FSWatcher;
        const serverConfig: string = serverInfo.getServerConfigPath();
        const serverPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Server);
        const httpPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Http);
        const httpsPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Https);
        Utility.setEnv(vscode.workspace.rootPath);
        try {
            await this._tomcatModel.updateJVMOptions(serverName);
            watcher = chokidar.watch(serverConfig);
            watcher.on('change', async () => {
                if (serverPort !== await Utility.getPort(serverConfig, Constants.PortKind.Server)) {
                    Utility.infoTelemetryStep(operationId, 'server port changed');
                    const result: MessageItem = await vscode.window.showErrorMessage(
                        DialogMessage.getServerPortChangeErrorMessage(serverName, serverPort), DialogMessage.yes, DialogMessage.no, DialogMessage.moreInfo
                    );

                    if (result === DialogMessage.yes) {
                        Utility.infoTelemetryStep(operationId, 'revert');
                        await Utility.setPort(serverConfig, Constants.PortKind.Server, serverPort);
                    } else if (result === DialogMessage.moreInfo) {
                        Utility.infoTelemetryStep(operationId, 'more info clicked');
                        opn(Constants.UNABLE_SHUTDOWN_URL);
                    }
                } else if (await Utility.needRestart(httpPort, httpsPort, serverConfig)) {
                    Utility.infoTelemetryStep(operationId, 'http(s) port changed');
                    const item: MessageItem = await vscode.window.showWarningMessage(
                        DialogMessage.getConfigChangedMessage(serverName), DialogMessage.yes, DialogMessage.no, DialogMessage.never
                    );

                    if (item === DialogMessage.yes) {
                        await this.stopOrRestartServer(operationId, serverInfo, true);
                    } else if (item === DialogMessage.never) {
                        Utility.infoTelemetryStep(operationId, 'disable auto restart');
                        Utility.disableAutoRestart();
                    }
                }
            });

            let startArguments: string[] = serverInfo.jvmOptions.slice();
            if (serverInfo.getDebugPort()) {
                startArguments = [`${Constants.DEBUG_ARGUMENT_KEY}${serverInfo.getDebugPort()}`].concat(startArguments);
            }
            startArguments.push('start');
            const javaProcess: Promise<void> = Utility.executeCMD(this._outputChannel, serverInfo.getName(), Utility.getJavaExecutable(), { shell: true }, ...startArguments);
            serverInfo.setStarted(true);
            this.startDebugSession(operationId, serverInfo);
            await javaProcess;
            serverInfo.setStarted(false);
            watcher.close();
            if (serverInfo.needRestart) {
                serverInfo.needRestart = false;
                await this.startTomcat(operationId, serverInfo);
            }
        } catch (err) {
            serverInfo.setStarted(false);
            if (watcher) { watcher.close(); }
            sendOperationError(operationId, 'startTomcat', err);
            vscode.window.showErrorMessage(err.toString());
        }
    }
    private async precheck(operationId: string, tomcatServer: TomcatServer): Promise<TomcatServer> {
        if (_.isEmpty(this._tomcatModel.getServerSet())) {
            vscode.window.showInformationMessage(DialogMessage.noServer);
            return;
        }
        return tomcatServer ? tomcatServer : await this.selectServer(operationId);
    }
}
