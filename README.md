# Tomcat for Visual Studio Code
[![Build Status](https://travis-ci.org/adashen/vscode-tomcat.svg?branch=master)](https://travis-ci.org/adashen/vscode-tomcat)


## Features
* Add Tomcat Server from Tomcat Install Path
* Start/Restart Tomcat Server from VSCode
* Run war package on Tomcat Server
* Debug war package on Tomcat Server
* Open server page in browser to check all deployed war packages
* View all deployed war packages in Tomcat Explorer
* Open war package page in browser
* Stop Tomcat Server
* Rename Tomcat Server
* Customize JVM Options when starting Tomcat Server
* Reveal deployed war packages in explorer
* Delete deployed war package

## Prerequisites
* [Apache Tomcat](http://tomcat.apache.org/)
* [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) (for debuging war package)

## Usage

* Add New Tomcat Server, right-click and start it. Find a war package, right-click to run it on Tomcat Server.

![start and run](resources/start_run_war.gif)

* Debug war package on Tomcat Server

Right-click a war package to debug it on Tomcat Server, if there is no server ready, just add a new one from Tomcat directory.
Set a breakpoint, and trigger it.

![debug](resources/debug.gif)

* Rename Tomcat Server
 ![rename](resources/rename.gif)

## Contributing

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Release Notes
Refer to [CHANGELOG](CHANGELOG.md)

## Telemetry
VS Code collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://go.microsoft.com/fwlink/?LinkID=528096&clcid=0x409) to learn more. If you don't wish to send usage data to Microsoft, you can set the `telemetry.enableTelemetry` setting to `false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).