# Finder — Claim & Retrieval Flow

Complete reference for the lost-and-found item lifecycle from posting through return.
Last updated to reflect Batch 2 feature additions.

---

## 1. Item Status State Machine

```
                  ┌─────────┐
                  │ waiting │  ← item posted by finder
                  └────┬────┘
                       │ claimant submits claim
                       │ (status stays "waiting"; claim_requests row = "pending")
                       │
                       │ finder accepts a claim
                       ▼
               ┌───────────────┐
               │ claim_accepted │
               └───────┬───────┘
                       │ finder confirms physical handoff
                       ▼
               ┌────────────────┐
               │   handed_off   │
               └───────┬────────┘
                       │
           ┌───────────┴────────────┐
           │                        │
           │ claimant confirms       │ claimant disputes
           ▼ receipt                 ▼
      ┌──────────┐           ┌──────────────┐
      │ (deleted) │           │   disputed   │
      └──────────┘           └──────┬───────┘
                                    │
                      ┌─────────────┴────────────┐
                      │                          │
              admin resolves               admin dismisses
              for claimant                 (→ claim_accepted)
                      │
                  (deleted)
```

Additional transitions:
- Any `waiting` item can be deleted by the finder (Case A).
- `waiting` items with pending claims can be deleted after notifying claimants (Case B).
- `claim_accepted` items can be deleted after notifying the accepted claimant (Case C).
- `handed_off` and `disputed` items **cannot** be deleted by the finder (Case D).
- `claim_accepted` items revert to `waiting` after 7 days with no handoff (cron).
- `handed_off` items are auto-deleted after 48 hours with no claimant confirmation (cron).

---

## 2. Step-by-Step Flow

### Step 1 — Claimant submits a claim

**What the claimant sees:**
- On any found-item detail page (`/items/[id]`), a "This is mine" button appears if:
  - The item status is `waiting`
  - The user has not already submitted a claim for this item
  - The user has fewer than 2 active claims (pending + accepted + cancelled-within-24h)
  - The user has never been rejected on this item
- Clicking opens a modal with a proof-of-ownership textarea (min 20 chars, character counter shown) and optional image upload.

**DB changes:**
- New row inserted into `claim_requests`: `{ item_id, claimant_id, claimant_name, claimant_email, description_proof, proof_image_url, status: "pending" }`
- Item status is NOT changed at this step.

**Emails sent:**
- → Finder (`claim-submitted` route): "Someone claimed your item on Finder"

**What the admin sees:**
- Nothing at this step.

---

### Step 2 — Finder reviews and accepts or rejects a claim

**What the finder sees:**
- A "View Claims (N)" button on the item detail page when the item has pending claims.
- Clicking opens a modal listing all pending claimants with their name, date, proof text, optional proof image, and per-claim Accept / Reject buttons.
- Each claim card also has a "Message Claimant" toggle that expands a textarea to send a direct email to that claimant via the `admin-message` route.
- Rejecting opens an inline textarea for a required rejection reason, then a "Confirm Reject" button.

**DB changes on Accept:**
- Item updated: `{ status: "claim_accepted", accepted_claimant_id, accepted_claimant_email, accepted_claimant_name, claim_accepted_at }`
- Accepted `claim_requests` row: status → `"accepted"`
- All other pending claims for this item: status → `"rejected"`, `rejection_reason: "Another claim was accepted for this item."`

**DB changes on Reject:**
- Rejected `claim_requests` row: status → `"rejected"`, rejection_reason set to finder's typed reason
- `rejection_count` on the item is incremented
- If `rejection_count >= 5`, a row is inserted into the `reports` table flagging possible finder misconduct

**Emails sent:**
- On Accept → accepted claimant (`claim-accepted` route): "Your claim was accepted!"
- On Accept → each auto-rejected claimant (`claim-rejected` route): "Update on your claim" with reason "Another claim was accepted"
- On Reject → rejected claimant (`claim-rejected` route): "Update on your claim" with finder's reason

**What the admin sees:**
- If 5+ claims are rejected on one item, the item appears in Reports → Items panel.

---

### Step 3 — Finder confirms physical handoff

**What the finder sees:**
- When item status is `claim_accepted`, a banner appears on the item detail page:
  "You accepted {name}'s claim. Once you physically hand it back, confirm below."
- A "Confirm I Handed It Back" button.

**DB changes:**
- Item updated: `{ status: "handed_off", handoff_confirmed_by_poster: true, handed_off_at: now }`

**Emails sent:**
- → Accepted claimant (`handoff-confirmed` route): "Please confirm you received {item}" (48-hour warning)

**What the admin sees:**
- Nothing at this step.

---

### Step 4 — Claimant confirms receipt or opens a dispute

**What the claimant sees:**
- When item status is `handed_off`, a banner appears:
  "The finder confirmed handoff. Please confirm you received it."
- Two buttons: "Confirm I Received It" and "Dispute".

**On Confirm Receipt:**
- DB changes: item is hard-deleted
- No email sent

**On Dispute:**
- Opens a modal with a dispute textarea (min 50 chars)
- DB changes: new row in `disputes` table; item status → `"disputed"`
- Email sent → all approved admins (`dispute-filed` route): includes item image, description, finder info, claimant email, and dispute reason, plus links to the item and admin dashboard

**What the admin sees:**
- Disputed items appear in Reports → Disputes panel with options to Resolve for Claimant (delete item) or Dismiss (revert to `claim_accepted`).
- Admin can message either the claimant or the finder from within the Disputes panel using the "Message Parties" button.

---

## 3. Deletion Rules (handleDelete — Cases A/B/C/D)

| Case | Condition | What happens |
|------|-----------|-------------|
| **A** | `waiting` status, no pending claims | Item deleted silently |
| **B** | `waiting` status, pending claims exist | Confirm dialog → notify each pending claimant → delete item |
| **C** | `claim_accepted` status | Confirm dialog → notify accepted claimant → delete item |
| **D** | `handed_off` or `disputed` status | Alert shown, deletion blocked, trash button hidden in UI |

Applies to both `items/[id]/page.tsx` (item detail page) and `dashboard/page.tsx` (dashboard card).

---

## 4. Edge Cases & Guards

### Rate limiting (2 active claims max)
A user cannot submit more than 2 simultaneous claims. The count is calculated as: pending claims + accepted claims + claims cancelled within the last 24 hours. If this total is ≥ 2, the "This is mine" button is disabled.

### Re-claim prevention after rejection
If a user has ever had a claim rejected on a specific item, they cannot re-submit a claim for that item. The check is: any `claim_requests` row for this `item_id` + `claimant_id` with status `"rejected"`.

### 7-day claim expiry (expire-claims cron)
When a `claim_accepted` item has no finder handoff confirmation within 7 days:
- Item reverts to `waiting`
- Accepted claim is marked `expired`
- Claimant is emailed via Resend
- Auto-rejected claims with reason "Another claim was accepted for this item." revert to `pending` (so legitimate claimants can still be considered)

### 48-hour handoff auto-complete (expire-claims cron)
When a `handed_off` item has no claimant receipt confirmation within 48 hours:
- Item is hard-deleted
- Claimant is emailed via Resend confirming auto-completion

### Dispute cooldown
None. There is no cooldown on disputes. The earlier `dispute_cooldowns` table logic was removed.

---

## 5. Email Routes

All routes live under `/app/api/emails/`. All use Resend (`RESEND_API_KEY`) server-side.

| Route | Trigger | Recipient |
|-------|---------|-----------|
| `claim-submitted` | Claimant submits a claim | Finder |
| `claim-accepted` | Finder accepts a claim | Accepted claimant |
| `claim-rejected` | Finder rejects a claim; or auto-rejected when another claim accepted; or item deleted with pending/accepted claims | Rejected or cancelled claimant |
| `handoff-confirmed` | Finder confirms physical handoff | Accepted claimant |
| `dispute-filed` | Claimant opens a dispute | All approved admins (queried from `admins` table; falls back to `NEXT_PUBLIC_ADMIN_EMAIL`) |
| `admin-message` | Admin sends message from Disputes panel; or finder messages a claimant from claims review modal | Target (claimant or finder) |
| `item-retrieval` | Legacy "I want to retrieve this" button (pre-claim flow, still present) | Finder |
| `admin-approved` | Super-admin approves an admin request | New admin |
| `school-approved` | Super-admin approves a school | School representative |
| `expire-claims` (Resend, not a route file) | Cron: 7-day expiry or 48h auto-complete | Claimant |

Cron route: `GET /api/expire-claims` — requires `x-cron-secret` header matching `CRON_SECRET` env var.

---

## 6. Admin Capabilities

In the Reports → Disputes panel (`dashboard/page.tsx` → `DisputesPanel`):

- **View all disputes** — shows item name, dispute reason, claimant email, date
- **Resolve for Claimant** — deletes the item listing entirely (hard delete); removes the dispute row
- **Dismiss Dispute** — reverts item to `claim_accepted` so the finder can re-confirm handoff; removes the dispute row
- **Message Parties** — expands a panel with a segmented toggle (Claimant / Finder) and a textarea; sends an email via `/api/emails/admin-message` to whichever party is selected, addressed by their name

Finder capability in the claims review modal (`items/[id]/page.tsx`):
- **Message Claimant** — expands a textarea per claim card; sends an email via `/api/emails/admin-message` to that specific claimant

---

## 7. Known Loose Ends

1. **Claimant name not in disputes table.** The `disputes` table stores `claimant_email` and `claimant_id` but not `claimant_name`. When the admin sends a message to the claimant, the email's `to_name` field uses `claimant_email` as the display name instead of their real name.

2. **Finder info not in disputes table.** The `disputes` table has no finder columns. The DisputesPanel fetches finder info via a Supabase join `disputes.select("*, items(author_id, author_name, author_email)")`. If the item was already deleted before the dispute row is read, this join returns `null` and the "Message Finder" send will silently fail (no `targetEmail`).

3. **claimedByMonth chart data is always zero.** The bar chart's "Claimed" dataset is computed by filtering the live `items` context for `status === "claimed"`. Items are hard-deleted on completion, so no historical data survives in context. The pie chart total (`totalClaimed`) is now correct (sourced from `claim_requests` via DB count), but the per-month bar chart breakdown remains flat. Fixing this would require a `completions` audit log table.

4. **Rate-limit window uses client-side time.** The 24-hour cancel window for rate limiting is checked against `updated_at` using `new Date()` on the client. Clock skew or timezone differences could cause minor inconsistencies.

5. **No email on claimant-initiated cancel.** If a claimant cancels their own pending claim ("My Active Claims" → Cancel), the finder is not notified. The `pendingClaimsCount` visible on the finder's dashboard will decrement on next load.

6. **No deduplication guard on dispute inserts.** A claimant can technically submit multiple disputes for the same item if they're fast (the UI disables the button during submission but there's no DB-level unique constraint on `(item_id, claimant_id)`).

7. **`CRON_SECRET` not in `.env.local`.** The expire-claims route requires a `CRON_SECRET` environment variable that does not exist in the checked-in `.env.local`. Without it, every request to `GET /api/expire-claims` returns 401.

8. **DisputesPanel fetch uses anon client.** The DisputesPanel in `dashboard/page.tsx` uses the anon Supabase client (`@/lib/supabaseClient`). If RLS is ever re-enabled on the `disputes` or `items` tables, this query will fail silently.
