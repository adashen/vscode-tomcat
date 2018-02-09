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

// tslint:disable-next-line:no-http-string
export const UNABLE_SHUTDOWN_URL: string = 'https://stackoverflow.com/questions/36566401/severe-could-not-contact-localhost8005-tomcat-may-not-be-running-error-while/48636631#48636631';

export const RESTART_CONFIG_ID: string = 'restart_when_http(s)_port_change';

// tslint:disable-next-line:no-http-string
export const LOCALHOST: string = 'http://localhost';

export enum ServerState {
    RunningServer = 'runningserver',
    IdleServer = 'idleserver'
}

export enum PortKind {
    Server = 'Server',
    Http = 'Http',
    Https = 'Https'
}
