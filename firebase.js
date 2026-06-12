import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 🔥 SUA CONFIGURAÇÃO REAL
const firebaseConfig = {
  apiKey: "AIzaSyB0v6DiOlbS95l15pAQq_m-yEITH9TlGHU",
  authDomain: "web-app-f30b1.firebaseapp.com",
  projectId: "web-app-f30b1",
  storageBucket: "web-app-f30b1.firebasestorage.app",
  messagingSenderId: "996911066682",
  appId: "1:996911066682:web:6a5e596e2e710746f28f03"
};

// 🚀 Inicializa Firebase
const app = initializeApp(firebaseConfig);

// 📦 Banco de dados
export const db = getFirestore(app);

// 🔐 Login (admin depois)
export const auth = getAuth(app);