'use strict';

import * as fse from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import * as vscode from "vscode";
import { TreeItem } from "vscode";
import * as Constants from "./Constants";
import { ServerState } from "./Constants";
import { TomcatModel } from "./Tomcat/TomcatModel";
import { TomcatServer } from "./Tomcat/TomcatServer";
import { WarPackage } from "./Tomcat/WarPackage";

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
                const wars: string[] = [];
                let temp: fse.Stats;
                let fileExtension: string;
                // show war packages with no extension if there is one
                // and no need to show war packages if its unzipped folder exists
                const promises: Promise<void>[] = (await fse.readdir(webapps)).map(async (w: string) => {
                    if (w.toUpperCase() !== 'ROOT') {
                        temp = await fse.stat(path.join(webapps, w));
                        fileExtension = path.extname(path.join(webapps, w));
                        if (temp.isDirectory() || (temp.isFile() && fileExtension === Constants.WAR_FILE_EXTENSION)) {
                            wars.push(fileExtension === Constants.WAR_FILE_EXTENSION ? path.basename(w, fileExtension) : w);
                        }
                    }
                });
                await Promise.all(promises);
                // tslint:disable-next-line:underscore-consistent-invocation
                return _.uniq(wars).map((w: string) => {
                    return new WarPackage(w, server.getName(), iconPath, path.join(webapps, w));
                });
            }
            return [];
        }
    }

    // tslint:disable-next-line:no-empty
    public dispose(): void { }
}
