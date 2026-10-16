// ===== Herramientas para exportar pedidos a Excel (CSV) =====
// Las usan Reportes y Copia de seguridad.

// Trae pedidos de Supabase de a 1000 (el máximo por consulta).
// Si no se pasa inicio/fin, trae TODO el historial.
async function traerPedidos(inicio, fin) {
  const todos = [];
  let desde = 0;

  while (true) {
    let consulta = db
      .from('domicilios')
      .select('*, mensajeros(nombre)')
      .order('fecha', { ascending: true })
      .range(desde, desde + 999);

    if (inicio) consulta = consulta.gte('fecha', inicio.toISOString());
    if (fin) consulta = consulta.lt('fecha', fin.toISOString());

    const { data, error } = await consulta;
    if (error) throw error;

    todos.push(...data);
    if (data.length < 1000) break;
    desde += 1000;
  }

  return todos;
}

// Convierte la lista de pedidos en un archivo .csv y lo descarga
function descargarCSV(pedidos, nombreArchivo) {
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
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

// "2026-10-16" para los nombres de archivo
function fechaParaArchivo(fecha) {
  const d = fecha || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}