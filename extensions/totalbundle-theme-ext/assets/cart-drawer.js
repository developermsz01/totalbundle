/**
 * TotalBundle Cart Drawer JavaScript
 * Slide-out Ajax cart with Free Shipping Bar & Product Addon functionality.
 */

(function () {
  'use strict';

  function formatMoney(cents) {
    if (typeof cents !== 'number') cents = parseInt(cents, 10) || 0;
    var dollars = (cents / 100).toFixed(2);
    // Use Shopify window format if available
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      try {
        return window.Shopify.formatMoney(cents);
      } catch (e) {}
    }
    return '$' + dollars;
  }

  function TotalBundleCartDrawer() {
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

    this.initEvents();
  }

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

    // Intercept clicks on cart links
    document.addEventListener('click', function (e) {
      var target = e.target.closest('a[href="/cart"], a[href^="/cart?"], [data-cart-drawer-trigger], .js-drawer-open-cart, .cart-icon-bubble');
      if (target && !e.defaultPrevented) {
        e.preventDefault();
        self.openAndRefresh();
      }
    });

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
        var lineKey = itemEl.dataset.itemKey;
        var lineIndex = itemEl.dataset.itemIndex;
        var input = itemEl.querySelector('.tb-qty-input');
        var currentQty = parseInt(input.value, 10) || 1;
        var action = qtyBtn.dataset.action;
        var newQty = action === 'plus' ? currentQty + 1 : currentQty - 1;

        if (newQty <= 0) {
          self.updateItem(lineKey || lineIndex, 0);
        } else {
          self.updateItem(lineKey || lineIndex, newQty);
        }
        return;
      }

      // Remove button
      var removeBtn = e.target.closest('.tb-cart-item-remove');
      if (removeBtn) {
        e.preventDefault();
        var itemWrap = removeBtn.closest('.tb-cart-item');
        if (!itemWrap) return;
        var key = itemWrap.dataset.itemKey || itemWrap.dataset.itemIndex;
        self.updateItem(key, 0);
        return;
      }
    });

    // Global custom events
    window.addEventListener('totalbundle:open-cart-drawer', function () {
      self.openAndRefresh();
    });

    window.addEventListener('totalbundle:close-cart-drawer', function () {
      self.close();
    });

    // Intercept AJAX form add-to-cart across themes
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (form && form.action && form.action.indexOf('/cart/add') !== -1) {
        // If form doesn't prevent default, listen for fetch or open after slight delay
        setTimeout(function () {
          self.openAndRefresh();
        }, 500);
      }
    });
  };

  TotalBundleCartDrawer.prototype.isOpen = function () {
    return this.drawer.classList.contains('tb-open');
  };

  TotalBundleCartDrawer.prototype.open = function () {
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
    fetch('/cart.js', { headers: { 'Accept': 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        self.renderCart(cart);
      })
      .catch(function (err) {
        console.warn('[TotalBundle] Failed to fetch cart:', err);
      });
  };

  TotalBundleCartDrawer.prototype.updateItem = function (idOrKey, quantity) {
    var self = this;
    fetch('/cart/change.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        id: idOrKey,
        quantity: quantity,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        self.renderCart(cart);
      })
      .catch(function (err) {
        console.error('[TotalBundle] Failed to update item:', err);
      });
  };

  TotalBundleCartDrawer.prototype.handleAddon = function (button, variantId, customTitle, customPrice) {
    var self = this;
    button.classList.add('tb-loading');
    var originalText = button.textContent;
    button.textContent = '...';

    var payload;
    if (variantId) {
      payload = { id: variantId, quantity: 1 };
    } else {
      // If variantId is not set, add as custom line item or first available
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

    fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then(function (res) { return res.json(); })
      .then(function () {
        button.classList.remove('tb-loading');
        button.textContent = '✓ Added';
        setTimeout(function () {
          button.textContent = originalText;
        }, 1500);
        self.refresh();
      })
      .catch(function () {
        button.classList.remove('tb-loading');
        button.textContent = originalText;
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
    if (!this.shippingSection || !this.shippingFillEl || !this.shippingTextEl) return;

    var thresholdCents = this.threshold * 100;
    var percentage = Math.min(100, Math.max(0, Math.round((totalPriceCents / thresholdCents) * 100)));

    this.shippingFillEl.style.width = percentage + '%';

    if (percentage >= 100) {
      this.shippingFillEl.classList.add('tb-complete');
      this.shippingTextEl.innerHTML = this.shippingSuccessText;
    } else {
      this.shippingFillEl.classList.remove('tb-complete');
      var remainingCents = thresholdCents - totalPriceCents;
      var remainingFormatted = formatMoney(remainingCents);
      var msg = this.shippingText.replace('{amount}', '<strong>' + remainingFormatted + '</strong>');
      this.shippingTextEl.innerHTML = msg;
    }
  };

  // Auto initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.totalBundleCartDrawer = new TotalBundleCartDrawer();
    });
  } else {
    window.totalBundleCartDrawer = new TotalBundleCartDrawer();
  }
})();

