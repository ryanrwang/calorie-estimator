<?php
session_start();
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
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <!-- Floating controls -->
    <div class="floating-controls">
        <button id="theme-toggle" class="fab-btn" type="button" aria-label="Toggle dark mode">
            <span class="material-symbols-outlined theme-icon">light_mode</span>
        </button>
        <?php if ($loggedIn): ?>
        <div class="profile-dropdown" id="profile-dropdown">
            <button class="fab-btn" type="button" id="profile-btn" aria-label="Profile menu">
                <span class="material-symbols-outlined">person</span>
            </button>
            <div class="profile-menu hidden" id="profile-menu">
                <span class="profile-menu-username"><?php echo htmlspecialchars($username, ENT_QUOTES, 'UTF-8'); ?></span>
                <a href="history.php" class="profile-menu-item">
                    <span class="material-symbols-outlined">history</span> History
                </a>
                <a href="index.php?action=logout" class="profile-menu-item profile-menu-danger">
                    <span class="material-symbols-outlined">logout</span> Log out
                </a>
            </div>
        </div>
        <?php else: ?>
        <button type="button" class="fab-btn" id="login-open-btn" aria-label="Log in">
            <span class="material-symbols-outlined">login</span>
        </button>
        <?php endif; ?>
    </div>

    <main class="app-main">
        <!-- Brand hero -->
        <div class="page-hero">
            <h1 class="brand-title">Carole</h1>
            <p class="brand-subtitle">The calorie estimator</p>
        </div>

        <!-- Estimation form -->
        <form id="estimate-form" class="estimate-form" autocomplete="off">
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8'); ?>">

            <div class="input-card" id="input-card">
                <textarea
                    id="food-input"
                    class="food-input"
                    name="text"
                    rows="2"
                    placeholder="What did you eat? e.g. Big Mac with fries and a Coke"
                    aria-label="Describe what you ate"
                ></textarea>

                <div class="compact-actions" id="compact-actions">
                    <div id="compact-usage-ring" class="usage-ring-wrap hidden">
                        <svg class="usage-ring" viewBox="0 0 24 24" width="24" height="24">
                            <circle class="usage-ring-track" cx="12" cy="12" r="10" />
                            <circle class="usage-ring-fill compact-ring-fill" cx="12" cy="12" r="10" />
                        </svg>
                        <span class="usage-ring-tooltip" id="compact-usage-tooltip"></span>
                    </div>
                    <button type="button" class="compact-edit-btn" aria-label="Edit search">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                </div>

                <div id="photo-preview" class="photo-preview hidden">
                    <img id="photo-preview-img" class="photo-preview-img" alt="Meal photo preview">
                    <button type="button" id="photo-remove" class="photo-remove" aria-label="Remove photo">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div class="input-toolbar">
                    <label class="toolbar-btn" aria-label="Upload a meal photo">
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
                        <button type="button" class="toolbar-btn model-select-trigger" id="model-select-trigger">
                            <span class="material-symbols-outlined">tune</span>
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

                    <div id="usage-ring-wrap" class="usage-ring-wrap hidden">
                        <svg class="usage-ring" viewBox="0 0 24 24" width="24" height="24">
                            <circle class="usage-ring-track" cx="12" cy="12" r="10" />
                            <circle id="usage-ring-fill" class="usage-ring-fill" cx="12" cy="12" r="10" />
                        </svg>
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
        </section>

        <!-- Local history -->
        <section id="history" class="history-section hidden">
            <div class="history-toggle" id="history-toggle">
                <span class="history-title">History</span>
                <span class="history-toggle-actions">
                    <button type="button" id="clear-history" class="clear-history-btn hidden">
                        <span class="material-symbols-outlined">delete_sweep</span> Clear
                    </button>
                    <span class="material-symbols-outlined history-chevron">expand_more</span>
                </span>
            </div>
            <div class="history-collapsible expanded" id="history-collapsible">
                <div id="history-list" class="history-list"></div>
            </div>
        </section>
    </main>

    <?php if (!$loggedIn): ?>
    <dialog id="login-dialog" class="login-dialog">
        <div class="login-dialog-content">
            <div class="login-dialog-header">
                <h2 class="login-heading">Log In</h2>
                <button type="button" class="login-dialog-close" id="login-close-btn" aria-label="Close">
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
                        <button type="button" id="login-toggle-pass" class="login-toggle-visibility" aria-label="Toggle passphrase visibility">
                            <span class="material-symbols-outlined" id="login-toggle-pass-icon">visibility</span>
                        </button>
                    </div>
                    <button type="button" id="login-passphrase-btn" class="submit-pill" style="width:100%;height:44px;">Continue</button>
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
                    <button type="button" id="login-create-btn" class="submit-pill" style="width:100%;height:44px;">Create & Log In</button>
                </div>
            </div>
        </div>
    </dialog>
    <?php endif; ?>

    <?php if ($mockMode): ?>
    <div class="mock-indicator">MOCK MODE</div>
    <?php endif; ?>

    <script>window.APP_AUTH = <?php echo json_encode($loggedIn); ?>;</script>
    <script>window.APP_CSRF = <?php echo json_encode($csrfToken); ?>;</script>
    <script>window.APP_MOCK = <?php echo json_encode($mockMode); ?>;</script>
    <script src="tokens.js"></script>
    <script src="app.js"></script>
</body>
</html>
