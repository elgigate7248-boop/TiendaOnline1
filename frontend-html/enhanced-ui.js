// Enhanced UI/UX JavaScript - Tienda Online

class EnhancedUI {
  constructor() {
    this.init();
  }

  init() {
    this.setupSmoothScrolling();
    this.setupLazyLoading();
    this.setupSearchEnhancements();
    this.setupCartDropdown();
    this.setupProductAnimations();
    this.setupScrollEffects();
    this.setupFormEnhancements();
    this.setupTooltips();
    this.setupNotifications();
    this.setupProgressIndicators();
  }

  // Smooth Scrolling
  setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  // Lazy Loading for Images
  setupLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          img.classList.add('loaded');
          observer.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  }

  // Enhanced Search Functionality
  setupSearchEnhancements() {
    const searchInput = document.querySelector('.search-input');
    const searchResults = document.querySelector('.search-results');
    
    if (!searchInput) return;

    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      
      if (query.length < 2) {
        searchResults?.classList.remove('show');
        return;
      }

      searchTimeout = setTimeout(() => {
        this.performSearch(query);
      }, 300);
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        searchResults?.classList.remove('show');
      }
    });
  }

  async performSearch(query) {
    try {
      const response = await fetch(`/producto/search?q=${encodeURIComponent(query)}`);
      const results = await response.json();
      
      this.displaySearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    }
  }

  displaySearchResults(results) {
    const searchResults = document.querySelector('.search-results');
    if (!searchResults) return;

    if (results.length === 0) {
      searchResults.innerHTML = `
        <div class="search-result-item">
          <div class="text-muted">No se encontraron resultados</div>
        </div>
      `;
    } else {
      searchResults.innerHTML = results.map(product => `
        <div class="search-result-item" onclick="window.location.href='detalle-producto.html?id=${product.id_producto}'">
          <div class="d-flex align-items-center gap-3">
            <img src="${product.imagen || 'https://picsum.photos/seed/' + product.id_producto + '/48/48.jpg'}" 
                 alt="${product.nombre}" class="rounded" style="width: 48px; height: 48px; object-fit: cover;">
            <div>
              <div class="fw-semibold">${product.nombre}</div>
              <div class="text-muted small">$${Number(product.precio).toLocaleString()}</div>
            </div>
          </div>
        </div>
      `).join('');
    }

    searchResults.classList.add('show');
  }

  // Enhanced Cart Dropdown
  setupCartDropdown() {
    const cartWidget = document.querySelector('.cart-widget');
    const cartDropdown = document.querySelector('.cart-dropdown');
    
    if (!cartWidget || !cartDropdown) return;

    cartWidget.addEventListener('click', (e) => {
      e.stopPropagation();
      cartDropdown.classList.toggle('show');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.cart-widget')) {
        cartDropdown.classList.remove('show');
      }
    });
  }

  // Product Animations
  setupProductAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const animationObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          animationObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);

    document.querySelectorAll('.product-card, .category-card').forEach(card => {
      animationObserver.observe(card);
    });
  }

  // Scroll Effects
  setupScrollEffects() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    let lastScrollTop = 0;
    
    window.addEventListener('scroll', () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      if (scrollTop > 100) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }

      lastScrollTop = scrollTop;
    });
  }

  // Form Enhancements
  setupFormEnhancements() {
    // Floating labels
    document.querySelectorAll('.form-control').forEach(input => {
      const label = input.previousElementSibling;
      if (label && label.tagName === 'LABEL') {
        input.addEventListener('focus', () => {
          label.classList.add('focused');
        });
        
        input.addEventListener('blur', () => {
          if (!input.value) {
            label.classList.remove('focused');
          }
        });

        // Check initial state
        if (input.value) {
          label.classList.add('focused');
        }
      }
    });

    // Real-time validation
    document.querySelectorAll('.form-control').forEach(input => {
      input.addEventListener('input', () => {
        this.validateField(input);
      });
    });

    // Password strength indicator
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => {
      input.addEventListener('input', () => {
        this.updatePasswordStrength(input);
      });
    });
  }

  validateField(field) {
    const value = field.value.trim();
    const isValid = this.checkFieldValidity(field, value);
    
    field.classList.remove('is-valid', 'is-invalid');
    
    if (value) {
      field.classList.add(isValid ? 'is-valid' : 'is-invalid');
    }

    return isValid;
  }

  checkFieldValidity(field, value) {
    const type = field.type;
    const required = field.required;
    
    if (required && !value) return false;
    
    switch (type) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'tel':
        return /^\d{10}$/.test(value.replace(/\D/g, ''));
      case 'password':
        return value.length >= 8;
      default:
        return value.length > 0;
    }
  }

  updatePasswordStrength(passwordInput) {
    const value = passwordInput.value;
    const strengthIndicator = passwordInput.parentNode.querySelector('.password-strength');
    
    if (!strengthIndicator) return;

    let strength = 0;
    const checks = {
      length: value.length >= 8,
      lowercase: /[a-z]/.test(value),
      uppercase: /[A-Z]/.test(value),
      numbers: /\d/.test(value),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(value)
    };

    strength = Object.values(checks).filter(Boolean).length;

    strengthIndicator.className = 'password-strength';
    
    if (strength <= 2) {
      strengthIndicator.classList.add('weak');
      strengthIndicator.textContent = 'Débil';
    } else if (strength <= 4) {
      strengthIndicator.classList.add('medium');
      strengthIndicator.textContent = 'Media';
    } else {
      strengthIndicator.classList.add('strong');
      strengthIndicator.textContent = 'Fuerte';
    }
  }

  // Tooltips
  setupTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(element => {
      element.addEventListener('mouseenter', (e) => {
        this.showTooltip(e.target);
      });
      
      element.addEventListener('mouseleave', (e) => {
        this.hideTooltip(e.target);
      });
    });
  }

  showTooltip(element) {
    const text = element.dataset.tooltip;
    if (!text) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
    
    setTimeout(() => tooltip.classList.add('show'), 10);
  }

  hideTooltip(element) {
    const tooltip = document.querySelector('.custom-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  // Notification System
  setupNotifications() {
    // Create notification container
    if (!document.getElementById('notification-container')) {
      const container = document.createElement('div');
      container.id = 'notification-container';
      container.className = 'notification-container';
      document.body.appendChild(container);
    }
  }

  showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    container.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto remove
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  // Progress Indicators
  setupProgressIndicators() {
    // Reading progress bar
    this.createReadingProgress();
    
    // Loading states
    this.setupLoadingStates();
  }

  createReadingProgress() {
    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.innerHTML = '<div class="reading-progress-bar"></div>';
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      
      progressBar.querySelector('.reading-progress-bar').style.width = scrolled + '%';
    });
  }

  setupLoadingStates() {
    // Add loading states to buttons
    document.querySelectorAll('.btn').forEach(button => {
      button.addEventListener('click', () => {
        if (button.dataset.loading !== 'false') {
          this.setButtonLoading(button, true);
        }
      });
    });
  }

  setButtonLoading(button, loading) {
    if (loading) {
      button.dataset.originalText = button.textContent;
      button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cargando...';
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText;
      button.disabled = false;
      delete button.dataset.originalText;
    }
  }

  // Utility Methods
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Animation Helpers
  animateElement(element, animation, duration = 600) {
    element.style.animation = `${animation} ${duration}ms ease`;
    
    return new Promise(resolve => {
      element.addEventListener('animationend', () => {
        element.style.animation = '';
        resolve();
      }, { once: true });
    });
  }

  // Local Storage Helpers
  saveToLocalStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }

  getFromLocalStorage(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  }

  // Performance Monitoring
  measurePerformance(name, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    console.log(`${name} took ${(end - start).toFixed(2)} milliseconds`);
    return result;
  }

  // Accessibility Helpers
  announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => announcement.remove(), 1000);
  }

  // Theme Management
  toggleTheme() {
    const body = document.body;
    const currentTheme = body.dataset.theme || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    body.dataset.theme = newTheme;
    this.saveToLocalStorage('theme', newTheme);
    
    this.announceToScreenReader(`Tema cambiado a ${newTheme === 'light' ? 'claro' : 'oscuro'}`);
  }

  loadTheme() {
    const savedTheme = this.getFromLocalStorage('theme', 'light');
    document.body.dataset.theme = savedTheme;
  }
}

// Initialize Enhanced UI
const enhancedUI = new EnhancedUI();

// Global functions for backward compatibility
window.showNotification = (message, type, duration) => enhancedUI.showNotification(message, type, duration);
window.setButtonLoading = (button, loading) => enhancedUI.setButtonLoading(button, loading);

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  enhancedUI.loadTheme();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedUI;
}
