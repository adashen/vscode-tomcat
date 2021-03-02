'use strict';

import * as vscode from "vscode";
import {
    dispose as disposeTelemetryWrapper,
    initializeFromJsonFile,
    instrumentOperation
} from "vscode-extension-telemetry-wrapper";
import { TomcatController } from "./Tomcat/TomcatController";
import { TomcatModel } from "./Tomcat/TomcatModel";
import { TomcatServer } from "./Tomcat/TomcatServer";
import { WarPackage } from "./Tomcat/WarPackage";
import { TomcatSeverTreeProvider } from "./TomcatSeverTreeProvider";
import { Utility } from "./Utility";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    await initializeFromJsonFile(context.asAbsolutePath('./package.json'), { firstParty: true });
    await instrumentOperation('activation', initializeExtension)(context);
}

async function initializeExtension(_opId: string, context: vscode.ExtensionContext): Promise<void> {
    let storagePath: string = context.storagePath;
    if (!storagePath) {
        storagePath = Utility.getTempStoragePath();
    }
    const tomcatModel: TomcatModel = new TomcatModel(storagePath);
    const tomcatServerTree: TomcatSeverTreeProvider = new TomcatSeverTreeProvider(context, tomcatModel);
    const tomcatController: TomcatController = new TomcatController(tomcatModel, context.extensionPath);

    context.subscriptions.push(tomcatController);
    context.subscriptions.push(tomcatServerTree);

    context.subscriptions.push(vscode.window.registerTreeDataProvider('tomcatServerExplorer', tomcatServerTree));
    context.subscriptions.push(registerCommandWrapper('tomcat.tree.refresh', (_operationId: string, server: TomcatServer) => tomcatServerTree.refresh(server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.war.browse', (operationId: string, war: WarPackage) => tomcatController.browseWarPackage(operationId, war)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.rename', (operationId: string, server: TomcatServer) => tomcatController.renameServer(operationId, server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.add', (operationId: string) => tomcatController.addServer(operationId)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.start', (operationId: string, server: TomcatServer) => tomcatController.startServer(operationId, server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.restart', (operationId: string, server: TomcatServer) => tomcatController.stopOrRestartServer(operationId, server, true)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.stop', (operationId: string, server: TomcatServer) => tomcatController.stopOrRestartServer(operationId, server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.delete', (operationId: string, server: TomcatServer) => tomcatController.deleteServer(operationId, server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.browse', (operationId: string, server: TomcatServer) => tomcatController.browseServer(operationId, server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.debug', (operationId: string, server: TomcatServer) => tomcatController.runOrDebugOnServer(operationId, undefined, true, server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.war.run', (operationId: string, uri: vscode.Uri) => tomcatController.runOrDebugOnServer(operationId, uri)));
    context.subscriptions.push(registerCommandWrapper('tomcat.war.debug', (operationId: string, uri: vscode.Uri) => tomcatController.runOrDebugOnServer(operationId, uri, true)));
    context.subscriptions.push(registerCommandWrapper('tomcat.webapp.run', (operationId: string, uri: vscode.Uri) => tomcatController.runOrDebugOnServer(operationId, uri)));
    context.subscriptions.push(registerCommandWrapper('tomcat.webapp.debug', (operationId: string, uri: vscode.Uri) => tomcatController.runOrDebugOnServer(operationId, uri, true)));
    context.subscriptions.push(registerCommandWrapper('tomcat.config.open', (operationId: string, server: TomcatServer) => tomcatController.openServerConfig(operationId, server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.war.delete', (operationId: string, warPackage: WarPackage) => tomcatController.deleteWarPackage(operationId, warPackage)));
    context.subscriptions.push(registerCommandWrapper('tomcat.war.reveal', (_operationId: string, warPackage: WarPackage) => tomcatController.revealWarPackage(warPackage)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.customizejvmoptions', (_operationId: string, server: TomcatServer) => tomcatController.customizeJVMOptions(server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.package', () => tomcatController.generateWarPackage()));

    // .context commands are duplicate for better naming the context commands and make it more clear and elegant
    context.subscriptions.push(registerCommandWrapper('tomcat.server.rename.context', (operationId: string, server: TomcatServer) => tomcatController.renameServer(operationId, server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.start.context', (operationId: string, server: TomcatServer) => tomcatController.startServer(operationId, server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.restart.context', (operationId: string, server: TomcatServer) => tomcatController.stopOrRestartServer(operationId, server, true)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.stop.context', (operationId: string, server: TomcatServer) => tomcatController.stopOrRestartServer(operationId, server)));
    context.subscriptions.push(registerCommandWrapper('tomcat.server.delete.context', (operationId: string, server: TomcatServer) => tomcatController.deleteServer(operationId, server)));
}

// tslint:disable no-any
function registerCommandWrapper(command: string, callback: (...args: any[]) => any): vscode.Disposable {
    const instrumented: (...args: any[]) => any = instrumentOperation(command, async (operationId: string, ...args: any[]) => {
        await callback(operationId, ...args);
    });
    return vscode.commands.registerCommand(command, instrumented);
}// tslint:enable no-any

// tslint:disable-next-line:no-empty
export async function deactivate(): Promise<void> {
    await disposeTelemetryWrapper();
}
