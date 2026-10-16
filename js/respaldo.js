const $ = (id) => document.getElementById(id);

// ===== Arranque =====
async function iniciar() {
  const sesion = await exigirSesion();
  if (!sesion) return;

  // Fechas por defecto: desde el día 1 del mes hasta hoy
  const hoy = new Date();
  $('desde').value = fechaParaArchivo(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  $('hasta').value = fechaParaArchivo(hoy);

  $('btn-todo').addEventListener('click', descargarTodo);
  $('btn-rango').addEventListener('click', descargarRango);

  mostrarUltimaCopia();
  await contarPedidos();
  $('contenido').hidden = false;
}

// Cuántos pedidos hay en total (sin traerlos todos)
async function contarPedidos() {
  const { count } = await db.from('domicilios').select('*', { count: 'exact', head: true });
  $('total').textContent = (count || 0).toLocaleString('es-CO');
}

// La fecha de la última copia se guarda en este navegador
function mostrarUltimaCopia() {
  const ultima = localStorage.getItem('ultimaCopia');
  $('ultima').textContent = ultima
    ? new Date(ultima).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
    : 'Nunca';
}

// Trae, descarga y avisa. "boton" se desactiva mientras trabaja.
async function hacerCopia(boton, inicio, fin, nombreArchivo) {
  const textoOriginal = boton.innerHTML;
  boton.disabled = true;
  boton.textContent = 'Preparando archivo...';

  try {
    const pedidos = await traerPedidos(inicio, fin);

    if (!pedidos.length) {
      dejarAviso('error', 'No hay pedidos en esas fechas.');
    } else {
      descargarCSV(pedidos, nombreArchivo);
      localStorage.setItem('ultimaCopia', new Date().toISOString());
      mostrarUltimaCopia();
      const cuantos = pedidos.length === 1 ? '1 pedido' : pedidos.length.toLocaleString('es-CO') + ' pedidos';
      dejarAviso('exito', `Copia descargada: ${cuantos}.`);
    }
  } catch (error) {
    dejarAviso('error', 'No se pudo hacer la copia: ' + error.message);
  }

  boton.disabled = false;
  boton.innerHTML = textoOriginal;
  mostrarAviso();
}

function descargarTodo() {
  hacerCopia($('btn-todo'), null, null, `domicilios-historial-${fechaParaArchivo()}.csv`);
}

function descargarRango() {
  if (!$('desde').value || !$('hasta').value) {
    dejarAviso('error', 'Elige la fecha de inicio y la de fin.');
    mostrarAviso();
    return;
  }

  const [a1, m1, d1] = $('desde').value.split('-').map(Number);
  const [a2, m2, d2] = $('hasta').value.split('-').map(Number);
  const inicio = new Date(a1, m1 - 1, d1);
  const fin = new Date(a2, m2 - 1, d2 + 1); // incluye todo el día "hasta"

  if (inicio >= fin) {
    dejarAviso('error', 'La fecha "Desde" debe ser antes que "Hasta".');
    mostrarAviso();
    return;
  }

  hacerCopia($('btn-rango'), inicio, fin, `domicilios-${$('desde').value}-a-${$('hasta').value}.csv`);
}

iniciar();