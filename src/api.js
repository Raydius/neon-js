import axios from 'axios';
import { getAccountsFromWIFKey, transferTransaction, signatureData, addContract, claimTransaction, getPublicKeyEncoded, getAccountsFromPublicKey } from './wallet';
import { ledgerNanoS_PublicKey, createSignatureAsynch } from './ledgerNanoS';

export * from './wallet.js';
export * from './nep2.js';

export * from './utils.js';

// hard-code asset ids for NEO and GAS
export const neoId = "c56f33fc6ecfcd0c225c4ab356fee59390af8560be0e930faebe74a6daff7c9b";
export const gasId = "602c79718b16e442de58778e148d0b1084e3b2dffd5de6b7b16cee7969282de7";
export const allAssetIds = [neoId, gasId];

// switch between APIs for MainNet and TestNet
export const getAPIEndpoint = (net) => {
  if (net === "MainNet"){
    return "http://api.wallet.cityofzion.io";
  } else {
    return "http://testnet-api.wallet.cityofzion.io";
  }
};

// return the best performing (highest block + fastest) node RPC
export const getRPCEndpoint = (net) => {
  const apiEndpoint = getAPIEndpoint(net);
  return axios.get(apiEndpoint + '/v2/network/best_node').then((response) => {
      return response.data.node;
  });
};

// wrapper for querying node RPC
export const queryRPC = (net, method, params, id = 1) => {
  let jsonRequest = axios.create({
    headers: {"Content-Type": "application/json"}
  });
  const jsonRpcData = {"jsonrpc": "2.0", "method": method, "params": params, "id": id};
  return getRPCEndpoint(net).then((rpcEndpoint) => {
    return jsonRequest.post(rpcEndpoint, jsonRpcData).then((response) => {
      return response.data;
    });
  });
};

// get amounts of available (spent) and unavailable claims
export const getClaimAmounts = (net, address) => {
  const apiEndpoint = getAPIEndpoint(net);
  return axios.get(apiEndpoint + '/v2/address/claims/' + address).then((res) => {
    return {available: parseInt(res.data.total_claim), unavailable:parseInt(res.data.total_unspent_claim)};
  });
}



// get Neo and Gas balance for an account
export const getBalance = (net, address) => {
    const apiEndpoint = getAPIEndpoint(net);
    return axios.get(apiEndpoint + '/v2/address/balance/' + address)
      .then((res) => {
          const neo = res.data.NEO.balance;
          const gas = res.data.GAS.balance;
          return {Neo: neo, Gas: gas, unspent: {Neo: res.data.NEO.unspent, Gas: res.data.GAS.unspent}};
      })
};

// get transaction history for an account
export const getTransactionHistory = (net, address) => {
  const apiEndpoint = getAPIEndpoint(net);
  return axios.get(apiEndpoint + '/v2/address/history/' + address).then((response) => {
    return response.data.history;
  });
};

// get the current height of the light wallet DB
export const getWalletDBHeight = (net) => {
  const apiEndpoint = getAPIEndpoint(net);
  return axios.get(apiEndpoint + '/v2/block/height').then((response) => {
    return parseInt(response.data.block_height);
  });
}



export const doSendAsset = ( net, toAddress, fromWif, assetType, amount ) => {
    return new Promise( function( resolve, reject ) {
        process.stdout.write( "started doSendAsset \n" );
        let assetId, assetName, assetSymbol;
        if ( assetType === "Neo" ) {
            assetId = neoId;
        } else {
            assetId = gasId;
        }

        var fromAccount;
        if ( fromWif == undefined ) {
            const publicKey = ledgerNanoS_PublicKey;
            process.stdout.write( "interim doSendAsset publicKey \"" + publicKey+ "\" \n" );
            const publicKeyEncoded = getPublicKeyEncoded( publicKey );
            fromAccount = getAccountsFromPublicKey( publicKeyEncoded )[0];
        } else {
            fromAccount = getAccountsFromWIFKey( fromWif )[0];
        }
        process.stdout.write( "interim doSendAsset fromAccount \"" + JSON.stringify( fromAccount ) + "\" \n" );

        return getBalance( net, fromAccount.address ).then(( response ) => {
            process.stdout.write( "interim doSendAsset getBalance response \"" + JSON.stringify( response ) + "\" \n" );

            const coinsData = {
                "assetid": assetId,
                "list": response.unspent[assetType],
                "balance": response[assetType],
                "name": assetType
            }
            process.stdout.write( "interim doSendAsset transferTransaction coinsData \"" + JSON.stringify(coinsData) + "\"\n" );
            process.stdout.write( "interim doSendAsset transferTransaction fromAccount.publickeyEncoded \"" + fromAccount.publickeyEncoded + "\"\n" );
            process.stdout.write( "interim doSendAsset transferTransaction toAddress \"" + toAddress + "\"\n" );
            process.stdout.write( "interim doSendAsset transferTransaction amount \"" + amount + "\"\n" );

            var txData = transferTransaction( coinsData, fromAccount.publickeyEncoded, toAddress, amount );

            // helps with ledger unit tests where we want to sign a transaction.
            if(txData == null) {
                txData = "00000000000000000000000000";
            }
            
            process.stdout.write( "interim doSendAsset txData \"" + txData + "\" \n" );

            signAndAddContractAndSendTransaction( fromWif, net, txData, fromAccount ).then( function( response ) {
                resolve( response );
            } );
        } );
    } );
};

const signAndAddContractAndSendTransaction = function( fromWif, net, txData, account ) {
    return new Promise( function( resolve, reject ) {
        if ( fromWif == undefined ) {
            createSignatureAsynch( txData ).then( function( sign ) {
                process.stdout.write( "interim signAndAddContractAndSendTransaction sign Ledger \"" + sign + "\" \n" );
                addContractAndSendTransaction( net, txData, sign, account.publickeyEncoded ).then( function( response ) {
                    resolve( response );
                } );
            } );
        } else {
            let sign = signatureData( txData, account.privatekey );
            process.stdout.write( "interim signAndAddContractAndSendTransaction sign fromWif \"" + sign + "\" \n" );
            addContractAndSendTransaction( net, txData, sign, account.publickeyEncoded ).then( function( response ) {
                resolve( response );
            } );
        }
    } );
};

const addContractAndSendTransaction = function( net, txData, sign, publickeyEncoded ) {
    return new Promise( function( resolve, reject ) {
        process.stdout.write( "interim addContractAndSendTransaction txData \"" + txData + "\" \n" );
        process.stdout.write( "interim addContractAndSendTransaction sign \"" + sign + "\" \n" );
        const txRawData = addContract( txData, sign, publickeyEncoded );
        process.stdout.write( "interim addContractAndSendTransaction txRawData \"" + txRawData + "\" \n" );
        queryRPC( net, "sendrawtransaction", [txRawData], 4 ).then( function( response ) {
            process.stdout.write( "interim addContractAndSendTransaction response \"" + JSON.stringify( response ) + "\" \n" );
            resolve( response );
        } );
    } );
};


export const doClaimAllGas = ( net, fromWif ) => {
    return new Promise( function( resolve, reject ) {
        process.stdout.write( "started doClaimAllGas \n" );
        const apiEndpoint = getAPIEndpoint( net );

        var account;
        if ( fromWif == undefined ) {
            const publicKey = ledgerNanoS_PublicKey;
            process.stdout.write( "interim doSendAsset publicKey \"" + publicKey+ "\" \n" );
            const publicKeyEncoded = getPublicKeyEncoded( publicKey );
            account = getAccountsFromPublicKey( publicKeyEncoded )[0];
        } else {
            account = getAccountsFromWIFKey( fromWif )[0];
        }

        // TODO: when fully working replace this with mainnet/testnet switch
        return axios.get( apiEndpoint + "/v2/address/claims/" + account.address ).then(( response ) => {
            const claims = response.data["claims"];
            const total_claim = response.data["total_claim"];
            const txData = claimTransaction( claims, account.publickeyEncoded, account.address, total_claim );
            process.stdout.write( "interim doSendAsset txData \"" + txData + "\" \n" );

            signAndAddContractAndSendTransaction( fromWif, net, txData, account ).then( function( response ) {
                resolve( response );
            } );
        } );
    } );
}
