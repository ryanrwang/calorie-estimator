<?php
session_start();
require_once __DIR__ . '/includes/csrf.php';
require_once __DIR__ . '/includes/auth.php';

if (!is_logged_in()) {
    header('Location: login.php');
    exit;
}

$csrfToken = csrf_generate();
$username = get_current_username();
$userId = get_current_user_id();

// Handle delete
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete') {
    if (csrf_validate(isset($_POST['csrf_token']) ? $_POST['csrf_token'] : '')) {
        $mealId = isset($_POST['meal_id']) ? (int)$_POST['meal_id'] : 0;
        if ($mealId > 0) {
            try {
                $db = get_db();
                $stmt = $db->prepare('DELETE FROM meals WHERE id = ? AND user_id = ?');
                $stmt->execute([$mealId, $userId]);
            } catch (Exception $e) {
                error_log('Failed to delete meal: ' . $e->getMessage());
            }
        }
    }
    // Regenerate CSRF token
    $_SESSION['csrf_token'] = '';
    $csrfToken = csrf_generate();
    header('Location: history.php');
    exit;
}

// Fetch meals
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$perPage = 20;
$offset = ($page - 1) * $perPage;

try {
    $db = get_db();

    $countStmt = $db->prepare('SELECT COUNT(*) FROM meals WHERE user_id = ?');
    $countStmt->execute([$userId]);
    $totalMeals = (int)$countStmt->fetchColumn();

    $stmt = $db->prepare('SELECT * FROM meals WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');
    $stmt->execute([$userId, $perPage, $offset]);
    $meals = $stmt->fetchAll();

    $totalPages = max(1, ceil($totalMeals / $perPage));
} catch (Exception $e) {
    $meals = [];
    $totalMeals = 0;
    $totalPages = 1;
    error_log('Failed to fetch meals: ' . $e->getMessage());
}

// Model display config
$modelLabels = [
    'flash' => 'Flash',
    'flash-thinking' => 'Thinking',
    'pro' => 'Pro',
    'sonnet' => 'Sonnet',
    'opus' => 'Opus',
];
$modelProviders = [
    'flash' => 'gemini',
    'flash-thinking' => 'gemini',
    'pro' => 'gemini',
    'sonnet' => 'claude',
    'opus' => 'claude',
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>History — Calorie Estimator</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header class="app-header">
        <a href="index.php" class="app-title-link"><h1 class="app-title">Calorie Estimator</h1></a>
        <div class="header-actions">
            <span class="header-username"><?php echo htmlspecialchars($username, ENT_QUOTES, 'UTF-8'); ?></span>
            <a href="history.php" class="header-link header-link-active">History</a>
            <a href="index.php?action=logout" class="header-link">Log out</a>
            <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle dark mode">
                <span class="theme-toggle-icon" aria-hidden="true"></span>
            </button>
        </div>
    </header>

    <main class="app-main">
        <div class="history-page-header">
            <h2 class="history-title">Saved History</h2>
            <span class="history-count"><?php echo $totalMeals; ?> <?php echo $totalMeals === 1 ? 'entry' : 'entries'; ?></span>
        </div>

        <?php if (empty($meals)): ?>
            <p class="history-empty">No saved estimates yet. Estimates are saved automatically when you're logged in.</p>
        <?php else: ?>
            <div class="history-list">
                <?php foreach ($meals as $meal): ?>
                    <?php
                        $modelKey = $meal['model_used'];
                        $label = isset($modelLabels[$modelKey]) ? $modelLabels[$modelKey] : $modelKey;
                        $provider = isset($modelProviders[$modelKey]) ? $modelProviders[$modelKey] : 'gemini';
                        $date = new DateTime($meal['created_at']);
                    ?>
                    <div class="history-entry">
                        <div class="history-entry-header">
                            <?php if ($meal['thumbnail']): ?>
                                <img class="history-thumb" src="<?php echo htmlspecialchars($meal['thumbnail'], ENT_QUOTES, 'UTF-8'); ?>" alt="Meal photo">
                            <?php endif; ?>
                            <div class="history-entry-meta">
                                <div class="history-entry-meta-row">
                                    <span class="history-date"><?php echo $date->format('M j, g:ia'); ?></span>
                                    <span class="model-badge model-badge-<?php echo $provider; ?>"><?php echo htmlspecialchars($label, ENT_QUOTES, 'UTF-8'); ?></span>
                                </div>
                                <?php if ($meal['input_text']): ?>
                                    <span class="history-input-text"><?php echo htmlspecialchars($meal['input_text'], ENT_QUOTES, 'UTF-8'); ?></span>
                                <?php endif; ?>
                            </div>
                        </div>
                        <div class="history-response">
                            <?php
                                $lines = explode("\n", $meal['gemini_response']);
                                foreach ($lines as $line) {
                                    $line = trim($line);
                                    if ($line !== '') {
                                        echo '<p class="result-line">' . htmlspecialchars($line, ENT_QUOTES, 'UTF-8') . '</p>';
                                    }
                                }
                            ?>
                        </div>
                        <form method="post" class="history-delete-form">
                            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8'); ?>">
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="meal_id" value="<?php echo $meal['id']; ?>">
                            <button type="submit" class="history-delete-btn" onclick="return confirm('Delete this entry?')">Delete</button>
                        </form>
                    </div>
                <?php endforeach; ?>
            </div>

            <?php if ($totalPages > 1): ?>
                <div class="pagination">
                    <?php if ($page > 1): ?>
                        <a href="history.php?page=<?php echo $page - 1; ?>" class="pagination-link">&larr; Newer</a>
                    <?php endif; ?>
                    <span class="pagination-info">Page <?php echo $page; ?> of <?php echo $totalPages; ?></span>
                    <?php if ($page < $totalPages): ?>
                        <a href="history.php?page=<?php echo $page + 1; ?>" class="pagination-link">Older &rarr;</a>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        <?php endif; ?>
    </main>

    <footer class="app-footer">
        <p>&copy; <?php echo date('Y'); ?> Calorie Estimator</p>
    </footer>

    <script src="tokens.js"></script>
    <script src="app.js"></script>
</body>
</html>
