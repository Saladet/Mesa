# Mesa

El menú de la semana, la lista de la compra compartida y las recetas de casa.

**App:** https://saladet.github.io/Mesa/ (se puede añadir a la pantalla de inicio del móvil).

## Qué hace

- **Semana**: comida y cena de cada día, con un plato dibujado hasta que le hagáis foto. Cada plato se puede cambiar por otro que encaje con las reglas de la semana, o moverse a otro día desde la semana entera.
- **Plato especial**: una receta más elaborada a la semana (por defecto, el domingo a mediodía). Dos días antes avisa de lo que hay que preparar (remojos, adobos, qué pedir en la carnicería).
- **Lista**: se monta sola con los ingredientes de la semana, agrupada por secciones del súper. Lo que marca uno lo ve el otro al momento. Avisa de lo que hay que congelar al llegar.
- **Recetas**: el recetario, con modo cocina paso a paso y temporizadores. Pegando el enlace de una receta de una web, se lee sola y se añade (foto, ingredientes, pasos y temporizadores).
- **Valoraciones**: cada uno puntúa los platos (1-5 estrellas) y deja un comentario. Lo de la última vez sale en el plato y al empezar a cocinar; lo que gustó aparece más en las semanas y lo de «No lo repetimos» deja de salir solo.
- **Hogar**: quién come, qué no come cada uno (datos estructurados, no texto libre), día de compra y reglas (legumbre, carne, huevo, caprichos).

## Cómo está hecha

- Web app (React + Vite) publicada con GitHub Pages; funciona sin conexión con lo último cargado.
- Datos, cuentas y tiempo real en Supabase (proyecto `mesa`). Cada tabla tiene políticas de seguridad: solo ve los datos quien está en el hogar.
- Importar recetas: al pegar un enlace, una función de Supabase (`leer-receta`) lee los datos de receta que publican casi todas las webs de cocina (schema.org/Recipe) y la app la guarda con los ingredientes reconocidos del catálogo. Si una web no los publica, el enlace queda pendiente y Claude la añade a mano. Recetas nuevas o repasos de una receta leída: se los pides a Claude.

## Desarrollo

```bash
npm install
npm run dev
```

`seed/` contiene el recetario (inicial, importado y especiales) y los scripts que generan el SQL de cada carga (`seed/sql.mjs`, `seed/sql-recetas.mjs`).

`supabase/functions/leer-receta/` es la función que lee las recetas de las webs (solo responde a usuarios con sesión y solo a webs públicas). La lógica que convierte lo leído en una receta de Mesa está en `src/logic/importar.js`.
