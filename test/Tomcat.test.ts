'use strict';

import * as assert from "assert";
import { DialogMessage } from '../src/DialogMessage';
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
      assert.equal(error.toString(), `Error: ${DialogMessage.noServer}`);
    }
  });
  test('runOnServer', async () => {
    try {
      await tomcat.runOnServer(serverInfo, '');
    } catch (error) {
      assert.equal(error.toString(), `Error: ${DialogMessage.noServer}`);
    }
  });
});
