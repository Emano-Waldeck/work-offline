'use strict';

const args = new URLSearchParams(location.search);

if (args.get('mode') === 'per-tab') {
  document.title += ' (per-tab mode)';
  chrome.runtime.sendMessage({
    method: 'change_icon_per_tab'
  });
}

const release = () => {
  const href = decodeURIComponent(location.href.split('rd=')[1]);
  location.replace(href);
};

document.addEventListener('click', ({target}) => {
  const cmd = target.dataset.cmd;

  if (cmd === 'retry') {
    release();
  }
  else if (cmd === 'go-online' && confirm('Are you sure you want to go online?')) {
    chrome.storage.local.set({
      mode: 'online'
    });
  }
  else if (cmd === 'switch-online' && confirm('Are you sure you want to switch to online mode for this tab?')) {
    chrome.runtime.sendMessage({
      method: 'tab_go_online'
    }, release);
  }
});

document.body.dataset.mode = args.get('mode');
chrome.storage.onChanged.addListener(prefs => {
  if (prefs.enabled) {
    const bol = prefs.enabled.newValue;
    document.body.dataset.mode = bol ? 'global' : 'per-tab';
  }
});

chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'release') {
    release();
  }
});
