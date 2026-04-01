<?php
session_start();
require_once __DIR__ . '/includes/csrf.php';
require_once __DIR__ . '/includes/auth.php';

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
            $input = isset($_POST['passphrase']) ? trim($_POST['passphrase']) : '';
            if (verify_passphrase($input)) {
                $_SESSION['passphrase_verified'] = true;
                $step = 'username';
            } else {
                $error = 'Incorrect passphrase.';
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

$users = ($step === 'username') ? get_all_usernames() : [];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Log In — Calorie Estimator</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header class="app-header">
        <a href="index.php" class="app-title-link"><h1 class="app-title">Calorie Estimator</h1></a>
        <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle dark mode">
            <span class="theme-toggle-icon" aria-hidden="true"></span>
        </button>
    </header>

    <main class="app-main">
        <div class="login-card">
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
                        required
                        autofocus
                        autocomplete="off"
                    >
                    <button type="submit" class="submit-btn">Continue</button>
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
                    <button type="submit" class="submit-btn">Create & Log In</button>
                </form>
            <?php endif; ?>

            <a href="index.php" class="login-back-link">Back to estimator</a>
        </div>
    </main>

    <footer class="app-footer">
        <p>&copy; <?php echo date('Y'); ?> Calorie Estimator</p>
    </footer>

    <script src="tokens.js"></script>
    <script src="app.js"></script>
</body>
</html>
