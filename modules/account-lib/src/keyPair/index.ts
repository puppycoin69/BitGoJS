import * as coinModules from '..';
import { BaseKeyPair } from '../coin/baseCoin';
import { KeyPairOptions } from '../coin/baseCoin/iface';
import { coins } from '@bitgo/statics';
import { BuildTransactionError } from '../coin/baseCoin/errors';

export function register(coinName: string, source?: KeyPairOptions): BaseKeyPair {
  const sanitizedCoinName = coins.get(coinName.trim().toLowerCase()).family;
  const key = Object.keys(coinModules)
    .filter((k) => coinModules[k].KeyPair)
    // TODO(BG-40990): eth2 BLS keypair init error
    .find((k) => k.trim().toLowerCase() !== 'eth2' && k.trim().toLowerCase() === sanitizedCoinName);
  if (key) {
    return new coinModules[key].KeyPair(source);
  }
  throw new BuildTransactionError(`Coin ${coinName} not supported`);
}
