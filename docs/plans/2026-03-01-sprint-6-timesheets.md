# Sprint 6 — Module Pointage (Timesheet)

## Context

Le projet ExeTeam dispose des briques de base pour le suivi du temps (modèle `TimeEntry`, CRUD API, formulaire sur la page détail tâche) mais il manque un module Timesheet dédié permettant aux employés de visualiser/saisir leurs heures dans une grille hebdomadaire, aux managers de valider les pointages de leur équipe, et d'intégrer les congés approuvés dans la vue.

## Objectif

Ajouter un module Pointage complet avec :
- Vue hebdomadaire (grille tâches × jours avec saisie inline)
- Vue mensuelle (calendrier avec indicateurs couleur)
- Vue équipe pour managers (validation en masse)
- Export CSV pour la paie
- Intégration des congés et jours fériés

## Architecture

- **Backend** : Étendre le `TimeEntriesModule` existant (pas de nouveau module NestJS)
- **Frontend** : Nouvelles pages sous `/timesheets/` + extension de l'API helper existant
- **Schéma** : Aucune migration nécessaire — tous les modèles existent déjà

## Branch : `feat/timesheets`

---

## Plan de fichier cible : `docs/plans/2026-03-01-sprint-6-timesheets.md`

Le plan d'implémentation complet sera écrit dans ce fichier avec le code source de chaque fichier.

---

## Tâches (8 tâches)

### Tâche 1 : Seed des permissions

**Fichier à modifier :** `packages/db/prisma/seed.ts`

Ajouter 3 permissions : `timesheets.read`, `timesheets.validate`, `timesheets.export`

Mapping rôles :
- `super_admin` : `*` (déjà couvert)
- `gerant` : `timesheets.*`
- `responsable_production` : `timesheets.read`, `timesheets.validate`
- `employe` : `timesheets.read`
- `comptable` : `timesheets.read`, `timesheets.export`
- `rh` : `timesheets.read`, `timesheets.export`

---

### Tâche 2 : Créer les DTOs backend

**Fichiers à créer :**
- `apps/api/src/time-entries/dto/weekly-timesheet.dto.ts` — employeeId (uuid), weekStart (date)
- `apps/api/src/time-entries/dto/monthly-timesheet.dto.ts` — employeeId (uuid), month (string "YYYY-MM")
- `apps/api/src/time-entries/dto/team-timesheet.dto.ts` — managerId (uuid optional), weekStart (date)
- `apps/api/src/time-entries/dto/export-timesheet.dto.ts` — employeeId? (uuid), dateFrom (date), dateTo (date), format (csv)
- `apps/api/src/time-entries/dto/bulk-validate.dto.ts` — ids (uuid[] min 1 max 500)

Pattern : `createZodDto` de `nestjs-zod` comme les DTOs existants.

---

### Tâche 3 : Implémenter les méthodes du service backend

**Fichiers à modifier :**
- `apps/api/src/time-entries/time-entries.service.ts` — ajouter 5 méthodes
- `apps/api/src/time-entries/time-entries.module.ts` — importer `LeavesModule` pour DI de `LeavesService`

**Méthodes à ajouter :**

#### `getWeeklyTimesheet(dto)`
1. Calculer weekEnd = weekStart + 6 jours
2. Requêter TimeEntry (avec task, project), LeaveRequest (approuvées chevauchant la semaine), PublicHoliday, WorkSchedule (via contractType de l'employé)
3. Retourner : `days[]` (7 jours avec entries, totaux, isLeave, isHoliday, conflict), `taskRows[]` (pivot par tâche × jour), `weeklyTotal`, `weeklyExpected`, `leaveDays`, `occupationRate`

#### `getMonthlyTimesheet(dto)`
1. Parser "YYYY-MM" en début/fin de mois
2. Même logique que weekly mais pour le mois entier
3. Retourner : `days[]` avec status (full/partial/missing/leave/holiday/weekend), `weekSummaries[]`, `monthlyTotal`, `monthlyExpected`, `occupationRate`

#### `getTeamTimesheet(dto, userId)`
1. Trouver les subordonnés via `Employee.managerId`
2. Pour chaque subordonné : résumé hebdomadaire (heures totales/attendues, taux occupation, entrées validées/en attente)
3. Retourner : `subordinates[]`, `teamTotal`, `teamExpected`

#### `exportTimesheet(dto)`
1. Requêter les entrées dans la plage, inclure task/employee
2. Générer CSV (séparateur `;`, UTF-8 BOM) : Date;Employé;Réf Tâche;Projet;Heures;Commentaire;Validé
3. Retourner `{ filename, contentType, data }`

#### `bulkValidate(dto, userId)`
1. Vérifier que les entrées appartiennent aux subordonnés du manager (ou user est super_admin/gerant)
2. `updateMany({ where: { id: { in: ids } }, data: { isValidated: true } })`

**Modification existante :** Bloquer `update()` et `remove()` si `isValidated === true` (throw BadRequestException).

**Réutilisation :** `LeavesService.calculateBusinessDays()` pour les jours ouvrés.

---

### Tâche 4 : Ajouter les endpoints au contrôleur

**Fichier à modifier :** `apps/api/src/time-entries/time-entries.controller.ts`

**5 nouveaux endpoints (AVANT les routes `:id` pour éviter les conflits) :**
- `GET /time-entries/weekly` — `@RequirePermissions('timesheets.read')`
- `GET /time-entries/monthly` — `@RequirePermissions('timesheets.read')`
- `GET /time-entries/team` — `@RequirePermissions('timesheets.validate')`
- `GET /time-entries/export` — `@RequirePermissions('timesheets.export')` — streamer le CSV via `@Res()`
- `PATCH /time-entries/bulk-validate` — `@RequirePermissions('timesheets.validate')`

---

### Tâche 5 : Étendre le helper API frontend

**Fichier à modifier :** `apps/web/src/lib/api/time-entries.ts`

Ajouter les interfaces TypeScript : `TimesheetDay`, `TimesheetTaskRow`, `WeeklyTimesheetResponse`, `MonthlyTimesheetResponse`, `TeamMemberSummary`, `TeamTimesheetResponse`

Ajouter les méthodes : `getWeekly()`, `getMonthly()`, `getTeam()`, `exportCsv()`, `bulkValidate()`

---

### Tâche 6 : Créer les pages et composants frontend

**Fichiers à créer :**

| Fichier | Description |
|---------|-------------|
| `apps/web/src/app/(app)/timesheets/page.tsx` | Page serveur, titre "Pointage", rend `<TimesheetsWeekly />` |
| `apps/web/src/app/(app)/timesheets/monthly/page.tsx` | Vue mensuelle, rend `<TimesheetsMonthly />` |
| `apps/web/src/app/(app)/timesheets/team/page.tsx` | Vue équipe, rend `<TimesheetsTeam />` |
| `apps/web/src/app/(app)/timesheets/timesheets-weekly.tsx` | Grille hebdomadaire interactive |
| `apps/web/src/app/(app)/timesheets/timesheets-monthly.tsx` | Calendrier mensuel avec indicateurs |
| `apps/web/src/app/(app)/timesheets/timesheets-team.tsx` | Vue manager avec validation en masse |
| `apps/web/src/app/(app)/timesheets/timesheet-entry-cell.tsx` | Cellule éditable inline (click→input→save) |
| `apps/web/src/app/(app)/timesheets/timesheet-export-button.tsx` | Bouton export CSV (dropdown semaine/mois/personnalisé) |

**Vue hebdomadaire (`timesheets-weekly.tsx`) :**
- Navigation semaine (← → + "Aujourd'hui")
- StatsBar : Total heures | Heures attendues | Taux occupation | Jours de congé
- Onglets : Semaine (actif) | Mois | Équipe
- Grille : colonnes Tâche | Projet | Lun-Dim | Total. Lignes = tâches travaillées
- Lignes congés en bleu (`bg-blue-50`), jours fériés en violet
- Footer : totaux journaliers vs attendus (vert si OK, rouge si déficit)
- Cellules validées avec icône cadenas, non éditables
- Cellules en conflit (entrée sur jour congé) avec bordure orange

**Vue mensuelle (`timesheets-monthly.tsx`) :**
- Navigation mois (← →)
- Grille calendrier 7 colonnes (Lun-Dim)
- Chaque cellule : numéro jour + heures + pastille couleur (vert=complet, jaune=partiel, rouge=manquant, bleu=congé, violet=férié, gris=weekend)
- Click sur jour → navigation vers vue semaine correspondante
- Résumé par semaine + total mensuel

**Vue équipe (`timesheets-team.tsx`) :**
- Navigation semaine
- Table : Employé | Heures saisies | Heures attendues | Taux | Validées | En attente | Actions
- Checkboxes pour sélection + bouton "Valider la sélection"
- Code couleur taux occupation (vert ≥90%, jaune 70-90%, rouge <70%)

---

### Tâche 7 : Ajouter l'entrée dans la sidebar

**Fichier à modifier :** `apps/web/src/components/layout/sidebar.tsx`

Ajouter `{ label: 'Pointage', href: '/timesheets', icon: Clock }` entre "Tâches" et "Sites" dans le tableau `navEntries`. Importer `Clock` de `lucide-react`.

---

### Tâche 8 : Vérification

1. `pnpm build` — compilation sans erreur
2. Vérifier l'ordre des routes dans le contrôleur (routes statiques AVANT `:id`)
3. Vérifier que update/remove rejettent les entrées validées
4. Vérifier la hiérarchie manager pour bulkValidate et getTeam
5. Vérifier le calcul weekStart (toujours un lundi)
6. Vérifier l'export CSV (encodage UTF-8 BOM, séparateur `;`)
7. Vérifier le fallback WorkSchedule (8h/jour Lun-Ven si pas de contrat trouvé)

---

## Graphe de dépendances

```
Tâche 1 (Permissions)  ─┐
Tâche 2 (DTOs)         ─┤── parallèle
                         │
                         └─► Tâche 3 (Service) ─► Tâche 4 (Controller) ─► Tâche 5 (API helper) ─► Tâche 6 (Pages) ─► Tâche 7 (Sidebar) ─► Tâche 8 (Vérification)
```

## Fichiers critiques

- `apps/api/src/time-entries/time-entries.service.ts` — 5 nouvelles méthodes d'agrégation
- `apps/api/src/time-entries/time-entries.controller.ts` — 5 nouveaux endpoints (ordre de routes critique)
- `apps/web/src/app/(app)/timesheets/timesheets-weekly.tsx` — composant principal avec grille interactive
- `apps/web/src/lib/api/time-entries.ts` — extension des types et méthodes API
- `packages/db/prisma/seed.ts` — nouvelles permissions timesheets
