'use strict';

import * as child_process from "child_process";
import { ChildProcess, SpawnOptions } from "child_process";
import * as fse from "fs-extra";
import * as net from "net";
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

    export async function executeCMD(outputPane: vscode.OutputChannel, command: string, options: SpawnOptions, ...args: string[]): Promise<void> {
        await new Promise((resolve: () => void, reject: (e: Error) => void): void => {
            outputPane.show();
            let stderr: string = '';
            const p: ChildProcess = child_process.spawn(command, args, options);
            p.stdout.on('data', (data: string | Buffer): void =>
                outputPane.append(data.toString()));
            p.stderr.on('data', (data: string | Buffer) => {
                stderr = stderr.concat(data.toString());
                outputPane.append(data.toString());
            });
            p.on('error', (err: Error) => {
                reject(err);
            });
            p.on('exit', (code: number, signal: string) => {
                if (code !== 0) {
                    reject(new Error(localize('tomcatExt.commandfailed', 'Command failed with exit code {0}', code)));
                }
                resolve();
            });
        });
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

    export async function getServerPort(serverXml: string): Promise<string> | undefined {
        if (!await fse.pathExists(serverXml)) {
            throw new Error(localize('tomcatExt.noserver', 'No tomcat server.'));
        }
        const xml: string = await fse.readFile(serverXml, 'utf8');
        const jsonObj: {} = await parseXml(xml);

        if (!jsonObj || !jsonObj[Constants.SERVER]) {
            return undefined;
        }

        let port: string | undefined;
        const server: {} = jsonObj[Constants.SERVER];
        const services: {}[] = server[Constants.SERVICE];
        if (services) {
            const service: {} = services.find((item: { $: { name: string } }) => item.$.name === Constants.CATALINA);
            if (service && service[Constants.CONNECTOR]) {
                const connectors: { $: {} }[] = service[Constants.CONNECTOR];
                const connector: { $: {} } = connectors.find((item: { $: { protocol: {} } }) =>
                    (item.$.protocol === undefined || item.$.protocol.toString().startsWith(Constants.HTTP)));
                if (connector && connector.$) {
                    port = connector.$[Constants.PORT];
                }
            }
        }
        return port;
    }

    async function parseXml(xml: string): Promise<{}> {
        return new Promise((resolve: (obj: {}) => void, reject: (e: Error) => void): void => {
            xml2js.parseString(xml, { explicitArray: true }, (err: Error, res: {}) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }
}
