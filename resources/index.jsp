<html>
<meta charset="UTF-8"><title>Apache Tomcat</title></head>
<body>
	<p><h3>Deployed Packages</h3><p></p>
<%@ page import="java.io.*" %>
<% 
	String file = application.getRealPath("/");
%>
	<ul>
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
		<li><a href="<%= fileNames[i] %>"><%= fileNames[i] %></a></li>
<%
	}
	}
%>
	</ul>
</body>
</html>
