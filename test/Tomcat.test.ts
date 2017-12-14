import * as assert from "assert";
import { Tomcat } from "../src/Tomcat/Tomcat";
import { TomcatController } from "../src/Tomcat/TomcatController";
import { TomcatServer } from "../src/Tomcat/TomcatServer";
import { Utility } from "../src/Utility";

suite('Error input', () => {
  const serverInfo: TomcatServer = undefined;
  const tomcat: TomcatController = new TomcatController(new Tomcat(''), undefined, undefined);
  test('stopServer', async () => {
    try {
      await tomcat.stopServer(serverInfo);
      assert.fail('Resolve', 'Reject');
    } catch (error) {
      assert.equal(error.toString(), `Error: ${Utility.localize('tomcatExt.noserver', 'Tomcat server is undefined')}`);
    }
  });
  test('runOnServer', async () => {
    try {
      await tomcat.runOnServer(serverInfo, '');
    } catch (error) {
      assert.equal(error.toString(), `Error: ${Utility.localize('tomcatExt.noserver', 'Tomcat server is undefined')}`);
    }
  });
});
