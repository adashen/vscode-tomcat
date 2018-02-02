'use strict';

import * as child_process from "child_process";
import * as fse from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";
import { MessageItem } from "vscode";
import { DialogMessage } from "./DialogMessage";
import { localize } from './localize';
import { TomcatController } from "./Tomcat/TomcatController";
import { TomcatModel } from "./Tomcat/TomcatModel";
import { TomcatServer } from "./Tomcat/TomcatServer";
import { TomcatSeverTreeProvider } from "./TomcatServerTree";
import { Utility } from "./Utility";

export function activate(context: vscode.ExtensionContext): void {
    let storagePath: string = context.storagePath;
    if (!storagePath) {
        storagePath = Utility.getTempStoragePath();
    }
    const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('Tomcat');
    const tomcatModel: TomcatModel = new TomcatModel(storagePath);
    const tomcatServerTree: TomcatSeverTreeProvider = new TomcatSeverTreeProvider(context, tomcatModel);
    const tomcatController: TomcatController = new TomcatController(tomcatModel, context.extensionPath);

    context.subscriptions.push(tomcatController);
    context.subscriptions.push(tomcatServerTree);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('tomcatServerExplorer', tomcatServerTree));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.tree.refresh', (server: TomcatServer) => tomcatServerTree.refresh(server)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.create', async () => { await tomcatController.createServer(); }));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.start', async (server: TomcatServer) => { await tomcatController.startServer(server); }));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.restart', async (server: TomcatServer) => { await tomcatController.stopOrRestartServer(server, true); }));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.stop', async (server: TomcatServer) => { await tomcatController.stopOrRestartServer(server); }));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.browse', async (server: TomcatServer) => { await tomcatController.browseServer(server); }));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.delete', async (server: TomcatServer) => { await tomcatController.deleteServer(server); }));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.config.open', async (server: TomcatServer) => { await tomcatController.openServerConfig(server); }));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.war.run', async (uri: vscode.Uri) => { await tomcatController.runOnTomcat(false, uri); }));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.war.debug', async (uri: vscode.Uri) => { await tomcatController.runOnTomcat(true, uri); }));
}

// tslint:disable-next-line:no-empty
export function deactivate(): void {}
