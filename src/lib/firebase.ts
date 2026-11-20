// Firebase client setup — Authentication is owned by Firebase (project
// novawallet-4596c, under solution.home.bd@gmail.com). This config is a
// client identifier set, safe to ship in the frontend bundle.
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyCURYE7tb3y917eZm2kTlY2IflgpM7zECY',
  authDomain: 'novawallet-4596c.firebaseapp.com',
  projectId: 'novawallet-4596c',
  storageBucket: 'novawallet-4596c.firebasestorage.app',
  messagingSenderId: '91232543054',
  appId: '1:91232543054:web:5749a66735d25149bebe1f',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)
