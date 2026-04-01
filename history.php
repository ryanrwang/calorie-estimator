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
    <title>History &mdash; Carole</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <!-- Floating controls -->
    <div class="floating-controls">
        <button id="theme-toggle" class="fab-btn" type="button" aria-label="Toggle dark mode">
            <span class="material-symbols-outlined theme-icon">light_mode</span>
        </button>
        <div class="profile-dropdown" id="profile-dropdown">
            <button class="fab-btn" type="button" id="profile-btn" aria-label="Profile menu">
                <span class="material-symbols-outlined">person</span>
            </button>
            <div class="profile-menu hidden" id="profile-menu">
                <span class="profile-menu-username"><?php echo htmlspecialchars($username, ENT_QUOTES, 'UTF-8'); ?></span>
                <a href="index.php" class="profile-menu-item">
                    <span class="material-symbols-outlined">home</span> Home
                </a>
                <a href="index.php?action=logout" class="profile-menu-item profile-menu-danger">
                    <span class="material-symbols-outlined">logout</span> Log out
                </a>
            </div>
        </div>
    </div>

    <main class="app-main">
        <div class="page-hero">
            <h1 class="brand-title"><a href="index.php" style="text-decoration:none;color:inherit;">Carole</a></h1>
            <p class="brand-subtitle">The calorie estimator</p>
        </div>

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
                            <button type="submit" class="history-delete-btn" onclick="return confirm('Delete this entry?')">
                                <span class="material-symbols-outlined">delete</span> Delete
                            </button>
                        </form>
                    </div>
                <?php endforeach; ?>
            </div>

            <?php if ($totalPages > 1): ?>
                <div class="pagination">
                    <?php if ($page > 1): ?>
                        <a href="history.php?page=<?php echo $page - 1; ?>" class="pagination-link">
                            <span class="material-symbols-outlined">arrow_back</span> Newer
                        </a>
                    <?php endif; ?>
                    <span class="pagination-info">Page <?php echo $page; ?> of <?php echo $totalPages; ?></span>
                    <?php if ($page < $totalPages): ?>
                        <a href="history.php?page=<?php echo $page + 1; ?>" class="pagination-link">
                            Older <span class="material-symbols-outlined">arrow_forward</span>
                        </a>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        <?php endif; ?>
    </main>

    <script src="tokens.js"></script>
    <script src="app.js"></script>
</body>
</html>
