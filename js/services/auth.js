import { auth } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export async function login(email, pass) {
  return await signInWithEmailAndPassword(auth, email, pass);
}