/**
 * Test script to verify all 15 financial calculation rules in calculations.js
 */

import {
  toMinorUnits,
  fromMinorUnits,
  safeAdd,
  calculateBalances,
  calculateBalancesFlat,
  getPersonBalance,
  getPersonPairBalance,
  simplifyDebts,
  computeEqualSplits,
  validateManualSplits,
  computePercentSplits,
  calculateDailySummary,
  calculateMonthlySummary,
  normalizeExpensesAndSettlements,
  calculateCumulativeMemberSummary,
} from './src/lib/calculations.js'

console.log('--- RUNNING 15 FINANCIAL VALIDATION RULES ---')

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`)
    passed++
  } else {
    console.error(`[FAIL] ${message}`)
    failed++
  }
}

// Setup users
const u1 = 'rusiru'
const u2 = 'sahan'
const u3 = 'kalum'
const members = [
  { id: u1, name: 'Rusiru' },
  { id: u2, name: 'Sahan' },
  { id: u3, name: 'Kalum' },
]

// Rule 1: Every Rs. 1000 expense is split equally among 3 users with exact sum = 1000
const splits1 = computeEqualSplits(1000, [u1, u2, u3], u1)
const sum1 = splits1.reduce((acc, s) => acc + s.amount, 0)
assert(
  splits1.length === 3 &&
  splits1.find(s => s.memberId === u1).amount === 333.34 &&
  splits1.find(s => s.memberId === u2).amount === 333.33 &&
  splits1.find(s => s.memberId === u3).amount === 333.33 &&
  sum1 === 1000,
  'Rule 1 & 8: Equal split of 1000 among 3 users has payer getting remainder, sum equals 1000 exactly'
)

// Rule 2 & 10: Rusiru pays 1000. Sahan and Kalum owe Rusiru. Rusiru does NOT get a debit.
const exp1 = {
  id: 'exp1',
  amount: 1000,
  paidBy: u1,
  splits: splits1,
  date: new Date('2026-10-01T12:00:00Z'),
}
const balancesFlat1 = calculateBalancesFlat([exp1], [])
const sahanOwesRusiru = balancesFlat1.find(b => b.from === u2 && b.to === u1)?.amount
const kalumOwesRusiru = balancesFlat1.find(b => b.from === u3 && b.to === u1)?.amount
assert(
  sahanOwesRusiru === 333.33 && kalumOwesRusiru === 333.33 && balancesFlat1.length === 2,
  'Rule 2 & 10: Only non-payers owe payer (Sahan: 333.33, Kalum: 333.33), payer has no debit'
)

// Rule 3: Person balance for Rusiru after Exp 1: owed = 666.66, owes = 0, net = 666.66
const rusiruBal1 = getPersonBalance(u1, [exp1], [])
const sahanBal1 = getPersonBalance(u2, [exp1], [])
const kalumBal1 = getPersonBalance(u3, [exp1], [])
assert(
  rusiruBal1.owed === 666.66 && rusiruBal1.owes === 0 && rusiruBal1.net === 666.66 &&
  sahanBal1.owes === 333.33 && sahanBal1.net === -333.33 &&
  kalumBal1.owes === 333.33 && kalumBal1.net === -333.33,
  'Rule 3: User balances reflect credits and debits accurately'
)

// Rule 4: Kalum pays another 1000 for food.
const splits2 = computeEqualSplits(1000, [u1, u2, u3], u3)
const exp2 = {
  id: 'exp2',
  amount: 1000,
  paidBy: u3,
  splits: splits2,
  date: new Date('2026-10-02T12:00:00Z'),
}
const balancesFlat2 = calculateBalancesFlat([exp1, exp2], [])
// Rusiru paid 1000 (share 333.34, paid 1000), Kalum paid 1000 (share 333.34, paid 1000), Sahan paid 0 (share 666.66)
const rusiruBal2 = getPersonBalance(u1, [exp1, exp2], [])
const kalumBal2 = getPersonBalance(u3, [exp1, exp2], [])
const sahanBal2 = getPersonBalance(u2, [exp1, exp2], [])
assert(
  rusiruBal2.net === 333.33 && kalumBal2.net === 333.33 && sahanBal2.net === -666.66,
  'Rule 4: Multi-expense accumulation (Kalum pays 1000)'
)

// Rule 5: Sahan pays another 1000 for food.
const splits3 = computeEqualSplits(1000, [u1, u2, u3], u2)
const exp3 = {
  id: 'exp3',
  amount: 1000,
  paidBy: u2,
  splits: splits3,
  date: new Date('2026-10-03T12:00:00Z'),
}
const allExp = [exp1, exp2, exp3]
const rusiruBal3 = getPersonBalance(u1, allExp, [])
const sahanBal3 = getPersonBalance(u2, allExp, [])
const kalumBal3 = getPersonBalance(u3, allExp, [])
assert(
  Math.abs(rusiruBal3.net) === 0 &&
  Math.abs(sahanBal3.net) === 0 &&
  Math.abs(kalumBal3.net) === 0,
  'Rule 5: When all 3 members each pay 1000 once, all net balances are exactly 0'
)

// Rule 6 & 15: Sum of all Net Balances = 0 across all scenarios
const sumNets = rusiruBal3.net + sahanBal3.net + kalumBal3.net
assert(
  sumNets === 0,
  'Rule 6 & 15: Sum of all Net Balances across all users is exactly 0'
)

// Rule 7: Settlements correctly reduce debts
const set1 = { id: 's1', from: u2, to: u1, amount: 100, date: new Date('2026-10-04T12:00:00Z') }
const balAfterSet = getPersonBalance(u1, [exp1], [set1])
assert(
  balAfterSet.owed === 566.66 && balAfterSet.net === 566.66,
  'Rule 7: Settlement reduces debt from Sahan to Rusiru by 100'
)

// Rule 8 & 9: Rounding precision - minor units arithmetic creates/destroys no money
const minor1 = toMinorUnits(10.55)
const minor2 = toMinorUnits(20.45)
assert(
  fromMinorUnits(minor1 + minor2) === 31.00,
  'Rule 8 & 9: Minor units arithmetic prevents floating-point drift'
)

// Rule 11: Simplify debts gives minimal valid settlement transactions
const sim = simplifyDebts(calculateBalancesFlat([exp1, exp2], []))
const simTotal = sim.reduce((acc, s) => acc + s.amount, 0)
assert(
  sim.length === 2 && Math.round(simTotal * 100) === 66666,
  'Rule 11: Debt simplification minimizes transactions correctly'
)

// Rule 12: Edit operation - updating an expense recalculates cleanly
const updatedExp1 = { ...exp1, amount: 600, splits: computeEqualSplits(600, [u1, u2, u3], u1) }
const balAfterEdit = getPersonBalance(u1, [updatedExp1], [])
assert(
  balAfterEdit.owed === 400 && balAfterEdit.net === 400,
  'Rule 12: Editing expense correctly removes old and applies new calculation'
)

// Rule 13: Delete operation - removing an expense restores zero balance
const balAfterDel = getPersonBalance(u1, [], [])
assert(
  balAfterDel.net === 0 && balAfterDel.owed === 0 && balAfterDel.owes === 0,
  'Rule 13: Deleting an expense removes all related debit/credit effects'
)

// Rule 14: Cumulative summary roll forward
const cumSummary = calculateCumulativeMemberSummary(allExp, [], members, u1, new Date('2026-10-04T23:59:59Z'))
assert(
  cumSummary.totalGroupSpent === 3000 &&
  cumSummary.totalToCollectFromMembers === 0 &&
  cumSummary.totalUserOwesMembers === 0 &&
  cumSummary.memberSummaries.every(m => Math.abs(m.overallNet) === 0),
  'Rule 14: Cumulative member summary rollup with roll-forward works accurately'
)

// Rule 15: Monthly summary
const monthSummary = calculateMonthlySummary(allExp, [], members)
assert(
  monthSummary.totalSpent === 3000 &&
  monthSummary.memberSummaries.length === 3 &&
  monthSummary.memberSummaries.every(m => m.paid === 1000 && m.owes === 1000 && m.finalBalance === 0),
  'Rule 15: Monthly summary calculation matches all member ledger constraints'
)

console.log(`\nRESULTS: ${passed} PASSED, ${failed} FAILED`)
if (failed > 0) process.exit(1)
