'use strict';
import * as path from "path";
import * as vscode from "vscode";
import { Tomcat } from "./Tomcat/Tomcat";
import { TomcatServer } from "./Tomcat/TomcatServer";

export class TomcatTreeItem implements vscode.TreeItem {
    private static readonly SERVER: string = 'tomcatserver';
    private static readonly RUNNING: string = 'runningserver';
    public readonly _tomcatServer: TomcatServer;
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
        if (this._tomcatServer.isStarted()) {
            return TomcatTreeItem.RUNNING;
        } else {
            return TomcatTreeItem.SERVER;
        }
    }

    public get iconPath(): string {
        let status: string = 'stop.svg';
        if (this.started) {
            status = 'running.svg';
        }
        return this._context.asAbsolutePath(path.join('resources', status));
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

    public getTreeItem(element: TomcatServer): vscode.TreeItem {
        return new TomcatTreeItem(this._context, element);
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
