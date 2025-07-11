// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBQ99rjxbIGm48Rb5upnYnE-E_xHvY0UUE",
  authDomain: "tv-hrz.firebaseapp.com",
  projectId: "tv-hrz",
  storageBucket: "tv-hrz.firebasestorage.app",
  messagingSenderId: "604680147180",
  appId: "1:604680147180:web:24fe7cf9c337ced45d55c9",
  measurementId: "G-XWWTT6VRFT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);