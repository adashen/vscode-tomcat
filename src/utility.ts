"use strict";

import * as vscode from "vscode";
import * as child_process from "child_process";
import * as nls from "vscode-nls";
import { TomcatServer } from "./Tomcat/TomcatServer";
import * as net from "net";
import * as fse from "fs-extra";
import * as path from "path";

export class Utility {
    public static async executeCMD(command: string, args: string[],
        options: child_process.SpawnOptions, outputPane: vscode.OutputChannel): Promise<void> {
        await new Promise((resolve: () => void, reject: (e: Error) => void): void => {
            outputPane.show();
            let stderr: string = "";
            let p: child_process.ChildProcess = child_process.spawn(command, args, options);
            p.stdout.on("data", (data: string | Buffer): void =>
                outputPane.append(data.toString()));
            p.stderr.on("data", (data: string | Buffer) => {
                stderr = stderr.concat(data.toString());
                outputPane.append(data.toString());
            });
            p.on("error", (err) => {
                reject(new Error(err.toString()));
            });
            p.on("exit", (code: number, signal: string) => {
                console.log(code);
                console.log(signal);
                if (code !== 0) {
                    // tslint:disable-next-line:quotemark
                    reject (new Error(Utility.localize("tomcatExt.commandfailed", "Command failed with exit code {0}", code)));
                } else {
                    resolve();
                }
            });
        });
    }

    public static isPathEqual(fsPath1: string, fsPath2: string): boolean {
        const relativePath: string = path.relative(fsPath1, fsPath2);
        return relativePath === "";
    }

    public static isSubPath(expectParent: string, expectChild: string): boolean {
        const relativePath: string = path.relative(expectParent, expectChild);
        return relativePath !== "" && !relativePath.startsWith("..") && relativePath !== expectChild;
    }

    public static getWorkspaceFolder(fsPath: string): vscode.WorkspaceFolder | undefined {
        if (vscode.workspace.workspaceFolders) {
            const folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders.find(
                (f: vscode.WorkspaceFolder): boolean => {
                return Utility.isPathEqual(f.uri.fsPath, fsPath) || Utility.isSubPath(f.uri.fsPath, fsPath);
            });

            return folder;
        } else {
            return undefined;
        }
    }

    public static combineServerNameAndPath(serverName: string, tomcatPath: string): string | undefined {
        if (!serverName || !tomcatPath) {
            return undefined;
        }

        return `${serverName};${tomcatPath}`;
    }

    public static parseServerNameAndPath(serverString: string): string[] | undefined {
        if (!serverString) {
            return undefined;
        }
        const nameAndPath: string[] = serverString.split(";");
        if (!nameAndPath || nameAndPath.length !== 2) {
            return undefined;
        }

        return nameAndPath;
    }

    public static async deleteFolderRecursive(dir: string): Promise<void> {
        const exists: boolean = await fse.pathExists(dir);
        if (exists) {
            await fse.remove(dir);
        }
        return Promise.resolve();
    }

    public static async cleanAndCreateFolder(dir: string): Promise<void> {
        await Utility.deleteFolderRecursive(dir);
        await fse.mkdirs(dir);
        return Promise.resolve();
    }

    public static async getFreePort(): Promise<number> {
        return await new Promise((resolve: (port: number) => void, reject: (e: Error) => void): void => {
            const server: net.Server = net.createServer();
            let port: number = 0;
            server.on("listening", () => {
                port = server.address().port;
                server.close();
            });
            server.on("close", () => {
                return resolve(port);
            });
            server.on("error", (err) => {
                return reject(new Error(err.toString()));
            });
            server.listen(0, "127.0.0.1");
        });
    }

    public static localize: nls.LocalizeFunc = nls.config(process.env.VSCODE_NLS_CONFIG)();
}
