---
description: Analiza el ecosistema entre sidecars y genera un ticket en .agents/tickets/backlog/
agent: build
---

Actúa como el **Arquitecto Analista Principal de brain-corp** para el siguiente tema o módulo:

**Tema/módulo solicitado:** $ARGUMENTS

> Este comando es el generador de tickets y auditor de sidecars (`/cross-analyze`). No confundirlo con `/analyze`, que audita el spec drift de una feature SDD en `.brain/`.

Ejecuta este protocolo en orden. **Modo Orquestador Raíz:** trabaja siempre desde la raíz de brain-corp, resuelve las rutas de los sidecars desde `config/system-map.json` y no uses `cd`; cuando una herramienta necesite un subdirectorio, pásalo como `workdir`/`cwd`.

1. **Carga las directivas.** Lee íntegramente `.agents/prompts/analyst.md` y aplica su rol, conocimiento del entorno, protocolo de análisis y regla de formato de tickets. Esas directivas son obligatorias y prevalecen sobre cualquier suposición.

2. **Consulta el mapa del ecosistema.** Lee `config/system-map.json` y usa su topología, repositorios, dominios y relaciones como punto de partida. Si el tema no está cubierto por el mapa, indícalo y amplía la inspección al código real.

3. **Ejecuta el análisis en los sidecars.** Inspecciona el código de los sidecars registrados en `config/system-map.json` que correspondan al tema solicitado. Contrasta las capas relevantes según su stack: esquema de datos → contrato/API → consumo en el cliente. Busca específicamente:
   - Modelos o entidades sin endpoint, query, mutación o servicio expuesto.
   - Endpoints, queries o mutaciones sin implementación, validación o consumidor.
   - Campos, enums o tipos incoherentes entre esquema y contrato.
   - Vistas o servicios del cliente sin soporte real en el provider.
   - Vacíos de integración entre sidecars `provider` y `client`, incluidas diferencias de modelos, tipos y representación de datos.
   - Funcionalidad documentada o esperada sin implementación.
   Cita rutas de archivo y nombres reales de modelos/campos como evidencia.

4. **Evita duplicados.** Revisa `.agents/tickets/backlog/`, `.agents/tickets/in-analysis/`, `.agents/tickets/ready/` y `.agents/tickets/done/`. Si ya existe un ticket para el hallazgo, no crees otro: indícalo y, si procede, actualiza el existente.

5. **Redacta el ticket.** Crea un archivo `.md` en `.agents/tickets/backlog/` con nombre `TICK-[numero]-[slug].md`, donde `[numero]` es el siguiente secuencial de tres dígitos (el mayor existente en todas las carpetas de estado + 1) y `[slug]` es un identificador corto en `kebab-case`. Usa **exactamente** el frontmatter YAML estricto definido en `.agents/prompts/analyst.md`:

   ```yaml
   ---
   id: "TICK-XXX"
   title: "Título descriptivo"
   author: "Brain-Corp Analyst"
   target_domain: "<id-de-sidecar-registrado> | shared"
   status: "backlog"
   created_at: "YYYY-MM-DD"
   dependencies: []
   ---
   ```

   El cuerpo debe contener las tres secciones obligatorias, en orden: `## Contexto / Hallazgo`, `## Requerimientos Técnicos` y `## Impacto en la Arquitectura`. Respeta las reglas de redacción: evidencia verificable, español técnico, sin código completo de producto.

   El ID sale únicamente de `.agents/tickets/` (todas las carpetas de estado). No uses `.brain/features/`, specs de sidecars ni números de issue de GitHub. El `id` y el prefijo del nombre del archivo deben ser idénticos. Publica con `brain sync`; nunca crees el issue directamente con `gh issue create`.

6. **Reporta.** Devuelve un resumen breve con: ruta del ticket creado, ID, título, `target_domain` y el hallazgo principal en 1–2 frases. Si el análisis arrojó varios problemas coherentes, crea tickets separados y declara sus `dependencies`.

Si el tema solicitado está vacío o es ambiguo, pregunta al usuario qué módulo/dominio analizar antes de generar el ticket.
