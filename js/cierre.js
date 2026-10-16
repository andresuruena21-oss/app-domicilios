// ===== Estado de la pantalla =====
let mensajeros = [];
let pedidos = [];          // pedidos del día elegido
let elegido = null;        // id del mensajero que se está viendo

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

// Fecha de hoy en formato del selector: "2026-10-16"
function hoyComoTexto() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// "1 pedido" / "3 pedidos"
function pedidosTexto(n) {
  return n === 1 ? '1 pedido' : n + ' pedidos';
}

// Fila de texto + valor para el desglose
function linea(clase, texto, valor) {
  const fila = crear('div', 'linea ' + clase);
  fila.appendChild(crear('span', '', texto));
  fila.appendChild(crear('b', '', valor));
  return fila;
}

// ===== Las cuentas de un grupo de pedidos =====
// Devuelve todo lo que se necesita para el cierre
function calcular(lista) {
  const efectivo = lista.filter((p) => p.pago === 'efectivo');
  const nequi = lista.filter((p) => p.pago === 'nequi');

  const productosEfectivo = efectivo.reduce((s, p) => s + p.valor_productos, 0);
  const domiciliosEfectivo = efectivo.reduce((s, p) => s + p.valor_domicilio, 0);
  const domiciliosNequi = nequi.reduce((s, p) => s + p.valor_domicilio, 0);

  return {
    cantidadEfectivo: efectivo.length,
    cantidadNequi: nequi.length,
    cobrado: productosEfectivo + domiciliosEfectivo,   // lo que cobró en la calle
    seQueda: domiciliosEfectivo,                       // sus domicilios en efectivo
    entrega: productosEfectivo,                        // productos que son del negocio
    nequiPorPagar: domiciliosNequi,                    // lo que el negocio le debe
    saldo: productosEfectivo - domiciliosNequi         // + él entrega / − el negocio le paga
  };
}

// ===== Arranque =====
async function iniciar() {
  const sesion = await exigirSesion();
  if (!sesion) return;

  $('dia').value = hoyComoTexto();
  $('dia').addEventListener('change', cargarPedidos);

  const { data } = await db.from('mensajeros').select('id, nombre').eq('activo', true).order('nombre');
  mensajeros = data || [];
  elegido = mensajeros.length ? mensajeros[0].id : null;

  await cargarPedidos();
  $('contenido').hidden = false;
}

// Trae los pedidos del día que está en el selector
async function cargarPedidos() {
  const [anio, mes, dia] = $('dia').value.split('-').map(Number);
  const inicio = new Date(anio, mes - 1, dia);
  const fin = new Date(anio, mes - 1, dia + 1);

  const { data, error } = await db
    .from('domicilios')
    .select('*')
    .gte('fecha', inicio.toISOString())
    .lt('fecha', fin.toISOString())
    .order('fecha', { ascending: false });

  if (error) {
    $('cuenta').innerHTML = '';
    $('cuenta').appendChild(crear('div', 'error', 'No se pudieron cargar los pedidos: ' + error.message));
    return;
  }

  pedidos = data || [];
  pintar();
}

// Dibuja pestañas, cuenta del mensajero y total del día
function pintar() {
  pintarPestanas();
  pintarCuenta();

  const total = calcular(pedidos);
  $('total-dia').innerHTML = '';
  $('total-dia').appendChild(crear('span', '', `Total del día (${pedidosTexto(pedidos.length)}): ` + (total.saldo >= 0 ? 'te entregan' : 'pagas')));
  $('total-dia').appendChild(crear('b', '', plata(Math.abs(total.saldo))));
}

function pintarPestanas() {
  const caja = $('pestanas');
  caja.innerHTML = '';

  mensajeros.forEach((m) => {
    const cantidad = pedidos.filter((p) => p.mensajero_id === m.id).length;
    const boton = crear('button', m.id === elegido ? 'elegida' : '', `${m.nombre} · ${cantidad}`);
    boton.type = 'button';
    boton.addEventListener('click', () => {
      elegido = m.id;
      pintar();
    });
    caja.appendChild(boton);
  });
}

function pintarCuenta() {
  const caja = $('cuenta');
  caja.innerHTML = '';

  const mensajero = mensajeros.find((m) => m.id === elegido);
  if (!mensajero) {
    caja.appendChild(crear('div', 'vacio', 'No hay mensajeros. Agrégalos en Supabase (tabla mensajeros).'));
    return;
  }

  const suyos = pedidos.filter((p) => p.mensajero_id === elegido);
  if (!suyos.length) {
    caja.appendChild(crear('div', 'vacio', `${mensajero.nombre} no tiene pedidos este día.`));
    return;
  }

  const c = calcular(suyos);
  const liquidado = suyos.every((p) => p.liquidado);

  // Tarjeta principal
  const tarjeta = crear('div', 'cuenta');
  tarjeta.appendChild(crear('span', 'estado ' + (liquidado ? 'liquidado' : 'pendiente'), liquidado ? '✓ Liquidado' : 'Pendiente'));

  const cabeza = crear('div');
  if (c.saldo >= 0) {
    cabeza.appendChild(crear('div', 'quien', `${mensajero.nombre} te entrega`));
    cabeza.appendChild(crear('div', 'grande', plata(c.saldo)));
  } else {
    cabeza.appendChild(crear('div', 'quien', `Le pagas a ${mensajero.nombre}`));
    cabeza.appendChild(crear('div', 'grande', plata(-c.saldo)));
  }
  tarjeta.appendChild(cabeza);

  const desglose = crear('div', 'desglose');
  desglose.appendChild(linea('', `Cobró en efectivo (${pedidosTexto(c.cantidadEfectivo)})`, plata(c.cobrado)));
  desglose.appendChild(linea('suave', '− Se queda sus domicilios', plata(c.seQueda)));
  desglose.appendChild(linea('verde', '= Productos a entregar', plata(c.entrega)));
  desglose.appendChild(linea('morado', `− Domicilios Nequi (${pedidosTexto(c.cantidadNequi)})`, plata(c.nequiPorPagar)));
  desglose.appendChild(linea('final', 'Saldo final', plata(c.saldo)));
  tarjeta.appendChild(desglose);
  caja.appendChild(tarjeta);

  // Lista de sus pedidos
  caja.appendChild(crear('div', 'titulo-seccion', `Pedidos de ${mensajero.nombre}`));
  const tabla = crear('div', 'tabla-pedidos');
  suyos.forEach((p) => {
    const fila = crear('div', 'fila-pedido');
    fila.appendChild(crear('span', 'mono', '#' + p.factura));
    fila.appendChild(crear('span', '', p.barrio));
    fila.appendChild(crear('span', p.pago, p.pago === 'nequi' ? 'Nequi' : 'Efectivo'));
    // En efectivo se muestra lo que entrega; en Nequi, lo que se le descuenta
    const monto = p.pago === 'nequi' ? '−' + plata(p.valor_domicilio) : plata(p.valor_productos);
    fila.appendChild(crear('span', 'mono derecha', monto));
    tabla.appendChild(fila);
  });
  caja.appendChild(tabla);

  // Botón de liquidar / deshacer
  const boton = crear('button', liquidado ? 'btn-secundario' : 'btn-principal',
    liquidado ? 'Deshacer liquidación' : `Marcar a ${mensajero.nombre} como liquidado`);
  boton.type = 'button';
  boton.addEventListener('click', () => liquidar(suyos, !liquidado, mensajero.nombre, boton));
  caja.appendChild(boton);
}

// Marca (o desmarca) como liquidados todos los pedidos del mensajero ese día
async function liquidar(lista, valor, nombre, boton) {
  boton.disabled = true;
  const ids = lista.map((p) => p.id);

  const { error } = await db.from('domicilios').update({ liquidado: valor }).in('id', ids);

  if (error) {
    dejarAviso('error', 'No se pudo guardar: ' + error.message);
  } else {
    pedidos.forEach((p) => { if (ids.includes(p.id)) p.liquidado = valor; });
    dejarAviso('exito', valor ? `${nombre} quedó liquidado.` : `Se deshizo la liquidación de ${nombre}.`);
  }

  pintar();
  mostrarAviso();
}

iniciar();