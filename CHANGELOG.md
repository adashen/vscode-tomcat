# Change Log
All notable changes to the "vscode-tomcat" extension will be documented in this file.

# 0.12.1

### Fixed
* Regression issue: failed to debug a WAR package. [#329](https://github.com/adashen/vscode-tomcat/issues/329)
* Empty string in META-INF/context.xml was not handled well. [#234](https://github.com/adashen/vscode-tomcat/issues/234)

# 0.12.0
### Added
* New setting `tomcat.customEnv` to specify custom environment variables. Now it is allowed to launch Tomcat servers with a different Java runtime by specifying a `JAVA_HOME` env. [#318](https://github.com/adashen/vscode-tomcat/pull/318)

### Changed
* Always ask for confirmation when deleting a Tomcat server. [#306](https://github.com/adashen/vscode-tomcat/pull/306)

# 0.11.3
### Changed
* Fixed [#226](https://github.com/adashen/vscode-tomcat/issues/226): Can't add Tomcat server on Linux
* Fixed [#239](https://github.com/adashen/vscode-tomcat/issues/239): Can't select different JVM to run Tomcat instance

# 0.11.2
### Changed
* Update the `vscode-extension-telemetry-wrapper` to `0.8.0`.

# 0.11.1
### Fixed
* Account for case when looking at context XML [#218](https://github.com/adashen/vscode-tomcat/issues/#218)

# 0.11.0
### Added
* Support to use the context.xml if present

# 0.10.0
### Added
* Support right click on exploded war folder to run it directory Tomcat Server
* Support right click on exploded war folder to debug it directory on Tomcat Server
### Fixed
* Fix issue [#177](https://github.com/adashen/vscode-tomcat/issues/206)

## 0.9.0
### Added
* Add command "Generate War Package from Current Folder"
### Fixed
* Fix issue [#177](https://github.com/adashen/vscode-tomcat/issues/177)
* Fix issue [#181](https://github.com/adashen/vscode-tomcat/issues/181)
* Fix issue [#185](https://github.com/adashen/vscode-tomcat/issues/185)
* Fix issue [#186](https://github.com/adashen/vscode-tomcat/issues/186)

## 0.8.0
### Added
* Enable "Open in Browser" command for idle server too
* Support right click on server to select a war package to debug
### Fixed
* Fix issue [#168](https://github.com/adashen/vscode-tomcat/issues/162)
### Changed
* Rename extension to "Tomcat for Java" [#162](https://github.com/adashen/vscode-tomcat/issues/162)
* Update war package icon
* Update demo gif in README

## 0.7.0
### Added
* Support automaticaly run operations aginst the server when there is only one Tomcat Server in work space
### Fixed
* Fix issue [#145](https://github.com/adashen/vscode-tomcat/issues/145)
* Fix issue [#144](https://github.com/adashen/vscode-tomcat/issues/144)
* Fix issue [#148](https://github.com/adashen/vscode-tomcat/issues/148)

### Changed
* Update the server home page header
* Provide a centralized usage demo in the beginning of README

## 0.6.1
### Hot Fix
* Fix issue [#138](https://github.com/adashen/vscode-tomcat/issues/138)

## 0.6.0
### Added
* Add "Reveal in Explorer" context command to war packages in Tomcat Exploer
* Add "Delete" context command to war packages in Tomcat Explorer
* Add support for users to customize JVM options

### Changed
* Update context commands names
* Format the server.xml during creating Tomcat Server

## 0.5.0
### Added
* Validate Tomcat install directory when user creating Tomcat Server
* Add "Restart Tomcat Server" command
* Add command palette entry for users to run "Debug on Tomcat Server"
* Support users to config the Tomcat Servers workspace in settings
* Add refresh button in Tomcat Server Explorer
* Support Tomcat Server renaming from Tomcat Server Explorer
* Show war packages deployed to Tomcat Server in sub-tree in Tomcat Server Explorer
* Add context command to browse war package
* Support right-click to Add Tomcat Server in Tomcat Server Explorer

### Changed
* Support creating multiple Tomcat Servers from same install path
* Construct the Tomcat Server name automatically base on install path
* Add option for users to choose never restarting Tomcat Server even if the http(s) port changed

### Fixed
* Just deploy a war package without restarting a Tomcat Server when users keep runing/debuging new war package on it [#59](https://github.com/adashen/vscode-tomcat/issues/59)
* Poping up error message with a revert action instead of just restarting Tomcat Server when user change server port of a running server [#28](https://github.com/adashen/vscode-tomcat/issues/28)

## 0.4.0
### Added
* Add "+" button in Tomcat Server Explorer to add new Tomcat Server
* Add option to add new Tomcat Server to start if there is no server to start
* Add context command "Delete Tomcat Server" for running server in Tomcat Server Explorer

### Changed
* Browse directly to select Tomcat Directory and add Tomcat Server without clicking "Browse..."
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
