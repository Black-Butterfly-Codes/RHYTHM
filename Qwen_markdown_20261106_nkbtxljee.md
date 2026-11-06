# COMPLIANCE.md

This document maps legal and compliance requirements to their implementation in the RHYTHM app.

## 1. Data Protection & Privacy (DPDP Act 2023 / India)
- **Parental Consent**: Implemented for users under 18. Verified status stored in `account.parentalConsent`.
- **Data Minimization**: Only essential fields collected (see `account` schema).
- **User Rights**: Data export (JSON) and account deletion available in Settings.
- **Grievance Officer**: Details listed in the Footer and Legal pages.

## 2. Cookies & Tracking
- **Consent Management**: Analytics disabled by default (`consent.analytics: false`).
- **Cookie Policy**: Available at `/cookies`.
- **Preference Management**: "Manage preferences" link in footer and settings.

## 3. Security
- **HTTPS & Headers**: Enforced at the infrastructure level (TODO: Verify server config).
- **Input Validation**: All forms use sanitized inputs (TODO: Verify backend).
- **Access Control**: Row-level security ensures users only see their own data.

## 4. Accessibility (WCAG 2.1 AA)
- **Contrast**: Text colors strictly use `--ink` on light backgrounds and `--paper` on dark backgrounds.
- **Focus States**: Visible `:focus-visible` outlines on all interactive elements.
- **Tap Targets**: Minimum 48px height for buttons and inputs.
- **Reduced Motion**: Respects `prefers-reduced-motion`.

## 5. User-Generated Content & Safety
- **Reporting**: Report button available on posts.
- **Community Guidelines**: Linked in footer.
- **Minor Safety**: Paid auctions locked until parental consent is verified.

## TODO / Needs Legal Review
- [ ] Verify exact data retention periods with legal counsel.
- [ ] Finalize Grievance Officer details.
- [ ] Ensure cross-border data transfer clauses are accurate for hosting provider.
- [ ] Review AI-generated content labeling requirements.