'use strict';

export const TOMCAT: string = 'Tomcat';

export const SERVER: string = 'Server';

export const SERVICE: string = 'Service';

export const HTTP: string = 'HTTP/';

export const HTPPS: string = 'HTTPS/';

export const CONNECTOR: string = 'Connector';

export const CATALINA: string = 'Catalina';

export const PORT: string = 'port';

export const INVALID_SERVER_DIRECTORY: string = 'Please make sure you select a valid Tomcat Directory.';

export enum ServerState {
    RunningServer = 'runningserver',
    IdleServer = 'idleserver'
}

export enum PortKind {
    Server = 'Server',
    Http = 'Http',
    Https = 'Https'
}
