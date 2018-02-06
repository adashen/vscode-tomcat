'use strict';

import { MessageItem } from 'vscode';
import { localize } from './localize';

export namespace DialogMessage {
    export const yes: MessageItem = { title: localize('tomcatExt.yes', 'Yes') };
    export const no: MessageItem = { title: localize('tomcatExt.no', 'No'), isCloseAffordance: true };
    export const cancel: MessageItem = { title: localize('tomcatExt.cancel', 'Cancel'), isCloseAffordance: true };
    export const revert: MessageItem = { title: localize('tomcatExt.revert', 'Revert') };
    export const never: MessageItem = { title: localize('tomcatExt.never', 'Never') };
    export const more: MessageItem = { title: localize('tomcatExt.more', 'More Info') };

    export const selectServer: string = localize('tomcatExt.selectServer', 'Select Tomcat Server');
    export const createServer: string = localize('tomcatExt.createServer', 'Create New Server');
    export const noServer: string = localize('tomcatExt.noServer', 'There are no Tomcat Servers.');
    export const serverExist: string = localize('tomcatExt.serverExist', 'This Tomcat Server already exists, abort creation.');
    export const noPackage: string = localize('tomcatExt.noPackage', 'The selected package is not under current workspace.');
    export const noServerConfig: string = localize('tomcatExt.noServerConfig', 'The Tomcat Server is broken. It does not have server.xml');
    export const selectWarPackage: string = localize('tomcatExt.selectWarPackage', 'Select War Package');
    export const selectDirectory: string = localize('tomcatExt.selectDirectory', 'Select Tomcat Directory');
    export const deleteConfirm: string = localize('tomcatExt.deleteConfirm', 'This Tomcat Server is running, are you sure you want to delete it?');
    export const serverRunning: string = localize('tomcatExt.serverRunning', 'This Tomcat Server is already started.');
    export const serverStopped: string = localize('tomcatExt.serverStopped', 'This Tomcat Server was stopped.');
    export const continueOnExistingServer: string = localize('tomcatExt.continueOnExistingServer', 'This Tomcat Server already exists. Do you want to continue the operation on this server?');
    export const startServerToBrowseWarPackage: string = localize('tomcatExt.startServerToBrowseWarPackage', 'Start Tomcat Server to browse the war package');

    export function whetherChangeServerPortBack(serverName: string, serverPort: string): string {
        return localize('tomcatExt.serverPortChangeError', 'Changing the server port of a running server {0} will cause it unable to shutdown, Would you like to change it back to {1}?', serverName, serverPort);
    }
    export function whetherRestartServer(serverName: string): string {
        return localize('tomcatExt.configChanged', 'server.xml of running server {0} has been changed. Would you like to restart it?', serverName);
    }

    export function getStopFailureMessage(serverName: string): string {
        return localize('tomcatExt.stopFailure', 'Failed to stop Tomcat Server {0}', serverName);
    }
}
