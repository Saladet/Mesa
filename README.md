# Mesa

El menú de la semana, la lista de la compra compartida y las recetas de casa.

**App:** https://saladet.github.io/Mesa/ (se puede añadir a la pantalla de inicio del móvil).

## Qué hace

- **Semana**: comida y cena de cada día, con un plato dibujado hasta que le hagáis foto. Cada plato se puede cambiar por otro que encaje con las reglas de la semana.
- **Lista**: se monta sola con los ingredientes de la semana, agrupada por secciones del súper. Lo que marca uno lo ve el otro al momento. Avisa de lo que hay que congelar al llegar.
- **Recetas**: el recetario, con modo cocina paso a paso y temporizadores.
- **Valoraciones**: cada uno puntúa los platos (1-5 estrellas) y deja un comentario. Lo de la última vez sale en el plato y al empezar a cocinar; lo que gustó aparece más en las semanas y lo de «No lo repetimos» deja de salir solo.
- **Hogar**: quién come, qué no come cada uno (datos estructurados, no texto libre), día de compra y reglas (legumbre, carne, huevo, caprichos).

## Cómo está hecha

- Web app (React + Vite) publicada con GitHub Pages; funciona sin conexión con lo último cargado.
- Datos, cuentas y tiempo real en Supabase (proyecto `mesa`). Cada tabla tiene políticas de seguridad: solo ve los datos quien está en el hogar.
- Recetas nuevas e importaciones: se las pides a Claude y las añade al recetario.

## Desarrollo

```bash
npm install
npm run dev
```

`seed/` contiene el recetario inicial y el script que generó la carga inicial.
