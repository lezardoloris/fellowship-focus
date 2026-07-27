# SERP, persona, conversion et moat

*27/07/2026. SERP live via DataForSEO. Corrige mon calcul de LTV, qui était faux.*

---

## 1. Ma règle des 25× était fausse. Voici la bonne.

Tu as raison : **le CPC se règle sur la LTV, qui s'étale sur des années.** J'utilisais un cumul à 12 mois comme si c'était la LTV. Ce n'est pas la même chose.

```
LTV = ARPU mensuel / churn mensuel          ← la vraie formule
CAC = CPC × 80                              (1,25 % du clic au paiement)
Viable si LTV ≥ 3 × CAC
⟹ prix mensuel ≥ CPC × 240 × churn
```

**Le churn devient le levier principal**, pas le prix.

| Churn mensuel | Prix requis |
|---|---|
| 5 % (grand public volatil) | CPC × 12 |
| 3 % | CPC × 7,2 |
| **2 % (achat de conviction)** | **CPC × 4,8** |
| 1,5 % (B2B installé) | CPC × 3,6 |

**Ce que ça change, marché par marché :**

| Sous-niche | CPC | Prix réel | Churn est. | LTV | CAC | Ratio | Verdict corrigé |
|---|---|---|---|---|---|---|---|
| **Accountability** | 2,35 $ | 17 $ | 2 % | **850 $** | 188 $ | **4,5** | ✅ **passe même en générique** |
| Blocage distraction | 1,94 $ | 3,33 $ | 5 % | 67 $ | 155 $ | 0,43 | ❌ toujours mort |
| Contrôle parental | 4,61 $ | 10 $ | 5 % | 200 $ | 369 $ | 0,54 | ❌ |
| Surveillance salariés | 67,97 $ | 200 $ (20 sièges) | 1,5 % | 13 333 $ | 5 438 $ | 2,45 | ⚠️ limite, explique le CPC |
| Suivi du temps | 62,44 $ | 240 $ (20 sièges) | 2 % | 12 000 $ | 4 995 $ | 2,40 | ⚠️ idem |

**La correction sauve ①, et elle explique enfin pourquoi les concurrents enchérissent à 62 $** : ils vendent 20 sièges avec 2 % de churn, pas un abonnement solo. Mon erreur venait de raisonner en utilisateur unique.

---

## 2. Ce que la SERP montre, et que les volumes cachaient

Requête analysée : **« covenant eyes alternative »**.

### a. L'AI Overview occupe la position 1 et cite les prix

Google affiche directement Ever Accountable, Canopy, Accountable2You **avec leurs tarifs** avant tout résultat organique. Conséquence : **le clic organique est écrasé**, et la place au-dessus de l'AI Overview, c'est-à-dire l'annonce payante, prend de la valeur. Être 5e organique ne vaut plus rien.

### b. Toute la première page appartient aux concurrents

`everaccountable.com`, `canopy.us`, `digitalzen.app` classent chacun un article « alternatives à Covenant Eyes ». **Ils font du conquesting par le contenu**, pas par l'enchère. C'est le terrain, et il est déjà occupé par du SEO.

### c. L'intention réelle est le prix, pas la fonctionnalité

Les recherches associées disent tout :

> « Covenant eyes alternative **free** » · « **Cheaper** alternatives to Covenant Eyes » · « Covenant eyes alternative **reddit** »

**C'est du trafic de chasseurs de prix.** Ils partent parce que 17 $/mois est trop cher. Si tu les captes, ton ARPU n'est pas 17 $, il est plus proche de 7 à 9 $, ce qui divise ta LTV par deux et ramène le ratio à **2,1**.

C'est la nuance que les volumes seuls ne montraient pas, et elle est décisive.

### d. Un concurrent solo occupe déjà l'angle que j'aurais recommandé

**DigitalZen**, 2e organique, se positionne « privacy-first, blocking-first, **sans captures d'écran ni journaux** », à **3 $/mois ou 119 $ à vie**. C'est exactement le wedge « on bloque au lieu de surveiller » que j'aurais proposé, et il est pris.

---

## 3. Les trois personas qui se percutent sur la même requête

La SERP les mélange, et c'est **l'erreur que fait tout le marché** :

| Persona | Ce qu'il veut | Qui le sert | Prix |
|---|---|---|---|
| **Le parent** | filtrer avant que l'enfant voie | Canopy, Bark, Qustodio, Net Nanny | 5-15 $ |
| **L'individu en démarche** | ne pas rechuter, seul | Ever Accountable, Fortify | 9-17 $ |
| **Le couple / le binôme** | un tiers reçoit le rapport | Covenant Eyes, Accountable2You | 9-17 $ |

Le parent veut **bloquer**. Le binôme veut **rapporter**. Ce sont des produits opposés, vendus sur la même page, ce qui explique que personne ne convertisse très bien.

---

## 4. Ce qui maximise la conversion, d'après la SERP

**a. La promesse qui convertit sur ce trafic est double, prix et vie privée.** Les recherches associées demandent « moins cher » et la SERP valorise « sans captures d'écran ». Une annonce qui dit *« le même engagement, sans qu'on photographie ton écran, à moitié prix »* répond aux deux intentions dominantes simultanément.

**b. Un persona par page de destination.** Trois audiences sur une page, c'est la conversion divisée par trois. Le parent et le binôme ne doivent jamais voir la même page.

**c. Il faut être cité dans l'AI Overview.** Elle est en position 1 et donne les prix. Aujourd'hui elle cite Ever Accountable, Canopy, DigitalZen et Barchart. On y entre par du contenu comparatif structuré, pas par de l'enchère.

**d. Reddit est 2e sur la requête.** L'avis communautaire pèse plus que ta page. Sur ce marché, une recommandation dans un fil vaut mieux qu'une annonce.

---

## 5. Le moat, sur ce marché précis

| Candidat | Type | Solidité |
|---|---|---|
| « Sans captures d'écran » | positionnement | **faible**, déjà pris par DigitalZen |
| IA sur l'appareil | technique | moyenne, revendiquée par Ever Accountable |
| Prix bas | aucun | **nul**, c'est une course vers le bas |
| **Présence dans l'AI Overview** | contenu | **forte**, elle s'accumule et se défend |
| **Distribution par les communautés** (paroisses, groupes) | structurel | **la plus forte**, non copiable à l'enchère |

**Le seul moat sérieux ici n'est pas un moat produit, c'est un moat de distribution** : ce marché s'achète par la recommandation d'un tiers de confiance, pas par une annonce. C'est aussi ce qui explique le churn bas.

---

## 6. Ma réponse à tes trois questions

**Quel persona ?** Le **binôme**, pas le parent. Le parent est écrasé par le gratuit natif d'Apple et Google, et par quatre acteurs financés. Le binôme a un churn structurellement bas parce que l'engagement est social, pas logiciel.

**Quel moat ?** La **distribution communautaire** plus la présence dans l'AI Overview. Aucun des deux ne s'achète, et c'est justement pour ça qu'ils tiennent.

**Ce qui maximise la conversion ?** Une promesse qui répond aux deux intentions visibles dans la SERP (moins cher, sans surveillance de l'écran), sur une page dédiée à un seul persona.

**Mais je dois répéter l'avertissement, parce qu'il grandit avec l'analyse.** Le persona que les chiffres désignent, c'est le binôme, c'est-à-dire un produit qui transmet l'activité d'un adulte à un autre adulte. C'est le cœur de l'affaire, pas un effet de bord. Le même mécanisme sert l'engagement choisi et le contrôle coercitif d'un conjoint, et le marché a déjà commencé à s'en éloigner (Accountable2You met en avant le texte plutôt que la capture « pour protéger la vie privée du partenaire »). Si tu entres, le consentement révocable de la personne surveillée est le produit lui-même.

**Et une chose que je ne peux pas trancher** : ce marché est majoritairement confessionnel aux États-Unis. Les canaux qui marchent sont des paroisses et des groupes de foi. C'est le moat, et c'est aussi le milieu dans lequel il faudrait aller vendre.
