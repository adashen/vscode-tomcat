'use strict';

import { MessageItem } from 'vscode';
import { localize } from './localize';

export namespace DialogMessage {
    export const yes: MessageItem = { title: localize('tomcatExt.yes', 'Yes') };
    export const no: MessageItem = { title: localize('tomcatExt.no', 'No'), isCloseAffordance: true };
    export const cancel: MessageItem = { title: localize('tomcatExt.cancel', 'Cancel'), isCloseAffordance: true };
    export const never: MessageItem = { title: localize('tomcatExt.never', 'Never') };
    export const moreInfo: MessageItem = { title: localize('tomcatExt.moreInfo', 'More Info') };
    export const selectServer: string = localize('tomcatExt.selectServer', 'Select Tomcat Server');
    export const createServer: string = localize('tomcatExt.createServer', 'Create New Server');
    export const noServer: string = localize('tomcatExt.noServer', 'There are no Tomcat Servers.');
    export const noPackage: string = localize('tomcatExt.noPackage', 'The selected package is not under current workspace.');
    export const noServerConfig: string = localize('tomcatExt.noServerConfig', 'The Tomcat Server is broken. It does not have server.xml');
    export const selectWarPackage: string = localize('tomcatExt.selectWarPackage', 'Select War Package');
    export const selectDirectory: string = localize('tomcatExt.selectDirectory', 'Select Tomcat Directory');
    export const deleteConfirm: string = localize('tomcatExt.deleteConfirm', 'This Tomcat Server is running, are you sure you want to delete it?');
    export const serverRunning: string = localize('tomcatExt.serverRunning', 'This Tomcat Server is already started.');
    export const serverStopped: string = localize('tomcatExt.serverStopped', 'This Tomcat Server was stopped.');
    export const startServer: string = localize('tomcatExt.startServer', 'The Tomcat server needs to be started before browsing the war packages. Would you like to start it now?');

    export function getServerPortChangeErrorMessage(serverName: string, serverPort: string): string {
        return localize('tomcatExt.serverPortChangeError', 'Changing the server port of a running server {0} will cause it unable to shutdown. Would you like to change it back to {1}?', serverName, serverPort);
    }
    export function getConfigChangedMessage(serverName: string): string {
        return localize('tomcatExt.configChanged', 'server.xml of running server {0} has been changed. Would you like to restart it?', serverName);
    }
}
