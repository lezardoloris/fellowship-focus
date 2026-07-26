# Positionnement Fellowship Focus (12 mois)

*Document de decision. 26 juillet 2026 (rev. meme jour: trou paiement). Strategie uniquement, pas de code produit.*
*Langue: francais. Les fourchettes utilisent un tiret simple (ex. 2-5 semaines).*

**Question tranchee:** quelle plateforme et quel canal maximisent le profit du fondateur sur 12 mois?

**Reponse en une ligne:** Windows d'abord, rail de paiement SaaS ensuite (il n'existe pas), Google Ads seulement apres. Autour du wedge "heures trackees vs heures facturees". Pas d'extension-first, pas de mobile, pas de Mac en annee 1.

**Correction majeure vs la premiere version de ce doc:** "Windows + Google Ads" etait a moitie vrai. Ads vers un produit sans moyen d'encaisser un abonnement brule du cash pour zero MRR. L'audit code du 26/07/2026 le confirme (voir section 0).

---

## 0. Etat des lieux paiement (le trou que le brief initial a sous-estime)

Audit repo `fellowship-focus/` (26/07/2026):

| Surface | Statut reel |
|---|---|
| Dependance `stripe` / `paddle` / `lemonsqueezy` dans `web/package.json` | Absente |
| Routes Checkout / Billing / Customer Portal | Absentes |
| Page `/pricing` | Absente (`web/src/app/` n'a ni pricing ni billing) |
| Paywall, plan, entitlement (`is_paid`, `isPro`, licence) | Absents (grep lib = vide utile) |
| Mentions "stripe" dans `web/src/lib/backlog.ts` | Metaphore d'attribution client ("Stripe metadata"), pas un SDK paiement |
| `web/src/app/api/escrow/` + `web/src/lib/escrow.ts` | Escrow.com pour les Ring Deposit (paris entre pairs). Auth `ESCROW_EMAIL` / `ESCROW_API_KEY`. Webhook `/api/escrow/webhook`. |
| UI `StakesPanel` "Open Ring Deposit" | Paiement entre joueurs, pas achat du logiciel |

**Consequence:** aujourd'hui le produit est 100% gratuit a l'usage pour qui a un compte. Les "paris" peuvent faire circuler de l'argent via Escrow.com si les cles sont configurees, mais ca ne remplace pas une vente d'abonnement. Un euro d'Ads depense avant un Checkout = un euro jete.

**Cout pour fermer le trou (estimate, solo):**

| Bloc | Semaines | Contenu |
|---|---|---|
| Stripe Billing (ou Paddle Merchant of Record EU) | 1.5-2.5 | Produits price (€19/mo annual, €24 monthly), Checkout Session, Customer Portal, webhooks `invoice.paid` / `customer.subscription.deleted` |
| Entitlement dans l'app | 1-1.5 | Table `subscriptions` (ou claim JWT), gate desktop features money+tracker pro, essai 7 jours |
| Page `/pricing` + paywall soft | 0.5-1 | Prix, CTA, etat "trial / active / lapsed" |
| Facturation legale minimale | 0.5 | Mentions societes, TVA si UE (Paddle simplifie; Stripe = a toi) |
| Total rail SaaS | 3.5-6 semaines | Avant tout spend Ads non trivial |

Escrow.com reste pour les stakes. Ne pas le confondre avec Stripe Connect (la v1 de ce doc le faisait). Les Ring Deposit existent deja cote code; les brancher en prod est un chantier separe et secondaire au rail d'abonnement.

**Ordre impose:** (1) rail paiement + entitlement, (2) wedge unbilled visible, (3) Google Ads. Inverser = recommander un canal sans caisse.

---

## 1. Segment et job-to-be-done

**Acheteur precis:** freelance ou consultant B2B solo (ou micro-agence 1-2 personnes) qui facture a l'heure ou a la journee, a €60-150/h (ou equivalent USD), sur Windows comme machine de travail principale, avec plusieurs clients et deja un outil de temps ou de facturation (Toggl, Clockify, Harvest, Excel).

Exemples concrets qui paient: consultant Google Ads / PPC, developpeur freelance, consultant data, bookkeeper independant, formateur B2B. Pas "les freelancers" au sens large (Upwork cite ~73-76M de freelancers US au sens large en 2025; la majorite ne paiera jamais un outil desktop a €20/mois). Source: [MBO Partners / Makerstations resume 2025](https://www.makerstations.io/freelancer-statistics/), [Upwork Future Workforce](https://www.upwork.com/resources/freelancing-stats).

**OS:** Windows. Chez les developpeurs (proxy raisonnable des knowledge workers digitaux), Windows reste a 49.5% d'usage professionnel vs 32.9% macOS (Stack Overflow Developer Survey 2025, [survey.stackoverflow.co/2025/technology](https://survey.stackoverflow.co/2025/technology)). Le produit a deja le moat sur Windows. Viser Mac en premier serait payer 16-24 semaines d'ingenierie pour un marche plus petit que celui deja accessible.

**Job, dans leurs mots:**
> "Je sais que j'ai travaille. Je ne sais pas ce que j'ai oublie de facturer. Et YouTube me vole encore 90 minutes dans l'apres-midi."

Deux douleurs, une facture: (1) fuite de facturation, (2) fuite d'attention. Le segment qui paie le plus est celui pour qui 1 heure non facturee = €60-150. Un outil a €20/mois se rembourse en moins d'une heure recuperee par mois.

**Segment ecarte volontairement:** etudiants / digital detox (marche Cold Turkey / Freedom, ARPU bas, churn haut, zero money layer). Creatifs Mac-first (Illustrator, Final Cut): WTP eleve mais hors plateforme actuelle.

---

## 2. Le wedge: pour le rapprochement tracked vs billed

**Candidat:** reconciliation entre temps tracke automatiquement et temps facture.
Exemple: le tracker voit 6.2h sur le repo du client X; la couche money voit 4.1h sur la facture; l'ecart = 2.1h non facturees = €168 a €80/h.

**Verdict: garder ce wedge.** Arguments:

| Concurrent | Track auto | Facture / money | Gap |
|---|---|---|---|
| Rize (Rory) | Oui (desktop) | Non natif | Track sans cash-out. Basic $9.99/mo annual, Pro $14.99/mo annual ([rize.io/pricing](https://rize.io/pricing), lu 26/07/2026: FAQ indique aussi fourchettes $12.99-$39.99 mensuel). |
| Toggl Track | Non (timer manuel) | Rates oui; facture surtout Premium | Les gens oublient de demarrer. Starter $9/user/mo ([delivvo.io resume 2026](https://delivvo.io/blog/best-freelance-time-tracking-apps-2026)). |
| Harvest | Non (timer) | Oui, coeur produit | Teams ~$9-12/seat/mo selon source ([getharvest.com/pricing](https://www.getharvest.com/pricing) cite via comparatifs 2026). |
| Cold Turkey | Non | Non | Blocker only, $39 one-time ([getcoldturkey.com/pricing](https://getcoldturkey.com/pricing/), 26/07/2026). |
| Freedom | Non | Non | Blocker multi-device, $3.33/mo annual / $8.99/mo / $99.50 lifetime ([freedom.to/pricing](https://freedom.to/pricing), 26/07/2026). |

Personne dans ce tableau ne joint track auto Windows + money (taux effectif, marge projet, PDF) + blocking systeme. Le wedge n'est pas "encore un Pomodoro". C'est montrer un euro perdu.

**Contre-argument traite:** "le blocking est plus defensible." Faux pour le profit. Cold Turkey vend le blocking a $39 une fois. Freedom a ~$40/an. Le plafond de panier blocker-only est bas. Le money layer justifie un abonnement recurrent au niveau Rize/Harvest.

**Alternative ecartee:** peer stakes comme wedge. Voir section 6. Le cold-start tue le jour 1.

---

## 3. Plateformes, chacune coutee

Hypotheses communes: fondateur solo, 1 semaine d'ingenierie = 5 jours plein, cout d'opportunite estime a €2 500/semaine (ce qu'il pourrait facturer en consulting Ads). "Parity" = tracker all-day + blocking multi-couches + money layer + extension sync.

### A. Double-down Windows (recommandation)

| Item | Chiffre |
|---|---|
| Semaines d'ingenierie a parity produit (track + block + money UI) | 0 (deja la). |
| Semaines avant de pouvoir encaisser | 3.5-6 (rail SaaS section 0). Ce n'est pas du packaging optionnel. |
| Puis wedge reconciliation + landing | 2-3 en parallele / juste apres le rail |
| Marche atteignable (order of magnitude) | Knowledge workers freelances Windows EU+US. Proxy: ~50% des developpeurs pro sur Windows (SO 2025). Sous-ensemble "facture a l'heure, multi-clients, WTP outil": estimate 80k-150k personnes adressables en English+FR (calcul: ~5M freelances digitaux "skilled" US+EU occidentaux x ~50% Windows x ~3-5% douleur unbilled). Sources base: Makerstations/Upwork + SO 2025. |
| Revenu 12 mois plausible | Estimate: 400-1 200 payants a €15-25/mo net. Fourchette ARR €72k-€288k. Point median: €150k ARR (~700 payants x €18/mo). Condition: rail paiement live avant le scale Ads. Sinon ARR = €0. |
| Payback | Si CAC ads €60-90 (voir section 4) et LTV annee 1 €216 (€18 x 12), payback 3-5 mois apres ouverture du Checkout. Les 4-6 semaines de rail sont un cout fixe (~€10k-€15k d'opportunite), pas du CAC. |

### B. Mac (parity)

A reconstruire (pas de WinINET, pas de `netsh`, pas du package `blocker/` actuel):

1. Foreground tracking: NSWorkspace / Accessibility APIs. 3-5 semaines.
2. Blocking systeme: Network Extension content-filter ou System Extension. Distribution hors Mac App Store = Developer ID + notarization (Apple: [Notarizing macOS software](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)). System Extensions: activation utilisateur dans Privacy & Security, entitlements `*-systemextension` pour Developer ID ([TN3134 / forums Apple](https://developer.apple.com/forums/thread/737894)). 8-14 semaines d'ingenierie + 2-8 semaines calendaires d'aller-retour notarization / approvals.
3. Cert MITM / interception HTTPS: beaucoup plus hostile sur macOS moderne. Souvent abandonne au profit d'extensions navigateur + NE. Perte partielle de parity.
4. Compte Apple Developer: $99/an.

| Item | Chiffre |
|---|---|
| Semaines totales | 16-24 semaines (+ delais Apple). Cout opportunite €40k-€60k. |
| Marche | ~33% des developpeurs pro (SO 2025). Creatifs Mac plus riches mais hors wedge money/repo. |
| Revenu 12 mois si on y passe l'annee | Estimate €40k-€100k (lancement tardif, moitie d'annee de vente). |
| Payback | >12 mois pour un solo. |

**Piege partiel:** Mac n'est pas un piege absolu, mais c'est un piege en annee 1 pour un solo qui a deja Windows.

### C. Mobile iOS

- APIs Screen Time: FamilyControls + ManagedSettings + DeviceActivity ([Apple Screen Time frameworks](https://developer.apple.com/documentation/ScreenTimeAPIDocumentation)).
- Entitlement Family Controls (Distribution): demande manuelle Apple, plusieurs jours a plus d'un mois, un request par bundle ID d'extension ([newly.app guide](https://newly.app/how-to/family-controls-entitlement)).
- Tokens opaques: pas de lecture fine "client X / repo Y" comparable au tracker Windows.
- Aucune parity avec le money layer desktop.

| Item | Chiffre |
|---|---|
| Semaines | 12-20 pour un blocker type Freedom, sans money. |
| Revenu 12 mois | Concurrent Freedom a $40/an. Race to bottom. Estimate < €30k si on y met l'annee. |

**Piege franc: iOS.**

### D. Mobile Android

- Accessibilite / VPN-based blockers existent; politiques Play Store hostiles aux blockers agressifs; contournement facile.
- Semaines: 10-16. Revenu: pire qu'iOS pour un outil B2B facturation.

**Piege franc: Android.**

### E. Chrome-extension-first

- Cout bas: 2-4 semaines polish + Web Store (zip 1.5.4 deja pret).
- L'extension ne voit pas hors navigateur. Le moat #1 (usage_tracker all-day) disparait. On concurrence StayFree / blockers gratuits.
- 50k installs gratuits = echec selon le brief.

| Item | Chiffre |
|---|---|
| Semaines | 2-4 |
| Revenu 12 mois si free+upsell faible | Estimate €5k-€40k |
| Payback | Illusoire: on vend le produit sans son avantage. |

**Piege strategique #1: extension-first.**

### Classement plateformes (profit 12 mois)

1. Windows double-down
2. Mac (annee 2 seulement, si Windows paye)
3. Chrome extension comme canal d'acquisition / companion, jamais comme produit principal
4. iOS / Android: ne pas toucher en 12 mois

**Ranking resume:** Windows > Mac annee 2 > extension companion > mobile non.

---

## 4. Canaux, chacun coute

**Precondition non negociable:** Checkout + webhook + entitlement live (test d'achat reel €1 puis remboursement). Sans ca, les CAC ci-dessous sont theoriques et le spend doit rester a €0.

### Google Ads (canal principal apres le rail)

**Demande de recherche (ordre de grandeur, pas un export Keyword Planner du jour):**
Impossible d'extraire ici les volumes exacts Google Ads sans compte. A defaut, benchmarks publics 2026 et logique d'intent:

| Cluster d'intent | Exemples de requetes | Volume relatif | Intent |
|---|---|---|---|
| Concurrent-alternatives | "toggl alternative", "harvest alternative", "rize alternative" | Moyen | Achat fort |
| Track auto | "automatic time tracking", "time tracking for freelancers" | Moyen-haut | Achat |
| Blocker | "website blocker windows", "cold turkey alternative" | Moyen | Achat bas ARPU |
| Douleur money | "forgot to bill hours", "unbilled time", "billable hours tracker" | Faible-moyen | Achat tres fort si landing colle |

Benchmarks CPC SaaS SMB Search non-brand: $3.33-$5.34 ([Kampaio B2B SaaS Google Ads Benchmarks 2026](https://www.kampaio.com/blog/b2b-saas-google-ads-benchmarks-2026)). Technology CPC moyen cite ailleurs ~$3.80 ([Snow Media SaaS PPC](https://thesnowmedia.com/resources/saas-ppc-benchmarks/)). Longue traine productivity: souvent €1-3.

**CAC defensible (estimate, calcul montre):**

Hypotheses apres optimisation fondateur Ads:
- CPC moyen blende: €2.00 (longue traine + QS eleve)
- Click -> trial desktop: 6%
- Trial -> payant J30: 25%
- CAC = 2 / (0.06 x 0.25) = €133 au demarrage

Apres 6-8 semaines d'iteration (negatives, RSA, landing wedge "€ unbilled"):
- CPC €1.60, CVR 8%, paid 30% -> CAC = 1.6 / 0.024 = €67

**Effet metier Google Ads du fondateur:** un fondateur moyen brule 30-50% du budget en termes trop larges et mauvaises landings. Un consultant Ads pro coupe ca. Decote CAC estimee: -25% a -40% vs fondateur moyen sur la meme offre. C'est un actif, pas un canal neutre.

**Le prix porte-t-il le CAC?**
- A €18/mo, LTV 12 mois = €216. Regle 3:1 LTV:CAC -> CAC max approx €72. Atteignable seulement avec la longue traine + landing wedge.
- A €29/mo (ou €24/mo annual), LTV 12 mois = €348, CAC max approx €116. Plus confortable.
- Conclusion: Google Ads marche si le prix est >= €20/mo equivalent et la landing vend l'euro perdu, pas le Pomodoro. Sinon le canal ne porte pas.

### Facebook / Meta Ads

- CPC SaaS souvent $1-5, CPA lead cite ~$55 ([Snow Media](https://thesnowmedia.com/resources/saas-ppc-benchmarks/), TrendTrack). Intent bas.
- Fondateur pas acheteur Meta de metier -> courbe d'apprentissage + creatives = semaines perdues.
- Role correct: retargeting des visiteurs site / trial, pas acquisition froide annee 1.

### Canal qui bat parfois les deux

**Distribution dans le reseau du fondateur (consultants Ads, communautes PPC FR/EN) + SEO concurrent-alternative.** Cout CAC proche de €0-30, volume limite, mais meilleur ROI initial. A faire en parallele de Google Ads, pas a la place: le reseau ne scale pas a €150k ARR seul.

**Si le prix etait €9/mo:** ni Google ni Meta ne portent un CAC serieux. Il faudrait product-led free extension. Le brief refuse ce succes vaniteux.

---

## 5. Monetisation

### 5.1 Ce qui existe vs ce qui manque

| | Existe aujourd'hui | Manque pour vendre le logiciel |
|---|---|---|
| Escrow.com Ring Deposit | Code + webhook + UI StakesPanel | Ne vend pas une licence; deplace des mises entre pairs |
| Abonnement Solo | Rien | Stripe Billing ou Paddle (MoR UE) |
| Droit d'acces | Compte gratuit = full product | Gate trial 7j -> payant |
| Page prix | Absente | `/pricing` publique |

### 5.2 Modele retenu (annee 1)

**Abonnement SaaS**, pas licence one-shot, pas rake de paris comme revenu principal.

| Offre | Prix | Contenu |
|---|---|---|
| Solo | €24/mo mensuel ou €19/mo facture annuel (€228/an) | Tracker auto Windows + blocking + money (taux, projets, invoice) + extension companion |
| Guild / stakes | Inclus plus tard | Ring Deposit via Escrow.com deja code, pas Stripe Connect |

**Choix processeur (estimate):**

| Option | Pour | Contre | Semaines |
|---|---|---|---|
| Stripe Billing | Controles, docs, fondateur technique | TVA UE a gerer (Tax / manual), KYC Stripe | 3.5-5 |
| Paddle (comme Cold Turkey) | Merchant of Record, TVA/VAT incluse | Moins flexible, fee ~5%+ | 3-4 |

Recommandation processeur: Paddle si le fondateur veut zero casse-tete TVA UE; Stripe s'il veut Customer Portal fin et webhooks deja familiers. Les deux ferment le trou. Aucun des deux n'est "deja la".

**Justification prix:** inchangee (entre Freedom/Cold Turkey et Rize/Harvest). Sans Checkout, le prix est une opinion.

### 5.3 Peer bets / escrow (compliance)

- Escrow.com = tiers de confiance deja integre dans le repo. Pas besoin de licence Payment Institution pour les Ring Deposit si Escrow reste le custodian.
- Licence PI maison: €300k-€800k, 12-18 mois. Hors sujet annee 1.
- Stripe Connect (cite a tort dans la v1 de ce doc pour les stakes): non prioritaire. L'existant Escrow.com suffit quand on activera les paris en prod.
- Decision: stakes = retention annee 2. Annee 1 = vendre Solo.

---

## 6. Cold-start et valeur solo

Chaque utilisateur jour 1 est seul.

**Valeur solo (sans personne a parier contre):**
1. Track auto all-day -> score / categories.
2. Blocking 4 couches -> deep work.
3. Money -> "tu as €X non factures cette semaine."
4. Invoice PDF / rates.

Si (3) est lisible en < 60 secondes apres install, le produit vaut l'abonnement sans guild. Les stakes deviennent un bonus social, pas le moteur.

**Si on inversait** (stakes d'abord): ranking change -> il faudrait mobile + viral loops + escrow tot. Ce n'est pas l'actif actuel. Le ranking Windows + Google Ads + wedge money tient uniquement parce que la valeur solo est epaisse.

---

## 7. Recommandation

### Classement final (profit 12 mois)

| Rang | Axe | Role |
|---|---|---|
| 0 | Rail paiement SaaS (Stripe ou Paddle) + entitlement | Precondition. Sans ca, rangs 1b+ sont fantaisie. |
| 1 | Windows desktop | Produit et moat |
| 1b | Google Ads | Canal principal apres rang 0 live |
| 2 | Reseau / SEO alternatives | Secondaire; pre-vente manuelle possible pendant que le rail se construit |
| 3 | Extension Chrome | Companion, jamais le coeur |
| 4 | Meta Ads | Retargeting seulement |
| 5 | Mac | Annee 2 si Windows >= kill criteria |
| 6 | Escrow Ring Deposit en prod | Retention, pas revenu logiciel |
| 7 | iOS / Android | Ne pas faire |

**Une phrase:** d'abord une caisse qui encaise un abonnement Windows, ensuite le wedge unbilled, ensuite Google Ads. Pas l'inverse.

### Plan 90 jours (jalons hebdo)

| Semaine | Livrable |
|---|---|
| S1 | Choisir Stripe ou Paddle. Compte pro + produits prix (€19 annual / €24 monthly). Schema DB `subscriptions`. |
| S2 | Checkout + webhooks signes + Customer Portal. Test: payer €1 reel, entitlement active, rembourser. |
| S3 | Page `/pricing`. Gate soft (trial 7j). Ecran wedge "Unbilled this week = € X". |
| S4 | Landing FR+EN = chiffre unbilled + CTA Checkout. 0 € d'Ads tant que S2 n'est pas vert. Pre-ventes reseau 5-10 gens. |
| S5 | Google Search 3 ad groups. Budget €30-50/jour seulement si paiement test OK. |
| S6 | 20 conversations trials: unbilled cru? Iterer copy. |
| S7-S8 | Negatives, QS, A/B blocker-led vs money-led. Objectif CAC < €100. |
| S9 | Install Windows + onboarding (clients, unbilled, shield). |
| S10 | SEO 4 pages vs Toggl / Harvest / Rize / Cold Turkey. |
| S11 | Scale Ads €80-120/jour si CAC < €80. |
| S12 | Bilan MRR, CAC, churn. Escrow Ring Deposit: ne pas bloquer dessus. |

### Kill criteria

**Kill immediat:** si a J21 le Checkout n'accepte pas un paiement test bout-en-bout, stop Ads. Le chantier est le rail.

Abandonner la direction (Windows + wedge + Ads) a J90 si les trois sont vrais:

1. Moins de 40 abonnements payants actifs, et
2. CAC blende > €120 sur 30 jours avec >= €2 000 de spend Ads, et
3. Sur >= 30 trials, moins de 20% restent pour l'ecran "unbilled €".

Si le rail marche mais (1) echoue avec CAC < €70 et feedback money fort: continuer (volume).
Si (3) echoue: pivoter le message vers blocking+track, meme rail.

Inversion Mac: >= 60% des payants bloquent sur Mac, et Windows >= €8k MRR.

---

## Where I could be wrong

0. (Deja arrive.) La v1 traitait le paiement comme une ligne "S2 Stripe" alors que le repo n'a aucun rail SaaS. L'objection "ya jamais eu question de paiement" est correcte. Sans section 0, le ranking Ads etait premature.
1. Beachhead Windows vs creatifs Mac a fort WTP.
2. Wedge unbilled trop froid emotionnellement.
3. CPC reel > benchmarks: alors prix €29-39/mo ou Ads meurt.
4. Rory ajoute l'invoicing avant nous.
5. KYC Stripe/Paddle retarde S1-S2. Mitigation: dossier processeur jour 0.

---

## Conclusion

Le moat est Windows. Le canal inequitable est Google Ads. Le profit commence a la caisse, et la caisse n'existe pas encore: Escrow.com sert les paris entre pairs, pas l'abonnement logiciel. Sequencer autrement (Ads d'abord, Mac, mobile, extension-first) reste une facon de ne pas etre paye, avec en plus une carte qui fume pour rien.
