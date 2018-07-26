/* globals webext */
'use strict';

var isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
var mode = 'per-tab'; // global or per-tab
var tabs = {}; // index of offline tabs

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'remove.tab') {
    delete tabs[sender.tab.id];
    reset().then(response);
    return true;
  }
});

var offline = {
  observe: ({frameId, tabId, url}) => {
    // per-tab mode
    if (mode === 'per-tab' && tabs[tabId] !== true) {
      return;
    }
    if (frameId === 0) {
      const redirectUrl = chrome.runtime.getURL(
        `/data/offline/index.html?id=${tabId}&rd=${encodeURIComponent(url)}&mode=${tabs[tabId] ? 'per-tab' : mode}`
      );

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
offline.install = () => chrome.webRequest.onBeforeRequest.addListener(offline.observe, {
  urls: ['*://*/*']
}, ['blocking']);
offline.on = (m = 'global') => {
  mode = m;
  offline.install();
};
offline.off = () => {
  mode = 'per-tab';
  // only disable the observer if there is no tab left in the tabs object
  if (Object.keys(tabs).length === 0) {
    chrome.webRequest.onBeforeRequest.removeListener(offline.observe);
  }
  else {
    offline.install();
  }
};

var path = (enabled, extra = {}) => Object.assign({
  path: {
    '16': 'data/icons' + (enabled ? '' : '/disabled') + '/16.png',
    '32': 'data/icons' + (enabled ? '' : '/disabled') + '/32.png',
    '64': 'data/icons' + (enabled ? '' : '/disabled') + '/64.png'
  }
}, extra);

var reset = async enabled => {
  if (enabled === undefined) {
    enabled = (await webext.storage.get({
      enabled: false
    })).enabled;
  }
  offline[enabled ? 'on' : 'off']();

  webext.browserAction.setIcon(path(enabled));
  const title = enabled ? 'Your browser is in offline mode' : `Your browser is in online mode
  
 Use page's context menu to toggle offline mode for one or more tabs`;
  webext.browserAction.setTitle({title});
};
// start up
reset();
webext.storage.on('changed', ps => reset(ps.enabled.newValue)).if(ps => ps.enabled);

webext.browserAction.on('clicked', async() => {
  const enabled = (await webext.storage.get({
    enabled: false
  })).enabled === false;
  webext.storage.set({enabled});
});

// Page context menu
chrome.contextMenus.create({
  id: 'toggle.offline',
  title: 'Toggle offline mode for this tab',
  contexts: ['PAGE', 'TABS'].map(key => chrome.contextMenus.ContextType[key]).filter(s => s)
});
webext.contextMenus.on('clicked', async(info, tab) => {
  if (tabs[tab.id]) {
    delete tabs[tab.id];
  }
  else {
    tabs[tab.id] = true;
  }
  webext.browserAction.setIcon(path(tabs[tab.id], {
    tabId: tab.id
  }));
  reset();
}).if(info => info.menuItemId === 'toggle.offline');

// change toolbar icon if tab gets refreshed in per-tab mode
webext.tabs.on('updated', tabId => webext.browserAction.setIcon(path(true, {
  tabId
}))).if(tabId => tabs[tabId]);

// restore
if (localStorage.length) {
  const arr = [];
  let msg = 'The following tabs were on offline mode before the restart:\n\n';
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    const url = localStorage.getItem(key);
    msg += '\n' + url;
    localStorage.removeItem(key);
    arr.push(url);
  }
  if(window.confirm(msg + '\n\n Press OK to restore them')) {
    arr.forEach(url => chrome.tabs.create({url}));
  }
}

// FAQs and Feedback
webext.runtime.on('start-up', () => {
  const {name, version, homepage_url} = webext.runtime.getManifest(); // eslint-disable-line camelcase
  const page = homepage_url; // eslint-disable-line camelcase
  // FAQs
  webext.storage.get({
    'version': null,
    'faqs': true,
    'last-update': 0
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
  chrome.runtime.setUninstallURL(
    page + '?rd=feedback&name=' + name + '&version=' + version
  );
});
