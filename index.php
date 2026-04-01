<?php
session_start();
require_once __DIR__ . '/includes/csrf.php';
require_once __DIR__ . '/includes/auth.php';
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
    <title>Calorie Estimator</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header class="app-header">
        <h1 class="app-title">Calorie Estimator</h1>
        <div class="header-actions">
            <?php if ($loggedIn): ?>
                <span class="header-username"><?php echo htmlspecialchars($username, ENT_QUOTES, 'UTF-8'); ?></span>
                <a href="history.php" class="header-link">History</a>
                <a href="index.php?action=logout" class="header-link">Log out</a>
            <?php else: ?>
                <a href="login.php" class="header-link">Log in</a>
            <?php endif; ?>
            <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle dark mode">
                <span class="theme-toggle-icon" aria-hidden="true"></span>
            </button>
        </div>
    </header>

    <main class="app-main">
        <!-- Estimation form -->
        <form id="estimate-form" class="estimate-form" autocomplete="off">
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8'); ?>">

            <div class="input-row">
                <textarea
                    id="food-input"
                    class="food-input"
                    name="text"
                    rows="2"
                    placeholder="What did you eat? e.g. Big Mac with fries and a Coke"
                    aria-label="Describe what you ate"
                ></textarea>
                <label class="photo-btn" aria-label="Upload a meal photo">
                    <span class="photo-btn-icon" aria-hidden="true">&#128247;</span>
                    <input
                        type="file"
                        id="photo-input"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        class="visually-hidden"
                    >
                </label>
            </div>

            <div id="photo-preview" class="photo-preview hidden">
                <img id="photo-preview-img" class="photo-preview-img" alt="Meal photo preview">
                <button type="button" id="photo-remove" class="photo-remove" aria-label="Remove photo">&times;</button>
            </div>

            <?php if ($loggedIn): ?>
            <div class="model-toggle" id="model-toggle">
                <div class="model-group">
                    <span class="model-group-label">Gemini</span>
                    <div class="model-pills">
                        <button type="button" class="model-pill active" data-model="flash">Flash</button>
                        <button type="button" class="model-pill" data-model="flash-thinking">Thinking</button>
                        <button type="button" class="model-pill" data-model="pro">Pro <span class="model-pill-note">100/day</span></button>
                    </div>
                </div>
                <div class="model-group-divider"></div>
                <div class="model-group">
                    <span class="model-group-label">Claude</span>
                    <div class="model-pills">
                        <button type="button" class="model-pill" data-model="sonnet">Sonnet <span class="model-pill-note">paid</span></button>
                        <button type="button" class="model-pill" data-model="opus">Opus <span class="model-pill-note">paid &middot; higher cost</span></button>
                    </div>
                </div>
            </div>
            <?php endif; ?>

            <div class="form-footer">
                <button type="submit" id="submit-btn" class="submit-btn">
                    <span id="submit-text">Estimate Calories</span>
                    <span id="submit-spinner" class="spinner hidden" aria-hidden="true"></span>
                </button>
                <div id="usage-indicator" class="usage-indicator hidden"></div>
            </div>
        </form>

        <!-- Results area -->
        <section id="results" class="results hidden" aria-live="polite">
            <div id="results-content" class="results-content"></div>
            <button type="button" id="copy-btn" class="copy-btn hidden">
                <span id="copy-text">Copy for LoseIt</span>
            </button>
        </section>

        <!-- Local history -->
        <section id="history" class="history-section">
            <div class="history-header">
                <h2 class="history-title">History</h2>
                <button type="button" id="clear-history" class="clear-history-btn hidden">Clear</button>
            </div>
            <div id="history-list" class="history-list"></div>
        </section>
    </main>

    <footer class="app-footer">
        <p>&copy; <?php echo date('Y'); ?> Calorie Estimator</p>
    </footer>

    <script>window.APP_AUTH = <?php echo json_encode($loggedIn); ?>;</script>
    <script src="tokens.js"></script>
    <script src="app.js"></script>
</body>
</html>
