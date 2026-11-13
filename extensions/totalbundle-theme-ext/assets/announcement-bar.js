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
    if (!this.bar) return;
    var themeSelectors = [
      'announcement-bar',
      '.announcement-bar:not(#tb-announcement-bar):not(.tb-announcement-bar)',
      '.announcement-bar-section',
      '[data-section-type="announcement-bar"]',
      '[data-section-type="header-announcements"]',
      '#shopify-section-announcement-bar',
      '[id*="shopify-section-announcement-bar"]',
      '[id*="shopify-section-sections--announcement_bar"]',
      '[id*="shopify-section-sections--"][id*="announcement"]',
      '[id*="announcement-bar"]:not(#tb-announcement-bar):not([id*="tb-announcement"])',
      '.site-header__announcement',
      '.header-announcement',
      '.utility-bar'
    ];
    var themeBar = null;
    for (var i = 0; i < themeSelectors.length; i++) {
      var found = document.querySelector(themeSelectors[i]);
      if (found && !found.contains(this.bar) && found !== this.bar) {
        themeBar = found;
        break;
      }
    }

    if (themeBar && themeBar.parentNode) {
      themeBar.style.setProperty('display', 'none', 'important');
      if (this.bar.nextSibling !== themeBar) {
        themeBar.parentNode.insertBefore(this.bar, themeBar);
      }
    } else if (document.body) {
      var header = document.querySelector('header, .header, #shopify-section-header, .site-header, [data-section-type="header"]');
      if (header && header.parentNode && header.parentNode === document.body) {
        if (this.bar.nextSibling !== header) {
          document.body.insertBefore(this.bar, header);
        }
      } else if (document.body.firstChild && document.body.firstChild !== this.bar) {
        document.body.insertBefore(this.bar, document.body.firstChild);
      }
    }
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

