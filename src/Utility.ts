'use strict';

import * as child_process from "child_process";
import * as fse from "fs-extra";
import * as net from "net";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import * as xml2js from "xml2js";
import * as Constants from "./Constants";
import { DialogMessage } from "./DialogMessage";
import { localize } from './localize';
import { TomcatServer } from "./Tomcat/TomcatServer";

export namespace Utility {
    export class UserCancelError extends Error {
        constructor(op: string) {
            super(localize('tomcatExt.cancel', '{0} was canceled by user', op));
        }
    }

    export async function executeCMD(outputPane: vscode.OutputChannel, command: string, options: child_process.SpawnOptions, ...args: string[]): Promise<void> {
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
                reject(err);
            });
            p.on('exit', (code: number) => {
                if (code !== 0) {
                    reject(new Error(localize('tomcatExt.commandfailed', 'Command failed with exit code {0}', code)));
                }
                resolve();
            });
        });
    }

    export function getWorkspace(): string {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('tomcat');
        if (config) {
            // tslint:disable-next-line:no-backbone-get-set-outside-model
            const workspace: string = config.get<string>('workspace');
            if (!workspace.startsWith('<<')) {
                return workspace;
            }
        }
        return undefined;
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
                return reject(err);
            });
            server.listen(0, '127.0.0.1');
        });
    }

    export function getTempStoragePath(): string {
        const chars: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
        let result: string = '';
        for (let i: number = 0; i < 5; i += 1) {
            // tslint:disable-next-line:insecure-random
            const idx: number = Math.floor(chars.length * Math.random());
            result += chars[idx];
        }
        return path.resolve(os.tmpdir(), `vscodetomcat_${result}`);
    }

    export function disposeResources(...resources: vscode.Disposable[]): void {
        if (resources) {
            resources.forEach((item: vscode.Disposable) => {if (item) { item.dispose(); }});
        }
    }

    export async function getPort(serverXml: string, kind: Constants.PortKind): Promise<string> {
        if (!await fse.pathExists(serverXml)) {
            throw new Error(localize('tomcatExt.noserver', 'No tomcat server.'));
        }
        const xml: string = await fse.readFile(serverXml, 'utf8');
        let port: string;
        try {
            /* tslint:disable:no-any */
            const jsonObj: any = await parseXml(xml);
            if (kind === Constants.PortKind.Server) {
                port = jsonObj.Server.$.port;
            } else if (kind === Constants.PortKind.Http) {
                port = jsonObj.Server.Service.find((item: any) => item.$.name === Constants.CATALINA).Connector.find((item: any) =>
                    (item.$.protocol === undefined || item.$.protocol.startsWith(Constants.HTTP))).$.port;
            } else if (kind === Constants.PortKind.Https) {
                port = jsonObj.Server.Service.find((item: any) => item.$.name === Constants.CATALINA).Connector.find((item: any) =>
                    (item.$.SSLEnabled.toLowerCase() === 'true')).$.port;
            }
        } catch (err) {
            port = undefined;
        }
        return port;
    }/* tslint:enable:no-any */

    /* tslint:disable:no-any */
    async function parseXml(xml: string): Promise<any> {
        return new Promise((resolve: (obj: {}) => void, reject: (e: Error) => void): void => {
            xml2js.parseString(xml, { explicitArray: true }, (err: Error, res: {}) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }/* tslint:enable:no-any */
}
