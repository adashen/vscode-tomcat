# Change Log
All notable changes to the "vscode-tomcat" extension will be documented in this file.

## 0.4.0
### Added
* Support add Tomcat Server from Tomcat Server Explorer
* Support create new Tomcat Server to start if there is no server to start
* Support stop running Tomcat Server from Tomcat Server Explorer
* Support user to continue operations when creating same Tomcat Server
* Support browse directly to select Tomcat Directory and create Tomcat Server without clicking "Browse..."

### Fixed
* Using command to start a running server throw error and shutdown the running server [#60](https://github.com/adashen/vscode-tomcat/issues/60)
* Error message shows not clear enough information to user when no server to stop [#42](https://github.com/adashen/vscode-tomcat/issues/42)
* Using command to delete a running server didn't kill all tomcat process [#61](https://github.com/adashen/vscode-tomcat/issues/61)
* Command 'Open server.xml' command shows in Tomcat Server Explorer even if there is no Tomcat Server [#37](https://github.com/adashen/vscode-tomcat/issues/37)

## 0.3.0
### Added
* Support starting Tomcat from Tomcat Server Explorer
* Support restart if server.xml of a running server is updated
* Support open root page from Tomcat Server Explorer
### Fixed
* Package the extension to work on linux OS [#10](https://github.com/adashen/vscode-tomcat/issues/10)
* Force stop Tomcat when closing Visual Studio Code [#6](https://github.com/adashen/vscode-tomcat/issues/6)

## 0.2.1
* Fix Overview page issue 

## 0.2.0
### Added
* Support opening/editoring server.xml of the tomcat instance in workspace from Tomcat Servers Explorer

## 0.1.0
- Initial release
### Added
* Create Tomcat server in workspace
* Debug war package on Tomcat server
* Run war package on Tomcat server
* Delete the Tomcat server in workspace
