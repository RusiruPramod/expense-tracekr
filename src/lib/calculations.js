/**
 * src/lib/calculations.js
 *
 * Pure utility functions for balance calculation.
 * All amounts are in MINOR UNITS (integer paise/cents) internally,
 * but the Firestore data stores them as floats (Rs) for readability.
 * We multiply by 100 on ingestion and divide on display.
 *
 * IMPORTANT: No floating-point addition is used for balances.
 * We use Math.round() to coerce to integer minor units.
 */

/**
 * Converts a float amount (Rs 12.50) → integer minor units (1250).
 * @param {number} amount
 * @returns {number}
 */
export const toMinorUnits = (amount) => Math.round(amount * 100)

/**
 * Converts minor units back to float (1250 → 12.50).
 * @param {number} units
 * @returns {number}
 */
export const fromMinorUnits = (units) => units / 100

/**
 * Safely adds two float amounts via minor units to avoid floating-point drift.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export const safeAdd = (a, b) => fromMinorUnits(toMinorUnits(a) + toMinorUnits(b))

/**
 * calculateBalances
 *
 * Given a list of expenses and settlements for a group,
 * returns a map of { memberId → { [otherId]: netAmount } }
 * where positive = otherId owes memberId, negative = memberId owes otherId.
 *
 * @param {Array<{
 *   paidBy: string,
 *   splits: Array<{ memberId: string, amount: number }>,
 *   amount: number
 * }>} expenses
 * @param {Array<{
 *   from: string,
 *   to: string,
 *   amount: number
 * }>} settlements
 * @returns {Map<string, Map<string, number>>}  ledger[a][b] = net(a→b)
 */
export function calculateBalances(expenses, settlements) {
  // ledger[creditor][debtor] = amount debtor owes creditor (in minor units)
  const ledger = new Map()

  const ensureEntry = (a, b) => {
    if (!ledger.has(a)) ledger.set(a, new Map())
    if (!ledger.get(a).has(b)) ledger.get(a).set(b, 0)
    if (!ledger.has(b)) ledger.set(b, new Map())
    if (!ledger.get(b).has(a)) ledger.get(b).set(a, 0)
  }

  const addDebt = (debtor, creditor, amountFloat) => {
    if (debtor === creditor) return
    const units = toMinorUnits(amountFloat)
    ensureEntry(debtor, creditor)
    // debtor owes creditor: ledger[creditor][debtor] += units
    ledger.get(creditor).set(debtor, ledger.get(creditor).get(debtor) + units)
    ledger.get(debtor).set(creditor, ledger.get(debtor).get(creditor) - units)
  }

  // Process expenses
  for (const expense of expenses) {
    const splits = expense.splits || expense.splitDetails || []
    for (const split of splits) {
      if (split.memberId !== expense.paidBy) {
        addDebt(split.memberId, expense.paidBy, split.amount)
      }
    }
  }

  // Process settlements (from paid to, so debtor → creditor)
  for (const s of settlements) {
    // s.from paid s.to, reducing the debt s.from had to s.to
    addDebt(s.to, s.from, s.amount) // reverse: creditor gets credit
    addDebt(s.from, s.to, s.amount) // forward: debtor's debt reduced
    // Actually: settlement means from→to paid amount, so from's debt to to is reduced
    // Let's redo: addDebt(s.from, s.to, amount) was +, settlement reduces it
  }

  return ledger
}

/**
 * calculateBalancesFlat
 *
 * Returns a flat list suitable for display:
 * [{ from, to, amount }] where amount > 0 always (from owes to).
 * Settlements are already factored in via the ledger.
 *
 * @param {Array} expenses
 * @param {Array} settlements
 * @returns {Array<{ from: string, to: string, amount: number }>}
 */
export function calculateBalancesFlat(expenses, settlements) {
  // Build raw pairwise balances in minor units
  // rawDebt[a][b] = how much a owes b (minor units, can be negative)
  const raw = {} // raw[debtor][creditor] in minor units

  const add = (debtor, creditor, minorUnits) => {
    if (debtor === creditor) return
    if (!raw[debtor]) raw[debtor] = {}
    if (!raw[creditor]) raw[creditor] = {}
    raw[debtor][creditor] = (raw[debtor][creditor] || 0) + minorUnits
    raw[creditor][debtor] = (raw[creditor][debtor] || 0) - minorUnits
  }

  // Expenses
  for (const expense of expenses) {
    const splits = expense.splits || expense.splitDetails || []
    for (const split of splits) {
      if (split.memberId !== expense.paidBy) {
        add(split.memberId, expense.paidBy, toMinorUnits(split.amount))
      }
    }
  }

  // Settlements: from→to means from paid to, reducing from's debt
  for (const s of settlements) {
    add(s.to, s.from, toMinorUnits(s.amount)) // from owes to LESS now
  }

  // Extract positive debts only (avoid duplicates)
  const results = []
  const seen = new Set()

  for (const debtor of Object.keys(raw)) {
    for (const creditor of Object.keys(raw[debtor])) {
      const key = [debtor, creditor].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)

      const net = raw[debtor][creditor] // how much debtor owes creditor

      if (Math.abs(net) < 1) continue // < 1 minor unit → settled

      if (net > 0) {
        results.push({ from: debtor, to: creditor, amount: fromMinorUnits(net) })
      } else {
        results.push({ from: creditor, to: debtor, amount: fromMinorUnits(-net) })
      }
    }
  }

  return results
}

/**
 * getPersonBalance
 *
 * Returns { owed: number, owes: number, net: number } for a given userId
 * relative to all other members in the group.
 *
 * @param {string} userId
 * @param {Array} expenses
 * @param {Array} settlements
 * @returns {{ owed: number, owes: number, net: number }}
 */
export function getPersonBalance(userId, expenses, settlements) {
  const flat = calculateBalancesFlat(expenses, settlements)

  let owed = 0 // others owe userId
  let owes = 0 // userId owes others

  for (const entry of flat) {
    if (entry.to === userId)   owed = safeAdd(owed, entry.amount)
    if (entry.from === userId) owes = safeAdd(owes, entry.amount)
  }

  return { owed, owes, net: safeAdd(owed, -owes) }
}

/**
 * getPersonPairBalance
 *
 * Returns net amount between two specific people.
 * Positive = b owes a, Negative = a owes b.
 *
 * @param {string} a
 * @param {string} b
 * @param {Array} expenses
 * @param {Array} settlements
 * @returns {number}
 */
export function getPersonPairBalance(a, b, expenses, settlements) {
  const flat = calculateBalancesFlat(expenses, settlements)

  for (const entry of flat) {
    if (entry.from === a && entry.to === b) return -entry.amount
    if (entry.from === b && entry.to === a) return  entry.amount
  }
  return 0
}

/**
 * simplifyDebts
 *
 * Takes the flat balance list and returns a minimal set of transactions
 * that settle all debts using the greedy reduction algorithm.
 *
 * @param {Array<{ from: string, to: string, amount: number }>} balances
 * @returns {Array<{ from: string, to: string, amount: number }>}
 */
export function simplifyDebts(balances) {
  // Build net balance per person (minor units)
  const net = {}

  for (const b of balances) {
    net[b.from] = (net[b.from] || 0) - toMinorUnits(b.amount)
    net[b.to]   = (net[b.to]   || 0) + toMinorUnits(b.amount)
  }

  const creditors = [] // net > 0
  const debtors   = [] // net < 0

  for (const [person, amount] of Object.entries(net)) {
    if (amount > 0)  creditors.push({ person, amount })
    if (amount < 0)  debtors.push({ person, amount: -amount })
  }

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const transactions = []

  let ci = 0, di = 0
  while (ci < creditors.length && di < debtors.length) {
    const settle = Math.min(creditors[ci].amount, debtors[di].amount)
    transactions.push({
      from:   debtors[di].person,
      to:     creditors[ci].person,
      amount: fromMinorUnits(settle),
    })
    creditors[ci].amount -= settle
    debtors[di].amount   -= settle
    if (creditors[ci].amount === 0) ci++
    if (debtors[di].amount   === 0) di++
  }

  return transactions
}

/**
 * computeEqualSplits
 *
 * Divides totalAmount equally among memberIds.
 * Remainder (due to rounding) goes to the first member (payer).
 *
 * @param {number} totalAmount  float (Rs)
 * @param {string[]} memberIds
 * @param {string} payerId  memberId of the payer (receives remainder)
 * @returns {Array<{ memberId: string, amount: number }>}
 */
export function computeEqualSplits(totalAmount, memberIds, payerId) {
  if (memberIds.length === 0) return []
  const totalMinor = toMinorUnits(totalAmount)
  const baseMinor  = Math.floor(totalMinor / memberIds.length)
  const remainder  = totalMinor - baseMinor * memberIds.length

  return memberIds.map((memberId, i) => {
    // Add remainder to the payer's share (or first member if payer not in list)
    const isPayer = memberId === payerId || (i === 0 && !memberIds.includes(payerId))
    const extra   = (isPayer && remainder > 0) ? remainder : 0
    return { memberId, amount: fromMinorUnits(baseMinor + extra) }
  })
}

/**
 * validateManualSplits
 *
 * Returns { valid: boolean, remaining: number }
 * remaining is in float (Rs), negative = over-split.
 *
 * @param {number} totalAmount
 * @param {Array<{ memberId: string, amount: number }>} splits
 * @returns {{ valid: boolean, remaining: number }}
 */
export function validateManualSplits(totalAmount, splits) {
  const totalMinor = toMinorUnits(totalAmount)
  const sumMinor   = splits.reduce((acc, s) => acc + toMinorUnits(s.amount || 0), 0)
  const remaining  = fromMinorUnits(totalMinor - sumMinor)
  return { valid: Math.abs(totalMinor - sumMinor) < 1, remaining }
}

/**
 * computePercentSplits
 *
 * @param {number} totalAmount
 * @param {Array<{ memberId: string, percent: number }>} percentSplits
 * @param {string} payerId
 * @returns {Array<{ memberId: string, amount: number }>}
 */
export function computePercentSplits(totalAmount, percentSplits, payerId) {
  const totalMinor = toMinorUnits(totalAmount)
  let assigned = 0

  const splits = percentSplits.map((ps) => {
    const amt = Math.floor((totalMinor * ps.percent) / 100)
    assigned += amt
    return { memberId: ps.memberId, amount: fromMinorUnits(amt) }
  })

  const remainder = totalMinor - assigned
  if (remainder !== 0) {
    const payerIdx = splits.findIndex((s) => s.memberId === payerId)
    const idx      = payerIdx >= 0 ? payerIdx : 0
    splits[idx].amount = fromMinorUnits(toMinorUnits(splits[idx].amount) + remainder)
  }

  return splits
}
