/**
 * Lightweight self-check for PHI scanner heuristics (no Jest required).
 * Run: node --experimental-strip-types scripts/check-phi-scanner.mjs
 * or via ts-node if available. This file imports the compiled logic via dynamic eval of patterns.
 *
 * Prefer: cd client && npx --yes tsx ../scripts/check-phi-scanner.ts
 */
import {
  scanTextForPhi,
  enforcePhiScan,
  PhiBlockedError,
  PhiNeedsAcknowledgmentError,
  acknowledgePhiContent,
  hashPhiContent,
} from '../client/src/utils/phiScanner';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// High: SSN
{
  const r = scanTextForPhi('SSN 123-45-6789');
  assert(r.maxSeverity === 'high', 'SSN should be high');
  assert(r.findings.some((f) => f.identifierNumber === 7), 'SSN category 7');
}

// High: MRN
{
  const r = scanTextForPhi('Patient MRN: A123456');
  assert(r.maxSeverity === 'high', 'MRN should be high');
}

// High: patient name
{
  const r = scanTextForPhi('The patient John Smith arrived for simulation.');
  assert(r.maxSeverity === 'high', 'patient + name should be high');
}

// Staff names allowed
{
  const r = scanTextForPhi('Assign gap to Jane Doe and talk to John Smith about updating the policy.');
  assert(r.maxSeverity === 'none', 'staff assignment names should pass');
}
{
  const r = scanTextForPhi('Patient Safety Officer training completed with Mary Johnson.');
  assert(!r.findings.some((f) => f.identifierNumber === 1), 'Patient Safety + staff name should not flag name PHI');
}
{
  const r = scanTextForPhi('Need to meet with John Smith about the PEWS policy update.');
  assert(r.maxSeverity === 'none', 'meet with staff name should pass');
}

// Medium: phone in notes
{
  const r = scanTextForPhi('Call them at (203) 555-1212 about the drill.');
  assert(r.maxSeverity === 'medium', 'phone should be medium');
}

// Clean educational text
{
  const r = scanTextForPhi('Completed PEWS education for ED nursing staff. No patient identifiers used.');
  assert(r.maxSeverity === 'none', 'clean text should pass');
}

// Enforce + ack flow
{
  const text = 'Email nurse@example.com for scheduling';
  const r = scanTextForPhi(text);
  let threw = false;
  try {
    enforcePhiScan(r, { surface: 'test', contentForHash: text });
  } catch (e) {
    threw = e instanceof PhiNeedsAcknowledgmentError;
    if (e instanceof PhiNeedsAcknowledgmentError) {
      acknowledgePhiContent(e.contentHash);
    }
  }
  assert(threw, 'medium should need ack');
  enforcePhiScan(r, { surface: 'test', contentForHash: text }); // should not throw after ack
}

{
  const text = 'SSN 111-22-3333';
  let blocked = false;
  try {
    enforcePhiScan(scanTextForPhi(text), { surface: 'test', contentForHash: text });
  } catch (e) {
    blocked = e instanceof PhiBlockedError;
  }
  assert(blocked, 'SSN should hard-block');
}

console.log('phiScanner self-check: OK', hashPhiContent('ok'));
