import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCv9EjCPGl3SlvHUaRCBShLZhT04aVl8wM",
  authDomain: "mesa-facil-62310.firebaseapp.com",
  databaseURL: "https://mesa-facil-62310-default-rtdb.firebaseio.com",
  projectId: "mesa-facil-62310",
  storageBucket: "mesa-facil-62310.firebasestorage.app",
  messagingSenderId: "170185351689",
  appId: "1:170185351689:web:a3fecbda25e40384ef8ed8",
  measurementId: "G-LWCWGT8WEZ"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);