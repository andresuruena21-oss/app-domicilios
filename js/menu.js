async function iniciar() {
  const sesion = await exigirSesion();
  if (!sesion) return;

  document.getElementById('fecha').textContent = fechaDeHoy();
  document.getElementById('usuario').textContent = sesion.user.email;
  document.getElementById('contenido').hidden = false;
  mostrarAviso();
}

document.getElementById('boton-salir').addEventListener('click', cerrarSesion);
iniciar();