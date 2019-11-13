/**
 * Resend the invitation email for sharing a BitGo wallet
 *
 * Copyright 2019, BitGo, Inc.  All Rights Reserved.
 */

const Promise = require('bluebird');
const BitGoJS = require('../../src');
const bitgo = new BitGoJS.BitGo({ env: 'test' });

// TODO: set your access token here
const accessToken = null;

// TODO: set your wallet share ID here
// you can get this using the listShares() convienence method
const walletShareId = null;

const coin = 'tltc';

Promise.coroutine(function *() {
  bitgo.authenticateWithAccessToken({ accessToken });

  const shareResult = yield bitgo.coin(coin).wallets().resendShareInvite({ walletShareId });

  console.log('Share invite resent successfully');
  console.dir(shareResult);
})();