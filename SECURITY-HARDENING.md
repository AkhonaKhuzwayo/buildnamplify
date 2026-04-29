# Security Hardening Checklist and Runbook

## Password and Account Controls
- Never store plaintext passwords in Firestore or client storage.
- Use Firebase Auth as the only password authority.
- Enforce forced password reset for privileged users (admin and official) on first sign-in.
- Keep optional password setup flow for guest users.
- Enforce minimum password lengths:
  - Admin/Official: 8+ (recommended 12+)
  - Guest: 8+
- Enable MFA for admin accounts in Firebase Authentication.

## Login Abuse Controls
- Use login cooldown in client UX after repeated failures.
- Monitor `auth/too-many-requests` signals in logs.
- Add Cloud Logging alerts for abnormal failed-login spikes.

## Firestore Rules
- Keep deny-by-default baseline.
- Limit profile writes to self, admin-only elevation for role/status changes.
- Validate document schemas (`type`, `size`, allowed enum values).
- Restrict metrics/admin collections to least privilege.

## Storage Rules
- Restrict uploads to `documents/{userId}/{fileName}`.
- Require authenticated user to match `{userId}` for writes.
- Enforce file constraints:
  - Max size: 5 MB
  - Types: `image/*`, `application/pdf`
- Deny all non-explicit paths.

## App and Client Hardening
- Avoid logging PII/auth-sensitive values in production logs.
- Use generic error messages for auth failures.
- Do not expose internal error stack traces to users.
- Keep dependency updates current and patch critical CVEs quickly.

## Deployment and Operations
- Separate environments: dev, staging, prod.
- Use least-privilege IAM roles for Firebase project access.
- Enable audit logs and alerting for risky events.
- Backup Firestore and test restore procedure quarterly.

## Incident Runbook
1. Detect: confirm suspicious event from logs/alerts.
2. Contain: disable affected users and revoke sessions.
3. Eradicate: patch rules/code path used in incident.
4. Recover: restore service and verify integrity.
5. Review: document timeline, root cause, prevention actions.

## Quarterly Security Review
- Review all Firestore and Storage rules.
- Review role assignment and dormant accounts.
- Validate first-login password reset behavior.
- Run penetration checks on login, profile, document upload, and admin controls.
