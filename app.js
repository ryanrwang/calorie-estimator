(function () {
    'use strict';

    // ── Theme toggle ──

    var THEME_KEY = 'calorie-estimator-theme';
    var HISTORY_KEY = 'calorie-estimator-history';
    var MAX_HISTORY = 50;
    var PRUNE_TARGET = 30;

    function getStoredTheme() {
        try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* noop */ }
        updateThemeIcon();
    }

    function initTheme() {
        var stored = getStoredTheme();
        if (stored === 'dark' || stored === 'light') {
            setTheme(stored);
        } else {
            setTheme('light');
        }
    }

    function toggleTheme() {
        var current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    }

    function updateThemeIcon() {
        var icon = document.querySelector('.theme-icon');
        if (!icon) return;
        var theme = document.documentElement.getAttribute('data-theme');
        icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
    }

    initTheme();

    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // ── Profile dropdown ──

    var profileBtn = document.getElementById('profile-btn');
    var profileMenu = document.getElementById('profile-menu');

    if (profileBtn && profileMenu) {
        profileBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            profileMenu.classList.toggle('hidden');
        });
    }

    // ── Model dropdown ──

    var selectedModel = 'flash';
    var modelSelectTrigger = document.getElementById('model-select-trigger');
    var modelDropdown = document.getElementById('model-dropdown');
    var modelSelectLabel = document.getElementById('model-select-label');

    if (modelSelectTrigger && modelDropdown) {
        modelSelectTrigger.addEventListener('click', function (e) {
            e.stopPropagation();
            modelDropdown.classList.toggle('hidden');
            // Close profile menu if open
            if (profileMenu) profileMenu.classList.add('hidden');
        });

        var modelOptions = modelDropdown.querySelectorAll('.model-option');
        for (var i = 0; i < modelOptions.length; i++) {
            modelOptions[i].addEventListener('click', function () {
                for (var j = 0; j < modelOptions.length; j++) {
                    modelOptions[j].classList.remove('active');
                }
                this.classList.add('active');
                selectedModel = this.getAttribute('data-model');

                // Update label — use the text content minus the note
                var labelText = this.childNodes[0].textContent.trim();
                if (modelSelectLabel) modelSelectLabel.textContent = labelText;

                modelDropdown.classList.add('hidden');
            });
        }
    }

    // ── Settings dropdown ──

    var settingsBtn = document.getElementById('settings-btn');
    var settingsMenu = document.getElementById('settings-menu');

    if (settingsBtn && settingsMenu) {
        settingsBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            settingsMenu.classList.toggle('hidden');
            if (profileMenu) profileMenu.classList.add('hidden');
        });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', function () {
        if (profileMenu) profileMenu.classList.add('hidden');
        if (modelDropdown) modelDropdown.classList.add('hidden');
        if (settingsMenu) settingsMenu.classList.add('hidden');
    });

    // ── Image compression ──

    function compressImage(file, maxSize, quality, callback) {
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = new Image();
            img.onload = function () {
                var w = img.width;
                var h = img.height;
                if (w > maxSize || h > maxSize) {
                    if (w > h) {
                        h = Math.round(h * maxSize / w);
                        w = maxSize;
                    } else {
                        w = Math.round(w * maxSize / h);
                        h = maxSize;
                    }
                }
                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                var dataUrl = canvas.toDataURL('image/jpeg', quality);
                callback(dataUrl);
            };
            img.onerror = function () {
                callback(null);
            };
            img.src = e.target.result;
        };
        reader.onerror = function () {
            callback(null);
        };
        reader.readAsDataURL(file);
    }

    // ── Usage ring ──

    var usageRingWrap = document.getElementById('usage-ring-wrap');
    var usageRingFill = document.getElementById('usage-ring-fill');
    var usageRingTooltip = document.getElementById('usage-ring-tooltip');
    var compactUsageRing = document.getElementById('compact-usage-ring');
    var compactRingFill = document.querySelector('.compact-ring-fill');
    var compactUsageTooltip = document.getElementById('compact-usage-tooltip');
    var RING_CIRCUMFERENCE = 2 * Math.PI * 10; // r=10 → ~62.83

    function applyRingState(wrap, fill, tooltip, count, limit, label, fraction) {
        if (tooltip) tooltip.textContent = label;
        if (limit > 0 && fill) {
            var offset = RING_CIRCUMFERENCE * (1 - fraction);
            fill.style.strokeDasharray = RING_CIRCUMFERENCE;
            fill.style.strokeDashoffset = offset;
            if (fraction >= 0.8) {
                wrap.classList.add('usage-ring-warn');
            } else {
                wrap.classList.remove('usage-ring-warn');
            }
        } else if (fill) {
            fill.style.strokeDasharray = RING_CIRCUMFERENCE;
            fill.style.strokeDashoffset = RING_CIRCUMFERENCE;
            wrap.classList.remove('usage-ring-warn');
        }
        wrap.classList.remove('hidden');
    }

    function updateUsageDisplay(usage) {
        if (!usage) return;

        var bucket = getUsageBucket(selectedModel);
        var count = usage[bucket] || 0;
        var limit = 0;
        var label = '';

        if (bucket === 'flash') {
            limit = 250;
            label = count + ' / ' + limit + ' Flash today';
        } else if (bucket === 'pro') {
            limit = 100;
            label = count + ' / ' + limit + ' Pro today';
        } else if (bucket === 'claude') {
            label = count + ' Claude today';
        }

        var fraction = limit > 0 ? Math.min(count / limit, 1) : 0;

        // Update both rings
        if (usageRingWrap) applyRingState(usageRingWrap, usageRingFill, usageRingTooltip, count, limit, label, fraction);
        if (compactUsageRing) applyRingState(compactUsageRing, compactRingFill, compactUsageTooltip, count, limit, label, fraction);
    }

    function getUsageBucket(model) {
        if (model === 'flash' || model === 'flash-thinking') return 'flash';
        if (model === 'pro') return 'pro';
        if (model === 'sonnet' || model === 'opus') return 'claude';
        return 'flash';
    }

    // ── Copy to clipboard (hidden for now) ──

    var lastResultText = '';

    function parseMidpointList(text) {
        var lines = text.split('\n');
        var items = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;

            var lowerLine = line.toLowerCase();
            if (lowerLine.indexOf('total') === 0 || lowerLine.indexOf('note') === 0 ||
                lowerLine.indexOf('source') === 0 || lowerLine.indexOf('*') === 0 ||
                lowerLine.indexOf('disclaimer') === 0) continue;

            var match = line.match(/^(.+?)\s*[\u2014\u2013\-]+\s*~?(\d+)\s*[\u2013\-]+\s*(\d+)\s*(cal|kcal)?/i);
            if (match) {
                var name = match[1].replace(/^[-\u2022\u2013\u2014\*]\s*/, '').trim();
                var low = parseInt(match[2], 10);
                var high = parseInt(match[3], 10);
                var mid = Math.round((low + high) / 2);
                items.push(name + ' ' + mid + ' cal');
            }
        }
        return items;
    }

    function parseMidpointListForCopy(text) {
        var items = parseMidpointList(text);
        return items.length > 0 ? items.join('\n') : text.trim();
    }

    // ── Form handling ──

    var form = document.getElementById('estimate-form');
    var foodInput = document.getElementById('food-input');
    var photoInput = document.getElementById('photo-input');
    var photoPreview = document.getElementById('photo-preview');
    var photoPreviewImg = document.getElementById('photo-preview-img');
    var photoRemove = document.getElementById('photo-remove');
    var submitBtn = document.getElementById('submit-btn');
    var submitText = document.getElementById('submit-text');
    var submitSpinner = document.getElementById('submit-spinner');
    var resultsSection = document.getElementById('results');
    var resultsContent = document.getElementById('results-content');
    var inputCard = document.getElementById('input-card');
    var loadingState = document.getElementById('loading-state');
    var calorieHero = document.getElementById('calorie-hero');
    var resultsBeard = document.getElementById('results-beard');
    var resultsBeardDate = document.getElementById('results-beard-date');
    var resultsPromptBtn = document.getElementById('results-show-prompt-btn');
    var resultsArchiveBtn = document.getElementById('results-archive-btn');
    var currentResultPrompt = '';

    var currentApiImage = null;
    var currentThumbnail = null;

    if (photoInput) {
        photoInput.addEventListener('change', function () {
            var file = photoInput.files[0];
            if (!file) return;

            compressImage(file, 1024, 0.8, function (apiImage) {
                if (!apiImage) {
                    showResults('<p class="error-text">Could not process this image. Try a different photo.</p>', true);
                    return;
                }
                currentApiImage = apiImage;
            });

            compressImage(file, 200, 0.6, function (thumb) {
                if (!thumb) return;
                currentThumbnail = thumb;
                photoPreviewImg.src = thumb;
                photoPreview.classList.remove('hidden');
            });
        });
    }

    if (photoRemove) {
        photoRemove.addEventListener('click', function () {
            currentApiImage = null;
            currentThumbnail = null;
            photoInput.value = '';
            photoPreview.classList.add('hidden');
            photoPreviewImg.src = '';
        });
    }

    // Auto-resize textarea with smooth transition
    var typingTimer = null;
    if (foodInput) {
        foodInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.max(80, this.scrollHeight) + 'px';

            // Typing glow pulse
            if (inputCard && !inputCard.classList.contains('compact')) {
                inputCard.classList.remove('typing-fade');
                // Re-trigger animation by removing and re-adding class
                inputCard.classList.remove('typing');
                void inputCard.offsetWidth; // force reflow to restart animation
                inputCard.classList.add('typing');
                clearTimeout(typingTimer);
                typingTimer = setTimeout(function () {
                    inputCard.classList.remove('typing');
                    inputCard.classList.add('typing-fade');
                    setTimeout(function () {
                        inputCard.classList.remove('typing-fade');
                    }, 500);
                }, 600);
            }
        });
    }

    // Track last payload for retry
    var lastPayload = null;

    var compactActions = document.getElementById('compact-actions');

    var ANIM_DURATION = 400;
    var ANIM_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

    function animateCardHeight(fromHeight, toHeight) {
        inputCard.classList.add('animating');
        var anim = inputCard.animate([
            { height: fromHeight + 'px' },
            { height: toHeight + 'px' }
        ], {
            duration: ANIM_DURATION,
            easing: ANIM_EASING,
        });
        anim.onfinish = function () {
            inputCard.classList.remove('animating');
        };
    }

    function compactInput() {
        if (!inputCard) return;
        isCompactClickable = false;

        var startHeight = inputCard.offsetHeight;

        inputCard.classList.add('compact');
        if (foodInput) foodInput.setAttribute('readonly', '');

        var endHeight = inputCard.offsetHeight;
        animateCardHeight(startHeight, endHeight);
    }

    function expandInput() {
        if (!inputCard) return;
        isCompactClickable = false;

        var startHeight = inputCard.offsetHeight;

        inputCard.classList.remove('compact');
        if (foodInput) foodInput.removeAttribute('readonly');

        var endHeight = inputCard.offsetHeight;
        animateCardHeight(startHeight, endHeight);
    }

    // Stagger-shift history entries down with visible delays
    function staggerHistoryDown(startIndex) {
        var historyList = document.getElementById('history-list');
        if (!historyList) return;
        var entries = historyList.querySelectorAll('.history-entry');
        var max = Math.min(entries.length, 8);
        for (var i = startIndex || 0; i < max; i++) {
            (function (entry, delay) {
                entry.style.animationDelay = delay + 'ms';
                entry.classList.add('stagger-shift');
                entry.addEventListener('animationend', function handler() {
                    entry.classList.remove('stagger-shift');
                    entry.style.animationDelay = '';
                    entry.removeEventListener('animationend', handler);
                });
            })(entries[i], i * 60);
        }
    }

    function beginLoading(afterCollapse) {
        clearResultsAnimation();
        if (!afterCollapse) compactInput();
        resultsContent.innerHTML = '';
        if (calorieHero) calorieHero.classList.add('hidden');
        if (resultsBeard) resultsBeard.classList.add('hidden');
        var oldPrompt = resultsSection.querySelector('.results-prompt');
        if (oldPrompt) oldPrompt.remove();
        if (loadingState) loadingState.classList.remove('hidden');
        resultsSection.classList.add('results-loading');
        resultsSection.classList.remove('hidden');

        // Animate loading card fading in and growing from small
        resultsSection.style.transformOrigin = 'top center';
        var loadingHeight = resultsSection.offsetHeight;

        resultsSection.animate([
            { opacity: 0, transform: 'scale(0.96) translateY(-8px)' },
            { opacity: 1, transform: 'scale(1) translateY(0)' }
        ], {
            duration: 400,
            easing: ANIM_EASING,
        }).onfinish = function () {
            resultsSection.style.transformOrigin = '';
        };
    }

    function submitEstimate(payload) {
        lastPayload = payload;

        if (resultsShowing && !resultsSection.classList.contains('hidden')) {
            // Results currently showing — collapse them into history, then load
            resultsShowing = false;
            compactInput();

            animateResultsIntoHistory(function () {
                renderHistory();
                // Pop-in newest history card + stagger the rest
                popInNewestHistoryCard();
                expandHistory();
                // Then grow in the loading card
                beginLoading(true);
            });
        } else {
            // First submit — stagger existing history down, then show loading
            compactInput();
            staggerHistoryDown(0);
            beginLoading(false);
        }

        submitBtn.disabled = true;
        submitText.textContent = 'Estimating...';
        submitSpinner.classList.remove('hidden');

        fetch('api/estimate.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.usage) {
                updateUsageDisplay(data.usage);
            }

            if (data.error) {
                var errorHtml = '<p class="error-text">' + escapeHtml(data.error) + '</p>';
                errorHtml += '<button type="button" class="retry-btn" id="retry-btn">Try Again</button>';
                showResults(errorHtml, true);
                var retryBtn = document.getElementById('retry-btn');
                if (retryBtn) {
                    retryBtn.addEventListener('click', function () {
                        submitEstimate(lastPayload);
                    });
                }
            } else {
                lastResultText = data.result;
                currentResultPrompt = payload.text || '';
                var totalRange = parseTotalRange(data.result);
                renderCalorieHero(totalRange);
                showResults(formatResponse(data.result), false);

                // Show results beard
                if (resultsBeard) {
                    var now = new Date();
                    var dStr = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    var tStr = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
                    if (resultsBeardDate) resultsBeardDate.textContent = dStr + ' ' + tStr;
                    resultsBeard.classList.remove('hidden');
                    // Show prompt button only if there's text
                    if (resultsPromptBtn) {
                        resultsPromptBtn.classList.toggle('hidden', !currentResultPrompt);
                        resultsPromptBtn.classList.remove('active');
                    }
                }

                resultsShowing = true;

                saveToHistory({
                    timestamp: new Date().toISOString(),
                    input_type: currentApiImage ? 'photo' : 'text',
                    input_text: payload.text || '',
                    thumbnail: currentThumbnail,
                    gemini_response: data.result,
                    model_used: data.model || 'flash',
                });
            }
        })
        .catch(function (err) {
            var errorHtml = '<p class="error-text">Connection error. Check your internet and try again.</p>';
            errorHtml += '<button type="button" class="retry-btn" id="retry-btn">Try Again</button>';
            showResults(errorHtml, true);
            var retryBtn = document.getElementById('retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', function () {
                    submitEstimate(lastPayload);
                });
            }
        })
        .finally(function () {
            if (loadingState) loadingState.classList.add('hidden');
            submitBtn.disabled = false;
            submitText.textContent = 'Estimate';
            submitSpinner.classList.add('hidden');
        });
    }

    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            var text = foodInput ? foodInput.value.trim() : '';
            if (!text && !currentApiImage) {
                foodInput.focus();
                return;
            }

            var csrfInput = form.querySelector('input[name="csrf_token"]');
            var csrfToken = csrfInput ? csrfInput.value : '';

            var payload = {
                csrf_token: csrfToken,
                text: text,
                model: selectedModel,
            };

            if (currentApiImage) {
                payload.image = currentApiImage;
                payload.thumbnail = currentThumbnail;
            }

            submitEstimate(payload);
        });
    }

    // ── Results beard actions ──

    if (resultsPromptBtn) {
        resultsPromptBtn.addEventListener('click', function () {
            var existing = resultsSection.querySelector('.results-prompt');
            if (existing) {
                existing.remove();
                this.classList.remove('active');
            } else if (currentResultPrompt) {
                var div = document.createElement('div');
                div.className = 'results-prompt history-prompt';
                div.textContent = currentResultPrompt;
                // Insert before the beard
                resultsBeard.parentNode.insertBefore(div, resultsBeard);
                this.classList.add('active');
            }
        });
    }

    if (resultsArchiveBtn) {
        resultsArchiveBtn.addEventListener('click', function () {
            // Archive the first history entry (which is the current result)
            var history = getHistory();
            if (history.length > 0) {
                archiveEntry(0);
                // Hide results since we archived it
                resultsSection.classList.add('hidden');
                resultsShowing = false;
                renderHistory();
                expandHistory();
            }
        });
    }

    function parseTotalRange(text) {
        var lines = text.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (/^total/i.test(line)) {
                var match = line.match(/~?(\d+)\s*[\u2013\-]+\s*~?(\d+)/);
                if (match) {
                    return { low: parseInt(match[1], 10), high: parseInt(match[2], 10) };
                }
            }
        }
        return null;
    }

    function renderCalorieHero(range) {
        if (!calorieHero || !range) {
            if (calorieHero) calorieHero.classList.add('hidden');
            return;
        }
        calorieHero.innerHTML =
            '<span class="calorie-hero-label">Total</span>' +
            '<span class="calorie-hero-range">' +
                '<span class="calorie-hero-number">' + range.low + '</span>' +
                '<span class="calorie-hero-number calorie-hero-tilde">~</span>' +
                '<span class="calorie-hero-number">' + range.high + '</span>' +
            '</span>';
        calorieHero.classList.remove('hidden');
    }

    function showResults(html, isError) {
        clearResultsAnimation();
        resultsSection.classList.remove('results-loading');

        // Hide all content initially for line-by-line reveal
        resultsContent.innerHTML = html;
        resultsSection.classList.remove('hidden');
        if (isError) {
            if (calorieHero) calorieHero.classList.add('hidden');
        }

        // Measure current (loading) height vs final (results) height
        var currentHeight = resultsSection.offsetHeight;

        // Hide content items for stagger reveal
        var allItems = resultsContent.querySelectorAll('.result-item, .result-meta, .result-line, .error-text');
        for (var i = 0; i < allItems.length; i++) {
            allItems[i].style.opacity = '0';
            allItems[i].style.transform = 'translateY(6px)';
        }
        if (calorieHero && !calorieHero.classList.contains('hidden')) {
            calorieHero.style.opacity = '0';
            calorieHero.style.transform = 'translateY(6px)';
        }
        if (resultsBeard && !resultsBeard.classList.contains('hidden')) {
            resultsBeard.style.opacity = '0';
        }

        var naturalHeight = resultsSection.offsetHeight;

        // Phase 1: Grow card from current height to natural height
        resultsSection.style.overflow = 'hidden';
        resultsSection.style.transformOrigin = 'top center';

        var growAnim = resultsSection.animate([
            { height: currentHeight + 'px' },
            { height: naturalHeight + 'px' }
        ], {
            duration: 500,
            easing: ANIM_EASING,
        });

        growAnim.onfinish = function () {
            resultsSection.style.overflow = '';
            resultsSection.style.transformOrigin = '';

            // Phase 2: Stagger-reveal content line by line
            // Calorie hero first
            if (calorieHero && !calorieHero.classList.contains('hidden')) {
                calorieHero.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                calorieHero.style.opacity = '1';
                calorieHero.style.transform = 'translateY(0)';
            }

            // Then each result line staggered
            for (var j = 0; j < allItems.length; j++) {
                (function (item, delay) {
                    setTimeout(function () {
                        item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        item.style.opacity = '1';
                        item.style.transform = 'translateY(0)';
                    }, delay);
                })(allItems[j], 150 + j * 80);
            }

            // Beard last
            if (resultsBeard && !resultsBeard.classList.contains('hidden')) {
                setTimeout(function () {
                    resultsBeard.style.transition = 'opacity 0.3s ease';
                    resultsBeard.style.opacity = '1';
                }, 150 + allItems.length * 80);
            }

            // Enable compact clicking after all animations
            setTimeout(function () {
                isCompactClickable = true;
                // Clean up inline styles
                if (calorieHero) { calorieHero.style.transition = ''; calorieHero.style.transform = ''; }
                for (var k = 0; k < allItems.length; k++) {
                    allItems[k].style.transition = '';
                    allItems[k].style.transform = '';
                    allItems[k].style.opacity = '';
                }
                if (resultsBeard) { resultsBeard.style.transition = ''; resultsBeard.style.opacity = ''; }
            }, 300 + allItems.length * 80);
        };

        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ── Clicking compact input expands for editing ──

    var isCompactClickable = false;

    if (inputCard) {
        inputCard.addEventListener('click', function (e) {
            if (!isCompactClickable) return;
            if (e.target.closest('.toolbar-btn') || e.target.closest('.submit-pill') ||
                e.target.closest('.model-select')) return;

            isCompactClickable = false;

            // Step 1: Expand input first
            resultsShowing = false;
            expandInput();
            lastResultText = '';

            // Step 2: Collapse results in place (shrink to history card size)
            animateResultsIntoHistory(function () {
                // Step 3: Render history with the new card, stagger everything
                renderHistory();
                if (loadingState) loadingState.classList.add('hidden');
                popInNewestHistoryCard();
                expandHistory();

                if (foodInput) {
                    setTimeout(function () {
                        foodInput.focus();
                        foodInput.style.height = 'auto';
                        foodInput.style.height = Math.max(80, foodInput.scrollHeight) + 'px';
                    }, 100);
                }
            });
        });
    }

    var resultsCollapseAnim = null;

    function animateResultsIntoHistory(callback) {
        if (!resultsSection || resultsSection.classList.contains('hidden')) {
            callback();
            return;
        }

        var startHeight = resultsSection.offsetHeight;
        var targetHeight = 48; // approximate history card height
        resultsSection.style.overflow = 'hidden';
        resultsSection.style.transformOrigin = 'top center';

        // Phase 1: Shrink content to history-card height
        resultsCollapseAnim = resultsSection.animate([
            { height: startHeight + 'px', opacity: 1 },
            { height: targetHeight + 'px', opacity: 0.6 }
        ], {
            duration: 400,
            easing: ANIM_EASING,
        });

        resultsCollapseAnim.onfinish = function () {
            // Phase 2: Collapse to zero
            resultsCollapseAnim = resultsSection.animate([
                { height: targetHeight + 'px', opacity: 0.6 },
                { height: '0px', opacity: 0 }
            ], {
                duration: 250,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            });

            resultsCollapseAnim.onfinish = function () {
                resultsSection.style.overflow = '';
                resultsSection.style.transformOrigin = '';
                resultsSection.style.height = '';
                resultsSection.classList.add('hidden');
                resultsCollapseAnim = null;
                callback();
            };
        };
    }

    function clearResultsAnimation() {
        if (resultsCollapseAnim) {
            resultsCollapseAnim.cancel();
            resultsCollapseAnim = null;
        }
        if (resultsSection) {
            resultsSection.style.overflow = '';
            resultsSection.style.transformOrigin = '';
            resultsSection.style.height = '';
        }
    }

    function popInNewestHistoryCard() {
        var historyList = document.getElementById('history-list');
        if (!historyList) return;

        var entries = historyList.querySelectorAll('.history-entry');
        if (entries.length === 0) return;

        // Pop-in the newest card (first entry)
        var firstEntry = entries[0];
        firstEntry.classList.add('new-entry');
        firstEntry.addEventListener('animationend', function handler() {
            firstEntry.classList.remove('new-entry');
            firstEntry.removeEventListener('animationend', handler);
        });

        // Stagger-shift the rest of the cards down
        staggerHistoryDown(1);
    }

    function formatResponse(text) {
        var lines = text.split('\n');
        var itemsHtml = '';
        var metaHtml = '';

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;

            var lowerLine = line.toLowerCase();

            // Skip total line (hero already shows it)
            if (/^total/i.test(lowerLine)) continue;

            // Source/Note/Disclaimer → meta
            if (lowerLine.indexOf('source') === 0 || lowerLine.indexOf('note') === 0 ||
                lowerLine.indexOf('*') === 0 || lowerLine.indexOf('disclaimer') === 0) {
                metaHtml += '<p class="result-meta">' + escapeHtml(line) + '</p>';
                continue;
            }

            // Try to parse as "Name — low–high"
            var match = line.match(/^(.+?)\s*[\u2014\u2013\-]+\s*~?(\d+)\s*[\u2013\-]+\s*~?(\d+)\s*(cal|kcal)?/i);
            if (match) {
                var name = match[1].replace(/^[-\u2022\u2013\u2014\*]\s*/, '').trim();
                var range = match[2] + '\u2013' + match[3];
                itemsHtml += '<div class="result-item">' +
                    '<span class="result-item-name">' + escapeHtml(name) + '</span>' +
                    '<span class="result-item-range">' + escapeHtml(range) + '</span>' +
                    '</div>';
            } else {
                // Fallback for unparseable lines
                itemsHtml += '<p class="result-line">' + escapeHtml(line) + '</p>';
            }
        }

        return itemsHtml + metaHtml;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── History section ──

    var historySection = document.getElementById('history');

    function expandHistory() {
        if (historySection && getHistory().length > 0) {
            historySection.classList.remove('hidden');
        }
    }

    // ── localStorage history ──

    function getHistory() {
        try {
            var data = localStorage.getItem(HISTORY_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function saveToHistory(entry) {
        if (window.APP_MOCK) entry.mock = true;

        var history = getHistory();
        history.unshift(entry);

        if (history.length > MAX_HISTORY) {
            history = history.slice(0, PRUNE_TARGET);
        }

        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            for (var i = Math.floor(history.length / 2); i < history.length; i++) {
                history[i].thumbnail = null;
            }
            try {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
            } catch (e2) {
                history = history.slice(0, 10);
                for (var k = 0; k < history.length; k++) {
                    history[k].thumbnail = null;
                }
                try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e3) { /* give up */ }
            }
        }
        renderHistory();
    }

    function pruneHistoryIfNeeded() {
        var history = getHistory();
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, PRUNE_TARGET);
            try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e) { /* noop */ }
        }
    }

    var VISIBLE_HISTORY = 6;
    var historyShowAll = false;
    var resultsShowing = false;

    var ARCHIVE_KEY = 'calorie-estimator-archive';

    function getArchive() {
        try {
            var data = localStorage.getItem(ARCHIVE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function archiveEntry(index) {
        var history = getHistory();
        if (index < 0 || index >= history.length) return;
        var entry = history.splice(index, 1)[0];
        entry.archived_at = new Date().toISOString();
        var archive = getArchive();
        archive.unshift(entry);
        try {
            localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        } catch (e) { /* noop */ }
        renderHistory();
    }

    function extractFoodNames(responseText) {
        var lines = responseText.split('\n');
        var names = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var lowerLine = line.toLowerCase();
            if (/^total/i.test(lowerLine)) continue;
            if (lowerLine.indexOf('source') === 0 || lowerLine.indexOf('note') === 0 ||
                lowerLine.indexOf('*') === 0 || lowerLine.indexOf('disclaimer') === 0) continue;
            var match = line.match(/^(.+?)\s*[\u2014\u2013\-]+\s*~?\d+/);
            if (match) {
                var name = match[1].replace(/^[-\u2022\u2013\u2014\*]\s*/, '').trim();
                if (name) names.push(name);
            }
        }
        return names;
    }

    function extractTotalCalories(responseText) {
        var range = parseTotalRange(responseText);
        if (!range) return '';
        var mid = Math.round((range.low + range.high) / 2);
        return mid + '';
    }

    var STACK_AFTER = 4; // Show stack starting at the 5th card
    var MAX_STACK_LAYERS = 4;

    function buildEntryHtml(entry, i) {
        var date = new Date(entry.timestamp);
        var dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        var timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        var foodNames = extractFoodNames(entry.gemini_response);
        var summaryText = foodNames.length > 0 ? foodNames.join(', ') : (entry.input_text || 'Meal');
        var totalCal = extractTotalCalories(entry.gemini_response);
        var entryRange = parseTotalRange(entry.gemini_response);

        var h = '';
        h += '<div class="history-entry" data-index="' + i + '">';

        // Header row — crossfades between collapsed/expanded
        h += '<div class="history-entry-header-row">';
        h += '<div class="history-header-collapsed">';
        if (entry.thumbnail) {
            h += '<img class="history-thumb" src="' + entry.thumbnail + '" alt="" style="width:32px;height:32px;">';
        }
        h += '<span class="history-entry-food-name">' + escapeHtml(summaryText) + '</span>';
        if (entryRange) {
            h += '<span class="history-entry-calories">' + entryRange.low + ' ~ ' + entryRange.high + '</span>';
        } else if (totalCal) {
            h += '<span class="history-entry-calories">' + escapeHtml(totalCal) + '</span>';
        }
        h += '</div>';
        h += '<div class="history-header-expanded">';
        h += '<span class="history-hero-label">Total</span>';
        if (entryRange) {
            h += '<span class="history-hero-range">';
            h += '<span class="history-hero-number">' + entryRange.low + '</span>';
            h += '<span class="history-hero-number history-hero-tilde">~</span>';
            h += '<span class="history-hero-number">' + entryRange.high + '</span>';
            h += '</span>';
        }
        h += '</div>';
        h += '</div>';

        // Detail content
        h += '<div class="history-entry-detail">';
        h += '<div class="history-entry-detail-inner">';
        if (entry.input_text) {
            h += '<div class="history-prompt hidden" data-prompt-index="' + i + '">' + escapeHtml(entry.input_text) + '</div>';
        }
        h += '<div class="history-response">';
        h += formatResponse(entry.gemini_response);
        h += '</div>';
        h += '</div>';
        h += '</div>';

        // Beard toolbar
        h += '<div class="history-entry-beard">';
        h += '<span class="history-date">' + escapeHtml(dateStr + ' ' + timeStr) + '</span>';
        h += '<div class="history-beard-actions">';
        if (entry.input_text) {
            h += '<button type="button" class="history-beard-btn history-show-prompt-btn" data-entry-index="' + i + '" aria-label="Show prompt">';
            h += '<span class="material-symbols-outlined">description</span></button>';
        }
        h += '<button type="button" class="history-beard-btn history-archive-btn" data-entry-index="' + i + '" aria-label="Archive">';
        h += '<span class="material-symbols-outlined">archive</span></button>';
        h += '</div>';
        h += '</div>';

        h += '</div>';
        return h;
    }

    function renderHistory() {
        var historyList = document.getElementById('history-list');
        if (!historyList) return;

        var history = getHistory();

        var startIndex = resultsShowing ? 1 : 0;

        if (history.length === 0 || (resultsShowing && history.length <= 1)) {
            historyList.innerHTML = '';
            if (historySection) historySection.classList.add('hidden');
            return;
        }

        if (historySection) historySection.classList.remove('hidden');

        var totalItems = history.length - startIndex;
        var html = '';

        if (historyShowAll) {
            // Show all items flat
            for (var i = startIndex; i < history.length; i++) {
                html += buildEntryHtml(history[i], i);
            }
        } else {
            // Show first STACK_AFTER items normally
            var normalEnd = Math.min(history.length, startIndex + STACK_AFTER);
            for (var i = startIndex; i < normalEnd; i++) {
                html += buildEntryHtml(history[i], i);
            }

            // If there are more, render a stack
            var stackStart = startIndex + STACK_AFTER;
            if (stackStart < history.length) {
                var stackedCount = history.length - stackStart;
                var layers = Math.min(stackedCount - 1, MAX_STACK_LAYERS - 1); // ghost layers behind top card

                html += '<div class="history-stack" id="history-stack">';
                html += '<div class="history-stack-cards">';

                // Top card (5th item) — interactive, not part of the hover zone
                html += '<div class="history-stack-item" style="--layer: 0;">';
                html += buildEntryHtml(history[stackStart], stackStart);
                html += '</div>';

                // Stacked cards behind — wrapped for hover targeting
                var stackVisible = Math.min(stackedCount, 3);
                if (stackVisible > 1) {
                    html += '<div class="history-stack-rest" id="history-stack-rest">';
                    for (var s = 1; s < stackVisible; s++) {
                        var stackIdx = stackStart + s;
                        html += '<div class="history-stack-item" style="--layer: ' + s + ';">';
                        html += buildEntryHtml(history[stackIdx], stackIdx);
                        html += '</div>';
                    }

                    // Always show 2 empty ghost cards to hint at more
                    html += '<div class="history-stack-ghost" style="--ghost: 0;"></div>';
                    html += '<div class="history-stack-ghost" style="--ghost: 1;"></div>';

                    html += '</div>';
                }

                html += '</div>';

                var hiddenCount = stackedCount - stackVisible;
                if (hiddenCount > 0) {
                    html += '<button type="button" class="history-stack-label" id="history-stack-expand">' + hiddenCount + ' more</button>';
                } else if (stackedCount > 1) {
                    html += '<button type="button" class="history-stack-label" id="history-stack-expand">Show all</button>';
                }
                html += '</div>';
            }
        }

        historyList.innerHTML = html;
        bindHistoryEntryEvents();

        // Stack expand — click the stacked rest area, ghosts, or label
        var stackRestEl = document.getElementById('history-stack-rest');
        var stackExpandBtn = document.getElementById('history-stack-expand');
        var expandStack = function (e) {
            e.stopPropagation();
            animateStackExpand();
        };
        if (stackRestEl) {
            stackRestEl.addEventListener('click', expandStack);
        }
        if (stackExpandBtn) {
            stackExpandBtn.addEventListener('click', expandStack);
        }
    }

    function animateStackExpand() {
        var stackEl = document.getElementById('history-stack');
        var restEl = document.getElementById('history-stack-rest');
        var history = getHistory();
        if (!stackEl || !restEl) {
            historyShowAll = true;
            renderHistory();
            return;
        }

        // Step 1: Animate stacked items — remove overlap, restore opacity
        var stackItems = restEl.querySelectorAll('.history-stack-item');
        var ghosts = restEl.querySelectorAll('.history-stack-ghost');
        var label = document.getElementById('history-stack-expand');

        // Fade out ghosts and label
        for (var g = 0; g < ghosts.length; g++) {
            ghosts[g].style.transition = 'opacity 0.15s ease';
            ghosts[g].style.opacity = '0';
        }
        if (label) {
            label.style.transition = 'opacity 0.15s ease';
            label.style.opacity = '0';
        }

        // Animate stacked items to full position
        for (var s = 0; s < stackItems.length; s++) {
            stackItems[s].style.transition = 'margin-top 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
            stackItems[s].style.marginTop = '8px';
            stackItems[s].style.transform = 'scaleX(1)';
            stackItems[s].style.opacity = '1';
            stackItems[s].style.animation = 'none';
        }

        // Also restore top card's stacked items in rest
        var topItem = stackEl.querySelector('.history-stack-cards > .history-stack-item:first-child');
        if (topItem) {
            topItem.style.transition = 'margin-top 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        }

        // Step 2: After animation, swap to full flat list
        // Only newly revealed cards (beyond the visible stack) should animate in
        var startIndex = resultsShowing ? 1 : 0;
        var alreadyVisibleCount = startIndex + STACK_AFTER + Math.min(history.length - (startIndex + STACK_AFTER), 3); // normal + stacked content cards

        setTimeout(function () {
            historyShowAll = true;
            renderHistory();

            var historyList = document.getElementById('history-list');
            if (!historyList) return;
            var allEntries = historyList.querySelectorAll('.history-entry');

            // Only animate entries that weren't already visible in the stack
            var animOrder = 0;
            for (var i = 0; i < allEntries.length; i++) {
                var dataIdx = parseInt(allEntries[i].getAttribute('data-index'), 10);
                if (dataIdx >= alreadyVisibleCount) {
                    allEntries[i].style.opacity = '0';
                    allEntries[i].style.transform = 'translateY(6px)';
                    allEntries[i].style.transition = 'none';
                }
            }

            // Force reflow
            historyList.offsetHeight;

            for (var j = 0; j < allEntries.length; j++) {
                var dataIdx2 = parseInt(allEntries[j].getAttribute('data-index'), 10);
                if (dataIdx2 >= alreadyVisibleCount) {
                    allEntries[j].style.transition = 'opacity 0.15s ease ' + (animOrder * 40) + 'ms, transform 0.15s ease ' + (animOrder * 40) + 'ms';
                    allEntries[j].style.opacity = '1';
                    allEntries[j].style.transform = 'translateY(0)';
                    animOrder++;
                }
            }
        }, 300);
    }

    function bindHistoryEntryEvents() {
        var historyList = document.getElementById('history-list');
        if (!historyList) return;

        // Click entry header to expand/collapse
        var entries = historyList.querySelectorAll('.history-entry');
        for (var i = 0; i < entries.length; i++) {
            entries[i].addEventListener('click', function (e) {
                // Don't toggle when clicking beard action buttons
                if (e.target.closest('.history-beard-btn')) return;
                this.classList.toggle('expanded');
            });
        }

        // Show prompt buttons (in beard)
        var promptBtns = historyList.querySelectorAll('.history-show-prompt-btn');
        for (var k = 0; k < promptBtns.length; k++) {
            promptBtns[k].addEventListener('click', function (e) {
                e.stopPropagation();
                var idx = this.getAttribute('data-entry-index');
                var prompt = historyList.querySelector('[data-prompt-index="' + idx + '"]');
                if (prompt) prompt.classList.toggle('hidden');
                // Toggle active state on button
                this.classList.toggle('active');
            });
        }

        // Archive buttons
        var archiveBtns = historyList.querySelectorAll('.history-archive-btn');
        for (var l = 0; l < archiveBtns.length; l++) {
            archiveBtns[l].addEventListener('click', function (e) {
                e.stopPropagation();
                var idx = parseInt(this.getAttribute('data-entry-index'), 10);
                archiveEntry(idx);
            });
        }
    }

    // Mock exit button + dialog
    var mockExitBtn = document.getElementById('mock-exit-btn');
    var mockExitDialog = document.getElementById('mock-exit-dialog');
    if (mockExitBtn && mockExitDialog) {
        function exitMock(keepData) {
            if (!keepData) {
                var cleaned = getHistory().filter(function (e) { return !e.mock; });
                try { localStorage.setItem(HISTORY_KEY, JSON.stringify(cleaned)); } catch (e) { /* noop */ }
            }
            window.location.href = 'index.php?mock=0';
        }

        mockExitBtn.addEventListener('click', function () {
            var hasMock = getHistory().some(function (e) { return e.mock; });
            if (!hasMock) { window.location.href = 'index.php?mock=0'; return; }
            mockExitDialog.showModal();
        });

        document.getElementById('mock-exit-dialog-close').addEventListener('click', function () {
            mockExitDialog.close();
        });

        document.getElementById('mock-exit-yes').addEventListener('click', function () {
            mockExitDialog.close();
            exitMock(true);
        });

        document.getElementById('mock-exit-no').addEventListener('click', function () {
            mockExitDialog.close();
            exitMock(false);
        });

        mockExitDialog.addEventListener('click', function (e) {
            if (e.target === mockExitDialog) mockExitDialog.close();
        });
    }

    var clearHistoryBtn = document.getElementById('settings-clear-history');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (settingsMenu) settingsMenu.classList.add('hidden');
            if (confirm('Clear all history?')) {
                try { localStorage.removeItem(HISTORY_KEY); } catch (e) { /* noop */ }
                renderHistory();
            }
        });
    }

    // Render history on page load
    pruneHistoryIfNeeded();
    renderHistory();

    // ── Login dialog ──

    var loginDialog = document.getElementById('login-dialog');
    var loginOpenBtn = document.getElementById('login-open-btn');
    var loginCloseBtn = document.getElementById('login-close-btn');
    var loginError = document.getElementById('login-error');
    var loginStepPassphrase = document.getElementById('login-step-passphrase');
    var loginStepUsername = document.getElementById('login-step-username');
    var loginPassphraseInput = document.getElementById('login-passphrase');
    var loginPassphraseBtn = document.getElementById('login-passphrase-btn');
    var loginUserList = document.getElementById('login-user-list');
    var loginDivider = document.getElementById('login-divider');
    var loginNewUsername = document.getElementById('login-new-username');
    var loginCreateBtn = document.getElementById('login-create-btn');

    var loginCsrf = window.APP_CSRF || '';

    function showLoginError(msg) {
        if (!loginError) return;
        loginError.textContent = msg;
        loginError.classList.remove('hidden');
    }

    function hideLoginError() {
        if (!loginError) return;
        loginError.textContent = '';
        loginError.classList.add('hidden');
    }

    if (loginOpenBtn && loginDialog) {
        loginOpenBtn.addEventListener('click', function () {
            hideLoginError();
            loginDialog.showModal();
            if (loginPassphraseInput) loginPassphraseInput.focus();
        });
    }

    if (loginCloseBtn && loginDialog) {
        loginCloseBtn.addEventListener('click', function () {
            loginDialog.close();
        });
    }

    // Close on backdrop click
    if (loginDialog) {
        loginDialog.addEventListener('click', function (e) {
            if (e.target === loginDialog) loginDialog.close();
        });
    }

    // Toggle passphrase visibility
    var loginTogglePass = document.getElementById('login-toggle-pass');
    var loginTogglePassIcon = document.getElementById('login-toggle-pass-icon');
    if (loginTogglePass && loginPassphraseInput) {
        loginTogglePass.addEventListener('click', function () {
            var isPassword = loginPassphraseInput.type === 'password';
            loginPassphraseInput.type = isPassword ? 'text' : 'password';
            if (loginTogglePassIcon) loginTogglePassIcon.textContent = isPassword ? 'visibility_off' : 'visibility';
            loginPassphraseInput.focus();
        });
    }

    // Step 1: Verify passphrase
    if (loginPassphraseBtn) {
        loginPassphraseBtn.addEventListener('click', submitPassphrase);
    }
    if (loginPassphraseInput) {
        loginPassphraseInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') submitPassphrase();
        });
    }

    function submitPassphrase() {
        var passphrase = loginPassphraseInput ? loginPassphraseInput.value.trim() : '';
        if (!passphrase && !window.APP_MOCK) return;

        hideLoginError();
        loginPassphraseBtn.disabled = true;
        loginPassphraseBtn.textContent = 'Verifying...';

        fetch('api/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'passphrase', passphrase: passphrase, csrf_token: loginCsrf }),
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.ok) {
                if (data.csrf_token) loginCsrf = data.csrf_token;
                showUsernameStep(data.users || []);
            } else {
                showLoginError(data.error || 'Incorrect passphrase.');
            }
        })
        .catch(function () {
            showLoginError('Connection error. Please try again.');
        })
        .finally(function () {
            loginPassphraseBtn.disabled = false;
            loginPassphraseBtn.textContent = 'Continue';
        });
    }

    function showUsernameStep(users) {
        if (loginStepPassphrase) loginStepPassphrase.classList.add('hidden');
        if (loginStepUsername) loginStepUsername.classList.remove('hidden');

        if (loginUserList && users.length > 0) {
            var html = '';
            for (var i = 0; i < users.length; i++) {
                html += '<button type="button" class="login-user-btn" data-user-id="' + users[i].id + '">' +
                    escapeHtml(users[i].username) + '</button>';
            }
            loginUserList.innerHTML = html;
            if (loginDivider) loginDivider.classList.remove('hidden');

            var userBtns = loginUserList.querySelectorAll('.login-user-btn');
            for (var j = 0; j < userBtns.length; j++) {
                userBtns[j].addEventListener('click', function () {
                    selectUser(parseInt(this.getAttribute('data-user-id'), 10));
                });
            }
        } else {
            if (loginUserList) loginUserList.innerHTML = '';
            if (loginDivider) loginDivider.classList.add('hidden');
            if (loginNewUsername) loginNewUsername.focus();
        }
    }

    function selectUser(userId) {
        hideLoginError();
        fetch('api/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'select_user', user_id: userId, csrf_token: loginCsrf }),
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.ok) {
                window.location.reload();
            } else {
                showLoginError(data.error || 'Could not log in.');
            }
        })
        .catch(function () {
            showLoginError('Connection error. Please try again.');
        });
    }

    if (loginCreateBtn) {
        loginCreateBtn.addEventListener('click', createUser);
    }
    if (loginNewUsername) {
        loginNewUsername.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') createUser();
        });
    }

    function createUser() {
        var username = loginNewUsername ? loginNewUsername.value.trim() : '';
        if (!username) return;

        hideLoginError();
        loginCreateBtn.disabled = true;
        loginCreateBtn.textContent = 'Creating...';

        fetch('api/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create_user', username: username, csrf_token: loginCsrf }),
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.ok) {
                window.location.reload();
            } else {
                showLoginError(data.error || 'Could not create user.');
            }
        })
        .catch(function () {
            showLoginError('Connection error. Please try again.');
        })
        .finally(function () {
            loginCreateBtn.disabled = false;
            loginCreateBtn.textContent = 'Create & Log In';
        });
    }

})();
