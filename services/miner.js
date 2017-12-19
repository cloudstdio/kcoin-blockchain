const Promise = require('bluebird');
const _ = require('lodash');

module.exports = exports = ({ blocks, transactions, utils }) => {
  let generateBlock = async function (previousBlockHash, message, outputs, transactionList) {
    console.log('Started to generate new block...');
    let block = {};
    block.version = 1;
    block.previousBlockHash = previousBlockHash;
    // Create coinbase transaction
    block.transactions = transactionList;
    block.timestamp = Math.floor(Date.now() / 1000);
    block.difficulty = blocks.FIXED_DIFFICULTY;
    block.transactions.unshift({
      version: 1,
      inputs: [
        {
          referencedOutputHash: '0'.repeat(32),
          referencedOutputIndex: -1,
          unlockScript: message
        }
      ],
      outputs: outputs
    });
    block.transactionsHash = utils.hash(blocks.getTransactionsBinary(block)).toString('hex');
    // Loop to find nonce 
    block.nonce = 0;
    for (;;) {
      block.hash = blocks.calculateHash(block).toString('hex');

      let prefix = '0'.repeat(block.difficulty);
      if (block.hash.toString('hex').indexOf(prefix) !== 0) {
        block.nonce++;
      } else {
        break;
      }
      
      // Delay 0.01 second for other thing to run
      await Promise.delay(10);
    }
    console.log('Generated block ' + block.hash + ' with nonce:', block.nonce, ' - hash:', block.hash);
    return block;
  };

  // Auto run miner
  let run = async function () {
    // Try to get all unconfirm transactions
    let unconfirmedTransactions = await transactions.findUnconfirmed();
    // Calculate fee
    let totalFee = _.sumBy(unconfirmedTransactions, 'fee');
    // Get latest block
    let latestBlock = await blocks.findLatest();
    if (latestBlock) {
      // Get default lock script from genesis block
      let genesisBlock = await blocks.findGenesis();
      // Put into block
      let block = await generateBlock(latestBlock.hash, 'DATETIME ' + new Date().toString(), [
        {
          value: blocks.FIXED_REWARD + totalFee,
          lockScript: genesisBlock.cache.transactions[0].outputs[0].lockScript
        }
      ], unconfirmedTransactions.map(t => t.cache));
      await blocks.add(block);
    }
    await Promise.delay(100);
    // Wait for 1 minutes
    await run();
  };

  run();

  return { generateBlock };
};