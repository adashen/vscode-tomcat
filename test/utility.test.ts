import * as assert from "assert";
import { Utility } from "../src/utility";

suite("utility tests", () => {
  test("getFreePort", async () => {
    try {
      const port: number = await Utility.getFreePort();
      assert.notEqual(port, 0);
    } catch(error) {
      assert.fail("no eror", "error");
    }
  });
});