````markdown
# API / Interface Control Document

**Pre-Development Readiness Platform**

---

## 1. Overview

This document defines the initial API and interface boundaries for the Pre-Development Readiness Platform.

The API supports:

- Project intake
- Document upload
- AI-assisted generation
- Decision object management
- Traceability
- Approvals
- Versioning
- Readiness evaluation
- Overrides
- Jira export

API design should support future deployment across SaaS, GovCloud, and on-prem / air-gapped environments.

---

## 2. API Standards

### Base Path

`/api/v1`

### Authentication

All authenticated endpoints require:

`Authorization: Bearer <token>`

### Content Types

Primary JSON APIs:

`Content-Type: application/json`

File upload APIs:

`multipart/form-data`

### Versioning Strategy

- API version included in path: `/api/v1`
- Breaking changes require new major version
- Non-breaking additions may be added within same version
- Response schemas should remain backward compatible within a major version

---

# 3. Core APIs

---

## 3.1 Create Project

### Endpoint

`/api/v1/projects`

### Method

`POST`

### Description

Creates a new readiness project after contract award.

### Request Schema

```json
{
  "name": "string",
  "description": "string",
  "customer": "string",
  "contractNumber": "string",
  "programName": "string",
  "metadata": {
    "key": "value"
  }
}
```
````

### Response Schema

```json
{
  "projectId": "string",
  "name": "string",
  "status": "Draft",
  "createdAt": "datetime",
  "createdBy": "string"
}
```

### Error Responses

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Project name is required"
}
```

### Authentication Requirements

- Authenticated user
- Project creation permission

### Rate Limits

- Standard tenant API limit

### Versioning Strategy

- Stable in `/v1`

---

## 3.2 Upload Project Documents

### Endpoint

`/api/v1/projects/{projectId}/documents`

### Method

`POST`

### Description

Uploads SOWs, proposals, legacy documents, PDFs, notes, and constraints.

### Request Schema

`multipart/form-data`

Fields:

- `files[]`
- `documentType`
- `description`

### Response Schema

```json
{
  "documents": [
    {
      "documentId": "string",
      "fileName": "string",
      "documentType": "SOW",
      "status": "Uploaded",
      "uploadedAt": "datetime"
    }
  ]
}
```

### Error Responses

```json
{
  "error": "UNSUPPORTED_FILE_TYPE",
  "message": "File type is not supported"
}
```

### Authentication Requirements

- Authenticated user
- Project edit permission

### Rate Limits

- File-size and tenant upload limits apply

### Versioning Strategy

- Stable in `/v1`

---

## 3.3 Trigger AI Draft Generation

### Endpoint

`/api/v1/projects/{projectId}/ai/generate-draft`

### Method

`POST`

### Description

Generates draft workflows, requirements, risks, assumptions, infrastructure needs, and missing questions.

### Request Schema

```json
{
  "documentIds": ["string"],
  "generationScope": [
    "workflows",
    "requirements",
    "risks",
    "assumptions",
    "infrastructure"
  ]
}
```

### Response Schema

```json
{
  "generationJobId": "string",
  "status": "Queued",
  "estimatedCompletionSeconds": 30
}
```

### Error Responses

```json
{
  "error": "AI_SERVICE_UNAVAILABLE",
  "message": "AI generation is temporarily unavailable"
}
```

### Authentication Requirements

- Authenticated user
- Project edit permission

### Rate Limits

- AI generation limits may apply by tenant

### Versioning Strategy

- AI output schemas versioned independently using `aiSchemaVersion`

---

## 3.4 Get AI Generation Results

### Endpoint

`/api/v1/projects/{projectId}/ai/generation-jobs/{generationJobId}`

### Method

`GET`

### Description

Retrieves AI draft generation status and results.

### Request Schema

None

### Response Schema

```json
{
  "generationJobId": "string",
  "status": "Completed",
  "outputs": {
    "workflows": [],
    "requirements": [],
    "risks": [],
    "assumptions": [],
    "infrastructureNeeds": [],
    "missingQuestions": []
  },
  "aiSchemaVersion": "1.0"
}
```

### Error Responses

```json
{
  "error": "JOB_NOT_FOUND",
  "message": "Generation job not found"
}
```

### Authentication Requirements

- Authenticated user
- Project read permission

### Rate Limits

- Standard tenant API limit

### Versioning Strategy

- Job response stable in `/v1`
- AI output schema version included in response

---

## 3.5 Create Decision Object

### Endpoint

`/api/v1/projects/{projectId}/decision-objects`

### Method

`POST`

### Description

Creates a structured decision object such as workflow, requirement, test, risk, assumption, infrastructure dependency, or interface.

### Request Schema

```json
{
  "type": "Requirement",
  "title": "string",
  "content": "string",
  "ownerId": "string",
  "priority": "High",
  "metadata": {
    "key": "value"
  }
}
```

### Response Schema

```json
{
  "objectId": "string",
  "type": "Requirement",
  "title": "string",
  "version": 1,
  "status": "Draft",
  "ownerId": "string",
  "createdAt": "datetime"
}
```

### Error Responses

```json
{
  "error": "INVALID_OBJECT_TYPE",
  "message": "Unsupported decision object type"
}
```

### Authentication Requirements

- Authenticated user
- Project edit permission

### Rate Limits

- Standard tenant API limit

### Versioning Strategy

- Object schemas versioned using `objectSchemaVersion`

---

## 3.6 Update Decision Object

### Endpoint

`/api/v1/projects/{projectId}/decision-objects/{objectId}`

### Method

`PATCH`

### Description

Updates a decision object. Meaningful changes automatically create a new version and may invalidate related approvals.

### Request Schema

```json
{
  "title": "string",
  "content": "string",
  "ownerId": "string",
  "priority": "High",
  "changeReason": "string"
}
```

### Response Schema

```json
{
  "objectId": "string",
  "version": 2,
  "status": "Draft",
  "invalidatedApprovals": [
    {
      "approvalId": "string",
      "reason": "Content changed"
    }
  ],
  "updatedAt": "datetime"
}
```

### Error Responses

```json
{
  "error": "VERSION_CONFLICT",
  "message": "Object has been modified by another user"
}
```

### Authentication Requirements

- Authenticated user
- Object edit permission

### Rate Limits

- Standard tenant API limit

### Versioning Strategy

- Optimistic concurrency recommended using version identifiers

---

## 3.7 Link Decision Objects

### Endpoint

`/api/v1/projects/{projectId}/decision-objects/{objectId}/links`

### Method

`POST`

### Description

Creates a traceability relationship between two decision objects.

### Request Schema

```json
{
  "targetObjectId": "string",
  "relationshipType": "DERIVED_FROM_WORKFLOW"
}
```

### Response Schema

```json
{
  "linkId": "string",
  "sourceObjectId": "string",
  "targetObjectId": "string",
  "relationshipType": "DERIVED_FROM_WORKFLOW",
  "createdAt": "datetime"
}
```

### Error Responses

```json
{
  "error": "INVALID_RELATIONSHIP",
  "message": "This relationship type is not allowed"
}
```

### Authentication Requirements

- Authenticated user
- Project edit permission

### Rate Limits

- Standard tenant API limit

### Versioning Strategy

- Relationship types versioned through controlled enum expansion

---

## 3.8 Submit Approval

### Endpoint

`/api/v1/projects/{projectId}/decision-objects/{objectId}/approvals`

### Method

`POST`

### Description

Submits an explicit approval for a specific decision object version.

### Request Schema

```json
{
  "version": 1,
  "approvalDecision": "Approved",
  "comment": "string"
}
```

### Response Schema

```json
{
  "approvalId": "string",
  "objectId": "string",
  "version": 1,
  "approvedBy": "string",
  "approvalDecision": "Approved",
  "approvedAt": "datetime"
}
```

### Error Responses

```json
{
  "error": "UNAUTHORIZED_APPROVER",
  "message": "User is not authorized to approve this object"
}
```

### Authentication Requirements

- Authenticated user
- Assigned approver or authorized role

### Rate Limits

- Standard tenant API limit

### Versioning Strategy

- Approvals always reference immutable object version

---

## 3.9 Get Version Diff

### Endpoint

`/api/v1/projects/{projectId}/decision-objects/{objectId}/versions/diff`

### Method

`GET`

### Description

Returns a visual/structured diff between two versions of a decision object.

### Request Schema

Query parameters:

- `fromVersion`
- `toVersion`

### Response Schema

```json
{
  "objectId": "string",
  "fromVersion": 1,
  "toVersion": 2,
  "changes": [
    {
      "field": "content",
      "changeType": "Modified",
      "before": "string",
      "after": "string"
    }
  ]
}
```

### Error Responses

```json
{
  "error": "VERSION_NOT_FOUND",
  "message": "Requested version does not exist"
}
```

### Authentication Requirements

- Authenticated user
- Project read permission

### Rate Limits

- Standard tenant API limit

### Versioning Strategy

- Diff response stable in `/v1`

---

## 3.10 Get Readiness Status

### Endpoint

`/api/v1/projects/{projectId}/readiness`

### Method

`GET`

### Description

Returns the project’s computed Ready / Not Ready status, readiness score, blockers, warnings, and overrides.

### Request Schema

None

### Response Schema

```json
{
  "projectId": "string",
  "status": "Not Ready",
  "readinessScore": 82,
  "hardBlockers": [
    {
      "blockerId": "string",
      "type": "MissingTraceability",
      "description": "Requirement is not linked to acceptance criteria",
      "objectId": "string",
      "severity": "Critical"
    }
  ],
  "warnings": [],
  "overrides": [],
  "evaluatedAt": "datetime"
}
```

### Error Responses

```json
{
  "error": "READINESS_ENGINE_ERROR",
  "message": "Unable to compute readiness status"
}
```

### Authentication Requirements

- Authenticated user
- Project read permission

### Rate Limits

- Standard tenant API limit

### Versioning Strategy

- Readiness rule version included in future schema as `readinessRulesVersion`

---

## 3.11 Submit Override

### Endpoint

`/api/v1/projects/{projectId}/overrides`

### Method

`POST`

### Description

Allows an authorized user to override specific blockers with explicit risk acceptance.

### Request Schema

```json
{
  "blockerIds": ["string"],
  "reason": "string",
  "riskAcknowledgment": "string"
}
```

### Response Schema

```json
{
  "overrideId": "string",
  "blockerIds": ["string"],
  "approvedBy": "string",
  "reason": "string",
  "riskAcknowledgment": "string",
  "createdAt": "datetime",
  "visibility": "DashboardAndAuditTrail"
}
```

### Error Responses

```json
{
  "error": "UNAUTHORIZED_OVERRIDE",
  "message": "User does not have authority to override blockers"
}
```

### Authentication Requirements

- Authenticated user
- PM or higher authority

### Rate Limits

- Standard tenant API limit

### Versioning Strategy

- Override records immutable after creation

---

## 3.12 Generate Ready-to-Build Package

### Endpoint

`/api/v1/projects/{projectId}/certification-package`

### Method

`POST`

### Description

Generates the Ready-to-Build certification package.

### Request Schema

```json
{
  "includeTraceabilityMatrix": true,
  "includeApprovals": true,
  "includeRisks": true,
  "includeOverrides": true
}
```

### Response Schema

```json
{
  "packageId": "string",
  "status": "Generated",
  "downloadUrl": "string",
  "generatedAt": "datetime"
}
```

### Error Responses

```json
{
  "error": "PROJECT_NOT_READY",
  "message": "Project is not Ready-to-Build"
}
```

### Authentication Requirements

- Authenticated user
- Project read/export permission

### Rate Limits

- Package generation limits may apply

### Versioning Strategy

- Package schema version included in generated artifact metadata

---

## 3.13 Export to Jira

### Endpoint

`/api/v1/projects/{projectId}/integrations/jira/export`

### Method

`POST`

### Description

Exports approved requirements into Jira as structured epics/stories after Ready-to-Build certification.

### Request Schema

```json
{
  "jiraProjectKey": "string",
  "exportMode": "CreateEpicsAndStories",
  "includeTraceabilityLinks": true
}
```

### Response Schema

```json
{
  "exportJobId": "string",
  "status": "Queued",
  "jiraProjectKey": "string"
}
```

### Error Responses

```json
{
  "error": "PROJECT_NOT_READY",
  "message": "Jira export is blocked until Ready-to-Build status is achieved"
}
```

### Authentication Requirements

- Authenticated user
- Project export permission
- Jira integration configured

### Rate Limits

- Tenant API limits
- Jira API limits apply

### Versioning Strategy

- Jira mapping version included as `jiraMappingVersion`

---

## 3.14 Get Jira Export Status

### Endpoint

`/api/v1/projects/{projectId}/integrations/jira/export-jobs/{exportJobId}`

### Method

`GET`

### Description

Returns status and results of a Jira export job.

### Request Schema

None

### Response Schema

```json
{
  "exportJobId": "string",
  "status": "Completed",
  "createdIssues": [
    {
      "objectId": "string",
      "jiraIssueKey": "PROJ-123",
      "issueType": "Story",
      "traceabilityUrl": "string"
    }
  ],
  "errors": []
}
```

### Error Responses

```json
{
  "error": "JIRA_EXPORT_FAILED",
  "message": "One or more Jira issues failed to create"
}
```

### Authentication Requirements

- Authenticated user
- Project read/export permission

### Rate Limits

- Standard tenant API limits
- Jira API limits apply

### Versioning Strategy

- Export job response stable in `/v1`

---

# 4. External System Interfaces

## 4.1 Jira Interface

### Purpose

Enable controlled handoff from readiness platform to execution layer.

### Direction

Platform → Jira

### Interface Type

REST API integration

### Key Behaviors

- Jira export blocked until Ready-to-Build
- Approved requirements become epics/stories
- Traceability links preserved
- Version and approval metadata included where supported

### Failure Handling

- Retry failed exports
- Report partial failures
- Preserve certification package
- Provide downloadable fallback export

---

## 4.2 Identity Provider Interface

### Purpose

Enterprise authentication and role mapping.

### Direction

Identity Provider → Platform

### Interface Type

SAML / OIDC

### Key Behaviors

- SSO login
- User identity mapping
- Tenant membership mapping
- Role assignment support

### Failure Handling

- Deny access if identity cannot be validated
- Log authentication failures
- Support admin recovery workflows

---

## 4.3 AI Model / AI Service Interface

### Purpose

Generate draft workflows, requirements, risks, assumptions, and structured exports.

### Direction

Platform ↔ AI Service

### Interface Type

Internal service API or external model API

### Key Behaviors

- AI generates drafts only
- AI never approves, overrides, or owns decisions
- AI outputs are versioned and human-reviewable

### Failure Handling

- Manual workflow allowed if AI unavailable
- AI errors surfaced clearly
- Retry supported where appropriate

---

## 4.4 Document Storage Interface

### Purpose

Store source documents and generated certification packages.

### Direction

Platform ↔ Storage Service

### Interface Type

Object storage API

### Key Behaviors

- Store uploaded files
- Store generated packages
- Support encrypted storage
- Support tenant isolation

### Failure Handling

- Prevent document loss
- Retry transient failures
- Alert on persistent storage failure

---

# 5. Assumptions

- Jira is the primary execution-layer integration for MVP.
- AI-generated content is always draft content requiring human validation.
- API consumers are internal frontend clients and authorized integration services.
- Enterprise authentication will use SAML or OIDC.
- API versioning will initially use path-based major versions.
- Tenant-level rate limits will be configurable.

---

# 6. Risks

- Jira customer configurations may vary significantly and complicate export mapping.
- AI output schema changes could break downstream workflows if not versioned carefully.
- Readiness rules may become complex and require explicit rule versioning.
- API permissions must be strict to prevent unauthorized approvals or overrides.
- Large document uploads may require async handling and robust retry behavior.
- Air-gapped deployments may require replacing external APIs with local services.

---

# 7. Open Questions

1. What exact Jira issue hierarchy should be generated for MVP?
2. Should Jira export support bidirectional sync or one-way export only?
3. What file size and file type limits should apply to document upload?
4. Should readiness rules be configurable per tenant or fixed for MVP?
5. Should external customers access APIs directly or only through the UI?
6. How should AI prompt/version metadata be exposed for auditability?
7. Should certification packages be generated as PDF, DOCX, JSON, or all three?
8. What rate limits are acceptable for enterprise tenants?
