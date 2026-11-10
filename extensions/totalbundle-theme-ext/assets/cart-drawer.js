/**
 * TotalBundle Cart Drawer JavaScript
 * Slide-out Ajax cart with Free Shipping Bar, Product Add-on functionality,
 * and universal suppression of ALL native theme cart behaviors:
 * 1. "Page" mode (intercepts /cart redirect)
 * 2. "Drawer" mode (suppresses theme cart-drawer)
 * 3. "Popup notification" mode (suppresses cart-notification)
 * 4. Across Dawn and all Shopify OS 2.0 & vintage themes.
 */

(function () {
  'use strict';

  function formatMoney(cents) {
    if (typeof cents !== 'number') cents = parseInt(cents, 10) || 0;
    var dollars = (cents / 100).toFixed(2);
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      try {
        return window.Shopify.formatMoney(cents);
      } catch (e) {}
    }
    return '$' + dollars;
  }

  function TotalBundleCartDrawer() {
    // 1. DOM Deduplication: ensure only one drawer exists in the document
    var allDrawers = document.querySelectorAll('.tb-cart-drawer');
    if (allDrawers.length > 1) {
      for (var d = 1; d < allDrawers.length; d++) {
        allDrawers[d].remove();
      }
    }
    var allBackdrops = document.querySelectorAll('.tb-cart-drawer-backdrop');
    if (allBackdrops.length > 1) {
      for (var b = 1; b < allBackdrops.length; b++) {
        allBackdrops[b].remove();
      }
    }

    this.drawer = document.querySelector('.tb-cart-drawer');
    this.backdrop = document.querySelector('.tb-cart-drawer-backdrop');
    if (!this.drawer || !this.backdrop) return;

    this.threshold = parseFloat(this.drawer.dataset.freeShippingThreshold) || 50;
    this.shippingText = this.drawer.dataset.freeShippingText || 'Add {amount} more for FREE Shipping!';
    this.shippingSuccessText = this.drawer.dataset.freeShippingSuccessText || '🎉 You have unlocked Free Shipping!';

    this.itemsContainer = this.drawer.querySelector('.tb-cart-items-wrap');
    this.emptyContainer = this.drawer.querySelector('.tb-drawer-empty');
    this.footer = this.drawer.querySelector('.tb-drawer-footer');
    this.subtotalEl = this.drawer.querySelector('.tb-drawer-subtotal-val');
    this.countBadge = this.drawer.querySelector('.tb-drawer-item-count');
    this.shippingSection = this.drawer.querySelector('.tb-free-shipping-section');
    this.shippingTextEl = this.drawer.querySelector('.tb-free-shipping-text');
    this.shippingFillEl = this.drawer.querySelector('.tb-free-shipping-fill');
    this.noteTextarea = this.drawer.querySelector('.tb-drawer-note-textarea');
    this.noteToggle = this.drawer.querySelector('.tb-drawer-note-toggle');

    // Internal flags to prevent double-fire
    this._tbInternalCartOp = false; // true while WE are doing a cart op
    this._tbAddonAdding = false;    // true while addon add is in-flight

    // Run active suppression and setup interceptors
    this.suppressThemeDrawer();
    this.hijackThemeProductForms();
    this.initThemeInterceptors();
    this.initEvents();
    // Do NOT call this.refresh() here — interceptors will catch first open
  }

  /**
   * Completely suppress & close all native theme drawers, popups, and notifications
   * (e.g. Dawn, Prestige, Sense, Impulse, Debut, etc.)
   */
  TotalBundleCartDrawer.prototype.suppressThemeDrawer = function () {
    var themeElements = document.querySelectorAll(
      'cart-drawer, cart-notification, [data-cart-drawer]:not(.tb-cart-drawer), #CartDrawer, .cart-drawer:not(.tb-cart-drawer), .drawer--cart, #sidebar-cart, .ajaxcart__drawer, .mini-cart, .cart-popup-wrapper, #CartPopup, .cart-notification'
    );

    themeElements.forEach(function (el) {
      el.classList.remove('active', 'animate', 'is-open');
      if (el.hasAttribute('open')) el.removeAttribute('open');
      if (typeof el.close === 'function') {
        try { el.close(); } catch (e) {}
      }
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    });

    // Remove any theme backdrops or overlays
    var themeBackdrops = document.querySelectorAll(
      '.cart-drawer-backdrop, .drawer__backdrop, .modal__backdrop, .js-drawer-open-right'
    );
    themeBackdrops.forEach(function (bd) {
      if (!bd.classList.contains('tb-cart-drawer-backdrop')) {
        bd.classList.remove('is-active', 'active');
        bd.style.setProperty('display', 'none', 'important');
      }
    });

    // Reset overflow on document/body that themes lock
    document.documentElement.classList.remove('overflow-hidden');
    document.body.classList.remove('overflow-hidden');
  };

  /**
   * Critical: Hijack Dawn & OS 2.0 Product Forms
   * In Dawn, when Cart Type is "Page", product-form checks:
   * if (!this.cart) { window.location = window.routes.cart_url; return; }
   * We attach a proxy cart to EVERY product-form and its prototype so it NEVER redirects to /cart,
   * but opens our TotalBundle Cart Drawer instead!
   */
  TotalBundleCartDrawer.prototype.hijackThemeProductForms = function () {
    var self = this;

    var proxyCart = {
      renderContents: function () {
        self.suppressThemeDrawer();
        self.openAndRefresh();
      },
      open: function () {
        self.suppressThemeDrawer();
        self.openAndRefresh();
      },
      close: function () {},
      classList: {
        contains: function () { return false; },
        add: function () {},
        remove: function () {},
      },
    };

    function attachToForms() {
      // 1. Direct attachment to all product-form elements on the page
      var productForms = document.querySelectorAll('product-form');
      productForms.forEach(function (pf) {
        pf.cart = proxyCart;
      });

      // 2. Override on custom element prototype if available
      if (window.customElements) {
        try {
          var PFClass = customElements.get('product-form');
          if (PFClass && PFClass.prototype) {
            Object.defineProperty(PFClass.prototype, 'cart', {
              get: function () {
                return proxyCart;
              },
              set: function () {},
              configurable: true,
            });
          }
        } catch (e) {}

        // 3. Override cart-drawer and cart-notification elements
        try {
          var CDClass = customElements.get('cart-drawer');
          if (CDClass && CDClass.prototype) {
            CDClass.prototype.open = function () {
              self.suppressThemeDrawer();
              self.openAndRefresh();
            };
            CDClass.prototype.renderContents = function () {
              self.suppressThemeDrawer();
              self.openAndRefresh();
            };
          }
        } catch (e) {}

        try {
          var CNClass = customElements.get('cart-notification');
          if (CNClass && CNClass.prototype) {
            CNClass.prototype.open = function () {
              self.suppressThemeDrawer();
              self.openAndRefresh();
            };
            CNClass.prototype.renderContents = function () {
              self.suppressThemeDrawer();
              self.openAndRefresh();
            };
          }
        } catch (e) {}
      }
    }

    attachToForms();
    // Re-run periodically as dynamic sections or variants load
    setTimeout(attachToForms, 400);
    setTimeout(attachToForms, 1500);
  };

  /**
   * Setup active listeners, fetch monkey-patch, and MutationObserver
   */
  TotalBundleCartDrawer.prototype.initThemeInterceptors = function () {
    var self = this;

    // 1. MutationObserver to catch theme drawer or notification activations immediately
    if (window.MutationObserver) {
      var observer = new MutationObserver(function () {
        var activeThemes = document.querySelectorAll(
          'cart-drawer.active, cart-notification.active, [data-cart-drawer].active, cart-drawer[open], .cart-popup-wrapper.active, .cart-notification.active'
        );
        if (activeThemes.length > 0) {
          self.suppressThemeDrawer();
          if (!self.isOpen()) {
            self.openAndRefresh();
          }
        }
      });

      try {
        observer.observe(document.documentElement, {
          attributes: true,
          subtree: true,
          attributeFilter: ['class', 'open'],
        });
      } catch (obsErr) {}
    }

    // 2. Monkey-patch window.fetch for /cart/add and /cart/add.js ONLY
    // Skip if the request is our own internal cart op
    if (window.fetch) {
      var origFetch = window.fetch;
      window.fetch = function (resource, init) {
        var urlStr = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
        // Only intercept /cart/add — NOT /cart/add.js from our own addon btn, NOT /cart/change, NOT /cart.js
        var isExternalCartAdd = urlStr &&
          (urlStr.indexOf('/cart/add') !== -1 || urlStr.indexOf('/cart/add.js') !== -1) &&
          !self._tbInternalCartOp &&
          !self._tbAddonAdding;

        return origFetch.apply(this, arguments).then(function (response) {
          if (isExternalCartAdd && response.ok) {
            setTimeout(function () {
              self.suppressThemeDrawer();
              self.openAndRefresh();
            }, 60);
          }
          return response;
        });
      };
    }

    // 3. Monkey-patch XMLHttpRequest for /cart/add — but skip our own internal ops
    if (window.XMLHttpRequest) {
      var origOpen = XMLHttpRequest.prototype.open;
      var origSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function (method, url) {
        this._tbUrl = url;
        return origOpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function () {
        var xhr = this;
        if (xhr._tbUrl &&
            (xhr._tbUrl.indexOf('/cart/add') !== -1 || xhr._tbUrl.indexOf('/cart/add.js') !== -1) &&
            !self._tbInternalCartOp &&
            !self._tbAddonAdding) {
          xhr.addEventListener('load', function () {
            if (xhr.status >= 200 && xhr.status < 300) {
              setTimeout(function () {
                self.suppressThemeDrawer();
                self.openAndRefresh();
              }, 60);
            }
          });
        }
        return origSend.apply(this, arguments);
      };
    }

    // 4. jQuery AJAX listener for vintage or commercial themes
    if (window.jQuery) {
      try {
        window.jQuery(document).ajaxComplete(function (event, xhr, settings) {
          if (settings && settings.url && (settings.url.indexOf('/cart/add') !== -1 || settings.url.indexOf('/cart/add.js') !== -1)) {
            self.suppressThemeDrawer();
            self.openAndRefresh();
          }
        });
      } catch (jqErr) {}
    }
  };

  TotalBundleCartDrawer.prototype.initEvents = function () {
    var self = this;

    // Close button
    var closeBtn = this.drawer.querySelector('.tb-drawer-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        self.close();
      });
    }

    // Backdrop click
    this.backdrop.addEventListener('click', function () {
      self.close();
    });

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && self.isOpen()) {
        self.close();
      }
    });

    // Note toggle
    if (this.noteToggle && this.noteTextarea) {
      this.noteToggle.addEventListener('click', function () {
        var isHidden = self.noteTextarea.style.display === 'none';
        self.noteTextarea.style.display = isHidden ? 'block' : 'none';
        if (isHidden) self.noteTextarea.focus();
      });

      var noteDebounce = null;
      this.noteTextarea.addEventListener('input', function () {
        clearTimeout(noteDebounce);
        noteDebounce = setTimeout(function () {
          self.updateNote(self.noteTextarea.value);
        }, 600);
      });
    }

    // Capture-phase click interceptor on cart links & icons
    document.addEventListener(
      'click',
      function (e) {
        var target = e.target.closest(
          'a[href$="/cart"], a[href*="/cart?"], a[href*="/cart#"], #cart-icon-bubble, .header__icon--cart, [data-cart-drawer-trigger], .js-drawer-open-cart, .cart-icon-bubble, [data-ajax-cart-trigger], .cart-link'
        );
        if (target && !target.closest('.tb-cart-drawer') && !e.defaultPrevented) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation(); // Stops theme listener from running
          self.suppressThemeDrawer();
          self.openAndRefresh();
        }
      },
      true // Capture phase
    );

    // Capture-phase form submit interceptor for Add to Cart
    document.addEventListener(
      'submit',
      function (e) {
        var form = e.target;
        if (form && form.action && form.action.indexOf('/cart/add') !== -1) {
          // If theme form is standard submit (Page mode), intercept and Ajax add
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          var formData = new FormData(form);
          fetch('/cart/add.js', {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' },
          })
            .then(function (res) { return res.json(); })
            .then(function () {
              self.suppressThemeDrawer();
              self.openAndRefresh();
            })
            .catch(function () {
              self.suppressThemeDrawer();
              self.openAndRefresh();
            });
        }
      },
      true // Capture phase
    );

    // Addon button clicks (Event delegation)
    this.drawer.addEventListener('click', function (e) {
      var addonBtn = e.target.closest('.tb-addon-add-btn');
      if (addonBtn) {
        e.preventDefault();
        var variantId = addonBtn.dataset.variantId;
        var customTitle = addonBtn.dataset.title;
        var customPrice = addonBtn.dataset.price;
        self.handleAddon(addonBtn, variantId, customTitle, customPrice);
        return;
      }

      // Quantity buttons
      var qtyBtn = e.target.closest('.tb-qty-stepper button');
      if (qtyBtn) {
        e.preventDefault();
        var itemEl = qtyBtn.closest('.tb-cart-item');
        if (!itemEl) return;
        var lineIndex = parseInt(itemEl.dataset.itemIndex, 10); // 1-based line index
        var input = itemEl.querySelector('.tb-qty-input');
        var currentQty = parseInt(input.value, 10) || 1;
        var action = qtyBtn.dataset.action;
        var newQty = action === 'plus' ? currentQty + 1 : currentQty - 1;

        if (newQty <= 0) {
          self.updateItem(lineIndex, 0);
        } else {
          self.updateItem(lineIndex, newQty);
        }
        return;
      }

      // Remove button
      var removeBtn = e.target.closest('.tb-cart-item-remove');
      if (removeBtn) {
        e.preventDefault();
        var itemWrap = removeBtn.closest('.tb-cart-item');
        if (!itemWrap) return;
        var lineIdx = parseInt(itemWrap.dataset.itemIndex, 10); // 1-based line index
        self.updateItem(lineIdx, 0);
        return;
      }
    });

    // Global custom events
    window.addEventListener('totalbundle:open-cart-drawer', function () {
      self.suppressThemeDrawer();
      self.openAndRefresh();
    });

    window.addEventListener('totalbundle:close-cart-drawer', function () {
      self.close();
    });

    // Custom standard shopify events
    document.addEventListener('cart:updated', function () {
      self.suppressThemeDrawer();
    });
  };

  TotalBundleCartDrawer.prototype.isOpen = function () {
    return this.drawer.classList.contains('tb-open');
  };

  TotalBundleCartDrawer.prototype.open = function () {
    this.suppressThemeDrawer();
    this.drawer.classList.add('tb-open');
    this.backdrop.classList.add('tb-open');
    document.body.style.overflow = 'hidden';
  };

  TotalBundleCartDrawer.prototype.close = function () {
    this.drawer.classList.remove('tb-open');
    this.backdrop.classList.remove('tb-open');
    document.body.style.overflow = '';
  };

  TotalBundleCartDrawer.prototype.openAndRefresh = function () {
    this.open();
    this.refresh();
  };

  TotalBundleCartDrawer.prototype.refresh = function () {
    var self = this;
    // Build cart URL — use Shopify.routes.root for multi-currency compatibility
    var cartUrl = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root
      ? window.Shopify.routes.root + 'cart.js'
      : '/cart.js') + '?_tb=' + Date.now();

    // Mark as internal so the fetch monkey-patch won't re-trigger openAndRefresh
    self._tbInternalCartOp = true;
    fetch(cartUrl, { headers: { 'Accept': 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        self._tbInternalCartOp = false;
        self.renderCart(cart);
      })
      .catch(function (err) {
        self._tbInternalCartOp = false;
        console.warn('[TotalBundle] Failed to fetch cart:', err);
      });
  };

  TotalBundleCartDrawer.prototype.updateItem = function (lineIndex, quantity) {
    var self = this;
    // Use 'line' (1-based index) NOT 'id' (variant id) so we target the EXACT line item,
    // not ALL items with the same variant.
    self._tbInternalCartOp = true;
    fetch('/cart/change.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        line: parseInt(lineIndex, 10),
        quantity: quantity,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        self._tbInternalCartOp = false;
        self.renderCart(cart);
      })
      .catch(function (err) {
        self._tbInternalCartOp = false;
        console.error('[TotalBundle] Failed to update item:', err);
      });
  };

  TotalBundleCartDrawer.prototype.handleAddon = function (button, variantId, customTitle, customPrice) {
    var self = this;
    // Prevent double-click / double-add
    if (button.classList.contains('tb-loading')) return;

    button.classList.add('tb-loading');
    var originalText = button.textContent;
    button.textContent = '...';

    var payload;
    if (variantId) {
      payload = { id: variantId, quantity: 1 };
    } else {
      payload = {
        items: [
          {
            id: variantId || (window.Shopify && window.Shopify.defaultVariantId),
            quantity: 1,
            properties: {
              '_addon': 'true',
              'Item': customTitle || 'Add-on Item',
            },
          },
        ],
      };
    }

    var addUrl = window.Shopify && window.Shopify.routes && window.Shopify.routes.root
      ? window.Shopify.routes.root + 'cart/add.js'
      : '/cart/add.js';

    // Set flag so fetch monkey-patch skips this internal add request
    self._tbAddonAdding = true;
    self._tbInternalCartOp = true;

    fetch(addUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        self._tbAddonAdding = false;
        self._tbInternalCartOp = false;
        if (!res.ok) {
          return res.json().then(function (err) { throw err; });
        }
        return res.json();
      })
      .then(function () {
        button.classList.remove('tb-loading');
        button.textContent = '✓ Added';
        setTimeout(function () {
          button.textContent = originalText;
        }, 1500);
        // Refresh cart display once — no second trigger from monkey-patch
        self.refresh();
      })
      .catch(function (err) {
        self._tbAddonAdding = false;
        self._tbInternalCartOp = false;
        button.classList.remove('tb-loading');
        button.textContent = originalText;
        console.warn('[TotalBundle] Addon add error:', err);
        self.refresh();
      });
  };

  TotalBundleCartDrawer.prototype.updateNote = function (note) {
    fetch('/cart/update.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ note: note }),
    });
  };

  TotalBundleCartDrawer.prototype.renderCart = function (cart) {
    if (!cart) return;

    // Update count badge
    if (this.countBadge) {
      this.countBadge.textContent = cart.item_count || 0;
    }

    // Sync theme badges
    var themeBadges = document.querySelectorAll('[data-cart-count], .cart-count-bubble span');
    themeBadges.forEach(function (el) {
      el.textContent = cart.item_count || 0;
    });

    // Update Subtotal
    if (this.subtotalEl) {
      this.subtotalEl.textContent = formatMoney(cart.total_price);
    }

    // Free Shipping Bar Calculation
    this.updateFreeShippingBar(cart.total_price);

    // Empty state vs Filled state
    if (!cart.items || cart.items.length === 0) {
      if (this.emptyContainer) this.emptyContainer.style.display = 'flex';
      if (this.itemsContainer) this.itemsContainer.style.display = 'none';
      if (this.footer) this.footer.style.display = 'none';
      return;
    }

    if (this.emptyContainer) this.emptyContainer.style.display = 'none';
    if (this.itemsContainer) this.itemsContainer.style.display = 'block';
    if (this.footer) this.footer.style.display = 'flex';

    // Render Items
    var itemsList = this.drawer.querySelector('.tb-cart-items');
    if (itemsList) {
      var html = '';
      for (var i = 0; i < cart.items.length; i++) {
        var item = cart.items[i];
        var imageSrc = item.image || item.featured_image ? (item.image || item.featured_image.url) : '';
        if (imageSrc && imageSrc.indexOf('?') === -1) imageSrc += '?width=140';

        var variantText = item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title : '';

        html += '<li class="tb-cart-item" data-item-key="' + (item.key || item.id) + '" data-item-index="' + (i + 1) + '">';
        if (imageSrc) {
          html += '<img class="tb-cart-item-image" src="' + imageSrc + '" alt="' + (item.title || '') + '" loading="lazy" />';
        }
        html += '<div class="tb-cart-item-info">';
        html += '<a href="' + item.url + '" class="tb-cart-item-title">' + item.product_title + '</a>';
        if (variantText) {
          html += '<span class="tb-cart-item-variant">' + variantText + '</span>';
        }
        html += '<div class="tb-cart-item-price-wrap">';
        html += '<span class="tb-cart-item-price">' + formatMoney(item.final_line_price) + '</span>';
        if (item.original_line_price > item.final_line_price) {
          html += '<span class="tb-cart-item-compare-price">' + formatMoney(item.original_line_price) + '</span>';
        }
        html += '</div>';

        html += '<div class="tb-cart-item-actions">';
        html += '<div class="tb-qty-stepper">';
        html += '<button type="button" data-action="minus" aria-label="Decrease quantity">−</button>';
        html += '<input type="number" class="tb-qty-input" value="' + item.quantity + '" min="1" readonly />';
        html += '<button type="button" data-action="plus" aria-label="Increase quantity">+</button>';
        html += '</div>';

        html += '<button type="button" class="tb-cart-item-remove" aria-label="Remove item">Remove</button>';
        html += '</div>';

        html += '</div>';
        html += '</li>';
      }
      itemsList.innerHTML = html;
    }
  };

  TotalBundleCartDrawer.prototype.updateFreeShippingBar = function (totalPriceCents) {
    // Re-query in case DOM was updated after init (drawer rendered async)
    if (!this.shippingSection) this.shippingSection = this.drawer.querySelector('.tb-free-shipping-section');
    if (!this.shippingFillEl) this.shippingFillEl = this.drawer.querySelector('.tb-free-shipping-fill');
    if (!this.shippingTextEl) this.shippingTextEl = this.drawer.querySelector('.tb-free-shipping-text');

    if (!this.shippingSection || !this.shippingFillEl || !this.shippingTextEl) return;

    var thresholdCents = this.threshold * 100;
    if (thresholdCents <= 0) thresholdCents = 5000;

    var priceCents = typeof totalPriceCents === 'number' ? totalPriceCents : parseInt(totalPriceCents, 10) || 0;
    var percentage = Math.min(100, Math.max(0, Math.round((priceCents / thresholdCents) * 100)));

    // Animate fill bar width from 0% up to 100% complete
    this.shippingFillEl.style.width = percentage + '%';

    if (percentage >= 100) {
      this.shippingFillEl.classList.add('tb-complete');
      this.shippingSection.classList.add('tb-is-complete');
      this.shippingTextEl.innerHTML = this.shippingSuccessText;
    } else {
      this.shippingFillEl.classList.remove('tb-complete');
      this.shippingSection.classList.remove('tb-is-complete');
      var remainingCents = Math.max(0, thresholdCents - priceCents);
      var remainingFormatted = formatMoney(remainingCents);
      var msg = this.shippingText.replace(/\{?\s*\{?\s*amount\s*\}?\s*\}?/gi, '<strong>' + remainingFormatted + '</strong>');
      this.shippingTextEl.innerHTML = msg;
    }
  };

  // Auto initialize
  function initTotalBundleDrawer() {
    window.totalBundleCartDrawer = new TotalBundleCartDrawer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTotalBundleDrawer);
  } else {
    initTotalBundleDrawer();
  }
})();
