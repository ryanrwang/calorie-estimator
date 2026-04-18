/**
 * Tooltip helper — single DOM node, event-delegated, edge-aware.
 *
 * Usage:
 *   - Any element with [data-tooltip="..."] gets a tooltip on hover/focus.
 *   - Add [data-tooltip-touch] to also show on tap for touch devices
 *     (default: hover-only — touch devices get nothing, rely on aria-label).
 *   - Update the attribute at any time; call window.Tooltip.refresh(el)
 *     if the tooltip is currently open for that element.
 */

(function () {
    'use strict';

    var SHOW_DELAY = 0;
    var VIEWPORT_PAD = 8;
    var GAP = 8;

    var isTouchOnly =
        window.matchMedia('(hover: none)').matches ||
        window.matchMedia('(pointer: coarse)').matches;

    var tipEl = null;
    var currentTarget = null;
    var showTimer = null;

    function ensureTipEl() {
        if (tipEl) return tipEl;
        tipEl = document.createElement('div');
        tipEl.className = 'tooltip';
        tipEl.id = 'app-tooltip';
        tipEl.setAttribute('role', 'tooltip');
        document.body.appendChild(tipEl);
        return tipEl;
    }

    function getText(el) {
        return el.getAttribute('data-tooltip');
    }

    function isTouchExempt(el) {
        return el.hasAttribute('data-tooltip-touch');
    }

    function canShowOn(el) {
        if (!getText(el)) return false;
        if (isTouchOnly && !isTouchExempt(el)) return false;
        return true;
    }

    function position(el) {
        var tip = tipEl;
        var r = el.getBoundingClientRect();
        var tr = tip.getBoundingClientRect();
        var vw = window.innerWidth;
        var vh = window.innerHeight;

        var placement = el.getAttribute('data-tooltip-placement') || 'top';
        var top, left;

        if (placement === 'left') {
            top = r.top + r.height / 2 - tr.height / 2;
            left = r.left - tr.width - GAP;
            if (left < VIEWPORT_PAD) {
                left = r.right + GAP;
                placement = 'right';
            }
        } else if (placement === 'right') {
            top = r.top + r.height / 2 - tr.height / 2;
            left = r.right + GAP;
            if (left + tr.width > vw - VIEWPORT_PAD) {
                left = r.left - tr.width - GAP;
                placement = 'left';
            }
        } else {
            // top (default) or bottom — flip if not enough room
            if (placement === 'top') {
                top = r.top - tr.height - GAP;
                if (top < VIEWPORT_PAD) {
                    top = r.bottom + GAP;
                    placement = 'bottom';
                }
            } else {
                top = r.bottom + GAP;
                if (top + tr.height > vh - VIEWPORT_PAD) {
                    top = r.top - tr.height - GAP;
                    placement = 'top';
                }
            }
            left = r.left + r.width / 2 - tr.width / 2;
        }

        // Horizontal clamp
        if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
        if (left + tr.width > vw - VIEWPORT_PAD) {
            left = vw - tr.width - VIEWPORT_PAD;
        }
        // Vertical clamp
        if (top < VIEWPORT_PAD) top = VIEWPORT_PAD;
        if (top + tr.height > vh - VIEWPORT_PAD) {
            top = vh - tr.height - VIEWPORT_PAD;
        }

        tip.style.top = Math.round(top) + 'px';
        tip.style.left = Math.round(left) + 'px';
        tip.setAttribute('data-placement', placement);
    }

    function show(el) {
        if (!canShowOn(el)) return;
        var tip = ensureTipEl();
        tip.textContent = getText(el);
        tip.classList.add('tooltip-visible');
        currentTarget = el;
        if (el.id) {
            el.setAttribute('aria-describedby', tip.id);
        }
        position(el);
    }

    function hide() {
        if (tipEl) tipEl.classList.remove('tooltip-visible');
        if (currentTarget) {
            currentTarget.removeAttribute('aria-describedby');
            currentTarget = null;
        }
        clearTimeout(showTimer);
    }

    function scheduleShow(el, delay) {
        clearTimeout(showTimer);
        showTimer = setTimeout(function () {
            show(el);
        }, delay == null ? SHOW_DELAY : delay);
    }

    // Pointer (mouse) handlers
    document.addEventListener('mouseover', function (e) {
        if (isTouchOnly) return;
        var el = e.target.closest && e.target.closest('[data-tooltip]');
        if (!el) return;
        if (el === currentTarget) return;
        scheduleShow(el);
    });

    document.addEventListener('mouseout', function (e) {
        if (isTouchOnly) return;
        var el = e.target.closest && e.target.closest('[data-tooltip]');
        if (!el) return;
        var related = e.relatedTarget && e.relatedTarget.closest
            ? e.relatedTarget.closest('[data-tooltip]')
            : null;
        if (related === el) return;
        clearTimeout(showTimer);
        if (currentTarget === el) hide();
    });

    // Keyboard focus
    document.addEventListener('focusin', function (e) {
        var el = e.target.closest && e.target.closest('[data-tooltip]');
        if (!el) return;
        scheduleShow(el, 0);
    });

    document.addEventListener('focusout', function (e) {
        var el = e.target.closest && e.target.closest('[data-tooltip]');
        if (!el) return;
        if (currentTarget === el) hide();
        clearTimeout(showTimer);
    });

    // Click: hide after interaction, and handle touch tap-toggle for exempt elements
    document.addEventListener('click', function (e) {
        var el = e.target.closest && e.target.closest('[data-tooltip]');

        // Tap outside any tooltip target — dismiss
        if (!el) {
            if (currentTarget) hide();
            return;
        }

        // Touch: tap-toggle on exempt elements, no-op on non-exempt
        if (isTouchOnly) {
            if (isTouchExempt(el)) {
                if (currentTarget === el) {
                    hide();
                } else {
                    show(el);
                }
            }
            return;
        }

        // Mouse: hide sticky tooltip after clicking the target
        if (currentTarget === el) hide();
    }, true);

    // Escape to dismiss
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && currentTarget) hide();
    });

    // Reposition on scroll/resize; hide if the element is no longer visible
    window.addEventListener('scroll', function () {
        if (currentTarget) position(currentTarget);
    }, true);
    window.addEventListener('resize', hide);

    // Public API
    window.Tooltip = {
        show: show,
        hide: hide,
        refresh: function (el) {
            if (el && el === currentTarget) {
                tipEl.textContent = getText(el);
                position(el);
            }
        },
        isTouchOnly: isTouchOnly
    };
})();
