// ===== Estado de la pantalla =====
let pedidos = [];            // los pedidos de hoy traídos de Supabase
let filtroMensajero = 'todos';
let filtroTipo = 'todos';
let pedidoAbierto = null;    // el pedido que se está viendo en el detalle

// ===== Utilidades =====
const $ = (id) => document.getElementById(id);

function plata(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO');
}

// Crea una etiqueta HTML con texto seguro (evita que un texto raro dañe la página)
function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// Hora corta: "3:45 p. m."
function hora(fechaISO) {
  return new Date(fechaISO).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

// ===== Arranque =====
async function iniciar() {
  const sesion = await exigirSesion();
  if (!sesion) return;

  $('fecha').textContent = fechaDeHoy();
  conectarFiltros();
  await Promise.all([cargarMensajeros(), cargarPedidos()]);
  $('contenido').hidden = false;
  mostrarAviso();
}

// Botones de mensajero: "Todos" + uno por cada mensajero
async function cargarMensajeros() {
  const { data } = await db.from('mensajeros').select('id, nombre').eq('activo', true).order('nombre');
  const caja = $('filtro-mensajero');
  caja.innerHTML = '';

  const opciones = [{ id: 'todos', nombre: 'Todos' }].concat(data || []);
  opciones.forEach((m) => {
    const boton = crear('button', m.id === 'todos' ? 'elegida' : '', m.nombre);
    boton.type = 'button';
    boton.addEventListener('click', () => {
      filtroMensajero = m.id;
      caja.querySelectorAll('button').forEach((b) => b.classList.remove('elegida'));
      boton.classList.add('elegida');
      pintar();
    });
    caja.appendChild(boton);
  });
}

// Trae los pedidos de hoy (desde las 12:00 a. m. hasta ahora)
async function cargarPedidos() {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);

  const { data, error } = await db
    .from('domicilios')
    .select('*, mensajeros(nombre)')
    .gte('fecha', inicio.toISOString())
    .lt('fecha', fin.toISOString())
    .order('fecha', { ascending: false });

  if (error) {
    $('lista').innerHTML = '';
    $('lista').appendChild(crear('div', 'error', 'No se pudieron cargar los pedidos: ' + error.message));
    return;
  }

  pedidos = data || [];
  pintar();
}

// Filtros por tipo (Todos, Efectivo, Nequi, Gaseosa)
function conectarFiltros() {
  document.querySelectorAll('[data-tipo]').forEach((boton) => {
    boton.addEventListener('click', () => {
      filtroTipo = boton.dataset.tipo;
      document.querySelectorAll('[data-tipo]').forEach((b) => b.classList.remove('elegida'));
      boton.classList.add('elegida');
      pintar();
    });
  });

  $('btn-cerrar').addEventListener('click', cerrarDetalle);
  $('detalle').addEventListener('click', (e) => { if (e.target.id === 'detalle') cerrarDetalle(); });
  $('btn-borrar').addEventListener('click', borrarPedido);
}

// Dibuja el resumen y la lista según los filtros elegidos
function pintar() {
  // 1. Filtro por mensajero (también afecta el resumen)
  const delMensajero = pedidos.filter((p) => filtroMensajero === 'todos' || p.mensajero_id === filtroMensajero);

  // 2. Resumen
  const efectivo = delMensajero.filter((p) => p.pago === 'efectivo');
  const nequi = delMensajero.filter((p) => p.pago === 'nequi');
  $('total-pedidos').textContent = delMensajero.length;
  $('total-efectivo').textContent = plata(efectivo.reduce((suma, p) => suma + p.valor_productos, 0));
  $('total-nequi').textContent = plata(nequi.reduce((suma, p) => suma + p.valor_domicilio, 0));

  // 3. Filtro por tipo (solo afecta la lista)
  const visibles = delMensajero.filter((p) => {
    if (filtroTipo === 'efectivo') return p.pago === 'efectivo';
    if (filtroTipo === 'nequi') return p.pago === 'nequi';
    if (filtroTipo === 'gaseosa') return p.gaseosa;
    return true;
  });

  // 4. Lista
  const lista = $('lista');
  lista.innerHTML = '';

  if (!visibles.length) {
    const texto = pedidos.length
      ? 'No hay pedidos con este filtro.'
      : 'Todavía no hay pedidos hoy. Toca "Nuevo domicilio" para registrar el primero.';
    lista.appendChild(crear('div', 'vacio', texto));
    return;
  }

  visibles.forEach((p) => lista.appendChild(tarjeta(p)));
}

// Una tarjeta de pedido
function tarjeta(p) {
  const boton = crear('button', 'tarjeta-pedido');
  boton.type = 'button';

  const arriba = crear('div', 'arriba');
  arriba.appendChild(crear('span', 'barrio', p.barrio));
  arriba.appendChild(crear('span', 'total', plata(p.valor_productos + p.valor_domicilio)));

  const etiquetas = crear('div', 'etiquetas');
  etiquetas.appendChild(crear('span', 'etiqueta mono', '#' + p.factura));
  etiquetas.appendChild(crear('span', 'etiqueta', p.mensajeros ? p.mensajeros.nombre : 'Sin mensajero'));
  etiquetas.appendChild(crear('span', 'etiqueta ' + p.pago, p.pago === 'nequi' ? 'Nequi' : 'Efectivo'));
  if (p.gaseosa) etiquetas.appendChild(crear('span', 'etiqueta gaseosa', 'Gaseosa'));

  boton.appendChild(arriba);
  boton.appendChild(etiquetas);
  boton.addEventListener('click', () => abrirDetalle(p));
  return boton;
}

// ===== Detalle de un pedido =====
function abrirDetalle(p) {
  pedidoAbierto = p;
  $('detalle-titulo').textContent = 'Factura #' + p.factura;

  const filas = [
    ['Barrio', p.barrio],
    ['Mensajero', p.mensajeros ? p.mensajeros.nombre : '—'],
    ['Productos', plata(p.valor_productos)],
    ['Domicilio', plata(p.valor_domicilio)],
    ['Pago', p.pago === 'nequi' ? 'Nequi' : 'Efectivo'],
    ['Gaseosa', p.gaseosa ? 'Sí' : 'No'],
    ['Hora', hora(p.fecha)]
  ];

  const caja = $('detalle-datos');
  caja.innerHTML = '';
  filas.forEach(([nombre, valor]) => {
    const fila = crear('div', 'dato');
    fila.appendChild(crear('span', '', nombre));
    fila.appendChild(crear('b', '', valor));
    caja.appendChild(fila);
  });

  $('btn-borrar').textContent = 'Borrar pedido';
  $('btn-borrar').classList.remove('confirmar');
  $('detalle').hidden = false;
}

function cerrarDetalle() {
  $('detalle').hidden = true;
  pedidoAbierto = null;
}

// Borrar pide confirmación: primer toque cambia el botón, segundo toque borra
async function borrarPedido() {
  const boton = $('btn-borrar');

  if (!boton.classList.contains('confirmar')) {
    boton.classList.add('confirmar');
    boton.textContent = 'Toca otra vez para borrar';
    return;
  }

  boton.disabled = true;
  const { error } = await db.from('domicilios').delete().eq('id', pedidoAbierto.id);
  boton.disabled = false;

  if (error) {
    dejarAviso('error', 'No se pudo borrar: ' + error.message);
  } else {
    dejarAviso('exito', `Pedido #${pedidoAbierto.factura} borrado.`);
    pedidos = pedidos.filter((p) => p.id !== pedidoAbierto.id);
  }

  cerrarDetalle();
  pintar();
  mostrarAviso();
}

iniciar();