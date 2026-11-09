(() => {
  const agent = navigator.userAgent;
  const appleDevice = /iPhone|iPod|iPad/i.test(agent)
    || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);
  if (/android/i.test(agent)) {
    location.replace('https://play.google.com/store/apps/details?id=live.outofsight.app');
  } else if (appleDevice) {
    location.replace('https://apps.apple.com/app/id6821150916');
  }
})();
