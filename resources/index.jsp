<html>
	<head>
		<title>Tomcat</title>
		<meta charset="UTF-8"></meta>
		<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">
	</head>
	<body>
		<div class="container-fluid">
			<div class="row jumbotron">
				<div class="col-md-1">
						<img src="icon.png" alt="icon.png" style="height:128;">
				</div>
				<div class="col-md-11">
					<h1 class="display-3">Tomcat for Visual Studio Code</h1>
				</div>
			</div>
		</div>
		<div class="container">
		<%@ page import="java.io.*" %>
		<% 
			String file = application.getRealPath("/");
			File f = new File(file);
			String webappsPath = f.getParent();
			File webapps = new File(webappsPath);
		%>
			<div class="row"><h2>War Packages Deployed on this Tomcat Server:</h2></div>
			<div class="row" style="font-size: 22px;">
				<ul class="list-group">
				<%
					String [] fileNames = webapps.list();
					File [] fileObjects= webapps.listFiles();
					int packagesCount = 0;
					for (int i = 0; i < fileObjects.length; i++) {
						if(fileObjects[i].isDirectory() && !("ROOT").equalsIgnoreCase(fileNames[i])){
							String fname = file+fileNames[i];
							++packagesCount;
				%>
					<li class="list-group-item"><span class="glyphicon glyphicon-folder-close"></span><a href="<%= fileNames[i] %>"> <%= fileNames[i] %></a></li>
				<%
						}
					}
					if (packagesCount == 0) {
				%>
					<h4>No war package</h4>
				<%
					}
				%>
				</ul>
			</div>
		</div>
	</body>
</html>