'use strict';

import * as vscode from "vscode";

export class WarPackage extends vscode.TreeItem {
    public contextValue: string;
    public description: string;

    constructor(public label: string, public serverName: string, public iconPath: string) {
        super(label);
        this.contextValue = 'war';
    }
}
