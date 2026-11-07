# Prove-It Challenges

Verification prompts requiring the agent to demonstrate comprehension before migration approval.

---

## Challenge 1: Codebase Coverage

**Source:** DIM-1 (Comprehension)

```
CHALLENGE: List every file you read. For files you did NOT read, 
explain specifically why each is irrelevant to migration.

Format:
READ: file1.ts, file2.ts, ...
NOT READ (justified): file3.ts because [reason], ...
NOT READ (unjustified): file4.ts [BLOCKING — must read or justify]

If >10% of files are unjustified, this is a BLOCKING finding.
```

---

## Challenge 2: Behavioral Claims

**Source:** DIM-2 (Fidelity)

```
CHALLENGE: For each behavioral claim, provide:
1. The specific behavior
2. The legacy code location that implements it
3. Your new code location that replicates it
4. The test case that verifies it

Format:
| Behavior | Legacy Location | New Location | Test |
|----------|----------------|--------------|------|
| Session creation | auth/service.ts:42 | auth/service.ts:38 | auth.test.ts:156 |

If any behavior lacks a citation, this is a BLOCKING finding.
```

---

## Challenge 3: Edge Case Discovery

**Source:** DIM-6 (Edge Cases)

```
CHALLENGE: Identify 5+ EDGE CASES in the legacy system that are NOT 
documented in any spec or README. For each:

1. What is the edge case?
2. What triggers it?
3. What happens in the legacy system?
4. How does your migration handle it?
5. What code location demonstrates this behavior?

If you cannot find undocumented edge cases, explain your systematic 
search methodology.
```

---

## Challenge 4: Side Effect Inventory

**Source:** DIM-5 (Side Effects)

```
CHALLENGE: Complete side effect inventory:

For the authentication module, list EVERY side effect:

| Side Effect | Trigger | Legacy Location | New Location | Verified? |
|-------------|---------|-----------------|--------------|-----------|
| Logs to auth.log | User login | service.ts:55 | service.ts:52 | [ ] |
| Creates Redis session | User login | service.ts:60 | service.ts:58 | [ ] |
| Emits metrics | Auth failure | service.ts:70 | service.ts:65 | [ ] |

For any side effect not verified with code evidence, this is a 
BLOCKING finding.
```

---

## Challenge 5: Interface Contract Verification

**Source:** DIM-3 (Contract)

```
CHALLENGE: Verify every interface preserved:

For every internal/external API in the legacy system:

1. List the interface signature
2. Show legacy implementation
3. Show new implementation
4. Verify: Are parameters identical? Return types? Error codes?

If ANY interface differs without documented justification, 
this is a BLOCKING finding.
```

---

## Challenge 6: Assumption Audit

**Source:** DIM-8 (Assumptions)

```
CHALLENGE: Every assumption you made about the legacy system:

1. List each assumption
2. For each: what is the specific code that proves it correct?
3. If you cannot prove an assumption, it becomes a blocking finding

Assumption examples:
- "The session expires after 24 hours" → PROVE with code citation
- "Failed auth returns 401" → PROVE with code citation
- "The system is thread-safe" → PROVE with code evidence
```

---

## Challenge 7: Data Model Mapping

**Source:** DIM-4 (Data Model)

```
CHALLENGE: Map every legacy table/collection to its new equivalent.

For each entity:
1. What is the legacy schema?
2. What is the new schema?
3. Are all fields mapped?
4. Are constraints preserved?

If ANY data cannot be migrated, this is a BLOCKING finding.
```