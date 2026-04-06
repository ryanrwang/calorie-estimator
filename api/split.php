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

if (!csrf_validate(isset($body['csrf_token']) ? $body['csrf_token'] : '')) {
    json_error('Invalid CSRF token', 403);
}

$mealId = isset($body['meal_id']) ? (int)$body['meal_id'] : 0;
if ($mealId <= 0) {
    json_error('Invalid meal_id');
}

// split_data can be null (to remove split) or an object
$splitData = isset($body['split_data']) ? $body['split_data'] : null;

try {
    $db = get_db();
    $stmt = $db->prepare(
        'UPDATE meals SET split_data = ? WHERE id = ? AND user_id = ?'
    );
    $stmt->execute([
        $splitData !== null ? json_encode($splitData) : null,
        $mealId,
        get_current_user_id(),
    ]);

    if ($stmt->rowCount() === 0) {
        json_error('Meal not found', 404);
    }

    json_response(['ok' => true]);
} catch (Exception $e) {
    error_log('Failed to update split data: ' . $e->getMessage());
    json_error('Server error', 500);
}
