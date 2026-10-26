/**
 * TotalBundle - Sticky Add to Cart
 * Handles scroll detection, variant synchronization, price formatting,
 * quantity adjustments, theme drawer integrations, and accessibility.
 */
(() => {
  // Prevent duplicate execution
  if (window.TotalBundleStickyCartLoaded) return;
  window.TotalBundleStickyCartLoaded = true;

  class TotalBundleStickyCart {
    constructor(element) {
      this.container = element;
      this.isUpdatingFromPeer = false;

      // Extract JSON product data safely
      const scriptData = this.container.querySelector('.tb-sticky-cart__product-json');
      if (scriptData) {
        try {
          this.productData = JSON.parse(scriptData.textContent || '{}');
        } catch (e) {
          console.warn('[TotalBundle] Error parsing product JSON', e);
          this.productData = { variants: [] };
        }
      } else {
        this.productData = { variants: [] };
      }

      // Cache DOM references
      this.productMediaImg = this.container.querySelector('.tb-sticky-cart__img');
      this.priceEl = this.container.querySelector('.tb-sticky-cart__price');
      this.comparePriceEl = this.container.querySelector('.tb-sticky-cart__compare-price');
      this.badgeEl = this.container.querySelector('.tb-sticky-cart__badge');
      this.variantSelect = this.container.querySelector('.tb-sticky-cart__variant-select');
      this.singleVariantInput = this.container.querySelector('.tb-sticky-cart__single-variant-id');
      this.qtyInput = this.container.querySelector('.tb-sticky-cart__qty-input');
      this.qtyMinusBtn = this.container.querySelector('.tb-sticky-cart__qty-btn--minus');
      this.qtyPlusBtn = this.container.querySelector('.tb-sticky-cart__qty-btn--plus');
      this.addBtn = this.container.querySelector('.tb-sticky-cart__add-btn');
      this.btnTextEl = this.container.querySelector('.tb-sticky-cart__btn-text');
      this.statusMsgEl = this.container.querySelector('.tb-sticky-cart__status-msg');

      // Configuration settings from attributes
      this.desktopVisibility = this.container.getAttribute('data-desktop-visibility') || 'scroll';
      this.buttonText = this.container.getAttribute('data-button-text') || 'Add to Cart';
      this.soldOutText = this.container.getAttribute('data-sold-out-text') || 'Sold Out';

      // Current active variant
      this.selectedVariantId =
        (this.variantSelect && this.variantSelect.value) ||
        (this.singleVariantInput && this.singleVariantInput.value) ||
        this.container.getAttribute('data-selected-variant-id');

      this.init();
    }

    init() {
      this.bindEvents();
      this.setupScrollObserver();
      this.syncFromMainForm();
    }

    bindEvents() {
      // 1. Variant Change in Sticky Bar
      if (this.variantSelect) {
        this.variantSelect.addEventListener('change', (e) => {
          this.onStickyVariantChange(e.target.value);
        });
      }

      // 2. Quantity Selector in Sticky Bar
      if (this.qtyMinusBtn && this.qtyInput) {
        this.qtyMinusBtn.addEventListener('click', () => {
          const current = parseInt(this.qtyInput.value, 10) || 1;
          const next = Math.max(1, current - 1);
          this.qtyInput.value = next;
          this.syncQuantityToMainForm(next);
        });
      }

      if (this.qtyPlusBtn && this.qtyInput) {
        this.qtyPlusBtn.addEventListener('click', () => {
          const current = parseInt(this.qtyInput.value, 10) || 1;
          const next = current + 1;
          this.qtyInput.value = next;
          this.syncQuantityToMainForm(next);
        });
      }

      if (this.qtyInput) {
        this.qtyInput.addEventListener('change', (e) => {
          let val = parseInt(e.target.value, 10);
          if (isNaN(val) || val < 1) val = 1;
          e.target.value = val;
          this.syncQuantityToMainForm(val);
        });
      }

      // 3. Add to Cart Button Click
      if (this.addBtn) {
        this.addBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleAddToCart();
        });
      }

      // 4. Synchronize from Main Product Form (Variant & Quantity changes)
      document.addEventListener('change', (e) => {
        if (this.isUpdatingFromPeer) return;
        const target = e.target;
        if (!target) return;

        // Check if change event came from product variant input
        if (
          target.name === 'id' ||
          (target.closest && target.closest('form[action*="/cart/add"]') && target.name === 'id')
        ) {
          this.onMainFormVariantChange(target.value);
        }

        // Check if change event came from product quantity input
        if (
          target.name === 'quantity' &&
          target.closest &&
          target.closest('form[action*="/cart/add"]')
        ) {
          const qty = parseInt(target.value, 10);
          if (!isNaN(qty) && this.qtyInput) {
            this.qtyInput.value = qty;
          }
        }
      });

      // 5. Support Custom Variant Change Events (Dawn, Prestige, Impulse, etc.)
      document.addEventListener('variant:change', (e) => {
        const variant = e.detail && (e.detail.variant || e.detail);
        if (variant && variant.id) {
          this.onMainFormVariantChange(variant.id);
        }
      });

      // URL search params change (popstate / history changes)
      window.addEventListener('popstate', () => {
        const params = new URLSearchParams(window.location.search);
        const variantParam = params.get('variant');
        if (variantParam) {
          this.onMainFormVariantChange(variantParam);
        }
      });
    }

    /**
     * Set up IntersectionObserver to toggle sticky bar visibility
     */
    setupScrollObserver() {
      if (this.desktopVisibility === 'always') {
        this.container.classList.remove('tb-sticky-cart--hidden');
        return;
      }

      // Find main product form or Add to Cart button
      const mainAddToCart =
        document.querySelector('form[action*="/cart/add"] [type="submit"]') ||
        document.querySelector('form[action*="/cart/add"] [name="add"]') ||
        document.querySelector('form[action*="/cart/add"]');

      if (!mainAddToCart || !('IntersectionObserver' in window)) {
        // Fallback: check window scroll position
        const checkScroll = () => {
          const scrollY = window.scrollY || window.pageYOffset;
          if (scrollY > 350) {
            this.container.classList.remove('tb-sticky-cart--hidden');
          } else {
            this.container.classList.add('tb-sticky-cart--hidden');
          }
        };
        window.addEventListener('scroll', checkScroll, { passive: true });
        checkScroll();
        return;
      }

      // Use IntersectionObserver
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            // When main Add to Cart is visible, hide sticky bar; when scrolled past, show it
            if (entry.isIntersecting) {
              this.container.classList.add('tb-sticky-cart--hidden');
            } else {
              // Only show if the user has scrolled past (down), not when at the very top
              const rect = entry.boundingClientRect;
              if (rect.top <= 0) {
                this.container.classList.remove('tb-sticky-cart--hidden');
              } else {
                this.container.classList.add('tb-sticky-cart--hidden');
              }
            }
          });
        },
        { threshold: 0.1 }
      );

      observer.observe(mainAddToCart);
    }

    /**
     * Handler when variant is changed inside Sticky Bar
     */
    onStickyVariantChange(variantId) {
      this.selectedVariantId = variantId;
      const variant = this.findVariant(variantId);
      if (!variant) return;

      this.updateDisplay(variant);
      this.syncVariantToMainForm(variantId);
    }

    /**
     * Handler when variant is changed in the main theme form
     */
    onMainFormVariantChange(variantId) {
      if (String(this.selectedVariantId) === String(variantId)) return;
      this.selectedVariantId = variantId;

      if (this.variantSelect) {
        this.variantSelect.value = variantId;
      }
      if (this.singleVariantInput) {
        this.singleVariantInput.value = variantId;
      }

      const variant = this.findVariant(variantId);
      if (variant) {
        this.updateDisplay(variant);
      }
    }

    /**
     * Update price, image, compare price, and availability
     */
    updateDisplay(variant) {
      // 1. Update Thumbnail Image
      if (this.productMediaImg && variant.featured_image) {
        this.productMediaImg.src = variant.featured_image;
        if (variant.title) {
          this.productMediaImg.alt = variant.title;
        }
      }

      // 2. Update Price
      if (this.priceEl) {
        this.priceEl.innerHTML = `
          <span class="visually-hidden">Sale price: </span>
          ${this.formatMoney(variant.price)}
        `;
      }

      // 3. Update Compare-At Price and Discount Badge
      if (this.comparePriceEl) {
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          this.comparePriceEl.style.display = '';
          this.comparePriceEl.innerHTML = `
            <span class="visually-hidden">Regular price: </span>
            ${this.formatMoney(variant.compare_at_price)}
          `;
          if (this.badgeEl) {
            const savings = Math.round(
              ((variant.compare_at_price - variant.price) * 100) / variant.compare_at_price
            );
            this.badgeEl.style.display = '';
            this.badgeEl.textContent = `Save ${savings}%`;
          }
        } else {
          this.comparePriceEl.style.display = 'none';
          if (this.badgeEl) {
            this.badgeEl.style.display = 'none';
          }
        }
      }

      // 4. Update Button Availability State
      if (this.addBtn && this.btnTextEl) {
        if (variant.available) {
          this.addBtn.disabled = false;
          this.addBtn.removeAttribute('aria-disabled');
          this.btnTextEl.textContent = this.buttonText;
        } else {
          this.addBtn.disabled = true;
          this.addBtn.setAttribute('aria-disabled', 'true');
          this.btnTextEl.textContent = this.soldOutText;
        }
      }
    }

    /**
     * Sync chosen variant back to the main product form
     */
    syncVariantToMainForm(variantId) {
      this.isUpdatingFromPeer = true;
      try {
        const mainForm = document.querySelector('form[action*="/cart/add"]');
        if (mainForm) {
          // Check standard select/input [name="id"]
          const idInput = mainForm.querySelector('[name="id"]');
          if (idInput) {
            idInput.value = variantId;
            idInput.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // Check radio buttons (e.g. dawn variant-radios)
          const radioInput = mainForm.querySelector(`input[type="radio"][value="${variantId}"]`);
          if (radioInput) {
            radioInput.checked = true;
            radioInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        // Update URL query parameter without page reload
        if (window.history && window.history.replaceState) {
          const url = new URL(window.location.href);
          url.searchParams.set('variant', variantId);
          window.history.replaceState({}, '', url.toString());
        }
      } finally {
        setTimeout(() => {
          this.isUpdatingFromPeer = false;
        }, 50);
      }
    }

    /**
     * Sync quantity to main theme form
     */
    syncQuantityToMainForm(qty) {
      const mainQty = document.querySelector('form[action*="/cart/add"] [name="quantity"]');
      if (mainQty) {
        mainQty.value = qty;
        mainQty.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    /**
     * Initial sync from main form
     */
    syncFromMainForm() {
      const mainIdInput = document.querySelector('form[action*="/cart/add"] [name="id"]');
      if (mainIdInput && mainIdInput.value) {
        this.onMainFormVariantChange(mainIdInput.value);
      }
    }

    /**
     * Submit Add to Cart using Shopify AJAX API
     */
    async handleAddToCart() {
      const variantId = this.selectedVariantId;
      const quantity = this.qtyInput ? parseInt(this.qtyInput.value, 10) || 1 : 1;

      if (!variantId) {
        console.error('[TotalBundle] No variant selected');
        return;
      }

      const variant = this.findVariant(variantId);
      if (variant && !variant.available) {
        return;
      }

      this.setLoading(true);
      this.announce('Adding to cart...');

      try {
        // Post to Shopify AJAX cart API
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            id: Number(variantId),
            quantity: Number(quantity),
          }),
        });

        const data = await response.json();

        if (response.ok) {
          this.onAddToCartSuccess(data);
        } else {
          this.onAddToCartError(data.description || data.message || 'Error adding to cart');
        }
      } catch (err) {
        this.onAddToCartError('Network error. Please try again.');
      } finally {
        this.setLoading(false);
      }
    }

    onAddToCartSuccess(itemData) {
      if (this.btnTextEl) {
        this.btnTextEl.textContent = 'Added to Cart!';
      }
      if (this.addBtn) {
        this.addBtn.classList.add('tb-sticky-cart__add-btn--success');
      }

      this.announce('Product added to cart successfully!');

      // Notify Theme and Drawers (Dawn, Prestige, Impulse, etc.)
      this.notifyThemeCartUpdated(itemData);

      // Revert button text after 2 seconds
      setTimeout(() => {
        if (this.btnTextEl) {
          this.btnTextEl.textContent = this.buttonText;
        }
        if (this.addBtn) {
          this.addBtn.classList.remove('tb-sticky-cart__add-btn--success');
        }
      }, 2000);
    }

    onAddToCartError(message) {
      console.warn('[TotalBundle] Add to cart error:', message);
      this.announce(message);
      if (this.btnTextEl) {
        this.btnTextEl.textContent = 'Sold Out or Limit Reached';
      }
      setTimeout(() => {
        if (this.btnTextEl) {
          this.btnTextEl.textContent = this.buttonText;
        }
      }, 3000);
    }

    /**
     * Dispatch standard cart events so theme drawer or cart count updates
     */
    notifyThemeCartUpdated(itemData) {
      // 1. Dispatch standard Shopify cart events
      document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true, detail: itemData }));
      document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));

      // 2. Dawn theme Cart Drawer integration
      const cartDrawer = document.querySelector('cart-drawer');
      const cartNotification = document.querySelector('cart-notification');

      if (cartDrawer && typeof cartDrawer.renderContents === 'function') {
        fetch(`${window.routes?.cart_url || '/cart'}?section_id=cart-drawer`)
          .then((res) => res.text())
          .then((text) => {
            const html = new DOMParser().parseFromString(text, 'text/html');
            const drawerContent = html.querySelector('#CartDrawer');
            if (drawerContent) {
              const currentContent = document.querySelector('#CartDrawer');
              if (currentContent) currentContent.innerHTML = drawerContent.innerHTML;
            }
            if (typeof cartDrawer.open === 'function') {
              cartDrawer.open();
            }
          })
          .catch(() => {});
      } else if (cartNotification && typeof cartNotification.renderContents === 'function') {
        cartNotification.renderContents(itemData);
      }
    }

    setLoading(isLoading) {
      if (!this.addBtn) return;
      if (isLoading) {
        this.addBtn.classList.add('tb-sticky-cart__add-btn--loading');
        this.addBtn.disabled = true;
      } else {
        this.addBtn.classList.remove('tb-sticky-cart__add-btn--loading');
        this.addBtn.disabled = false;
      }
    }

    announce(text) {
      if (this.statusMsgEl) {
        this.statusMsgEl.textContent = text;
      }
    }

    findVariant(id) {
      if (!this.productData || !this.productData.variants) return null;
      return this.productData.variants.find((v) => String(v.id) === String(id));
    }

    formatMoney(cents) {
      if (typeof cents !== 'number') cents = parseInt(cents, 10) || 0;
      const format = this.productData.moneyFormat || '${{amount}}';
      const amount = (cents / 100).toFixed(2);
      const amountNoDecimals = Math.round(cents / 100).toString();

      return format
        .replace('{{amount}}', amount)
        .replace('{{amount_no_decimals}}', amountNoDecimals)
        .replace('{{amount_with_comma_separator}}', amount.replace('.', ','))
        .replace('{{amount_no_decimals_with_comma_separator}}', amountNoDecimals);
    }
  }

  // Singleton DOM Initializer: ensures only ONE authoritative bar exists
  function initStickyCart() {
    const bars = document.querySelectorAll('#totalbundle-sticky-cart');
    if (!bars.length) return;

    // If multiple bars exist (e.g. from section re-renders), keep the last or embed one and remove others
    if (bars.length > 1) {
      for (let i = 0; i < bars.length - 1; i++) {
        bars[i].remove();
      }
    }

    const activeBar = document.querySelector('#totalbundle-sticky-cart');
    if (activeBar && !activeBar.dataset.initialized) {
      activeBar.dataset.initialized = 'true';
      new TotalBundleStickyCart(activeBar);
    }
  }

  // Listen on DOMContentLoaded & theme re-renders
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStickyCart);
  } else {
    initStickyCart();
  }

  // Handle Shopify theme section re-renders (Online Store 2.0 Theme Customizer & Section Rendering API)
  document.addEventListener('shopify:section:load', initStickyCart);
  document.addEventListener('shopify:section:reorder', initStickyCart);

  // Expose for automated testing environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TotalBundleStickyCart, initStickyCart };
  }
})();
