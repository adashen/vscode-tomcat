import * as assert from "assert";
import * as path from "path";
import * as portfinder from "portfinder";
import * as Constants from "../src/Constants";
import { TomcatServer } from "../src/Tomcat/TomcatServer";
import { Utility } from "../src/Utility";

suite('utility tests', () => {
  test('getFreePort', async () => {
    try {
      const port: number = await portfinder.getPortPromise();
      assert.notEqual(port, 0);
    } catch (error) {
      assert.fail('no eror', 'error');
    }
  }).timeout(60 * 1000);
  test('getPort', async () => {
    try {
      const filePath: string = path.resolve(__dirname, '../../testResources/server.xml');
      const port: string = await Utility.getPort(filePath, Constants.PortKind.Http);
      assert.equal(port, '8081');
    } catch (error) {
      assert.fail('no error', 'error');
    }
  }).timeout(60 * 1000);
});
