# Browser & Incognito honesty

Fellowship Focus’s Chrome extension blocks in **Chrome** (and Chromium-based browsers that load the unpacked/MV3 extension).

| Surface | Status |
|---------|--------|
| **Chrome** | Supported — Shield via extension DNR + tab sweep |
| **Windows desktop app** | Supported — system proxy + mitm cert (all browsers on that machine) |
| **Firefox** | Not shipped — no WebExtensions/DNR port yet |
| **Edge** | Works only if you load the same Chrome MV3 extension; not separately packaged |
| **Incognito / private** | Extension blocking applies only when the extension is **allowed in Incognito** (`chrome://extensions` → Details → Allow in Incognito). Default is off. |

We do not claim Firefox, Edge-by-default, or Incognito-by-default protection. Prefer the **Windows app** when you need whole-machine coverage.
