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
import { WarPackage } from "./Tomcat/WarPackage";
import { TomcatSeverTreeProvider } from "./TomcatSeverTreeProvider";
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
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.war.browse', (war: WarPackage) => tomcatController.browseWarPackage(war)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.rename', (server: TomcatServer) => tomcatController.renameServer(server)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.create', () => { tomcatController.createServer(); }));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.start', (server: TomcatServer) => tomcatController.startServer(server)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.restart', (server: TomcatServer) => tomcatController.stopOrRestartServer(server, true)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.stop', (server: TomcatServer) => tomcatController.stopOrRestartServer(server)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.delete', (server: TomcatServer) => tomcatController.deleteServer(server)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.browse', (server: TomcatServer) => tomcatController.browseServer(server)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.war.run', (uri: vscode.Uri) => tomcatController.runOrDebugOnServer(uri)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.war.debug', (uri: vscode.Uri) => tomcatController.runOrDebugOnServer(uri, true)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.config.open', (server: TomcatServer) => tomcatController.openServerConfig(server)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.war.delete', (warPackage: WarPackage) => tomcatController.deleteWarPackage(warPackage)));

    // .context commands are duplicate for better naming the context commands and make it more clear and elegant
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.rename.context', (server: TomcatServer) => tomcatController.renameServer(server)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.start.context', (server: TomcatServer) => tomcatController.startServer(server)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.restart.context', (server: TomcatServer) => tomcatController.stopOrRestartServer(server, true)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.stop.context', (server: TomcatServer) => tomcatController.stopOrRestartServer(server)));
    context.subscriptions.push(vscode.commands.registerCommand('tomcat.server.delete.context', (server: TomcatServer) => tomcatController.deleteServer(server)));
}
// tslint:disable-next-line:no-empty
export function deactivate(): void {}
