/**
 * TotalBundle Announcement Bar JavaScript
 * Manages multi-mode announcement bars:
 * - Continuous Marquee Scrolling Ticker
 * - Centered One-by-One Rotating Slides (with auto-timer, prev/next arrows, pause on hover)
 * - Static Center
 * - Dismiss / Close state persistence via sessionStorage
 * - Live real-time settings fallback from app API
 */

(function () {
  'use strict';

  function TotalBundleAnnouncementBar() {
    // 1. DOM Deduplication
    var allBars = document.querySelectorAll('.tb-announcement-bar');
    if (allBars.length > 1) {
      for (var i = 1; i < allBars.length; i++) {
        allBars[i].remove();
      }
    }

    this.bar = document.querySelector('.tb-announcement-bar');
    if (!this.bar) return;

    // Immediately replace theme announcement bar & mount at top
    this.mountAtTop();

    // Check if user previously dismissed this session
    try {
      if (sessionStorage.getItem('tb_announcement_dismissed') === 'true') {
        this.bar.style.display = 'none';
        return;
      }
    } catch (e) {}

    this.mode = this.bar.dataset.mode || 'rotating';
    this.intervalSeconds = parseFloat(this.bar.dataset.rotationInterval) || 4;
    this.timer = null;
    this.currentIndex = 0;

    this.slides = Array.prototype.slice.call(this.bar.querySelectorAll('.tb-rotating-slide'));
    this.prevBtn = this.bar.querySelector('.tb-rotator-prev');
    this.nextBtn = this.bar.querySelector('.tb-rotator-next');
    this.closeBtn = this.bar.querySelector('.tb-announcement-close');

    this.initEvents();

    if (this.mode === 'rotating' && this.slides.length > 1) {
      this.startRotation();
    }

    // Live settings check
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

    // Pause on hover
    if (this.bar.classList.contains('tb-pause-hover')) {
      this.bar.addEventListener('mouseenter', function () {
        self.stopRotation();
      });
      this.bar.addEventListener('mouseleave', function () {
        if (self.mode === 'rotating' && self.slides.length > 1) {
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

    // 1. Hide theme native announcement bars specifically
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

    // 2. ALWAYS hoist bar directly into document.body at the top, NEVER inside a theme section!
    var topHeader = document.querySelector('header-group, .shopify-section-group-header-group, header, #shopify-section-header, .site-header');
    if (topHeader && topHeader.parentNode === document.body) {
      if (this.bar.nextSibling !== topHeader) {
        document.body.insertBefore(this.bar, topHeader);
      }
    } else if (document.body.firstChild && document.body.firstChild !== this.bar) {
      document.body.insertBefore(this.bar, document.body.firstChild);
    } else {
      document.body.appendChild(this.bar);
    }

    // 3. Ensure the bar itself is explicitly visible
    this.bar.style.setProperty('display', 'block', 'important');
    this.bar.style.setProperty('visibility', 'visible', 'important');
  };

  TotalBundleAnnouncementBar.prototype.fetchLiveSettings = function () {
    var self = this;
    var shopDomain = window.Shopify && window.Shopify.shop ? window.Shopify.shop : '';
    if (!shopDomain) return;

    var apiUrl = 'https://totalbundle.vercel.app/api/announcement-bar-settings?shop=' + encodeURIComponent(shopDomain);
    fetch(apiUrl, { mode: 'cors' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.settings) {
          var s = data.settings;
          if (s.enabled === false) {
            self.bar.style.display = 'none';
            self.stopRotation();
            // Restore theme bars
            var overrideTag = document.getElementById('tb-announcement-bar-theme-override');
            if (overrideTag) overrideTag.remove();
            var themeBars = document.querySelectorAll('announcement-bar, .announcement-bar:not(#tb-announcement-bar), .utility-bar');
            for (var i = 0; i < themeBars.length; i++) {
              themeBars[i].style.removeProperty('display');
            }
            return;
          }
          self.bar.style.display = '';
          self.mountAtTop();
          if (s.bgColor) {
            self.bar.style.setProperty('--tb-announcement-bg', s.bgColor);
          }
          if (s.textColor) {
            self.bar.style.setProperty('--tb-announcement-color', s.textColor);
          }
          if (s.fontSize) {
            self.bar.style.setProperty('--tb-announcement-size', s.fontSize + 'px');
          }
        }
      })
      .catch(function () {});
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

