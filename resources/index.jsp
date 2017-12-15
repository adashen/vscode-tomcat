<html>
	<head>
		<title>Tomcat</title>
		<meta charset="UTF-8"></meta>
		<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">
	</head>
	<body>
	<div class="container-fluid">
	<div class="row jumbotron">
		<div class="col-md-1"><p><img src="https://github.com/adashen/vscode-tomcat/raw/master/resources/Tomcat.png" alt="Tomcat.png" style="height:128;"></p></div>
		<div class="col-md-11"><h1 class="display-3">Tomcat for Visual Studio Code</h1></div>
	</div></div>
	<div class="container">
		<div class="row"><p><h2>Deployed Packages</h2></p></div>
		<div class="row">
	<%@ page import="java.io.*" %>
	<% 
		String file = application.getRealPath("/");
	%>
			<ul class="list-group">
	<%
		File f = new File(file);
		String webappsPath = f.getParent();
		File webapps = new File(webappsPath);
		String [] fileNames = webapps.list();
		File [] fileObjects= webapps.listFiles();
		for (int i = 0; i < fileObjects.length; i++) {
		if(fileObjects[i].isDirectory() && !("ROOT").equalsIgnoreCase(fileNames[i])){
			String fname = file+fileNames[i];
	%>
				<li class="list-group-item"><span class="glyphicon glyphicon-folder-close"></span><a href="<%= fileNames[i] %>"> <%= fileNames[i] %></a></li>
	<%
		}
		}
	%>
			</ul>
		</div>
	</div>
	</body>
</html>
