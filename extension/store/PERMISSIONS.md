# Permission justifications (paste into the Web Store dashboard)

The Chrome Web Store asks for a one-line justification per permission. Copy each
line into the matching field.

| Permission | Justification to paste |
|---|---|
| `declarativeNetRequest` | Redirects the distracting sites the user has chosen to a block page during focus sessions. |
| `webNavigation` | Blocks a chosen site the instant the user navigates to it, before the page loads. |
| `tabs` | Redirects tabs that were already open on a blocked site the moment the shield is turned on. |
| `browsingData` | Clears the cached service worker of a blocked site so it cannot serve an offline copy. |
| `storage` | Saves the user's block list, schedules, and preferences locally. |
| `alarms` | Runs the focus/break timer and periodic schedule checks. |
| `notifications` | Shows the optional brief "site blocked, -XP" notification. |
| `host_permissions` (`<all_urls>`) | The user decides which sites to block, so the extension must be able to act on any site they add. |
| `history` (optional) | Only requested when the user taps "Scan history" to find their most-visited distractions; analyzed locally and never uploaded. |

## Single purpose statement

> Fellowship Focus has one purpose: to block distracting websites during focus
> sessions and help the user stay on task.

## Data usage disclosures (check these in the dashboard)

- Does NOT sell/transfer user data to third parties.
- Does NOT use data for anything unrelated to the single purpose.
- Does NOT use data for creditworthiness or lending.
- The only network transmission is to the Fellowship guild server the user
  explicitly connects, sending block/session events to power their own XP.
