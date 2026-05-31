import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import fs from "fs";

// Leer config
const configStr = fs.readFileSync("firebase-applet-config.json", "utf8");
const firebaseConfig = JSON.parse(configStr);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  try {
    const prods = await getDocs(collection(db, "products"));
    const arrozList = [];
    prods.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.toLowerCase().includes("arroz")) {
        arrozList.push({ id: doc.id, ...data });
      }
    });
    console.log("Arroz items found:", JSON.stringify(arrozList, null, 2));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

check();
