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
    private _statusBar: vscode.StatusBarItem;
    private _statusBarCommand: vscode.Disposable;

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
            fse.mkdirs(path.join(catalinaBasePath, 'logs')),
            fse.mkdirs(path.join(catalinaBasePath, 'temp')),
            fse.mkdirs(path.join(catalinaBasePath, 'work'))
        ]);

        const tomcatServer: TomcatServer = new TomcatServer(serverName, tomcatInstallPath, storagePath);
        this._tomcatModel.addServer(tomcatServer);
        vscode.commands.executeCommand('tomcat.tree.refresh');
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

    public async clickServer(server: TomcatServer): Promise<void> {
        this.disposeResources(this._statusBar, this._statusBarCommand);
        if (server && server.isStarted()) {
            const serverName: string = server.getName();
            this._statusBar = vscode.window.createStatusBarItem();
            this._statusBar.command = `open.${serverName}`;
            this._statusBar.text = `$(browser) Open ${serverName}`;
            const httpPort: string = await Utility.getPort(server.getServerConfigPath(), Constants.PortKind.Http);
            // tslint:disable-next-line:no-http-string
            const serverUri: string = `http://localhost:${httpPort}`;
            this._statusBar.tooltip = localize('tomcatExt.open', 'Open: {0}', serverUri);
            this._statusBarCommand = vscode.commands.registerCommand(this._statusBar.command, async () => {
                opn(serverUri);
            });
            this._statusBar.show();
        }
    }

    public dispose(): void {
        this.stopServers();
        this._tomcatModel.saveServerListSync();
        this.disposeResources(this._statusBarCommand, this._statusBar);
        this._tomcatModel.getServerSet().forEach((element: TomcatServer) => {
           element.outputChannel.dispose();
        });
    }

    private async run(serverInfo: TomcatServer, packagePath ?: string, debug ?: boolean): Promise<void> {
        if (!serverInfo) {
            throw new Error(DialogMessage.noServer);
        }
        if (packagePath) {
            await this.deployPackage(serverInfo, packagePath);
        }
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
            await this.startTomcat(serverInfo);
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

    private async deployPackage(serverInfo: TomcatServer, packagePath: string): Promise<void> {
        const appName: string =  path.basename(packagePath, path.extname(packagePath));
        const serverName: string = serverInfo.getName();
        const appPath: string = path.join(serverInfo.getStoragePath(), serverName, 'webapps', appName);

        await fse.remove(appPath);
        await fse.mkdirs(appPath);
        await Utility.executeCMD(serverInfo.outputChannel, 'jar', {cwd: appPath}, 'xvf', `${packagePath}`);
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

    private async startTomcat(serverInfo: TomcatServer): Promise<void> {
        const serverConfig: string = serverInfo.getServerConfigPath();
        const serverName: string = serverInfo.getName();
        const serverPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Server);
        const httpPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Http);
        const httpsPort: string = await Utility.getPort(serverConfig, Constants.PortKind.Https);
        let watcher: chokidar.FSWatcher;
        try {
            watcher = chokidar.watch(serverConfig);
            watcher.on('change', async () => {
                if (serverPort !== await Utility.getPort(serverConfig, Constants.PortKind.Server)) {
                    vscode.window.showErrorMessage(DialogMessage.getServerPortChangeErrorMessage(serverName, serverPort));
                } else if (httpPort !== await Utility.getPort(serverConfig, Constants.PortKind.Http) || httpsPort !== await Utility.getPort(serverConfig, Constants.PortKind.Https)) {
                    const item: vscode.MessageItem = await vscode.window.showInformationMessage(DialogMessage.getConfigChangedMessage(serverName), DialogMessage.yes, DialogMessage.no);
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
            serverInfo.setStarted(true);
            this.clickServer(serverInfo);
            this.startDebugSession(serverInfo);
            await javaProcess;
            serverInfo.setStarted(false);
            this.disposeResources(this._statusBar, this._statusBarCommand);
            watcher.close();
            if (serverInfo.needRestart) {
                serverInfo.needRestart = false;
                await this.startTomcat(serverInfo);
            }
        } catch (err) {
            serverInfo.setStarted(false);
            this.disposeResources(this._statusBar, this._statusBarCommand);
            if (watcher) { watcher.close(); }
            throw new Error(err.toString());
        }
    }

    private disposeResources(...resources: vscode.Disposable[]): void {
        if (resources) {
            resources.forEach((item: vscode.Disposable) => { if (item) { item.dispose(); } });
        }
    }
}
