(function () {
    'use strict';

    // ── Theme toggle ──

    var THEME_KEY = 'calorie-estimator-theme';
    var HISTORY_KEY = 'calorie-estimator-history';

    function getStoredTheme() {
        try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* noop */ }
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

    initTheme();

    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

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
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // ── Model toggle ──

    var selectedModel = 'flash';
    var modelToggle = document.getElementById('model-toggle');

    if (modelToggle) {
        var pills = modelToggle.querySelectorAll('.model-pill');
        for (var i = 0; i < pills.length; i++) {
            pills[i].addEventListener('click', function () {
                for (var j = 0; j < pills.length; j++) {
                    pills[j].classList.remove('active');
                }
                this.classList.add('active');
                selectedModel = this.getAttribute('data-model');
            });
        }
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

    var currentApiImage = null;   // base64 at 1024px for API
    var currentThumbnail = null;  // base64 at 200px for history

    if (photoInput) {
        photoInput.addEventListener('change', function () {
            var file = photoInput.files[0];
            if (!file) return;

            // Compress for API (1024px)
            compressImage(file, 1024, 0.8, function (apiImage) {
                currentApiImage = apiImage;
            });

            // Generate thumbnail (200px)
            compressImage(file, 200, 0.6, function (thumb) {
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

    // Auto-resize textarea
    if (foodInput) {
        foodInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
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

            // Show loading state
            submitBtn.disabled = true;
            submitText.textContent = 'Estimating...';
            submitSpinner.classList.remove('hidden');
            resultsSection.classList.add('hidden');

            var payload = {
                csrf_token: csrfToken,
                text: text,
                model: selectedModel,
            };

            if (currentApiImage) {
                payload.image = currentApiImage;
                payload.thumbnail = currentThumbnail;
            }

            fetch('api/estimate.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.error) {
                    showResults('<p class="error-text">' + escapeHtml(data.error) + '</p>');
                } else {
                    showResults(formatResponse(data.result));

                    // Save to localStorage history
                    saveToHistory({
                        timestamp: new Date().toISOString(),
                        input_type: currentApiImage ? 'photo' : 'text',
                        input_text: text,
                        thumbnail: currentThumbnail,
                        gemini_response: data.result,
                        model_used: data.model || 'flash',
                    });
                }
            })
            .catch(function (err) {
                showResults('<p class="error-text">Something went wrong. Please try again.</p>');
            })
            .finally(function () {
                submitBtn.disabled = false;
                submitText.textContent = 'Estimate Calories';
                submitSpinner.classList.add('hidden');
            });
        });
    }

    function showResults(html) {
        resultsContent.innerHTML = html;
        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function formatResponse(text) {
        // Convert plain text response to HTML
        var lines = text.split('\n');
        var html = '';
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            html += '<p class="result-line">' + escapeHtml(line) + '</p>';
        }
        return html;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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
        var history = getHistory();
        history.unshift(entry);
        // Keep max 50 entries to avoid localStorage limits
        if (history.length > 50) {
            history = history.slice(0, 50);
        }
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            // localStorage full — remove oldest entries and retry
            history = history.slice(0, 25);
            try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e2) { /* give up */ }
        }
        renderHistory();
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
        clearHistoryBtn.addEventListener('click', function () {
            if (confirm('Clear all history?')) {
                try { localStorage.removeItem(HISTORY_KEY); } catch (e) { /* noop */ }
                renderHistory();
            }
        });
    }

    // Render history on page load
    renderHistory();

})();
