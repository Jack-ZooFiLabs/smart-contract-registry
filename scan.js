'use strict';

const fs = require('fs');

const idToChain = { 43114: 'avalanche' };
const chainToExplorers = { 'avalanche': ['https://cchain.explorer.avax.network/address/', 'https://avascan.info/blockchain/c/address/'] }

// console.assert does not fail the program.
function assert(expr, msg) {
  if (!expr) {
    throw new Error('AssertionError: ' + msg);
  }
}

function readFileAsJson(file) {
  return JSON.parse(fs.readFileSync(file));
}

function readFileAsString(file) {
  return fs.readFileSync(file).toString();
}

function toChain(path) {
  let id = readFileAsString(path + '.chainId');
  let chain = idToChain[id];
  assert(chain != null, `ChainId ${id} not found`);
  console.log(`ChainId ${id} => Chain ${chain}`);
  return chain;
}

function fileToSmartContract(chain, path, file) {
  console.log('Looking at file: ', file);
  let json = readFileAsJson(path + file);
  let address = json.address;

  // suffix: _vN.json
  let version = 'v' + (file.match(/_v(\d)\.json/) || [,'1'])[1];

  // remove suffix from file name
  let name = file.replace(/(_v\d)?\.json/, '');
  let parts = name.split('-');
  let type = path.includes('governance-contracts') ? 'governance' : 'core';

  // Check if last part is a version. If so, consume it.
  let maybeVersion = +parseInt(parts[parts.length-1]);
  if (maybeVersion > 0) {
    version = 'v' + maybeVersion;
    parts = parts.slice(0, -1);
  }
  switch (parts.length) {
    case 1: {
      if (path.includes('smart-contracts') && name.endsWith('Helper')) { // Helper files: BalanceOfHelper, StrategyHelper, PairHelper, etc.
        return toSmartContract(chain, name, address, version, type, 'Helper files');
      } else if (path.includes('farm-contracts') && name.startsWith("MiniYak")) { // yield-yak/farm-contracts
        return toSmartContract(chain, 'MiniYak Token', address, version, type, 'A mYak is one-million-th Yak');
      } else if (path.includes ('governance-contracts')) {
        if (name.startsWith("YakToken")) {
          return toSmartContract(chain, 'Yak Token', address, version, type, 'Governance token for yield yak');
        } else {
          return toSmartContract(chain, name, address, version, type, 'Governance contracts for yield yak');
        }
      } else {
        assert(false, "Unknown file: " + file);
      }
    }
    case 2: {
      // special file: Timelock-vN
      if (name.startsWith("Timelock-V")) {
        let [ timelock , v ] = parts;
        return toSmartContract(chain, 'Timelock', address, v.toLowerCase(), type, 'Time lock contract');
      }

      // format: PLATFORM-TOKEN
      let [ platform, token ] = parts;
      let description = `${platform} farm for compounding ${token}`;
      return toSmartContract(chain, name, address, version, type, description);
    }
    case 3: {
      // format: PLATFORM-TOKENA-TOKENB
      let [ platform, tokenA, tokenB ] = parts;
      let description = `${platform} farm for ${tokenA}-${tokenB} LP`;
      return toSmartContract(chain, name, address, version, type, description);
    }
    case 4: {
      // format for LP farm: PLATFORM-LP-A-B
      let [ platform, lp, tokenA, tokenB ] = parts;
      let description = `${platform} farm for ${tokenA}-${tokenB} LP`;
      return toSmartContract(chain, name, address, version, type, description);
    }
    case 5: {
      // format for voting power formula: Formula-YRT-GDL-mYAK-YAK.json
      assert(type == 'governance', 'Unknown file pattern:' + file);
      let [ prefix, token, platform, tokenA, tokenB ] = parts;
      return toSmartContract(chain, name, address, version, type, 'Voting power formula for yield yak');
    }
    default: {
      assert(false, 'Unknown file pattern: ' + file);
    }
  }
}

function toSmartContract(chain, name, address, version, type, description) {
  return {
    name,
    address,
    chain,
    version,
    type,
    description,
    explorers: chainToExplorers[chain].map(el => el + address.toLowerCase()),
  };
}

function processDir(dir) {
  let path = dir + 'deployments/mainnet/';
  console.log('Reading path: ', path);

  let chain = toChain(path);
  let jsonFiles = fs.readdirSync(path).filter(f => f.endsWith('.json'));
  let smartContracts = jsonFiles.map(el => fileToSmartContract(chain, path, el));
  return smartContracts;
}

function main() {
  let args = process.argv.slice(2);
  console.log('argv: ', args);
  assert(args.length >= 1, 'args not provided');

  // collect all smart contracts from each dir
  let smartContracts = args.flatMap(processDir);
  // pretty print json to output file.
  fs.writeFileSync('output.json', JSON.stringify(smartContracts, null, 2) + '\n\n');
}

main();
