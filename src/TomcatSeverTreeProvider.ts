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
            const webapps: string = path.join(server.getStoragePath(), 'webapps');
            const iconPath: string = this._context.asAbsolutePath(path.join('resources', 'war.jpg'));
            if (await fse.pathExists(webapps)) {
                let wars: string[] = await fse.readdir(webapps);
                let temp: fse.Stats;
                // show war packages with no extension if there is one
                // and no need to show war packages if its unzipped folder exists
                wars = wars.filter((w: string) => {
                    if (w.toUpperCase() !== 'ROOT') {
                        temp = fse.statSync(path.join(webapps, w));
                        if (temp.isDirectory() || (temp.isFile() && w.endsWith('.war'))) {
                            return w;
                        }
                    }
                }).map((w: string) => {
                    return w.endsWith('.war') ? w.substring(0, w.indexOf('.war')) : w;
                });
                return [...new Set([...wars])].map((w: string) => {
                    return new WarPackage(w, server.getName(), iconPath, path.join(webapps, w));
                });
            }
            return [];
        }
    }

    // tslint:disable-next-line:no-empty
    public dispose(): void { }
}
