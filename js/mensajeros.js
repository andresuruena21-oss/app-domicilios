// ===== Estado de la pantalla =====
let mensajeros = [];
let editando = null;   // id del mensajero que se está renombrando

// ===== Utilidades =====
const $ = (id) => document.getElementById(id);

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// Muestra un aviso en esta misma pantalla
function avisar(tipo, texto) {
  dejarAviso(tipo, texto);
  mostrarAviso();
}

// ===== Arranque =====
async function iniciar() {
  const sesion = await exigirSesion();
  if (!sesion) return;

  $('form-agregar').addEventListener('submit', agregar);
  await cargar();
  $('contenido').hidden = false;
}

// Trae todos los mensajeros: primero los activos, luego por nombre
async function cargar() {
  const { data, error } = await db
    .from('mensajeros')
    .select('id, nombre, activo')
    .order('activo', { ascending: false })
    .order('nombre');

  if (error) {
    avisar('error', 'No se pudieron cargar los mensajeros: ' + error.message);
    return;
  }

  mensajeros = data || [];
  pintar();
}

// ===== Dibujar la lista =====
function pintar() {
  const lista = $('lista');
  lista.innerHTML = '';

  if (!mensajeros.length) {
    lista.appendChild(crear('div', 'vacio', 'Aún no hay mensajeros. Escribe un nombre arriba y toca Agregar.'));
    return;
  }

  mensajeros.forEach((m) => {
    const fila = crear('div', 'mensajero' + (m.activo ? '' : ' inactivo'));

    if (editando === m.id) {
      // Modo edición: campo de texto + Guardar + Cancelar
      const campo = crear('input', 'input-texto');
      campo.value = m.nombre;
      campo.setAttribute('aria-label', 'Nuevo nombre');
      const guardar = crear('button', 'btn-chico guardar', 'Guardar');
      const cancelar = crear('button', 'btn-chico', 'Cancelar');
      guardar.type = 'button';
      cancelar.type = 'button';

      guardar.addEventListener('click', () => renombrar(m, campo.value));
      campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') renombrar(m, campo.value); });
      cancelar.addEventListener('click', () => { editando = null; pintar(); });

      fila.append(campo, guardar, cancelar);
      lista.appendChild(fila);
      setTimeout(() => campo.focus(), 0);
      return;
    }

    // Modo normal: nombre + Editar + Activar/Desactivar
    const editar = crear('button', 'btn-chico', 'Editar');
    const interruptor = crear('button', 'btn-chico ' + (m.activo ? 'apagar' : 'encender'), m.activo ? 'Desactivar' : 'Activar');
    editar.type = 'button';
    interruptor.type = 'button';

    editar.addEventListener('click', () => { editando = m.id; pintar(); });
    interruptor.addEventListener('click', () => cambiarEstado(m));

    fila.append(crear('span', 'nombre', m.nombre), editar, interruptor);
    lista.appendChild(fila);
  });
}

// ===== Acciones =====
async function agregar(evento) {
  evento.preventDefault();
  const nombre = $('nuevo-nombre').value.trim();

  if (!nombre) {
    avisar('error', 'Escribe el nombre del mensajero.');
    return;
  }

  if (mensajeros.some((m) => m.nombre.toLowerCase() === nombre.toLowerCase())) {
    avisar('error', `Ya existe un mensajero llamado ${nombre}.`);
    return;
  }

  const { error } = await db.from('mensajeros').insert({ nombre });
  if (error) {
    avisar('error', 'No se pudo agregar: ' + error.message);
    return;
  }

  $('nuevo-nombre').value = '';
  avisar('exito', `${nombre} quedó agregado.`);
  await cargar();
}

async function renombrar(m, nuevoNombre) {
  const nombre = nuevoNombre.trim();
  if (!nombre) {
    avisar('error', 'El nombre no puede quedar vacío.');
    return;
  }

  const { error } = await db.from('mensajeros').update({ nombre }).eq('id', m.id);
  if (error) {
    avisar('error', 'No se pudo cambiar el nombre: ' + error.message);
    return;
  }

  editando = null;
  avisar('exito', `Nombre cambiado a ${nombre}.`);
  await cargar();
}

async function cambiarEstado(m) {
  const { error } = await db.from('mensajeros').update({ activo: !m.activo }).eq('id', m.id);
  if (error) {
    avisar('error', 'No se pudo cambiar: ' + error.message);
    return;
  }

  avisar('exito', m.activo ? `${m.nombre} quedó desactivado.` : `${m.nombre} quedó activo otra vez.`);
  await cargar();
}

iniciar();