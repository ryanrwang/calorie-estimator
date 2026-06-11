<?php
/**
 * Mock mode helpers — fake API responses and auth bypass for UI testing.
 * Requires session_start() to have been called.
 */

/**
 * Check and apply ?mock=1 / ?mock=0 URL override, then return whether mock mode is active.
 */
function is_mock_mode() {
    $config = require __DIR__ . '/config.php';

    // Mock mode must be explicitly enabled for this deployment. Off by default
    // so a stray ?mock= can never enable it (or bypass anything) in production.
    // Owners opt in per-environment via 'allow_mock' (or force-on via 'mock_mode').
    $allowed = !empty($config['allow_mock']) || !empty($config['mock_mode']);
    if (!$allowed) {
        return false;
    }

    // URL toggle (only honored on mock-enabled deployments)
    if (isset($_GET['mock'])) {
        $_SESSION['mock_mode'] = $_GET['mock'] === '1';
    }

    // Session override takes priority
    if (isset($_SESSION['mock_mode'])) {
        return (bool)$_SESSION['mock_mode'];
    }

    // Fall back to config flag
    return !empty($config['mock_mode']);
}

/**
 * Check if a database connection is available.
 */
function mock_has_db() {
    try {
        get_db();
        return true;
    } catch (Exception $e) {
        return false;
    }
}

/**
 * Generate a mock calorie estimate response.
 * Returns the response text in the same format as real AI responses.
 */
function mock_generate_response($inputText, $modelId) {
    $foodPool = [
        ['name' => 'Grilled chicken breast', 'low' => 165, 'high' => 220, 'alts' => ['Chicken breast grilled']],
        ['name' => 'Brown rice (1 cup)', 'low' => 215, 'high' => 250, 'alts' => ['Brown rice cooked']],
        ['name' => 'Caesar salad', 'low' => 300, 'high' => 450, 'alts' => []],
        ['name' => 'Banana', 'low' => 90, 'high' => 120, 'alts' => []],
        ['name' => 'Scrambled eggs (2)', 'low' => 180, 'high' => 240, 'alts' => ['Eggs scrambled']],
        ['name' => 'Slice of pepperoni pizza', 'low' => 280, 'high' => 350, 'alts' => ['Pepperoni pizza slice']],
        ['name' => 'Greek yogurt (6oz)', 'low' => 100, 'high' => 150, 'alts' => ['Greek yogurt plain']],
        ['name' => 'Turkey sandwich', 'low' => 350, 'high' => 480, 'alts' => []],
        ['name' => 'Latte (12oz)', 'low' => 150, 'high' => 200, 'alts' => ['Caffe latte']],
        ['name' => 'French fries (medium)', 'low' => 320, 'high' => 420, 'alts' => ['Fries fast food']],
        ['name' => 'Salmon fillet (6oz)', 'low' => 280, 'high' => 360, 'alts' => ['Salmon grilled']],
        ['name' => 'Avocado toast', 'low' => 250, 'high' => 350, 'alts' => []],
        ['name' => 'Chocolate chip cookie', 'low' => 180, 'high' => 250, 'alts' => []],
        ['name' => 'Bowl of oatmeal', 'low' => 150, 'high' => 220, 'alts' => ['Oatmeal cooked']],
        ['name' => 'Burrito bowl', 'low' => 550, 'high' => 750, 'alts' => ['Chipotle burrito bowl']],
        ['name' => 'Goong Aob Woon Sen (1 plate)', 'low' => 600, 'high' => 800, 'alts' => ['Goong Ob Woonsen', 'Shrimp and glass noodles']],
        ['name' => 'Pad See Ew (1 plate)', 'low' => 700, 'high' => 950, 'alts' => ['Pad See-Ew', 'Stir-fried wide rice noodles']],
    ];

    $sources = [
        'Source: Mock data for testing.',
        'Source: Estimated from typical preparation.',
        'Source: USDA FoodData Central (mock).',
        'Source: Nutritionix database (mock).',
    ];

    $notes = [
        'Note: Actual calories depend on portion size and preparation method.',
        'Note: Range accounts for variation in serving sizes.',
        'Note: Dressing and toppings can add 50–150 cal.',
        'Note: Cooking method (fried vs baked) significantly affects total.',
        '',
    ];

    // If prompt starts with a number, use that as item count
    $count = rand(1, 4);
    if (preg_match('/^\s*(\d+)/', $inputText, $m)) {
        $count = max(1, min((int)$m[1], count($foodPool)));
    }
    shuffle($foodPool);
    $items = array_slice($foodPool, 0, $count);

    $totalLow = 0;
    $totalHigh = 0;
    $lines = [];

    foreach ($items as $item) {
        // Add some randomness within the range
        $low = $item['low'] + rand(-15, 15);
        $high = $item['high'] + rand(-15, 15);
        if ($low < 10) $low = 10;
        if ($high <= $low) $high = $low + 30;
        $totalLow += $low;
        $totalHigh += $high;
        $lines[] = $item['name'] . ' — ' . $low . '–' . $high;
    }

    $lines[] = 'Total: ~' . $totalLow . '–' . $totalHigh . ' cal';
    $lines[] = $sources[array_rand($sources)];
    $note = $notes[array_rand($notes)];
    if ($note !== '') {
        $lines[] = $note;
    }

    $lines[] = '';
    $lines[] = 'Names:';
    foreach ($items as $item) {
        // Strip "(portion)" from the original to match the prompt rule
        $bare = trim(preg_replace('/\s*\([^)]*\)\s*$/', '', $item['name']));
        $parts = [$bare !== '' ? $bare : $item['name']];
        if (!empty($item['alts'])) {
            foreach ($item['alts'] as $alt) {
                $parts[] = $alt;
            }
        }
        $lines[] = implode(' | ', $parts);
    }

    return implode("\n", $lines);
}
