// Revisa si hay sesión iniciada. Si no la hay, manda al login.
async function exigirSesion() {
  const { data } = await db.auth.getSession();
  if (!data.session) {
    window.location.href = 'index.html';
    return null;
  }
  return data.session;
}

// Cierra la sesión y vuelve al login.
async function cerrarSesion() {
  await db.auth.signOut();
  window.location.href = 'index.html';
}

// Fecha de hoy en español, por ejemplo: "viernes, 16 de oct"
function fechaDeHoy() {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'short'
  });
}

// ===== Avisos entre pantallas =====
// Guarda un aviso para mostrarlo en la siguiente pantalla.
// tipo: 'exito' (verde) o 'error' (rojo)
function dejarAviso(tipo, texto) {
  sessionStorage.setItem('aviso', JSON.stringify({ tipo, texto }));
}

// Si hay un aviso guardado, lo muestra arriba y lo borra.
function mostrarAviso() {
  const guardado = sessionStorage.getItem('aviso');
  if (!guardado) return;
  sessionStorage.removeItem('aviso');

  const { tipo, texto } = JSON.parse(guardado);
  const aviso = document.createElement('div');
  aviso.className = 'aviso aviso-' + tipo;
  aviso.setAttribute('role', 'status');
  aviso.textContent = (tipo === 'exito' ? '✓ ' : '✕ ') + texto;
  document.body.appendChild(aviso);

  // Se va solo a los 4 segundos, o al tocarlo
  const quitar = () => aviso.remove();
  aviso.addEventListener('click', quitar);
  setTimeout(quitar, 4000);
}