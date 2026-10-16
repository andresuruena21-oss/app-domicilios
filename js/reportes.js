// ===== Estado de la pantalla =====
let periodo = 'hoy';
let pedidos = [];

// ===== Utilidades =====
const $ = (id) => document.getElementById(id);

function plata(valor) {
  return '$' + Number(valor || 0).toLocaleString('es-CO');
}

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function sumar(lista, campo) {
  return lista.reduce((s, p) => s + p[campo], 0);
}

function porcentaje(parte, total) {
  return total ? Math.round((parte / total) * 100) : 0;
}

// Desde y hasta según el periodo elegido
function rangoDe(cual) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let inicio = new Date(hoy);

  if (cual === 'semana') {
    // Desde el lunes de esta semana
    const diaSemana = (hoy.getDay() + 6) % 7; // lunes = 0
    inicio.setDate(hoy.getDate() - diaSemana);
  } else if (cual === 'mes') {
    inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }

  const fin = new Date(hoy);
  fin.setDate(hoy.getDate() + 1);
  return { inicio, fin };
}

function fechaCorta(fecha) {
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

// ===== Arranque =====
async function iniciar() {
  const sesion = await exigirSesion();
  if (!sesion) return;

  document.querySelectorAll('[data-periodo]').forEach((boton) => {
    boton.addEventListener('click', () => {
      periodo = boton.dataset.periodo;
      document.querySelectorAll('[data-periodo]').forEach((b) => b.classList.remove('elegida'));
      boton.classList.add('elegida');
      cargar();
    });
  });

  $('exportar').addEventListener('click', exportar);

  await cargar();
  $('contenido').hidden = false;
}

// Trae los pedidos del periodo, de a 1000 (Supabase entrega máximo 1000 por consulta)
async function cargar() {
  const { inicio, fin } = rangoDe(periodo);
  const ultimoDia = new Date(fin);
  ultimoDia.setDate(fin.getDate() - 1);
  $('rango').textContent = periodo === 'hoy'
    ? 'Hoy, ' + fechaCorta(inicio)
    : `Del ${fechaCorta(inicio)} al ${fechaCorta(ultimoDia)}`;

  const todos = [];
  let desde = 0;

  while (true) {
    const { data, error } = await db
      .from('domicilios')
      .select('*, mensajeros(nombre)')
      .gte('fecha', inicio.toISOString())
      .lt('fecha', fin.toISOString())
      .order('fecha', { ascending: true })
      .range(desde, desde + 999);

    if (error) {
      $('reporte').innerHTML = '';
      $('reporte').appendChild(crear('div', 'error', 'No se pudo cargar el reporte: ' + error.message));
      return;
    }

    todos.push(...data);
    if (data.length < 1000) break;
    desde += 1000;
  }

  pedidos = todos;
  pintar();
}

// ===== Dibujar el reporte =====
function pintar() {
  const caja = $('reporte');
  caja.innerHTML = '';

  if (!pedidos.length) {
    caja.appendChild(crear('div', 'vacio', 'No hay pedidos en este periodo.'));
    return;
  }

  caja.appendChild(bloqueCifras());
  caja.appendChild(bloquePago());
  caja.appendChild(bloqueGaseosa());
  caja.appendChild(bloqueBarrios());
  caja.appendChild(bloqueMensajeros());
}

// 1. Cifras principales
function bloqueCifras() {
  const cifras = crear('div', 'cifras');
  const datos = [
    ['Ventas en productos', plata(sumar(pedidos, 'valor_productos')), true],
    ['Pedidos', pedidos.length, false]
  ];
  datos.forEach(([titulo, valor, oscura]) => {
    const c = crear('div', 'cifra' + (oscura ? ' oscura' : ''));
    c.appendChild(crear('span', '', titulo));
    c.appendChild(crear('b', '', valor));
    cifras.appendChild(c);
  });
  return cifras;
}

// 2. Efectivo vs. Nequi
function bloquePago() {
  const efectivo = pedidos.filter((p) => p.pago === 'efectivo');
  const nequi = pedidos.filter((p) => p.pago === 'nequi');
  const ventasEf = sumar(efectivo, 'valor_productos');
  const ventasNq = sumar(nequi, 'valor_productos');
  const pctEf = porcentaje(ventasEf, ventasEf + ventasNq);

  const b = crear('div', 'bloque');
  b.appendChild(crear('h2', '', 'Efectivo vs. Nequi'));

  const barra = crear('div', 'barra-doble');
  const ef = crear('div', 'ef'); ef.style.width = pctEf + '%';
  const nq = crear('div', 'nq'); nq.style.width = (100 - pctEf) + '%';
  barra.appendChild(ef); barra.appendChild(nq);
  b.appendChild(barra);

  b.appendChild(renglonPunto('#15803D', `Efectivo · ${efectivo.length} pedidos (${pctEf}%)`, plata(ventasEf)));
  b.appendChild(renglonPunto('#6D28D9', `Nequi · ${nequi.length} pedidos (${100 - pctEf}%)`, plata(ventasNq)));

  const nequiPagar = crear('div', 'renglon destacado');
  nequiPagar.appendChild(crear('span', '', 'Domicilios Nequi a pagar'));
  nequiPagar.appendChild(crear('b', '', plata(sumar(nequi, 'valor_domicilio'))));
  b.appendChild(nequiPagar);
  return b;
}

function renglonPunto(color, texto, valor) {
  const r = crear('div', 'renglon');
  const izq = crear('span', 'con-punto');
  const punto = crear('span', 'punto'); punto.style.background = color;
  izq.appendChild(punto);
  izq.appendChild(document.createTextNode(texto));
  r.appendChild(izq);
  r.appendChild(crear('b', '', valor));
  return r;
}

// 3. Gaseosa
function bloqueGaseosa() {
  const con = pedidos.filter((p) => p.gaseosa).length;
  const pct = porcentaje(con, pedidos.length);

  const b = crear('div', 'bloque');
  const r = crear('div', 'renglon');
  r.appendChild(crear('h2', '', 'Pedidos con gaseosa'));
  r.appendChild(crear('span', '', `${con} de ${pedidos.length} · ${pct}%`));
  b.appendChild(r);

  const barra = crear('div', 'barra-simple');
  const relleno = crear('div'); relleno.style.width = pct + '%'; relleno.style.background = '#B45309';
  barra.appendChild(relleno);
  b.appendChild(barra);
  return b;
}

// 4. Barrios más frecuentes (los 10 primeros)
function bloqueBarrios() {
  const conteo = {};
  pedidos.forEach((p) => {
    if (!conteo[p.barrio]) conteo[p.barrio] = { pedidos: 0, ventas: 0 };
    conteo[p.barrio].pedidos += 1;
    conteo[p.barrio].ventas += p.valor_productos;
  });

  const ranking = Object.entries(conteo)
    .sort((a, b) => b[1].pedidos - a[1].pedidos || b[1].ventas - a[1].ventas)
    .slice(0, 10);
  const maximo = ranking.length ? ranking[0][1].pedidos : 1;

  const b = crear('div', 'bloque');
  b.appendChild(crear('h2', '', 'Barrios más frecuentes'));

  ranking.forEach(([nombre, d]) => {
    const fila = crear('div', 'fila-barrio');
    fila.appendChild(crear('span', 'nombre', nombre));
    const barra = crear('div', 'barra-simple');
    const relleno = crear('div');
    relleno.style.width = Math.round((d.pedidos / maximo) * 100) + '%';
    relleno.style.background = '#C2410C';
    barra.appendChild(relleno);
    fila.appendChild(barra);
    fila.appendChild(crear('span', 'num fuerte', d.pedidos));
    fila.appendChild(crear('span', 'num suave', plata(d.ventas)));
    b.appendChild(fila);
  });
  return b;
}

// 5. Resumen por mensajero (lo que entrega y lo que se le paga de Nequi)
function bloqueMensajeros() {
  const porMensajero = {};
  pedidos.forEach((p) => {
    const nombre = p.mensajeros ? p.mensajeros.nombre : 'Sin mensajero';
    if (!porMensajero[nombre]) porMensajero[nombre] = { pedidos: 0, entrega: 0, nequi: 0 };
    porMensajero[nombre].pedidos += 1;
    if (p.pago === 'efectivo') porMensajero[nombre].entrega += p.valor_productos;
    else porMensajero[nombre].nequi += p.valor_domicilio;
  });

  const b = crear('div', 'bloque');
  b.appendChild(crear('h2', '', 'Por mensajero'));

  const tabla = crear('table', 'tabla-mensajeros');
  const cabeza = crear('tr');
  ['Mensajero', 'Pedidos', 'Entrega', 'Nequi'].forEach((t, i) => {
    const th = crear('th', i ? 'num' : '', t);
    cabeza.appendChild(th);
  });
  tabla.appendChild(cabeza);

  Object.entries(porMensajero)
    .sort((a, b) => b[1].pedidos - a[1].pedidos)
    .forEach(([nombre, d]) => {
      const tr = crear('tr');
      tr.appendChild(crear('td', '', nombre));
      tr.appendChild(crear('td', 'num', d.pedidos));
      tr.appendChild(crear('td', 'num', plata(d.entrega)));
      tr.appendChild(crear('td', 'num', plata(d.nequi)));
      tabla.appendChild(tr);
    });

  b.appendChild(tabla);
  b.appendChild(crear('div', 'ayuda', 'Entrega = productos cobrados en efectivo. Nequi = domicilios que se le deben.'));
  return b;
}

// ===== Exportar a Excel (archivo CSV) =====
function exportar() {
  if (!pedidos.length) {
    dejarAviso('error', 'No hay pedidos para exportar en este periodo.');
    mostrarAviso();
    return;
  }

  const columnas = ['Fecha', 'Hora', 'Factura', 'Mensajero', 'Barrio', 'Productos', 'Domicilio', 'Total', 'Pago', 'Gaseosa', 'Liquidado'];
  const filas = pedidos.map((p) => {
    const f = new Date(p.fecha);
    return [
      f.toLocaleDateString('es-CO'),
      f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      p.factura,
      p.mensajeros ? p.mensajeros.nombre : '',
      p.barrio,
      p.valor_productos,
      p.valor_domicilio,
      p.valor_productos + p.valor_domicilio,
      p.pago === 'nequi' ? 'Nequi' : 'Efectivo',
      p.gaseosa ? 'Sí' : 'No',
      p.liquidado ? 'Sí' : 'No'
    ];
  });

  // Excel en español usa punto y coma (;) para separar columnas
  const limpiar = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const texto = [columnas, ...filas].map((fila) => fila.map(limpiar).join(';')).join('\r\n');

  // El "\uFEFF" al inicio hace que Excel lea bien las tildes y la ñ
  const archivo = new Blob(['\uFEFF' + texto], { type: 'text/csv;charset=utf-8' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = `domicilios-${periodo}-${new Date().toISOString().slice(0, 10)}.csv`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

iniciar();