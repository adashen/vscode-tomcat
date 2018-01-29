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

    public openServerConfig(tomcatServer: TomcatServer): void {
        if (!tomcatServer) {
            throw (new Error(DialogMessage.noServer));
        }
        Utility.openFile(tomcatServer.getServerConfigPath());
    }

    public async createTomcatServer(serverName: string, tomcatInstallPath: string): Promise<void> {
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
            fse.copy(path.join(this._extensionPath, 'resources', 'vm.properties'), path.join(catalinaBasePath, 'vm.properties')),
            fse.mkdirs(path.join(catalinaBasePath, 'logs')),
            fse.mkdirs(path.join(catalinaBasePath, 'temp')),
            fse.mkdirs(path.join(catalinaBasePath, 'work'))
        ]);

        const tomcatServer: TomcatServer = new TomcatServer(serverName, tomcatInstallPath, storagePath);
        this._tomcatModel.addServer(tomcatServer);
        vscode.commands.executeCommand('tomcat.tree.refresh');
    }

    public async stopServer(serverInfo: TomcatServer, restart: boolean = false): Promise<void> {
        if (!serverInfo) {
            throw new Error(DialogMessage.noServer);
        }
        if (!serverInfo.isStarted()) {
            vscode.window.showInformationMessage(DialogMessage.serverStopped);
            return;
        }
        await Utility.executeCMD(serverInfo.outputChannel, 'java', { shell: true }, ...serverInfo.vmOptions.concat('stop'));
        serverInfo.needRestart = restart;
    }

    public customizeVMOptions(serverInfo: TomcatServer): void {
        if (!serverInfo) {
            return;
        }
        Utility.openFile(serverInfo.getVMOptionFile());
    }

    public async openServer(serverInfo: TomcatServer): Promise<void> {
        const httpPort: string = await Utility.getPort(serverInfo.getServerConfigPath(), Constants.PortKind.Http);
        if (!httpPort) {
            throw new Error('No http port found in server.xml');
        }
        // tslint:disable-next-line:no-http-string
        await opn(`http://localhost:${httpPort}`);
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
            if (vscode.workspace.workspaceFolders) {
                workspaceFolder = vscode.workspace.workspaceFolders.find((f: vscode.WorkspaceFolder): boolean => {
                    const relativePath: string = path.relative(f.uri.fsPath, packagePath);
                    return relativePath === '' || (!relativePath.startsWith('..') && relativePath !== packagePath);
                });
            }
            if (!workspaceFolder) {
                throw new Error(DialogMessage.noPackage);
            }
            port = await Utility.getFreePort();
        }

        serverInfo.setDebugInfo(debug, port, workspaceFolder);
        if (serverInfo.isStarted()) {
            await this.stopServer(serverInfo, true);
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
        const appPath: string = path.join(serverInfo.getStoragePath(), serverInfo.getName(), 'webapps', appName);

        await fse.remove(appPath);
        await fse.mkdirs(appPath);
        await Utility.executeCMD(serverInfo.outputChannel, 'jar', {cwd: appPath}, 'xvf', `${packagePath}`);
        return appName;
    }

    private startDebugSession(serverInfo: TomcatServer): void {
        if (!serverInfo || !serverInfo.getDebugPort() || !serverInfo.getDebugWorkspace()) {
            return;
        }
        const config: vscode.DebugConfiguration = {
            type: 'java',
            name: 'Tomcat Debug (Attach)',
            request: 'attach',
            hostName: 'localhost',
            port: serverInfo.getDebugPort()
        };
        setTimeout(() => vscode.debug.startDebugging(serverInfo.getDebugWorkspace(), config), 500);
    }

    private async startTomcat(serverInfo: TomcatServer, appName: string): Promise<void> {
        const serverConfig: string = serverInfo.getServerConfigPath();
        const httpPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Http);
        if (!httpPort) {
            throw new Error('No http port found in server.xml');
        }
        const serverPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Server);
        const httpsPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Https);
        const serverName: string = serverInfo.getName();
        let watcher: chokidar.FSWatcher;
        let statusBarItem: vscode.StatusBarItem;
        let statusBarCommand: vscode.Disposable;
        await serverInfo.updateVMOptions();
        // tslint:disable-next-line:no-http-string
        const serverUri: string = `http://localhost:${httpPort}/${appName}`;
        statusBarItem = vscode.window.createStatusBarItem();
        statusBarItem.command = `open.${serverName}`;
        statusBarItem.text = `$(browser) Open ${appName}`;
        statusBarItem.tooltip = localize('tomcatExt.open', 'Open: {0}', serverUri);
        statusBarCommand = vscode.commands.registerCommand(statusBarItem.command, async () => {
            opn(serverUri);
        });
        statusBarItem.show();

        try {
            watcher = chokidar.watch(serverConfig);
            watcher.on('change', async () => {
                if (serverPort !== await Utility.getPort(serverConfig, Constants.PortKind.Server)) {
                    vscode.window.showErrorMessage(localize('tomcatExt.serverPortChangeError', `Changing the server port of a running server will cause errors, please change it back to ${ serverPort} ！`));
                } else if (httpPort !== await Utility.getPort(serverConfig, Constants.PortKind.Http) ||
                           httpsPort !== await Utility.getPort(serverConfig, Constants.PortKind.Https)) {
                    const promptString: string = localize('tomcatExt.configChanged',
                                                          'server.xml of running server {0} has been changed. Would you like to restart it?',
                                                          serverName);
                    const item: vscode.MessageItem = await vscode.window.showInformationMessage(promptString, DialogMessage.yes, DialogMessage.no);
                    if (item === DialogMessage.yes) {
                        try {
                            // Need restart tomcat
                            await this.stopServer(serverInfo);
                            serverInfo.needRestart = true;
                        } catch (err) {
                            console.error(err.toString());
                            vscode.window.showErrorMessage(localize('tomcatExt.stopFailure', 'Failed to stop Tomcat Server {0}', serverName));
                        }
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
            Utility.disposeResources(statusBarItem, statusBarCommand);
            watcher.close();
            if (serverInfo.needRestart) {
                serverInfo.needRestart = false;
                await this.startTomcat(serverInfo, appName);
            }
        } catch (err) {
            serverInfo.setStarted(false);
            Utility.disposeResources(statusBarItem, statusBarCommand);
            if (watcher) { watcher.close(); }
            throw new Error(err.toString());
        }
    }
}
