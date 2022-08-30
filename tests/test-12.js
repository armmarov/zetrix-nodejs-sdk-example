const ZtxChainSDK = require('zetrix-sdk-nodejs');
const expect = require('chai').expect;
const BigNumber = require('bignumber.js');
const co = require('co');
require('dotenv').config({path:"/../.env"})

const privateKey = process.env.PRIVATE_KEY;
const sourceAddress = process.env.SRC_ADDRESS;
const destinationAddress = process.env.DST_ADDRESS;
const contractAddress = process.env.CONTRACT_ADDRESS;

const sdk = new ZtxChainSDK({
  host: "test-node.zetrix.com",
  secure: true
});

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

describe('Test use case no 9772', function() {

  it('test startTx when params.srcAddress is -1', function() {

    co(function* () {

      const nonceResult = yield sdk.account.getNonce(sourceAddress);

      expect(nonceResult.errorCode).to.equal(0)

      let nonce = nonceResult.result.nonce;
      nonce = new BigNumber(nonce).plus(1).toString(10);

      console.log(nonce)

      let input = {
        "method": "startTx",
        "params": {
          "extension": "extension",
          "payloadType": "4",
          "payload": {
            "amount": "55"
          },
          "destAddress": destinationAddress,
          "remark": "",
          "srcAddress": "-1",
          "version": "1.0.0",
          "destChainCode": "ab01"
        }
      }
          
      let contractInvoke = yield sdk.operation.contractInvokeByGasOperation({
        contractAddress,
        sourceAddress,
        gasAmount: '55',
        input: JSON.stringify(input),
      });

      console.log(contractInvoke)

      expect(contractInvoke.errorCode).to.equal(0)

      const operationItem = contractInvoke.result.operation;

      console.log(operationItem)

      // let feeData = yield sdk.transaction.evaluateFee({
      //   sourceAddress,
      //   nonce,
      //   operations: [operationItem],
      //   signtureNumber: '100',
      //   // metadata: 'Test evaluation fee',
      // });
      // console.log(feeData)
      // expect(feeData.errorCode).to.equal(0)

      // let feeLimit = feeData.result.feeLimit;
      // let gasPrice = feeData.result.gasPrice;

      // console.log("gasPrice", gasPrice);
      // console.log("feeLimit", feeLimit);

      const blobInfo = sdk.transaction.buildBlob({
        sourceAddress: sourceAddress,
        gasPrice: "1000",
        feeLimit: "1000000",
        nonce: nonce,
        operations: [ operationItem ],
      });

      console.log(blobInfo);
      expect(blobInfo.errorCode).to.equal(0)

      const signed = sdk.transaction.sign({
        privateKeys: [privateKey],
        blob: blobInfo.result.transactionBlob
      })

      console.log(signed)
      expect(signed.errorCode).to.equal(0)

      let submitted = yield sdk.transaction.submit({
        signature: signed.result.signatures,
        blob: blobInfo.result.transactionBlob
      })

      console.log(submitted)
      expect(submitted.errorCode).to.equal(0)

    }).catch(err => {
      console.log(err);
    });
  });

});