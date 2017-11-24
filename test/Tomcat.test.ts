import * as assert from "assert";
import { Tomcat } from "../src/Tomcat/Tomcat";
import { Utility } from "../src/utility";

suite("Error input", () => {
  const serverInfo: undefined = undefined;
  const tomcat: Tomcat = new Tomcat("");
  test("stopServer", async () => {
    try {
      await tomcat.stopServer(serverInfo);
      assert.fail("Resolve", "Reject");
    } catch(error) {
      assert.equal(error.toString(), `Error: ${Utility.localize("tomcatExt.noserver", "Tomcat server is undefined")}`);
    }
  });
  test("runOnServer", async () => {
    try {
      await tomcat.runOnServer(serverInfo, "");
    } catch(error) {
      assert.equal(error.toString(), `Error: ${Utility.localize("tomcatExt.noserver", "Tomcat server is undefined")}`);
    }
  });
});
