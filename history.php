<?php
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/includes/csrf.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/mock.php';
$mockMode = is_mock_mode();

if (!is_logged_in()) {
    header('Location: login.php');
    exit;
}

$csrfToken = csrf_generate();
$username = get_current_username();
$userId = get_current_user_id();

// Read filter params
$archiveFilter = isset($_GET['archive']) ? $_GET['archive'] : 'active';
$modelFilter = isset($_GET['model']) ? $_GET['model'] : 'all';
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$perPage = 20;
$offset = ($page - 1) * $perPage;

// Build query
$where = 'user_id = ?';
$params = [$userId];

if ($archiveFilter === 'archived') {
    $where .= ' AND archived_at IS NOT NULL';
} else {
    $where .= ' AND (archived_at IS NULL)';
}

$validModels = ['flash', 'flash-thinking', 'pro', 'sonnet', 'opus'];
if ($modelFilter !== 'all' && in_array($modelFilter, $validModels)) {
    $where .= ' AND model_used = ?';
    $params[] = $modelFilter;
}

try {
    $db = get_db();

    $countStmt = $db->prepare("SELECT COUNT(*) FROM meals WHERE $where");
    $countStmt->execute($params);
    $totalMeals = (int)$countStmt->fetchColumn();

    $stmt = $db->prepare("SELECT * FROM meals WHERE $where ORDER BY created_at DESC LIMIT ? OFFSET ?");
    $stmt->execute(array_merge($params, [$perPage, $offset]));
    $meals = $stmt->fetchAll();

    $totalPages = max(1, ceil($totalMeals / $perPage));
} catch (Exception $e) {
    $meals = [];
    $totalMeals = 0;
    $totalPages = 1;
    error_log('Failed to fetch meals: ' . $e->getMessage());
}

// Convert meals to JSON-safe array for JS rendering
$mealsJson = [];
foreach ($meals as $meal) {
    $mealsJson[] = [
        'id' => (int)$meal['id'],
        'input_text' => $meal['input_text'],
        'thumbnail' => $meal['thumbnail'],
        'model_used' => $meal['model_used'],
        'gemini_response' => $meal['gemini_response'],
        'created_at' => $meal['created_at'],
        'archived_at' => $meal['archived_at'],
        'split_data' => $meal['split_data'] ? json_decode($meal['split_data'], true) : null,
    ];
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

// Build filter URL helper
function filterUrl($overrides = []) {
    $params = [
        'archive' => isset($overrides['archive']) ? $overrides['archive'] : (isset($_GET['archive']) ? $_GET['archive'] : 'active'),
        'model' => isset($overrides['model']) ? $overrides['model'] : (isset($_GET['model']) ? $_GET['model'] : 'all'),
    ];
    if (isset($overrides['page'])) {
        $params['page'] = $overrides['page'];
    }
    // Remove defaults to keep URL clean
    if ($params['archive'] === 'active') unset($params['archive']);
    if ($params['model'] === 'all') unset($params['model']);
    if (isset($params['page']) && $params['page'] <= 1) unset($params['page']);
    return 'history.php' . ($params ? '?' . http_build_query($params) : '');
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>History &mdash; Carole</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <!-- Floating controls -->
    <div class="floating-controls entrance">
        <div class="settings-dropdown" id="settings-dropdown">
            <button class="fab-btn" type="button" id="settings-btn" aria-label="Settings" data-tooltip="Settings" data-tooltip-placement="left">
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
                <span class="settings-menu-username"><?php echo htmlspecialchars($username, ENT_QUOTES, 'UTF-8'); ?></span>
                <a href="index.php" class="settings-menu-item">
                    <span class="material-symbols-outlined">home</span> Exit history
                </a>
                <a href="index.php?action=logout" class="settings-menu-item settings-menu-danger">
                    <span class="material-symbols-outlined">logout</span> Log out
                </a>
            </div>
        </div>
    </div>

    <main class="app-main">
        <!-- History page header -->
        <div class="history-page-header entrance">
            <div class="history-page-title-row">
                <a href="index.php" class="history-back-btn" aria-label="Back" data-tooltip="Back">
                    <span class="material-symbols-outlined">arrow_back</span>
                </a>
                <h1 class="history-page-title">History</h1>
            </div>
            <span class="history-count"><?php echo $totalMeals; ?> <?php echo $totalMeals === 1 ? 'entry' : 'entries'; ?></span>
        </div>

        <!-- Filters -->
        <div class="history-filters entrance">
            <div class="history-filter-group">
                <a href="<?php echo filterUrl(['archive' => 'active', 'page' => 1]); ?>"
                   class="history-filter-chip<?php echo $archiveFilter !== 'archived' ? ' active' : ''; ?>">Active</a>
                <a href="<?php echo filterUrl(['archive' => 'archived', 'page' => 1]); ?>"
                   class="history-filter-chip<?php echo $archiveFilter === 'archived' ? ' active' : ''; ?>">Archived</a>
            </div>
            <div class="history-filter-group">
                <a href="<?php echo filterUrl(['model' => 'all', 'page' => 1]); ?>"
                   class="history-filter-chip<?php echo $modelFilter === 'all' ? ' active' : ''; ?>">All</a>
                <?php foreach ($modelLabels as $key => $label): ?>
                    <?php $provider = $modelProviders[$key]; ?>
                    <a href="<?php echo filterUrl(['model' => $key, 'page' => 1]); ?>"
                       class="history-filter-chip<?php echo $modelFilter === $key ? ' active' : ''; ?>"><?php echo $label; ?></a>
                <?php endforeach; ?>
            </div>
        </div>

        <?php if (empty($meals)): ?>
            <p class="history-empty entrance"><?php echo $archiveFilter === 'archived' ? 'No archived entries.' : 'No saved estimates yet.'; ?></p>
        <?php else: ?>
            <div class="history-list entrance" id="history-page-list"></div>

            <?php if ($totalPages > 1): ?>
                <div class="pagination entrance">
                    <?php if ($page > 1): ?>
                        <a href="<?php echo filterUrl(['page' => $page - 1]); ?>" class="pagination-link">
                            <span class="material-symbols-outlined">arrow_back</span> Newer
                        </a>
                    <?php endif; ?>
                    <span class="pagination-info">Page <?php echo $page; ?> of <?php echo $totalPages; ?></span>
                    <?php if ($page < $totalPages): ?>
                        <a href="<?php echo filterUrl(['page' => $page + 1]); ?>" class="pagination-link">
                            Older <span class="material-symbols-outlined">arrow_forward</span>
                        </a>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        <?php endif; ?>
    </main>

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
            </div>
        </div>
    </dialog>

    <?php if ($mockMode): ?>
    <div class="mock-indicator">MOCK MODE</div>
    <?php endif; ?>

    <script>window.APP_AUTH = true;</script>
    <script>window.APP_CSRF = <?php echo json_encode($csrfToken); ?>;</script>
    <script>window.APP_MOCK = <?php echo json_encode($mockMode); ?>;</script>
    <script>window.HISTORY_PAGE_MEALS = <?php echo json_encode($mealsJson); ?>;</script>
    <script>window.HISTORY_PAGE_ARCHIVE_FILTER = <?php echo json_encode($archiveFilter); ?>;</script>
    <script src="tokens.js"></script>
    <script src="tooltips.js"></script>
    <script src="app.js"></script>
</body>
</html>
