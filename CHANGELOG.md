# Change Log
All notable changes to the "vscode-tomcat" extension will be documented in this file.

## 0.4.0
### Added
* Add "+" button in Tomcat Server Explorer to create new Tomcat Server
* Add option to create new Tomcat Server to start if there is no server to start
* Add context command "Delete Tomcat Server" for running server in Tomcat Server Explorer

### Changed
* Browse directly to select Tomcat Directory and create Tomcat Server without clicking "Browse..."
* Prompt information message to confirm continuing operations when user creating same Tomcat Server

### Fixed
* Using command to start a running server throw error and shutdown the running server [#60](https://github.com/adashen/vscode-tomcat/issues/60)
* Error message shows not clear enough information to user when no server to stop [#42](https://github.com/adashen/vscode-tomcat/issues/42)
* Using command to delete a running server didn't kill all tomcat process [#61](https://github.com/adashen/vscode-tomcat/issues/61)
* Command 'Open server.xml' command shows in Tomcat Server Explorer even if there is no Tomcat Server [#37](https://github.com/adashen/vscode-tomcat/issues/37)

## 0.3.0
### Added
* Support starting Tomcat from Tomcat Server Explorer
* Support restarting if server.xml of a running server is updated
* Support opening root page from Tomcat Server Explorer
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
