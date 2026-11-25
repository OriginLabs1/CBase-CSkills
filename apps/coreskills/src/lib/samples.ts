/**
 * Realistic first-run examples. They are only written when the catalog is
 * completely empty, so a user's own skills are never replaced by samples.
 */
export interface SampleSkill {
  markdown: string;
  createdAt: string;
}

export const SAMPLE_SKILLS: readonly SampleSkill[] = [
  {
    createdAt: '2026-01-12T09:20:00.000Z',
    markdown: `---
name: code-review
description: Review a change set for correctness, edge cases and maintainability. Use when a diff or pull request needs a careful second pass.
version: 0.3.0
tags: [review, engineering, quality]
license: MIT
permissions:
  - scope: workspace.read
    level: ask
    reason: Read the diff and nearby files chosen by the user.
---
# Code review

Perform a focused review of the supplied change set. Instructions are advisory text only; they never execute on their own.

## Process

1. Read the diff from start to finish before commenting.
2. Check behavior against the stated intent, including error paths and empty inputs.
3. Look for accidental scope creep, debug output and unsafe defaults.
4. Trace each changed call site to confirm the contract still holds.

## Report format

- **Finding** — one sentence describing the problem.
- **Evidence** — file path and line reference, or say that none is available.
- **Severity** — blocking, important or minor.
- **Suggestion** — a concrete change, not a generic warning.

If no issues are found, say so plainly and list the assumptions the review relied on.
`
  },
  {
    createdAt: '2026-01-18T14:05:00.000Z',
    markdown: `---
name: meeting-notes
description: Turn rough meeting notes into a concise record of decisions, owners and follow-up actions. Use after a call or workshop.
version: 1.1.0
tags: [writing, meetings, planning]
authors: [OneOrigin]
---
# Meeting notes

Transform raw notes into a readable record without inventing details.

## Output structure

- **Summary** — two or three sentences at most.
- **Decisions** — bullet list, one decision per line.
- **Action items** — owner, task and due date when the notes provide one.
- **Open questions** — items that need an answer before work proceeds.

## Rules

1. Preserve the speaker's meaning; mark unclear points as unresolved.
2. Do not assign an owner that was not stated in the notes.
3. Keep action items short and verifiable.
4. Append a short "Not captured" note when a topic was discussed but details are missing.
`
  },
  {
    createdAt: '2026-02-03T11:42:00.000Z',
    markdown: `---
name: release-checklist
description: Produce a pre-release verification checklist for a software release. Use when preparing a version bump or deployment window.
version: 0.2.1
tags: [release, operations, checklist]
allowed-tools: [search, read]
---
# Release checklist

Generate a checklist that a human can work through and mark complete.

## Steps

1. Confirm the target version and the list of changes since the previous release.
2. Verify that tests and builds pass for every supported platform.
3. Review migration notes and rollback instructions in \`./docs\`.
4. Check that release notes describe user-visible behavior, not internal jargon.
5. List the exact approvals required before publishing.

## Output

Return a markdown checklist with one checkbox per step and a short evidence column.
Never claim a step passed without a concrete artifact to point at.
`
  },
  {
    createdAt: '2026-02-21T16:10:00.000Z',
    markdown: `---
name: privacy-review
description: Review a product change for data minimization and user consent. Use when a feature collects, stores or exports personal information.
version: 0.1.0
tags: [privacy, review, trust]
metadata:
  reviewType: lightweight
---
# Privacy review

Evaluate the described change against data minimization and explicit consent.

## Questions to answer

- What data is collected, and is each field necessary for the stated purpose?
- Where is it stored, how long is it kept, and who can read it?
- Does the user see a clear explanation before the collection happens?
- Can the user export or delete the data without contacting support?
- Are credentials or secrets kept out of exported artifacts?

## Output

Write a short verdict followed by findings ordered by severity. For each finding,
name the concrete mitigation and the user-visible wording that would be required.
`
  }
];
