# Guía del flujo de trabajo agéntico

> Idioma: **Español** — [English](./workflow.en.md)

Esta guía explica cómo *usar* el andamiaje (scaffold) en el día a día, una vez
instalado en un proyecto. Para instrucciones de instalación y la estructura de
archivos, consulta el `README.md` de la raíz. Para el contrato de comportamiento
exacto de cualquier pieza individual, la fuente canónica siempre es el archivo al
que este documento enlaza — esta guía explica cómo encajan las piezas entre sí, no
es la última palabra sobre ninguna de ellas.

## Filosofía

Un único conjunto de reglas, consumido de forma idéntica por dos agentes.
`AGENTS.md` es el punto de entrada canónico (OpenCode lo lee directamente);
`CLAUDE.md` incluye los mismos archivos de reglas mediante `@path` para que Claude
Code nunca diverja de lo que ve OpenCode. Todo lo que está bajo `.agents/` — reglas,
comandos, planes, scripts — es agnóstico del agente; nada en este andamiaje es
exclusivo de Claude ni de OpenCode.

El conjunto de herramientas es de dependencia cero por diseño: POSIX `sh` +
Markdown. No hay nada que instalar con `npm` antes de que el flujo de trabajo
funcione.

## Ciclo principal: interrogar → planificar → implementar → verificar → entregar

La forma del día a día del andamiaje, se usen o no issues de GitHub:

1. **Interrogar (grill).** Cuando el diseño aún no está definido, ejecuta
   `/grill "<tema>"` antes de planificar nada. Modela el trabajo como un árbol de
   decisiones y pregunta toda la **frontera** — cada decisión cuyos prerrequisitos ya
   están resueltos — como una única ronda numerada, con una respuesta recomendada por
   pregunta, y luego se detiene y te espera. Encontrar *hechos* es tarea del agente
   (despacha subagentes en lugar de preguntarte algo que podría consultar); las
   *decisiones* son tuyas. Mientras pregunta, afina `.agents/ubiquitous-language.md` en
   el momento y ofrece un ADR para cualquier decisión que sea difícil de revertir *y*
   sorprendente *y* fruto de una disyuntiva real. Cuando la frontera queda vacía escribe
   una especificación definida en
   `.agents/specs/[aaaa-mm-dd]-[descripción-corta-en-kebab-case].md` y te indica qué
   ejecutar después: `/planning` para trabajo local, `/create-issue` para un solo issue,
   o `/spec-breakdown <ruta-de-la-spec>` para algo lo bastante grande como para
   dividirse. El protocolo completo está en `.agents/rules/design-interrogation.md`.
   Omite este paso cuando el diseño ya sea evidente.
2. **Planificar.** Para cualquier tarea no trivial, produce un archivo de plan antes
   de escribir código. Pide al agente que planifique (entrar en modo plan lo activa
   automáticamente) o ejecuta `/planning "<descripción>"`. El plan se guarda en
   `.agents/plans/[aaaa-mm-dd]-[descripción-corta-en-kebab-case].md` siguiendo la
   estructura de `.agents/rules/plan-creation.md` — Objetivo (Goal), Contexto
   (Context), Archivos Afectados (Affected Files), una Implementación Paso a Paso
   numerada con suficiente detalle para que un modelo menos capaz la ejecute sin
   adivinar, Decisiones de Arquitectura, Criterios de Validación, Preguntas
   Abiertas. El estado inicial es `draft`.
3. **Revisar.** El plan se presenta antes de empezar cualquier implementación.
   Apruébalo, o devuélvelo con cambios — el estado pasa a `approved` cuando lo
   hagas.
4. **Implementar.** El agente ejecuta la Implementación Paso a Paso del plan en
   orden, marcando el estado como `in-progress`, y luego `completed` una vez que
   todos los Criterios de Validación se cumplen. Cualquier código de dominio tocado
   en el camino debe primero verificarse contra
   `.agents/ubiquitous-language.md` (ver más abajo).
5. **Verificar.** Ejecuta lo que definan las `## Commands` de tu proyecto en
   `AGENTS.md` para lint/build/test. Si estás modificando el andamiaje mismo en
   lugar de un proyecto que lo adoptó, `sh .agents/scripts/verify-scaffold.sh` es la
   puerta de aceptación — ver más abajo.
6. **Entregar.** Haz commit, y si el trabajo se rastrea como un issue de GitHub,
   ejecuta `/ship-note` para publicar lo que realmente ocurrió como comentario (ver
   el flujo de issues de GitHub más abajo). `/ship-note` nunca cierra el issue —
   es un punto de control humano deliberado.

## Mantener honesto el vocabulario de dominio

`.agents/ubiquitous-language.md` es la fuente única de verdad para los nombres
canónicos de entidades, tipos, estados e invariantes. `.agents/rules/domain-glossary.md`
es la regla de cumplimiento: antes de tocar cualquier archivo que viva en una ruta
de dominio canónica, o que nombre/exporte/importe/cambie un concepto del glosario,
lee primero el glosario. Si introduces o cambias vocabulario canónico, añádelo al
glosario, actualiza `Last updated` a la fecha ISO actual, y agrega una fila al
Changelog — nunca renombres silenciosamente un concepto en el código sin actualizar
su definición.

Esa regla tiene dos modos. El **pasivo**, descrito arriba, aplica siempre que tocas
código de dominio. El **activo** se ejecuta durante una sesión de `/grill`: los
términos que entran en conflicto con el glosario se cuestionan en el momento, las
palabras difusas se afinan hasta un término canónico, las relaciones se someten a
casos límite inventados, y las afirmaciones sobre cómo funciona algo se contrastan
contra el código real. Los términos resueltos se escriben de inmediato en lugar de
acumularse para el final. Las decisiones que sobreviven a la tarea que las originó van
a un ADR en `.agents/adr/` — ver `.agents/rules/adr.md` para la prueba de tres partes
que evita que ese directorio se llene de decisiones rutinarias.

## Pruebas (testing)

`.agents/rules/testing.md` define qué probar (lógica pura primero, luego módulos
con estado, luego unidades interactivas/UI, luego código de frontera) y cómo
(verificar comportamiento observable, hacer mock solo en fronteras reales de E/S,
fixtures determinísticos, un comportamiento verificable por prueba)
independientemente del stack. Cuando tu proyecto adopte un runner, completa los
marcadores específicos del runner en ese archivo y en `AGENTS.md` ›
`## Testing` / `## Commands` › `Test:` — mantén ambos en concordancia en lugar de
dejar que diverjan silenciosamente.

## Comandos de barra (slash commands)

Cada comando se define una sola vez como una especificación agnóstica del agente en
`.agents/commands/<nombre>.md`, con un wrapper delgado por agente en
`.claude/commands/` y `.opencode/commands/` que solo difiere en el frontmatter
(`.agents/rules/command-creation.md`). Se invoca de forma idéntica como
`/<nombre>` en cualquiera de los dos agentes.

| Comando | Úsalo para |
|---|---|
| `/grill` | Definir un diseño mediante interrogación antes de escribir ningún artefacto. |
| `/planning` | Producir un plan de implementación revisable antes de escribir código. |
| `/commit-message` | Generar un mensaje de Conventional Commits a partir del diff actual. |
| `/install-scaffold` | Instalar este andamiaje en un proyecto destino (ver más abajo). |
| `/create-issue` | Convertir una descripción de requerimiento en un issue de GitHub con un plan completo en el cuerpo. |
| `/update-issue` | Corregir el cuerpo/título de un issue cuando la primera generación fue inexacta. |
| `/execute-issue` | Ejecutar el issue vinculado a la rama actual, en dos fases: confirmar, luego implementar. |
| `/comment-issue` | Añadir un comentario al hilo del issue de la rama actual sin tocar su estado. |
| `/ship-note` | Publicar un comentario que describe lo que realmente se entregó, una vez terminado el trabajo. |
| `/spec-breakdown` | Descomponer una especificación grande en un issue epic + issues hijos con un grafo de dependencias. |
| `/execute-epic` | Ejecutar los hijos de un epic ola por ola en worktrees paralelos — push, revisión agéntica, retrabajo automático ante una violación dura, integración — sin que nadie esté mirando, y luego abrir un solo PR. |
| `/supervise-epic` | El mismo pipeline por etapas que `/execute-epic`, con tu decisión explícita de aprobar/rechazar cada hijo en la puerta de revisión antes de que se integre. Solo invocable por el usuario. |
| `/spec` | Todo en uno: `/spec-breakdown` seguido, por defecto, de `/execute-epic`, encadenados. Agrega `--supervised` para que la ejecución pase por `/supervise-epic` en su lugar. |
| `/handoff` | Pasar esta conversación a un agente en segundo plano que retoma el trabajo de inmediato. |

## Habilidades (skills)

Un comando es algo que *tú* inicias. Una **skill** es algo que inicia el *agente*: un
procedimiento que carga por su cuenta en cuanto la situación coincide con la
`description` de esa skill. Nunca escribes su nombre; simplemente encuentras al agente
ya siguiéndola.

Cada skill mantiene un único cuerpo canónico en `.agents/skills/<nombre>/SKILL.md`, que
OpenCode lee de forma nativa, más un symlink relativo en `.claude/skills/<nombre>`, que
es el único lugar donde mira Claude Code. Un solo archivo real, dos agentes, sin
posibilidad de divergencia (`.agents/rules/skill-creation.md`; el razonamiento y las
alternativas descartadas están en
`.agents/adr/0001-skills-canonical-in-agents-skills.md`).

| Skill | Se dispara cuando |
|---|---|
| `resolving-merge-conflicts` | Hay un merge o rebase de git en conflicto. Reconstruye la intención detrás de cada lado, resuelve cada hunk sin inventar comportamiento, corre las verificaciones del proyecto y termina el merge. |
| `standards-and-spec-review` | Una rama necesita revisión en dos ejes a la vez: **Standards** (¿sigue `AGENTS.md`, `.agents/rules/`, el glosario y los ADR?) y **Spec** (¿implementa el issue, plan o especificación del que salió?). Cada eje corre en su propio sub-agente y los dos informes se presentan lado a lado, sin reordenarse uno contra el otro. No es una cacería de bugs de corrección — para eso está `/code-review`. |

Una salvedad que conviene conocer antes de agregar las tuyas: un directorio de skills
que no existía cuando arrancó el agente no queda bajo observación. Reinicia el agente
después de agregar la primera.

## El flujo de trabajo de issues de GitHub

Los comandos que dependen de issues (`/execute-issue`, `/update-issue`,
`/comment-issue`, `/ship-note`) resuelven "¿en qué issue estoy trabajando?" a partir
de la rama actual, usando la precedencia definida en
`.agents/rules/issue-resolution.md`: primero un segmento numérico inicial en el
nombre de la rama, luego el `Closes #N` de un PR vinculado, luego una coincidencia
aproximada por título, y solo entonces preguntándote directamente. Se conectan a
GitHub a través del servidor GitHub MCP registrado en `.mcp.json` /
`opencode.json`, que requiere un `GITHUB_TOKEN` en `.env` (ver la sección "GitHub
MCP server" del README de la raíz).

Un flujo típico de un solo issue:

```
/create-issue "add CSV export to the reports page"   # crea el issue + el plan
git checkout -b 42-csv-export                          # el nombre de rama lleva el número de issue
/execute-issue                                          # Fase 1 confirmar, Fase 2 implementar
/ship-note                                               # registra lo ocurrido, el issue queda abierto
```

## Orquestación paralela: epics e hijos

Para especificaciones demasiado grandes para una sola rama,
`.agents/rules/parallel-orchestration.md` define un modelo **epic/hijo**: un issue
epic contiene una lista de tareas hijas y un bloque de grafo de dependencias
` ```waves `; cada hijo es un issue normal con plan completo, prefijado con
`> Epic: #<n>` y `> Depends on: #…`. Los hijos ramifican desde una **rama de
integración del epic** real y duradera (`epic/<n>-<slug>`) — nunca directamente
desde `main` — y `.agents/scripts/run-parallel-issues.sh` ejecuta un worktree de
git + un agente headless por cada hijo. `main` solo recibe el trabajo una vez,
mediante un único PR `epic → main` abierto después de que todos los hijos estén
integrados.

Un hijo ya no se fusiona en el instante en que se hace push. Primero pasa por una
**puerta de revisión (review gate)**: el runner despacha una revisión agéntica
`standards-and-spec-review` contra la rama del epic como punto fijo, y solo un hijo
que la supera se integra. Dos comandos ejecutan el mismo pipeline —
push → revisión agéntica → retrabajo opcional → integración — y solo difieren en
quién resuelve lo que encuentra la revisión:

- **`/execute-epic`** (auto) — corre de principio a fin sin que nadie esté
  mirando. Una **violación dura** (un incumplimiento del glosario o de un ADR)
  bloquea la integración y dispara un retrabajo automático en lugar de una
  pregunta; un **juicio de valor** nunca bloquea — solo queda registrado en el
  ship-note del hijo.
- **`/supervise-epic`** — el mismo pipeline, más tu decisión explícita de
  aprobar/rechazar cada hijo, informada por el diff, el log del agente y el mismo
  informe agéntico. Una violación dura preselecciona "rechazar", pero puedes
  aprobar igual. Solo invocable por el usuario — igual que `/grill`, necesita a
  alguien presente para responder, así que nunca debe ejecutarse dentro de un hijo
  headless del runner paralelo.

Un hijo rechazado se vuelve a despachar automáticamente — hasta
`MAX_REWORK_ROUNDS` (por defecto 2) — con los hallazgos de la revisión como
retroalimentación, y luego se vuelve a revisar antes de tener otra oportunidad en
la puerta, ya que un retrabajo puede romper algo que la ronda anterior había
aprobado. Las olas siguen avanzando sin ningún punto de control de fusión manual
entre ellas.

```
/spec ruta/a/especificacion-grande.md               # spec-breakdown, revisión, luego execute-epic — encadenados
/spec ruta/a/especificacion-grande.md --supervised  # lo mismo, pero la ejecución pasa por supervise-epic
```

o ejecuta las fases tú mismo con `/spec-breakdown` seguido de `/execute-epic` o
`/supervise-epic` cuando quieras revisar la descomposición antes de que empiece
cualquier ejecución.

Configuración única antes del primer `/execute-epic` o `/supervise-epic`: copia
`.agents/parallel.config.example` → `.agents/parallel.config` y establece
`AGENT_EXEC_CMD` (por defecto `claude -p --dangerously-skip-permissions`; los
adaptadores de Codex y OpenCode están documentados en el mismo archivo).
Opcionalmente, establece `REVIEW_AGENT_EXEC_CMD` para darle al revisor agéntico un
modelo distinto al del implementador — vacío hereda `AGENT_EXEC_CMD`, nunca
significa "saltar la revisión". Completa `## Commands` › `Build:` / `Test:` en
`AGENTS.md` para que los agentes hijos tengan verificaciones de aceptación reales
que ejecutar.

Los límites de seguridad están en el mismo archivo de reglas: `MAX_CHILDREN=12`,
`PARALLEL_MAX_CONCURRENCY=3`, `AGENT_TIMEOUT=1800s`, `MAX_REWORK_ROUNDS=2` (`0`
desactiva el retrabajo, así que un rechazo simplemente bloquea al hijo). El runner
nunca obtiene `GITHUB_TOKEN` — los agentes hijos headless no tienen acceso a
GitHub por diseño; todas las llamadas a la API de GitHub las realiza la sesión
propia del agente orquestador a través de MCP.

## Instalar este andamiaje en otro lugar

`/install-scaffold [directorio-destino]` ejecuta el copiador basado en manifiesto
(`.agents/scripts/install-scaffold.sh`), que lee `.agents/scaffold.manifest` — una
lista plana de archivos y directorios recursivos — y copia cada entrada al destino,
omitiendo (nunca sobrescribiendo) lo que ya exista ahí. Siempre es seguro volver a
ejecutarlo. Para agregar algo nuevo a lo que recibe cada proyecto que lo adopte,
añade una línea al manifiesto en lugar de incrustar una plantilla en otro lugar; el
manifiesto y el script copiador son la única fuente de verdad sobre qué se
instala.

## Verificar el andamiaje mismo

`sh .agents/scripts/verify-scaffold.sh` es la puerta de aceptación de dependencia
cero. Verifica, en nueve grupos: que existan los archivos raíz/de gobernanza
requeridos; que cada especificación de comando tenga tanto un wrapper de Claude como
uno de OpenCode *y* un encabezado `# Command: <nombre>` que coincida con su nombre de
archivo; que los dos wrappers sean idénticos byte a byte por debajo de su frontmatter;
que cada wrapper declare un campo `description:`; que cada script bajo
`.agents/scripts/` compile limpiamente con `sh -n` y sea ejecutable; que cada entrada
de `.agents/scaffold.manifest` resuelva a una ruta real; que no haya artefactos
específicos de stack (`src/`, `src-tauri/`, `package.json`) rastreados; que cada skill
tenga un `SKILL.md` cuyo `name` coincida con su directorio, declare una `description` y
esté enlazado por symlink en `.claude/skills/`; y —a la inversa de la verificación del
manifiesto— que cada ADR y cada archivo `*.example` figure realmente en el manifiesto,
para que nada quede referenciado pero sin instalarse. El código de salida es el número
de verificaciones fallidas — `0` significa limpio.

Córrela también en un proyecto que adoptó el andamiaje, no solo aquí. Las cuatro
verificaciones que solo tienen sentido en el código fuente propio del andamiaje
dependen de que `.agents/scaffold.manifest` esté presente, y el manifiesto
deliberadamente no se lista a sí mismo — así que nunca llega a un proyecto adoptante,
donde esas verificaciones se reportan como omitidas y el resto igual se ejecuta.

## Después de adoptar el andamiaje en un proyecto real

Completa los marcadores que este andamiaje trae con `_not yet documented_`:
`AGENTS.md` › `## Workspace`, `## Commands`, `## Testing`, `## Verification Quirks`,
`## Code Structure`; la fecha `Last updated` y la ruta canónica de código de
dominio de `.agents/ubiquitous-language.md`; y las rutas canónicas de dominio en
`.agents/rules/domain-glossary.md`. Deja `AGENTS.md` › `## Skills` como está — ya
viene poblada, y describe skills que heredas en lugar de un espacio en blanco por
completar.

Hay dos cosas que se heredan en vez de empezar de cero. Los ADR `0001`–`0007` vienen
con el andamiaje y registran decisiones que tu proyecto hereda, así que tu primer ADR
propio arranca en `0008`. Y tienes que reiniciar el agente una vez después de la
instalación, o no descubrirá `.claude/skills/` — un directorio de skills que no existía
al arrancar no queda bajo observación.

Nada del flujo de trabajo anterior cambia una vez que lo hagas — es el mismo ciclo
planificar → implementar → verificar → entregar, ahora apuntando a los comandos reales
de lint/build/test de tu stack en lugar de marcadores.
