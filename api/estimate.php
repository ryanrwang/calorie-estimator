<?php
session_start();

require_once __DIR__ . '/../includes/csrf.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/mock.php';
$config = require __DIR__ . '/../includes/config.php';

// --- JSON response helpers ---

function json_response($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function json_error($message, $status = 400) {
    json_response(['error' => $message], $status);
}

// --- Request validation ---

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Method not allowed', 405);
}

$contentType = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
if (stripos($contentType, 'application/json') === false) {
    json_error('Content-Type must be application/json');
}

$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    json_error('Invalid JSON body');
}

// CSRF validation
if (!csrf_validate(isset($body['csrf_token']) ? $body['csrf_token'] : '')) {
    json_error('Invalid CSRF token', 403);
}

// --- Extract inputs ---

$inputText = isset($body['text']) ? trim($body['text']) : '';
$inputImage = isset($body['image']) ? $body['image'] : null; // base64 string
$inputThumbnail = isset($body['thumbnail']) ? $body['thumbnail'] : null;
$modelId = isset($body['model']) ? $body['model'] : 'flash';

if ($inputText === '' && !$inputImage) {
    json_error('Please provide a text description or photo of your meal.');
}

// --- System prompt (shared across all providers) ---

$systemPrompt = <<<'PROMPT'
You are a calorie estimation assistant. When the user uploads a photo of a meal or describes what they ate, respond with a quick calorie estimate as a range (low to high).

Keep responses short and to the point. No lengthy explanations unless the user asks for them.

Never use markdown formatting — no bold, no italic, no headers, no numbered lists, no bullet characters, no backticks. Plain text only.

When the user mentions a specific restaurant or menu item, always search the web before responding. Look for the restaurant's official nutrition info, MyFitnessPal entries, Nutritionix, CalorieKing, or similar databases. If official data exists, use it and note the source. If not, estimate based on typical preparation methods for that restaurant or cuisine style.

For photos, identify each visible item and estimate portion sizes based on visual cues like plate size, utensils, and item proportions relative to each other.

For text descriptions, ask for portion size only if it would significantly change the estimate. Otherwise just give your best range.

Use simple, generic item names that are easy to search in LoseIt. Avoid overly specific or descriptive names. For example, use "chicken breast grilled" instead of "herb-crusted free-range chicken breast." If a restaurant-specific entry is likely to exist in LoseIt (e.g. "McDonald's Big Mac"), use that name instead.

Include your assumed portion size in parentheses after each item name. Use common units like oz, cups, tbsp, slices, or pieces.

Response format is strict. Always follow this order, no exceptions:
1. Item list with assumed portion and calorie ranges (one item per line)
2. Total calorie range
3. Any notes, sources, caveats, or explanations come last

Never put commentary, context, or disclaimers above the item list. Example:
Chicken shawarma wrap (10oz) — 450–600
Garlic sauce (2 tbsp) — 60–90
Total: ~510–690 cal
Source: Estimated, no official data found for ShawarBite.
Note: Range depends on wrap size and amount of sauce. If fries are stuffed inside, could push to 650–700.

If the image is unclear or you genuinely cannot identify the food, say so and ask for clarification. Do not guess wildly.

Do not add health advice, dietary recommendations, or commentary unless the user asks.

If the user mentions sharing, splitting, or dividing the meal with others, ALWAYS report the FULL total calories for the entire meal. Never divide the total yourself. Instead, add a "Split: N" line at the very end of your response (after notes/sources) where N is the number of people sharing. The app will handle the math. For example, if someone says "I shared a pizza with my friend", estimate the full pizza calories and add "Split: 2" at the end.
PROMPT;

// --- API usage counter (per-model tracking) ---

$usageFile = __DIR__ . '/../data/api_usage.json';
$ALL_MODELS = ['flash', 'flash-thinking', 'pro', 'sonnet', 'opus'];

function empty_usage() {
    global $ALL_MODELS;
    $u = ['date' => ''];
    foreach ($ALL_MODELS as $m) $u[$m] = 0;
    return $u;
}

function read_usage() {
    global $usageFile;
    $fp = fopen($usageFile, 'c+');
    if (!$fp) return empty_usage();
    flock($fp, LOCK_SH);
    $contents = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $data = json_decode($contents, true);
    if (!$data) return empty_usage();
    // Backfill any missing model keys (migration from old bucket format)
    $base = empty_usage();
    foreach ($base as $k => $v) {
        if (!isset($data[$k])) $data[$k] = $v;
    }
    return $data;
}

function increment_usage($modelId) {
    global $usageFile;
    $fp = fopen($usageFile, 'c+');
    if (!$fp) return empty_usage();
    flock($fp, LOCK_EX);
    $contents = stream_get_contents($fp);
    $data = json_decode($contents, true);
    if (!$data) $data = empty_usage();

    // Reset if new day (Pacific time)
    $today = (new DateTime('now', new DateTimeZone('America/Los_Angeles')))->format('Y-m-d');
    if (!isset($data['date']) || $data['date'] !== $today) {
        $data = empty_usage();
        $data['date'] = $today;
    }

    // Backfill missing keys
    $base = empty_usage();
    foreach ($base as $k => $v) {
        if (!isset($data[$k])) $data[$k] = $v;
    }

    $data[$modelId] = isset($data[$modelId]) ? $data[$modelId] + 1 : 1;

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $data;
}

function get_usage_for_response() {
    global $ALL_MODELS;
    $data = read_usage();
    $today = (new DateTime('now', new DateTimeZone('America/Los_Angeles')))->format('Y-m-d');
    if (!isset($data['date']) || $data['date'] !== $today) {
        $result = [];
        foreach ($ALL_MODELS as $m) $result[$m] = 0;
        return $result;
    }
    $result = [];
    foreach ($ALL_MODELS as $m) {
        $result[$m] = isset($data[$m]) ? (int)$data[$m] : 0;
    }
    return $result;
}

function get_usage_limits() {
    global $config;
    return isset($config['usage_limits']) ? $config['usage_limits'] : [
        'flash' => 200, 'flash-thinking' => 200, 'pro' => 80, 'sonnet' => 50, 'opus' => 20,
    ];
}

// --- Provider routing ---

// Map model identifiers to providers
$geminiModels = [
    'flash'          => 'gemini-2.5-flash',
    'flash-thinking' => 'gemini-2.5-flash',
    'pro'            => 'gemini-2.5-pro',
];
$anthropicModels = [
    'sonnet' => 'claude-sonnet-4-20250514',
    'opus'   => 'claude-opus-4-20250514',
];

if (isset($geminiModels[$modelId])) {
    $provider = 'gemini';
} elseif (isset($anthropicModels[$modelId])) {
    $provider = 'anthropic';
} else {
    // Default to flash for unknown models
    $modelId = 'flash';
    $provider = 'gemini';
}

// Claude models require login
if ($provider === 'anthropic' && !is_logged_in()) {
    $modelId = 'flash';
    $provider = 'gemini';
}

// --- Mock mode ---

if (is_mock_mode()) {
    // Simulate API latency
    usleep(rand(1500, 2000) * 1000);

    $resultText = mock_generate_response($inputText, $modelId);

    // Still save to DB if logged in and DB is available
    $mealId = null;
    if (is_logged_in() && mock_has_db()) {
        $mealId = save_to_db($inputText, $inputImage, $inputThumbnail, $modelId, $resultText);
    }

    // Return real usage + a mock_bump for the client to accumulate locally
    $resp = [
        'result'    => $resultText,
        'model'     => $modelId,
        'usage'     => get_usage_for_response(),
        'limits'    => get_usage_limits(),
        'mock_bump' => rand(1, 8),
    ];
    if ($mealId) $resp['meal_id'] = $mealId;
    json_response($resp);
}

// --- Quota check (all models, when hard stop is enabled) ---

$currentUsage = get_usage_for_response();
$usageLimits = get_usage_limits();
$hardStop = isset($config['usage_hard_stop']) ? $config['usage_hard_stop'] : true;

if ($hardStop) {
    $limit = isset($usageLimits[$modelId]) ? $usageLimits[$modelId] : 0;
    $count = isset($currentUsage[$modelId]) ? $currentUsage[$modelId] : 0;

    if ($limit > 0 && $count >= $limit) {
        // Suggest alternatives that still have quota
        $modelNames = [
            'flash' => 'Flash', 'flash-thinking' => 'Flash Thinking',
            'pro' => 'Pro', 'sonnet' => 'Sonnet', 'opus' => 'Opus',
        ];
        $suggestions = [];
        foreach ($usageLimits as $altModel => $altLimit) {
            if ($altModel === $modelId) continue;
            $altCount = isset($currentUsage[$altModel]) ? $currentUsage[$altModel] : 0;
            if ($altCount < $altLimit) {
                // Skip Claude models for logged-out users
                if (($altModel === 'sonnet' || $altModel === 'opus') && !is_logged_in()) continue;
                $suggestions[] = isset($modelNames[$altModel]) ? $modelNames[$altModel] : $altModel;
            }
        }
        $altMsg = count($suggestions) > 0 ? ' Try ' . implode(' or ', $suggestions) . '.' : '';
        $displayName = isset($modelNames[$modelId]) ? $modelNames[$modelId] : $modelId;
        json_response([
            'error' => 'Daily limit reached for ' . $displayName . ' (' . $count . '/' . $limit . ') — resets at midnight PT.' . $altMsg,
            'usage' => $currentUsage,
            'limits' => $usageLimits,
            'quota_exceeded' => true,
        ], 429);
    }
}

// --- Gemini provider ---

if ($provider === 'gemini') {
    $apiKey = isset($config['gemini_api_key']) ? $config['gemini_api_key'] : '';
    if (!$apiKey || $apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        json_error('Gemini API key not configured', 500);
    }

    $geminiModel = $geminiModels[$modelId];
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $geminiModel . ':generateContent?key=' . urlencode($apiKey);

    // Build contents array
    $parts = [];

    // Add text part
    if ($inputText !== '') {
        $parts[] = ['text' => $inputText];
    }

    // Add image part
    if ($inputImage) {
        // Strip data URI prefix if present
        $imageData = $inputImage;
        $mimeType = 'image/jpeg';
        if (preg_match('/^data:(image\/[a-z]+);base64,/', $inputImage, $matches)) {
            $mimeType = $matches[1];
            $imageData = substr($inputImage, strlen($matches[0]));
        }
        $parts[] = [
            'inline_data' => [
                'mime_type' => $mimeType,
                'data' => $imageData,
            ],
        ];
        // If no text was provided, add a generic prompt
        if ($inputText === '') {
            array_unshift($parts, ['text' => 'What is this meal and how many calories?']);
        }
    }

    $payload = [
        'system_instruction' => [
            'parts' => [['text' => $systemPrompt]],
        ],
        'contents' => [
            ['parts' => $parts],
        ],
        'tools' => [
            ['google_search' => new stdClass()],
        ],
    ];

    // Flash Thinking uses thinkingConfig
    if ($modelId === 'flash-thinking') {
        $payload['generationConfig'] = [
            'thinkingConfig' => ['thinkingBudget' => 1024],
        ];
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 55,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        $msg = strpos($curlError, 'timed out') !== false || strpos($curlError, 'Timeout') !== false
            ? 'Gemini took too long to respond. Try again or use a faster model.'
            : 'Failed to connect to Gemini API: ' . $curlError;
        json_response(['error' => $msg, 'usage' => get_usage_for_response(), 'limits' => get_usage_limits(), 'timeout' => true], 504);
    }

    $data = json_decode($response, true);

    if ($httpCode !== 200) {
        $errorMsg = 'Gemini API error';
        if (isset($data['error']['message'])) {
            $errorMsg = $data['error']['message'];
        }
        $status = 502;
        if ($httpCode === 429) {
            $errorMsg = 'Too many requests — wait a moment and try again.';
            $status = 429;
        }
        json_response(['error' => $errorMsg, 'usage' => get_usage_for_response(), 'limits' => get_usage_limits()], $status);
    }

    // Extract text from response
    $resultText = '';
    if (isset($data['candidates'][0]['content']['parts'])) {
        foreach ($data['candidates'][0]['content']['parts'] as $part) {
            if (isset($part['text'])) {
                $resultText .= $part['text'];
            }
        }
    }

    if ($resultText === '') {
        json_error('Empty response from Gemini', 502);
    }

    // Increment usage counter and save to DB
    $updatedUsage = increment_usage($modelId);
    $mealId = save_to_db($inputText, $inputImage, $inputThumbnail, $modelId, $resultText);

    $resp = [
        'result' => $resultText,
        'model'  => $modelId,
        'usage'  => get_usage_for_response(),
        'limits' => get_usage_limits(),
    ];
    if ($mealId) $resp['meal_id'] = $mealId;
    json_response($resp);
}

// --- Anthropic provider ---

if ($provider === 'anthropic') {
    $apiKey = isset($config['anthropic_api_key']) ? $config['anthropic_api_key'] : '';
    if (!$apiKey || $apiKey === 'YOUR_ANTHROPIC_API_KEY_HERE') {
        json_error('Anthropic API key not configured', 500);
    }

    $anthropicModel = $anthropicModels[$modelId];

    // Build messages content
    $contentBlocks = [];

    if ($inputImage) {
        // Strip data URI prefix if present
        $imageData = $inputImage;
        $mimeType = 'image/jpeg';
        if (preg_match('/^data:(image\/[a-z]+);base64,/', $inputImage, $matches)) {
            $mimeType = $matches[1];
            $imageData = substr($inputImage, strlen($matches[0]));
        }
        $contentBlocks[] = [
            'type' => 'image',
            'source' => [
                'type' => 'base64',
                'media_type' => $mimeType,
                'data' => $imageData,
            ],
        ];
    }

    $textContent = $inputText !== '' ? $inputText : 'What is this meal and how many calories?';
    $contentBlocks[] = [
        'type' => 'text',
        'text' => $textContent,
    ];

    $payload = [
        'model' => $anthropicModel,
        'max_tokens' => 1024,
        'system' => $systemPrompt,
        'tools' => [
            [
                'type' => 'web_search_20250305',
                'name' => 'web_search',
                'max_uses' => 3,
            ],
        ],
        'messages' => [
            [
                'role' => 'user',
                'content' => $contentBlocks,
            ],
        ],
    ];

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-api-key: ' . $apiKey,
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 90,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        $msg = strpos($curlError, 'timed out') !== false || strpos($curlError, 'Timeout') !== false
            ? 'Claude took too long to respond. Try again or use a different model.'
            : 'Failed to connect to Claude API: ' . $curlError;
        json_response(['error' => $msg, 'usage' => get_usage_for_response(), 'limits' => get_usage_limits(), 'timeout' => true], 504);
    }

    $data = json_decode($response, true);

    if ($httpCode !== 200) {
        $errorMsg = 'Claude API error';
        if (isset($data['error']['message'])) {
            $errorMsg = $data['error']['message'];
        }
        $status = 502;
        if ($httpCode === 429) {
            $errorMsg = 'Claude is rate limited — wait a moment and try again.';
            $status = 429;
        } elseif ($httpCode === 529) {
            $errorMsg = 'Claude is temporarily overloaded — please try again shortly.';
            $status = 529;
        } elseif ($httpCode === 401) {
            $errorMsg = 'Claude API key is invalid. Please contact the admin.';
            $status = 401;
        }
        json_response(['error' => $errorMsg, 'usage' => get_usage_for_response(), 'limits' => get_usage_limits()], $status);
    }

    // Extract text from response
    $resultText = '';
    if (isset($data['content'])) {
        foreach ($data['content'] as $block) {
            if (isset($block['type']) && $block['type'] === 'text' && isset($block['text'])) {
                $resultText .= $block['text'];
            }
        }
    }

    if ($resultText === '') {
        json_error('Empty response from Claude', 502);
    }

    // Increment usage counter and save to DB
    $updatedUsage = increment_usage($modelId);
    $mealId = save_to_db($inputText, $inputImage, $inputThumbnail, $modelId, $resultText);

    $resp = [
        'result' => $resultText,
        'model'  => $modelId,
        'usage'  => get_usage_for_response(),
        'limits' => get_usage_limits(),
    ];
    if ($mealId) $resp['meal_id'] = $mealId;
    json_response($resp);
}

// --- Save to database (logged-in users only) ---

function save_to_db($inputText, $inputImage, $thumbnail, $modelId, $responseText) {
    if (!is_logged_in()) {
        return null;
    }

    try {
        $db = get_db();
        $stmt = $db->prepare(
            'INSERT INTO meals (user_id, input_type, input_text, thumbnail, model_used, gemini_response, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())'
        );
        $stmt->execute([
            get_current_user_id(),
            $inputImage ? 'photo' : 'text',
            $inputText !== '' ? $inputText : null,
            $thumbnail,
            $modelId,
            $responseText,
        ]);
        return (int)$db->lastInsertId();
    } catch (Exception $e) {
        // Log but don't fail the request
        error_log('Failed to save meal to DB: ' . $e->getMessage());
        return null;
    }
}
