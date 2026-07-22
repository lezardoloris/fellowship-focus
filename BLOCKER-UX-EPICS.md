# Blocker web app — audit UX & backlog epics/stories

Audit fait le 22/07/2026, après le correctif « le blocage bloque vraiment »
(commit `dc50881`, 8/8 au test d'acceptation).

---

## 1. Où on en est vraiment

Ce qui marche maintenant, vérifié en navigateur :

- L'extension arme le shield au `Connect`, installe de vraies règles DNR et
  bloque `youtube.com`, `m.youtube.com`, `youtu.be`.
- Un site ajouté après connexion est bloqué en 1-2 s, sans reconnexion.
- `Start` refuse de lancer une session non protégée.
- Le statut affiche l'état réel (Shield ON/OFF/Not connected + nombre de règles).

**Le produit tient donc sa promesse de base.** Les problèmes restants ne sont
plus des bugs de blocage, ce sont des problèmes de **activation**, de
**granularité** et de **rétention**.

---

## 2. Les 5 vrais trous

### T1 — L'installation est réservée aux développeurs (bloquant business)

Aujourd'hui, pour bloquer quoi que ce soit il faut :
`chrome://extensions` → activer le mode développeur → *Load unpacked* → choisir
un dossier. Un utilisateur non technique abandonne ici. C'est, de loin, le
plus gros frein : **tout le reste du produit est inaccessible tant que ce mur
n'est pas franchi.**

### T2 — Le blocage est binaire, alors que le différenciateur est la granularité

L'app desktop sait bloquer `/shorts` et `/reels` en laissant passer les tutos
YouTube (`DEFAULT_PATH_RULES`). **L'extension ne sait pas faire ça** : elle
bloque au domaine. Or c'est exactement l'argument face à Cold Turkey. On a la
fonctionnalité côté desktop et on ne la sert pas côté web.

Même chose pour trois réglages qui existent déjà côté extension mais n'ont
aucune UI web : `prefs.allowlist`, `prefs.schedules`, `prefs.site_modes`
(friction par site).

### T3 — Les données de guilde sont effacées à chaque déploiement

`web/src/lib/db.ts` écrit SQLite dans `process.cwd()/data`. Le `railway.toml`
ne monte aucun volume et ne définit pas `DATA_DIR`. Sur Railway ce disque est
éphémère : **chaque redeploy efface fellowships, XP, ladder, habits et stakes.**
Constaté en direct : les deux codes de fellowship d'Etienne renvoyaient 404.

Tant que ce n'est pas réglé, la couche communautaire ne peut pas exister.

### T4 — Aucun retour sur l'effort fourni

L'extension compte `stats.blocks` et `stats.focusMinutes` tous les jours, et
**rien de tout ça n'est affiché**. L'utilisateur bloque des distractions et ne
voit jamais le score. C'est le carburant de rétention le moins cher du produit,
il est déjà collecté et jeté.

### T5 — Zones d'ombre non dites

Navigation privée (l'extension est désactivée par défaut en incognito), autres
navigateurs (Firefox/Safari), et applications desktop (Discord, Steam) ne sont
pas couverts. Le produit ne le dit nulle part, donc l'utilisateur découvre le
trou tout seul, ce qui détruit la confiance.

---

## 3. Backlog

### EPIC A — Activation : de la landing à « je suis bloqué » en moins de 2 min
*Objectif : supprimer T1. C'est la priorité absolue.*

- **A1** — Publier l'extension sur le Chrome Web Store, remplacer les
  instructions `Load unpacked` par un bouton « Add to Chrome ». (dépend d'un
  compte développeur à 5 $ et d'une revue de quelques jours)
- **A2** — Détection d'état à l'arrivée : si l'extension est absente, l'écran
  Block affiche une seule action, pas la liste. La liste ne sert à rien sans
  moteur.
- **A3** — Onboarding 3 étapes (installer → choisir un preset → armer), avec
  une vérification réelle à chaque étape (pas un toast optimiste).
- **A4** — Bouton « Tester le shield » qui ouvre un site bloqué dans un onglet
  et confirme visuellement que ça marche.

### EPIC B — Granularité : servir sur le web ce que le desktop sait déjà faire
*Objectif : combler T2, et récupérer le différenciateur produit.*

- **B1** — Path rules dans l'extension : bloquer `youtube.com/shorts` et
  `instagram.com/reels` en laissant passer le reste du domaine.
- **B2** — Preset « Deep Work / Lockdown » côté web, câblé sur B1 (même
  vocabulaire que le desktop).
- **B3** — UI d'allowlist (sites toujours autorisés).
- **B4** — Mode par site : bloc dur vs friction, réglable depuis la liste.
- **B5** — UI de planning (blocage automatique 9h-12h, etc.), `prefs.schedules`
  existe déjà côté extension.

### EPIC C — Fiabilité et confiance
*Objectif : combler T3 et T5.*

- **C1** — Volume Railway + `DATA_DIR=/data`. **Bloquant pour toute la couche
  guilde.** Une variable et un volume, pas de refonte.
- **C2** — Migration Postgres si plusieurs instances un jour (pas urgent).
- **C3** — Détecter et expliquer l'incognito, proposer d'activer « Autoriser en
  navigation privée ».
- **C4** — Page « Ce que le blocker ne couvre pas », assumée, liée depuis le
  statut. Mieux vaut le dire que le faire découvrir.
- **C5** — Port Firefox (WebExtensions, DNR supporté) une fois le Store fait.

### EPIC D — Redevabilité : la couche qui fait revenir
*Objectif : combler T4 et exploiter la guilde.*

- **D1** — Afficher les stats déjà collectées : distractions déviées
  aujourd'hui, minutes de focus, série en cours.
- **D2** — Personas sur la page de bloc (fait — 7 personas, citations réelles
  pour les personnes réelles, personnages libres pour la fiction).
- **D3** — Notifier la guilde sur une tentative de contournement (le shield
  coupé en session est déjà loggé via `action: "bypass"`).
- **D4** — Relier les stakes (`StakesPanel`) aux résultats réels du blocker :
  un pari perdu si l'objectif de focus n'est pas tenu.
- **D5** — Récap hebdomadaire par mail.

### EPIC E — Monétisation
Voir la section 5.

---

## 4. Ordre d'exécution recommandé

1. **C1** (volume Railway) — sans ça, la guilde est une fiction.
2. **B1 + B2** (path rules) — c'est le produit, et le code desktop existe déjà.
3. **D1** (stats) — gratuit, les données sont déjà là.
4. **A4** puis **A2/A3** — activation.
5. **A1** (Chrome Web Store) — le vrai déverrouillage business, mais délai
   externe, donc à lancer en parallèle dès maintenant.

---

## 5. Modèle économique

Le produit a une particularité : **la valeur perçue augmente avec la
contrainte**, et la contrainte est plus crédible quand elle est sociale. C'est
ce qui doit être payant, pas le blocage lui-même.

Un blocage de sites nu ne se vend pas : uBlock, LeechBlock et Cold Turkey Free
le font gratuitement. Faire payer pour ça, c'est se comparer à zéro.

**Recommandation : freemium, avec la ligne de coupe sur le social et
l'engagement, jamais sur le blocage.**

### Free — « Solo »
Blocage illimité, presets, timer, page de bloc avec personas, stats du jour.
Assez généreux pour être recommandé. C'est l'acquisition.

### Pro — 5 à 7 €/mois (ou 49 €/an)
- Path rules et planning (B1, B5)
- Historique et tendances au-delà de 7 jours
- Multi-appareils (extension + desktop synchronisés)
- Mode hardcore (déblocage à délai, sans échappatoire)
- Personas premium et thèmes

### Guild — 4 €/membre/mois, minimum 3 membres
- Ladder, XP, classement
- Notifications de contournement à la guilde
- Stakes / cagnotte hebdomadaire (D4)
- Récap hebdo partagé

C'est ce palier qui a le meilleur potentiel : il est **intrinsèquement
multi-joueur**, donc chaque membre payant en recrute d'autres, et le coût de
churn est social, pas contractuel. Quelqu'un qui quitte sa guilde perd sa place
au classement et son argent misé.

### Ce que je déconseille
- **Freemium avec limite de sites** (« 3 sites gratuits ») : ça punit
  exactement le comportement qu'on veut encourager, et ça se contourne en 10 s
  avec un concurrent gratuit.
- **Paywall sur le blocage lui-même** : le produit perd sa raison d'exister et
  la comparaison avec le gratuit devient mortelle.
- **One-shot à vie** : les coûts sont récurrents (hébergement, maintien des
  règles face aux changements de YouTube/Instagram), la revente à vie ne les
  couvre pas.

### Prérequis avant de facturer quoi que ce soit
1. **C1** — sinon on vend un abonnement à une base de données qui se vide.
2. **A1** — sinon le tunnel d'achat commence par « activez le mode
   développeur ».

Tant que ces deux-là ne sont pas faits, monétiser serait prématuré.
