// RUGPULL extension: inject the engine into the current tab on click (or Alt+Shift+R).
// Running it a second time on the same tab refunds and puts the page back.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id === undefined) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['rugpull.js'], world: 'MAIN' });
  } catch (err) {
    // chrome:// pages, the Web Store and the PDF viewer can't be scripted
    console.warn('RUGPULL cannot run on this page:', err && err.message);
    chrome.action.setBadgeBackgroundColor({ color: '#f23b4c', tabId: tab.id });
    chrome.action.setBadgeText({ text: '×', tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2500);
  }
});
