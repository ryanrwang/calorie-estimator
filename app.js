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
        var label = document.getElementById('settings-theme-label');
        if (!icon) return;
        var theme = document.documentElement.getAttribute('data-theme');
        icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
        if (label) label.textContent = theme === 'dark' ? 'Use light mode' : 'Use dark mode';
    }

    initTheme();

    // ── Model dropdown ──

    var selectedModel = 'flash';
    var modelSelectTrigger = document.getElementById('model-select-trigger');
    var modelDropdown = document.getElementById('model-dropdown');
    var modelSelectLabel = document.getElementById('model-select-label');

    if (modelSelectTrigger && modelDropdown) {
        modelSelectTrigger.addEventListener('click', function (e) {
            e.stopPropagation();
            modelDropdown.classList.toggle('hidden');
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

                // Refresh usage ring for the newly selected model
                updateUsageDisplay();
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
        });
    }

    // Theme toggle in settings menu
    var settingsThemeToggle = document.getElementById('settings-theme-toggle');
    if (settingsThemeToggle) {
        settingsThemeToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleTheme();
        });
    }

    // Debug mode toggle in settings menu — enables/disables mock mode
    var settingsDebugToggle = document.getElementById('settings-debug-toggle');
    if (settingsDebugToggle) {
        if (window.APP_MOCK) {
            settingsDebugToggle.classList.add('active');
        }
        settingsDebugToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            window.location.href = window.APP_MOCK ? 'index.php?mock=0' : 'index.php?mock=1';
        });
    }

    // Login button in settings menu (for logged-out users)
    var settingsLoginBtn = document.getElementById('settings-login-btn');
    var loginDialog = document.getElementById('login-dialog');
    if (settingsLoginBtn && loginDialog) {
        settingsLoginBtn.addEventListener('click', function () {
            if (settingsMenu) settingsMenu.classList.add('hidden');
            var loginError = document.getElementById('login-error');
            if (loginError) { loginError.textContent = ''; loginError.classList.add('hidden'); }
            loginDialog.showModal();
            var passInput = document.getElementById('login-passphrase');
            if (passInput) passInput.focus();
        });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', function () {
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

    // Initialize both rings to empty state
    var allRingFills = [usageRingFill, compactRingFill];
    for (var r = 0; r < allRingFills.length; r++) {
        if (allRingFills[r]) {
            allRingFills[r].style.strokeDasharray = RING_CIRCUMFERENCE;
            allRingFills[r].style.strokeDashoffset = RING_CIRCUMFERENCE;
        }
    }
    if (usageRingTooltip) usageRingTooltip.textContent = 'Usage';
    if (compactUsageTooltip) compactUsageTooltip.textContent = 'Usage';

    // Cached usage/limits from server (per-model)
    var cachedUsage = null;
    var cachedLimits = null;

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
    }

    function updateUsageDisplay(usage, limits) {
        if (usage) cachedUsage = usage;
        if (limits) cachedLimits = limits;
        if (!cachedUsage) return;

        var model = selectedModel;
        var count = cachedUsage[model] || 0;
        var limit = cachedLimits && cachedLimits[model] ? cachedLimits[model] : 0;
        var label = limit > 0 ? count + ' / ' + limit + ' today' : count + ' today';
        var fraction = limit > 0 ? Math.min(count / limit, 1) : 0;

        // Update both rings identically — CSS handles visibility per state
        if (usageRingWrap) applyRingState(usageRingWrap, usageRingFill, usageRingTooltip, count, limit, label, fraction);
        if (compactUsageRing) applyRingState(compactUsageRing, compactRingFill, compactUsageTooltip, count, limit, label, fraction);
    }

    // Prefetch usage on page load
    fetch('api/usage.php')
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.usage) updateUsageDisplay(data.usage, data.limits);
        })
        .catch(function () { /* silent — ring stays hidden until first API call */ });

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

    function handleImageFile(file) {
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
    }

    if (photoInput) {
        photoInput.addEventListener('change', function () {
            var file = photoInput.files[0];
            if (!file) return;
            handleImageFile(file);
        });
    }

    if (foodInput) {
        foodInput.addEventListener('paste', function (e) {
            var items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            for (var i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image/') === 0) {
                    e.preventDefault();
                    handleImageFile(items[i].getAsFile());
                    return;
                }
            }
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

            // Typing glow — debounced fade (transition-based, no jarring restarts)
            if (inputCard && !inputCard.classList.contains('compact')) {
                inputCard.classList.add('typing-glow');
                inputCard.classList.remove('typing-fade');
                clearTimeout(typingTimer);
                typingTimer = setTimeout(function () {
                    inputCard.classList.add('typing-fade');
                    setTimeout(function () {
                        inputCard.classList.remove('typing-glow', 'typing-fade');
                    }, 500);
                }, 400);
            }
        });

        // Enter to submit, Shift+Enter for new line
        foodInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (submitBtn && !submitBtn.disabled) {
                    submitBtn.click();
                }
            }
        });
    }

    // Track last payload for retry
    var lastPayload = null;

    var compactActions = document.getElementById('compact-actions');

    var MORPH_DURATION = 800;
    var ANIM_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

    function animateCardHeight(fromHeight, toHeight) {
        inputCard.classList.add('animating');
        var dur = Math.round(MORPH_DURATION * 0.5);
        var anim = inputCard.animate([
            { height: fromHeight + 'px' },
            { height: toHeight + 'px' }
        ], {
            duration: dur,
            easing: ANIM_EASING,
        });
        var cleanup = function () {
            inputCard.classList.remove('animating');
        };
        anim.onfinish = cleanup;
        anim.oncancel = cleanup;
        // Safety fallback
        setTimeout(cleanup, dur + 50);
    }

    function compactInput() {
        if (!inputCard) return;
        isCompactClickable = false;

        var startHeight = inputCard.offsetHeight;

        // Populate the compact text overlay with the first line of input
        var overlay = document.getElementById('compact-text-overlay');
        if (overlay && foodInput) {
            overlay.textContent = foodInput.value.replace(/\n/g, ' ');
        }

        // Apply compact layout. The class change is instant, but the
        // Web Animations API first keyframe (startHeight) overrides
        // the rendered height on the same frame — no visible jump.
        inputCard.classList.add('compact');
        inputCard.setAttribute('data-tooltip', 'Edit prompt');
        if (foodInput) foodInput.setAttribute('readonly', '');

        var endHeight = inputCard.offsetHeight;
        animateCardHeight(startHeight, endHeight);
    }

    function expandInput() {
        if (!inputCard) return;
        isCompactClickable = false;

        var startHeight = inputCard.offsetHeight;

        inputCard.classList.remove('compact');
        inputCard.removeAttribute('data-tooltip');
        if (foodInput) foodInput.removeAttribute('readonly');

        var endHeight = inputCard.offsetHeight;
        animateCardHeight(startHeight, endHeight);
    }

    // Tracked-treads shift: animate the ENTIRE history list container as one unit.
    // The list starts shifted up by one card slot, then glides down — like a
    // conveyor belt or tank treads. The newest card fades in as it enters view.
    //
    // This avoids all per-card FLIP/transition bugs because there's only ONE
    // animation on ONE element (the container).
    function shiftHistoryDown() {
        var historyList = document.getElementById('history-list');
        if (!historyList) return;

        var dur = Math.round(MORPH_DURATION * 0.65); // ~520ms — slow enough to read
        var easing = 'cubic-bezier(0.22, 1, 0.36, 1)'; // slight overshoot for physical feel

        var firstEntry = historyList.querySelector('.history-entry');
        if (!firstEntry) return;

        // One slot = card height + flex gap
        var slotHeight = firstEntry.offsetHeight + 8;

        // Clip overflow so cards sliding from above are hidden until in-bounds
        historyList.style.overflow = 'clip';

        // Animate the whole list sliding down from one slot above
        var listAnim = historyList.animate([
            { transform: 'translateY(' + (-slotHeight) + 'px)' },
            { transform: 'translateY(0)' }
        ], { duration: dur, easing: easing });

        listAnim.onfinish = function () {
            historyList.style.overflow = '';
        };

        // Newest card fades in as it slides into view
        firstEntry.animate([
            { opacity: 0 },
            { opacity: 1 }
        ], { duration: Math.round(dur * 0.7), easing: 'ease-out' });
    }

    // First-submit nudge: same container animation, smaller displacement.
    function nudgeHistoryDown() {
        var historyList = document.getElementById('history-list');
        if (!historyList) return;
        var entries = historyList.querySelectorAll(':scope > .history-entry:not(.morph-target)');
        if (entries.length === 0) return;

        var dur = Math.round(MORPH_DURATION * 0.35);
        var easing = 'cubic-bezier(0.0, 0, 0.2, 1)';

        // Subtle downward nudge for existing cards
        for (var i = 0; i < Math.min(entries.length, 8); i++) {
            entries[i].animate([
                { transform: 'translateY(-20px)', opacity: 0.5 },
                { transform: 'translateY(0)', opacity: 1 }
            ], { duration: dur, easing: easing });
        }
    }

    var loadingGrowAnim = null;

    function beginLoading() {
        clearResultsAnimation();
        resultsContent.innerHTML = '';
        if (calorieHero) calorieHero.classList.add('hidden');
        if (resultsBeard) resultsBeard.classList.add('hidden');
        var oldPrompt = resultsSection.querySelector('.results-prompt');
        if (oldPrompt) oldPrompt.remove();
        if (loadingState) loadingState.classList.remove('hidden');
        resultsSection.classList.add('results-loading');
        resultsSection.classList.remove('hidden');

        // Measure natural height before animating
        var naturalHeight = resultsSection.scrollHeight;
        var growDuration = Math.round(MORPH_DURATION * 0.5);

        // Animate from 0 to natural — no fill, no inline style pre-sets
        // The animation drives the values while running; on finish, natural layout takes over
        // Use ease-out (no overshoot) for height growth
        loadingGrowAnim = resultsSection.animate([
            { height: '0px', opacity: 0, transform: 'scale(0.97)', overflow: 'hidden' },
            { height: naturalHeight + 'px', opacity: 1, transform: 'scale(1)', overflow: 'hidden' }
        ], {
            duration: growDuration,
            easing: 'cubic-bezier(0.0, 0, 0.2, 1)',
        });
        loadingGrowAnim.onfinish = function () { loadingGrowAnim = null; };
    }

    function submitEstimate(payload) {
        lastPayload = payload;

        if (resultsShowing && !resultsSection.classList.contains('hidden')) {
            // Results currently showing — morph into history card, then load
            compactInput();

            morphResultToHistory(function () {
                beginLoading();
            });
        } else {
            // First submit — compact input, nudge history, show loading
            compactInput();
            nudgeHistoryDown();
            beginLoading();
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
                // In mock mode, accumulate fake bumps on top of cached usage
                if (window.APP_MOCK && data.mock_bump && cachedUsage) {
                    var model = data.model || selectedModel;
                    cachedUsage[model] = (cachedUsage[model] || 0) + data.mock_bump;
                    updateUsageDisplay(null, data.limits);
                } else {
                    updateUsageDisplay(data.usage, data.limits);
                }
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

            // Client-side quota check (catches mock-accumulated usage)
            if (cachedUsage && cachedLimits) {
                var modelLimit = cachedLimits[selectedModel] || 0;
                var modelCount = cachedUsage[selectedModel] || 0;
                if (modelLimit > 0 && modelCount >= modelLimit) {
                    var modelNames = {
                        'flash': 'Flash', 'flash-thinking': 'Flash Thinking',
                        'pro': 'Pro', 'sonnet': 'Sonnet', 'opus': 'Opus'
                    };
                    var displayName = modelNames[selectedModel] || selectedModel;
                    var errorHtml = '<p class="error-text">Daily limit reached for ' + displayName +
                        ' (' + modelCount + '/' + modelLimit + ') \u2014 resets at midnight PT.</p>' +
                        '<button type="button" class="retry-btn" id="retry-btn">Try Again</button>';
                    // Use the full submit flow so the error displays in the results area
                    compactInput();
                    if (!resultsShowing) nudgeHistoryDown();
                    beginLoading();
                    // Short delay to let loading state render, then show error
                    setTimeout(function () {
                        showResults(errorHtml, true);
                        var retryBtn = document.getElementById('retry-btn');
                        if (retryBtn) {
                            retryBtn.addEventListener('click', function () {
                                submitEstimate(payload);
                            });
                        }
                    }, 300);
                    return;
                }
            }

            submitEstimate(payload);
        });
    }

    // ── Prompt dialog ──

    var promptDialog = document.getElementById('prompt-dialog');
    var promptDialogText = document.getElementById('prompt-dialog-text');
    var promptDialogClose = document.getElementById('prompt-dialog-close');
    var promptCopyBtn = document.getElementById('prompt-copy-btn');
    var promptCopyLabel = document.getElementById('prompt-copy-label');
    var promptRepromptBtn = document.getElementById('prompt-reprompt-btn');
    var activePromptText = '';

    function openPromptDialog(text) {
        if (!promptDialog || !text) return;
        activePromptText = text;
        promptDialogText.textContent = text;
        if (promptCopyLabel) promptCopyLabel.textContent = 'Copy';
        promptDialog.showModal();
    }

    if (promptDialogClose && promptDialog) {
        promptDialogClose.addEventListener('click', function () {
            promptDialog.close();
        });
    }

    if (promptDialog) {
        promptDialog.addEventListener('click', function (e) {
            if (e.target === promptDialog) promptDialog.close();
        });
    }

    if (promptCopyBtn) {
        promptCopyBtn.addEventListener('click', function () {
            if (!activePromptText) return;
            navigator.clipboard.writeText(activePromptText).then(function () {
                if (promptCopyLabel) {
                    promptCopyLabel.textContent = 'Copied!';
                    setTimeout(function () { promptCopyLabel.textContent = 'Copy'; }, 1500);
                }
            });
        });
    }

    if (promptRepromptBtn) {
        promptRepromptBtn.addEventListener('click', function () {
            if (!activePromptText || !foodInput) return;
            if (promptDialog) promptDialog.close();
            expandInput();
            foodInput.value = activePromptText;
            foodInput.style.height = 'auto';
            foodInput.style.height = Math.max(80, foodInput.scrollHeight) + 'px';
            foodInput.focus();
        });
    }

    // ── Results beard actions ──

    if (resultsPromptBtn) {
        resultsPromptBtn.addEventListener('click', function () {
            if (currentResultPrompt) {
                openPromptDialog(currentResultPrompt);
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
        // Temporarily hide hero/beard that may have been set before this call
        // so we measure only the loading-state height
        if (calorieHero) calorieHero.classList.add('hidden');
        if (resultsBeard) resultsBeard.classList.add('hidden');

        // Capture loading height (just spinner + padding)
        var loadingHeight = parseFloat(getComputedStyle(resultsSection).height) || resultsSection.offsetHeight;
        clearResultsAnimation();
        resultsSection.classList.remove('results-loading');

        var growDuration = Math.round(MORPH_DURATION * 0.625);
        var staggerBase = Math.round(MORPH_DURATION * 0.1875);
        var staggerStep = Math.round(MORPH_DURATION * 0.1);
        var revealDuration = Math.round(MORPH_DURATION * 0.375);

        // Lock the section at loading height while we swap content
        resultsSection.style.height = loadingHeight + 'px';
        resultsSection.style.overflow = 'hidden';

        // Hide loading state before measuring naturalHeight
        if (loadingState) loadingState.classList.add('hidden');

        // Swap in new content
        resultsContent.innerHTML = html;
        resultsSection.classList.remove('hidden');

        // Restore hero/beard visibility (they were hidden for loading measurement)
        // Then set them to opacity:0 for stagger reveal
        if (isError) {
            if (calorieHero) calorieHero.classList.add('hidden');
        } else {
            if (calorieHero) calorieHero.classList.remove('hidden');
        }
        // Un-hide beard now so naturalHeight includes it
        // (submitEstimate also un-hides it, but we need it for measurement)
        if (resultsBeard && !isError) resultsBeard.classList.remove('hidden');

        var currentHeight = loadingHeight;

        // Hide content items for stagger reveal (invisible but taking space)
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

        // Temporarily unlock height to measure natural size (loading hidden, all content at opacity:0 but occupying space)
        resultsSection.style.height = '';
        var naturalHeight = resultsSection.offsetHeight;
        // Re-lock at current height for smooth animation
        resultsSection.style.height = currentHeight + 'px';

        // Phase 2 function: Stagger-reveal content line by line
        function revealContent() {
            resultsSection.style.overflow = '';
            resultsSection.style.transformOrigin = '';

            // Calorie hero first
            if (calorieHero && !calorieHero.classList.contains('hidden')) {
                calorieHero.style.transition = 'opacity ' + revealDuration + 'ms ease, transform ' + revealDuration + 'ms ease';
                calorieHero.style.opacity = '1';
                calorieHero.style.transform = 'translateY(0)';
            }

            // Then each result line staggered
            for (var j = 0; j < allItems.length; j++) {
                (function (item, delay) {
                    setTimeout(function () {
                        item.style.transition = 'opacity ' + revealDuration + 'ms ease, transform ' + revealDuration + 'ms ease';
                        item.style.opacity = '1';
                        item.style.transform = 'translateY(0)';
                    }, delay);
                })(allItems[j], staggerBase + j * staggerStep);
            }

            // Beard last
            if (resultsBeard && !resultsBeard.classList.contains('hidden')) {
                setTimeout(function () {
                    resultsBeard.style.transition = 'opacity ' + revealDuration + 'ms ease';
                    resultsBeard.style.opacity = '1';
                }, staggerBase + allItems.length * staggerStep);
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
            }, revealDuration + staggerBase + allItems.length * staggerStep);
        }

        // Phase 1: Grow card from loading height to natural results height
        resultsSection.style.overflow = 'hidden';
        resultsSection.style.transformOrigin = 'top center';

        if (Math.abs(currentHeight - naturalHeight) > 2) {
            // Use ease-out (no overshoot) for height — spring easing overshoots
            // which makes the card grow beyond its final size
            var growAnim = resultsSection.animate([
                { height: currentHeight + 'px' },
                { height: naturalHeight + 'px' }
            ], {
                duration: growDuration,
                easing: 'cubic-bezier(0.0, 0, 0.2, 1)',
            });
            growAnim.onfinish = function () {
                resultsSection.style.height = '';
                revealContent();
            };
        } else {
            resultsSection.style.height = '';
            revealContent();
        }

        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ── Clicking compact input expands for editing ──

    var isCompactClickable = false;

    if (inputCard) {
        inputCard.addEventListener('click', function (e) {
            if (!isCompactClickable) return;
            if (e.target.closest('.toolbar-btn') || e.target.closest('.submit-pill') ||
                e.target.closest('.model-select') || e.target.closest('.compact-clear-btn')) return;

            isCompactClickable = false;

            // Step 1: Expand input
            expandInput();
            lastResultText = '';

            // Step 2: Quick swap — skip the slow Phase 1 fade/collapse.
            // Just hide results and shift history down.
            quickMorphToHistory();

            if (loadingState) loadingState.classList.add('hidden');
            if (foodInput) {
                setTimeout(function () {
                    foodInput.focus();
                    foodInput.style.height = 'auto';
                    foodInput.style.height = Math.max(80, foodInput.scrollHeight) + 'px';
                }, 100);
            }
        });

        // Restart button — clear input and expand (fresh start)
        var compactClearBtn = inputCard.querySelector('.compact-clear-btn');
        if (compactClearBtn) {
            compactClearBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (!inputCard.classList.contains('compact')) return;

                isCompactClickable = false;

                // Clear all input state
                if (foodInput) {
                    foodInput.value = '';
                    foodInput.style.height = '';
                }
                currentApiImage = null;
                currentThumbnail = null;
                if (photoInput) photoInput.value = '';
                if (photoPreview) photoPreview.classList.add('hidden');
                if (photoPreviewImg) photoPreviewImg.src = '';
                lastResultText = '';

                expandInput();
                quickMorphToHistory();

                if (loadingState) loadingState.classList.add('hidden');
                if (foodInput) {
                    setTimeout(function () { foodInput.focus(); }, 100);
                }
            });
        }
    }

    // Quick morph for edit-expand: skip the slow Phase 1 fade/collapse.
    // Just hide results, render history, and do the tracked-treads shift.
    // No content fade-out, no height collapse — instant swap + slide.
    function quickMorphToHistory() {
        if (!resultsSection || resultsSection.classList.contains('hidden')) return;

        // Cancel any running collapse animation
        if (resultsCollapseAnim) {
            resultsCollapseAnim.cancel();
            resultsCollapseAnim = null;
        }

        // Hide results immediately
        resultsSection.classList.add('hidden');
        resultsSection.classList.remove('morphing');
        resultsSection.style.height = '';
        resultsSection.style.padding = '';
        resultsSection.style.borderRadius = '';
        resultsSection.style.opacity = '';
        resultsSection.style.transform = '';
        // Clean content states
        [calorieHero, resultsContent, resultsBeard].forEach(function (el) {
            if (el) { el.style.transition = ''; el.style.opacity = ''; }
        });
        var oldSummary = resultsSection.querySelector('.results-morph-summary');
        if (oldSummary) oldSummary.remove();

        // Render history and animate
        resultsShowing = false;
        renderHistory();
        var historySection = document.getElementById('history');
        if (historySection) historySection.classList.remove('hidden');
        shiftHistoryDown();
    }

    var resultsCollapseAnim = null;

    function morphResultToHistory(callback) {
        if (!resultsSection || resultsSection.classList.contains('hidden')) {
            callback();
            return;
        }

        var history = getHistory();
        if (history.length === 0) { callback(); return; }
        var newestEntry = history[0];
        var historyList = document.getElementById('history-list');

        // ── Phase 1: Collapse results card ──
        // Fade out detailed content, shrink to history-card height
        var startHeight = resultsSection.offsetHeight;
        var targetHeight = 48;
        var collapseDuration = Math.round(MORPH_DURATION * 0.6);

        resultsSection.classList.add('morphing');

        // Fade out content
        var contentEls = [calorieHero, resultsContent, resultsBeard].filter(function (el) { return el; });
        for (var c = 0; c < contentEls.length; c++) {
            contentEls[c].style.transition = 'opacity ' + Math.round(collapseDuration * 0.4) + 'ms ease';
            contentEls[c].style.opacity = '0';
        }

        // Build and insert summary overlay
        var foodNames = extractFoodNames(newestEntry.gemini_response);
        var summaryText = foodNames.length > 0 ? foodNames.join(', ') : (newestEntry.input_text || 'Meal');
        var entryRange = parseTotalRange(newestEntry.gemini_response);
        var summaryHtml = '<div class="results-morph-summary">';
        if (newestEntry.thumbnail) {
            summaryHtml += '<img style="width:32px;height:32px;border-radius:var(--radius-sm);flex-shrink:0;" src="' + newestEntry.thumbnail + '" alt="">';
        }
        summaryHtml += '<span class="history-entry-food-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(summaryText) + '</span>';
        if (entryRange) {
            summaryHtml += '<span class="history-entry-calories">' + entryRange.low + ' ~ ' + entryRange.high + '</span>';
        }
        summaryHtml += '</div>';
        var summaryEl = document.createElement('div');
        summaryEl.innerHTML = summaryHtml;
        summaryEl = summaryEl.firstElementChild;
        resultsSection.appendChild(summaryEl);

        // Fade in summary at 40%
        setTimeout(function () {
            summaryEl.style.transition = 'opacity ' + Math.round(collapseDuration * 0.5) + 'ms ease';
            summaryEl.style.opacity = '1';
        }, Math.round(collapseDuration * 0.4));

        // Animate height collapse
        resultsCollapseAnim = resultsSection.animate([
            { height: startHeight + 'px', padding: 'var(--spacing-md)', borderRadius: 'var(--radius-lg)' },
            { height: targetHeight + 'px', padding: 'var(--spacing-sm) var(--spacing-md)', borderRadius: 'var(--radius-md)' }
        ], {
            duration: collapseDuration,
            easing: ANIM_EASING,
        });

        // ── Phase 2: At collapse end, swap into history and animate ──
        resultsCollapseAnim.onfinish = function () {
            resultsCollapseAnim = null;

            // Hide results, clean up
            resultsSection.classList.add('hidden');
            resultsSection.classList.remove('morphing');
            resultsSection.style.height = '';
            resultsSection.style.padding = '';
            resultsSection.style.borderRadius = '';
            if (summaryEl.parentNode) summaryEl.remove();
            for (var c = 0; c < contentEls.length; c++) {
                contentEls[c].style.transition = '';
                contentEls[c].style.opacity = '';
            }

            // Render history with the new card at the top
            resultsShowing = false;
            renderHistory();
            if (historySection) historySection.classList.remove('hidden');

            // Tracked-treads: whole list slides down one slot, new card fades in
            shiftHistoryDown();

            // Wait for shift animation to finish before showing loading
            setTimeout(callback, Math.round(MORPH_DURATION * 0.7));
        };
    }

    function clearResultsAnimation() {
        if (resultsCollapseAnim) {
            resultsCollapseAnim.cancel();
            resultsCollapseAnim = null;
        }
        if (loadingGrowAnim) {
            loadingGrowAnim.cancel();
            loadingGrowAnim = null;
        }
        if (resultsSection) {
            resultsSection.classList.remove('morphing');
            resultsSection.style.overflow = '';
            resultsSection.style.transformOrigin = '';
            resultsSection.style.height = '';
            resultsSection.style.padding = '';
            resultsSection.style.borderRadius = '';
            resultsSection.style.opacity = '';
            resultsSection.style.transform = '';
            // Remove any leftover summary overlay
            var oldSummary = resultsSection.querySelector('.results-morph-summary');
            if (oldSummary) oldSummary.remove();
        }
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
        h += '<div class="history-entry" data-index="' + i + '" data-timestamp="' + escapeHtml(entry.timestamp) + '">';

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
            h += '<button type="button" class="history-beard-btn history-show-prompt-btn" data-entry-index="' + i + '" aria-label="Show prompt" data-tooltip="Prompt">';
            h += '<span class="material-symbols-outlined">description</span></button>';
        }
        h += '<button type="button" class="history-beard-btn history-archive-btn" data-entry-index="' + i + '" aria-label="Archive" data-tooltip="Archive">';
        h += '<span class="material-symbols-outlined">archive</span></button>';
        h += '</div>';
        h += '</div>';

        h += '</div>';
        return h;
    }

    // Helper: create a DOM element from buildEntryHtml string
    function createEntryElement(entry, index) {
        var tmp = document.createElement('div');
        tmp.innerHTML = buildEntryHtml(entry, index);
        var el = tmp.firstElementChild;
        // Store timestamp for identity matching
        el.setAttribute('data-timestamp', entry.timestamp);
        return el;
    }

    // Helper: bind events on a single history entry element
    function bindSingleEntryEvents(entryEl) {
        entryEl.addEventListener('click', function (e) {
            if (e.target.closest('.history-beard-btn')) return;
            this.classList.toggle('expanded');
        });

        var promptBtn = entryEl.querySelector('.history-show-prompt-btn');
        if (promptBtn) {
            promptBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var idx = parseInt(this.getAttribute('data-entry-index'), 10);
                var history = getHistory();
                if (history[idx] && history[idx].input_text) {
                    openPromptDialog(history[idx].input_text);
                }
            });
        }

        var archiveBtn = entryEl.querySelector('.history-archive-btn');
        if (archiveBtn) {
            archiveBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var idx = parseInt(this.getAttribute('data-entry-index'), 10);
                archiveEntry(idx);
            });
        }
    }

    function renderHistory(options) {
        options = options || {};
        var skipNewest = options.skipNewest || false; // when morph handles the newest card
        var historyList = document.getElementById('history-list');
        if (!historyList) return;

        var history = getHistory();
        var startIndex = resultsShowing ? 1 : 0;
        if (skipNewest && startIndex === 0) startIndex = 1;

        if (history.length === 0 || (startIndex >= history.length)) {
            historyList.innerHTML = '';
            if (historySection) historySection.classList.add('hidden');
            return;
        }

        if (historySection) historySection.classList.remove('hidden');

        // Build list of timestamps that should be in the normal (non-stack) area
        var normalEnd = historyShowAll ? history.length : Math.min(history.length, startIndex + STACK_AFTER);
        var wantedTimestamps = [];
        for (var i = startIndex; i < normalEnd; i++) {
            wantedTimestamps.push(history[i].timestamp);
        }

        // Get existing entry elements (not stack containers)
        var existingEntries = historyList.querySelectorAll(':scope > .history-entry');
        var existingMap = {};
        for (var e = 0; e < existingEntries.length; e++) {
            var ts = existingEntries[e].getAttribute('data-timestamp');
            if (ts) existingMap[ts] = existingEntries[e];
        }

        // Remove the stack section if present (will rebuild if needed)
        var oldStack = historyList.querySelector('.history-stack');
        if (oldStack) oldStack.remove();

        // Remove entries no longer in the normal range
        for (var ts in existingMap) {
            if (wantedTimestamps.indexOf(ts) === -1) {
                existingMap[ts].remove();
                delete existingMap[ts];
            }
        }

        // Insert/reorder normal entries
        var prevSibling = null;
        for (var w = 0; w < wantedTimestamps.length; w++) {
            var wantTs = wantedTimestamps[w];
            var dataIndex = startIndex + w;
            var entryEl;

            if (existingMap[wantTs]) {
                entryEl = existingMap[wantTs];
                // Update data-index in case it shifted
                entryEl.setAttribute('data-index', dataIndex);
            } else {
                // New entry — create and insert
                entryEl = createEntryElement(history[dataIndex], dataIndex);
                bindSingleEntryEvents(entryEl);
            }

            // Ensure correct order: should come after prevSibling
            if (prevSibling) {
                if (entryEl.previousElementSibling !== prevSibling) {
                    prevSibling.after(entryEl);
                }
            } else {
                if (historyList.firstElementChild !== entryEl) {
                    historyList.prepend(entryEl);
                }
            }
            prevSibling = entryEl;
        }

        // Build stack section if needed (still uses innerHTML since structural)
        if (!historyShowAll) {
            var stackStart = startIndex + STACK_AFTER;
            if (stackStart < history.length) {
                var stackedCount = history.length - stackStart;
                var html = '';
                html += '<div class="history-stack" id="history-stack">';
                html += '<div class="history-stack-cards">';
                html += '<div class="history-stack-item" style="--layer: 0;">';
                html += buildEntryHtml(history[stackStart], stackStart);
                html += '</div>';

                var stackVisible = Math.min(stackedCount, 3);
                if (stackVisible > 1) {
                    html += '<div class="history-stack-rest" id="history-stack-rest">';
                    for (var s = 1; s < stackVisible; s++) {
                        var stackIdx = stackStart + s;
                        html += '<div class="history-stack-item" style="--layer: ' + s + ';">';
                        html += buildEntryHtml(history[stackIdx], stackIdx);
                        html += '</div>';
                    }
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

                var stackTmp = document.createElement('div');
                stackTmp.innerHTML = html;
                var stackEl = stackTmp.firstElementChild;
                historyList.appendChild(stackEl);

                // Bind events on stack entries
                var stackEntries = stackEl.querySelectorAll('.history-entry');
                for (var se = 0; se < stackEntries.length; se++) {
                    bindSingleEntryEvents(stackEntries[se]);
                }

                var stackRestEl = document.getElementById('history-stack-rest');
                var stackExpandBtn = document.getElementById('history-stack-expand');
                var expandStack = function (ev) {
                    ev.stopPropagation();
                    animateStackExpand();
                };
                if (stackRestEl) stackRestEl.addEventListener('click', expandStack);
                if (stackExpandBtn) stackExpandBtn.addEventListener('click', expandStack);
            }
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

    if (!loginDialog) loginDialog = document.getElementById('login-dialog');
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
