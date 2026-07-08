import {Config} from '@remotion/cli/config';

// Use the system Chrome instead of downloading Chrome Headless Shell —
// this network intermittently blackholes DNS for storage.googleapis.com.
// chrome-for-testing mode launches with the NEW headless (old headless was
// removed from Chrome 132+; Edge's headless is hollowed out entirely).
Config.setBrowserExecutable('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
Config.setChromeMode('chrome-for-testing');
Config.setEntryPoint('src/index.ts');
// The MAG8 dev/prod server owns :3000 — keep Remotion's render server away.
Config.setRendererPort(3333);
Config.setStudioPort(3334);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
