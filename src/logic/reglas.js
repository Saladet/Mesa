// Restricciones (qué no come cada uno) y reglas de la semana.

export function normalizar(t) {
  return (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Grupos de alimentos que se pueden marcar como "no come". Las palabras sirven para
// detectar ingredientes escritos a mano (recetas importadas) que no están en el catálogo.
export const GRUPOS = {
  pescado: {
    nombre: 'Pescado',
    nota: '«Pescado» incluye el marisco y también los caldos y salsas que lo llevan.',
    palabras: ['pescado', 'merluza', 'bacalao', 'atun', 'salmon', 'sardina', 'anchoa', 'boqueron', 'bonito', 'caballa', 'dorada', 'lubina', 'rape', 'emperador', 'trucha', 'lenguado', 'rodaballo', 'surimi', 'gamba', 'langostino', 'calamar', 'sepia', 'pulpo', 'mejillon', 'almeja', 'berberecho', 'navaja', 'marisco', 'cangrejo', 'bogavante', 'vieira', 'chipiron', 'cigala', 'fumet', 'pez '],
  },
  marisco: {
    nombre: 'Marisco',
    palabras: ['marisco', 'gamba', 'langostino', 'calamar', 'sepia', 'pulpo', 'mejillon', 'almeja', 'berberecho', 'navaja', 'cangrejo', 'bogavante', 'vieira', 'chipiron', 'cigala'],
  },
  carne: {
    nombre: 'Carne',
    nota: 'Incluye el pollo y el pavo, y los caldos de carne.',
    palabras: ['pollo', 'pavo', 'ternera', 'cerdo', 'cordero', 'conejo', 'jamon', 'chorizo', 'bacon', 'panceta', 'lomo', 'salchicha', 'morcilla', 'carne', 'buey', 'pato', 'solomillo', 'costilla', 'hamburguesa', 'albondiga'],
  },
  carne_roja: {
    nombre: 'Carne roja',
    palabras: ['ternera', 'cerdo', 'cordero', 'buey', 'vaca', 'jamon', 'chorizo', 'bacon', 'panceta', 'lomo', 'salchicha', 'morcilla', 'solomillo', 'costilla', 'chuleta'],
  },
  cerdo: {
    nombre: 'Cerdo',
    palabras: ['cerdo', 'jamon', 'chorizo', 'bacon', 'panceta', 'lomo', 'salchicha', 'morcilla', 'costilla', 'sobrasada', 'fuet', 'salchichon'],
  },
  lacteo: {
    nombre: 'Lácteos',
    palabras: ['leche', 'queso', 'yogur', 'nata', 'mantequilla', 'mozzarella', 'parmesano', 'feta', 'requeson', 'kefir', 'bechamel'],
  },
  gluten: {
    nombre: 'Gluten',
    palabras: ['harina', 'pan ', 'pasta', 'trigo', 'cebada', 'centeno', 'cuscus', 'espelta', 'galleta', 'rebozado', 'empanado', 'seitan', 'bulgur', 'macarron', 'espagueti', 'fideo', 'lasana'],
  },
  huevo: { nombre: 'Huevo', palabras: ['huevo', 'clara', 'yema', 'mayonesa'] },
  frutos_secos: {
    nombre: 'Frutos secos',
    palabras: ['nuez', 'nueces', 'almendra', 'avellana', 'pistacho', 'anacardo', 'pinon', 'cacahuete', 'macadamia', 'pecana'],
  },
  setas: { nombre: 'Setas y champiñones', palabras: ['seta', 'champinon', 'boletus', 'shiitake', 'hongo', 'portobello', 'niscalo'] },
  picante: { nombre: 'Picante', palabras: ['guindilla', 'cayena', 'chile', 'jalapeno', 'picante', 'tabasco', 'sriracha', 'harissa', 'chipotle'] },
  soja: { nombre: 'Soja', palabras: ['soja', 'tofu', 'tempeh', 'edamame', 'miso'] },
  legumbre: { nombre: 'Legumbres', palabras: ['lenteja', 'garbanzo', 'alubia', 'judion', 'frijol', 'hummus'] },
};

export const NIVELES = {
  no_come: 'No come',
  mejor_poco: 'Mejor poco',
  alergia: 'Alergia',
};

export const PROTEINAS = {
  legumbre: 'Legumbre',
  carne: 'Carne',
  huevo: 'Huevo',
  pescado: 'Pescado',
  lacteo: 'Lácteo',
  otro: 'Vegetal',
};

export function esBloqueante(restriccion) {
  return restriccion.nivel === 'no_come' || restriccion.nivel === 'alergia';
}

function contienePalabra(texto, palabra) {
  return (` ${texto} `).includes(` ${palabra}`);
}

export function nombreRestriccion(r, ingMap) {
  if (r.tipo === 'grupo') return GRUPOS[r.valor]?.nombre || r.valor;
  return ingMap.get(r.valor)?.nombre || r.valor;
}

function coincide(receta, r, ingMap) {
  const ris = receta.receta_ingredientes || [];
  if (r.tipo === 'ingrediente') {
    const ing = ingMap.get(r.valor);
    const buscado = normalizar(ing ? ing.nombre : r.valor.replace(/-/g, ' '));
    if (!buscado) return false;
    return ris.some((ri) => {
      if (ri.ingrediente_id === r.valor) return true;
      const propio = ri.ingrediente_id ? ingMap.get(ri.ingrediente_id) : null;
      const texto = normalizar(propio ? propio.nombre : ri.texto_original);
      return contienePalabra(texto, buscado);
    });
  }
  if (receta.proteina && receta.proteina === r.valor) return true;
  if ((receta.etiquetas || []).includes(r.valor)) return true;
  const grupo = GRUPOS[r.valor];
  return ris.some((ri) => {
    const ing = ri.ingrediente_id ? ingMap.get(ri.ingrediente_id) : null;
    if (ing) return (ing.grupos || []).includes(r.valor);
    if (!grupo) return false;
    const texto = normalizar(ri.texto_original);
    return grupo.palabras.some((p) => contienePalabra(texto, p));
  });
}

// Restricciones del hogar que afectan a una receta
export function conflictosReceta(receta, restricciones, ingMap) {
  if (!receta) return [];
  return restricciones.filter((r) => coincide(receta, r, ingMap));
}

export function contarSemana(recetas) {
  const c = { legumbre: 0, carne: 0, huevo: 0, pescado: 0, capricho: 0 };
  for (const r of recetas) {
    if (!r) continue;
    if (c[r.proteina] != null) c[r.proteina] += 1;
    if (r.capricho) c.capricho += 1;
  }
  return c;
}

export function reglasCompletas(reglas) {
  return {
    legumbre_min: reglas?.legumbre_min ?? 4,
    carne_max: reglas?.carne_max ?? 3,
    huevos_max: reglas?.huevos_max ?? 4,
    caprichos_max: reglas?.caprichos_max ?? 1,
    pescado_min: reglas?.pescado_min ?? 0, // solo cuenta en las casas donde se come pescado
  };
}

// Chips del resumen de la semana
export function chipsSemana(cuenta, reglas, sinPescado) {
  const r = reglasCompletas(reglas);
  const chips = [];
  chips.push({
    texto: cuenta.legumbre >= r.legumbre_min ? `Legumbre ${cuenta.legumbre}` : `Legumbre ${cuenta.legumbre}/${r.legumbre_min}`,
    estado: cuenta.legumbre >= r.legumbre_min ? 'ok' : 'falta',
  });
  if (!sinPescado && r.pescado_min > 0) {
    chips.push({
      texto: cuenta.pescado >= r.pescado_min ? `Pescado ${cuenta.pescado}` : `Pescado ${cuenta.pescado}/${r.pescado_min}`,
      estado: cuenta.pescado >= r.pescado_min ? 'ok' : 'falta',
    });
  }
  chips.push({ texto: `Carne ${cuenta.carne}/${r.carne_max}`, estado: cuenta.carne > r.carne_max ? 'pasa' : 'normal' });
  chips.push({ texto: `Huevos ${cuenta.huevo}/${r.huevos_max}`, estado: cuenta.huevo > r.huevos_max ? 'pasa' : 'normal' });
  if (sinPescado) chips.push({ texto: cuenta.pescado ? 'Lleva pescado' : 'Sin pescado', estado: cuenta.pescado ? 'pasa' : 'normal' });
  chips.push({ texto: `Capricho ${cuenta.capricho}/${r.caprichos_max}`, estado: cuenta.capricho > r.caprichos_max ? 'pasa' : 'normal' });
  return chips;
}
