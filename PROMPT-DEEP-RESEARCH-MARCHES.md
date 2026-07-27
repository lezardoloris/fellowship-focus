# Prompt Google Deep Research — trouver un marché achetable en Google Ads

*À coller tel quel dans Gemini Deep Research (ou Perplexity Deep Research / ChatGPT Deep Research). Tout ce qui suit la barre est le prompt.*

---

Tu es analyste de marché. Ta mission est de **trouver et classer des marchés logiciels que je peux attaquer seul et distribuer en Google Ads**, avec des chiffres sourcés et datés. Pas de conseils génériques, pas de listicles.

## Qui je suis, et pourquoi ça change la réponse

- **Consultant Google Ads professionnel.** C'est mon métier, avec des comptes clients réels. J'achète du search mieux et moins cher qu'un fondateur normal. **Traite ça comme un actif, pas comme un canal neutre.** Un marché où le search est cher mais mal exploité par les concurrents est un avantage pour moi, pas un repoussoir.
- **Développeur solo.** Je livre du Windows natif, du web (Next.js) et des extensions Chrome. Pas d'équipe, pas de commerciaux.
- **Pas de budget de levée.** L'acquisition doit s'autofinancer.
- **Je ne veux pas de vente entreprise** : pas de démo, pas d'appel d'offres, pas de DPO. Libre-service ou petit compte.

Mon objectif réaliste est **200 à 300 k€ d'ARR en solo**, pas une licorne. Un marché « trop petit » pour un fonds peut être parfait pour moi. Dis-le si c'est le cas.

## Ce qui qualifie un marché (critères de filtrage, à appliquer strictement)

Un candidat n'est retenu que s'il coche **tous** ces points, et tu dois montrer le chiffre pour chacun :

1. **Demande de recherche déjà existante.** Au moins **5 000 recherches/mois** cumulées aux États-Unis ou en Europe de l'Ouest sur des requêtes à **intention commerciale** (« best X software », « X alternative », « X pricing », « logiciel de X »). Donne les requêtes et les volumes.
2. **Un CPC compatible avec le prix.** Donne la fourchette de CPC observée. Calcule le CAC implicite avec un taux de conversion visiteur → essai de 3 à 8 %, et essai → payant de 20 à 30 %. **Montre le calcul.**
3. **Un prix qui porte ce CAC.** Ratio LTV/CAC visé ≥ 3 sur 12 mois. Si le prix du marché est trop bas pour absorber le CAC, écarte le marché et dis-le explicitement.
4. **Une preuve que des gens paient déjà.** Au moins deux acteurs payants existants avec un chiffre d'affaires ou un nombre de clients publiquement estimé. **Un marché sans concurrent payant n'est pas vierge, il est mort.**
5. **Pas dominé par un acteur unique** détenant plus de ~60 % du search paid ou de la part de marché.
6. **Constructible par une personne seule en moins de 6 mois** jusqu'à une v1 vendable. Pas de place de marché à deux faces, pas de conformité lourde, pas de besoin d'un stock ou d'une logistique.
7. **Revenu récurrent.** Abonnement, pas achat unique. Justifie si tu proposes une exception.

## Étalonnage : ce que j'ai déjà mesuré

Utilise ces repères pour juger si un marché est meilleur ou pire que ce que je connais déjà. Ne les répète pas, sers-t'en pour comparer.

- Catégorie suivi du temps / anti-distraction : plafond solo autour de **12-15 €/mois**, et Memtime a mis **11 ans pour atteindre 4 M$ avec 36 salariés**, soit ~111 k$ par tête, sous le repère SaaS de 150-200 k$. **Marché réel mais lent.**
- Dans cette catégorie, l'argent est **en par-siège chez des cabinets**, pas chez les indépendants.
- Cold Turkey vend **39 $ une fois**, ce qui ne finance aucun développement continu.

**Je cherche mieux que ça** : soit un prix par utilisateur plus élevé, soit un cycle de vente plus court, soit une croissance moins lente.

## Où chercher en priorité

Explore au moins ces directions, et ajoutes-en si tu en trouves de meilleures :

- **Logiciels de niche pour professions réglementées ou techniques** (cabinets comptables, artisans, santé, immobilier, juridique) où le prix par utilisateur dépasse 50 €/mois.
- **Outils qui remplacent un tableur** dans un métier précis, là où le tableur est le concurrent principal.
- **Marchés où un acteur historique vient d'augmenter ses prix ou d'être racheté**, provoquant une fuite de clients. C'est une fenêtre datée et exploitable en Google Ads sur les requêtes « alternative à X ». Cherche activement ces événements sur les 18 derniers mois.
- **Outils B2B « sur le poste de travail »** (desktop, extension) où les acteurs SaaS purs ne vont pas.
- Segments où **l'acheteur est aussi l'utilisateur** et peut payer par carte sans validation hiérarchique.

## Ce que tu dois produire

### 1. Tableau de tête

Les **8 à 12 marchés** retenus, classés par attractivité pour moi, avec en colonnes : marché, requête principale et son volume, CPC moyen, prix médian du marché, CAC estimé, ratio LTV/CAC, concurrent principal et son CA estimé, difficulté de construction en mois, et une note sur 10 justifiée.

### 2. Fiche détaillée pour les 3 premiers

Pour chacun :

- **L'acheteur précis** : métier, taille, ce qu'il utilise aujourd'hui, ce qui le fait souffrir. Pas « les PME ».
- **Le mot-clé exact** que je devrais acheter, avec volume, CPC et concurrence, plus 5 requêtes de longue traîne moins chères.
- **Les concurrents** : prix, positionnement, chiffre d'affaires ou clients estimés, et **leur faille**.
- **Le moat possible** pour un nouvel entrant, en distinguant le moat produit (copiable) du moat structurel (données, intégration, réglementation, effet de réseau).
- **La promesse chiffrée** que je pourrais tenir, et la garantie associée.
- **Ce qui pourrait tuer ce marché** dans les 24 mois : un acteur qui descend en gamme, une fonctionnalité native ajoutée par Microsoft ou Google, une IA qui rend l'outil inutile.

### 3. Ce que tu écartes, et pourquoi

Liste les marchés examinés puis rejetés, avec le critère précis qui a échoué et son chiffre. **Cette section m'intéresse autant que les gagnants** : elle m'évite de refaire le travail.

### 4. Où tu pourrais te tromper

Une section honnête sur les limites de ton analyse : chiffres estimés plutôt que publiés, sources datées, biais de disponibilité des données publiques.

## Règles

- **Chaque chiffre est sourcé et daté.** Un chiffre sans source ne vaut rien ; écris « estimation » et montre le calcul quand tu ne trouves pas.
- **Volumes de recherche** : cite l'outil ou la source. Si tu n'as que des ordres de grandeur, dis-le.
- **Pas de marché sans concurrent payant identifié.**
- Français, ton direct, pas de superlatifs commerciaux.
- Si aucun marché ne coche les sept critères, **dis-le franchement** et donne les trois moins mauvais avec ce qui cloche. Ne force pas une réponse positive.
