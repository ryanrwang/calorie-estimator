<?php
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/csrf.php';
require_once __DIR__ . '/../includes/auth.php';

function json_response($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function json_error($message, $status = 400) {
    json_response(['error' => $message], $status);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Method not allowed', 405);
}

if (!is_logged_in()) {
    json_error('Not authenticated', 401);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    json_error('Invalid JSON');
}

if (empty($body['csrf_token']) || !csrf_validate($body['csrf_token'])) {
    json_error('Invalid CSRF token', 403);
}

$action = isset($body['action']) ? $body['action'] : '';
$mealId = isset($body['meal_id']) ? (int)$body['meal_id'] : 0;
$userId = get_current_user_id();

if ($mealId <= 0) {
    json_error('Invalid meal ID');
}

try {
    $db = get_db();

    if ($action === 'archive') {
        $stmt = $db->prepare('UPDATE meals SET archived_at = NOW() WHERE id = ? AND user_id = ? AND archived_at IS NULL');
        $stmt->execute([$mealId, $userId]);
        json_response(['ok' => true]);
    } elseif ($action === 'unarchive') {
        $stmt = $db->prepare('UPDATE meals SET archived_at = NULL WHERE id = ? AND user_id = ? AND archived_at IS NOT NULL');
        $stmt->execute([$mealId, $userId]);
        json_response(['ok' => true]);
    } elseif ($action === 'delete') {
        $stmt = $db->prepare('DELETE FROM meals WHERE id = ? AND user_id = ?');
        $stmt->execute([$mealId, $userId]);
        json_response(['ok' => true]);
    } else {
        json_error('Invalid action');
    }
} catch (Exception $e) {
    error_log('History API error: ' . $e->getMessage());
    json_error('Server error', 500);
}
