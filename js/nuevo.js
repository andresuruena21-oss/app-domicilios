// ===== Ajustes que puedes cambiar =====
const TARIFAS = [6000, 7000, 8000];   // botones de valor del domicilio
const MAX_BARRIOS = 8;                       // cuántos barrios frecuentes mostrar

// ===== Lo que el usuario va eligiendo =====
const pedido = {
  mensajeroId: null,
  mensajeroNombre: '',
  barrio: '',
  domicilio: null,
  pago: null,
  gaseosa: null
};

// ===== Utilidades =====
const $ = (id) => document.getElementById(id);

// 42000 -> "$42.000"
function plata(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO');
}

// "$42.000" -> 42000
function soloNumero(texto) {
  return Number(String(texto).replace(/\D/g, '')) || 0;
}

// ===== Arranque =====
async function iniciar() {
  const sesion = await exigirSesion();
  if (!sesion) return;

  await Promise.all([cargarFactura(), cargarMensajeros(), cargarBarrios()]);
  pintarTarifas();
  conectarBotones();
  actualizar();
  $('contenido').hidden = false;
}

// 1. Factura: busca la última y sugiere la siguiente
async function cargarFactura() {
  const { data } = await db
    .from('domicilios')
    .select('factura')
    .order('id', { ascending: false })
    .limit(1);

  const ultima = data && data.length ? soloNumero(data[0].factura) : 0;
  $('factura').value = ultima ? ultima + 1 : '';
}

// 2. Mensajeros: un botón por cada mensajero activo
async function cargarMensajeros() {
  const { data, error } = await db
    .from('mensajeros')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre');

  const caja = $('lista-mensajeros');
  caja.innerHTML = '';

  if (error || !data.length) {
    caja.innerHTML = '<div class="ayuda">No hay mensajeros. Agrégalos en Supabase (tabla mensajeros).</div>';
    return;
  }

  data.forEach((m) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'opcion';
    boton.textContent = m.nombre;
    boton.addEventListener('click', () => {
      pedido.mensajeroId = m.id;
      pedido.mensajeroNombre = m.nombre;
      marcar(caja, boton);
      actualizar();
    });
    caja.appendChild(boton);
  });
}

// 3. Barrios: los más usados primero, más el botón "+ Otro"
async function cargarBarrios() {
  const [guardados, recientes] = await Promise.all([
    db.from('barrios').select('nombre'),
    db.from('domicilios').select('barrio').order('id', { ascending: false }).limit(500)
  ]);

  const conteo = {};
  (guardados.data || []).forEach((b) => { conteo[b.nombre] = conteo[b.nombre] || 0; });
  (recientes.data || []).forEach((d) => { conteo[d.barrio] = (conteo[d.barrio] || 0) + 1; });

  const nombres = Object.keys(conteo)
    .sort((a, b) => conteo[b] - conteo[a] || a.localeCompare(b))
    .slice(0, MAX_BARRIOS);

  const caja = $('lista-barrios');
  caja.innerHTML = '';

  nombres.forEach((nombre) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'opcion';
    boton.textContent = nombre;
    boton.addEventListener('click', () => {
      pedido.barrio = nombre;
      $('barrio-nuevo').hidden = true;
      marcar(caja, boton);
      actualizar();
    });
    caja.appendChild(boton);
  });

  const otro = document.createElement('button');
  otro.type = 'button';
  otro.className = 'opcion otro';
  otro.textContent = '+ Otro';
  otro.addEventListener('click', () => {
    marcar(caja, otro);
    $('barrio-nuevo').hidden = false;
    $('barrio-nuevo').focus();
    pedido.barrio = $('barrio-nuevo').value.trim();
    actualizar();
  });
  caja.appendChild(otro);
}

// 5. Tarifas del domicilio, más el botón "Otro"
function pintarTarifas() {
  const caja = $('lista-tarifas');
  caja.innerHTML = '';

  TARIFAS.forEach((valor) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'opcion';
    boton.textContent = plata(valor);
    boton.addEventListener('click', () => {
      pedido.domicilio = valor;
      $('domicilio-otro').hidden = true;
      marcar(caja, boton);
      actualizar();
    });
    caja.appendChild(boton);
  });

  const otro = document.createElement('button');
  otro.type = 'button';
  otro.className = 'opcion otro';
  otro.style.gridColumn = '1 / -1';
  otro.textContent = 'Otro valor';
  otro.addEventListener('click', () => {
    marcar(caja, otro);
    $('domicilio-otro').hidden = false;
    $('domicilio-otro').focus();
    pedido.domicilio = soloNumero($('domicilio-otro').value) || null;
    actualizar();
  });
  caja.appendChild(otro);
}

// Deja marcado solo el botón tocado dentro de un grupo
function marcar(grupo, botonElegido) {
  grupo.querySelectorAll('button').forEach((b) => b.classList.remove('elegida'));
  botonElegido.classList.add('elegida');
}

// Botones fijos y campos de texto
function conectarBotones() {
  $('factura-menos').addEventListener('click', () => {
    $('factura').value = Math.max(1, soloNumero($('factura').value) - 1);
    actualizar();
  });
  $('factura-mas').addEventListener('click', () => {
    $('factura').value = soloNumero($('factura').value) + 1;
    actualizar();
  });
  $('factura').addEventListener('input', actualizar);

  // Valor de productos: se le ponen los puntos de miles mientras escribes
  $('productos').addEventListener('input', () => {
    const valor = soloNumero($('productos').value);
    $('productos').value = valor ? plata(valor) : '';
    actualizar();
  });

  $('domicilio-otro').addEventListener('input', () => {
    const valor = soloNumero($('domicilio-otro').value);
    $('domicilio-otro').value = valor ? plata(valor) : '';
    pedido.domicilio = valor || null;
    actualizar();
  });

  $('barrio-nuevo').addEventListener('input', () => {
    pedido.barrio = $('barrio-nuevo').value.trim();
    actualizar();
  });

  document.querySelectorAll('[data-pago]').forEach((boton) => {
    boton.addEventListener('click', () => {
      pedido.pago = boton.dataset.pago;
      marcar(boton.parentElement, boton);
      actualizar();
    });
  });

  document.querySelectorAll('[data-gaseosa]').forEach((boton) => {
    boton.addEventListener('click', () => {
      pedido.gaseosa = boton.dataset.gaseosa === 'si';
      marcar(boton.parentElement, boton);
      actualizar();
    });
  });

  $('guardar').addEventListener('click', guardar);
}

// Pone en verde los pasos listos y recalcula el resumen
function actualizar() {
  const productos = soloNumero($('productos').value);

  const listos = {
    'paso-factura': soloNumero($('factura').value) > 0,
    'paso-mensajero': pedido.mensajeroId !== null,
    'paso-barrio': pedido.barrio !== '',
    'paso-productos': productos > 0,
    'paso-domicilio': pedido.domicilio !== null,
    'paso-pago': pedido.pago !== null,
    'paso-gaseosa': pedido.gaseosa !== null
  };

  Object.entries(listos).forEach(([id, listo]) => {
    $(id).classList.toggle('listo', listo);
  });

  const quien = pedido.mensajeroNombre || 'El mensajero';
  const domicilio = pedido.domicilio || 0;

  if (pedido.pago === 'nequi') {
    $('resumen').innerHTML =
      `<div class="linea"><span>${quien} le cobra al cliente</span><b>$0</b></div>` +
      `<div class="linea total"><span>Le debes por el domicilio</span><b>${plata(domicilio)}</b></div>`;
  } else {
    $('resumen').innerHTML =
      `<div class="linea"><span>${quien} le cobra al cliente</span><b>${plata(productos + domicilio)}</b></div>` +
      `<div class="linea"><span>Se queda por el domicilio</span><b>${plata(domicilio)}</b></div>` +
      `<div class="linea total"><span>Te entrega</span><b>${plata(productos)}</b></div>`;
  }

  return Object.values(listos).every(Boolean);
}

// Guarda el domicilio en Supabase
async function guardar() {
  $('error').hidden = true;
  $('exito').hidden = true;

  if (!actualizar()) {
    $('error').textContent = 'Falta llenar algún paso. Los pasos listos tienen el número en verde.';
    $('error').hidden = false;
    return;
  }

  $('guardar').disabled = true;
  $('guardar').textContent = 'Guardando...';

  const nuevo = {
    factura: String(soloNumero($('factura').value)),
    mensajero_id: pedido.mensajeroId,
    barrio: pedido.barrio,
    valor_productos: soloNumero($('productos').value),
    valor_domicilio: pedido.domicilio,
    pago: pedido.pago,
    gaseosa: pedido.gaseosa
  };

  const { error } = await db.from('domicilios').insert(nuevo);

  $('guardar').disabled = false;
  $('guardar').textContent = 'Guardar domicilio';

  if (error) {
    // Si falla, se queda aquí para no perder lo que llenaste
    $('error').textContent = 'No se pudo guardar: ' + error.message;
    $('error').hidden = false;
    return;
  }

  // Si el barrio es nuevo, se guarda para que salga como botón la próxima vez
  await db.from('barrios').upsert({ nombre: nuevo.barrio }, { onConflict: 'nombre', ignoreDuplicates: true });

  // Vuelve al menú y muestra el aviso verde allá
  dejarAviso('exito', `Domicilio guardado: factura #${nuevo.factura}, ${nuevo.barrio}, ${pedido.mensajeroNombre}.`);
  window.location.href = 'menu.html';
}


iniciar();