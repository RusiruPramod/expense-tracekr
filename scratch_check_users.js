import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, getDocs } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            'AIzaSyCgoHKwN3z3ErA3ylh_nBdAbypphYQgv5k',
  authDomain:        'expenses-70234.firebaseapp.com',
  projectId:         'expenses-70234',
  storageBucket:     'expenses-70234.firebasestorage.app',
  messagingSenderId: '232906847717',
  appId:             '1:232906847717:web:1714776d786814a0c02b0c',
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

async function checkUsers() {
  await signInWithEmailAndPassword(auth, 'owner@gmail.com', 'owner123456')
  const usersSnap = await getDocs(collection(db, 'users'))
  console.log(`Total users in Firestore 'users' collection: ${usersSnap.size}`)
  for (const doc of usersSnap.docs) {
    console.log(`User [${doc.id}]:`, doc.data())
  }
}

checkUsers().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
