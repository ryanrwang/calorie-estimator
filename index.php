<?php session_start(); ?>
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
        <p class="greeting">Hello world — scaffold is working.</p>
    </main>

    <footer class="app-footer">
        <p>&copy; <?php echo date('Y'); ?> Calorie Estimator</p>
    </footer>

    <script src="tokens.js"></script>
    <script src="app.js"></script>
</body>
</html>
