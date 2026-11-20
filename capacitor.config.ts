import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Real Google Play package id for OrthodoxConnect (from the Page's old
  // Sign up button link: play.google.com/store/apps/details?id=orthodoxconnect.live).
  appId: 'orthodoxconnect.live',
  appName: 'OrthodoxConnect',
  webDir: 'dist',
  // v12: load the LIVE website instead of the bundled copy, like V-Kid's
  // TWA does. Web changes then reach the app right away — no new AAB for
  // app-code changes. The native shell (and its plugins: push, share,
  // filesystem, status bar) stays: Capacitor injects the bridge JS into
  // this origin at document start, so native features keep working.
  server: {
    url: 'https://orthodoxconnect.live',
  },
};

export default config;
