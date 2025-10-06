# Privacy & Data Handling - Technical Reference

**Purpose:** This document provides technical details about data collection, storage, retention, and deletion in the Evaluation Planner application. Use this as a reference when drafting or updating the privacy policy.

**Last Updated:** October 6, 2025

---

## Data Retention Policies

### Job Data (User Submissions & Generated Reports)
- **Retention Period:** 6 hours after completion or failure
- **Automatic Deletion:** Yes, runs every hour via `cleanupOldJobs()`
- **What Gets Deleted:** 
  - All input data (organization name, program name, descriptions, scraped web content)
  - All output data (AI analysis, evaluation frameworks, HTML reports)
  - Job metadata (status, timestamps, errors)
- **Permanent Storage:** None - all job data is temporary
- **User Access Window:** Users can access their results via API for 6 hours after completion

### Admin Session Data
- **Retention Period:** 24 hours from login
- **Automatic Deletion:** Yes, runs every hour via `cleanupExpiredSessions()`
- **Storage Location:** PostgreSQL database (sessions table)
- **What Gets Stored:** Session token (64-char hex), creation timestamp, expiration timestamp, last access timestamp
- **Persistent Across Restarts:** Yes (database-backed as of Oct 2025)

### AI Prompt Templates (Admin Data)
- **Retention Period:** Indefinite (operational data)
- **Version History:** Stored indefinitely for rollback capability
- **Access:** Admin-only (password-protected)

---

## Data Types & Storage

### 1. Jobs Table (Temporary - 6 Hour Retention)

**What We Store:**
- `job_type`: Type of analysis (prompt1, prompt2, report_template)
- `status`: Current job status (pending, processing, completed, failed)
- `input_data` (JSON):
  - Program name
  - Organization name
  - Program description
  - URLs provided by user
  - Full scraped website content (text only)
  - Metadata fields
- `result_data` (JSON):
  - AI-generated program analysis
  - AI-generated evaluation frameworks
  - Complete HTML evaluation reports
- `email`: User's email address (for delivery notification)
- `error`: Error messages if job fails
- `created_at`: When job was created
- `completed_at`: When job finished

**Access Control:**
- ❌ **Not authenticated** - Anyone with job ID can access
- Job IDs are auto-incrementing integers (sequential)
- Acts as "security through obscurity" - IDs are not publicly listed

**Why We Store This:**
- Enable status polling while AI processes data (30-60+ seconds)
- Allow users to retrieve results if browser closes
- Support email delivery of completed reports

### 2. Sessions Table (24 Hour Retention)

**What We Store:**
- `token`: Cryptographically secure session token (64 characters)
- `created_at`: Session creation time
- `expires_at`: When session will expire (24 hours)
- `last_accessed_at`: Most recent activity timestamp

**Access Control:**
- ✅ Admin-only (password-protected)
- Used for admin panel authentication

**Why We Store This:**
- Secure admin authentication
- Prevent unauthorized access to AI prompts and settings

### 3. Prompts Table (Indefinite Retention)

**What We Store:**
- AI prompt templates (markdown text)
- Prompt configuration (step name, display name, descriptions)
- Version history for rollback capability

**Access Control:**
- ✅ Admin-only (password-protected)

**Why We Store This:**
- Core operational data
- Version control for AI behavior

### 4. Settings Table (Indefinite Retention)

**What We Store:**
- OpenRouter API key (encrypted in transit, stored as-is)
- AI model configurations (which models to use for each step)
- Temperature settings for AI models
- Email delivery template

**Access Control:**
- ✅ Admin-only (password-protected)

**Why We Store This:**
- Core operational configuration
- Enables admin to update settings without code changes

---

## Third-Party Data Sharing

### 1. OpenRouter (AI Processing)
**Data Sent:**
- Program name, organization name, descriptions
- Scraped website content
- Previous AI analysis results (for later steps)

**Purpose:** Generate AI-powered program analysis and evaluation frameworks

**Retention by OpenRouter:** Per their privacy policy (not controlled by us)

**API Key Storage:** Stored in database settings table, never exposed to frontend

### 2. Resend (Email Delivery)
**Data Sent:**
- Recipient email address
- Email subject line
- Email body (program name, organization name, completion timestamp)
- HTML report attachment

**Purpose:** Deliver completed evaluation reports to users

**Retention by Resend:** Per their privacy policy (not controlled by us)

**Configuration:** Managed via Replit integration

### 3. PostgreSQL/Neon (Database)
**Data Sent:** All data described in "Data Types & Storage" section above

**Purpose:** Application database (job queue, sessions, prompts, settings)

**Encryption:** In transit via SSL, at rest per Neon's security practices

**Access:** Via Replit environment variable (DATABASE_URL)

### 4. CORS Proxy (Web Scraping)
**Data Sent:**
- URLs provided by users
- HTTP headers

**Data Received:**
- Public website content (text only, HTML stripped)

**Purpose:** Scrape publicly accessible web content for AI analysis

**No User Data Sent:** Only URLs are transmitted

---

## Automatic Cleanup Mechanisms

### Job Cleanup (Every Hour)
```javascript
// Deletes jobs older than 6 hours
DELETE FROM jobs 
WHERE (status = 'completed' OR status = 'failed') 
AND completed_at < (NOW() - INTERVAL '6 hours')
```

### Session Cleanup (Every Hour)
```javascript
// Deletes expired sessions
DELETE FROM sessions 
WHERE expires_at < NOW()
```

### Startup Cleanup (On Server Start)
- Runs `cleanupExpiredSessions()` immediately on startup
- Ensures no stale sessions remain after server restarts

---

## Email Delivery Details

### What Gets Sent via Email

**Email Body:**
- Program name
- Organization name  
- Completion timestamp
- Brief message (from admin-configurable `email_delivery` template)

**Email Attachment:**
- Complete HTML evaluation report
- Filename: `OrganizationName_ProgramName_Evaluation_Plan.html`

**Email Subject:**
- Format: "Evaluation Plan for [Program Name]"

**When Emails Are Sent:**
- Only for final `report_template` jobs (not intermediate AI steps)
- Sent immediately upon job completion

**Email Retention:**
- Emails exist in user's inbox (not controlled by us)
- Job data deleted from our database after 6 hours
- Users keep the email and attachment permanently (their choice)

---

## User Data Access & Control

### Can Users Access Their Data?
**During Processing & 6-Hour Window:**
- ✅ Yes, via `GET /api/jobs/:id` endpoint
- Returns full job status and results
- No authentication required (job ID acts as access token)

**After 6 Hours:**
- ❌ No, data is permanently deleted from database
- ✅ Users still have emailed report in their inbox

### Can Users Delete Their Data?
**Current Implementation:**
- ❌ No manual deletion endpoint exists
- ✅ Automatic deletion after 6 hours guaranteed
- If user wants immediate deletion, admin could manually delete from database

**Recommendation for Privacy Policy:**
- State that data is automatically deleted after 6 hours
- Offer manual deletion on request (would require admin action)

### Can Users Export Their Data?
- ✅ Yes, implicitly - they receive HTML report via email
- ✅ API endpoint returns full results as JSON
- Users can save/download their own data within 6-hour window

---

## Browser & Frontend Data

### Local Storage
**Currently Used:** Yes, for session tokens

**What's Stored:**
- `adminSessionToken`: Admin session token (if logged in as admin)
- `adminSessionExpiry`: Session expiration timestamp

**Retention:** Until logout or 24 hours (whichever comes first)

**Cleared On:** Logout, manual browser clear, or expiration

### Cookies
**Currently Used:** No - application does not use cookies

### Browser Session Storage
**Currently Used:** No

---

## Security Practices

### Data in Transit
- ✅ HTTPS enforced (Replit deployment)
- ✅ Database connections via SSL (PostgreSQL)
- ✅ API calls to OpenRouter via HTTPS

### Data at Rest
- Database encryption per Neon/PostgreSQL provider
- No additional encryption layer (plain text in database)
- API keys stored as plain text in database settings table

### Authentication
- Admin panel: Password-protected (ADMIN_PASSWORD environment variable)
- API endpoints: Most are public (job endpoints, prompt endpoints)
- Protected endpoints: Admin prompts/settings modifications

### API Key Management
- Backend proxy architecture (keys never exposed to frontend)
- Three-tier fallback: Database → Environment Variables → Error
- Admin can update via UI without code changes

---

## Compliance Considerations

### GDPR (European Users)
**Right to Access:** Users can access their data via API for 6 hours

**Right to Deletion:** Automatic deletion after 6 hours (can offer manual deletion on request)

**Right to Portability:** Users receive HTML report via email (portable format)

**Data Minimization:** Only collect what's needed for report generation

**Consent:** Should obtain consent before collecting program data

**Breach Notification:** No sensitive personal data stored (unless user includes it in program descriptions)

### CCPA (California Users)
**Right to Know:** Document what data is collected (this file helps with that)

**Right to Delete:** Automatic deletion after 6 hours

**Right to Opt-Out:** Consider adding opt-out of data collection

**Do Not Sell:** We don't sell user data (OpenRouter processing is not "selling")

### Data Minimization Principles
- ✅ Only store data needed for service functionality
- ✅ Automatic deletion ensures data isn't kept longer than necessary
- ✅ No user accounts or profiles stored
- ✅ No tracking or analytics data collected

---

## Privacy Policy Recommendations

**Based on this technical documentation, the privacy policy should:**

1. **Clearly state 6-hour retention period** for job data
2. **List all third-party services** (OpenRouter, Resend, PostgreSQL/Neon)
3. **Explain data sharing with OpenRouter** for AI processing
4. **Describe email delivery process** and what's included
5. **Note that job IDs are not authenticated** (anyone with ID can access)
6. **Explain automatic deletion mechanisms**
7. **Offer manual deletion on request** (if feasible)
8. **Include contact information** for privacy questions
9. **State jurisdiction and applicable laws** (GDPR, CCPA, etc.)
10. **Obtain user consent** before data collection (checkbox on form?)

---

## Future Privacy Enhancements to Consider

### Short-Term (Low Effort)
- [ ] Add UUID-based job IDs instead of sequential integers (better security)
- [ ] Add authentication to job endpoint (require email verification?)
- [ ] Add manual job deletion endpoint (`DELETE /api/jobs/:id`)
- [ ] Add "Do Not Email" option for users who only want browser results

### Medium-Term (Medium Effort)
- [ ] Add audit logging for admin actions
- [ ] Implement rate limiting on job creation (prevent abuse)
- [ ] Add data export endpoint (JSON download of all job data)
- [ ] Encrypt sensitive fields at rest (API keys, scraped content)

### Long-Term (High Effort)
- [ ] User accounts with persistent data storage (opt-in)
- [ ] Granular data retention settings per user
- [ ] Self-service data deletion portal
- [ ] Compliance dashboard for GDPR/CCPA requests
- [ ] End-to-end encryption for job data

---

## Questions for Legal/Compliance Review

1. **Is 6-hour retention sufficient for our users, or should we offer longer?**
2. **Do we need explicit consent checkboxes before collecting data?**
3. **Should we add a "Privacy Policy Accepted" timestamp to jobs table?**
4. **Is our OpenRouter data sharing compliant with GDPR's data processor requirements?**
5. **Should we sign Data Processing Agreements (DPAs) with OpenRouter and Resend?**
6. **Do we need a cookie consent banner? (Currently no cookies, but may change)**
7. **Should job IDs be authenticated to prevent unauthorized access?**
8. **What's our breach notification process if database is compromised?**

---

## Change Log

### October 6, 2025
- Initial documentation created
- Documented 6-hour job retention policy
- Documented 24-hour session retention policy
- Listed all third-party data sharing
- Identified security considerations for job ID access

### Future Updates
- Update this document whenever data handling changes
- Review after adding new features that collect/process data
- Update before significant product launches or regulatory changes
