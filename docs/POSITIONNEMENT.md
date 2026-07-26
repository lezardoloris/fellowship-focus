# Positionnement Fellowship Focus (12 mois)

*Decision document. 26 July 2026. Strategy only, no product code.*
*Language: French. Ranges use a plain hyphen (ex. 2-5 semaines).*

**Question tranchee:** quelle plateforme et quel canal maximisent le profit du fondateur sur 12 mois?

**Reponse en une ligne:** Windows (doubler la mise sur le desktop deja livré) + Google Ads (le metier du fondateur), autour d'un coin de marche "heures trackees vs heures facturees". Pas d'extension-first, pas de mobile, pas de Mac en annee 1.

---

## 1. Segment et job-to-be-done

**Acheteur precis:** freelance ou consultant B2B solo (ou micro-agence 1-2 personnes) qui facture a l'heure ou a la journee, a **€60-150/h** (ou equivalent USD), sur **Windows comme machine de travail principale**, avec **plusieurs clients** et deja un outil de temps ou de facturation (Toggl, Clockify, Harvest, Excel).

Exemples concrets qui paient: consultant Google Ads / PPC, developpeur freelance, consultant data, bookkeeper independant, formateur B2B. Pas "les freelancers" au sens large (Upwork cite ~73-76M de freelancers US au sens large en 2025; la majorite ne paiera jamais un outil desktop a €20/mois). Source: [MBO Partners / Makerstations resume 2025](https://www.makerstations.io/freelancer-statistics/), [Upwork Future Workforce](https://www.upwork.com/resources/freelancing-stats).

**OS:** Windows. Chez les developpeurs (proxy raisonnable des knowledge workers digitaux), Windows reste a **49,5% d'usage professionnel** vs **32,9% macOS** (Stack Overflow Developer Survey 2025, [survey.stackoverflow.co/2025/technology](https://survey.stackoverflow.co/2025/technology)). Le produit a deja le moat sur Windows. Viser Mac en premier serait payer 16-24 semaines d'ingenierie pour un marche plus petit que celui deja accessible.

**Job, dans leurs mots:**
> "Je sais que j'ai travaille. Je ne sais pas ce que j'ai oublie de facturer. Et YouTube me vole encore 90 minutes dans l'apres-midi."

Deux douleurs, une facture: (1) fuite de facturation, (2) fuite d'attention. Le segment qui paie le plus est celui pour qui **1 heure non facturee = €60-150**. Un outil a €20/mois se rembourse en **moins d'une heure recuperee par mois**.

**Segment ecarte volontairement:** etudiants / digital detox (marche Cold Turkey / Freedom, ARPU bas, churn haut, zero money layer). Creatifs Mac-first (Illustrator, Final Cut): WTP eleve mais hors plateforme actuelle.

---

## 2. Le wedge: pour le rapprochement tracked vs billed

**Candidat:** reconciliation entre temps tracke automatiquement et temps facture.
Exemple: le tracker voit 6,2h sur le repo du client X; la couche money voit 4,1h sur la facture; l'ecart = **2,1h non facturees = €168 a €80/h**.

**Verdict: garder ce wedge.** Arguments:

| Concurrent | Track auto | Facture / money | Gap |
|---|---|---|---|
| Rize (Rory) | Oui (desktop) | Non natif | Track sans cash-out. Basic **$9.99/mo** annual, Pro **$14.99/mo** annual ([rize.io/pricing](https://rize.io/pricing), lu 26/07/2026: FAQ indique aussi fourchettes $12.99-$39.99 mensuel). |
| Toggl Track | Non (timer manuel) | Rates oui; facture surtout Premium | Les gens oublient de demarrer. Starter **$9/user/mo** ([delivvo.io resume 2026](https://delivvo.io/blog/best-freelance-time-tracking-apps-2026)). |
| Harvest | Non (timer) | Oui, coeur produit | Teams ~**$9-12/seat/mo** selon source ([getharvest.com/pricing](https://www.getharvest.com/pricing) cite via comparatifs 2026). |
| Cold Turkey | Non | Non | Blocker only, **$39 one-time** ([getcoldturkey.com/pricing](https://getcoldturkey.com/pricing/), 26/07/2026). |
| Freedom | Non | Non | Blocker multi-device, **$3.33/mo** annual / **$8.99/mo** / **$99.50 lifetime** ([freedom.to/pricing](https://freedom.to/pricing), 26/07/2026). |

Personne dans ce tableau ne joint **track auto Windows + money (taux effectif, marge projet, PDF) + blocking systeme**. Le wedge n'est pas "encore un Pomodoro". C'est **montrer un euro perdu**.

**Contre-argument traite:** "le blocking est plus defensible." Faux pour le profit. Cold Turkey vend le blocking a $39 une fois. Freedom a ~$40/an. Le plafond de panier blocker-only est bas. Le money layer justifie un abonnement recurrent au niveau Rize/Harvest.

**Alternative ecartee:** peer stakes comme wedge. Voir §6. Le cold-start tue le jour 1.

---

## 3. Plateformes, chacune coutee

Hypotheses communes: fondateur solo, 1 semaine d'ingenierie = 5 jours plein, cout d'opportunite estime a **€2 500/semaine** (ce qu'il pourrait facturer en consulting Ads). "Parity" = tracker all-day + blocking multi-couches + money layer + extension sync.

### A. Double-down Windows (recommandation)

| Item | Chiffre |
|---|---|
| Semaines d'ingenierie a parity | **0** (deja la). Wedge reconciliation + packaging SaaS + billing Stripe: **4-6 semaines**. |
| Marche atteignable (order of magnitude) | Knowledge workers freelances Windows EU+US. Proxy: ~50% des developpeurs pro sur Windows (SO 2025). Sous-ensemble "facture a l'heure, multi-clients, WTP outil": **estimate** 80k-150k personnes adressables en English+FR (calcul: ~5M freelances digitaux "skilled" US+EU occidentaux x ~50% Windows x ~3-5% douleur unbilled). Sources base: Makerstations/Upwork + SO 2025. |
| Revenu 12 mois plausible | **Estimate:** 400-1 200 payants a €15-25/mo net. Fourchette ARR **€72k-€288k**. Point median utilise plus bas: **€150k ARR** (~700 payants x €18/mo). |
| Payback | Si CAC ads €60-90 (voir §4) et LTV annee 1 €216 (€18 x 12), payback **3-5 mois**. |

### B. Mac (parity)

A reconstruire (pas de WinINET, pas de `netsh`, pas du package `blocker/` actuel):

1. **Foreground tracking:** NSWorkspace / Accessibility APIs. **3-5 semaines.**
2. **Blocking systeme:** Network Extension content-filter ou System Extension. Distribution hors Mac App Store = **Developer ID + notarization** (Apple: [Notarizing macOS software](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)). System Extensions: activation utilisateur dans Privacy & Security, entitlements `*-systemextension` pour Developer ID ([TN3134 / forums Apple](https://developer.apple.com/forums/thread/737894)). **8-14 semaines** d'ingenierie + **2-8 semaines calendaires** d'aller-retour notarization / approvals.
3. **Cert MITM / interception HTTPS:** beaucoup plus hostile sur macOS moderne. Souvent abandonne au profit d'extensions navigateur + NE. Perte partielle de parity.
4. Compte Apple Developer: **$99/an**.

| Item | Chiffre |
|---|---|
| Semaines totales | **16-24 semaines** (+ delais Apple). Cout opportunite **€40k-€60k**. |
| Marche | ~33% des developpeurs pro (SO 2025). Creatifs Mac plus riches mais hors wedge money/repo. |
| Revenu 12 mois si on y passe l'annee | **Estimate** €40k-€100k (lancement tardif, moitie d'annee de vente). |
| Payback | **>12 mois** pour un solo. |

**Piege partiel:** Mac n'est pas un piege absolu, mais c'est un piege **en annee 1** pour un solo qui a deja Windows.

### C. Mobile iOS

- APIs Screen Time: FamilyControls + ManagedSettings + DeviceActivity ([Apple Screen Time frameworks](https://developer.apple.com/documentation/ScreenTimeAPIDocumentation)).
- Entitlement **Family Controls (Distribution)**: demande manuelle Apple, **plusieurs jours a plus d'un mois**, un request par bundle ID d'extension ([newly.app guide](https://newly.app/how-to/family-controls-entitlement)).
- Tokens opaques: pas de lecture fine "client X / repo Y" comparable au tracker Windows.
- **Aucune parity** avec le money layer desktop.

| Item | Chiffre |
|---|---|
| Semaines | **12-20** pour un blocker type Freedom, sans money. |
| Revenu 12 mois | Concurrent Freedom a $40/an. Race to bottom. **Estimate** < €30k si on y met l'annee. |

**Piege franc: iOS.**

### D. Mobile Android

- Accessibilite / VPN-based blockers existent; politiques Play Store hostiles aux blockers agressifs; contournement facile.
- Semaines: **10-16**. Revenu: pire qu'iOS pour un outil B2B facturation.

**Piege franc: Android.**

### E. Chrome-extension-first

- Cout bas: **2-4 semaines** polish + Web Store (zip 1.5.4 deja pret).
- L'extension **ne voit pas** hors navigateur. Le moat #1 (usage_tracker all-day) disparait. On concurrence StayFree / blockers gratuits.
- 50k installs gratuits = echec selon le brief.

| Item | Chiffre |
|---|---|
| Semaines | 2-4 |
| Revenu 12 mois si free+upsell faible | **Estimate** €5k-€40k |
| Payback | Illusoire: on vend le produit sans son avantage. |

**Piege strategique #1: extension-first.**

### Classement plateformes (profit 12 mois)

1. **Windows double-down**
2. Mac (annee 2 seulement, si Windows paye)
3. Chrome extension comme **canal d'acquisition / companion**, jamais comme produit principal
4. iOS / Android: ne pas toucher en 12 mois

---

## 4. Canaux, chacun coute

### Google Ads (recommandation)

**Demande de recherche (ordre de grandeur, pas un export Keyword Planner du jour):**
Impossible d'extraire ici les volumes exacts Google Ads sans compte. A defaut, benchmarks publics 2026 et logique d'intent:

| Cluster d'intent | Exemples de requetes | Volume relatif | Intent |
|---|---|---|---|
| Concurrent-alternatives | "toggl alternative", "harvest alternative", "rize alternative" | Moyen | Achat fort |
| Track auto | "automatic time tracking", "time tracking for freelancers" | Moyen-haut | Achat |
| Blocker | "website blocker windows", "cold turkey alternative" | Moyen | Achat bas ARPU |
| Douleur money | "forgot to bill hours", "unbilled time", "billable hours tracker" | Faible-moyen | Achat tres fort si landing colle |

Benchmarks CPC SaaS SMB Search non-brand: **$3.33-$5.34** ([Kampaio B2B SaaS Google Ads Benchmarks 2026](https://www.kampaio.com/blog/b2b-saas-google-ads-benchmarks-2026)). Technology CPC moyen cite ailleurs ~$3.80 ([Snow Media SaaS PPC](https://thesnowmedia.com/resources/saas-ppc-benchmarks/)). Longue traine productivity: souvent **€1-3**.

**CAC defensible (estimate, calcul montre):**

Hypotheses apres optimisation fondateur Ads:
- CPC moyen blende: **€2,00** (longue traine + QS eleve)
- Click → trial desktop: **6%**
- Trial → payant J30: **25%**
- CAC = 2 / (0,06 × 0,25) = **€133** au demarrage

Apres 6-8 semaines d'iteration (negatives, RSA, landing wedge "€ unbilled"):
- CPC **€1,60**, CVR **8%**, paid **30%** → CAC = 1,6 / 0,024 = **€67**

**Effet metier Google Ads du fondateur:** un fondateur moyen brule 30-50% du budget en termes trop larges et mauvaises landings. Un consultant Ads pro coupe ca. Decote CAC estimee: **-25% a -40%** vs fondateur moyen sur la meme offre. C'est un actif, pas un canal neutre.

**Le prix porte-t-il le CAC?**
- A **€18/mo**, LTV 12 mois = €216. Regle 3:1 LTV:CAC → CAC max ≈ **€72**. Atteignable seulement avec la longue traine + landing wedge.
- A **€29/mo** (ou €24/mo annual), LTV 12 mois = €348, CAC max ≈ **€116**. Plus confortable.
- Conclusion: **Google Ads marche si le prix est ≥ €20/mo equivalent et la landing vend l'euro perdu, pas le Pomodoro.** Sinon le canal ne porte pas.

### Facebook / Meta Ads

- CPC SaaS souvent **$1-5**, CPA lead cite ~**$55** ([Snow Media](https://thesnowmedia.com/resources/saas-ppc-benchmarks/), TrendTrack). Intent bas.
- Fondateur **pas** acheteur Meta de metier → courbe d'apprentissage + creatives = semaines perdues.
- Role correct: **retargeting** des visiteurs site / trial, pas acquisition froide annee 1.

### Canal qui bat parfois les deux

**Distribution dans le reseau du fondateur (consultants Ads, communautes PPC FR/EN) + SEO concurrent-alternative.** Cout CAC proche de €0-30, volume limite, mais meilleur ROI initial. A faire **en parallele** de Google Ads, pas a la place: le reseau ne scale pas a €150k ARR seul.

**Si le prix etait €9/mo:** ni Google ni Meta ne portent un CAC serieux. Il faudrait product-led free extension. Le brief refuse ce succes vaniteux.

---

## 5. Monetisation

**Modele retenu:** abonnement SaaS, pas licence one-shot, pas rake de paris en annee 1.

| Offre | Prix | Contenu |
|---|---|---|
| Solo (recommandation) | **€24/mo** mensuel ou **€19/mo** facture annuel (€228/an) | Tracker auto Windows + blocking + money (taux, projets, invoice) + extension companion |
| Guild / stakes (annee 2) | Inclus ou +€5/mo | Peer bets via Stripe Connect |

**Justification prix:**
- Au-dessus de Freedom ($40/an) et Cold Turkey ($39 life): on n'est pas un blocker.
- Au niveau / legerement au-dessus de Rize Basic-Pro ($120-$180/an) et Harvest solo: on ajoute blocking systeme + reconciliation facturee.
- En dessous d'un stack Rize + Cold Turkey + Harvest (~$120 + $39 + $108).

**Peer bets / escrow (cout compliance, pas balaye):**
- Construire son propre escrow = licence Payment Institution PSD2. Capital minimum **€20k-€125k**, cout de lancement typique **€300k-€800k**, 12-18 mois ([finconduit](https://finconduit.com/resources/payment-institution-licence-eu), [N5Deal 2026](https://n5deal.com/articles/155-psp-licensing-key-requirements-and-challenges-for-2026)). **Infinanceable pour un solo annee 1.**
- Voie viable: **Stripe Connect** pour ne jamais posseder les fonds (Stripe documente la conformite PSD2 des platforms Connect: [stripe.com/guides/...psd2](https://stripe.com/guides/frequently-asked-questions-about-stripe-connect-and-psd2)). Frais Stripe + rake plateforme **10-15%** sur les mises. Ingenierie: **3-5 semaines** quand le solo wedge paie deja.
- **Decision:** stakes = feature de retention annee 2, pas de monetisation annee 1.

---

## 6. Cold-start et valeur solo

Chaque utilisateur jour 1 est **seul**.

**Valeur solo (sans personne a parier contre):**
1. Track auto all-day → score / categories.
2. Blocking 4 couches → deep work.
3. Money → "tu as €X non factures cette semaine."
4. Invoice PDF / rates.

Si (3) est lisible en < 60 secondes apres install, le produit **vaut l'abonnement sans guild**. Les stakes deviennent un bonus social, pas le moteur.

**Si on inversait** (stakes d'abord): ranking change → il faudrait mobile + viral loops + escrow tot. Ce n'est pas l'actif actuel. Le ranking Windows + Google Ads + wedge money **tient uniquement parce que la valeur solo est epaisse**.

---

## 7. Recommandation

### Classement final (profit 12 mois)

| Rang | Axe | Role |
|---|---|---|
| 1 | **Windows desktop** | Produit et moat |
| 1b | **Google Ads** | Canal principal |
| 2 | Reseau / SEO alternatives | Canal secondaire CAC bas |
| 3 | Extension Chrome | Companion + acquisition, jamais le coeur |
| 4 | Meta Ads | Retargeting seulement |
| 5 | Mac | Annee 2 si Windows ≥ kill criteria |
| 6 | iOS / Android | Ne pas faire |

**Une phrase:** vendre aux freelances Windows qui facturent cher le fait qu'ils oublient de facturer, via Google Ads mene par quelqu'un qui vit Google Ads, sans diluer le moat dans une extension ou un mobile.

### Plan 90 jours (jalons hebdo)

| Semaine | Livrable |
|---|---|
| S1 | Ecran wedge "Unbilled this week = €X" branche sur tracker + money. Landing FR+EN avec ce chiffre au-dessus de la ligne de flotaison. |
| S2 | Stripe Checkout abonnement Solo (€19/mo annual / €24 monthly). Essai 7 jours. |
| S3 | Campagne Google Search: 3 ad groups (alternatives concurrents, automatic tracking, unbilled/billable). Budget test **€50/jour**. |
| S4 | 20 conversations (calls ou messages) avec trials: est-ce que le chiffre € unbilled est cru? Iterer copy. |
| S5-S6 | Negatives, QS, 2 landings A/B (blocker-led vs money-led). Objectif CAC < €100. |
| S7 | Packaging install Windows one-click + onboarding 3 ecrans (connect clients → voir unbilled → arm shield). |
| S8 | Contenu SEO 4 pages: vs Toggl, vs Harvest, vs Rize, vs Cold Turkey. |
| S9-S10 | Scale budget Ads a €80-120/jour si CAC < €80. Lancer offre annual. |
| S11 | Activer extension comme upsell "browser companion", pas comme produit. |
| S12 | Bilan: MRR, CAC, churn essai, NPS money screen. Decision kill / continue / preparer Mac. |

### Kill criteria (jour 90)

Abandonner **cette direction** (Windows + Ads + wedge money) si **les trois** sont vrais a J90:

1. **Moins de 40 abonnements payants actifs** (apres essais), **et**
2. **CAC blende > €120** sur les 30 derniers jours avec ≥ €2 000 de spend Ads, **et**
3. Sur ≥ 30 trials qualifies, **moins de 20%** disent que l'ecran "unbilled €" est la raison principale de rester.

Si (1) echoue mais CAC < €70 et le feedback money est fort: continuer, c'est un probleme de volume/budget.
Si (3) echoue (personne ne croit l'unbilled): le wedge est faux → pivoter le message vers blocking+track (positionnement type Rize+Cold Turkey), meme plateforme.

Ce qui ferait **inverser** le ranking vers Mac: preuve que ≥ 60% des trials payants demandent Mac en blocage d'achat, **et** Windows a deja ≥ €8k MRR pour financer 16+ semaines.

---

## Where I could be wrong

1. **Le beachhead Windows est trop "dev/Ads" et ignore les creatifs Mac a fort WTP.** Si le fondateur decouvre que ses meilleurs leads sont designers / video sur Mac, doubler Windows est un plafond artificiel. Signal a surveiller: % de "I'm on Mac" dans les essais.
2. **Le wedge unbilled est intellectuellement elegant mais emotionnellement froid.** Les gens achètent parfois la peur de la distraction plus que l'euro perdu. Les landings A/B de S5-S6 doivent pouvoir tuer le wedge money sans ego.
3. **Google Ads sur cette categorie est plus cher que les benchmarks SMB.** Si le CPC reel floor a €4+ sur les termes utiles, le prix doit monter a €29-39/mo ou le canal Ads meurt au profit du seul reseau perso.
4. **Rize (Rize/Rize) peut ajouter l'invoicing avant nous.** Alors le gap se ferme. Mitigation: blocking systeme Windows reste differentiant; vitesse sur le chiffre € unbilled compte plus que la perfection produit.

Ces quatre risques ne changent pas la recommandation aujourd'hui: ils definissent les capteurs du plan 90 jours.

---

## Conclusion

Le profit des 12 prochains mois se trouve la ou le code defensible existe deja (Windows), la ou l'acheteur perd de l'argent chaque semaine (heures non facturees), et la ou le fondateur a un avantage injuste (Google Ads). Tout le reste (Mac, mobile, Meta froid, extension-first, escrow maison) est une facon elegante de ne pas etre paye.
