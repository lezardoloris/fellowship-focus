# Plan — armement total, désarmement total (Epic REL)

*27/07/2026. Écrit après inventaire de chaque mutation que l'app applique à la machine, et de ce qui la retire. Format BMAD : invariant, inventaire, écarts prouvés, epics et stories, matrice de tests.*

---

## 1. L'invariant

Deux phrases, et tout le reste en découle.

> **Armer** applique toutes les couches, ou dit lesquelles manquent. Jamais de bouclier qui se croit complet.
>
> **Désarmer** rend la machine à l'état d'avant, vérifié, y compris pour les applications natives, y compris après un `kill -9`, y compris si l'app ne redémarre jamais.

La seconde est la plus dure et c'est celle qui a été violée. Une couche appliquée sans retrait garanti est une **dette posée sur la machine de l'utilisateur**, pas une fonctionnalité.

---

## 2. Inventaire : tout ce que l'armement touche

| # | Mutation | Portée | Retrait | Vérifié | Survit à un kill |
|---|---|---|---|---|---|
| 1 | Bloc dans `C:\Windows\System32\drivers\etc\hosts` | **Machine entière, apps natives comprises** | `clear_hosts()` | ✅ *(corrigé)* | ✅ *(corrigé)* |
| 2 | Règle pare-feu `FellowshipFocusQUIC` (UDP 443 sortant) | Machine entière | `clear_quic_block()` | ✅ *(corrigé)* | ✅ *(corrigé)* |
| 3 | Cache DNS Windows | Machine entière | `flush_dns()` | ✅ *(corrigé)* | n/a |
| 4 | Proxy système WinINET | Session utilisateur | `delete_proxy()` | ⚠️ supprime, ne restaure pas | ⚠️ |
| 5 | **`DisableQuic` : 4 valeurs de registre Chrome et Edge** | **Navigateurs, définitif** | ❌ **aucun** | ❌ | ❌ |
| 6 | Processus `mitmdump` et enfants | Machine | `kill_mitmdump()` arbre récursif | ✅ | ⚠️ orphelins possibles |
| 7 | Agent élevé persistant | Machine | heartbeat, expire | ⚠️ | ⚠️ |
| 8 | **État « armé » côté serveur, lu par l'extension** | **Navigateur, sans limite de temps** | ❌ **rien n'expire** | ❌ | ❌ |
| 9 | **Autorité de certification mitm dans le magasin Windows** | **Machine, sécurité** | `uninstall_cert_windows()` **jamais appelée** | ❌ | ❌ |
| 10 | Clé `Run` de démarrage automatique | Session | `DeleteValue` | ✅ | n/a (hors bloqueur) |

Dix mutations. **Quatre n'ont pas de retrait fiable.**

---

## 3. Les écarts, avec la preuve

### R1 · QUIC reste désactivé pour toujours · **P0**
`disable_browser_quic()` ([manager.py:294](desktop/fellowship_focus/blocker/manager.py#L294)) écrit `DisableQuic` dans quatre emplacements : les politiques Chrome et Edge, plus les `ExperimentalSettings` de repli. Aucune fonction ne les efface, dans aucun fichier.

Conséquence : **tu lances l'app une fois, et Chrome perd HTTP/3 définitivement.** Connexions plus lentes, pour toujours, y compris après désinstallation, sans rien qui l'indique. C'est la violation la plus nette de « tout se remette en route ».

### R2 · L'extension bloque encore quand l'app est morte · **P0**
L'extension calcule `shieldOn` depuis la config qu'elle récupère du serveur ([background.js:387](extension/background.js#L387)). Si l'app est tuée pendant qu'elle est armée, l'état serveur reste « armé » et **rien ne l'expire**. L'extension continue de bloquer indéfiniment, y compris après un redémarrage de la machine, y compris si l'app n'est jamais relancée.

### R3 · L'autorité de certification reste dans le magasin · **P1**
`uninstall_cert_windows()` existe et **n'est appelée nulle part**. Un certificat racine d'interception reste installé pour toujours. Au-delà de la propreté, c'est une surface de sécurité : une racine de confiance qui n'a plus de raison d'être.

### R4 · Le proxy est supprimé, pas restauré · **P2**
`set_system_proxy(False)` appelle `delete_proxy()`. Un proxy d'entreprise configuré avant l'armement est perdu. *Arbitrage assumé* : supprimer garantit l'accès, restaurer pourrait re-bloquer. À revoir seulement si des postes en entreprise deviennent une cible.

### R5 · Aucun point de réparation · **P0**
Il n'existe aucune commande « tout relâcher ». Si un retrait échoue, l'utilisateur n'a aucun moyen d'agir depuis l'app. J'ai ajouté un avertissement qui parle de réparation ; **la réparation n'existe pas encore.**

---

## 4. Epics

### REL-1 · Un registre des mutations, une seule vérité · P0
Aujourd'hui les couches sont appliquées à quatre endroits et retirées à trois autres. Tant que ce n'est pas centralisé, chaque nouvelle couche recréera un trou.

- **REL-1.1** Un module `registry.py` qui déclare chaque mutation avec trois fonctions : `apply()`, `release()`, `present()`.
- **REL-1.2** `arm()` parcourt le registre, applique tout, renvoie les couches obtenues **et** manquantes.
- **REL-1.3** `release_all()` parcourt le registre **en sens inverse**, retire tout, puis **revérifie chaque `present()`** et renvoie la liste de ce qui résiste.
- *Critère* : ajouter une couche sans écrire son `release()` fait échouer un test, pas la machine de l'utilisateur.

### REL-2 · Restaurer QUIC · P0
- **REL-2.1** `restore_browser_quic()` supprime les quatre valeurs, en distinguant « valeur absente avant nous » de « valeur posée par nous ». Mémoriser l'état antérieur à l'écriture.
- **REL-2.2** Appelée par `release_all()`, et une fois au démarrage si un résidu est détecté.
- *Critère* : après un cycle armer/désarmer, `reg query` ne renvoie aucune des quatre valeurs, sauf si elles préexistaient.

### REL-3 · L'extension ne peut pas bloquer plus longtemps que l'app ne vit · P0
Le principe : **le blocage doit expirer tout seul.** Une extension qui dépend d'un signal « arrête-toi » bloquera pour toujours le jour où ce signal ne vient pas.

- **REL-3.1** L'état armé porte une **échéance** (fin de session plus une marge courte), pas un booléen.
- **REL-3.2** Sans battement de cœur de l'app pendant N minutes, l'extension se désarme elle-même et le dit dans son popup.
- **REL-3.3** Le serveur expire l'état armé côté API, pour que le web soit cohérent avec l'extension.
- *Critère* : app tuée, machine redémarrée, l'extension ne bloque plus au bout de N minutes sans intervention.

### REL-4 · Réparer, visiblement · P0
- **REL-4.1** Un bouton **« Tout débloquer »** dans les réglages : lance `release_all()`, affiche le résultat couche par couche, avec des coches, pas un toast.
- **REL-4.2** Si une couche résiste, dire **laquelle** et proposer l'action (accepter l'UAC, ou la commande exacte à coller).
- **REL-4.3** Ce bouton marche même si le bouclier se croit déjà désarmé, puisque c'est précisément ce cas qui pose problème.
- *Critère* : depuis une machine avec résidu, deux clics rendent l'accès, et l'écran le prouve.

### REL-5 · Retirer le certificat · P1
- **REL-5.1** Appeler `uninstall_cert_windows()` au désarmement définitif (désinstallation, ou « Tout débloquer » avec l'option cochée), pas à chaque session.
- **REL-5.2** L'écran des réglages montre si la racine est installée et permet de la retirer.
- *Critère* : après retrait, `certutil -store Root` ne renvoie plus la racine.

### REL-6 · Le filet de sécurité ne dépend pas d'une sortie propre · P0
`atexit` ne s'exécute pas sur un kill, et la réconciliation au démarrage ne sert à rien si l'app n'est jamais relancée.

- **REL-6.1** Écrire un **journal d'armement** sur disque (quelles couches, quand, pour quelle session) avant d'appliquer, pas après.
- **REL-6.2** Au démarrage, si le journal dit « armé » alors qu'aucune session ne tourne, tout relâcher.
- **REL-6.3** *À trancher* : une tâche planifiée Windows qui relâche tout au démarrage de la machine si le journal est resté ouvert. Elle règle le cas « l'app n'est jamais relancée », mais elle ajoute une tâche persistante à nettoyer. **Ne pas faire sans arbitrage explicite** : ce serait ajouter une onzième mutation pour en réparer une autre.

### REL-7 · Armer dit la vérité sur ce qui manque · P1
`shield_strength()` existe déjà et compte les couches. À finir de câbler :

- **REL-7.1** Refuser d'afficher « bouclier complet » quand une couche manque, quelle qu'elle soit.
- **REL-7.2** Nommer la couche manquante et sa raison (UAC refusé, poste sous GPO, agent mort).
- *Critère* : sur une machine où l'élévation est refusée, l'app affiche « partiel, 2 couches sur 4 » et dit lesquelles.

---

## 5. Matrice de tests

Chaque ligne doit passer avant de dire que l'invariant tient. Les trois premières sont celles qui ont déjà cassé.

| # | Scénario | Attendu |
|---|---|---|
| T1 | Armer, tuer l'app dans le gestionnaire de tâches, relancer | Tout relâché, vérifié, WhatsApp Desktop joignable |
| T2 | Armer, tuer l'app, **ne jamais relancer**, redémarrer la machine | Extension désarmée d'elle-même ; hosts et pare-feu traités par REL-6 |
| T3 | Armer puis désarmer normalement | Les 4 valeurs `DisableQuic` absentes ; cache DNS vidé |
| T4 | Refuser l'UAC à l'armement | Bouclier « partiel », couches manquantes nommées, aucun résidu |
| T5 | Refuser l'UAC au désarmement | Échec **annoncé**, bouton « Tout débloquer » proposé |
| T6 | Armer, couper le courant, rallumer | Aucun blocage résiduel après REL-6 |
| T7 | Deux instances lancées en même temps | Une seule arme ; la seconde ne relâche pas sous la première |
| T8 | Désarmer alors que rien n'est armé | Aucune UAC, aucune écriture, retour immédiat |
| T9 | Fichier hosts contenant des entrées d'autres outils | Elles survivent au cycle complet |
| T10 | Armer, désarmer, vérifier une app native (WhatsApp Desktop) | Reconnexion sans redémarrer l'app |

---

## 6. Ordre

**REL-2** et **REL-4** d'abord : la restauration de QUIC est un vrai dommage en cours sur toute machine ayant lancé l'app, et le bouton de réparation est le filet qui rend tout le reste rattrapable. Puis **REL-3** (l'extension qui bloque toute seule est le pire scénario restant), puis **REL-6**, puis **REL-1** qui empêche la récidive, enfin **REL-5** et **REL-7**.

REL-1 arrive volontairement après les correctifs : refactoriser d'abord retarderait des réparations que des utilisateurs subissent déjà.

---

## 7. La règle à retenir

**Aucune couche ne s'écrit sans que son retrait soit écrit et testé dans le même commit.** Les quatre trous de cet inventaire viennent tous du même geste : une couche ajoutée pour renforcer le blocage, et le retrait remis à plus tard.

Corollaire pour l'extension : **le blocage expire, il ne s'arrête pas sur ordre.** Un ordre peut ne jamais arriver.
