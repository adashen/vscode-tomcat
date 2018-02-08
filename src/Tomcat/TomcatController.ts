'use strict';

import * as chokidar from "chokidar";
import * as fse from "fs-extra";
// tslint:disable-next-line:no-require-imports
import opn = require("opn");
import * as path from "path";
import * as portfinder from "portfinder";
import * as vscode from "vscode";
import { MessageItem } from "vscode";
import * as Constants from "../Constants";
import { DialogMessage } from '../DialogMessage';
import { Utility } from "../Utility";
import { TomcatModel } from "./TomcatModel";
import { TomcatServer } from "./TomcatServer";
import { WarPackage } from "./WarPackage";

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
            const confirmation: MessageItem = await vscode.window.showWarningMessage(DialogMessage.deleteConfirm, DialogMessage.yes, DialogMessage.cancel);
            if (confirmation !== DialogMessage.yes) {
                return;
            }
            await this.stopOrRestartServer(tomcatServer);
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

    public async browseWarPackage(warPackage: WarPackage): Promise<void> {
        if (warPackage) {
            const server: TomcatServer = this._tomcatModel.getTomcatServer(warPackage.serverName);
            opn(await this.getServerUri(server, warPackage.label));
            if (!server.isStarted()) {
                const result: MessageItem = await vscode.window.showInformationMessage(DialogMessage.startServerToBrowseWarPackage, DialogMessage.yes, DialogMessage.no);
                if (result === DialogMessage.yes) {
                    this.startServer(server);
                }
            }
        }
    }

    public async createTomcatServer(tomcatInstallPath: string): Promise<string> {
        const serverName: string = await Utility.getServerName(tomcatInstallPath, this._tomcatModel.defaultStoragePath);
        const serverConfigFile: string = path.join(tomcatInstallPath, 'conf', 'server.xml');
        const serverWebFile: string = path.join(tomcatInstallPath, 'conf', 'web.xml');
        const serverBootstrapJarFile: string = path.join(tomcatInstallPath, 'bin', 'bootstrap.jar');
        const serverJuliJarFile: string = path.join(tomcatInstallPath, 'bin', 'tomcat-juli.jar');

        if (!await fse.pathExists(serverConfigFile) || !await fse.pathExists(serverWebFile) ||
            !await fse.pathExists(serverBootstrapJarFile) || !await fse.pathExists(serverJuliJarFile)) {
            throw new Error(Constants.INVALID_SERVER_DIRECTORY);
        }
        const catalinaBasePath: string = Utility.getServerStoragePath(this._tomcatModel.defaultStoragePath, serverName);
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
        const tomcatServer: TomcatServer = new TomcatServer(serverName, tomcatInstallPath, catalinaBasePath);
        this._tomcatModel.addServer(tomcatServer);
        vscode.commands.executeCommand('tomcat.tree.refresh');
        return serverName;
    }

    public async renameServer(server: TomcatServer): Promise<void> {
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
        if (!newName) {
            return;
        }
        server.rename(newName);
        await this._tomcatModel.saveServerList();
        vscode.commands.executeCommand('tomcat.tree.refresh');
    }

    public async stopOrRestartServer(serverInfo: TomcatServer, restart: boolean = false): Promise<void> {
        if (!serverInfo) {
            throw new Error(DialogMessage.noServer);
        }

        await Utility.executeCMD(serverInfo.outputChannel, 'java', { shell: true }, ...this.getJavaArgs(serverInfo, false));
        serverInfo.needRestart = restart;
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
                throw new Error(DialogMessage.noPackage);
            }
            port = await portfinder.getPortPromise();
        }

        serverInfo.setDebugInfo(debug, port, workspaceFolder);
        if (serverInfo.isStarted()) {
            await this.stopOrRestartServer(serverInfo, true);
        } else {
            await this.startTomcat(serverInfo, appName);
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
        return appName;
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
                    const result: MessageItem = await vscode.window.showErrorMessage(
                        DialogMessage.getServerPortChangeErrorMessage(serverName, serverPort), DialogMessage.yes, DialogMessage.no, DialogMessage.moreInfo
                    );
                    if (result === DialogMessage.yes) {
                        await Utility.setPort(serverConfig, Constants.PortKind.Server, serverPort);
                    } else if (result === DialogMessage.moreInfo) {
                        opn(Constants.UNABLE_SHUTDOWN_URL);
                    }
                } else if (Utility.getRestartConfig() && (httpPort !== await Utility.getPort(serverConfig, Constants.PortKind.Http) ||
                    httpsPort !== await Utility.getPort(serverConfig, Constants.PortKind.Https))
                ) {
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

            const javaProcess: Promise<void> = Utility.executeCMD(serverInfo.outputChannel, 'java', { shell: true }, ...this.getJavaArgs(serverInfo, true));
            serverInfo.setStarted(true);
            this.startDebugSession(serverInfo);
            await javaProcess;
            serverInfo.setStarted(false);
            watcher.close();
            if (serverInfo.needRestart) {
                serverInfo.needRestart = false;
                await this.startTomcat(serverInfo, appName);
            }
        } catch (err) {
            serverInfo.setStarted(false);
            if (watcher) { watcher.close(); }
            throw new Error(err.toString());
        }
    }
}
