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

async function inspect() {
  const creds = [
    { email: 'owner@gmail.com', password: 'owner123456' },
    { email: 'sahan@gmail.com', password: 'sahan123456' },
    { email: 'kalum@gmail.com', password: 'kalum123456' },
  ]

  for (const c of creds) {
    try {
      console.log(`\n--- Logging in as ${c.email} ---`)
      const res = await signInWithEmailAndPassword(auth, c.email, c.password)
      console.log(`Logged in UID: ${res.user.uid}`)

      const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', res.user.uid))
      const groupsSnap = await getDocs(q)
      console.log(`User ${c.email} has ${groupsSnap.size} group(s):`)

      for (const gDoc of groupsSnap.docs) {
        const gData = gDoc.data()
        console.log(` Group [${gDoc.id}] "${gData.name}":`)
        console.log(`   memberIds:`, gData.memberIds)
        console.log(`   guestMembers:`, gData.guestMembers)

        const expSnap = await getDocs(collection(db, 'groups', gDoc.id, 'expenses'))
        console.log(`   Expenses (${expSnap.size}):`)
        for (const eDoc of expSnap.docs) {
          const ed = eDoc.data()
          console.log(`     - [${eDoc.id}] ${ed.title}: Rs. ${ed.amount} (paidBy: ${ed.paidBy})`)
        }

        const setSnap = await getDocs(collection(db, 'groups', gDoc.id, 'settlements'))
        console.log(`   Settlements (${setSnap.size}):`)
        for (const sDoc of setSnap.docs) {
          const sd = sDoc.data()
          console.log(`     - [${sDoc.id}] From: ${sd.from} -> To: ${sd.to}: Rs. ${sd.amount}`)
        }
      }
    } catch (e) {
      console.log(`Failed for ${c.email}:`, e.message)
    }
  }
}

inspect().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
