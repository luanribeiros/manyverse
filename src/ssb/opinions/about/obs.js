/* Copyright (C) 2018-2019 The Manyverse Authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import xs from 'xstream';
var pull = require('pull-stream');
var nest = require('depnest');
var ref = require('ssb-ref');
var blobIdToUrl = require('ssb-serve-blobs/id-to-url');
var colorHash = new (require('color-hash'))();

exports.needs = nest({
  'sbot.pull.aboutSocialValueStream': 'first',
  'about.sync.shortFeedId': 'first',
  'keys.sync.id': 'first',
});

exports.gives = nest({
  'about.obs': ['name', 'description', 'image', 'imageUrl', 'color'],
});

exports.create = function(api) {
  return nest({
    'about.obs': {
      name: id => socialValue$(id, 'name', api.about.sync.shortFeedId(id)),
      description: id => socialValue$(id, 'description'),
      image: id => socialValue$(id, 'image'),
      imageUrl: id =>
        socialValue$(id, 'image')
          .map(x => (!!x && typeof x === 'object' && x.link ? x.link : x))
          .map(blobId => (blobId ? blobIdToUrl(blobId) : null)),
      color: id => xs.of(colorHash.hex(id)).remember(),
    },
  });

  function socialValue$(id, key, defaultValue) {
    if (!ref.isLink(id)) throw new Error('About requires an ssb ref!');
    return xs.createWithMemory({
      start(listener) {
        listener.next(defaultValue);
        this.sink = pull.drain(listener.next.bind(listener));
        pull(api.sbot.pull.aboutSocialValueStream({key, dest: id}), this.sink);
      },
      stop() {
        if (this.sink) this.sink.abort(true);
      },
    });
  }
};
