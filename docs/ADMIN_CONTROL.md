# Admin Control Centre

Sign in as the seeded admin (tunde.risk@veripay.ng) using the configured demo password.
The Control Centre is the admin landing page. Other accounts cannot call its APIs.

New buyers and sellers click Register on VeriPay on the sign-in page and choose
Buyer or Seller within the registration form. Both start pending and appear immediately under Users, with their own profile
and private Verification upload area. They choose their own password, which is
stored as a salted hash. Registered accounts are restored before governance approval
decisions on server startup. Only an existing admin can approve trading access.

## Individual user profiles

In Users, use the Buyers or Sellers buttons to filter accounts by role, or All users
to see every account. Search works within the selected filter, which remains selected
when returning from a profile. Click an account name or View profile & records. The profile groups:

- Details: contact information, verification methods, restriction flags, and account
  approval controls and notes.
- Documents: the user's NIN/identity, CAC/business, address, and supporting uploads.
  View images and PDFs within the profile, download originals, and approve or reject
  pending documents with notes. Identity and business are document categories;
  existing files retain the names and types supplied by their owners.
- Products: the seller's own listings, including hidden/pending listings and images,
  with publish/hide controls.
- Reviews written: reviews this account submitted across products.
- Reviews received: customer reviews on products owned by this seller. Both review
  tabs include hidden reviews and moderation controls.
- Orders: purchases or sales belonging to the user, with items, totals, fees,
  delivery details, and references to purchase snapshots and courier records.
- Disputes: cases linked through the user's orders. Open a case to inspect its
  evidence and use the existing admin dispute tools, then return to the profile.
- Activity: audit events performed by the user or linked to their records.

Profiles are admin-only. Document viewing uses the same owner/admin permission
check as downloads, no-store caching, and sandbox headers. Users' documents are
never served from the public uploads directory. Empty sections display a message;
the app does not invent documents, reviews, or transactions for an account.

- Users: approve, reject, suspend, or return an account to pending. A non-approved
  account needs an approved identity document before activation. Admin accounts
  cannot be suspended or rejected from this screen.
- Documents: users submit PDF, JPG, or PNG files (up to 10 MB) through Verification.
  Only their owner and the admin can download them. Admins record an approval or
  rejection with review notes. This is manual document review, not an external ID
  provider check. Rejected documents can be replaced by a new submission.
- Products: review new and edited listings, publish them, or hide them. Hidden and
  pending listings cannot be purchased and do not appear in the public catalog.
- Reviews: hide or restore buyer reviews. Hidden reviews do not count toward ratings.
- Settings: pause new purchases, require listing approval, and display a platform
  announcement. Pausing purchases does not interrupt existing fulfilment or disputes.
- Disputes, Risk Shield, Transactions, Trust Registry, and Audit Trail remain
  available from the admin navigation for case decisions and financial oversight.

Every admin decision requires a reason and is logged. Uploaded files, account
approval states, platform settings, seller listings, and admin audit records are
saved in data/governance/ (excluded from Git). VERIPAY_ADMIN_DATA_DIR can select
another local directory. The integration tests use an isolated temporary directory.
Orders, sessions, and buyer reviews still use the local demo's in-memory storage.
Restarting the server ends sessions; governance decisions and files remain saved.

Seeded accounts stay approved except Emeka Smart, who starts pending so the account
approval workflow can be exercised. Suspension or rejection blocks both existing
sessions and subsequent sign-in attempts until an admin changes the account state.
