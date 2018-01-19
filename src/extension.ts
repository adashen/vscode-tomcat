'use strict';

import * as child_process from "child_process";
import * as fse from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { MessageItem } from "vscode";
import { DialogMessage } from "./DialogMessage";
import { localize } from './localize';
import { Tomcat } from "./Tomcat/Tomcat";
import { TomcatController } from "./Tomcat/TomcatController";
import { TomcatServer } from "./Tomcat/TomcatServer";
import { TomcatSeverTreeProvider } from "./TomcatServerTree";
import { Utility } from "./Utility";

export function activate(context: vscode.ExtensionContext): void {
    let storagePath: string = context.storagePath;
    if (!storagePath) {
        storagePath = path.resolve(os.tmpdir(), `vscodetomcat_${makeRandomHexString(5)}`);
    }
    const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('Tomcat');
    const tomcatData: Tomcat = new Tomcat(storagePath);
    const tree: TomcatSeverTreeProvider = new TomcatSeverTreeProvider(context, tomcatData);
    const tomcat: TomcatController = new TomcatController(tomcatData, context.extensionPath, tree._onDidChangeTreeData);

    context.subscriptions.push(tomcat);
    context.subscriptions.push(tree);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('tomcatServerExplorer', tree));

    initCommand(context, outputChannel, tomcat, 'tomcat.server.create', createServer);
    initCommand(context, outputChannel, tomcat, 'tomcat.server.start', startServer);
    initCommand(context, outputChannel, tomcat, 'tomcat.server.browse', browseServer);
    initCommand(context, outputChannel, tomcat, 'tomcat.server.stop', stopServer);
    initCommand(context, outputChannel, tomcat, 'tomcat.server.delete', deleteServer);
    initCommand(context, outputChannel, tomcat, 'tomcat.war.run', runWarPackage);
    initCommand(context, outputChannel, tomcat, 'tomcat.war.debug', debugWarPackage);
    initCommand(context, outputChannel, tomcat, 'tomcat.config.open', openServerConfig);
}

function initCommand<T>(context: vscode.ExtensionContext, output: vscode.OutputChannel, tomcat: TomcatController,
                        commandId: string, callback: (tomcat: TomcatController, input?: T) => Promise<string|void>): void {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, async (...args: {}[]) => {
        try {
            if (args.length === 0) {
                await callback(tomcat);
            } else {
                await callback(tomcat, <T>args[0]);
            }
        } catch (error) {
            if (error instanceof Utility.UserCancelError) {
                return;
            }

            output.show();
            output.appendLine(localize('tomcatExt.error', '{0}', error));
            vscode.window.showErrorMessage(error.toString());
        } finally {
            // todo telemetry;
        }
    }));
}

async function startServer(tomcat: TomcatController, tomcatItem?: TomcatServer): Promise<void> {
    const server: TomcatServer = await selectServer(tomcat, tomcatItem);
    if (server) {
        if (server.isStarted()) {
            vscode.window.showInformationMessage(DialogMessage.serverRunning);
            return;
        }
        await tomcat.startServer(server);
    }
}

async function stopServer(tomcat: TomcatController, tomcatItem?: TomcatServer): Promise<void> {
    const server: TomcatServer = await selectServer(tomcat, tomcatItem);
    if (server) {
        if (!server.isStarted()) {
            vscode.window.showInformationMessage(DialogMessage.serverStopped);
            return;
        }
        await tomcat.stopServer(server);
    } else {
        await vscode.window.showInformationMessage(DialogMessage.noServer);
    }
}

async function browseServer(tomcat: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    const server: TomcatServer = await selectServer(tomcat, tomcatItem);
    if (server) {
        await tomcat.openServer(server);
    } else {
        await vscode.window.showInformationMessage(DialogMessage.noServer);
    }
}

async function deleteServer(tomcat: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    const server: TomcatServer = await selectServer(tomcat, tomcatItem);
    if (server) {
        await tomcat.deleteServer(server);
    } else {
        await vscode.window.showInformationMessage(DialogMessage.noServer);
    }
}

async function openServerConfig(tomcat: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    const server: TomcatServer = await selectServer(tomcat, tomcatItem);
    if (server) {
        await tomcat.openConfig(server);
    } else {
        await vscode.window.showInformationMessage(DialogMessage.noServer);
    }
}

async function createServer(tomcat: TomcatController): Promise<string> {
    const pathPick: vscode.Uri[] = await vscode.window.showOpenDialog(
        {
            defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: DialogMessage.selectDirectory
        });
    if (pathPick && pathPick.length > 0 && pathPick[0].fsPath) {
        const serverName: string = path.basename(pathPick[0].fsPath);

        if (tomcat.getTomcatServer(serverName)) {
            vscode.window.showInformationMessage(DialogMessage.serverExist);
        } else {
            await tomcat.createTomcatServer(serverName, pathPick[0].fsPath);
        }
        return serverName;
    }
}

async function debugWarPackage(tomcat: TomcatController, uri?: vscode.Uri): Promise<void> {
    await runOnTomcat(tomcat, true, uri);
}

async function runWarPackage(tomcat: TomcatController, uri?: vscode.Uri): Promise<void> {
    await runOnTomcat(tomcat, false, uri);
}

async function selectServer(tomcat: TomcatController, tomcatServer?: TomcatServer): Promise<TomcatServer> {
    if (tomcatServer) {
        return tomcatServer;
    }
    const serverSet: TomcatServer[] = tomcat.getServerSet();
    const pick: vscode.QuickPickItem = await vscode.window.showQuickPick(
        [...serverSet, { label: `$(plus) ${DialogMessage.createServer}`, description: null }],
        { placeHolder: serverSet && serverSet.length > 0 ? DialogMessage.selectServer : DialogMessage.createServer });

    if (pick) {
        if (pick instanceof TomcatServer) {
            return pick;
        } else {
            const newServerName: string = await createServer(tomcat);
            const newServer: TomcatServer = tomcat.getTomcatServer(newServerName);
            if (newServer) {
                newServer.newCreated = true;
                return newServer;
            }
        }
    }
}

async function runOnTomcat(tomcat: TomcatController, debug: boolean, uri?: vscode.Uri): Promise<void> {
    if (!uri) {
        const dialog: vscode.Uri[] = await vscode.window.showOpenDialog(
            {
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
    const originalServerSet: string[] = tomcat.getServerSet().map((s: TomcatServer) => s.getName());
    const server: TomcatServer = await selectServer(tomcat);

    if (server && server.newCreated && originalServerSet.indexOf(server.getName()) >= 0) {
        server.newCreated = false;
        const result: MessageItem | undefined = await vscode.window.showWarningMessage(DialogMessage.continueOnExistingServer, DialogMessage.yes, DialogMessage.no);
        if (result !== DialogMessage.yes) {
            return;
        }
    }

    await tomcat.runOnServer(server, packagePath, debug);
}

function makeRandomHexString(length: number): string {
    const chars: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
    let result: string = '';
    for (let i: number = 0; i < length; i += 1) {
        // tslint:disable-next-line:insecure-random
        const idx: number = Math.floor(chars.length * Math.random());
        result += chars[idx];
    }
    return result;
}

// tslint:disable-next-line:no-empty
export function deactivate(): void {}
