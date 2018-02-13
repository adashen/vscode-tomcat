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
import { TelemetryWrapper } from "vscode-extension-telemetry-wrapper";
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
        Utility.initTelemetrySteps();
        const server: TomcatServer = await this.precheck(tomcatServer);
        if (server) {
            if (server.isStarted()) {
                const confirmation: MessageItem = await vscode.window.showWarningMessage(DialogMessage.deleteConfirm, DialogMessage.yes, DialogMessage.cancel);
                if (confirmation !== DialogMessage.yes) {
                    Utility.trackTelemetryStep('cancel delete');
                    return;
                }
                Utility.trackTelemetryStep('stop server');
                await this.doStopOrRestartServer(server);
            }
            Utility.trackTelemetryStep('delete server');
            this._tomcatModel.deleteServer(server);
        }
    }

    public async stopOrRestartServer(tomcatServer: TomcatServer, restart: boolean = false): Promise<void> {
        Utility.initTelemetrySteps();
        this.doStopOrRestartServer(tomcatServer, restart);
    }

    public async openServerConfig(tomcatServer: TomcatServer): Promise<void> {
        if (tomcatServer) {
            Utility.initTelemetrySteps();
            const configFile: string = tomcatServer.getServerConfigPath();
            if (!await fse.pathExists(configFile)) {
                Utility.trackTelemetryStep('no server configuration');
                throw new Error(DialogMessage.noServerConfig);
            }
            Utility.trackTelemetryStep('show server configuration');
            vscode.window.showTextDocument(vscode.Uri.file(configFile), { preview: false });
        }
    }

    public async browseWarPackage(warPackage: WarPackage): Promise<void> {
        if (warPackage) {
            Utility.initTelemetrySteps();
            const server: TomcatServer = this._tomcatModel.getTomcatServer(warPackage.serverName);
            const httpPort: string = await Utility.getPort(server.getServerConfigPath(), Constants.PortKind.Http);
            if (!server.isStarted()) {
                const result: MessageItem = await vscode.window.showInformationMessage(DialogMessage.startServer, DialogMessage.yes, DialogMessage.no);
                if (result === DialogMessage.yes) {
                    Utility.trackTelemetryStep('start server');
                    this.doStartServer(server);
                }
            }
            Utility.trackTelemetryStep('browse war package');
            opn(new URL(warPackage.label, `${Constants.LOCALHOST}:${httpPort}`).toString());
        }
    }

    public async deleteWarPackage(warPackage: WarPackage): Promise<void> {
        if (warPackage) {
            Utility.initTelemetrySteps();
            Utility.trackTelemetryStep('delete war package');
            await fse.remove(warPackage.storagePath);
            vscode.commands.executeCommand('tomcat.tree.refresh');
        }
    }

    public reveralWarPackage(warPackage: WarPackage): void {
        if (warPackage) {
            Utility.initTelemetrySteps();
            Utility.trackTelemetryStep('reveal war package in explorer');
            opn(warPackage.storagePath);
        }
    }

    public async createServer(): Promise<TomcatServer> {
        Utility.initTelemetrySteps();
        return await this.doCreateServer();
    }

    public async renameServer(tomcatServer: TomcatServer): Promise<void> {
        Utility.initTelemetrySteps();
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
                Utility.trackTelemetryStep('rename');
                server.rename(newName);
                await this._tomcatModel.saveServerList();
            }
        }
    }

    public async startServer(tomcatServer: TomcatServer): Promise<void> {
        Utility.initTelemetrySteps();
        this.doStartServer(tomcatServer);
    }

    public async runOrDebugOnServer(uri?: vscode.Uri, debug?: boolean): Promise<void> {
        Utility.initTelemetrySteps();
        if (!uri) {
            Utility.trackTelemetryStep('select war package');
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
            Utility.trackTelemetryStep('operation canceled');
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
                Utility.trackTelemetryStep('no proper workspace folder');
                vscode.window.showErrorMessage(DialogMessage.noPackage);
                return;
            }
            Utility.trackTelemetryStep('get debug port');
            port = await portfinder.getPortPromise();
        }

        server.setDebugInfo(debug, port, workspaceFolder);
        if (server.isStarted()) {
            Utility.trackTelemetryStep('restart server');
            await this.doStopOrRestartServer(server, true);
        } else {
            Utility.trackTelemetryStep('start server');
            await this.startTomcat(server);
        }
    }

    public async browseServer(tomcatServer: TomcatServer): Promise<void> {
        if (tomcatServer) {
            Utility.initTelemetrySteps();
            Utility.trackTelemetryStep('get http port');
            const httpPort: string = await Utility.getPort(tomcatServer.getServerConfigPath(), Constants.PortKind.Http);
            Utility.trackTelemetryStep('browse server');
            opn(new URL(`${Constants.LOCALHOST}:${httpPort}`).toString());
        }
    }

    public dispose(): void {
        this._tomcatModel.getServerSet().forEach((element: TomcatServer) => {
            if (element.isStarted()) {
                this.doStopOrRestartServer(element);
            }
            element.outputChannel.dispose();
        });
        this._tomcatModel.saveServerListSync();
    }

    private async doStopOrRestartServer(tomcatServer: TomcatServer, restart: boolean = false): Promise<void> {
        const server: TomcatServer = await this.precheck(tomcatServer);
        if (server) {
            if (!server.isStarted()) {
                Utility.trackTelemetryStep('server was stopped');
                vscode.window.showInformationMessage(DialogMessage.serverStopped);
                return;
            }
            Utility.trackTelemetryStep(`${restart ? 'restart' : 'stop'} server`);
            await Utility.executeCMD(server.outputChannel, 'java', { shell: true }, ...this.getJavaArgs(server, false));
            server.needRestart = restart;
        }
    }

    private async doStartServer(tomcatServer: TomcatServer): Promise<void> {
        const server: TomcatServer = tomcatServer ? tomcatServer : await this.selectServer(true);
        if (server) {
            if (server.isStarted()) {
                Utility.trackTelemetryStep('server already started');
                vscode.window.showInformationMessage(DialogMessage.serverRunning);
                return;
            }
            Utility.trackTelemetryStep('start server');
            await this.startTomcat(server);
        }
    }

    private async doCreateServer(): Promise<TomcatServer> {
        Utility.trackTelemetryStep('select tomcat install path');
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
            Utility.trackTelemetryStep('install path validation failed');
            vscode.window.showErrorMessage(Constants.INVALID_SERVER_DIRECTORY);
            return;
        }
        Utility.trackTelemetryStep('construct server name');
        const serverName: string = await Utility.getServerName(tomcatInstallPath, this._tomcatModel.defaultStoragePath);
        const catalinaBasePath: string = await Utility.getServerStoragePath(this._tomcatModel.defaultStoragePath, serverName);
        await fse.remove(catalinaBasePath);
        Utility.trackTelemetryStep('copy files');
        await Promise.all([
            Utility.copyServerConfig(path.join(tomcatInstallPath, 'conf', 'server.xml'),  path.join(catalinaBasePath, 'conf', 'server.xml')),
            fse.copy(path.join(tomcatInstallPath, 'conf', 'web.xml'), path.join(catalinaBasePath, 'conf', 'web.xml')),
            fse.copy(path.join(this._extensionPath, 'resources', 'index.jsp'), path.join(catalinaBasePath, 'webapps', 'ROOT', 'index.jsp')),
            fse.copy(path.join(this._extensionPath, 'resources', 'icon.png'), path.join(catalinaBasePath, 'webapps', 'ROOT', 'icon.png')),
            fse.mkdirs(path.join(catalinaBasePath, 'logs')),
            fse.mkdirs(path.join(catalinaBasePath, 'temp')),
            fse.mkdirs(path.join(catalinaBasePath, 'work'))
        ]);
        const tomcatServer: TomcatServer = new TomcatServer(serverName, tomcatInstallPath, catalinaBasePath);
        this._tomcatModel.addServer(tomcatServer);
        Utility.trackTelemetryStep('add server to server list');
        return tomcatServer;
    }

    private async selectServer(createIfNoneServer: boolean = false): Promise<TomcatServer> {
        let items: vscode.QuickPickItem[] = this._tomcatModel.getServerSet();
        if (Utility.isEmpty(items) && !createIfNoneServer) {
            Utility.trackTelemetryStep('no server');
            return;
        }
        items = createIfNoneServer ? items.concat({ label: `$(plus) ${DialogMessage.createServer}`, description: '' }) : items;
        const pick: vscode.QuickPickItem = await vscode.window.showQuickPick(
            items,
            { placeHolder: createIfNoneServer && items && items.length === 1 ? DialogMessage.createServer : DialogMessage.selectServer }
        );

        if (pick) {
            if (pick instanceof TomcatServer) {
                Utility.trackTelemetryStep('select a server');
                return pick;
            } else {
                Utility.trackTelemetryStep('create a new server');
                return await this.doCreateServer();
            }
        }
    }

    private async deployPackage(serverInfo: TomcatServer, packagePath: string): Promise<void> {
        const appName: string =  path.basename(packagePath, path.extname(packagePath));
        const appPath: string = path.join(serverInfo.getStoragePath(), 'webapps', appName);

        await fse.remove(appPath);
        await fse.mkdirs(appPath);
        Utility.trackTelemetryStep('deploy war package');
        await Utility.executeCMD(serverInfo.outputChannel, 'jar', {cwd: appPath}, 'xvf', `${packagePath}`);
        vscode.commands.executeCommand('tomcat.tree.refresh');
    }

    private getJavaArgs(serverInfo: TomcatServer, start: boolean): string[] {
        const catalinaBase: string = serverInfo.getStoragePath();
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
        Utility.trackTelemetryStep('start debug session');
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
            watcher = chokidar.watch(serverConfig);
            watcher.on('change', async () => {
                if (serverPort !== await Utility.getPort(serverConfig, Constants.PortKind.Server)) {
                    Utility.trackTelemetryStep('server port changed');
                    const result: MessageItem = await vscode.window.showErrorMessage(
                        DialogMessage.getServerPortChangeErrorMessage(serverName, serverPort), DialogMessage.yes, DialogMessage.no, DialogMessage.moreInfo
                    );

                    if (result === DialogMessage.yes) {
                        Utility.trackTelemetryStep('server port reverted');
                        await Utility.setPort(serverConfig, Constants.PortKind.Server, serverPort);
                    } else if (result === DialogMessage.moreInfo) {
                        Utility.trackTelemetryStep('server port change more info clicked');
                        opn(Constants.UNABLE_SHUTDOWN_URL);
                    }
                } else if (await Utility.needRestart(httpPort, httpsPort, serverConfig)) {
                    Utility.trackTelemetryStep('http(s) port changed');
                    const item: MessageItem = await vscode.window.showWarningMessage(
                        DialogMessage.getConfigChangedMessage(serverName), DialogMessage.yes, DialogMessage.no, DialogMessage.never
                    );

                    if (item === DialogMessage.yes) {
                        Utility.trackTelemetryStep('server restarted');
                        await this.doStopOrRestartServer(serverInfo, true);
                    } else if (item === DialogMessage.never) {
                        Utility.trackTelemetryStep('disable auto restart');
                        Utility.disableAutoRestart();
                    }
                }
            });

            const javaProcess: Promise<void> = Utility.executeCMD(serverInfo.outputChannel, 'java', { shell: true }, ...this.getJavaArgs(serverInfo, true));
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
            Utility.trackTelemetryStep(`start server exception: ${err}`);
            if (watcher) { watcher.close(); }
            throw new Error(err.toString());
        }
    }
    private async precheck(tomcatServer: TomcatServer): Promise<TomcatServer> {
        if (Utility.isEmpty(this._tomcatModel.getServerSet())) {
            vscode.window.showInformationMessage(DialogMessage.noServer);
            Utility.trackTelemetryStep('no server');
            return;
        }
        return tomcatServer ? tomcatServer : await this.selectServer();
    }
}
