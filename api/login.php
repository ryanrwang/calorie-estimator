<?php
/**
 * JSON API for login flow (passphrase verification, user list, user selection/creation).
 * Replaces the form-POST login.php with fetch()-friendly endpoints.
 */
session_start();
require_once __DIR__ . '/../includes/csrf.php';
require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

$csrfToken = isset($input['csrf_token']) ? $input['csrf_token'] : '';
if (!csrf_validate($csrfToken)) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid request. Please reload and try again.']);
    exit;
}

$action = isset($input['action']) ? $input['action'] : '';

if ($action === 'passphrase') {
    $passphrase = isset($input['passphrase']) ? trim($input['passphrase']) : '';
    if (verify_passphrase($passphrase)) {
        $_SESSION['passphrase_verified'] = true;
        $users = get_all_usernames();
        // Regenerate CSRF token
        $_SESSION['csrf_token'] = '';
        $newToken = csrf_generate();
        echo json_encode(['ok' => true, 'users' => $users, 'csrf_token' => $newToken]);
    } else {
        echo json_encode(['ok' => false, 'error' => 'Incorrect passphrase.']);
    }
    exit;
}

if ($action === 'select_user') {
    if (empty($_SESSION['passphrase_verified'])) {
        echo json_encode(['ok' => false, 'error' => 'Please enter the passphrase first.']);
        exit;
    }
    $userId = isset($input['user_id']) ? (int)$input['user_id'] : 0;
    $user = get_user_by_id($userId);
    if ($user) {
        login_user($user['id'], $user['username']);
        unset($_SESSION['passphrase_verified']);
        echo json_encode(['ok' => true, 'username' => $user['username']]);
    } else {
        echo json_encode(['ok' => false, 'error' => 'User not found.']);
    }
    exit;
}

if ($action === 'create_user') {
    if (empty($_SESSION['passphrase_verified'])) {
        echo json_encode(['ok' => false, 'error' => 'Please enter the passphrase first.']);
        exit;
    }
    $username = isset($input['username']) ? trim($input['username']) : '';
    if ($username === '') {
        echo json_encode(['ok' => false, 'error' => 'Please enter a username.']);
        exit;
    }
    if (strlen($username) > 50) {
        echo json_encode(['ok' => false, 'error' => 'Username too long (max 50 characters).']);
        exit;
    }
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $username)) {
        echo json_encode(['ok' => false, 'error' => 'Username can only contain letters, numbers, hyphens, and underscores.']);
        exit;
    }
    try {
        $userId = create_user($username);
        login_user($userId, $username);
        unset($_SESSION['passphrase_verified']);
        echo json_encode(['ok' => true, 'username' => $username]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            echo json_encode(['ok' => false, 'error' => 'Username already taken.']);
        } else {
            echo json_encode(['ok' => false, 'error' => 'Something went wrong. Please try again.']);
        }
    }
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Unknown action.']);
