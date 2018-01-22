'use strict';

import axios from "axios";
import * as path from "path";
import * as vscode from "vscode";
import { Tomcat } from "./Tomcat/Tomcat";
import { TomcatServer } from "./Tomcat/TomcatServer";
import { Utility } from "./Utility";

export class TomcatTreeItem implements vscode.TreeItem {
    private static readonly IDLE: string = 'idleserver';
    private static readonly RUNNING: string = 'runningserver';
    public readonly _tomcatServer: TomcatServer;
    public iconPath: string;
    private _context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext, tomcatServer: TomcatServer) {
        this._context = context;
        this._tomcatServer = tomcatServer;
    }

    public get label(): string {
        return this._tomcatServer.getName();
    }

    public get path(): string {
        return this._tomcatServer.getTomcatPath();
    }

    public get contextValue(): string {
        return this._tomcatServer.getState();
    }

    public get started(): boolean {
        return this._tomcatServer.isStarted();
    }

    public get serverConfig(): string {
        return this._tomcatServer.getServerConfigPath();
    }
}

export class TomcatSeverTreeProvider implements vscode.TreeDataProvider<TomcatServer> {
    public _onDidChangeTreeData: vscode.EventEmitter<TomcatServer | undefined> = new vscode.EventEmitter<TomcatServer | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<TomcatServer | undefined> = this._onDidChangeTreeData.event;
    private _tomcat: Tomcat;
    private _context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext, tomcat: Tomcat) {
        this._tomcat = tomcat;
        this._context = context;
        this._onDidChangeTreeData.fire();
    }

    public async getTreeItem(element: TomcatServer): Promise<vscode.TreeItem> {
        const treeItem: TomcatTreeItem = new TomcatTreeItem(this._context, element);
        try {
            const port: string = await Utility.getHttpPort(treeItem.serverConfig);
            // tslint:disable-next-line:no-any no-http-string
            const response: any = await axios.get(`http://localhost:${port}`);
            element.setStarted(response.status === 200);
        } catch (err) {
            element.setStarted(false);
        }
        treeItem.iconPath = this._context.asAbsolutePath(path.join('resources', `${element.getState()}.svg`));
        return treeItem;
    }

    public refresh(element: TomcatServer): void {
        this._onDidChangeTreeData.fire(element);
    }

    public getChildren(element?: TomcatServer): TomcatServer[] {
        if (!element) {
            return this._tomcat.getServerSet();
        } else {
            return [];
        }
    }

    // tslint:disable-next-line:no-empty
    public dispose() : void {}
}
