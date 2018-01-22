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
import { TomcatSeverTreeProvider, TomcatTreeItem } from "./TomcatServerTree";
import { Utility } from "./Utility";
import { PickWithData, VSCodeUI } from "./VSCodeUI";

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

// tslint:disable-next-line:no-empty
export function deactivate(): void {}

async function getTargetServer(tomcatController: TomcatController, tomcatItem ?: TomcatServer, createIfNotExist ?: boolean): Promise<TomcatServer> {
    if (tomcatItem) {
        return tomcatItem;
    }

    const ui: VSCodeUI = new VSCodeUI();
    let serverName: string = await selectServer(ui, DialogMessage.selectServer, tomcatController);
    let server: TomcatServer = tomcatController.getTomcatServer(serverName);

    if (!server && createIfNotExist) {
        serverName = await createServer(tomcatController);
        server = tomcatController.getTomcatServer(serverName);
    }

    return server;
}

async function startServer(tomcatController: TomcatController, tomcatItem?: TomcatServer): Promise<void> {
    const server: TomcatServer = await getTargetServer(tomcatController, tomcatItem, true);
    if (server) {
        if (server.isStarted()) {
            vscode.window.showInformationMessage(DialogMessage.serverRunning);
            return;
        }
        await tomcatController.startServer(server);
    } else {
        await vscode.window.showInformationMessage(DialogMessage.noServer);
    }
}

async function restartServer(tomcatController: TomcatController, tomcatItem?: TomcatServer): Promise<void> {
    await tomcatController.restartServer(await getTargetServer(tomcatController, tomcatItem));
}

async function stopServer(tomcatController: TomcatController, tomcatItem?: TomcatServer): Promise<void> {
    const server: TomcatServer = await getTargetServer(tomcatController, tomcatItem);
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
    const server: TomcatServer = await getTargetServer(tomcatController, tomcatItem);
    if (server) {
        await tomcatController.openServer(server);
    } else {
        await vscode.window.showInformationMessage(DialogMessage.noServer);
    }
}

async function deleteServer(tomcatController: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    const server: TomcatServer = await getTargetServer(tomcatController, tomcatItem);
    if (server) {
        await tomcatController.deleteServer(server);
    } else {
        await vscode.window.showInformationMessage(DialogMessage.noServer);
    }
}

async function openServerConfig(tomcatController: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    const server: TomcatServer = await getTargetServer(tomcatController, tomcatItem);
    if (server) {
        await tomcatController.openConfig(server);
    } else {
        await vscode.window.showInformationMessage(DialogMessage.noServer);
    }
}

async function createServer(tomcatController: TomcatController): Promise<string> {
    const ui: VSCodeUI = new VSCodeUI();
    const tomcatPath: string = await ui.showFileFolderDialog(false, true, DialogMessage.selectDirectory);
    const serverName: string = path.basename(tomcatPath);

    if (tomcatController.getTomcatServer(serverName)) {
        vscode.window.showInformationMessage(DialogMessage.serverExist);
    } else {
        await tomcatController.createTomcatServer(serverName, tomcatPath);
    }
    return serverName;
}

async function debugWarPackage(tomcatController: TomcatController, uri?: vscode.Uri): Promise<void> {
    await runOnTomcat(tomcatController, true, uri);
}

async function runWarPackage(tomcatController: TomcatController, uri?: vscode.Uri): Promise<void> {
    await runOnTomcat(tomcatController, false, uri);
}

async function selectServer(ui: VSCodeUI, placeHolder: string, tomcatController: TomcatController, withNew?: string): Promise<string | undefined> {
    const serverSet: TomcatServer[] = tomcatController.getServerSet();
    let serverPick: PickWithData<string> | undefined;
    let serverPicks: PickWithData<string>[] = [];

    if (serverSet && serverSet.length !== 0) {
        serverPicks = serverPicks.concat(serverSet.map((server: TomcatServer) =>
            new PickWithData(server.getName(), server.getName())));
        if (withNew) {
            serverPicks.push(new PickWithData(withNew, DialogMessage.createServer));
        }
        serverPick = await ui.showQuickPick<string>(serverPicks, placeHolder);
    }

    return serverPick ? serverPick.data : undefined;
}

async function runOnTomcat(tomcatController: TomcatController, debug: boolean, uri?: vscode.Uri): Promise<void> {
    const ui: VSCodeUI = new VSCodeUI();
    const packagePath: string = uri ? uri.fsPath : await ui.showFileFolderDialog(true, false, DialogMessage.selectWarPackage);
    const originalServerSet: string[] = tomcatController.getServerSet().map((s: TomcatServer) => s.getName());
    const newServer: string = ':new';
    const serverPick: string = await selectServer(ui, DialogMessage.selectServer, tomcatController, newServer);
    const server: string = serverPick && serverPick !== newServer ? serverPick : await createServer(tomcatController);

    if (serverPick === newServer && originalServerSet.indexOf(server) >= 0) {
        const result: MessageItem | undefined = await vscode.window.showWarningMessage(DialogMessage.continueOnExistingServer, DialogMessage.yes, DialogMessage.no);
        if (result !== DialogMessage.yes) {
            return;
        }
    }

    await tomcatController.runOnServer(tomcatController.getTomcatServer(server), packagePath, debug);
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
