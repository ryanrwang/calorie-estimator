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
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
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

    // Close dropdowns on outside click
    document.addEventListener('click', function () {
        if (profileMenu) profileMenu.classList.add('hidden');
        if (modelDropdown) modelDropdown.classList.add('hidden');
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

    // ── Usage indicator ──

    var usageIndicator = document.getElementById('usage-indicator');

    function updateUsageDisplay(usage) {
        if (!usageIndicator || !usage) return;

        var bucket = getUsageBucket(selectedModel);
        var count = usage[bucket] || 0;
        var html = '';

        if (bucket === 'flash') {
            var cls = count >= 230 ? ' usage-warn' : '';
            html = '<span class="usage-text' + cls + '">' + count + '/250 Flash today</span>';
        } else if (bucket === 'pro') {
            var cls = count >= 85 ? ' usage-warn' : '';
            html = '<span class="usage-text' + cls + '">' + count + '/100 Pro today</span>';
        } else if (bucket === 'claude') {
            html = '<span class="usage-text">' + count + ' Claude today</span>';
        }

        usageIndicator.innerHTML = html;
        usageIndicator.classList.remove('hidden');
    }

    function getUsageBucket(model) {
        if (model === 'flash' || model === 'flash-thinking') return 'flash';
        if (model === 'pro') return 'pro';
        if (model === 'sonnet' || model === 'opus') return 'claude';
        return 'flash';
    }

    // ── Copy to clipboard ──

    var copyBtn = document.getElementById('copy-btn');
    var copyText = document.getElementById('copy-text');
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

    function copyForLoseIt() {
        if (!lastResultText) return;
        var items = parseMidpointList(lastResultText);
        var copyString = items.length > 0 ? items.join('\n') : lastResultText.trim();

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(copyString).then(function () {
                showCopyConfirmation();
            }, function () {
                showCopyConfirmation();
            });
        }
    }

    function showCopyConfirmation() {
        if (!copyText || !copyBtn) return;
        copyText.textContent = 'Copied!';
        copyBtn.classList.add('action-btn-success');
        setTimeout(function () {
            copyText.textContent = 'Copy for LoseIt';
            copyBtn.classList.remove('action-btn-success');
        }, 1500);
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', copyForLoseIt);
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
    var newEstimateBtn = document.getElementById('new-estimate-btn');

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
    if (foodInput) {
        foodInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.max(80, this.scrollHeight) + 'px';
        });
    }

    // Track last payload for retry
    var lastPayload = null;

    function collapseInput() {
        if (!inputCard) return;
        // Set explicit max-height before collapsing for smooth transition
        inputCard.style.maxHeight = inputCard.scrollHeight + 'px';
        // Force reflow
        inputCard.offsetHeight;
        inputCard.classList.add('collapsed');
    }

    function expandInput() {
        if (!inputCard) return;
        inputCard.classList.remove('collapsed');
        inputCard.style.maxHeight = '';
    }

    function submitEstimate(payload) {
        lastPayload = payload;

        // Collapse input, show loading
        collapseInput();
        if (loadingState) loadingState.classList.remove('hidden');
        resultsSection.classList.add('hidden');

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
                showResults(formatResponse(data.result), false);

                saveToHistory({
                    timestamp: new Date().toISOString(),
                    input_type: currentApiImage ? 'photo' : 'text',
                    input_text: payload.text || '',
                    thumbnail: currentThumbnail,
                    gemini_response: data.result,
                    model_used: data.model || 'flash',
                });

                // Auto-collapse history when results arrive
                collapseHistory();
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

    function showResults(html, isError) {
        resultsContent.innerHTML = html;
        resultsSection.classList.remove('hidden');
        if (copyBtn) {
            if (isError) {
                copyBtn.classList.add('hidden');
            } else {
                copyBtn.classList.remove('hidden');
            }
        }
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ── New estimate button ──

    if (newEstimateBtn) {
        newEstimateBtn.addEventListener('click', function () {
            expandInput();
            resultsSection.classList.add('hidden');
            if (loadingState) loadingState.classList.add('hidden');

            // Clear inputs
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

            // Focus textarea
            if (foodInput) {
                setTimeout(function () { foodInput.focus(); }, 100);
            }

            // Re-expand history
            expandHistory();
        });
    }

    function formatResponse(text) {
        var lines = text.split('\n');
        var html = '';
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            if (/^total/i.test(line)) {
                html += '<p class="result-line result-total">' + escapeHtml(line) + '</p>';
            } else {
                html += '<p class="result-line">' + escapeHtml(line) + '</p>';
            }
        }
        return html;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── History toggle ──

    var historyToggle = document.getElementById('history-toggle');
    var historyCollapsible = document.getElementById('history-collapsible');
    var historySection = document.getElementById('history');

    function collapseHistory() {
        if (historyCollapsible) historyCollapsible.classList.remove('expanded');
        if (historySection) historySection.classList.remove('expanded');
    }

    function expandHistory() {
        if (historyCollapsible) historyCollapsible.classList.add('expanded');
        if (historySection) historySection.classList.add('expanded');
    }

    function toggleHistory() {
        if (historyCollapsible) historyCollapsible.classList.toggle('expanded');
        if (historySection) historySection.classList.toggle('expanded');
    }

    if (historyToggle) {
        historyToggle.addEventListener('click', function (e) {
            // Don't toggle if clicking the clear button
            if (e.target.closest('#clear-history')) return;
            toggleHistory();
        });
    }

    // Start history expanded
    if (historySection) historySection.classList.add('expanded');

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

    function renderHistory() {
        var historyList = document.getElementById('history-list');
        var clearBtn = document.getElementById('clear-history');
        if (!historyList) return;

        var history = getHistory();

        if (history.length === 0) {
            historyList.innerHTML = '<p class="history-empty">No estimates yet.</p>';
            if (clearBtn) clearBtn.classList.add('hidden');
            return;
        }

        if (clearBtn) clearBtn.classList.remove('hidden');

        var html = '';
        for (var i = 0; i < history.length; i++) {
            var entry = history[i];
            var date = new Date(entry.timestamp);
            var dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            var timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

            html += '<div class="history-entry">';
            html += '<div class="history-entry-header">';

            if (entry.thumbnail) {
                html += '<img class="history-thumb" src="' + entry.thumbnail + '" alt="Meal photo">';
            }

            html += '<div class="history-entry-meta">';
            html += '<span class="history-date">' + escapeHtml(dateStr + ' ' + timeStr) + '</span>';
            if (entry.input_text) {
                html += '<span class="history-input-text">' + escapeHtml(entry.input_text) + '</span>';
            }
            html += '</div>';
            html += '</div>';

            html += '<div class="history-response">';
            html += formatResponse(entry.gemini_response);
            html += '</div>';
            html += '</div>';
        }

        historyList.innerHTML = html;
    }

    var clearHistoryBtn = document.getElementById('clear-history');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (confirm('Clear all history?')) {
                try { localStorage.removeItem(HISTORY_KEY); } catch (e) { /* noop */ }
                renderHistory();
            }
        });
    }

    // Render history on page load
    pruneHistoryIfNeeded();
    renderHistory();

})();
