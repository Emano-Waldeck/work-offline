/* globals webext */
'use strict';

const notify = e => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.runtime.getManifest().name,
  message: e.message || e
});

const prefs = {
  enabled: false
};
// start up
webext.storage.get(prefs).then(ps => {
  Object.assign(prefs, ps);
  if (prefs.enabled) {
    reset();
    offline.on();
  }
});
webext.storage.on('changed', ps => {
  Object.keys(ps).forEach(key => prefs[key] = ps[key].newValue);
  if (ps.enabled) {
    reset();
    offline[prefs.enabled ? 'on' : 'off']();
  }
});

const isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
const tabs = {}; // index of offline tabs

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'remove.tab') {
    delete tabs[sender.tab.id];
    if (Object.keys(tabs).length === 0) {
      offline.off();
    }
    window.setTimeout(response);
    return true;
  }
});

const events = {
  online(id) {
    webext.tabs.executeScript(id, {
      runAt: 'document_start',
      allFrames: true,
      file: '/data/inject/online.js'
    }, () => chrome.runtime.lastError);
  },
  offline(id) {
    webext.tabs.executeScript(id, {
      runAt: 'document_start',
      allFrames: true,
      file: '/data/inject/offline.js'
    }, () => chrome.runtime.lastError);
  }
};

const offline = {
  observe: ({frameId, tabId, url, type}) => {
    // per-tab mode
    if (prefs.enabled === false && tabs[tabId] !== true) {
      return;
    }
    if (type === 'main_frame' && url.startsWith('http')) {
      const redirectUrl = chrome.runtime.getURL(
        `/data/offline/index.html?id=${tabId}&rd=${encodeURIComponent(url)}&mode=${tabs[tabId] ? 'per-tab' : (prefs.enabled ? 'global' : 'per-tab')}`
      );
      if (isFirefox) {
        window.setTimeout(() => chrome.tabs.update({
          url: redirectUrl
        }), 10);
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
offline.install = () => {
  chrome.webRequest.onBeforeRequest.removeListener(offline.observe);
  chrome.webRequest.onBeforeRequest.addListener(offline.observe, {
    urls: ['*://*/*', 'ws://*/*', 'wss://*/*']
  }, ['blocking']);
};
offline.on = () => offline.install();
offline.off = () => {
  // only disable the observer if there is no tab left in the tabs object
  if (Object.keys(tabs).length === 0) {
    chrome.webRequest.onBeforeRequest.removeListener(offline.observe);
  }
  else {
    offline.install();
  }
};

const path = (enabled, extra = {}) => Object.assign({
  path: {
    '16': 'data/icons' + (enabled ? '' : '/disabled') + '/16.png',
    '32': 'data/icons' + (enabled ? '' : '/disabled') + '/32.png',
    '64': 'data/icons' + (enabled ? '' : '/disabled') + '/64.png'
  }
}, extra);

const reset = async () => {
  let ts = await webext.tabs.query({});
  if (prefs.enabled === false) {
    ts = ts.filter(t => tabs[t.id] !== true);
  }
  const icon = path(prefs.enabled);
  webext.browserAction.setIcon(icon);
  ts.forEach(t => webext.browserAction.setIcon(Object.assign({
    tabId: t.id
  }, icon)));
  const title = prefs.enabled ? 'Your browser is in offline mode' : `Your browser is in online mode

 Use page's context menu to toggle offline mode for one or more tabs`;
  webext.browserAction.setTitle({title});

  let enabled = prefs.enabled;
  if (enabled === false && navigator.onLine === false) {
    enabled = true;
  }
  const c = events[enabled ? 'offline' : 'online'];
  ts.forEach(t => c(t.id));
};
window.addEventListener('online', () => {
  if (prefs.enabled === false) {
    events.online();
  }
});
window.addEventListener('offline', () => {
  events.offline();
});


webext.browserAction.on('clicked', () => {
  webext.storage.set({
    enabled: prefs.enabled === false
  });
});

// Page context menu
chrome.contextMenus.create({
  id: 'toggle.offline',
  title: 'Toggle offline mode for this tab',
  contexts: ['PAGE', 'TABS', 'BROWSER_ACTION'].map(key => chrome.contextMenus.ContextType[key]).filter(s => s)
});
webext.contextMenus.on('clicked', async (info, tab) => {
  if (tabs[tab.id]) {
    delete tabs[tab.id];
    if (Object.keys(tabs).length === 0) {
      offline.off();
    }
  }
  else {
    tabs[tab.id] = true;
    offline.on();
  }
  // change icon only if there is no global mode
  if (prefs.enabled === false) {
    if (tabs[tab.id]) {
      events.offline(tab.id);
    }
    else {
      if (navigator.onLine === true) {
        events.online(tab.id);
      }
    }
    webext.browserAction.setIcon(path(tabs[tab.id], {
      tabId: tab.id
    }));
  }
  else {
    if (tabs[tab.id]) {
      notify('Your browser is currently in offline mode. This tab remains in offline mode even after the browser switched to online mode');
    }
    else {
      notify('Your browser is currently in offline mode. This tab will switch to online mode when the global offline mode is disabled');
    }
  }
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
  if (window.confirm(msg + '\n\n Press OK to restore them')) {
    arr.forEach(url => chrome.tabs.create({url}));
  }
}

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install'
            });
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
