'use strict';

import * as child_process from "child_process";
import * as fse from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as dotenv from "dotenv";
import * as readline from "readline";
import * as vscode from "vscode";
import { instrumentOperationStep, sendInfo } from "vscode-extension-telemetry-wrapper";
import * as xml2js from "xml2js";
import * as Constants from "./Constants";
import { DialogMessage } from "./DialogMessage";
import { localize } from './localize';

/* tslint:disable:no-any */
export namespace Utility {
    let projectEnv = {};

    export async function executeCMD(outputPane: vscode.OutputChannel, serverName: string, command: string, options: child_process.SpawnOptions, ...args: string[]): Promise<void> {
        await new Promise((resolve: () => void, reject: (e: Error) => void): void => {
            outputPane.show();
            let stderr: string = '';
            options.env = {...options.env, ...projectEnv};
            const p: child_process.ChildProcess = child_process.spawn(command, args, options);
            p.stdout.on('data', (data: string | Buffer): void =>
                outputPane.append(serverName ? `[${serverName}]: ${data.toString()}` : data.toString()));
            p.stderr.on('data', (data: string | Buffer) => {
                stderr = stderr.concat(data.toString());
                outputPane.append(serverName ? `[${serverName}]: ${data.toString()}` : data.toString());
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

    export function setEnv(workdir: string): void {
        projectEnv = {};
        let fpath = workdir+'/.env';
        if (!fse.pathExistsSync(fpath)) return;
        const envConfig = dotenv.parse(fse.readFileSync(fpath))
        for (let k in envConfig) {
            projectEnv[k] = envConfig[k]
        }
    }

    export async function openFile(file: string): Promise<void> {
        if (!await fse.pathExists(file)) {
            throw new Error(localize('tomcatExt.fileNotExist', `File ${file} does not exist.`));
        }
        vscode.window.showTextDocument(vscode.Uri.file(file), { preview: false });
    }

    export function trackTelemetryStep(operationId: string, step: string, callback: (...args: any[]) => any): any {
        return instrumentOperationStep(operationId, step, callback)();
    }

    export function infoTelemetryStep(operationId: string, step: string): void {
        sendInfo(operationId, { finishedStep: step });
    }

    export function disableAutoRestart(): void {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('tomcat');
        if (config) {
            config.update(Constants.RESTART_CONFIG_ID, false, true);
        }
    }

    export async function getServerStoragePath(defaultStoragePath: string, serverName: string): Promise<string> {
        return path.join(await getWorkspace(defaultStoragePath), serverName);
    }

    export async function getServerName(installPath: string, defaultStoragePath: string, existingServerNames: string[]): Promise<string> {
        const workspace: string = await getWorkspace(defaultStoragePath);
        await fse.ensureDir(workspace);
        const fileNames: string[] = await fse.readdir(workspace);
        let serverName: string = path.basename(installPath);
        let index: number = 1;
        while (fileNames.indexOf(serverName) >= 0 || existingServerNames.indexOf(serverName) >= 0) {
            serverName = path.basename(installPath).concat(`-${index}`);
            index += 1;
        }
        return serverName;
    }

    async function getWorkspace(defaultStoragePath: string): Promise<string> {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('tomcat');
        if (config) {
            // tslint:disable-next-line:no-backbone-get-set-outside-model
            const workspace: string = config.get<string>('workspace');
            if (workspace && workspace !== '') {
                await fse.ensureDir(workspace);
                return workspace;
            }
        }
        return path.join(defaultStoragePath, 'tomcat');
    }

    export async function validateInstallPath(installPath: string): Promise<boolean> {
        const configFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'conf', 'server.xml'));
        const serverWebFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'conf', 'web.xml'));
        const serverBootstrapJarFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'bin', 'bootstrap.jar'));
        const serverJuliJarFileExists: Promise<boolean> = fse.pathExists(path.join(installPath, 'bin', 'tomcat-juli.jar'));

        return await configFileExists && await serverWebFileExists && await serverBootstrapJarFileExists && await serverJuliJarFileExists;
    }

    export async function needRestart(httpPort: string, httpsPort: string, serverConfog: string): Promise<boolean> {
        const newHttpPort: string = await getPort(serverConfog, Constants.PortKind.Http);
        const newHttpsPort: string = await getPort(serverConfog, Constants.PortKind.Https);
        let restartConfig: boolean = false;
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('tomcat');
        if (config) {
            restartConfig = config.get<boolean>(Constants.RESTART_CONFIG_ID);
        }
        return restartConfig && (httpPort !== newHttpPort || httpsPort !== newHttpsPort);
    }

    export async function readFileLineByLine(file: string, filterFunction?: (value: string) => boolean): Promise<string[]> {
        let result: string[] = [];
        await new Promise((resolve: () => void): void => {
            const lineReader: readline.ReadLine = readline.createInterface({
                input: fse.createReadStream(file),
                crlfDelay: Infinity
            });
            lineReader.on('line', (line: string) => {
                if (!filterFunction || filterFunction(line)) {
                    result = result.concat(line);
                }
            });
            lineReader.on('close', () => {
                resolve();
            });
        });
        return result;
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

    export async function getPort(serverXml: string, kind: Constants.PortKind): Promise<string> {
        if (!await fse.pathExists(serverXml)) {
            throw new Error(DialogMessage.noServer);
        }
        const xml: string = await fse.readFile(serverXml, 'utf8');
        let port: string;
        try {
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
    }

    export async function setPort(serverXml: string, kind: Constants.PortKind, value: string): Promise<void> {
        if (!await fse.pathExists(serverXml)) {
            throw new Error(DialogMessage.noServer);
        }
        const xml: string = await fse.readFile(serverXml, 'utf8');
        const jsonObj: any = await parseXml(xml);
        if (kind === Constants.PortKind.Server) {
            jsonObj.Server.$.port = value;
        } else {
            const catalinaService: any = jsonObj.Server.Service.find((item: any) => item.$.name === Constants.CATALINA);

            if (kind === Constants.PortKind.Http) {
                const httpConnector: any = catalinaService.Connector.find((item: any) => (!item.$.protocol || item.$.protocol.startsWith(Constants.HTTP)));
                httpConnector.$.port = value;
            } else if (kind === Constants.PortKind.Https) {
                const httpsConnector: any = catalinaService.Connector.find((item: any) => (item.$.SSLEnabled.toLowerCase() === 'true'));
                httpsConnector.$.port = value;
            }
        }
        const builder: xml2js.Builder = new xml2js.Builder();
        const newXml: string = builder.buildObject(jsonObj);
        await fse.writeFile(serverXml, newXml);
    }

    export async function copyServerConfig(source: string, target: string): Promise<void> {
        const xml: string = await fse.readFile(source, 'utf8');
        const jsonObj: {} = await parseXml(xml);
        const builder: xml2js.Builder = new xml2js.Builder();
        const newXml: string = builder.buildObject(jsonObj);
        await fse.ensureFile(target);
        await fse.writeFile(target, newXml);
    }

    export async function parseXml(xml: string): Promise<any> {
        return new Promise((resolve: (obj: {}) => void, reject: (e: Error) => void): void => {
            xml2js.parseString(xml, { explicitArray: true }, (err: Error, res: {}) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }

    export function getJavaExecutable(): string {
        let javaPath = '';
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('java');
        if (config) {
            javaPath = config.get<string>('home');
        }
        return javaPath ? javaPath + '/bin/java' : 'java';
    }
}
