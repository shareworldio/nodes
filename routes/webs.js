/**
 * Created by cjf on 2017/9/30.
 */

var Web3 = require('web3');
var logs = require('./logs.js');
var coder = require('../node_modules/web3/lib/solidity/coder');
var RequestManager = require('../node_modules/web3/lib/web3/requestmanager');
var Eth = require('../node_modules/web3/lib/web3/methods/eth');
var Personal = require('../node_modules/web3/lib/web3/methods/Personal');
var HttpProvider = require('../node_modules/web3/lib/web3/httpprovider');
var sha3 = require('../node_modules/web3/lib/utils/sha3');
var utils = require('../node_modules/web3/lib/utils/utils');

var Jsonrpc = {
    messageId: 0
};

var webs = {};

function get_random_num(Min, Max) // [Min, Max)
{
    var Range = Max - Min;
    var Rand = Math.floor(Math.random() * Range);
    return Min + Rand;
}

function random_string(len) {
    var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz0123456789';    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
    var maxPos = $chars.length;
    var pwd = '';
    for (i = 0; i < len; i++) {
        pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return '"'+ pwd + '"';
}

function random_x_string(len) {
    var $chars = '0123456789abcdef';    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
    var maxPos = $chars.length;
    var pwd = '';
    for (i = 0; i < len; i++) {
        pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
}

function random_address() {
    return '0x'+ random_x_string(40) + '';
}

function random_number(len){
    return '0x'+ random_x_string(len) + '';
}

function random_integer(len){
    if(0 == len)
        return '0x0';

    var $chars = '01234567';
    var firstChr = $chars.charAt(Math.floor(Math.random() * $chars.length));

    if(Math.floor(Math.random()*2) == 0){
        return '-0x'+  firstChr + random_x_string(len-1) + '';
    }

    return '0x'+  firstChr + random_x_string(len-1) + '';
}

function alignSize(size) {
    return parseInt(32 * Math.ceil(size / 32));
}

function randomNumber(size, signed) {
    if(signed)
        return random_integer(size);

    return random_number(size);
}

function randomBoolean() {
    return get_random_num(0, 2) == 0 ? false : true;
}

function randomString() {
    return random_string(get_random_num(0, 256));;
}

function randomFixedBytes(size) {
    return random_string(size);
}

function randomDynamicBytes() {
    return random_string(get_random_num(0, 256));
}

function randomAddress() {
    return random_number(40);
}

function randomArray(size) {
    return random_number(20);
}

function randomType(typeInput) {
    var type = typeInput; // eslint-disable-line
    var coder = null; // eslint-disable-line
    const paramTypePart = new RegExp(/^((u?int|bytes)([0-9]*)|(address|bool|string)|(\[([0-9]*)\]))/);
    const invalidTypeErrorMessage = `[ethjs-abi] while getting param coder (getParamCoder) type value ${JSON.stringify(type)} is either invalid or unsupported by ethjs-abi.`;

    while (type) {
        var part = type.match(paramTypePart); // eslint-disable-line
        if (!part) { throw new Error(invalidTypeErrorMessage); }
        type = type.substring(part[0].length);

        var prefix = (part[2] || part[4] || part[5]); // eslint-disable-line
        switch (prefix) {
            case 'int': case 'uint':
            if (coder) { throw new Error(invalidTypeErrorMessage); }
            var intSize = parseInt(part[3] || 256); // eslint-disable-line
            if (intSize === 0 || intSize > 256 || (intSize % 8) !== 0) {
                throw new Error(`[ethjs-abi] while getting param coder for type ${type}, invalid ${prefix}<N> width: ${type}`);
            }

            coder = randomNumber(intSize / 8, (prefix === 'int'));
            break;

            case 'bool':
                if (coder) { throw new Error(invalidTypeErrorMessage); }
                coder = randomBoolean();
                break;

            case 'string':
                if (coder) { throw new Error(invalidTypeErrorMessage); }
                coder = randomString();
                break;

            case 'bytes':
                if (coder) { throw new Error(invalidTypeErrorMessage); }
                if (part[3]) {
                    var size = parseInt(part[3]); // eslint-disable-line
                    if (size === 0 || size > 32) {
                        throw new Error(`[ethjs-abi] while getting param coder for prefix bytes, invalid type ${type}, size ${size} should be 0 or greater than 32`);
                    }
                    coder = coderFixedBytes(size);
                } else {
                    coder = randomDynamicBytes();
                }
                break;

            case 'address':
                if (coder) { throw new Error(invalidTypeErrorMessage); }
                coder = randomAddress();
                break;

            case '[]':
                if (!coder || coder.dynamic) { throw new Error(invalidTypeErrorMessage); }
                var defaultSize = get_random_num(0, 16);
                coder = [];
                for(var i = 0; i < defaultSize; i++)
                    coder[i] = randomType(coder);
                break;

            // "[0-9+]"
            default:
                if (!coder || coder.dynamic) { throw new Error(invalidTypeErrorMessage); }
                var defaultSize = parseInt(part[6]); // eslint-disable-line
                coder = [];
                for(var i = 0; i < defaultSize; i++)
                    coder[i] = randomType(coder);
        }
    }

    return coder;
}

function randomInput(inputTypes) {
    var parts = [];

    inputTypes.forEach(function(type, index) {
        var coder = randomType(type);
        parts.push(coder);
    });

    return parts;
}

webs.validateArgs = function validateArgs(inputTypes, args) {
    var inputArgs = args.filter(function (a) {
        // filter the options object but not arguments that are arrays
        return !( (utils.isObject(a) === true) &&
            (utils.isArray(a) === false) &&
            (utils.isBigNumber(a) === false)
        );
    });
    if (inputArgs.length !== inputTypes.length) {
        throw errors.InvalidNumberOfSolidityArgs();
    }
};

webs.random_data = function (abi, params) // [Min, Max)
{
    var inputTypes = abi.inputs.map(function (i) {
        return i.type;
    });

    if(params === undefined)
        params = randomInput(inputTypes);
    this.validateArgs(inputTypes, params);

    const signature = abi.name + '(' + inputTypes.join(',') + ')';
    var hash = sha3(signature).slice(0, 8);

    return '0x' + hash + coder.encodeParams(inputTypes, params);
}

webs.toPayload = function toPayload(tran) {
    var options = {};
    Object.keys(tran).forEach(function (f) {
        if(f != 'abi' && f != 'params' && f != 'events')
            options[f] = tran[f];
    });

    //logs.logvar(options);
    if(options.data === undefined){
        options.data = webs.random_data(tran.abi, tran.params);
    }

    return options;
};

webs.getReceipt = function(eth, txHash, callback){
    var timeout = 240000;
    var start = new Date().getTime();

    var getTransactionReceipt_UntilNotNull = function(txHash) {
        eth.getTransactionReceipt(txHash, function (err, receipt) {
            //console.log("txHash=",txHash)
            //console.log("err=",err)
            //console.log("receipt=",receipt)
            //logs.logvar(txHash, err, receipt);
            if (err) {
                callback(err);
            }

            if (receipt == null) {
                if (timeout > 0 && new Date().getTime() - start > timeout) {
                    callback(true, "timeout");
                    return;
                }

                setTimeout(function () {
                    getTransactionReceipt_UntilNotNull(txHash);
                }, 500);
            } else {
                callback(false, receipt);
            }
        })
    };

    getTransactionReceipt_UntilNotNull(txHash);
}

webs.unpackOutput = function (outputs, output) {
    if (!output) {
        return;
    }

    var outputTypes = outputs.map(function (i) {
        return i.type;
    });
    output = output.length >= 2 ? output.slice(2) : output;
    var result = coder.decodeParams(outputTypes, output);
    return result.length === 1 ? result[0] : result;
};

webs.decode_logs = function (tran, receipt) {
    if (tran.events === undefined) {
        logs.logvar(tran, receipt.logs);
        return receipt.logs;
    }

    var ret = [];

    for(var i = 0; i < receipt.logs.length; i++){
        ret[i] = receipt.logs[i];
        var topics = receipt.logs[i].topics[0];
        logs.logvar(topics);
        if(tran.events[topics] != undefined)
            ret[i].result = webs.unpackOutput(tran.events[topics].inputs, receipt.logs[i].data);
    }

    return ret;
};

function  eth_one(eth, tran, i, fun){
    try{
        var payload = webs.toPayload(tran);
        if(tran.abi.constant){
            var result = eth.call(payload);
            if (result && tran.abi === undefined) {
                result = webs.unpackOutput(tran.abi.outputs, result);
            }
            //logs.logvar(result);
            fun(i, {"err":false,"result":result});
        }else{
            eth.sendTransaction(payload, function(err, result){
                //logs.logvar(err, result);

                webs.getReceipt(eth, result, function(err, receipt){
                    //logs.logvar(indes, trans.length, err, receipt);
                    receipt.logs = webs.decode_logs(tran, receipt);
                    fun(i, {"err":false,"result":receipt});
                });
            });
        }
    }catch(err){
        fun(i, {"err":true,"result":err});
    }
}

webs.random_item = function (addr) // [Min, Max)
{
    //console.log('addr.length=', addr.length);
    if(0 == addr.length)
        return undefined;

    var rand = Math.floor(Math.random() * (addr.length));
    //console.log('rand=', rand, ",addr=", addr);
    return addr[rand];
}

webs.trans = function(rpc, trans, fun) {
    try{
        var provider = new HttpProvider(rpc);
        var request = new RequestManager(provider);
        var web = {"_requestManager":request,"currentProvider":rpc};
        var eth = new Eth(web);
        var personal = new Personal(web);
        //logs.logvar(personal.listAccounts);

        var ret = [];
        var count = 0;
        //var i = 3;
        for(var i = 0; i < trans.length; i++)
        {
            if(trans[i].from == undefined)
                trans[i].from = webs.random_item(personal.listAccounts);

            eth_one(eth, trans[i], i, function (index, result) {
                ret[index] = result;
                count++;
                //logs.logvar(count, index, trans.length);
                if(count >= trans.length)
                    fun(false, ret);
            });
        }

    }catch(err){
        //logs.logvar(err);
        fun(true, {err:true,result:err});
    }
}

function result_fun(result) {
    if(typeof(result) == "number")
        result = result.toString();
    if(result == null)
        result = "null";

    return result;
}

webs.call = function(args, callback) {
    var fun = args.fun;
    var arg = args.arg;
    var type = args.type;
    var rpc = args[".rpc"];

    try {
        var line;
        var result;
        var web3 = new Web3(new Web3.providers.HttpProvider(rpc));

        //logs.logvar(web3.eth.blockNumber);

        if(type == 'fun.sync') {
            line = 'web3.' + fun + '(' + arg + ', callback)';
            eval(line);
        }else if(type == 'fun'){
            line = 'web3.' + fun + '(' + arg + ')';
            result = eval(line);

            callback(false, result_fun(result));
        }else{
            line = 'result = web3.' + fun;
            //logs.log("line=", line);
            eval(line);

            callback(false, result_fun(result));
        }
    } catch (err) {
        callback(true, err);
    }

    callback(true, "no support");
};

if(typeof window!=="undefined")
    window.webs = webs
else
    module.exports = webs;

