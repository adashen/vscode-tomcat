"use strict";

import * as vscode from "vscode";
import * as child_process from "child_process";
import * as path from "path";
import * as os from "os";
import * as fse from "fs-extra";
import { VSCodeUI, PickWithData } from "./VSCodeUI";
import { workspace } from "vscode";
import { TomcatSeverTreeProvider, TomcatTreeItem } from "./TomcatServerTree";
import { Tomcat } from "./Tomcat/Tomcat";
import { TomcatServer } from "./Tomcat/TomcatServer";
import { TomcatController } from "./Tomcat/TomcatController";
import { Utility } from "./utility";

export function activate(context: vscode.ExtensionContext): void {
    let storagePath: string = context.storagePath;
    if (!storagePath) {
        storagePath = getTempWorkspace();
    }
    const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel("Tomcat");
    const tomcatData: Tomcat = new Tomcat(storagePath);
    const tree: TomcatSeverTreeProvider = new TomcatSeverTreeProvider(context, tomcatData);
    const tomcat: TomcatController = new TomcatController(tomcatData, tree._onDidChangeTreeData);

    context.subscriptions.push(tomcat);
    context.subscriptions.push(tree);
    context.subscriptions.push(vscode.window.registerTreeDataProvider("tomcatServerExplorer", tree));

    initCommand(context, outputChannel, tomcat, "tomcat.createserver", createServer);
    initCommand(context, outputChannel, tomcat, "tomcat.run", serverRun);
    initCommand(context, outputChannel, tomcat, "tomcat.debug", serverDebug);
    initCommand(context, outputChannel, tomcat, "tomcat.stop", serverStop);
    initCommand(context, outputChannel, tomcat, "tomcat.delete", serverDelete);
}

function initCommand<T>(context: vscode.ExtensionContext, output: vscode.OutputChannel,
    tomcat: TomcatController, commandId: string,
        callback: (tomcat: TomcatController, input?: T) => Promise<any>): void {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, async (...args: {}[]) => {
        try {
            if (args.length === 0) {
                await callback(tomcat);
            } else {
                await callback(tomcat, <T>args[0]);
            }
        } catch (error) {
            output.show();
            output.appendLine(Utility.localize("tomcatExt.error", "Error: '{0}'", error));
            vscode.window.showErrorMessage(error);
        } finally {
            // todo telemetry;
        }
    }));
}

// tslint:disable-next-line:no-empty
export function deactivate(): void {}

async function getTargetServer(tomcat: TomcatController, tomcatItem ?: TomcatServer): Promise<TomcatServer> {
    const ui: VSCodeUI = new VSCodeUI();
    if (tomcatItem) {
        return tomcatItem;
    }

    let server: TomcatServer = undefined;
    const serverString: string = await selectServer(ui, Utility.localize("tomcatExt.selectserver", "Select Tomcat Server"), tomcat);
    if (serverString) {
        const serverStr: string[] | undefined = Utility.parseServerNameAndPath(serverString);
        if (serverStr) {
            server = tomcat.getTomcatServer(serverStr[0]);
        }
    }

    if (!server) {
        return Promise.reject(new Error(Utility.localize("tomcatExt.noserver", "Tomcat server is undefined")));
    } else {
        return server;
    }
}

async function serverStop(tomcat: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    let server: TomcatServer = await getTargetServer(tomcat, tomcatItem);
    if (server) {
        await tomcat.stopServer(server);
    }
}

async function serverDelete(tomcat: TomcatController, tomcatItem ?: TomcatServer): Promise<void> {
    let server: TomcatServer = await getTargetServer(tomcat, tomcatItem);
    if (server) {
        await tomcat.deleteServer(server);
    }
}

async function createServer(tomcat: TomcatController): Promise<string> {
    let ui: VSCodeUI = new VSCodeUI();
    const tomcatPath: string = await selectFolder(ui, Utility.localize("tomcatExt.selectinstllpath", "Select Tomcat Installation Path"));
    let serverName: string = path.basename(tomcatPath);

    if (tomcat.getTomcatServer(serverName)) {
        return Promise.reject(new Error(
            Utility.localize("tomcatExt.alreadyexist", "This tomcat server exists in the workspace, abort creation")));
    }

    await tomcat.createTomcatServer(serverName, tomcatPath);
    return `${serverName};${tomcatPath}`;
}

async function serverDebug(tomcat: TomcatController, uri?: vscode.Uri): Promise<void> {
    await startTomcat(tomcat, true, uri);
}

async function serverRun(tomcat: TomcatController, uri?: vscode.Uri): Promise<void> {
    await startTomcat(tomcat, false, uri);
}

async function selectFile(ui: VSCodeUI, placehoder: string): Promise<string> {
    const browse: string = ":browse";
    let file: PickWithData<string> | undefined;
    let filePicks: PickWithData<string>[] = [new PickWithData(browse, Utility.localize("tomcatExt.browse", "Browse..."))];
    file = await ui.showQuickPick(filePicks, placehoder);
    return await ui.showFileFolderDialog(true, false);
}

async function selectFolder(ui: VSCodeUI, placeholder: string): Promise<string> {
    const browse: string = ":browse";
    let folder: PickWithData<string> | undefined;
    let folderPicks: PickWithData<string>[] = [new PickWithData(browse, Utility.localize("tomcatExt.browse", "Browse..."))];
    folder = await ui.showQuickPick(folderPicks, placeholder);
    return await ui.showFileFolderDialog(false, true);
}

async function selectServer(ui: VSCodeUI, placehoder: string, tomcat: TomcatController, withNew?: string): Promise<string | undefined> {
    const serverSet: Array<TomcatServer> = tomcat.getServerSet();
    let serverPick: PickWithData<string> | undefined;
    let serverPicks: PickWithData<string>[] = withNew
        ? [new PickWithData(withNew, Utility.localize("tomcatExt.newserver", "New server"))] : [];

    if (serverSet && serverSet.length!== 0) {
        serverPicks = serverPicks.concat(serverSet.map((server: TomcatServer) =>
            new PickWithData(Utility.combineServerNameAndPath(server.getName(), server.getTomcatPath()), server.getName())));
        serverPick = await ui.showQuickPick<string>(serverPicks, placehoder);
    }

    return serverPick ? serverPick.data : undefined;
}

async function selectOrCreateServer(ui: VSCodeUI, placeholder: string,
    tomcat: TomcatController): Promise<string> {
    const newServer: string = ":new";
    let serverPick: string | undefined = await selectServer(ui, placeholder, tomcat, newServer);
    return serverPick && serverPick !== newServer ? serverPick: await createServer(tomcat);
}

async function startTomcat(tomcat: TomcatController, debug: boolean, uri?: vscode.Uri): Promise<void> {
    const inputPath: vscode.Uri | undefined = uri ? uri: undefined;
    let ui: VSCodeUI = new VSCodeUI();
    const packagePath: string = inputPath ? inputPath.fsPath
        : await selectFile(ui, Utility.localize("tomcatExt.selectwar", "Select war package"));
    const serverInfo: string = await selectOrCreateServer(ui,
        Utility.localize("tomcatExt.selectserver", "Select Tomcat Server"), tomcat);
    const server: string[] = Utility.parseServerNameAndPath(serverInfo);

    if (!server || !tomcat.getTomcatServer(server[0])) {
        return Promise.reject(new Error(Utility.localize("tomcatExt.noserver", "Tomcat server is undefined")));
    }

    let execute: Promise<void> = tomcat.runOnServer(tomcat.getTomcatServer(server[0]), packagePath, debug);
    await execute;
    return Promise.resolve();
}

function getTempWorkspace(): string {
    return path.resolve(os.tmpdir(), "vscodetomcat_" + makeRandomHexString(5));
}

function makeRandomHexString(length: number): string {
    let chars: string[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
    let result: string = "";
    for (let i: number = 0; i < length; i++) {
        let idx: number = Math.floor(chars.length * Math.random());
        result += chars[idx];
    }
    return result;
}
