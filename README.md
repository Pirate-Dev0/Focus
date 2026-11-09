# Focus

Ton outil perso : **Life · Portefeuille · Projets**, avec ton objectif principal en haut du dashboard.
Web app installable sur iPhone, synchro tel ↔ ordi et notifications. **100 % gratuit, un seul compte : GitHub.**

```
npm install
npm run dev      # http://localhost:5173
```

## Comment ça marche

```
focus        (repo PUBLIC)  → le code de l'app, hébergé sur GitHub Pages
focus-data   (repo PRIVÉ)   → tes données (data.json) + l'Action qui envoie les rappels
```

L'app parle directement à l'API GitHub avec un token perso : chaque modif devient un commit de `data.json` dans ton repo privé (regroupées toutes les 2-3 s). Les autres appareils récupèrent les changements quand tu rouvres l'app, et toutes les minutes quand elle est ouverte.
Bonus : tout l'historique de tes données est dans les commits.

Sans connexion GitHub, Focus marche en **mode local** (données sur l'appareil uniquement).

---

## 1. Mettre l'app en ligne (repo public `focus`)

1. Crée un repo **public** `focus` sur GitHub et pousse ce dossier :
   ```
   git init && git add . && git commit -m "Focus v1"
   git branch -M main
   git remote add origin https://github.com/<ton-pseudo>/focus.git
   git push -u origin main
   ```
2. **Settings → Pages → Source : GitHub Actions**.
3. **Actions → Deploy Focus → Run workflow** (ou fais simplement un nouveau push).
4. L'app est en ligne sur `https://<ton-pseudo>.github.io/focus/`. Chaque `git push` la remet à jour toute seule.

> Le code est public, mais pas tes données : elles sont uniquement dans ton repo privé. Seules les données de départ importées de Notion (noms de projets, 3 tâches) sont dans `src/seed.ts`. Vide ce fichier si tu veux.

## 2. Créer le repo de données (repo PRIVÉ `focus-data`)

1. Crée un repo **privé** `focus-data`, puis pousse le dossier `focus-data/` du zip :
   ```
   cd focus-data
   git init && git add . && git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/<ton-pseudo>/focus-data.git
   git push -u origin main
   ```
2. Crée un **token** : GitHub → Settings → Developer settings → **Personal access tokens → Fine-grained tokens → Generate new token**
   - Expiration : la plus longue possible (tu le remettras quand il expire)
   - Repository access : **Only select repositories → focus-data**
   - Permissions → Repository : **Contents : Read and write** et **Actions : Read and write** (pour le bouton « notif de test »)
   - Copie le token `github_pat_…`
3. Dans Focus : **Réglages → Synchro GitHub** → ton pseudo, `focus-data`, le token → **Connecter**.
   Le premier appareil envoie tes données. Sur les autres, même chose : ils récupèrent tout.

## 3. Installer sur l'iPhone

Ouvre l'URL dans **Safari** → **Partager** → **Sur l'écran d'accueil**, puis ouvre Focus depuis l'icône.
⚠️ L'app installée a son propre stockage : connecte GitHub (étape 2.3) **depuis l'app installée**, pas depuis Safari.

## 4. Notifications (habitudes à 21h, deadlines à 9h)

1. Génère des clés VAPID : `npx web-push generate-vapid-keys`
2. Dans le repo **focus-data** → Settings → Secrets and variables → Actions, ajoute :
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, et `VAPID_SUBJECT` = `mailto:ton@email.com`
3. Dans Focus → **Réglages → Notifications** : colle la clé **publique** (une seule fois, elle se synchronise).
4. Sur l'iPhone (dans l'app installée) : **Activer** puis **Envoyer une notif de test** (elle arrive en ~1 min).

L'Action `Rappels Focus` tourne toutes les heures de 6h à 23h. À l'heure choisie dans Réglages (heure de Paris), elle envoie :
- **le soir** : les habitudes pas encore cochées (rien si tout est fait) ;
- **le matin** : les tâches du jour, celles en retard, et les deadlines de projet à 3 jours.

Les crons GitHub peuvent avoir quelques minutes de retard, donc la notif peut arriver vers 21h10. Elle ne part qu'une fois par jour : c'est mémorisé dans `.notify-state.json`.
Coût : environ 550 minutes d'Actions par mois, alors que le compte gratuit en donne 2 000 pour les repos privés.

---

## Ce qu'il y a dedans

| | |
|---|---|
| **Dashboard** | Objectif principal (jauge auto = somme du MRR des projets), habitudes du jour en un tap, tâches du jour / en retard / P0, la semaine, résumé Life · Portefeuille · Projets |
| **Life → Habitudes** | Grille de la semaine, jours au choix par habitude, séries 🔥 |
| **Life → Salle** | Programmes (Push/Pull/Legs modifiables), séance avec charges de la dernière fois pré-remplies, records, 1RM estimé, courbe par exercice, poids de corps. Terminer une séance coche l'habitude « Salle » |
| **Portefeuille** | MRR par projet + historique, abonnements déduits pour le net mensuel, dépenses ponctuelles par mois, **Vinted séparé** (solde, bénéfice, marge, stock immobilisé) |
| **Projets** | Un kanban par projet (À faire / En cours / Bloqué / Fait), glisser-déposer (appui long sur iPhone), checklist, priorités, échéances, jauge d'objectif (MRR ou perso) |
| **Ajout rapide** | Bouton + (ou touche `C` sur ordi) : tâche, dépense, article Vinted, poids |
| **Raccourcis ordi** | `C` ajout rapide · `1` `2` `3` `4` sections · `Échap` fermer |

## Bon à savoir

- **Conflits** : si tu modifies sur le tel et l'ordi en même temps, c'est la version la plus récente qui gagne. En pratique, ça n'arrive pas pour un usage solo.
- **Token** : il est stocké sur l'appareil, pas dans le code. S'il expire, la synchro passe en « Erreur » : crée-en un nouveau, puis Déconnecter → Connecter.
- **Stack** : Vite + React + TypeScript, PWA (vite-plugin-pwa), API GitHub Contents, GitHub Actions (Pages + cron), web-push.
