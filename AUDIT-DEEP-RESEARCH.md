# Audit du rapport Gemini Deep Research

*27/07/2026. J'ai écrit les règles que ce rapport devait respecter, donc je l'audite au lieu de le relayer.*

---

## 1. Ce qu'il a bien fait

- **La section « marchés écartés » est la meilleure du rapport.** Le raisonnement y est solide : takeoff BTP à 12 $ de CPC, générateurs de formulaires qui vivent d'une boucle virale et non de l'achat de trafic, réconciliation e-commerce écartée pour risque légal. Ça t'évite réellement du travail.
- **La section « où tu pourrais te tromper » est honnête**, notamment sur la volatilité des enchères quand un concurrent lève des fonds.
- **Le contexte macro est juste et actionnable** : +11 à 12 % d'inflation SaaS en 2025-2026, cinq fois le CPI, ce qui fabrique mécaniquement des requêtes « alternative à X ».

---

## 2. Trois manquements à mes propres règles

### a. Les volumes et les CPC ne sont pas sourcés
Ma consigne était explicite : *« Volumes de recherche : cite l'outil ou la source. »* Le rapport annonce « 15 000+ » et « 3,50 $ » sans jamais nommer un Keyword Planner, un Ahrefs ou un Semrush. Les sources listées en bas sont des **blogs d'éditeurs** (soapnoteai.com, apitemplate.io, docraptor.com), c'est-à-dire des parties prenantes, pas des outils de mesure.

**Tous les chiffres d'acquisition du rapport sont donc des estimations non vérifiées présentées comme des données.** C'est le défaut le plus grave, parce que tout le classement en dépend.

### b. Le classement est circulaire
Le rapport applique **le même taux de conversion (1,25 % du clic au paiement) à tous les marchés**. Donc `CAC = CPC × 80`, mécaniquement. Le classement ne mesure alors qu'une seule chose : **quel marché a le CPC le plus bas**. Tout le reste est décoratif.

Un vrai différentiel de conversion entre un dev qui teste une API et un thérapeute qui confie de l'audio patient existe, et il est probablement d'un facteur 2 à 3. Il n'est pas modélisé.

### c. La LTV ignore le churn, et ça casse deux marchés sur trois
Le rapport pose `LTV 12 mois = prix × 12`, ce qui suppose **zéro départ pendant un an**. Avec un churn SMB réaliste de 4 %/mois, le cumul sur 12 mois vaut `prix × 9,68`, soit **19 % de moins**.

Refaisons ses trois gagnants avec ce seul correctif :

| Marché | LTV annoncée | LTV réelle (churn 4 %) | CAC | Ratio corrigé | Verdict |
|---|---|---|---|---|---|
| Scribe IA thérapeutes | 948 $ | 765 $ | 280 $ | **2,73** | ❌ sous le seuil de 3 |
| API HTML→PDF | 708 $ | 571 $ (churn 2 % : 626 $) | 240 $ | **2,38** (2,61) | ❌ |
| État des lieux immo | 720 $ | 581 $ | 160 $ | **3,63** | ✅ seul survivant |

**Avec la correction la plus élémentaire, il ne reste qu'un marché sur trois.**

---

## 3. Chaque gagnant a une faille qui contredit une de mes contraintes

Et le rapport ne l'a vue dans aucun des trois cas.

### Marché 1 · Scribe IA santé mentale → **conformité lourde**
Ma consigne disait « pas de conformité lourde ». Ce produit traite **de l'audio de séances de psychothérapie**, la donnée de santé la plus sensible qui existe. Le rapport identifie lui-même le moat comme « la signature automatisée d'un BAA et la conformité HIPAA » : c'est exactement ce qui rend le produit **non constructible en solo**, pas un avantage. Et il annonce « Oui (3 mois) » pour une v1 conforme HIPAA, ce qui n'est pas sérieux.

S'ajoute que le rapport admet que le moat n'est pas l'IA (Whisper + GPT accessibles à tous) et liste six concurrents dont un à 26 000 praticiens. Ce marché aurait dû être écarté au critère 6.

### Marché 2 · API HTML→PDF → **la pire audience possible pour Google Ads**
C'est la faille que le rapport ne pouvait pas voir parce qu'elle est contre-intuitive : **52 % des développeurs utilisent un bloqueur de publicité sur desktop, et 72 % chez les développeurs expérimentés.**

Tu paierais donc pour atteindre au mieux la moitié de l'audience, et la moitié restante est la moins expérimentée, donc la moins susceptible d'avoir une carte d'entreprise. **Un marché devtools annule ton seul avantage structurel.** Sur ce segment tu serais un fondateur normal.

### Marché 3 · État des lieux immobilier → **hors de ta pile technique**
C'est le seul qui survit à la correction du churn, et le rapport décrit lui-même la solution : *« une architecture offline-first robuste (React Native…) »*, avec appareil photo, synchronisation en arrière-plan et signature sur tablette.

Or ta pile déclarée est **Windows natif, Next.js, extension Chrome**. Pas de mobile. Le cœur du produit est une **app mobile terrain**, c'est-à-dire la chose que tu n'as jamais livrée. Ce n'est pas rédhibitoire, mais ça déplace la v1 bien au-delà des 6 mois.

---

## 4. Ce que j'en garde

**Le rapport n'a pas trouvé de marché qui coche tes sept critères.** Il aurait dû le dire, ma consigne l'y autorisait explicitement.

Ce qui reste réellement exploitable :

1. **Le mécanisme « alternative à X » est validé** par l'inflation SaaS de 12 %. C'est la meilleure idée du rapport, et elle est indépendante des trois marchés proposés.
2. **Le filtre anti-devtools est acquis** : ton avantage Google Ads exige une audience **non technique**. Ça élimine d'un coup une grande famille de niches et c'est une contrainte précieuse.
3. **L'état des lieux immobilier mérite une vérification réelle** : CPC bas, acheteur non technique donc sans bloqueur, douleur juridique claire. À condition de vérifier les volumes avec un vrai Keyword Planner, ce que tu peux faire toi-même en cinq minutes, et d'accepter la marche mobile.

**Le prochain pas utile n'est pas une nouvelle recherche IA.** C'est d'ouvrir ton Keyword Planner sur trois ou quatre candidats non techniques et de regarder les vrais volumes et les vrais CPC. Tu as l'outil que ce rapport a simulé.
