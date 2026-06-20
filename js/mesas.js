import { db } from "./firebase.js";
import { collection, onSnapshot } from "firebase/firestore";

onSnapshot(collection(db, "mesas"), (snap) => {
  snap.forEach(d => {
    const m = d.data();
    console.log("Mesa:", m.numero, m.status);
  });
});