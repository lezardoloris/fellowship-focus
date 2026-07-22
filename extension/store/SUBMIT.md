# Submitting Fellowship Focus to the Chrome Web Store

A step-by-step so publishing isn't a mystery. ~30-60 min of work, then Google's
review (a few days to ~2 weeks given the broad permissions).

## 0. One-time
1. Go to https://chrome.google.com/webstore/devconsole
2. Pay the one-time **$5** developer fee.
3. Set up the publisher profile (name + a contact email).

## 1. Build the upload zip
From `extension/`:
```
node ../web/scripts/pack-extension.mjs
```
This writes `extension/store/fellowship-focus-<version>.zip` containing only the
runtime files (no `store/`, no `*.md`, no private key).

> The `key` field in manifest.json keeps the extension id stable while testing
> unpacked (id: dphkpfngkbjkadamfhkgjippmdnehppd). The Store assigns the final
> id on first publish; the web app discovers the id at runtime, so nothing to
> hardcode. Keep `store/extension-key.pem` PRIVATE and out of git.

## 2. Upload + listing
1. New item → upload the zip.
2. Fill the listing from `STORE-LISTING.md` (name, descriptions, category).
3. Upload the 3 screenshots (1280x800) and the 128px icon.
4. Paste each permission justification from `PERMISSIONS.md`.
5. Privacy: set the policy URL to `https://<your-domain>/privacy`, and tick the
   data-usage disclosures listed in `PERMISSIONS.md`.
6. Single purpose: paste the statement from `PERMISSIONS.md`.

## 3. Submit
Submit for review. You'll get an email on approval or with the reason if
rejected.

## If rejected (usually a permission justification)
- Read the exact reason in the email; it names the permission or policy.
- Tighten that one justification (be concrete about the user benefit), or
  remove the permission if the feature can wait.
- Re-submit. Each round is another review cycle, so get justifications right
  the first time.

## After first publish (make dev id match store id)
1. In the dashboard, copy the extension's public key.
2. Replace the `key` in manifest.json with it, so unpacked dev loads under the
   same id as the published extension. Then `externally_connectable` and the
   web app's direct channel line up in dev and prod.
