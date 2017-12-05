//
// note: This example test is leveraging the Mocha test framework.
// please refer to their documentation on https://mochajs.org/ for help.
//

// the module 'assert' provides assertion methods from node
import * as assert from "assert";

// you can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as myExtension from "../src/extension";

// defines a Mocha test suite to group tests of similar kind together
suite('Extension Tests', () => {

    // defines a Mocha unit test
    test('Something 1', () => {
        assert.equal(-1, [1, 2, 3].indexOf(5));
        assert.equal(-1, [1, 2, 3].indexOf(0));
    });
});
