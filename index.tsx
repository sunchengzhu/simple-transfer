import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Script } from '@ckb-lumos/lumos';
import { capacityOf, generateAccountFromPrivateKey, getTx, transfer } from './lib';
import { indexer } from './ckb';
import { decamelizeKeys } from 'humps';

const app = document.getElementById('root');
ReactDOM.render(<App/>, app);

export function App() {
  // default value: first account privkey from offckb
  const [privKey, setPrivKey] = useState('0x022368a3063844b597cc3ddeeedacb1cc02f72722a0a249b6b7d1a4ccb00f482');
  const [fromAddr, setFromAddr] = useState('');
  const [fromLock, setFromLock] = useState<Script>();
  const [balance, setBalance] = useState('0');

  // default value: second account address from offckb
  const [toAddr, setToAddr] = useState('ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2l4enwahgpapweu36m7wxczsayhhqqa7gyujjcf');
  // default value: 62 CKB
  const [amount, setAmount] = useState('6200000000');

  const [isTransferring, setIsTransferring] = useState(false);
  const [tx, setTx] = useState(null);
  const [txInfo, setTxInfo] = useState<string>();
  const [txHash, setTxHash] = useState<string>();

  useEffect(() => {
    if (privKey) {
      updateFromInfo();
    }
  }, [privKey]);

  const updateFromInfo = async () => {
    const {lockScript, address} = generateAccountFromPrivateKey(privKey);
    const capacity = await capacityOf(address);
    setFromAddr(address);
    setFromLock(lockScript);
    setBalance(capacity.toString());
  };

  const onInputPrivKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Regular expression to match a valid private key with "0x" prefix
    const priv = e.target.value;
    const privateKeyRegex = /^0x[0-9a-fA-F]{64}$/;

    const isValid = privateKeyRegex.test(priv);
    if (isValid) {
      setPrivKey(priv);
    } else {
      alert(
        `Invalid private key: must start with 0x and 32 bytes length. Ensure you're using a valid private key from the offckb accounts list.`,
      );
    }
  };

  const onGetTxParams = async () => {
    const newTx = await getTx({amount, from: fromAddr, to: toAddr, privKey}).catch(alert);
    if (newTx) {
      setTx(newTx);
      const snakeCaseNewTx = decamelizeKeys(newTx);
      snakeCaseNewTx.cell_deps.forEach(dep => {
        dep.dep_type = 'dep_group';
      });
      setTxInfo(JSON.stringify(snakeCaseNewTx, null, 2));
      await updateFromInfo();
    }
  }
  const onTransfer = async () => {
    setIsTransferring(true);
    const txHash = await transfer(tx).catch(alert);

    // We can wait for this txHash to be on-chain so that we can trigger the UI/UX updates including balance.
    if (txHash) {
      setTxHash(txHash);
      // Note: indexer.waitForSync has a bug, we use negative number to workaround.
      // the negative number presents the block difference from current tip to wait
      await indexer.waitForSync(-1);
      await updateFromInfo();
    }

    setIsTransferring(false);
  }

  const enabled = +amount > 6100000000 && +balance > +amount && toAddr.length > 0 && !isTransferring;
  const amountTip =
    amount.length > 0 && +amount < 6100000000 ? (
      <span>
        amount must larger than 6,100,000,000(61 CKB), see{' '}
        <a href="https://docs.nervos.org/docs/wallets/#requirements-for-ckb-transfers">why</a>
      </span>
    ) : null;

  return (
    <div>
      <h1>View and Transfer Balance</h1>
      <label htmlFor="private-key">Private Key: </label>&nbsp;
      <input id="private-key" type="text" value={privKey} onChange={onInputPrivKey} style={{width: '480px'}}/>
      <ul>
        <li>CKB Address: {fromAddr}</li>
        <li>
          Current lock script:
          <pre>{JSON.stringify(fromLock, null, 2)}</pre>
        </li>

        <li>Total capacity: {(+balance).toLocaleString()}</li>
      </ul>
      <label htmlFor="to-address">Transfer to Address: </label>&nbsp;
      <input id="to-address" type="text" value={toAddr} onChange={(e) => setToAddr(e.target.value)}
             style={{width: '650px'}}/>
      <br/>
      <label htmlFor="amount">Amount</label>
      &nbsp;
      <input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)}/>
      <small>Tx fee: 100,000 (0.001 CKB)</small>
      <br/>
      <small style={{color: 'red'}}>{amountTip}</small>
      <br/>
      <br/>
      <button
        disabled={!enabled}
        onClick={onGetTxParams}
      >
        GetTxParams
      </button>
      {txInfo && <div>{txInfo}</div>}
      <br/>
      <button
        disabled={!enabled}
        onClick={onTransfer}
      >
        Transfer
      </button>
      {txHash && <div>tx hash: {txHash}</div>}
    </div>
  );
}
