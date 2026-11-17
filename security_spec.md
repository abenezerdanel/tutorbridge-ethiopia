# Security Specification — TutorBridge Ethiopia

## 1. Data Invariants
1. **No Self-Assigned Admin or Verified Status**: A user registering via `/users/{userId}` can only choose `role` in `['parent', 'tutor', 'trainer', 'organization']`. Setting `role: 'admin'` on client creation is forbidden. Similarly, creating `/tutors/{tutorId}` or `/corporate_trainers/{trainerId}` requires `status: 'pending'` and `isVerified: false` unless performed by a verified Administrator.
2. **PII Isolation**: Private contact details (`email`, `phone`, residential address) reside strictly in `/users/{userId}` (owner + admin read only) and `/tutor_documents/{docId}` (owner + admin read only). Public `/tutors/{tutorId}` and `/corporate_trainers/{trainerId}` contain only non-sensitive professional profiles and are publicly readable only when `status == 'approved'`.
3. **Child Safety & Guardian Oversight Isolation**: `/students/{studentId}` contains minor details and is strictly readable and writable only by the owning `parentId == request.auth.uid` or verified Administrators. Any `/conversations/{id}` with `conversationType == 'student_tutor'` MUST include a valid `guardianUid` in `participantUids`.
4. **Booking, Corporate Contract & Payment Integrity**: Bookings always initialize as `status: 'pending_tutor'` and `paymentStatus: 'unpaid'`. Parents cannot self-confirm bookings or mark payments `verified`. Only verified Administrators can mark payments or corporate invoices `verified`/`paid` or `refunded`. Terminal booking states (`completed`, `cancelled`) are locked against non-admin mutation.
5. **Temporal & Relational Integrity**: Every `create` requires `createdAt == request.time` and `updatedAt == request.time`. Every `update` requires `updatedAt == request.time`, immutable `createdAt`, and immutable ownership IDs (`parentId`, `userId`, `tutorId`, `ownerUid`).
6. **Admin Bootstrapping & Verified Email**: Admin privileges require either `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` or verified email `abenezerdaniel69@gmail.com` with `request.auth.token.email_verified == true`.
7. **Contact Protection & Anti-Bypass Messaging Integrity**:
   - All `/messages/{messageId}` writes from non-admin users must pass `containsProhibitedContact(incoming().text) == false`, blocking direct phone numbers, emails, messaging/meeting links, social handles, and unapproved external URLs even if a client bypasses the Express `/api/messages/send` endpoint.
   - Public profile text fields on `/tutors/{tutorId}` (`headline`, `bio`, `qualifications`) and `/corporate_trainers/{trainerId}` (`headline`, `qualifications`, `methodology`) also enforce `!containsProhibitedContact(...)` for non-admin writes.
   - Users with an active `temp_restricted` or `suspended_review` status in `/messaging_restrictions/{uid}` are denied message creation at the database rules layer (`isNotRestrictedFromMessaging()`).
   - Users cannot self-lift restrictions, decrement `violationCount`, or self-approve appeals; only Administrators can resolve appeals, lift restrictions, approve exceptions, or write to `/moderation_actions/{actionId}` and `/platform_moderation_settings/{settingId}`.

## 2. Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Privilege Escalation on User Create**: Authenticated user creates `/users/{uid}` with `{ role: 'admin' }`.
2. **Role Mutation Shadow Update**: Existing parent updates `/users/{uid}` changing `role` to `'admin'`.
3. **Self-Approved Tutor Profile**: Non-admin user creates `/tutors/{id}` with `{ status: 'approved', isVerified: true }`.
4. **Unapproved Tutor Public Read**: Unauthenticated or non-owner user queries or gets `/tutors/{id}` where `status == 'pending'`.
5. **PII Scrape on Users**: Signed-in user reads `/users/{otherUid}` belonging to another family or trainer.
6. **Minor Data Leak**: Signed-in tutor attempts to read `/students/{studentId}` belonging to a parent.
7. **ID Poisoning**: Attacker sends a 2KB random string as document ID to `/bookings/{oversizedId}`.
8. **Ghost Field Shadow Update**: Tutor updates `/tutors/{id}` including `{ headline: 'Math', isVerified: true }`.
9. **Parent Self-Confirming Payment**: Parent creates `/payments/{id}` with `{ status: 'verified' }`.
10. **Terminal Booking Tampering**: Parent or tutor tries to modify a booking whose `status` is already `'completed'`.
11. **Spoofed Unverified Email Admin**: Token has `email: 'abenezerdaniel69@gmail.com'` with `email_verified: false` attempting admin write.
12. **Client-Forged Timestamp**: Client creates `/tutor_requests/{id}` with a backdated `createdAt` instead of `request.time`.
13. **Direct SDK Contact Leak Bypass**: Non-admin user attempts direct write to `/messages/{id}` containing `+251 91 122 3344`, `abebe@gmail.com`, or `https://wa.me/251911223344`.
14. **Self-Lifted Messaging Restriction**: Restricted user updates `/messaging_restrictions/{uid}` setting `status: 'lifted'` or `appealStatus: 'approved'`.
15. **Restricted User Message Send**: User with active `temp_restricted` restriction creates a document in `/messages/{id}`.
16. **Unsupervised Student-Tutor Thread**: User creates `/conversations/{id}` with `conversationType: 'student_tutor'` without `guardianUid` in `participantUids`.
17. **Cross-User Conversation Eavesdrop**: Signed-in user not listed in `participantUids` reads `/conversations/{id}` or `/messages/{id}`.
18. **Profile Bio Contact Injection**: Tutor updates `/tutors/{id}` setting `bio` to include a personal email or WhatsApp link.
19. **Direct Organization-to-Trainer Channel Creation**: Organization or trainer creates a `/conversations/{id}` document with `conversationType: 'organization_trainer'` or sends a message in one.
20. **Organization Reading Separate Trainer Contract**: Organization owner attempts `get`/`list` on `/trainer_assignment_agreements/{id}` or `/trainer_compensation_records/{id}`.
21. **Organization Reading Trainer Compensation Negotiation**: Organization owner queries `/corporate_negotiations` for documents with `targetType == 'trainer_compensation'`.
22. **Trainer Self-Approving Portfolio Sample**: Trainer creates `/trainer_portfolio_items/{id}` with `status: 'approved'` or attempts to update `status`.
23. **Organization Auto-Approving Selection Request**: Organization creates `/trainer_selection_requests/{id}` with `status: 'approved'` instead of `'pending_tutorbridge_review'`.
24. **Unauthenticated Corporate Trainer Directory Access**: Unauthenticated caller queries `/corporate_trainers` without signing in.

