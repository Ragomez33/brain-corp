---
name: brain-corp-pr
description: Crea, previsualiza o registra un pull request para un ticket de brain-corp usando la plantilla incluida, sin hacer commit ni push.
---

# Pull requests

Usa esta skill cuando el usuario pida abrir, preparar, previsualizar o registrar un pull request para un `TICK-XXX`.

## Requisitos

- `brain` disponible (si no, usa `npx @rgkoko/brain-corp`).
- GitHub CLI autenticado (`gh auth status`).
- El ticket existe en `.agents/tickets/`.
- La rama ya está publicada en el remoto y la rama base existe.

`brain pr` no hace commit, push, no crea ramas ni hace merge.

## Flujo

1. Lee `.brain/memory/constitution.md`, el ticket y `config/system-map.json`.
2. Resuelve el repositorio destino. Usa `--repo <id>` cuando `target_domain` sea `shared`.
3. Previsualiza opcionalmente el cuerpo y el comando:

   ```bash
   brain pr TICK-XXX --dry-run
   ```

4. Crea el pull request:

   ```bash
   brain pr TICK-XXX --base main
   ```

   Opciones útiles: `--draft`, `--title`, `--summary`, `--spec-impact`, `--lang en|es`, `--json`.

   La plantilla sale de `templates/pr/<lang>/` según el idioma del workspace, salvo que `--lang` lo sobrescriba.

5. Registra la entrega después de obtener la URL del PR:

   ```bash
   brain complete TICK-XXX <PR_URL>
   ```

   No ejecutes `complete` antes de que exista el PR.

## Guardrails

- Nunca ejecutes `git commit`, `git push`, `git merge` ni crees ramas desde esta skill.
- Nunca abras un PR contra una rama sin publicar.
- No inventes una URL de PR ni un número de issue.
- Mantén las explicaciones al usuario en el idioma del workspace; deja la salida y los flags de la CLI tal cual.
