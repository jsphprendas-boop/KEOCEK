import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

async function check() {
  try {
    const prods = await db.collection('products').get();
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
