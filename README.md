# Test script for crosschain functionality test


### ENV file creation

Please create your own .env file in the root directory and fill in the following information. The CONTRACT_ADDRESS of crosschain contract can be filled in after first contract deployment.

```
PRIVATE_KEY='privBx2Z16FxioN3MzzpWqmfP6kVSeWtZZDYoXLp8ocdaYX3vzdaenjj'
SRC_ADDRESS='ZTX3KYJ7V3xyqox7yXAXxoiZ5DE8QdV6hXE1W'
DST_ADDRESS='did:bid:zfJi76jMyfDCb8FWtM9fgQ6zRwER3doR'
CONTRACT_ADDRESS='ZTX3RXzvqcUL7uF7Mjjj2SAsjb8kgiouUGfpV'
```

### Install dependencies

Before starting the test, please install all related dependencies. 

```
npm install

```

If having error, please check the node version. Currently validated node / npm version is as follows (in linux pc, windows might use different version):

```
node = v16.14.0
npm = 8.3.1

```


### Contract creation

For contract creation, first run the following script.

```
npm test tests/test-contract.js

```

Then please copy paste the contract address to .env at CONTRACT_ADDRESS variable.



### Run test

The test environment has been well defined based on the excel test file in reference folder. The tests can be distinguished by the numbering which denotes the line of the test number in excel file. The number of test case also is defined in the test file, for example : 

```
In test-01.js, we defined "Test use case no 9785" that can binded to the test case number in excel file.

```

To run the test, please execute below command.

```
npm test tests/test-01.js
npm test tests/test-02.js
npm test tests/test-03.js
npm test tests/test-04.js
....
```

### Vaidating test result

Since we are using the Zetrix testnet, the transaction result can be validated via test-explorer.zetrix.com. Please find the deployed crosschain contract to check the transaction list and result.

