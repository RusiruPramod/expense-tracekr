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

/**
 * calculateDailySummary
 *
 * Computes daily breakdown for all group members for a set of expenses on a specific day.
 * Returns:
 * {
 *   totalAmount: number,
 *   memberSummaries: Array<{
 *     memberId: string,
 *     name: string,
 *     paid: number,
 *     owes: number,
 *     net: number,
 *     status: 'receive' | 'pay' | 'settled'
 *   }>
 * }
 *
 * @param {Array} dayExpenses
 * @param {Array} members
 * @returns {{ totalAmount: number, memberSummaries: Array }}
 */
export function calculateDailySummary(dayExpenses, members = [], currentUserId = '') {
  const totalAmount = (dayExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0)

  const memberMap = new Map()
  members.forEach((m) => {
    memberMap.set(m.id, {
      memberId: m.id,
      name: m.name || 'Member',
      paidMinor: 0,
      owesMinor: 0,
    })
  })

  // Fallback for current user if not in members list
  if (currentUserId && !memberMap.has(currentUserId)) {
    memberMap.set(currentUserId, {
      memberId: currentUserId,
      name: 'You',
      paidMinor: 0,
      owesMinor: 0,
    })
  }

  // Process day expenses
  for (const exp of (dayExpenses || [])) {
    let paidBy = exp.paidBy
    if (paidBy === 'ME_PLACEHOLDER' && currentUserId) paidBy = currentUserId

    if (!memberMap.has(paidBy) && paidBy) {
      memberMap.set(paidBy, {
        memberId: paidBy,
        name: 'Member',
        paidMinor: 0,
        owesMinor: 0,
      })
    }

    if (memberMap.has(paidBy)) {
      memberMap.get(paidBy).paidMinor += toMinorUnits(exp.amount || 0)
    }

    const splits = exp.splits || exp.splitDetails || []
    for (const s of splits) {
      let mId = s.memberId
      if (mId === 'ME_PLACEHOLDER' && currentUserId) mId = currentUserId

      if (!memberMap.has(mId) && mId) {
        memberMap.set(mId, {
          memberId: mId,
          name: 'Member',
          paidMinor: 0,
          owesMinor: 0,
        })
      }

      if (memberMap.has(mId)) {
        memberMap.get(mId).owesMinor += toMinorUnits(s.amount || 0)
      }
    }
  }

  const memberSummaries = Array.from(memberMap.values())
    .filter((m) => m.paidMinor > 0 || m.owesMinor > 0)
    .map((m) => {
      const paid = fromMinorUnits(m.paidMinor)
      const owes = fromMinorUnits(m.owesMinor)
      const net = fromMinorUnits(m.paidMinor - m.owesMinor)
      let status = 'settled'
      if (net > 0.009) status = 'receive'
      else if (net < -0.009) status = 'pay'

      return {
        memberId: m.memberId,
        name: m.name,
        paid,
        owes,
        net,
        status,
      }
    })

  return {
    totalAmount,
    memberSummaries,
  }
}

/**
 * calculateMonthlySummary
 *
 * Computes monthly totals and final net balances for all members in a given month.
 *
 * @param {Array} monthExpenses
 * @param {Array} monthSettlements
 * @param {Array} members
 * @returns {{
 *   totalSpent: number,
 *   memberSummaries: Array<{
 *     memberId: string,
 *     name: string,
 *     paid: number,
 *     owes: number,
 *     finalBalance: number,
 *     status: 'receive' | 'pay' | 'settled'
 *   }>,
 *   simplifiedSettlements: Array<{ from: string, fromName: string, to: string, toName: string, amount: number }>
 * }}
 */
export function calculateMonthlySummary(monthExpenses, monthSettlements = [], members = []) {
  const totalSpent = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

  const memberMap = new Map()
  members.forEach((m) => {
    memberMap.set(m.id, {
      memberId: m.id,
      name: m.name || 'Unknown',
      paidMinor: 0,
      owesMinor: 0,
    })
  })

  // Accumulate expenses
  for (const exp of monthExpenses) {
    if (memberMap.has(exp.paidBy)) {
      memberMap.get(exp.paidBy).paidMinor += toMinorUnits(exp.amount || 0)
    }
    const splits = exp.splits || exp.splitDetails || []
    for (const s of splits) {
      if (memberMap.has(s.memberId)) {
        memberMap.get(s.memberId).owesMinor += toMinorUnits(s.amount || 0)
      }
    }
  }

  // Calculate balances flat to derive simplified settlements
  const rawFlatBalances = calculateBalancesFlat(monthExpenses, monthSettlements)
  const simplified = simplifyDebts(rawFlatBalances).map((trans) => {
    const fromMember = members.find((m) => m.id === trans.from)
    const toMember = members.find((m) => m.id === trans.to)
    return {
      ...trans,
      fromName: fromMember?.name || 'Unknown',
      toName: toMember?.name || 'Unknown',
    }
  })

  const memberSummaries = Array.from(memberMap.values()).map((m) => {
    const paid = fromMinorUnits(m.paidMinor)
    const owes = fromMinorUnits(m.owesMinor)
    const finalBalance = fromMinorUnits(m.paidMinor - m.owesMinor)
    let status = 'settled'
    if (finalBalance > 0.009) status = 'receive'
    else if (finalBalance < -0.009) status = 'pay'

    return {
      memberId: m.memberId,
      name: m.name,
      paid,
      owes,
      finalBalance,
      status,
    }
  })

  return {
    totalSpent,
    memberSummaries,
    simplifiedSettlements: simplified,
  }
}

/**
 * normalizeExpensesAndSettlements
 * Replaces 'ME_PLACEHOLDER' with currentUserId across expenses and settlements.
 */
export function normalizeExpensesAndSettlements(expenses = [], settlements = [], currentUserId = '') {
  const fixedExpenses = (expenses || []).map((e) => {
    const splits = e.splits || e.splitDetails || []
    return {
      ...e,
      paidBy: e.paidBy === 'ME_PLACEHOLDER' && currentUserId ? currentUserId : e.paidBy,
      splits: splits.map((s) => ({
        ...s,
        memberId: s.memberId === 'ME_PLACEHOLDER' && currentUserId ? currentUserId : s.memberId,
      })),
    }
  })

  const fixedSettlements = (settlements || []).map((s) => ({
    ...s,
    from: s.from === 'ME_PLACEHOLDER' && currentUserId ? currentUserId : s.from,
    to:   s.to   === 'ME_PLACEHOLDER' && currentUserId ? currentUserId : s.to,
  }))

  return { expenses: fixedExpenses, settlements: fixedSettlements }
}

/**
 * calculateCumulativeMemberSummary
 *
 * Calculates cumulative member balances as of targetDate (or all time).
 * Shows exactly how much each member has spent, their split shares, settlements made,
 * and their direct pending debt to the current user (owner).
 *
 * Unpaid balances from previous days automatically roll forward to today!
 */
export function calculateCumulativeMemberSummary(
  expenses = [],
  settlements = [],
  members = [],
  currentUserId = '',
  targetDate = new Date()
) {
  const endOfDay = new Date(targetDate)
  endOfDay.setHours(23, 59, 59, 999)

  const filteredExpenses = (expenses || []).filter((e) => {
    const d = e.date?.toDate ? e.date.toDate() : new Date(e.date)
    return d <= endOfDay
  })

  const filteredSettlements = (settlements || []).filter((s) => {
    const d = s.date?.toDate ? s.date.toDate() : new Date(s.date)
    return d <= endOfDay
  })

  const { expenses: normExp, settlements: normSet } = normalizeExpensesAndSettlements(
    filteredExpenses,
    filteredSettlements,
    currentUserId
  )

  const balancesFlat = calculateBalancesFlat(normExp, normSet)
  const simplified = simplifyDebts(balancesFlat)

  const memberMap = new Map()
  members.forEach((m) => {
    memberMap.set(m.id, {
      memberId: m.id,
      name: m.name || 'Member',
      isUser: m.id === currentUserId,
      isGuest: !!m.isGuest,
      totalPaidMinor: 0,
      totalShareMinor: 0,
      datesInvolved: new Set(),
    })
  })

  let totalGroupSpentMinor = 0

  for (const exp of normExp) {
    const amtMinor = toMinorUnits(exp.amount || 0)
    totalGroupSpentMinor += amtMinor

    const dateStr = exp.date?.toDate
      ? exp.date.toDate().toISOString().split('T')[0]
      : (typeof exp.date === 'string' ? exp.date.split('T')[0] : '')

    if (memberMap.has(exp.paidBy)) {
      const entry = memberMap.get(exp.paidBy)
      entry.totalPaidMinor += amtMinor
      if (dateStr) entry.datesInvolved.add(dateStr)
    }

    const splits = exp.splits || []
    for (const s of splits) {
      if (memberMap.has(s.memberId)) {
        const entry = memberMap.get(s.memberId)
        entry.totalShareMinor += toMinorUnits(s.amount || 0)
        if (dateStr) entry.datesInvolved.add(dateStr)
      }
    }
  }

  let totalToCollectMinor = 0
  let totalUserOwesMinor = 0

  const memberSummaries = Array.from(memberMap.values()).map((m) => {
    const isUser = m.memberId === currentUserId

    let netWithUserMinor = 0
    for (const b of balancesFlat) {
      if (b.from === m.memberId && b.to === currentUserId) {
        netWithUserMinor += toMinorUnits(b.amount)
      } else if (b.from === currentUserId && b.to === m.memberId) {
        netWithUserMinor -= toMinorUnits(b.amount)
      }
    }

    const overallNetMinor = m.totalPaidMinor - m.totalShareMinor

    const totalPaid = fromMinorUnits(m.totalPaidMinor)
    const totalShare = fromMinorUnits(m.totalShareMinor)
    const netWithUser = fromMinorUnits(netWithUserMinor)
    const overallNet = fromMinorUnits(overallNetMinor)

    let status = 'settled'
    if (netWithUserMinor > 9) {
      status = 'owes_user'
      totalToCollectMinor += netWithUserMinor
    } else if (netWithUserMinor < -9) {
      status = 'user_owes'
      totalUserOwesMinor += -netWithUserMinor
    }

    return {
      memberId: m.memberId,
      name: m.name,
      isUser,
      isGuest: m.isGuest,
      totalPaid,
      totalShare,
      netWithUser,
      overallNet,
      status,
      amountDueToUser: netWithUser > 0.009 ? netWithUser : 0,
      amountOwedByUser: netWithUser < -0.009 ? Math.abs(netWithUser) : 0,
      activeDaysCount: m.datesInvolved.size,
    }
  })

  const namedSettlements = simplified.map((s) => {
    const fromMem = members.find((m) => m.id === s.from)
    const toMem = members.find((m) => m.id === s.to)
    return {
      ...s,
      fromName: s.from === currentUserId ? 'You' : fromMem?.name || 'Unknown',
      toName: s.to === currentUserId ? 'You' : toMem?.name || 'Unknown',
      isYouPay: s.from === currentUserId,
      isYouReceive: s.to === currentUserId,
    }
  })

  return {
    asOfDate: targetDate,
    totalExpensesCount: normExp.length,
    totalSettlementsCount: normSet.length,
    totalGroupSpent: fromMinorUnits(totalGroupSpentMinor),
    totalToCollectFromMembers: fromMinorUnits(totalToCollectMinor),
    totalUserOwesMembers: fromMinorUnits(totalUserOwesMinor),
    memberSummaries,
    simplifiedSettlements: namedSettlements,
  }
}

