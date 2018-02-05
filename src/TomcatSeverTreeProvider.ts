'use strict';

import * as fse from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";
import { TreeItem } from "vscode";
import { ServerState } from "./Constants";
import { TomcatModel } from "./Tomcat/TomcatModel";
import { TomcatServer } from "./Tomcat/TomcatServer";
import { WarPackage } from "./Tomcat/WarPackage";
import { Utility } from "./Utility";

export class TomcatSeverTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    public _onDidChangeTreeData: vscode.EventEmitter<TreeItem> = new vscode.EventEmitter<TreeItem>();
    public readonly onDidChangeTreeData: vscode.Event<TreeItem> = this._onDidChangeTreeData.event;

    constructor(private _context: vscode.ExtensionContext, private _tomcatModel: TomcatModel) {
        this._onDidChangeTreeData.fire();
    }

    public async getTreeItem(element: TreeItem): Promise<TreeItem> {
        /* qisun: checking http port is not a valid way to detect the server running or not
        // update the logic when finding a proper way to check the server real state
        // currently behavior is ignoring the server state outside vscode
        // and always stop servers when exiting vscode
        try {
            const port: string = await Utility.getHttpPort(treeItem.serverConfig);
            // tslint:disable-next-line:no-any no-http-string
            const response: any = await axios.get(`http://localhost:${port}`);
            element.setStarted(response.status === 200);
        } catch (err) {
            element.setStarted(false);
        }
        */
        return element;
    }

    public refresh(element: TreeItem): void {
        this._onDidChangeTreeData.fire(element);
    }

    public async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (!element) {
            return this._tomcatModel.getServerSet().map((server: TomcatServer) => {
                server.iconPath = this._context.asAbsolutePath(path.join('resources', `${server.getState()}.svg`));
                server.contextValue = server.getState();
                server.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                return server;
            });
        } else if (element.contextValue === ServerState.IdleServer || element.contextValue === ServerState.RunningServer) {
            const server: TomcatServer = <TomcatServer>element;
            const wars: string[] = await fse.readdir(path.join(server.getStoragePath(), server.getName(), 'webapps'));
            return wars.map((w: string) => {
                if (w.toUpperCase() !== 'ROOT') {
                    return new WarPackage(w, server.getName(), this._context.asAbsolutePath(path.join('resources', 'war.svg')));
                }
            });
        }
    }

    // tslint:disable-next-line:no-empty
    public dispose(): void { }
}
