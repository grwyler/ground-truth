import { JIRA_EXPORT_STATUSES } from "../../../domain/src/index.js";

export function createMockJiraAdapter() {
  return Object.freeze({
    exportPreview(preview, input = {}) {
      const jiraProjectKey = preview.jiraProjectKey;

      if (input.simulateFailure === true || jiraProjectKey === "FAIL") {
        return Object.freeze({
          status: JIRA_EXPORT_STATUSES.FAILED,
          createdIssues: Object.freeze([]),
          errors: Object.freeze([
            Object.freeze({
              code: "JIRA_EXPORT_FAILED",
              message: "Mock Jira export failed before creating issues."
            })
          ]),
          errorSummary: "JIRA_EXPORT_FAILED"
        });
      }

      if (jiraProjectKey === "PARTIAL") {
        return Object.freeze({
          status: JIRA_EXPORT_STATUSES.PARTIAL,
          createdIssues: Object.freeze(
            preview.issues.slice(0, 1).map((issue, index) => toCreatedIssue(issue, jiraProjectKey, index))
          ),
          errors: Object.freeze([
            Object.freeze({
              code: "JIRA_EXPORT_PARTIAL",
              message: "Mock Jira export created only part of the preview."
            })
          ]),
          errorSummary: "JIRA_EXPORT_PARTIAL"
        });
      }

      return Object.freeze({
        status: JIRA_EXPORT_STATUSES.COMPLETED,
        createdIssues: Object.freeze(
          preview.issues.map((issue, index) => toCreatedIssue(issue, jiraProjectKey, index))
        ),
        errors: Object.freeze([]),
        errorSummary: null
      });
    }
  });
}

function toCreatedIssue(issue, jiraProjectKey, index) {
  return Object.freeze({
    objectId: issue.objectId,
    jiraIssueKey: `${jiraProjectKey}-${index + 1}`,
    issueType: issue.issueType,
    traceabilityUrl: `local://jira/${jiraProjectKey}/${issue.sourceRequirementId}`,
    sourceRequirementId: issue.sourceRequirementId,
    versionId: issue.versionId,
    workflowLink: issue.workflowLink,
    acceptanceCriteriaLink: issue.acceptanceCriteriaLink,
    approvalMetadata: issue.approvalMetadata
  });
}
