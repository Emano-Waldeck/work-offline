/* globals webext */
'use strict';

var offline = {
  observe: ({frameId, url}) => {
    if (frameId === 0) {
      return {
        redirectUrl: chrome.runtime.getURL('/data/offline/index.html?rd=' + encodeURIComponent(url))
      };
    }
    else {
      return {
        cancel: true
      };
    }
  }
};
offline.on = () => chrome.webRequest.onBeforeRequest.addListener(offline.observe, {
  urls: ['*://*/*']
}, ['blocking']);
offline.off = () => chrome.webRequest.onBeforeRequest.removeListener(offline.observe);

offline.on();

var reset = enabled => {
  offline[enabled ? 'on' : 'off']();

  webext.browserAction.setIcon({
    path: {
      '16': 'data/icons' + (enabled ? '' : '/disabled') + '/16.png',
      '32': 'data/icons' + (enabled ? '' : '/disabled') + '/32.png',
      '64': 'data/icons' + (enabled ? '' : '/disabled') + '/64.png'
    }
  });
  webext.browserAction.setTitle({
    title: 'Your browser is in ' + (enabled ? 'offline' : 'online') + ' mode'
  });
};

webext.storage.on('changed', ps => reset(ps.enabled.newValue)).if(ps => ps.enabled);
webext.storage.get({
  enabled: false
}).then(ps => reset(ps.enabled));

webext.browserAction.on('clicked', async() => {
  const enabled = (await webext.storage.get({
    enabled: false
  })).enabled === false;
  webext.storage.set({enabled});
});
