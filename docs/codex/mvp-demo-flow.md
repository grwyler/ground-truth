# MVP Demo Flow

This demo proves the MVP gate from project intake through Jira export using the Apollo field service pilot scenario.

## Pilot Scenario

Program: Apollo  
Customer: Acme Federal Services  
Source document: `apollo-field-service-sow.txt`

The source material describes field operators who must review assignments, capture site evidence, work offline when connectivity is unavailable, and preserve traceability before development starts.

The deterministic MVP AI adapter generates:

- A source intake workflow.
- A source-backed build requirement.
- Acceptance criteria/test coverage.
- A risk that AI output requires human validation.

## Happy Path

1. Program Manager creates the pilot project.
2. Program Manager uploads the SOW text fixture.
3. Program Manager triggers AI draft generation.
4. Program Manager accepts the generated workflow, requirement, test, and risk.
5. Program Manager assigns owners.
6. Engineering Lead attempts Jira export while the project is Not Ready and receives `PROJECT_NOT_READY`.
7. System actor attempts approval and is rejected.
8. Engineering Lead links the requirement to the workflow and test.
9. Operator Representative approves the workflow.
10. Customer PM approves the requirement.
11. Readiness evaluates to Ready with score `100`.
12. Program Manager generates the certification package.
13. Engineering Lead exports to Jira and the preview includes traceability metadata.

## Override Path

1. Program Manager creates the same pilot project and accepts generated drafts.
2. Readiness evaluates to Not Ready with hard blockers.
3. System actor attempts an override and is rejected.
4. Program Manager overrides the active blockers with a reason and explicit risk acknowledgment.
5. Readiness evaluates to Ready because blockers are overridden, while the override remains visible.
6. Certification package generation and Jira export proceed with override evidence in the package.

## Commands

Run the focused MVP end-to-end tests:

```bash
npm test -- --test-name-pattern=mvp
```

Run the smoke script that resets deterministic seed data and executes both pilot paths:

```bash
npm run smoke:mvp
```

Run all MVP verification gates:

```bash
npm run lint
npm run typecheck
npm test
npm run smoke:mvp
npm run build
```
