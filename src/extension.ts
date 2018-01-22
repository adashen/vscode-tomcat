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
    const tomcatServerTree: TomcatSeverTreeProvider = new TomcatSeverTreeProvider(context, tomcatData);
    const tomcatController: TomcatController = new TomcatController(tomcatData, context.extensionPath);

    context.subscriptions.push(tomcatController);
    context.subscriptions.push(tomcatServerTree);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('tomcatServerExplorer', tomcatServerTree));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.tree.refresh', (element: TomcatServer) => tomcatServerTree.refresh(element)));

    initCommand(context, outputChannel, tomcatController, 'tomcat.server.create', createServer);
    initCommand(context, outputChannel, tomcatController, 'tomcat.server.start', startServer);
    initCommand(context, outputChannel, tomcatController, 'tomcat.server.restart', restartServer);
    initCommand(context, outputChannel, tomcatController, 'tomcat.server.browse', browseServer);
    initCommand(context, outputChannel, tomcatController, 'tomcat.server.stop', stopServer);
    initCommand(context, outputChannel, tomcatController, 'tomcat.server.delete', deleteServer);
    initCommand(context, outputChannel, tomcatController, 'tomcat.war.run', runWarPackage);
    initCommand(context, outputChannel, tomcatController, 'tomcat.war.debug', debugWarPackage);
    initCommand(context, outputChannel, tomcatController, 'tomcat.config.open', openServerConfig);
}

function initCommand<T>(context: vscode.ExtensionContext, output: vscode.OutputChannel, tomcatController: TomcatController,
                        commandId: string, callback: (tomcatController: TomcatController, input?: T) => Promise<string|void>): void {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, async (...args: {}[]) => {
        try {
            if (args.length === 0) {
                await callback(tomcatController);
            } else {
                await callback(tomcatController, <T>args[0]);
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

async function startServer(tomcatController: TomcatController, tomcatItem?: TomcatServer): Promise<void> {
    const server: TomcatServer = await selectServer(tomcatController, tomcatItem);
    if (server) {
        if (server.isStarted()) {
            vscode.window.showInformationMessage(DialogMessage.serverRunning);
            return;
        }
        await tomcatController.startServer(server);
    }
}

async function restartServer(tomcatController: TomcatController, tomcatItem?: TomcatServer): Promise<void> {
    await tomcatController.restartServer(await getTargetServer(tomcatController, tomcatItem));
}

async function stopServer(tomcatController: TomcatController, tomcatItem?: TomcatServer): Promise<void> {
    const server: TomcatServer = await selectServer(tomcatController, tomcatItem);
    if (server) {
        if (!server.isStarted()) {
            vscode.window.showInformationMessage(DialogMessage.serverStopped);
            return;
        }
        await tomcatController.stopServer(server);
    } else {
        await vscode.window.showInformationMessage(DialogMessage.noServer);
    }
}

async function browseServer(tomcatController: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    const server: TomcatServer = await selectServer(tomcatController, tomcatItem);
    if (server) {
        await tomcatController.openServer(server);
    } else {
        await vscode.window.showInformationMessage(DialogMessage.noServer);
    }
}

async function deleteServer(tomcatController: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    const server: TomcatServer = await selectServer(tomcatController, tomcatItem);
    if (server) {
        await tomcatController.deleteServer(server);
    } else {
        await vscode.window.showInformationMessage(DialogMessage.noServer);
    }
}

async function openServerConfig(tomcatController: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    const server: TomcatServer = await selectServer(tomcatController, tomcatItem);
    if (server) {
        await tomcatController.openConfig(server);
    } else {
        await vscode.window.showInformationMessage(DialogMessage.noServer);
    }
}

async function createServer(tomcatController: TomcatController): Promise<string> {
    const pathPick: vscode.Uri[] = await vscode.window.showOpenDialog({
        defaultUri: vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined,
        canSelectFiles: false,
        canSelectFolders: true,
        openLabel: DialogMessage.selectDirectory
    });
    if (pathPick && pathPick.length > 0 && pathPick[0].fsPath) {
        const serverName: string = path.basename(pathPick[0].fsPath);
        if (tomcatController.getTomcatServer(serverName)) {
            vscode.window.showInformationMessage(DialogMessage.serverExist);
        } else {
            await tomcatController.createTomcatServer(serverName, pathPick[0].fsPath);
        }
        return serverName;
    }
}

async function debugWarPackage(tomcatController: TomcatController, uri?: vscode.Uri): Promise<void> {
    await runOnTomcat(tomcatController, true, uri);
}

async function runWarPackage(tomcatController: TomcatController, uri?: vscode.Uri): Promise<void> {
    await runOnTomcat(tomcatController, false, uri);
}

async function selectServer(tomcatController: TomcatController, tomcatServer?: TomcatServer): Promise<TomcatServer> {
    if (tomcatServer) {
        return tomcatServer;
    }
    const serverSet: TomcatServer[] = tomcatController.getServerSet();
    const pick: vscode.QuickPickItem = await vscode.window.showQuickPick(
        [...serverSet, { label: `$(plus) ${DialogMessage.createServer}`, description: null }],
        { placeHolder: serverSet && serverSet.length > 0 ? DialogMessage.selectServer : DialogMessage.createServer });

    if (pick) {
        if (pick instanceof TomcatServer) {
            return pick;
        } else {
            const newServerName: string = await createServer(tomcatController);
            const newServer: TomcatServer = tomcatController.getTomcatServer(newServerName);
            if (newServer) {
                newServer.newCreated = true;
                return newServer;
            }
        }
    }
}

async function runOnTomcat(tomcatController: TomcatController, debug: boolean, uri?: vscode.Uri): Promise<void> {
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
    const originalServerSet: string[] = tomcatController.getServerSet().map((s: TomcatServer) => s.getName());
    const server: TomcatServer = await selectServer(tomcatController);

    if (server && server.newCreated && originalServerSet.indexOf(server.getName()) >= 0) {
        server.newCreated = false;
        const result: MessageItem | undefined = await vscode.window.showWarningMessage(DialogMessage.continueOnExistingServer, DialogMessage.yes, DialogMessage.no);
        if (result !== DialogMessage.yes) {
            return;
        }
    }

    await tomcatController.runOnServer(server, packagePath, debug);
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
