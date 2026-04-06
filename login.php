<?php
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/includes/csrf.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/mock.php';
$mockMode = is_mock_mode();

// Already logged in? Go home
if (is_logged_in()) {
    header('Location: index.php');
    exit;
}

$csrfToken = csrf_generate();
$step = 'passphrase'; // passphrase or username
$error = '';

// Handle POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_validate(isset($_POST['csrf_token']) ? $_POST['csrf_token'] : '')) {
        $error = 'Invalid request. Please try again.';
    } else {
        $action = isset($_POST['action']) ? $_POST['action'] : '';

        if ($action === 'passphrase') {
            if ($mockMode) {
                // Mock mode: skip passphrase verification
                $_SESSION['passphrase_verified'] = true;
                $step = 'username';
            } else {
                $input = isset($_POST['passphrase']) ? trim($_POST['passphrase']) : '';
                if (verify_passphrase($input)) {
                    $_SESSION['passphrase_verified'] = true;
                    $step = 'username';
                } else {
                    $error = 'Incorrect passphrase.';
                }
            }
        } elseif ($action === 'select_user') {
            if (empty($_SESSION['passphrase_verified'])) {
                $error = 'Please enter the passphrase first.';
            } else {
                $userId = isset($_POST['user_id']) ? (int)$_POST['user_id'] : 0;
                $user = get_user_by_id($userId);
                if ($user) {
                    login_user($user['id'], $user['username']);
                    unset($_SESSION['passphrase_verified']);
                    header('Location: index.php');
                    exit;
                } else {
                    $error = 'User not found.';
                    $step = 'username';
                }
            }
        } elseif ($action === 'create_user') {
            if (empty($_SESSION['passphrase_verified'])) {
                $error = 'Please enter the passphrase first.';
            } else {
                $username = isset($_POST['username']) ? trim($_POST['username']) : '';
                if ($username === '') {
                    $error = 'Please enter a username.';
                    $step = 'username';
                } elseif (strlen($username) > 50) {
                    $error = 'Username too long (max 50 characters).';
                    $step = 'username';
                } elseif (!preg_match('/^[a-zA-Z0-9_-]+$/', $username)) {
                    $error = 'Username can only contain letters, numbers, hyphens, and underscores.';
                    $step = 'username';
                } else {
                    if ($mockMode && !mock_has_db()) {
                        // No DB: use mock session login
                        login_user(99999, $username);
                        unset($_SESSION['passphrase_verified']);
                        header('Location: index.php');
                        exit;
                    }
                    try {
                        $userId = create_user($username);
                        login_user($userId, $username);
                        unset($_SESSION['passphrase_verified']);
                        header('Location: index.php');
                        exit;
                    } catch (PDOException $e) {
                        if ($e->getCode() == 23000) {
                            $error = 'Username already taken.';
                        } else {
                            $error = 'Something went wrong. Please try again.';
                        }
                        $step = 'username';
                    }
                }
            }
        }
    }

    // Regenerate CSRF token after POST
    $_SESSION['csrf_token'] = '';
    $csrfToken = csrf_generate();
}

// If passphrase was already verified (multi-step), show username step
if (!empty($_SESSION['passphrase_verified']) && $step === 'passphrase') {
    $step = 'username';
}

if ($step === 'username' && (!$mockMode || mock_has_db())) {
    $users = get_all_usernames();
} else {
    $users = [];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Log In &mdash; Carole</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <!-- Floating controls -->
    <div class="floating-controls entrance">
        <button id="theme-toggle" class="fab-btn" type="button" aria-label="Toggle dark mode">
            <span class="material-symbols-outlined theme-icon">light_mode</span>
        </button>
    </div>

    <main class="app-main">
        <div class="page-hero entrance">
            <h1 class="brand-title"><a href="index.php" style="text-decoration:none;color:inherit;">Carole</a></h1>
            <p class="brand-subtitle">The calorie estimator</p>
        </div>

        <div class="login-card entrance">
            <h2 class="login-heading">Log In</h2>

            <?php if ($error): ?>
                <div class="login-error"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
            <?php endif; ?>

            <?php if ($step === 'passphrase'): ?>
                <form method="post" class="login-form" autocomplete="off">
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8'); ?>">
                    <input type="hidden" name="action" value="passphrase">
                    <label class="login-label" for="passphrase">Passphrase</label>
                    <input
                        type="password"
                        id="passphrase"
                        name="passphrase"
                        class="login-input"
                        <?php echo $mockMode ? '' : 'required'; ?>
                        autofocus
                        autocomplete="off"
                    >
                    <button type="submit" class="submit-pill" style="width:100%;height:44px;">Continue</button>
                </form>
            <?php else: ?>
                <p class="login-subtitle">Choose a username or create a new one.</p>

                <?php if (count($users) > 0): ?>
                    <form method="post" class="login-form login-user-list" autocomplete="off">
                        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8'); ?>">
                        <input type="hidden" name="action" value="select_user">
                        <?php foreach ($users as $u): ?>
                            <button type="submit" name="user_id" value="<?php echo $u['id']; ?>" class="login-user-btn">
                                <?php echo htmlspecialchars($u['username'], ENT_QUOTES, 'UTF-8'); ?>
                            </button>
                        <?php endforeach; ?>
                    </form>
                    <div class="login-divider"><span>or</span></div>
                <?php endif; ?>

                <form method="post" class="login-form" autocomplete="off">
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8'); ?>">
                    <input type="hidden" name="action" value="create_user">
                    <label class="login-label" for="username">New username</label>
                    <input
                        type="text"
                        id="username"
                        name="username"
                        class="login-input"
                        maxlength="50"
                        pattern="[a-zA-Z0-9_-]+"
                        placeholder="e.g. alex"
                        required
                        <?php echo count($users) === 0 ? 'autofocus' : ''; ?>
                    >
                    <button type="submit" class="submit-pill" style="width:100%;height:44px;">Create & Log In</button>
                </form>
            <?php endif; ?>

            <a href="index.php" class="login-back-link">Back to estimator</a>
        </div>
    </main>

    <?php if ($mockMode): ?>
    <div class="mock-indicator">MOCK MODE</div>
    <?php endif; ?>

    <script src="tokens.js"></script>
    <script src="app.js"></script>
</body>
</html>
