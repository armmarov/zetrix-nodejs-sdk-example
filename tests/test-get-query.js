const ZtxChainSDK = require('zetrix-sdk-nodejs');
const expect = require('chai').expect;
const BigNumber = require('bignumber.js');
const co = require('co');
require('dotenv').config({path:"/../.env"})
require('chai').should();

const privateKey = process.env.PRIVATE_KEY;
const sourceAddress = process.env.SRC_ADDRESS;
const destinationAddress = 'ZTX3ePNZQhndgGzKLmg1SFfno3N42mLhPYJMN';
const contractAddress = 'ZTX3ePNZQhndgGzKLmg1SFfno3N42mLhPYJMN';

const sdk = new ZtxChainSDK({
  host: "node.zetrix.com",
  secure: true
});

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

describe('Test query data', function() {

  it('test block.getNumber()', async() => {
    let data = await sdk.block.getNumber();
    console.log(data);
    data.errorCode.should.equal(0);
    data.result.should.be.a('object');
    data.result.should.have.property('header').be.a('object').have.property('blockNumber');
  });

  it('test account.getBalance(address)', async() => {
    let data = await sdk.account.getBalance(contractAddress);
    console.log(data);
    data.should.be.a('object');
    data.errorCode.should.equal(0);
    data.result.should.have.property('balance');
  });

  it('test contract.call()', async() => {

    let data = await sdk.contract.call({
      optType: 2,
      // code: 'leo'
      // contractAddress: 'ZTX3Ta7d4GyAXD41H2kFCTd2eXhDesM83rvC3',
      contractAddress: contractAddress,
      input: JSON.stringify({
        // method: 'contractInfo',
        method: 'getRewardDistribute',
      }),
    });
    console.log(data);
    console.log(data.result.query_rets);
  });

});