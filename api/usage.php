<?php
/**
 * GET /api/usage.php — Returns current global usage counts and limits.
 * Used to prefetch usage data on page load so the ring displays immediately.
 */
session_start();

$config = require __DIR__ . '/../includes/config.php';

header('Content-Type: application/json');

$usageFile = __DIR__ . '/../data/api_usage.json';
$ALL_MODELS = ['flash', 'flash-thinking', 'pro', 'sonnet', 'opus'];

$fp = fopen($usageFile, 'c+');
if (!$fp) {
    echo json_encode(['usage' => array_fill_keys($ALL_MODELS, 0), 'limits' => $config['usage_limits']]);
    exit;
}
flock($fp, LOCK_SH);
$contents = stream_get_contents($fp);
flock($fp, LOCK_UN);
fclose($fp);

$data = json_decode($contents, true);
$today = (new DateTime('now', new DateTimeZone('America/Los_Angeles')))->format('Y-m-d');

$usage = [];
foreach ($ALL_MODELS as $m) {
    if ($data && isset($data['date']) && $data['date'] === $today && isset($data[$m])) {
        $usage[$m] = (int)$data[$m];
    } else {
        $usage[$m] = 0;
    }
}

echo json_encode([
    'usage' => $usage,
    'limits' => isset($config['usage_limits']) ? $config['usage_limits'] : [],
]);
