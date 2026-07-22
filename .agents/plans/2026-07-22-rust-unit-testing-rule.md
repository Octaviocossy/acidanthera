# Plan: Incorporar pruebas unitarias de Rust

> Status: **completed**
> Created: 2026-07-22
> Updated: 2026-07-22

## Goal

Ampliar la regla de testing para cubrir explícitamente las pruebas unitarias del backend Rust con `cargo test`, manteniendo Vitest para React y TypeScript.

## Context

- `.agents/rules/testing.md` actualmente excluye `src-tauri/src/**`.
- El backend ya contiene 47 pruebas unitarias en módulos `#[cfg(test)]`.
- Las pruebas existentes usan `#[test]`, `use super::*`, helpers internos y directorios temporales.
- `AGENTS.md` presenta Vitest como único runner y no documenta el comando de Rust.
- No se necesitan dependencias nuevas ni cambios al código de producción.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `.agents/plans/2026-07-22-rust-unit-testing-rule.md` | Persistir este plan y su estado |
| MODIFY | `.agents/rules/testing.md` | Incorporar convenciones para pruebas unitarias de Rust |
| MODIFY | `AGENTS.md` | Documentar los runners y comandos de ambos stacks |

## Step-by-Step Implementation

1. **Generalizar la regla de testing**
   - **File:** `.agents/rules/testing.md`
   - **Action:** MODIFY
   - **Details:** Cambiar el título para abarcar frontend y Rust, y separar el alcance de Vitest y `cargo test`.
   - **Why:** Rust dejará de estar fuera del alcance de la regla.

2. **Documentar las pruebas unitarias de Rust**
   - **File:** `.agents/rules/testing.md`
   - **Action:** MODIFY
   - **Details:** Indicar la colocación en módulos `#[cfg(test)]`, el uso de `use super::*` y `#[test]`, la prueba de helpers internos con dependencias explícitas, las aserciones para errores, los fixtures temporales deterministas, los condicionantes por plataforma y los límites frente a pruebas de integración.
   - **Why:** Formaliza los patrones que ya utilizan los módulos del backend.

3. **Documentar los comandos de Rust**
   - **File:** `.agents/rules/testing.md`
   - **Action:** MODIFY
   - **Details:** Añadir `cargo test --manifest-path src-tauri/Cargo.toml` y una variante focalizada para módulos, e indicar cuándo ejecutar la suite Rust.
   - **Why:** El comando funciona desde la raíz y evita depender del directorio actual.

4. **Actualizar el resumen para agentes**
   - **File:** `AGENTS.md`
   - **Action:** MODIFY
   - **Details:** Identificar Vitest como runner frontend y Cargo como runner Rust. Dividir los comandos de prueba por stack.
   - **Why:** Los agentes deben descubrir ambos runners sin depender únicamente de la regla extendida.

5. **Validar la documentación**
   - **File:** `.agents/plans/2026-07-22-rust-unit-testing-rule.md`
   - **Action:** MODIFY
   - **Details:** Ejecutar `pnpm test` y `cargo test --manifest-path src-tauri/Cargo.toml`, y marcar el plan como completado si ambos pasan.
   - **Why:** Confirma que los comandos documentados son válidos.

## Architecture Decisions

- Se utiliza el runner integrado de Rust; no se añaden dependencias de testing.
- Las pruebas unitarias se colocan junto al código para acceder a elementos privados.
- Las pruebas de integración Rust quedan fuera de este cambio.
- Vitest sigue cubriendo exclusivamente `src/**`.
- Los comandos de Cargo usan `--manifest-path` para ejecutarse desde la raíz.

## Validation Criteria

- [x] La regla ya no excluye Rust.
- [x] Las convenciones reflejan los patrones existentes del backend.
- [x] `AGENTS.md` documenta Vitest y Cargo.
- [x] `pnpm test` pasa (145 pruebas).
- [x] `cargo test --manifest-path src-tauri/Cargo.toml` pasa (47 pruebas unitarias).
- [x] No se añaden dependencias ni se modifica código de producción.

## Open Questions

None.
