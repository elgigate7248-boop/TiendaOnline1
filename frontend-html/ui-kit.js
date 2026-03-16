;(function initUIKit(global) {
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message, type = 'info', options = {}) {
    const containerId = options.containerId || 'globalToastContainer';
    const durationMs = Number(options.durationMs) || 2600;
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2200;display:flex;flex-direction:column;gap:8px;max-width:360px;';
      document.body.appendChild(container);
    }

    const tone = type === 'success'
      ? { bg: '#198754', border: '#146c43' }
      : type === 'warning'
        ? { bg: '#ffc107', border: '#e6ac00', text: '#111' }
        : type === 'error'
          ? { bg: '#dc3545', border: '#b02a37' }
          : { bg: '#0d6efd', border: '#0a58ca' };

    const toast = document.createElement('div');
    toast.style.cssText = `background:${tone.bg};border:1px solid ${tone.border};color:${tone.text || '#fff'};padding:10px 12px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.2);font-size:14px;opacity:0;transform:translateY(-4px);transition:all .2s ease;`;
    toast.textContent = String(message || '');
    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-4px)';
      setTimeout(() => toast.remove(), 220);
    }, durationMs);
  }

  function renderImagePreview(previewContainer, imageUrl) {
    const preview = typeof previewContainer === 'string'
      ? document.getElementById(previewContainer)
      : previewContainer;
    if (!preview) return;
    if (!imageUrl) {
      preview.innerHTML = '';
      return;
    }
    preview.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="Vista previa" style="max-height:180px;max-width:100%;object-fit:contain;border-radius:8px;" onerror="this.outerHTML='<span class=\\'text-muted small\\'>No se pudo cargar la imagen</span>'">`;
  }

  function bindImageUploader(config) {
    const inputUrl = document.getElementById(config.inputUrlId);
    const inputFile = document.getElementById(config.inputFileId);
    const dropZone = config.dropZoneId ? document.getElementById(config.dropZoneId) : null;
    const maxSizeBytes = Number(config.maxSizeBytes) || 2 * 1024 * 1024;
    const onLoaded = typeof config.onLoaded === 'function' ? config.onLoaded : null;
    const onError = typeof config.onError === 'function' ? config.onError : null;
    const onInvalidType = typeof config.onInvalidType === 'function' ? config.onInvalidType : null;
    const onTooLarge = typeof config.onTooLarge === 'function' ? config.onTooLarge : null;

    if (!inputUrl || !inputFile) return;
    if (inputFile.dataset.bound === '1') return;
    inputFile.dataset.bound = '1';

    function notifyError(message, kind) {
      if (onError) onError(message, kind);
      else showToast(message, 'error');
    }

    function processFile(file) {
      if (!file) return;
      if (!String(file.type || '').startsWith('image/')) {
        if (onInvalidType) onInvalidType(file);
        else notifyError('El archivo seleccionado no es una imagen válida.', 'invalid_type');
        return;
      }
      if (file.size > maxSizeBytes) {
        if (onTooLarge) onTooLarge(file);
        else notifyError('La imagen supera el tamaño permitido.', 'too_large');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!dataUrl) return;
        inputUrl.value = dataUrl;
        if (onLoaded) onLoaded(dataUrl, file);
      };
      reader.onerror = () => notifyError('No se pudo leer la imagen seleccionada.', 'read_error');
      reader.readAsDataURL(file);
    }

    inputUrl.addEventListener('input', () => {
      if (onLoaded) onLoaded(inputUrl.value.trim() || '', null);
    });
    inputFile.addEventListener('change', () => {
      const file = inputFile.files && inputFile.files[0];
      processFile(file);
    });

    if (dropZone) {
      dropZone.addEventListener('click', () => inputFile.click());
      dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputFile.click();
        }
      });
      ['dragenter', 'dragover'].forEach((evt) => {
        dropZone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add('is-dragover');
        });
      });
      ['dragleave', 'drop'].forEach((evt) => {
        dropZone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove('is-dragover');
        });
      });
      dropZone.addEventListener('drop', (e) => {
        const file = e.dataTransfer?.files && e.dataTransfer.files[0];
        if (!file) return;
        processFile(file);
        try {
          const dt = new DataTransfer();
          dt.items.add(file);
          inputFile.files = dt.files;
        } catch {
          // Ignore assignment if browser blocks it.
        }
      });
    }
  }

  global.UIKit = {
    escapeHtml,
    showToast,
    renderImagePreview,
    bindImageUploader
  };
})(window);

