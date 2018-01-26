'use strict';

import * as assert from "assert";
import { DialogMessage } from '../src/DialogMessage';
import { TomcatController } from "../src/Tomcat/TomcatController";
import { TomcatModel } from "../src/Tomcat/TomcatModel";
import { TomcatServer } from "../src/Tomcat/TomcatServer";
import { Utility } from "../src/Utility";

suite('Error input', () => {
  const serverInfo: TomcatServer = undefined;
  const tomcatModel: TomcatController = new TomcatController(new TomcatModel(''), undefined);
  test('stopServer', async () => {
    try {
      await tomcatModel.stopServer(serverInfo);
      assert.fail('Resolve', 'Reject');
    } catch (error) {
      assert.equal(error.toString(), `Error: ${DialogMessage.noServer}`);
    }
  });
  test('runOnServer', async () => {
    try {
      await tomcatModel.run(serverInfo, '');
    } catch (error) {
      assert.equal(error.toString(), `Error: ${DialogMessage.noServer}`);
    }
  });
});
