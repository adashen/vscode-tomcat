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
import { Tomcat } from "./Tomcat";
import { TomcatServer } from "./TomcatServer";

export class TomcatController {
    private _outputChannels: Map<string, vscode.OutputChannel>;
    private _tomcat: Tomcat;
    private _contextExtensionPath: string;

    constructor(tomcat: Tomcat, extensionPath: string) {
      this._outputChannels = new Map<string, vscode.OutputChannel>();
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
            throw (new Error(DialogMessage.noServer));
        }

        if (tomcatServer.isStarted()) {
            const confirmation: MessageItem | undefined = await vscode.window.showWarningMessage(DialogMessage.deleteConfirm, DialogMessage.yes, DialogMessage.cancel);
            if (confirmation !== DialogMessage.yes) {
                return;
            }
            await this.stopServer(tomcatServer);
        }

        if (this._tomcat.deleteServer(tomcatServer)) {
            const output: vscode.OutputChannel = this.getOutput(tomcatServer);
            this._outputChannels.delete(this.getChannelName(tomcatServer));
            output.dispose();
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

        const catalinaBasePath: string = path.join(this._tomcat.getExtensionPath(), serverName);
        await fse.remove(catalinaBasePath);
        await Promise.all([
            fse.copy(serverConfigFile, path.join(catalinaBasePath, 'conf', 'server.xml')),
            fse.copy(serverWebFile, path.join(catalinaBasePath, 'conf', 'web.xml')),
            fse.copy(path.join(this._contextExtensionPath, 'resources', 'index.jsp'), path.join(catalinaBasePath, 'webapps', 'ROOT', 'index.jsp')),
            fse.mkdirs(path.join(catalinaBasePath, 'logs')),
            fse.mkdirs(path.join(catalinaBasePath, 'temp')),
            fse.mkdirs(path.join(catalinaBasePath, 'work'))
        ]);

        const tomcatServer: TomcatServer = new TomcatServer(serverName, tomcatInstallPath, this._tomcat.getExtensionPath());
        this._tomcat.addServer(tomcatServer);
        vscode.commands.executeCommand('tomcat.tree.refresh');
    }

    public async stopServer(serverInfo: TomcatServer): Promise<void> {
        if (!serverInfo) {
            throw new Error(DialogMessage.noServer);
        }

        await Utility.executeCMD(this.getOutput(serverInfo), 'java', { shell: true }, ...this.getJavaArgs(serverInfo, false));
    }

    public async restartServer(serverInfo: TomcatServer): Promise<void> {
        if (!serverInfo) {
            throw new Error(DialogMessage.noServer);
        }
        if (serverInfo.isStarted()) {
            serverInfo.needRestart = true;
            await Utility.executeCMD(this.getOutput(serverInfo), 'java', { shell: true }, ...this.getJavaArgs(serverInfo, false));
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

    public dispose(): void {
        this.stopServers();
        this._tomcat.saveServerListSync();
        this._outputChannels.forEach((value: vscode.OutputChannel, key: string) => value.dispose());
    }

    private async run(serverInfo: TomcatServer, packagePath ?: string, debug ?: boolean): Promise<void> {
        if (!serverInfo) {
            throw new Error(DialogMessage.noServer);
        }

        const output: vscode.OutputChannel = this.getOutput(serverInfo);
        const appName: string = packagePath ? await this.deployPackage(serverInfo, packagePath, output) : '';
        if (serverInfo.isStarted() && serverInfo.isDebugging() === debug) {
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
            await Utility.executeCMD(this.getOutput(serverInfo), 'java', { shell: true }, ...this.getJavaArgs(serverInfo, false));
        } else {
            await this.startTomcat(serverInfo, appName, output);
        }
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
        const appName: string =  path.basename(packagePath, path.extname(packagePath));
        const serverName: string = serverInfo.getName();
        const appPath: string = path.join(this._tomcat.getExtensionPath(), serverName, 'webapps', appName);

        await fse.remove(appPath);
        await fse.mkdirs(appPath);
        await Utility.executeCMD(output, 'jar', {cwd: appPath}, 'xvf', `${packagePath}`);
        return appName;
    }

    private setStarted(serverInfo: TomcatServer, started: boolean): void {
        serverInfo.setStarted(started);
        vscode.commands.executeCommand('tomcat.tree.refresh');
    }

    private getJavaArgs(serverInfo: TomcatServer, start: boolean): string[] {
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
        const serverPort: string = await Utility.getHttpPort(serverInfo.getServerConfigPath());
        if (!serverPort) {
            throw new Error('No http port found in server.xml');
        }
        // tslint:disable-next-line:no-http-string
        return `http://localhost:${serverPort}/${appName ? appName : ''}`;
    }

    private async startTomcat(serverInfo: TomcatServer, appName: string, output: vscode.OutputChannel): Promise<void> {
        let statusBar: vscode.StatusBarItem;
        let statusBarCommand: vscode.Disposable;
        const serverName: string = serverInfo.getName();
        let watcher: chokidar.FSWatcher;
        const serverUri: string = await this.getServerUri(serverInfo, appName);

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

            watcher = chokidar.watch(serverInfo.getServerConfigPath());
            watcher.on('change', async () => {
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
            });

            const javaProcess: Promise<void> = Utility.executeCMD(output, 'java', { shell: true }, ...this.getJavaArgs(serverInfo, true));
            this.startDebugSession(serverInfo);
            setTimeout(() => this.setStarted(serverInfo, true), 500);
            await javaProcess;
            this.setStarted(serverInfo, false);
            this.disposeResource(statusBarCommand);
            this.disposeResource(statusBar);
            watcher.close();
            if (serverInfo.needRestart) {
                serverInfo.needRestart = false;
                await this.startTomcat(serverInfo, appName, output);
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
