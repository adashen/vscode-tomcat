"use strict";

import { TomcatServer } from "./Tomcat/TomcatServer";
import { Tomcat } from "./Tomcat/Tomcat";
import * as vscode from "vscode";

export class TomcatTreeItem implements vscode.TreeItem {
    private static readonly SERVER = "tomcatserver";
    private static readonly RUNNING = "runningserver";
    public readonly _tomcatServer: TomcatServer;

    constructor(tomcatServer: TomcatServer) {
        this._tomcatServer = tomcatServer;
    }

    public get label(): string {
        return this._tomcatServer.getName();
    }

    public get path(): string {
        return this._tomcatServer.getTomcatPath();
    }

    public get contextValue(): string {
        if (this._tomcatServer.isStarted()) {
            return TomcatTreeItem.RUNNING;
        } else {
            return TomcatTreeItem.SERVER;
        }
    }
    public get started(): boolean {
        return this._tomcatServer.isStarted();
    }
}

export class TomcatSeverTreeProvider implements vscode.TreeDataProvider<TomcatServer> {
    private _tomcat: Tomcat = undefined;
    public _onDidChangeTreeData: vscode.EventEmitter<TomcatServer | undefined> = new vscode.EventEmitter<TomcatServer | undefined>();
    public readonly onDidChangeTreeData: vscode.Event<TomcatServer | undefined> = this._onDidChangeTreeData.event;

    constructor(tomcat: Tomcat) {
        this._tomcat = tomcat;
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: TomcatServer): vscode.TreeItem {
        return new TomcatTreeItem(element);
    }

    public getChildren(element?: TomcatServer): TomcatServer[] {
        if (!element) {
            return this._tomcat.getServerSet();
        } else {
            return [];
        }
    }

    // tslint:disable-next-line:no-empty
    dispose():void {}
}
