(() => {
  const $ = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => [...p.querySelectorAll(s)];

  const API = {
    async guardar(data) {
      const r = await fetch(`${window.API_BASE}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      return r.json();
    },
    async listar(limit=100) {
      const r = await fetch(`${window.API_BASE}/records?limit=${limit}`);
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const j = await r.json();
      return j.items || [];
    },
    descargarCSV() {
      // abre la descarga en la misma pestaña
      window.location.href = `${window.API_BASE}/descargas`;
    }
  };

  function formatTs(ts){
    try {
      const d = new Date(ts);
      const pad = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return ''; }
  }

  async function cargarTabla(){
    const tbody = $('#tabla-datos tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:.5rem;">Cargando...</td></tr>';
    try {
      const items = await API.listar(200);
      if (!items.length){
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:.5rem;">Sin registros</td></tr>';
        return;
      }
      tbody.innerHTML = items.map(r => `
        <tr>
          <td>${formatTs(r.ts)}</td>
          <td>${r.tecnico ?? ''}</td>
          <td>${r.material ?? ''}</td>
          <td>${r.cantidad ?? ''}</td>
          <td>${r.po ?? ''}</td>
          <td>${r.comentarios ?? ''}</td>
          <td style="font-size:.8rem;color:#666">${r.id ?? ''}</td>
        </tr>
      `).join('');
    } catch (e){
      tbody.innerHTML = `<tr><td colspan="7" style="color:#b00;padding:.5rem;">Error al cargar: ${e.message}</td></tr>`;
    }
  }

  async function onGuardar(e){
    e?.preventDefault?.();
    const btn = $('#btn-guardar');
    const data = {
      tecnico: $('#tecnico')?.value?.trim(),
      material: $('#material')?.value?.trim(),
      cantidad: Number($('#cantidad')?.value || 0),
      po: $('#po')?.value?.trim(),
      comentarios: $('#comentarios')?.value?.trim(),
    };

    // Validaciones mínimas
    if (!data.tecnico || !data.material || !data.cantidad){
      alert('Completa Técnico, Material y Cantidad.');
      return;
    }

    try{
      btn && (btn.disabled = true, btn.textContent = 'Guardando...');
      const res = await API.guardar(data);
      // limpia el formulario
      $('#material').value = '';
      $('#cantidad').value = '';
      $('#po').value = '';
      $('#comentarios').value = '';
      // refresca la tabla
      await cargarTabla();
      alert('Guardado OK. ID: ' + (res.id || ''));
    }catch(e){
      alert('Error al guardar: ' + e.message);
    }finally{
      btn && (btn.disabled = false, btn.textContent = 'Guardar');
    }
  }

  function onDescargar(){
    API.descargarCSV();
  }

  function init(){
    // Bind de botones
    $('#btn-guardar')?.addEventListener('click', onGuardar);
    $('#btn-refrescar')?.addEventListener('click', cargarTabla);
    $('#btn-descargar')?.addEventListener('click', onDescargar);
    // Primera carga
    cargarTabla();
  }

  document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init);
})();
