<?php
/**
 * Centralized session configuration.
 * Include this instead of calling session_start() directly.
 *
 * - 30-day session lifetime
 * - Secure cookie flags (HttpOnly, SameSite=Lax, Secure when on HTTPS)
 * - Custom save path to avoid shared-hosting GC interference
 */

if (session_status() === PHP_SESSION_ACTIVE) {
    return;
}

$sessionLifetime = 60 * 60 * 24 * 30; // 30 days

// Keep session data alive on the server for 30 days
ini_set('session.gc_maxlifetime', $sessionLifetime);

// Custom save path so other Bluehost accounts' GC can't sweep our sessions
$sessionDir = __DIR__ . '/../data/sessions';
if (!is_dir($sessionDir)) {
    mkdir($sessionDir, 0700, true);
}
ini_set('session.save_path', $sessionDir);

// Configure cookie: 30-day lifetime + security flags
$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_set_cookie_params([
    'lifetime' => $sessionLifetime,
    'path'     => '/',
    'secure'   => $secure,
    'httponly'  => true,
    'samesite'  => 'Lax',
]);

session_start();
