import * as vscode from "vscode";
import { Utility } from "./utility";

export class Pick implements vscode.QuickPickItem {
    public readonly description: string;
    public readonly label: string;
    constructor(label: string, description?: string) {
        this.label = label;
        this.description = description ? description : '';
    }
}

export class PickWithData<T> extends Pick {
    public readonly data: T;
    constructor(data: T, label: string, description?: string) {
        super(label, description);
        this.data = data;
    }
}

export class VSCodeUI {
    public async showQuickPick<T>(items: PickWithData<T>[] | Thenable<PickWithData<T>[]>
                                , placeHolder: string, ignoreFocusOut?: boolean): Promise<PickWithData<T>>;
    public async showQuickPick(items: Pick[] | Thenable<Pick[]>, placeHolder: string, ignoreFocusOut?: boolean): Promise<Pick>;
    public async showQuickPick(items: vscode.QuickPickItem[] | Thenable<vscode.QuickPickItem[]>
                             , placeHolder: string, ignoreFocusOut: boolean = false): Promise<vscode.QuickPickItem> {
        const options: vscode.QuickPickOptions = {
            placeHolder: placeHolder,
            ignoreFocusOut: ignoreFocusOut
        };
        const result: vscode.QuickPickItem | undefined = await vscode.window.showQuickPick(items, options);

        if (!result) {
            throw new Error(Utility.localize('tomcatExt.cancel', 'User canceled'));
        } else {
            return result;
        }
    }

    public async showInputBox(placeHolder: string, prompt: string
                            , ignoreFocusOut: boolean = false, validateInput?: (s: string) => string | undefined | null, defaultValue?: string): Promise<string> {
        const options: vscode.InputBoxOptions = {
            placeHolder: placeHolder,
            prompt: prompt,
            validateInput: validateInput,
            ignoreFocusOut: ignoreFocusOut,
            value: defaultValue
        };
        const result: string | undefined = await vscode.window.showInputBox(options);

        if (!result) {
            throw new Error(Utility.localize('tomcatExt.cancel', 'User canceled'));
        } else {
            return result;
        }
    }

    public async showFileFolderDialog(file: boolean, dir: boolean): Promise<string> {
        const defaultUri: vscode.Uri | undefined = vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined;
        const options: vscode.OpenDialogOptions = {
            defaultUri: defaultUri,
            canSelectFiles: file,
            canSelectFolders: dir,
            canSelectMany: false,
            openLabel: 'Select'
        };
        const result: vscode.Uri[] | undefined = await vscode.window.showOpenDialog(options);

        if (!result || result.length === 0) {
            throw new Error(Utility.localize('tomcatExt.cancel', 'User canceled'));
        } else {
            return result[0].fsPath;
        }
    }
}
