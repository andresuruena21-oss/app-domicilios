const formulario = document.getElementById('formulario');
const boton = document.getElementById('boton-entrar');
const cajaError = document.getElementById('error');

// Si ya había iniciado sesión antes, pasa directo al menú
db.auth.getSession().then(({ data }) => {
  if (data.session) window.location.href = 'menu.html';
});

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  cajaError.hidden = true;
  boton.disabled = true;
  boton.textContent = 'Entrando...';

  const correo = document.getElementById('correo').value.trim();
  const clave = document.getElementById('clave').value;

  const { error } = await db.auth.signInWithPassword({ email: correo, password: clave });

  if (error) {
    cajaError.textContent = 'Correo o contraseña incorrectos. Revisa e intenta de nuevo.';
    cajaError.hidden = false;
    boton.disabled = false;
    boton.textContent = 'Entrar';
    return;
  }

  window.location.href = 'menu.html';
});