<?php
session_start();

require_once __DIR__ . '/../includes/csrf.php';
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
$modelId = isset($body['model']) ? $body['model'] : 'flash';

if ($inputText === '' && !$inputImage) {
    json_error('Please provide a text description or photo of your meal.');
}

// --- System prompt (shared across all providers) ---

$systemPrompt = <<<'PROMPT'
You are a calorie estimation assistant. When the user uploads a photo of a meal or describes what they ate, respond with a quick calorie estimate as a range (low to high).

Keep responses short and to the point. No lengthy explanations unless the user asks for them.

When the user mentions a specific restaurant or menu item, always search the web before responding. Look for the restaurant's official nutrition info, MyFitnessPal entries, Nutritionix, CalorieKing, or similar databases. If official data exists, use it and note the source. If not, estimate based on typical preparation methods for that restaurant or cuisine style.

For photos, identify each visible item and estimate portion sizes based on visual cues like plate size, utensils, and item proportions relative to each other.

For text descriptions, ask for portion size only if it would significantly change the estimate. Otherwise just give your best range.

Use simple, generic item names that are easy to search in LoseIt. Avoid overly specific or descriptive names. For example, use "chicken breast grilled" instead of "herb-crusted free-range chicken breast." If a restaurant-specific entry is likely to exist in LoseIt (e.g. "McDonald's Big Mac"), use that name instead.

Response format is strict. Always follow this order, no exceptions:
1. Item list with calorie ranges (one item per line)
2. Total calorie range
3. Any notes, sources, caveats, or explanations come last

Never put commentary, context, or disclaimers above the item list. Example:
Chicken shawarma wrap — 450–600
Total: ~450–600 cal
Source: Estimated, no official data found for ShawarBite.
Note: Range depends on wrap size and amount of sauce. If fries are stuffed inside, could push to 650–700.

If the image is unclear or you genuinely cannot identify the food, say so and ask for clarification. Do not guess wildly.

Do not add health advice, dietary recommendations, or commentary unless the user asks.
PROMPT;

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
        json_error('Failed to connect to Gemini API: ' . $curlError, 502);
    }

    $data = json_decode($response, true);

    if ($httpCode !== 200) {
        $errorMsg = 'Gemini API error';
        if (isset($data['error']['message'])) {
            $errorMsg = $data['error']['message'];
        }
        json_error($errorMsg, 502);
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

    json_response([
        'result' => $resultText,
        'model'  => $modelId,
    ]);
}

// --- Anthropic provider (Session 2) ---

if ($provider === 'anthropic') {
    // TODO: Implement in Session 2
    // Will use https://api.anthropic.com/v1/messages
    // Different auth header (x-api-key), different request format
    json_error('Claude models are not yet available. Coming in Session 2.', 501);
}
