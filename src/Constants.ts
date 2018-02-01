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

export const DEBUG_ARGUMENT_KEY: string = '-agentlib:jdwp=transport=dt_socket,suspend=n,server=y,address=localhost:';

export const CLASS_PATH_KEY: string = '-classpath';

export const CATALINA_BASE_KEY: string = '-Dcatalina.base';

export const CATALINA_HOME_KEY: string = '-Dcatalina.home';

export const JAVA_IO_TEMP_DIR_KEY: string = '-Djava.io.tmpdir';

export const FILE_ENCODING_KEY: string = '-Dfile.encoding';

export const BOOTSTRAP_FILE: string = 'org.apache.catalina.startup.Bootstrap';

export const JVM_DEFAULT_OPTIONS_KEYS: string[] = [CLASS_PATH_KEY, CATALINA_BASE_KEY, CATALINA_HOME_KEY, JAVA_IO_TEMP_DIR_KEY, FILE_ENCODING_KEY];

export enum ServerState {
    RunningServer = 'runningserver',
    IdleServer = 'idleserver'
}

export enum PortKind {
    Server = 'Server',
    Http = 'Http',
    Https = 'Https'
}
