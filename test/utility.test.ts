import * as assert from "assert";
import { Utility } from "../src/utility";
import { TomcatServer } from "../src/Tomcat/TomcatServer";
import * as path from "path";

suite("utility tests", () => {
  test("getFreePort", async () => {
    try {
      const port: number = await Utility.getFreePort();
      assert.notEqual(port, 0);
    } catch(error) {
      assert.fail("no eror", "error");
    }
  }).timeout(60*1000);
  test("getPort", async () => {
    try {
      const filePath: string = path.resolve(__dirname, "../../testResources/server.xml");
      let port: string = await Utility.getServerPort(filePath);
      assert.equal(port, "8081");
    } catch(error) {
      assert.fail("no error", "error");
    }
  }).timeout(60*1000);
});