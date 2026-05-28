import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCaqJraAXeZ8F4zCd9GUIdNIHhfU7FMzJk",
    authDomain: "club-cafe-app.firebaseapp.com",
    databaseURL: "https://club-cafe-app-default-rtdb.firebaseio.com",
    projectId: "club-cafe-app",
    storageBucket: "club-cafe-app.firebasestorage.app",
    messagingSenderId: "1007849307452",
    appId: "1:1007849307452:web:2472f6b2cab7deeae53239",
    measurementId: "G-6314S7TS0T"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
