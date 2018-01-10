'use strict';

import * as child_process from "child_process";
import * as fse from "fs-extra";
import * as net from "net";
import * as path from "path";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import * as xml2js from "xml2js";
import { TomcatServer } from "./Tomcat/TomcatServer";

export namespace Utility {
    export class UserCancelError extends Error {
        constructor(op: string) {
            super(`${Utility.localize('tomcatExt.cancel', '{0} canceled by user', op)}`);
        }
    }

    export async function executeCMD(outputPane: vscode.OutputChannel, command: string,
                                     options: child_process.SpawnOptions, ...args: string[]): Promise<void> {
        await new Promise((resolve: () => void, reject: (e: Error) => void): void => {
            outputPane.show();
            let stderr: string = '';
            const p: child_process.ChildProcess = child_process.spawn(command, args, options);
            p.stdout.on('data', (data: string | Buffer): void =>
                outputPane.append(data.toString()));
            p.stderr.on('data', (data: string | Buffer) => {
                stderr = stderr.concat(data.toString());
                outputPane.append(data.toString());
            });
            p.on('error', (err: Error) => {
                reject(new Error(err.toString()));
            });
            p.on('exit', (code: number, signal: string) => {
                if (code !== 0) {
                    // tslint:disable-next-line:quotemark
                    reject (new Error(localize('tomcatExt.commandfailed', 'Command failed with exit code {0}', code)));
                } else {
                    resolve();
                }
            });
        });
    }

    export function isPathEqual(fsPath1: string, fsPath2: string): boolean {
        const relativePath: string = path.relative(fsPath1, fsPath2);
        return relativePath === '';
    }

    export function isSubPath(expectParent: string, expectChild: string): boolean {
        const relativePath: string = path.relative(expectParent, expectChild);
        return relativePath !== '' && !relativePath.startsWith('..') && relativePath !== expectChild;
    }

    export function getWorkspaceFolder(fsPath: string): vscode.WorkspaceFolder | undefined {
        if (vscode.workspace.workspaceFolders) {
           return vscode.workspace.workspaceFolders.find(
                (f: vscode.WorkspaceFolder): boolean => {
                return isPathEqual(f.uri.fsPath, fsPath) || isSubPath(f.uri.fsPath, fsPath);
            });
        } else {
            return undefined;
        }
    }

    export async function deleteFolderRecursive(dir: string): Promise<void> {
        if (await fse.pathExists(dir)) {
            await fse.remove(dir);
        }
    }

    export async function cleanAndCreateFolder(dir: string): Promise<void> {
        await deleteFolderRecursive(dir);
        await fse.mkdirs(dir);
    }

    export async function getFreePort(): Promise<number> {
        return await new Promise((resolve: (port: number) => void, reject: (e: Error) => void): void => {
            const server: net.Server = net.createServer();
            let port: number = 0;
            server.on('listening', () => {
                port = server.address().port;
                server.close();
            });
            server.on('close', () => {
                return resolve(port);
            });
            server.on('error', (err: Error) => {
                return reject(new Error(err.toString()));
            });
            server.listen(0, '127.0.0.1');
        });
    }

    export async function openFileIfExists(filepath: string): Promise<boolean> {
        const exists: boolean = await fse.pathExists(filepath);
        if (exists) {
            await vscode.window.showTextDocument(vscode.Uri.file(filepath), { preview: false });
            return true;
        } else {
            return false;
        }
    }

    export async function getServerPort(serverXml: string): Promise<string> | undefined {
        if (!await fse.pathExists(serverXml)) {
            throw new Error(localize('tomcatExt.noserver', 'No tomcat server.'));
        }
        const xml: string = await fse.readFile(serverXml, 'utf8');
        const jsonObj: {} = await parseXml(xml);
        return getPortFromJson(jsonObj);
    }

    export const localize: nls.LocalizeFunc = nls.config(process.env.VSCODE_NLS_CONFIG)();

    async function parseXml(xml: string): Promise<{}> {
        return new Promise((resolve: (obj: {}) => void, reject: (e: Error) => void): void => {
            xml2js.parseString(xml, { explicitArray: true }, (err: {}, res: {}) => {
                if (err) {
                    return reject(new Error(err.toString()));
                } else {
                    return resolve(res);
                }
            });
        });
    }

    function getPortFromJson(jsonObj: {}): string | undefined {
        try {
            const server: {} = getValue(jsonObj, 'Server');
            const services: {}[] = getValue(server, 'Service');
            const service: {} = services.find((item: {$: {name: string}}) => item.$.name === 'Catalina');
            const connectors: {$: {}}[] = getValue(service, 'Connector');
            // if protocol is not specified, the default is HTTP/1.1
            const connector: {$: {}} = connectors.find((item: {$: {protocol: {}}}) =>
                (item.$.protocol === undefined || item.$.protocol.toString().startsWith('HTTP/')));
            return getValue(connector.$, 'port');
        } catch (err) {
            return undefined;
        }
    }

    // tslint:disable-next-line:no-any
    function getValue(jsonObj: {}, key: string): any {
        if (jsonObj && jsonObj[key]) {
            return jsonObj[key];
        }
        throw new Error('key does not exist');
    }
}
