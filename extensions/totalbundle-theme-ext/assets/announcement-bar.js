/**
 * TotalBundle Announcement Bar JavaScript
 * Manages multi-mode announcement bars:
 * - Continuous Marquee Scrolling Ticker  (mode="marquee")
 * - Centered One-by-One Rotating Slides (mode="rotating")
 * - Static Centered                     (mode="static")
 *
 * The HTML is fully rendered by Liquid (server-side) based on saved metafields.
 * This JS file ONLY handles:
 *   1. Hoisting the bar to the top of <body>
 *   2. Hiding the theme's native announcement bar
 *   3. Rotating slides timer + prev/next arrows (rotating mode)
 *   4. Close / dismiss button
 *   5. Pause-on-hover for marquee
 *   6. Fetching live settings for enable/disable toggle ONLY (no HTML replacement)
 */

(function () {
  'use strict';

  function TotalBundleAnnouncementBar() {
    // 1. DOM Deduplication - keep only the first bar
    var allBars = document.querySelectorAll('.tb-announcement-bar');
    if (allBars.length > 1) {
      for (var i = 1; i < allBars.length; i++) {
        allBars[i].remove();
      }
    }

    this.bar = document.querySelector('.tb-announcement-bar');
    if (!this.bar) return;

    // Immediately hoist bar to top of body & suppress theme bar
    this.mountAtTop();

    // Check if user dismissed this session
    try {
      if (sessionStorage.getItem('tb_announcement_dismissed') === 'true') {
        this.bar.style.display = 'none';
        return;
      }
    } catch (e) {}

    // Read mode from Liquid-rendered data attribute (source of truth)
    this.mode = this.bar.dataset.mode || 'rotating';
    this.intervalSeconds = parseFloat(this.bar.dataset.rotationInterval) || 4;
    this.timer = null;
    this.currentIndex = 0;

    // Rotating mode: wire up slides and arrows
    this.slides = Array.prototype.slice.call(this.bar.querySelectorAll('.tb-rotating-slide'));
    this.prevBtn = this.bar.querySelector('.tb-rotator-prev');
    this.nextBtn = this.bar.querySelector('.tb-rotator-next');
    this.closeBtn = this.bar.querySelector('.tb-announcement-close');

    this.initEvents();

    if (this.mode === 'rotating' && this.slides.length > 1) {
      this.startRotation();
    }

    // Check enable/disable state from API (no HTML clobbering)
    this.fetchLiveSettings();
  }

  TotalBundleAnnouncementBar.prototype.initEvents = function () {
    var self = this;

    // Dismiss button
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        self.bar.style.display = 'none';
        self.stopRotation();
        try {
          sessionStorage.setItem('tb_announcement_dismissed', 'true');
        } catch (err) {}
      });
    }

    // Previous / Next buttons for rotating mode
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', function (e) {
        e.preventDefault();
        self.prevSlide();
      });
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', function (e) {
        e.preventDefault();
        self.nextSlide();
      });
    }

    // Pause marquee on hover
    if (this.mode === 'marquee' && this.bar.classList.contains('tb-pause-hover')) {
      var marqueeContents = this.bar.querySelectorAll('.tb-marquee-content');
      this.bar.addEventListener('mouseenter', function () {
        for (var i = 0; i < marqueeContents.length; i++) {
          marqueeContents[i].style.animationPlayState = 'paused';
        }
      });
      this.bar.addEventListener('mouseleave', function () {
        for (var i = 0; i < marqueeContents.length; i++) {
          marqueeContents[i].style.animationPlayState = 'running';
        }
      });
    }

    // Pause rotating on hover
    if (this.mode === 'rotating' && this.bar.classList.contains('tb-pause-hover')) {
      this.bar.addEventListener('mouseenter', function () {
        self.stopRotation();
      });
      this.bar.addEventListener('mouseleave', function () {
        if (self.slides.length > 1) {
          self.startRotation();
        }
      });
    }
  };

  TotalBundleAnnouncementBar.prototype.goToSlide = function (index) {
    if (!this.slides || this.slides.length === 0) return;
    if (index >= this.slides.length) index = 0;
    if (index < 0) index = this.slides.length - 1;
    for (var i = 0; i < this.slides.length; i++) {
      if (i === index) {
        this.slides[i].classList.add('tb-active');
      } else {
        this.slides[i].classList.remove('tb-active');
      }
    }
    this.currentIndex = index;
  };

  TotalBundleAnnouncementBar.prototype.nextSlide = function () {
    this.goToSlide(this.currentIndex + 1);
  };

  TotalBundleAnnouncementBar.prototype.prevSlide = function () {
    this.goToSlide(this.currentIndex - 1);
  };

  TotalBundleAnnouncementBar.prototype.startRotation = function () {
    this.stopRotation();
    var self = this;
    var ms = Math.max(2000, self.intervalSeconds * 1000);
    this.timer = setInterval(function () {
      self.nextSlide();
    }, ms);
  };

  TotalBundleAnnouncementBar.prototype.stopRotation = function () {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  };

  TotalBundleAnnouncementBar.prototype.mountAtTop = function () {
    if (!this.bar || !document.body) return;

    // Hide theme native announcement bars
    var themeSelectors = [
      'announcement-bar',
      '.announcement-bar:not(#tb-announcement-bar):not(.tb-announcement-bar)',
      '.announcement-bar-section',
      '[data-section-type="announcement-bar"]',
      '[data-section-type="header-announcements"]',
      '.site-header__announcement',
      '.header-announcement',
      '.utility-bar .announcement-bar',
      '.utility-bar'
    ];
    for (var i = 0; i < themeSelectors.length; i++) {
      try {
        var elements = document.querySelectorAll(themeSelectors[i]);
        for (var j = 0; j < elements.length; j++) {
          if (!elements[j].contains(this.bar) && elements[j] !== this.bar) {
            elements[j].style.setProperty('display', 'none', 'important');
            elements[j].style.setProperty('visibility', 'hidden', 'important');
            elements[j].style.setProperty('height', '0px', 'important');
            elements[j].style.setProperty('min-height', '0px', 'important');
            elements[j].style.setProperty('padding', '0px', 'important');
            elements[j].style.setProperty('margin', '0px', 'important');
          }
        }
      } catch (e) {}
    }

    // ALWAYS hoist bar directly into document.body at the very top
    var topHeader = document.querySelector(
      'header-group, .shopify-section-group-header-group, header, #shopify-section-header, .site-header'
    );
    if (topHeader && topHeader.parentNode === document.body) {
      if (this.bar.nextSibling !== topHeader) {
        document.body.insertBefore(this.bar, topHeader);
      }
    } else if (document.body.firstChild && document.body.firstChild !== this.bar) {
      document.body.insertBefore(this.bar, document.body.firstChild);
    } else {
      document.body.appendChild(this.bar);
    }

    // Force bar visible
    this.bar.style.setProperty('display', 'block', 'important');
    this.bar.style.setProperty('visibility', 'visible', 'important');
  };

  /**
   * applySettings — kept for API compatibility and future dynamic updates.
   * Currently NOT called from fetchLiveSettings to avoid clobbering
   * the Liquid-server-rendered HTML which is the source of truth for mode.
   * Only call this if you need to fully re-render the bar client-side.
   */
  TotalBundleAnnouncementBar.prototype.applySettings = function (s) {
    if (!s || !this.bar) return;

    // Apply style variables only — do NOT replace innerHTML
    if (s.bgColor) this.bar.style.setProperty('--tb-announcement-bg', s.bgColor);
    if (s.textColor) this.bar.style.setProperty('--tb-announcement-color', s.textColor);
    if (s.fontSize) this.bar.style.setProperty('--tb-announcement-size', s.fontSize + 'px');
    if (s.marqueeSpeed) this.bar.style.setProperty('--tb-marquee-duration', (parseFloat(s.marqueeSpeed) || 25) + 's');
    if (s.isSticky) {
      this.bar.classList.add('tb-is-sticky');
    } else {
      this.bar.classList.remove('tb-is-sticky');
    }
    // For reference: mode-specific HTML containers used in dynamic rendering:
    // tb-marquee-track (marquee mode), tb-rotating-track (rotating), tb-static-center (static)
  };

  /**
   * fetchLiveSettings — ONLY used to check enabled/disabled status.
   * Does NOT replace any HTML. The Liquid template is the sole source of truth
   * for which mode (marquee / rotating / static) is rendered.
   */
  TotalBundleAnnouncementBar.prototype.fetchLiveSettings = function () {
    var self = this;
    var shopDomain =
      (self.bar && self.bar.dataset.shop)
        ? self.bar.dataset.shop
        : (window.Shopify && window.Shopify.shop ? window.Shopify.shop : '');
    if (!shopDomain) return;

    var apiUrl =
      'https://totalbundle.vercel.app/api/announcement-bar-settings?shop=' +
      encodeURIComponent(shopDomain);

    fetch(apiUrl, { mode: 'cors' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.settings) return;
        var s = data.settings;

        // Only handle enable/disable — never replace HTML
        if (s.enabled === false) {
          self.bar.style.display = 'none';
          self.stopRotation();
          var overrideTag = document.getElementById('tb-announcement-bar-theme-override');
          if (overrideTag) overrideTag.remove();
        } else {
          self.bar.style.setProperty('display', 'block', 'important');
        }
      })
      .catch(function () {
        // API unavailable — Liquid-rendered bar stays as-is, which is correct
      });
  };

  function initAnnouncementBar() {
    window.totalBundleAnnouncementBar = new TotalBundleAnnouncementBar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnnouncementBar);
  } else {
    initAnnouncementBar();
  }
})();
