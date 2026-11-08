# brain-corp

Este workspace está orquestado por brain-corp.

## Recursos

- Rol del analista: `.agents/prompts/analyst.md`
- Skills base: `.agents/skills/`
- Tickets: `.agents/tickets/<estado>/TICK-XXX-<slug>.md`
- SDD nativo: `.brain/active.json` y `.brain/features/<ticket>/`
- Constitución central: `.brain/memory/constitution.md`
- Topología de sidecars: `config/system-map.json`

## Comandos principales

- `/cross-analyze <tema>`: analiza el ecosistema y crea un ticket.
- `/init-work <TICK-XXX>`: crea la feature en `.brain/features/<ticket>/`.
- `/specify`, `/plan`, `/tasks`, `/implement`: flujo SDD nativo.
- `/analyze`: audita coherencia y detecta spec drift.
- `/sanity`: valida coherencia de tickets.
- `/sync`: publica el backlog como issues de GitHub.

## Reglas

1. Trabaja siempre desde la raíz del workspace; resuelve rutas de sidecars desde `config/system-map.json`.
2. No modifiques código de producto desde la raíz.
3. Todo cambio debe estar asociado a un ticket `TICK-XXX`.
4. Usa `gh` como única interfaz con GitHub; no persistas tokens.
