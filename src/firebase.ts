import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDiDoxBzc1rZ_9Q63eGyt2GgoY5D9PNpzs",
    authDomain: "braintopai.firebaseapp.com",
    projectId: "braintopai",
    storageBucket: "braintopai.appspot.com",
    messagingSenderId: "1091362437440",
    appId: "1:1091362437440:web:1ce2b48b07a129234922a5",
    measurementId: "G-RCH8KF2HVG"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); 