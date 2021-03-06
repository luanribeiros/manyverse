/* Copyright (C) 2018-2019 The Manyverse Authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import fs = require('fs');
const path = require('path');
const ssbKeys = require('ssb-keys');
const mkdirp = require('mkdirp');
const DHT = require('multiserver-dht');
const rnBridge = require('rn-bridge');
const rnChannelPlugin = require('multiserver-rn-channel');
const NoauthTransformPlugin = require('multiserver/plugins/noauth');
const npip = require('non-private-ip');
const injectSsbConfig = require('ssb-config/inject');
import syncingPlugin = require('./plugins/syncing');
import blobsFromPathPlugin = require('./plugins/blobsFromPath');
import manifest = require('./manifest');

const appDataDir = rnBridge.app.datadir();
const ssbPath = path.resolve(appDataDir, '.ssb');
if (!fs.existsSync(ssbPath)) {
  mkdirp.sync(ssbPath);
}
const keysPath = path.join(ssbPath, '/secret');
const keys = ssbKeys.loadOrCreateSync(keysPath);

const config = (() => {
  const c = injectSsbConfig();
  const NET_PORT = 26831;
  const DHT_PORT = 26832;
  const host = npip.private(); // Avoid (public) rmnet IP addresses
  c.path = ssbPath;
  c.keys = keys;
  c.manifest = manifest;
  c.friends.hops = 2;
  c.connections = {
    incoming: {
      net: [{scope: 'private', transform: 'shs', host, port: NET_PORT}],
      dht: [{scope: 'public', transform: 'shs', port: DHT_PORT}],
      channel: [{scope: 'device', transform: 'noauth'}],
    },
    outgoing: {
      net: [{transform: 'shs'}],
      dht: [{transform: 'shs'}],
    },
  };
  return c;
})();

function noAuthTransform(_sbot: any, cfg: any) {
  _sbot.multiserver.transform({
    name: 'noauth',
    create: () =>
      NoauthTransformPlugin({
        keys: {
          publicKey: Buffer.from(cfg.keys.public, 'base64'),
        },
      }),
  });
}

function rnChannelTransport(_sbot: any) {
  _sbot.multiserver.transport({
    name: 'channel',
    create: () => rnChannelPlugin(rnBridge.channel),
  });
}

function dhtTransport(_sbot: any) {
  _sbot.multiserver.transport({
    name: 'dht',
    create: (dhtConfig: any) =>
      DHT({keys: _sbot.dhtInvite.channels(), port: dhtConfig.port}),
  });
}

require('scuttlebot/index')
  .use(noAuthTransform)
  .use(rnChannelTransport)
  .use(require('ssb-dht-invite'))
  .use(dhtTransport)
  .use(require('scuttlebot/plugins/master'))
  .use(require('@staltz/sbot-gossip'))
  .use(require('scuttlebot/plugins/replicate'))
  .use(syncingPlugin)
  .use(require('ssb-backlinks'))
  .use(require('ssb-about'))
  .use(require('ssb-friends'))
  .use(require('ssb-blobs'))
  .use(blobsFromPathPlugin)
  .use(require('ssb-serve-blobs'))
  .use(require('ssb-private'))
  .use(require('ssb-contacts'))
  .use(require('ssb-query'))
  .use(require('ssb-threads'))
  .use(require('scuttlebot/plugins/invite'))
  .use(require('scuttlebot/plugins/local'))
  .use(require('ssb-ebt'))
  .call(null, config);
