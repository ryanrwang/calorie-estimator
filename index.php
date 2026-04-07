<?php
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/includes/csrf.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/mock.php';
$mockMode = is_mock_mode();
$csrfToken = csrf_generate();
$loggedIn = is_logged_in();
$username = get_current_username();

// Handle logout
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    logout_user();
    header('Location: index.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Carole &mdash; The calorie estimator</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <!-- Floating controls -->
    <div class="floating-controls entrance">
        <div class="settings-dropdown" id="settings-dropdown">
            <button class="fab-btn" type="button" id="settings-btn" aria-label="Settings" data-tooltip="Settings">
                <span class="material-symbols-outlined">settings</span>
            </button>
            <div class="settings-menu hidden" id="settings-menu">
                <button type="button" class="settings-menu-item" id="settings-theme-toggle">
                    <span class="material-symbols-outlined theme-icon">light_mode</span> <span id="settings-theme-label">Use dark mode</span>
                </button>
                <button type="button" class="settings-menu-item" id="settings-debug-toggle">
                    <span class="material-symbols-outlined">bug_report</span> <span id="settings-mock-label"><?php echo $mockMode ? 'Disable mock mode' : 'Enable mock mode'; ?></span>
                </button>
                <div class="settings-menu-divider"></div>
                <?php if ($loggedIn): ?>
                <span class="settings-menu-username"><?php echo htmlspecialchars($username, ENT_QUOTES, 'UTF-8'); ?></span>
                <a href="history.php" class="settings-menu-item">
                    <span class="material-symbols-outlined">history</span> History
                </a>
                <?php endif; ?>
                <!-- Hidden for now — uncomment to restore
                <button type="button" class="settings-menu-item settings-menu-danger" id="settings-clear-history">
                    <span class="material-symbols-outlined">delete_sweep</span> Clear history
                </button>
                -->
                <?php if ($loggedIn): ?>
                <a href="index.php?action=logout" class="settings-menu-item settings-menu-danger">
                    <span class="material-symbols-outlined">logout</span> Log out
                </a>
                <?php else: ?>
                <button type="button" class="settings-menu-item" id="settings-login-btn">
                    <span class="material-symbols-outlined">login</span> Log in
                </button>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <main class="app-main">
        <!-- Brand hero -->
        <div class="page-hero entrance">
            <h1 class="brand-title">Carole</h1>
            <?php if ($mockMode): ?>
            <div class="mock-controls">
                <p class="brand-subtitle mock-subtitle">MOCK MODE</p>
                <button type="button" id="mock-exit-btn" class="mock-exit-btn" data-tooltip="Exit mock mode">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <?php else: ?>
            <p class="brand-subtitle">The calorie estimator</p>
            <?php endif; ?>
        </div>

        <!-- Estimation form -->
        <form id="estimate-form" class="estimate-form" autocomplete="off">
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8'); ?>">

            <div class="input-card entrance" id="input-card">
                <textarea
                    id="food-input"
                    class="food-input"
                    name="text"
                    rows="2"
                    placeholder="What did you eat? e.g. Big Mac with fries and a Coke"
                    aria-label="Describe what you ate"
                ></textarea>

                <div class="compact-text-overlay" id="compact-text-overlay"></div>
                <div class="compact-actions" id="compact-actions">
                    <div id="compact-usage-ring" class="usage-ring-wrap">
                        <svg class="usage-ring" viewBox="0 0 32 32" width="32" height="32">
                            <circle class="usage-ring-track" cx="16" cy="16" r="13" />
                            <circle class="usage-ring-fill compact-ring-fill" cx="16" cy="16" r="13" />
                        </svg>
                        <span class="usage-ring-count compact-ring-count"></span>
                        <span class="usage-ring-tooltip" id="compact-usage-tooltip"></span>
                    </div>
                    <button type="button" class="compact-clear-btn" aria-label="Restart" data-tooltip="Restart">
                        <span class="material-symbols-outlined">restart_alt</span>
                    </button>
                </div>

                <div id="photo-preview" class="photo-preview hidden">
                    <img id="photo-preview-img" class="photo-preview-img" alt="Meal photo preview">
                    <button type="button" id="photo-remove" class="photo-remove" aria-label="Remove photo" data-tooltip="Remove photo">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div class="input-toolbar">
                    <label class="toolbar-btn" aria-label="Upload a meal photo" data-tooltip="Photo">
                        <span class="material-symbols-outlined">photo_camera</span>
                        <input
                            type="file"
                            id="photo-input"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            class="visually-hidden"
                        >
                    </label>

                    <?php if ($loggedIn): ?>
                    <div class="model-select" id="model-select">
                        <button type="button" class="toolbar-btn model-select-trigger" id="model-select-trigger" data-tooltip="Model">
                            <span class="material-symbols-outlined">chef_hat</span>
                            <span class="model-select-label" id="model-select-label">Flash</span>
                        </button>
                        <div class="model-dropdown hidden" id="model-dropdown">
                            <div class="model-dropdown-group">
                                <span class="model-dropdown-group-label">Gemini</span>
                                <button type="button" class="model-option active" data-model="flash">Flash</button>
                                <button type="button" class="model-option" data-model="flash-thinking">Thinking</button>
                                <button type="button" class="model-option" data-model="pro">Pro <span class="model-option-note">100/day</span></button>
                            </div>
                            <div class="model-dropdown-divider"></div>
                            <div class="model-dropdown-group">
                                <span class="model-dropdown-group-label">Claude</span>
                                <button type="button" class="model-option" data-model="sonnet">Sonnet <span class="model-option-note">paid</span></button>
                                <button type="button" class="model-option" data-model="opus">Opus <span class="model-option-note">paid</span></button>
                            </div>
                        </div>
                    </div>
                    <?php endif; ?>

                    <div class="toolbar-spacer"></div>

                    <div id="usage-ring-wrap" class="usage-ring-wrap">
                        <svg class="usage-ring" viewBox="0 0 32 32" width="32" height="32">
                            <circle class="usage-ring-track" cx="16" cy="16" r="13" />
                            <circle id="usage-ring-fill" class="usage-ring-fill" cx="16" cy="16" r="13" />
                        </svg>
                        <span id="usage-ring-count" class="usage-ring-count"></span>
                        <span id="usage-ring-tooltip" class="usage-ring-tooltip"></span>
                    </div>

                    <button type="submit" id="submit-btn" class="submit-pill">
                        <span id="submit-text">Estimate</span>
                        <span id="submit-spinner" class="spinner hidden" aria-hidden="true"></span>
                    </button>
                </div>
            </div>
        </form>

        <!-- Results area (also used for loading state) -->
        <section id="results" class="results hidden" aria-live="polite">
            <div id="calorie-hero" class="calorie-hero hidden"></div>
            <div id="loading-state" class="loading-state hidden">
                <div class="loading-spinner-large"></div>
                <p class="loading-text">Estimating calories...</p>
            </div>
            <div id="results-content" class="results-content"></div>
            <div id="results-beard" class="results-beard hidden">
                <span id="results-beard-date" class="history-date"></span>
                <div class="history-beard-actions">
                    <button type="button" class="history-beard-btn" id="results-show-prompt-btn" aria-label="Show prompt" data-tooltip="Prompt">
                        <span class="material-symbols-outlined">description</span>
                    </button>
                    <button type="button" class="history-beard-btn" id="results-archive-btn" aria-label="Archive" data-tooltip="Archive">
                        <span class="material-symbols-outlined">archive</span>
                    </button>
                </div>
            </div>
        </section>

        <!-- Local history -->
        <section id="history" class="history-section hidden entrance">
            <div id="history-list" class="history-list"></div>
        </section>
    </main>

    <footer class="app-footer">
        <a href="/apps/" title="Back to Apps" class="rw-back-link">
            <img src="/images/icon-rw.svg" alt="Back to Apps" class="rw-back-logo">
        </a>
    </footer>

    <?php if (!$loggedIn): ?>
    <dialog id="login-dialog" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Log In</h2>
                <button type="button" class="modal-close" id="login-close-btn" aria-label="Close">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>

            <div id="login-error" class="login-error hidden"></div>

            <!-- Step 1: Passphrase -->
            <div id="login-step-passphrase">
                <div class="login-form">
                    <div class="login-passphrase-wrapper">
                        <input
                            type="password"
                            id="login-passphrase"
                            class="login-input"
                            placeholder="Passphrase"
                            autocomplete="off"
                        >
                        <button type="button" id="login-toggle-pass" class="login-toggle-visibility" aria-label="Toggle passphrase visibility" data-tooltip="Show/Hide password">
                            <span class="material-symbols-outlined" id="login-toggle-pass-icon">visibility</span>
                        </button>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" id="login-passphrase-btn" class="modal-btn modal-btn-primary">Continue</button>
                </div>
            </div>

            <!-- Step 2: Username selection/creation -->
            <div id="login-step-username" class="hidden">
                <p class="login-subtitle">Choose a username or create a new one.</p>
                <div id="login-user-list" class="login-form login-user-list"></div>
                <div id="login-divider" class="login-divider hidden"><span>or</span></div>
                <div class="login-form">
                    <label class="login-label" for="login-new-username">New username</label>
                    <input
                        type="text"
                        id="login-new-username"
                        class="login-input"
                        maxlength="50"
                        pattern="[a-zA-Z0-9_-]+"
                        placeholder="e.g. alex"
                    >
                </div>
                <div class="modal-actions">
                    <button type="button" id="login-create-btn" class="modal-btn modal-btn-primary">Create & Log In</button>
                </div>
            </div>
        </div>
    </dialog>
    <?php endif; ?>


    <?php if ($mockMode): ?>
    <dialog id="mock-exit-dialog" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Save mock data?</h2>
                <button type="button" id="mock-exit-dialog-close" class="modal-close" aria-label="Cancel">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <p class="modal-body">Mock usage counts will be cleared.</p>
            <div class="modal-actions">
                <button type="button" id="mock-exit-yes" class="modal-btn">Save Data</button>
                <button type="button" id="mock-exit-no" class="modal-btn">Delete Data</button>
            </div>
        </div>
    </dialog>
    <?php endif; ?>

    <dialog id="split-dialog" class="modal modal-lg"></dialog>

    <dialog id="prompt-dialog" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Prompt</h2>
                <button type="button" class="modal-close" id="prompt-dialog-close" aria-label="Close">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div id="prompt-dialog-text" class="prompt-dialog-text"></div>
            <div class="modal-actions">
                <button type="button" id="prompt-copy-btn" class="modal-btn">
                    <span class="material-symbols-outlined">content_copy</span> <span id="prompt-copy-label">Copy</span>
                </button>
                <button type="button" id="prompt-reprompt-btn" class="modal-btn modal-btn-primary">
                    <span class="material-symbols-outlined">refresh</span> Use as prompt
                </button>
            </div>
        </div>
    </dialog>

    <script>window.APP_AUTH = <?php echo json_encode($loggedIn); ?>;</script>
    <script>window.APP_CSRF = <?php echo json_encode($csrfToken); ?>;</script>
    <script>window.APP_MOCK = <?php echo json_encode($mockMode); ?>;</script>
    <script src="tokens.js"></script>
    <script src="app.js"></script>
</body>
</html>
