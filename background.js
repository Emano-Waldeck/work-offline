/* globals webext */
'use strict';

var isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;

var offline = {
  observe: ({frameId, url}) => {
    if (frameId === 0) {
      const redirectUrl = chrome.runtime.getURL('/data/offline/index.html?rd=' + encodeURIComponent(url));

      if (isFirefox) {
        window.setTimeout(() => chrome.tabs.update({
          url: redirectUrl
        }), 0);
      }
      return {
        redirectUrl
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

// FAQs and Feedback
webext.runtime.on('start-up', () => {
  const {name, version, homepage_url} = webext.runtime.getManifest(); // eslint-disable-line camelcase
  const page = homepage_url; // eslint-disable-line camelcase
  // FAQs
  webext.storage.get({
    'version': null,
    'faqs': true,
    'last-update': 0,
  }).then(prefs => {
    if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
      const now = Date.now();
      const doUpdate = (now - prefs['last-update']) / 1000 / 60 / 60 / 24 > 30;
      webext.storage.set({
        version,
        'last-update': doUpdate ? Date.now() : prefs['last-update']
      }).then(() => {
        // do not display the FAQs page if last-update occurred less than 30 days ago.
        if (doUpdate) {
          const p = Boolean(prefs.version);
          webext.tabs.create({
            url: page + '?version=' + version +
              '&type=' + (p ? ('upgrade&p=' + prefs.version) : 'install'),
            active: p === false
          });
        }
      });
    }
  });
  // Feedback
  webext.runtime.setUninstallURL(
    page + '?rd=feedback&name=' + name + '&version=' + version
  );
});
