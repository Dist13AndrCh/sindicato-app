// ============================================
// CONFIGURACIÓN DE FIREBASE (PRODUCCIÓN)
// Copia este archivo como 'firebase-config.js'
// y reemplaza con tus credenciales originales.
// ============================================

const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO",
    storageBucket: "TU_PROYECTO.firebasestorage.app",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

function getPublicRef(col) {
    return db.collection('artifacts')
             .doc('sindicato-pagos-v1')
             .collection('public')
             .doc('data')
             .collection(col);
}
