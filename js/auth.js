import { auth } from "./firebase.js";
import { signInWithEmailAndPassword } from "firebase/auth";

export async function login(email, pass) {
  return await signInWithEmailAndPassword(auth, email, pass);
}