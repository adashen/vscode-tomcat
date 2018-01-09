'use strict';

import * as child_process from "child_process";
import * as fse from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { workspace } from "vscode";
import { Tomcat } from "./Tomcat/Tomcat";
import { TomcatController } from "./Tomcat/TomcatController";
import { TomcatServer } from "./Tomcat/TomcatServer";
import { TomcatSeverTreeProvider, TomcatTreeItem } from "./TomcatServerTree";
import { Utility } from "./Utility";
import { PickWithData, VSCodeUI } from "./VSCodeUI";

export function activate(context: vscode.ExtensionContext): void {
    let storagePath: string = context.storagePath;
    if (!storagePath) {
        storagePath = getTempWorkspace();
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
    initCommand(context, outputChannel, tomcat, 'tomcat.war.deploy', deployWarPackage);
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
            output.appendLine(Utility.localize('tomcatExt.error', 'Error: "{0}"', error));
            vscode.window.showErrorMessage(error.toString());
        } finally {
            // todo telemetry;
        }
    }));
}

// tslint:disable-next-line:no-empty
export function deactivate(): void {}

async function getTargetServer(tomcat: TomcatController, tomcatItem ?: TomcatServer, createIfNotExist ?: boolean): Promise<TomcatServer> {
    const ui: VSCodeUI = new VSCodeUI();
    if (tomcatItem) {
        return tomcatItem;
    }

    let server: TomcatServer;
    let serverName: string = await selectServer(ui, Utility.localize('tomcatExt.selectdirectory', 'Select Tomcat Directory'), tomcat);
    server = tomcat.getTomcatServer(serverName);

    if (!server && createIfNotExist) {
        serverName = await createServer(tomcat);
        server = tomcat.getTomcatServer(serverName);
    }

    return server;
}

async function startServer(tomcat: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    const server: TomcatServer = await getTargetServer(tomcat, tomcatItem, true);
    if (server) {
        await tomcat.startServer(server);
    } else {
        await vscode.window.showInformationMessage(Utility.localize('tomcatExt.noserver', 'No tomcat server.'));
    }
}

async function stopServer(tomcat: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    const server: TomcatServer = await getTargetServer(tomcat, tomcatItem);
    if (server) {
        await tomcat.stopServer(server);
    } else {
        await vscode.window.showInformationMessage(Utility.localize('tomcatExt.noserver', 'No tomcat server.'));
    }
}

async function browseServer(tomcat: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    const server: TomcatServer = await getTargetServer(tomcat, tomcatItem);
    if (server) {
        await tomcat.openServer(server);
    } else {
        await vscode.window.showInformationMessage(Utility.localize('tomcatExt.noserver', 'No tomcat server.'));
    }
}

async function deleteServer(tomcat: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    const server: TomcatServer = await getTargetServer(tomcat, tomcatItem);
    if (server) {
        await tomcat.deleteServer(server);
    } else {
        await vscode.window.showInformationMessage(Utility.localize('tomcatExt.noserver', 'No tomcat server.'));
    }
}

async function openServerConfig(tomcat: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    const server: TomcatServer = await getTargetServer(tomcat, tomcatItem);
    if (server) {
        await tomcat.openConfig(server);
    } else {
        await vscode.window.showInformationMessage(Utility.localize('tomcatExt.noserver', 'No tomcat server.'));
    }
}

async function createServer(tomcat: TomcatController): Promise<string> {
    const ui: VSCodeUI = new VSCodeUI();
    const tomcatPath: string = await ui.showFileFolderDialog(false, true, Utility.localize('tomcatExt.selectserver', 'Select Tomcat Server'));

    const serverName: string = path.basename(tomcatPath);

    if (tomcat.getTomcatServer(serverName)) {
        return Promise.reject(new Error(
            Utility.localize('tomcatExt.alreadyexist', 'This tomcat server exists in the workspace, abort creation')));
    }

    await tomcat.createTomcatServer(serverName, tomcatPath);
    return serverName;
}

async function debugWarPackage(tomcat: TomcatController, uri?: vscode.Uri): Promise<void> {
    await runOnTomcat(tomcat, true, uri);
}

async function deployWarPackage(tomcat: TomcatController, uri?: vscode.Uri): Promise<void> {
    await runOnTomcat(tomcat, false, uri);
}

async function selectServer(ui: VSCodeUI, placeHolder: string, tomcat: TomcatController, withNew?: string): Promise<string | undefined> {
    const serverSet: TomcatServer[] = tomcat.getServerSet();
    let serverPick: PickWithData<string> | undefined;
    let serverPicks: PickWithData<string>[] = [];

    if (serverSet && serverSet.length !== 0) {
        serverPicks = serverPicks.concat(serverSet.map((server: TomcatServer) =>
            new PickWithData(server.getName(), server.getName())));
        if (withNew) {
            serverPicks.push(new PickWithData(withNew, Utility.localize('tomcatExt.newserver', 'New server')));
        }
        serverPick = await ui.showQuickPick<string>(serverPicks, placeHolder);
    }

    return serverPick ? serverPick.data : undefined;
}

async function selectOrCreateServer(ui: VSCodeUI, placeholder: string,
                                    tomcat: TomcatController): Promise<string> {
    const newServer: string = ':new';
    const serverPick: string | undefined = await selectServer(ui, placeholder, tomcat, newServer);
    return serverPick && serverPick !== newServer ? serverPick : await createServer(tomcat);
}

async function runOnTomcat(tomcat: TomcatController, debug: boolean, uri?: vscode.Uri): Promise<void> {
    const inputPath: vscode.Uri | undefined = uri ? uri : undefined;
    const ui: VSCodeUI = new VSCodeUI();
    const packagePath: string = inputPath ? inputPath.fsPath
        : await ui.showFileFolderDialog(true, false, Utility.localize('tomcatExt.selectwar', 'Select war package'));
    const server: string = await selectOrCreateServer(ui,
                                                      Utility.localize('tomcatExt.selectserver', 'Select Tomcat Server'),
                                                      tomcat);

    if (!tomcat.getTomcatServer(server)) {
        return Promise.reject(new Error(Utility.localize('tomcatExt.noserver', 'No tomcat server.')));
    }

    const execute: Promise<void> = tomcat.runOnServer(tomcat.getTomcatServer(server), packagePath, debug);
    await execute;
    return Promise.resolve();
}

function getTempWorkspace(): string {
    return path.resolve(os.tmpdir(), `vscodetomcat_${makeRandomHexString(5)}`);
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
