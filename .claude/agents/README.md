# Klusraak Operating System

Een team van Claude Code subagents dat samen het Klusraak platform bouwt en onderhoudt. Aangestuurd vanuit één primaire orchestrator (`klusraak-ceo`) die taken delegeert naar de juiste specialist.

## Hoe gebruik je het?

In Claude Code (CLI of IDE-extensie) kun je elke agent op twee manieren aanspreken:

1. **Impliciet** — vraag iets aan Claude. De `klusraak-ceo` orchestrator picks it up via zijn `description` (markeerd als "use proactively") en delegeert.

2. **Expliciet** — gebruik de Agent tool met `subagent_type: "klusraak-frontend"` (of een andere naam). Voor de meeste gebruikers werkt optie 1.

## Het team

| Agent | Rol | Wanneer gebruiken |
|---|---|---|
| `klusraak-ceo` | Orchestrator | Eerste contactpunt voor élke vraag. Triage + delegatie. |
| `klusraak-frontend` | UI specialist | Visueel werk in `frontend/public/`. Schermen, copy-positie, design tokens. |
| `klusraak-backend` | API specialist | Express, Prisma, BullMQ in `backend/src/`. |
| `klusraak-deploy` | DevOps | gh-pages, Netlify, Fly.io, GitHub Actions, releases. |
| `klusraak-designer` | Brand & UX | Mockups, kleur, copy. Reviewer voor visuele PR's. |
| `klusraak-qa` | Smoke tester | Verificatie na elke deploy. |

## Voorbeelden

**Nieuwe feature, end-to-end:**
> "Ik wil een chat-functie tussen klant en vakman op een klus."

→ CEO splitst: designer maakt spec → backend bouwt endpoints (de modules `messages` bestaan al) → frontend bouwt UI → deploy publiceert → QA test.

**Snelle visuele tweak:**
> "De Inloggen-link mag iets minder fel oranje."

→ CEO gaat direct naar designer (kleurkeuze) → frontend (implementatie) → deploy.

**Bug op de live demo:**
> "De demo URL doet niets."

→ CEO start met deploy (diagnose: deploy state? cache?). Als deploy correct is, escalate naar frontend (HTML/JS bug?). QA verifieert na fix.

**Backend wijziging:**
> "Voeg een endpoint toe om je eigen reviews te bekijken."

→ CEO gaat direct naar backend. Wanneer klaar, deploy update Fly.io. Frontend pakt het later op als de UI-side erbij komt.

## Toevoegen / aanpassen van agents

Elke agent is een markdown-bestand in deze directory. Frontmatter velden:

```yaml
---
name: <kebab-case-name>            # Used as subagent_type identifier
description: <when to use>          # The orchestrator picks based on this
tools: Read, Edit, Bash, ...        # Comma-separated. Omit for "all available"
---
```

De body is de system prompt — geef de agent zijn rol, conventies, do/don'ts, en kennis over de repo.

## V2 ideeën (niet gebouwd)

- `klusraak-support` — NL klantvragen beantwoorden over hoe Klusraak werkt.
- `klusraak-content` — blog/SEO copy.
- `klusraak-analyst` — query Postgres, rapporteer over usage en conversie.
- `klusraak-product` — feature-prioritisering, roadmap, user research samenvatten.

Open een PR met een nieuw `<naam>.md` bestand om eraan toe te voegen.

## Testen

Vraag de CEO direct een taak om de chain end-to-end te valideren:

> "Voer een korte audit uit: is de live demo correct gedeployed en bevat de pagina alle V0.5 elementen?"

CEO → QA → terug. Geen frontend/backend werk nodig, maar test wel de delegatie + tool access.
