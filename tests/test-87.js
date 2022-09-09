const ZtxChainSDK = require('zetrix-sdk-nodejs');
const expect = require('chai').expect;
const BigNumber = require('bignumber.js');
const co = require('co');
require('dotenv').config({path:"/../.env"})

const privateKey = 'privBthNghd6oueWpsMXAUCY3Ac5dS8JLmABXBzWmJDwkEabo7BZrqxC';
const sourceAddress = 'ZTX3dgA6bzAjvyW3vDnQNGTUvWk8utSUHzU4U';
const destinationAddress = process.env.DST_ADDRESS;
const contractAddress = 'ZTX3RXzvqcUL7uF7Mjjj2SAsjb8kgiouUGfpV';


const sdk = new ZtxChainSDK({
  host: "test-node.zetrix.com",
  secure: true
});

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

describe('Test use case no 9697', function() {

  it('test sendAcked, send feedback value 4 for asset transfer', function() {

    co(function* () {

      const nonceResult = yield sdk.account.getNonce(sourceAddress);

      expect(nonceResult.errorCode).to.equal(0)

      let nonce = nonceResult.result.nonce;
      nonce = new BigNumber(nonce).plus(1).toString(10);

      console.log(nonce)

      let input = {
        "method": "sendAcked",
        "params": {
          "crossTxNo": "ab01:cz01:f748eafa30710f7ceb3f150bf46dbf33",
          "extension": "extension",
          "proof": {
            "ledgerSeq": "63052",
            "txHash": "a32963cc5026c1ce46cbeaa4fa38871b1cc903eaf267eaf2b07bb63ff31b9a76"
          },
          "result": "4",
          "version": "1.0.0"
        }
      }

      let contractInvoke = yield sdk.operation.contractInvokeByGasOperation({
        contractAddress,
        sourceAddress,
        gasAmount: '1',
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
        feeLimit: "1500000",
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