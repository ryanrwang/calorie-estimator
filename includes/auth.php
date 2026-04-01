<?php
/**
 * Auth helpers — passphrase + username login.
 * Requires session_start() to have been called.
 */

function get_db() {
    static $pdo = null;
    if ($pdo === null) {
        $config = require __DIR__ . '/config.php';
        $dsn = 'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'] . ';charset=utf8mb4';
        $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

function is_logged_in() {
    return !empty($_SESSION['user_id']) && !empty($_SESSION['username']);
}

function get_current_user_id() {
    return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
}

function get_current_username() {
    return isset($_SESSION['username']) ? $_SESSION['username'] : null;
}

function verify_passphrase($input) {
    $config = require __DIR__ . '/config.php';
    $passphrase = isset($config['app_passphrase']) ? $config['app_passphrase'] : '';
    if ($passphrase === '') {
        return false;
    }
    return hash_equals($passphrase, $input);
}

function get_all_usernames() {
    $db = get_db();
    $stmt = $db->query('SELECT id, username FROM users ORDER BY username ASC');
    return $stmt->fetchAll();
}

function create_user($username) {
    $db = get_db();
    $stmt = $db->prepare('INSERT INTO users (username) VALUES (?)');
    $stmt->execute([$username]);
    return (int)$db->lastInsertId();
}

function get_user_by_id($id) {
    $db = get_db();
    $stmt = $db->prepare('SELECT id, username FROM users WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->fetch();
}

function login_user($userId, $username) {
    $_SESSION['user_id'] = $userId;
    $_SESSION['username'] = $username;
}

function logout_user() {
    unset($_SESSION['user_id'], $_SESSION['username']);
}
