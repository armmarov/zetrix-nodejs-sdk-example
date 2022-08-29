'use strict';

const ZtxChainSDK = require('zetrix-sdk-nodejs');

require('chai').should();

const sdk = new ZtxChainSDK({
  host: "test-node.zetrix.com",
  secure: true
});

describe('Test create account', function() {

  it('test account.create', function() {

    // Create account
    sdk.account.create().then(data => {
      console.log(data);
    }).catch(err => {
      console.log(err.message);
    });
  });

});