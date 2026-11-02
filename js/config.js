/* Dagsplan — the Firebase project. Paste your own project's values here (Firebase console → Project settings →
   Your apps → Web app → SDK setup and configuration). While both are empty the app runs in local mode: everything is
   kept in this browser only, and the parent and child screens sync only between tabs of the same browser. */
'use strict';
const FIREBASE = {
  apiKey: 'AIzaSyCy5gxpbF9BPmfKWKJSaNW71SG8YAEvZvI',
  databaseURL: 'https://dagsplan-85435-default-rtdb.europe-west1.firebasedatabase.app',
};
/* The relay server for calls between different networks (a phone on mobile data and a PC on Wi-Fi, two homes).
   Either `url`: the relay service's address that gives fresh servers (e.g. Metered: https://<app>.metered.live/api/v1/
   turn/credentials?apiKey=…), or `servers`: a fixed list like [{ urls: 'turn:…', username: '…', credential: '…' }].
   Empty: calls work only when both devices can reach each other directly (often the same Wi-Fi). */
const TURN = {
  url: '',
  servers: [],
};
