# Change Log
All notable changes to the "vscode-tomcat" extension will be documented in this file.

## 0.1.0
- Initial release
### Added
* Create Tomcat server in workspace
* Debug war package on Tomcat server
* Run war package on Tomcat server
* Delete the Tomcat server in workspace

## 0.2.0
### Added
* Support opening/editoring server.xml of the tomcat instance in workspace from Tomcat Servers Explorer

## 0.2.1
* Fix Overview page issue 

## 0.3.0
### Added
* Support starting Tomcat from Tomcat Server Explorer
* Support restart if server.xml of a running server is updated
* Support open root page from Tomcat Server Explorer
### Fixed
* Package the extension to work on linux OS #10
* Force stop Tomcat when closing Visual Studio Code #6
