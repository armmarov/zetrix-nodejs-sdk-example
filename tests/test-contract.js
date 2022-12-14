const ZtxChainSDK = require('zetrix-sdk-nodejs');
const expect = require('chai').expect;
const BigNumber = require('bignumber.js');
const co = require('co');
require('dotenv').config({path:"/../.env"})

const privateKey = process.env.PRIVATE_KEY;
const sourceAddress = process.env.SRC_ADDRESS;

const sdk = new ZtxChainSDK({
  host: "test-node.zetrix.com",
  secure: true
});

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

describe('Test contract create operation', function() {

  it('test create contract account', function() {

    co(function* () {

      const nonceResult = yield sdk.account.getNonce(sourceAddress);

      expect(nonceResult.errorCode).to.equal(0)

      let nonce = nonceResult.result.nonce;
      nonce = new BigNumber(nonce).plus(1).toString(10);

      console.log(nonce)

      let input = { 
        "params": {    
            "managersList": [sourceAddress],    
            "chainCode": "cz91",    
            "isRelay": false  
        }
      }      

      let contractCreateOperation = sdk.operation.contractCreateOperation({
        sourceAddress: sourceAddress,
        initBalance: '10',
        type: 0,
        payload: `
          /*cross-chain*/
          'use strict';
          const INIT_DATA = 'init_data';
          const GATEWAY_PRE = 'gateway';
          const ASSET_PRE = 'asset';
          const PROTOCOL_VERSION = '1.0.0';
          const TxResultEnum = {
            'INIT': '0',
            'ACK_SUCCESS': '1',
            'ACK_FAIL': '2',
            'ACK_TIMEOUT': '3'
          };
          const TxRefundedEnum = {
            'NONE': '0',
            'TODO': '1',
            'REFUNDED': '2'
          };
          const PayloadTypeEnum = {
            'CONTRACT_CALL': '2',
            'TRANSFER_DATA': '3',
            'TRANSFER_SGAS': '4'
          };
          const TxOriginEnum = {
            'SRC': '0',
            'DEST': '1',
            'RELAY': '2'
          };
          const TRANSFER_DATA_FUN = 'storeCrossData';

          function _loadObj(key) {
            let data = Chain.load(key);
            Utils.assert(data !== false, 'Failed to get storage data, key:' + key);
            return JSON.parse(data);
          }

          function _saveObj(key, value) {
            Chain.store(key, JSON.stringify(value));
          }

          function _getKey(first, second, third = '') {
            return (third === '') ? (first + '_' + second) : (first + '_' + second + '_' + third);
          }

          function _checkExisted(key, arrayList) {
            let i = 0;
            for (i = 0; i < arrayList.length; i += 1) {
              if (arrayList[i] === key) {
                return true;
              }
            }
            return false;
          }

          function _checkGateNode(chainCode) {
            let nodeGateways = _loadObj(_getKey(GATEWAY_PRE, chainCode));
            Utils.assert(_checkExisted(Chain.msg.sender, nodeGateways), 'Not gate node');
          }

          function _isGateNode(chainCode) {
            let nodeGateways = _loadObj(_getKey(GATEWAY_PRE, chainCode));
            return _checkExisted(Chain.msg.sender, nodeGateways);
          }

          function _verfiyParamAckResult(ackResult) {
            Utils.assert(ackResult === TxResultEnum.ACK_SUCCESS || ackResult === TxResultEnum.ACK_FAIL || ackResult === TxResultEnum.ACK_TIMEOUT, 'Ack result error');
          }

          function _getChainCode() {
            return _loadObj(INIT_DATA).chainCode;
          }

          //资产合约定义
          function _makeAllowanceKey(owner, spender) {
            return 'allow_' + owner + '_to_' + spender;
          }

          function _makeAssetKey(assetKey, address) {
            return _getKey(ASSET_PRE, assetKey, address);
          }

          function _buildContractInput(payload) {
            let callInput = {
              'method': payload.contractMethod,
              'params': {}
            };

            let i = 0;
            let inputArray = payload.contractInput;
            for (i = 0; i < inputArray.length; i += 1) {
              let singleInput = inputArray[i];
              let key = singleInput.name;
              let value = singleInput.value;
              callInput.params[key] = value;
            }

            return callInput;
          }

          function transfer(paramObj) {
            let to = paramObj.to;
            let value = paramObj.value;
            Utils.assert(Utils.addressCheck(to) === true, 'Arg-to is not a valid address.');
            Utils.assert(Utils.stoI64Check(value) === true, 'Arg-value must be alphanumeric.');
            Utils.assert(Utils.int64Compare(value, '0') > 0, 'Arg-value must be greater than 0.');
            if (Chain.msg.sender === to) {
              Chain.tlog('transfer', Chain.msg.sender, to, value);
              return;
            }

            let senderValue = Chain.load(_makeAssetKey(paramObj.assetKey, Chain.msg.sender));
            Utils.assert(senderValue !== false, 'Failed to get the balance of ' + Chain.msg.sender + ' from metadata.');
            Utils.assert(Utils.int64Compare(senderValue, value) >= 0, 'Balance:' + senderValue + ' of sender:' + Chain.msg.sender + ' < transfer value:' + value + '.');

            let toValue = Chain.load(_makeAssetKey(paramObj.assetKey, to));
            toValue = (toValue === false) ? value: Utils.int64Add(toValue, value);
            Chain.store(_makeAssetKey(paramObj.assetKey, to), toValue);

            senderValue = Utils.int64Sub(senderValue, value);
            Chain.store(_makeAssetKey(paramObj.assetKey, Chain.msg.sender), senderValue);

            Chain.tlog('transfer', Chain.msg.sender, to, value);
          }

          function balanceOf(paramObj) {
            Utils.assert(Utils.addressCheck(paramObj.owner) === true, 'Arg-address is not a valid address.');

            let value = Chain.load(_makeAssetKey(paramObj.assetKey, paramObj.owner));
            Utils.assert(value !== false, 'Failed to get the balance of ' + paramObj.owner + ' from metadata.');
            return value;
          }

          function _assetMint(paramObj) {
            //铸造资产
            let toValue = Chain.load(_makeAssetKey(paramObj.assetKey, paramObj.toAddress));
            toValue = (toValue === false) ? paramObj.amount: Utils.int64Add(toValue, paramObj.amount);
            Chain.store(_makeAssetKey(paramObj.assetKey, paramObj.toAddress), toValue);
            Chain.tlog('mint', Chain.thisAddress, paramObj.toAddress, paramObj.amount);
          }

          function _assetBurn(paramObj) {
            //跨链合约燃烧资产
            let remainValue = Chain.load(_makeAssetKey(paramObj.assetKey, Chain.thisAddress));
            remainValue = Utils.int64Sub(remainValue, paramObj.amount);
            Utils.assert(Utils.int64Compare(remainValue, 0) >= 0, 'Asset burn must large than 0');
            Chain.store(_makeAssetKey(paramObj.assetKey, Chain.thisAddress), remainValue);
            Chain.tlog('burn', Chain.thisAddress, paramObj.amount);
          }

          //判断是否为管理员节点
          function _verifyManager() {

            let manager_accounts = _loadObj(INIT_DATA).managers;
            Utils.assert(_checkExisted(Chain.msg.sender, manager_accounts), 'Not manager_accounts ');

          }

          function _createCrossTxObj(crossTxNo, srcChainCode, destChainCode, origin, paramObj) {
            //1、生成跨链编号
            if (crossTxNo === '') {
              crossTxNo = srcChainCode + ':' + destChainCode + ':' + Utils.sha256(Chain.msg.initiator + Chain.msg.nonce + Chain.msg.operationIndex, 1).substr(0, 32);
            }
            //2、生成跨链交易
            let crossTx = {
              'crossTxNo': crossTxNo,
              'srcChainCode': srcChainCode,
              'destChainCode': destChainCode,
              'srcAddress': paramObj.srcAddress,
              'destAddress': paramObj.destAddress,
              'payloadType': paramObj.payloadType,
              'payload': paramObj.payload,
              'remark': paramObj.remark,
              'result': TxResultEnum.INIT,
              'refunded': TxRefundedEnum.NONE,
              'extension': paramObj.extension,
              'sendProofs': [],
              'ackProofs': [],
              'version': PROTOCOL_VERSION,
              'origin': origin
            };

            return crossTx;
          }

          function init(input) {
            let paramObj = JSON.parse(input).params;
            Utils.assert(paramObj.managersList !== undefined && paramObj.managersList.length > 0, 'Param obj has no managersList.');
            let initData = {
              'chainCode': paramObj.chainCode,
              'createTime': Chain.block.timestamp,
              'createAccount': Chain.msg.sender,
              'managers': paramObj.managersList,
              'isRelay': paramObj.isRelay,
              'blockHeight': Chain.block.number
            };
            _saveObj(INIT_DATA, initData);
            return;
          }

          //设置网关节点
          function setGateway(paramObj) {
            //1、判断是否为超级节点
            _verifyManager();

            //2、保存公证人
            _saveObj(_getKey(GATEWAY_PRE, paramObj.chainCode), paramObj.gatewayList);

            Chain.tlog('setGateway', paramObj.chainCode, JSON.stringify(paramObj.gatewayList));
          }

          function _relaySendTxSub2SubGas(paramObj) {
            //子链->子链
            //1、判断目标链是否存在
            _loadObj(_getKey(GATEWAY_PRE, paramObj.destChainCode));

            //2、生成跨链交易
            let crossTxObj = _createCrossTxObj(paramObj.crossTxNo, paramObj.srcChainCode, paramObj.destChainCode, TxOriginEnum.RELAY, paramObj);
            return crossTxObj;
          }

          function _relaySendTxSub2SubSgas(paramObj) {
            //子链->子链
            //1、判断目标链是否存在
            _loadObj(_getKey(GATEWAY_PRE, paramObj.destChainCode));

            //2、生成跨链交易
            let crossTxObj = _createCrossTxObj(paramObj.crossTxNo, paramObj.srcChainCode, paramObj.destChainCode, TxOriginEnum.RELAY, paramObj);

            return crossTxObj;
          }

          function _relaySendTxSub2SubTransferSgas(paramObj) {
            //子链->子链
            //1、判断目标链是否存在
            _loadObj(_getKey(GATEWAY_PRE, paramObj.destChainCode));

            //2、生成跨链交易
            let crossTxObj = _createCrossTxObj(paramObj.crossTxNo, paramObj.srcChainCode, paramObj.destChainCode, TxOriginEnum.RELAY, paramObj);

            return crossTxObj;
          }

          function _relaySendTxSub2SubCall(paramObj) {
            //子链->子链
            //1、判断目标链是否存在
            _loadObj(_getKey(GATEWAY_PRE, paramObj.destChainCode));

            //2、生成跨链交易
            let crossTxObj = _createCrossTxObj(paramObj.crossTxNo, paramObj.srcChainCode, paramObj.destChainCode, TxOriginEnum.RELAY, paramObj);

            return crossTxObj;
          }

          function _relaySendTxSub2SubData(paramObj) {
            //子链->子链
            //1、判断目标链是否存在
            _loadObj(_getKey(GATEWAY_PRE, paramObj.destChainCode));

            //2、生成跨链交易
            let crossTxObj = _createCrossTxObj(paramObj.crossTxNo, paramObj.srcChainCode, paramObj.destChainCode, TxOriginEnum.RELAY, paramObj);
            return crossTxObj;
          }

          function relaySendTx(paramObj) {
            //判断是否为网关节点
            _checkGateNode(paramObj.srcChainCode);
            Utils.assert(PROTOCOL_VERSION === paramObj.version, 'Version is different, now:' + PROTOCOL_VERSION + ', but sender version:' + paramObj.version);

            let direction = 'sub2sub';
            let funcList = {
              'sub2sub': {
                '2': _relaySendTxSub2SubCall,
                '3': _relaySendTxSub2SubData,
                '4': _relaySendTxSub2SubTransferSgas
              }
            };
            let crossTxObj = funcList[direction][paramObj.payloadType](paramObj);
            Utils.assert(Chain.load(crossTxObj.crossTxNo) === false, 'Cross tx already existed :' + crossTxObj.crossTxNo);
            paramObj.proof.verifierBid = Chain.msg.sender;
            crossTxObj.sendProofs.push(paramObj.proof);
            _saveObj(crossTxObj.crossTxNo, crossTxObj);
            Chain.tlog('sendTx', crossTxObj.crossTxNo);
          }

          function _getOrgin(origin) {
            if (origin === TxOriginEnum.SRC) {
              return 'src';
            }
            if (origin === TxOriginEnum.DEST) {
              return 'dest';
            }
            if (origin === TxOriginEnum.RELAY) {
              return 'relay';
            }
          }

          function _relaySendAckSrcGas(paramObj, crossTxObj) {
            //支持主-子跨链交易
            _checkGateNode(crossTxObj.destChainCode);
            if (paramObj.result === TxResultEnum.ACK_SUCCESS) {
              //将积分转移给目标网关，主链积分不能转走，必须锁在合约里
              return crossTxObj;
            }

            //异常处理, 并将其设置为待退款，由用户自己取走
            crossTxObj.refunded = TxRefundedEnum.TODO;
            return crossTxObj;
          }

          function _relaySendAckSrcSgas(paramObj, crossTxObj) {
            //支持主-子跨链交易
            _checkGateNode(crossTxObj.destChainCode);
            if (paramObj.result === TxResultEnum.ACK_SUCCESS) {
              //解锁目标合约上质押的主链积分，并将主链积分转移给目标网关
              let nodeGateways = _loadObj(_getKey(GATEWAY_PRE, crossTxObj.destChainCode));
              Chain.payCoin(nodeGateways[0], crossTxObj.payload.masterAmount, '', 'Trans main gas to dest gateway for sub gas');
              return crossTxObj;
            }

            //异常处理, 并将其设置为待退款，由用户自己取走
            crossTxObj.refunded = TxRefundedEnum.TODO;
            return crossTxObj;
          }

          function _relaySendAckSrcTransferSgas(paramObj, crossTxObj) {
            //支持主-子跨链交易
            _checkGateNode(crossTxObj.destChainCode);
            if (paramObj.result === TxResultEnum.ACK_SUCCESS) {
              //解锁目标合约上质押的主链积分，并将主链积分转移给目标网关
              return crossTxObj;
            }

            //异常处理, 并将其设置为待退款，由用户自己取走
            crossTxObj.refunded = TxRefundedEnum.TODO;
            return crossTxObj;
          }

          function _relaySendAckSrcCall(paramObj, crossTxObj) {
            //检查是否为目标链的网关发起的ACK交易
            _checkGateNode(crossTxObj.destChainCode);
            if (paramObj.result === TxResultEnum.ACK_SUCCESS) {
              //解锁目标合约上质押的主链积分，并将主链积分转移给目标网关
              let nodeGateways = _loadObj(_getKey(GATEWAY_PRE, crossTxObj.destChainCode));
              Chain.payCoin(nodeGateways[0], crossTxObj.payload.token.masterAmount, '', 'Trans main gas to dest gateway for contract call');
              return crossTxObj;
            }

            //异常处理, 并将其设置为待退款，由用户自己取走
            crossTxObj.refunded = TxRefundedEnum.TODO;
            return crossTxObj;
          }

          function _relaySendAckSrcData(paramObj, crossTxObj) {
            //支持主-子跨链交易
            _checkGateNode(crossTxObj.destChainCode);
            return crossTxObj;
          }

          function _relaySendAckDestCommon(paramObj, crossTxObj) {
            //支持子主的跨链交易
            _checkGateNode(crossTxObj.srcChainCode);
            return crossTxObj;
          }

          function _relaySendAckRelayGas(paramObj, crossTxObj) {
            //支持子-子的跨链交易，由目标链进行ACK确认
            _checkGateNode(crossTxObj.destChainCode);

            if (paramObj.result === TxResultEnum.ACK_SUCCESS) {
              return crossTxObj;
            }
            return crossTxObj;
          }

          function _relaySendAckRelaySgas(paramObj, crossTxObj) {
            //支持子-子的跨链交易，由目标链进行ACK确认
            _checkGateNode(crossTxObj.destChainCode);

            //成功转给目标链，失败退换给目标链
            let toChainCode = paramObj.result === TxResultEnum.ACK_SUCCESS ? crossTxObj.destChainCode: crossTxObj.srcChainCode;
            let nodeGateways = _loadObj(_getKey(GATEWAY_PRE, toChainCode));
            Chain.payCoin(nodeGateways[0], crossTxObj.payload.masterAmount, '', 'Send ack for relay sgas');
            return crossTxObj;
          }

          function _relaySendAckRelayTransferSgas(paramObj, crossTxObj) {
            //支持子-子的跨链交易，由目标链进行ACK确认
            Utils.assert(_isGateNode(crossTxObj.destChainCode) || _isGateNode(crossTxObj.srcChainCode), 'Not gate node');

            return crossTxObj;
          }

          function _relaySendAckRelayCall(paramObj, crossTxObj) {
            //支持子-子的跨链交易，由目标链进行ACK确认
            Utils.assert(_isGateNode(crossTxObj.destChainCode) || _isGateNode(crossTxObj.srcChainCode), 'Not gate node');

            return crossTxObj;
          }

          function _relaySendAckRelayData(paramObj, crossTxObj) {
            //支持子-子的跨链交易，由目标链进行ACK确认
            Utils.assert(_isGateNode(crossTxObj.destChainCode) || _isGateNode(crossTxObj.srcChainCode), 'Not gate node');

            return crossTxObj;
          }

          function relaySendAcked(paramObj) {
            let crossTxObj = _loadObj(paramObj.crossTxNo);
            Utils.assert(crossTxObj.result === TxResultEnum.INIT, 'Result is not init');
            Utils.assert(PROTOCOL_VERSION === paramObj.version, 'Version is different, now:' + PROTOCOL_VERSION + ', but sender version:' + paramObj.version);
            _verfiyParamAckResult(paramObj.result);

            let origin = _getOrgin(crossTxObj.origin);
            let funcList = {
              'src': {
                '2': _relaySendAckSrcCall,
                '3': _relaySendAckSrcData,
                '4': _relaySendAckSrcTransferSgas
              },
              'dest': {
                '2': _relaySendAckDestCommon,
                '3': _relaySendAckDestCommon,
                '4': _relaySendAckDestCommon
              },
              'relay': {
                '2': _relaySendAckRelayCall,
                '3': _relaySendAckRelayData,
                '4': _relaySendAckRelayTransferSgas
              }
            };

            crossTxObj = funcList[origin][crossTxObj.payloadType](paramObj, crossTxObj);
            crossTxObj.result = paramObj.result;
            paramObj.proof.verifierBid = Chain.msg.sender;
            crossTxObj.ackProofs.push(paramObj.proof);
            _saveObj(crossTxObj.crossTxNo, crossTxObj);
            Chain.tlog('sendAcked', crossTxObj.crossTxNo);
          }

          function _subStartTxSgas(paramObj) {
            //子链积分
            Utils.assert(paramObj.srcAddress === Chain.msg.sender, 'Start tx srcAddress and sender not same');
            Utils.assert(paramObj.payloadType === PayloadTypeEnum.SUB_GAS, 'It is not sub gas tx type');

            //2、检查子链积分参数
            Utils.assert(paramObj.payload.srcAmount === Chain.msg.coinAmount, 'Amount not same');

          }

          function _checkParamObj(paramObj) {
            //目标链编码
            Utils.assert((paramObj.destChainCode !== undefined && paramObj.destChainCode.length > 0), 'Start tx destChainCode undefined');
            let reg = /^[a-zA-Z0-9]{4}$/;
            Utils.assert(reg.test(paramObj.destChainCode), 'Start tx destChainCode pattern error');
            //目标链编码
            Utils.assert((paramObj.destAddress !== undefined && paramObj.destAddress.length > 0), 'Start tx destAddress undefined');
          }

          function _subStartTxTransferSgas(paramObj) {
            //子链积分
            Utils.assert(paramObj.srcAddress === Chain.msg.sender, 'Start tx srcAddress and sender not same');
            Utils.assert(paramObj.payloadType === PayloadTypeEnum.TRANSFER_SGAS, 'It is not transfer sub gas tx type');

            //2、检查子链积分参数
            Utils.assert(paramObj.payload.amount === Chain.msg.coinAmount, 'Amount not same');
            _checkParamObj(paramObj);
          }

          function _subStartTxCall(paramObj) {
            //子链积分
            Utils.assert(paramObj.srcAddress === Chain.msg.sender, 'Start tx srcAddress and sender not same');
            Utils.assert(paramObj.payloadType === PayloadTypeEnum.CONTRACT_CALL, 'It is not contract call tx type');
            _checkParamObj(paramObj);
          }

          function _subStartTxData(paramObj) {
            //在源链不做检查，由目标链合约触发ddo合约时候检查
            _checkParamObj(paramObj);
            return;
          }

          function subStartTx(paramObj) {
            Utils.assert(PROTOCOL_VERSION === paramObj.version, 'Version is different, now:' + PROTOCOL_VERSION + ', but sender version:' + paramObj.version);

            let funcList = {
              '2': _subStartTxCall,
              '3': _subStartTxData,
              '4': _subStartTxTransferSgas
            };

            let crossTxObj = funcList[paramObj.payloadType](paramObj);
            //2、生成并保存跨链交易
            crossTxObj = _createCrossTxObj('', _getChainCode(), paramObj.destChainCode, TxOriginEnum.SRC, paramObj);
            _saveObj(crossTxObj.crossTxNo, crossTxObj);
            Chain.tlog('startTx', crossTxObj.crossTxNo);
          }

          function _subSendTxGas(paramObj, crossTxObj) {
            //1、增发主链积分
            let params = {
              'assetKey': _getChainCode(),
              'toAddress': crossTxObj.destAddress,
              'amount': crossTxObj.payload.amount
            };
            _assetMint(params);
          }

          function _subSendTxSgas(paramObj, crossTxObj) {
            //1、检查参数
            Utils.assert(paramObj.payload.destAmount === Chain.msg.coinAmount, 'Amount not same');

            //2、转移给目标用户子链积分
            Chain.payCoin(paramObj.destAddress, crossTxObj.payload.destAmount, '', 'send tx sgas');
          }

          function _subSendTxTransferSgas(paramObj, crossTxObj) {
            let params = {
              'assetKey': crossTxObj.srcChainCode,
              'toAddress': crossTxObj.destAddress,
              'amount': crossTxObj.payload.amount
            };
            _assetMint(params);
          }

          function _subSendTxCall(paramObj, crossTxObj) {
            //1、检查参数
            // Utils.assert(paramObj.payload.token.destAmount === Chain.msg.coinAmount, 'Amount not same');

            //2、构建跨链交易，转移给目标用户
            let callInput = _buildContractInput(crossTxObj.payload);
            Chain.payCoin(paramObj.destAddress, '0', JSON.stringify(callInput), 'send tx for contract call');
          }

          function _buildTransferDataInput(payload) {
            let callInput = {
              'method': TRANSFER_DATA_FUN,
              'params': {
                'crossData': payload.data
              }
            };

            return callInput;
          }

          function _subSendTxData(paramObj, crossTxObj) {
            //生成data数据
            let callInput = _buildTransferDataInput(crossTxObj.payload);
            //2、构建跨链交易，转移给目标用户
            Chain.payCoin(paramObj.destAddress, '0', JSON.stringify(callInput), 'send tx for  transfer data');

          }

          function subSendTx(paramObj) {
            //1、判断是否为网关节点
            _checkGateNode(paramObj.destChainCode);
            Utils.assert(PROTOCOL_VERSION === paramObj.version, 'Version is different, now:' + PROTOCOL_VERSION + ', but sender version:' + paramObj.version);

            let funcList = {
              '2': _subSendTxCall,
              '3': _subSendTxData,
              '4': _subSendTxTransferSgas
            };

            //2、生成跨链交易
            let crossTxObj = _createCrossTxObj(paramObj.crossTxNo, paramObj.srcChainCode, paramObj.destChainCode, TxOriginEnum.DEST, paramObj);
            funcList[crossTxObj.payloadType](paramObj, crossTxObj);
            paramObj.proof.verifierBid = Chain.msg.sender;
            crossTxObj.sendProofs.push(paramObj.proof);
            Utils.assert(Chain.load(crossTxObj.crossTxNo) === false, 'Cross tx already existed:' + crossTxObj.crossTxNo);
            _saveObj(crossTxObj.crossTxNo, crossTxObj);
            Chain.tlog('sendTx', crossTxObj.crossTxNo);
          }

          function _subSendAckSrcGas(paramObj, crossTxObj) {
            //子-其他链的跨链交易
            _checkGateNode(crossTxObj.srcChainCode);
            if (paramObj.result === TxResultEnum.ACK_SUCCESS) {
              //成功之后，销毁自己的主链积分合约资产
              let params = {
                'assetKey': _getChainCode(),
                'amount': crossTxObj.payload.amount
              };
              _assetBurn(params);
            } else {
              //失败之后，需要将其设置为待退款，由用户自己取走
              crossTxObj.refunded = TxRefundedEnum.TODO;
            }

            return crossTxObj;
          }

          function _subSendAckSrcSgas(paramObj, crossTxObj) {
            //子-其他链的跨链交易
            _checkGateNode(crossTxObj.srcChainCode);
            if (paramObj.result === TxResultEnum.ACK_SUCCESS) {
              //成功之后，转移资产给网关
              let nodeGateways = _loadObj(_getKey(GATEWAY_PRE, crossTxObj.srcChainCode));
              Chain.payCoin(nodeGateways[0], crossTxObj.payload.srcAmount, '', 'Trans sub gas to gateway');
            } else {
              //失败之后，需要将其设置为待退款，由用户自己取走
              crossTxObj.refunded = TxRefundedEnum.TODO;
            }

            return crossTxObj;
          }

          function _subSendAckSrcTransferSgas(paramObj, crossTxObj) {
            //子-其他链的跨链交易
            _checkGateNode(crossTxObj.srcChainCode);
            if (paramObj.result !== TxResultEnum.ACK_SUCCESS) {
              //失败之后，需要将其设置为待退款，由用户自己取走
              crossTxObj.refunded = TxRefundedEnum.TODO;
            }

            return crossTxObj;
          }

          function _subSendAckSrcCall(paramObj, crossTxObj) {
            //子-其他链的跨链交易
            _checkGateNode(crossTxObj.srcChainCode);
            if (paramObj.result !== TxResultEnum.ACK_SUCCESS) {
              //失败之后，需要将其设置为待退款，由用户自己取走
              crossTxObj.refunded = TxRefundedEnum.TODO;
            }

            return crossTxObj;
          }

          function _subSendAckSrcData(paramObj, crossTxObj) {
            _checkGateNode(crossTxObj.srcChainCode);
            return crossTxObj;
          }

          function _subSendAckDestCommon(paramObj, crossTxObj) {
            _checkGateNode(crossTxObj.destChainCode);
            return crossTxObj;
          }

          function subSendAcked(paramObj) {
            let crossTxObj = _loadObj(paramObj.crossTxNo);
            Utils.assert(crossTxObj.result === TxResultEnum.INIT, 'Result is not init');
            Utils.assert(PROTOCOL_VERSION === paramObj.version, 'Version is different, now:' + PROTOCOL_VERSION + ', but sender version:' + paramObj.version);
            _verfiyParamAckResult(paramObj.result);

            let origin = _getOrgin(crossTxObj.origin);
            let funcList = {
              'src': {
                '2': _subSendAckSrcCall,
                '3': _subSendAckSrcData,
                '4': _subSendAckSrcTransferSgas
              },
              'dest': {
                '2': _subSendAckDestCommon,
                '3': _subSendAckDestCommon,
                '4': _subSendAckDestCommon
              }
            };

            crossTxObj = funcList[origin][crossTxObj.payloadType](paramObj, crossTxObj);
            crossTxObj.result = paramObj.result;
            paramObj.proof.verifierBid = Chain.msg.sender;
            crossTxObj.ackProofs.push(paramObj.proof);
            _saveObj(crossTxObj.crossTxNo, crossTxObj);
            Chain.tlog('sendAcked', crossTxObj.crossTxNo);
          }

          function subTakeOut(paramObj) {
            let crossTxObj = _loadObj(paramObj.crossTxNo);
            //TODOO 目前只支持主链积分
            Utils.assert(crossTxObj.origin === TxOriginEnum.SRC, 'Not src');
            Utils.assert(crossTxObj.result === TxResultEnum.ACK_TIMEOUT || crossTxObj.result === TxResultEnum.ACK_FAIL, 'Result is not timeout or fail');
            Utils.assert(Chain.msg.sender === crossTxObj.srcAddress, 'Not your asset');
            Utils.assert(crossTxObj.refunded === TxRefundedEnum.TODO, 'Not your asset');
            Utils.assert(crossTxObj.payloadType === PayloadTypeEnum.TRANSFER_SGAS, 'just take out transfer sub gas ');
            crossTxObj.refunded = TxRefundedEnum.REFUNDED;
            _saveObj(crossTxObj.crossTxNo, crossTxObj);
            Chain.payCoin(paramObj.toAddress, crossTxObj.payload.amount, '', 'take out');

            Chain.tlog('takeOut', crossTxObj.crossTxNo);
          }

          function isRelayChain() {
            let initData = _loadObj(INIT_DATA);
            return initData.isRelay === true;
          }

          function main(input) {
            let beRelayChain = isRelayChain();
            let funcList = {
              'setGateway': setGateway,
              'startTx': subStartTx,
              'sendTx': beRelayChain ? relaySendTx: subSendTx,
              'sendAcked': beRelayChain ? relaySendAcked: subSendAcked,
              'takeOut': subTakeOut,
              'transfer': transfer
            };
            let inputObj = JSON.parse(input);
            Utils.assert(funcList.hasOwnProperty(inputObj.method) && typeof funcList[inputObj.method] === 'function', 'Cannot find func:' + inputObj.method);
            funcList[inputObj.method](inputObj.params);
          }

          function query(input) {
            let result = {};
            let inputObj = JSON.parse(input);
            if (inputObj.method === 'getCrossTx') {
              result = _loadObj(input.params.crossTxNo);
            } else if (inputObj.method === 'balanceOf') {
              result.balance = balanceOf(inputObj.params);
            } else if (inputObj.method === 'version') {
              result.version = PROTOCOL_VERSION;
            }

            return JSON.stringify(result);
          }
        `,
        initInput: JSON.stringify(input),
        // metadata: 'Test contract create operation',
      });

      expect(contractCreateOperation.errorCode).to.equal(0)

      const operationItem = contractCreateOperation.result.operation;

      console.log(operationItem)

      let feeData = yield sdk.transaction.evaluateFee({
        sourceAddress,
        nonce,
        operations: [operationItem],
        signtureNumber: '100',
        // metadata: 'Test evaluation fee',
      });
      console.log(feeData)
      expect(feeData.errorCode).to.equal(0)

      let feeLimit = feeData.result.feeLimit;
      let gasPrice = feeData.result.gasPrice;

      console.log("gasPrice", gasPrice);
      console.log("feeLimit", feeLimit);

      const blobInfo = sdk.transaction.buildBlob({
        sourceAddress: sourceAddress,
        gasPrice: gasPrice,
        feeLimit: feeLimit,
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