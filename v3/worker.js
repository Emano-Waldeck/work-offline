const state = () => chrome.storage.local.get({
  'mode': 'online',
  'tab-only': true
}, async prefs => {
  if (prefs.mode === 'online') {
    chrome.action.setIcon({
      path: {
        '16': 'data/icons/disabled/16.png',
        '32': 'data/icons/disabled/32.png',
        '48': 'data/icons/disabled/48.png'
      }
    });
    chrome.action.setTitle({
      title: `Your browser is in online mode

 Use page's context menu to toggle offline mode for one or more tabs`
    });
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [1, 2]
    });
    // dispatch online event
    const tabs = await chrome.tabs.query({});
    const ptids = (await chrome.declarativeNetRequest.getSessionRules())
      .map(r => r.condition?.tabIds).flat();
    for (const tab of tabs) {
      if (ptids.indexOf(tab.id) === -1) {
        chrome.scripting.executeScript({
          target: {
            tabId: tab.id,
            allFrames: true
          },
          files: ['data/inject/online.js']
        }).catch(() => {});
      }
    }
    // release
    const [tab] = await chrome.tabs.query({
      currentWindow: true,
      active: true
    });
    chrome.tabs.sendMessage(tab.id, {
      method: 'release'
    }, () => chrome.runtime.lastError);
  }
  else {
    chrome.action.setIcon({
      path: {
        '16': 'data/icons/16.png',
        '32': 'data/icons/32.png',
        '48': 'data/icons/48.png'
      }
    });
    chrome.action.setTitle({
      title: 'Your browser is in offline mode'
    });
    const ids = [];
    if (prefs['tab-only']) {
      ids.push(chrome.tabs.TAB_ID_NONE);
    }

    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: [{
        'id': 1,
        'action': {'type': 'block'},
        'condition': {
          'excludedResourceTypes': ['main_frame'],
          'excludedTabIds': ids
        }
      }, {
        'id': 2,
        'action': {
          'type': 'redirect',
          'redirect': {
            'regexSubstitution': chrome.runtime.getURL('/data/offline/index.html') + '?rd=\\0'
          }
        },
        'condition': {
          'regexFilter': '^http',
          'resourceTypes': ['main_frame'],
          'excludedTabIds': ids
        }
      }],
      removeRuleIds: [1, 2]
    });
    // dispatch online event
    const tabs = await chrome.tabs.query({});
    const ptids = (await chrome.declarativeNetRequest.getSessionRules())
      .map(r => r.condition?.tabIds).flat();
    for (const tab of tabs) {
      if (ptids.indexOf(tab.id) === -1) {
        chrome.scripting.executeScript({
          target: {
            tabId: tab.id,
            allFrames: true
          },
          files: ['data/inject/offline.js']
        }).catch(() => {});
      }
    }
  }
});
chrome.storage.onChanged.addListener(ps => (ps.mode || ps['tab-only']) && state());
chrome.runtime.onInstalled.addListener(state);
chrome.runtime.onStartup.addListener(state);

chrome.action.onClicked.addListener(() => chrome.storage.local.get({
  mode: 'online'
}, prefs => {
  if (prefs.mode === 'online') {
    prefs.mode = 'offline';
  }
  else {
    prefs.mode = 'online';
  }
  chrome.storage.local.set(prefs);
}));

const onMessage = (request, sender) => {
  if (request.method === 'tab_go_offline') {
    chrome.declarativeNetRequest.getSessionRules().then(async rules => {
      const removeRuleIds = rules.filter(r => r.id > 2 && r.condition.tabIds.indexOf(sender.tab.id) !== -1)
        .map(o => o.id);
      rules = rules.filter(r => (r.condition.tabIds || []).indexOf(sender.tab.id) === -1);

      const ids = rules.map(o => o.id);
      const newIds = [];
      for (let j = 3; ; j += 1) {
        if (ids.indexOf(j) === -1) {
          newIds.push(j);
        }
        if (newIds.length === 2) {
          break;
        }
      }
      chrome.action.setIcon({
        tabId: sender.tab.id,
        path: {
          '16': 'data/icons/tab/16.png',
          '32': 'data/icons/tab/32.png',
          '48': 'data/icons/tab/48.png'
        }
      });
      chrome.action.setTitle({
        tabId: sender.tab.id,
        title: 'This tab is offline'
      });
      await chrome.declarativeNetRequest.updateSessionRules({
        addRules: [{
          'id': newIds[0],
          'action': {'type': 'block'},
          'condition': {
            'tabIds': [sender.tab.id],
            'excludedResourceTypes': ['main_frame']
          }
        }, {
          'id': newIds[1],
          'action': {
            'type': 'redirect',
            'redirect': {
              'regexSubstitution': chrome.runtime.getURL('/data/offline/index.html') + '?mode=per-tab&rd=\\0'
            }
          },
          'condition': {
            'tabIds': [sender.tab.id],
            'regexFilter': '^http',
            'resourceTypes': ['main_frame']
          }
        }],
        removeRuleIds
      });
      chrome.scripting.executeScript({
        target: {
          tabId: sender.tab.id,
          allFrames: true
        },
        files: ['data/inject/offline.js']
      }).catch(() => {});
    });
  }
  else if (request.method === 'tab_go_online') {
    chrome.declarativeNetRequest.getSessionRules().then(rules => {
      const removeRuleIds = rules.filter(r => r.id > 2 && r.condition.tabIds.indexOf(sender.tab.id) !== -1)
        .map(o => o.id);
      chrome.storage.local.get({
        mode: 'online'
      }, async prefs => {
        const addRules = [];
        if (prefs.mode === 'offline') {
          rules = rules.filter(r => (r.condition.tabIds || []).indexOf(sender.tab.id) === -1);
          const ids = rules.map(o => o.id);
          for (let j = 3; ; j += 1) {
            if (ids.indexOf(j) === -1) {
              addRules.push({
                'id': j,
                'priority': 2,
                'action': {'type': 'allowAllRequests'},
                'condition': {
                  'tabIds': [sender.tab.id],
                  'resourceTypes': ['main_frame', 'sub_frame']
                }
              });
              break;
            }
          }
        }
        chrome.action.setIcon({
          tabId: sender.tab.id,
          path: {
            '16': 'data/icons/disabled/16.png',
            '32': 'data/icons/disabled/32.png',
            '48': 'data/icons/disabled/48.png'
          }
        });
        chrome.action.setTitle({
          tabId: sender.tab.id,
          title: 'This tab is online'
        });
        await chrome.declarativeNetRequest.updateSessionRules({
          addRules,
          removeRuleIds
        }).then(() => chrome.tabs.sendMessage(sender.tab.id, {
          method: 'release'
        }));
        if (prefs.mode === 'online') {
          chrome.scripting.executeScript({
            target: {
              tabId: sender.tab.id,
              allFrames: true
            },
            files: ['data/inject/online.js']
          }).catch(() => {});
        }
      });
    });
  }
  else if (request.method === 'change_icon_per_tab') {
    chrome.action.setIcon({
      tabId: sender.tab.id,
      path: {
        '16': 'data/icons/tab/16.png',
        '32': 'data/icons/tab/32.png',
        '48': 'data/icons/tab/48.png'
      }
    });
    chrome.action.setTitle({
      tabId: sender.tab.id,
      title: 'This tab is offline'
    });
  }
};
chrome.runtime.onMessage.addListener(onMessage);

// context menu
const once = () => chrome.storage.local.get({
  'tab-only': true
}, prefs => {
  chrome.contextMenus.create({
    id: 'toggle.offline',
    title: 'Toggle Offline Mode for This Tab',
    contexts: ['PAGE', 'TABS', 'ACTION'].map(key => chrome.contextMenus.ContextType[key]).filter(s => s)
  });
  chrome.contextMenus.create({
    id: 'tab.only',
    title: 'Only Block Requests from Tabs',
    contexts: ['TABS', 'ACTION'].map(key => chrome.contextMenus.ContextType[key]).filter(s => s),
    checked: prefs['tab-only'],
    type: 'checkbox'
  });
});
chrome.runtime.onInstalled.addListener(once);
chrome.runtime.onStartup.addListener(once);

const context = async (info, tab) => {
  if (info.menuItemId === 'toggle.offline') {
    const rules = await chrome.declarativeNetRequest.getSessionRules();
    const hasRules = rules.filter(r => r.action.type === 'block' && (r.condition.tabIds || []).indexOf(tab.id) !== -1)
      .length !== 0;

    if (hasRules) {
      onMessage({
        method: 'tab_go_online'
      }, {
        tab
      });
    }
    else {
      onMessage({
        method: 'tab_go_offline'
      }, {
        tab
      });
    }
  }
  else if (info.menuItemId === 'tab.only') {
    chrome.storage.local.set({
      'tab-only': info.checked
    });
  }
};
chrome.contextMenus.onClicked.addListener(context);
chrome.commands.onCommand.addListener(async name => {
  if (name === 'toggle.offline') {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    context({
      menuItemId: 'toggle.offline'
    }, tab);
  }
});

/* remove per tab rules on startup */
{
  const once = () => chrome.declarativeNetRequest.getSessionRules().then(rules => {
    const removeRuleIds = rules.filter(r => r.id > 2).map(r => r.id);
    if (removeRuleIds.length) {
      chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds
      });
    }
  });
  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
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
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
