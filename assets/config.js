// Firebase web config (public by design — access is enforced by firebase/firestore.rules).
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCl_eTm52Wx9vAvtJ13M-zqICtLwxU4oEA",
  authDomain: "kosherguard-rb.firebaseapp.com",
  projectId: "kosherguard-rb",
  storageBucket: "kosherguard-rb.firebasestorage.app",
  messagingSenderId: "149432122507",
  appId: "1:149432122507:web:207f32a33fcf4a4a7f688e",
};

// Keep in sync with isSuper() in firebase/firestore.rules.
export const SUPER_ADMINS = ["rb077858@gmail.com", "ybirenbaum@gmail.com"];

// A device counts as online if it reported within this window (report interval is 5 min).
export const ONLINE_WINDOW_MS = 11 * 60 * 1000;
