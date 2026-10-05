import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore'

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

async function cleanMockData() {
  const users = [
    { email: 'owner@gmail.com', password: 'owner123456' },
    { email: 'sahan@gmail.com', password: 'sahan123456' },
    { email: 'kalum@gmail.com', password: 'kalum123456' },
  ]

  for (const u of users) {
    try {
      console.log(`\nLogging in as ${u.email}...`)
      const res = await signInWithEmailAndPassword(auth, u.email, u.password)
      const uid = res.user.uid
      console.log(`Signed in successfully: ${uid}`)

      // Find groups where this user is member
      const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', uid))
      const snap = await getDocs(q)
      console.log(`Found ${snap.size} groups for ${u.email}`)

      for (const gDoc of snap.docs) {
        const groupId = gDoc.id
        console.log(`Cleaning group: ${groupId} (${gDoc.data().name})`)

        // Delete expenses
        const expSnap = await getDocs(collection(db, 'groups', groupId, 'expenses'))
        for (const eDoc of expSnap.docs) {
          console.log(`  Deleting expense: ${eDoc.id} (${eDoc.data().title})`)
          await deleteDoc(doc(db, 'groups', groupId, 'expenses', eDoc.id))
        }

        // Delete settlements
        const setSnap = await getDocs(collection(db, 'groups', groupId, 'settlements'))
        for (const sDoc of setSnap.docs) {
          console.log(`  Deleting settlement: ${sDoc.id}`)
          await deleteDoc(doc(db, 'groups', groupId, 'settlements', sDoc.id))
        }

        // Delete group doc itself
        console.log(`  Deleting group doc: ${groupId}`)
        await deleteDoc(doc(db, 'groups', groupId))
      }
      console.log(`Cleaned all data for ${u.email}`)
    } catch (err) {
      console.error(`Error cleaning for ${u.email}:`, err.message)
    }
  }

  console.log('\n--- Cleanup Finished ---')
}

cleanMockData().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
