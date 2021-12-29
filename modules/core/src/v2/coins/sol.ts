/**
 * @prettier
 */

import BigNumber from 'bignumber.js';
import * as base58 from 'bs58';

import { BaseCoin as StaticsBaseCoin, CoinFamily, coins } from '@bitgo/statics';
import * as accountLib from '@bitgo/account-lib';
import {
  BaseCoin,
  KeyPair,
  ParsedTransaction as BaseParsedTransaction,
  ParseTransactionOptions as BaseParseTransactionOptions,
  SignedTransaction,
  TransactionExplanation,
  TransactionRecipient,
  VerifyAddressOptions,
  VerifyTransactionOptions,
  SignTransactionOptions,
  TransactionPrebuild as BaseTransactionPrebuild,
} from '../baseCoin';
import { BitGo } from '../../bitgo';
import { Memo } from '../wallet';
import * as _ from 'lodash';

export interface TransactionFee {
  fee: string;
}
export type SolTransactionExplanation = TransactionExplanation;

export interface ExplainTransactionOptions {
  txBase64: string;
  feeInfo: TransactionFee;
}

export interface TxInfo {
  recipients: TransactionRecipient[];
  from: string;
  txid: string;
}

export interface SolSignTransactionOptions extends SignTransactionOptions {
  txPrebuild: TransactionPrebuild;
  prv: string | string[];
  pubKeys?: string[];
}
export interface TransactionPrebuild extends BaseTransactionPrebuild {
  txBase64: string;
  txInfo: TxInfo;
  source: string;
}

export interface SolVerifyTransactionOptions extends VerifyTransactionOptions {
  memo?: Memo;
  feePayer?: string;
  blockhash?: string;
  durableNonce?: { walletNonceAddress: string; authWalletAddress: number };
}
interface TransactionOutput {
  address: string;
  amount: number | string;
}
type TransactionInput = TransactionOutput;

export interface SolParsedTransaction extends BaseParsedTransaction {
  // total assets being moved, including fees
  inputs: TransactionInput[];

  // where assets are moved to
  outputs: TransactionOutput[];
}

export interface SolParseTransactionOptions extends BaseParseTransactionOptions {
  txBase64: string;
  feeInfo: TransactionFee;
}

export class Sol extends BaseCoin {
  protected readonly _staticsCoin: Readonly<StaticsBaseCoin>;

  constructor(bitgo: BitGo, staticsCoin?: Readonly<StaticsBaseCoin>) {
    super(bitgo);

    if (!staticsCoin) {
      throw new Error('missing required constructor parameter staticsCoin');
    }

    this._staticsCoin = staticsCoin;
  }

  static createInstance(bitgo: BitGo, staticsCoin?: Readonly<StaticsBaseCoin>): BaseCoin {
    return new Sol(bitgo, staticsCoin);
  }

  getChain(): string {
    return this._staticsCoin.name;
  }
  getFamily(): CoinFamily {
    return this._staticsCoin.family;
  }
  getFullName(): string {
    return this._staticsCoin.fullName;
  }
  getBaseFactor(): string | number {
    return Math.pow(10, this._staticsCoin.decimalPlaces);
  }

  async verifyTransaction(params: SolVerifyTransactionOptions): Promise<any> {
    let totalAmount = 0;
    const coinConfig = coins.get(this.getChain());
    const {
      txParams: txParams,
      txPrebuild: txPrebuild,
      memo: memo,
      feePayer: feePayer,
      blockhash: blockhash,
      durableNonce: durableNonce,
    } = params;
    const transaction = new accountLib.Sol.Transaction(coinConfig);

    if (!txPrebuild.txBase64) {
      throw new Error('missing required tx prebuild property txBase64');
    }

    transaction.fromRawTransaction(txPrebuild.txBase64);
    const explainedTx = transaction.explainTransaction();

    if (!_.isEqual(explainedTx.outputs, txParams.recipients)) {
      throw new Error('Tx outputs does not match with expected txParams recipients');
    }

    const transactionJson = transaction.toJson();
    if (memo != explainedTx.memo) {
      throw new Error('Tx memo does not match with expected txParams recipient memo');
    }

    if (explainedTx.outputs.length != txParams.recipients?.length) {
      throw new Error('Tx outputs does not match with expected txParams recipient outputs');
    }
    for (const recipients of txParams.recipients) {
      totalAmount += new BigNumber(recipients.amount).toNumber();
    }

    if (totalAmount != new BigNumber(explainedTx.outputAmount).toNumber()) {
      throw new Error('Tx total amount does not match with expected total amount field');
    }

    if (transactionJson.feePayer != feePayer) {
      throw new Error('Tx fee payer does not match with txParams fee payer');
    }

    if (explainedTx.blockhash != blockhash) {
      throw new Error('Tx blockhash does not match with param blockhash');
    }

    if (!_.isEqual(explainedTx.durableNonce, durableNonce)) {
      throw new Error('Tx durableNonce does not match with param durableNonce');
    }

    return true;
  }

  verifyAddress(params: VerifyAddressOptions): boolean {
    return this.isValidAddress(params.address);
  }

  /**
   * Generate Solana key pair
   *
   * @param {Buffer} seed - Seed from which the new keypair should be generated, otherwise a random seed is used
   * @returns {Object} object with generated pub and prv
   */
  generateKeyPair(seed?: Buffer | undefined): KeyPair {
    const result = seed ? new accountLib.Sol.KeyPair({ seed }).getKeys() : new accountLib.Sol.KeyPair().getKeys();
    return result as KeyPair;
  }

  /**
   * Return boolean indicating whether input is valid public key for the coin
   *
   * @param {string} pub the prv to be checked
   * @returns is it valid?
   */
  isValidPub(pub: string): boolean {
    return accountLib.Sol.Utils.isValidPublicKey(pub);
  }

  /**
   * Return boolean indicating whether input is valid private key for the coin
   *
   * @param {string} prv the prv to be checked
   * @returns is it valid?
   */
  isValidPrv(prv: string): boolean {
    return accountLib.Sol.Utils.isValidPrivateKey(prv);
  }

  isValidAddress(address: string): boolean {
    return accountLib.Sol.Utils.isValidAddress(address);
  }

  async signMessage(key: KeyPair, message: string | Buffer): Promise<Buffer> {
    const solKeypair = new accountLib.Sol.KeyPair({ prv: key.prv });
    if (Buffer.isBuffer(message)) {
      message = base58.encode(message);
    }

    return Buffer.from(solKeypair.signMessage(message));
  }

  /**
   * Signs Solana transaction
   * @param params
   * @param callback
   */
  async signTransaction(params: SolSignTransactionOptions): Promise<SignedTransaction> {
    const factory = accountLib.register(this.getChain(), accountLib.Sol.TransactionBuilderFactory);
    const txBuilder = factory.from(params.txPrebuild.txBase64);
    txBuilder.sign({ key: params.prv });
    const transaction: accountLib.BaseCoin.BaseTransaction = await txBuilder.build();

    if (!transaction) {
      throw new Error('Invalid transaction');
    }

    return {
      txBase64: (transaction as accountLib.BaseCoin.BaseTransaction).toBroadcastFormat(),
    } as any;
  }

  async parseTransaction(params: SolParseTransactionOptions): Promise<SolParsedTransaction> {
    const transactionExplanation = await this.explainTransaction({
      txBase64: params.txBase64,
      feeInfo: params.feeInfo,
    });

    if (!transactionExplanation) {
      throw new Error('Invalid transaction');
    }

    const solTransaction = transactionExplanation as SolTransactionExplanation;
    if (solTransaction.outputs.length <= 0) {
      return {
        inputs: [],
        outputs: [],
      };
    }

    const senderAddress = solTransaction.outputs[0].address;
    const feeAmount = new BigNumber(solTransaction.fee.fee);

    // assume 1 sender, who is also the fee payer
    const inputs = [
      {
        address: senderAddress,
        amount: new BigNumber(solTransaction.outputAmount).plus(feeAmount).toNumber(),
      },
    ];

    const outputs: TransactionOutput[] = solTransaction.outputs.map((output) => {
      return {
        address: output.address,
        amount: output.amount,
      };
    });

    return {
      inputs,
      outputs,
    };
  }

  /**
   * Explain a Solana transaction from txBase64
   * @param params
   */
  async explainTransaction(params: ExplainTransactionOptions): Promise<SolTransactionExplanation> {
    const factory = accountLib.register(this.getChain(), accountLib.Sol.TransactionBuilderFactory);
    let rebuiltTransaction;

    try {
      rebuiltTransaction = await factory.from(params.txBase64).fee({ amount: params.feeInfo.fee }).build();
    } catch {
      throw new Error('Invalid transaction');
    }

    const explainedTransaction = (rebuiltTransaction as accountLib.BaseCoin.BaseTransaction).explainTransaction();

    return explainedTransaction as SolTransactionExplanation;
  }
}
