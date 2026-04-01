<?php
session_start();
require_once __DIR__ . '/includes/csrf.php';
$csrfToken = csrf_generate();
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
        <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle dark mode">
            <span class="theme-toggle-icon" aria-hidden="true"></span>
        </button>
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

            <button type="submit" id="submit-btn" class="submit-btn">
                <span id="submit-text">Estimate Calories</span>
                <span id="submit-spinner" class="spinner hidden" aria-hidden="true"></span>
            </button>
        </form>

        <!-- Results area -->
        <section id="results" class="results hidden" aria-live="polite">
            <div id="results-content" class="results-content"></div>
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

    <script src="tokens.js"></script>
    <script src="app.js"></script>
</body>
</html>
