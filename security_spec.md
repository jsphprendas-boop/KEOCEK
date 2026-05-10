# Security Specification - INTENDENCIA AUTONOMA

## Data Invariants
1. A user can only access data if they belong to the specific delegation or are a SuperAdmin.
2. System config is publicly readable but only writable by SuperAdmins.
3. Users can only update their own profile (limited fields) or be updated by SuperAdmins.
4. Data integrity: Every write to `main_db` must follow the expected schema.

## The Dirty Dozen (Potential Attacks)
1. **Identity Spoofing**: User A trying to read Delegation B's `main_db`.
2. **Role Escalation**: User A (cook) trying to write to `main_db` (restricted to admins).
3. **Ghost Fields**: Injecting metadata into the `users` array to bypass approval.
4. **ID Poisoning**: Injecting massive strings as delegation IDs.
5. **PII Leak**: Accessing other users' emails without authorization.
6. **Master Admin Lockout**: Trying to change the Master Admin's role.
7. **Resource Exhaustion**: Sending 1MB of junk data to a small doc.
8. **Unauthorized System Write**: Trying to modify `global_config` as a normal user.
9. **Fake Approval**: Manually setting `isApproved: true` on own profile.
10. **Shadow Delegation**: Creating a delegation without being a SuperAdmin.
11. **Revocation Bypass**: Accessing data after `isApproved` becomes `false`.
12. **Audit Log Tampering**: Deleting or modifying `main_db_data_2` (audit logs) as a regular user.

## Implementation Details
We will use strict role-checking functions:
- `isSignedIn()`
- `isSuperAdmin()`
- `isDelegationMember(delId)`
- `isDelegationAdmin(delId)`
