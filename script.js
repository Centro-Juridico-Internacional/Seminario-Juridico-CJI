document.addEventListener('DOMContentLoaded', () => {
  // =================== POPUP MODERNO ===================
  function mostrarAlerta(mensaje) {
    if (document.querySelector('.alerta-modal')) return;

    const overlay = document.createElement('div');
    overlay.className = 'alerta-modal';
    overlay.innerHTML = `
      <div class="alerta-contenido" role="dialog" aria-modal="true" aria-live="assertive">
        <p>${mensaje}</p>
        <button id="btnCerrarAlerta" type="button" autofocus>Aceptar</button>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('alerta-modal')) cerrar();
    });

    const onKey = (e) => { if (e.key === 'Escape') cerrar(); };

    function cerrar() {
      overlay.classList.remove('visible');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => overlay.remove(), 220);
    }

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    document.getElementById('btnCerrarAlerta').addEventListener('click', cerrar);
    document.addEventListener('keydown', onKey);
  }

  // =================== SLIDER (scope a .form-shell) ===================
  const shell = document.querySelector('.form-shell') || document;
  const left = shell ? shell.querySelector('.left') : null;
  const dots = shell ? shell.querySelectorAll('.dot') : [];

  const fondos = [
    "url('img/slideruno.jpg')",
    "url('img/sliderdos.jpg')",
    "url('img/slidertres.jpg')",
    "url('img/slidercuatro.jpg')"
  ];

  if (left && dots.length === fondos.length && fondos.length > 0) {
    let index = 0;
    let intervalo;

    function cambiarFondo(nuevoIndex = null) {
      if (nuevoIndex !== null) index = nuevoIndex;
      else index = (index + 1) % fondos.length;

      left.style.backgroundImage = fondos[index];
      dots.forEach(dot => dot.classList.remove('active'));
      dots[index].classList.add('active');
    }

    function iniciarSlider() {
      intervalo = setInterval(() => cambiarFondo(), 4000);
    }

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        clearInterval(intervalo);
        cambiarFondo(i);
        iniciarSlider();
      });
    });

    left.style.backgroundImage = fondos[0];
    dots[0].classList.add('active');
    iniciarSlider();
  }

  // =================== FORMULARIO ===================
  const tipoPersona = document.getElementById('tipoPersona');
  const ubicacion = document.getElementById('ubicacion');
  const campoUbicacion = document.getElementById('campoUbicacion');
  const campoEmpresa = document.getElementById('campoEmpresa');
  const precioTexto = document.getElementById('precio');
  const btnPayu = document.getElementById('btnPayu');

  const inputNombre = document.getElementById('nombre');
  const inputCorreo = document.getElementById('correo');
  const inputConfirmarCorreo = document.getElementById('confirmarCorreo');
  const inputEmpresa = document.getElementById('empresa');
  const inputTelefono = document.getElementById('telefono');
  const inputHoneypot = document.getElementById('website_honeypot');

  // Placeholders
  if (inputNombre) inputNombre.placeholder = 'Ingrese su nombre completo';
  if (inputCorreo) inputCorreo.placeholder = 'Ingrese su correo electrónico';
  if (inputConfirmarCorreo) inputConfirmarCorreo.placeholder = 'Confirme su correo electrónico';
  if (inputEmpresa) inputEmpresa.placeholder = 'Ingrese el nombre de su empresa';
  if (inputTelefono) inputTelefono.placeholder = 'Ingrese su número de celular';

  // Requeridos base
  if (inputNombre) inputNombre.required = true;
  if (inputCorreo) inputCorreo.required = true;
  if (inputConfirmarCorreo) inputConfirmarCorreo.required = true;
  if (inputTelefono) inputTelefono.required = true;
  if (tipoPersona) tipoPersona.required = true;

function actualizarPrecio() {
  let precio = null;

  // ✅ NUEVOS PRECIOS
  const PRECIO_NATURAL = 356346;
  const PRECIO_BOGOTA = 320813;
  const PRECIO_FUERA  = 323406;

  if (tipoPersona && tipoPersona.value === 'natural') {
    // Oculta ubicación
    if (campoUbicacion) campoUbicacion.classList.add('oculto');
    if (ubicacion) ubicacion.removeAttribute('required');
    if (ubicacion) ubicacion.value = ""; // opcional: limpia selección

    // Oculta empresa y limpia
    if (campoEmpresa) {
      campoEmpresa.classList.remove('mostrar');
      campoEmpresa.classList.add('hidden');
      campoEmpresa.classList.remove('oculto');
      campoEmpresa.setAttribute('aria-hidden', 'true');
    }
    if (inputEmpresa) {
      inputEmpresa.removeAttribute('required');
      inputEmpresa.value = '';
    }

    const formShell = document.querySelector('.form-shell');
    if (formShell) formShell.classList.remove('expanded');

    precio = PRECIO_NATURAL;

  } else if (tipoPersona && tipoPersona.value === 'empresa') {
    // Muestra ubicación
    if (campoUbicacion) campoUbicacion.classList.remove('oculto');
    if (ubicacion) ubicacion.setAttribute('required', 'required');

    // Muestra empresa
    if (campoEmpresa) {
      campoEmpresa.classList.add('mostrar');
      campoEmpresa.classList.remove('hidden', 'oculto');
      campoEmpresa.setAttribute('aria-hidden', 'false');
    }
    if (inputEmpresa) inputEmpresa.setAttribute('required', 'required');

    const formShell = document.querySelector('.form-shell');
    if (formShell) formShell.classList.add('expanded');

    // ✅ Precio por ubicación
    if (ubicacion) {
      if (ubicacion.value === 'bogota') precio = PRECIO_BOGOTA;
      else if (ubicacion.value === 'fuera') precio = PRECIO_FUERA;
    }
  }

  if (precio !== null) {
    precioTexto.textContent = `Precio: $${precio.toLocaleString('es-CO')}`;
    btnPayu.textContent = `Pagar $${precio.toLocaleString('es-CO')} con PayU (Sandbox)`;
    btnPayu.dataset.valor = String(precio);
  } else {
    precioTexto.textContent = '';
    btnPayu.textContent = 'Separar mi cupo';
    btnPayu.dataset.valor = '';
  }
}


  tipoPersona?.addEventListener('change', actualizarPrecio);
  ubicacion?.addEventListener('change', actualizarPrecio);

  // Estado inicial campo empresa
  if (tipoPersona?.value === 'empresa') {
    campoEmpresa?.classList.add('mostrar');
    campoEmpresa?.classList.remove('hidden', 'oculto');
    campoEmpresa?.setAttribute('aria-hidden', 'false');
    if (inputEmpresa) inputEmpresa.required = true;
  } else {
    campoEmpresa?.classList.remove('mostrar');
    campoEmpresa?.classList.add('hidden');
    campoEmpresa?.setAttribute('aria-hidden', 'true');
    if (inputEmpresa) inputEmpresa.required = false;
  }

  actualizarPrecio();

  // =================== VENDEDOR POR URL ===================
  // URL: https://tudominio.com/landing.html?vendedor=123
  function detectVendedorFromURL() {
    const params = new URLSearchParams(window.location.search || '');
    const v = (params.get('vendedor') || '').trim();
    return v || 'sin_vendedor';
  }

  const idVendedor = detectVendedorFromURL();
  const inputVendedor = document.getElementById('vendedor');
  if (inputVendedor) inputVendedor.value = idVendedor;

  // =================== HELPERS PAYU ===================
  function ensureHiddenInput(form, name, idOpt) {
    let el = idOpt ? document.getElementById(idOpt) : form.querySelector(`input[name="${name}"]`);
    if (!el) {
      el = document.createElement('input');
      el.type = 'hidden';
      el.name = name;
      if (idOpt) el.id = idOpt;
      form.appendChild(el);
    }
    return el;
  }

  function limit255(v) {
    return (v == null ? '' : String(v)).trim().slice(0, 255);
  }

  // =================== VALIDACIÓN ===================
  function validarFormulario(form) {
    if (!form) return false;

    if (inputHoneypot && inputHoneypot.value !== '') {
      console.warn('Bot detected via honeypot.');
      return false;
    }

    if (!form.checkValidity()) {
      const primerInvalido = form.querySelector(':invalid');
      let mensaje = 'Por favor completa los campos obligatorios.';

      if (primerInvalido) {
        const mapaLabels = {
          nombre: 'tu nombre completo',
          correo: 'tu correo electrónico',
          confirmarCorreo: 'la confirmación del correo',
          telefono: 'tu número de celular',
          tipoPersona: 'el tipo de cliente',
          ubicacion: 'la ubicación',
          empresa: 'el nombre de tu empresa'
        };
        const id = primerInvalido.id || primerInvalido.name;
        if (id && mapaLabels[id]) mensaje = `Por favor ingresa ${mapaLabels[id]}.`;

        primerInvalido.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => primerInvalido.focus({ preventScroll: true }), 300);
      }
      mostrarAlerta(mensaje);
      return false;
    }

    if (inputCorreo && inputConfirmarCorreo) {
      if (inputCorreo.value.trim().toLowerCase() !== inputConfirmarCorreo.value.trim().toLowerCase()) {
        mostrarAlerta('Los correos electrónicos no coinciden. Por favor verifícalos.');
        inputConfirmarCorreo.focus();
        return false;
      }
    }

    return true;
  }

  // ✅ Anti doble click / doble submit (y re-habilita si falla)
  let pagando = false;

  // =================== PAGO PAYU ===================
  btnPayu?.addEventListener('click', () => {
    try {
      if (pagando) return;
      pagando = true;

      const valor = btnPayu.dataset.valor;
      if (!valor) {
        pagando = false;
        mostrarAlerta('Por favor, seleccione el tipo de cliente y (si aplica) la ubicación antes de pagar.');
        return;
      }

      const chkPolitica = document.getElementById('politica');
      if (chkPolitica && !chkPolitica.checked) {
        pagando = false;
        mostrarAlerta('Debes aceptar la política de privacidad para continuar.');
        chkPolitica.focus();
        return;
      }

      const form = document.getElementById('formulario');
      if (!validarFormulario(form)) {
        pagando = false;
        return;
      }

      const formData = new FormData(form);

      // ✅ RAW (los reales)
      const empresaRaw = (formData.get('empresa') || '').toString().trim();
      const correoRaw = (formData.get('correo') || '').toString().trim();
      const telefonoRaw = (formData.get('telefono') || '').toString().trim();
      const personaRaw = (formData.get('nombre') || '').toString().trim();

      const tipo = (tipoPersona?.value || '').toString().trim();
      const ubi = (ubicacion?.value || 'N/A').toString().trim();
      const vendedor = (inputVendedor?.value || idVendedor || 'sin_vendedor').toString().trim() || 'sin_vendedor';

      if (typeof CryptoJS === 'undefined' || !CryptoJS.MD5) {
        pagando = false;
        mostrarAlerta('No se pudo inicializar la librería de firma (CryptoJS). Revisa tu conexión.');
        return;
      }

      // ⚠️ En producción NO expongas apiKey en frontend. Para Sandbox está ok.
      const apiKey = '4Vj8eK4rloUd272L48hsrarnUA';
      const merchantId = '508029';
      const accountId = '512321';
      const currency = 'COP';

      const amount = Number(valor).toFixed(2);

      const referenceCode = `CJI_${Date.now()}_${vendedor}`;
      const rawSignature = `${apiKey}~${merchantId}~${referenceCode}~${amount}~${currency}`;
      const signature = CryptoJS.MD5(rawSignature).toString();

      const payuForm = document.getElementById('formPayu');
      if (!payuForm) {
        pagando = false;
        mostrarAlerta('Error interno: formulario de pago no disponible.');
        return;
      }

      payuForm.setAttribute('method', 'POST');
      payuForm.setAttribute('action', 'https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/');
      payuForm.setAttribute('target', '_top');

      // Campos PayU
      ensureHiddenInput(payuForm, 'merchantId').value = merchantId;
      ensureHiddenInput(payuForm, 'accountId').value = accountId;
      ensureHiddenInput(payuForm, 'description').value = 'Pago de formulario CJI';
      ensureHiddenInput(payuForm, 'referenceCode', 'referenceCode').value = referenceCode;
      ensureHiddenInput(payuForm, 'amount', 'amount').value = amount;
      ensureHiddenInput(payuForm, 'tax').value = '0';
      ensureHiddenInput(payuForm, 'taxReturnBase').value = '0';
      ensureHiddenInput(payuForm, 'currency').value = currency;
      ensureHiddenInput(payuForm, 'signature', 'signature').value = signature;
      ensureHiddenInput(payuForm, 'buyerEmail', 'buyerEmail').value = correoRaw;
      ensureHiddenInput(payuForm, 'test', 'test').value = '1';

      // ✅ extra1 = tipo
      ensureHiddenInput(payuForm, 'extra1', 'extra1').value = limit255(tipo);

      // ✅ extra2 = PAQUETE (esto sí llega a tu Apps Script)
      // u=ubicacion|v=vendedor|tel=telefono|emp=empresa
      const empVal = (tipo === 'empresa') ? empresaRaw : '';
      const extra2Pack = `u=${ubi}|v=${vendedor}|tel=${telefonoRaw}|emp=${empVal}`;
      ensureHiddenInput(payuForm, 'extra2', 'extra2').value = limit255(extra2Pack);

      // Limpieza extras dinámicos
      ['extra3', 'extra4', 'extra5'].forEach((name) => {
        payuForm.querySelectorAll(`input[name="${name}"]`).forEach((el) => el.remove());
      });

      // ✅ extra3 = NOMBRE (ya confirmado que llega)
      const ex3 = document.createElement('input');
      ex3.type = 'hidden';
      ex3.name = 'extra3';
      ex3.value = limit255(personaRaw);
      payuForm.appendChild(ex3);

      // (Opcional) Igual enviamos extra4/extra5 por si PayU los reenvía
      const ex4 = document.createElement('input');
      ex4.type = 'hidden';
      ex4.name = 'extra4';
      ex4.value = limit255(telefonoRaw);
      payuForm.appendChild(ex4);

      const ex5 = document.createElement('input');
      ex5.type = 'hidden';
      ex5.name = 'extra5';
      ex5.value = limit255(empVal);
      payuForm.appendChild(ex5);

      // URLs Apps Script
      const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbylET_BHHnE1xxLe8IxV0j1f4WCYXmXqxk7qkAiCqqr7dn7HIGoduYaRxYNkkyDJ3Ze/exec';

      // Solo vendedor + referencia
      const qs = `?vendedor=${encodeURIComponent(vendedor)}&ref=${encodeURIComponent(referenceCode)}`;

      ensureHiddenInput(payuForm, 'responseUrl', 'responseUrl').value = `${APPS_SCRIPT_URL}${qs}`;
      ensureHiddenInput(payuForm, 'confirmationUrl', 'confirmationUrl').value = `${APPS_SCRIPT_URL}${qs}`;

      btnPayu.disabled = true;
      payuForm.submit();

    } catch (err) {
      console.error('[PayU] Error en el envío:', err);
      pagando = false;
      btnPayu && (btnPayu.disabled = false);
      mostrarAlerta('Ocurrió un error al preparar el pago. Revisa la consola para más detalles.');
    }
  });
});
