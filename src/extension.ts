'use strict';

import * as child_process from "child_process";
import * as fse from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";
import { MessageItem } from "vscode";
import { Session, TelemetryWrapper } from "vscode-extension-telemetry-wrapper";
import { DialogMessage } from "./DialogMessage";
import { localize } from './localize';
import { TomcatController } from "./Tomcat/TomcatController";
import { TomcatModel } from "./Tomcat/TomcatModel";
import { TomcatServer } from "./Tomcat/TomcatServer";
import { WarPackage } from "./Tomcat/WarPackage";
import { TomcatSeverTreeProvider } from "./TomcatSeverTreeProvider";
import { Utility } from "./Utility";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    let storagePath: string = context.storagePath;
    await TelemetryWrapper.initilizeFromJsonFile(context.asAbsolutePath('package.json'));
    if (!storagePath) {
        storagePath = Utility.getTempStoragePath();
    }
    const tomcatModel: TomcatModel = new TomcatModel(storagePath);
    const tomcatServerTree: TomcatSeverTreeProvider = new TomcatSeverTreeProvider(context, tomcatModel);
    const tomcatController: TomcatController = new TomcatController(tomcatModel, context.extensionPath);

    context.subscriptions.push(tomcatController);
    context.subscriptions.push(tomcatServerTree);

    context.subscriptions.push(vscode.window.registerTreeDataProvider('tomcatServerExplorer', tomcatServerTree));
    context.subscriptions.push(registerCommandWrapper('tomcat.tree.refresh', (server: TomcatServer) => tomcatServerTree.refresh(server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.war.browse', (war: WarPackage) => tomcatController.browseWarPackage(war)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.rename', (server: TomcatServer) => tomcatController.renameServer(server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.create', () => tomcatController.createServer()));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.start', (server: TomcatServer) => tomcatController.startServer(server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.restart', (server: TomcatServer) => tomcatController.stopOrRestartServer(server, true)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.stop', (server: TomcatServer) => tomcatController.stopOrRestartServer(server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.delete', (server: TomcatServer) => tomcatController.deleteServer(server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.browse', (server: TomcatServer) => tomcatController.browseServer(server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.war.run', (uri: vscode.Uri) => tomcatController.runOrDebugOnServer(uri)));
    context.subscriptions.push(registerCommandWrapper('tomcat.war.debug', (uri: vscode.Uri) => tomcatController.runOrDebugOnServer(uri, true)));
    context.subscriptions.push(registerCommandWrapper('tomcat.config.open', (server: TomcatServer) => tomcatController.openServerConfig(server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.war.delete', (warPackage: WarPackage) => tomcatController.deleteWarPackage(warPackage)));
    context.subscriptions.push(registerCommandWrapper('tomcat.war.reveal', (warPackage: WarPackage) => tomcatController.reveralWarPackage(warPackage)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.customizejvmoptions', (server: TomcatServer) => tomcatController.customizeJVMOptions(server)));

    // .context commands are duplicate for better naming the context commands and make it more clear and elegant
    context.subscriptions.push(registerCommandWrapper('tomcat.server.rename.context', (server: TomcatServer) => tomcatController.renameServer(server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.start.context', (server: TomcatServer) => tomcatController.startServer(server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.restart.context', (server: TomcatServer) => tomcatController.stopOrRestartServer(server, true)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.stop.context', (server: TomcatServer) => tomcatController.stopOrRestartServer(server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.delete.context', (server: TomcatServer) => tomcatController.deleteServer(server)));
}

// tslint:disable no-any
function registerCommandWrapper(command: string, callback: (...args: any[]) => any): vscode.Disposable {
    return TelemetryWrapper.registerCommand(command, (param: any[]) => {
        Utility.initTelemetrySteps();
        callback(param);
    });
}// tslint:enable no-any

// tslint:disable-next-line:no-empty
export function deactivate(): void {}
