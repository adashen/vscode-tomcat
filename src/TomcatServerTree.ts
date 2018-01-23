'use strict';

import * as path from "path";
import * as vscode from "vscode";
import { TomcatModel } from "./Tomcat/TomcatModel";
import { TomcatServer } from "./Tomcat/TomcatServer";
import { Utility } from "./Utility";

export class TomcatTreeItem implements vscode.TreeItem {
    public iconPath: string;
    public label: string;

    constructor(private _context: vscode.ExtensionContext, public readonly _tomcatServer: TomcatServer) {
        this.label = this._tomcatServer.getName();
    }

    public get contextValue(): string {
        return this._tomcatServer.getState();
    }
}

export class TomcatSeverTreeProvider implements vscode.TreeDataProvider<TomcatServer> {
    public _onDidChangeTreeData: vscode.EventEmitter<TomcatServer | undefined> = new vscode.EventEmitter<TomcatServer | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<TomcatServer | undefined> = this._onDidChangeTreeData.event;

    constructor(private _context: vscode.ExtensionContext, private _tomcatModel: TomcatModel) {
        this._onDidChangeTreeData.fire();
    }

    public async getTreeItem(element: TomcatServer): Promise<vscode.TreeItem> {
        const treeItem: TomcatTreeItem = new TomcatTreeItem(this._context, element);
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
        treeItem.iconPath = this._context.asAbsolutePath(path.join('resources', `${element.getState()}.svg`));
        return treeItem;
    }

    public refresh(element: TomcatServer): void {
        this._onDidChangeTreeData.fire(element);
    }

    public getChildren(element?: TomcatServer): TomcatServer[] {
        if (!element) {
            return this._tomcatModel.getServerSet();
        } else {
            return [];
        }
    }

    // tslint:disable-next-line:no-empty
    public dispose() : void {}
}
